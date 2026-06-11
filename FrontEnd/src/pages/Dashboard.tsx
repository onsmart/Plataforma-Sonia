
import { useEffect, useState, useRef } from "react"
import { Activity, ArrowUpRight, Bot, Cpu, Mic, ShieldCheck, Users, Zap, Loader2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card"
import { api } from "../utils/api"
import { Badge } from "../components/ui/badge"

const DASHBOARD_STATS_TTL = 2 * 60 * 1000

export function Dashboard() {
  const [stats, setStats] = useState({
    activeAgents: 0,
    agnoCount: 0,
    beeCount: 0,
    loading: true
  })
  const lastFetchedRef = useRef(0)

  useEffect(() => {
    void loadStats()
  }, [])

  const loadStats = async (force = false) => {
    const now = Date.now()
    if (!force && now - lastFetchedRef.current < DASHBOARD_STATS_TTL) return
    try {
      const data = await api.agents.list().catch(() => ({ agents: [] }))

      if (data && data.agents) {
        setStats({
          activeAgents: data.agents.length,
          agnoCount: data.agents.filter((a: any) => a.framework === 'agno').length,
          beeCount: data.agents.filter((a: any) => a.framework === 'bee').length,
          loading: false
        })
        lastFetchedRef.current = Date.now()
      } else {
         setStats(prev => ({ ...prev, loading: false }));
      }
    } catch (e: any) {
      if (e.name !== 'TypeError' && e.message !== 'Failed to fetch') {
          console.error("Critical error in dashboard loadStats", e)
      }
      setStats(prev => ({ ...prev, loading: false }))
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 pt-0">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-all duration-300 hover:bg-accent/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Latency</CardTitle>
            <Zap className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">120ms</div>
            <p className="text-xs text-muted-foreground">
              Agno Optimization
            </p>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-md transition-all duration-300 cursor-pointer hover:bg-accent/5" onClick={() => window.location.hash = '#agents-list'}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Fleet</CardTitle>
            <Bot className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {stats.loading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
                <div className="text-2xl font-bold">{stats.activeAgents}</div>
            )}
            <p className="text-xs text-muted-foreground">
              {stats.agnoCount} Agno / {stats.beeCount} Bee
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-all duration-300 hover:bg-accent/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compliance Rate</CardTitle>
            <ShieldCheck className="h-4 w-4 text-indigo-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">99.8%</div>
            <p className="text-xs text-muted-foreground">
              Bee Guardrails Active
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-all duration-300 hover:bg-accent/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <Activity className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,203</div>
            <p className="text-xs text-muted-foreground">
              +15% since last hour
            </p>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 shadow-sm">
          <CardHeader>
            <CardTitle>Agent Orchestration Overview</CardTitle>
            <CardDescription>
                Real-time performance of Agno (Real-time) and Bee (Enterprise) agents.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[200px] flex items-center justify-center text-muted-foreground bg-accent/10 rounded-md border border-dashed border-muted-foreground/20">
                <div className="text-center">
                    <Activity className="h-8 w-8 mx-auto mb-2 opacity-20" />
                    <span className="text-sm">Live telemetry graph would render here</span>
                </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="col-span-3 shadow-sm">
          <CardHeader>
            <CardTitle>System Status</CardTitle>
            <CardDescription>
              Infrastructure health check.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
                <div className="flex items-center p-2 rounded-lg hover:bg-accent/10 transition-colors">
                    <div className="h-2 w-2 bg-emerald-500 rounded-full mr-3 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                    <div className="flex-1 text-sm font-medium">AgentOS Runtime (Agno)</div>
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Operational</Badge>
                </div>
                <div className="flex items-center p-2 rounded-lg hover:bg-accent/10 transition-colors">
                    <div className="h-2 w-2 bg-indigo-500 rounded-full mr-3 shadow-[0_0_8px_rgba(99,102,241,0.4)]" />
                    <div className="flex-1 text-sm font-medium">Bee Enterprise Engine</div>
                    <Badge variant="outline" className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20">Operational</Badge>
                </div>
                <div className="flex items-center p-2 rounded-lg hover:bg-accent/10 transition-colors">
                    <div className="h-2 w-2 bg-amber-500 rounded-full mr-3" />
                    <div className="flex-1 text-sm font-medium">LangGraph Workflows</div>
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">High Load</Badge>
                </div>
                <div className="flex items-center p-2 rounded-lg hover:bg-accent/10 transition-colors">
                    <div className="h-2 w-2 bg-blue-500 rounded-full mr-3" />
                    <div className="flex-1 text-sm font-medium">Supabase Data Layer</div>
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20">Connected</Badge>
                </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
