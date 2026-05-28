import { Request, Response } from 'express'
import logger from '../../lib/logger'
import {
  getWorkspaceTeamContext,
  inviteTeamMember,
  listAvailablePermissions,
  listTeamMembers,
  removeTeamMember,
  updateTeamMemberPermission,
} from '../../services/team/team.service'

function getEmail(req: Request): string | undefined {
  return req.user?.email
}

function handleTeamError(res: Response, error: unknown, context: string) {
  const err = error as Error & { status?: number; code?: string }
  logger.error(`[${context}]`, err.message)
  const status = err.status || 500
  return res.status(status).json({
    error: err.message || 'Erro ao processar equipe',
    code: err.code,
  })
}

export async function getTeamWorkspace(req: Request, res: Response) {
  try {
    const email = getEmail(req)
    if (!email) return res.status(401).json({ error: 'Usuário não autenticado' })
    const ctx = await getWorkspaceTeamContext(email)
    return res.json(ctx)
  } catch (error) {
    return handleTeamError(res, error, 'getTeamWorkspace')
  }
}

export async function getTeamMembers(req: Request, res: Response) {
  try {
    const email = getEmail(req)
    if (!email) return res.status(401).json({ error: 'Usuário não autenticado' })
    const members = await listTeamMembers(email)
    return res.json({ members })
  } catch (error) {
    return handleTeamError(res, error, 'getTeamMembers')
  }
}

export async function getTeamPermissions(req: Request, res: Response) {
  try {
    const permissions = await listAvailablePermissions()
    return res.json({ permissions })
  } catch (error) {
    return handleTeamError(res, error, 'getTeamPermissions')
  }
}

export async function postTeamInvite(req: Request, res: Response) {
  try {
    const email = getEmail(req)
    if (!email) return res.status(401).json({ error: 'Usuário não autenticado' })

    const memberEmail = String(req.body?.email || req.body?.memberEmail || '').trim()
    const permissionKey = String(req.body?.permissionKey || 'basic.read').trim()

    const result = await inviteTeamMember(email, memberEmail, permissionKey)
    return res.json(result)
  } catch (error) {
    return handleTeamError(res, error, 'postTeamInvite')
  }
}

export async function putTeamMemberPermission(req: Request, res: Response) {
  try {
    const email = getEmail(req)
    if (!email) return res.status(401).json({ error: 'Usuário não autenticado' })

    const memberEmail = String(req.body?.email || '').trim()
    const permissionKey = String(req.body?.permissionKey || req.body?.newPermissionKey || '').trim()

    const result = await updateTeamMemberPermission(email, memberEmail, permissionKey)
    return res.json(result)
  } catch (error) {
    return handleTeamError(res, error, 'putTeamMemberPermission')
  }
}

export async function deleteTeamMember(req: Request, res: Response) {
  try {
    const email = getEmail(req)
    if (!email) return res.status(401).json({ error: 'Usuário não autenticado' })

    const memberEmail = String(req.params.email || req.body?.email || '').trim()
    const result = await removeTeamMember(email, memberEmail)
    return res.json(result)
  } catch (error) {
    return handleTeamError(res, error, 'deleteTeamMember')
  }
}
