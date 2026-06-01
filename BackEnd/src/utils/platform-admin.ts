import { supabase } from '../lib/supabase'

export const PLATFORM_ADMIN_PLAN_TITLE = 'Administrador'
export const PLATFORM_ADMIN_PLAN_CODE = 'PLATFORM_ADMIN'

export function parsePlatformAdminEmails(): Set<string> {
  return new Set(
    String(process.env.PLATFORM_ADMIN_EMAILS || '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  )
}

export function isPlatformAdminEmail(email: string | null | undefined): boolean {
  const normalized = String(email || '').trim().toLowerCase()
  if (!normalized) return false
  const allowlist = parsePlatformAdminEmails()
  return allowlist.size > 0 && allowlist.has(normalized)
}

export async function getCompanyOwnerEmail(companiesId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('tb_company_users')
    .select('tb_users(email)')
    .eq('companies_id', companiesId)
    .eq('role', 'owner')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null

  const joined = data as { tb_users?: { email?: string | null } | null }
  const email = joined.tb_users?.email
  return typeof email === 'string' && email.trim() ? email.trim() : null
}

export async function resolvePlatformAdminEmail(
  companiesId: string,
  userEmail?: string | null
): Promise<string | null> {
  if (isPlatformAdminEmail(userEmail)) {
    return String(userEmail).trim()
  }

  const ownerEmail = await getCompanyOwnerEmail(companiesId)
  if (isPlatformAdminEmail(ownerEmail)) {
    return ownerEmail
  }

  return null
}
