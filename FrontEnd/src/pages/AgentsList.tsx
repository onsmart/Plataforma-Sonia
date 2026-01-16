
import { useEffect, useState } from "react"
import { 
  Bot, 
  Zap, 
  ShieldCheck, 
  Plus, 
  MoreVertical, 
  Search,
  Filter,
  Loader2,
  Circle
} from "lucide-react"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Badge } from "../components/ui/badge"
import { cn } from "../lib/utils"
import { api } from "../utils/api"
import { toast } from "sonner"

type Agent = {
  id: string
  name: string
  framework: "agno" | "bee"
  model: string
  status: "deployed" | "training" | "stopped"
  requirements?: string[]
  updatedAt: string
}

function AgentCard({ agent }: { agent: Agent }) {
  const isAgno = agent.framework === "agno"
  
  return (
    <div className="group relative bg-card rounded-[20px] p-5 shadow-sm border border-border hover:shadow-md hover:border-primary/20 transition-all duration-300">
      <div className="flex justify-between items-start mb-4">
        <div className={cn(
          "h-10 w-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 border",
          isAgno 
            ? "bg-amber-500/10 text-amber-500 border-amber-500/20" 
            : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
        )}>
          {isAgno ? <Zap className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="mb-4">
        <h3 className="font-semibold text-foreground text-lg leading-tight mb-1">{agent.name}</h3>
        <p className="text-xs text-muted-foreground font-medium truncate">{agent.model}</p>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <Badge variant="secondary" className={cn(
          "text-[10px] h-5 px-2 border border-transparent bg-secondary/50 text-secondary-foreground"
        )}>
          {isAgno ? "High Performance" : "Enterprise Grade"}
        </Badge>
        {agent.requirements && agent.requirements.length > 0 && (
          <Badge variant="outline" className="text-[10px] h-5 px-2 text-muted-foreground border-border">
            {agent.requirements.length} Rules
          </Badge>
        )}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-border/50">
        <div className="flex items-center gap-1.5">
          <Circle className={cn("h-2 w-2 fill-current", agent.status === 'deployed' ? "text-emerald-500" : "text-yellow-500")} />
          <span className="text-xs font-medium text-muted-foreground capitalize">{agent.status}</span>
        </div>
        <span className="text-[10px] text-muted-foreground/70">
            {new Date(agent.updatedAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  )
}

export function AgentsList({ filterFramework }: { filterFramework?: "agno" | "bee" }) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    loadAgents()
  }, [])

  const loadAgents = async () => {
    try {
      setIsLoading(true)
      const data = await api.agents.list()
      setAgents(data.agents || [])
    } catch (error: any) {
      if (error.name !== 'TypeError' && error.message !== 'Failed to fetch') {
          console.error(error)
      }
      toast.error("Failed to load agents")
    } finally {
      setIsLoading(false)
    }
  }

  const filteredAgents = agents.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          agent.framework.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesFramework = filterFramework ? agent.framework === filterFramework : true

    return matchesSearch && matchesFramework
  })

  const getPageTitle = () => {
    if (filterFramework === 'agno') return "Agno Agents Fleet";
    if (filterFramework === 'bee') return "Bee Agents Fleet";
    return "Agents Fleet";
  }

  const getPageDescription = () => {
    if (filterFramework === 'agno') return "Manage your high-performance real-time Agno instances.";
    if (filterFramework === 'bee') return "Manage your enterprise-grade Bee instances.";
    return "Manage your Agno and Bee instances across all environments.";
  }

  const deploySentinel = async () => {
    try {
      toast.promise(api.agents.create({
        name: "Sentinel One",
        role: "IoT Security Specialist",
        description: "Autonomous security agent capable of monitoring cameras, controlling locks, and analyzing visual threats.",
        channels: ["webchat", "whatsapp"],
        languages: ["English", "Portuguese"],
        framework: "agno"
      }), {
        loading: "Deploying Sentinel Agent...",
        success: () => {
          loadAgents()
          return "Sentinel Agent Deployed"
        },
        error: "Deployment failed"
      })
    } catch (e: any) {
      if (e.name !== 'TypeError' && e.message !== 'Failed to fetch') {
          console.error(e)
      }
    }
  }

  return (
    <div className="p-4 md:p-8 font-sans">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">{getPageTitle()}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {getPageDescription()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative hidden md:block">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search agents..." 
              className="pl-9 h-10 w-64 bg-card border-border rounded-full text-sm focus-visible:ring-primary/20"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" className="rounded-full h-10 px-4 bg-card border-border hover:bg-accent hover:text-accent-foreground">
            <Filter className="h-4 w-4 mr-2" /> Filter
          </Button>
          <Button 
            variant="secondary"
            className="rounded-full h-10 px-5 shadow-sm bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 border border-purple-500/20"
            onClick={deploySentinel}
          >
            <ShieldCheck className="h-4 w-4 mr-2" /> Deploy Sentinel
          </Button>
          <Button 
            className="rounded-full h-10 px-5 shadow-sm"
            onClick={() => window.location.hash = '#agents-new'}
          >
            <Plus className="h-4 w-4 mr-2" /> New Agent
          </Button>
        </div>
      </header>

      {/* Main Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mb-3" />
          <p className="text-sm">Loading fleet status...</p>
        </div>
      ) : filteredAgents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredAgents.map(agent => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
          
          {/* Create New Card Placeholder */}
          <div 
            onClick={() => window.location.hash = '#agents-new'}
            className="group relative flex flex-col items-center justify-center bg-card/30 rounded-[20px] p-5 border-2 border-dashed border-border hover:border-primary/50 hover:bg-accent/10 transition-all duration-300 cursor-pointer min-h-[220px]"
          >
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3 group-hover:scale-110 group-hover:bg-primary/20 group-hover:text-primary transition-all">
                <Plus className="h-6 w-6" />
            </div>
            <p className="font-medium text-muted-foreground group-hover:text-primary transition-colors">Deploy New Agent</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Agno or Bee Framework</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
            <div className="h-20 w-20 rounded-3xl bg-muted/30 flex items-center justify-center mb-6">
                <Bot className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">No agents deployed</h3>
            <p className="text-muted-foreground max-w-sm mb-8">
                Your fleet is empty. Start by deploying a high-performance Agno agent or an enterprise-grade Bee agent.
            </p>
            <Button 
                className="rounded-full h-12 px-8 shadow-lg shadow-primary/20"
                onClick={() => window.location.hash = '#agents-new'}
            >
                Create First Agent
            </Button>
        </div>
      )}
    </div>
  )
}
