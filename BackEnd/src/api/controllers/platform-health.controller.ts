import type { Request, Response } from 'express'
import { supabase } from '../../lib/supabase'
import { listRecentSecurityAuditEvents } from '../../services/security/audit-log.service'
import { isMetaWebhookConfigured } from '../../services/integrations/whatsapp/meta-webhook-secret.service'
import { getAuthenticatedEmail } from '../../utils/request-auth'
import { isPlatformAdminEmail } from '../../utils/platform-admin'

const startedAt = Date.now()

export async function getPlatformHealth(req: Request, res: Response) {
  try {
    const email = getAuthenticatedEmail(req)
    if (!email || !isPlatformAdminEmail(email)) {
      return res.status(403).json({ error: 'Acesso restrito a administradores da plataforma', code: 'PLATFORM_ADMIN_REQUIRED' })
    }

    let databaseOk = false
    try {
      const { error } = await supabase.from('tb_companies').select('id').limit(1)
      databaseOk = !error
    } catch {
      databaseOk = false
    }

    let auditEvents: unknown[] = []
    try {
      auditEvents = await listRecentSecurityAuditEvents(20)
    } catch {
      auditEvents = []
    }

    let metaWebhookConfigured = false
    try {
      metaWebhookConfigured = await isMetaWebhookConfigured()
    } catch {
      metaWebhookConfigured = Boolean(process.env.WHATSAPP_META_APP_SECRET?.trim())
    }

    return res.json({
      success: true,
      environment: process.env.NODE_ENV || 'development',
      version: process.env.APP_VERSION || '1.0.0',
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      checks: {
        backend: true,
        database: databaseOk,
        stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
        metaWebhookConfigured,
        corsConfigured: Boolean(process.env.CORS_ALLOWED_ORIGINS?.trim()),
      },
      recentAuditEvents: auditEvents,
    })
  } catch (error: unknown) {
    return res.status(500).json({
      error: 'Erro ao obter saúde da plataforma',
      details: error instanceof Error ? error.message : String(error),
    })
  }
}
