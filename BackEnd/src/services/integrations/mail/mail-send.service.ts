import logger from '../../../lib/logger'
import {
  getOutboundHandoffEmailGuard,
  isBlockedMailSenderEmail,
} from '../../flows/flow-team-notify.config'
import { MailProviderFactory } from './mail-provider.factory'
import { MailIntegrationConfig } from './mail.types'
import { MailSendInput, MailSendResult } from './mail.types'
import { resolveMailIntegrationForSend } from './mail-integration.resolver'

function suppressHandoffEmailIfBlocked(input: MailSendInput): MailSendResult | null {
  const guard = getOutboundHandoffEmailGuard({ to: input.to, subject: input.subject })
  if (guard.allowed) return null

  logger.warn('[mail-send] Envio de handoff suprimido', {
    reason: guard.reason,
    toPreview: String(input.to || '').slice(0, 48),
    subjectPreview: String(input.subject || '').slice(0, 80),
  })
  return { provider: 'suppressed', externalMessageId: null }
}

function suppressIfBlockedSender(config: MailIntegrationConfig, input: MailSendInput): MailSendResult | null {
  const sender = config.emailAddress || config.username
  if (!isBlockedMailSenderEmail(sender)) return null

  logger.warn('[mail-send] Envio suprimido (remetente bloqueado em FLOW_EMAIL_BLOCKED_SENDERS)', {
    senderPreview: String(sender || '').slice(0, 48),
    subjectPreview: String(input.subject || '').slice(0, 80),
  })
  return { provider: 'suppressed', externalMessageId: null }
}

export async function sendMailFromIntegration(
  integrationId: string,
  input: MailSendInput
): Promise<MailSendResult> {
  const suppressed = suppressHandoffEmailIfBlocked(input)
  if (suppressed) return suppressed

  const provider = await MailProviderFactory.fromIntegrationId(integrationId)

  if (!provider.sender) {
    throw new Error('Esta integração de email não suporta envio.')
  }

  const config = provider.config
  const blockedBySender = config ? suppressIfBlockedSender(config, input) : null
  if (blockedBySender) return blockedBySender

  return provider.sender.send(input)
}

export async function sendMailForUser(
  userEmail: string,
  input: MailSendInput,
  preferredIntegrationId?: string | null
): Promise<MailSendResult> {
  const suppressed = suppressHandoffEmailIfBlocked(input)
  if (suppressed) return suppressed

  const config = await resolveMailIntegrationForSend({
    userEmail,
    preferredIntegrationId,
  })
  const blockedBySender = suppressIfBlockedSender(config, input)
  if (blockedBySender) return blockedBySender

  const provider = MailProviderFactory.fromConfig(config)

  if (!provider.sender) {
    throw new Error('Esta integracao de email nao suporta envio.')
  }

  return provider.sender.send(input)
}
