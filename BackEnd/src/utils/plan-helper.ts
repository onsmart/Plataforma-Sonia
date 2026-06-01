import { supabase } from '../lib/supabase'
import logger from '../lib/logger'
import {
  type PlanId,
  FREE_PLAN_ID,
  FREE_PLAN_LIMITS,
  getPlanCatalogEntry,
  getFreePlanDisplay,
  hasEffectivePaidAccess,
  isCancelAtPeriodEnd,
  isPaidSubscriptionStatus,
  normalizePlanId,
  planLimitsFromCatalog,
} from '../config/plans.catalog'
import {
  isPlatformAdminEmail,
  PLATFORM_ADMIN_PLAN_CODE,
  PLATFORM_ADMIN_PLAN_TITLE,
  resolvePlatformAdminEmail,
} from './platform-admin'

export type PlanType = PlanId

export const planInfoCache: Map<string, { info: PlanInfo; expiresAt: number }> = new Map()
const CACHE_TTL_MS = 5 * 60 * 1000

export function clearPlanInfoCache(companiesId?: string): void {
  if (companiesId) {
    planInfoCache.delete(companiesId)
    return
  }
  planInfoCache.clear()
}

export interface PlanLimits {
  agents: number | null
  messages: number | null
  conversations: number | null
  hasRAG: boolean
  hasSSO: boolean
  hasGovernance: boolean
  hasCustomDeployment: boolean
  hasActiveOutbound: boolean
  hasFlows: boolean
  hasCrmApi: boolean
  productLine: 'rec' | 'com'
}

export interface PlanInfo {
  plan: PlanId
  planCode: string
  planTitle: string
  status: 'active' | 'inactive' | 'canceled'
  limits: PlanLimits
}

function buildFreePlanInfo(): PlanInfo {
  const free = getFreePlanDisplay()
  return {
    plan: FREE_PLAN_ID,
    planCode: free.code,
    planTitle: free.title,
    status: 'inactive',
    limits: { ...FREE_PLAN_LIMITS },
  }
}

const PLATFORM_ADMIN_EFFECTIVE_PLAN: PlanId = 'com_enterprise'

function buildPlatformAdminPlanInfo(): PlanInfo {
  const enterprise = getPlanCatalogEntry(PLATFORM_ADMIN_EFFECTIVE_PLAN)
  return {
    plan: PLATFORM_ADMIN_EFFECTIVE_PLAN,
    planCode: PLATFORM_ADMIN_PLAN_CODE,
    planTitle: PLATFORM_ADMIN_PLAN_TITLE,
    status: 'active',
    limits: {
      agents: null,
      messages: null,
      conversations: null,
      hasRAG: true,
      hasSSO: true,
      hasGovernance: true,
      hasCustomDeployment: true,
      hasActiveOutbound: true,
      hasFlows: true,
      hasCrmApi: true,
      productLine: enterprise.productLine,
    },
  }
}

export type GetPlanInfoOptions = {
  userEmail?: string | null
}

function getPlanLimits(planId: PlanId): PlanLimits {
  return planLimitsFromCatalog(planId) as PlanLimits
}

function suggestUpgradePlan(current: PlanId): PlanId {
  const entry = getPlanCatalogEntry(current)
  if (entry.productLine === 'rec') {
    if (entry.tier === 'start') return 'rec_growth'
    if (entry.tier === 'growth') return 'rec_enterprise'
    return 'rec_enterprise'
  }
  if (entry.tier === 'start') return 'com_growth'
  if (entry.tier === 'growth') return 'com_enterprise'
  return 'com_enterprise'
}

