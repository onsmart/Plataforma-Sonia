import React, { useEffect, useState } from "react"
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
    Users,
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
import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import { useTranslation } from "react-i18next"
import i18n from "../i18n/config"

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
    
    const handleMouseMove = (e: React.MouseEvent) => {
        setTooltipPos({ x: e.clientX, y: e.clientY })
    }
    
    return (
        <div 
            className="relative flex items-center gap-4 py-2"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => {
                setShowTooltip(false)
                setTooltipPos(null)
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
                    <p className="font-semibold text-sm text-slate-900 truncate">{agent.name}</p>
                    <p className="text-xs text-slate-500">{color.label}</p>
                </div>
            </div>
            
            {/* Barra de Progresso no centro */}
            <div className="flex-1 relative h-8 bg-slate-100 rounded-full overflow-hidden shadow-inner">
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
                <p className="font-black text-lg text-slate-900">{score.toFixed(1)}%</p>
            </div>
            
            {/* Tooltip Premium - Segue o mouse */}
            {showTooltip && tooltipPos && (
                <div 
                    className="fixed flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold shadow-xl pointer-events-none z-50"
                    style={{
                        left: `${tooltipPos.x}px`,
                        top: `${tooltipPos.y - 50}px`,
                        transform: 'translateX(-50%)',
                        backgroundColor: '#0f172a',
                        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)'
                    }}
                >
                    <Sparkles className="h-4 w-4" style={{ color: '#fbbf24' }} />
                    <span>{t('agents.tooltip', { score: score.toFixed(1) })}</span>
                </div>
            )}
        </div>
    )
}

