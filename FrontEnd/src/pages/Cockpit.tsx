import React, { useEffect, useState, useCallback } from "react"
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
import { AgentService, DashboardData, KPIService, KPIMetrics, WhatsAppService, type WhatsAppConversationSummary } from "../services/api"
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
    if (!isoString) return t('cockpit:time.now')
    const date = new Date(isoString)
    const now = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diff < 60) return `${diff}${t('cockpit:time.secondsAgo')}`
    if (diff < 3600) return `${Math.floor(diff / 60)}${t('cockpit:time.minutesAgo')}`
    if (diff < 86400) return `${Math.floor(diff / 3600)}${t('cockpit:time.hoursAgo')}`
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

export function Cockpit() {
    const { t } = useTranslation('cockpit')
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
                    <p className="text-sm font-medium">{t('errors.loading')}</p>
                    <p className="text-xs text-muted-foreground mt-1">{error}</p>
                    <Button onClick={loadData} className="mt-4" size="sm">
                        {t('errors.tryAgain')}
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
    const handleOutlookAuth = () => {
        if (!user?.id || !user?.email) {
            toast.error('Usuário não autenticado corretamente.')
            return
        }

        // @ts-ignore - Vite environment variables
        const clientId = import.meta.env.VITE_OUTLOOK_CLIENT_ID
        // @ts-ignore - Vite environment variables
        const tenantId = import.meta.env.VITE_OUTLOOK_TENANT_ID

        if (!clientId || !tenantId) {
            toast.error('Outlook OAuth não configurado. Configure as variáveis VITE_OUTLOOK_CLIENT_ID e VITE_OUTLOOK_TENANT_ID no arquivo .env')
            return
        }

        // ✅ Sempre usar o IP do servidor (não localhost) - garantindo que seja 192.168.15.31
        const redirectUri = 'http://192.168.15.31:3333/auth/outlook/callback'

        // Debug: verificar se está usando o IP correto
        console.log('[Cockpit] Redirect URI:', redirectUri)
        console.log('[Cockpit] Client ID:', clientId)
        console.log('[Cockpit] Tenant ID:', tenantId)

        const oauthUrl =
            `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize` +
            `?client_id=${clientId}` +
            `&response_type=code` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}` +
            `&scope=${encodeURIComponent('offline_access Mail.Read Mail.Send User.Read')}` +
            `&state=${user.id}`

        console.log('[Cockpit] OAuth URL completa:', oauthUrl)
        window.location.href = oauthUrl
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
                label: t('workforce.status.noStatus'),
                icon: AlertCircle
            };
        }

        switch (statusId) {
            case 1: // Verde - Conectado/Funcionando
                return {
                    color: 'text-emerald-500',
                    bgColor: 'bg-emerald-500',
                    label: t('workforce.status.connected'),
                    icon: CheckCircle2
                };
            case 2: // Vermelho - Cancelado
                return {
                    color: 'text-red-500',
                    bgColor: 'bg-red-500',
                    label: t('workforce.status.cancelled'),
                    icon: AlertCircle
                };
            case 3: // Amarelo - Pausado
                return {
                    color: 'text-yellow-500',
                    bgColor: 'bg-yellow-500',
                    label: t('workforce.status.paused'),
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
    let systemStatusLabel = t('status.healthy')
    let systemStatusColor =
        'bg-emerald-500/10 text-emerald-800 border-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30'
    let systemStatusDotColor = 'bg-emerald-500'
    let systemStatusPingColor = 'bg-emerald-400'

    if (hasRedStatus) {
        systemStatus = 'blocked'
        systemStatusLabel = t('status.blocked')
        systemStatusColor =
            'bg-red-500/10 text-red-800 border-red-500/25 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/35'
        systemStatusDotColor = 'bg-red-500'
        systemStatusPingColor = 'bg-red-400'
    } else if (hasYellowStatus || hasPausedAgents) {
        systemStatus = 'unstable'
        systemStatusLabel = t('status.unstable')
        systemStatusColor =
            'bg-amber-500/12 text-amber-900 border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200 dark:border-amber-500/35'
        systemStatusDotColor = 'bg-amber-500'
        systemStatusPingColor = 'bg-amber-400'
    } else {
        systemStatus = 'stable'
        systemStatusLabel = t('status.stable')
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
            toast.error(t('errors.auth'))
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
                toast.error(t('errors.deleteEvent'))
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

            toast.success(t('success.deleted'))
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
            toast.error(t('errors.selectAtLeastOne'))
            return
        }

        if (!user?.email) {
            toast.error(t('errors.auth'))
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
                toast.error(t('errors.deleteEvent'))
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

            toast.success(`${idsToDelete.length} ${t('success.eventsDeleted')}`)
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
            toast.error(t('errors.auth'))
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
                toast.error(t('errors.deleteLog'))
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

            toast.success(t('success.logDeleted'))
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
            toast.error(t('errors.selectAtLeastOneLog'))
            return
        }

        if (!user?.email) {
            toast.error(t('errors.auth'))
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
                toast.error(t('errors.deleteLogs'))
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

            toast.success(`${idsToDelete.length} ${t('success.logsDeleted')}`)
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

    const metricAccents = [
        { icon: "bg-blue-500/[0.12] text-blue-700 dark:bg-blue-500/25 dark:text-blue-300", stripe: "bg-blue-500 dark:bg-blue-400" },
        { icon: "bg-indigo-500/[0.12] text-indigo-700 dark:bg-indigo-500/25 dark:text-indigo-300", stripe: "bg-indigo-500 dark:bg-indigo-400" },
        { icon: "bg-emerald-500/[0.12] text-emerald-800 dark:bg-emerald-500/25 dark:text-emerald-300", stripe: "bg-emerald-500 dark:bg-emerald-400" },
        { icon: "bg-red-500/[0.12] text-red-700 dark:bg-red-500/25 dark:text-red-300", stripe: "bg-red-500 dark:bg-red-400" },
        { icon: "bg-amber-500/[0.14] text-amber-900 dark:bg-amber-500/25 dark:text-amber-200", stripe: "bg-amber-500 dark:bg-amber-400" },
        { icon: "bg-pink-500/[0.12] text-pink-700 dark:bg-pink-500/25 dark:text-pink-300", stripe: "bg-pink-500 dark:bg-pink-400" },
    ] as const

    const metricIconWell =
        "flex h-[3.25rem] w-[3.25rem] shrink-0 items-center justify-center rounded-xl border border-slate-200/70 bg-white/50 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9)] dark:border-white/[0.14] dark:bg-black/25 dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),inset_0_-1px_0_0_rgba(0,0,0,0.35)]"

    /** Painéis principais: elevação clara no dark (fundo ~16% vs página ~11%) + borda e highlight superior */
    const cockpitCardClass =
        "rounded-2xl border border-slate-200/90 bg-card text-card-foreground shadow-[0_1px_2px_rgba(15,23,42,0.05),0_12px_36px_-16px_rgba(15,23,42,0.12)] transition-all duration-200 hover:border-slate-300/90 hover:shadow-[0_16px_48px_-20px_rgba(15,23,42,0.14)] dark:border-white/[0.11] dark:bg-[hsl(222_32%_16%)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_20px_50px_-20px_rgba(0,0,0,0.75),inset_0_1px_0_0_rgba(255,255,255,0.08)] dark:hover:border-white/[0.16] dark:hover:bg-[hsl(222_32%_17.5%)] dark:hover:shadow-[0_0_0_1px_rgba(255,255,255,0.07),0_24px_56px_-18px_rgba(0,0,0,0.82),inset_0_1px_0_0_rgba(255,255,255,0.1)]"

    /** Linhas dentro do card de atividade (recuadas em relação ao painel) */
    const cockpitRowClass =
        "rounded-xl border border-slate-200/75 bg-slate-50/70 shadow-sm shadow-slate-900/[0.04] transition-colors dark:border-white/[0.09] dark:bg-[hsl(222_36%_12.5%)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_8px_24px_-16px_rgba(0,0,0,0.5)]"

    const scrollH = "h-[min(28rem,55svh)] sm:h-[min(31rem,60svh)] lg:h-[500px]"

    return (
        <>
            <div className="min-h-full w-full min-w-0 animate-in fade-in duration-500 bg-background px-3 py-4 sm:px-4 sm:py-6 md:px-6 md:py-8">
                <div className="mx-auto max-w-[1600px] space-y-6 sm:space-y-8">

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl md:text-4xl">{t('title')}</h2>
                        <p className="mt-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground sm:text-xs">{t('subtitle')}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-2xl border border-slate-200/90 bg-card/95 p-2 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.1)] backdrop-blur-sm dark:border-white/[0.11] dark:bg-[hsl(222_32%_15%)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_16px_40px_-16px_rgba(0,0,0,0.65)] sm:gap-3">
                        <Badge variant="outline" className={cn("max-w-[min(100%,20rem)] gap-2 truncate rounded-lg border px-2.5 py-2 text-[10px] font-semibold sm:px-3 sm:text-xs", systemStatusColor)}>
                            <span className="relative flex h-2.5 w-2.5 shrink-0">
                                <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-75", systemStatusPingColor)} />
                                <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", systemStatusDotColor)} />
                            </span>
                            <span className="truncate">{systemStatusLabel}</span>
                        </Badge>
                        <Button variant="ghost" size="icon" onClick={loadData} className="h-9 w-9 shrink-0 rounded-lg sm:h-10 sm:w-10">
                            <RefreshCw className={cn("h-4 w-4 text-muted-foreground sm:h-5 sm:w-5", isRefreshing && "animate-spin")} />
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                    {[
                        { title: t('metrics.interactions'), value: stats.totalInteractions, icon: MessageSquare },
                        { title: t('metrics.activeLeads'), value: stats.activeLeads || 0, icon: Users },
                        { title: t('metrics.messagesPerMin'), value: stats.avgResponseTime > 0 ? stats.avgResponseTime.toFixed(1) : '0.0', icon: Activity },
                        { title: t('metrics.stuck'), value: unassignedConversations, icon: AlertCircle, isAlert: unassignedConversations > 0, route: 'inbox' },
                        { title: t('metrics.fallbacks'), value: fallbacksCount, icon: AlertTriangle, isAlert: fallbacksCount > 0 },
                        { title: t('metrics.pending'), value: pendingDecisionsCount, icon: Clock, isAlert: pendingDecisionsCount > 0, route: 'inbox?tab=decisions' },
                    ].map((stat, i) => (
                        <Card
                            key={i}
                            className={cn(
                                cockpitCardClass,
                                "relative flex min-h-[11.5rem] flex-col justify-center overflow-hidden sm:min-h-[13rem]",
                                stat.route &&
                                    "cursor-pointer hover:border-primary/35 hover:shadow-[0_12px_32px_-14px_rgba(59,130,246,0.2)] active:scale-[0.99] dark:hover:border-primary/40 dark:hover:shadow-[0_0_0_1px_rgba(96,165,250,0.2),0_20px_48px_-16px_rgba(0,0,0,0.8)]",
                                stat.isAlert && Number(stat.value) > 0 &&
                                    "border-destructive/25 bg-destructive/[0.04] shadow-[0_0_0_1px_rgba(239,68,68,0.08)] dark:border-red-500/30 dark:bg-[hsl(222_32%_15%)] dark:shadow-[0_0_0_1px_rgba(248,113,113,0.15),0_16px_40px_-16px_rgba(0,0,0,0.65)]"
                            )}
                            onClick={() => stat.route && navigate(stat.route)}
                        >
                            <div className={cn("absolute left-0 top-0 h-1 w-full", metricAccents[i % metricAccents.length].stripe)} />
                            <CardContent className="flex flex-col items-center gap-4 px-4 py-5 text-center sm:gap-5 sm:px-5 sm:py-6">
                                <div className={cn(metricIconWell, metricAccents[i % metricAccents.length].icon)}>
                                    <stat.icon size={26} strokeWidth={2.25} className="shrink-0" />
                                </div>
                                <div className="min-w-0 space-y-1">
                                    <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground sm:text-3xl">{stat.value}</p>
                                    <p className="px-1 text-[10px] font-semibold uppercase leading-snug tracking-wider text-muted-foreground sm:text-[11px]">{stat.title}</p>
                                </div>
                                {stat.isAlert && Number(stat.value) > 0 && (
                                    <>
                                        <div className="absolute bottom-0 left-0 top-0 w-px bg-destructive/80 dark:bg-destructive" />
                                        <div className="absolute right-2 top-2 rounded-md bg-destructive/10 p-1.5 text-destructive sm:right-3 sm:top-3 dark:bg-destructive/20 dark:text-red-400">
                                            <stat.icon size={18} className="animate-pulse" aria-hidden />
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
                    <Card className={cn(cockpitCardClass, "relative flex min-h-[11.5rem] flex-col justify-center overflow-hidden sm:min-h-[13rem]")}>
                        <div className="absolute left-0 top-0 h-1 w-full bg-emerald-500 dark:bg-emerald-400" />
                        <CardContent className="flex flex-col items-center gap-4 px-4 py-5 text-center sm:gap-5 sm:px-5 sm:py-6">
                            <div className={cn(metricIconWell, "bg-emerald-500/[0.12] text-emerald-800 dark:bg-emerald-500/25 dark:text-emerald-300")}>
                                <CheckCircle2 size={26} strokeWidth={2.25} />
                            </div>
                            <div className="space-y-1">
                                <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground sm:text-3xl">
                                    {kpis ? kpis.taskSuccessRate.toFixed(1) : '0.0'}%
                                </p>
                                <p className="text-[10px] font-semibold uppercase leading-snug tracking-wider text-muted-foreground sm:text-[11px]">{t('metrics.taskSuccessRate')}</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className={cn(cockpitCardClass, "relative flex min-h-[11.5rem] flex-col justify-center overflow-hidden sm:min-h-[13rem]")}>
                        <div className="absolute left-0 top-0 h-1 w-full bg-blue-500 dark:bg-blue-400" />
                        <CardContent className="flex flex-col items-center gap-4 px-4 py-5 text-center sm:gap-5 sm:px-5 sm:py-6">
                            <div className={cn(metricIconWell, "bg-blue-500/[0.12] text-blue-700 dark:bg-blue-500/25 dark:text-blue-300")}>
                                <Clock size={26} strokeWidth={2.25} />
                            </div>
                            <div className="space-y-1">
                                <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground sm:text-3xl">
                                    {kpis && kpis.averageResponseTime > 0 ? (kpis.averageResponseTime / 1000).toFixed(1) : '0.0'}s
                                </p>
                                <p className="text-[10px] font-semibold uppercase leading-snug tracking-wider text-muted-foreground sm:text-[11px]">{t('metrics.averageResponseTime')}</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className={cn(cockpitCardClass, "relative flex min-h-[11.5rem] flex-col justify-center overflow-hidden sm:min-h-[13rem] sm:col-span-2 lg:col-span-1")}>
                        <div className="absolute left-0 top-0 h-1 w-full bg-pink-500 dark:bg-pink-400" />
                        <CardContent className="flex flex-col items-center gap-4 px-4 py-5 text-center sm:gap-5 sm:px-5 sm:py-6">
                            <div className={cn(metricIconWell, "bg-pink-500/[0.12] text-pink-700 dark:bg-pink-500/25 dark:text-pink-300")}>
                                <DollarSign size={26} strokeWidth={2.25} />
                            </div>
                            <div className="min-w-0 space-y-1">
                                <p className="break-all text-2xl font-semibold tabular-nums tracking-tight text-foreground sm:break-normal sm:text-3xl">
                                    R$ {kpis && kpis.costPerInteraction > 0 ? kpis.costPerInteraction.toFixed(4) : '0.0000'}
                                </p>
                                <p className="text-[10px] font-semibold uppercase leading-snug tracking-wider text-muted-foreground sm:text-[11px]">{t('metrics.costPerInteraction')}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
                    <Card className={cn(cockpitCardClass, "overflow-hidden lg:col-span-8")}>
                        <CardHeader className="relative flex flex-col gap-3 px-4 pb-2 pt-5 sm:flex-row sm:items-start sm:justify-between sm:gap-4 md:px-6 md:pt-6 lg:px-8">
                            <div className="min-w-0 pr-0 sm:pr-14">
                                <CardTitle className="text-lg font-semibold tracking-tight text-foreground sm:text-xl md:text-2xl">{t('activity.title')}</CardTitle>
                                <CardDescription className="mt-1 text-[10px] font-semibold uppercase tracking-widest sm:text-[11px]">
                                    {t('activity.subtitle')}
                                </CardDescription>
                            </div>
                            <button
                                type="button"
                                onClick={() => workforceCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                                className="flex h-10 w-10 shrink-0 items-center justify-center self-end rounded-full bg-primary text-primary-foreground shadow-md transition-all hover:bg-primary/90 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:absolute sm:right-4 sm:top-5 md:right-6 md:top-6"
                                aria-label="Ir para IA Workforce"
                            >
                                <ArrowDown className="h-5 w-5" strokeWidth={2.5} />
                            </button>
                        </CardHeader>
                        <CardContent className="px-4 pb-5 pt-0 md:px-6 md:pb-6 lg:px-8">
                            <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
                                <TabsList className="mb-4 flex h-auto min-h-10 w-full flex-wrap items-center justify-start gap-1 rounded-xl border border-slate-200/80 bg-slate-100/70 p-1 shadow-inner shadow-slate-900/5 sm:mb-6 dark:border-white/[0.1] dark:bg-black/35 dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] lg:inline-flex lg:w-auto lg:flex-nowrap">
                                    <TabsTrigger
                                        value="activity"
                                        className="grow rounded-lg px-3 py-2 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground transition-all data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-[0_1px_3px_rgba(15,23,42,0.08),0_4px_12px_-4px_rgba(15,23,42,0.12)] dark:data-[state=active]:border dark:data-[state=active]:border-white/[0.1] dark:data-[state=active]:bg-[hsl(222_32%_19%)] dark:data-[state=active]:text-foreground dark:data-[state=active]:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),0_8px_24px_-12px_rgba(0,0,0,0.55)] sm:grow-0 sm:px-4 sm:text-[10px]"
                                    >
                                        {t('activity.tabs.history')}
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="logs"
                                        className="grow rounded-lg px-3 py-2 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground transition-all data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-[0_1px_3px_rgba(15,23,42,0.08),0_4px_12px_-4px_rgba(15,23,42,0.12)] dark:data-[state=active]:border dark:data-[state=active]:border-white/[0.1] dark:data-[state=active]:bg-[hsl(222_32%_19%)] dark:data-[state=active]:text-foreground dark:data-[state=active]:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),0_8px_24px_-12px_rgba(0,0,0,0.55)] sm:grow-0 sm:px-4 sm:text-[10px]"
                                    >
                                        {t('activity.tabs.logs')} ({systemLogs.length})
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="whatsapp"
                                        className="grow rounded-lg px-3 py-2 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground transition-all data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-[0_1px_3px_rgba(15,23,42,0.08),0_4px_12px_-4px_rgba(15,23,42,0.12)] dark:data-[state=active]:border dark:data-[state=active]:border-white/[0.1] dark:data-[state=active]:bg-[hsl(222_32%_19%)] dark:data-[state=active]:text-foreground dark:data-[state=active]:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),0_8px_24px_-12px_rgba(0,0,0,0.55)] sm:grow-0 sm:px-4 sm:text-[10px]"
                                    >
                                        WhatsApp ({whatsappConversations.length})
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="fallbacks"
                                        className="grow rounded-lg px-3 py-2 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground transition-all data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-[0_1px_3px_rgba(15,23,42,0.08),0_4px_12px_-4px_rgba(15,23,42,0.12)] dark:data-[state=active]:border dark:data-[state=active]:border-white/[0.1] dark:data-[state=active]:bg-[hsl(222_32%_19%)] dark:data-[state=active]:text-foreground dark:data-[state=active]:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),0_8px_24px_-12px_rgba(0,0,0,0.55)] sm:grow-0 sm:px-4 sm:text-[10px]"
                                    >
                                        {t('activity.tabs.fallbacks')} ({fallbacks.length})
                                    </TabsTrigger>
                                </TabsList>

                                {(selectedLogs.size > 0 || selectedFallbacks.size > 0) && (
                                    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/[0.07] p-4 shadow-[0_0_0_1px_rgba(239,68,68,0.06)] animate-in slide-in-from-top-2 duration-300 dark:border-red-500/35 dark:bg-red-950/25 dark:shadow-[inset_0_1px_0_0_rgba(252,165,165,0.08)] sm:mb-6 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-5">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive text-sm font-semibold text-destructive-foreground shadow-sm sm:h-10 sm:w-10">
                                                {selectedLogs.size || selectedFallbacks.size}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-semibold uppercase tracking-wider text-foreground">{t('activity.itemsSelected')}</p>
                                                <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t('activity.readyToClean')}</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                                            <Button
                                                variant="ghost"
                                                className="h-9 rounded-lg text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-muted hover:text-foreground sm:h-10"
                                                onClick={() => { setSelectedLogs(new Set()); setSelectedFallbacks(new Set()); }}
                                            >
                                                {t('activity.cancel')}
                                            </Button>
                                            <Button
                                                className="h-9 rounded-lg bg-destructive px-5 text-[10px] font-semibold uppercase tracking-wider text-destructive-foreground shadow-sm hover:bg-destructive/90 sm:h-10 sm:px-6"
                                                onClick={selectedLogs.size > 0 ? handleDeleteMultipleLogs : handleDeleteMultipleFallbacks}
                                            >
                                                {t('activity.deleteNow')}
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                <TabsContent value="activity" className="mt-0 outline-none">
                                    <ScrollArea className={cn(scrollH, "pr-2 sm:pr-4")}>
                                        <div className="space-y-3 pb-2">
                                            {(() => {
                                                let normalIndex = 0
                                                return activityOverview.map((item, i) => {
                                                    const isError = Number(item.status) >= 2
                                                    const isIntegrationExpired =
                                                        item.tipo === 'Data expirada' ||
                                                        item.tipo === 'DATA EXPIRADA' ||
                                                        item.tipo?.toLowerCase().includes('data expirada') ||
                                                        item.tipo?.toLowerCase().includes('expirada')
                                                    const toneVariants = [
                                                        "border-l-4 border-l-blue-500",
                                                        "border-l-4 border-l-violet-500",
                                                        "border-l-4 border-l-cyan-500",
                                                        "border-l-4 border-l-indigo-500",
                                                        "border-l-4 border-l-emerald-500",
                                                    ] as const
                                                    const tone = toneVariants[normalIndex % toneVariants.length]
                                                    if (!isError) normalIndex++

                                                    return (
                                                    <div
                                                        key={i}
                                                        className={cn(
                                                            cockpitRowClass,
                                                            "flex cursor-pointer items-start gap-3 p-3 hover:bg-slate-100/90 dark:hover:bg-[hsl(222_36%_14%)] sm:gap-4 sm:p-4",
                                                            isError && "border-destructive/35 border-l-4 border-l-destructive bg-red-50/80 hover:bg-red-50 dark:border-red-500/40 dark:bg-red-950/30 dark:hover:bg-red-950/40",
                                                            !isError && tone
                                                        )}
                                                        onClick={() => isIntegrationExpired && handleOutlookAuth()}
                                                    >
                                                        <div
                                                            className={cn(
                                                                "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-primary-foreground shadow-sm sm:h-11 sm:w-11",
                                                                isError ? "bg-destructive" : "bg-primary"
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
                                                                {t('activity.origin')}{" "}
                                                                <span className="text-foreground uppercase">{item.user_name || t('activity.autonomous')}</span>
                                                            </p>
                                                            {isError && (
                                                                <Badge variant="destructive" className="mt-2 border-0 px-2 py-0.5 text-[9px] font-semibold uppercase">
                                                                    {t('activity.actionRequired')}
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
                                                    ? "border-primary bg-primary shadow-sm"
                                                    : "border-border bg-background group-hover:border-muted-foreground/40"
                                            )}>
                                                {selectedLogs.size === systemLogs.length && systemLogs.length > 0 && <CheckCircle2 size={14} className="text-primary-foreground" />}
                                            </div>
                                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors group-hover:text-foreground">{t('activity.selectAll')}</span>
                                        </div>
                                        <Badge variant="secondary" className="w-fit rounded-md px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide">{systemLogs.length} {t('activity.tabs.logs').toUpperCase()}</Badge>
                                    </div>

                                    <ScrollArea className={cn(scrollH, "pr-2 sm:pr-4")}>
                                        <div className="space-y-3 pb-2">
                                            {systemLogs.map((log, i) => {
                                                const isError = log.level === 'error'
                                                const selected = selectedLogs.has(log.id)
                                                const stripeTones = [
                                                    "border-l-4 border-l-blue-500",
                                                    "border-l-4 border-l-violet-500",
                                                    "border-l-4 border-l-cyan-500",
                                                    "border-l-4 border-l-indigo-500",
                                                ] as const
                                                const stripe = stripeTones[i % stripeTones.length]
                                                return (
                                                <div
                                                    key={log.id}
                                                    onClick={() => toggleLogSelection(log.id)}
                                                    className={cn(
                                                        cockpitRowClass,
                                                        "flex cursor-pointer items-start gap-3 p-3 hover:bg-slate-100/90 dark:hover:bg-[hsl(222_36%_14%)] sm:items-center sm:gap-4 sm:p-4",
                                                        isError && "border-destructive/35 border-l-4 border-l-destructive bg-red-50/80 dark:border-red-500/40 dark:bg-red-950/30 dark:hover:bg-red-950/40",
                                                        selected && !isError && "border-primary/45 bg-primary/[0.07] shadow-[0_0_0_1px_rgba(59,130,246,0.12)] dark:border-primary/50 dark:bg-primary/10 dark:shadow-[0_0_0_1px_rgba(96,165,250,0.2)]",
                                                        !isError && !selected && stripe
                                                    )}
                                                >
                                                    <div className={cn(
                                                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-primary-foreground shadow-sm sm:h-11 sm:w-11",
                                                        isError ? "bg-destructive" : "bg-primary"
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
                                                            selected ? "border-primary bg-primary shadow-sm" : "border-border bg-muted/50"
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
                                        <Badge variant="secondary" className="w-fit rounded-md px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide">
                                            {whatsappConversations.length} conversas
                                        </Badge>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 rounded-lg text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-muted hover:text-foreground"
                                            onClick={loadData}
                                        >
                                            Atualizar
                                        </Button>
                                    </div>

                                    <ScrollArea className={cn(scrollH, "pr-2 sm:pr-4")}>
                                        <div className="space-y-3 pb-2">
                                            {whatsappConversations.length === 0 ? (
                                                <div className={cn(cockpitRowClass, "p-6 text-center")}>
                                                    <p className="text-sm font-medium text-foreground">Nenhuma conversa do WhatsApp encontrada</p>
                                                    <p className="mt-2 text-[11px] text-muted-foreground">
                                                        Assim que o número oficial receber mensagens, o resumo operacional vai aparecer aqui.
                                                    </p>
                                                </div>
                                            ) : (
                                                whatsappConversations.map((conversation, i) => {
                                                    const stripeTones = [
                                                        "border-l-4 border-l-emerald-500",
                                                        "border-l-4 border-l-cyan-500",
                                                        "border-l-4 border-l-blue-500",
                                                        "border-l-4 border-l-teal-500",
                                                    ] as const
                                                    const stripe = stripeTones[i % stripeTones.length]

                                                    return (
                                                        <div
                                                            key={conversation.last_message_id}
                                                            className={cn(
                                                                cockpitRowClass,
                                                                stripe,
                                                                "flex items-start gap-3 p-3 sm:gap-4 sm:p-4"
                                                            )}
                                                        >
                                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/12 text-emerald-700 shadow-sm dark:bg-emerald-500/20 dark:text-emerald-300 sm:h-11 sm:w-11">
                                                                <MessageSquare size={20} />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="mb-1 flex flex-wrap items-center gap-2">
                                                                    <Badge variant="secondary" className="rounded-md border-0 px-2 py-0.5 text-[9px] font-semibold uppercase">
                                                                        {conversation.agent_name || 'sem agente'}
                                                                    </Badge>
                                                                    {conversation.unread_count > 0 && (
                                                                        <Badge className="rounded-md border-0 bg-emerald-500/12 px-2 py-0.5 text-[9px] font-semibold uppercase text-emerald-700 dark:text-emerald-300">
                                                                            {conversation.unread_count} não lida{conversation.unread_count > 1 ? 's' : ''}
                                                                        </Badge>
                                                                    )}
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
                                                                    {conversation.last_message_direction === 'outbound' ? 'Última saída' : 'Última entrada'} às {formatTime(conversation.last_message_at)}
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
                                                    ? "border-amber-600 bg-amber-600"
                                                    : "border-border bg-background hover:border-amber-500/50"
                                            )}
                                        >
                                            {selectedFallbacks.size === fallbacks.length && fallbacks.length > 0 && <CheckCircle2 size={14} className="text-white" />}
                                        </div>
                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t('activity.selectAllFallbacks')}</span>
                                    </div>

                                    <ScrollArea className={cn(scrollH, "pr-2 sm:pr-4")}>
                                        <div className="space-y-3 pb-2">
                                            {fallbacks.map((fb, i) => {
                                                const selected = selectedFallbacks.has(fb.id)
                                                const stripes = [
                                                    "border-l-4 border-l-amber-500",
                                                    "border-l-4 border-l-orange-500",
                                                    "border-l-4 border-l-yellow-500",
                                                ] as const
                                                const stripe = stripes[i % stripes.length]
                                                return (
                                                <div
                                                    key={fb.id}
                                                    onClick={() => toggleFallbackSelection(fb.id)}
                                                    className={cn(
                                                        cockpitRowClass,
                                                        "flex cursor-pointer items-start gap-3 p-3 hover:bg-slate-100/90 dark:hover:bg-[hsl(222_36%_14%)] sm:gap-4 sm:p-4",
                                                        selected
                                                            ? "border-destructive/35 border-l-4 border-l-destructive bg-red-50/90 dark:border-red-500/45 dark:bg-red-950/35 dark:shadow-[0_0_0_1px_rgba(248,113,113,0.15)]"
                                                            : stripe
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
                                                            <Badge className="w-fit border-0 bg-amber-500/90 px-2 py-0.5 text-[8px] font-semibold uppercase text-amber-950 dark:text-amber-950">
                                                                {fb.impact_level.toUpperCase()}
                                                            </Badge>
                                                            <span className="shrink-0 text-[10px] font-medium text-muted-foreground">{formatRelativeTime(fb.created_at, t)}</span>
                                                        </div>
                                                        <p className="mb-2 break-words text-sm font-medium leading-snug text-foreground">{translateFallbackMessage(fb.message, t)}</p>
                                                        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                            {t('activity.node')} <span className="text-foreground">{fb.node_id || t('activity.notAvailable')}</span>
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

                    <div ref={workforceCardRef} className="lg:col-span-4">
                        <Card className={cn(cockpitCardClass, "flex h-full min-h-0 flex-col")}>
                            <CardHeader className="px-4 pb-2 pt-5 md:px-6 md:pt-6">
                                <div className="flex items-center justify-between gap-2">
                                    <CardTitle className="text-base font-semibold uppercase tracking-wide text-foreground sm:text-lg md:text-xl">{t('workforce.title')}</CardTitle>
                                    <div className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.45)]" />
                                </div>
                                <CardDescription className="mt-1 text-[10px] font-semibold uppercase tracking-widest sm:text-[11px]">
                                    {t('workforce.subtitle')}
                                </CardDescription>
                            </CardHeader>

                        <CardContent className="flex-1 px-3 pb-5 pt-0 md:px-5 md:pb-6">
                            <ScrollArea className={cn("pr-2 sm:pr-3", "h-[min(24rem,50svh)] sm:h-[min(28rem,55svh)] lg:h-[550px]")}>
                                <div className="space-y-3">
                                    {agents.map((agent) => (
                                        <div
                                            key={agent.id}
                                            onClick={() => navigate('agents')}
                                            className={cn(
                                                cockpitRowClass,
                                                "group relative flex cursor-pointer items-center justify-between gap-2 overflow-hidden p-3 pl-4 transition-all hover:border-primary/40 hover:bg-slate-100/90 active:scale-[0.99] dark:hover:border-primary/35 dark:hover:bg-[hsl(222_36%_14%)] sm:p-4 sm:pl-5"
                                            )}
                                        >
                                            <div
                                                className={cn(
                                                    "absolute bottom-0 left-0 top-0 w-1 rounded-l-xl",
                                                    agent.status_id === 1 && "bg-emerald-500",
                                                    (agent.status_id === 3 || agent.status_id === 4) && "bg-yellow-500",
                                                    agent.status_id !== 1 && agent.status_id !== 3 && agent.status_id !== 4 && "bg-destructive"
                                                )}
                                            />

                                            <div className="flex min-w-0 flex-1 items-center gap-3 pl-2 sm:gap-4 sm:pl-3">
                                                <div className="relative shrink-0">
                                                    <Avatar className="h-11 w-11 border-2 border-background shadow-sm sm:h-12 sm:w-12">
                                                        <AvatarFallback className="bg-primary text-base font-semibold text-primary-foreground sm:text-lg">
                                                            {agent.nome.substring(0, 2).toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div
                                                        className={cn(
                                                            "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background shadow-sm sm:h-4 sm:w-4",
                                                            agent.status_id === 1 && "bg-emerald-500",
                                                            (agent.status_id === 3 || agent.status_id === 4) && "bg-yellow-500",
                                                            agent.status_id !== 1 && agent.status_id !== 3 && agent.status_id !== 4 && "bg-destructive"
                                                        )}
                                                    />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-semibold leading-tight text-foreground sm:text-base">{agent.nome}</p>
                                                    {agent.status_id === 1 ? (
                                                        <div className="mt-1.5 flex w-fit items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-0.5">
                                                            <div className="h-1 w-1 animate-pulse rounded-full bg-emerald-500" />
                                                            <span className="text-[9px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">{t('workforce.status.connected')}</span>
                                                        </div>
                                                    ) : agent.status_id === 3 || agent.status_id === 4 ? (
                                                        <div className="mt-1.5 flex w-fit items-center gap-1.5 rounded-md bg-yellow-500/10 px-2 py-0.5">
                                                            <div className="h-1 w-1 animate-pulse rounded-full bg-yellow-500" />
                                                            <span className="text-[9px] font-semibold uppercase tracking-wider text-yellow-800 dark:text-yellow-400">{t('workforce.status.paused')}</span>
                                                        </div>
                                                    ) : (
                                                        <div className="mt-1.5 flex w-fit items-center gap-1.5 rounded-md bg-destructive/10 px-2 py-0.5">
                                                            <div className="h-1 w-1 animate-pulse rounded-full bg-destructive" />
                                                            <span className="text-[9px] font-semibold uppercase tracking-wider text-destructive">{t('workforce.status.inactive')}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 opacity-0 transition-opacity group-hover:opacity-100 sm:h-9 sm:w-9">
                                                <ArrowRight size={16} className="text-primary" />
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
        </>
    )
}
