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
    Square
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

    // Função para carregar dados
    const loadData = useCallback(async () => {
        try {
            setIsRefreshing(true)
            setError(null)

            // Buscar stats e activityFeed da API
            const stats = await AgentService.getDashboardStats()

            // Buscar agentes DIRETAMENTE do Supabase (igual AgentsHub)
            let agentsList: Array<{ id: string; nome: string; status_id: number | null }> = []

            // Buscar activity overview usando sp_activity_overview
            let overviewData: Array<{ tipo: string; data_evento: string; status: number }> = []

            if (user?.email) {
                // Buscar agentes
                const { data: agentsData, error: agentsError } = await supabase.rpc('sp_list_agents_by_email', {
                    p_email: user.email
                })

                if (agentsError) {
                    console.error("[Cockpit] Erro ao buscar agentes:", agentsError)
                } else if (agentsData) {
                    const rows = Array.isArray(agentsData) ? agentsData : (agentsData ? [agentsData] : [])
                    agentsList = rows.map((agent: any) => {
                        let statusId: number | null = null
                        if (agent.status_id !== null && agent.status_id !== undefined) {
                            statusId = typeof agent.status_id === 'string' ? parseInt(agent.status_id, 10) : Number(agent.status_id)
                            if (isNaN(statusId)) {
                                statusId = null
                            }
                        }
                        return {
                            id: String(agent.id),
                            nome: agent.nome || 'Sem nome',
                            status_id: statusId
                        }
                    })
                }

                // Buscar activity overview
                const { data: overviewResult, error: overviewError } = await supabase.rpc('sp_activity_overview', {
                    p_email: user.email
                })

                if (overviewError) {
                    console.error("[Cockpit] Erro ao buscar activity overview:", overviewError)
                } else if (overviewResult) {
                    const rows = Array.isArray(overviewResult) ? overviewResult : (overviewResult ? [overviewResult] : [])
                    overviewData = rows.map((item: any) => {
                        let statusNum = 1
                        if (item.status !== null && item.status !== undefined) {
                            statusNum = typeof item.status === 'string' ? parseInt(item.status, 10) : Number(item.status)
                            if (isNaN(statusNum)) {
                                statusNum = 1
                            }
                        }

                        // Debug para "Data expirada"
                        if (item.tipo && item.tipo.includes('Data expirada')) {
                            console.log('[Cockpit] Processando Data expirada:', {
                                tipo: item.tipo,
                                statusOriginal: item.status,
                                statusType: typeof item.status,
                                statusConvertido: statusNum
                            })
                        }

                        return {
                            tipo: item.tipo || '',
                            data_evento: item.data_evento || new Date().toISOString(),
                            status: statusNum,
                            user_name: item.user_name || null,
                            user_email: item.user_email || null
                        }
                    })
                }
            }

            setActivityOverview(overviewData)

            // Buscar métricas do cockpit e usar se disponíveis
            let metricsData: { total_interacoes: number; leads_ativos: number; mensagens_por_minuto: number } | null = null
            if (user?.email) {
                const { data: metricsResult, error: metricsError } = await supabase.rpc('sp_cockpit_metrics_by_email', {
                    p_email: user.email
                })

                if (!metricsError && metricsResult) {
                    const metrics = Array.isArray(metricsResult) ? metricsResult[0] : metricsResult
                    if (metrics) {
                        metricsData = {
                            total_interacoes: Number(metrics.total_interacoes) || 0,
                            leads_ativos: Number(metrics.leads_ativos) || 0,
                            mensagens_por_minuto: Number(metrics.mensagens_por_minuto) || 0
                        }
                        setCockpitMetrics(metricsData)
                    }
                }

                // Buscar contagem de conversas sem agente atribuído
                const { data: unassignedCount, error: unassignedError } = await supabase.rpc('sp_count_unassigned_whatsapp_conversations', {
                    p_email: user.email
                })

                if (!unassignedError && unassignedCount !== null) {
                    setUnassignedConversations(Number(unassignedCount) || 0)
                } else {
                    console.error("[Cockpit] Erro ao buscar conversas não atribuídas:", unassignedError)
                    setUnassignedConversations(0)
                }

                // Buscar fallbacks
                const { data: fallbacksData, error: fallbacksError } = await supabase.rpc('sp_get_fallbacks_by_email', {
                    p_email: user.email
                })

                console.log("[Cockpit] Resultado da busca de fallbacks:", {
                    hasData: !!fallbacksData,
                    isArray: Array.isArray(fallbacksData),
                    length: Array.isArray(fallbacksData) ? fallbacksData.length : fallbacksData ? 1 : 0,
                    error: fallbacksError,
                    sample: Array.isArray(fallbacksData) ? fallbacksData[0] : fallbacksData
                })

                if (!fallbacksError && fallbacksData) {
                    const fallbacksList = Array.isArray(fallbacksData) ? fallbacksData : (fallbacksData ? [fallbacksData] : [])
                    console.log("[Cockpit] Fallbacks processados:", fallbacksList.length, "eventos")
                    setFallbacks(fallbacksList)
                } else {
                    console.error("[Cockpit] Erro ao buscar fallbacks:", fallbacksError)
                    setFallbacks([])
                }

                // Buscar contagem total de fallbacks
                const { data: fallbacksCountData, error: fallbacksCountError } = await supabase.rpc('sp_count_fallbacks_by_email', {
                    p_email: user.email
                })

                console.log("[Cockpit] Contagem de fallbacks:", {
                    count: fallbacksCountData,
                    error: fallbacksCountError
                })

                if (!fallbacksCountError && fallbacksCountData !== null) {
                    setFallbacksCount(Number(fallbacksCountData) || 0)
                } else {
                    console.error("[Cockpit] Erro ao buscar contagem de fallbacks:", fallbacksCountError)
                    setFallbacksCount(0)
                }

                // Buscar contagem de decisões pendentes de aprovação
                const { data: pendingDecisionsCountData, error: pendingDecisionsCountError } = await supabase.rpc('sp_count_pending_decisions_by_email', {
                    p_email: user.email
                })

                if (!pendingDecisionsCountError && pendingDecisionsCountData !== null) {
                    setPendingDecisionsCount(Number(pendingDecisionsCountData) || 0)
                } else {
                    console.error("[Cockpit] Erro ao buscar contagem de decisões pendentes:", pendingDecisionsCountError)
                    setPendingDecisionsCount(0)
                }

                // Buscar logs do sistema
                setSystemLogsLoading(true)
                const { data: logsData, error: logsError } = await supabase.rpc('sp_get_system_logs_by_email', {
                    p_email: user.email,
                    p_limit: 100
                })

                if (logsError) {
                    console.error("[Cockpit] Erro ao buscar logs do sistema:", logsError)
                    setSystemLogs([])
                } else {
                    setSystemLogs(Array.isArray(logsData) ? logsData : [])
                }

                // Buscar contagem de logs
                const { data: logsCountData, error: logsCountError } = await supabase.rpc('sp_count_system_logs_by_email', {
                    p_email: user.email
                })

                if (!logsCountError && logsCountData !== null) {
                    setSystemLogsCount(Number(logsCountData) || 0)
                } else {
                    setSystemLogsCount(0)
                }

                setSystemLogsLoading(false)
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
            // Em caso de erro, definir dados padrão para não deixar tela branca
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
            setIsRefreshing(false)
            setLoading(false)
        }
    }, [user])

    // Carregar dados ao montar o componente, quando voltar para a página ou quando a rota mudar
    useEffect(() => {
        // Se estiver na rota do Cockpit, sempre recarregar os dados
        if (currentRoute === 'cockpit') {
            // Resetar dados para evitar mostrar dados antigos/mockados
            setData(null)
            setLoading(true)
            setActivityOverview([])
            setCockpitMetrics(null)

            // Recarregar dados
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
    }, [user, currentRoute, loadData])

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

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Operations Cockpit</h2>
                    <p className="text-muted-foreground">
                        Visão em tempo real do desempenho da sua força de trabalho autônoma.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Badge
                        variant="outline"
                        className={`gap-1.5 px-3 py-1 ${systemStatusColor}`}
                    >
                        <span className="relative flex h-2 w-2">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${systemStatusPingColor}`}></span>
                            <span className={`relative inline-flex rounded-full h-2 w-2 ${systemStatusDotColor}`}></span>
                        </span>
                        {systemStatusLabel}
                    </Badge>
                    <span className="text-sm text-muted-foreground">Agentes Ativos: {stats.activeAgents}</span>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={loadData}
                        disabled={isRefreshing}
                        className="h-8 w-8 p-0"
                    >
                        <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </Button>
                    <span className="text-xs text-muted-foreground">
                        Atualizado: {formatRelativeTime(lastRefresh.toISOString())}
                    </span>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total de Interações</CardTitle>
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalInteractions.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">
                            <span className="text-emerald-500 font-medium flex items-center inline-flex">
                                <TrendingUp className="h-3 w-3 mr-0.5" /> Ao vivo
                            </span>{" "}
                            últimas 24 horas
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Leads Ativos</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.activeLeads}</div>
                        <p className="text-xs text-muted-foreground">
                            <span className="text-emerald-500 font-medium flex items-center inline-flex">
                                <TrendingUp className="h-3 w-3 ml-0.5" />
                            </span>{" "}
                            sendo acompanhados
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Mensagens por Minuto</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {stats.avgResponseTime > 0
                                ? stats.avgResponseTime.toFixed(1)
                                : '0.0'}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Média calculada automaticamente
                        </p>
                    </CardContent>
                </Card>
                <Card className={unassignedConversations > 0 ? "border-red-500/50 bg-red-50/30 dark:bg-red-950/10" : ""}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            Mensagens Travadas
                            {unassignedConversations > 0 && (
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                </span>
                            )}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            {unassignedConversations > 0 && (
                                <AlertCircle className="h-4 w-4 text-red-500 animate-pulse" />
                            )}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant={unassignedConversations > 0 ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => navigate('inbox')}
                                        className={`h-8 w-8 p-0 ${unassignedConversations > 0 ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse shadow-lg' : ''}`}
                                    >
                                        <Wrench className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Concertar</p>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${unassignedConversations > 0 ? 'text-red-600 dark:text-red-400 animate-pulse' : ''}`}>
                            {unassignedConversations}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            <span className={`font-medium flex items-center inline-flex ${unassignedConversations > 0 ? 'text-red-500' : ''}`}>
                                <AlertCircle className={`h-3 w-3 ml-0.5 ${unassignedConversations > 0 ? 'animate-pulse' : ''}`} />
                            </span>{" "}
                            sem agente atribuído
                        </p>
                    </CardContent>
                </Card>

                <Card className={fallbacksCount > 0 ? "border-yellow-500/50 bg-yellow-50/30 dark:bg-yellow-950/10" : ""}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            Fallbacks
                            {fallbacksCount > 0 && (
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
                                </span>
                            )}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            {fallbacksCount > 0 && (
                                <AlertTriangle className="h-4 w-4 text-yellow-500 animate-pulse" />
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${fallbacksCount > 0 ? 'text-yellow-600 dark:text-yellow-400' : ''}`}>
                            {fallbacksCount}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            <span className={`font-medium flex items-center inline-flex ${fallbacksCount > 0 ? 'text-yellow-500' : ''}`}>
                                <AlertTriangle className={`h-3 w-3 ml-0.5 ${fallbacksCount > 0 ? 'animate-pulse' : ''}`} />
                            </span>{" "}
                            eventos de fallback detectados
                        </p>
                    </CardContent>
                </Card>

                <Card className={pendingDecisionsCount > 0 ? "border-red-500/50 bg-red-50/30 dark:bg-red-950/10" : ""}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            Aguardando Aprovação
                            {pendingDecisionsCount > 0 && (
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                </span>
                            )}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            {pendingDecisionsCount > 0 && (
                                <AlertCircle className="h-4 w-4 text-red-500 animate-pulse" />
                            )}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant={pendingDecisionsCount > 0 ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => navigate('inbox?tab=decisions')}
                                        className={`h-8 w-8 p-0 ${pendingDecisionsCount > 0 ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse shadow-lg' : ''}`}
                                    >
                                        <CheckCircle2 className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Ver aprovações</p>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${pendingDecisionsCount > 0 ? 'text-red-600 dark:text-red-400 animate-pulse' : ''}`}>
                            {pendingDecisionsCount}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            <span className={`font-medium flex items-center inline-flex ${pendingDecisionsCount > 0 ? 'text-red-500' : ''}`}>
                                <AlertCircle className={`h-3 w-3 ml-0.5 ${pendingDecisionsCount > 0 ? 'animate-pulse' : ''}`} />
                            </span>{" "}
                            mensagens aguardando aprovação
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Feed de Atividades em Tempo Real</CardTitle>
                                <CardDescription>Logs de ações e decisões dos agentes.</CardDescription>
                            </div>
                            {recentErrors > 0 && (
                                <Badge variant="destructive" className="gap-1.5">
                                    <AlertTriangle className="h-3 w-3" />
                                    {recentErrors} erro{recentErrors > 1 ? 's' : ''} nas últimas 24h
                                </Badge>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue="historico" className="w-full">
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="historico">Histórico</TabsTrigger>
                                <TabsTrigger value="fallback">Fallback</TabsTrigger>
                                <TabsTrigger value="logs" className="relative">
                                    Logs
                                    {systemLogsCount > 0 && (
                                        <>
                                            <span className="ml-2 text-xs font-medium">({systemLogsCount})</span>
                                            <span className="ml-2 relative flex h-2 w-2">
                                                {(() => {
                                                    // Determina a cor baseado no maior nível de impacto
                                                    const hasCritical = systemLogs.some(log => log.impact_level === 'critical')
                                                    const hasHigh = systemLogs.some(log => log.impact_level === 'high')
                                                    const hasMedium = systemLogs.some(log => log.impact_level === 'medium')

                                                    if (hasCritical || hasHigh) {
                                                        // Vermelho para critical/high
                                                        return (
                                                            <>
                                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                                            </>
                                                        )
                                                    } else if (hasMedium) {
                                                        // Amarelo para medium
                                                        return (
                                                            <>
                                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
                                                            </>
                                                        )
                                                    } else {
                                                        // Verde para low ou nenhum
                                                        return (
                                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                                        )
                                                    }
                                                })()}
                                            </span>
                                        </>
                                    )}
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="historico" className="mt-4">
                                <ScrollArea className="h-[500px] pr-4">
                                    <div className="space-y-4">
                                        {activityOverview.length === 0 ? (
                                            <div className="text-center text-muted-foreground py-10">
                                                Nenhuma atividade registrada ainda. Comece a interagir com os agentes para ver os logs.
                                            </div>
                                        ) : (
                                            activityOverview.slice(0, 5).map((item, i) => {
                                                // Garantir que status seja número
                                                const status = typeof item.status === 'string' ? parseInt(item.status, 10) : Number(item.status)

                                                // Mapear status: 1 = verde, 2 ou 3 = vermelho (erro/expirado)
                                                const isError = status === 2 || status === 3
                                                const isSuccess = status === 1
                                                // Status 3 = expirado (precisa reautenticar) - "Data expirada" retorna status 3
                                                // Status 2 também pode ser expirado, mas a função retorna 3 para "Data expirada"
                                                const isExpired = (status === 3 && item.tipo && item.tipo.includes('Data expirada')) || status === 2

                                                return (
                                                    <div
                                                        key={i}
                                                        className={`flex items-start gap-4 text-sm animate-in slide-in-from-top-2 duration-300 p-3 rounded-lg ${isError ? 'bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900' : ''
                                                            }`}
                                                    >
                                                        <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${isSuccess ? 'bg-emerald-500' :
                                                            isError ? 'bg-red-500' :
                                                                'bg-muted-foreground'
                                                            }`} />
                                                        <div className="flex-1 space-y-1 min-w-0">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    {item.user_name ? (
                                                                        <Tooltip>
                                                                            <TooltipTrigger asChild>
                                                                                <p className="font-medium leading-none truncate">
                                                                                    {item.user_name}
                                                                                </p>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent>
                                                                                <p>{item.user_email || 'Usuário'}</p>
                                                                            </TooltipContent>
                                                                        </Tooltip>
                                                                    ) : (
                                                                        <p className="font-medium leading-none truncate">System</p>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    {isExpired && (
                                                                        <Tooltip>
                                                                            <TooltipTrigger asChild>
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="sm"
                                                                                    onClick={handleOutlookAuth}
                                                                                    className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-950/30"
                                                                                >
                                                                                    <Wrench className="h-3.5 w-3.5" />
                                                                                </Button>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent>
                                                                                <p>Reautenticar Outlook</p>
                                                                            </TooltipContent>
                                                                        </Tooltip>
                                                                    )}
                                                                    <span className="text-xs text-muted-foreground shrink-0">
                                                                        {formatRelativeTime(item.data_evento)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <p className={`text-sm ${isError ? 'text-red-700 dark:text-red-300 font-medium' : 'text-muted-foreground'}`}>
                                                                {item.tipo}
                                                            </p>
                                                            <div className="flex items-center gap-2">
                                                                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal">
                                                                    {isError ? 'Expirado' : 'Ativo'}
                                                                </Badge>
                                                                {isError && (
                                                                    <Badge variant="destructive" className="text-[10px] h-5 px-1.5 font-normal">
                                                                        Atenção
                                                                    </Badge>
                                                                )}
                                                                {isExpired && (
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <Button
                                                                                variant="outline"
                                                                                size="sm"
                                                                                onClick={handleOutlookAuth}
                                                                                className="h-6 px-2 text-xs text-red-600 border-red-300 hover:bg-red-100 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30 shrink-0"
                                                                            >
                                                                                <Wrench className="h-3 w-3 mr-1" />
                                                                                Reautenticar
                                                                            </Button>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>
                                                                            <p>Reautenticar Outlook</p>
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })
                                        )}
                                    </div>
                                </ScrollArea>
                            </TabsContent>

                            <TabsContent value="fallback" className="mt-4">
                                {fallbacks.length > 0 && (
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={toggleSelectAllFallbacks}
                                                className="h-8"
                                            >
                                                {selectedFallbacks.size === fallbacks.length ? (
                                                    <>
                                                        <Square className="h-4 w-4 mr-2" />
                                                        Desselecionar Todos
                                                    </>
                                                ) : (
                                                    <>
                                                        <CheckSquare className="h-4 w-4 mr-2" />
                                                        Selecionar Todos
                                                    </>
                                                )}
                                            </Button>
                                            {selectedFallbacks.size > 0 && (
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    onClick={handleDeleteMultipleFallbacks}
                                                    disabled={isDeletingMultiple}
                                                    className="h-8"
                                                >
                                                    {isDeletingMultiple ? (
                                                        <>
                                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                            Deletando...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Trash2 className="h-4 w-4 mr-2" />
                                                            Deletar {selectedFallbacks.size} selecionado(s)
                                                        </>
                                                    )}
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                )}
                                <ScrollArea className="h-[500px] pr-4">
                                    <div className="space-y-4">
                                        {fallbacks.length === 0 ? (
                                            <div className="text-center text-muted-foreground py-10">
                                                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                                <p className="text-lg font-semibold">Nenhum fallback detectado!</p>
                                                <p className="text-sm mt-2">Todos os workflows estão funcionando corretamente.</p>
                                            </div>
                                        ) : (
                                            fallbacks.map((fallback) => {
                                                const getLevelColor = (level: string) => {
                                                    switch (level) {
                                                        case 'error':
                                                            return 'bg-red-500'
                                                        case 'warn':
                                                            return 'bg-yellow-500'
                                                        default:
                                                            return 'bg-blue-500'
                                                    }
                                                }

                                                const getImpactColor = (impact: string) => {
                                                    switch (impact) {
                                                        case 'high':
                                                            return 'text-red-500'
                                                        case 'medium':
                                                            return 'text-yellow-500'
                                                        default:
                                                            return 'text-blue-500'
                                                    }
                                                }

                                                const getEventTypeLabel = (type: string) => {
                                                    const labels: Record<string, string> = {
                                                        'fallback_variable_missing': 'Variável Faltando',
                                                        'condition_defaulted': 'Condição Padrão',
                                                        'input_defaulted': 'Input Padrão',
                                                        'template_substitution_failed': 'Substituição Falhou',
                                                        'agent_blocked': 'Agente Bloqueado'
                                                    }
                                                    return labels[type] || type
                                                }

                                                const isSelected = selectedFallbacks.has(fallback.id)
                                                const isDeleting = isDeletingFallback === fallback.id

                                                return (
                                                    <div
                                                        key={fallback.id}
                                                        className={`flex items-start gap-3 text-sm animate-in slide-in-from-top-2 duration-300 p-3 rounded-lg border ${fallback.level === 'error'
                                                            ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900'
                                                            : fallback.level === 'warn'
                                                                ? 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900'
                                                                : 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900'
                                                            } ${isSelected ? 'ring-2 ring-primary' : ''}`}
                                                    >
                                                        <Checkbox
                                                            checked={isSelected}
                                                            onCheckedChange={() => toggleFallbackSelection(fallback.id)}
                                                            className="mt-1"
                                                        />
                                                        <div className={`w-2 h-2 rounded-full mt-2 ${getLevelColor(fallback.level)}`} />
                                                        <div className="flex-1 space-y-1">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-semibold">{getEventTypeLabel(fallback.event_type)}</span>
                                                                    <Badge variant="outline" className={`text-xs ${getImpactColor(fallback.impact_level)}`}>
                                                                        {fallback.impact_level}
                                                                    </Badge>
                                                                </div>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => handleDeleteFallback(fallback.id)}
                                                                            disabled={isDeleting}
                                                                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                                                        >
                                                                            {isDeleting ? (
                                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                                            ) : (
                                                                                <Trash2 className="h-4 w-4" />
                                                                            )}
                                                                        </Button>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>
                                                                        <p>Deletar evento</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </div>
                                                            <p className="text-muted-foreground">{fallback.message}</p>
                                                            {fallback.metadata && fallback.metadata.variable_name && (
                                                                <p className="text-xs text-muted-foreground">
                                                                    Variável: <code className="bg-muted px-1 rounded">{fallback.metadata.variable_name}</code>
                                                                </p>
                                                            )}
                                                            {fallback.metadata && fallback.metadata.agent_nome && (
                                                                <p className="text-xs text-muted-foreground">
                                                                    Agente: <span className="font-medium">{fallback.metadata.agent_nome}</span>
                                                                </p>
                                                            )}
                                                            <p className="text-xs text-muted-foreground">
                                                                {formatRelativeTime(fallback.created_at)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                )
                                            })
                                        )}
                                    </div>
                                </ScrollArea>
                            </TabsContent>

                            <TabsContent value="logs" className="mt-4">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Logs do Sistema</CardTitle>
                                        <CardDescription>
                                            Histórico de logs: agentes bloqueados, workflows, erros e avisos
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        {systemLogs.length > 0 && (
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={toggleSelectAllLogs}
                                                        className="h-8"
                                                    >
                                                        {selectedLogs.size === systemLogs.length ? (
                                                            <>
                                                                <Square className="h-4 w-4 mr-2" />
                                                                Desselecionar Todos
                                                            </>
                                                        ) : (
                                                            <>
                                                                <CheckSquare className="h-4 w-4 mr-2" />
                                                                Selecionar Todos
                                                            </>
                                                        )}
                                                    </Button>
                                                    {selectedLogs.size > 0 && (
                                                        <Button
                                                            variant="destructive"
                                                            size="sm"
                                                            onClick={handleDeleteMultipleLogs}
                                                            disabled={isDeletingMultipleLogs}
                                                            className="h-8"
                                                        >
                                                            {isDeletingMultipleLogs ? (
                                                                <>
                                                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                                    Deletando...
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                                    Deletar {selectedLogs.size} selecionado(s)
                                                                </>
                                                            )}
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        {systemLogsLoading ? (
                                            <div className="flex items-center justify-center p-8">
                                                <Loader2 className="h-6 w-6 animate-spin" />
                                            </div>
                                        ) : systemLogs.length === 0 ? (
                                            <div className="text-center p-8 text-muted-foreground">
                                                Nenhum log encontrado
                                            </div>
                                        ) : (
                                            <ScrollArea className="h-[500px]">
                                                <div className="space-y-2">
                                                    {systemLogs.map((log) => {
                                                        const impactColors = {
                                                            low: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900',
                                                            medium: 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900',
                                                            high: 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900',
                                                            critical: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900'
                                                        }
                                                        const levelColors = {
                                                            info: 'text-blue-600 dark:text-blue-400',
                                                            warn: 'text-yellow-600 dark:text-yellow-400',
                                                            error: 'text-red-600 dark:text-red-400',
                                                            debug: 'text-muted-foreground'
                                                        }
                                                        const impactBadges = {
                                                            low: 'Baixo',
                                                            medium: 'Médio',
                                                            high: 'Alto',
                                                            critical: 'Crítico'
                                                        }

                                                        const isSelected = selectedLogs.has(log.id)
                                                        const isDeleting = isDeletingLog === log.id

                                                        return (
                                                            <Card
                                                                key={log.id}
                                                                className={`p-4 ${impactColors[log.impact_level as keyof typeof impactColors] || impactColors.low} ${isSelected ? 'ring-2 ring-primary' : ''}`}
                                                            >
                                                                <div className="flex items-start gap-3">
                                                                    <Checkbox
                                                                        checked={isSelected}
                                                                        onCheckedChange={() => toggleLogSelection(log.id)}
                                                                        className="mt-1"
                                                                    />
                                                                    <div className="flex-1 space-y-2">
                                                                        <div className="flex items-center gap-2 flex-wrap">
                                                                            <Badge variant={
                                                                                log.impact_level === 'critical' ? 'destructive' :
                                                                                    log.impact_level === 'high' ? 'destructive' :
                                                                                        log.impact_level === 'medium' ? 'secondary' : 'default'
                                                                            }>
                                                                                {impactBadges[log.impact_level as keyof typeof impactBadges] || 'Baixo'}
                                                                            </Badge>
                                                                            <Badge variant="outline">
                                                                                {log.log_type}
                                                                            </Badge>
                                                                            <span className={`text-xs font-medium ${levelColors[log.level as keyof typeof levelColors] || levelColors.info}`}>
                                                                                {log.level.toUpperCase()}
                                                                            </span>
                                                                            <span className="text-xs text-muted-foreground">
                                                                                {formatRelativeTime(log.created_at)}
                                                                            </span>
                                                                        </div>
                                                                        <p className="text-sm font-medium">{log.message}</p>
                                                                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                                                                            <details className="mt-2">
                                                                                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                                                                    Ver detalhes
                                                                                </summary>
                                                                                <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                                                                                    {JSON.stringify(log.metadata, null, 2)}
                                                                                </pre>
                                                                            </details>
                                                                        )}
                                                                    </div>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() => handleDeleteLog(log.id)}
                                                                                disabled={isDeleting}
                                                                                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                                                            >
                                                                                {isDeleting ? (
                                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                                ) : (
                                                                                    <Trash2 className="h-4 w-4" />
                                                                                )}
                                                                            </Button>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>
                                                                            <p>Deletar log</p>
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                </div>
                                                            </Card>
                                                        )
                                                    })}
                                                </div>
                                            </ScrollArea>
                                        )}
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>

                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Status dos Agentes</CardTitle>
                        <CardDescription>Status operacional dos seus agentes.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {agents.length === 0 ? (
                            <div className="text-center text-muted-foreground py-8">
                                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">Nenhum agente encontrado</p>
                                <p className="text-xs mt-1">Crie seu primeiro agente para começar</p>
                            </div>
                        ) : (
                            agents.map((agent) => {
                                try {
                                    if (!agent || !agent.id || !agent.nome) {
                                        console.warn("Cockpit: Agente inválido:", agent);
                                        return null;
                                    }

                                    const statusInfo = getAgentStatusInfo(agent.status_id);
                                    const StatusIcon = statusInfo.icon;

                                    return (
                                        <div
                                            key={agent.id}
                                            className="flex items-center justify-between p-3 border rounded-lg bg-card/50 hover:bg-card/80 transition-colors"
                                        >
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <div className={`relative flex h-2 w-2 shrink-0 ${statusInfo.bgColor} rounded-full`}>
                                                    <span className={`absolute inline-flex h-full w-full ${statusInfo.bgColor} rounded-full opacity-75 animate-ping`}></span>
                                                </div>
                                                <div className="space-y-0.5 flex-1 min-w-0">
                                                    <p className="text-sm font-medium leading-none truncate">{agent.nome || 'Sem nome'}</p>
                                                    <p className="text-xs text-muted-foreground">{statusInfo.label}</p>
                                                </div>
                                            </div>
                                            <StatusIcon className={`h-4 w-4 ${statusInfo.color} shrink-0`} />
                                        </div>
                                    );
                                } catch (err) {
                                    console.error("Cockpit: Erro ao renderizar agente:", agent, err);
                                    return null;
                                }
                            }).filter(Boolean)
                        )}

                        <div className="pt-4 border-t">
                            <Button
                                variant="outline"
                                className="w-full text-xs h-8"
                                size="sm"
                                onClick={() => navigate('agents')}
                            >
                                Criar Novo Agente <ArrowRight className="ml-2 h-3 w-3" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}