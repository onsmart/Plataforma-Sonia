
import React, { useEffect, useRef, useState } from "react"
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
import { toast } from "sonner"
import { supabase } from "../utils/supabase/client"
import { useAuth } from "../contexts/AuthContext"

interface Channel {
    id: string
    name: string
}

interface PlaygroundAgent {
    id: string
    nome: string
    role_template_id: string | null
    primary_language: string | null
    bio: string | null
    integrations_id: string | null
    provider: string | null
    provider_model: string | null
    temperature: number | null
    max_tokens: number | null
    system_instructions: string | null
    created_at: string
    updated_at: string
    channels: Channel[] | string | any // jsonb - array de objetos { id, name } ou string JSON
}

export function Playground() {
    const { user } = useAuth()
    const [agents, setAgents] = useState<Agent[]>([])
    const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [inputValue, setInputValue] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [isConfigOpen, setIsConfigOpen] = useState(false)
    const [activeChannel, setActiveChannel] = useState<string>("webchat")
    const [showDebug, setShowDebug] = useState(true)
    
    // Simulation Config State - Alimentados pelo banco
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
    const callTimerRef = useRef<any>(null)

    // --- VOICE IMPLEMENTATION ---
    useEffect(() => {
        if (typeof window !== 'undefined') {
            synthesisRef.current = window.speechSynthesis
        }
        return () => {
            if (recognitionRef.current) recognitionRef.current.stop()
            if (synthesisRef.current) synthesisRef.current.cancel()
        }
    }, [])

    const getAgentLocale = () => {
        if (!selectedAgent?.languages?.[0]) return 'pt-BR'
        const lang = selectedAgent.languages[0].toLowerCase()
        if (lang.includes('portuguese')) return 'pt-BR'
        if (lang.includes('spanish')) return 'es-ES'
        if (lang.includes('german')) return 'de-DE'
        if (lang.includes('french')) return 'fr-FR'
        return 'en-US'
    }

    const speak = (text: string) => {
        if (!synthesisRef.current || isMuted) return
        synthesisRef.current.cancel()
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = getAgentLocale()
        const voices = synthesisRef.current.getVoices()
        const preferredVoice = voices.find(v => v.lang === utterance.lang && v.name.includes('Google')) || voices.find(v => v.lang === utterance.lang)
        if (preferredVoice) utterance.voice = preferredVoice
        utterance.onstart = () => {
            setIsSpeaking(true)
            if (recognitionRef.current) recognitionRef.current.stop()
        }
        utterance.onend = () => {
            setIsSpeaking(false)
            if (isCallActive) startListening()
        }
        synthesisRef.current.speak(utterance)
    }

    const startListening = () => {
        if (!isCallActive) return
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        if (!SpeechRecognition) return
        if (recognitionRef.current) {
            try { recognitionRef.current.start() } catch(e) {}
            return
        }
        const recognition = new SpeechRecognition()
        recognition.lang = getAgentLocale()
        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript
            if (transcript) handleSendMessage(transcript)
        }
        recognition.onend = () => {
            if (isCallActive && !synthesisRef.current?.speaking) {
                try { recognition.start() } catch(e) {}
            }
        }
        recognitionRef.current = recognition
        try { recognition.start() } catch (e) {}
    }

    useEffect(() => {
        if (user?.email) {
            loadAgents()
        }
    }, [user])

    // Quando o agente muda, sincronizamos os estados de debug com os dados reais do banco
    useEffect(() => {
        if (selectedAgent) {
            setSystemPromptOverride(selectedAgent.systemPrompt || "")
            setTemp([selectedAgent.modelConfig?.temperature ?? 0.7])
        }
    }, [selectedAgent])

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollIntoView({ behavior: "smooth" })
    }, [messages, isCallActive])

    const loadAgents = async () => {
        if (!user?.email) {
            toast.error("Usuário não autenticado")
            return
        }

        setIsLoading(true)
        try {
            const { data, error } = await supabase.rpc('sp_get_agents_playground_by_email', {
                p_user_email: user.email
            })

            if (error) {
                console.error("Erro ao buscar agentes:", error)
                toast.error("Erro ao carregar agentes")
                return
            }

            // Mapear os dados da API para o formato Agent
            const mappedAgents: Agent[] = (data || []).map((item: PlaygroundAgent) => {
                // Parse channels - pode ser array de objetos { id, name } ou string JSON
                let channels: string[] = []
                if (item.channels) {
                    if (typeof item.channels === 'string') {
                        try {
                            const parsed = JSON.parse(item.channels)
                            // Se for array de objetos, extrair os names
                            if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
                                channels = parsed.map((ch: Channel) => ch.name || ch.id)
                            } else if (Array.isArray(parsed)) {
                                channels = parsed
                            }
                        } catch {
                            channels = []
                        }
                    } else if (Array.isArray(item.channels)) {
                        // Se for array de objetos, extrair os names
                        if (item.channels.length > 0 && typeof item.channels[0] === 'object' && item.channels[0] !== null) {
                            channels = item.channels.map((ch: Channel) => ch.name || ch.id)
                        } else {
                            channels = item.channels
                        }
                    }
                }

                // Criar avatar a partir da primeira letra do nome
                const avatar = item.nome ? item.nome.charAt(0).toUpperCase() : 'A'

                // Mapear primary_language para languages array
                const languages = item.primary_language ? [item.primary_language] : ['ENGLISH']

                return {
                    id: item.id,
                    name: item.nome,
                    role: item.bio || '',
                    description: item.bio || '',
                    status: 'active' as const,
                    channels: channels.length > 0 ? channels : ['webchat'],
                    languages: languages,
                    avatar: avatar,
                    systemPrompt: item.system_instructions || undefined,
                    modelConfig: {
                        provider: item.provider || 'openai',
                        model: item.provider_model || 'gpt-4o',
                        temperature: item.temperature !== null ? item.temperature : 0.7,
                        maxTokens: item.max_tokens !== null ? Number(item.max_tokens) : 1000,
                        apiKey: ''
                    },
                    metrics: {
                        conversations: 0,
                        csat: '0%',
                        avgResponseTime: '0s'
                    }
                }
            })

            setAgents(mappedAgents)
            if (mappedAgents.length > 0 && !selectedAgent) {
                handleSelectAgent(mappedAgents[0])
            }
        } catch (error) {
            console.error("Erro ao carregar agentes:", error)
            toast.error("Erro ao carregar agentes")
        } finally {
            setIsLoading(false)
        }
    }

    const handleSelectAgent = (agent: Agent) => {
        setSelectedAgent(agent)
        setMessages([])
        setIsCallActive(false)
        if (agent.channels && agent.channels.length > 0) {
            setActiveChannel(agent.channels[0])
        } else {
            setActiveChannel('webchat')
        }
    }

    const handleSendMessage = async (textOverride?: string) => {
        const textToSend = typeof textOverride === 'string' ? textOverride : inputValue
        if (!textToSend.trim() || !selectedAgent || !user?.email) return

        const userMsg: ChatMessage = { role: 'user', content: textToSend }
        setMessages(prev => [...prev, userMsg])
        setInputValue("")
        setIsLoading(true)
        
        try {
            const response = await fetch('http://localhost:3333/agents/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: user.email,
                    agent_id: selectedAgent.id,
                    message: textToSend
                })
            })

            if (!response.ok) {
                throw new Error(response.statusText)
                throw new Error('Erro ao enviar mensagem')
            }

            const data = await response.json()
            const assistantMsg: ChatMessage = { role: 'assistant', content: data.reply || 'Sem resposta' }
            setMessages(prev => [...prev, assistantMsg])
            if (isCallActive) speak(assistantMsg.content)
        } catch (error) {
            console.error('Erro ao conversar com o agente:', error)
            setMessages(prev => [...prev, { role: 'system', content: 'Erro de conexão com o agente.' }])
            toast.error('Erro ao enviar mensagem')
        } finally {
            setIsLoading(false)
        }
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

    if (!isLoading && agents.length === 0) {
        return (
            <div className="flex h-[calc(100vh-2rem)] items-center justify-center bg-background border rounded-lg">
                <div className="text-center space-y-4">
                    <Bot className="h-12 w-12 mx-auto text-primary/40" />
                    <h2 className="text-xl font-semibold">Nenhum agente ativo</h2>
                    <p className="text-muted-foreground">Configure seus agentes no Agents Hub primeiro.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex h-[calc(100vh-2rem)] border rounded-lg overflow-hidden bg-background shadow-sm">
             <AgentConfigSheet 
                agent={selectedAgent} 
                isOpen={isConfigOpen} 
                onClose={() => setIsConfigOpen(false)}
                onSave={async () => loadAgents()}
            />

            <div className="w-64 border-r bg-muted/10 flex flex-col hidden md:flex">
                <div className="p-4 border-b">
                    <h2 className="font-semibold flex items-center gap-2">
                        <Bot className="h-5 w-5 text-primary" />
                        Workforce
                    </h2>
                </div>
                <ScrollArea className="flex-1">
                    <div className="p-2 space-y-1">
                        {agents.map(agent => (
                            <button
                                key={agent.id}
                                onClick={() => handleSelectAgent(agent)}
                                className={`w-full text-left px-3 py-3 rounded-md text-sm flex items-center gap-3 transition-colors ${
                                    selectedAgent?.id === agent.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                                }`}
                            >
                                <Avatar className="h-8 w-8">
                                    <AvatarFallback className={selectedAgent?.id === agent.id ? "bg-primary text-primary-foreground" : ""}>
                                        {agent.avatar}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="overflow-hidden flex-1">
                                    <p className="truncate font-medium">{agent.name}</p>
                                    <div className="flex items-center gap-1 mt-0.5">
                                        <span className="text-xs text-muted-foreground truncate">{agent.role || 'Agent'}</span>
                                        {agent.languages?.[0] && (
                                            <Badge variant="outline" className="text-[9px] px-1 h-4 ml-1">
                                                {agent.languages[0].toUpperCase().slice(0, 2)}
                                            </Badge>
                                        )}
                                        {agent.channels?.slice(0, 2).map((c: string) => (
                                            <span key={c} className="text-muted-foreground/60">{getChannelIcon(c)}</span>
                                        ))}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </ScrollArea>
            </div>

            <div className="flex-1 flex flex-col relative">
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
                                    <Badge variant="secondary" className="gap-1 font-normal uppercase text-[10px]">
                                        <Globe className="h-3 w-3" />
                                        {selectedAgent.languages?.[0] || "PT"}
                                    </Badge>
                                    
                                    <Select value={activeChannel} onValueChange={setActiveChannel}>
                                        <SelectTrigger className="h-7 text-xs w-[130px] bg-muted/50 border-none capitalize">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {(selectedAgent.channels || ['webchat']).map((c: string) => (
                                                <SelectItem key={c} value={c} className="text-xs">
                                                    <div className="flex items-center gap-2">
                                                        {getChannelIcon(c)}
                                                        <span className="capitalize">{c}</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </>
                        ) : null}
                    </div>
                    <div className="flex items-center gap-1">
                        <Button variant={showDebug ? "outline" : "ghost"} size="icon" onClick={() => setShowDebug(!showDebug)} className="hidden md:flex">
                            <Terminal className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setIsConfigOpen(true)} disabled={!selectedAgent}>
                            <Settings2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    <div className={`flex-1 flex flex-col relative min-w-0 bg-background ${activeChannel === 'whatsapp' ? 'bg-[#e5ddd5] dark:bg-[#0b141a]' : ''}`}>
                        <ScrollArea className="flex-1 p-4 z-10">
                            <div className="flex flex-col gap-4 max-w-3xl mx-auto py-4 min-h-full justify-end">
                                {messages.map((msg, idx) => (
                                    <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                        <div className={`max-w-[80%] rounded-lg p-3 text-sm shadow-sm ${
                                            msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                                        }`}>
                                            {msg.content}
                                        </div>
                                    </div>
                                ))}
                                {isLoading && <div className="flex gap-2 p-2 bg-muted rounded-lg w-16 animate-pulse" />}
                                <div ref={scrollRef} />
                            </div>
                        </ScrollArea>

                        <div className="p-4 border-t bg-background">
                            <div className="max-w-3xl mx-auto flex gap-2">
                                <Input 
                                    className="flex-1"
                                    placeholder="Digite sua mensagem..."
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                    disabled={isLoading}
                                />
                                <Button onClick={() => handleSendMessage()} size="icon" disabled={isLoading || !inputValue.trim()}>
                                    <Send className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    {selectedAgent && showDebug && (
                        <div className="w-80 border-l bg-background flex flex-col animate-in slide-in-from-right duration-300">
                            <div className="h-14 border-b flex items-center px-4 font-semibold text-sm bg-muted/20">
                                <Terminal className="h-4 w-4 mr-2" />
                                Simulation Context
                            </div>
                            <ScrollArea className="flex-1 p-4">
                                <Tabs defaultValue="system">
                                    <TabsList className="w-full mb-4">
                                        <TabsTrigger value="system" className="flex-1 text-xs">System</TabsTrigger>
                                        <TabsTrigger value="memory" className="flex-1 text-xs">Memory</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="system" className="space-y-4">
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <label className="text-xs font-medium text-muted-foreground">Temperature</label>
                                                <span className="text-xs text-muted-foreground">{temp[0]}</span>
                                            </div>
                                            <Slider min={0} max={1} step={0.1} value={temp} onValueChange={setTemp} disabled={true} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-medium text-muted-foreground">System Prompt</label>
                                            <Textarea 
                                                className="text-xs font-mono h-[300px] resize-none" 
                                                value={systemPromptOverride}
                                                onChange={e => setSystemPromptOverride(e.target.value)}
                                                disabled={true}
                                            />
                                        </div>
                                    </TabsContent>
                                    <TabsContent value="memory">
                                        <div className="text-[10px] font-mono text-muted-foreground italic">
                                            No context window active...
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
