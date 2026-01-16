import { useEffect, useState } from "react"
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
    Loader2
} from "lucide-react"
import { Button } from "../components/ui/button"
import { Badge } from "../components/ui/badge"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "../components/ui/chart"
import { AgentService, InsightsData } from "../services/api"

export function Insights() {
    const [data, setData] = useState<InsightsData | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const load = async () => {
            try {
                const insights = await AgentService.getInsights()
                setData(insights)
            } catch (e: any) {
                if (e.name !== 'TypeError' && e.message !== 'Failed to fetch') {
                    console.error("Failed to load insights", e)
                }
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    const overviewData = data?.overview || []
    const channelsData = data?.channels || []

    // Calculate Totals for KPI Cards
    const totalInteractions = overviewData.reduce((acc, curr) => acc + curr.conversations, 0)
    const totalCost = overviewData.reduce((acc, curr) => acc + curr.cost, 0)
    
    // Mock for now until we have real CSAT/SDR data
    const sdrConversion = 0 
    const csatScore = "N/A"

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
                    <Select defaultValue="7d">
                        <SelectTrigger className="w-[180px]">
                            <Calendar className="mr-2 h-4 w-4" />
                            <SelectValue placeholder="Period" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="7d">Last 7 days</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline" size="icon">
                        <Download className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Interactions (7d)</CardTitle>
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
                        <CardTitle className="text-sm font-medium">Est. Token Cost</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${totalCost.toFixed(4)}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Based on OpenAI usage
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Channels</CardTitle>
                        <Target className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{channelsData.length}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Deployed endpoints
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">CSAT Score</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{csatScore}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                           Requires feedback loop
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
                            </CardContent>
                        </Card>
                     </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}