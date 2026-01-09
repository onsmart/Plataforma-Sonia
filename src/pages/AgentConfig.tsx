
import { useState } from "react"
import { 
  Bot, 
  Zap, 
  ShieldCheck, 
  Sparkles, 
  Cpu, 
  Plus, 
  Trash2, 
  Check, 
  Globe, 
  Lock,
  ChevronRight,
  Settings2,
  Loader2
} from "lucide-react"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Switch } from "../components/ui/switch"
import { Textarea } from "../components/ui/textarea"
import { cn } from "../lib/utils"
import { Badge } from "../components/ui/badge"
import { toast } from "sonner"
import { api } from "../utils/api"
import { Toaster } from "sonner"

// Componente de Card refatorado para Enterprise Dark
function FrameworkCard({ children, className, active, onClick }: { children: React.ReactNode, className?: string, active?: boolean, onClick?: () => void }) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-[24px] bg-card p-6 shadow-sm transition-all duration-300 ease-out border",
        "hover:shadow-md cursor-pointer hover:border-primary/50",
        active ? "ring-2 ring-primary shadow-md bg-primary/5 border-primary" : "border-border",
        className
      )}
    >
      {active && (
        <div className="absolute top-4 right-4 h-6 w-6 bg-primary rounded-full flex items-center justify-center text-primary-foreground shadow-sm animate-in fade-in zoom-in duration-200">
          <Check className="h-3.5 w-3.5 stroke-[3]" />
        </div>
      )}
      {children}
    </div>
  )
}

