import { getAgentsByEmail } from './index'
import { getAgentFromCache } from './getagentfromcache'
import { readOutlookEmails } from '../integrations/email_reader/outlook/outlook.service'

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
    integrations_id_type: typeof agent?.integrations_id
  })

  if (!agent) {
    throw new Error(`Agente com id ${agentId} não encontrado`)
  }

  if (!agent.integrations_id) {
    throw new Error(`Agente ${agentId} não possui integration_id configurado`)
  }

  if (provider === 'outlook') {
    return await readOutlookEmails(agent.integrations_id, limit)
  }

  throw new Error('Provider de email não suportado')
}
