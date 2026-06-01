import { supabase } from '../../../lib/supabase'
import logger from '../../../lib/logger'
import { extractMetaWebhookPhoneNumberIds } from '../../../utils/meta-webhook-payload'

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
    logger.warn('[meta-webhook-secret] Falha ao buscar meta_app_secret por phone_number_id', {
      phoneNumberIds,
      error: error.message,
    })
    return []
  }

  const secrets: string[] = []
  for (const row of data || []) {
    const secret = String((row as { meta_app_secret?: string | null }).meta_app_secret || '').trim()
    if (secret) {
      secrets.push(secret)
    }
  }

  return secrets
}

/**
 * Candidatos para validar X-Hub-Signature-256:
 * 1) WHATSAPP_META_APP_SECRET (fallback plataforma)
 * 2) meta_app_secret da integração cujo app_key = phone_number_id do payload
 */
export async function resolveMetaWebhookVerificationSecrets(rawBody: Buffer | string): Promise<string[]> {
  const envSecret = getEnvMetaAppSecret()
  const phoneNumberIds = extractMetaWebhookPhoneNumberIds(rawBody)
  const integrationSecrets = await loadIntegrationSecretsByPhoneNumberIds(phoneNumberIds)

  return dedupeSecrets([envSecret, ...integrationSecrets])
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
    logger.warn('[meta-webhook-secret] Falha ao verificar meta_app_secret no banco', {
      error: error.message,
    })
    return false
  }

  return (count || 0) > 0
}
