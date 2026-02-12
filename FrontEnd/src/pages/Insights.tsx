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
    Users,
    MessageSquare,
    Phone,
    DollarSign,
    Calendar,
    Download,
    Globe,
    Target,
    Loader2,
    FileSpreadsheet,
    FileText
} from "lucide-react"
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

export function Insights() {
    const [data, setData] = useState<InsightsData | null>(null)
    const [loading, setLoading] = useState(true)
    const [period, setPeriod] = useState<string>('7d')
    const { user } = useAuth()

    useEffect(() => {
        const load = async () => {
            if (!user?.email) {
                console.log("[Insights] Usuário não encontrado, aguardando...")
                return
            }

            try {
                setLoading(true)

                const days = period === '7d' ? 7 : period === '30d' ? 30 : 7

                // Buscar dados do Supabase
                const [overviewResult, channelsResult, agentPerformanceResult, summaryResult] = await Promise.all([
                    supabase.rpc('sp_get_analytics_overview_by_email', { p_email: user.email, p_days: days }),
                    supabase.rpc('sp_get_analytics_channel_distribution_by_email', { p_email: user.email, p_days: days }),
                    supabase.rpc('sp_get_analytics_agent_performance_by_email', { p_email: user.email, p_days: days }), // Added agent performance fetch
                    supabase.rpc('sp_get_analytics_summary_by_email', { p_email: user.email, p_days: days })
                ])

                const overview = (overviewResult.data && Array.isArray(overviewResult.data)) ? overviewResult.data : []
                const channels = (channelsResult.data && Array.isArray(channelsResult.data)) ? channelsResult.data : []
                const agents = (agentPerformanceResult.data && Array.isArray(agentPerformanceResult.data)) ? agentPerformanceResult.data : [] // Added agents processing
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

                setData({
                    overview,
                    channels,
                    agents, // Added agents to state
                    summary
                })
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

    // Export functions remains roughly same, can add agents tab logic if needed but user just wants visual merge
    const exportToExcel = () => {
        if (!data) {
            toast.error("Nenhum dado disponível para exportar")
            return
        }
        try {
            const workbook = (XLSX.utils as any).book_new()

            // Overview
            const overviewSheet = (XLSX.utils as any).json_to_sheet(data.overview.map(item => ({
                'Data': item.date, 'Interações': item.conversations, 'Custo (USD)': item.cost.toFixed(6)
            })))
                ; (XLSX.utils as any).book_append_sheet(workbook, overviewSheet, 'Overview')

            // Channels
            const channelsSheet = (XLSX.utils as any).json_to_sheet(data.channels.map(item => ({
                'Canal': item.name, 'Quantidade': item.value
            })))
                ; (XLSX.utils as any).book_append_sheet(workbook, channelsSheet, 'Canais')

            // Agents (NEW)
            const agentsSheet = (XLSX.utils as any).json_to_sheet(data.agents.map(item => ({
                'Agente': item.agent_name, 'Confiança Média (%)': (Number(item.avg_confidence) * 100).toFixed(2)
            })))
                ; (XLSX.utils as any).book_append_sheet(workbook, agentsSheet, 'Performance Agentes')

            // Summary
            const summarySheet = (XLSX.utils as any).json_to_sheet([
                { 'Métrica': 'Total de Interações', 'Valor': data.summary.total_interactions },
                { 'Métrica': 'Custo Total (USD)', 'Valor': data.summary.total_cost.toFixed(6) },
                { 'Métrica': 'Canais Ativos', 'Valor': data.summary.active_channels },
                { 'Métrica': 'Uso de RAG', 'Valor': `${data.summary.rag_usage_count} (${data.summary.rag_usage_rate.toFixed(2)}%)` }
            ])
                ; (XLSX.utils as any).book_append_sheet(workbook, summarySheet, 'Resumo')

            const fileName = `Insights_${period}_${new Date().toISOString().split('T')[0]}.xlsx`
                ; (XLSX as any).writeFile(workbook, fileName)
            toast.success(`Relatório Excel exportado: ${fileName}`)
        } catch (error: any) {
            toast.error("Erro ao exportar Excel")
        }
    }

    const exportToPDF = async () => {
        // Keeping PDF export simple for now, can be expanded later
        if (!data) return
        toast.info("Funcionalidade de PDF simplificada para esta versão.")
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Insights & Analytics</h2>
                    <p className="text-muted-foreground">
                        Real-time metrics from your AI workforce.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={period} onValueChange={setPeriod}>
                        <SelectTrigger className="w-[180px]">
                            <Calendar className="mr-2 h-4 w-4" />
                            <SelectValue placeholder="Period" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="7d">Last 7 days</SelectItem>
                            <SelectItem value="30d">Last 30 days</SelectItem>
                        </SelectContent>
                    </Select>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" title="Exportar relatório">
                                <Download className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>Exportar Relatório</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={exportToExcel} className="cursor-pointer">
                                <FileSpreadsheet className="mr-2 h-4 w-4" />
                                <span>Exportar para Excel</span>
                            </DropdownMenuItem>
                            {/* PDF temporarily disabled/simplified to save space */}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Total Interactions
                        </CardTitle>
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalInteractions.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground flex items-center mt-1">
                            Live data ({period})
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Est. Token Cost</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            ${totalCost > 0 ? totalCost.toFixed(6) : '0.000000'}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Estimated
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Channels</CardTitle>
                        <Target className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{activeChannels}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Deployed endpoints
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">RAG Usage Rate</CardTitle>
                        <Globe className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{ragUsageRate.toFixed(1)}%</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {summary.rag_usage_count} arquivos consultados
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="overview" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="agents">Agent Performance</TabsTrigger>
                    <TabsTrigger value="channels">Channels</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-1">
                        <Card>
                            <CardHeader>
                                <CardTitle>Interaction Volume Trend</CardTitle>
                                <CardDescription>Daily active sessions.</CardDescription>
                            </CardHeader>
                            <CardContent className="pl-2">
                                {overviewData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={350}>
                                        <AreaChart data={overviewData}>
                                            <defs>
                                                <linearGradient id="colorInteractions" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                            <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                                                itemStyle={{ color: 'hsl(var(--foreground))' }}
                                            />
                                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                                            <Area type="monotone" dataKey="conversations" stroke="#3b82f6" fillOpacity={1} fill="url(#colorInteractions)" strokeWidth={2} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex items-center justify-center h-[350px] text-muted-foreground">
                                        <p>Nenhum dado disponível para o período selecionado</p>
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
                                <CardTitle>Agent Confidence Score</CardTitle>
                                <CardDescription>Average AI confidence by agent.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {agentsData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={350}>
                                        <BarChart data={agentsData} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 40 }}>
                                            <XAxis type="number" domain={[0, 100]} hide />
                                            <YAxis
                                                dataKey="name"
                                                type="category"
                                                width={150}
                                                stroke="hsl(var(--muted-foreground))"
                                                fontSize={12}
                                                tickLine={false}
                                                axisLine={false}
                                            />
                                            <Tooltip
                                                cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
                                                contentStyle={{
                                                    backgroundColor: 'hsl(var(--popover))',
                                                    borderColor: 'hsl(var(--border))',
                                                    borderRadius: '8px',
                                                }}
                                                itemStyle={{ color: 'hsl(var(--foreground))' }}
                                            />
                                            <Bar dataKey="score" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={20} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex items-center justify-center h-[350px] text-muted-foreground">
                                        <p>Nenhum dado de agente disponível</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="channels" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <Card className="col-span-1">
                            <CardHeader>
                                <CardTitle>Channel Distribution</CardTitle>
                                <CardDescription>Active agents by channel type.</CardDescription>
                            </CardHeader>
                            <CardContent className="flex justify-center">
                                {channelsData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={300}>
                                        <PieChart>
                                            <Pie
                                                data={channelsData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={90}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {channelsData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={`hsl(${index * 45}, 70%, 50%)`} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                                                itemStyle={{ color: 'hsl(var(--foreground))' }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                                        <p>Nenhum canal encontrado para o período selecionado</p>
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