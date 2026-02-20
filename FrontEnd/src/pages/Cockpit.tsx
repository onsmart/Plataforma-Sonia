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
    Bot
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

// Função para formatar timestamp relativo
function formatRelativeTime(isoString: string): string {
    if (!isoString) return "Agora"
    const date = new Date(isoString)
    const now = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diff < 60) return `${diff}s atrás`
    if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// Função para formatar timestamp completo
function formatTime(isoString: string): string {
    if (!isoString) return ""
    const date = new Date(isoString)
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function Cockpit() {
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
                    <p className="text-sm font-medium">Erro ao carregar dados</p>
                    <p className="text-xs text-muted-foreground mt-1">{error}</p>
                    <Button onClick={loadData} className="mt-4" size="sm">
                        Tentar Novamente
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
                label: 'Sem Status',
                icon: AlertCircle
            };
        }

        switch (statusId) {
            case 1: // Verde - Conectado/Funcionando
                return {
                    color: 'text-emerald-500',
                    bgColor: 'bg-emerald-500',
                    label: 'Conectado',
                    icon: CheckCircle2
                };
            case 2: // Vermelho - Cancelado
                return {
                    color: 'text-red-500',
                    bgColor: 'bg-red-500',
                    label: 'Cancelado',
                    icon: AlertCircle
                };
            case 3: // Amarelo - Pausado
                return {
                    color: 'text-yellow-500',
                    bgColor: 'bg-yellow-500',
                    label: 'Pausado',
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
    let systemStatusLabel = 'Sistema Saudável'
    let systemStatusColor = 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
    let systemStatusDotColor = 'bg-emerald-500'
    let systemStatusPingColor = 'bg-emerald-400'

    // PRIORIDADE 1: Status 2 (vermelho) = Sistema Travado
    if (hasRedStatus) {
        systemStatus = 'blocked'
        systemStatusLabel = 'Sistema Travado'
        systemStatusColor = 'bg-red-500/10 text-red-600 border-red-500/20'
        systemStatusDotColor = 'bg-red-500'
        systemStatusPingColor = 'bg-red-400'
    }
    // PRIORIDADE 2: Status 3 (amarelo) ou agentes pausados = Sistema Estável
    else if (hasYellowStatus || hasPausedAgents) {
        systemStatus = 'stable'
        systemStatusLabel = 'Sistema Estável'
        systemStatusColor = 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
        systemStatusDotColor = 'bg-yellow-500'
        systemStatusPingColor = 'bg-yellow-400'
    }
    // PRIORIDADE 3: Tudo ok = Sistema Saudável (já definido como padrão)

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
            toast.error('Erro de autenticação')
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
                toast.error('Erro ao deletar evento')
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

            toast.success('Excluído com sucesso')
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
            toast.error('Selecione pelo menos um evento para deletar')
            return
        }

        if (!user?.email) {
            toast.error('Erro de autenticação')
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
                toast.error('Erro ao deletar eventos')
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

            toast.success(`${idsToDelete.length} evento(s) excluído(s) com sucesso`)
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
            toast.error('Erro de autenticação')
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
                toast.error('Erro ao deletar log')
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

            toast.success('Log excluído com sucesso')
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
            toast.error('Selecione pelo menos um log para deletar')
            return
        }

        if (!user?.email) {
            toast.error('Erro de autenticação')
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
                toast.error('Erro ao deletar logs')
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

            toast.success(`${idsToDelete.length} log(s) excluído(s) com sucesso`)
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
        { bg: "#3b82f6", icon: "text-white" }, // Blue
        { bg: "#6366f1", icon: "text-white" }, // Indigo
        { bg: "#10b981", icon: "text-white" }, // Emerald
        { bg: "#ef4444", icon: "text-white" }, // Red
        { bg: "#f59e0b", icon: "text-white" }, // Amber
        { bg: "#ec4899", icon: "text-white" }, // Pink
    ];

    return (
        // Fundo cinza azulado suave para dar contraste com os cards brancos
        <div className="space-y-8 animate-in fade-in duration-500 bg-[#F4F7FA] -m-4 p-10 min-h-screen">
            <div className="max-w-[1600px] mx-auto space-y-10">

                {/* HEADER */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-4">
                    <div>
                        <h2 className="text-4xl font-black tracking-tighter text-slate-900">Cockpit</h2>
                        <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em]">Live Status</p>
                    </div>
                    <div className="flex items-center gap-4 bg-white p-3 rounded-[2rem] shadow-xl shadow-slate-200/50">
                        <Badge variant="outline" className={`gap-2 px-4 py-2 rounded-2xl border-none font-black text-xs ${systemStatusColor}`}>
                            <span className="relative flex h-3 w-3">
                                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${systemStatusPingColor}`}></span>
                                <span className={`relative inline-flex rounded-full h-3 w-3 ${systemStatusDotColor}`}></span>
                            </span>
                            {systemStatusLabel}
                        </Badge>
                        <Button variant="ghost" size="icon" onClick={loadData} className="h-10 w-10 rounded-2xl hover:bg-slate-100">
                            <RefreshCw className={`h-5 w-5 text-slate-400 ${isRefreshing ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </div>

                {/* METRIC CARDS - USANDO STYLE PARA GARANTIR A COR */}
                <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                    {[
                        { title: "Interações", value: stats.totalInteractions, icon: MessageSquare },
                        { title: "Leads Ativos", value: stats.activeLeads || 0, icon: Users },
                        { title: "Msgs / Min", value: stats.avgResponseTime > 0 ? stats.avgResponseTime.toFixed(1) : '0.0', icon: Activity },
                        { title: "Travadas", value: unassignedConversations, icon: AlertCircle, isAlert: unassignedConversations > 0, route: 'inbox' },
                        { title: "Fallbacks", value: fallbacksCount, icon: AlertTriangle, isAlert: fallbacksCount > 0 },
                        { title: "Aguardando", value: pendingDecisionsCount, icon: Clock, isAlert: pendingDecisionsCount > 0, route: 'inbox?tab=decisions' },
                    ].map((stat, i) => (
                        <Card
                            key={i}
                            className={`border-none rounded-[2.5rem] bg-white shadow-2xl shadow-slate-200/60 relative overflow-hidden transition-all hover:scale-105 h-56 flex flex-col justify-center ${stat.route ? 'cursor-pointer' : ''}`}
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

                                {/* BADGE DE ATENÇÃO - Reposicionado e com animação discreta */}
                                {stat.isAlert && Number(stat.value) > 0 && (
                                    <div className="absolute top-6 right-6">
                                        <Badge className="bg-red-500 text-white border-none font-black text-[8px] px-2 py-0.5 animate-pulse shadow-lg shadow-red-200">
                                            ATENÇÃO
                                        </Badge>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* ABAIXO MANTÉM O RESTANTE DA ESTRUTURA (FEED E AGENTES) */}
                <div className="grid gap-10 lg:grid-cols-12">
                    <Card className="lg:col-span-8 border-none shadow-xl shadow-slate-200/40 bg-white rounded-[3.5rem] overflow-hidden">
                        <CardHeader className="p-10 pb-6 px-16 flex flex-row items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Atividade do Sistema</h2>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Logs em tempo real</p>
                            </div>
                            <Button variant="outline" size="sm" className="rounded-2xl font-black text-[10px] uppercase tracking-widest h-10 px-6" onClick={loadData}>Atualizar</Button>
                        </CardHeader>
                        <CardContent className="px-10 pb-10">
                            <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
                                {/* BARRA DE ABAS - CONTROLE MANUAL TOTAL */}
                                <TabsList className="bg-slate-200/50 p-1.5 rounded-full flex w-fit border-none shadow-none mb-8 outline-none ring-0">
                                    <TabsTrigger
                                        value="activity"
                                        className={`rounded-full font-black text-[10px] uppercase tracking-widest px-8 h-10 transition-all border-none outline-none ring-0 focus:ring-0 focus:outline-none focus-visible:ring-0 shadow-none
                                            ${currentTab === "activity"
                                                ? "!bg-slate-900 !text-white shadow-lg"
                                                : "text-slate-500 hover:text-slate-800 bg-transparent"
                                            }`}
                                    >
                                        Histórico
                                    </TabsTrigger>

                                    <TabsTrigger
                                        value="logs"
                                        className={`rounded-full font-black text-[10px] uppercase tracking-widest px-8 h-10 transition-all border-none outline-none ring-0 focus:ring-0 focus:outline-none focus-visible:ring-0 shadow-none
                                            ${currentTab === "logs"
                                                ? "!bg-slate-900 !text-white shadow-lg"
                                                : "text-slate-500 hover:text-slate-800 bg-transparent"
                                            }`}
                                    >
                                        Logs ({systemLogs.length})
                                    </TabsTrigger>

                                    <TabsTrigger
                                        value="fallbacks"
                                        className={`rounded-full font-black text-[10px] uppercase tracking-widest px-8 h-10 transition-all border-none outline-none ring-0 focus:ring-0 focus:outline-none focus-visible:ring-0 shadow-none
                                            ${currentTab === "fallbacks"
                                                ? "!bg-red-800 !text-white shadow-lg shadow-red-900/20"
                                                : "text-slate-500 hover:text-slate-800 bg-transparent"
                                            }`}
                                    >
                                        Fallbacks ({fallbacks.length})
                                    </TabsTrigger>
                                </TabsList>

                                {/* BARRA DE AÇÕES - ESTILO BANNER DE TOPO (NÃO BUGA MAIS) */}
                                {/* BARRA DE AÇÕES EM MASSA - AGORA EM AZUL VIBRANTE */}
                                {(selectedLogs.size > 0 || selectedFallbacks.size > 0) && (
                                    <div className="flex items-center justify-between gap-6 bg-blue-600 text-white p-6 px-10 rounded-[2.5rem] mb-8 animate-in slide-in-from-top-4 duration-500 shadow-xl shadow-blue-500/20 border-2 border-white/10">
                                        <div className="flex items-center gap-5">
                                            <div className="h-10 w-10 rounded-2xl bg-white text-blue-600 flex items-center justify-center shadow-lg font-black text-sm">
                                                {selectedLogs.size || selectedFallbacks.size}
                                            </div>
                                            <div>
                                                <p className="font-black text-xs uppercase tracking-[0.2em] leading-none text-white">Itens selecionados</p>
                                                <p className="text-[10px] font-bold text-blue-100 uppercase mt-1">Pronto para realizar a limpeza do banco</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Button
                                                variant="ghost"
                                                className="text-white hover:bg-white/10 rounded-2xl font-black text-[10px] uppercase tracking-widest px-6 h-11"
                                                onClick={() => { setSelectedLogs(new Set()); setSelectedFallbacks(new Set()); }}
                                            >
                                                Cancelar
                                            </Button>
                                            <Button
                                                className="bg-white text-red-600 hover:bg-red-50 rounded-2xl font-black text-[10px] uppercase tracking-widest px-8 h-11 shadow-xl transition-all active:scale-95"
                                                onClick={selectedLogs.size > 0 ? handleDeleteMultipleLogs : handleDeleteMultipleFallbacks}
                                            >
                                                Excluir Agora
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                <TabsContent value="activity">
                                    <ScrollArea className="h-[500px] pr-4">
                                        <div className="space-y-4">
                                            {activityOverview.map((item, i) => {
                                                const isError = Number(item.status) >= 2;
                                                return (
                                                    <div key={i} className={`flex items-start gap-6 p-6 rounded-[2rem] border-2 transition-all ${isError ? 'bg-red-50 border-red-100 shadow-md shadow-red-200/10' : 'bg-slate-50/50 border-transparent hover:border-blue-100 hover:bg-white hover:shadow-lg hover:shadow-blue-500/5 group'}`}>
                                                        <div className={`h-12 w-12 rounded-2xl shrink-0 flex items-center justify-center text-white shadow-md ${isError ? 'bg-red-500' : 'bg-blue-500'} mt-1`}>
                                                            {isError ? <AlertCircle size={20} /> : <Bot size={20} />}
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex justify-between items-center mb-1">
                                                                <h4 className={`font-black text-sm uppercase tracking-tight ${isError ? 'text-red-700' : 'text-slate-800'}`}>{item.tipo}</h4>
                                                                <span className="text-[10px] font-bold text-slate-400">{formatRelativeTime(item.data_evento)}</span>
                                                            </div>
                                                            <p className="text-[10px] font-bold text-slate-500">ORIGEM: <span className="text-slate-900 uppercase">{item.user_name || 'IA Autônoma'}</span></p>
                                                            {isError && (
                                                                <Badge className="mt-2 bg-red-600 text-white border-none font-black text-[9px] px-2 py-0.5">AÇÃO REQUERIDA</Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                            })}
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
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-slate-600 transition-colors">Selecionar Tudo</span>
                                        </div>
                                        <Badge variant="outline" className="rounded-full border-slate-200 text-slate-400 font-black text-[9px] px-3">{systemLogs.length} LOGS</Badge>
                                    </div>

                                    <ScrollArea className="h-[500px] pr-4">
                                        <div className="space-y-3 px-2 pb-4">
                                            {systemLogs.map((log) => (
                                                <div
                                                    key={log.id}
                                                    onClick={() => toggleLogSelection(log.id)}
                                                    className={`flex items-center gap-6 p-6 rounded-[2.5rem] border-2 transition-all cursor-pointer group mb-3 
                                                        ${selectedLogs.has(log.id)
                                                            ? 'bg-blue-50/80 border-blue-400 shadow-inner'
                                                            : 'bg-white border-slate-50 hover:border-blue-200 hover:shadow-md shadow-sm'
                                                        }`}
                                                >
                                                    <div className={`h-12 w-12 rounded-2xl shrink-0 flex items-center justify-center shadow-sm ${log.level === 'error' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'}`}>
                                                        {log.level === 'error' ? <AlertCircle size={22} /> : <Activity size={22} />}
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-3 mb-1">
                                                            <Badge className={`border-none font-black text-[9px] px-2 py-0.5 rounded-lg ${log.level === 'error' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                                                {log.log_type.replace(/_/g, ' ')}
                                                            </Badge>
                                                            <span className="text-[10px] font-black text-slate-300 uppercase">{formatRelativeTime(log.created_at)}</span>
                                                        </div>
                                                        <p className={`text-sm font-bold leading-tight ${selectedLogs.has(log.id) ? 'text-blue-900' : 'text-slate-700'}`}>
                                                            {log.message}
                                                        </p>
                                                    </div>

                                                    <div className={`h-7 w-7 rounded-full border-2 flex items-center justify-center transition-all ${selectedLogs.has(log.id) ? 'bg-blue-600 border-blue-600 shadow-lg' : 'bg-slate-50 border-slate-200 group-hover:border-blue-300'}`}>
                                                        {selectedLogs.has(log.id) && <CheckCircle2 size={16} className="text-white" />}
                                                    </div>
                                                </div>
                                            ))}
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
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Selecionar Todos os Fallbacks</span>
                                    </div>

                                    <ScrollArea className="h-[500px] pr-4">
                                        <div className="space-y-3">
                                            {fallbacks.map((fb) => (
                                                <div
                                                    key={fb.id}
                                                    className={`flex items-start gap-5 p-5 rounded-[2rem] border-2 transition-all group ${selectedFallbacks.has(fb.id) ? 'bg-red-50 border-red-200' : 'bg-amber-50/30 border-transparent hover:border-red-100 hover:bg-white'}`}
                                                >
                                                    {/* QUADRADINHO DE SELEÇÃO PINTADO */}
                                                    <div
                                                        onClick={() => toggleFallbackSelection(fb.id)}
                                                        className={`mt-1 h-6 w-6 rounded-lg shrink-0 flex items-center justify-center cursor-pointer transition-all border-2 ${selectedFallbacks.has(fb.id) ? 'bg-red-600 border-red-600 shadow-lg shadow-red-500/20' : 'bg-white border-slate-200 group-hover:border-red-400'}`}
                                                    >
                                                        {selectedFallbacks.has(fb.id) && <CheckCircle2 size={16} className="text-white" />}
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <Badge className="bg-amber-500 text-white border-none font-black text-[8px] px-2">
                                                                {fb.impact_level.toUpperCase()}
                                                            </Badge>
                                                            <span className="text-[10px] font-bold text-slate-400">{formatRelativeTime(fb.created_at)}</span>
                                                        </div>
                                                        <p className="text-sm font-bold text-slate-700 leading-tight mb-2 break-words">{fb.message}</p>
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Node: <span className="text-slate-900">{fb.node_id || 'N/A'}</span></p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>

                    <Card className="lg:col-span-4 border-none shadow-xl shadow-slate-200/40 bg-white rounded-[3.5rem] overflow-hidden flex flex-col h-full">
                        <CardHeader className="p-10 pb-6 px-16">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-black text-slate-900 uppercase tracking-widest">IA Workforce</h2>
                                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                            </div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Status dos Agentes</p>
                        </CardHeader>

                        <CardContent className="p-6 pt-0 flex-1">
                            <ScrollArea className="h-[550px] pr-4">
                                <div className="space-y-4">
                                    {agents.map((agent) => (
                                        <div
                                            key={agent.id}
                                            onClick={() => navigate('agents')}
                                            className="flex items-center justify-between p-5 rounded-[2.5rem] bg-white border-2 border-slate-50 hover:border-blue-200 hover:shadow-lg transition-all cursor-pointer group mb-3"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="relative">
                                                    {/* AZUL CLARINHO ESTILO UMBLER NO AVATAR */}
                                                    <Avatar className="h-14 w-14 border-4 border-white shadow-lg">
                                                        <AvatarFallback
                                                            className="text-white font-black text-lg shadow-inner"
                                                            style={{ backgroundColor: '#60a5fa' }} // Azul clarinho (Sky Blue)
                                                        >
                                                            {agent.nome.substring(0, 2).toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-emerald-500 border-4 border-white shadow-sm" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-black text-slate-800 text-base leading-none mb-1.5">{agent.nome}</p>
                                                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 w-fit rounded-lg">
                                                        <div className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                                                        <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Ativo</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="h-10 w-10 rounded-2xl bg-slate-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                                                <ArrowRight size={16} className="text-blue-500" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* TRUQUE: Deixe isso aqui no final do seu arquivo, fora do return principal.
                Isso força o Tailwind a carregar as cores que estavam sumindo. */}
            <div className="hidden bg-blue-500 bg-indigo-500 bg-emerald-500 bg-red-500 bg-amber-500 bg-pink-500" />
        </div>
    )
}
