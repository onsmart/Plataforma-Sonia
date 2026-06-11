
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
import { normalizeAgentLanguageCode } from "../lib/agent-language"
import { cn } from "../components/ui/utils"
import { fetchFlowsList } from "../services/flows-api"
import { useAgentVoiceProfile } from "../hooks/useAgentVoiceProfile"
import { VoiceService } from "../services/voice"
import { AudioVisualizer } from "../components/live/AudioVisualizer"

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
    flowKind?: 'main' | 'subflow'
}

interface PlaygroundMetrics {
    totalTurns: number
    lastResponseMs: number | null
    averageResponseMs: number | null
    lastVoiceMs: number | null
    averageVoiceMs: number | null
    estimatedAssertiveness: number | null
    browserVoiceFallbacks: number
    lastVoiceMode: 'agent' | 'browser' | 'none'
}

export function Playground() {
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
    const [flowTestSession, setFlowTestSession] = useState<{
        executionId?: string
        resumeNodeId?: string | null
        finalData?: Record<string, unknown>
        executionHistory?: any[]
        pausedForUserReply?: boolean
    } | null>(null)
    const [playgroundMetrics, setPlaygroundMetrics] = useState<PlaygroundMetrics>({
        totalTurns: 0,
        lastResponseMs: null,
        averageResponseMs: null,
        lastVoiceMs: null,
        averageVoiceMs: null,
        estimatedAssertiveness: null,
        browserVoiceFallbacks: 0,
        lastVoiceMode: 'none'
    })

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
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const activeVoiceUrlRef = useRef<string | null>(null)
    const voicePlaybackRequestRef = useRef(0)
    const isSpeakingRef = useRef(false)
    const isCallActiveRef = useRef(false)
    const hasHandledSpeechResultRef = useRef(false)

    // Seed State
    const [isSeeding, setIsSeeding] = useState(false)

    const scrollRef = useRef<HTMLDivElement>(null)
    const callTimerRef = useRef<any>(null)
    const { data: voiceProfileData, isLoading: isVoiceProfileLoading } = useAgentVoiceProfile(selectedAgent?.id || null)

    const normalizeAgentReplyText = (value: unknown) => {
        const rawText = String(value || "").trim()
        if (!rawText) {
            return t('errors.noResponse')
        }

        return rawText
            .replace(/```[\s\S]*?```/g, ' ')
            .replace(/`([^`]+)`/g, '$1')
            .replace(/\*\*([^*]+)\*\*/g, '$1')
            .replace(/\*([^*]+)\*/g, '$1')
            .replace(/__([^_]+)__/g, '$1')
            .replace(/_([^_]+)_/g, '$1')
            .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
            .replace(/https?:\/\/\S+/gi, '')
            .replace(/[#>-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim() || t('errors.noResponse')
    }

    const formatLatency = (value: number | null) => {
        if (value == null) return '--'
        if (value < 1000) return `${Math.round(value)}ms`
        return `${(value / 1000).toFixed(1)}s`
    }

    const getLatencyTone = (value: number | null) => {
        if (value == null) return 'text-muted-foreground'
        if (value <= 2000) return 'text-emerald-600'
        if (value <= 5000) return 'text-amber-600'
        return 'text-destructive'
    }

    const estimateAssertiveness = (reply: string) => {
        const normalized = reply.trim()
        if (!normalized) return 0

        let score = 0.72
        const lower = normalized.toLowerCase()
        const length = normalized.length

        if (length >= 80) score += 0.08
        if (length >= 180) score += 0.04
        if (/[.!?]/.test(normalized)) score += 0.03
        if (/\d/.test(normalized)) score += 0.03
        if (/(passo|etapa|opcao|opção|recomendo|seguinte|primeiro|segundo|terceiro|clique|acesse)/i.test(lower)) score += 0.05
        if (/(nao sei|não sei|talvez|acho que|possivelmente|provavelmente|não tenho certeza|nao tenho certeza)/i.test(lower)) score -= 0.18
        if (/(desculpe|desculpa|infelizmente)/i.test(lower)) score -= 0.08
        if (length < 40) score -= 0.12

        return Math.max(0, Math.min(0.99, score))
    }

    const updateResponseMetrics = (responseMs: number, assertiveness: number) => {
        setPlaygroundMetrics((prev) => {
            const totalTurns = prev.totalTurns + 1
            const averageResponseMs = prev.averageResponseMs == null
                ? responseMs
                : ((prev.averageResponseMs * prev.totalTurns) + responseMs) / totalTurns

            return {
                ...prev,
                totalTurns,
                lastResponseMs: responseMs,
                averageResponseMs,
                estimatedAssertiveness: assertiveness,
            }
        })
    }

    const updateVoiceMetrics = (voiceMs: number, mode: 'agent' | 'browser', usedFallback: boolean) => {
        setPlaygroundMetrics((prev) => {
            const sampleCount = prev.lastVoiceMs == null ? 1 : prev.totalTurns || 1
            const averageVoiceMs = prev.averageVoiceMs == null
                ? voiceMs
                : ((prev.averageVoiceMs * (sampleCount - 1)) + voiceMs) / sampleCount

            return {
                ...prev,
                lastVoiceMs: voiceMs,
                averageVoiceMs,
                browserVoiceFallbacks: prev.browserVoiceFallbacks + (usedFallback ? 1 : 0),
                lastVoiceMode: mode
            }
        })
    }

    const resetPlaygroundMetrics = () => {
        setPlaygroundMetrics({
            totalTurns: 0,
            lastResponseMs: null,
            averageResponseMs: null,
            lastVoiceMs: null,
            averageVoiceMs: null,
            estimatedAssertiveness: null,
            browserVoiceFallbacks: 0,
            lastVoiceMode: 'none'
        })
    }

    const getAssertivenessTone = (value: number | null) => {
        if (value == null) return 'text-muted-foreground'
        if (value >= 0.85) return 'text-emerald-600'
        if (value >= 0.72) return 'text-amber-600'
        return 'text-destructive'
    }

    const getAssertivenessLabel = (value: number | null) => {
        if (value == null) return 'Sem leitura'
        if (value >= 0.85) return 'Alta'
        if (value >= 0.72) return 'Média'
        return 'Baixa'
    }

    const getVoiceModeLabel = (mode: PlaygroundMetrics['lastVoiceMode']) => {
        if (mode === 'agent') return 'Voz do agente'
        if (mode === 'browser') return 'Fallback local'
        return 'Sem áudio'
    }

    const setSpeakingState = (value: boolean) => {
        isSpeakingRef.current = value
        setIsSpeaking(value)
    }

    const setCallActiveState = (value: boolean) => {
        isCallActiveRef.current = value
        setIsCallActive(value)
    }

    const revokeActiveVoiceUrl = () => {
        if (activeVoiceUrlRef.current) {
            URL.revokeObjectURL(activeVoiceUrlRef.current)
            activeVoiceUrlRef.current = null
        }
    }

    const stopVoicePlayback = () => {
        voicePlaybackRequestRef.current += 1
        if (audioRef.current) {
            audioRef.current.pause()
            audioRef.current.src = ""
            audioRef.current = null
        }
        revokeActiveVoiceUrl()
        if (synthesisRef.current) synthesisRef.current.cancel()
        setSpeakingState(false)
    }

    const voiceProfile = voiceProfileData?.profile || null
    const hasSavedAgentVoiceConfig = Boolean(
        voiceProfile?.enabled &&
        voiceProfile?.voiceId
    )
    const hasConfiguredAgentVoice = Boolean(
        voiceProfileData?.providerConfigured &&
        hasSavedAgentVoiceConfig
    )

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
        resetPlaygroundMetrics()
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
            stopVoicePlayback()
        }
    }, [])

    const getAgentLocale = () => {
        return normalizeAgentLanguageCode(selectedAgent?.languages?.[0], 'pt-BR')
    }

    const speakWithBrowserVoice = (text: string) => {
        if (!synthesisRef.current || isMuted) return
        synthesisRef.current.cancel()
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = getAgentLocale()
        const voices = synthesisRef.current.getVoices()
        const preferredVoice = voices.find(v => v.lang === utterance.lang && v.name.includes('Google')) || voices.find(v => v.lang === utterance.lang)
        if (preferredVoice) utterance.voice = preferredVoice
        utterance.onstart = () => {
            setSpeakingState(true)
            if (recognitionRef.current) recognitionRef.current.stop()
        }
        utterance.onend = () => {
            setSpeakingState(false)
            if (isCallActive) startListening()
        }
        synthesisRef.current.speak(utterance)
    }

    const speak = async (text: string) => {
        if (!selectedAgent || isMuted) return

        stopVoicePlayback()
        const voiceStartedAt = performance.now()

        if (!hasConfiguredAgentVoice) {
            updateVoiceMetrics(performance.now() - voiceStartedAt, 'browser', false)
            speakWithBrowserVoice(text)
            return
        }

        const requestId = ++voicePlaybackRequestRef.current
        setSpeakingState(true)
        if (recognitionRef.current) recognitionRef.current.stop()

        try {
            const audioBlob = await VoiceService.generateAgentVoiceResponse(selectedAgent.id, {
                text,
                channel: 'web',
            })

            updateVoiceMetrics(performance.now() - voiceStartedAt, 'agent', false)

            if (requestId !== voicePlaybackRequestRef.current || isMuted) {
                setSpeakingState(false)
                return
            }

            const audioUrl = URL.createObjectURL(audioBlob)
            activeVoiceUrlRef.current = audioUrl
            const audio = new Audio(audioUrl)
            audioRef.current = audio

            audio.onended = () => {
                if (requestId !== voicePlaybackRequestRef.current) return
                audioRef.current = null
                revokeActiveVoiceUrl()
                setSpeakingState(false)
                if (isCallActive) startListening()
            }

            audio.onerror = () => {
                if (requestId !== voicePlaybackRequestRef.current) return
                audioRef.current = null
                revokeActiveVoiceUrl()
                updateVoiceMetrics(performance.now() - voiceStartedAt, 'browser', true)
                setSpeakingState(false)
                speakWithBrowserVoice(text)
            }

            await audio.play()
        } catch (error) {
            console.error('[Playground] Erro ao reproduzir voz configurada do agente:', error)
            updateVoiceMetrics(performance.now() - voiceStartedAt, 'browser', true)
            setSpeakingState(false)
            speakWithBrowserVoice(text)
        }
    }

    const startListening = () => {
        if (!isCallActiveRef.current) return
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        if (!SpeechRecognition) {
            toast.warning(
                t('button.activateVoice', { defaultValue: 'Ativar Voz' }),
                {
                    description: t('errors.speechRecognitionUnavailable', {
                        defaultValue: 'Este navegador não oferece suporte ao reconhecimento de voz usado no laboratório.'
                    })
                }
            )
            setCallActiveState(false)
            return
        }
        if (recognitionRef.current) {
            recognitionRef.current.lang = getAgentLocale()
            try { recognitionRef.current.start() } catch (e) { }
            return
        }
        const recognition = new SpeechRecognition()
        recognition.lang = getAgentLocale()
        recognition.continuous = false
        recognition.interimResults = false
        recognition.maxAlternatives = 1
        recognition.onstart = () => {
            hasHandledSpeechResultRef.current = false
        }
        recognition.onresult = (event: any) => {
            const result = event.results?.[event.resultIndex] || event.results?.[0]
            const transcript = result?.[0]?.transcript?.trim()
            if (!transcript || hasHandledSpeechResultRef.current) return

            hasHandledSpeechResultRef.current = true
            void handleSendMessage(transcript)
        }
        recognition.onend = () => {
            if (isCallActiveRef.current && !isSpeakingRef.current && !synthesisRef.current?.speaking) {
                try { recognition.start() } catch (e) { }
            }
        }
        recognition.onerror = (event: any) => {
            hasHandledSpeechResultRef.current = false
            const errorCode = String(event?.error || '')

            if (errorCode === 'not-allowed' || errorCode === 'service-not-allowed') {
                toast.error('Microfone bloqueado', {
                    description: 'Permita o uso do microfone no navegador para continuar usando a voz no laboratório.'
                })
                setCallActiveState(false)
                return
            }

            if (errorCode === 'audio-capture') {
                toast.error('Microfone indisponível', {
                    description: 'Nenhum dispositivo de captura de áudio foi encontrado.'
                })
                setCallActiveState(false)
                return
            }
        }
        recognitionRef.current = recognition
        try { recognition.start() } catch (e) { }
    }

    useEffect(() => {
        if (user?.email) {
            loadAgents()
            loadFlows()
            WhatsAppService.getCurrentIntegration()
                .then(setCurrentWhatsAppIntegration)
                .catch(() => setCurrentWhatsAppIntegration(null))
        }
    }, [user?.email])

    const loadFlows = async () => {
        if (!user?.email) {
            return
        }

        try {
            const mainFlows = (await fetchFlowsList(user.email, { mainOnly: true })) as Flow[]
            setFlows(mainFlows)
            setSelectedFlow((current) =>
                current && mainFlows.some((flow) => flow.id === current.id) ? current : null
            )
        } catch (error) {
            console.error('[Playground] Erro ao carregar flows:', error)
            if ((error as Error)?.message) {
                toast.error(t('errors.loadFlows'))
            }
            setFlows([])
            setSelectedFlow(null)
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
        setFlowTestSession(null)
    }

    const handleExecuteFlow = async () => {
        if (!selectedFlow || !user?.email) {
            toast.error(t('errors.flowOrUserNotFound'))
            return
        }

        const flowInput = flowTestChannel === 'whatsapp' ? '' : inputValue.trim()
        if (flowTestChannel !== 'whatsapp' && !flowInput) {
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

        const initialData: Record<string, unknown> = {
            channel: flowTestChannel,
            channel_origin: flowTestChannel === 'whatsapp' ? 'whatsapp' : 'webchat',
            integrations_id: flowTestChannel === 'whatsapp' ? currentWhatsAppIntegration?.id : undefined,
            whatsapp_contact_id: flowTestChannel === 'whatsapp' ? normalizedPhone : undefined,
            phone_number: flowTestChannel === 'whatsapp' ? normalizedPhone : undefined,
            ...(flowTestSession?.finalData || {}),
        }

        if (flowInput) {
            initialData.message = flowInput
            initialData.originalMessage = flowInput
            initialData.userMessage = flowInput
            initialData.input = flowInput
        }

        if (flowInput) {
            setMessages((current) => [
                ...current,
                {
                    id: `flow-user-${Date.now()}`,
                    role: 'user',
                    content: flowInput,
                    timestamp: new Date().toISOString(),
                },
            ])
        }

        setIsExecutingFlow(true)
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
                    execution_mode: 'test',
                    delivery_channel: flowTestChannel === 'whatsapp' ? 'whatsapp' : 'none',
                    integrations_id: flowTestChannel === 'whatsapp' ? currentWhatsAppIntegration?.id : undefined,
                    recipient_id: flowTestChannel === 'whatsapp' ? normalizedPhone : undefined,
                    initial_data: initialData,
                    resume_session: flowTestSession?.pausedForUserReply
                        ? {
                            execution_id: flowTestSession.executionId,
                            resume_node_id: flowTestSession.resumeNodeId,
                            execution_history: flowTestSession.executionHistory,
                            data: flowTestSession.finalData,
                        }
                        : undefined,
                })
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.details || error.error || t('errors.executeFlow'))
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

            const outbound = String(result.outboundMessage || '').trim()
            if (outbound) {
                setMessages((current) => [
                    ...current,
                    {
                        id: `flow-assistant-${Date.now()}`,
                        role: 'assistant',
                        content: outbound,
                        timestamp: new Date().toISOString(),
                    },
                ])
            }

            setFlowTestSession({
                executionId: result.executionId,
                resumeNodeId: result.resumeNodeId || null,
                finalData: result.finalData || {},
                executionHistory: result.executionHistory || [],
                pausedForUserReply: Boolean(result.pausedForUserReply),
            })

            const hasErrors = processedHistory.some((h: any) => !h.success)
            if (result.pausedForUserReply) {
                toast.message('Fluxo aguardando sua próxima mensagem. Envie outra resposta para continuar.')
            } else if (!hasErrors) {
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
        setCallActiveState(false)
        stopVoicePlayback()
        resetPlaygroundMetrics()
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
        const requestStartedAt = performance.now()

        try {
            const { BASE_URL, getAuthHeaders } = await import('../services/api')
            const response = await fetch(`${BASE_URL}/agents/chat`, {
                method: 'POST',
                headers: await getAuthHeaders(),
                body: JSON.stringify({
                    agent_id: selectedAgent.id,
                    message: textToSend
                })
            })

            if (!response.ok) {
                throw new Error(response.statusText)
                throw new Error(t('errors.sendMessage'))
            }

            const data = await response.json()
            const normalizedReply = normalizeAgentReplyText(data.reply)
            const responseMs = performance.now() - requestStartedAt
            const assertiveness = estimateAssertiveness(normalizedReply)
            updateResponseMetrics(responseMs, assertiveness)
            const assistantMsg: ChatMessage = {
                role: 'assistant',
                content: normalizedReply,
                meta: typeof data.reply === 'string'
                    ? {
                        rawContent: data.reply,
                        latency: Math.round(responseMs),
                        assertiveness
                    }
                    : {
                        latency: Math.round(responseMs),
                        assertiveness
                    }
            }
            setMessages(prev => [...prev, assistantMsg])
            if (isCallActiveRef.current) {
                void speak(normalizedReply)
            }
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
        isCallActiveRef.current = isCallActive
        if (isCallActive) {
            startListening()
            callTimerRef.current = setInterval(() => {
                setCallDuration(prev => prev + 1)
            }, 1000)
        } else {
            if (recognitionRef.current) recognitionRef.current.stop()
            stopVoicePlayback()
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

    const getCallMode = (): "listening" | "speaking" | "thinking" | "idle" => {
        if (!isCallActive) return "idle"
        if (isLoading) return "thinking"
        if (isSpeaking) return "speaking"
        return "listening"
    }

    const handleToggleCall = () => {
        if (!isCallActiveRef.current && isVoiceProfileLoading) {
            toast.warning(
                t('button.activateVoice', { defaultValue: 'Ativar Voz' }),
                {
                    description: t('button.loadingVoiceConfig', {
                        defaultValue: 'Aguarde um instante enquanto a configuração de voz do agente é carregada.'
                    })
                }
            )
            return
        }

        if (!isCallActiveRef.current && !hasSavedAgentVoiceConfig) {
            toast.warning(
                t('button.activateVoice', { defaultValue: 'Ativar Voz' }),
                {
                    description: t('button.configureVoiceFirst', {
                        defaultValue: 'Configure e habilite a voz do agente antes de ativar o áudio no laboratório.'
                    })
                }
            )
            return
        }

        setCallActiveState(!isCallActiveRef.current)
    }

    const panelClass =
        "rounded-xl border border-border/60 bg-white/85 backdrop-blur-sm text-card-foreground shadow-sm dark:border-white/[0.07] dark:bg-card/60 dark:shadow-none"
    const rowClass =
        "rounded-lg border border-border/70 bg-muted/20 transition-colors hover:bg-muted/40 dark:border-border dark:bg-muted/30 dark:hover:bg-muted/50"
    const selectedRowClass =
        "rounded-lg border border-primary bg-primary text-primary-foreground transition-colors"
    const iconWellClass =
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background/80 text-muted-foreground dark:border-border dark:bg-background/40"
    const selectedIconWellClass =
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary-foreground/25 bg-primary-foreground/15 text-primary-foreground"
    const sectionHeaderClass = "border-b border-border/60 bg-muted/20 dark:bg-muted/20"
    const actionButtonClass =
        "h-9 rounded-lg border-border/80 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] shadow-none"
    const softPanelClass = "rounded-lg border border-border/60 bg-white/80 backdrop-blur-sm shadow-sm dark:border-white/[0.07] dark:bg-card/60 dark:shadow-none"
    const promptButtonClass =
        "rounded-lg border border-border/70 bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted/50 dark:border-border"
    const labMetricCardClass = "rounded-lg border border-border/60 bg-white/80 backdrop-blur-sm px-3 py-2.5 shadow-sm dark:border-white/[0.07] dark:bg-card/60"

    if (!isLoading && agents.length === 0) {
        return (
            <div className="flex h-[calc(100vh-2rem)] items-center justify-center rounded-lg border border-border/60 bg-white/85 backdrop-blur-sm dark:border-white/[0.07] dark:bg-card/60">
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
                className="playground-root flex h-[calc(100dvh-6rem)] max-h-[calc(100dvh-6rem)] min-h-0 w-full min-w-0 flex-1 flex-col gap-4 overflow-hidden p-3 font-sans antialiased selection:bg-primary/10 sm:gap-5 sm:p-4 lg:flex-row lg:p-5"
                style={{
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
                .playground-chat-scroll::-webkit-scrollbar {
                    width: 8px;
                }
                .playground-chat-scroll::-webkit-scrollbar-track {
                    background: transparent;
                }
                .playground-chat-scroll::-webkit-scrollbar-thumb {
                    background-color: rgba(148, 163, 184, 0.6);
                    border-radius: 9999px;
                }
                .playground-chat-scroll::-webkit-scrollbar-thumb:hover {
                    background-color: rgba(148, 163, 184, 0.85);
                }
                .playground-chat-scroll {
                    scrollbar-width: thin;
                    scrollbar-color: rgba(148, 163, 184, 0.7) transparent;
                }
                .playground-root {
                    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
                }
            `}</style>

            {/* SIDEBAR: COLUNA DE COMANDO */}
            <aside className={cn("flex max-h-[38vh] min-h-0 w-full shrink-0 flex-col overflow-hidden lg:h-full lg:max-h-none lg:w-[292px] xl:w-[304px]", panelClass)}>
                <div className={cn("flex min-h-[4.1rem] shrink-0 items-center px-4 py-3", sectionHeaderClass)}>
                    <h2 className="flex items-center gap-3 text-xs font-semibold uppercase leading-normal tracking-[0.12em] text-primary">
                        <Cpu className="h-5 w-5" />
                        {t('header.title')}
                    </h2>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Info className="ml-2 h-4 w-4 cursor-help text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent className="bg-slate-900 text-white border-slate-700 max-w-xs">
                            <p className="text-xs font-bold mb-1">{t('header.title')}</p>
                            <p className="text-xs text-slate-300">{t('header.description')}</p>
                        </TooltipContent>
                    </Tooltip>
                </div>

                <div className="flex-1 min-h-0 overflow-hidden">
                    <div className="flex h-full min-h-0 flex-col gap-4 p-4">
                        {/* Fluxos */}
                        <div className="flex min-h-0 max-h-[36%] flex-col gap-2.5">
                            <div className="flex items-center gap-2">
                                <span className="px-1 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{t('sidebar.automationsAvailable')}</span>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Info className="h-3 w-3 cursor-help text-muted-foreground/70" />
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-slate-900 text-white border-slate-700 max-w-xs">
                                        <p className="text-xs font-bold mb-1">{t('sidebar.automations')}</p>
                                        <p className="text-xs text-slate-300">{t('sidebar.automationsDescription')}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                            <div className="playground-sidebar-scroll min-h-0 space-y-2 overflow-y-auto pr-1">
                                {flows.length === 0 ? (
                                    <div className="p-4 text-center">
                                        <p className="text-[9px] font-medium text-muted-foreground">
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
                                                className={cn(
                                                    "group relative flex min-h-[3.1rem] w-full items-center gap-2 overflow-hidden px-3 py-2.5 text-left",
                                                    isSelected ? selectedRowClass : rowClass
                                                )}
                                            >
                                                <div className="relative shrink-0 z-10">
                                                    <div
                                                        className={isSelected ? selectedIconWellClass : iconWellClass}
                                                    >
                                                        <GitBranch 
                                                            size={18} 
                                                            strokeWidth={2.2}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="relative z-10 flex min-w-0 flex-1 items-center gap-2 pl-0.5">
                                                    <span
                                                        className={cn(
                                                            "line-clamp-2 min-w-0 break-words text-left text-[11px] font-medium leading-[1.45] tracking-normal",
                                                            isSelected ? "text-primary-foreground" : "text-foreground"
                                                        )}
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
                        <div className="flex min-h-0 flex-1 flex-col gap-2.5">
                            <div className="flex items-center gap-2">
                                <span className="px-1 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{t('sidebar.agentsAvailable')}</span>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Info className="h-3 w-3 cursor-help text-muted-foreground/70" />
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-slate-900 text-white border-slate-700 max-w-xs">
                                        <p className="text-xs font-bold mb-1">{t('sidebar.agents')}</p>
                                        <p className="text-xs text-slate-300">{t('sidebar.agentsDescription')}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                            <div className="playground-sidebar-scroll min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                                {agents.map(agent => {
                                    const isSelected = selectedAgent?.id === agent.id
                                    return (
                                        <button
                                            key={agent.id}
                                            onClick={() => handleSelectAgent(agent)}
                                            className={cn(
                                                    "group relative flex min-h-[3.1rem] w-full items-center gap-2 overflow-hidden px-3 py-2.5 text-left",
                                                isSelected ? selectedRowClass : rowClass
                                            )}
                                        >
                                            <div className="relative shrink-0 z-10">
                                                <div
                                                    className={cn(
                                                        "text-xs font-semibold",
                                                        isSelected ? selectedIconWellClass : iconWellClass
                                                    )}
                                                >
                                                    {agent.avatar}
                                                </div>
                                            </div>
                                            <div className="relative z-10 flex min-w-0 flex-1 items-center gap-2 pl-0.5">
                                                <div 
                                                    className={cn(
                                                        "h-2.5 w-2.5 shrink-0 rounded-full border border-background",
                                                        agent.status_id === 1 && "bg-emerald-500",
                                                        (agent.status_id === 3 || agent.status_id === 4) && "bg-yellow-500",
                                                        agent.status_id !== 1 && agent.status_id !== 3 && agent.status_id !== 4 && "bg-destructive",
                                                        isSelected && "border-primary-foreground"
                                                    )}
                                                />
                                                <span
                                                    className={cn(
                                                        "line-clamp-2 min-w-0 break-words text-left text-[11px] font-medium leading-[1.45] tracking-normal",
                                                        isSelected ? "text-primary-foreground" : "text-foreground"
                                                    )}
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
            <main className={cn("relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden", panelClass)}>

                {/* HEADER — altura mínima + overflow visível para não cortar ascendentes/descendentes */}
                <header className={cn("flex min-h-[4.9rem] shrink-0 items-center justify-between gap-3 overflow-visible px-4 py-3 sm:px-5 lg:px-6", sectionHeaderClass)}>
                    <div className="flex min-w-0 items-center gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                            {selectedFlow ? <GitBranch size={18} strokeWidth={2.8} /> : <Bot size={18} strokeWidth={2.4} />}
                        </div>
                        <div className="min-w-0 overflow-visible py-0.5">
                            <h3 className="line-clamp-2 break-words text-lg font-semibold leading-[1.3] tracking-tight text-foreground sm:text-[1.6rem] sm:leading-[1.3]">
                                {selectedFlow ? selectedFlow.name : formatAgentName(selectedAgent?.name)}
                            </h3>
                            <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                <p className="text-[10px] font-medium uppercase leading-normal tracking-[0.08em] text-muted-foreground">{t('header.testEnvironment')}</p>
                                {selectedAgent?.channels && selectedAgent.channels.length > 1 && (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="ml-2 flex items-center gap-1 rounded-lg border border-border/70 bg-muted/30 p-1 dark:border-border">
                                                {selectedAgent.channels.map(ch => (
                                                    <button
                                                        key={ch}
                                                        onClick={() => setActiveChannel(ch)}
                                                        className={cn(
                                                            "rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                                                            activeChannel === ch && "bg-background text-primary shadow-sm"
                                                        )}
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

                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                        {selectedAgent && (
                            <>
                                {!selectedFlow && (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="outline"
                                                onClick={handleClearConversation}
                                                disabled={messages.length === 0}
                                                className={actionButtonClass}
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
                                            onClick={handleToggleCall}
                                            className={cn(
                                                actionButtonClass,
                                                "relative overflow-hidden transition-all",
                                                isCallActive && "border-destructive pr-5"
                                            )}
                                        >
                                            {isCallActive && (
                                                <span className="absolute inset-0 bg-destructive/10" aria-hidden="true" />
                                            )}
                                            <span className="relative flex items-center gap-2">
                                                <span className="relative flex items-center">
                                                    {isCallActive ? (
                                                        <>
                                                            <span className="absolute inline-flex h-6 w-6 animate-ping rounded-full bg-destructive/30" aria-hidden="true" />
                                                            <PhoneOff className="relative h-4 w-4" />
                                                        </>
                                                    ) : (
                                                        <Phone className="h-4 w-4" />
                                                    )}
                                                </span>
                                                <span>{isCallActive ? t('button.deactivateVoice', { defaultValue: 'Finalizar ligação' }) : t('button.activateVoice')}</span>
                                                {isCallActive && (
                                                    <>
                                                        <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-bold tabular-nums text-destructive-foreground">
                                                            {formatDuration(callDuration)}
                                                        </span>
                                                        <span className="hidden sm:flex">
                                                            <AudioVisualizer
                                                                isActive={isCallActive}
                                                                mode={getCallMode()}
                                                                framework="agno"
                                                            />
                                                        </span>
                                                    </>
                                                )}
                                            </span>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-slate-900 text-white border-slate-700 max-w-xs">
                                        <p className="text-xs font-bold mb-1">{isCallActive ? t('button.deactivateVoice', { defaultValue: 'Finalizar ligação' }) : t('button.activateVoice')}</p>
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
                                            className={actionButtonClass}
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

                <div className="flex min-h-0 flex-1 overflow-hidden">
                    {/* ÁREA DE CHAT OU EXECUÇÃO DE FLOW */}
                    <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
                        {/* ÁREA DE MENSAGENS COM SCROLL */}
                        <div className="playground-chat-scroll h-0 min-h-0 flex-1 overflow-y-auto overscroll-contain">
                            {selectedFlow ? (
                                <div className="space-y-8 p-4 sm:p-5 lg:p-6">
                                    {(isExecutingFlow || flowExecutionHistory.length > 0) ? (
                                        <div className="mx-auto max-w-5xl space-y-8 animate-in fade-in duration-300">
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
                                        <div className="flex flex-col items-center py-14 text-center">
                                            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-lg border border-border/70 bg-muted/30 text-primary dark:border-border">
                                                <GitBranch size={34} strokeWidth={2.4} />
                                            </div>
                                            <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-foreground">{t('flow.readyToExecute')}</h4>
                                            <p className="mt-2 max-w-md text-sm font-medium leading-relaxed text-muted-foreground">
                                                {t('flow.clickExecuteButton')}
                                            </p>
                                            <p className="mt-4 max-w-sm text-xs text-muted-foreground">
                                                {t('flow.realTimeProcessing')}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="mx-auto max-w-3xl space-y-5 px-4 pb-5 pt-5 sm:px-5 lg:px-8">
                                    {selectedAgent && (
                                        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
                                            <div className={labMetricCardClass}>
                                                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Tempo resposta</p>
                                                <p className={cn("mt-1.5 text-base font-semibold", getLatencyTone(playgroundMetrics.lastResponseMs))}>
                                                    {formatLatency(playgroundMetrics.lastResponseMs)}
                                                </p>
                                                <p className="mt-0.5 text-[11px] text-muted-foreground">
                                                    Média: {formatLatency(playgroundMetrics.averageResponseMs)}
                                                </p>
                                            </div>
                                            <div className={labMetricCardClass}>
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Tempo do áudio</p>
                                                <p className={cn("mt-1.5 text-base font-semibold", getLatencyTone(playgroundMetrics.lastVoiceMs))}>
                                                    {formatLatency(playgroundMetrics.lastVoiceMs)}
                                                </p>
                                                <p className="mt-0.5 text-[11px] text-muted-foreground">
                                                    {getVoiceModeLabel(playgroundMetrics.lastVoiceMode)}
                                                </p>
                                            </div>
                                            <div className={labMetricCardClass}>
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Assertividade estimada</p>
                                                <p className={cn("mt-1.5 text-base font-semibold", getAssertivenessTone(playgroundMetrics.estimatedAssertiveness))}>
                                                    {playgroundMetrics.estimatedAssertiveness == null ? '--' : `${Math.round(playgroundMetrics.estimatedAssertiveness * 100)}%`}
                                                </p>
                                                <p className="mt-0.5 text-[11px] text-muted-foreground">
                                                    {getAssertivenessLabel(playgroundMetrics.estimatedAssertiveness)}
                                                </p>
                                            </div>
                                            <div className={labMetricCardClass}>
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Fallbacks de voz</p>
                                                <p className="mt-1.5 text-base font-semibold text-foreground">
                                                    {playgroundMetrics.browserVoiceFallbacks}
                                                </p>
                                                <p className="mt-0.5 text-[11px] text-muted-foreground">
                                                    {playgroundMetrics.totalTurns} resposta(s) testada(s)
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {messages.length === 0 && (
                                        <div className="flex flex-col items-center py-12 text-center">
                                            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-lg border border-border/70 bg-muted/30 text-primary dark:border-border">
                                                <MessageSquare size={34} strokeWidth={2.4} />
                                            </div>
                                            <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-foreground">{t('chat.readyToChat')}</h4>
                                            <p className="mt-1.5 max-w-md text-sm font-medium leading-relaxed text-muted-foreground">
                                                {t('chat.typeMessageBelow', { agentName: formatAgentName(selectedAgent?.name) })}
                                            </p>
                                            <p className="mb-4 mt-3 max-w-sm text-xs text-muted-foreground">
                                                {t('chat.safeArea')}
                                            </p>
                                            {/* Prompt Starters */}
                                            <div className="mt-2 flex max-w-2xl flex-wrap justify-center gap-2.5">
                                                <button
                                                    onClick={() => setInputValue(t('chat.promptStarter.help'))}
                                                    className={promptButtonClass}
                                                >
                                                    {t('chat.promptStarter.help')}
                                                </button>
                                                <button
                                                    onClick={() => setInputValue(t('chat.promptStarter.knowledgeBase'))}
                                                    className={promptButtonClass}
                                                >
                                                    {t('chat.promptStarter.knowledgeBase')}
                                                </button>
                                                <button
                                                    onClick={() => setInputValue(t('chat.promptStarter.explainFeatures'))}
                                                    className={promptButtonClass}
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
                                                className={cn("mb-5 flex w-full animate-in fade-in duration-300", isUser ? "justify-end" : "justify-start")}
                                            >
                                                <div className={`flex max-w-[min(86%,40rem)] items-end gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                                                    {/* Avatar */}
                                                    <div className={cn(
                                                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border",
                                                        isUser
                                                            ? "border-border/70 bg-muted/30 text-primary dark:border-border"
                                                            : "border-primary bg-primary text-primary-foreground"
                                                    )}>
                                                        {isUser ? <User className="h-4.5 w-4.5" strokeWidth={2.4} /> : <Bot className="h-4.5 w-4.5" strokeWidth={2.4} />}
                                                    </div>
                                                    
                                                    {/* Balão de mensagem - MAIOR E MAIS ARREDONDADO */}
                                                    <div
                                                        className={cn(
                                                            "w-fit max-w-full rounded-lg border px-5 py-4 text-[15px] font-medium leading-7 text-foreground shadow-sm",
                                                            isUser
                                                                ? "border-primary/20 bg-primary/10 dark:bg-primary/15"
                                                                : "border-border/70 bg-card dark:border-border"
                                                        )}
                                                    >
                                                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                                                        {msg.role === 'assistant' && msg.meta && (
                                                            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                                                {typeof msg.meta.latency === 'number' && (
                                                                    <span className="rounded-full bg-muted px-2 py-1">
                                                                        Resposta {formatLatency(msg.meta.latency)}
                                                                    </span>
                                                                )}
                                                                {typeof msg.meta.assertiveness === 'number' && (
                                                                    <span className="rounded-full bg-muted px-2 py-1">
                                                                        Assertividade {Math.round(msg.meta.assertiveness * 100)}%
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                        
                                                        {/* Seta do balão */}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    
                                    {/* Balão de pensamento quando está carregando */}
                                    {isLoading && selectedAgent && (
                                        <div className="mb-5 flex w-full justify-start animate-in fade-in duration-300">
                                            <div className="flex max-w-[min(86%,40rem)] items-end gap-3 flex-row">
                                                {/* Avatar */}
                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary bg-primary text-primary-foreground">
                                                    <Bot className="h-4.5 w-4.5" strokeWidth={2.4} />
                                                </div>
                                                
                                                {/* Balão de pensamento - MAIOR */}
                                                <div className="rounded-lg border border-border/70 bg-card px-3.5 py-3 shadow-sm dark:border-border">
                                                    <div className="flex items-center gap-2 rounded-md bg-muted/30 px-2 py-1">
                                                        <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary" />
                                                        <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary/70 [animation-delay:150ms]" />
                                                        <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary/50 [animation-delay:300ms]" />
                                                    </div>
                                                    
                                                    {/* Seta do balão */}
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
                                <div className="shrink-0 border-t border-border/60 bg-muted/20 p-3 sm:p-4 lg:p-5">
                                    <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-lg border border-border/70 bg-card p-1.5 shadow-sm dark:border-border">
                                        <Input
                                            className="h-11 min-w-0 flex-1 border-0 bg-transparent px-3 text-sm font-normal leading-normal text-foreground shadow-none placeholder:text-muted-foreground focus-visible:ring-0"
                                            placeholder={selectedAgent ? t('input.placeholderWithAgent', { agentName: selectedAgent.name }) : t('input.placeholderNoAgent')}
                                            value={inputValue}
                                            onChange={(e) => setInputValue(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                            disabled={!selectedAgent}
                                        />
                                        <Button
                                            onClick={() => handleSendMessage()}
                                            disabled={!selectedAgent || !inputValue.trim()}
                                            className="flex h-10 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-semibold shadow-none disabled:cursor-not-allowed"
                                        >
                                            <Send className="h-5 w-5" strokeWidth={2.4} />
                                            <span>{t('button.send')}</span>
                                        </Button>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* MENSAGEM PARA FLOWS - APENAS EXECUTAR */}
                        {selectedFlow && (
                            <div className="shrink-0 border-t border-border/60 bg-muted/20 p-3 sm:p-4 lg:p-5">
                                <div className="mx-auto max-w-3xl space-y-3">
                                    <div className={cn(softPanelClass, "px-4 py-3")}>
                                        <div className="flex items-start gap-3">
                                            <GitBranch className="mt-0.5 h-5 w-5 text-primary" strokeWidth={2.5} />
                                            <div>
                                                <p className="text-sm font-semibold text-foreground">
                                                    Configure e execute o fluxo de teste
                                                </p>
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    {flowTestChannel === 'whatsapp'
                                                        ? 'Para testar o primeiro contato via template, basta escolher o destino e executar o fluxo.'
                                                        : 'Escolha o canal e escreva a mensagem de entrada do fluxo.'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className={cn("grid gap-3 p-3 md:grid-cols-[220px,1fr]", softPanelClass)}>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Canal do teste</Label>
                                            <div className="grid grid-cols-2 gap-2">
                                                <Button
                                                    type="button"
                                                    variant={flowTestChannel === 'webchat' ? "default" : "outline"}
                                                    onClick={() => setFlowTestChannel('webchat')}
                                                    className="rounded-lg shadow-none"
                                                >
                                                    Webchat
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant={flowTestChannel === 'whatsapp' ? "default" : "outline"}
                                                    onClick={() => {
                                                        setFlowTestChannel('whatsapp')
                                                        setInputValue('')
                                                    }}
                                                    className="rounded-lg shadow-none"
                                                >
                                                    WhatsApp
                                                </Button>
                                            </div>
                                        </div>
                                        {flowTestChannel === 'whatsapp' && (
                                            <div className="space-y-2">
                                                <Label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Número de destino</Label>
                                                <Input
                                                    value={flowTestPhone}
                                                    onChange={(e) => setFlowTestPhone(e.target.value)}
                                                    placeholder="Ex.: 5511999999999"
                                                    className="rounded-lg"
                                                />
                                                <p className="text-xs text-muted-foreground">
                                                    Integração atual: {currentWhatsAppIntegration?.phone_number || 'não encontrada'}.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                    {flowTestChannel === 'whatsapp' ? (
                                        <div className={cn("p-4 md:p-5", softPanelClass)}>
                                            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                                <div className="space-y-1">
                                                    <p className="text-sm font-semibold text-foreground">
                                                        Disparo inicial por template
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        O teste via WhatsApp pode enviar a primeira mensagem direto para o número informado, desde que o template configurado não exija mídia ou variáveis extras.
                                                    </p>
                                                </div>
                                                <Button
                                                    onClick={handleExecuteFlow}
                                                    disabled={isExecutingFlow || !flowTestPhone.replace(/\D/g, '')}
                                                    className="h-11 shrink-0 rounded-lg px-5 text-sm font-semibold shadow-none"
                                                >
                                                    {isExecutingFlow ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                                                    <span>Executar fluxo</span>
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className={cn("flex flex-col gap-3 p-2.5 sm:flex-row sm:items-end", softPanelClass)}>
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
                                                className="min-h-[90px] flex-1 resize-none border-0 bg-transparent px-4 py-3 text-base text-foreground shadow-none focus-visible:ring-0"
                                            />
                                            <Button
                                                onClick={handleExecuteFlow}
                                                disabled={isExecutingFlow || !inputValue.trim()}
                                                className="h-11 shrink-0 rounded-lg px-5 text-sm font-semibold shadow-none"
                                            >
                                                {isExecutingFlow ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                                                <span>Executar fluxo</span>
                                            </Button>
                                        </div>
                                    )}
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