export async function getPlanInfo(
  companiesId: string,
  options?: GetPlanInfoOptions
): Promise<PlanInfo> {
  try {
    const platformAdminEmail = await resolvePlatformAdminEmail(companiesId, options?.userEmail)
    if (platformAdminEmail && isPlatformAdminEmail(platformAdminEmail)) {
      const planInfo = buildPlatformAdminPlanInfo()
      planInfoCache.set(companiesId, {
        info: planInfo,
        expiresAt: Date.now() + CACHE_TTL_MS,
      })
      return planInfo
    }

    const cached = planInfoCache.get(companiesId)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.info
    }

    const { data: subscription, error } = await supabase
      .from('tb_subscriptions')
      .select('plan, status, current_period_end, canceled_at')
      .eq('companies_id', companiesId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      logger.warn(`[getPlanInfo] Erro ao buscar subscription: ${error.message}`)
    }

    const cancelAtPeriodEnd = isCancelAtPeriodEnd(subscription || {})
    let usageLimitReached = false

    if (subscription && cancelAtPeriodEnd) {
      const planLimits = getPlanLimits(normalizePlanId(subscription.plan))
      if (planLimits.conversations !== null) {
        const { getMonthlyAtendimentoCount } = await import('../services/service-session.service')
        const used = await getMonthlyAtendimentoCount(companiesId)
        usageLimitReached = used >= planLimits.conversations
      }
    }

    if (
      !subscription ||
      !hasEffectivePaidAccess(subscription, { cancelAtPeriodEnd, usageLimitReached })
    ) {
      const planInfo = buildFreePlanInfo()
      if (subscription?.status === 'canceled') {
        planInfo.status = 'canceled'
      }
      planInfoCache.set(companiesId, {
        info: planInfo,
        expiresAt: Date.now() + CACHE_TTL_MS,
      })
      return planInfo
    }

    const plan = normalizePlanId(subscription.plan)
    const catalog = getPlanCatalogEntry(plan)
    const subscriptionStatus = String(subscription.status || 'inactive')
    const planInfo: PlanInfo = {
      plan,
      planCode: catalog.code,
      planTitle: catalog.title,
      status:
        subscriptionStatus === 'canceled' && hasEffectivePaidAccess(subscription)
          ? 'active'
          : isPaidSubscriptionStatus(subscriptionStatus)
            ? 'active'
            : subscriptionStatus === 'canceled'
              ? 'canceled'
              : 'inactive',
      limits: getPlanLimits(plan),
    }

    planInfoCache.set(companiesId, {
      info: planInfo,
      expiresAt: Date.now() + CACHE_TTL_MS,
    })

    return planInfo
  } catch (err: any) {
    logger.error('[getPlanInfo] Erro:', err)
    return buildFreePlanInfo()
  }
}

export async function canCreateAgent(companiesId: string): Promise<{
  allowed: boolean
  reason?: string
  upgradePlan?: PlanId
}> {
  const planInfo = await getPlanInfo(companiesId)

  if (planInfo.status !== 'active') {
    return {
      allowed: false,
      reason:
        'Você não tem uma assinatura ativa. Por favor, faça upgrade do seu plano para continuar usando o serviço.',
      upgradePlan: 'rec_start',
    }
  }

  const limit = planInfo.limits.agents
  if (limit === null) {
    return { allowed: true }
  }

  const { getActiveAgentCount } = await import('../services/usage-tracker.service')
  const activeCount = await getActiveAgentCount(companiesId)

  if (activeCount >= limit) {
    const upgradePlan = suggestUpgradePlan(planInfo.plan)
    return {
      allowed: false,
      reason: `Você já tem ${activeCount} agente(s) ativo(s). O plano ${planInfo.planTitle} permite apenas ${limit} agente(s) ativo(s). Faça upgrade para ${getPlanCatalogEntry(upgradePlan).title}.`,
      upgradePlan,
    }
  }

  return { allowed: true }
}

export async function canActivateAgent(
  companiesId: string,
  agentIdToActivate: string
): Promise<{
  allowed: boolean
  reason?: string
  upgradePlan?: PlanId
}> {
  const planInfo = await getPlanInfo(companiesId)

  if (planInfo.status !== 'active') {
    return {
      allowed: false,
      reason:
        'Você não tem uma assinatura ativa. Por favor, faça upgrade do seu plano para continuar usando o serviço.',
      upgradePlan: 'rec_start',
    }
  }

  const limit = planInfo.limits.agents
  if (limit === null) {
    return { allowed: true }
  }

  const { getActiveAgentCount } = await import('../services/usage-tracker.service')
  const currentActiveCount = await getActiveAgentCount(companiesId)

  const { data: agent } = await supabase
    .from('tb_agents')
    .select('status_id')
    .eq('id', agentIdToActivate)
    .eq('companies_id', companiesId)
    .maybeSingle()

  if (agent?.status_id === 1) {
    return { allowed: true }
  }

  if (currentActiveCount >= limit) {
    const upgradePlan = suggestUpgradePlan(planInfo.plan)
    return {
      allowed: false,
      reason: `Você já tem ${currentActiveCount} agente(s) ativo(s). O plano ${planInfo.planTitle} permite apenas ${limit} agente(s) ativo(s). Faça upgrade para ${getPlanCatalogEntry(upgradePlan).title}.`,
      upgradePlan,
    }
  }

  return { allowed: true }
}

