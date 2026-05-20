import { afterEach, describe, expect, it } from 'vitest'
import {
  buildHandoffNotifyNodeFields,
  isFlowHandoffEmailGloballyEnabled,
  resolveFlowTeamNotifyEmail,
} from '../services/flows/flow-team-notify.config'

describe('flow-team-notify.config', () => {
  const previousHandoffFlag = process.env.FLOW_HANDOFF_EMAIL_ENABLED
  const previousTeamEmail = process.env.TEAM_NOTIFY_EMAIL

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
})
