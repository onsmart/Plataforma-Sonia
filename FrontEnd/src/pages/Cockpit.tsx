import React, { useEffect, useState, useCallback, useMemo } from "react"
import {
    Users,
    MessageSquare,
    TrendingUp,
    Clock,
    Activity,
    AlertCircle,
    CheckCircle2,
    Calendar,
    ArrowRight,
    Loader2,
    PlayCircle,
    RefreshCw,
    AlertTriangle,
    Mail,
    Wrench,
    ExternalLink,
    Trash2,
    CheckSquare,
    Square,
    Bot,
    ArrowDown,
    DollarSign
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar"
import { Badge } from "../components/ui/badge"
import { ScrollArea } from "../components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip"
import { AgentService, BASE_URL, DashboardData, getAuthHeaders, KPIService, KPIMetrics, WhatsAppService, type WhatsAppConversationSummary } from "../services/api"
import { supabase } from "../utils/supabase/client"
import { useAuth } from "../contexts/AuthContext"
import { useNavigation } from "../contexts/NavigationContext"
import { toast } from "sonner"
import { Checkbox } from "../components/ui/checkbox"
import { useTranslation } from "react-i18next"
import { translateActivityType, translateLogMessage, translateFallbackMessage } from "../utils/i18n-helpers"
import { cn } from "../components/ui/utils"

// Função para formatar timestamp relativo (com tradução)
function formatRelativeTime(isoString: string, t: any): string {
    if (!isoString) return t('time.now', { defaultValue: 'agora' })
    const date = new Date(isoString)
    const now = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diff < 60) return `${diff}${t('time.secondsAgo', { defaultValue: 's atrás' })}`
    if (diff < 3600) return `${Math.floor(diff / 60)}${t('time.minutesAgo', { defaultValue: 'min atrás' })}`
    if (diff < 86400) return `${Math.floor(diff / 3600)}${t('time.hoursAgo', { defaultValue: 'h atrás' })}`
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// Função para formatar timestamp completo
function formatTime(isoString: string): string {
    if (!isoString) return ""
    const date = new Date(isoString)
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatWhatsAppConversationLabel(conversation: WhatsAppConversationSummary): string {
    return conversation.phone_number || conversation.contact_label || conversation.lid || conversation.whatsapp_contact_id
}

function getWhatsAppStatusBadge(
    status: string | null | undefined,
    direction: 'inbound' | 'outbound',
    t: (key: string, o?: { defaultValue?: string }) => string
): { label: string; className: string } {
    const normalizedStatus = String(status || '').trim().toLowerCase()

    if (direction === 'inbound') {
        return {
            label:
                normalizedStatus === 'received_unread'
                    ? t('whatsapp.status.receivedUnread', { defaultValue: 'Recebida (nova)' })
                    : t('whatsapp.status.received', { defaultValue: 'Recebida' }),
            className: 'bg-sky-500/12 text-sky-700 dark:text-sky-300'
        }
    }

    switch (normalizedStatus) {
        case 'accepted':
            return { label: t('whatsapp.status.accepted', { defaultValue: 'Aceita' }), className: 'bg-slate-500/12 text-slate-700 dark:text-slate-300' }
        case 'sent':
            return { label: t('whatsapp.status.sent', { defaultValue: 'Enviada' }), className: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300' }
        case 'delivered':
            return { label: t('whatsapp.status.delivered', { defaultValue: 'Entregue' }), className: 'bg-cyan-500/12 text-cyan-700 dark:text-cyan-300' }
        case 'read':
            return { label: t('whatsapp.status.read', { defaultValue: 'Lida' }), className: 'bg-blue-500/12 text-blue-700 dark:text-blue-300' }
        case 'failed':
            return { label: t('whatsapp.status.failed', { defaultValue: 'Falhou' }), className: 'bg-rose-500/12 text-rose-700 dark:text-rose-300' }
        default:
            return { label: t('whatsapp.status.sent', { defaultValue: 'Enviada' }), className: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300' }
    }
}

/** Corrige título/subtítulo em PT quando o banco ainda tem os rótulos em inglês do seed antigo. */
function useCockpitPageHeader(t: (k: string, o?: { defaultValue?: string }) => string, lang: string | undefined) {
    return useMemo(() => {
        const def = { title: "Cabine de Operações", subtitle: "Situação em tempo real" }
        const rawTitle = String(t("title", { defaultValue: def.title })).trim()
        const rawSub = String(t("subtitle", { defaultValue: def.subtitle })).trim()
        const lg = (lang || "").toLowerCase()
        const isPt = lg === "pt" || lg.startsWith("pt-")
        if (!isPt) {
            return { title: rawTitle || def.title, subtitle: rawSub || def.subtitle }
        }
        const title =
            !rawTitle ||
            /^cockpit$/i.test(rawTitle) ||
            rawTitle === "title" ||
            /^cabine de operações$/i.test(rawTitle)
                ? def.title
                : rawTitle
        const subtitle =
            !rawSub || /^live\s*status$/i.test(rawSub) || rawSub === "subtitle" ? def.subtitle : rawSub
        return { title, subtitle }
    }, [t, lang])
}

export function Cockpit() {
    const { t, i18n } = useTranslation("cockpit")
    const pageHeader = useCockpitPageHeader(t, i18n.resolvedLanguage || i18n.language)
    const [currentTab, setCurrentTab] = useState("activity")
    const [data, setData] = useState<DashboardData | null>(null)
    const [loading, setLoading] = useState(true)
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [activityOverview, setActivityOverview] = useState<Array<{
        tipo: string
        data_evento: string
        status: number
        user_name?: string | null
        user_email?: string | null
    }>>([])
    const [cockpitMetrics, setCockpitMetrics] = useState<{
        total_interacoes: number
        leads_ativos: number
        mensagens_por_minuto: number
    } | null>(null)
    const [unassignedConversations, setUnassignedConversations] = useState<number>(0)
    const [fallbacks, setFallbacks] = useState<Array<{
        id: string
        event_type: string
        level: string
        message: string
        metadata: any
        impact_level: string
        workflow_id: string | null
        node_id: string | null
        created_at: string
    }>>([])
    const [fallbacksCount, setFallbacksCount] = useState<number>(0)
    const [pendingDecisionsCount, setPendingDecisionsCount] = useState<number>(0)
    const [selectedFallbacks, setSelectedFallbacks] = useState<Set<string>>(new Set())
    const [isDeletingFallback, setIsDeletingFallback] = useState<string | null>(null)
    const [isDeletingMultiple, setIsDeletingMultiple] = useState(false)
    const [systemLogs, setSystemLogs] = useState<Array<{
        id: string
        log_type: string
        level: string
        message: string
        metadata: any
        impact_level: string
        agent_id: string | null
        workflow_id: string | null
        node_id: string | null
        execution_id: string | null
        created_at: string
    }>>([])
    const [systemLogsLoading, setSystemLogsLoading] = useState(false)
    const [systemLogsCount, setSystemLogsCount] = useState<number>(0)
    const [selectedLogs, setSelectedLogs] = useState<Set<string>>(new Set())
    const [isDeletingLog, setIsDeletingLog] = useState<string | null>(null)
    const [isDeletingMultipleLogs, setIsDeletingMultipleLogs] = useState(false)
    const [whatsappConversations, setWhatsappConversations] = useState<WhatsAppConversationSummary[]>([])
    const [kpis, setKpis] = useState<KPIMetrics | null>(null)
    const [kpisLoading, setKpisLoading] = useState(false)
    const { user } = useAuth()
    const { navigate, currentRoute } = useNavigation()
    const isFetchingRef = React.useRef(false)
    const workforceCardRef = React.useRef<HTMLDivElement>(null)

    // Função para carregar dados
    const loadData = useCallback(async () => {
        if (!user?.email || isFetchingRef.current) return

        try {
            isFetchingRef.current = true
            setIsRefreshing(true)
            setError(null)

            const [
                stats,
                agentsRes,
                overviewRes,
                metricsRes,
                unassignedRes,
                fallbacksRes,
                fallbacksCountRes,
                pendingRes,
                logsRes,
                logsCountRes,
                kpisRes,
                whatsappRes
            ] = await Promise.all([
                AgentService.getDashboardStats().catch(e => {
                    console.error("[Cockpit] Erro ao buscar stats da API:", e)
                    return null
                }),
                supabase.rpc('sp_list_agents_by_email', { p_email: user.email }),
                supabase.rpc('sp_activity_overview', { p_email: user.email }),
                supabase.rpc('sp_cockpit_metrics_by_email', { p_email: user.email }),
                supabase.rpc('sp_count_unassigned_whatsapp_conversations', { p_email: user.email }),
                supabase.rpc('sp_get_fallbacks_by_email', { p_email: user.email }),
                supabase.rpc('sp_count_fallbacks_by_email', { p_email: user.email }),
                supabase.rpc('sp_count_pending_decisions_by_email', { p_email: user.email }),
                supabase.rpc('sp_get_system_logs_by_email', { p_email: user.email, p_limit: 100 }),
                supabase.rpc('sp_count_system_logs_by_email', { p_email: user.email }),
                KPIService.getKPIs().catch(e => {
                    console.error("[Cockpit] Erro ao buscar KPIs:", e)
                    // Retorna objeto vazio ao invés de null para não quebrar a renderização
                    return {
                        taskSuccessRate: 0,
                        averageResponseTime: 0,
                        taskAbandonmentRate: 0,
                        costPerInteraction: 0,
                        totalCost: 0,
                        violationsCount: 0,
                        hallucinationsFlagged: 0,
                        humanTransferRate: 0,
                        quickReworkRate: 0,
                        csatScore: 0,
                        npsScore: 0,
                        averageSentiment: 0,
                        incorrectRoutingFrequency: 0
                    } as KPIMetrics
                }),
                WhatsAppService.listCurrentConversations().catch(e => {
                    console.error("[Cockpit] Erro ao buscar conversas do WhatsApp:", e)
                    return { integration: null, conversations: [] }
                })
            ])

            // 1. Processar Agentes
            let agentsList: Array<{ id: string; nome: string; status_id: number | null }> = []
            if (agentsRes.data) {
                const rows = Array.isArray(agentsRes.data) ? agentsRes.data : (agentsRes.data ? [agentsRes.data] : [])
                agentsList = rows.map((agent: any) => {
                    let statusId: number | null = null
                    if (agent.status_id !== null && agent.status_id !== undefined) {
                        statusId = typeof agent.status_id === 'string' ? parseInt(agent.status_id, 10) : Number(agent.status_id)
                        if (isNaN(statusId)) statusId = null
                    }
                    return {
                        id: String(agent.id),
                        nome: agent.nome || 'Sem nome',
                        status_id: statusId
                    }
                })
            }

            // 2. Processar Activity Overview
            let overviewData: Array<{ tipo: string; data_evento: string; status: number }> = []
            if (overviewRes.data) {
                const rows = Array.isArray(overviewRes.data) ? overviewRes.data : (overviewRes.data ? [overviewRes.data] : [])
                overviewData = rows.map((item: any) => ({
                    tipo: item.tipo || '',
                    data_evento: item.data_evento || new Date().toISOString(),
                    status: Number(item.status) || 1,
                    user_name: item.user_name || null,
                    user_email: item.user_email || null
                }))
            }
            setActivityOverview(overviewData)

            // 3. Processar Cockpit Metrics
            let metricsData: { total_interacoes: number; leads_ativos: number; mensagens_por_minuto: number } | null = null
            if (metricsRes.data) {
                const metrics = Array.isArray(metricsRes.data) ? metricsRes.data[0] : metricsRes.data
                if (metrics) {
                    metricsData = {
                        total_interacoes: Number(metrics.total_interacoes) || 0,
                        leads_ativos: Number(metrics.leads_ativos) || 0,
                        mensagens_por_minuto: Number(metrics.mensagens_por_minuto) || 0
                    }
                    setCockpitMetrics(metricsData)
                }
            }

            // 4. Processar Unassigned
            setUnassignedConversations(Number(unassignedRes.data) || 0)

            // 5. Processar Fallbacks
            setFallbacks(Array.isArray(fallbacksRes.data) ? fallbacksRes.data : (fallbacksRes.data ? [fallbacksRes.data] : []))
            setFallbacksCount(Number(fallbacksCountRes.data) || 0)

            // 6. Processar Pending Decisions
            setPendingDecisionsCount(Number(pendingRes.data) || 0)

            // 7. Processar System Logs
            setSystemLogs(Array.isArray(logsRes.data) ? logsRes.data : [])
            setSystemLogsCount(Number(logsCountRes.data) || 0)

            // 7.5. Processar conversas recentes do WhatsApp
            setWhatsappConversations(Array.isArray(whatsappRes?.conversations) ? whatsappRes.conversations : [])

            // 8. Processar KPIs
            console.log('[Cockpit] KPIs recebidos:', kpisRes)
            if (kpisRes && typeof kpisRes === 'object' && !Array.isArray(kpisRes)) {
                setKpis(kpisRes as KPIMetrics)
                console.log('[Cockpit] ✅ KPIs processados e salvos no state')
            } else {
                console.warn('[Cockpit] ⚠️ KPIs não foram processados:', { 
                    kpisRes, 
                    type: typeof kpisRes, 
                    isArray: Array.isArray(kpisRes) 
                })
            }

            // Filtrar apenas agentes ativos (status_id = 1)
            const activeAgentsList = agentsList.filter(agent => agent.status_id === 1)

            // Usar métricas do cockpit se disponíveis, senão usar stats da API
            const finalStats = metricsData ? {
                totalInteractions: metricsData.total_interacoes,
                activeLeads: metricsData.leads_ativos,
                avgResponseTime: metricsData.mensagens_por_minuto,
                meetingsBooked: stats?.stats?.meetingsBooked || 0,
                activeAgents: activeAgentsList.length,
                lastUpdated: new Date().toISOString()
            } : (stats?.stats || {
                totalInteractions: 0,
                activeLeads: 0,
                avgResponseTime: 0,
                meetingsBooked: 0,
                activeAgents: activeAgentsList.length,
                lastUpdated: new Date().toISOString()
            })

            if (stats && typeof stats === 'object') {
                setData({
                    stats: finalStats,
                    activityFeed: Array.isArray(stats.activityFeed) ? stats.activityFeed : [],
                    agents: agentsList
                })
            } else {
                setData({
                    stats: finalStats,
                    activityFeed: [],
                    agents: agentsList
                })
            }
            setLastRefresh(new Date())
        } catch (error: any) {
            console.error("Erro ao carregar dados do Cockpit:", error)
            setError(error?.message || "Erro ao carregar dados")
            setData({
                stats: {
                    totalInteractions: 0,
                    activeLeads: 0,
                    avgResponseTime: 0,
                    meetingsBooked: 0,
                    activeAgents: 0,
                    lastUpdated: new Date().toISOString()
                },
                activityFeed: [],
                agents: []
            })
        } finally {
            isFetchingRef.current = false
            setIsRefreshing(false)
            setLoading(false)
        }
    }, [user?.email])

    // Carregar dados ao montar o componente, quando voltar para a página ou quando a rota mudar
    useEffect(() => {
        // Se estiver na rota do Cockpit, sempre recarregar os dados
        if (currentRoute === 'cockpit') {
            loadData()
        }

        // Recarregar quando a visibilidade da página muda (usuário volta para a aba do navegador)
        const handleVisibilityChange = () => {
            if (!document.hidden && currentRoute === 'cockpit') {
                loadData()
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [user?.email, currentRoute, loadData])

    // Se ainda está carregando e não tem dados, mostra loading
    if (loading && !data) {
        return (
            <div className="flex h-full items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    // Se tem erro e não tem dados, mostra erro
    if (error && !data) {
        return (
            <div className="flex h-full items-center justify-center p-8">
                <div className="text-center">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 text-destructive" />
                    <p className="text-sm font-medium">{t('errors.loading', { defaultValue: 'Não foi possível carregar os dados.' })}</p>
                    <p className="text-xs text-muted-foreground mt-1">{error}</p>
                    <Button onClick={loadData} className="mt-4" size="sm">
                        {t('errors.tryAgain', { defaultValue: 'Tentar novamente' })}
                    </Button>
                </div>
            </div>
        )
    }

    // Garantir que data não seja null
    if (!data) {
        return (
            <div className="flex h-full items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    const { stats, agents = [] } = data

    // Função para iniciar autenticação Outlook (similar ao Integrations.tsx)
    const handleOutlookAuth = async () => {
        if (!user?.id || !user?.email) {
            toast.error('Usuário não autenticado corretamente.')
            return
        }

        try {
            const response = await fetch(`${BASE_URL}/email/oauth/microsoft365/authorize-url`, {
                method: 'GET',
                headers: await getAuthHeaders(false)
            })

            const result = await response.json().catch(() => null)

            if (!response.ok || !result?.authorizeUrl) {
                throw new Error(result?.details || result?.error || 'Erro ao iniciar autenticação do Outlook.')
            }

            window.location.href = result.authorizeUrl
        } catch (error: any) {
            toast.error(error?.message || 'Erro ao iniciar autenticação do Outlook.')
        }
    }

    // Função para mapear status_id do agente para cor e texto
    // 1 = verde (conectado/funcionando)
    // 2 = vermelho (cancelado)
    // 3 = amarelo (pausado)
    const getAgentStatusInfo = (statusId: number | null | undefined) => {
        if (statusId === null || statusId === undefined || statusId === 0) {
            return {
                color: 'text-muted-foreground',
                bgColor: 'bg-muted-foreground',
                label: t('workforce.status.noStatus', { defaultValue: 'Sem status' }),
                icon: AlertCircle
            };
        }

        switch (statusId) {
            case 1: // Verde - Conectado/Funcionando
                return {
                    color: 'text-emerald-500',
                    bgColor: 'bg-emerald-500',
                    label: t('workforce.status.connected', { defaultValue: 'Conectado' }),
                    icon: CheckCircle2
                };
            case 2: // Vermelho - Cancelado
                return {
                    color: 'text-red-500',
                    bgColor: 'bg-red-500',
                    label: t('workforce.status.cancelled', { defaultValue: 'Cancelado' }),
                    icon: AlertCircle
                };
            case 3: // Amarelo - Pausado
                return {
                    color: 'text-yellow-500',
                    bgColor: 'bg-yellow-500',
                    label: t('workforce.status.paused', { defaultValue: 'Em pausa' }),
                    icon: AlertTriangle
                };
            default:
                return {
                    color: 'text-muted-foreground',
                    bgColor: 'bg-muted-foreground',
                    label: `Status ${statusId}`,
                    icon: AlertCircle
                };
        }
    };

    // Calcular status do sistema baseado em agentes e activity overview
    // PRIORIDADE: Status 2 (vermelho) > Status 3 (amarelo) > Status 1 (verde)

    // Verificar se algum agente está pausado (status_id 3 ou 4 = amarelo)
    const hasPausedAgents = agents.some(agent => agent.status_id === 3 || agent.status_id === 4)

    // Verificar status no activity overview (garantir que status seja número)
    const hasRedStatus = activityOverview.some(item => {
        const status = typeof item.status === 'string' ? parseInt(item.status, 10) : Number(item.status)
        return status === 2
    })

    const hasYellowStatus = activityOverview.some(item => {
        const status = typeof item.status === 'string' ? parseInt(item.status, 10) : Number(item.status)
        return status === 3
    })

    // Debug: verificar status encontrados
    console.log('[Cockpit] Verificação de status:', {
        hasRedStatus,
        hasYellowStatus,
        hasPausedAgents,
        activityOverviewStatuses: activityOverview.map(item => ({
            tipo: item.tipo,
            status: item.status,
            statusType: typeof item.status
        }))
    })

    // Determinar status do sistema com prioridade: VERMELHO > AMARELO > VERDE
    let systemStatus: 'healthy' | 'stable' | 'blocked' | 'unstable' = 'healthy'
    let systemStatusLabel = t('status.healthy', { defaultValue: 'Tudo certo' })
    let systemStatusColor =
        'bg-emerald-500/10 text-emerald-800 border-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30'
    let systemStatusDotColor = 'bg-emerald-500'
    let systemStatusPingColor = 'bg-emerald-400'

    if (hasRedStatus) {
        systemStatus = 'blocked'
        systemStatusLabel = t('status.blocked', { defaultValue: 'Requer atenção imediata' })
        systemStatusColor =
            'bg-red-500/10 text-red-800 border-red-500/25 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/35'
        systemStatusDotColor = 'bg-red-500'
        systemStatusPingColor = 'bg-red-400'
    } else if (hasYellowStatus || hasPausedAgents) {
        systemStatus = 'unstable'
        systemStatusLabel = t('status.unstable', { defaultValue: 'Instabilidade detectada' })
        systemStatusColor =
            'bg-amber-500/12 text-amber-900 border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200 dark:border-amber-500/35'
        systemStatusDotColor = 'bg-amber-500'
        systemStatusPingColor = 'bg-amber-400'
    } else {
        systemStatus = 'stable'
        systemStatusLabel = t('status.stable', { defaultValue: 'Operação estável' })
        systemStatusColor =
            'bg-cyan-500/10 text-cyan-900 border-cyan-500/25 dark:bg-cyan-500/12 dark:text-cyan-300 dark:border-cyan-500/35'
        systemStatusDotColor = 'bg-cyan-500'
        systemStatusPingColor = 'bg-cyan-400'
    }

    // Contar erros nas últimas 24h (status 3 = erro/expiração)
    const recentErrors = activityOverview.filter(item => {
        if (item.status !== 3) return false
        const logTime = new Date(item.data_evento)
        const now = new Date()
        return (now.getTime() - logTime.getTime()) < 24 * 60 * 60 * 1000
    }).length

    // Função para deletar um fallback individual
    const handleDeleteFallback = async (fallbackId: string) => {
        if (!user?.email) {
            toast.error(t('errors.auth', { defaultValue: 'Sessão inválida. Entre novamente.' }))
            return
        }

        setIsDeletingFallback(fallbackId)
        try {
            const { error } = await supabase
                .from('tb_system_events')
                .delete()
                .eq('id', fallbackId)

            if (error) {
                console.error('[Cockpit] Erro ao deletar fallback:', error)
                toast.error(t('errors.deleteEvent', { defaultValue: 'Não foi possível excluir o registro.' }))
                return
            }

            // ✅ Salvar ação no histórico (tb_activity_history)
            try {
                await supabase.rpc('sp_save_activity_history', {
                    p_email: user.email,
                    p_activity_type: 'fallback_cleaned',
                    p_description: 'Fallback excluído pelo usuário',
                    p_status: 1,
                    p_metadata: {
                        action: 'fallback_deleted',
                        fallback_id: fallbackId
                    }
                })
            } catch (err) {
                console.warn('[Cockpit] Erro ao salvar ação no histórico:', err)
            }

            toast.success(t('success.deleted', { defaultValue: 'Excluído com sucesso.' }))
            // Recarregar dados
            await loadData()
            // Remover da seleção se estiver selecionado
            setSelectedFallbacks(prev => {
                const newSet = new Set(prev)
                newSet.delete(fallbackId)
                return newSet
            })
        } catch (error: any) {
            console.error('[Cockpit] Erro ao deletar fallback:', error)
            toast.error('Erro ao deletar evento')
        } finally {
            setIsDeletingFallback(null)
        }
    }

    // Função para deletar múltiplos fallbacks
    const handleDeleteMultipleFallbacks = async () => {
        if (selectedFallbacks.size === 0) {
            toast.error(t('errors.selectAtLeastOne', { defaultValue: 'Selecione pelo menos um item.' }))
            return
        }

        if (!user?.email) {
            toast.error(t('errors.auth', { defaultValue: 'Sessão inválida. Entre novamente.' }))
            return
        }

        setIsDeletingMultiple(true)
        try {
            const idsToDelete = Array.from(selectedFallbacks)
            const { error } = await supabase
                .from('tb_system_events')
                .delete()
                .in('id', idsToDelete)

            if (error) {
                console.error('[Cockpit] Erro ao deletar fallbacks:', error)
                toast.error(t('errors.deleteEvent', { defaultValue: 'Não foi possível excluir o registro.' }))
                return
            }

            // ✅ Salvar ação no histórico (tb_activity_history)
            try {
                await supabase.rpc('sp_save_activity_history', {
                    p_email: user.email,
                    p_activity_type: 'fallback_cleaned',
                    p_description: `${idsToDelete.length} fallback(s) excluído(s) pelo usuário`,
                    p_status: 1,
                    p_metadata: {
                        action: 'fallbacks_deleted',
                        fallbacks_count: idsToDelete.length,
                        fallback_ids: idsToDelete
                    }
                })
            } catch (err) {
                console.warn('[Cockpit] Erro ao salvar ação no histórico:', err)
            }

            toast.success(`${idsToDelete.length} ${t('success.eventsDeleted', { defaultValue: 'eventos excluídos.' })}`)
            // Recarregar dados
            await loadData()
            // Limpar seleção
            setSelectedFallbacks(new Set())
        } catch (error: any) {
            console.error('[Cockpit] Erro ao deletar fallbacks:', error)
            toast.error('Erro ao deletar eventos')
        } finally {
            setIsDeletingMultiple(false)
        }
    }

    // Função para alternar seleção de um fallback
    const toggleFallbackSelection = (fallbackId: string) => {
        setSelectedFallbacks(prev => {
            const newSet = new Set(prev)
            if (newSet.has(fallbackId)) {
                newSet.delete(fallbackId)
            } else {
                newSet.add(fallbackId)
            }
            return newSet
        })
    }

    // Função para deletar um log individual
    const handleDeleteLog = async (logId: string) => {
        if (!user?.email) {
            toast.error(t('errors.auth', { defaultValue: 'Sessão inválida. Entre novamente.' }))
            return
        }

        setIsDeletingLog(logId)
        try {
            const { error } = await supabase
                .from('tb_system_logs')
                .delete()
                .eq('id', logId)

            if (error) {
                console.error('[Cockpit] Erro ao deletar log:', error)
                toast.error(t('errors.deleteLog', { defaultValue: 'Não foi possível excluir o log.' }))
                return
            }

            // ✅ Salvar ação no histórico (tb_activity_history)
            try {
                await supabase.rpc('sp_save_activity_history', {
                    p_email: user.email,
                    p_activity_type: 'log_cleaned',
                    p_description: 'Log excluído pelo usuário',
                    p_status: 1,
                    p_metadata: {
                        action: 'log_deleted',
                        log_id: logId
                    }
                })
            } catch (err) {
                console.warn('[Cockpit] Erro ao salvar ação no histórico:', err)
            }

            toast.success(t('success.logDeleted', { defaultValue: 'Log excluído.' }))
            await loadData()
            setSelectedLogs(prev => {
                const newSet = new Set(prev)
                newSet.delete(logId)
                return newSet
            })
        } catch (error: any) {
            console.error('[Cockpit] Erro ao deletar log:', error)
            toast.error('Erro ao deletar log')
        } finally {
            setIsDeletingLog(null)
        }
    }

    // Função para deletar múltiplos logs
    const handleDeleteMultipleLogs = async () => {
        if (selectedLogs.size === 0) {
            toast.error(t('errors.selectAtLeastOneLog', { defaultValue: 'Selecione pelo menos um log.' }))
            return
        }

        if (!user?.email) {
            toast.error(t('errors.auth', { defaultValue: 'Sessão inválida. Entre novamente.' }))
            return
        }

        setIsDeletingMultipleLogs(true)
        try {
            const idsToDelete = Array.from(selectedLogs)
            const { error } = await supabase
                .from('tb_system_logs')
                .delete()
                .in('id', idsToDelete)

            if (error) {
                console.error('[Cockpit] Erro ao deletar logs:', error)
                toast.error(t('errors.deleteLogs', { defaultValue: 'Não foi possível excluir os logs.' }))
                return
            }

            // ✅ Salvar ação no histórico (tb_activity_history)
            try {
                await supabase.rpc('sp_save_activity_history', {
                    p_email: user.email,
                    p_activity_type: 'log_cleaned',
                    p_description: `${idsToDelete.length} log(s) excluído(s) pelo usuário`,
                    p_status: 1,
                    p_metadata: {
                        action: 'logs_deleted',
                        logs_count: idsToDelete.length,
                        log_ids: idsToDelete
                    }
                })
            } catch (err) {
                console.warn('[Cockpit] Erro ao salvar ação no histórico:', err)
            }

            toast.success(`${idsToDelete.length} ${t('success.logsDeleted', { defaultValue: 'logs excluídos.' })}`)
            await loadData()
            setSelectedLogs(new Set())
        } catch (error: any) {
            console.error('[Cockpit] Erro ao deletar logs:', error)
            toast.error('Erro ao deletar logs')
        } finally {
            setIsDeletingMultipleLogs(false)
        }
    }

    // Função para alternar seleção de um log
    const toggleLogSelection = (logId: string) => {
        setSelectedLogs(prev => {
            const newSet = new Set(prev)
            if (newSet.has(logId)) {
                newSet.delete(logId)
            } else {
                newSet.add(logId)
            }
            return newSet
        })
    }

    // Função para selecionar/desselecionar todos os logs
    const toggleSelectAllLogs = () => {
        if (selectedLogs.size === systemLogs.length) {
            setSelectedLogs(new Set())
        } else {
            setSelectedLogs(new Set(systemLogs.map(log => log.id)))
        }
    }

    // Função para selecionar/desselecionar todos
    const toggleSelectAllFallbacks = () => {
        if (selectedFallbacks.size === fallbacks.length) {
            setSelectedFallbacks(new Set())
        } else {
            setSelectedFallbacks(new Set(fallbacks.map(f => f.id)))
        }
    }

    /**
     * Métricas — iconWell responsivo ao hover do card via group-hover.
     * Light: azul/violet muito suave. Dark: opacidade elevada para contraste.
     */
    const metricNeutral = {
        iconWell: "border-blue-100 bg-blue-50 text-blue-600 group-hover:border-blue-200 group-hover:bg-blue-100/70 dark:border-blue-400/15 dark:bg-blue-400/10 dark:text-blue-300 dark:group-hover:bg-blue-400/15",
        stripe: "bg-gradient-to-r from-blue-500/50 via-violet-500/35 to-cyan-400/25 dark:from-blue-400/45 dark:via-violet-400/30 dark:to-cyan-300/20",
    } as const
    const metricAlert = {
        iconWell: "border-red-100 bg-red-50 text-red-600 group-hover:border-red-200 group-hover:bg-red-100/70 dark:border-red-400/15 dark:bg-red-400/10 dark:text-red-300 dark:group-hover:bg-red-400/15",
        stripe: "bg-gradient-to-r from-red-500/50 via-amber-400/35 to-orange-400/25 dark:from-red-400/45 dark:via-amber-300/30 dark:to-orange-300/20",
    } as const

    const metricIconWell =
        "mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border shadow-sm ring-1 ring-white/80 transition-all duration-300 group-hover:scale-[1.04] group-hover:shadow-md dark:ring-white/[0.04]"

    /**
     * Cards: group para ativar group-hover nos ícones.
     * Light: branco puro com sombra difusa e ring interno sutil.
     * Dark: zinc-900 refinado com hover de borda azul.
     */
    const cockpitCardClass =
        "group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.06)] ring-1 ring-white/80 text-card-foreground transition-all duration-300 motion-safe:hover:-translate-y-0.5 hover:border-blue-200/80 hover:shadow-[0_22px_55px_rgba(37,99,235,0.12)] dark:border-white/[0.07] dark:bg-zinc-900/80 dark:ring-white/[0.03] dark:hover:border-blue-400/20 dark:hover:shadow-[0_22px_55px_rgba(37,99,235,0.15)]"

    /**
     * Linhas de lista: group/row para hover nos ícones internos.
     * Light: branco premium com sombra suave e hover azulado.
     * Dark: overlay mínimo com hover discreto.
     */
    const cockpitRowClass =
        "group/row relative overflow-hidden rounded-2xl border border-slate-200/75 bg-white shadow-[0_8px_22px_rgba(15,23,42,0.04)] transition-all duration-250 motion-safe:hover:-translate-y-0.5 hover:border-blue-200/80 hover:bg-slate-50/60 hover:shadow-[0_14px_34px_rgba(37,99,235,0.09)] dark:border-white/[0.07] dark:bg-white/[0.035] dark:hover:border-blue-400/20 dark:hover:bg-white/[0.055] dark:hover:shadow-[0_14px_34px_rgba(37,99,235,0.12)]"

    /** Tab trigger refinado — ring + borda azul no ativo */
    const tabTriggerClass =
        "min-h-9 w-full rounded-xl px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground transition-all duration-200 hover:text-foreground data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-blue-100/80 data-[state=active]:ring-1 data-[state=active]:ring-blue-100/50 dark:data-[state=active]:bg-white/[0.09] dark:data-[state=active]:text-white dark:data-[state=active]:border-white/[0.06] dark:data-[state=active]:ring-white/[0.04] min-[480px]:w-auto min-[480px]:grow sm:grow-0 sm:text-[11px]"

    const scrollH =
        "h-[min(20rem,42svh)] min-[380px]:h-[min(22rem,46svh)] sm:h-[min(26rem,52svh)] md:h-[min(28rem,55svh)] lg:h-[min(31rem,58svh)] lg:max-h-[500px]"
    const workforceScrollH =
        "h-[min(20rem,42svh)] min-[380px]:h-[min(22rem,46svh)] sm:h-[min(26rem,52svh)] md:h-[min(28rem,55svh)] lg:h-[min(31rem,58svh)] lg:max-h-[550px]"

    return (
        <>
            <div className="min-h-full w-full min-w-0 animate-in fade-in duration-500 px-3 py-4 sm:px-5 sm:py-5 md:px-6 md:py-7 lg:px-8 lg:py-8">
                <div className="mx-auto max-w-[1600px] space-y-5 sm:space-y-7 md:space-y-8">

                <div className="flex flex-col gap-4 min-[520px]:flex-row min-[520px]:items-end min-[520px]:justify-between min-[520px]:gap-6">
                    <div className="min-w-0 flex-1 space-y-2">
                        <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/8 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-primary dark:bg-primary/12">
                            <span className="relative flex h-1.5 w-1.5 shrink-0">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                            </span>
                            Tempo real
                        </div>
                        <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
                            {pageHeader.title}
                        </h2>
                        <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground sm:text-xs">
                            {pageHeader.subtitle}
                        </p>
                    </div>
                    <div className="flex w-full min-w-0 shrink-0 flex-wrap items-center gap-2 rounded-xl border border-border/40 bg-card/60 p-1.5 backdrop-blur-sm min-[520px]:w-auto dark:border-white/[0.06] dark:bg-card/40">
                        <Badge variant="outline" className={cn("min-w-0 max-w-full flex-1 gap-2 truncate rounded-lg border px-2.5 py-2 text-[10px] font-semibold min-[520px]:max-w-[min(100%,20rem)] min-[520px]:flex-none sm:px-3 sm:text-xs", systemStatusColor)}>
                            <span className="relative flex h-2.5 w-2.5 shrink-0">
                                <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-75", systemStatusPingColor)} />
                                <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", systemStatusDotColor)} />
                            </span>
                            <span className="truncate">{systemStatusLabel}</span>
                        </Badge>
                        <Button variant="ghost" size="icon" onClick={loadData} className="h-9 w-9 shrink-0 rounded-lg hover:bg-muted/60 sm:h-9 sm:w-9">
                            <RefreshCw className={cn("h-4 w-4 text-muted-foreground", isRefreshing && "animate-spin")} />
                        </Button>
                    </div>
                </div>

                <div className="space-y-3 sm:space-y-4">
                    <div className="space-y-1.5">
                        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-primary dark:bg-primary/12">
                            <MessageSquare className="h-3 w-3" />
                            {t('sections.overview', { defaultValue: 'Visão geral' })}
                        </div>
                        <p className="max-w-2xl text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
                            {t('sections.overviewDescription', {
                                defaultValue: 'Resumo do que está acontecendo no atendimento: volume, alertas e itens que precisam da sua equipe.',
                            })}
                        </p>
                    </div>
                    <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 sm:gap-3 md:grid-cols-3 md:gap-3 lg:grid-cols-3 lg:gap-4 xl:grid-cols-6 xl:gap-3 2xl:gap-4">
                    {[
                        {
                            title: t('metrics.interactions', { defaultValue: 'Interações' }),
                            description: t('metrics.interactionsDescription', { defaultValue: 'Conversas registradas na plataforma no período.' }),
                            value: stats.totalInteractions,
                            icon: MessageSquare,
                        },
                        {
                            title: t('metrics.activeLeads', { defaultValue: 'Leads ativos' }),
                            description: t('metrics.activeLeadsDescription', { defaultValue: 'Contatos com conversa em andamento agora.' }),
                            value: stats.activeLeads || 0,
                            icon: Users,
                        },
                        {
                            title: t('metrics.messagesPerMin', { defaultValue: 'Msgs / min' }),
                            description: t('metrics.messagesPerMinDescription', { defaultValue: 'Média de mensagens por minuto no atendimento.' }),
                            value: stats.avgResponseTime > 0 ? stats.avgResponseTime.toFixed(1) : '0.0',
                            icon: Activity,
                        },
                        {
                            title: t('metrics.stuck', { defaultValue: 'Travadas' }),
                            description: t('metrics.stuckDescription', { defaultValue: 'Sem responsável atribuído; confira na Inbox.' }),
                            value: unassignedConversations,
                            icon: AlertCircle,
                            isAlert: unassignedConversations > 0,
                            route: 'inbox',
                        },
                        {
                            title: t('metrics.fallbacks', { defaultValue: 'Fallbacks' }),
                            description: t('metrics.fallbacksDescription', { defaultValue: 'Quando o fluxo não respondeu sozinho e precisou de alternativa.' }),
                            value: fallbacksCount,
                            icon: AlertTriangle,
                            isAlert: fallbacksCount > 0,
                        },
                        {
                            title: t('metrics.pending', { defaultValue: 'Aguardando' }),
                            description: t('metrics.pendingDescription', { defaultValue: 'Decisões da IA aguardando sua aprovação na Inbox.' }),
                            value: pendingDecisionsCount,
                            icon: Clock,
                            isAlert: pendingDecisionsCount > 0,
                            route: 'inbox?tab=decisions',
                        },
                    ].map((stat, i) => {
                        const hasAlert = stat.isAlert && Number(stat.value) > 0
                        const accent = hasAlert ? metricAlert : metricNeutral
                        return (
                        <Card
                            key={i}
                            className={cn(
                                cockpitCardClass,
                                "relative flex min-h-0 flex-col overflow-hidden",
                                stat.route && "cursor-pointer hover:bg-muted/40 active:scale-[0.99] dark:hover:bg-muted/25",
                                hasAlert && "ring-1 ring-destructive/20 border-destructive/25"
                            )}
                            onClick={() => stat.route && navigate(stat.route)}
                        >
                            <div className={cn("absolute left-0 top-0 h-1 w-full", accent.stripe)} />
                            <CardContent className="flex flex-1 flex-col items-center justify-between gap-3 px-3 py-4 text-center sm:gap-3.5 sm:px-3.5 sm:py-5 md:px-4 md:py-5">
                                <div className={cn(metricIconWell, accent.iconWell)}>
                                    <stat.icon size={20} strokeWidth={1.75} className="shrink-0" />
                                </div>
                                <div className="flex w-full min-w-0 flex-1 flex-col justify-center gap-1">
                                    <p className="text-[1.65rem] font-bold tabular-nums leading-none tracking-tight text-foreground">{stat.value}</p>
                                    <p className="mt-1 text-[10px] font-semibold uppercase leading-tight tracking-[0.1em] text-slate-500 sm:text-[11px] dark:text-zinc-400">{stat.title}</p>
                                    <p className="mx-auto mt-1 w-full text-pretty text-[9px] font-normal leading-snug text-slate-400 sm:text-[10px] dark:text-zinc-500">
                                        {stat.description}
                                    </p>
                                </div>
                                {hasAlert && (
                                    <span className="sr-only">{t('activity.actionRequired', { defaultValue: 'Ação necessária' })}</span>
                                )}
                            </CardContent>
                        </Card>
                        )
                    })}
                    </div>
                </div>

                <div className="space-y-3 sm:space-y-4">
                    <div className="space-y-1.5">
                        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-primary dark:bg-primary/12">
                            <TrendingUp className="h-3 w-3" />
                            {t('sections.performance', { defaultValue: 'Desempenho (KPIs)' })}
                        </div>
                        <p className="max-w-2xl text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
                            {t('sections.performanceDescription', {
                                defaultValue: 'Indicadores de qualidade, velocidade de resposta e custo estimado do uso da IA.',
                            })}
                        </p>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3 md:grid-cols-3 md:gap-4">
                    <Card className={cn(cockpitCardClass, "relative flex min-h-0 flex-col overflow-hidden")}>
                        <div className={cn("absolute left-0 top-0 h-1 w-full", metricNeutral.stripe)} />
                        <CardContent className="flex flex-1 flex-col items-center justify-between gap-3 px-4 py-5 text-center sm:gap-3.5 sm:px-5 sm:py-6 md:py-7">
                            <div className={cn(metricIconWell, metricNeutral.iconWell)}>
                                <CheckCircle2 size={22} strokeWidth={1.75} />
                            </div>
                            <div className="flex w-full min-w-0 flex-1 flex-col justify-center gap-1.5">
                                <p className="text-3xl font-bold tabular-nums leading-none tracking-tight text-foreground sm:text-4xl md:text-5xl">
                                    {kpis ? kpis.taskSuccessRate.toFixed(1) : '0.0'}%
                                </p>
                                <p className="mt-1 text-[10px] font-semibold uppercase leading-tight tracking-[0.1em] text-slate-500 sm:text-[11px] dark:text-zinc-400">{t('metrics.taskSuccessRate', { defaultValue: 'Taxa de sucesso' })}</p>
                                <p className="mx-auto mt-1 w-full text-pretty text-[9px] font-normal leading-snug text-slate-400 sm:text-[10px] dark:text-zinc-500">
                                    {t('metrics.taskSuccessRateDescription', { defaultValue: 'Percentual de tarefas que a assistente concluiu com sucesso.' })}
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className={cn(cockpitCardClass, "relative flex min-h-0 flex-col overflow-hidden")}>
                        <div className={cn("absolute left-0 top-0 h-1 w-full", metricNeutral.stripe)} />
                        <CardContent className="flex flex-1 flex-col items-center justify-between gap-3 px-4 py-5 text-center sm:gap-3.5 sm:px-5 sm:py-6 md:py-7">
                            <div className={cn(metricIconWell, metricNeutral.iconWell)}>
                                <Clock size={22} strokeWidth={1.75} />
                            </div>
                            <div className="flex w-full min-w-0 flex-1 flex-col justify-center gap-1.5">
                                <p className="text-3xl font-bold tabular-nums leading-none tracking-tight text-foreground sm:text-4xl md:text-5xl">
                                    {kpis && kpis.averageResponseTime > 0 ? (kpis.averageResponseTime / 1000).toFixed(1) : '0.0'}s
                                </p>
                                <p className="mt-1 text-[10px] font-semibold uppercase leading-tight tracking-[0.1em] text-slate-500 sm:text-[11px] dark:text-zinc-400">{t('metrics.averageResponseTime', { defaultValue: 'Tempo médio resposta' })}</p>
                                <p className="mx-auto mt-1 w-full text-pretty text-[9px] font-normal leading-snug text-slate-400 sm:text-[10px] dark:text-zinc-500">
                                    {t('metrics.averageResponseTimeDescription', { defaultValue: 'Tempo médio até a primeira resposta ao cliente.' })}
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className={cn(cockpitCardClass, "relative flex min-h-0 flex-col overflow-hidden sm:col-span-2 md:col-span-1")}>
                        <div className={cn("absolute left-0 top-0 h-1 w-full", metricNeutral.stripe)} />
                        <CardContent className="flex flex-1 flex-col items-center justify-between gap-3 px-4 py-5 text-center sm:gap-3.5 sm:px-5 sm:py-6 md:py-7">
                            <div className={cn(metricIconWell, metricNeutral.iconWell)}>
                                <DollarSign size={22} strokeWidth={1.75} />
                            </div>
                            <div className="flex w-full min-w-0 flex-1 flex-col justify-center gap-1.5">
                                <p className="break-all text-3xl font-bold tabular-nums leading-none tracking-tight text-foreground sm:break-normal sm:text-4xl md:text-5xl">
                                    R$ {kpis && kpis.costPerInteraction > 0 ? kpis.costPerInteraction.toFixed(4) : '0.0000'}
                                </p>
                                <p className="mt-1 text-[10px] font-semibold uppercase leading-tight tracking-[0.1em] text-slate-500 sm:text-[11px] dark:text-zinc-400">{t('metrics.costPerInteraction', { defaultValue: 'Custo por interação' })}</p>
                                <p className="mx-auto mt-1 w-full text-pretty text-[9px] font-normal leading-snug text-slate-400 sm:text-[10px] dark:text-zinc-500">
                                    {t('metrics.costPerInteractionDescription', { defaultValue: 'Estimativa de custo de uso da IA por interação.' })}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                    </div>
                </div>

                <div className="space-y-3 sm:space-y-4">
                    <div className="space-y-1.5">
                        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-primary dark:bg-primary/12">
                            <Activity className="h-3 w-3" />
                            {t('sections.activity', { defaultValue: 'Atividade e registros' })}
                        </div>
                        <p className="max-w-2xl text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
                            {t('sections.activityDescription', {
                                defaultValue: 'Acompanhe o histórico operacional, logs, conversas do WhatsApp e fallbacks para entender o que a plataforma registrou.',
                            })}
                        </p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-12 lg:gap-6 xl:gap-8">
                    <Card className={cn(cockpitCardClass, "min-h-0 min-w-0 overflow-hidden lg:col-span-8")}>
                        <CardHeader className="relative flex flex-col gap-3 border-b border-border/30 px-4 pb-3 pt-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4 md:px-5 md:pt-5 lg:px-6 dark:border-white/[0.05]">
                            <div className="min-w-0 pr-0 sm:pr-12">
                                <CardTitle className="text-base font-semibold tracking-tight text-foreground sm:text-lg md:text-xl">
                                    {t('activity.title', { defaultValue: 'Atividade do sistema' })}
                                </CardTitle>
                                <CardDescription className="mt-1 text-xs font-normal normal-case tracking-normal text-muted-foreground">
                                    {t('activity.subtitle', { defaultValue: 'Registros e alertas em tempo real' })}
                                </CardDescription>
                            </div>
                            <button
                                type="button"
                                onClick={() => workforceCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                                className="flex h-9 w-9 shrink-0 items-center justify-center self-end rounded-full border border-border bg-muted/60 text-foreground transition-colors hover:bg-muted sm:absolute sm:right-4 sm:top-4 md:right-5 md:top-5"
                                aria-label={t('activity.scrollToWorkforce', { defaultValue: 'Ir para a equipe de IA' })}
                            >
                                <ArrowDown className="h-4 w-4" strokeWidth={2.25} />
                            </button>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 pt-3 md:px-5 md:pb-5 lg:px-6">
                            <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
                                <TabsList className="mb-3 grid w-full grid-cols-2 gap-1 rounded-2xl border border-slate-200/70 bg-slate-50/80 p-1.5 shadow-[0_2px_8px_rgba(15,23,42,0.04)] min-[480px]:flex min-[480px]:h-auto min-[480px]:min-h-9 min-[480px]:w-full min-[480px]:flex-wrap min-[480px]:justify-start min-[480px]:gap-0.5 sm:mb-4 dark:border-white/[0.06] dark:bg-white/[0.04] dark:shadow-none lg:inline-flex lg:w-auto lg:flex-nowrap">
                                    <TabsTrigger value="activity" className={tabTriggerClass}>
                                        {t('activity.tabs.history', { defaultValue: 'Histórico' })}
                                    </TabsTrigger>
                                    <TabsTrigger value="logs" className={tabTriggerClass}>
                                        {t('activity.tabs.logs', { defaultValue: 'Logs' })}
                                        <span className="ml-1.5 rounded-full bg-slate-200/70 px-1.5 py-0.5 text-[9px] font-bold tabular-nums dark:bg-white/8">{systemLogs.length}</span>
                                    </TabsTrigger>
                                    <TabsTrigger value="whatsapp" className={tabTriggerClass}>
                                        {t('activity.tabs.whatsapp', { defaultValue: 'WhatsApp' })}
                                        <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold tabular-nums dark:bg-white/[0.08]">{whatsappConversations.length}</span>
                                    </TabsTrigger>
                                    <TabsTrigger value="fallbacks" className={tabTriggerClass}>
                                        {t('activity.tabs.fallbacks', { defaultValue: 'Fallbacks' })}
                                        <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold tabular-nums dark:bg-white/[0.08]">{fallbacks.length}</span>
                                    </TabsTrigger>
                                </TabsList>

                                {(selectedLogs.size > 0 || selectedFallbacks.size > 0) && (
                                    <div className="mb-3 flex flex-col gap-3 rounded-lg border border-border bg-muted/50 p-3 sm:mb-4 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-destructive/40 bg-destructive/10 text-sm font-semibold text-destructive sm:h-9 sm:w-9">
                                                {selectedLogs.size || selectedFallbacks.size}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-semibold uppercase tracking-wider text-foreground">{t('activity.itemsSelected', { defaultValue: 'Itens selecionados' })}</p>
                                                <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t('activity.readyToClean', { defaultValue: 'Prontos para limpeza' })}</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                                            <Button
                                                variant="ghost"
                                                className="h-9 rounded-lg text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-muted hover:text-foreground sm:h-10"
                                                onClick={() => { setSelectedLogs(new Set()); setSelectedFallbacks(new Set()); }}
                                            >
                                                {t('activity.cancel', { defaultValue: 'Cancelar' })}
                                            </Button>
                                            <Button
                                                className="h-9 rounded-lg bg-destructive px-5 text-[10px] font-semibold uppercase tracking-wider text-destructive-foreground hover:bg-destructive/90 sm:h-10 sm:px-6"
                                                onClick={selectedLogs.size > 0 ? handleDeleteMultipleLogs : handleDeleteMultipleFallbacks}
                                            >
                                                {t('activity.deleteNow', { defaultValue: 'Excluir agora' })}
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                <TabsContent value="activity" className="mt-0 outline-none">
                                    <ScrollArea className={cn(scrollH, "pr-2 sm:pr-4")}>
                                        <div className="space-y-3 pb-2">
                                            {(() => {
                                                return activityOverview.map((item, i) => {
                                                    const isError = Number(item.status) >= 2
                                                    const isIntegrationExpired =
                                                        item.tipo === 'Data expirada' ||
                                                        item.tipo === 'DATA EXPIRADA' ||
                                                        item.tipo?.toLowerCase().includes('data expirada') ||
                                                        item.tipo?.toLowerCase().includes('expirada')

                                                    return (
                                                    <div
                                                        key={i}
                                                        className={cn(
                                                            cockpitRowClass,
                                                            "flex cursor-pointer items-start gap-3 border-l-2 p-3 hover:bg-muted/40 dark:hover:bg-muted/50 sm:gap-4 sm:p-4",
                                                            isError
                                                                ? "border-l-destructive bg-destructive/5 dark:bg-destructive/10"
                                                                : "border-l-transparent"
                                                        )}
                                                        onClick={() => isIntegrationExpired && handleOutlookAuth()}
                                                    >
                                                        <div
                                                            className={cn(
                                                                "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-sm sm:h-11 sm:w-11",
                                                                isError
                                                                    ? "border-destructive/20 bg-destructive/10 text-destructive"
                                                                    : "border-slate-200/70 bg-slate-50 text-slate-400 shadow-sm transition-all duration-200 group-hover/row:border-blue-100 group-hover/row:bg-blue-50/60 group-hover/row:text-blue-500 dark:border-white/[0.07] dark:bg-white/4 dark:text-zinc-400 dark:group-hover/row:border-blue-400/20 dark:group-hover/row:text-blue-300"
                                                            )}
                                                        >
                                                            {isError ? <AlertCircle size={20} /> : <Bot size={20} />}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="mb-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                                                                <h4 className={cn("text-xs font-semibold uppercase tracking-wide sm:text-sm", isError ? "text-destructive" : "text-foreground")}>
                                                                    {translateActivityType(item.tipo, t)}
                                                                </h4>
                                                                <span className="shrink-0 text-[10px] font-medium text-muted-foreground">{formatRelativeTime(item.data_evento, t)}</span>
                                                            </div>
                                                            <p className="text-[10px] font-medium text-muted-foreground sm:text-[11px]">
                                                                {t('activity.origin', { defaultValue: 'Origem' })}{" "}
                                                                <span className="text-foreground uppercase">{item.user_name || t('activity.autonomous', { defaultValue: 'Automático' })}</span>
                                                            </p>
                                                            {isError && (
                                                                <Badge variant="destructive" className="mt-2 border-0 px-2 py-0.5 text-[9px] font-semibold uppercase">
                                                                    {t('activity.actionRequired', { defaultValue: 'Ação necessária' })}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                    )
                                                })
                                            })()}
                                        </div>
                                    </ScrollArea>
                                </TabsContent>

                                <TabsContent value="logs" className="mt-0 outline-none">
                                    <div className="mb-3 flex flex-col gap-2 px-0 sm:mb-4 sm:flex-row sm:items-center sm:justify-between sm:px-1">
                                        <div onClick={toggleSelectAllLogs} className="group flex cursor-pointer items-center gap-2 sm:gap-3">
                                            <div className={cn(
                                                "flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors",
                                                selectedLogs.size === systemLogs.length && systemLogs.length > 0
                                                    ? "border-primary bg-primary"
                                                    : "border-border bg-background group-hover:border-muted-foreground/40"
                                            )}>
                                                {selectedLogs.size === systemLogs.length && systemLogs.length > 0 && <CheckCircle2 size={14} className="text-primary-foreground" />}
                                            </div>
                                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors group-hover:text-foreground">{t('activity.selectAll', { defaultValue: 'Selecionar todos' })}</span>
                                        </div>
                                        <Badge variant="secondary" className="w-fit rounded-md px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide">{systemLogs.length} {t('activity.tabs.logs', { defaultValue: 'Logs' }).toUpperCase()}</Badge>
                                    </div>

                                    <ScrollArea className={cn(scrollH, "pr-2 sm:pr-4")}>
                                        <div className="space-y-3 pb-2">
                                            {systemLogs.map((log) => {
                                                const isError = log.level === 'error'
                                                const selected = selectedLogs.has(log.id)
                                                return (
                                                <div
                                                    key={log.id}
                                                    onClick={() => toggleLogSelection(log.id)}
                                                    className={cn(
                                                        cockpitRowClass,
                                                        "flex cursor-pointer items-start gap-3 border-l-2 p-3 hover:bg-muted/40 dark:hover:bg-muted/50 sm:items-center sm:gap-4 sm:p-4",
                                                        isError && "border-l-destructive bg-destructive/5 dark:bg-destructive/10",
                                                        !isError && !selected && "border-l-transparent",
                                                        selected && "border-l-primary/50 bg-primary/5 ring-1 ring-primary/15 dark:bg-primary/10"
                                                    )}
                                                >
                                                    <div className={cn(
                                                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-sm sm:h-11 sm:w-11",
                                                        isError ? "border-destructive/20 bg-destructive/10 text-destructive" : "border-slate-200/80 bg-slate-50 text-slate-500 dark:border-white/[0.07] dark:bg-white/4 dark:text-foreground"
                                                    )}>
                                                        {isError ? <AlertCircle size={20} /> : <Activity size={20} />}
                                                    </div>

                                                    <div className="min-w-0 flex-1">
                                                        <div className="mb-1 flex flex-wrap items-center gap-2">
                                                            <Badge variant="secondary" className={cn(
                                                                "rounded-md border-0 px-2 py-0.5 text-[9px] font-semibold uppercase",
                                                                isError && "bg-destructive/15 text-destructive"
                                                            )}>
                                                                {log.log_type.replace(/_/g, ' ')}
                                                            </Badge>
                                                            <span className="text-[10px] font-medium uppercase text-muted-foreground">{formatRelativeTime(log.created_at, t)}</span>
                                                        </div>
                                                        <p className="text-sm font-medium leading-snug text-foreground">
                                                            {translateLogMessage(log.message, t)}
                                                        </p>
                                                    </div>

                                                    <div
                                                        onClick={(e) => e.stopPropagation()}
                                                        className={cn(
                                                            "mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors sm:mt-0",
                                                            selected ? "border-primary bg-primary" : "border-border bg-muted/50"
                                                        )}
                                                    >
                                                        {selected && <CheckCircle2 size={14} className="text-primary-foreground" />}
                                                    </div>
                                                </div>
                                                )
                                            })}
                                        </div>
                                    </ScrollArea>
                                </TabsContent>

                                <TabsContent value="whatsapp" className="mt-0 outline-none">
                                    <div className="mb-3 flex items-center justify-between gap-2 px-0 sm:mb-4 sm:px-1">
                                        <Badge variant="secondary" className="w-fit max-w-[calc(100%-5rem)] truncate rounded-md px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide">
                                            {whatsappConversations.length}{" "}
                                            {t('whatsapp.conversations', { defaultValue: 'conversas' })}
                                        </Badge>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 shrink-0 rounded-lg text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-muted hover:text-foreground"
                                            onClick={loadData}
                                        >
                                            {t('whatsapp.refresh', { defaultValue: 'Atualizar' })}
                                        </Button>
                                    </div>

                                    <ScrollArea className={cn(scrollH, "pr-2 sm:pr-4")}>
                                        <div className="space-y-3 pb-2">
                                            {whatsappConversations.length === 0 ? (
                                                <div className={cn(cockpitRowClass, "p-6 text-center")}>
                                                    <p className="text-sm font-medium text-foreground">
                                                        {t('whatsapp.emptyTitle', { defaultValue: 'Nenhuma conversa do WhatsApp encontrada' })}
                                                    </p>
                                                    <p className="mt-2 text-[11px] text-muted-foreground">
                                                        {t('whatsapp.emptyHint', {
                                                            defaultValue:
                                                                'Assim que o número oficial receber mensagens, o resumo operacional aparece aqui.',
                                                        })}
                                                    </p>
                                                </div>
                                            ) : (
                                                whatsappConversations.map((conversation) => {
                                                    const statusBadge = getWhatsAppStatusBadge(
                                                        conversation.last_message_status,
                                                        conversation.last_message_direction,
                                                        t
                                                    )

                                                    return (
                                                        <div
                                                            key={conversation.last_message_id}
                                                            className={cn(
                                                                cockpitRowClass,
                                                                "flex items-start gap-3 border-l-2 border-l-transparent p-3 sm:gap-4 sm:p-4"
                                                            )}
                                                        >
                                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/70 bg-slate-50 text-slate-400 shadow-sm transition-all duration-200 group-hover/row:border-blue-100 group-hover/row:bg-blue-50/60 group-hover/row:text-blue-500 dark:border-white/[0.07] dark:bg-white/4 dark:text-zinc-400 dark:group-hover/row:border-blue-400/20 dark:group-hover/row:text-blue-300 sm:h-11 sm:w-11">
                                                                <MessageSquare size={20} />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="mb-1 flex flex-wrap items-center gap-2">
                                                                    <Badge variant="secondary" className="rounded-md border-0 px-2 py-0.5 text-[9px] font-semibold uppercase">
                                                                        {conversation.agent_name || t('whatsapp.noAgent', { defaultValue: 'Sem agente' })}
                                                                    </Badge>
                                                                    {conversation.unread_count > 0 && (
                                                                        <Badge variant="secondary" className="rounded-md px-2 py-0.5 text-[9px] font-semibold uppercase">
                                                                            {conversation.unread_count}{" "}
                                                                            {conversation.unread_count > 1
                                                                                ? t('whatsapp.unreadPlural', { defaultValue: 'não lidas' })
                                                                                : t('whatsapp.unreadSingular', { defaultValue: 'não lida' })}
                                                                        </Badge>
                                                                    )}
                                                                    <Badge className={cn("rounded-md border-0 px-2 py-0.5 text-[9px] font-semibold uppercase", statusBadge.className)}>
                                                                        {statusBadge.label}
                                                                    </Badge>
                                                                    <span className="text-[10px] font-medium uppercase text-muted-foreground">
                                                                        {formatRelativeTime(conversation.last_message_at, t)}
                                                                    </span>
                                                                </div>
                                                                <p className="text-sm font-medium leading-snug text-foreground">
                                                                    {formatWhatsAppConversationLabel(conversation)}
                                                                </p>
                                                                <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                                                                    {conversation.last_message}
                                                                </p>
                                                                <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                                                    {conversation.last_message_direction === 'outbound'
                                                                        ? t('whatsapp.lastOutbound', { defaultValue: 'Última saída' })
                                                                        : t('whatsapp.lastInbound', { defaultValue: 'Última entrada' })}{" "}
                                                                    {t('whatsapp.atTime', { defaultValue: 'às' })}{" "}
                                                                    {formatTime(conversation.last_message_at)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    )
                                                })
                                            )}
                                        </div>
                                    </ScrollArea>
                                </TabsContent>

                                <TabsContent value="fallbacks" className="mt-0 outline-none">
                                    <div className="mb-3 flex items-center gap-2 px-0 sm:mb-4 sm:gap-3 sm:px-1">
                                        <div
                                            onClick={toggleSelectAllFallbacks}
                                            className={cn(
                                                "flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border-2 transition-colors",
                                                selectedFallbacks.size === fallbacks.length && fallbacks.length > 0
                                                    ? "border-primary bg-primary"
                                                    : "border-border bg-background hover:border-muted-foreground/40"
                                            )}
                                        >
                                            {selectedFallbacks.size === fallbacks.length && fallbacks.length > 0 && <CheckCircle2 size={14} className="text-primary-foreground" />}
                                        </div>
                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t('activity.selectAllFallbacks', { defaultValue: 'Selecionar todos os fallbacks' })}</span>
                                    </div>

                                    <ScrollArea className={cn(scrollH, "pr-2 sm:pr-4")}>
                                        <div className="space-y-3 pb-2">
                                            {fallbacks.map((fb) => {
                                                const selected = selectedFallbacks.has(fb.id)
                                                return (
                                                <div
                                                    key={fb.id}
                                                    onClick={() => toggleFallbackSelection(fb.id)}
                                                    className={cn(
                                                        cockpitRowClass,
                                                        "flex cursor-pointer items-start gap-3 border-l-2 p-3 hover:bg-muted/40 dark:hover:bg-muted/50 sm:gap-4 sm:p-4",
                                                        selected
                                                            ? "border-l-primary bg-primary/5 ring-1 ring-primary/15 dark:bg-primary/10"
                                                            : "border-l-transparent"
                                                    )}
                                                >
                                                    <div
                                                        onClick={(e) => e.stopPropagation()}
                                                        className={cn(
                                                            "mt-0.5 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md border-2 transition-colors",
                                                            selected ? "border-destructive bg-destructive" : "border-border bg-background hover:border-destructive/40"
                                                        )}
                                                    >
                                                        {selected && <CheckCircle2 size={14} className="text-destructive-foreground" />}
                                                    </div>

                                                    <div className="min-w-0 flex-1">
                                                        <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                                                            <Badge variant="outline" className="w-fit px-2 py-0.5 text-[8px] font-semibold uppercase text-muted-foreground">
                                                                {fb.impact_level.toUpperCase()}
                                                            </Badge>
                                                            <span className="shrink-0 text-[10px] font-medium text-muted-foreground">{formatRelativeTime(fb.created_at, t)}</span>
                                                        </div>
                                                        <p className="mb-2 break-words text-sm font-medium leading-snug text-foreground">{translateFallbackMessage(fb.message, t)}</p>
                                                        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                            {t('activity.node', { defaultValue: 'Nó' })}{" "}
                                                            <span className="text-foreground">{fb.node_id || t('activity.notAvailable', { defaultValue: 'N/D' })}</span>
                                                        </p>
                                                    </div>
                                                </div>
                                                )
                                            })}
                                        </div>
                                    </ScrollArea>
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>

                    <div ref={workforceCardRef} className="min-h-0 min-w-0 overflow-hidden lg:col-span-4">
                        <Card className={cn(cockpitCardClass, "flex h-full min-h-0 min-w-0 flex-col overflow-hidden")}>
                            <CardHeader className="border-b border-slate-200/60 px-4 pb-3.5 pt-4 md:px-5 md:pt-5 dark:border-white/[0.06]">
                                <div className="flex items-center justify-between gap-2">
                                    <CardTitle className="min-w-0 text-base font-semibold tracking-tight text-foreground sm:text-lg md:text-xl">
                                        {t('workforce.title', { defaultValue: 'Equipe de IA' })}
                                    </CardTitle>
                                    <div className="flex items-center gap-1.5">
                                        <span className="relative flex h-2.5 w-2.5 shrink-0">
                                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                                            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                                        </span>
                                    </div>
                                </div>
                                <CardDescription className="mt-1 text-xs font-normal normal-case tracking-normal text-slate-400 dark:text-zinc-500">
                                    {t('workforce.subtitle', { defaultValue: 'Status dos seus agentes' })}
                                </CardDescription>
                            </CardHeader>

                        <CardContent className="flex min-h-0 min-w-0 flex-1 overflow-hidden px-3 pb-5 pt-0 md:px-5 md:pb-6">
                            <ScrollArea className={cn("w-full min-w-0 max-w-full", "min-h-0 pr-2 sm:pr-3", workforceScrollH)}>
                                <div className="space-y-3 pr-1">
                                    {agents.map((agent) => (
                                        <div
                                            key={agent.id}
                                            onClick={() => navigate('agents')}
                                            className={cn(
                                                cockpitRowClass,
                                                "cursor-pointer grid min-h-0 w-full max-w-full grid-cols-[1fr_auto] items-center gap-2 p-4 pl-5 active:scale-[0.99] sm:gap-3 sm:p-4 sm:pl-5"
                                            )}
                                        >
                                            <div
                                                className={cn(
                                                    "pointer-events-none absolute bottom-0 left-0 top-0 w-1 rounded-l-xl bg-border/40",
                                                    agent.status_id === 1 && "bg-linear-to-b from-emerald-400 to-emerald-600",
                                                    (agent.status_id === 3 || agent.status_id === 4) && "bg-linear-to-b from-amber-400 to-amber-600",
                                                    agent.status_id !== 1 && agent.status_id !== 3 && agent.status_id !== 4 && "bg-linear-to-b from-red-400 to-destructive"
                                                )}
                                            />

                                            <div className="flex min-w-0 items-center gap-3 pl-3 sm:gap-3 sm:pl-4">
                                                <div className="relative shrink-0">
                                                    <Avatar className="h-11 w-11 border-2 border-white shadow-md dark:border-zinc-800 sm:h-12 sm:w-12">
                                                        <AvatarFallback className="bg-linear-to-br from-blue-500 to-violet-600 text-base font-bold text-white sm:text-lg">
                                                            {agent.nome.substring(0, 2).toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div
                                                        className={cn(
                                                            "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background sm:h-4 sm:w-4",
                                                            agent.status_id === 1 && "bg-emerald-500",
                                                            (agent.status_id === 3 || agent.status_id === 4) && "bg-yellow-500",
                                                            agent.status_id !== 1 && agent.status_id !== 3 && agent.status_id !== 4 && "bg-destructive"
                                                        )}
                                                    />
                                                </div>
                                                <div className="min-w-0 flex-1 overflow-hidden">
                                                    <p className="truncate text-sm font-semibold leading-tight text-foreground sm:text-base">{agent.nome}</p>
                                                    {agent.status_id === 1 ? (
                                                        <div className="mt-1.5 flex w-fit max-w-full items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-0.5">
                                                            <div className="h-1 w-1 shrink-0 animate-pulse rounded-full bg-emerald-500" />
                                                            <span className="truncate text-[9px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">{t('workforce.status.connected', { defaultValue: 'Conectado' })}</span>
                                                        </div>
                                                    ) : agent.status_id === 3 || agent.status_id === 4 ? (
                                                        <div className="mt-1.5 flex w-fit max-w-full items-center gap-1.5 rounded-md bg-yellow-500/10 px-2 py-0.5">
                                                            <div className="h-1 w-1 shrink-0 animate-pulse rounded-full bg-yellow-500" />
                                                            <span className="truncate text-[9px] font-semibold uppercase tracking-wider text-yellow-800 dark:text-yellow-400">{t('workforce.status.paused', { defaultValue: 'Em pausa' })}</span>
                                                        </div>
                                                    ) : (
                                                        <div className="mt-1.5 flex w-fit max-w-full items-center gap-1.5 rounded-md bg-destructive/10 px-2 py-0.5">
                                                            <div className="h-1 w-1 shrink-0 animate-pulse rounded-full bg-destructive" />
                                                            <span className="truncate text-[9px] font-semibold uppercase tracking-wider text-destructive">{t('workforce.status.inactive', { defaultValue: 'Inativo' })}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-transparent bg-transparent opacity-0 transition-all duration-200 group-hover/row:border-blue-100 group-hover/row:bg-blue-50 group-hover/row:opacity-100 dark:group-hover/row:border-blue-400/20 dark:group-hover/row:bg-blue-400/8 sm:h-9 sm:w-9">
                                                <ArrowRight size={15} className="text-blue-500 dark:text-blue-300" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                    </div>
                </div>
                </div>
            </div>
            </div>
        </>
    )
}
