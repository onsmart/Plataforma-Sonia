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
                console.log("[Insights] ========== INICIANDO CARREGAMENTO ==========")
                console.log("[Insights] Período:", period)
                console.log("[Insights] Email do usuário:", user.email)
                
                const days = period === '7d' ? 7 : period === '30d' ? 30 : 7

                // Buscar dados diretamente do Supabase (como o Cockpit faz)
                const [overviewResult, channelsResult, summaryResult] = await Promise.all([
                    supabase.rpc('sp_get_analytics_overview_by_email', {
                        p_email: user.email,
                        p_days: days
                    }),
                    supabase.rpc('sp_get_analytics_channel_distribution_by_email', {
                        p_email: user.email,
                        p_days: days
                    }),
                    supabase.rpc('sp_get_analytics_summary_by_email', {
                        p_email: user.email,
                        p_days: days
                    })
                ])

                console.log("[Insights] ========== RESULTADOS DAS FUNÇÕES SQL ==========")
                console.log("[Insights] Overview - Error:", overviewResult.error)
                console.log("[Insights] Overview - Data:", overviewResult.data)
                console.log("[Insights] Overview - Length:", overviewResult.data?.length || 0)
                console.log("[Insights] Channels - Error:", channelsResult.error)
                console.log("[Insights] Channels - Data:", channelsResult.data)
                console.log("[Insights] Channels - Length:", channelsResult.data?.length || 0)
                console.log("[Insights] Summary - Error:", summaryResult.error)
                console.log("[Insights] Summary - Data:", summaryResult.data)
                console.log("[Insights] Summary - Length:", summaryResult.data?.length || 0)

                const overview = (overviewResult.data && Array.isArray(overviewResult.data)) ? overviewResult.data : []
                const channels = (channelsResult.data && Array.isArray(channelsResult.data)) ? channelsResult.data : []
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

                console.log("[Insights] ========== DADOS PROCESSADOS ==========")
                console.log("[Insights] Overview processado:", overview.length, "itens")
                console.log("[Insights] Channels processado:", channels.length, "itens")
                console.log("[Insights] Summary processado:", summary)
                console.log("[Insights] =========================================")

                setData({
                    overview,
                    channels,
                    summary
                })
            } catch (e: any) {
                console.error("[Insights] ========== ERRO ==========")
                console.error("[Insights] Erro completo:", e)
                console.error("[Insights] Stack:", e.stack)
            } finally {
                setLoading(false)
                console.log("[Insights] Loading finalizado")
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
    const summary = data?.summary || {
        total_interactions: 0,
        total_cost: 0,
        active_channels: 0,
        total_tokens: 0,
        rag_usage_count: 0,
        rag_usage_rate: 0
    }

    console.log("[Insights] Dados processados:", {
        overviewDataLength: overviewData.length,
        channelsDataLength: channelsData.length,
        summary,
        overviewDataSample: overviewData.slice(0, 2),
        channelsDataSample: channelsData.slice(0, 2)
    })

    // Calculate Totals for KPI Cards (usar summary se disponível)
    const totalInteractions = summary.total_interactions || overviewData.reduce((acc, curr) => acc + (curr.conversations || 0), 0)
    // Garantir que totalCost seja um número e não seja null/undefined
    const totalCost = Number(summary.total_cost) || Number(overviewData.reduce((acc, curr) => acc + (Number(curr.cost) || 0), 0)) || 0
    const activeChannels = summary.active_channels || channelsData.length
    const ragUsageRate = summary.rag_usage_rate || 0
    
    // CSAT Score ainda não disponível
    const csatScore = "N/A"

    // Função para exportar para Excel
    const exportToExcel = () => {
        if (!data) {
            toast.error("Nenhum dado disponível para exportar")
            return
        }

        try {
            const workbook = (XLSX.utils as any).book_new()

            // Aba 1: Overview (Dados Diários)
            const overviewData = data.overview.map(item => ({
                'Data': item.date,
                'Interações': item.conversations,
                'Custo (USD)': item.cost.toFixed(6),
                'Tokens': 0 // Pode ser adicionado se disponível
            }))
            const overviewSheet = (XLSX.utils as any).json_to_sheet(overviewData)
            ;(XLSX.utils as any).book_append_sheet(workbook, overviewSheet, 'Overview Diário')

            // Aba 2: Distribuição por Canal
            const totalChannels = data.channels.reduce((sum, c) => sum + c.value, 0)
            const channelsData = data.channels.map(item => ({
                'Canal': item.name,
                'Quantidade': item.value,
                'Percentual (%)': totalChannels > 0 
                    ? ((item.value / totalChannels) * 100).toFixed(2)
                    : '0.00'
            }))
            const channelsSheet = (XLSX.utils as any).json_to_sheet(channelsData)
            ;(XLSX.utils as any).book_append_sheet(workbook, channelsSheet, 'Canais')

            // Aba 3: Resumo Executivo
            const summaryData = [
                { 'Métrica': 'Total de Interações', 'Valor': data.summary.total_interactions },
                { 'Métrica': 'Custo Total (USD)', 'Valor': data.summary.total_cost.toFixed(6) },
                { 'Métrica': 'Canais Ativos', 'Valor': data.summary.active_channels },
                { 'Métrica': 'Total de Tokens', 'Valor': data.summary.total_tokens },
                { 'Métrica': 'Uso de RAG (Quantidade)', 'Valor': data.summary.rag_usage_count },
                { 'Métrica': 'Taxa de Uso de RAG (%)', 'Valor': data.summary.rag_usage_rate.toFixed(2) },
                { 'Métrica': 'Período', 'Valor': period === '7d' ? 'Últimos 7 dias' : 'Últimos 30 dias' },
                { 'Métrica': 'Data do Relatório', 'Valor': new Date().toLocaleString('pt-BR') }
            ]
            const summarySheet = (XLSX.utils as any).json_to_sheet(summaryData)
            ;(XLSX.utils as any).book_append_sheet(workbook, summarySheet, 'Resumo Executivo')

            // Gerar nome do arquivo
            const fileName = `Insights_${period}_${new Date().toISOString().split('T')[0]}.xlsx`
            
            // Salvar arquivo
            ;(XLSX as any).writeFile(workbook, fileName)
            toast.success(`Relatório Excel exportado: ${fileName}`)
        } catch (error: any) {
            console.error("[Insights] Erro ao exportar Excel:", error)
            toast.error("Erro ao exportar para Excel: " + (error.message || "Erro desconhecido"))
        }
    }

    // Função para exportar para PDF
    const exportToPDF = async () => {
        if (!data) {
            toast.error("Nenhum dado disponível para exportar")
            return
        }

        try {
            toast.info("Gerando PDF... Isso pode levar alguns segundos.")
            
            const pdf = new jsPDF('p', 'mm', 'a4')
            const pageWidth = pdf.internal.pageSize.getWidth()
            const pageHeight = pdf.internal.pageSize.getHeight()
            let yPosition = 20

            // Cabeçalho
            pdf.setFontSize(20)
            pdf.setTextColor(0, 0, 0)
            pdf.text('Insights & Analytics', pageWidth / 2, yPosition, { align: 'center' })
            yPosition += 10

            pdf.setFontSize(12)
            pdf.setTextColor(100, 100, 100)
            pdf.text(`Período: ${period === '7d' ? 'Últimos 7 dias' : 'Últimos 30 dias'}`, pageWidth / 2, yPosition, { align: 'center' })
            yPosition += 5
            pdf.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, pageWidth / 2, yPosition, { align: 'center' })
            yPosition += 15

            // Resumo Executivo
            pdf.setFontSize(16)
            pdf.setTextColor(0, 0, 0)
            pdf.text('Resumo Executivo', 20, yPosition)
            yPosition += 10

            pdf.setFontSize(11)
            const summaryItems = [
                `Total de Interações: ${data.summary.total_interactions.toLocaleString()}`,
                `Custo Total: $${data.summary.total_cost.toFixed(6)}`,
                `Canais Ativos: ${data.summary.active_channels}`,
                `Total de Tokens: ${data.summary.total_tokens.toLocaleString()}`,
                `Uso de RAG: ${data.summary.rag_usage_count} (${data.summary.rag_usage_rate.toFixed(2)}%)`
            ]

            summaryItems.forEach(item => {
                if (yPosition > pageHeight - 20) {
                    pdf.addPage()
                    yPosition = 20
                }
                pdf.text(item, 25, yPosition)
                yPosition += 7
            })

            yPosition += 10

            // Overview (Tabela)
            if (data.overview.length > 0) {
                if (yPosition > pageHeight - 40) {
                    pdf.addPage()
                    yPosition = 20
                }

                pdf.setFontSize(16)
                pdf.text('Overview Diário', 20, yPosition)
                yPosition += 10

                pdf.setFontSize(9)
                // Cabeçalho da tabela
                pdf.setFillColor(240, 240, 240)
                pdf.rect(20, yPosition - 5, pageWidth - 40, 8, 'F')
                pdf.text('Data', 22, yPosition)
                pdf.text('Interações', 60, yPosition)
                pdf.text('Custo (USD)', 100, yPosition)
                yPosition += 8

                // Dados da tabela (limitado para não ultrapassar página)
                data.overview.slice(0, 20).forEach(item => {
                    if (yPosition > pageHeight - 15) {
                        pdf.addPage()
                        yPosition = 20
                    }
                    pdf.text(item.date, 22, yPosition)
                    pdf.text(item.conversations.toString(), 60, yPosition)
                    pdf.text(item.cost.toFixed(6), 100, yPosition)
                    yPosition += 6
                })

                if (data.overview.length > 20) {
                    yPosition += 3
                    pdf.setFontSize(8)
                    pdf.setTextColor(150, 150, 150)
                    pdf.text(`... e mais ${data.overview.length - 20} registros`, 22, yPosition)
                }
            }

            // Rodapé
            const totalPages = pdf.internal.pages.length - 1
            for (let i = 1; i <= totalPages; i++) {
                pdf.setPage(i)
                pdf.setFontSize(8)
                pdf.setTextColor(150, 150, 150)
                pdf.text(
                    `Página ${i} de ${totalPages}`,
                    pageWidth / 2,
                    pageHeight - 10,
                    { align: 'center' }
                )
            }

            // Salvar PDF
            const fileName = `Insights_${period}_${new Date().toISOString().split('T')[0]}.pdf`
            pdf.save(fileName)
            toast.success(`Relatório PDF exportado: ${fileName}`)
        } catch (error: any) {
            console.error("[Insights] Erro ao exportar PDF:", error)
            toast.error("Erro ao exportar para PDF: " + (error.message || "Erro desconhecido"))
        }
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
                            <DropdownMenuItem onClick={exportToPDF} className="cursor-pointer">
                                <FileText className="mr-2 h-4 w-4" />
                                <span>Exportar para PDF</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Total Interactions ({period === '7d' ? '7d' : '30d'})
                        </CardTitle>
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalInteractions.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground flex items-center mt-1">
                            Live data
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Est. Token Cost Médio</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            ${totalCost > 0 ? totalCost.toFixed(6) : '0.000000'}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Baseado em preços por modelo
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
                    <TabsTrigger value="channels">Channels</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-1">
                        <Card>
                            <CardHeader>
                                <CardTitle>Interaction Volume Trend</CardTitle>
                                <CardDescription>Daily active sessions (Last 7 Days).</CardDescription>
                            </CardHeader>
                            <CardContent className="pl-2">
                                {overviewData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={350}>
                                        <AreaChart data={overviewData}>
                                            <defs>
                                                <linearGradient id="colorInteractions" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
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