/**
 * Limite mensal de atendimentos = sessões abertas no mês (tb_service_sessions).
 */
export async function canStartNewAtendimento(companiesId: string): Promise<{
  allowed: boolean
  reason?: string
  upgradePlan?: PlanId
  conversationsUsed?: number
  conversationsLimit?: number | null
}> {
  const planInfo = await getPlanInfo(companiesId)

  if (planInfo.status !== 'active') {
    return {
      allowed: false,
      reason:
        'Você não tem uma assinatura ativa. Por favor, faça upgrade do seu plano para continuar atendendo conversas.',
      upgradePlan: 'rec_start',
    }
  }

  const limit = planInfo.limits.conversations
  if (limit === null) {
    return { allowed: true, conversationsLimit: null }
  }

  const { getMonthlyAtendimentoCount } = await import('../services/service-session.service')
  const used = await getMonthlyAtendimentoCount(companiesId)

  if (used >= limit) {
    const upgradePlan = suggestUpgradePlan(planInfo.plan)
    return {
      allowed: false,
      reason:
        'Atualize seu plano para poder ter mais acesso a números de atendimentos, ou entre em contato conosco para uma possível recarga.',
      upgradePlan,
      conversationsUsed: used,
      conversationsLimit: limit,
    }
  }

  return {
    allowed: true,
    conversationsUsed: used,
    conversationsLimit: limit,
  }
}

/**
 * Gate de inbound WhatsApp: continua sessão aberta ou delega abertura via resolveInboundSession.
 * @deprecated Preferir resolveInboundSession; mantido para compatibilidade.
 */
export async function canAcceptConversation(
  companiesId: string,
  whatsappContactId: string,
  integrationId?: string
): Promise<{
  allowed: boolean
  reason?: string
  upgradePlan?: PlanId
  conversationsUsed?: number
  conversationsLimit?: number | null
  continuing?: boolean
}> {
  const { hasOpenServiceSession } = await import('../services/usage-tracker.service')

  if (await hasOpenServiceSession(companiesId, whatsappContactId, integrationId)) {
    const planInfo = await getPlanInfo(companiesId)
    return {
      allowed: true,
      continuing: true,
      conversationsLimit: planInfo.limits.conversations,
    }
  }

  const gate = await canStartNewAtendimento(companiesId)
  return { ...gate, continuing: false }
}

/** @deprecated Preferir canAcceptConversation; mantido para compatibilidade com RPC antiga */
export async function canSendMessage(
  companiesId: string,
  currentMessageCount?: number
): Promise<{
  allowed: boolean
  reason?: string
  upgradePlan?: PlanId
}> {
  const planInfo = await getPlanInfo(companiesId)

  if (planInfo.status !== 'active') {
    return {
      allowed: false,
      reason:
        'Você não tem uma assinatura ativa. Por favor, faça upgrade do seu plano para continuar usando o serviço.',
      upgradePlan: 'rec_start',
    }
  }

  const limit = planInfo.limits.conversations
  if (limit === null) {
    return { allowed: true }
  }

  const { getCurrentMonthConversationCount } = await import('../services/usage-tracker.service')
  const used =
    typeof currentMessageCount === 'number'
      ? currentMessageCount
      : await getCurrentMonthConversationCount(companiesId)

  if (used >= limit) {
    const upgradePlan = suggestUpgradePlan(planInfo.plan)
    return {
      allowed: false,
      reason: `Você atingiu o limite de ${limit} atendimentos/mês do plano ${planInfo.planTitle}. Faça upgrade para ${getPlanCatalogEntry(upgradePlan).title}.`,
      upgradePlan,
    }
  }

  return { allowed: true }
}

export async function canUseActiveOutbound(companiesId: string): Promise<{
  allowed: boolean
  reason?: string
  upgradePlan?: PlanId
}> {
  const planInfo = await getPlanInfo(companiesId)

  if (planInfo.status !== 'active') {
    return {
      allowed: false,
      reason: 'Assinatura inativa. Ative um plano Sonia Completa para usar IA ativa/SDR.',
      upgradePlan: 'com_start',
    }
  }

  if (!planInfo.limits.hasActiveOutbound) {
    return {
      allowed: false,
      reason:
        'Operação ativa (SDR, campanhas outbound) está disponível apenas nos planos Sonia Completa (COM_START, COM_GROWTH, COM_ENTERPRISE).',
      upgradePlan: 'com_start',
    }
  }

  return { allowed: true }
}

