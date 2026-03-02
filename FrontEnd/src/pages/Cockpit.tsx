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
    ArrowDown
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar"
import { Badge } from "../components/ui/badge"
import { ScrollArea } from "../components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip"
import { AgentService, DashboardData } from "../services/api"
import { supabase } from "../utils/supabase/client"
import { useAuth } from "../contexts/AuthContext"
import { useNavigation } from "../contexts/NavigationContext"
import { toast } from "sonner"
import { Checkbox } from "../components/ui/checkbox"
import { useTheme } from "next-themes"
import { useTranslation } from "react-i18next"
import { translateActivityType, translateLogMessage, translateFallbackMessage } from "../utils/i18n-helpers"

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

export function Cockpit() {
    const { t } = useTranslation('cockpit')
    const { theme } = useTheme()
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
                logsCountRes
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
                supabase.rpc('sp_count_system_logs_by_email', { p_email: user.email })
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
    let systemStatus: 'healthy' | 'stable' | 'blocked' = 'healthy'
    let systemStatusLabel = t('status.healthy')
    let systemStatusColor = 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
    let systemStatusDotColor = 'bg-emerald-500'
    let systemStatusPingColor = 'bg-emerald-400'

    // PRIORIDADE 1: Status 2 (vermelho) = Sistema Travado
    if (hasRedStatus) {
        systemStatus = 'blocked'
        systemStatusLabel = t('status.blocked')
        systemStatusColor = 'bg-red-500/10 text-red-600 border-red-500/20'
        systemStatusDotColor = 'bg-red-500'
        systemStatusPingColor = 'bg-red-400'
    }
    // PRIORIDADE 2: Status 3 (amarelo) ou agentes pausados = Instabilidade Detectada
    else if (hasYellowStatus || hasPausedAgents) {
        systemStatus = 'unstable'
        systemStatusLabel = t('status.unstable')
        systemStatusColor = 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
        systemStatusDotColor = 'bg-yellow-500'
        systemStatusPingColor = 'bg-yellow-400'
    }
    // PRIORIDADE 3: Tudo ok = Sistema Estável (usando ciano da marca)
    else {
        systemStatus = 'stable'
        systemStatusLabel = t('status.stable')
        systemStatusColor = 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20'
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

    // Definição de cores fixas em HEX para não ter erro de compilação
    const cardThemes = [
        { bg: "#3b82f6", icon: "text-white", cardBg: "#eff6ff" }, // Blue - pastel azul
        { bg: "#6366f1", icon: "text-white", cardBg: "#eef2ff" }, // Indigo - pastel índigo
        { bg: "#10b981", icon: "text-white", cardBg: "#ecfdf5" }, // Emerald - pastel verde
        { bg: "#ef4444", icon: "text-white", cardBg: "#fef2f2" }, // Red - pastel vermelho
        { bg: "#f59e0b", icon: "text-white", cardBg: "#fffbeb" }, // Amber - pastel amarelo
        { bg: "#ec4899", icon: "text-white", cardBg: "#fdf2f8" }, // Pink - pastel rosa
    ];

    return (
        <>
            <style>{`
                /* Glassmorphism para cards de agentes */
                .agent-card-glass {
                    background: rgba(255, 255, 255, 0.8) !important;
                    backdrop-filter: blur(12px) saturate(180%) !important;
                    -webkit-backdrop-filter: blur(12px) saturate(180%) !important;
                    border: 1px solid rgba(255, 255, 255, 0.3) !important;
                }
                
                .agent-card-glass:hover {
                    background: rgba(255, 255, 255, 0.95) !important;
                    backdrop-filter: blur(16px) saturate(200%) !important;
                    -webkit-backdrop-filter: blur(16px) saturate(200%) !important;
                }

                /* FORÇA COR CIANO NOS TABS ATIVOS */
                [data-slot="tabs-trigger"][data-state="active"],
                [data-slot="tabs-trigger"][aria-selected="true"] {
                    background-color: #0e7490 !important;
                    background: #0e7490 !important;
                    color: #ffffff !important;
                    box-shadow: 0 10px 20px rgba(14, 116, 144, 0.2) !important;
                }

                [data-slot="tabs-trigger"][data-state="active"] *,
                [data-slot="tabs-trigger"][aria-selected="true"] * {
                    color: #ffffff !important;
                }
            `}</style>
            {/* Fundo cinza azulado suave para dar contraste com os cards brancos */}
            <div className="space-y-8 animate-in fade-in duration-500 bg-[#F4F7FA] -m-4 p-10 min-h-screen">
                <div className="max-w-[1600px] mx-auto space-y-10">

                {/* HEADER */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-4">
                    <div>
                        <h2 className="text-4xl font-black tracking-tighter" style={{ color: theme === 'dark' ? '#f1f5f9' : '#0f172a' }}>{t('title')}</h2>
                        <p className="font-bold uppercase text-[10px] tracking-[0.2em]" style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b' }}>{t('subtitle')}</p>
                    </div>
                    <div className="flex items-center gap-4 bg-background p-3 rounded-[2rem] shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50">
                        <Badge variant="outline" className={`gap-2 px-4 py-2 rounded-2xl border-none font-black text-xs ${systemStatusColor}`}>
                            <span className="relative flex h-3 w-3">
                                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${systemStatusPingColor}`}></span>
                                <span className={`relative inline-flex rounded-full h-3 w-3 ${systemStatusDotColor}`}></span>
                            </span>
                            {systemStatusLabel}
                        </Badge>
                        <Button variant="ghost" size="icon" onClick={loadData} className="h-10 w-10 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800">
                            <RefreshCw className={`h-5 w-5 text-slate-400 dark:text-slate-300 ${isRefreshing ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </div>

                {/* METRIC CARDS - USANDO STYLE PARA GARANTIR A COR */}
                <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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
                            className={`border-none rounded-[2.5rem] shadow-2xl shadow-slate-200/60 relative overflow-hidden transition-all hover:scale-105 h-56 flex flex-col justify-center ${stat.route ? 'cursor-pointer' : ''}`}
                            style={{ backgroundColor: cardThemes[i].cardBg }}
                            onClick={() => stat.route && navigate(stat.route)}
                        >
                            <CardContent className="p-8 flex flex-col items-center text-center gap-4">

                                {/* AQUI ESTÁ A MUDANÇA: backgroundColor fixo via Style */}
                                <div
                                    className="h-16 w-16 rounded-3xl flex items-center justify-center shadow-lg text-white"
                                    style={{ backgroundColor: cardThemes[i].bg }}
                                >
                                    <stat.icon size={32} strokeWidth={3} />
                                </div>

                                <div className="z-10">
                                    <h4 className="text-3xl font-black text-slate-900 leading-none mb-1">{stat.value}</h4>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{stat.title}</p>
                                </div>

                                {/* BORDA ESQUERDA COLORIDA E ÍCONE PULSANTE - Substitui badge ATENÇÃO */}
                                {stat.isAlert && Number(stat.value) > 0 && (
                                    <>
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500 rounded-l-3xl" />
                                        <div className="absolute top-6 right-6">
                                            <stat.icon 
                                                size={24} 
                                                className="text-red-500 animate-pulse drop-shadow-lg" 
                                                style={{ filter: 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.6))' }}
                                            />
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* ABAIXO MANTÉM O RESTANTE DA ESTRUTURA (FEED E AGENTES) */}
                <div className="grid gap-10 lg:grid-cols-12">
                    <Card className="lg:col-span-8 border-none shadow-xl shadow-slate-200/40 dark:shadow-slate-900/40 bg-background rounded-[3.5rem] overflow-hidden">
                        <CardHeader className="p-10 pb-6 px-16 flex flex-row items-center justify-between relative">
                            <div>
                                <h2 className="text-2xl font-black tracking-tight" style={{ fontFamily: 'Inter, system-ui, sans-serif', color: theme === 'dark' ? '#f1f5f9' : '#0f172a' }}>{t('activity.title')}</h2>
                                <p className="text-[10px] font-black uppercase tracking-widest mt-1" style={{ fontFamily: 'Inter, system-ui, sans-serif', color: theme === 'dark' ? '#64748b' : '#94a3b8' }}>{t('activity.subtitle')}</p>
                            </div>
                            <button
                                onClick={() => {
                                    workforceCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                                }}
                                className="absolute right-6 h-12 w-12 rounded-full text-white shadow-xl shadow-cyan-500/40 hover:shadow-cyan-500/60 transition-all duration-300 flex items-center justify-center group hover:scale-110 active:scale-95"
                                style={{
                                    top: '80px',
                                    background: 'linear-gradient(135deg, #0e7490 0%, #0891b2 50%, #06b6d4 100%)',
                                    boxShadow: '0 8px 20px -5px rgba(6, 182, 212, 0.4), 0 0 0 1px rgba(6, 182, 212, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                                    opacity: 1,
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'linear-gradient(135deg, #0891b2 0%, #06b6d4 50%, #22d3ee 100%)'
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'linear-gradient(135deg, #0e7490 0%, #0891b2 50%, #06b6d4 100%)'
                                }}
                                aria-label="Ir para IA Workforce"
                            >
                                <ArrowDown className="h-7 w-7 transition-transform group-hover:translate-y-1 group-hover:scale-110" strokeWidth={3} />
                            </button>
                        </CardHeader>
                        <CardContent className="px-10 pb-10">
                            <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
                                {/* BARRA DE ABAS - CONTROLE MANUAL TOTAL */}
                                <TabsList className="bg-slate-200/50 p-1.5 rounded-full flex w-fit border-none shadow-none mb-8 outline-none ring-0">
                                    <TabsTrigger
                                        value="activity"
                                        className={`rounded-full font-black text-[10px] uppercase tracking-widest px-8 h-10 transition-all border-none outline-none ring-0 focus:ring-0 focus:outline-none focus-visible:ring-0 shadow-none
                                            ${currentTab === "activity"
                                                ? "!bg-[#0e7490] !text-white shadow-lg shadow-cyan-900/20"
                                                : "text-slate-500 hover:text-slate-800 bg-transparent"
                                            }`}
                                    >
                                        {t('activity.tabs.history')}
                                    </TabsTrigger>

                                    <TabsTrigger
                                        value="logs"
                                        className={`rounded-full font-black text-[10px] uppercase tracking-widest px-8 h-10 transition-all border-none outline-none ring-0 focus:ring-0 focus:outline-none focus-visible:ring-0 shadow-none
                                            ${currentTab === "logs"
                                                ? "!bg-[#0e7490] !text-white shadow-lg shadow-cyan-900/20"
                                                : "text-slate-500 hover:text-slate-800 bg-transparent"
                                            }`}
                                    >
                                        {t('activity.tabs.logs')} ({systemLogs.length})
                                    </TabsTrigger>

                                    <TabsTrigger
                                        value="fallbacks"
                                        className={`rounded-full font-black text-[10px] uppercase tracking-widest px-8 h-10 transition-all border-none outline-none ring-0 focus:ring-0 focus:outline-none focus-visible:ring-0 shadow-none
                                            ${currentTab === "fallbacks"
                                                ? "!bg-[#0e7490] !text-white shadow-lg shadow-cyan-900/20"
                                                : "text-slate-500 hover:text-slate-800 bg-transparent"
                                            }`}
                                    >
                                        {t('activity.tabs.fallbacks')} ({fallbacks.length})
                                    </TabsTrigger>
                                </TabsList>

                                {/* BARRA DE AÇÕES - ESTILO BANNER DE TOPO (NÃO BUGA MAIS) */}
                                {/* BARRA DE AÇÕES EM MASSA - AGORA EM AZUL VIBRANTE */}
                                {(selectedLogs.size > 0 || selectedFallbacks.size > 0) && (
                                    <div className="flex items-center justify-between gap-6 bg-red-50 dark:bg-red-950/30 text-red-900 dark:text-red-100 p-6 px-10 rounded-[2.5rem] mb-8 animate-in slide-in-from-top-4 duration-500 shadow-xl shadow-red-200/30 dark:shadow-red-900/30 border-2 border-red-200 dark:border-red-800/50">
                                        <div className="flex items-center gap-5">
                                            <div className="h-10 w-10 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg font-black text-sm">
                                                {selectedLogs.size || selectedFallbacks.size}
                                            </div>
                                            <div style={{ paddingLeft: '8px' }}>
                                                <p className="font-black text-xs uppercase tracking-[0.2em] leading-none" style={{ color: 'inherit' }}>{t('activity.itemsSelected')}</p>
                                                <p className="text-[10px] font-bold uppercase mt-1" style={{ color: 'inherit', opacity: 0.8 }}>{t('activity.readyToClean')}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Button
                                                variant="ghost"
                                                className="text-white hover:bg-white/10 rounded-2xl font-black text-[10px] uppercase tracking-widest px-6 h-11"
                                                onClick={() => { setSelectedLogs(new Set()); setSelectedFallbacks(new Set()); }}
                                            >
                                                {t('activity.cancel')}
                                            </Button>
                                            <Button
                                                className="bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest px-8 h-11 shadow-xl shadow-red-500/30 transition-all active:scale-95"
                                                onClick={selectedLogs.size > 0 ? handleDeleteMultipleLogs : handleDeleteMultipleFallbacks}
                                            >
                                                {t('activity.deleteNow')}
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                <TabsContent value="activity">
                                    <ScrollArea className="h-[500px] pr-4">
                                        <div className="space-y-6">
                                            {(() => {
                                                let errorIndex = 0;
                                                let normalIndex = 0;
                                                return activityOverview.map((item, i) => {
                                                    const isError = Number(item.status) >= 2;
                                                    // Cores pastéis baseadas no tipo de evento
                                                    const getPastelStyle = () => {
                                                        if (isError) {
                                                            // Cores pastéis para erros (tons de vermelho, rosa, laranja)
                                                            const errorPastelStyles = [
                                                                { bg: '#fef2f2', border: '#fecaca', shadow: 'rgba(254, 202, 202, 0.3)' }, // red-50
                                                                { bg: '#fff1f2', border: '#ffd1d9', shadow: 'rgba(255, 209, 217, 0.3)' }, // rose-50
                                                                { bg: '#fdf2f8', border: '#fce7f3', shadow: 'rgba(252, 231, 243, 0.3)' }, // pink-50
                                                                { bg: '#fff7ed', border: '#ffedd5', shadow: 'rgba(255, 237, 213, 0.3)' }, // orange-50
                                                            ];
                                                            const style = errorPastelStyles[errorIndex % errorPastelStyles.length];
                                                            errorIndex++;
                                                            return {
                                                                backgroundColor: style.bg,
                                                                borderColor: style.border,
                                                                boxShadow: `0 10px 15px -3px ${style.shadow}, 0 4px 6px -2px ${style.shadow}, 0 0 0 1px ${style.border}`,
                                                            };
                                                        }
                                                        // Cores pastéis diferentes baseadas no índice para variedade - com mesmo destaque dos erros
                                                        const pastelStyles = [
                                                            { bg: '#eff6ff', border: '#93c5fd', shadow: 'rgba(147, 197, 253, 0.3)' }, // blue-50 com blue-300 border
                                                            { bg: '#faf5ff', border: '#c4b5fd', shadow: 'rgba(196, 181, 253, 0.3)' }, // purple-50 com purple-300 border
                                                            { bg: '#ecfeff', border: '#67e8f9', shadow: 'rgba(103, 232, 249, 0.3)' }, // cyan-50 com cyan-300 border
                                                            { bg: '#eef2ff', border: '#a5b4fc', shadow: 'rgba(165, 180, 252, 0.3)' }, // indigo-50 com indigo-300 border
                                                            { bg: '#ecfdf5', border: '#6ee7b7', shadow: 'rgba(110, 231, 183, 0.3)' }, // emerald-50 com emerald-300 border
                                                        ];
                                                        const style = pastelStyles[normalIndex % pastelStyles.length];
                                                        normalIndex++;
                                                        return {
                                                            backgroundColor: style.bg,
                                                            borderColor: style.border,
                                                            boxShadow: `0 10px 15px -3px ${style.shadow}, 0 4px 6px -2px ${style.shadow}, 0 0 0 1px ${style.border}`,
                                                        };
                                                    };
                                                const baseStyle = getPastelStyle();
                                                // Verifica se é uma notificação de integração expirada (DATA EXPIRADA)
                                                const isIntegrationExpired = item.tipo === 'Data expirada' || item.tipo === 'DATA EXPIRADA' || item.tipo?.toLowerCase().includes('data expirada') || item.tipo?.toLowerCase().includes('expirada');
                                                
                                                return (
                                                    <div 
                                                        key={i} 
                                                        className="flex items-start gap-6 p-6 rounded-[3rem] border-2 transition-all duration-300 cursor-pointer group" 
                                                        style={baseStyle}
                                                        onClick={() => {
                                                            if (isIntegrationExpired) {
                                                                handleOutlookAuth();
                                                            }
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.transform = 'scale(1.02)';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.transform = 'scale(1)';
                                                        }}
                                                    >
                                                        <div className={`h-12 w-12 rounded-2xl shrink-0 flex items-center justify-center text-white shadow-md ${isError ? 'bg-red-500' : 'bg-blue-500'} mt-1`}>
                                                            {isError ? <AlertCircle size={20} /> : <Bot size={20} />}
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex justify-between items-center mb-1">
                                                                <h4 className={`font-black text-sm uppercase tracking-tight ${isError ? 'text-red-700' : 'text-slate-800'}`}>{translateActivityType(item.tipo, t)}</h4>
                                                                <span className="text-[10px] font-bold text-slate-400">{formatRelativeTime(item.data_evento, t)}</span>
                                                            </div>
                                                            <p className="text-[10px] font-bold text-slate-500">{t('activity.origin')} <span className="text-slate-900 uppercase">{item.user_name || t('activity.autonomous')}</span></p>
                                                            {isError && (
                                                                <Badge className="mt-2 bg-red-600 text-white border-none font-black text-[9px] px-2 py-0.5">{t('activity.actionRequired')}</Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })})()}
                                        </div>
                                    </ScrollArea>
                                </TabsContent>

                                <TabsContent value="logs">
                                    <div className="flex items-center justify-between mb-6 px-4">
                                        <div
                                            onClick={toggleSelectAllLogs}
                                            className="flex items-center gap-3 cursor-pointer group"
                                        >
                                            <div className={`h-6 w-6 rounded-full border-2 transition-all flex items-center justify-center ${selectedLogs.size === systemLogs.length && systemLogs.length > 0 ? 'bg-slate-900 border-slate-900 shadow-lg' : 'bg-white border-slate-200 group-hover:border-slate-400'}`}>
                                                {selectedLogs.size === systemLogs.length && systemLogs.length > 0 && <CheckCircle2 size={14} className="text-white" />}
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-slate-600 transition-colors">{t('activity.selectAll')}</span>
                                        </div>
                                        <Badge variant="outline" className="rounded-full border-slate-200 text-slate-400 font-black text-[9px] px-3">{systemLogs.length} {t('activity.tabs.logs').toUpperCase()}</Badge>
                                    </div>

                                    <ScrollArea className="h-[500px] pr-4">
                                        <div className="space-y-6 px-2 pb-4">
                                            {systemLogs.map((log, i) => {
                                                const getPastelStyle = () => {
                                                    const isError = log.level === 'error';
                                                    
                                                    // Se for erro, sempre usa vermelho pastel (mesmo se selecionado ou não)
                                                    if (isError) {
                                                        if (selectedLogs.has(log.id)) {
                                                            return {
                                                                backgroundColor: '#fee2e2', // red-100 (um pouco mais escuro quando selecionado)
                                                                borderColor: '#fca5a5', // red-300
                                                                boxShadow: '0 10px 15px -3px rgba(252, 165, 165, 0.3), 0 4px 6px -2px rgba(252, 165, 165, 0.2)',
                                                            };
                                                        }
                                                        // Mantém vermelho pastel mesmo quando não selecionado
                                                        return {
                                                            backgroundColor: '#fef2f2', // red-50
                                                            borderColor: '#fecaca', // red-200
                                                            boxShadow: '0 4px 6px -1px rgba(254, 202, 202, 0.2), 0 2px 4px -1px rgba(254, 202, 202, 0.1)',
                                                        };
                                                    }
                                                    
                                                    // Se estiver selecionado e não for erro, usa azul
                                                    if (selectedLogs.has(log.id)) {
                                                        return {
                                                            backgroundColor: '#eff6ff', // blue-50
                                                            borderColor: '#dbeafe', // blue-100
                                                            boxShadow: '0 10px 15px -3px rgba(219, 234, 254, 0.3), 0 4px 6px -2px rgba(219, 234, 254, 0.2)',
                                                        };
                                                    }
                                                    const pastelStyles = [
                                                        { bg: '#eff6ff', border: '#dbeafe', shadow: 'rgba(219, 234, 254, 0.2)' }, // blue-50
                                                        { bg: '#faf5ff', border: '#f3e8ff', shadow: 'rgba(243, 232, 255, 0.2)' }, // purple-50
                                                        { bg: '#ecfeff', border: '#cffafe', shadow: 'rgba(207, 250, 254, 0.2)' }, // cyan-50
                                                        { bg: '#eef2ff', border: '#e0e7ff', shadow: 'rgba(224, 231, 255, 0.2)' }, // indigo-50
                                                    ];
                                                    const style = pastelStyles[i % pastelStyles.length];
                                                    return {
                                                        backgroundColor: style.bg,
                                                        borderColor: style.border,
                                                        boxShadow: `0 4px 6px -1px ${style.shadow}, 0 2px 4px -1px ${style.shadow}`,
                                                    };
                                                };
                                                const baseStyle = getPastelStyle();
                                                const isError = log.level === 'error';
                                                return (
                                                <div
                                                    key={log.id}
                                                    onClick={() => toggleLogSelection(log.id)}
                                                    className="flex items-center gap-6 p-6 rounded-[3rem] border-2 transition-all duration-300 cursor-pointer group"
                                                    style={baseStyle}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.transform = 'scale(1.02)';
                                                        if (isError) {
                                                            // Mantém o fundo vermelho pastel no hover
                                                            e.currentTarget.style.backgroundColor = '#fee2e2'; // red-100 (um pouco mais escuro no hover)
                                                            e.currentTarget.style.borderColor = '#fca5a5'; // red-300
                                                            e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(252, 165, 165, 0.4), 0 4px 6px -2px rgba(252, 165, 165, 0.3)';
                                                        } else {
                                                            e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(147, 197, 253, 0.3), 0 4px 6px -2px rgba(147, 197, 253, 0.2)';
                                                        }
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.transform = 'scale(1)';
                                                        // Restaura todos os estilos do baseStyle
                                                        e.currentTarget.style.backgroundColor = baseStyle.backgroundColor;
                                                        e.currentTarget.style.borderColor = baseStyle.borderColor;
                                                        e.currentTarget.style.boxShadow = baseStyle.boxShadow;
                                                    }}
                                                >
                                                    <div className={`h-12 w-12 rounded-2xl shrink-0 flex items-center justify-center shadow-sm ${log.level === 'error' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'}`}>
                                                        {log.level === 'error' ? <AlertCircle size={22} /> : <Activity size={22} />}
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-3 mb-1">
                                                            <Badge className={`border-none font-black text-[9px] px-2 py-0.5 rounded-lg ${log.level === 'error' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                                                {log.log_type.replace(/_/g, ' ')}
                                                            </Badge>
                                                            <span className="text-[10px] font-black text-slate-300 uppercase">{formatRelativeTime(log.created_at, t)}</span>
                                                        </div>
                                                        <p className={`text-sm font-bold leading-tight ${selectedLogs.has(log.id) ? 'text-blue-900' : 'text-slate-700'}`}>
                                                            {translateLogMessage(log.message, t)}
                                                        </p>
                                                    </div>

                                                    <div 
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="h-7 w-7 rounded-full border-2 flex items-center justify-center transition-all"
                                                        style={selectedLogs.has(log.id) ? {
                                                            backgroundColor: '#000000',
                                                            borderColor: '#000000',
                                                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
                                                        } : {
                                                            backgroundColor: '#f8fafc',
                                                            borderColor: '#e2e8f0',
                                                        }}
                                                    >
                                                        {selectedLogs.has(log.id) && <CheckCircle2 size={16} style={{ color: '#ffffff' }} />}
                                                    </div>
                                                </div>
                                                );
                                            })}
                                        </div>
                                    </ScrollArea>
                                </TabsContent>

                                <TabsContent value="fallbacks">
                                    {/* SELECIONAR TODOS - FALLBACKS */}
                                    <div className="flex items-center gap-3 mb-4 px-6 py-2">
                                        <div
                                            onClick={toggleSelectAllFallbacks}
                                            className={`h-6 w-6 rounded-lg flex items-center justify-center cursor-pointer transition-all border-2 ${selectedFallbacks.size === fallbacks.length && fallbacks.length > 0 ? 'bg-slate-900 border-slate-900' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}
                                        >
                                            {selectedFallbacks.size === fallbacks.length && fallbacks.length > 0 && <CheckCircle2 size={16} className="text-white" />}
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{t('activity.selectAllFallbacks')}</span>
                                    </div>

                                    <ScrollArea className="h-[500px] pr-4">
                                        <div className="space-y-6">
                                            {fallbacks.map((fb, i) => {
                                                const getPastelStyle = () => {
                                                    if (selectedFallbacks.has(fb.id)) {
                                                        return {
                                                            backgroundColor: '#fee2e2', // red-100 (quando selecionado)
                                                            borderColor: '#fca5a5', // red-300
                                                            boxShadow: '0 10px 15px -3px rgba(252, 165, 165, 0.3), 0 4px 6px -2px rgba(252, 165, 165, 0.2)',
                                                        };
                                                    }
                                                    // Cores pastéis amarelas variadas
                                                    const pastelStyles = [
                                                        { bg: '#fffbeb', border: '#fef3c7', shadow: 'rgba(254, 243, 199, 0.3)' }, // amber-50
                                                        { bg: '#fff7ed', border: '#ffedd5', shadow: 'rgba(255, 237, 213, 0.3)' }, // orange-50
                                                        { bg: '#fefce8', border: '#fef08a', shadow: 'rgba(254, 240, 138, 0.3)' }, // yellow-50
                                                    ];
                                                    const style = pastelStyles[i % pastelStyles.length];
                                                    return {
                                                        backgroundColor: style.bg,
                                                        borderColor: style.border,
                                                        boxShadow: `0 4px 6px -1px ${style.shadow}, 0 2px 4px -1px ${style.shadow}`,
                                                    };
                                                };
                                                const baseStyle = getPastelStyle();
                                                return (
                                                <div
                                                    key={fb.id}
                                                    onClick={() => toggleFallbackSelection(fb.id)}
                                                    className="flex items-start gap-5 p-5 rounded-[3rem] border-2 transition-all duration-300 cursor-pointer group"
                                                    style={baseStyle}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.transform = 'scale(1.02)';
                                                        if (selectedFallbacks.has(fb.id)) {
                                                            e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(252, 165, 165, 0.4), 0 4px 6px -2px rgba(252, 165, 165, 0.3)';
                                                        } else {
                                                            e.currentTarget.style.backgroundColor = '#fef3c7'; // amber-100 (um pouco mais escuro no hover)
                                                            e.currentTarget.style.borderColor = '#fde68a'; // amber-200
                                                            e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(253, 230, 138, 0.4), 0 4px 6px -2px rgba(253, 230, 138, 0.3)';
                                                        }
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.transform = 'scale(1)';
                                                        e.currentTarget.style.backgroundColor = baseStyle.backgroundColor;
                                                        e.currentTarget.style.borderColor = baseStyle.borderColor;
                                                        e.currentTarget.style.boxShadow = baseStyle.boxShadow;
                                                    }}
                                                >
                                                    {/* QUADRADINHO DE SELEÇÃO PINTADO */}
                                                    <div
                                                        onClick={(e) => e.stopPropagation()}
                                                        className={`mt-1 h-6 w-6 rounded-lg shrink-0 flex items-center justify-center cursor-pointer transition-all border-2 ${selectedFallbacks.has(fb.id) ? 'bg-red-600 border-red-600 shadow-lg shadow-red-500/20' : 'bg-white border-slate-200 group-hover:border-red-400'}`}
                                                    >
                                                        {selectedFallbacks.has(fb.id) && <CheckCircle2 size={16} className="text-white" />}
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <Badge className="bg-amber-500 border-none font-black text-[8px] px-2" style={{ color: '#000000' }}>
                                                                {fb.impact_level.toUpperCase()}
                                                            </Badge>
                                                            <span className="text-[10px] font-bold text-slate-400">{formatRelativeTime(fb.created_at, t)}</span>
                                                        </div>
                                                        <p className="text-sm font-bold text-slate-700 leading-tight mb-2 break-words">{translateFallbackMessage(fb.message, t)}</p>
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('activity.node')} <span className="text-slate-900">{fb.node_id || t('activity.notAvailable')}</span></p>
                                                    </div>
                                                </div>
                                                );
                                            })}
                                        </div>
                                    </ScrollArea>
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>

                    <div ref={workforceCardRef}>
                        <Card className="lg:col-span-4 border-none shadow-xl shadow-slate-200/40 dark:shadow-slate-900/40 bg-background rounded-[3.5rem] overflow-hidden flex flex-col h-full">
                            <CardHeader className="p-10 pb-6 px-16">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-black uppercase tracking-widest" style={{ fontFamily: 'Inter, system-ui, sans-serif', color: theme === 'dark' ? '#f1f5f9' : '#0f172a' }}>{t('workforce.title')}</h2>
                                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                                </div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] mt-1" style={{ fontFamily: 'Inter, system-ui, sans-serif', color: theme === 'dark' ? '#64748b' : '#94a3b8' }}>{t('workforce.subtitle')}</p>
                            </CardHeader>

                        <CardContent className="p-6 pt-0 flex-1">
                            <ScrollArea className="h-[550px] pr-4">
                                <div className="space-y-4">
                                    {agents.map((agent) => (
                                        <div
                                            key={agent.id}
                                            onClick={() => navigate('agents')}
                                            className="relative flex items-center justify-between p-5 rounded-2xl border-2 transition-all duration-300 cursor-pointer group mb-3 overflow-hidden"
                                            style={{
                                                backgroundColor: '#eff6ff', // blue-50
                                                borderColor: '#93c5fd', // blue-300
                                                boxShadow: '0 4px 6px -1px rgba(147, 197, 253, 0.2), 0 2px 4px -1px rgba(147, 197, 253, 0.1)',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.backgroundColor = '#dbeafe'; // blue-100
                                                e.currentTarget.style.borderColor = '#60a5fa'; // blue-400
                                                e.currentTarget.style.transform = 'scale(1.02)';
                                                e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(96, 165, 250, 0.3), 0 4px 6px -2px rgba(96, 165, 250, 0.2)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = '#eff6ff'; // blue-50
                                                e.currentTarget.style.borderColor = '#93c5fd'; // blue-300
                                                e.currentTarget.style.transform = 'scale(1)';
                                                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(147, 197, 253, 0.2), 0 2px 4px -1px rgba(147, 197, 253, 0.1)';
                                            }}
                                        >
                                            {/* Barra vertical na lateral esquerda */}
                                            <div 
                                                className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl" 
                                                style={{
                                                    backgroundColor: agent.status_id === 1 
                                                        ? '#10b981' // emerald-500 - Ativo
                                                        : agent.status_id === 3 || agent.status_id === 4
                                                        ? '#eab308' // yellow-500 - Pausado
                                                        : '#ef4444' // red-500 - Cancelado/Inativo
                                                }}
                                            />
                                            
                                            <div className="flex items-center flex-1" style={{ gap: '24px', paddingLeft: '16px' }}>
                                                <div className="relative">
                                                    {/* Avatar com gradiente ciano estilo Profile */}
                                                    <Avatar className="h-14 w-14 border-2 border-white shadow-lg">
                                                        <AvatarFallback
                                                            className="text-white font-black text-lg"
                                                            style={{
                                                                background: 'linear-gradient(135deg, #0e7490 0%, #0891b2 30%, #06b6d4 60%, #22d3ee 100%)',
                                                                border: '2px solid rgba(255, 255, 255, 0.3)',
                                                                boxShadow: '0 0 20px rgba(6, 182, 212, 0.3), inset 0 0 10px rgba(255, 255, 255, 0.2)',
                                                            }}
                                                        >
                                                            {agent.nome.substring(0, 2).toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div 
                                                        className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-white shadow-sm"
                                                        style={{
                                                            backgroundColor: agent.status_id === 1 
                                                                ? '#10b981' // emerald-500 - Ativo
                                                                : agent.status_id === 3 || agent.status_id === 4
                                                                ? '#eab308' // yellow-500 - Pausado
                                                                : '#ef4444' // red-500 - Cancelado/Inativo
                                                        }}
                                                    />
                                                </div>
                                                <div className="min-w-0 flex-1" style={{ marginLeft: '8px' }}>
                                                    <p className="font-black text-slate-800 text-base leading-none mb-2">{agent.nome}</p>
                                                    {agent.status_id === 1 ? (
                                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 w-fit rounded-lg">
                                                            <div className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                                                            <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">{t('workforce.status.connected')}</span>
                                                        </div>
                                                    ) : agent.status_id === 3 || agent.status_id === 4 ? (
                                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-yellow-50 w-fit rounded-lg">
                                                            <div className="h-1 w-1 rounded-full bg-yellow-500 animate-pulse" />
                                                            <span className="text-[9px] font-black text-yellow-600 uppercase tracking-widest">{t('workforce.status.paused')}</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-red-50 w-fit rounded-lg">
                                                            <div className="h-1 w-1 rounded-full bg-red-500 animate-pulse" />
                                                            <span className="text-[9px] font-black text-red-600 uppercase tracking-widest">{t('workforce.status.inactive')}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="h-10 w-10 rounded-2xl bg-slate-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                                                <ArrowRight size={16} className="text-cyan-500" />
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

            {/* TRUQUE: Deixe isso aqui no final do seu arquivo, fora do return principal.
                Isso força o Tailwind a carregar as cores que estavam sumindo. */}
            <div className="hidden bg-blue-500 bg-indigo-500 bg-emerald-500 bg-red-500 bg-amber-500 bg-pink-500" />
        </div>
        
        </>
    )
}
