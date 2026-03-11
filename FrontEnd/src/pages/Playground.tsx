
import React, { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip"
import { Info } from "lucide-react"
import { useTheme } from "next-themes"

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
    status_id: number | null // ID do status: 1=ativo, 2=cancelado, 3=pausado, null/undefined=inativo
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
    const { theme } = useTheme()
    const { user, userId } = useAuth()
    const { navigate } = useNavigation()
    const { t } = useTranslation('playground')
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

    // Função para capitalizar nomes de agentes
    const formatAgentName = (name: string | undefined): string => {
        if (!name) return ''
        return name.split(' - ').map(part => 
            part.split(' ').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            ).join(' ')
        ).join(' - ')
    }

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
        if (user?.email && userId) {
            loadAgents()
            loadFlows()
        }
    }, [user, userId])

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
                    toast.error(t('errors.loadFlows'))
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
            toast.error(t('errors.flowOrUserNotFound'))
            return
        }

        setIsExecutingFlow(true)
        setMessages([])
        setFlowExecutionHistory([])
        setCurrentStepIndex(undefined)

        try {
            const { BASE_URL } = await import('../services/api')
            const { supabase } = await import('../utils/supabase/client')
            
            // ✅ Obter token de autenticação
            const { data: { session } } = await supabase.auth.getSession()
            const token = session?.access_token
            
            if (!token) {
                throw new Error('Token de autenticação não encontrado. Faça login novamente.')
            }
            
            const response = await fetch(`${BASE_URL}/flows/execute`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    flow_id: selectedFlow.id,
                    email: user.email,
                    initial_data: {} // Dados iniciais vazios por padrão
                })
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.details || t('errors.executeFlow'))
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
                toast.success(t('success.flowExecuted', { count: result.nodesExecuted || processedHistory.length }))
            } else {
                toast.warning(t('warning.flowExecutedWithErrors', { count: processedHistory.filter((h: any) => !h.success).length }))
            }
        } catch (error: any) {
            console.error('Erro ao executar flow:', error)
            toast.error(t('errors.executeFlowError', { message: error.message }))

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
            toast.error(t('errors.userNotAuthenticated'))
            return
        }

        setIsLoading(true)
        try {
            // Usar a mesma RPC do AgentsHub que retorna status_id
            const { data, error } = await supabase.rpc('sp_list_agents_by_email', {
                p_email: user.email
            })

            if (error) {
                console.error("Erro ao buscar agentes:", error)
                toast.error(t('errors.loadAgents'))
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

                // Processar status_id
                let statusId: number | null = null
                if (item.status_id !== null && item.status_id !== undefined) {
                    statusId = typeof item.status_id === 'string' ? parseInt(item.status_id, 10) : Number(item.status_id)
                    if (isNaN(statusId)) {
                        statusId = null
                    }
                }

                // Mapear status_id para status string (para compatibilidade)
                let status: 'active' | 'paused' | 'error' = 'paused' // Padrão: pausado/inativo
                if (statusId === 1) {
                    status = 'active' // Conectado/Funcionando
                } else if (statusId === 2) {
                    status = 'error' // Cancelado
                } else if (statusId === 3 || statusId === 4) {
                    status = 'paused' // Pausado
                }

                return {
                    id: item.id,
                    name: item.nome,
                    role: item.bio || '',
                    description: item.bio || '',
                    status: status,
                    status_id: statusId, // Incluir status_id no objeto
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
            toast.error(t('errors.loadAgents'))
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
            const { BASE_URL } = await import('../services/api')
            const response = await fetch(`${BASE_URL}/agents/chat`, {
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
                throw new Error(t('errors.sendMessage'))
            }

            const data = await response.json()
            const assistantMsg: ChatMessage = { role: 'assistant', content: data.reply || t('errors.noResponse') }
            setMessages(prev => [...prev, assistantMsg])
            if (isCallActive) speak(assistantMsg.content)
        } catch (error) {
            console.error('Erro ao conversar com o agente:', error)
            setMessages(prev => [...prev, { role: 'system', content: t('errors.connectionError') }])
            toast.error(t('errors.sendMessage'))
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
                    <h2 className="text-xl font-semibold">{t('empty.noAgents')}</h2>
                    <p className="text-muted-foreground">{t('empty.createAgentsFirst')}</p>
                </div>
            </div>
        )
    }

    return (
        <TooltipProvider>
            <div className="flex h-screen w-full bg-[#F0F5FA] overflow-hidden font-sans selection:bg-blue-100 p-6 gap-6">
            <style>{`
                .playground-sidebar-scroll::-webkit-scrollbar {
                    width: 6px;
                }
                .playground-sidebar-scroll::-webkit-scrollbar-track {
                    background: transparent;
                }
                .playground-sidebar-scroll::-webkit-scrollbar-thumb {
                    background-color: #cbd5e1;
                    border-radius: 3px;
                }
                .playground-sidebar-scroll::-webkit-scrollbar-thumb:hover {
                    background-color: #94a3b8;
                }
                .playground-sidebar-scroll {
                    scrollbar-width: thin;
                    scrollbar-color: #cbd5e1 transparent;
                }
            `}</style>

            {/* SIDEBAR: COLUNA DE COMANDO */}
            <aside className="w-[320px] shrink-0 rounded-[2.5rem] shadow-xl flex flex-col overflow-hidden border-2 shrink-0" style={{
                backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#ffffff',
                boxShadow: theme === 'dark' ? '0 20px 40px rgba(0, 0, 0, 0.3)' : '0 20px 40px rgba(0, 0, 0, 0.05)'
            }}>
                <div className="h-28 flex items-center px-10 border-b-2 shrink-0" style={{
                    borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0'
                }}>
                    <h2 className="font-black flex items-center gap-3 text-[10px] uppercase tracking-[0.4em]" style={{ color: theme === 'dark' ? '#22d3ee' : '#0891b2' }}>
                        <Cpu className="h-5 w-5" />
                        {t('header.title')}
                    </h2>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Info className="h-4 w-4 ml-2 cursor-help" style={{ color: theme === 'dark' ? '#64748b' : '#94a3b8' }} />
                        </TooltipTrigger>
                        <TooltipContent className="bg-slate-900 text-white border-slate-700 max-w-xs">
                            <p className="text-xs font-bold mb-1">{t('header.title')}</p>
                            <p className="text-xs text-slate-300">{t('header.description')}</p>
                        </TooltipContent>
                    </Tooltip>
                </div>

                <div className="flex-1 overflow-y-auto playground-sidebar-scroll">
                    <div className="p-8 space-y-12 pb-32">
                        {/* Fluxos */}
                        <div className="space-y-5">
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black uppercase tracking-[0.2em] px-2" style={{ color: theme === 'dark' ? '#64748b' : '#94a3b8' }}>{t('sidebar.automationsAvailable')}</span>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Info className="h-3 w-3 cursor-help" style={{ color: theme === 'dark' ? '#475569' : '#cbd5e1' }} />
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-slate-900 text-white border-slate-700 max-w-xs">
                                        <p className="text-xs font-bold mb-1">{t('sidebar.automations')}</p>
                                        <p className="text-xs text-slate-300">{t('sidebar.automationsDescription')}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                            <div className="space-y-2">
                                {flows.length === 0 ? (
                                    <div className="p-4 text-center">
                                        <p className="text-[9px] font-medium" style={{ color: theme === 'dark' ? '#64748b' : '#94a3b8' }}>
                                            {t('sidebar.noAutomations')}
                                        </p>
                                    </div>
                                ) : (
                                    flows.map(flow => {
                                        const isSelected = selectedFlow?.id === flow.id
                                        return (
                                            <button
                                                key={flow.id}
                                                onClick={() => handleSelectFlow(flow)}
                                                className={`w-full p-4 flex items-center transition-all duration-300 group relative overflow-hidden rounded-[1.8rem] ${
                                                    isSelected 
                                                        ? 'shadow-2xl' 
                                                        : 'bg-slate-100 hover:bg-slate-200 border-2 border-slate-200 hover:border-slate-300'
                                                }`}
                                                style={isSelected ? {
                                                    background: 'linear-gradient(135deg, #0891b2 0%, #22d3ee 100%)',
                                                    color: '#ffffff',
                                                    boxShadow: '0 20px 40px -10px rgba(8, 145, 178, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1) inset',
                                                    transform: 'scale(1.05)',
                                                    borderRadius: '1.8rem'
                                                } : {
                                                    borderRadius: '1.8rem',
                                                    backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f8fafc',
                                                    borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0'
                                                }}
                                            >
                                                {isSelected && (
                                                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 animate-shimmer" style={{ borderRadius: '1.8rem' }} />
                                                )}
                                                <div className="relative shrink-0 z-10">
                                                    <div
                                                        className="h-10 w-10 border-2 flex items-center justify-center shadow-lg transform transition-transform group-active:scale-90"
                                                        style={isSelected ? {
                                                            backgroundColor: 'rgba(255, 255, 255, 0.25)',
                                                            borderColor: 'rgba(255, 255, 255, 0.4)',
                                                            color: '#ffffff',
                                                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                                                            borderRadius: '1.5rem'
                                                        } : {
                                                            backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0',
                                                            borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : '#cbd5e1',
                                                            color: theme === 'dark' ? '#e2e8f0' : '#475569',
                                                            borderRadius: '1.5rem'
                                                        }}
                                                    >
                                                        <GitBranch 
                                                            size={18} 
                                                            strokeWidth={isSelected ? 2.5 : 2}
                                                            style={{ color: isSelected ? '#ffffff' : (theme === 'dark' ? '#cbd5e1' : '#334155') }}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5 relative z-10 flex-1 min-w-0" style={{ marginLeft: '4px' }}>
                                                    <span
                                                        className="truncate font-black uppercase text-[10px] tracking-tight text-center"
                                                        style={{ color: isSelected ? '#ffffff' : (theme === 'dark' ? '#e2e8f0' : '#334155') }}
                                                    >
                                                        {flow.name}
                                                    </span>
                                                </div>
                                            </button>
                                        )
                                    })
                                )}
                            </div>
                        </div>

                        {/* Agentes */}
                        <div className="space-y-5">
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black uppercase tracking-[0.2em] px-2" style={{ color: theme === 'dark' ? '#64748b' : '#94a3b8' }}>{t('sidebar.agentsAvailable')}</span>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Info className="h-3 w-3 cursor-help" style={{ color: theme === 'dark' ? '#475569' : '#cbd5e1' }} />
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-slate-900 text-white border-slate-700 max-w-xs">
                                        <p className="text-xs font-bold mb-1">{t('sidebar.agents')}</p>
                                        <p className="text-xs text-slate-300">{t('sidebar.agentsDescription')}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                            <div className="space-y-2">
                                {agents.map(agent => {
                                    const isSelected = selectedAgent?.id === agent.id
                                    return (
                                        <button
                                            key={agent.id}
                                            onClick={() => handleSelectAgent(agent)}
                                            className={`w-full p-4 flex items-center transition-all duration-300 group relative overflow-hidden rounded-[1.8rem] ${
                                                isSelected 
                                                    ? 'shadow-2xl' 
                                                    : 'bg-slate-100 hover:bg-slate-200 border-2 border-slate-200 hover:border-slate-300'
                                            }`}
                                            style={isSelected ? {
                                                background: 'linear-gradient(135deg, #0891b2 0%, #22d3ee 100%)',
                                                color: '#ffffff',
                                                boxShadow: '0 20px 40px -10px rgba(8, 145, 178, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1) inset',
                                                transform: 'scale(1.05)',
                                                borderRadius: '1.8rem'
                                            } : {
                                                borderRadius: '1.8rem',
                                                backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f8fafc',
                                                borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0'
                                            }}
                                        >
                                            {isSelected && (
                                                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 animate-shimmer" style={{ borderRadius: '1.8rem' }} />
                                            )}
                                            <div className="relative shrink-0 z-10">
                                                <div
                                                    className="h-10 w-10 border-2 flex items-center justify-center font-black text-[10px] shadow-lg transform transition-transform group-active:scale-90"
                                                    style={isSelected ? {
                                                        backgroundColor: 'rgba(255, 255, 255, 0.25)',
                                                        borderColor: 'rgba(255, 255, 255, 0.4)',
                                                        color: '#ffffff',
                                                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                                                        borderRadius: '1.5rem'
                                                    } : {
                                                        backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0',
                                                        borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : '#cbd5e1',
                                                        color: theme === 'dark' ? '#e2e8f0' : '#475569',
                                                        borderRadius: '1.5rem'
                                                    }}
                                                >
                                                    {agent.avatar}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 relative z-10 flex-1 min-w-0" style={{ marginLeft: '4px' }}>
                                                <div 
                                                    className="h-2.5 w-2.5 rounded-full border-2 shrink-0"
                                                    style={{ 
                                                        backgroundColor: (agent.status_id === 1)
                                                            ? (isSelected ? '#34d399' : '#10b981') // emerald - Ativo
                                                            : (agent.status_id === 3 || agent.status_id === 4)
                                                            ? (isSelected ? '#fbbf24' : '#eab308') // yellow - Pausado
                                                            : (isSelected ? '#f87171' : '#ef4444'), // red - Cancelado/Inativo (inclui null/undefined)
                                                        borderColor: isSelected ? '#ffffff' : '#ffffff',
                                                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                                                    }}
                                                />
                                                <span
                                                    className="truncate font-black uppercase text-[10px] tracking-tight text-center"
                                                    style={{ color: isSelected ? '#ffffff' : (theme === 'dark' ? '#e2e8f0' : '#334155') }}
                                                >
                                                    {agent.name}
                                                </span>
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* PAINEL CENTRAL */}
            <main className="flex-1 flex flex-col rounded-[2.5rem] shadow-2xl overflow-hidden border-[6px] relative min-w-0" style={{
                backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#ffffff',
                boxShadow: theme === 'dark' ? '0 20px 40px rgba(0, 0, 0, 0.3)' : '0 20px 40px rgba(0, 0, 0, 0.05)'
            }}>

                {/* HEADER FIXO */}
                <header className="h-28 border-b-2 flex items-center justify-between px-12 shrink-0" style={{
                    backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                    borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0'
                }}>
                    <div className="flex items-center gap-6">
                        <div className="h-14 w-14 rounded-2xl flex items-center justify-center text-white shadow-2xl shrink-0" style={{ background: 'linear-gradient(135deg, #0891b2 0%, #22d3ee 100%)', boxShadow: theme === 'dark' ? '0 0 20px rgba(34, 211, 238, 0.4), 0 8px 20px rgba(8, 145, 178, 0.3)' : '0 8px 20px rgba(8, 145, 178, 0.3)' }}>
                            {selectedFlow ? <GitBranch size={24} strokeWidth={3} /> : <Bot size={24} strokeWidth={2.5} />}
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-black text-2xl tracking-tighter truncate leading-none mb-2" style={{
                                color: theme === 'dark' ? '#e2e8f0' : '#0f172a'
                            }}>
                                {selectedFlow ? selectedFlow.name : formatAgentName(selectedAgent?.name)}
                            </h3>
                            <div className="flex items-center gap-3">
                                <p className="text-[9px] font-black uppercase tracking-[0.4em]" style={{ color: theme === 'dark' ? '#22d3ee' : '#0891b2' }}>{t('header.testEnvironment')}</p>
                                {selectedAgent?.channels && selectedAgent.channels.length > 1 && (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="flex items-center gap-1.5 ml-2 bg-slate-50 p-1 rounded-lg border border-slate-100">
                                                {selectedAgent.channels.map(ch => (
                                                    <button
                                                        key={ch}
                                                        onClick={() => setActiveChannel(ch)}
                                                        className={`p-1 rounded transition-all ${activeChannel === ch ? 'bg-white shadow-sm text-blue-600 scale-110' : 'text-slate-300 hover:text-slate-400'}`}
                                                    >
                                                        {getChannelIcon(ch)}
                                                    </button>
                                                ))}
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent className="bg-slate-900 text-white border-slate-700">
                                            <p className="text-xs">{t('header.availableChannels')}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {selectedFlow && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        onClick={handleExecuteFlow}
                                        disabled={isExecutingFlow}
                                        className="rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] px-8 h-11 shadow-xl"
                                        style={{
                                            background: isExecutingFlow ? '#94a3b8' : 'linear-gradient(135deg, #0891b2 0%, #22d3ee 100%)',
                                            color: '#ffffff',
                                            border: 'none',
                                            boxShadow: isExecutingFlow 
                                                ? '0 4px 12px rgba(0, 0, 0, 0.1)' 
                                                : (theme === 'dark' 
                                                    ? '0 0 20px rgba(34, 211, 238, 0.4), 0 8px 20px rgba(8, 145, 178, 0.3)' 
                                                    : '0 8px 20px rgba(8, 145, 178, 0.4)')
                                        }}
                                    >
                                        {isExecutingFlow ? <RefreshCw className="h-4 w-4 animate-spin mr-2" style={{ color: '#ffffff' }} /> : <Play className="h-4 w-4 mr-2 fill-current" style={{ color: '#ffffff' }} />}
                                        <span style={{ color: '#ffffff' }}>{t('button.executeAutomation')}</span>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent className="bg-slate-900 text-white border-slate-700 max-w-xs">
                                    <p className="text-xs font-bold mb-1">{t('button.executeAutomation')}</p>
                                    <p className="text-xs text-slate-300">{t('button.executeAutomationDescription')}</p>
                                </TooltipContent>
                            </Tooltip>
                        )}

                        {selectedAgent && (
                            <>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant={isCallActive ? "destructive" : "outline"}
                                            onClick={() => setIsCallActive(!isCallActive)}
                                            className={`rounded-2xl border-2 font-black text-[9px] uppercase tracking-[0.2em] px-6 h-11 transition-all ${isCallActive ? 'shadow-lg shadow-red-500/20' : 'shadow-sm'}`}
                                            style={!isCallActive ? {
                                                backgroundColor: '#ffffff',
                                                borderColor: '#0891b2',
                                                color: '#0891b2',
                                                borderWidth: '2px',
                                                boxShadow: theme === 'dark'
                                                    ? '0 0 20px rgba(34, 211, 238, 0.3), 0 4px 12px rgba(8, 145, 178, 0.2)'
                                                    : '0 0 20px rgba(8, 145, 178, 0.3), 0 4px 12px rgba(8, 145, 178, 0.2)',
                                                animation: 'pulse-glow 2s ease-in-out infinite'
                                            } : {}}
                                        >
                                            <style>{`
                                                @keyframes pulse-glow {
                                                    0%, 100% { box-shadow: 0 0 20px rgba(34, 211, 238, 0.3), 0 4px 12px rgba(8, 145, 178, 0.2); }
                                                    50% { box-shadow: 0 0 30px rgba(34, 211, 238, 0.5), 0 4px 20px rgba(8, 145, 178, 0.4); }
                                                }
                                            `}</style>
                                            {isCallActive ? <PhoneOff className="h-4 w-4 mr-2" /> : <Phone className="h-4 w-4 mr-2" />}
                                            {isCallActive ? formatDuration(callDuration) : t('button.activateVoice')}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-slate-900 text-white border-slate-700 max-w-xs">
                                        <p className="text-xs font-bold mb-1">{isCallActive ? t('button.deactivateVoice') : t('button.activateVoice')}</p>
                                        <p className="text-xs text-slate-300">
                                            {isCallActive 
                                                ? t('button.deactivateVoiceDescription')
                                                : t('button.activateVoiceDescription')}
                                        </p>
                                    </TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="outline"
                                            onClick={() => navigate(`agent-config?id=${selectedAgent.id}`)}
                                            className="rounded-2xl border-2 font-black text-[9px] uppercase tracking-[0.2em] px-8 h-11 transition-all shadow-lg hover:shadow-xl"
                                            style={{
                                                backgroundColor: '#ffffff',
                                                borderColor: '#0891b2',
                                                color: '#0891b2',
                                                borderWidth: '2px'
                                            }}
                                        >
                                            <Settings2 className="h-4 w-4 mr-2" />
                                            {t('button.configure')}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-slate-900 text-white border-slate-700 max-w-xs">
                                        <p className="text-xs font-bold mb-1">{t('button.configureAgent')}</p>
                                        <p className="text-xs text-slate-300">{t('button.configureAgentDescription')}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </>
                        )}
                    </div>
                </header>

                <div className="flex-1 flex overflow-hidden min-h-0">
                    {/* ÁREA DE CHAT OU EXECUÇÃO DE FLOW */}
                    <section className="flex-1 flex flex-col relative" style={{ backgroundColor: theme === 'dark' ? '#0f172a' : '#F8FAFC' }}>
                        {/* ÁREA DE MENSAGENS COM SCROLL */}
                        <div className="flex-1 overflow-y-auto min-h-0">
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
                                        <div className="py-24 text-center flex flex-col items-center">
                                            <div className="h-24 w-24 rounded-[3.5rem] bg-gradient-to-br from-blue-50 to-indigo-50 shadow-xl flex items-center justify-center mb-8 border-4 border-white">
                                                <GitBranch size={40} className="text-blue-400" strokeWidth={3} />
                                            </div>
                                            <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.6em] ml-2 mb-2">{t('flow.readyToExecute')}</h4>
                                            <p className="text-sm font-bold text-slate-500 mt-2 max-w-md leading-relaxed">
                                                {t('flow.clickExecuteButton')}
                                            </p>
                                            <p className="text-xs text-slate-400 mt-4 max-w-sm">
                                                {t('flow.realTimeProcessing')}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="max-w-3xl mx-auto px-12 pt-12 pb-8 space-y-8">
                                    {messages.length === 0 && (
                                        <div className="py-24 text-center flex flex-col items-center">
                                            <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-cyan-50 to-blue-50 dark:bg-gradient-to-br dark:from-cyan-900/20 dark:to-blue-900/20 shadow-xl flex items-center justify-center mb-8 border-4 border-white dark:border-slate-800 relative">
                                                <MessageSquare size={40} className="text-cyan-500 dark:text-cyan-400" strokeWidth={3} />
                                                {/* Ondas sonoras animadas */}
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <div 
                                                        className="absolute w-20 h-20 border-2 rounded-full animate-ping opacity-30" 
                                                        style={{ 
                                                            animationDuration: '2s',
                                                            borderColor: theme === 'dark' ? '#22d3ee' : '#0891b2',
                                                            backgroundColor: 'transparent'
                                                        }}
                                                    ></div>
                                                    <div 
                                                        className="absolute w-24 h-24 border-2 rounded-full animate-ping opacity-20" 
                                                        style={{ 
                                                            animationDuration: '2.5s', 
                                                            animationDelay: '0.5s',
                                                            borderColor: theme === 'dark' ? '#22d3ee' : '#0891b2',
                                                            backgroundColor: 'transparent'
                                                        }}
                                                    ></div>
                                                </div>
                                            </div>
                                            <h4 className="text-[10px] font-black uppercase tracking-[0.6em] ml-2 mb-2" style={{ color: theme === 'dark' ? '#e2e8f0' : '#475569' }}>{t('chat.readyToChat')}</h4>
                                            <p className="text-sm font-bold mt-2 max-w-md leading-relaxed" style={{ color: theme === 'dark' ? '#cbd5e1' : '#64748b' }}>
                                                {t('chat.typeMessageBelow', { agentName: formatAgentName(selectedAgent?.name) })}
                                            </p>
                                            <p className="text-xs mt-4 max-w-sm mb-6" style={{ color: theme === 'dark' ? '#94a3b8' : '#94a3b8' }}>
                                                {t('chat.safeArea')}
                                            </p>
                                            {/* Prompt Starters */}
                                            <div className="flex flex-wrap gap-3 justify-center max-w-2xl mt-4">
                                                <button
                                                    onClick={() => setInputValue(t('chat.promptStarter.help'))}
                                                    className="px-6 py-3 rounded-2xl text-sm font-bold transition-all shadow-sm hover:shadow-md"
                                                    style={{
                                                        backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9',
                                                        border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid transparent',
                                                        color: theme === 'dark' ? '#e2e8f0' : '#334155',
                                                        backdropFilter: theme === 'dark' ? 'blur(10px)' : 'none'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.borderColor = theme === 'dark' ? '#22d3ee' : '#0891b2'
                                                        e.currentTarget.style.boxShadow = theme === 'dark' ? '0 0 20px rgba(34, 211, 238, 0.3)' : '0 4px 12px rgba(8, 145, 178, 0.2)'
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.borderColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'transparent'
                                                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)'
                                                    }}
                                                >
                                                    {t('chat.promptStarter.help')}
                                                </button>
                                                <button
                                                    onClick={() => setInputValue(t('chat.promptStarter.knowledgeBase'))}
                                                    className="px-6 py-3 rounded-2xl text-sm font-bold transition-all shadow-sm hover:shadow-md"
                                                    style={{
                                                        backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9',
                                                        border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid transparent',
                                                        color: theme === 'dark' ? '#e2e8f0' : '#334155',
                                                        backdropFilter: theme === 'dark' ? 'blur(10px)' : 'none'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.borderColor = theme === 'dark' ? '#22d3ee' : '#0891b2'
                                                        e.currentTarget.style.boxShadow = theme === 'dark' ? '0 0 20px rgba(34, 211, 238, 0.3)' : '0 4px 12px rgba(8, 145, 178, 0.2)'
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.borderColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'transparent'
                                                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)'
                                                    }}
                                                >
                                                    {t('chat.promptStarter.knowledgeBase')}
                                                </button>
                                                <button
                                                    onClick={() => setInputValue(t('chat.promptStarter.explainFeatures'))}
                                                    className="px-6 py-3 rounded-2xl text-sm font-bold transition-all shadow-sm hover:shadow-md"
                                                    style={{
                                                        backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9',
                                                        border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid transparent',
                                                        color: theme === 'dark' ? '#e2e8f0' : '#334155',
                                                        backdropFilter: theme === 'dark' ? 'blur(10px)' : 'none'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.borderColor = theme === 'dark' ? '#22d3ee' : '#0891b2'
                                                        e.currentTarget.style.boxShadow = theme === 'dark' ? '0 0 20px rgba(34, 211, 238, 0.3)' : '0 4px 12px rgba(8, 145, 178, 0.2)'
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.borderColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'transparent'
                                                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)'
                                                    }}
                                                >
                                                    {t('chat.promptStarter.explainFeatures')}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {messages.map((msg, i) => {
                                        const isUser = msg.role === 'user';
                                        return (
                                            <div 
                                                key={i} 
                                                className={`flex w-full animate-in fade-in slide-in-from-bottom-3 duration-500 ${isUser ? 'justify-end' : 'justify-start'} mb-6 px-4 py-3 rounded-2xl`}
                                                style={{
                                                    backgroundColor: isUser ? 'rgba(220, 252, 231, 0.8)' : 'rgba(219, 234, 254, 0.8)',
                                                    borderRadius: '1rem',
                                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)'
                                                }}
                                            >
                                                <div className={`flex items-start gap-4 max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                                                    {/* Avatar */}
                                                    <div className="shrink-0 h-12 w-12 rounded-2xl flex items-center justify-center font-black text-sm shadow-xl" style={{
                                                        background: isUser 
                                                            ? (theme === 'dark' ? 'linear-gradient(135deg, #0891b2 0%, #22d3ee 100%)' : 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)')
                                                            : (theme === 'dark' ? 'linear-gradient(135deg, #0891b2 0%, #22d3ee 100%)' : 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)'),
                                                        border: theme === 'dark' ? '2px solid rgba(34, 211, 238, 0.3)' : '2px solid rgba(8, 145, 178, 0.3)'
                                                    }}>
                                                        {isUser ? <User className="h-6 w-6" style={{ color: theme === 'dark' ? '#ffffff' : '#0891b2' }} strokeWidth={2.5} /> : <Bot className="h-6 w-6" style={{ color: theme === 'dark' ? '#ffffff' : '#0891b2' }} strokeWidth={2.5} />}
                                                    </div>
                                                    
                                                    {/* Balão de mensagem - MAIOR E MAIS ARREDONDADO */}
                                                    <div
                                                        className="relative px-8 py-6 shadow-2xl font-bold text-base leading-relaxed border-2"
                                                        style={{
                                                            borderRadius: '2.5rem',
                                                            backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                                                            color: theme === 'dark' ? '#e2e8f0' : '#1e293b',
                                                            borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0',
                                                            boxShadow: theme === 'dark' ? '0 8px 20px rgba(0, 0, 0, 0.3)' : '0 4px 12px rgba(0, 0, 0, 0.08)'
                                                        }}
                                                    >
                                                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                                                        
                                                        {/* Seta do balão */}
                                                        <div 
                                                            className="absolute top-6 w-0 h-0"
                                                            style={{
                                                                [isUser ? 'right' : 'left']: '-10px',
                                                                borderTop: '10px solid transparent',
                                                                [isUser ? 'borderLeft' : 'borderRight']: `14px solid ${theme === 'dark' ? '#1e293b' : '#ffffff'}`
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    
                                    {/* Balão de pensamento quando está carregando */}
                                    {isLoading && selectedAgent && (
                                        <div className="flex w-full justify-start mb-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
                                            <div className="flex items-start gap-4 max-w-[85%] flex-row">
                                                {/* Avatar */}
                                                <div className="shrink-0 h-12 w-12 rounded-2xl flex items-center justify-center font-black text-sm shadow-xl" style={{
                                                    background: theme === 'dark' ? 'linear-gradient(135deg, #0891b2 0%, #22d3ee 100%)' : 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
                                                    border: theme === 'dark' ? '2px solid rgba(34, 211, 238, 0.3)' : '2px solid rgba(8, 145, 178, 0.3)'
                                                }}>
                                                    <Bot className="h-6 w-6" style={{ color: theme === 'dark' ? '#ffffff' : '#0891b2' }} strokeWidth={2.5} />
                                                </div>
                                                
                                                {/* Balão de pensamento - MAIOR */}
                                                <div 
                                                    className="relative rounded-[2.5rem] shadow-2xl border-2 rounded-bl-none"
                                                    style={{ 
                                                        paddingLeft: '56px',
                                                        paddingRight: '56px',
                                                        paddingTop: '24px',
                                                        paddingBottom: '24px',
                                                        backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                                                        borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0',
                                                        boxShadow: theme === 'dark' ? '0 8px 20px rgba(0, 0, 0, 0.3)' : '0 4px 12px rgba(0, 0, 0, 0.08)'
                                                    }}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div 
                                                            className="w-4 h-4 rounded-full animate-bounce"
                                                            style={{ backgroundColor: theme === 'dark' ? '#22d3ee' : '#0891b2' }}
                                                            style={{ 
                                                                animationDelay: '0ms',
                                                                animationDuration: '1.4s',
                                                                animationTimingFunction: 'ease-in-out'
                                                            }}
                                                        />
                                                        <div 
                                                            className="w-4 h-4 rounded-full animate-bounce"
                                                            style={{ backgroundColor: theme === 'dark' ? '#22d3ee' : '#0891b2' }}
                                                            style={{ 
                                                                animationDelay: '200ms',
                                                                animationDuration: '1.4s',
                                                                animationTimingFunction: 'ease-in-out'
                                                            }}
                                                        />
                                                        <div 
                                                            className="w-4 h-4 rounded-full animate-bounce"
                                                            style={{ backgroundColor: theme === 'dark' ? '#22d3ee' : '#0891b2' }}
                                                            style={{ 
                                                                animationDelay: '400ms',
                                                                animationDuration: '1.4s',
                                                                animationTimingFunction: 'ease-in-out'
                                                            }}
                                                        />
                                                    </div>
                                                    
                                                    {/* Seta do balão */}
                                                    <div 
                                                        className="absolute top-6 left-[-10px] w-0 h-0"
                                                        style={{
                                                            borderTop: '10px solid transparent',
                                                            borderRight: `14px solid ${theme === 'dark' ? '#1e293b' : '#ffffff'}`
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* DIVISÃO ENTRE MENSAGENS E INPUT */}
                        {!selectedFlow && (
                            <>
                                <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent shrink-0"></div>

                                {/* INPUT FLUTUANTE (ESTILO CHATGPT) - APENAS PARA AGENTES */}
                                <div className="p-12 border-t shrink-0" style={{ 
                                    backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                                    borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0'
                                }}>
                                    <div className="max-w-3xl mx-auto relative flex items-center">
                                        <Input
                                            className="h-20 pl-8 pr-32 border border-slate-300/30 shadow-[0_20px_50px_rgba(0,0,0,0.15)] bg-white/95 backdrop-blur-xl text-lg font-bold focus-visible:ring-blue-500 focus-visible:ring-4 transition-all placeholder:text-slate-300 flex-1"
                                            style={{
                                                borderRadius: '2.5rem'
                                            }}
                                            placeholder={selectedAgent ? t('input.placeholderWithAgent', { agentName: selectedAgent.name }) : t('input.placeholderNoAgent')}
                                            value={inputValue}
                                            onChange={(e) => setInputValue(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                            disabled={!selectedAgent}
                                        />
                                        <Button
                                            onClick={() => handleSendMessage()}
                                            disabled={!selectedAgent || !inputValue.trim()}
                                            className="absolute right-4 h-12 px-8 font-black shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                            style={{ 
                                                background: inputValue.trim() ? 'linear-gradient(135deg, #0891b2 0%, #22d3ee 100%)' : '#94a3b8',
                                                color: '#ffffff',
                                                border: 'none',
                                                borderRadius: '2rem',
                                                transform: inputValue.trim() ? 'scale(1.05)' : 'scale(1)',
                                                boxShadow: inputValue.trim() 
                                                    ? (theme === 'dark' 
                                                        ? '0 0 20px rgba(34, 211, 238, 0.4), 0 8px 20px rgba(8, 145, 178, 0.3)' 
                                                        : '0 8px 20px rgba(8, 145, 178, 0.4)')
                                                    : '0 4px 12px rgba(0, 0, 0, 0.1)'
                                            }}
                                            onMouseEnter={(e) => {
                                                if (inputValue.trim()) {
                                                    e.currentTarget.style.transform = 'scale(1.08) translateY(-2px)'
                                                    e.currentTarget.style.boxShadow = theme === 'dark'
                                                        ? '0 0 30px rgba(34, 211, 238, 0.6), 0 12px 30px rgba(8, 145, 178, 0.4)'
                                                        : '0 12px 30px rgba(8, 145, 178, 0.5)'
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (inputValue.trim()) {
                                                    e.currentTarget.style.transform = 'scale(1.05)'
                                                    e.currentTarget.style.boxShadow = theme === 'dark'
                                                        ? '0 0 20px rgba(34, 211, 238, 0.4), 0 8px 20px rgba(8, 145, 178, 0.3)'
                                                        : '0 8px 20px rgba(8, 145, 178, 0.4)'
                                                }
                                            }}
                                        >
                                            <Send className="h-5 w-5" strokeWidth={3} style={{ color: '#ffffff', transform: inputValue.trim() ? 'translateY(-2px)' : 'translateY(0)' }} />
                                            <span style={{ color: '#ffffff' }}>{t('button.send')}</span>
                                        </Button>
                                    </div>
                                    <p className="text-[9px] text-center font-black uppercase tracking-[0.3em] mt-4" style={{ 
                                        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
                                        color: theme === 'dark' ? '#22d3ee' : '#0891b2',
                                        textShadow: theme === 'dark' 
                                            ? '0 0 10px rgba(34, 211, 238, 0.4), 0 0 20px rgba(34, 211, 238, 0.3)' 
                                            : '0 0 10px rgba(8, 145, 178, 0.3), 0 0 20px rgba(8, 145, 178, 0.2)',
                                        letterSpacing: '0.15em'
                                    }}>SONIA INTELLIGENT CORE V3.0</p>
                                </div>
                            </>
                        )}

                        {/* MENSAGEM PARA FLOWS - APENAS EXECUTAR */}
                        {selectedFlow && (
                            <div className="p-12 shrink-0" style={{
                                backgroundColor: theme === 'dark' ? '#0f172a' : '#F0F5FA',
                                borderTop: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.1)' : '#e2e8f0'}`
                            }}>
                                <div className="max-w-3xl mx-auto text-center">
                                    <div className="inline-flex items-center gap-3 px-6 py-4 bg-blue-50 border-2 border-blue-100 rounded-2xl">
                                        <GitBranch className="h-5 w-5 text-blue-600" strokeWidth={2.5} />
                                        <p className="text-sm font-bold text-slate-700">
                                            {t('flow.automationsAutoExecute')}
                                        </p>
                                    </div>
                                    <p className="text-[9px] text-center font-black uppercase tracking-[0.3em] mt-4" style={{ 
                                        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
                                        color: theme === 'dark' ? '#22d3ee' : '#0891b2',
                                        textShadow: theme === 'dark' 
                                            ? '0 0 10px rgba(34, 211, 238, 0.4), 0 0 20px rgba(34, 211, 238, 0.3)' 
                                            : '0 0 10px rgba(8, 145, 178, 0.3), 0 0 20px rgba(8, 145, 178, 0.2)',
                                        letterSpacing: '0.15em'
                                    }}>SONIA INTELLIGENT CORE V3.0</p>
                                </div>
                            </div>
                        )}
                    </section>
                </div>
            </main>
        </div>
        </TooltipProvider>
    );
}
