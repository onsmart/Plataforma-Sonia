import { supabase } from '../../../lib/supabase'
import logger from '../../../lib/logger'

/** Flag global (env) — rollout sem migration em tb_integrations. */
export function isGlobalTemplatesEnabled(): boolean {
  return String(process.env.WHATSAPP_TEMPLATES_ENABLED || '').toLowerCase() === 'true'
}

export function isGlobalCampaignsEnabled(): boolean {
  return String(process.env.WHATSAPP_CAMPAIGNS_ENABLED || '').toLowerCase() === 'true'
}

/**
 * Templates habilitados se env global OU registro em tb_whatsapp_integration_feature_flags.
 * Falha silenciosa se a tabela ainda não existir (migration não aplicada).
 */
export async function isCampaignsEnabledForIntegration(integrationId: string): Promise<boolean> {
  if (isGlobalCampaignsEnabled()) {
    return true
  }

  try {
    const { data, error } = await supabase
      .from('tb_whatsapp_integration_feature_flags')
      .select('campaigns_enabled')
      .eq('integrations_id', integrationId)
      .maybeSingle()

    if (error) {
      if (String(error.message || '').includes('does not exist') || error.code === '42P01') {
        return false
      }
      logger.warn('[whatsapp-feature-flags] Erro ao ler campaigns_enabled', {
        integrationId,
        error: error.message
      })
      return false
    }

    return Boolean(data?.campaigns_enabled)
  } catch (err: any) {
    logger.warn('[whatsapp-feature-flags] Excecao campaigns flag', { integrationId, error: err?.message })
    return false
  }
}

export async function isTemplatesEnabledForIntegration(integrationId: string): Promise<boolean> {
  if (isGlobalTemplatesEnabled()) {
    return true
  }

  try {
    const { data, error } = await supabase
      .from('tb_whatsapp_integration_feature_flags')
      .select('templates_enabled')
      .eq('integrations_id', integrationId)
      .maybeSingle()

    if (error) {
      if (String(error.message || '').includes('does not exist') || error.code === '42P01') {
        return false
      }
      logger.warn('[whatsapp-feature-flags] Erro ao ler flags por integracao', {
        integrationId,
        error: error.message
      })
      return false
    }

    return Boolean(data?.templates_enabled)
  } catch (err: any) {
    logger.warn('[whatsapp-feature-flags] Excecao ao ler flags', { integrationId, error: err?.message })
    return false
  }
}
