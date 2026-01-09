import { useEffect, useRef, useState } from "react"
import { 
    Send, 
    Bot, 
    User, 
    MoreVertical, 
    Trash2, 
    RefreshCw,
    MessageSquare,
    Settings2,
    Phone,
    PhoneOff,
    Mic,
    MicOff,
    MessageCircle,
    Mail,
    Globe,
    Linkedin,
    Plus,
    Loader2,
    Sparkles,
    Terminal,
    Code,
    Cpu,
    Database,
    Bug
} from "lucide-react"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar"
import { ScrollArea } from "../components/ui/scroll-area"
import { Separator } from "../components/ui/separator"
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger,
    DropdownMenuLabel,
    DropdownMenuSeparator
} from "../components/ui/dropdown-menu"
import { Badge } from "../components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"
import { Slider } from "../components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs"
import { Textarea } from "../components/ui/textarea"
import { AgentService, Agent, ChatMessage } from "../services/api"
import { AgentConfigSheet } from "../components/agents/AgentConfigSheet"
import { motion, AnimatePresence } from "motion/react"
import { toast } from "sonner@2.0.3"

export function Playground() {
    const [agents, setAgents] = useState<Agent[]>([])
    const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [inputValue, setInputValue] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [isConfigOpen, setIsConfigOpen] = useState(false)
    const [activeChannel, setActiveChannel] = useState<string>("webchat")
    const [showDebug, setShowDebug] = useState(true)
    
    // Simulation Config State
    const [temp, setTemp] = useState([0.7])
    const [systemPromptOverride, setSystemPromptOverride] = useState("")

    // Voice State
    const [isCallActive, setIsCallActive] = useState(false)
    const [isMuted, setIsMuted] = useState(false)
    const [callDuration, setCallDuration] = useState(0)
    const [isSpeaking, setIsSpeaking] = useState(false)
    const recognitionRef = useRef<any>(null)
    const synthesisRef = useRef<SpeechSynthesis | null>(null)
    
    // Seed State
    const [isSeeding, setIsSeeding] = useState(false)

    const scrollRef = useRef<HTMLDivElement>(null)
    const callTimerRef = useRef<NodeJS.Timeout | null>(null)

    // --- VOICE IMPLEMENTATION (Web Speech API) ---
    useEffect(() => {
        // Initialize Synthesis
        if (typeof window !== 'undefined') {
            synthesisRef.current = window.speechSynthesis
        }
        
        return () => {
            if (recognitionRef.current) recognitionRef.current.stop()
            if (synthesisRef.current) synthesisRef.current.cancel()
        }
    }, [])

    const getAgentLocale = () => {
        if (!selectedAgent?.languages?.[0]) return 'en-US'
        const lang = selectedAgent.languages[0].toLowerCase()
        if (lang.includes('portuguese')) return 'pt-BR'
        if (lang.includes('spanish')) return 'es-ES'
        if (lang.includes('german')) return 'de-DE'
        if (lang.includes('french')) return 'fr-FR'
        return 'en-US'
    }

    const speak = (text: string) => {
        if (!synthesisRef.current || isMuted) return

        // Cancel previous utterances
        synthesisRef.current.cancel()

        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = getAgentLocale()
        utterance.rate = 1.0
        utterance.pitch = 1.0

        // Attempt to find a matching voice
        const voices = synthesisRef.current.getVoices()
        // Try to find a "Google" voice for better quality if available, or just matching lang
        const preferredVoice = voices.find(v => 
            v.lang === utterance.lang && v.name.includes('Google')
        ) || voices.find(v => v.lang === utterance.lang)
        
        if (preferredVoice) utterance.voice = preferredVoice

        utterance.onstart = () => {
            setIsSpeaking(true)
            // Pause recognition while speaking to avoid self-loop
            if (recognitionRef.current) recognitionRef.current.stop()
        }

        utterance.onend = () => {
            setIsSpeaking(false)
            // Resume listening if call is still active
            if (isCallActive) {
                startListening()
            }
        }
        
        utterance.onerror = () => {
            setIsSpeaking(false)
            if (isCallActive) startListening()
        }

        synthesisRef.current.speak(utterance)
    }

    const startListening = () => {
        if (!isCallActive) return

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        if (!SpeechRecognition) {
            toast.error("Browser does not support Voice API")
            return
        }

        if (recognitionRef.current) {
            try {
                recognitionRef.current.start()
            } catch(e) {
                // Already started or error
            }
            return
        }

        const recognition = new SpeechRecognition()
        recognition.lang = getAgentLocale()
        recognition.continuous = false // Turn-based
        recognition.interimResults = false

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript
            if (transcript) {
                handleSendMessage(transcript) // Send directly
            }
        }

        recognition.onend = () => {
            // If call is active and NOT speaking, restart listening (keep-alive)
            if (isCallActive && !synthesisRef.current?.speaking) {
                try {
                    recognition.start()
                } catch(e) {
                    // Ignore start errors
                }
            }
        }

        recognition.onerror = async (event: any) => {
            console.warn("Speech Error:", event.error)
            
            if (event.error === 'not-allowed') {
                setIsCallActive(false)
                
                // Try to diagnose WHY it is not allowed
                try {
                    const permissionStatus = await navigator.permissions.query({ name: 'microphone' as any })
                    
                    if (permissionStatus.state === 'granted') {
                        toast.error("Microphone blocked by Preview Environment (Iframe). Please use Text Chat.")
                    } else {
                        toast.error("Microphone permission denied. Please allow access in browser settings.")
                    }
                } catch (e) {
                    toast.error("Microphone access unavailable in this environment.")
                }
            } else if (event.error === 'no-speech') {
                // Ignore silence, just restart if needed or let the loop handle it
                return
            } else {
                toast.error(`Voice Error: ${event.error}`)
                setIsCallActive(false)
            }
        }

        recognitionRef.current = recognition
        try {
            recognition.start()
        } catch (e) {
            console.error("Failed to start recognition:", e)
        }
    }
    // ---------------------------------------------

    useEffect(() => {
        loadAgents()
    }, [])

    useEffect(() => {
        if (selectedAgent) {
            // Reset override when agent changes
            setSystemPromptOverride(selectedAgent.systemPrompt || `You are ${selectedAgent.name}. Role: ${selectedAgent.role}.`)
        }
    }, [selectedAgent])

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: "smooth" })
        }
    }, [messages, isCallActive])

    useEffect(() => {
        if (isCallActive) {
            callTimerRef.current = setInterval(() => {
                setCallDuration(prev => prev + 1)
            }, 1000)
        } else {
            if (callTimerRef.current) clearInterval(callTimerRef.current)
            setCallDuration(0)
        }
        return () => {
            if (callTimerRef.current) clearInterval(callTimerRef.current)
        }
    }, [isCallActive])

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    const loadAgents = async () => {
        setIsLoading(true)
        try {
            const data = await AgentService.listAgents()
            setAgents(data)
            if (data.length > 0) {
                // If we have agents but none selected, select the first one
                if (!selectedAgent) {
                    handleSelectAgent(data[0])
                } else {
                    // Update the currently selected agent with fresh data
                    const updated = data.find(a => a.id === selectedAgent.id)
                    if (updated) setSelectedAgent(updated)
                }
            } else {
                setSelectedAgent(null)
            }
        } catch (error: any) {
            if (error.name !== 'TypeError' && error.message !== 'Failed to fetch') {
                console.error("Failed to load agents", error)
            }
            toast.error("Could not load agents")
        } finally {
            setIsLoading(false)
        }
    }

    const handleCreateDemoAgents = async () => {
        setIsSeeding(true)
        try {
            await AgentService.createAgent({
                name: "Sonia Support",
                role: "Customer Success AI",
                description: "Expert in technical support and customer satisfaction. Empathetic and precise.",
                channels: ["webchat", "whatsapp", "email"],
                languages: ["English", "Portuguese", "Spanish"],
                avatar: "S"
            })
            
            await AgentService.createAgent({
                name: "Marcus Sales",
                role: "Senior SDR",
                description: "Aggressive but polite sales representative focused on qualifying leads and booking meetings.",
                channels: ["phone", "linkedin", "email"],
                languages: ["English", "German"],
                avatar: "M"
            })
            
            toast.success("Demo workforce deployed successfully!")
            await loadAgents()
        } catch (e) {
            toast.error("Failed to create demo agents")
        } finally {
            setIsSeeding(false)
        }
    }

    const handleSelectAgent = (agent: Agent) => {
        setSelectedAgent(agent)
        setMessages([])
        setIsCallActive(false)
        
        // Default to first available channel or webchat
        if (agent.channels && agent.channels.length > 0) {
            setActiveChannel(agent.channels[0])
        } else {
            setActiveChannel('webchat')
        }
    }

    const handleSendMessage = async (textOverride?: string) => {
        const textToSend = typeof textOverride === 'string' ? textOverride : inputValue
        if (!textToSend.trim() || !selectedAgent) return

        const userMsg: ChatMessage = { role: 'user', content: textToSend }
        setMessages(prev => [...prev, userMsg])
        setInputValue("")
        setIsLoading(true)
        
        // Stop listening while processing
        if (recognitionRef.current) recognitionRef.current.stop()

        try {
            const response = await AgentService.chatWithAgent(selectedAgent.id, [...messages, userMsg], { channel: activeChannel })
            setMessages(prev => [...prev, response])
            
            // If in Voice Mode, speak the response
            if (isCallActive) {
                speak(response.content)
            }
        } catch (error: any) {
            if (error.name !== 'TypeError' && error.message !== 'Failed to fetch') {
                console.error("Chat error", error)
            }
            setMessages(prev => [...prev, { 
                role: 'system', 
                content: 'Error: Could not reach agent. Please check connection.' 
            }])
        } finally {
            setIsLoading(false)
        }
    }

    const handleStartCall = async () => {
        if (!selectedAgent) return
        
        setIsCallActive(true)
        setIsLoading(true)
        setMessages([{ role: "system", content: "Connecting to secure voice gateway..." }])
        
        try {
            // Send a hidden system instruction to trigger a greeting
            // The user won't see this message in the UI because we filter 'system' roles in the chat view 
            // (or we can just append the response).
            // Actually, for the "Call" UI, we want to show the transcript.
            
            const response = await AgentService.chatWithAgent(selectedAgent.id, [
                { role: 'user', content: "(System: The user has initiated a voice call. Please greet them concisely based on your role.)" }
            ], { channel: 'voice' })
            
            setMessages(prev => [...prev, response])
            
            // Speak the greeting
            speak(response.content)
            
        } catch (e) {
            setMessages(prev => [...prev, { role: "system", content: "Connection failed." }])
            setIsCallActive(false)
        } finally {
            setIsLoading(false)
        }
    }

    const handleEndCall = () => {
        setIsCallActive(false)
        setIsSpeaking(false)
        setMessages(prev => [...prev, { role: "system", content: "Call ended." }])
        
        if (recognitionRef.current) recognitionRef.current.stop()
        if (synthesisRef.current) synthesisRef.current.cancel()
    }

    const getChannelIcon = (channel: string) => {
        switch(channel) {
            case 'whatsapp': return <MessageCircle className="h-4 w-4" />;
            case 'webchat': return <MessageSquare className="h-4 w-4" />;
            case 'email': return <Mail className="h-4 w-4" />;
            case 'linkedin': return <Linkedin className="h-4 w-4" />;
            case 'phone': return <Phone className="h-4 w-4" />;
            default: return <Bot className="h-4 w-4" />;
        }
    }

    const getChannelColor = (channel: string) => {
        switch(channel) {
            case 'whatsapp': return "bg-[#e5ddd5] dark:bg-[#0b141a]"; // WhatsApp background color
            case 'phone': return "bg-slate-900 text-white";
            default: return "bg-background";
        }
    }

    // EMPTY STATE - NO AGENTS
    if (!isLoading && agents.length === 0) {
        return (
            <div className="flex h-[calc(100vh-2rem)] border rounded-lg overflow-hidden bg-background shadow-sm items-center justify-center">
                <div className="text-center max-w-md p-6 space-y-6">
                    <div className="bg-primary/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Bot className="h-10 w-10 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight">No Agents Configured</h2>
                    <p className="text-muted-foreground">
                        Your workspace is empty. Deploy our standard demo workforce to start testing the platform immediately.
                    </p>
                    <Button onClick={handleCreateDemoAgents} disabled={isSeeding} size="lg" className="gap-2">
                        {isSeeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        {isSeeding ? "Deploying Agents..." : "Deploy Demo Agents"}
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex h-[calc(100vh-2rem)] border rounded-lg overflow-hidden bg-background shadow-sm">
             {/* Config Sheet for quick edits */}
             <AgentConfigSheet 
                agent={selectedAgent} 
                isOpen={isConfigOpen} 
                onClose={() => setIsConfigOpen(false)}
                onSave={async (id, updates) => {
                    await AgentService.updateAgent(id, updates)
                    loadAgents()
                }}
            />

            {/* Sidebar - Agent List */}
            <div className="w-64 border-r bg-muted/10 flex flex-col hidden md:flex">
                <div className="p-4 border-b flex justify-between items-center">
                    <h2 className="font-semibold flex items-center gap-2">
                        <Bot className="h-5 w-5 text-primary" />
                        Workforce
                    </h2>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
                <ScrollArea className="flex-1">
                    <div className="p-2 space-y-1">
                        {agents.map(agent => (
                            <button
                                key={agent.id}
                                onClick={() => handleSelectAgent(agent)}
                                className={`w-full text-left px-3 py-3 rounded-md text-sm flex items-center gap-3 transition-colors ${
                                    selectedAgent?.id === agent.id 
                                        ? "bg-primary/10 text-primary font-medium" 
                                        : "hover:bg-muted"
                                }`}
                            >
                                <Avatar className="h-8 w-8">
                                    <AvatarFallback className={selectedAgent?.id === agent.id ? "bg-primary text-primary-foreground" : ""}>
                                        {agent.avatar}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="overflow-hidden flex-1">
                                    <div className="flex justify-between items-center">
                                        <p className="truncate font-medium">{agent.name}</p>
                                        <span className="text-[10px] uppercase text-muted-foreground">{agent.languages?.[0] || "EN"}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        {agent.channels?.slice(0, 3).map(c => (
                                            <span key={c} className="text-muted-foreground/60">{getChannelIcon(c)}</span>
                                        ))}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </ScrollArea>
            </div>

            {/* Main Interaction Area */}
            <div className="flex-1 flex flex-col relative">
                {/* Header */}
                <div className="h-14 border-b flex items-center justify-between px-6 bg-background z-10 shadow-sm">
                    <div className="flex items-center gap-4">
                        {selectedAgent ? (
                            <>
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-9 w-9 border">
                                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                            {selectedAgent.avatar}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <h3 className="font-semibold text-sm leading-none">{selectedAgent.name}</h3>
                                        <span className="text-xs text-muted-foreground">{selectedAgent.role}</span>
                                    </div>
                                </div>
                                <Separator orientation="vertical" className="h-6" />
                                <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className="gap-1 font-normal">
                                        <Globe className="h-3 w-3" />
                                        {selectedAgent.languages?.[0] || "EN"}
                                    </Badge>
                                    
                                    <Select value={activeChannel} onValueChange={setActiveChannel}>
                                        <SelectTrigger className="h-7 text-xs w-[130px] bg-muted/50 border-none">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <DropdownMenuLabel className="text-xs text-muted-foreground">Available Channels</DropdownMenuLabel>
                                            <DropdownMenuSeparator />
                                            {(selectedAgent.channels || ['webchat']).map(c => (
                                                <SelectItem key={c} value={c} className="text-xs">
                                                    <div className="flex items-center gap-2">
                                                        {getChannelIcon(c)}
                                                        <span className="capitalize">{c === 'phone' ? 'Voice Call' : c}</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Bot className="h-5 w-5" />
                                <span className="text-sm">Select an agent to start</span>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <Button 
                            variant={showDebug ? "secondary" : "ghost"} 
                            size="icon" 
                            onClick={() => setShowDebug(!showDebug)} 
                            title="Toggle Debug Panel"
                            className="hidden md:flex"
                        >
                            <Terminal className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setIsConfigOpen(true)} title="Quick Config" disabled={!selectedAgent}>
                            <Settings2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                         <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <MoreVertical className="h-4 w-4 text-muted-foreground" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setMessages([])}>
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Reset Session
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    <div className="flex-1 flex flex-col relative min-w-0 bg-background">
                        {/* NO AGENT SELECTED STATE */}
                        {!selectedAgent && (
                            <div className="flex-1 flex items-center justify-center bg-muted/5">
                        <div className="text-center text-muted-foreground">
                            <Bot className="h-12 w-12 mx-auto mb-4 opacity-20" />
                            <p>Please select an agent from the sidebar.</p>
                        </div>
                    </div>
                )}

                {/* Dynamic Channel Interface */}
                {selectedAgent && activeChannel === 'phone' ? (
                    // ---------------- VOIP INTERFACE ----------------
                    <div className="flex-1 bg-slate-950 flex flex-col items-center justify-center p-8 text-white relative overflow-hidden">
                        {/* Ambient Background Animation */}
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-950 to-slate-950"></div>

                        {!isCallActive ? (
                            <div className="z-10 text-center space-y-8 animate-in zoom-in-95 duration-500">
                                <Avatar className="h-32 w-32 border-4 border-slate-800 mx-auto shadow-2xl">
                                    <AvatarFallback className="bg-slate-800 text-4xl text-white">
                                        {selectedAgent?.avatar}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="space-y-2">
                                    <h2 className="text-3xl font-light tracking-tight">{selectedAgent?.name}</h2>
                                    <p className="text-slate-400">{selectedAgent?.role}</p>
                                </div>
                                <Button 
                                    size="lg" 
                                    className="h-16 w-16 rounded-full bg-emerald-500 hover:bg-emerald-600 shadow-[0_0_40px_-10px_rgba(16,185,129,0.5)] transition-all hover:scale-110"
                                    onClick={handleStartCall}
                                >
                                    <Phone className="h-8 w-8" />
                                </Button>
                                <p className="text-xs text-slate-500 uppercase tracking-widest mt-8">Ready to Connect</p>
                            </div>
                        ) : (
                            <div className="z-10 w-full max-w-md flex flex-col items-center justify-between h-full py-8 animate-in fade-in duration-500">
                                <div className="text-center space-y-2">
                                    <div className="relative">
                                        <Avatar className="h-24 w-24 border-2 border-slate-700 mx-auto">
                                            <AvatarFallback className="bg-slate-800 text-2xl text-white">
                                                {selectedAgent?.avatar}
                                            </AvatarFallback>
                                        </Avatar>
                                        {/* Speaking indicator ring */}
                                        {messages.length > 0 && messages[messages.length-1].role === 'assistant' && !isLoading && (
                                            <span className="absolute inset-0 rounded-full border-2 border-emerald-500 animate-ping opacity-75"></span>
                                        )}
                                    </div>
                                    <h3 className="text-xl font-medium">{selectedAgent?.name}</h3>
                                    <p className="text-slate-400 text-sm font-mono">{formatTime(callDuration)}</p>
                                </div>

                                {/* Live Transcription Area */}
                                <div className="w-full bg-slate-900/50 backdrop-blur-sm rounded-xl p-4 min-h-[120px] max-h-[200px] overflow-y-auto border border-white/5">
                                    <ScrollArea className="h-full">
                                        <div className="space-y-3">
                                            {messages.slice(-3).map((msg, i) => (
                                                msg.role !== 'system' && (
                                                    <div key={i} className={`text-sm ${msg.role === 'user' ? 'text-right text-indigo-300' : 'text-left text-slate-300'}`}>
                                                        <span className="text-[10px] uppercase opacity-50 block mb-1">{msg.role === 'user' ? 'You' : 'Agent'}</span>
                                                        {msg.content}
                                                    </div>
                                                )
                                            ))}
                                            {isLoading && (
                                                <div className="text-left">
                                                    <span className="text-xs text-slate-500 animate-pulse">Agent is thinking...</span>
                                                </div>
                                            )}
                                            {isSpeaking && (
                                                <div className="text-left">
                                                    <span className="text-xs text-emerald-500 animate-pulse">Agent is speaking...</span>
                                                </div>
                                            )}
                                            {isCallActive && !isLoading && !isSpeaking && (
                                                <div className="text-right">
                                                    <span className="text-xs text-indigo-400 animate-pulse">Listening... (Speak now)</span>
                                                </div>
                                            )}
                                        </div>
                                    </ScrollArea>
                                </div>

                                {/* Voice Controls */}
                                <div className="space-y-6 w-full">
                                    {/* Mock Waveform */}
                                    <div className="flex items-center justify-center gap-1 h-8">
                                        {[...Array(20)].map((_, i) => (
                                            <motion.div 
                                                key={i}
                                                className={`w-1 rounded-full ${isSpeaking ? 'bg-emerald-400' : 'bg-emerald-500/30'}`}
                                                animate={{ 
                                                    height: isSpeaking || isLoading
                                                        ? [10, Math.random() * 32, 10] 
                                                        : 4 
                                                }}
                                                transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.05 }}
                                            />
                                        ))}
                                    </div>

                                    <div className="flex items-center justify-center gap-6">
                                        <Button 
                                            variant="outline" 
                                            size="icon" 
                                            className={`h-14 w-14 rounded-full border-none bg-slate-800 hover:bg-slate-700 text-white ${isMuted ? 'bg-white text-slate-900 hover:bg-slate-200' : ''}`}
                                            onClick={() => setIsMuted(!isMuted)}
                                        >
                                            {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                                        </Button>
                                        <Button 
                                            variant="destructive" 
                                            size="icon" 
                                            className="h-16 w-16 rounded-full bg-red-500 hover:bg-red-600 shadow-lg"
                                            onClick={handleEndCall}
                                        >
                                            <PhoneOff className="h-8 w-8" />
                                        </Button>
                                    </div>
                                    
                                    {/* Text Input Fallback for Voice Mode */}
                                    <div className="relative">
                                        <Input 
                                            placeholder="Type to speak..." 
                                            className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-600 pr-10"
                                            value={inputValue}
                                            onChange={e => setInputValue(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                                        />
                                        <Button 
                                            size="icon" 
                                            className="absolute right-1 top-1 h-8 w-8 bg-transparent hover:bg-slate-800 text-slate-400"
                                            onClick={handleSendMessage}
                                        >
                                            <Send className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : selectedAgent ? (
                    // ---------------- TEXT INTERFACE (WhatsApp / Webchat) ----------------
                    <div className={`flex-1 flex flex-col ${getChannelColor(activeChannel)} relative`}>
                        {activeChannel === 'whatsapp' && (
                            <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')" }}></div>
                        )}

                        <ScrollArea className="flex-1 p-4 z-10 h-full">
                            <div className="flex flex-col gap-4 max-w-3xl mx-auto py-4 min-h-full justify-end">
                                {messages.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground opacity-50">
                                        {activeChannel === 'whatsapp' ? <MessageCircle className="h-12 w-12 mb-4" /> : <MessageSquare className="h-12 w-12 mb-4" />}
                                        <p>Start a {activeChannel} conversation with {selectedAgent?.name}.</p>
                                    </div>
                                ) : (
                                    messages.map((msg, idx) => (
                                        <div 
                                            key={idx} 
                                            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                                        >
                                            {activeChannel !== 'whatsapp' && (
                                                <Avatar className="h-8 w-8 mt-1">
                                                    {msg.role === 'user' ? (
                                                        <AvatarFallback className="bg-muted"><User className="h-4 w-4" /></AvatarFallback>
                                                    ) : (
                                                        <AvatarFallback className="bg-primary/10 text-primary">
                                                            {selectedAgent?.avatar}
                                                        </AvatarFallback>
                                                    )}
                                                </Avatar>
                                            )}
                                            
                                            <div className={`
                                                max-w-[80%] rounded-lg p-3 text-sm shadow-sm
                                                ${activeChannel === 'whatsapp' 
                                                    ? (msg.role === 'user' ? 'bg-[#dcf8c6] dark:bg-[#005c4b] text-foreground' : 'bg-white dark:bg-[#202c33] text-foreground')
                                                    : (msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted')
                                                }
                                            `}>
                                                {msg.content}
                                            </div>
                                        </div>
                                    ))
                                )}
                                {isLoading && (
                                    <div className="flex gap-3">
                                        <Avatar className="h-8 w-8 mt-1">
                                            <AvatarFallback className="bg-primary/10 text-primary">
                                                {selectedAgent?.avatar}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="bg-muted rounded-lg p-3 w-16">
                                            <div className="flex gap-1 justify-center">
                                                <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                                <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                                <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div ref={scrollRef} />
                            </div>
                        </ScrollArea>

                        {/* Input Area */}
                        <div className={`p-4 border-t ${activeChannel === 'whatsapp' ? 'bg-[#f0f2f5] dark:bg-[#202c33]' : 'bg-background'}`}>
                            <div className="max-w-3xl mx-auto flex gap-2">
                                <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground">
                                    <Plus className="h-5 w-5" />
                                </Button>
                                <Input 
                                    className={`flex-1 ${activeChannel === 'whatsapp' ? 'bg-white dark:bg-[#2a3942] border-none' : ''}`}
                                    placeholder="Type a message..."
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                    disabled={isLoading}
                                />
                                {inputValue.trim() ? (
                                    <Button onClick={handleSendMessage} size="icon" disabled={isLoading}>
                                        <Send className="h-4 w-4" />
                                    </Button>
                                ) : (
                                    <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground">
                                        <Mic className="h-5 w-5" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                ) : null}

                    </div>
                    {/* DEBUG PANEL - RIGHT SIDE */}
                    {selectedAgent && showDebug && activeChannel !== 'phone' && (
                        <div className="w-80 border-l bg-background flex flex-col animate-in slide-in-from-right duration-300 h-full">
                        <div className="h-14 border-b flex items-center px-4 font-semibold text-sm bg-muted/20">
                            <Terminal className="h-4 w-4 mr-2" />
                            Simulation Context
                        </div>
                        <ScrollArea className="flex-1 p-4">
                            <Tabs defaultValue="system">
                                <TabsList className="w-full mb-4">
                                    <TabsTrigger value="system" className="flex-1 text-xs">System</TabsTrigger>
                                    <TabsTrigger value="memory" className="flex-1 text-xs">Memory</TabsTrigger>
                                    <TabsTrigger value="logs" className="flex-1 text-xs">Logs</TabsTrigger>
                                </TabsList>
                                
                                <TabsContent value="system" className="space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <label className="text-xs font-medium text-muted-foreground">Temperature</label>
                                            <span className="text-xs text-muted-foreground">{temp[0]}</span>
                                        </div>
                                        <Slider defaultValue={[0.7]} max={1} step={0.1} value={temp} onValueChange={setTemp} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-muted-foreground">System Prompt Override</label>
                                        <Textarea 
                                            className="text-xs font-mono h-[300px] resize-none" 
                                            value={systemPromptOverride}
                                            onChange={e => setSystemPromptOverride(e.target.value)}
                                        />
                                        <Button size="sm" variant="secondary" className="w-full text-xs h-7">
                                            Apply Changes
                                        </Button>
                                    </div>
                                </TabsContent>
                                
                                <TabsContent value="memory" className="space-y-4">
                                    <div className="rounded-md border bg-muted/30 p-2">
                                        <div className="flex items-center gap-2 mb-2 text-xs font-medium text-emerald-500">
                                            <Database className="h-3 w-3" />
                                            Active RAG Chunks
                                        </div>
                                        <div className="text-[10px] font-mono text-muted-foreground space-y-2">
                                            <div className="p-2 bg-background rounded border">
                                                <span className="text-emerald-500 font-bold">Chunk #142 (92% match)</span>
                                                <p className="mt-1 line-clamp-3">...pricing for the Enterprise tier starts at $5,000/mo and includes dedicated support...</p>
                                            </div>
                                            <div className="p-2 bg-background rounded border">
                                                <span className="text-emerald-500 font-bold">Chunk #088 (85% match)</span>
                                                <p className="mt-1 line-clamp-3">...SLA uptime guarantees are calculated on a monthly basis excluding maintenance windows...</p>
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="logs">
                                    <div className="space-y-2 font-mono text-[10px]">
                                        {messages.map((m, i) => (
                                            <div key={i} className="border-b pb-1 mb-1 last:border-0">
                                                <span className={m.role === 'user' ? 'text-blue-500' : 'text-green-500'}>[{m.role.toUpperCase()}]</span>
                                                <span className="text-muted-foreground ml-2">Token usage: ~{(m.content.length / 4).toFixed(0)}</span>
                                            </div>
                                        ))}
                                        {messages.length === 0 && <span className="text-muted-foreground italic">No logs yet...</span>}
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </ScrollArea>
                    </div>
                    )}
                </div>
            </div>
        </div>
    )
}