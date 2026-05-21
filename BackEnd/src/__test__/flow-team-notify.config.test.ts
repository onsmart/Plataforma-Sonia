import { afterEach, describe, expect, it } from 'vitest'
import {
  buildHandoffNotifyNodeFields,
  getOutboundHandoffEmailGuard,
  isBlockedMailSenderEmail,
  isFlowHandoffEmailGloballyEnabled,
  resolveFlowTeamNotifyEmail,
} from '../services/flows/flow-team-notify.config'

describe('flow-team-notify.config', () => {
  const previousHandoffFlag = process.env.FLOW_HANDOFF_EMAIL_ENABLED
  const previousTeamEmail = process.env.TEAM_NOTIFY_EMAIL
  const previousBlockedSenders = process.env.FLOW_EMAIL_BLOCKED_SENDERS

  afterEach(() => {
    if (previousHandoffFlag === undefined) {
      delete process.env.FLOW_HANDOFF_EMAIL_ENABLED
    } else {
      process.env.FLOW_HANDOFF_EMAIL_ENABLED = previousHandoffFlag
    }
    if (previousTeamEmail === undefined) {
      delete process.env.TEAM_NOTIFY_EMAIL
    } else {
      process.env.TEAM_NOTIFY_EMAIL = previousTeamEmail
    }
    if (previousBlockedSenders === undefined) {
      delete process.env.FLOW_EMAIL_BLOCKED_SENDERS
    } else {
      process.env.FLOW_EMAIL_BLOCKED_SENDERS = previousBlockedSenders
    }
  })

  it('deve manter handoff email desligado por padrao', () => {
    delete process.env.FLOW_HANDOFF_EMAIL_ENABLED
    expect(isFlowHandoffEmailGloballyEnabled()).toBe(false)
    expect(resolveFlowTeamNotifyEmail('recepcao@clinica.com.br')).toBeNull()
  })

  it('deve bloquear endereco demo mesmo com flag ligada', () => {
    process.env.FLOW_HANDOFF_EMAIL_ENABLED = 'true'
    expect(resolveFlowTeamNotifyEmail('recepcao@clinica.com.br')).toBeNull()
  })

  it('deve aceitar e-mail real quando habilitado', () => {
    process.env.FLOW_HANDOFF_EMAIL_ENABLED = 'true'
    process.env.TEAM_NOTIFY_EMAIL = 'equipe@minhaempresa.com.br'
    expect(resolveFlowTeamNotifyEmail()).toBe('equipe@minhaempresa.com.br')
  })

  it('buildHandoffNotifyNodeFields nao deve incluir notifyEmail quando desligado', () => {
    delete process.env.FLOW_HANDOFF_EMAIL_ENABLED
    const fields = buildHandoffNotifyNodeFields({
      teamNotifyEmail: 'recepcao@clinica.com.br',
    })
    expect(fields.notifyEmail).toBeUndefined()
  })

  it('getOutboundHandoffEmailGuard deve suprimir assunto de handoff quando desligado', () => {
    delete process.env.FLOW_HANDOFF_EMAIL_ENABLED
    expect(
      getOutboundHandoffEmailGuard({
        to: 'recepcao@clinica.com.br',
        subject: '[Fluxo Clínica] Atendimento humano necessário - MEDIUM',
      })
    ).toEqual({ allowed: false, reason: 'FLOW_HANDOFF_EMAIL_ENABLED=false' })
  })

  it('getOutboundHandoffEmailGuard nao deve afetar outros assuntos', () => {
    delete process.env.FLOW_HANDOFF_EMAIL_ENABLED
    expect(
      getOutboundHandoffEmailGuard({
        to: 'cliente@empresa.com',
        subject: 'Confirmacao de consulta',
      })
    ).toEqual({ allowed: true })
  })

  it('isBlockedMailSenderEmail deve bloquear remetente listado no env', () => {
    process.env.FLOW_EMAIL_BLOCKED_SENDERS = 'remetente-bloqueado@example.com'
    expect(isBlockedMailSenderEmail('remetente-bloqueado@example.com')).toBe(true)
    expect(isBlockedMailSenderEmail('outro@empresa.com')).toBe(false)
  })
})
