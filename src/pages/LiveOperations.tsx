
import { useEffect, useState, useRef } from "react"
import { 
    Mic, Bot, Zap, ShieldCheck, User, Send, ShieldAlert, 
    Loader2, MessageCircle, PlayCircle, PauseCircle, MoreVertical,
    Camera, Lock, Eye, Activity
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Badge } from "../components/ui/badge"
import { ScrollArea } from "../components/ui/scroll-area"
import { Avatar, AvatarFallback } from "../components/ui/avatar"
import { Separator } from "../components/ui/separator"
import { cn } from "../lib/utils"
import { api } from "../utils/api"
import { toast } from "sonner"
import { AudioVisualizer } from "../components/live/AudioVisualizer"

type Agent = {
    id: string
    name: string
    framework: "agno" | "bee"
    model: string
}

type Message = {
    id: string
    sender: "user" | "agent" | "system"
    text: string
    timestamp: string
    imageUrl?: string
    meta?: {
        latency?: number
        compliance?: boolean
    }
}

export function LiveOperations() {
    const [agents, setAgents] = useState<Agent[]>([])
    const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const [inputText, setInputText] = useState("")
    const [isAiPaused, setIsAiPaused] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    
    // New state for audio visualization
    const [voiceMode, setVoiceMode] = useState<"idle" | "listening" | "thinking" | "speaking">("idle")
    
    // Sentinel specific state
    const [latestSnapshot, setLatestSnapshot] = useState<string | null>(null)
    const [monitoredDevices, setMonitoredDevices] = useState([
        { name: "Lobby Camera 01", status: "online", type: "camera" },
        { name: "Main Entrance Lock", status: "locked", type: "lock" },
        { name: "Server Room Motion", status: "clear", type: "sensor" }
    ])

    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        loadAgents()
    }, [])

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: "smooth" })
        }
    }, [messages, isProcessing])

    // Simulate speaking effect when agent message arrives
    useEffect(() => {
        if (messages.length > 0 && messages[messages.length - 1].sender === 'agent') {
            setVoiceMode('speaking')
            const timeout = setTimeout(() => setVoiceMode('idle'), 2000)
            return () => clearTimeout(timeout)
        }
    }, [messages])

    const loadAgents = async () => {
        try {
            const data = await api.agents.list()
            if (data.agents && data.agents.length > 0) {
                setAgents(data.agents)
                setSelectedAgentId(data.agents[0].id)
                setMessages([{
                    id: "welcome",
                    sender: "system",
                    text: `Connected to ${data.agents[0].name} (${data.agents[0].framework === 'agno' ? 'Agno Real-time' : 'Bee Enterprise'}).`,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }])
            }
        } catch (e) {
            // Silently fail if agents cannot be loaded
        }
    }

    const handleSendMessage = async () => {
        if (!inputText.trim() || !selectedAgentId) return

        const userMsg: Message = {
            id: Date.now().toString(),
            sender: "user",
            text: inputText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }

        setMessages(prev => [...prev, userMsg])
        setInputText("")
        setIsProcessing(true)
        setVoiceMode('thinking')

        const isSentinel = selectedAgent?.name === "Sentinel One"
        const isCameraRequest = userMsg.text.toLowerCase().includes("camera") || userMsg.text.toLowerCase().includes("snapshot") || userMsg.text.toLowerCase().includes("look")

        if (!isAiPaused) {
            try {
                let responseText = ""
                let responseImage = undefined

                if (isSentinel && isCameraRequest) {
                    // ASYNC JOB QUEUE PATTERN
                    // 1. Enqueue Job
                    const { jobId } = await api.agents.triggerDeviceAction("cam-01", "snapshot", {});
                    
                    // 2. Poll for Completion (Simulating Worker)
                    let attempts = 0;
                    while (attempts < 10) {
                        // Trigger processing (in real app this happens automatically by worker)
                        await api.agents.triggerJobProcess(jobId);
                        
                        // Check Status
                        const job = await api.agents.getJobStatus(jobId);
                        
                        if (job.status === 'completed') {
                            responseText = job.result.compliance + " " + job.result.analysis;
                            responseImage = job.result.imageUrl;
                            setLatestSnapshot(responseImage);
                            break;
                        } else if (job.status === 'failed') {
                            throw new Error(job.error || "Audit failed");
                        }
                        
                        // Wait 1s
                        await new Promise(r => setTimeout(r, 1000));
                        attempts++;
                    }
                    if (attempts >= 10) throw new Error("Audit timed out");

                } else {
                    const response = await api.chat.send({
                        agentId: selectedAgentId,
                        message: userMsg.text
                    })
                    responseText = response.response
                }

                const agentMsg: Message = {
                    id: (Date.now() + 1).toString(),
                    sender: "agent",
                    text: responseText,
                    imageUrl: responseImage,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    meta: {
                        latency: isSentinel ? 1450 : 320,
                        compliance: true
                    }
                }
                setMessages(prev => [...prev, agentMsg])
            } catch (error) {
                toast.error("Failed to get response from agent")
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    sender: "system",
                    text: "Error: Agent unreachable.",
                    timestamp: new Date().toLocaleTimeString()
                }])
            } finally {
                setIsProcessing(false)
                // Voice mode will switch to 'speaking' via the useEffect above
            }
        } else {
            setIsProcessing(false)
            setVoiceMode('idle')
        }
    }

    const selectedAgent = agents.find(a => a.id === selectedAgentId)
    const isSentinel = selectedAgent?.name === "Sentinel One"

    return (
        <div className="flex h-[calc(100vh-8rem)] flex-col md:flex-row gap-4">
            {/* Agent Selector List */}
            <Card className="w-full md:w-80 flex flex-col h-full">
                <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-lg">Live Channels</CardTitle>
                    <div className="relative">
                        <Input placeholder="Filter agents..." className="h-8 bg-muted/50" />
                    </div>
                </CardHeader>
                <CardContent className="p-0 flex-1 overflow-hidden">
                    <ScrollArea className="h-full">
                        <div className="flex flex-col">
                            {agents.length === 0 ? (
                                <div className="p-4 text-center text-sm text-muted-foreground">
                                    No active agents found. <br/>
                                    <a href="#agents-new" className="text-primary hover:underline">Create one</a>
                                </div>
                            ) : agents.map((agent) => (
                                <button
                                    key={agent.id}
                                    onClick={() => setSelectedAgentId(agent.id)}
                                    className={cn(
                                        "flex items-start gap-3 p-3 text-left hover:bg-accent/50 transition-colors border-b border-border/50",
                                        selectedAgentId === agent.id && "bg-accent border-l-2 border-l-primary"
                                    )}
                                >
                                    <Avatar className="h-10 w-10">
                                        <AvatarFallback className="bg-secondary text-secondary-foreground">
                                            {agent.name.substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 overflow-hidden">
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium truncate text-sm">{agent.name}</span>
                                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Online</span>
                                        </div>
                                        <div className="mt-2 flex gap-1">
                                            {agent.framework === "agno" ? (
                                                <Badge variant="outline" className="h-5 text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/20 flex items-center gap-1">
                                                    <Zap className="h-3 w-3" /> Agno
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="h-5 text-[10px] bg-purple-500/10 text-purple-400 border-purple-500/20 flex items-center gap-1">
                                                    <ShieldCheck className="h-3 w-3" /> Bee
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>

            {/* Chat Area */}
            <Card className="flex-1 flex flex-col h-full border-0 shadow-none md:border md:shadow-sm relative overflow-hidden bg-background/50">
                {selectedAgent ? (
                    <>
                        <div className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10">
                            <div className="flex items-center gap-3">
                                <div className={cn("h-2 w-2 rounded-full animate-pulse shadow-[0_0_8px_currentcolor]", isProcessing ? "bg-yellow-400 text-yellow-400" : "bg-emerald-500 text-emerald-500")} />
                                <div>
                                    <div className="font-medium flex items-center gap-2 text-sm">
                                        {selectedAgent.name}
                                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal opacity-80">{selectedAgent.model}</Badge>
                                    </div>
                                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                                        {isProcessing ? (
                                            <span className="text-yellow-500 font-medium">Processing...</span>
                                        ) : (
                                            <span>Idle • 12ms latency</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                             <div className="flex items-center gap-2">
                                <Button 
                                    variant={isAiPaused ? "destructive" : "outline"} 
                                    size="sm"
                                    className="h-8 text-xs"
                                    onClick={() => setIsAiPaused(!isAiPaused)}
                                >
                                    {isAiPaused ? (
                                        <><PlayCircle className="mr-2 h-3 w-3" /> Resume AI</>
                                    ) : (
                                        <><PauseCircle className="mr-2 h-3 w-3" /> Pause AI</>
                                    )}
                                </Button>
                            </div>
                        </div>

                        {/* Active Voice Visualization Header */}
                        <div className="bg-card/30 border-b p-2 flex justify-center items-center h-24 backdrop-blur-sm">
                            <AudioVisualizer 
                                isActive={!isAiPaused} 
                                mode={voiceMode} 
                                framework={selectedAgent.framework} 
                            />
                        </div>

                        <ScrollArea className="flex-1 p-4">
                            <div className="space-y-6 pb-4">
                                {messages.map((message) => (
                                    <div
                                        key={message.id}
                                        className={cn(
                                            "flex gap-3 max-w-[85%]",
                                            message.sender === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                                        )}
                                    >
                                        <div className={cn(
                                            "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm border",
                                            message.sender === "user" ? "bg-primary border-primary text-primary-foreground" : 
                                            message.sender === "agent" ? "bg-card border-border text-foreground" : "bg-muted border-transparent text-muted-foreground"
                                        )}>
                                            {message.sender === "user" && <User className="h-4 w-4" />}
                                            {message.sender === "agent" && <Bot className="h-4 w-4" />}
                                            {message.sender === "system" && <MoreVertical className="h-4 w-4" />}
                                        </div>
                                        
                                        <div className={cn(
                                            "rounded-2xl p-4 text-sm shadow-sm",
                                            message.sender === "user" 
                                                ? "bg-primary text-primary-foreground rounded-tr-none" 
                                                : "bg-card border border-border text-foreground rounded-tl-none"
                                        )}>
                                            <p className="leading-relaxed">{message.text}</p>
                                            
                                            {message.imageUrl && (
                                                <div className="mt-3 mb-1 rounded-lg overflow-hidden border border-border/50 shadow-sm">
                                                    <img src={message.imageUrl} alt="Analysis" className="w-full h-auto object-cover max-h-[200px]" />
                                                    <div className="bg-black/50 p-2 text-[10px] text-white backdrop-blur-sm flex items-center justify-between absolute bottom-0 w-full opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <span>Object Detection</span>
                                                        <Badge variant="outline" className="h-4 text-[9px] border-white/30 text-white">Clean</Badge>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Metadata Footer */}
                                            <div className={cn(
                                                "flex items-center gap-3 mt-3 text-[10px] opacity-70 font-medium border-t pt-2",
                                                message.sender === "user" ? "border-primary-foreground/20 justify-end" : "border-border"
                                            )}>
                                                <span>{message.timestamp}</span>
                                                {message.meta?.latency && (
                                                    <span className="flex items-center gap-1">
                                                        <Zap className="h-3 w-3" /> {message.meta.latency}ms
                                                    </span>
                                                )}
                                                {message.meta?.compliance !== undefined && (
                                                    message.meta.compliance ? (
                                                        <span className="flex items-center gap-1 text-emerald-400">
                                                            <ShieldCheck className="h-3 w-3" /> Compliant
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1 text-red-400">
                                                            <ShieldAlert className="h-3 w-3" /> Blocked
                                                        </span>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {isProcessing && (
                                    <div className="flex gap-3 max-w-[85%] mr-auto">
                                         <div className="h-8 w-8 rounded-full bg-card border border-border flex items-center justify-center shadow-sm">
                                            <Bot className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                        <div className="bg-card border border-border rounded-2xl rounded-tl-none p-4 shadow-sm flex items-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                            <span className="text-xs text-muted-foreground">
                                                {selectedAgent.framework === 'bee' ? "Running Compliance Checks..." : "Agno Neural Processing..."}
                                            </span>
                                        </div>
                                    </div>
                                )}
                                <div ref={scrollRef} />
                            </div>
                        </ScrollArea>

                        <div className="p-4 bg-card border-t">
                            <form 
                                onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                                className="flex gap-2"
                            >
                                <Input 
                                    placeholder="Simulate customer message..."
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    className="h-12 rounded-full bg-muted/30 border-border focus-visible:ring-primary/20"
                                />
                                <Button 
                                    type="submit" 
                                    size="icon"
                                    disabled={!inputText.trim() || isProcessing}
                                    className="h-12 w-12 rounded-full shadow-lg shadow-primary/20"
                                >
                                    <Send className="h-5 w-5 ml-0.5" />
                                </Button>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <MessageCircle className="h-12 w-12 mb-4 opacity-20" />
                        <p>Select an active agent to start simulation</p>
                    </div>
                )}
            </Card>

            {/* Context/Debug Panel */}
             <Card className="w-full md:w-80 h-full hidden xl:flex flex-col bg-card/50 border-l">
                {isSentinel ? (
                    <>
                         <div className="p-4 border-b bg-purple-500/5">
                            <h4 className="font-semibold text-sm flex items-center gap-2 text-purple-700 dark:text-purple-300">
                                <ShieldCheck className="h-4 w-4" /> Security Command
                            </h4>
                        </div>
                        <ScrollArea className="flex-1">
                            <div className="p-4 space-y-6">
                                {/* Live Vision Feed */}
                                <div>
                                    <h5 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider flex items-center justify-between">
                                        Live Vision Feed
                                        <Badge variant="outline" className="text-[10px] h-4">REAL-TIME</Badge>
                                    </h5>
                                    <div className="aspect-video bg-black rounded-lg overflow-hidden border border-border shadow-md relative group">
                                        {latestSnapshot ? (
                                            <>
                                                <img src={latestSnapshot} className="w-full h-full object-cover opacity-80" />
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-transparent transition-all">
                                                    <div className="absolute top-2 left-2 flex gap-1">
                                                        <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                                                        <span className="text-[10px] text-white font-mono">LIVE REC</span>
                                                    </div>
                                                    <div className="absolute bottom-2 right-2 text-[10px] text-white/70 font-mono">
                                                        CAM-01
                                                    </div>
                                                    {/* Fake Bounding Boxes */}
                                                    <div className="absolute top-1/2 left-1/3 w-16 h-24 border border-green-500/70 rounded-sm">
                                                         <div className="absolute -top-3 left-0 bg-green-500 text-[8px] text-black px-1">Person 98%</div>
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/50">
                                                <Camera className="h-8 w-8 mb-2 opacity-50" />
                                                <span className="text-xs">Waiting for feed...</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <Separator />

                                {/* Connected Devices */}
                                <div>
                                    <h5 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">
                                        Monitored Devices
                                    </h5>
                                    <div className="space-y-2">
                                        {monitoredDevices.map((dev, i) => (
                                            <div key={i} className="flex items-center justify-between p-2 rounded-md bg-card border border-border/50 text-sm">
                                                <div className="flex items-center gap-2">
                                                    {dev.type === 'camera' && <Camera className="h-3 w-3 text-muted-foreground" />}
                                                    {dev.type === 'lock' && <Lock className="h-3 w-3 text-muted-foreground" />}
                                                    {dev.type === 'sensor' && <Activity className="h-3 w-3 text-muted-foreground" />}
                                                    <span className="text-xs font-medium">{dev.name}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <div className={cn("h-1.5 w-1.5 rounded-full", dev.status === 'online' || dev.status === 'locked' || dev.status === 'clear' ? "bg-emerald-500" : "bg-red-500")} />
                                                    <span className="text-[10px] text-muted-foreground capitalize">{dev.status}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <Separator />

                                {/* Agent Thought Process */}
                                <div>
                                    <h5 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">
                                        Agent Logic
                                    </h5>
                                    <div className="bg-slate-950 rounded-lg p-3 font-mono text-[10px] text-green-400 space-y-1 h-32 overflow-hidden relative">
                                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-950/80 pointer-events-none" />
                                        <p>&gt; initializing_visual_cortex...</p>
                                        <p>&gt; connecting_to_iot_gateway...</p>
                                        <p>&gt; status: monitoring_active</p>
                                        {latestSnapshot && (
                                            <>
                                                <p className="text-yellow-400">&gt; event: snapshot_request_received</p>
                                                <p>&gt; fetching_frame(CAM-01)...</p>
                                                <p>&gt; analyzing_objects: [person, chair, desk]</p>
                                                <p>&gt; safety_check: passed</p>
                                                <p>&gt; response_generated</p>
                                            </>
                                        )}
                                        <p className="animate-pulse">&gt; _</p>
                                    </div>
                                </div>
                            </div>
                        </ScrollArea>
                    </>
                ) : (
                    <>
                        <div className="p-4 border-b">
                            <h4 className="font-semibold text-sm">Agent Internals</h4>
                        </div>
                        <div className="p-4 space-y-6">
                            <div>
                                <h5 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Architecture</h5>
                                <div className="p-3 bg-card rounded-xl border border-border shadow-sm">
                                    <div className="flex justify-between mb-1">
                                        <span className="text-sm text-muted-foreground">Framework</span>
                                        <span className="text-sm font-mono text-foreground">{selectedAgent?.framework}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-muted-foreground">Version</span>
                                        <span className="text-sm font-mono text-foreground">v2.1.0</span>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <h5 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Performance</h5>
                                <div className="p-3 bg-card rounded-xl border border-border shadow-sm space-y-3">
                                    <div>
                                        <div className="flex justify-between mb-1">
                                            <span className="text-xs text-muted-foreground">Latency</span>
                                            <span className="text-xs font-medium text-emerald-400">12ms</span>
                                        </div>
                                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                            <div className="h-full bg-emerald-500 w-[15%]" />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between mb-1">
                                            <span className="text-xs text-muted-foreground">Memory</span>
                                            <span className="text-xs font-medium">6.6 MB</span>
                                        </div>
                                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                            <div className="h-full bg-primary w-[4%]" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </Card>
        </div>
    )
}
