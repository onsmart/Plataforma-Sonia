import type { Request, Response } from 'express'

export function normalizeAuthEmail(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase()
}

/** Email do JWT — exige `requireAuth` antes. */
export function getAuthenticatedEmail(req: Request): string {
  return normalizeAuthEmail(req.user?.email)
}

/** Workspace do JWT — exige `requireWorkspace` antes. */
export function getAuthenticatedCompaniesId(req: Request): string {
  return String(req.user?.companiesId || '').trim()
}

export function getAuthenticatedUserId(req: Request): string {
  return String(req.user?.userId || '').trim()
}

export type EmailMismatchResult = {
  mismatch: true
  response: { status: number; body: Record<string, unknown> }
}

/** Rejeita body/query email diferente do JWT autenticado. */
export function assertAuthenticatedEmailMatches(
  req: Request,
  bodyOrQueryEmail?: string | null
): EmailMismatchResult | null {
  const authEmail = getAuthenticatedEmail(req)
  if (!authEmail) {
    return {
      mismatch: true,
      response: {
        status: 401,
        body: {
          error: 'Token de autenticação não fornecido',
          code: 'AUTH_REQUIRED',
        },
      },
    }
  }

  const other = normalizeAuthEmail(bodyOrQueryEmail)
  if (other && other !== authEmail) {
    return {
      mismatch: true,
      response: {
        status: 403,
        body: {
          error: 'Email informado não corresponde ao usuário autenticado',
          code: 'EMAIL_MISMATCH',
        },
      },
    }
  }

  return null
}

export function respondEmailMismatch(res: Response, result: EmailMismatchResult): void {
  res.status(result.response.status).json(result.response.body)
}

/** Resolve email apenas do JWT; ignora headers/query legados. */
export function resolveTrustedEmail(req: Request): string {
  return getAuthenticatedEmail(req)
}
