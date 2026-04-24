import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  supabaseFromMock,
  getCompanyIdByEmailMock,
  getVoiceMock,
  isConfiguredMock,
  saveSystemLogMock,
} = vi.hoisted(() => ({
  supabaseFromMock: vi.fn(),
  getCompanyIdByEmailMock: vi.fn(),
  getVoiceMock: vi.fn(),
  isConfiguredMock: vi.fn(),
  saveSystemLogMock: vi.fn(),
}))

vi.mock('../lib/logger', () => ({
  default: {
    info: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: supabaseFromMock,
  },
}))

vi.mock('../utils/company-helper', () => ({
  getCompanyIdByEmail: getCompanyIdByEmailMock,
}))

vi.mock('../services/system-logs', () => ({
  saveSystemLog: saveSystemLogMock,
}))

vi.mock('../modules/voice/providers/elevenlabs.provider', () => ({
  ElevenLabsProvider: class {
    isConfigured() {
      return isConfiguredMock()
    }

    getVoice(voiceId: string) {
      return getVoiceMock(voiceId)
    }
  },
}))

import { getAgentVoiceProfile, saveAgentVoiceProfile } from '../modules/voice/services/voiceProfile.service'

function createAgentAccessQuery(result: { data: any; error: any }) {
  const maybeSingle = vi.fn().mockResolvedValue(result)
  const secondEq = vi.fn(() => ({ maybeSingle }))
  const firstEq = vi.fn(() => ({ eq: secondEq }))

  return {
    select: vi.fn(() => ({
      eq: firstEq,
    })),
  }
}

function createVoiceProfileSelectQuery(result: { data: any; error: any }) {
  const maybeSingle = vi.fn().mockResolvedValue(result)
  const eq = vi.fn(() => ({ maybeSingle }))

  return {
    select: vi.fn(() => ({ eq })),
  }
}

describe('voiceProfile.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ELEVENLABS_DEFAULT_MODEL_ID = 'eleven_multilingual_v2'
    getCompanyIdByEmailMock.mockResolvedValue('company-1')
    isConfiguredMock.mockReturnValue(true)
    saveSystemLogMock.mockResolvedValue({ success: true })
  })

  it('retorna o perfil persistido do agente com defaults do provedor', async () => {
    supabaseFromMock.mockImplementation((table: string) => {
      if (table === 'tb_agents') {
        return createAgentAccessQuery({
          data: { id: 'agent-1', companies_id: 'company-1' },
          error: null,
        })
      }

      if (table === 'tb_agent_voice_profiles') {
        return createVoiceProfileSelectQuery({
          data: {
            id: 'profile-1',
            agent_id: 'agent-1',
            voice_id: 'voice-1',
            voice_name: 'Sonia',
            model_id: 'eleven_multilingual_v2',
            stability: 0.5,
            similarity_boost: 0.7,
            style: 0.1,
            use_speaker_boost: true,
            preview_text: 'Ola, eu sou o agente.',
            enabled: true,
            created_at: '2026-04-24T10:00:00.000Z',
            updated_at: '2026-04-24T10:00:00.000Z',
          },
          error: null,
        })
      }

      throw new Error(`Tabela nao mockada: ${table}`)
    })

    const response = await getAgentVoiceProfile('agent-1', 'user@example.com')

    expect(response.providerConfigured).toBe(true)
    expect(response.defaults).toEqual({
      provider: 'elevenlabs',
      modelId: 'eleven_multilingual_v2',
      previewText: 'Ola, eu sou o seu agente de IA. Como posso ajudar voce hoje?',
    })
    expect(response.profile).toEqual(
      expect.objectContaining({
        agentId: 'agent-1',
        voiceId: 'voice-1',
        voiceName: 'Sonia',
        enabled: true,
      })
    )
  })

  it('salva o perfil de voz do agente e registra evento de auditoria', async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null })
    getVoiceMock.mockResolvedValue({ voice_id: 'voice-2', name: 'Nova Sonia' })

    supabaseFromMock.mockImplementation((table: string) => {
      if (table === 'tb_agents') {
        return createAgentAccessQuery({
          data: { id: 'agent-1', companies_id: 'company-1' },
          error: null,
        })
      }

      if (table === 'tb_agent_voice_profiles') {
        return {
          upsert: upsertMock,
          ...createVoiceProfileSelectQuery({
            data: {
              id: 'profile-2',
              agent_id: 'agent-1',
              voice_id: 'voice-2',
              voice_name: 'Nova Sonia',
              model_id: 'model-custom',
              stability: 0.55,
              similarity_boost: 0.8,
              style: 0.05,
              use_speaker_boost: false,
              preview_text: 'Ola equipe',
              enabled: true,
              created_at: '2026-04-24T11:00:00.000Z',
              updated_at: '2026-04-24T11:00:00.000Z',
            },
            error: null,
          }),
        }
      }

      throw new Error(`Tabela nao mockada: ${table}`)
    })

    const response = await saveAgentVoiceProfile('agent-1', 'user@example.com', {
      voiceId: 'voice-2',
      voiceName: '  Nova Sonia  ',
      modelId: 'model-custom',
      stability: 0.55,
      similarityBoost: 0.8,
      style: 0.05,
      useSpeakerBoost: false,
      previewText: '  Ola   equipe \n',
      enabled: true,
    })

    expect(getVoiceMock).toHaveBeenCalledWith('voice-2')
    expect(upsertMock).toHaveBeenCalledWith(
      {
        agent_id: 'agent-1',
        provider: 'elevenlabs',
        voice_id: 'voice-2',
        voice_name: 'Nova Sonia',
        model_id: 'model-custom',
        stability: 0.55,
        similarity_boost: 0.8,
        style: 0.05,
        use_speaker_boost: false,
        preview_text: 'Ola equipe',
        enabled: true,
      },
      {
        onConflict: 'agent_id',
      }
    )
    expect(saveSystemLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_email: 'user@example.com',
        companies_id: 'company-1',
        agent_id: 'agent-1',
        log_type: 'agent_voice_profile_updated',
      })
    )
    expect(response.profile?.voiceId).toBe('voice-2')
  })
})
