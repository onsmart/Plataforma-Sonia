import logger from '../../../lib/logger'
import { supabase } from '../../../lib/supabase'
import { getCompanyIdByEmail } from '../../../utils/company-helper'
import { ElevenLabsProvider } from '../providers/elevenlabs.provider'
import {
  type UpdateVoiceProfileInput,
  type VoiceProfileRecord,
  type VoiceProfileResponse,
  VoiceModuleError,
} from '../types/voice.types'

const DEFAULT_PREVIEW_TEXT = 'Ola, eu sou o seu agente de IA. Como posso ajudar voce hoje?'

const provider = new ElevenLabsProvider()

function normalizeOptionalString(value: unknown): string | null {
  const normalized = String(value || '').trim()
  return normalized || null
}

function sanitizeText(value: unknown, maxLength: number): string | null {
  const normalized = String(value || '')
    .replace(/[\u0000-\u001F\u007F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!normalized) {
    return null
  }

  return normalized.slice(0, maxLength)
}

function normalizeNumberField(value: unknown, fieldName: string): number | null {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) {
    throw new VoiceModuleError(`Campo ${fieldName} invalido.`, {
      code: 'VOICE_SETTINGS_INVALID',
      statusCode: 400,
    })
  }

  if (parsed < 0 || parsed > 1) {
    throw new VoiceModuleError(`Campo ${fieldName} deve estar entre 0 e 1.`, {
      code: 'VOICE_SETTINGS_OUT_OF_RANGE',
      statusCode: 400,
    })
  }

  return Number(parsed.toFixed(4))
}

function normalizeSpeedField(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) {
    throw new VoiceModuleError('Campo speed invalido.', {
      code: 'VOICE_SETTINGS_INVALID',
      statusCode: 400,
    })
  }

  if (parsed < 0.7 || parsed > 1.2) {
    throw new VoiceModuleError('Campo speed deve estar entre 0.7 e 1.2 para manter uma fala natural.', {
      code: 'VOICE_SETTINGS_OUT_OF_RANGE',
      statusCode: 400,
    })
  }

  return Number(parsed.toFixed(4))
}

