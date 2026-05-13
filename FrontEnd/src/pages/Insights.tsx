import React, { useEffect, useMemo, useState } from "react"
import ReactDOM from "react-dom"
import {
    Bar,
    BarChart,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
    PieChart,
    Pie,
    Cell,
    CartesianGrid,
    Area,
    AreaChart
} from "recharts"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle
} from "../components/ui/card"
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from "../components/ui/tabs"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "../components/ui/select"
import {
    ArrowUpRight,
    ArrowDownRight,
    ArrowUp,
    ArrowDown,
    MessageSquare,
    MessageCircle,
    Phone,
    DollarSign,
    Calendar,
    Download,
    Globe,
    Target,
    Loader2,
    FileSpreadsheet,
    FileText,
    Brain,
    Sparkles,
    Mail,
    Linkedin
} from "lucide-react"
import { Avatar, AvatarFallback } from "../components/ui/avatar"
import { Button } from "../components/ui/button"
import { Badge } from "../components/ui/badge"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "../components/ui/chart"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "../components/ui/dropdown-menu"
import { supabase } from "../utils/supabase/client"
import { useAuth } from "../contexts/AuthContext"
import { toast } from "sonner"
import ExcelJS from "exceljs"
import { jsPDF } from "jspdf"
import { useTranslation } from "react-i18next"
import i18n from "../i18n/config"
import { useTheme } from "next-themes"

export interface InsightsData {
    overview: { name: string; date: string; conversations: number; cost: number }[];
    channels: { name: string; value: number }[];
    agents: { agent_name: string; avg_confidence: number }[]; // Added agents data
    summary: {
        total_interactions: number;
        total_cost: number;
        active_channels: number;
        total_tokens: number;
        rag_usage_count: number;
        rag_usage_rate: number;
    };
}

