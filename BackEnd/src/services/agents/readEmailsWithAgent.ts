import { getAgentsByEmail } from './index'
import { getAgentFromCache } from './getagentfromcache'
import { readInboxMessages } from '../integrations/mail'

interface EmailResult {
  id: string
  from: string
  subject: string
  preview: string
  receivedAt: string
}

export async function readEmailsWithAgent(
  email: string,
  agentId: string,
  provider: string,
  limit: number
): Promise<EmailResult[]> {
  console.log('[readEmailsWithAgent] Parâmetros:', { email, agentId, provider, limit })

  const agents = await getAgentsByEmail(email)
  console.log('[readEmailsWithAgent] Agentes encontrados:', agents?.length || 0)

  const agent = getAgentFromCache(agents, agentId)
  console.log('[readEmailsWithAgent] Agente selecionado:', {
    id: agent?.id,
    nome: agent?.nome,
    integrations_id: agent?.integrations_id,
    integrations_id_type: typeof agent?.integrations_id,
  })

  if (!agent) {
    throw new Error(`Agente com id ${agentId} não encontrado`)
  }

  if (!agent.integrations_id) {
    throw new Error(`Agente ${agentId} não possui integration_id configurado`)
  }

  const messages = await readInboxMessages(agent.integrations_id, limit)
  return messages.map((message) => ({
    id: message.external_message_id,
    from: message.from[0]?.address || '',
    subject: message.subject,
    preview: message.preview || message.body_text || '',
    receivedAt: message.received_at || '',
  }))
}