function mapRecord(row: any): VoiceProfileRecord {
  return {
    id: String(row.id),
    agentId: String(row.agent_id),
    provider: 'elevenlabs',
    voiceId: String(row.voice_id),
    voiceName: normalizeOptionalString(row.voice_name),
    modelId: normalizeOptionalString(row.model_id),
    stability: row.stability === null || row.stability === undefined ? null : Number(row.stability),
    similarityBoost:
      row.similarity_boost === null || row.similarity_boost === undefined ? null : Number(row.similarity_boost),
    style: row.style === null || row.style === undefined ? null : Number(row.style),
    speed: row.speed === null || row.speed === undefined ? null : Number(row.speed),
    useSpeakerBoost: row.use_speaker_boost !== false,
    previewText: normalizeOptionalString(row.preview_text),
    enabled: row.enabled !== false,
    callsEnabled: row.calls_enabled === true,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

async function assertAgentAccess(agentId: string, email: string): Promise<{ agentId: string; companiesId: string }> {
  const normalizedAgentId = String(agentId || '').trim()
  if (!normalizedAgentId) {
    throw new VoiceModuleError('agentId invalido.', {
      code: 'AGENT_ID_INVALID',
      statusCode: 400,
    })
  }

  const companiesId = await getCompanyIdByEmail(email)
  if (!companiesId) {
    throw new VoiceModuleError('Empresa nao encontrada para o usuario autenticado.', {
      code: 'VOICE_AGENT_FORBIDDEN',
      statusCode: 403,
    })
  }

  const { data, error } = await supabase
    .from('tb_agents')
    .select('id, companies_id')
    .eq('id', normalizedAgentId)
    .eq('companies_id', companiesId)
    .maybeSingle()

  if (error) {
    logger.error('[voice.profile] Erro ao validar acesso ao agente', {
      agentId: normalizedAgentId,
      email,
      error: error.message,
    })
    throw new VoiceModuleError('Erro ao validar acesso ao agente.', {
      code: 'VOICE_AGENT_LOOKUP_FAILED',
      statusCode: 500,
      cause: error,
    })
  }

  if (!data) {
    throw new VoiceModuleError('Agente nao encontrado ou sem permissao.', {
      code: 'VOICE_AGENT_FORBIDDEN',
      statusCode: 404,
    })
  }

  return {
    agentId: normalizedAgentId,
    companiesId,
  }
}

export async function getAgentVoiceProfile(agentId: string, email: string): Promise<VoiceProfileResponse> {
  const access = await assertAgentAccess(agentId, email)

  const { data, error } = await supabase
    .from('tb_agent_voice_profiles')
    .select('*')
    .eq('agent_id', access.agentId)
    .maybeSingle()

  if (error) {
    logger.error('[voice.profile] Erro ao buscar perfil de voz', {
      agentId: access.agentId,
      email,
      error: error.message,
    })
    throw new VoiceModuleError('Erro ao buscar perfil de voz do agente.', {
      code: 'VOICE_PROFILE_FETCH_FAILED',
      statusCode: 500,
      cause: error,
    })
  }

  return {
    profile: data ? mapRecord(data) : null,
    defaults: {
      provider: 'elevenlabs',
      modelId: normalizeOptionalString(process.env.ELEVENLABS_DEFAULT_MODEL_ID),
      previewText: DEFAULT_PREVIEW_TEXT,
    },
    providerConfigured: provider.isConfigured(),
  }
}

export async function saveAgentVoiceProfile(
  agentId: string,
  email: string,
  input: UpdateVoiceProfileInput
): Promise<VoiceProfileResponse> {
  const access = await assertAgentAccess(agentId, email)
  const voiceId = String(input.voiceId || '').trim()

  if (!voiceId) {
    throw new VoiceModuleError('voiceId e obrigatorio.', {
      code: 'VOICE_ID_REQUIRED',
      statusCode: 400,
    })
  }

  if (provider.isConfigured()) {
    const voice = await provider.getVoice(voiceId)
    if (!voice) {
      throw new VoiceModuleError('A voz selecionada nao foi encontrada na ElevenLabs.', {
        code: 'VOICE_NOT_FOUND',
        statusCode: 400,
      })
    }
  }

  const payload = {
    agent_id: access.agentId,
    provider: 'elevenlabs',
    voice_id: voiceId,
    voice_name: sanitizeText(input.voiceName, 150),
    model_id: normalizeOptionalString(input.modelId) || normalizeOptionalString(process.env.ELEVENLABS_DEFAULT_MODEL_ID),
    stability: normalizeNumberField(input.stability, 'stability'),
    similarity_boost: normalizeNumberField(input.similarityBoost, 'similarityBoost'),
    style: normalizeNumberField(input.style, 'style'),
    speed: normalizeSpeedField(input.speed),
    use_speaker_boost: typeof input.useSpeakerBoost === 'boolean' ? input.useSpeakerBoost : true,
    preview_text: sanitizeText(input.previewText, 500),
    enabled: input.enabled !== false,
    calls_enabled: input.callsEnabled === true,
  }

  const { error } = await supabase
    .from('tb_agent_voice_profiles')
    .upsert(payload, {
      onConflict: 'agent_id',
    })

  if (error) {
    const errMsg = String(error.message || '')
    const missingSpeed =
      /speed/i.test(errMsg) && (/schema cache|column/i.test(errMsg) || errMsg.includes('PGRST204'))
    logger.error('[voice.profile] Erro ao salvar perfil de voz', {
      agentId: access.agentId,
      email,
      error: errMsg,
    })
    if (missingSpeed) {
      throw new VoiceModuleError(
        'O banco ainda nao tem a coluna "speed" na tabela de voz. No Supabase (SQL Editor), rode o arquivo BackEnd/database/migrations/MIGRATION_AGENT_VOICE_SPEED.sql ou a migracao supabase/migrations/20260505180000_agent_voice_speed.sql, depois tente salvar de novo.',
        {
          code: 'VOICE_PROFILE_SCHEMA_OUTDATED',
          statusCode: 503,
          cause: error,
        }
      )
    }
    throw new VoiceModuleError('Erro ao salvar perfil de voz do agente.', {
      code: 'VOICE_PROFILE_SAVE_FAILED',
      statusCode: 500,
      cause: error,
    })
  }

  try {
    const { saveSystemLog } = await import('../../../services/system-logs')
    await saveSystemLog({
      user_email: email,
      companies_id: access.companiesId,
      agent_id: access.agentId,
      log_type: 'agent_voice_profile_updated',
      level: 'info',
      message: 'Perfil de voz do agente atualizado.',
      metadata: {
        provider: 'elevenlabs',
        voice_id: payload.voice_id,
        voice_name: payload.voice_name,
        model_id: payload.model_id,
        speed: payload.speed,
        enabled: payload.enabled,
        calls_enabled: payload.calls_enabled,
      },
      impact_level: 'low',
    })
  } catch (logError: any) {
    logger.warn('[voice.profile] Falha ao salvar log de atualizacao de voz', {
      agentId: access.agentId,
      error: logError?.message,
    })
  }

  return getAgentVoiceProfile(access.agentId, email)
}

export async function getStoredAgentVoiceProfile(agentId: string): Promise<VoiceProfileRecord | null> {
  const normalizedAgentId = String(agentId || '').trim()
  if (!normalizedAgentId) {
    return null
  }

  const { data, error } = await supabase
    .from('tb_agent_voice_profiles')
    .select('*')
    .eq('agent_id', normalizedAgentId)
    .maybeSingle()

  if (error) {
    logger.error('[voice.profile] Erro ao buscar perfil persistido do agente', {
      agentId: normalizedAgentId,
      error: error.message,
    })
    throw new VoiceModuleError('Erro ao buscar configuracao de voz persistida.', {
      code: 'VOICE_PROFILE_FETCH_FAILED',
      statusCode: 500,
      cause: error,
    })
  }

  return data ? mapRecord(data) : null
}

export function getDefaultVoicePreviewText(): string {
  return DEFAULT_PREVIEW_TEXT
}