// Componente para cada item de agente com tooltip que segue o mouse
function AgentPerformanceItem({ agent, index }: { agent: { name: string; score: number }; index: number }) {
    const [tooltipPos, setTooltipPos] = React.useState<{ x: number; y: number } | null>(null)
    const [showTooltip, setShowTooltip] = React.useState(false)
    const mousePosRef = React.useRef<{ x: number; y: number } | null>(null)
    const tooltipRef = React.useRef<HTMLDivElement | null>(null)
    const { theme } = useTheme()
    
    const score = agent.score
    const { t } = useTranslation('insights')
    
    const getColor = (score: number) => {
        if (score >= 80) {
            return { 
                bg: '#10b981', 
                gradient: 'linear-gradient(to right, #10b981, #34d399)', 
                label: t('agents.performance.excellent'),
                glow: '0 0 20px rgba(16, 185, 129, 0.5)'
            }
        }
        if (score >= 60) {
            return { 
                bg: '#2563eb', 
                gradient: 'linear-gradient(to right, #2563eb, #6366f1, #9333ea)', 
                label: t('agents.performance.normal'),
                glow: '0 0 20px rgba(37, 99, 235, 0.5)'
            }
        }
        if (score >= 40) {
            return { 
                bg: '#f59e0b', 
                gradient: 'linear-gradient(to right, #f59e0b, #fbbf24)', 
                label: t('agents.performance.attention'),
                glow: '0 0 20px rgba(245, 158, 11, 0.5)'
            }
        }
        return { 
            bg: '#ef4444', 
            gradient: 'linear-gradient(to right, #ef4444, #f87171)', 
            label: t('agents.performance.critical'),
            glow: '0 0 20px rgba(239, 68, 68, 0.5)'
        }
    }
    const color = getColor(score)
    const initials = agent.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    
    // Atualizar posição do mouse globalmente - sempre ativo quando tooltip está visível
    React.useEffect(() => {
        if (!showTooltip) return

        let animationFrameId: number | null = null

        const updateTooltipPosition = () => {
            if (mousePosRef.current && tooltipRef.current) {
                const { x, y } = mousePosRef.current
                tooltipRef.current.style.left = `${x + 12}px`
                tooltipRef.current.style.top = `${y - 28}px`
            }
            animationFrameId = requestAnimationFrame(updateTooltipPosition)
        }

        const handleGlobalMouseMove = (e: MouseEvent) => {
            const newPos = { x: e.clientX, y: e.clientY }
            mousePosRef.current = newPos
            setTooltipPos(newPos)
        }

        // Inicia o loop de animação
        animationFrameId = requestAnimationFrame(updateTooltipPosition)

        window.addEventListener('mousemove', handleGlobalMouseMove, { passive: true })
        document.addEventListener('mousemove', handleGlobalMouseMove, { passive: true })
        
        return () => {
            if (animationFrameId !== null) {
                cancelAnimationFrame(animationFrameId)
            }
            window.removeEventListener('mousemove', handleGlobalMouseMove)
            document.removeEventListener('mousemove', handleGlobalMouseMove)
        }
    }, [showTooltip])
    
    const handleMouseMove = (e: React.MouseEvent) => {
        // Atualiza a posição do mouse
        mousePosRef.current = { x: e.clientX, y: e.clientY }
        setTooltipPos({ x: e.clientX, y: e.clientY })
    }
    
    return (
        <div 
            className="relative flex items-center gap-4 py-2"
            onMouseEnter={() => {
                setShowTooltip(true)
                if (mousePosRef.current) {
                    setTooltipPos(mousePosRef.current)
                }
            }}
            onMouseLeave={() => {
                setShowTooltip(false)
                setTooltipPos(null)
                mousePosRef.current = null
            }}
            onMouseMove={handleMouseMove}
        >
            {/* Avatar + Nome à esquerda */}
            <div className="flex items-center gap-3 shrink-0 min-w-0" style={{ width: '200px' }}>
                <Avatar className="h-10 w-10 border-2 border-white shadow-md shrink-0">
                    <AvatarFallback 
                        className="text-white font-bold text-sm"
                        style={{
                            background: 'linear-gradient(to bottom right, #3b82f6, #9333ea)'
                        }}
                    >
                        {initials}
                    </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                    <p 
                        className="font-semibold text-sm truncate" 
                        style={{ 
                            color: theme === 'dark' ? '#fafafa' : '#0f172a' 
                        }}
                    >
                        {agent.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">{color.label}</p>
                </div>
            </div>
            
            {/* Barra de Progresso no centro */}
            <div className="flex-1 relative h-8 rounded-full overflow-hidden shadow-inner bg-slate-100 dark:bg-zinc-800/80">
                <div
                    className="h-full rounded-full transition-all duration-500 ease-out relative"
                    style={{
                        width: `${score}%`,
                        background: color.gradient,
                        boxShadow: `${color.glow}, 0 2px 8px ${color.bg}40`
                    }}
                >
                    {/* Glow na ponta da barra */}
                    <div 
                        className="absolute right-0 top-0 bottom-0 w-8 rounded-full opacity-60"
                        style={{
                            background: `radial-gradient(circle at right, ${color.bg}, transparent)`,
                            filter: 'blur(8px)'
                        }}
                    />
                </div>
            </div>
            
            {/* Porcentagem à direita */}
            <div className="text-right shrink-0" style={{ width: '80px' }}>
                <p className="font-black text-lg text-slate-900 dark:text-zinc-100">{score.toFixed(1)}%</p>
            </div>
            
            {/* Tooltip Premium - Segue o mouse - Renderizado via portal para evitar problemas de posicionamento */}
            {showTooltip && tooltipPos && ReactDOM.createPortal(
                <div 
                    ref={tooltipRef}
                    className="fixed flex items-center gap-2 px-3 py-1.5 rounded-lg text-white text-xs font-semibold shadow-xl pointer-events-none z-[99999] whitespace-nowrap"
                    style={{
                        left: `${tooltipPos.x + 12}px`,
                        top: `${tooltipPos.y - 28}px`,
                        backgroundColor: 'rgba(9, 9, 11, 0.95)',
                        backdropFilter: 'blur(8px)',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                        transform: 'translateZ(0)',
                        willChange: 'left, top'
                    }}
                >
                    <Sparkles className="h-3.5 w-3.5" style={{ color: '#fbbf24' }} />
                    <span>{t('agents.tooltip', { score: score.toFixed(1) })}</span>
                </div>,
                document.body
            )}
        </div>
    )
}

export function Insights() {
    const { t } = useTranslation('insights')
    const { theme } = useTheme()
    const [data, setData] = useState<InsightsData | null>(null)
    const [previousPeriodData, setPreviousPeriodData] = useState<InsightsData['summary'] | null>(null)
    const [loading, setLoading] = useState(true)
    const [period, setPeriod] = useState<string>('7d')
    const [activeTab, setActiveTab] = useState<string>('overview')
    const [analyticsIssues, setAnalyticsIssues] = useState<string[]>([])
    const { user } = useAuth()
    
    // Garantir que as traduções estejam carregadas
    useEffect(() => {
        const checkTranslations = async () => {
            const currentLang = i18n.language || 'pt-BR'
            const insightsTranslations = i18n.getResourceBundle(currentLang, 'insights')
            
            if (!insightsTranslations || Object.keys(insightsTranslations).length === 0) {
                console.log('[Insights] Traduções não encontradas, carregando...')
                const { loadTranslationsFromDatabase } = await import('../i18n/config')
                const companiesId = localStorage.getItem('companies_id') || undefined
                await loadTranslationsFromDatabase(currentLang, companiesId)
                i18n.emit('loaded')
            }
        }
        
        checkTranslations()
        
        const handleLanguageChanged = () => {
            checkTranslations()
        }
        
        i18n.on('languageChanged', handleLanguageChanged)
        i18n.on('added', checkTranslations)
        
        return () => {
            i18n.off('languageChanged', handleLanguageChanged)
            i18n.off('added', checkTranslations)
        }
    }, [])

    useEffect(() => {
        const load = async () => {
            if (!user?.email) {
                console.log("[Insights] Usuário não encontrado, aguardando...")
                return
            }

            try {
                setLoading(true)

                const days = period === '7d' ? 7 : period === '30d' ? 30 : 7

                // Buscar dados do período atual
                const [overviewResult, channelsResult, agentPerformanceResult, summaryResult] = await Promise.all([
                    supabase.rpc('sp_get_analytics_overview_by_email', { p_email: user.email, p_days: days }),
                    supabase.rpc('sp_get_analytics_channel_distribution_by_email', { p_email: user.email, p_days: days }),
                    supabase.rpc('sp_get_analytics_agent_performance_by_email', { p_email: user.email, p_days: days }),
                    supabase.rpc('sp_get_analytics_summary_by_email', { p_email: user.email, p_days: days }),
                ])

                const rpcIssues = [
                    overviewResult.error ? t('errors.overviewRpc', { defaultValue: 'Historico de interacoes indisponivel.' }) : null,
                    channelsResult.error ? t('errors.channelsRpc', { defaultValue: 'Distribuicao por canal indisponivel.' }) : null,
                    agentPerformanceResult.error ? t('errors.agentsRpc', { defaultValue: 'Performance por agente indisponivel.' }) : null,
                    summaryResult.error ? t('errors.summaryRpc', { defaultValue: 'Resumo consolidado indisponivel.' }) : null,
                ].filter(Boolean) as string[]
                setAnalyticsIssues(rpcIssues)

                const overview = (!overviewResult.error && overviewResult.data && Array.isArray(overviewResult.data)) ? overviewResult.data : []
                const channels = (!channelsResult.error && channelsResult.data && Array.isArray(channelsResult.data)) ? channelsResult.data : []
                const agents = (!agentPerformanceResult.error && agentPerformanceResult.data && Array.isArray(agentPerformanceResult.data)) ? agentPerformanceResult.data : []
                const summary = (!summaryResult.error && summaryResult.data && Array.isArray(summaryResult.data) && summaryResult.data.length > 0)
                    ? summaryResult.data[0]
                    : {
                        total_interactions: 0,
                        total_cost: 0,
                        active_channels: 0,
                        total_tokens: 0,
                        rag_usage_count: 0,
                        rag_usage_rate: 0
                    }

                // Buscar dados de um período maior (2x) para calcular o período anterior
                // A função retorna os últimos N dias, então se buscar days*2, teremos:
                // - Últimos N dias = período atual (já temos)
                // - N dias anteriores = período anterior (vamos calcular)
                const previousOverviewResult = await supabase.rpc('sp_get_analytics_overview_by_email', { 
                    p_email: user.email, 
                    p_days: days * 2 
                })

                let previousPeriodSummary: InsightsData['summary'] | null = null
                
                if (!previousOverviewResult.error && previousOverviewResult.data && Array.isArray(previousOverviewResult.data) && previousOverviewResult.data.length > 0) {
                    // Ordenar por data (mais antiga primeiro)
                    const sortedData = [...previousOverviewResult.data].sort((a: any, b: any) => 
                        new Date(a.date).getTime() - new Date(b.date).getTime()
                    )
                    
                    // Separar: primeiros N dias = período anterior, últimos N dias = período atual
                    const previousPeriodData = sortedData.slice(0, days)
                    // Calcular métricas do período anterior
                    const prevInteractions = previousPeriodData.reduce((acc: number, curr: any) => acc + (curr.conversations || 0), 0)
                    const prevCost = previousPeriodData.reduce((acc: number, curr: any) => acc + (Number(curr.cost) || 0), 0)

                    // Calcular summary do período anterior baseado nos dados de overview
                    previousPeriodSummary = {
                        total_interactions: prevInteractions,
                        total_cost: prevCost,
                        active_channels: 0,
                        total_tokens: 0,
                        rag_usage_count: 0,
                        rag_usage_rate: 0
                    }
                }

                setData({
                    overview,
                    channels,
                    agents,
                    summary
                })
                setPreviousPeriodData(previousPeriodSummary)
            } catch (e: any) {
                console.error("[Insights] Erro ao carregar dados:", e)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [period, user?.email])

    const overviewData = data?.overview || []
    const overviewChartData = useMemo(
        () =>
            overviewData.map((row) => ({
                ...row,
                conversations: Number(row.conversations) || 0,
                cost: Number(row.cost) || 0,
            })),
        [overviewData]
    )
    const channelsData = data?.channels || []

    if (loading) {
        return (
            <div className="flex h-full min-h-[50vh] items-center justify-center bg-[#F8FAFC] p-8 dark:bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    // Função para obter cor, ícone e configuração por canal
    const getChannelConfig = (channelName: string) => {
        const name = channelName.toLowerCase()
        if (name.includes('whatsapp') || name.includes('whats')) {
            return {
                color: '#10b981',
                icon: MessageCircle,
                label: t('channels.label.whatsapp')
            }
        }
        if (
            name === 'chat' ||
            name.includes('webchat') ||
            name.includes('web') ||
            name.includes('widget')
        ) {
            return {
                color: '#2563eb',
                icon: MessageSquare,
                label: t('channels.label.webchat')
            }
        }
        if (name.includes('email') || name.includes('mail')) {
            return {
                color: '#f59e0b',
                icon: Mail,
                label: t('channels.label.email')
            }
        }
        if (name.includes('linkedin')) {
            return {
                color: '#6366f1',
                icon: Linkedin,
                label: t('channels.label.linkedin')
            }
        }
        if (name.includes('phone') || name.includes('voice') || name.includes('voip') || name.includes('telefone')) {
            return {
                color: '#ec4899',
                icon: Phone,
                label: t('channels.label.phone')
            }
        }
        // Default
        return {
            color: '#64748b',
            icon: Globe,
            label: channelName
        }
    }
    
    // Soma de contagens por valor distinto do campo channel em tb_agent_decisions (decisões do agente),
    // não número de agentes físicos nem total de conversas diretas.
    const channelDecisionsTotal = channelsData.reduce((acc, curr) => acc + curr.value, 0)

    const channelTechnicalHint = (slug: string) => {
        const key = slug.trim().toLowerCase()
        const hintKeys: Record<string, [string, string]> = {
            whatsapp: [
                'channels.slugHint.whatsapp',
                'Mensagens de texto no WhatsApp (código técnico: whatsapp).'
            ],
            whatsapp_call: [
                'channels.slugHint.whatsapp_call',
                'Chamadas de voz via WhatsApp (código técnico: whatsapp_call).'
            ],
            whatsapp_audio: [
                'channels.slugHint.whatsapp_audio',
                'Áudios tratados pelo canal WhatsApp (código técnico: whatsapp_audio).'
            ],
            webchat: [
                'channels.slugHint.webchat',
                'Chat web ou widget no site (código técnico: webchat).'
            ],
            chat: [
                'channels.slugHint.chat',
                'Interações gravadas pelo produto como "chat".'
            ],
        }
        const pair = hintKeys[key]
        return pair ? t(pair[0], { defaultValue: pair[1] }) : null
    }
    
    const agentsData = data?.agents?.map(a => ({ name: a.agent_name, score: Number(a.avg_confidence) * 100 })) || [] // Process agents data
    const summary = data?.summary || {
        total_interactions: 0,
        total_cost: 0,
        active_channels: 0,
        total_tokens: 0,
        rag_usage_count: 0,
        rag_usage_rate: 0
    }

    const totalInteractions =
        summary.total_interactions ||
        overviewChartData.reduce((acc, curr) => acc + (Number(curr.conversations) || 0), 0)
    const totalCost = Number(summary.total_cost) || 0
    const activeChannels = summary.active_channels || channelsData.length
    const ragUsageRate = summary.rag_usage_rate || 0

    // Calcular tendências comparando com período anterior REAL
    const calculateTrend = (current: number, previous: number | null) => {
        // Se não temos dados do período anterior, retorna neutro
        if (previous === null || previous === undefined || previous === 0) {
            return { value: 0, isPositive: true, hasData: false }
        }
        const change = ((current - previous) / previous) * 100
        return {
            value: Math.abs(change),
            isPositive: change >= 0,
            hasData: true
        }
    }

    const interactionsTrend = calculateTrend(totalInteractions, previousPeriodData?.total_interactions || null)
    const costTrend = calculateTrend(totalCost, previousPeriodData?.total_cost ? Number(previousPeriodData.total_cost) : null)
    const channelsTrend = calculateTrend(activeChannels, previousPeriodData?.active_channels && previousPeriodData.active_channels > 0 ? previousPeriodData.active_channels : null)
    const ragTrend = calculateTrend(ragUsageRate, previousPeriodData?.rag_usage_rate && previousPeriodData.rag_usage_rate > 0 ? previousPeriodData.rag_usage_rate : null)

    // Export functions remains roughly same, can add agents tab logic if needed but user just wants visual merge
    const exportToExcel = async () => {
        if (!data) {
            toast.error(t('export.error.noData'))
            return
        }
        try {
            const workbook = new ExcelJS.Workbook()
            workbook.creator = "SONIA Insights"

            const overviewWs = workbook.addWorksheet(t('tabs.overview'))
            overviewWs.addRow([t('excel.overview.date'), t('excel.overview.interactions'), t('excel.overview.cost')])
            data.overview.forEach(item => {
                overviewWs.addRow([item.date, item.conversations, item.cost.toFixed(6)])
            })

            const channelsWs = workbook.addWorksheet(t('tabs.channels'))
            channelsWs.addRow([t('excel.channels.channel'), t('excel.channels.quantity')])
            data.channels.forEach(item => {
                channelsWs.addRow([item.name, item.value])
            })

            const agentsWs = workbook.addWorksheet(t('tabs.agents'))
            agentsWs.addRow([t('excel.agents.agent'), t('excel.agents.confidence')])
            data.agents.forEach(item => {
                agentsWs.addRow([item.agent_name, (Number(item.avg_confidence) * 100).toFixed(2)])
            })

            const summaryWs = workbook.addWorksheet(t('pdf.summary.title'))
            summaryWs.addRow([t('excel.summary.metric'), t('excel.summary.value')])
            summaryWs.addRow([t('excel.summary.totalInteractions'), data.summary.total_interactions])
            summaryWs.addRow([t('excel.summary.totalCost'), data.summary.total_cost.toFixed(6)])
            summaryWs.addRow([t('excel.summary.activeChannels'), data.summary.active_channels])
            summaryWs.addRow([
                t('excel.summary.ragUsage'),
                `${data.summary.rag_usage_count} (${data.summary.rag_usage_rate.toFixed(2)}%)`
            ])

            const fileName = `Insights_${period}_${new Date().toISOString().split('T')[0]}.xlsx`
            const buf = await workbook.xlsx.writeBuffer()
            const blob = new Blob([buf], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = fileName
            a.click()
            URL.revokeObjectURL(url)
            toast.success(t('export.success.excel', { fileName }))
        } catch (error: unknown) {
            console.error(error)
            toast.error(t('export.error.excel'))
        }
    }

    const exportToPDF = async () => {
        if (!data) {
            toast.error(t('export.error.noData'))
            return
        }

        try {
            const { default: autoTable } = await import("jspdf-autotable")
            const doc = new jsPDF()
            const dateStr = new Date().toLocaleDateString(i18n.language === 'pt-BR' ? 'pt-BR' : i18n.language === 'es-ES' ? 'es-ES' : 'en-US')
            const fileName = `Insights_${period}_${new Date().toISOString().split('T')[0]}.pdf`

            // Title
            doc.setFontSize(20)
            doc.text(t('pdf.title'), 14, 22)
            doc.setFontSize(11)
            doc.setTextColor(100)
            doc.text(`${t('header.period')}: ${period === '7d' ? t('pdf.period.7d') : t('pdf.period.30d')}`, 14, 30)
            doc.text(t('pdf.generated', { date: dateStr }), 14, 35)

            // Resumo (KPIs)
            doc.setFontSize(14)
            doc.setTextColor(0)
            doc.text(t('pdf.summary.title'), 14, 50)

            autoTable(doc, {
                startY: 55,
                head: [[t('pdf.summary.metric'), t('pdf.summary.value')]],
                body: [
                    [t('pdf.summary.totalInteractions'), data.summary.total_interactions.toLocaleString()],
                    [t('pdf.summary.totalCost'), `$${data.summary.total_cost.toFixed(6)}`],
                    [t('pdf.summary.activeChannels'), data.summary.active_channels.toString()],
                    [t('pdf.summary.ragRate'), `${data.summary.rag_usage_rate.toFixed(2)}%`],
                    [t('pdf.summary.totalTokens'), data.summary.total_tokens.toLocaleString()]
                ],
                theme: 'striped',
                headStyles: { fillColor: [59, 130, 246] }
            })

            // Overview/Trend Table
            doc.setFontSize(14)
            doc.text(t('pdf.history.title'), 14, (doc as any).lastAutoTable.finalY + 15)

            autoTable(doc, {
                startY: (doc as any).lastAutoTable.finalY + 20,
                head: [[t('pdf.history.date'), t('pdf.history.interactions'), t('pdf.history.cost')]],
                body: data.overview.map(item => [
                    item.date,
                    item.conversations.toString(),
                    `$${item.cost.toFixed(6)}`
                ]),
                theme: 'grid',
                headStyles: { fillColor: [59, 130, 246] }
            })

            // Agents Performance
            if (data.agents && data.agents.length > 0) {
                doc.addPage()
                doc.setFontSize(14)
                doc.text(t('pdf.agents.title'), 14, 22)

                autoTable(doc, {
                    startY: 30,
                    head: [[t('pdf.agents.agent'), t('pdf.agents.confidence')]],
                    body: data.agents.map(item => [
                        item.agent_name,
                        `${(Number(item.avg_confidence) * 100).toFixed(2)}%`
                    ]),
                    theme: 'striped',
                    headStyles: { fillColor: [59, 130, 246] }
                })
            }

            // Channels
            doc.setFontSize(14)
            doc.text(t('pdf.channels.title'), 14, (doc as any).lastAutoTable.finalY + 15)

            autoTable(doc, {
                startY: (doc as any).lastAutoTable.finalY + 20,
                head: [[t('pdf.channels.channel'), t('pdf.channels.interactions')]],
                body: data.channels.map(item => [
                    item.name,
                    item.value.toString()
                ]),
                theme: 'striped',
                headStyles: { fillColor: [59, 130, 246] }
            })

            doc.save(fileName)
            toast.success(t('export.success.pdf', { fileName }))
        } catch (error: any) {
            console.error("Erro ao exportar PDF:", error)
            toast.error(t('export.error.pdf'))
        }
    }

    const tabMutedColor = theme === 'dark' ? '#a1a1aa' : '#64748b'
    const metricCardStyle = {
        border: theme === 'dark' ? '1px solid rgba(63, 63, 70, 0.9)' : '1px solid rgba(203, 213, 225, 0.85)',
        borderRadius: '12px',
        boxShadow: 'none',
    }
    const renderTrend = (
        trend: { value: number; isPositive: boolean; hasData: boolean },
        positiveIsGood = true
    ) => {
        if (!trend.hasData) {
            return <p className="text-xs text-muted-foreground">{t('kpi.trend.insufficient')}</p>
        }

        const good = positiveIsGood ? trend.isPositive : !trend.isPositive
        const TrendIcon = trend.isPositive ? ArrowUp : ArrowDown

        return (
            <div className="flex items-center gap-1.5 text-xs">
                <div className={`flex items-center gap-1 font-semibold ${good ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    <TrendIcon className="h-3.5 w-3.5" />
                    <span>{trend.value.toFixed(1)}%</span>
                </div>
                <span className="text-muted-foreground">{t('kpi.trend.relative')}</span>
            </div>
        )
    }
    const primaryMetricCards = [
        {
            key: 'interactions',
            title: t('kpi.totalInteractions'),
            description: t('kpi.totalInteractions.description', { defaultValue: 'Volume total de conversas e eventos processados no período selecionado.' }),
            value: totalInteractions.toLocaleString(),
            footer: t('kpi.totalInteractions.footer', { defaultValue: 'Use para medir demanda operacional e crescimento do atendimento.' }),
            Icon: MessageSquare,
            iconColor: '#2563eb',
            iconBg: theme === 'dark' ? 'rgba(37, 99, 235, 0.16)' : '#eff6ff',
            trend: interactionsTrend,
            positiveIsGood: true,
        },
        {
            key: 'cost',
            title: t('kpi.tokenCost'),
            description: t('kpi.tokenCost.description', { defaultValue: 'Custo estimado de tokens consumidos pelas interações do período.' }),
            value: `$${totalCost > 0 ? totalCost.toFixed(6) : '0.000000'}`,
            footer: t('kpi.tokenCost.footer', { defaultValue: 'Quedas costumam indicar melhor eficiência; altas podem acompanhar mais volume.' }),
            Icon: DollarSign,
            iconColor: '#10b981',
            iconBg: theme === 'dark' ? 'rgba(16, 185, 129, 0.16)' : '#ecfdf5',
            trend: costTrend,
            positiveIsGood: false,
        },
        {
            key: 'channels',
            title: t('kpi.activeChannels'),
            description: t('kpi.activeChannels.description', { defaultValue: 'Quantidade de canais com atividade ou agentes vinculados no período.' }),
            value: activeChannels.toString(),
            footer: t('kpi.activeChannels.footer', { defaultValue: 'Ajuda a entender a cobertura dos pontos de contato ativos.' }),
            Icon: Target,
            iconColor: '#4f46e5',
            iconBg: theme === 'dark' ? 'rgba(79, 70, 229, 0.16)' : '#eef2ff',
            trend: channelsTrend,
            positiveIsGood: true,
        },
        {
            key: 'rag',
            title: t('kpi.ragUsage'),
            description: t('kpi.ragUsage.description', { defaultValue: 'Percentual de uso da base de conhecimento nas respostas dos agentes.' }),
            value: `${ragUsageRate.toFixed(1)}%`,
            supporting: t('kpi.rag.decisions', {
                count: summary.rag_usage_count,
                defaultValue: '{{count}} decisões com uso da base (RAG)',
            }),
            footer: t('kpi.ragUsage.footer', { defaultValue: 'Indica quanto os agentes estão consultando documentos para responder.' }),
            Icon: Brain,
            iconColor: '#9333ea',
            iconBg: theme === 'dark' ? 'rgba(147, 51, 234, 0.16)' : '#faf5ff',
            trend: ragTrend,
            positiveIsGood: true,
        },
    ]
    const renderMetricCard = (card: typeof primaryMetricCards[number]) => {
        const Icon = card.Icon

        return (
            <Card
                key={card.key}
                className="flex min-h-[168px] flex-col overflow-hidden transition-colors hover:border-cyan-500/45"
                style={metricCardStyle}
            >
                <CardHeader className="p-4 pb-2">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <CardTitle className="text-sm font-semibold leading-tight">{card.title}</CardTitle>
                            <CardDescription className="mt-1 line-clamp-2 text-xs leading-relaxed">
                                {card.description}
                            </CardDescription>
                        </div>
                        <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                            style={{ backgroundColor: card.iconBg }}
                        >
                            <Icon className="h-4.5 w-4.5" strokeWidth={2.4} style={{ color: card.iconColor }} />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="flex-1 px-4 pb-3 pt-0">
                    <div className={`${String(card.value).length > 9 ? 'text-lg' : 'text-2xl'} font-bold tracking-tight`}>
                        {card.value}
                    </div>
                    <div className="mt-2">
                        {'trend' in card
                            ? renderTrend(card.trend, card.positiveIsGood)
                            : null}
                    </div>
                    {'supporting' in card && card.supporting ? (
                        <p className="mt-1 text-xs text-muted-foreground">{card.supporting}</p>
                    ) : null}
                </CardContent>
                <CardFooter className="border-t bg-muted/20 px-4 py-2 text-[11px] leading-relaxed text-muted-foreground">
                    {card.footer}
                </CardFooter>
            </Card>
        )
    }

    return (
        <div className="min-h-screen -m-4 space-y-6 bg-[#F8FAFC] p-4 sm:p-6 lg:p-8 dark:bg-background">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">{t('header.title')}</h2>
                    <p className="text-muted-foreground">
                        {t('header.description')}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={period} onValueChange={setPeriod}>
                        <SelectTrigger className="w-[180px]">
                            <Calendar className="mr-2 h-4 w-4" />
                            <SelectValue placeholder={t('header.period')} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="7d">{t('header.period.7d')}</SelectItem>
                            <SelectItem value="30d">{t('header.period.30d')}</SelectItem>
                        </SelectContent>
                    </Select>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" title={t('export.title')}>
                                <Download className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>{t('export.title')}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={exportToExcel} className="cursor-pointer">
                                <FileSpreadsheet className="mr-2 h-4 w-4" />
                                <span>{t('export.excel')}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={exportToPDF} className="cursor-pointer">
                                <FileText className="mr-2 h-4 w-4" />
                                <span>{t('export.pdf')}</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {analyticsIssues.length > 0 ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
                    <p className="font-semibold">
                        {t('errors.partialDataTitle', { defaultValue: 'Alguns dados não puderam ser carregados.' })}
                    </p>
                    <p className="mt-1 text-xs opacity-90">
                        {analyticsIssues.join(' ')}
                    </p>
                </div>
            ) : null}

            <section className="space-y-3">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t('sections.executiveSummary', { defaultValue: 'Resumo executivo' })}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {t('sections.executiveSummary.description', {
                            defaultValue: 'Indicadores principais para acompanhar volume, custo, cobertura e uso da base de conhecimento.',
                        })}
                    </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {primaryMetricCards.map(renderMetricCard)}
                </div>
            </section>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="flex h-auto w-full overflow-x-auto rounded-lg border border-transparent bg-slate-100 p-1.5 shadow-none outline-none dark:border-border dark:bg-zinc-900/90 sm:w-fit">
                    <TabsTrigger
                        value="overview"
                        className="h-10 min-w-fit rounded-md border-none px-4 text-[11px] font-black uppercase tracking-wider outline-none ring-0 transition-colors sm:px-6"
                        style={{
                            backgroundColor: activeTab === 'overview' ? '#06b6d4' : 'transparent',
                            color: activeTab === 'overview' ? '#ffffff' : tabMutedColor,
                            borderRadius: '8px',
                            fontWeight: '900',
                            fontSize: '11px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            paddingLeft: '24px',
                            paddingRight: '24px',
                            height: '40px',
                            border: 'none',
                            outline: 'none',
                            transition: 'color 0.2s, background-color 0.2s',
                            boxShadow: 'none'
                        }}
                    >
                        {t('tabs.overview')}
                    </TabsTrigger>
                    <TabsTrigger
                        value="agents"
                        className="h-10 min-w-fit rounded-md border-none px-4 text-[11px] font-black uppercase tracking-wider outline-none ring-0 transition-colors sm:px-6"
                        style={{
                            backgroundColor: activeTab === 'agents' ? '#06b6d4' : 'transparent',
                            color: activeTab === 'agents' ? '#ffffff' : tabMutedColor,
                            borderRadius: '8px',
                            fontWeight: '900',
                            fontSize: '11px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            paddingLeft: '24px',
                            paddingRight: '24px',
                            height: '40px',
                            border: 'none',
                            outline: 'none',
                            transition: 'color 0.2s, background-color 0.2s',
                            boxShadow: 'none'
                        }}
                    >
                        {t('tabs.agents')}
                    </TabsTrigger>
                    <TabsTrigger
                        value="channels"
                        className="h-10 min-w-fit rounded-md border-none px-4 text-[11px] font-black uppercase tracking-wider outline-none ring-0 transition-colors sm:px-6"
                        style={{
                            backgroundColor: activeTab === 'channels' ? '#06b6d4' : 'transparent',
                            color: activeTab === 'channels' ? '#ffffff' : tabMutedColor,
                            borderRadius: '8px',
                            fontWeight: '900',
                            fontSize: '11px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            paddingLeft: '24px',
                            paddingRight: '24px',
                            height: '40px',
                            border: 'none',
                            outline: 'none',
                            transition: 'color 0.2s, background-color 0.2s',
                            boxShadow: 'none'
                        }}
                    >
                        {t('tabs.channels')}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-1">
                        <Card className="overflow-hidden" style={metricCardStyle}>
                            <CardHeader>
                                <CardTitle className="text-lg font-black tracking-tight">{t('overview.title')}</CardTitle>
                                <CardDescription>{t('overview.description')}</CardDescription>
                            </CardHeader>
                            <CardContent className="min-h-0 pl-2">
                                {overviewChartData.length > 0 ? (
                                    <div className="h-[220px] w-full sm:h-[260px] md:h-[280px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart
                                                data={overviewChartData}
                                                margin={{ top: 8, right: 8, left: 4, bottom: 4 }}
                                            >
                                            <defs>
                                                <linearGradient id="colorInteractions" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8} />
                                                    <stop offset="50%" stopColor="#3b82f6" stopOpacity={0.4} />
                                                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                            <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                                itemStyle={{ color: 'hsl(var(--foreground))' }}
                                            />
                                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                                            <Area
                                                type="linear"
                                                dataKey="conversations"
                                                stroke="#3b82f6"
                                                fillOpacity={1}
                                                fill="url(#colorInteractions)"
                                                strokeWidth={2}
                                                isAnimationActive={false}
                                                connectNulls={false}
                                                dot={{
                                                    r: 3,
                                                    fill: theme === 'dark' ? '#0c1222' : '#ffffff',
                                                    stroke: '#3b82f6',
                                                    strokeWidth: 2,
                                                }}
                                                activeDot={{ r: 5, fill: '#2563eb', stroke: '#ffffff', strokeWidth: 2 }}
                                            />
                                        </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : (
                                    <div className="flex h-[220px] items-center justify-center text-muted-foreground sm:h-[260px]">
                                        <p>{t('overview.empty')}</p>
                                    </div>
                                )}
                            </CardContent>
                            <CardFooter className="border-t bg-muted/20 px-6 py-3 text-xs leading-relaxed text-muted-foreground">
                                {t('overview.footer', { defaultValue: 'Mostra a evolução do volume no período escolhido; use para identificar picos de demanda.' })}
                            </CardFooter>
                        </Card>
                        
                        <Card className="overflow-hidden" style={metricCardStyle}>
                            <CardHeader>
                                <CardTitle className="text-lg font-black tracking-tight">{t('overview.costs.title')}</CardTitle>
                                <CardDescription>{t('overview.costs.description')}</CardDescription>
                            </CardHeader>
                            <CardContent className="min-h-0 pl-2">
                                {overviewChartData.length > 0 ? (
                                    <div className="h-[220px] w-full sm:h-[260px] md:h-[280px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart
                                                data={overviewChartData}
                                                margin={{ top: 8, right: 8, left: 4, bottom: 4 }}
                                            >
                                            <defs>
                                                <linearGradient id="colorCosts" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.8} />
                                                    <stop offset="50%" stopColor="#10b981" stopOpacity={0.4} />
                                                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                            <YAxis
                                                stroke="#888888"
                                                fontSize={12}
                                                tickLine={false}
                                                axisLine={false}
                                                tickFormatter={(value) => `$${Number(value).toFixed(6)}`}
                                            />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                                itemStyle={{ color: 'hsl(var(--foreground))' }}
                                                formatter={(value: any) => [`$${Number(value).toFixed(6)}`, t('overview.costs.tooltip')]}
                                            />
                                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                                            <Area
                                                type="linear"
                                                dataKey="cost"
                                                stroke="#10b981"
                                                fillOpacity={1}
                                                fill="url(#colorCosts)"
                                                strokeWidth={2}
                                                isAnimationActive={false}
                                                connectNulls={false}
                                                dot={{
                                                    r: 3,
                                                    fill: theme === 'dark' ? '#0c1222' : '#ffffff',
                                                    stroke: '#10b981',
                                                    strokeWidth: 2,
                                                }}
                                                activeDot={{ r: 5, fill: '#059669', stroke: '#ffffff', strokeWidth: 2 }}
                                            />
                                        </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : (
                                    <div className="flex h-[220px] items-center justify-center text-muted-foreground sm:h-[260px]">
                                        <p>{t('overview.costs.empty')}</p>
                                    </div>
                                )}
                            </CardContent>
                            <CardFooter className="border-t bg-muted/20 px-6 py-3 text-xs leading-relaxed text-muted-foreground">
                                {t('overview.costs.footer', { defaultValue: 'Ajuda a comparar gasto estimado com volume; investigue aumentos sem crescimento proporcional.' })}
                            </CardFooter>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="agents" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-1">
                        <Card className="overflow-hidden" style={metricCardStyle}>
                            <CardHeader>
                                <CardTitle className="text-lg font-black tracking-tight">{t('agents.title')}</CardTitle>
                                <CardDescription>{t('agents.description')}</CardDescription>
                            </CardHeader>
                            <CardContent className="max-h-[360px] overflow-y-auto pr-2">
                                {agentsData.length > 0 ? (
                                    <div className="space-y-4">
                                        {agentsData.map((agent, index) => (
                                            <AgentPerformanceItem key={index} agent={agent} index={index} />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex h-[260px] items-center justify-center text-muted-foreground">
                                        <p>{t('agents.empty')}</p>
                                    </div>
                                )}
                            </CardContent>
                            <CardFooter className="border-t bg-muted/20 px-6 py-3 text-xs leading-relaxed text-muted-foreground">
                                {t('agents.footer', { defaultValue: 'Lista os agentes por confiança média; pontuações baixas indicam necessidade de revisão de prompt, base ou fluxo.' })}
                            </CardFooter>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="channels" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                        {/* Donut Chart */}
                        <Card className="overflow-hidden md:col-span-2" style={metricCardStyle}>
                            <CardHeader>
                                <CardTitle className="text-lg font-black tracking-tight">{t('channels.distribution.title')}</CardTitle>
                                <CardDescription>
                                    {t('channels.distribution.description', {
                                        defaultValue:
                                            'Volume de decisões do agente agrupadas pelo identificador salvo no campo channel (ex.: whatsapp, whatsapp_audio, webchat). Não é quantidade de agentes.',
                                    })}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex justify-center items-center relative">
                                {channelsData.length > 0 ? (
                                    <div className="relative flex h-[280px] w-full items-center justify-center">
                                        {/* Atrás do SVG: buraco do donut é transparente; pointer-events-none não bloqueia o hover nas fatias */}
                                        <div className="pointer-events-none absolute inset-0 z-0 flex flex-col items-center justify-center">
                                            <p
                                                className="text-5xl font-black leading-none"
                                                style={{
                                                    color: theme === 'dark' ? '#fafafa' : '#0f172a',
                                                }}
                                            >
                                                {channelDecisionsTotal}
                                            </p>
                                            <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                                                {t('channels.total', {
                                                    defaultValue: 'Decisões (soma)',
                                                })}
                                            </p>
                                        </div>
                                        <div className="relative z-10 h-full w-full min-h-[280px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={channelsData}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={64}
                                                        outerRadius={104}
                                                        paddingAngle={3}
                                                        dataKey="value"
                                                    >
                                                        {channelsData.map((entry, index) => {
                                                            const config = getChannelConfig(entry.name)
                                                            return (
                                                                <Cell key={`cell-${index}`} fill={config.color} />
                                                            )
                                                        })}
                                                    </Pie>
                                                    <Tooltip
                                                        wrapperStyle={{ zIndex: 100 }}
                                                        content={({ active, payload }) => {
                                                            if (active && payload && payload[0]) {
                                                                const data = payload[0].payload as any
                                                                const config = getChannelConfig(data.name)
                                                                const Icon = config.icon
                                                                const percentage =
                                                                    channelDecisionsTotal > 0
                                                                        ? ((data.value / channelDecisionsTotal) * 100).toFixed(1)
                                                                        : '0'
                                                                return (
                                                                    <div
                                                                        className="flex max-w-xs flex-col gap-1 rounded-xl px-3 py-2.5 text-left text-xs font-medium text-white shadow-xl"
                                                                        style={{
                                                                            backgroundColor: '#18181b',
                                                                            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
                                                                        }}
                                                                    >
                                                                        <div className="flex items-center gap-2 font-semibold">
                                                                            <Icon className="h-4 w-4 shrink-0" style={{ color: config.color }} />
                                                                            <span>{config.label}</span>
                                                                        </div>
                                                                        <p className="pl-6 font-mono text-[11px] font-normal text-neutral-400 opacity-95">
                                                                            {data.name}
                                                                        </p>
                                                                        <p className="pl-6 text-[11px] font-normal text-neutral-300 opacity-95">
                                                                            {data.value} · {percentage}%
                                                                            <span className="text-neutral-500">
                                                                                {' · '}
                                                                                {t('channels.legend.decisions', {
                                                                                    defaultValue: 'decisões',
                                                                                })}
                                                                            </span>
                                                                        </p>
                                                                    </div>
                                                                )
                                                            }
                                                            return null
                                                        }}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex h-[280px] items-center justify-center text-muted-foreground">
                                        <p>{t('channels.distribution.empty')}</p>
                                    </div>
                                )}
                            </CardContent>
                            <CardFooter className="border-t bg-muted/20 px-6 py-3 text-xs leading-relaxed text-muted-foreground">
                                {t('channels.distribution.footer', {
                                    defaultValue:
                                        'Cada fatia = decisões da IA agrupadas pelo identificador de canal gravado ao processar cada interação.'
                                })}
                            </CardFooter>
                        </Card>
                        
                        {/* Legenda com Ícones */}
                        <Card className="overflow-hidden md:col-span-1" style={metricCardStyle}>
                            <CardHeader>
                                <CardTitle className="text-lg font-black tracking-tight">{t('channels.legend.title')}</CardTitle>
                                <CardDescription>
                                    {t('channels.legend.description', {
                                        defaultValue:
                                            'Lista o nome amigável, o código usado pelo sistema e quantas decisões da IA foram contabilizadas em cada grupo.'
                                    })}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {channelsData.length > 0 ? (
                                    <div className="space-y-3">
                                        {channelsData.map((entry, index) => {
                                            const config = getChannelConfig(entry.name)
                                            const Icon = config.icon
                                            const percentage =
                                                channelDecisionsTotal > 0
                                                    ? ((entry.value / channelDecisionsTotal) * 100).toFixed(1)
                                                    : '0'
                                            const hint = channelTechnicalHint(entry.name)
                                            return (
                                                <div
                                                    key={`${entry.name}-${index}`}
                                                    className="flex items-stretch gap-3 rounded-lg border border-border bg-muted/30 p-3 transition-colors hover:bg-muted/50 dark:bg-muted/20 dark:hover:bg-muted/35"
                                                    style={{
                                                        borderLeftWidth: 4,
                                                        borderLeftColor: config.color
                                                    }}
                                                >
                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
                                                        <Icon className="h-5 w-5" style={{ color: config.color }} strokeWidth={2.5} />
                                                    </div>
                                                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                                                        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                                                            <span className="font-semibold text-foreground">{config.label}</span>
                                                            <span className="shrink-0 tabular-nums text-sm font-bold text-foreground">
                                                                {entry.value}{' '}
                                                                <span className="text-xs font-semibold text-muted-foreground">
                                                                    ({percentage}%)
                                                                </span>
                                                            </span>
                                                        </div>
                                                        <p className="font-mono text-xs text-foreground">{entry.name}</p>
                                                        <p className="text-[11px] leading-snug text-muted-foreground">
                                                            {hint
                                                                ? hint
                                                                : t('channels.legend.genericHint', {
                                                                      defaultValue:
                                                                          'Este é o identificador exato do campo de canal salvado junto das decisões; cada valor distinto aparece como uma linha.'
                                                                  })}
                                                        </p>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                                        <p className="text-sm">{t('channels.legend.empty')}</p>
                                    </div>
                                )}
                            </CardContent>
                            <CardFooter className="border-t bg-muted/20 px-6 py-3 text-xs leading-relaxed text-muted-foreground">
                                {t('channels.legend.footer', {
                                    defaultValue:
                                        'O total no gráfico é a soma das decisões de todos os grupos; percentuais mostram o peso de cada identificador de canal.'
                                })}
                            </CardFooter>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
