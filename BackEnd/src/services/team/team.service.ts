import { supabase } from '../../lib/supabase'
import { getCompanyIdByEmail, getUserIdByEmail } from '../../utils/company-helper'
import logger from '../../lib/logger'

const ADMIN_ROLES = new Set(['owner', 'admin'])

export type TeamMemberRow = {
  user_id: string
  name: string
  email: string
  role: string
  created_at: string | null
  permissions: Array<{ key: string; name: string; category: string | null }>
}

async function getCompanyAccountType(companiesId: string): Promise<string> {
  const { data, error } = await supabase
    .from('tb_companies')
    .select('account_type')
    .eq('id', companiesId)
    .maybeSingle()

  if (error) {
    logger.warn('[team.service] Erro ao buscar account_type:', error.message)
  }
  return String(data?.account_type || 'individual')
}

async function assertCompanyMember(adminEmail: string): Promise<{ companiesId: string; userId: string }> {
  const companiesId = await getCompanyIdByEmail(adminEmail)
  if (!companiesId) {
    throw Object.assign(new Error('Empresa não encontrada'), { status: 403 })
  }

  const userId = await getUserIdByEmail(adminEmail)
  if (!userId) {
    throw Object.assign(new Error('Usuário não encontrado'), { status: 403 })
  }

  const { data: membership, error } = await supabase
    .from('tb_company_users')
    .select('user_id')
    .eq('companies_id', companiesId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !membership) {
    throw Object.assign(new Error('Você não pertence a esta empresa'), { status: 403 })
  }

  return { companiesId, userId }
}

async function assertTeamAdmin(adminEmail: string): Promise<{ companiesId: string; adminUserId: string }> {
  const companiesId = await getCompanyIdByEmail(adminEmail)
  if (!companiesId) {
    throw Object.assign(new Error('Empresa não encontrada'), { status: 403 })
  }

  const adminUserId = await getUserIdByEmail(adminEmail)
  if (!adminUserId) {
    throw Object.assign(new Error('Usuário não encontrado'), { status: 403 })
  }

  const { data: membership, error } = await supabase
    .from('tb_company_users')
    .select('role')
    .eq('companies_id', companiesId)
    .eq('user_id', adminUserId)
    .maybeSingle()

  if (error || !membership) {
    throw Object.assign(new Error('Você não pertence a esta empresa'), { status: 403 })
  }

  if (!ADMIN_ROLES.has(String(membership.role || ''))) {
    const { data: adminPerm } = await supabase
      .from('tb_permissions')
      .select('id')
      .eq('key', 'basic.admin')
      .maybeSingle()

    if (adminPerm?.id) {
      const { data: hasAdminPerm } = await supabase
        .from('tb_user_permissions')
        .select('id')
        .eq('user_id', adminUserId)
        .eq('companies_id', companiesId)
        .eq('permission_id', adminPerm.id)
        .maybeSingle()

      if (hasAdminPerm) {
        return { companiesId, adminUserId }
      }
    }

    throw Object.assign(new Error('Apenas administradores podem gerenciar a equipe'), { status: 403 })
  }

  return { companiesId, adminUserId }
}

export async function getWorkspaceTeamContext(adminEmail: string) {
  try {
    const { companiesId } = await assertCompanyMember(adminEmail)

    const { data: company } = await supabase
      .from('tb_companies')
      .select('name, account_type')
      .eq('id', companiesId)
      .maybeSingle()

    const accountType = String(company?.account_type || 'individual')
    return {
      can_manage_team: accountType === 'company',
      account_type: accountType,
      company_name: company?.name ?? null,
    }
  } catch {
    return { can_manage_team: false, account_type: 'individual' as const, company_name: null }
  }
}

export async function listTeamMembers(adminEmail: string): Promise<TeamMemberRow[]> {
  const { companiesId } = await assertCompanyMember(adminEmail)

  const { data: memberships, error: memErr } = await supabase
    .from('tb_company_users')
    .select('user_id, role, created_at')
    .eq('companies_id', companiesId)
    .order('created_at', { ascending: true })

  if (memErr) {
    throw new Error(memErr.message)
  }

  const userIds = (memberships || []).map((m) => m.user_id).filter(Boolean)
  if (userIds.length === 0) return []

  const { data: users, error: usersErr } = await supabase
    .from('tb_users')
    .select('id, name, last_name, email')
    .in('id', userIds)

  if (usersErr) {
    throw new Error(usersErr.message)
  }

  const { data: permRows, error: permErr } = await supabase
    .from('tb_user_permissions')
    .select('user_id, permission_id, tb_permissions(key, name, category)')
    .eq('companies_id', companiesId)
    .in('user_id', userIds)

  if (permErr) {
    logger.warn('[team.service] Permissões não carregadas:', permErr.message)
  }

  const userById = new Map((users || []).map((u) => [u.id, u]))
  const permsByUser = new Map<string, TeamMemberRow['permissions']>()

  for (const row of permRows || []) {
    const uid = row.user_id as string
    const perm = row.tb_permissions as { key?: string; name?: string; category?: string } | null
    if (!uid || !perm?.key) continue
    if (!permsByUser.has(uid)) permsByUser.set(uid, [])
    permsByUser.get(uid)!.push({
      key: perm.key,
      name: perm.name || perm.key,
      category: perm.category ?? null,
    })
  }

  return (memberships || []).map((m) => {
    const user = userById.get(m.user_id)
    const fullName = [user?.name, user?.last_name].filter(Boolean).join(' ').trim()
    return {
      user_id: m.user_id,
      name: fullName || user?.email || 'Membro',
      email: user?.email || '',
      role: m.role,
      created_at: m.created_at,
      permissions: permsByUser.get(m.user_id) || [],
    }
  })
}

