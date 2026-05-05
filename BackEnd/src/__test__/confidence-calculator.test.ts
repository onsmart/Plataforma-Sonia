import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  calculateConfidence,
  DEFAULT_CONFIDENCE_APPROVAL_THRESHOLD,
  getConfidenceApprovalThreshold,
} from '../services/agents/confidence-calculator'

describe('confidence-calculator', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    delete process.env.AGENT_CONFIDENCE_THRESHOLD
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.AGENT_CONFIDENCE_THRESHOLD
  })

  const reply = (
    msg: string,
    answer: string,
    extras?: { historyLength?: number; hasFile?: boolean }
  ) =>
    calculateConfidence(
      { action: 'reply', message: answer },
      msg,
      {},
      extras?.historyLength ?? 0,
      extras?.hasFile ?? false
    )

  it('pergunta direta com "Qual" deve ter score alto mesmo sem histórico', () => {
    const d = reply(
      'Qual a sua finalidade?',
      'Sou a assistente virtual da empresa e ajudo com dúvidas e agendamentos.',
      { historyLength: 0 }
    )
    expect(d.confidence_score).toBeGreaterThanOrEqual(DEFAULT_CONFIDENCE_APPROVAL_THRESHOLD)
    expect(d.reason).not.toBe('ambiguous')
  })

  it('mensagem curta tipo STT não deve ser bloqueada só por ter "?" se não há incerteza do usuário', () => {
    const d = reply('Olá?', 'Oi! Como posso ajudar?', { historyLength: 0 })
    expect(d.confidence_score).toBeGreaterThanOrEqual(DEFAULT_CONFIDENCE_APPROVAL_THRESHOLD)
  })

  it('incerteza explícita do usuário deve reduzir score', () => {
    const d = reply(
      'talvez nao sei',
      'Sem problema — me diga o que você precisa com mais detalhes.',
      { historyLength: 2 }
    )
    expect(d.confidence_score).toBeLessThan(DEFAULT_CONFIDENCE_APPROVAL_THRESHOLD)
    expect(['ambiguous', 'low_context']).toContain(d.reason)
  })

  it('mensagem vazia deve ficar baixa', () => {
    const d = reply('', 'Olá!')
    expect(d.confidence_score).toBeLessThan(DEFAULT_CONFIDENCE_APPROVAL_THRESHOLD)
  })

  it('getConfidenceApprovalThreshold lê AGENT_CONFIDENCE_THRESHOLD válido', () => {
    process.env.AGENT_CONFIDENCE_THRESHOLD = '0.65'
    expect(getConfidenceApprovalThreshold()).toBe(0.65)
  })

  it('placeholder na resposta reduz forte', () => {
    const d = reply('Oi', 'Seu código é {{codigo}}.')
    expect(d.confidence_score).toBeLessThan(DEFAULT_CONFIDENCE_APPROVAL_THRESHOLD)
    expect(d.reason).toBe('insufficient_data')
  })
})