export async function canUseRAG(companiesId: string): Promise<{
  allowed: boolean
  reason?: string
  upgradePlan?: PlanId
}> {
  const planInfo = await getPlanInfo(companiesId)

  if (planInfo.status !== 'active') {
    return {
      allowed: false,
      reason:
        'Você não tem uma assinatura ativa. Por favor, faça upgrade do seu plano para continuar usando o serviço.',
      upgradePlan: suggestUpgradePlan(planInfo.plan),
    }
  }

  if (!planInfo.limits.hasRAG) {
    const upgradePlan = suggestUpgradePlan(planInfo.plan)
    return {
      allowed: false,
      reason: `A base de conhecimento (RAG) não está incluída no plano ${planInfo.planTitle}. Faça upgrade para ${getPlanCatalogEntry(upgradePlan).title}.`,
      upgradePlan,
    }
  }

  return { allowed: true }
}

export async function canUseFlows(companiesId: string): Promise<{
  allowed: boolean
  reason?: string
  upgradePlan?: PlanId
}> {
  const planInfo = await getPlanInfo(companiesId)

  if (planInfo.status !== 'active') {
    return {
      allowed: false,
      reason:
        'Você não tem uma assinatura ativa. Contrate o plano Receptivo Growth para usar fluxos visuais.',
      upgradePlan: 'rec_growth',
    }
  }

  if (!planInfo.limits.hasFlows) {
    const upgradePlan = suggestUpgradePlan(planInfo.plan)
    return {
      allowed: false,
      reason: `Fluxos visuais não estão incluídos no plano ${planInfo.planTitle}. Faça upgrade para ${getPlanCatalogEntry(upgradePlan).title}.`,
      upgradePlan,
    }
  }

  return { allowed: true }
}

export async function canUseCrmApi(companiesId: string): Promise<{
  allowed: boolean
  reason?: string
  upgradePlan?: PlanId
}> {
  const planInfo = await getPlanInfo(companiesId)

  if (planInfo.status !== 'active') {
    return {
      allowed: false,
      reason:
        'Você não tem uma assinatura ativa. Contrate o plano Receptivo Growth para integrações CRM/API.',
      upgradePlan: 'rec_growth',
    }
  }

  if (!planInfo.limits.hasCrmApi) {
    const upgradePlan = suggestUpgradePlan(planInfo.plan)
    return {
      allowed: false,
      reason: `Integrações CRM e API não estão incluídas no plano ${planInfo.planTitle}. Faça upgrade para ${getPlanCatalogEntry(upgradePlan).title}.`,
      upgradePlan,
    }
  }

  return { allowed: true }
}

export async function canUseSSO(companiesId: string): Promise<{
  allowed: boolean
  reason?: string
  upgradePlan?: PlanId
}> {
  const planInfo = await getPlanInfo(companiesId)

  if (planInfo.status !== 'active') {
    return {
      allowed: false,
      reason:
        'Você não tem uma assinatura ativa. Por favor, faça upgrade do seu plano para continuar usando o serviço.',
      upgradePlan: planInfo.limits.productLine === 'rec' ? 'rec_enterprise' : 'com_enterprise',
    }
  }

  if (!planInfo.limits.hasSSO) {
    const upgradePlan =
      planInfo.limits.productLine === 'rec' ? 'rec_enterprise' : 'com_enterprise'
    return {
      allowed: false,
      reason: `SSO está disponível apenas no plano Enterprise da linha ${planInfo.limits.productLine === 'rec' ? 'Receptiva' : 'Completa'}.`,
      upgradePlan,
    }
  }

  return { allowed: true }
}

export async function canUseGovernance(companiesId: string): Promise<{
  allowed: boolean
  reason?: string
  upgradePlan?: PlanId
}> {
  const planInfo = await getPlanInfo(companiesId)

  if (planInfo.status !== 'active') {
    return {
      allowed: false,
      reason:
        'Você não tem uma assinatura ativa. Por favor, faça upgrade do seu plano para continuar usando o serviço.',
      upgradePlan: planInfo.limits.productLine === 'rec' ? 'rec_enterprise' : 'com_enterprise',
    }
  }

  if (!planInfo.limits.hasGovernance) {
    const upgradePlan =
      planInfo.limits.productLine === 'rec' ? 'rec_enterprise' : 'com_enterprise'
    return {
      allowed: false,
      reason: `Governança avançada está disponível apenas no plano Enterprise da linha ${planInfo.limits.productLine === 'rec' ? 'Receptiva' : 'Completa'}.`,
      upgradePlan,
    }
  }

  return { allowed: true }
}
