import { supabase } from '../lib/supabase'
import logger from '../lib/logger'

export type PlanType = 'starter' | 'pro' | 'enterprise'

export interface PlanLimits {
  agents: number | null // null = unlimited
  messages: number | null // null = unlimited
  hasRAG: boolean
  hasSSO: boolean
  hasGovernance: boolean
  hasCustomDeployment: boolean
}

export interface PlanInfo {
  plan: PlanType
  status: 'active' | 'inactive' | 'canceled'
  limits: PlanLimits
}

/**
 * Obtém informações do plano da empresa
 */
export async function getPlanInfo(companiesId: string): Promise<PlanInfo> {
  try {
    // Buscar subscription no banco (apenas ativas ou em trial)
    // Status válidos: 'active', 'trialing' (período de teste)
    // Status inválidos: 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'unpaid'
    const { data: subscription, error } = await supabase
      .from('tb_subscriptions')
      .select('plan, status')
      .eq('companies_id', companiesId)
      .in('status', ['active', 'trialing']) // Apenas status válidos
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      logger.warn(`[getPlanInfo] Erro ao buscar subscription: ${error.message}`)
    }

    // Se não tem subscription ativa, assume starter
    const plan: PlanType = (subscription?.plan as PlanType) || 'starter'
    // Status 'trialing' também é considerado ativo para permitir uso durante período de teste
    const status = (subscription?.status === 'active' || subscription?.status === 'trialing') 
      ? 'active' 
      : 'inactive'

    // Definir limites baseado no plano
    const limits: PlanLimits = getPlanLimits(plan)

    return {
      plan,
      status,
      limits
    }
  } catch (err: any) {
    logger.error('[getPlanInfo] Erro:', err)
    // Em caso de erro, retorna starter como padrão
    return {
      plan: 'starter',
      status: 'inactive',
      limits: getPlanLimits('starter')
    }
  }
}

/**
 * Retorna os limites de cada plano
 */
function getPlanLimits(plan: PlanType): PlanLimits {
  switch (plan) {
    case 'starter':
      return {
        agents: 1,
        messages: 50,
        hasRAG: false,
        hasSSO: false,
        hasGovernance: false,
        hasCustomDeployment: false
      }
    case 'pro':
      return {
        agents: 5,
        messages: null, // unlimited
        hasRAG: true,
        hasSSO: false,
        hasGovernance: false,
        hasCustomDeployment: false
      }
    case 'enterprise':
      return {
        agents: null, // unlimited
        messages: null, // unlimited
        hasRAG: true,
        hasSSO: true,
        hasGovernance: true,
        hasCustomDeployment: true
      }
    default:
      return getPlanLimits('starter')
  }
}

/**
 * Verifica se a empresa pode criar mais agentes
 */
export async function canCreateAgent(companiesId: string, currentAgentCount: number): Promise<{
  allowed: boolean
  reason?: string
  upgradePlan?: PlanType
}> {
  const planInfo = await getPlanInfo(companiesId)

  if (planInfo.status !== 'active') {
    return {
      allowed: false,
      reason: 'Você não tem uma assinatura ativa. Por favor, faça upgrade do seu plano para continuar usando o serviço.',
      upgradePlan: 'pro'
    }
  }

  const limit = planInfo.limits.agents

  // Se não tem limite (unlimited), permite
  if (limit === null) {
    return { allowed: true }
  }

  // Verifica se já atingiu o limite
  if (currentAgentCount >= limit) {
    const upgradePlan = planInfo.plan === 'starter' ? 'pro' : 'enterprise'
    return {
      allowed: false,
      reason: `Você atingiu o limite de ${limit} agente(s) do seu plano atual. Para criar mais agentes, faça upgrade para o plano ${upgradePlan === 'pro' ? 'Pro' : 'Enterprise'}.`,
      upgradePlan
    }
  }

  return { allowed: true }
}

/**
 * Verifica se a empresa pode enviar mais mensagens
 */
export async function canSendMessage(companiesId: string, currentMessageCount: number): Promise<{
  allowed: boolean
  reason?: string
  upgradePlan?: PlanType
}> {
  const planInfo = await getPlanInfo(companiesId)

  if (planInfo.status !== 'active') {
    return {
      allowed: false,
      reason: 'Você não tem uma assinatura ativa. Por favor, faça upgrade do seu plano para continuar usando o serviço.',
      upgradePlan: 'pro'
    }
  }

  const limit = planInfo.limits.messages

  // Se não tem limite (unlimited), permite
  if (limit === null) {
    return { allowed: true }
  }

  // Verifica se já atingiu o limite
  if (currentMessageCount >= limit) {
    return {
      allowed: false,
      reason: `Você atingiu o limite de ${limit} mensagens/mês do seu plano atual. Para enviar mensagens ilimitadas, faça upgrade para o plano Pro.`,
      upgradePlan: 'pro'
    }
  }

  return { allowed: true }
}

/**
 * Verifica se a empresa pode usar RAG (Knowledge Base)
 */
export async function canUseRAG(companiesId: string): Promise<{
  allowed: boolean
  reason?: string
  upgradePlan?: PlanType
}> {
  const planInfo = await getPlanInfo(companiesId)

  if (planInfo.status !== 'active') {
    return {
      allowed: false,
      reason: 'Você não tem uma assinatura ativa. Por favor, faça upgrade do seu plano para continuar usando o serviço.',
      upgradePlan: 'pro'
    }
  }

  if (!planInfo.limits.hasRAG) {
    return {
      allowed: false,
      reason: 'A funcionalidade RAG Knowledge Base está disponível apenas no plano Pro ou superior. Faça upgrade do seu plano para acessar esta funcionalidade.',
      upgradePlan: 'pro'
    }
  }

  return { allowed: true }
}

/**
 * Verifica se a empresa pode usar SSO
 */
export async function canUseSSO(companiesId: string): Promise<{
  allowed: boolean
  reason?: string
  upgradePlan?: PlanType
}> {
  const planInfo = await getPlanInfo(companiesId)

  if (planInfo.status !== 'active') {
    return {
      allowed: false,
      reason: 'Você não tem uma assinatura ativa. Por favor, faça upgrade do seu plano para continuar usando o serviço.',
      upgradePlan: 'enterprise'
    }
  }

  if (!planInfo.limits.hasSSO) {
    return {
      allowed: false,
      reason: 'A funcionalidade SSO & Governance está disponível apenas no plano Enterprise. Entre em contato com nossa equipe de vendas para fazer upgrade.',
      upgradePlan: 'enterprise'
    }
  }

  return { allowed: true }
}

/**
 * Verifica se a empresa pode usar Governance
 */
export async function canUseGovernance(companiesId: string): Promise<{
  allowed: boolean
  reason?: string
  upgradePlan?: PlanType
}> {
  const planInfo = await getPlanInfo(companiesId)

  if (planInfo.status !== 'active') {
    return {
      allowed: false,
      reason: 'Você não tem uma assinatura ativa. Por favor, faça upgrade do seu plano para continuar usando o serviço.',
      upgradePlan: 'enterprise'
    }
  }

  if (!planInfo.limits.hasGovernance) {
    return {
      allowed: false,
      reason: 'A funcionalidade Governance está disponível apenas no plano Enterprise. Entre em contato com nossa equipe de vendas para fazer upgrade.',
      upgradePlan: 'enterprise'
    }
  }

  return { allowed: true }
}
