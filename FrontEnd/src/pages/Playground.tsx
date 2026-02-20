
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
    Bug,
    GitBranch,
    Play
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
import { useNavigation } from "../contexts/NavigationContext"
import { api } from "../utils/api"
import { FlowExecutionTimeline } from "../components/flows/FlowExecutionTimeline"
import { FlowExecutionStats } from "../components/flows/FlowExecutionStats"
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
    personality_prompt: string | null
    role: string | null // Conteúdo técnico vindo do template
    created_at: string
    updated_at: string
    channels: Channel[] | string | any // jsonb - array de objetos { id, name } ou string JSON
}

interface Flow {
    id: string
    name: string
    created_at?: string
}

export function Playground() {
    const { user, userId } = useAuth()
    const { navigate } = useNavigation()
    const [agents, setAgents] = useState<Agent[]>([])
    const [flows, setFlows] = useState<Flow[]>([])
    const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
    const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null)
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [inputValue, setInputValue] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [isExecutingFlow, setIsExecutingFlow] = useState(false)
    const [flowExecutionHistory, setFlowExecutionHistory] = useState<any[]>([])
    const [currentStepIndex, setCurrentStepIndex] = useState<number | undefined>(undefined)
    const [activeChannel, setActiveChannel] = useState<string>("webchat")

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
            try { recognitionRef.current.start() } catch (e) { }
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
                try { recognition.start() } catch (e) { }
            }
        }
        recognitionRef.current = recognition
        try { recognition.start() } catch (e) { }
    }

    useEffect(() => {
        if (user?.email) {
            loadAgents()
            loadFlows()
        }
    }, [user])

    const loadFlows = async () => {
        if (!user?.email || !userId) {
            console.log('[Playground] loadFlows: user.email ou userId não disponível')
            return
        }

        console.log('[Playground] Carregando flows para:', user.email)

        try {
            // 1. Buscar companies_id a partir do user_id
            const { data: companyUser, error: companyError } = await supabase
                .from('tb_company_users')
                .select('companies_id')
                .eq('user_id', userId)
                .maybeSingle()

            if (companyError || !companyUser?.companies_id) {
                console.error('[Playground] Erro ao buscar companies_id:', companyError)
                setFlows([])
                return
            }

            const companiesId = companyUser.companies_id

            // 2. Filtrar por companies_id
            const { data, error } = await supabase
                .from('tb_flows')
                .select('id, name, created_at')
                .eq('companies_id', companiesId)
                .order('created_at', { ascending: false })

            if (error) {
                console.error('[Playground] Erro ao carregar flows:', error)
                // Se a tabela não existir, apenas loga o erro
                if (error.code !== 'PGRST116') {
                    toast.error('Erro ao carregar flows')
                }
                setFlows([])
                return
            }

            console.log('[Playground] Flows carregados:', data?.length || 0, data)
            setFlows(data || [])
        } catch (error) {
            console.error('[Playground] Erro ao carregar flows:', error)
            setFlows([])
        }
    }

    const handleSelectFlow = (flow: Flow) => {
        setSelectedFlow(flow)
        setSelectedAgent(null) // Limpa agente selecionado
        setMessages([]) // Limpa mensagens
    }

    const handleExecuteFlow = async () => {
        if (!selectedFlow || !user?.email) {
            toast.error('Flow ou usuário não encontrado')
            return
        }

        setIsExecutingFlow(true)
        setMessages([])
        setFlowExecutionHistory([])
        setCurrentStepIndex(undefined)

        try {
            const response = await fetch('http://192.168.15.31:3333/flows/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    flow_id: selectedFlow.id,
                    email: user.email,
                    initial_data: {} // Dados iniciais vazios por padrão
                })
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.details || 'Erro ao executar flow')
            }

            const result = await response.json()

            // Processa o histórico de execução para a timeline
            const processedHistory = (result.executionHistory || []).map((h: any, idx: number) => ({
                nodeId: h.nodeId || `Node ${idx + 1}`,
                agentId: h.agentId,
                success: h.success !== false, // Default true se não especificado
                output: h.output,
                error: h.error,
                qrCode: h.qrCode, // Inclui o QR code se vier do backend
                timestamp: Date.now() - ((result.executionHistory.length - idx) * 100), // Simula timestamps
                duration: h.duration || Math.floor(Math.random() * 500) + 100 // Simula duração se não houver
            }))

            setFlowExecutionHistory(processedHistory)

            // Mostra mensagem de sucesso apenas se não houver erros
            const hasErrors = processedHistory.some((h: any) => !h.success)
            if (!hasErrors) {
                toast.success(`Flow executado com sucesso! ${result.nodesExecuted || processedHistory.length} node(s) processado(s)`)
            } else {
                toast.warning(`Flow executado com ${processedHistory.filter((h: any) => !h.success).length} erro(s)`)
            }
        } catch (error: any) {
            console.error('Erro ao executar flow:', error)
            toast.error(`Erro ao executar flow: ${error.message}`)

            // Adiciona erro ao histórico
            setFlowExecutionHistory([
                {
                    nodeId: 'Erro de Execução',
                    success: false,
                    error: error.message,
                    timestamp: Date.now()
                }
            ])
        } finally {
            setIsExecutingFlow(false)
            setCurrentStepIndex(undefined)
        }
    }

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
                    personalityPrompt: item.personality_prompt || undefined,
                    templateRole: item.role || undefined,
                    systemPrompt: item.personality_prompt || undefined, // Mantendo por compatibilidade com o editor atual do playground
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
        setSelectedFlow(null) // Limpa flow selecionado
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
            const response = await fetch('http://192.168.15.31:3333/agents/chat', {
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
        switch (channel) {
            case 'whatsapp': return <MessageCircle className="h-4 w-4" />;
            case 'webchat': return <MessageSquare className="h-4 w-4" />;
            case 'email': return <Mail className="h-4 w-4" />;
            case 'linkedin': return <Linkedin className="h-4 w-4" />;
            case 'phone': return <Phone className="h-4 w-4" />;
            default: return <Bot className="h-4 w-4" />;
        }
    }

    // Efeito para gerenciar a chamada de voz
    useEffect(() => {
        if (isCallActive) {
            startListening()
            callTimerRef.current = setInterval(() => {
                setCallDuration(prev => prev + 1)
            }, 1000)
        } else {
            if (recognitionRef.current) recognitionRef.current.stop()
            if (synthesisRef.current) synthesisRef.current.cancel()
            clearInterval(callTimerRef.current)
            setCallDuration(0)
        }
        return () => clearInterval(callTimerRef.current)
    }, [isCallActive])

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
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
        <div className="flex h-screen w-full bg-[#F0F5FA] overflow-hidden font-sans selection:bg-blue-100 p-6 gap-6">

            {/* SIDEBAR: COLUNA DE COMANDO */}
            <aside className="w-[320px] shrink-0 bg-white rounded-[2.5rem] shadow-xl shadow-blue-900/5 flex flex-col overflow-hidden border-2 border-white">
                <div className="h-28 flex items-center px-10 border-b-2 border-slate-50">
                    <h2 className="font-black flex items-center gap-3 text-[10px] uppercase tracking-[0.4em] text-blue-600">
                        <Cpu className="h-5 w-5" />
                        Laboratório
                    </h2>
                </div>

                <ScrollArea className="flex-1">
                    <div className="p-8 space-y-12 pb-32">
                        {/* Fluxos */}
                        <div className="space-y-5">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">Workflows Ativos</span>
                            <div className="space-y-1.5">
                                {flows.map(flow => (
                                    <button
                                        key={flow.id}
                                        onClick={() => handleSelectFlow(flow)}
                                        className="w-full text-left px-5 py-4 rounded-2xl text-xs flex items-center gap-4 transition-all duration-300 group"
                                        style={{
                                            backgroundColor: selectedFlow?.id === flow.id ? '#2563eb' : 'transparent',
                                            color: selectedFlow?.id === flow.id ? 'white' : '#64748b',
                                            boxShadow: selectedFlow?.id === flow.id ? '0 10px 20px -5px rgba(37, 99, 235, 0.3)' : 'none'
                                        }}
                                    >
                                        <GitBranch size={16} className={selectedFlow?.id === flow.id ? 'opacity-100' : 'opacity-40'} />
                                        <span className="truncate font-black uppercase tracking-tight">{flow.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Agentes */}
                        <div className="space-y-5">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">Agentes Disponíveis</span>
                            <div className="space-y-1.5">
                                {agents.map(agent => (
                                    <button
                                        key={agent.id}
                                        onClick={() => handleSelectAgent(agent)}
                                        className="w-full text-left px-5 py-4 rounded-2xl flex items-center gap-5 transition-all duration-300 group"
                                        style={{
                                            backgroundColor: selectedAgent?.id === agent.id ? '#2563eb' : 'transparent',
                                            boxShadow: selectedAgent?.id === agent.id ? '0 10px 20px -5px rgba(37, 99, 235, 0.3)' : 'none'
                                        }}
                                    >
                                        <div className="relative shrink-0">
                                            <div
                                                className="h-10 w-10 rounded-xl border-2 border-white flex items-center justify-center text-white font-black text-[10px] shadow-sm transform transition-transform group-active:scale-90"
                                                style={{ backgroundColor: selectedAgent?.id === agent.id ? 'rgba(255,255,255,0.2)' : '#60a5fa' }}
                                            >
                                                {agent.avatar}
                                            </div>
                                            <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-white" />
                                        </div>
                                        <span
                                            className="truncate font-black uppercase text-[10px] tracking-tight"
                                            style={{ color: selectedAgent?.id === agent.id ? 'white' : '#1e293b' }}
                                        >
                                            {agent.name}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </ScrollArea>
            </aside>

            {/* PAINEL CENTRAL */}
            <main className="flex-1 flex flex-col bg-white rounded-[2.5rem] shadow-2xl shadow-blue-900/10 overflow-hidden border-[6px] border-white relative min-w-0">

                {/* HEADER FIXO */}
                <header className="h-28 border-b-2 border-slate-50 flex items-center justify-between px-12 bg-white shrink-0">
                    <div className="flex items-center gap-6">
                        <div className="h-14 w-14 rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-blue-500/30 shrink-0" style={{ backgroundColor: '#2563eb' }}>
                            {selectedFlow ? <GitBranch size={24} strokeWidth={3} /> : <Bot size={24} strokeWidth={2.5} />}
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-black text-2xl text-slate-900 tracking-tighter truncate leading-none mb-2">
                                {selectedFlow ? selectedFlow.name : selectedAgent?.name}
                            </h3>
                            <div className="flex items-center gap-3">
                                <p className="text-[9px] font-black text-blue-500 uppercase tracking-[0.4em]">Simulação Hosteada</p>
                                {selectedAgent?.channels && selectedAgent.channels.length > 1 && (
                                    <div className="flex items-center gap-1.5 ml-2 bg-slate-50 p-1 rounded-lg border border-slate-100">
                                        {selectedAgent.channels.map(ch => (
                                            <button
                                                key={ch}
                                                onClick={() => setActiveChannel(ch)}
                                                className={`p-1 rounded transition-all ${activeChannel === ch ? 'bg-white shadow-sm text-blue-600 scale-110' : 'text-slate-300 hover:text-slate-400'}`}
                                                title={ch.toUpperCase()}
                                            >
                                                {getChannelIcon(ch)}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {selectedFlow && (
                            <Button
                                onClick={handleExecuteFlow}
                                disabled={isExecutingFlow}
                                className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] px-8 h-11 shadow-xl shadow-blue-500/20"
                            >
                                {isExecutingFlow ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2 fill-current" />}
                                Executar Fluxo
                            </Button>
                        )}

                        {selectedAgent && (
                            <>
                                <Button
                                    variant={isCallActive ? "destructive" : "outline"}
                                    onClick={() => setIsCallActive(!isCallActive)}
                                    className={`rounded-2xl border-2 font-black text-[9px] uppercase tracking-[0.2em] px-6 h-11 transition-all ${isCallActive ? 'shadow-lg shadow-red-500/20 animate-pulse' : 'text-slate-500 border-slate-100 hover:text-blue-600 hover:border-blue-200 shadow-sm'}`}
                                >
                                    {isCallActive ? <PhoneOff className="h-4 w-4 mr-2" /> : <Phone className="h-4 w-4 mr-2" />}
                                    {isCallActive ? formatDuration(callDuration) : 'Voz'}
                                </Button>

                                <Button
                                    variant="outline"
                                    onClick={() => navigate(`agent-config?id=${selectedAgent.id}`)}
                                    className="rounded-2xl border-2 border-slate-100 font-black text-[9px] uppercase tracking-[0.2em] px-6 h-11 text-slate-500 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/50 transition-all shadow-sm"
                                >
                                    <Settings2 className="h-4 w-4 mr-2" />
                                    Configurador
                                </Button>
                            </>
                        )}
                    </div>
                </header>

                <div className="flex-1 flex overflow-hidden min-h-0">
                    {/* ÁREA DE CHAT OU EXECUÇÃO DE FLOW */}
                    <section className="flex-1 flex flex-col bg-[#F8FAFC] relative overflow-hidden">
                        <ScrollArea className="flex-1">
                            {selectedFlow ? (
                                <div className="p-12 space-y-10">
                                    {(isExecutingFlow || flowExecutionHistory.length > 0) ? (
                                        <div className="max-w-5xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                            <FlowExecutionStats
                                                executionHistory={flowExecutionHistory}
                                                isExecuting={isExecutingFlow}
                                            />
                                            <FlowExecutionTimeline
                                                executionHistory={flowExecutionHistory}
                                                currentStepIndex={currentStepIndex}
                                                isExecuting={isExecutingFlow}
                                            />
                                        </div>
                                    ) : (
                                        <div className="py-24 text-center flex flex-col items-center opacity-40">
                                            <div className="h-24 w-24 rounded-[3.5rem] bg-white shadow-xl flex items-center justify-center mb-8 border-4 border-white">
                                                <GitBranch size={40} className="text-blue-100" strokeWidth={3} />
                                            </div>
                                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.6em] ml-2">Pronto para Executar</h4>
                                            <p className="text-[11px] font-bold text-slate-300 mt-4 max-w-xs leading-relaxed">
                                                Clique em "Executar Fluxo" no topo para disparar a simulação deste workflow.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="max-w-3xl mx-auto px-12 pt-12 pb-44 space-y-8">
                                    {messages.length === 0 && (
                                        <div className="py-24 text-center flex flex-col items-center opacity-40">
                                            <div className="h-24 w-24 rounded-[3rem] bg-white shadow-xl flex items-center justify-center mb-8 border-4 border-white">
                                                <MessageSquare size={40} className="text-blue-100" strokeWidth={3} />
                                            </div>
                                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.6em] ml-2">Sandbox Pronta</h4>
                                        </div>
                                    )}

                                    {messages.map((msg, i) => {
                                        const isUser = msg.role === 'user';
                                        return (
                                            <div key={i} className={`flex w-full animate-in fade-in slide-in-from-bottom-3 duration-500 ${isUser ? 'justify-end' : 'justify-start'}`}>
                                                <div
                                                    className={`p-7 rounded-[2.5rem] max-w-[85%] shadow-lg font-bold text-sm leading-relaxed ${isUser ? 'text-white rounded-br-none' : 'bg-white text-slate-700 border-2 border-slate-50 rounded-bl-none shadow-blue-900/5'}`}
                                                    style={{ backgroundColor: isUser ? '#2563eb' : undefined }}
                                                >
                                                    {msg.content}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </ScrollArea>

                        {/* INPUT FLUTUANTE PINADO */}
                        <div className="absolute bottom-0 left-0 right-0 p-12 bg-gradient-to-t from-[#F8FAFC] via-[#F8FAFC]/90 to-transparent z-40">
                            <div className="max-w-3xl mx-auto relative flex items-center">
                                <Input
                                    className="h-16 pl-8 pr-36 rounded-[2rem] border-4 border-white shadow-2xl bg-white/95 backdrop-blur-xl text-base font-bold focus-visible:ring-[#2563eb] transition-all placeholder:text-slate-300"
                                    placeholder="Inicie um teste agora..."
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                />
                                <Button
                                    onClick={() => handleSendMessage()}
                                    className="absolute right-3.5 h-10 px-8 rounded-2xl text-white font-black shadow-xl hover:translate-x-1 transition-transform"
                                    style={{ backgroundColor: '#2563eb' }}
                                >
                                    ENVIAR
                                </Button>
                            </div>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}
