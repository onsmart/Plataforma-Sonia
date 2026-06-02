import { supabase } from '../../../lib/supabase'
import logger from '../../../lib/logger'
import { extractMetaWebhookPhoneNumberIds } from '../../../utils/meta-webhook-payload'

const MAX_WEBHOOK_SECRET_CANDIDATES = 48

export function getEnvMetaAppSecret(): string {
  return String(process.env.WHATSAPP_META_APP_SECRET || '').trim()
}

function dedupeSecrets(secrets: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const secret of secrets) {
    const normalized = String(secret || '').trim()
    if (!normalized || seen.has(normalized)) {
      continue
    }
    seen.add(normalized)
    result.push(normalized)
  }

  return result
}

export function isMissingMetaAppSecretColumn(error: { message?: string; details?: string } | null | undefined): boolean {
  const message = String(error?.message || error?.details || '').toLowerCase()
  return message.includes('column') && message.includes('meta_app_secret')
}

function secretsFromRows(data: unknown): string[] {
  const secrets: string[] = []
  for (const row of (Array.isArray(data) ? data : []) as Array<{ meta_app_secret?: string | null }>) {
    const secret = String(row.meta_app_secret || '').trim()
    if (secret) secrets.push(secret)
  }
  return secrets
}

async function loadIntegrationSecretsByPhoneNumberIds(phoneNumberIds: string[]): Promise<string[]> {
  if (phoneNumberIds.length === 0) {
    return []
  }

  const { data, error } = await supabase
    .from('tb_integrations')
    .select('app_key, meta_app_secret')
    .eq('provider', 'whatsapp')
    .in('app_key', phoneNumberIds)

  if (error) {
    if (isMissingMetaAppSecretColumn(error)) {
      logger.error(
        '[meta-webhook-secret] Coluna meta_app_secret ausente em tb_integrations — aplique MIGRATION_WHATSAPP_META_APP_SECRET.sql'
      )
      return []
    }
    logger.warn('[meta-webhook-secret] Falha ao buscar meta_app_secret por phone_number_id', {
      phoneNumberIds,
      error: error.message,
    })
    return []
  }

  return secretsFromRows(data)
}

async function loadAllWhatsAppIntegrationSecrets(): Promise<string[]> {
  const { data, error } = await supabase
    .from('tb_integrations')
    .select('meta_app_secret')
    .eq('provider', 'whatsapp')
    .not('meta_app_secret', 'is', null)
    .neq('meta_app_secret', '')
    .limit(MAX_WEBHOOK_SECRET_CANDIDATES)

  if (error) {
    if (isMissingMetaAppSecretColumn(error)) {
      logger.error(
        '[meta-webhook-secret] Coluna meta_app_secret ausente em tb_integrations — aplique MIGRATION_WHATSAPP_META_APP_SECRET.sql'
      )
      return []
    }
    logger.warn('[meta-webhook-secret] Falha ao listar meta_app_secret das integrações WhatsApp', {
      error: error.message,
    })
    return []
  }

  return secretsFromRows(data)
}

/**
 * Candidatos para validar X-Hub-Signature-256:
 * 1) WHATSAPP_META_APP_SECRET (fallback plataforma, opcional)
 * 2) meta_app_secret da integração cujo app_key = phone_number_id do payload
 * 3) Se (2) vazio: todos meta_app_secret de integrações WhatsApp (multi-tenant; HMAC escolhe o correto)
 */
export async function resolveMetaWebhookVerificationSecrets(rawBody: Buffer | string): Promise<string[]> {
  const envSecret = getEnvMetaAppSecret()
  const phoneNumberIds = extractMetaWebhookPhoneNumberIds(rawBody)

  let integrationSecrets: string[] = []
  if (phoneNumberIds.length > 0) {
    integrationSecrets = await loadIntegrationSecretsByPhoneNumberIds(phoneNumberIds)
  }

  if (integrationSecrets.length === 0) {
    integrationSecrets = await loadAllWhatsAppIntegrationSecrets()
    if (integrationSecrets.length > 0) {
      if (phoneNumberIds.length === 0) {
        logger.info(
          '[meta-webhook-secret] phone_number_id ausente no payload; validando com secrets de todas integrações WhatsApp'
        )
      } else {
        logger.warn(
          '[meta-webhook-secret] Nenhum secret para phone_number_id do payload; tentando todas integrações WhatsApp',
          { phoneNumberIds }
        )
      }
    }
  }

  const candidates = dedupeSecrets([envSecret, ...integrationSecrets])
  return candidates.slice(0, MAX_WEBHOOK_SECRET_CANDIDATES + 1)
}

export async function isMetaWebhookConfigured(): Promise<boolean> {
  if (getEnvMetaAppSecret()) {
    return true
  }

  const { count, error } = await supabase
    .from('tb_integrations')
    .select('id', { count: 'exact', head: true })
    .eq('provider', 'whatsapp')
    .not('meta_app_secret', 'is', null)
    .neq('meta_app_secret', '')

  if (error) {
    if (isMissingMetaAppSecretColumn(error)) {
      return false
    }
    logger.warn('[meta-webhook-secret] Falha ao verificar meta_app_secret no banco', {
      error: error.message,
    })
    return false
  }

  return (count || 0) > 0
}
