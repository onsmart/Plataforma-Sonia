
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
    Play,
    Eraser
} from "lucide-react"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
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
import { AgentService, Agent, ChatMessage, WhatsAppService, type CurrentWhatsAppIntegration } from "../services/api"
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
import { normalizeAgentLanguageCode } from "../lib/agent-language"

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
    const [flowTestChannel, setFlowTestChannel] = useState<'webchat' | 'whatsapp'>('webchat')
    const [currentWhatsAppIntegration, setCurrentWhatsAppIntegration] = useState<CurrentWhatsAppIntegration | null>(null)
    const [flowTestPhone, setFlowTestPhone] = useState("")

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

    const getPlaygroundHistoryKey = (agentId: string, channel: string) =>
        `playground:history:${userId || 'anonymous'}:${agentId}:${channel}`

    const loadPersistedMessages = (agentId: string, channel: string): ChatMessage[] => {
        try {
            const raw = localStorage.getItem(getPlaygroundHistoryKey(agentId, channel))
            if (!raw) return []

            const parsed = JSON.parse(raw)
            if (!Array.isArray(parsed)) return []

            return parsed.filter((item): item is ChatMessage =>
                item &&
                typeof item === 'object' &&
                (item.role === 'user' || item.role === 'assistant' || item.role === 'system') &&
                typeof item.content === 'string'
            )
        } catch (error) {
            console.error('[Playground] Erro ao carregar histórico persistido:', error)
            return []
        }
    }

    const persistMessages = (agentId: string, channel: string, nextMessages: ChatMessage[]) => {
        try {
            localStorage.setItem(getPlaygroundHistoryKey(agentId, channel), JSON.stringify(nextMessages))
        } catch (error) {
            console.error('[Playground] Erro ao persistir histórico:', error)
        }
    }

    const handleClearConversation = () => {
        if (!selectedAgent?.id) return
        setMessages([])
        persistMessages(selectedAgent.id, activeChannel, [])
        toast.success(
            t('clearConversation.success', { defaultValue: 'Conversa limpa' }),
            { description: t('clearConversation.hint', { defaultValue: 'O histórico deste agente e canal foi apagado neste laboratório.' }) }
        )
    }

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
        return normalizeAgentLanguageCode(selectedAgent?.languages?.[0], 'pt-BR')
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
            WhatsAppService.getCurrentIntegration()
                .then(setCurrentWhatsAppIntegration)
                .catch(() => setCurrentWhatsAppIntegration(null))
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
        setInputValue('')
        setFlowExecutionHistory([])
        setFlowTestChannel('webchat')
        setFlowTestPhone('')
    }

    const handleExecuteFlow = async () => {
        if (!selectedFlow || !user?.email) {
            toast.error(t('errors.flowOrUserNotFound'))
            return
        }

        const flowInput = inputValue.trim()
        if (!flowInput) {
            toast.error('Digite uma mensagem para testar o fluxo.')
            return
        }

        const normalizedPhone = flowTestPhone.replace(/\D/g, '')
        if (flowTestChannel === 'whatsapp') {
            if (!currentWhatsAppIntegration?.id) {
                toast.error('Nenhuma integração WhatsApp ativa foi encontrada para este teste.')
                return
            }
            if (!normalizedPhone) {
                toast.error('Informe o número de WhatsApp que deve receber a mensagem.')
                return
            }
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
                    delivery_channel: flowTestChannel === 'whatsapp' ? 'whatsapp' : 'none',
                    integrations_id: flowTestChannel === 'whatsapp' ? currentWhatsAppIntegration?.id : undefined,
                    recipient_id: flowTestChannel === 'whatsapp' ? normalizedPhone : undefined,
                    initial_data: {
                        message: flowInput,
                        originalMessage: flowInput,
                        userMessage: flowInput,
                        input: flowInput,
                        channel: flowTestChannel,
                        integrations_id: flowTestChannel === 'whatsapp' ? currentWhatsAppIntegration?.id : undefined,
                        whatsapp_contact_id: flowTestChannel === 'whatsapp' ? normalizedPhone : undefined,
                        phone_number: flowTestChannel === 'whatsapp' ? normalizedPhone : undefined
                    }
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
                executionMode: h.executionMode,
                agentId: h.agentId,
                templateId: h.templateId,
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
        if (!selectedAgent?.id) {
            setMessages([])
            return
        }

        const persistedMessages = loadPersistedMessages(selectedAgent.id, activeChannel)
        setMessages(persistedMessages)
    }, [selectedAgent?.id, activeChannel])

    useEffect(() => {
        if (!selectedAgent?.id) return
        persistMessages(selectedAgent.id, activeChannel, messages)
    }, [messages, selectedAgent?.id, activeChannel])

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
                const normalizedLanguage = normalizeAgentLanguageCode(item.primary_language, 'pt-BR')
                const languages = [normalizedLanguage]

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
                    primary_language: normalizedLanguage,
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

    const isDark = theme === 'dark'
    const sidebarShellStyle = {
        background: isDark
            ? 'linear-gradient(180deg, rgba(24,24,27,0.96), rgba(9,9,11,0.94))'
            : 'linear-gradient(180deg, rgba(255,255,255,0.96), rgba(248,250,252,0.94))',
        border: isDark ? '1px solid rgba(63,63,70,0.45)' : '1px solid rgba(148,163,184,0.12)',
        boxShadow: isDark
            ? '0 24px 56px -30px rgba(0,0,0,0.65)'
            : '0 22px 50px -32px rgba(15,23,42,0.12), 0 12px 26px -24px rgba(37,99,235,0.06)'
    } as const

    const mainShellStyle = {
        background: isDark
            ? 'linear-gradient(180deg, rgba(24,24,27,0.98), rgba(9,9,11,0.96))'
            : 'linear-gradient(180deg, rgba(255,255,255,0.97), rgba(246,249,252,0.95))',
        border: isDark ? '1px solid rgba(63,63,70,0.4)' : '1px solid rgba(148,163,184,0.1)',
        boxShadow: isDark
            ? '0 30px 70px -34px rgba(0,0,0,0.72)'
            : '0 28px 64px -36px rgba(15,23,42,0.14), 0 16px 32px -28px rgba(37,99,235,0.06)'
    } as const

    const secondaryButtonStyle = {
        backgroundColor: isDark ? 'rgba(39,39,42,0.9)' : 'rgba(255,255,255,0.82)',
        borderColor: isDark ? 'rgba(63,63,70,0.55)' : 'rgba(148,163,184,0.16)',
        color: isDark ? '#e4e4e7' : '#0f172a',
        boxShadow: isDark
            ? '0 14px 26px -20px rgba(0,0,0,0.4)'
            : '0 12px 24px -20px rgba(15,23,42,0.12)'
    } as const

    const primaryButtonStyle = {
        background: 'linear-gradient(135deg, #0891b2 0%, #22d3ee 100%)',
        color: '#ffffff',
        boxShadow: isDark
            ? '0 18px 34px -20px rgba(8,145,178,0.42), 0 10px 22px -18px rgba(34,211,238,0.26)'
            : '0 16px 30px -20px rgba(8,145,178,0.28)'
    } as const

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
            <div
                className="playground-root flex h-screen w-full gap-6 overflow-hidden p-6 font-sans antialiased selection:bg-blue-100"
                style={{
                    backgroundColor: isDark ? '#09090b' : '#eef4fb',
                    WebkitFontSmoothing: 'antialiased',
                    MozOsxFontSmoothing: 'grayscale',
                }}
            >
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
                .playground-root {
                    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
                }
            `}</style>

            {/* SIDEBAR: COLUNA DE COMANDO */}
            <aside className="w-[320px] shrink-0 rounded-[2.25rem] flex flex-col overflow-hidden" style={sidebarShellStyle}>
                <div className="flex min-h-[5.25rem] shrink-0 items-center px-8 py-4" style={{
                    background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(248,250,252,0.72)',
                    borderBottom: isDark ? '1px solid rgba(148,163,184,0.08)' : '1px solid rgba(148,163,184,0.1)'
                }}>
                    <h2 className="flex items-center gap-3 text-xs font-semibold uppercase leading-normal tracking-[0.12em]" style={{ color: theme === 'dark' ? '#22d3ee' : '#0891b2' }}>
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
                    <div className="p-7 space-y-10 pb-24">
                        {/* Fluxos */}
                        <div className="space-y-5">
                            <div className="flex items-center gap-2">
                                <span className="px-2 text-[10px] font-medium uppercase tracking-[0.08em]" style={{ color: theme === 'dark' ? '#64748b' : '#94a3b8' }}>{t('sidebar.automationsAvailable')}</span>
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
                                                className={`group relative flex w-full min-h-[3.75rem] items-center gap-2 overflow-visible rounded-[1.6rem] px-4 py-3.5 transition-all duration-300 ${
                                                    isSelected 
                                                        ? 'shadow-2xl' 
                                                        : 'hover:-translate-y-0.5'
                                                }`}
                                                style={isSelected ? {
                                                    background: 'linear-gradient(135deg, #0891b2 0%, #22d3ee 100%)',
                                                    color: '#ffffff',
                                                    boxShadow: '0 18px 36px -18px rgba(8, 145, 178, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
                                                    transform: 'translateY(-1px)',
                                                    borderRadius: '1.6rem'
                                                } : {
                                                    borderRadius: '1.6rem',
                                                    backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(248,250,252,0.9)',
                                                    border: theme === 'dark' ? '1px solid rgba(148,163,184,0.08)' : '1px solid rgba(148,163,184,0.12)',
                                                    boxShadow: theme === 'dark' ? '0 16px 28px -24px rgba(0,0,0,0.38)' : '0 14px 28px -26px rgba(15,23,42,0.08)'
                                                }}
                                            >
                                                {isSelected && (
                                                    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[1.6rem]">
                                                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 animate-shimmer" />
                                                    </div>
                                                )}
                                                <div className="relative shrink-0 z-10">
                                                    <div
                                                        className="h-10 w-10 border-2 flex items-center justify-center shadow-lg transform transition-transform group-active:scale-90"
                                                        style={isSelected ? {
                                                            backgroundColor: 'rgba(255, 255, 255, 0.25)',
                                                            borderColor: 'rgba(255, 255, 255, 0.4)',
                                                            color: '#ffffff',
                                                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                                                            borderRadius: '1.15rem'
                                                        } : {
                                                            backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
                                                            borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.12)' : '#cbd5e1',
                                                            color: theme === 'dark' ? '#e2e8f0' : '#475569',
                                                            borderRadius: '1.15rem'
                                                        }}
                                                    >
                                                        <GitBranch 
                                                            size={18} 
                                                            strokeWidth={isSelected ? 2.5 : 2}
                                                            style={{ color: isSelected ? '#ffffff' : (theme === 'dark' ? '#cbd5e1' : '#334155') }}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="relative z-10 flex min-w-0 flex-1 items-center gap-2 pl-0.5">
                                                    <span
                                                        className="line-clamp-2 min-w-0 break-words text-left text-[11px] font-medium leading-[1.45] tracking-normal"
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
                                <span className="px-2 text-[10px] font-medium uppercase tracking-[0.08em]" style={{ color: theme === 'dark' ? '#64748b' : '#94a3b8' }}>{t('sidebar.agentsAvailable')}</span>
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
                                                className={`group relative flex w-full min-h-[3.75rem] items-center gap-2 overflow-visible rounded-[1.6rem] px-4 py-3.5 transition-all duration-300 ${
                                                isSelected 
                                                    ? 'shadow-2xl' 
                                                    : 'hover:-translate-y-0.5'
                                            }`}
                                            style={isSelected ? {
                                                background: 'linear-gradient(135deg, #0891b2 0%, #22d3ee 100%)',
                                                color: '#ffffff',
                                                boxShadow: '0 18px 36px -18px rgba(8, 145, 178, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
                                                transform: 'translateY(-1px)',
                                                borderRadius: '1.6rem'
                                            } : {
                                                borderRadius: '1.6rem',
                                                backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(248,250,252,0.9)',
                                                border: theme === 'dark' ? '1px solid rgba(148,163,184,0.08)' : '1px solid rgba(148,163,184,0.12)',
                                                boxShadow: theme === 'dark' ? '0 16px 28px -24px rgba(0,0,0,0.38)' : '0 14px 28px -26px rgba(15,23,42,0.08)'
                                            }}
                                        >
                                            {isSelected && (
                                                <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[1.6rem]">
                                                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 animate-shimmer" />
                                                </div>
                                            )}
                                            <div className="relative shrink-0 z-10">
                                                <div
                                                    className="flex h-10 w-10 items-center justify-center border-2 text-xs font-bold shadow-lg transition-transform group-active:scale-90"
                                                    style={isSelected ? {
                                                        backgroundColor: 'rgba(255, 255, 255, 0.25)',
                                                        borderColor: 'rgba(255, 255, 255, 0.4)',
                                                        color: '#ffffff',
                                                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                                                        borderRadius: '1.15rem'
                                                    } : {
                                                        backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0',
                                                        borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : '#cbd5e1',
                                                        color: theme === 'dark' ? '#e2e8f0' : '#475569',
                                                        borderRadius: '1.15rem'
                                                    }}
                                                >
                                                    {agent.avatar}
                                                </div>
                                            </div>
                                            <div className="relative z-10 flex min-w-0 flex-1 items-center gap-2 pl-0.5">
                                                <div 
                                                    className="h-2.5 w-2.5 shrink-0 rounded-full border-2"
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
                                                    className="line-clamp-2 min-w-0 break-words text-left text-[11px] font-medium leading-[1.45] tracking-normal"
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
            <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-[2.35rem]" style={mainShellStyle}>

                {/* HEADER — altura mínima + overflow visível para não cortar ascendentes/descendentes */}
                <header
                    className="flex min-h-[6.5rem] shrink-0 items-center justify-between gap-4 overflow-visible px-8 py-5 sm:px-10"
                    style={{
                    background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(248,250,252,0.72)',
                    borderBottom: isDark ? '1px solid rgba(148,163,184,0.08)' : '1px solid rgba(148,163,184,0.1)'
                }}
                >
                    <div className="flex min-w-0 items-center gap-5">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-2xl" style={{ background: 'linear-gradient(135deg, #0891b2 0%, #22d3ee 100%)', boxShadow: theme === 'dark' ? '0 12px 24px -18px rgba(34, 211, 238, 0.3), 0 6px 14px -14px rgba(8, 145, 178, 0.26)' : '0 10px 18px -14px rgba(8, 145, 178, 0.22)' }}>
                            {selectedFlow ? <GitBranch size={18} strokeWidth={2.8} /> : <Bot size={18} strokeWidth={2.4} />}
                        </div>
                        <div className="min-w-0 overflow-visible py-0.5">
                            <h3
                                className="line-clamp-2 break-words text-xl font-semibold leading-[1.35] tracking-tight sm:text-2xl sm:leading-[1.35]"
                                style={{
                                color: theme === 'dark' ? '#fafafa' : '#0f172a'
                            }}
                            >
                                {selectedFlow ? selectedFlow.name : formatAgentName(selectedAgent?.name)}
                            </h3>
                            <div className="mt-2 flex flex-wrap items-center gap-3">
                                <p className="text-[10px] font-medium uppercase leading-normal tracking-[0.08em]" style={{ color: theme === 'dark' ? '#22d3ee' : '#0891b2' }}>{t('header.testEnvironment')}</p>
                                {selectedAgent?.channels && selectedAgent.channels.length > 1 && (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="ml-2 flex items-center gap-1 rounded-[0.9rem] p-1.5" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.82)', border: isDark ? '1px solid rgba(148,163,184,0.08)' : '1px solid rgba(148,163,184,0.12)' }}>
                                                {selectedAgent.channels.map(ch => (
                                                    <button
                                                        key={ch}
                                                        onClick={() => setActiveChannel(ch)}
                                                        className={`rounded-[0.7rem] p-1.5 transition-all duration-300 ${activeChannel === ch ? 'scale-105 text-blue-600' : 'text-slate-300 hover:text-slate-400'}`}
                                                        style={activeChannel === ch ? { backgroundColor: isDark ? 'rgba(34,211,238,0.12)' : '#ffffff', boxShadow: isDark ? '0 12px 22px -18px rgba(34,211,238,0.22)' : '0 10px 18px -16px rgba(37,99,235,0.18)' } : undefined}
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

                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
                        {selectedFlow && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        onClick={handleExecuteFlow}
                                        disabled={isExecutingFlow || !inputValue.trim()}
                                        className="h-11 rounded-full px-8 text-[11px] font-semibold uppercase tracking-wide transition-all duration-300 hover:-translate-y-0.5"
                                        style={{
                                            ...((isExecutingFlow || !inputValue.trim()) ? { background: '#94a3b8', color: '#ffffff', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)' } : primaryButtonStyle)
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
                                {!selectedFlow && (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="outline"
                                                onClick={handleClearConversation}
                                                disabled={messages.length === 0}
                                                className="h-11 rounded-full border px-7 text-[10px] font-semibold uppercase tracking-wide transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-50"
                                                style={{ ...secondaryButtonStyle, borderColor: '#0891b2', color: '#0891b2' }}
                                            >
                                                <Eraser className="h-4 w-4 mr-2" />
                                                {t('button.clearConversation', { defaultValue: 'Limpar conversa' })}
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent className="bg-slate-900 text-white border-slate-700 max-w-xs">
                                            <p className="text-xs font-bold mb-1">{t('button.clearConversation', { defaultValue: 'Limpar conversa' })}</p>
                                            <p className="text-xs text-slate-300">{t('button.clearConversationDescription', { defaultValue: 'Remove as mensagens deste chat e o histórico salvo no navegador para este agente e canal.' })}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                )}

                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant={isCallActive ? "destructive" : "outline"}
                                            onClick={() => setIsCallActive(!isCallActive)}
                                            className={`h-11 rounded-full border px-7 text-[10px] font-semibold uppercase tracking-wide transition-all duration-300 hover:-translate-y-0.5 ${isCallActive ? 'shadow-lg shadow-red-500/20' : ''}`}
                                            style={!isCallActive ? {
                                                ...secondaryButtonStyle,
                                                borderColor: '#0891b2',
                                                color: '#0891b2',
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
                                            className="h-11 rounded-full border px-8 text-[10px] font-semibold uppercase tracking-wide transition-all duration-300 hover:-translate-y-0.5"
                                            style={{ ...secondaryButtonStyle, borderColor: '#0891b2', color: '#0891b2' }}
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
                    <section className="flex-1 flex flex-col relative" style={{ backgroundColor: theme === 'dark' ? '#18181b' : '#F8FAFC' }}>
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
                                            <h4 className="mb-2 ml-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">{t('flow.readyToExecute')}</h4>
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
                                        <div className="flex flex-col items-center py-24 text-center">
                                            <div className="relative mb-8 flex h-24 w-24 items-center justify-center rounded-full shadow-[0_24px_48px_-24px_rgba(8,145,178,0.28)]" style={{ background: isDark ? 'radial-gradient(circle at 50% 45%, rgba(34,211,238,0.18), rgba(8,145,178,0.06) 62%, rgba(8,145,178,0.02) 100%)' : 'radial-gradient(circle at 50% 45%, rgba(224,242,254,0.96), rgba(191,219,254,0.82) 65%, rgba(191,219,254,0.35) 100%)', border: isDark ? '1px solid rgba(34,211,238,0.08)' : '1px solid rgba(148,163,184,0.08)' }}>
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
                                            <h4 className="mb-2 ml-2 text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: theme === 'dark' ? '#e2e8f0' : '#475569' }}>{t('chat.readyToChat')}</h4>
                                            <p className="text-sm font-bold mt-2 max-w-md leading-relaxed" style={{ color: theme === 'dark' ? '#cbd5e1' : '#64748b' }}>
                                                {t('chat.typeMessageBelow', { agentName: formatAgentName(selectedAgent?.name) })}
                                            </p>
                                            <p className="text-xs mt-4 max-w-sm mb-6" style={{ color: theme === 'dark' ? '#94a3b8' : '#94a3b8' }}>
                                                {t('chat.safeArea')}
                                            </p>
                                            {/* Prompt Starters */}
                                            <div className="mt-4 flex max-w-2xl flex-wrap justify-center gap-3">
                                                <button
                                                    onClick={() => setInputValue(t('chat.promptStarter.help'))}
                                                    className="rounded-full px-6 py-3.5 text-sm font-semibold transition-all duration-300 hover:-translate-y-0.5"
                                                    style={{
                                                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255,255,255,0.82)',
                                                        border: isDark ? '1px solid rgba(148,163,184,0.1)' : '1px solid rgba(148,163,184,0.12)',
                                                        color: isDark ? '#e2e8f0' : '#334155',
                                                        boxShadow: isDark ? '0 14px 26px -24px rgba(0,0,0,0.4)' : '0 14px 24px -22px rgba(15,23,42,0.1)',
                                                        backdropFilter: 'blur(10px)'
                                                    }}
                                                >
                                                    {t('chat.promptStarter.help')}
                                                </button>
                                                <button
                                                    onClick={() => setInputValue(t('chat.promptStarter.knowledgeBase'))}
                                                    className="rounded-full px-6 py-3.5 text-sm font-semibold transition-all duration-300 hover:-translate-y-0.5"
                                                    style={{
                                                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255,255,255,0.82)',
                                                        border: isDark ? '1px solid rgba(148,163,184,0.1)' : '1px solid rgba(148,163,184,0.12)',
                                                        color: isDark ? '#e2e8f0' : '#334155',
                                                        boxShadow: isDark ? '0 14px 26px -24px rgba(0,0,0,0.4)' : '0 14px 24px -22px rgba(15,23,42,0.1)',
                                                        backdropFilter: 'blur(10px)'
                                                    }}
                                                >
                                                    {t('chat.promptStarter.knowledgeBase')}
                                                </button>
                                                <button
                                                    onClick={() => setInputValue(t('chat.promptStarter.explainFeatures'))}
                                                    className="rounded-full px-6 py-3.5 text-sm font-semibold transition-all duration-300 hover:-translate-y-0.5"
                                                    style={{
                                                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255,255,255,0.82)',
                                                        border: isDark ? '1px solid rgba(148,163,184,0.1)' : '1px solid rgba(148,163,184,0.12)',
                                                        color: isDark ? '#e2e8f0' : '#334155',
                                                        boxShadow: isDark ? '0 14px 26px -24px rgba(0,0,0,0.4)' : '0 14px 24px -22px rgba(15,23,42,0.1)',
                                                        backdropFilter: 'blur(10px)'
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
                                                className={`mb-5 flex w-full animate-in fade-in slide-in-from-bottom-3 duration-500 ${isUser ? 'justify-end' : 'justify-start'}`}
                                                style={{}}
                                            >
                                                <div className={`flex max-w-[min(86%,40rem)] items-end gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                                                    {/* Avatar */}
                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-[0_14px_24px_-18px_rgba(8,145,178,0.3)]" style={{
                                                        background: isUser 
                                                            ? (isDark ? 'linear-gradient(135deg, rgba(34,211,238,0.18), rgba(8,145,178,0.12))' : 'linear-gradient(135deg, rgba(224,242,254,0.92), rgba(191,219,254,0.9))')
                                                            : 'linear-gradient(135deg, #0891b2 0%, #22d3ee 100%)',
                                                        border: isDark ? '1px solid rgba(148,163,184,0.08)' : '1px solid rgba(148,163,184,0.1)'
                                                    }}>
                                                        {isUser ? <User className="h-4.5 w-4.5" style={{ color: isDark ? '#cffafe' : '#0891b2' }} strokeWidth={2.4} /> : <Bot className="h-4.5 w-4.5 text-white" strokeWidth={2.4} />}
                                                    </div>
                                                    
                                                    {/* Balão de mensagem - MAIOR E MAIS ARREDONDADO */}
                                                    <div
                                                        className="w-fit max-w-full px-5 py-4 text-[15px] font-medium leading-7"
                                                        style={{
                                                            borderRadius: isUser ? '1.5rem 1.5rem 0.55rem 1.5rem' : '1.5rem 1.5rem 1.5rem 0.55rem',
                                                            background: isUser
                                                                ? (isDark ? 'linear-gradient(135deg, rgba(10,89,122,0.56), rgba(15,118,110,0.24))' : 'linear-gradient(135deg, rgba(224,242,254,0.98), rgba(219,234,254,0.94))')
                                                                : (isDark ? 'linear-gradient(135deg, rgba(39,39,42,0.96), rgba(24,24,27,0.98))' : 'linear-gradient(135deg, rgba(255,255,255,0.98), rgba(248,250,252,0.94))'),
                                                            color: isDark ? '#fafafa' : '#0f172a',
                                                            border: isUser
                                                                ? (isDark ? '1px solid rgba(34,211,238,0.12)' : '1px solid rgba(125,211,252,0.5)')
                                                                : (isDark ? '1px solid rgba(148,163,184,0.1)' : '1px solid rgba(148,163,184,0.12)'),
                                                            boxShadow: isUser
                                                                ? (isDark ? '0 18px 34px -26px rgba(34,211,238,0.22)' : '0 16px 30px -24px rgba(37,99,235,0.12)')
                                                                : (isDark ? '0 18px 34px -28px rgba(0,0,0,0.42)' : '0 14px 28px -24px rgba(15,23,42,0.08)')
                                                        }}
                                                    >
                                                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                                                        
                                                        {/* Seta do balão */}
                                                        <div 
                                                            className="hidden"
                                                            style={{
                                                                [isUser ? 'right' : 'left']: '-10px',
                                                                borderTop: '10px solid transparent',
                                                                [isUser ? 'borderLeft' : 'borderRight']: `14px solid ${theme === 'dark' ? '#18181b' : '#ffffff'}`
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    
                                    {/* Balão de pensamento quando está carregando */}
                                    {isLoading && selectedAgent && (
                                        <div className="mb-5 flex w-full justify-start animate-in fade-in slide-in-from-bottom-3 duration-500">
                                            <div className="flex max-w-[min(86%,40rem)] items-end gap-3 flex-row">
                                                {/* Avatar */}
                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-[0_14px_24px_-18px_rgba(8,145,178,0.3)]" style={{
                                                    background: 'linear-gradient(135deg, #0891b2 0%, #22d3ee 100%)',
                                                    border: isDark ? '1px solid rgba(148,163,184,0.08)' : '1px solid rgba(148,163,184,0.1)'
                                                }}>
                                                    <Bot className="h-4.5 w-4.5 text-white" strokeWidth={2.4} />
                                                </div>
                                                
                                                {/* Balão de pensamento - MAIOR */}
                                                <div 
                                                    className="rounded-full px-3.5 py-3"
                                                    style={{ 
                                                        background: isDark ? 'linear-gradient(135deg, rgba(39,39,42,0.96), rgba(24,24,27,0.98))' : 'linear-gradient(135deg, rgba(255,255,255,0.98), rgba(248,250,252,0.94))',
                                                        border: isDark ? '1px solid rgba(148,163,184,0.1)' : '1px solid rgba(148,163,184,0.12)',
                                                        boxShadow: isDark ? '0 18px 34px -28px rgba(0,0,0,0.42)' : '0 14px 28px -24px rgba(15,23,42,0.08)'
                                                    }}
                                                >
                                                    <div className="flex items-center gap-2 rounded-full px-1.5 py-0.5" style={{ background: isDark ? 'rgba(255,255,255,0.025)' : 'rgba(15,23,42,0.03)' }}>
                                                        <div 
                                                            className="h-3.5 w-3.5 rounded-full animate-bounce"
                                                            style={{ 
                                                                backgroundColor: theme === 'dark' ? '#22d3ee' : '#0891b2',
                                                                animationDelay: '0ms',
                                                                animationDuration: '1.4s',
                                                                animationTimingFunction: 'ease-in-out'
                                                            }}
                                                        />
                                                        <div 
                                                            className="h-3.5 w-3.5 rounded-full animate-bounce"
                                                            style={{ 
                                                                backgroundColor: theme === 'dark' ? '#22d3ee' : '#0891b2',
                                                                animationDelay: '200ms',
                                                                animationDuration: '1.4s',
                                                                animationTimingFunction: 'ease-in-out'
                                                            }}
                                                        />
                                                        <div 
                                                            className="h-3.5 w-3.5 rounded-full animate-bounce"
                                                            style={{ 
                                                                backgroundColor: theme === 'dark' ? '#22d3ee' : '#0891b2',
                                                                animationDelay: '400ms',
                                                                animationDuration: '1.4s',
                                                                animationTimingFunction: 'ease-in-out'
                                                            }}
                                                        />
                                                    </div>
                                                    
                                                    {/* Seta do balão */}
                                                    <div 
                                                        className="hidden"
                                                        style={{
                                                            borderTop: '10px solid transparent',
                                                            borderRight: `14px solid ${theme === 'dark' ? '#18181b' : '#ffffff'}`
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
                                {/* INPUT FLUTUANTE (ESTILO CHATGPT) - APENAS PARA AGENTES */}
                                <div className="p-10 shrink-0" style={{ 
                                    background: isDark ? 'rgba(255,255,255,0.015)' : 'rgba(248,250,252,0.72)',
                                    borderTop: isDark ? '1px solid rgba(148,163,184,0.06)' : '1px solid rgba(148,163,184,0.1)'
                                }}>
                                    <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-full p-2.5 pl-3" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.88)', border: isDark ? '1px solid rgba(148,163,184,0.08)' : '1px solid rgba(148,163,184,0.1)', boxShadow: isDark ? '0 24px 44px -30px rgba(0,0,0,0.45)' : '0 20px 38px -30px rgba(15,23,42,0.12)' }}>
                                        <Input
                                            className="h-[4.7rem] min-w-0 flex-1 border-0 bg-transparent pl-7 pr-6 text-base font-normal leading-normal shadow-none transition-all placeholder:text-slate-400 focus-visible:ring-0"
                                            style={{
                                                borderRadius: '999px',
                                                color: isDark ? '#fafafa' : '#0f172a'
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
                                            className="flex h-[4rem] shrink-0 items-center gap-2 rounded-full px-6 text-sm font-semibold transition-all duration-300 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                                            style={{ 
                                                ...(inputValue.trim() ? primaryButtonStyle : { background: '#94a3b8', color: '#ffffff', boxShadow: '0 8px 18px -14px rgba(15,23,42,0.18)' })
                                            }}
                                            onMouseEnter={(e) => {
                                                if (inputValue.trim()) {
                                                    e.currentTarget.style.transform = 'translateY(-2px)'
                                                    e.currentTarget.style.boxShadow = isDark
                                                        ? '0 22px 38px -20px rgba(8,145,178,0.48), 0 12px 24px -18px rgba(34,211,238,0.28)'
                                                        : '0 18px 32px -20px rgba(8,145,178,0.34)'
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (inputValue.trim()) {
                                                    e.currentTarget.style.transform = 'translateY(0)'
                                                    e.currentTarget.style.boxShadow = primaryButtonStyle.boxShadow
                                                }
                                            }}
                                        >
                                            <Send className="h-5 w-5" strokeWidth={3} style={{ color: '#ffffff', transform: inputValue.trim() ? 'translateY(-2px)' : 'translateY(0)' }} />
                                            <span style={{ color: '#ffffff' }}>{t('button.send')}</span>
                                        </Button>
                                    </div>
                                    <p className="mt-4 text-center text-[10px] font-medium uppercase tracking-[0.14em]" style={{ 
                                        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
                                        color: theme === 'dark' ? '#22d3ee' : '#0891b2',
                                        opacity: 0.75
                                    }}>SONIA INTELLIGENT CORE V3.0</p>
                                </div>
                            </>
                        )}

                        {/* MENSAGEM PARA FLOWS - APENAS EXECUTAR */}
                        {selectedFlow && (
                            <div className="p-12 shrink-0" style={{
                                backgroundColor: theme === 'dark' ? '#18181b' : '#F0F5FA',
                                borderTop: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.1)' : '#e2e8f0'}`
                            }}>
                                <div className="max-w-3xl mx-auto space-y-4">
                                    <div className="rounded-2xl border-2 border-blue-100 bg-blue-50 px-6 py-4">
                                        <div className="flex items-start gap-3">
                                            <GitBranch className="h-5 w-5 text-blue-600 mt-0.5" strokeWidth={2.5} />
                                            <div>
                                                <p className="text-sm font-bold text-slate-700">
                                                    Digite uma mensagem de teste para executar o fluxo
                                                </p>
                                                <p className="text-xs text-slate-500 mt-1">
                                                    Exemplo: Quero marcar uma consulta para amanhã.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid gap-3 rounded-[1.6rem] border p-4 md:grid-cols-[220px,1fr]" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.88)', borderColor: isDark ? 'rgba(148,163,184,0.08)' : '#dbe4ee' }}>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Canal do teste</Label>
                                            <div className="grid grid-cols-2 gap-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => setFlowTestChannel('webchat')}
                                                    className="rounded-xl"
                                                    style={flowTestChannel === 'webchat' ? { borderColor: '#0891b2', color: '#0891b2' } : undefined}
                                                >
                                                    Webchat
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => setFlowTestChannel('whatsapp')}
                                                    className="rounded-xl"
                                                    style={flowTestChannel === 'whatsapp' ? { borderColor: '#0891b2', color: '#0891b2' } : undefined}
                                                >
                                                    WhatsApp
                                                </Button>
                                            </div>
                                        </div>
                                        {flowTestChannel === 'whatsapp' && (
                                            <div className="space-y-2">
                                                <Label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Número de destino</Label>
                                                <Input
                                                    value={flowTestPhone}
                                                    onChange={(e) => setFlowTestPhone(e.target.value)}
                                                    placeholder="Ex.: 5511999999999"
                                                    className="rounded-xl"
                                                />
                                                <p className="text-xs text-slate-500">
                                                    Integração atual: {currentWhatsAppIntegration?.phone_number || 'não encontrada'}.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-end gap-3 rounded-[2rem] p-3" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.88)', border: isDark ? '1px solid rgba(148,163,184,0.08)' : '1px solid rgba(148,163,184,0.1)', boxShadow: isDark ? '0 24px 44px -30px rgba(0,0,0,0.45)' : '0 20px 38px -30px rgba(15,23,42,0.12)' }}>
                                        <Textarea
                                            value={inputValue}
                                            onChange={(e) => setInputValue(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault()
                                                    handleExecuteFlow()
                                                }
                                            }}
                                            placeholder="Digite a mensagem que o cliente enviaria para o fluxo..."
                                            rows={3}
                                            className="min-h-[90px] flex-1 resize-none border-0 bg-transparent px-4 py-3 text-base shadow-none focus-visible:ring-0"
                                            style={{
                                                color: isDark ? '#fafafa' : '#0f172a'
                                            }}
                                        />
                                        <Button
                                            onClick={handleExecuteFlow}
                                            disabled={isExecutingFlow || !inputValue.trim()}
                                            className="shrink-0 rounded-full px-6 py-6 text-sm font-semibold"
                                            style={{
                                                ...((isExecutingFlow || !inputValue.trim())
                                                    ? { background: '#94a3b8', color: '#ffffff', boxShadow: '0 8px 18px -14px rgba(15,23,42,0.18)' }
                                                    : primaryButtonStyle)
                                            }}
                                        >
                                            {isExecutingFlow ? <RefreshCw className="h-4 w-4 animate-spin mr-2" style={{ color: '#ffffff' }} /> : <Play className="h-4 w-4 mr-2 fill-current" style={{ color: '#ffffff' }} />}
                                            <span style={{ color: '#ffffff' }}>Executar fluxo</span>
                                        </Button>
                                    </div>
                                    <p className="mt-4 text-center text-[10px] font-medium uppercase tracking-[0.14em]" style={{ 
                                        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
                                        color: theme === 'dark' ? '#22d3ee' : '#0891b2',
                                        opacity: 0.75
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