export async function listAvailablePermissions() {
  const { data, error } = await supabase
    .from('tb_permissions')
    .select('key, name, category')
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)

  const basic = (data || []).filter((p) => String(p.category || '').toLowerCase() === 'basic')
  return basic.length > 0 ? basic : data || []
}

export async function inviteTeamMember(
  adminEmail: string,
  memberEmail: string,
  permissionKey: string
) {
  const { companiesId, adminUserId } = await assertTeamAdmin(adminEmail)

  const accountType = await getCompanyAccountType(companiesId)
  if (accountType !== 'company') {
    throw Object.assign(
      new Error('Convites de equipe estão disponíveis apenas para contas Pessoa Jurídica'),
      { status: 403, code: 'TEAM_PJ_ONLY' }
    )
  }

  const normalizedMemberEmail = memberEmail.trim().toLowerCase()
  if (!normalizedMemberEmail) {
    throw Object.assign(new Error('E-mail do membro é obrigatório'), { status: 400 })
  }

  const memberUserId = await getUserIdByEmail(normalizedMemberEmail)
  if (!memberUserId) {
    throw Object.assign(
      new Error(
        'Este e-mail ainda não possui cadastro na plataforma. A pessoa deve criar uma conta (Pessoa Física) antes do convite.'
      ),
      { status: 404, code: 'MEMBER_NOT_REGISTERED' }
    )
  }

  const { data: permission, error: permErr } = await supabase
    .from('tb_permissions')
    .select('id, key, name')
    .eq('key', permissionKey)
    .maybeSingle()

  if (permErr || !permission?.id) {
    throw Object.assign(new Error('Permissão inválida'), { status: 400 })
  }

  const { data: existingMembership } = await supabase
    .from('tb_company_users')
    .select('user_id, role')
    .eq('companies_id', companiesId)
    .eq('user_id', memberUserId)
    .maybeSingle()

  if (!existingMembership) {
    const { error: insertMemErr } = await supabase.from('tb_company_users').insert({
      user_id: memberUserId,
      companies_id: companiesId,
      role: 'member',
      status: 'active',
    })

    if (insertMemErr) {
      throw new Error(insertMemErr.message)
    }
  } else if (existingMembership.role === 'owner') {
    throw Object.assign(new Error('O proprietário da empresa já faz parte do time'), { status: 400 })
  }

  await supabase
    .from('tb_user_permissions')
    .delete()
    .eq('user_id', memberUserId)
    .eq('companies_id', companiesId)

  const { error: grantErr } = await supabase.from('tb_user_permissions').insert({
    user_id: memberUserId,
    companies_id: companiesId,
    permission_id: permission.id,
  })

  if (grantErr) {
    throw new Error(grantErr.message)
  }

  return {
    success: true,
    message: `${normalizedMemberEmail} adicionado ao time com sucesso.`,
  }
}

export async function updateTeamMemberPermission(
  adminEmail: string,
  memberEmail: string,
  newPermissionKey: string
) {
  return inviteTeamMember(adminEmail, memberEmail, newPermissionKey)
}

export async function removeTeamMember(adminEmail: string, memberEmail: string) {
  const { companiesId } = await assertTeamAdmin(adminEmail)

  const memberUserId = await getUserIdByEmail(memberEmail.trim().toLowerCase())
  if (!memberUserId) {
    throw Object.assign(new Error('Membro não encontrado'), { status: 404 })
  }

  const { data: membership } = await supabase
    .from('tb_company_users')
    .select('role')
    .eq('companies_id', companiesId)
    .eq('user_id', memberUserId)
    .maybeSingle()

  if (!membership) {
    throw Object.assign(new Error('Membro não pertence a esta empresa'), { status: 404 })
  }

  if (membership.role === 'owner') {
    throw Object.assign(new Error('Não é possível remover o proprietário da empresa'), { status: 400 })
  }

  await supabase
    .from('tb_user_permissions')
    .delete()
    .eq('user_id', memberUserId)
    .eq('companies_id', companiesId)

  const { error } = await supabase
    .from('tb_company_users')
    .delete()
    .eq('companies_id', companiesId)
    .eq('user_id', memberUserId)

  if (error) throw new Error(error.message)

  return { success: true, message: 'Membro removido do time.' }
}