function SectionTitle({ children, subtitle }: { children: React.ReactNode, subtitle?: string }) {
  return (
    <div className="mb-4 ml-1">
      <h3 className="text-xl font-semibold tracking-tight text-foreground">{children}</h3>
      {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  )
}

export function AgentConfig() {
  const [isLoading, setIsLoading] = useState(false)
  const [selectedFramework, setSelectedFramework] = useState<"agno" | "bee">("agno")
  const [name, setName] = useState("")
  const [instructions, setInstructions] = useState("")
  const [model, setModel] = useState("Anthropic Claude 3.5 Sonnet")
  const [requirements, setRequirements] = useState<string[]>([
    "Always verify user identity before transactional operations",
    "Check credit limit using Tool: check_credit_limit"
  ])
  const [capabilities, setCapabilities] = useState({
    voice: false,
    memory: true,
    internet: false
  })

  const addRequirement = () => {
    setRequirements([...requirements, "New compliance rule..."])
  }

  const removeRequirement = (index: number) => {
    const newReqs = [...requirements]
    newReqs.splice(index, 1)
    setRequirements(newReqs)
  }

  const handleDeploy = async () => {
    if (!name) {
      toast.error("Please give your agent a name.")
      return
    }

    setIsLoading(true)
    try {
      await api.agents.create({
        name,
        framework: selectedFramework,
        model,
        requirements: selectedFramework === 'bee' ? requirements : [], // Only Bee uses strict Requirements
        capabilities,
        instructions
      })
      
      toast.success("Agent successfully deployed!", {
        description: `${name} is now active on the ${selectedFramework === 'agno' ? 'Agno Runtime' : 'Bee Enterprise Engine'}.`
      })
      
      // Reset form optional, or redirect
      setName("")
      setInstructions("")
      
    } catch (error) {
        console.error(error)
      toast.error("Failed to deploy agent", {
        description: "Please check your connection and try again."
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen pb-20 font-sans">
      <Toaster position="top-center" />
      
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-8 py-5 bg-background/95 backdrop-blur-xl border-b border-border supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-card rounded-xl shadow-sm flex items-center justify-center border border-border">
            <Bot className="h-6 w-6 text-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">New Agent</h1>
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              SONIA Platform <ChevronRight className="h-3 w-3" /> Configuration
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" className="rounded-full text-muted-foreground hover:text-foreground" onClick={() => window.history.back()}>Cancel</Button>
          <Button 
            onClick={handleDeploy}
            disabled={isLoading}
            className="rounded-full shadow-sm disabled:opacity-70"
          >
            {isLoading ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deploying...
                </>
            ) : (
                "Deploy Agent"
            )}
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-8 py-8 space-y-10">
        
        {/* Step 1: Framework Selection */}
        <section>
          <SectionTitle subtitle="Choose the underlying architecture based on your performance and compliance needs.">
            Core Framework
          </SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FrameworkCard 
              active={selectedFramework === "agno"} 
              onClick={() => setSelectedFramework("agno")}
              className="group"
            >
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform duration-300">
                  <Zap className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-foreground">Agno Framework</h4>
                  <Badge variant="secondary" className="mt-1 mb-2 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-0">High Performance</Badge>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Designed for real-time interaction. 529× faster instantiation. Best for voice, streaming, and high-concurrency scenarios.
                  </p>
                  <div className="mt-4 flex items-center gap-4 text-xs font-medium text-foreground">
                    <span className="flex items-center gap-1"><Cpu className="h-3.5 w-3.5 text-muted-foreground" /> 3μs latency</span>
                    <span className="flex items-center gap-1"><Globe className="h-3.5 w-3.5 text-muted-foreground" /> AgentOS Runtime</span>
                  </div>
                </div>
              </div>
            </FrameworkCard>

            <FrameworkCard 
              active={selectedFramework === "bee"} 
              onClick={() => setSelectedFramework("bee")}
              className="group"
            >
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform duration-300">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-foreground">Bee Framework</h4>
                  <Badge variant="secondary" className="mt-1 mb-2 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border-0">Enterprise Grade</Badge>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Built for strict compliance. Includes Requirement Agent to enforce business rules and mandatory tool usage. Multi-language (Py/TS).
                  </p>
                  <div className="mt-4 flex items-center gap-4 text-xs font-medium text-foreground">
                    <span className="flex items-center gap-1"><Lock className="h-3.5 w-3.5 text-muted-foreground" /> Compliance</span>
                    <span className="flex items-center gap-1"><Globe className="h-3.5 w-3.5 text-muted-foreground" /> Python + TS</span>
                  </div>
                </div>
              </div>
            </FrameworkCard>
          </div>
        </section>

        {/* Step 2: Agent Identity & Intelligence */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-6">
            <div className="bg-card rounded-[24px] p-8 shadow-sm border border-border">
               <SectionTitle>Identity & Role</SectionTitle>
               <div className="space-y-6">
                  <div className="grid gap-2">
                    <Label htmlFor="name" className="text-sm font-medium text-foreground">Agent Name</Label>
                    <Input 
                        id="name" 
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Sales Assistant Pro" 
                        className="rounded-xl border-border bg-muted/30 focus:bg-card transition-all h-12" 
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="instructions" className="text-sm font-medium text-foreground">System Instructions</Label>
                    <Textarea 
                      id="instructions" 
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      placeholder="Define the agent's persona, tone, and primary objectives..." 
                      className="rounded-xl border-border bg-muted/30 focus:bg-card transition-all min-h-[120px] resize-none" 
                    />
                  </div>
               </div>
            </div>

            {/* Requirement Agent Rules - Only visible for Bee or High Compliance Agno */}
            <div className="bg-card rounded-[24px] p-8 shadow-sm border border-border">
               <div className="flex items-center justify-between mb-4">
                 <SectionTitle subtitle="Mandatory rules that the agent must follow regardless of context.">
                   {selectedFramework === 'bee' ? 'Bee Requirements' : 'Guidelines & Safety'}
                 </SectionTitle>
                 <Button onClick={addRequirement} variant="outline" size="sm" className="rounded-full h-8 text-xs border-dashed border-muted-foreground/40 text-muted-foreground">
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Rule
                 </Button>
               </div>
               
               <div className="space-y-3">
                 {requirements.map((req, idx) => (
                   <div key={idx} className="group flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-border hover:border-primary/30 transition-colors">
                      <div className="h-6 w-6 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 flex-shrink-0">
                        <ShieldCheck className="h-3.5 w-3.5" />
                      </div>
                      <Input 
                        value={req} 
                        onChange={(e) => {
                          const newReqs = [...requirements]
                          newReqs[idx] = e.target.value
                          setRequirements(newReqs)
                        }}
                        className="border-0 bg-transparent shadow-none h-auto p-0 focus-visible:ring-0 text-sm text-foreground placeholder:text-muted-foreground" 
                      />
                      <Button 
                        onClick={() => removeRequirement(idx)}
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                   </div>
                 ))}
                 {requirements.length === 0 && (
                   <div className="text-center py-6 text-sm text-muted-foreground italic">No rules defined. Agent is in open mode.</div>
                 )}
               </div>
            </div>
          </div>

          {/* Sidebar Settings */}
          <div className="space-y-6">
            <div className="bg-card rounded-[24px] p-6 shadow-sm border border-border">
              <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Neural Engine
              </h4>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Model Family</Label>
                  <select 
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full rounded-xl border-border bg-muted/30 h-10 px-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none text-foreground"
                  >
                    <option value="Anthropic Claude 3.5 Sonnet">Anthropic Claude 3.5 Sonnet</option>
                    <option value="IBM Granite 3.0">IBM Granite 3.0 (Enterprise)</option>
                    <option value="OpenAI GPT-4o">OpenAI GPT-4o</option>
                  </select>
                </div>

                {selectedFramework === 'bee' && (
                   <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-xs text-indigo-300">
                      <p className="font-medium mb-1">IBM Granite Recommended</p>
                      <p className="opacity-80">Granite models are optimized for Bee Framework and RAG tasks.</p>
                   </div>
                )}
              </div>
            </div>

            <div className="bg-card rounded-[24px] p-6 shadow-sm border border-border">
              <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-muted-foreground" />
                Capabilities
              </h4>
              
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="voice" className="text-sm font-medium text-foreground">Voice Interface</Label>
                  <Switch 
                    id="voice" 
                    checked={capabilities.voice}
                    onCheckedChange={(c) => setCapabilities({...capabilities, voice: c})}
                    className="data-[state=checked]:bg-emerald-500" 
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="memory" className="text-sm font-medium text-foreground">Long-term Memory</Label>
                  <Switch 
                    id="memory" 
                    checked={capabilities.memory}
                    onCheckedChange={(c) => setCapabilities({...capabilities, memory: c})}
                    className="data-[state=checked]:bg-emerald-500" 
                  />
                </div>
                 <div className="flex items-center justify-between">
                  <Label htmlFor="internet" className="text-sm font-medium text-foreground">Internet Access</Label>
                  <Switch 
                    id="internet" 
                    checked={capabilities.internet}
                    onCheckedChange={(c) => setCapabilities({...capabilities, internet: c})}
                    className="data-[state=checked]:bg-emerald-500" 
                  />
                </div>
              </div>
            </div>
            
            <div className="bg-card/50 p-4 rounded-[24px] border border-transparent hover:border-border transition-colors cursor-help">
              <p className="text-[11px] text-muted-foreground text-center leading-tight">
                Agents created here are deployed to the isolated <span className="font-mono text-foreground">tenant-cluster-v2</span> environment.
              </p>
            </div>

          </div>
        </section>

      </main>
    </div>
  )
}
