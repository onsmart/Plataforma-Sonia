import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'

export type SecurityAuditEventInput = {
  companiesId?: string | null
  userId?: string | null
  action: string
  resourceType?: string | null
  resourceId?: string | null
  ipAddress?: string | null
  metadata?: Record<string, unknown>
}

function sanitizeMetadata(metadata?: Record<string, unknown>): Record<string, unknown> {
  if (!metadata || typeof metadata !== 'object') return {}
  const blocked = new Set(['password', 'token', 'api_key', 'apikey', 'secret', 'authorization'])
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(metadata)) {
    if (blocked.has(key.toLowerCase())) continue
    if (typeof value === 'string' && value.length > 500) {
      out[key] = `${value.slice(0, 500)}…`
      continue
    }
    out[key] = value
  }
  return out
}

export async function recordSecurityAuditEvent(input: SecurityAuditEventInput): Promise<void> {
  try {
    const payload = {
      companies_id: input.companiesId || null,
      user_id: input.userId || null,
      action: input.action,
      resource_type: input.resourceType || null,
      resource_id: input.resourceId || null,
      ip_address: input.ipAddress || null,
      metadata: sanitizeMetadata(input.metadata),
    }

    const { error } = await supabase.from('tb_security_audit_events').insert(payload)
    if (error) {
      logger.warn('[recordSecurityAuditEvent] Falha ao persistir evento', {
        action: input.action,
        message: error.message,
      })
    }
  } catch (err) {
    logger.warn('[recordSecurityAuditEvent] Erro inesperado', {
      action: input.action,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

export async function listRecentSecurityAuditEvents(limit = 20) {
  const { data, error } = await supabase
    .from('tb_security_audit_events')
    .select('id, companies_id, user_id, action, resource_type, resource_id, ip_address, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100))

  if (error) {
    throw error
  }

  return data || []
}