export function Insights() {
    const { t } = useTranslation('insights')
    const [data, setData] = useState<InsightsData | null>(null)
    const [previousPeriodData, setPreviousPeriodData] = useState<InsightsData['summary'] | null>(null)
    const [loading, setLoading] = useState(true)
    const [period, setPeriod] = useState<string>('7d')
    const [activeTab, setActiveTab] = useState<string>('overview')
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
                    supabase.rpc('sp_get_analytics_summary_by_email', { p_email: user.email, p_days: days })
                ])

                const overview = (overviewResult.data && Array.isArray(overviewResult.data)) ? overviewResult.data : []
                const channels = (channelsResult.data && Array.isArray(channelsResult.data)) ? channelsResult.data : []
                const agents = (agentPerformanceResult.data && Array.isArray(agentPerformanceResult.data)) ? agentPerformanceResult.data : []
                const summary = (summaryResult.data && Array.isArray(summaryResult.data) && summaryResult.data.length > 0)
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
                
                if (previousOverviewResult.data && Array.isArray(previousOverviewResult.data) && previousOverviewResult.data.length > 0) {
                    // Ordenar por data (mais antiga primeiro)
                    const sortedData = [...previousOverviewResult.data].sort((a: any, b: any) => 
                        new Date(a.date).getTime() - new Date(b.date).getTime()
                    )
                    
                    // Separar: primeiros N dias = período anterior, últimos N dias = período atual
                    const previousPeriodData = sortedData.slice(0, days)
                    const currentPeriodData = sortedData.slice(days)
                    
                    // Calcular métricas do período anterior
                    const prevInteractions = previousPeriodData.reduce((acc: number, curr: any) => acc + (curr.conversations || 0), 0)
                    const prevCost = previousPeriodData.reduce((acc: number, curr: any) => acc + (Number(curr.cost) || 0), 0)
                    
                    // Buscar summary do período anterior (para RAG e channels)
                    const previousSummaryResult = await supabase.rpc('sp_get_analytics_summary_by_email', { 
                        p_email: user.email, 
                        p_days: days * 2 
                    })
                    
                    // Calcular summary do período anterior baseado nos dados de overview
                    previousPeriodSummary = {
                        total_interactions: prevInteractions,
                        total_cost: prevCost,
                        active_channels: summary.active_channels, // Mantém o mesmo (não muda muito entre períodos)
                        total_tokens: 0, // Não temos como calcular facilmente sem dados detalhados
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

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    const overviewData = data?.overview || []
    const channelsData = data?.channels || []
    
    // Função para obter cor, ícone e configuração por canal
    const getChannelConfig = (channelName: string) => {
        const name = channelName.toLowerCase()
        if (name.includes('whatsapp') || name.includes('whats')) {
            return {
                color: '#10b981',
                bgColor: '#ecfdf5',
                icon: MessageCircle,
                label: t('channels.label.whatsapp')
            }
        }
        if (name.includes('webchat') || name.includes('web') || name.includes('widget')) {
            return {
                color: '#2563eb',
                bgColor: '#eff6ff',
                icon: MessageSquare,
                label: t('channels.label.webchat')
            }
        }
        if (name.includes('email') || name.includes('mail')) {
            return {
                color: '#f59e0b',
                bgColor: '#fffbeb',
                icon: Mail,
                label: t('channels.label.email')
            }
        }
        if (name.includes('linkedin')) {
            return {
                color: '#6366f1',
                bgColor: '#eef2ff',
                icon: Linkedin,
                label: t('channels.label.linkedin')
            }
        }
        if (name.includes('phone') || name.includes('voice') || name.includes('voip') || name.includes('telefone')) {
            return {
                color: '#ec4899',
                bgColor: '#fdf2f8',
                icon: Phone,
                label: t('channels.label.phone')
            }
        }
        // Default
        return {
            color: '#64748b',
            bgColor: '#f1f5f9',
            icon: Globe,
            label: channelName
        }
    }
    
    // Calcular total de agentes
    const totalAgents = channelsData.reduce((acc, curr) => acc + curr.value, 0)
    
    const agentsData = data?.agents?.map(a => ({ name: a.agent_name, score: Number(a.avg_confidence) * 100 })) || [] // Process agents data
    const summary = data?.summary || {
        total_interactions: 0,
        total_cost: 0,
        active_channels: 0,
        total_tokens: 0,
        rag_usage_count: 0,
        rag_usage_rate: 0
    }

    const totalInteractions = summary.total_interactions || overviewData.reduce((acc, curr) => acc + (curr.conversations || 0), 0)
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
    const channelsTrend = calculateTrend(activeChannels, previousPeriodData?.active_channels || null)
    const ragTrend = calculateTrend(ragUsageRate, previousPeriodData?.rag_usage_rate || null)

    // Export functions remains roughly same, can add agents tab logic if needed but user just wants visual merge
    const exportToExcel = () => {
        if (!data) {
            toast.error(t('export.error.noData'))
            return
        }
        try {
            const workbook = (XLSX.utils as any).book_new()

            // Overview
            const overviewSheet = (XLSX.utils as any).json_to_sheet(data.overview.map(item => ({
                [t('excel.overview.date')]: item.date, 
                [t('excel.overview.interactions')]: item.conversations, 
                [t('excel.overview.cost')]: item.cost.toFixed(6)
            })))
                ; (XLSX.utils as any).book_append_sheet(workbook, overviewSheet, t('tabs.overview'))

            // Channels
            const channelsSheet = (XLSX.utils as any).json_to_sheet(data.channels.map(item => ({
                [t('excel.channels.channel')]: item.name, 
                [t('excel.channels.quantity')]: item.value
            })))
                ; (XLSX.utils as any).book_append_sheet(workbook, channelsSheet, t('tabs.channels'))

            // Agents
            const agentsSheet = (XLSX.utils as any).json_to_sheet(data.agents.map(item => ({
                [t('excel.agents.agent')]: item.agent_name, 
                [t('excel.agents.confidence')]: (Number(item.avg_confidence) * 100).toFixed(2)
            })))
                ; (XLSX.utils as any).book_append_sheet(workbook, agentsSheet, t('tabs.agents'))

            // Summary
            const summarySheet = (XLSX.utils as any).json_to_sheet([
                { [t('excel.summary.metric')]: t('excel.summary.totalInteractions'), [t('excel.summary.value')]: data.summary.total_interactions },
                { [t('excel.summary.metric')]: t('excel.summary.totalCost'), [t('excel.summary.value')]: data.summary.total_cost.toFixed(6) },
                { [t('excel.summary.metric')]: t('excel.summary.activeChannels'), [t('excel.summary.value')]: data.summary.active_channels },
                { [t('excel.summary.metric')]: t('excel.summary.ragUsage'), [t('excel.summary.value')]: `${data.summary.rag_usage_count} (${data.summary.rag_usage_rate.toFixed(2)}%)` }
            ])
                ; (XLSX.utils as any).book_append_sheet(workbook, summarySheet, t('pdf.summary.title'))

            const fileName = `Insights_${period}_${new Date().toISOString().split('T')[0]}.xlsx`
                ; (XLSX as any).writeFile(workbook, fileName)
            toast.success(t('export.success.excel', { fileName }))
        } catch (error: any) {
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

    return (
        <div className="space-y-6 animate-in fade-in duration-500 bg-[#F8FAFC] min-h-screen -m-4 p-8">
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

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card 
                    className="shadow-lg transition-all cursor-pointer"
                    style={{
                        border: '2px solid rgba(6, 182, 212, 0.3)',
                        borderRadius: '1rem'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.6)'
                        e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(6, 182, 212, 0.2), 0 4px 6px -2px rgba(6, 182, 212, 0.1)'
                        e.currentTarget.style.transform = 'translateY(-2px)'
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.3)'
                        e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
                        e.currentTarget.style.transform = 'translateY(0)'
                    }}
                >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            {t('kpi.totalInteractions')}
                        </CardTitle>
                        <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#eff6ff', borderRadius: '12px' }}>
                            <MessageSquare className="h-5 w-5" strokeWidth={2.5} style={{ color: '#2563eb' }} />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalInteractions.toLocaleString()}</div>
                        {interactionsTrend.hasData ? (
                            <div className="flex items-center gap-1.5 mt-2">
                                {interactionsTrend.isPositive ? (
                                    <div className="flex items-center gap-1 text-emerald-600">
                                        <ArrowUp className="h-3.5 w-3.5" />
                                        <span className="text-xs font-semibold">{interactionsTrend.value.toFixed(1)}%</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1 text-red-600">
                                        <ArrowDown className="h-3.5 w-3.5" />
                                        <span className="text-xs font-semibold">{interactionsTrend.value.toFixed(1)}%</span>
                                    </div>
                                )}
                                <span className="text-xs text-muted-foreground">{t('kpi.trend.relative')}</span>
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground mt-2">{t('kpi.trend.insufficient')}</p>
                        )}
                    </CardContent>
                </Card>
                <Card 
                    className="shadow-lg transition-all cursor-pointer"
                    style={{
                        border: '2px solid rgba(6, 182, 212, 0.3)',
                        borderRadius: '1rem'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.6)'
                        e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(6, 182, 212, 0.2), 0 4px 6px -2px rgba(6, 182, 212, 0.1)'
                        e.currentTarget.style.transform = 'translateY(-2px)'
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.3)'
                        e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
                        e.currentTarget.style.transform = 'translateY(0)'
                    }}
                >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t('kpi.tokenCost')}</CardTitle>
                        <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#ecfdf5', borderRadius: '12px' }}>
                            <DollarSign className="h-5 w-5" strokeWidth={2.5} style={{ color: '#10b981' }} />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            ${totalCost > 0 ? totalCost.toFixed(6) : '0.000000'}
                        </div>
                        {costTrend.hasData ? (
                            <div className="flex items-center gap-1.5 mt-2">
                                {costTrend.isPositive ? (
                                    <div className="flex items-center gap-1 text-red-600">
                                        <ArrowUp className="h-3.5 w-3.5" />
                                        <span className="text-xs font-semibold">{costTrend.value.toFixed(1)}%</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1 text-emerald-600">
                                        <ArrowDown className="h-3.5 w-3.5" />
                                        <span className="text-xs font-semibold">{costTrend.value.toFixed(1)}%</span>
                                    </div>
                                )}
                                <span className="text-xs text-muted-foreground">{t('kpi.trend.relative')}</span>
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground mt-2">{t('kpi.trend.insufficient')}</p>
                        )}
                    </CardContent>
                </Card>
                <Card 
                    className="shadow-lg transition-all cursor-pointer"
                    style={{
                        border: '2px solid rgba(6, 182, 212, 0.3)',
                        borderRadius: '1rem'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.6)'
                        e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(6, 182, 212, 0.2), 0 4px 6px -2px rgba(6, 182, 212, 0.1)'
                        e.currentTarget.style.transform = 'translateY(-2px)'
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.3)'
                        e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
                        e.currentTarget.style.transform = 'translateY(0)'
                    }}
                >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t('kpi.activeChannels')}</CardTitle>
                        <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#eef2ff', borderRadius: '12px' }}>
                            <Target className="h-5 w-5" strokeWidth={2.5} style={{ color: '#4f46e5' }} />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{activeChannels}</div>
                        {channelsTrend.hasData ? (
                            <div className="flex items-center gap-1.5 mt-2">
                                {channelsTrend.isPositive ? (
                                    <div className="flex items-center gap-1 text-emerald-600">
                                        <ArrowUp className="h-3.5 w-3.5" />
                                        <span className="text-xs font-semibold">{channelsTrend.value.toFixed(1)}%</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1 text-red-600">
                                        <ArrowDown className="h-3.5 w-3.5" />
                                        <span className="text-xs font-semibold">{channelsTrend.value.toFixed(1)}%</span>
                                    </div>
                                )}
                                <span className="text-xs text-muted-foreground">{t('kpi.trend.relative')}</span>
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground mt-2">{t('kpi.trend.insufficient')}</p>
                        )}
                    </CardContent>
                </Card>
                <Card 
                    className="shadow-lg transition-all cursor-pointer"
                    style={{
                        border: '2px solid rgba(6, 182, 212, 0.3)',
                        borderRadius: '1rem'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.6)'
                        e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(6, 182, 212, 0.2), 0 4px 6px -2px rgba(6, 182, 212, 0.1)'
                        e.currentTarget.style.transform = 'translateY(-2px)'
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.3)'
                        e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
                        e.currentTarget.style.transform = 'translateY(0)'
                    }}
                >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t('kpi.ragUsage')}</CardTitle>
                        <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#faf5ff', borderRadius: '12px' }}>
                            <Brain className="h-5 w-5" strokeWidth={2.5} style={{ color: '#9333ea' }} />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{ragUsageRate.toFixed(1)}%</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {t('kpi.rag.agents', { count: summary.rag_usage_count })}
                        </p>
                        {ragTrend.hasData ? (
                            <div className="flex items-center gap-1.5 mt-2">
                                {ragTrend.isPositive ? (
                                    <div className="flex items-center gap-1 text-emerald-600">
                                        <ArrowUp className="h-3.5 w-3.5" />
                                        <span className="text-xs font-semibold">{ragTrend.value.toFixed(1)}%</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1 text-red-600">
                                        <ArrowDown className="h-3.5 w-3.5" />
                                        <span className="text-xs font-semibold">{ragTrend.value.toFixed(1)}%</span>
                                    </div>
                                )}
                                <span className="text-xs text-muted-foreground">{t('kpi.trend.relative')}</span>
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground mt-2">{t('kpi.trend.insufficient')}</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="bg-slate-100 p-1.5 rounded-full flex w-fit border-none shadow-inner outline-none">
                    <TabsTrigger
                        value="overview"
                        className="rounded-full font-black text-[11px] uppercase tracking-wider px-6 h-10 transition-all border-none outline-none ring-0"
                        style={{
                            backgroundColor: activeTab === 'overview' ? '#06b6d4' : 'transparent',
                            color: activeTab === 'overview' ? '#ffffff' : '#64748b',
                            borderRadius: '9999px',
                            fontWeight: '900',
                            fontSize: '11px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            paddingLeft: '24px',
                            paddingRight: '24px',
                            height: '40px',
                            border: 'none',
                            outline: 'none',
                            transition: 'all 0.2s',
                            boxShadow: activeTab === 'overview' ? '0 10px 15px -3px rgba(6, 182, 212, 0.2), 0 4px 6px -2px rgba(6, 182, 212, 0.1)' : 'none'
                        }}
                    >
                        {t('tabs.overview')}
                    </TabsTrigger>
                    <TabsTrigger
                        value="agents"
                        className="rounded-full font-black text-[11px] uppercase tracking-wider px-6 h-10 transition-all border-none outline-none ring-0"
                        style={{
                            backgroundColor: activeTab === 'agents' ? '#06b6d4' : 'transparent',
                            color: activeTab === 'agents' ? '#ffffff' : '#64748b',
                            borderRadius: '9999px',
                            fontWeight: '900',
                            fontSize: '11px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            paddingLeft: '24px',
                            paddingRight: '24px',
                            height: '40px',
                            border: 'none',
                            outline: 'none',
                            transition: 'all 0.2s',
                            boxShadow: activeTab === 'agents' ? '0 10px 15px -3px rgba(6, 182, 212, 0.2), 0 4px 6px -2px rgba(6, 182, 212, 0.1)' : 'none'
                        }}
                    >
                        {t('tabs.agents')}
                    </TabsTrigger>
                    <TabsTrigger
                        value="channels"
                        className="rounded-full font-black text-[11px] uppercase tracking-wider px-6 h-10 transition-all border-none outline-none ring-0"
                        style={{
                            backgroundColor: activeTab === 'channels' ? '#06b6d4' : 'transparent',
                            color: activeTab === 'channels' ? '#ffffff' : '#64748b',
                            borderRadius: '9999px',
                            fontWeight: '900',
                            fontSize: '11px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            paddingLeft: '24px',
                            paddingRight: '24px',
                            height: '40px',
                            border: 'none',
                            outline: 'none',
                            transition: 'all 0.2s',
                            boxShadow: activeTab === 'channels' ? '0 10px 15px -3px rgba(6, 182, 212, 0.2), 0 4px 6px -2px rgba(6, 182, 212, 0.1)' : 'none'
                        }}
                    >
                        {t('tabs.channels')}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-1">
                        <Card>
                            <CardHeader>
                                <CardTitle className="font-black text-xl tracking-tight">{t('overview.title')}</CardTitle>
                                <CardDescription>{t('overview.description')}</CardDescription>
                            </CardHeader>
                            <CardContent className="pl-2">
                                {overviewData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={350}>
                                        <AreaChart data={overviewData}>
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
                                                type="basis" 
                                                dataKey="conversations" 
                                                stroke="#3b82f6" 
                                                fillOpacity={1} 
                                                fill="url(#colorInteractions)" 
                                                strokeWidth={3}
                                                dot={{ fill: 'transparent', stroke: '#3b82f6', strokeWidth: 2, r: 2 }}
                                                activeDot={{ r: 4, fill: '#2563eb', stroke: '#ffffff', strokeWidth: 2 }}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex items-center justify-center h-[350px] text-muted-foreground">
                                        <p>{t('overview.empty')}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                        
                        <Card>
                            <CardHeader>
                                <CardTitle className="font-black text-xl tracking-tight">{t('overview.costs.title')}</CardTitle>
                                <CardDescription>{t('overview.costs.description')}</CardDescription>
                            </CardHeader>
                            <CardContent className="pl-2">
                                {overviewData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={350}>
                                        <AreaChart data={overviewData}>
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
                                                tickFormatter={(value) => `$${value.toFixed(6)}`} 
                                            />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                                itemStyle={{ color: 'hsl(var(--foreground))' }}
                                                formatter={(value: any) => [`$${Number(value).toFixed(6)}`, t('overview.costs.tooltip')]}
                                            />
                                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                                            <Area 
                                                type="basis" 
                                                dataKey="cost" 
                                                stroke="#10b981" 
                                                fillOpacity={1} 
                                                fill="url(#colorCosts)" 
                                                strokeWidth={3}
                                                dot={{ fill: 'transparent', stroke: '#10b981', strokeWidth: 2, r: 2 }}
                                                activeDot={{ r: 4, fill: '#059669', stroke: '#ffffff', strokeWidth: 2 }}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex items-center justify-center h-[350px] text-muted-foreground">
                                        <p>{t('overview.costs.empty')}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="agents" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-1">
                        <Card>
                            <CardHeader>
                                <CardTitle className="font-black text-xl tracking-tight">{t('agents.title')}</CardTitle>
                                <CardDescription>{t('agents.description')}</CardDescription>
                            </CardHeader>
                            <CardContent className="max-h-[500px] overflow-y-auto pr-2">
                                {agentsData.length > 0 ? (
                                    <div className="space-y-4">
                                        {agentsData.map((agent, index) => (
                                            <AgentPerformanceItem key={index} agent={agent} index={index} />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center h-[350px] text-muted-foreground">
                                        <p>{t('agents.empty')}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="channels" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                        {/* Donut Chart */}
                        <Card className="col-span-2">
                            <CardHeader>
                                <CardTitle className="font-black text-xl tracking-tight">{t('channels.distribution.title')}</CardTitle>
                                <CardDescription>{t('channels.distribution.description')}</CardDescription>
                            </CardHeader>
                            <CardContent className="flex justify-center items-center relative">
                                {channelsData.length > 0 ? (
                                    <div className="relative w-full h-[350px] flex items-center justify-center">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={channelsData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={80}
                                                    outerRadius={120}
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
                                                    content={({ active, payload }) => {
                                                        if (active && payload && payload[0]) {
                                                            const data = payload[0].payload as any
                                                            const config = getChannelConfig(data.name)
                                                            const Icon = config.icon
                                                            const percentage = totalAgents > 0 ? ((data.value / totalAgents) * 100).toFixed(1) : '0'
                                                            return (
                                                                <div 
                                                                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold shadow-xl"
                                                                    style={{
                                                                        backgroundColor: '#0f172a',
                                                                        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)'
                                                                    }}
                                                                >
                                                                    <Icon className="h-4 w-4" style={{ color: config.color }} />
                                                                    <span>{config.label}: {data.value} ({percentage}%)</span>
                                                                </div>
                                                            )
                                                        }
                                                        return null
                                                    }}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        {/* Número total no centro */}
                                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                            <p className="text-5xl font-black text-slate-900 leading-none">{totalAgents}</p>
                                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mt-2">{t('channels.total')}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center h-[350px] text-muted-foreground">
                                        <p>{t('channels.distribution.empty')}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                        
                        {/* Legenda com Ícones */}
                        <Card className="col-span-1">
                            <CardHeader>
                                <CardTitle className="font-black text-xl tracking-tight">{t('channels.legend.title')}</CardTitle>
                                <CardDescription>{t('channels.legend.description')}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {channelsData.length > 0 ? (
                                    <div className="space-y-3">
                                        {channelsData.map((entry, index) => {
                                            const config = getChannelConfig(entry.name)
                                            const Icon = config.icon
                                            const percentage = totalAgents > 0 ? ((entry.value / totalAgents) * 100).toFixed(1) : '0'
                                            return (
                                                <div 
                                                    key={index} 
                                                    className="flex items-center gap-3 p-4 border-2 border-transparent transition-all cursor-pointer"
                                                    style={{
                                                        backgroundColor: config.bgColor,
                                                        borderColor: 'transparent',
                                                        borderRadius: '2.5rem'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.borderColor = config.color + '40'
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.borderColor = 'transparent'
                                                    }}
                                                >
                                                    <div 
                                                        className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                                                        style={{ backgroundColor: config.bgColor }}
                                                    >
                                                        <Icon className="h-5 w-5" style={{ color: config.color }} strokeWidth={2.5} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-sm text-slate-900">{config.label}</p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <p className="text-xs font-semibold text-slate-600">{entry.value}</p>
                                                            <p className="text-xs text-slate-400">•</p>
                                                            <p className="text-xs text-slate-500">{percentage}%</p>
                                                        </div>
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
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
