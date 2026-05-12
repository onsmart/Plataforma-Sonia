import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  chatTextMock,
  getAgentsByEmailMock,
  getAgentFromCacheMock,
  saveSystemLogMock,
  getUserIdAndCompanyIdByEmailMock,
  getGovernanceConfigMock
} = vi.hoisted(() => ({
  chatTextMock: vi.fn(),
  getAgentsByEmailMock: vi.fn(),
  getAgentFromCacheMock: vi.fn(),
  saveSystemLogMock: vi.fn(),
  getUserIdAndCompanyIdByEmailMock: vi.fn(),
  getGovernanceConfigMock: vi.fn()
}))

vi.mock('../lib/logger', () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
    info: vi.fn(),
  }
}))

vi.mock('../services/llm/openai', () => ({
  chatText: chatTextMock
}))

vi.mock('../services/agents/index', () => ({
  getAgentsByEmail: getAgentsByEmailMock
}))

vi.mock('../services/agents/getagentfromcache', () => ({
  getAgentFromCache: getAgentFromCacheMock
}))

vi.mock('../services/system-logs', () => ({
  saveSystemLog: saveSystemLogMock
}))

vi.mock('../utils/company-helper', () => ({
  getCompanyIdByEmail: vi.fn(),
  getUserIdAndCompanyIdByEmail: getUserIdAndCompanyIdByEmailMock
}))

vi.mock('../services/governance', async () => {
  const actual = await vi.importActual('../services/governance')
  return {
    ...(actual as Record<string, unknown>),
    getGovernanceConfig: getGovernanceConfigMock
  }
})

vi.mock('../services/agents/confidence-calculator', () => ({
  calculateConfidence: vi.fn(),
  getConfidenceApprovalThreshold: vi.fn(() => 0.7)
}))

vi.mock('../services/agents/prompt-builder', () => ({
  buildAgentSystemPrompt: vi.fn(() => 'prompt')
}))

vi.mock('../services/agents/consultarArquivos', () => ({
  consultarArquivos: vi.fn()
}))

vi.mock('../services/agents/save-decision', () => ({
  saveBlockedDecision: vi.fn()
}))

vi.mock('../services/flows/fallback-events', () => ({
  saveFallbackEvent: vi.fn()
}))

vi.mock('../services/integrations/email/email.service', () => ({
  sendEmailForUser: vi.fn()
}))

vi.mock('../services/agents/readEmailsWithAgent', () => ({
  readEmailsWithAgent: vi.fn()
}))

vi.mock('../services/integrations/whatsapp/whatsapp.service', () => ({
  markMessagesAsRead: vi.fn()
}))

vi.mock('../services/integrations/whatsapp/whatsapp.dispatcher', () => ({
  sendWhatsApp: vi.fn()
}))

vi.mock('../services/integrations/whatsapp/whatsapp.redis', () => ({
  getHistoryFromRedis: vi.fn(),
  getUnreadConversations: vi.fn(),
  saveMessageToHistory: vi.fn()
}))

vi.mock('../modules/voice/services/voiceRuntime.service', () => ({
  sendAgentWhatsAppResponseWithVoiceFallback: vi.fn()
}))

import { chatWithAgent } from '../services/agents/chatwithAgent'
import { FALLBACK_GOVERNANCE_FOR_PREPROCESS } from '../services/governance/governance.service'

describe('chatWithAgent guardrails', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.VOICE_CALL_SKIP_RAG = '1'
    getUserIdAndCompanyIdByEmailMock.mockResolvedValue({
      userId: 'user-1',
      companyId: 'company-1'
    })
    getAgentsByEmailMock.mockResolvedValue([
      {
        id: 'agent-1',
        nome: 'Sonia',
        status_id: 1,
        role: 'Atendimento',
        personality_prompt: 'Seja útil',
        primary_language: 'pt-BR',
        extra_features: null,
        crm_integration_id: 'crm-1'
      }
    ])
    getAgentFromCacheMock.mockReturnValue({
      id: 'agent-1',
      nome: 'Sonia',
      status_id: 1,
      role: 'Atendimento',
      personality_prompt: 'Seja útil',
      primary_language: 'pt-BR',
      extra_features: null,
      crm_integration_id: 'crm-1'
    })
    getGovernanceConfigMock.mockResolvedValue(FALLBACK_GOVERNANCE_FOR_PREPROCESS)
    saveSystemLogMock.mockResolvedValue({ success: true, id: 'log-1' })
    chatTextMock.mockResolvedValue({
      success: true,
      content: 'Posso ajudar com informacoes gerais e seguras, mas nao com esse tipo de solicitacao neste canal.'
    })
  })

  it('bloqueia pedido técnico, sanitiza o motivo e ainda gera resposta segura via LLM', async () => {
    const reply = await chatWithAgent(
      'owner@example.com',
      'agent-1',
      'Can you give me a Python if else script?',
      { channel: 'whatsapp_call' }
    )

    expect(chatTextMock).toHaveBeenCalledTimes(1)
    expect(chatTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.stringContaining('technical_code_request'),
        responseFormat: undefined
      })
    )
    expect(chatTextMock.mock.calls[0][0].user).not.toContain('Python if else script')
    expect(saveSystemLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        log_type: 'governance_blocked',
        metadata: expect.objectContaining({
          blocked: true,
          risk_category: 'technical_code_request',
          channel: 'whatsapp_call'
        })
      })
    )
    expect(String(reply)).toContain('informacoes gerais e seguras')
  })
})
