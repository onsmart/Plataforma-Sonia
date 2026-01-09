import { useEffect, useState } from "react"
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
    PlayCircle
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar"
import { Badge } from "../components/ui/badge"
import { ScrollArea } from "../components/ui/scroll-area"
import { AgentService, DashboardData } from "../services/api"

export function Cockpit() {
    const [data, setData] = useState<DashboardData | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const loadData = async () => {
            // Only show full loading on initial load
            if (!data) setLoading(true)
            const stats = await AgentService.getDashboardStats()
            setData(stats)
            if (!data) setLoading(false)
        }
        loadData()
        
        // Refresh every 10 seconds to see changes from other users/simulation
        const interval = setInterval(loadData, 10000)
        return () => clearInterval(interval)
    }, [])

    if (loading && !data) {
        return (
            <div className="flex h-full items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    const { stats, activityFeed } = data || { 
        stats: { 
            totalInteractions: 0, 
            activeLeads: 0, 
            avgResponseTime: 0, 
            meetingsBooked: 0,
            activeAgents: 0
        }, 
        activityFeed: [] 
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Operations Cockpit</h2>
                    <p className="text-muted-foreground">
                        Real-time overview of your autonomous workforce performance.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1.5 px-3 py-1">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        System Healthy
                    </Badge>
                    <span className="text-sm text-muted-foreground ml-2">Active Agents: {stats.activeAgents}</span>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Interactions</CardTitle>
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalInteractions.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">
                            <span className="text-emerald-500 font-medium flex items-center inline-flex">
                                <TrendingUp className="h-3 w-3 mr-0.5" /> Live
                            </span>{" "}
                            tracked sessions
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Leads</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.activeLeads}</div>
                        <p className="text-xs text-muted-foreground">
                            <span className="text-emerald-500 font-medium flex items-center inline-flex">
                                +0% <TrendingUp className="h-3 w-3 ml-0.5" />
                            </span>{" "}
                            currently being nurtured
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg. Response Time</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.avgResponseTime}s</div>
                        <p className="text-xs text-muted-foreground">
                            Global average latency
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Meetings Booked</CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.meetingsBooked}</div>
                        <p className="text-xs text-muted-foreground">
                            <span className="text-emerald-500 font-medium flex items-center inline-flex">
                                +0 <TrendingUp className="h-3 w-3 ml-0.5" />
                            </span>{" "}
                            this week
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Live Activity Feed</CardTitle>
                        <CardDescription>Real-time logs of agent actions and decisions.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[350px] pr-4">
                            <div className="space-y-6">
                                {activityFeed.length === 0 ? (
                                    <div className="text-center text-muted-foreground py-10">
                                        No activity recorded yet. Start interacting with agents to see logs.
                                    </div>
                                ) : (
                                    activityFeed.map((log, i) => (
                                        <div key={i} className="flex items-start gap-4 text-sm animate-in slide-in-from-top-2 duration-300">
                                            <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                                                log.type === 'success' ? 'bg-emerald-500' :
                                                log.type === 'warning' ? 'bg-yellow-500' :
                                                log.type === 'system' ? 'bg-blue-500' : 'bg-muted-foreground'
                                            }`} />
                                            <div className="flex-1 space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <p className="font-medium leading-none">{log.agent}</p>
                                                    <span className="text-xs text-muted-foreground">{log.time}</span>
                                                </div>
                                                <p className="text-muted-foreground">{log.action}</p>
                                                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal">
                                                    {log.platform}
                                                </Badge>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
                
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>System Health</CardTitle>
                        <CardDescription>Operational status of critical services.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {[
                            { name: "LLM Gateway (OpenAI/Anthropic)", status: "Operational", uptime: "99.9%" },
                            { name: "Vector Database (RAG)", status: "Operational", uptime: "100%" },
                            { name: "WhatsApp API Connector", status: "Operational", uptime: "99.5%" },
                            { name: "Email Service (SMTP)", status: "Operational", uptime: "99.9%" },
                            { name: "Voice Synthesis Engine", status: "Operational", uptime: "98.2%" },
                        ].map((service, i) => (
                            <div key={i} className="flex items-center justify-between p-3 border rounded-lg bg-card/50">
                                <div className="flex items-center gap-3">
                                    {service.status !== 'Operational' ? (
                                        <AlertCircle className="h-4 w-4 text-yellow-500" />
                                    ) : (
                                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                    )}
                                    <div className="space-y-0.5">
                                        <p className="text-sm font-medium leading-none">{service.name}</p>
                                        <p className="text-xs text-muted-foreground">{service.status}</p>
                                    </div>
                                </div>
                                <span className="text-xs font-mono text-muted-foreground">{service.uptime}</span>
                            </div>
                        ))}
                        
                        <div className="pt-4">
                             <Button variant="outline" className="w-full text-xs h-8" size="sm">
                                View Detailed Status Page <ArrowRight className="ml-2 h-3 w-3" />
                             </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}