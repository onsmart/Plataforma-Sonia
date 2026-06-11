import { useEffect, useState, useRef, useCallback } from "react"
import { useTheme } from "next-themes"
import { useTranslation } from "react-i18next"
import {
    MessageSquare,
    User,
    Bot,
    Wrench,
    AlertCircle,
    CheckCircle2,
    RefreshCw,
    Zap,
    Image as ImageIcon,
    Bell,
    Search,
    Trash2
} from "lucide-react"
import { Input } from "../components/ui/input"
import { Button } from "../components/ui/button"
import { Badge } from "../components/ui/badge"
import { ScrollArea } from "../components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"
import { toast } from "sonner"
import { supabase } from "../utils/supabase/client"
import { useAuth } from "../contexts/AuthContext"
import { DecisionApprovalCard } from "../components/inbox/DecisionApprovalCard"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs"
import { cn } from "../components/ui/utils"
import {
    WhatsAppService,
    type StuckWhatsAppConversation,
    type WhatsAppConversationMessage,
    type WhatsAppConversationSummary,
} from "../services/api"

type UnassignedConversation = StuckWhatsAppConversation

interface Agent {
    id: string
    nome: string
}

export function Inbox() {
    const { user } = useAuth()
    const { t } = useTranslation('inbox')
    const { resolvedTheme, theme } = useTheme()
    /**
     * Alinhado à AppSidebar: em tema claro usamos cores explícitas (branco/slate),
     * porque bg-card/bg-muted seguem --card do html — se houver dessincronia com .dark,
     * o miolo do inbox ficava escuro com shell/header claros.
     */
    const inboxLight =
        theme === 'light' ||
        resolvedTheme === 'light' ||
        (theme === 'system' && resolvedTheme !== 'dark')
    const [unassignedConversations, setUnassignedConversations] = useState<UnassignedConversation[]>([])
    const [agents, setAgents] = useState<Agent[]>([])
    const [selectedConversation, setSelectedConversation] = useState<UnassignedConversation | null>(null)
    const [selectedAgentId, setSelectedAgentId] = useState<string>("")
    const [isLoading, setIsLoading] = useState(false)
    const [isAssigning, setIsAssigning] = useState(false)
    const [pendingDecisions, setPendingDecisions] = useState<any[]>([])
    const [isLoadingDecisions, setIsLoadingDecisions] = useState(false)
    const [whatsappConversations, setWhatsappConversations] = useState<WhatsAppConversationSummary[]>([])
    const [selectedWhatsappConversation, setSelectedWhatsappConversation] = useState<WhatsAppConversationSummary | null>(null)
    const [whatsappMessages, setWhatsappMessages] = useState<WhatsAppConversationMessage[]>([])
    const [isLoadingWhatsApp, setIsLoadingWhatsApp] = useState(false)
    const [isLoadingWhatsappMessages, setIsLoadingWhatsappMessages] = useState(false)
    const [isDeletingWhatsappHistory, setIsDeletingWhatsappHistory] = useState(false)
    const [isDeletingUnassignedHistory, setIsDeletingUnassignedHistory] = useState(false)
    const [currentWhatsappNumber, setCurrentWhatsappNumber] = useState<string | null>(null)
    const [lastMessageCount, setLastMessageCount] = useState(0)
    const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default')
    const [isPageVisible, setIsPageVisible] = useState(!document.hidden)

    // Estado para controlar qual aba está ativa (permite controle externo via URL)
    const [activeTab, setActiveTab] = useState<string>("unassigned")

    /** Evita closure obsoleta no polling/realtime ao resolver a conversa selecionada */
    const selectedWaContactIdRef = useRef<string | null>(null)
    const realtimeConnectedRef = useRef(false)
    selectedWaContactIdRef.current = selectedWhatsappConversation?.whatsapp_contact_id ?? null

    const loadWhatsappMessages = useCallback(async (contactId: string, silent = false) => {
        if (!contactId) return
        try {
            if (!silent) setIsLoadingWhatsappMessages(true)
            const messages = await WhatsAppService.getCurrentConversationMessages(contactId, 100)
            setWhatsappMessages(messages)
        } catch (error) {
            console.error("[Inbox] Erro ao carregar histórico da conversa:", error)
            setWhatsappMessages([])
        } finally {
            if (!silent) setIsLoadingWhatsappMessages(false)
        }
    }, [])

    /**
     * showSidebarLoading: true = primeira carga / botão atualizar (spinner na lista).
     * false = polling/realtime (só atualiza dados; histórico em modo silencioso).
     */
    const loadWhatsAppConversations = useCallback(
        async (showSidebarLoading: boolean): Promise<string | null> => {
            try {
                if (showSidebarLoading) setIsLoadingWhatsApp(true)
                const result = await WhatsAppService.listCurrentConversations()
                const conversations = result.conversations || []

                setWhatsappConversations(conversations)
                setCurrentWhatsappNumber(result.integration?.phone_number || null)

                const preferredId = selectedWaContactIdRef.current
                const preferredConversation = preferredId
                    ? conversations.find((c) => c.whatsapp_contact_id === preferredId) ?? null
                    : null
                const resolved = preferredConversation || conversations[0] || null

                setSelectedWhatsappConversation(resolved)
                if (!resolved) setWhatsappMessages([])

                if (resolved?.whatsapp_contact_id && !showSidebarLoading) {
                    await loadWhatsappMessages(resolved.whatsapp_contact_id, true)
                }

                return resolved?.whatsapp_contact_id ?? null
            } catch (error) {
                console.error("[Inbox] Erro ao carregar conversas do WhatsApp:", error)
                setWhatsappConversations([])
                setSelectedWhatsappConversation(null)
                setWhatsappMessages([])
                return null
            } finally {
                if (showSidebarLoading) setIsLoadingWhatsApp(false)
            }
        },
        [loadWhatsappMessages]
    )

    const loadUnassignedConversations = useCallback(async () => {
        if (!user?.email) return

        try {
            setIsLoading(true)
            const conversations = await WhatsAppService.listStuckConversations()
            setUnassignedConversations(conversations)
        } catch (error: any) {
            console.error("[Inbox] Erro:", error)
            toast.error(t('errors.loading'))
        } finally {
            setIsLoading(false)
        }
    }, [user?.email, t])

    // Verificar se há parâmetro de URL para definir a aba inicial
    useEffect(() => {
        // Lê query string do hash (ex: #inbox?tab=decisions)
        const hash = window.location.hash.replace('#', '')
        const hashParts = hash.split('?')
        if (hashParts.length > 1) {
            const urlParams = new URLSearchParams(hashParts[1])
            const tab = urlParams.get('tab')
            if (tab === 'decisions' || tab === 'whatsapp') {
                setActiveTab(tab)
            }
        }

        // Também verifica query string tradicional (fallback)
        const urlParams = new URLSearchParams(window.location.search)
        const tab = urlParams.get('tab')
        if (tab === 'decisions' || tab === 'whatsapp') {
            setActiveTab(tab)
        }
    }, [])

    // Solicitar permissão de notificações
    useEffect(() => {
        if ('Notification' in window) {
            setNotificationPermission(Notification.permission)
            if (Notification.permission === 'default') {
                // Não solicita automaticamente, apenas quando o usuário clicar no botão
            }
        }
    }, [])

    // Verificar visibilidade da página
    useEffect(() => {
        const handleVisibilityChange = () => {
            setIsPageVisible(!document.hidden)
        }
        
        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
    }, [])

    // Carregar conversas não atribuídas e agentes (quando o usuário estiver disponível)
    useEffect(() => {
        if (!user?.email && !user?.id) return
        loadUnassignedConversations()
        loadAgents()
        loadPendingDecisions()
        void loadWhatsAppConversations(true)
    }, [user?.email, user?.id, loadUnassignedConversations, loadWhatsAppConversations])

    // Escutar mudanças em tempo real via Supabase Realtime + Polling (sem spinner a cada tick)
    useEffect(() => {
        if (!user?.email) return

        let debounceTimer: ReturnType<typeof setTimeout> | null = null
        const scheduleRealtimeRefresh = () => {
            if (debounceTimer) clearTimeout(debounceTimer)
            debounceTimer = setTimeout(() => {
                loadUnassignedConversations()
                void loadWhatsAppConversations(false)
            }, 600)
        }

        const channel = supabase
            .channel('inbox-messages')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'tb_whatsapp_messages',
                    filter: 'agent_id=is.null'
                },
                () => {
                    scheduleRealtimeRefresh()
                }
            )
            .subscribe((status) => {
                realtimeConnectedRef.current = status === 'SUBSCRIBED'
            })

        // Polling só quando Realtime não está conectado (fallback)
        const pollingInterval = setInterval(() => {
            if (!realtimeConnectedRef.current) {
                loadUnassignedConversations()
                void loadWhatsAppConversations(false)
            }
        }, 30_000)

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer)
            supabase.removeChannel(channel)
            clearInterval(pollingInterval)
        }
    }, [user?.email, loadUnassignedConversations, loadWhatsAppConversations])

    // Detectar novas mensagens e mostrar notificações
    useEffect(() => {
        const currentCount = unassignedConversations.length
        
        // Se há novas mensagens
        if (currentCount > lastMessageCount) {
            const newMessagesCount = currentCount - lastMessageCount
            
            // Sempre mostrar toast (notificação principal)
            toast.info(
                newMessagesCount === 1 
                    ? 'Nova mensagem no Inbox!'
                    : `${newMessagesCount} novas mensagens no Inbox!`,
                {
                    action: {
                        label: 'Ver',
                        onClick: () => {
                            // Navegar para o inbox se não estiver lá
                            if (window.location.hash !== '#inbox') {
                                window.location.hash = '#inbox'
                            }
                        }
                    },
                    duration: 5000
                }
            )

            // Fallback: Notificação do navegador apenas se a página estiver em background
            // e o usuário tiver dado permissão
            if (!isPageVisible && notificationPermission === 'granted') {
                try {
                    new Notification('Nova mensagem no Inbox', {
                        body: newMessagesCount === 1 
                            ? 'Você tem 1 nova mensagem não atribuída'
                            : `Você tem ${newMessagesCount} novas mensagens não atribuídas`,
                        icon: '/favicon.ico',
                        badge: '/favicon.ico',
                        tag: 'inbox-notification',
                        requireInteraction: false,
                        silent: false
                    })
                } catch (error) {
                    console.error('[Inbox] Erro ao criar notificação do navegador:', error)
                }
            }
        }

        // Atualizar contador
        setLastMessageCount(currentCount)
    }, [unassignedConversations.length, lastMessageCount, notificationPermission, isPageVisible])

    useEffect(() => {
        const id = selectedWhatsappConversation?.whatsapp_contact_id
        if (id) {
            void loadWhatsappMessages(id, false)
        } else {
            setWhatsappMessages([])
        }
    }, [selectedWhatsappConversation?.whatsapp_contact_id, loadWhatsappMessages])

    useEffect(() => {
        if (activeTab !== 'whatsapp') return

        const refreshInterval = setInterval(() => {
            const id = selectedWaContactIdRef.current
            if (id) void loadWhatsappMessages(id, true)
        }, 5000)

        return () => clearInterval(refreshInterval)
    }, [activeTab, loadWhatsappMessages])

    const loadAgents = async () => {
        if (!user?.email) return

        try {
            const { data, error } = await supabase.rpc('sp_list_agents_by_email', {
                p_email: user.email
            })

            if (error) {
                console.error("[Inbox] Erro ao buscar agentes:", error)
                return
            }

            if (data) {
                const agentsList = Array.isArray(data) ? data : [data]
                setAgents(agentsList.map((agent: any) => ({
                    id: String(agent.id),
                    nome: agent.nome || 'Sem nome'
                })))
            }
        } catch (error: any) {
            console.error("[Inbox] Erro ao buscar agentes:", error)
        }
    }

    const handleAssignAgent = async () => {
        if (!selectedConversation || !selectedAgentId) {
            toast.error(t('errors.selectAgent'))
            return
        }

        setIsAssigning(true)
        try {
            // ✅ USAR API DO BACKEND ao invés de Supabase direto (protege com requireAdmin)
            const { BASE_URL, getAuthHeaders } = await import('../services/api')
            
            const response = await fetch(`${BASE_URL}/agents/assign`, {
                method: 'PUT',
                headers: await getAuthHeaders(),
                body: JSON.stringify({
                    message_id: selectedConversation.message_id,
                    agent_id: selectedAgentId,
                    email: user?.email
                })
            })

            if (!response.ok) {
                const error = await response.json()
                console.error("[Inbox] Erro ao atribuir agente:", error)
                toast.error(error.error || t('errors.assignAgent'), {
                    description: error.details || error.reason,
                    duration: 5000,
                })
                return
            }

            toast.success(t('success.agentAssigned'))

            // Remover da lista de não atribuídas
            setUnassignedConversations(prev =>
                prev.filter(conv => conv.message_id !== selectedConversation.message_id)
            )

            // Limpar seleção
            setSelectedConversation(null)
            setSelectedAgentId("")

            // Recarregar lista
            loadUnassignedConversations()
        } catch (error: any) {
            console.error("[Inbox] Erro:", error)
            toast.error(t('errors.assignAgent'))
        } finally {
            setIsAssigning(false)
        }
    }

    const loadPendingDecisions = async () => {
        // ✅ Buscar companies_id para filtrar por empresa (multi-tenant)
        if (!user?.email) {
            console.warn("[Inbox] Email do usuário não disponível")
            return
        }

        let userId: string | undefined
        let companiesId: string | undefined

        // 1. Buscar user_id da tabela tb_users usando email
        const { data: userData, error: userError } = await supabase
            .from('tb_users')
            .select('id')
            .eq('email', user.email)
            .maybeSingle()

        if (userError) {
            console.error("[Inbox] Erro ao buscar user_id da tb_users:", userError)
            return
        }

        if (!userData?.id) {
            console.warn("[Inbox] Usuário não encontrado na tb_users para email:", user.email)
            return
        }

        userId = userData.id

        // 2. Buscar companies_id a partir do user_id
        const { data: companyUserData, error: companyUserError } = await supabase
            .from('tb_company_users')
            .select('companies_id')
            .eq('user_id', userId)
            .maybeSingle()

        if (companyUserError) {
            console.error("[Inbox] Erro ao buscar companies_id:", companyUserError)
            return
        }

        if (!companyUserData?.companies_id) {
            console.warn("[Inbox] Nenhuma empresa encontrada para user_id:", userId)
            // Se não tiver empresa, não retorna decisões (multi-tenant)
            setPendingDecisions([])
            return
        }

        companiesId = companyUserData.companies_id
        console.log("[Inbox] user_id e companies_id encontrados:", { userId, companiesId })

        try {
            setIsLoadingDecisions(true)

            console.log("[Inbox] Buscando decisões pendentes:")
            console.log("  - Email:", user.email)
            console.log("  - userId:", userId)
            console.log("  - companies_id:", companiesId)

            const { data, error } = await supabase
                .from('tb_agent_decisions')
                .select('*')
                .eq('companies_id', companiesId) // ✅ Filtrar por companies_id
                .eq('status', 'pending_approval')
                .order('created_at', { ascending: false })

            console.log("[Inbox] Resultado da query:", {
                userIdUsado: userId,
                data: data,
                error: error,
                count: data?.length || 0,
                primeiraDecisao: data?.[0] ? {
                    id: data[0].id,
                    user_id: data[0].user_id,
                    status: data[0].status,
                    original_message: data[0].original_message?.substring(0, 50)
                } : null
            })

            if (error) {
                console.error("[Inbox] Erro ao carregar decisões pendentes:", error)
                // Se a tabela não existir, apenas loga e não quebra a UI
                if (error.code === '42P01' || error.message?.includes('does not exist')) {
                    console.warn("[Inbox] Tabela tb_agent_decisions não existe ainda. Criando...")
                    setPendingDecisions([])
                    return
                }
                toast.error(t('errors.loadingDecisions'))
                return
            }

            console.log("[Inbox] Decisões encontradas:", data?.length || 0)
            setPendingDecisions(data || [])
        } catch (error: any) {
            console.error("[Inbox] Erro ao carregar decisões:", error)
            // Não quebra a UI se houver erro
            setPendingDecisions([])
        } finally {
            setIsLoadingDecisions(false)
        }
    }

    const deleteConversationHistory = async (
        integrationId: string,
        contactId: string,
        successMessage: string
    ) => {
        const result = await WhatsAppService.deleteConversationHistory(integrationId, contactId)

        if (!result.success) {
            throw new Error(result.error || 'Não foi possível apagar o histórico da conversa.')
        }

        setSelectedConversation((prev) =>
            prev?.whatsapp_contact_id === contactId ? null : prev
        )
        setSelectedAgentId((prev) =>
            selectedConversation?.whatsapp_contact_id === contactId ? "" : prev
        )

        if (selectedWaContactIdRef.current === contactId) {
            setWhatsappMessages([])
        }

        await Promise.all([
            loadUnassignedConversations(),
            loadPendingDecisions(),
            loadWhatsAppConversations(true)
        ])

        toast.success(successMessage)
    }

    const handleDeleteSelectedWhatsappHistory = async () => {
        if (!selectedWhatsappConversation) return

        const confirmed = window.confirm(
            'Deseja apagar todo o histórico desta conversa no WhatsApp? Essa ação remove as mensagens salvas e as aprovações vinculadas a este contato.'
        )

        if (!confirmed) return

        setIsDeletingWhatsappHistory(true)
        try {
            const currentIntegration = await WhatsAppService.getCurrentIntegration()
            if (!currentIntegration?.id) {
                throw new Error('Integração atual do WhatsApp não encontrada.')
            }

            await deleteConversationHistory(
                currentIntegration.id,
                selectedWhatsappConversation.whatsapp_contact_id,
                'Histórico da conversa apagado com sucesso.'
            )
        } catch (error: any) {
            toast.error(error?.message || 'Não foi possível apagar o histórico do WhatsApp.')
        } finally {
            setIsDeletingWhatsappHistory(false)
        }
    }

    const handleDeleteSelectedUnassignedHistory = async () => {
        if (!selectedConversation?.integrations_id || !selectedConversation?.whatsapp_contact_id) return

        const confirmed = window.confirm(
            'Deseja apagar todo o histórico desta conversa travada? Essa ação remove as mensagens salvas e aprovações vinculadas a este contato.'
        )

        if (!confirmed) return

        setIsDeletingUnassignedHistory(true)
        try {
            await deleteConversationHistory(
                selectedConversation.integrations_id,
                selectedConversation.whatsapp_contact_id,
                'Histórico da conversa travada apagado com sucesso.'
            )
        } catch (error: any) {
            toast.error(error?.message || 'Não foi possível apagar o histórico desta conversa.')
        } finally {
            setIsDeletingUnassignedHistory(false)
        }
    }

    const handleDeleteDecisionHistory = async (decision: { integrations_id?: string; contact_id?: string | null }) => {
        if (!decision.integrations_id || !decision.contact_id) {
            throw new Error('Esta aprovação não possui uma conversa do WhatsApp vinculada.')
        }

        await deleteConversationHistory(
            decision.integrations_id,
            decision.contact_id,
            'Histórico da aprovação apagado com sucesso.'
        )
    }

    const formatPhoneNumber = (contactId: string) => {
        // Remove @lid or @s.whatsapp.net se existir
        const cleaned = contactId.replace(/@(lid|s\.whatsapp\.net)$/, '')

        // Se for um UUID (formato: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx), mostra texto amigável
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (uuidRegex.test(cleaned)) {
            return t('contact.noAgent')
        }

        // Se parecer com número de telefone, retorna formatado
        if (/^\d+$/.test(cleaned) && cleaned.length >= 10) {
            return cleaned
        }

        // Caso contrário, retorna o texto limpo
        return cleaned || t('contact.unknown')
    }

    const formatContactLabel = (conv: Pick<UnassignedConversation, 'whatsapp_contact_id' | 'phone_number'>) => {
        const phone = String(conv.phone_number || '').trim()
        if (phone) return formatPhoneNumber(phone)
        return formatPhoneNumber(conv.whatsapp_contact_id)
    }

    const getWhatsappConversationLabel = (conversation: WhatsAppConversationSummary) => {
        const reference =
            conversation.phone_number ||
            conversation.contact_label ||
            conversation.lid ||
            conversation.whatsapp_contact_id

        return formatPhoneNumber(reference)
    }

    const extractVisibleMessageText = (value: string | null | undefined) => {
        const normalizedValue = String(value || '').trim()
        if (!normalizedValue) return ''

        const extractFromObject = (payload: any): string => {
            if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
                return ''
            }

            const candidateFields = ['response', 'message', 'reply', 'answer', 'content', 'text', 'output']

            for (const field of candidateFields) {
                const candidateValue = payload[field]

                if (typeof candidateValue === 'string' && candidateValue.trim()) {
                    return candidateValue.trim()
                }

                if (candidateValue && typeof candidateValue === 'object') {
                    const nested = extractFromObject(candidateValue)
                    if (nested) return nested
                }
            }

            return ''
        }

        try {
            const parsed = JSON.parse(normalizedValue)
            const extracted = extractFromObject(parsed)
            return extracted || normalizedValue
        } catch {
            return normalizedValue
        }
    }

    const getWhatsappSenderLabel = (message: WhatsAppConversationMessage) => {
        if (message.direction === 'inbound') {
            return 'Contato'
        }

        if (message.metadata?.automation_source === 'flow') {
            return 'Flow'
        }

        return selectedWhatsappConversation?.agent_name || 'Agente'
    }

    // Função para formatar tempo relativo mais amigável
    const formatRelativeTime = (iso: string) => {
        if (!iso) return ""
        const date = new Date(iso)
        const now = new Date()
        const diff = Math.floor((now.getTime() - date.getTime()) / 1000)

        if (diff < 60) return t('time.ago', { value: `${diff}s` })
        if (diff < 3600) return t('time.ago', { value: `${Math.floor(diff / 60)}min` })
        if (diff < 86400) return t('time.ago', { value: `${Math.floor(diff / 3600)}h` })
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    }

    const formatMessageTime = (iso?: string) => {
        if (!iso) return ""
        return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }

    const getWhatsAppStatusBadge = (
        status: string | null | undefined,
        direction: 'inbound' | 'outbound',
        isRead?: boolean
    ) => {
        const normalizedStatus = String(status || '').trim().toLowerCase()

        if (direction === 'inbound') {
            if (normalizedStatus === 'received_unread' || isRead === false) {
                return {
                    label: 'Recebida (nova)',
                    className: 'bg-sky-100 text-sky-700 dark:bg-sky-500/12 dark:text-sky-300'
                }
            }

            return {
                label: 'Recebida',
                className: 'bg-sky-100 text-sky-700 dark:bg-sky-500/12 dark:text-sky-300'
            }
        }

        switch (normalizedStatus) {
            case 'accepted':
                return {
                    label: 'Aceita',
                    className: 'bg-slate-100 text-slate-700 dark:bg-slate-500/12 dark:text-slate-300'
                }
            case 'sent':
                return {
                    label: 'Enviada',
                    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/12 dark:text-emerald-300'
                }
            case 'delivered':
                return {
                    label: 'Entregue',
                    className: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/12 dark:text-cyan-300'
                }
            case 'read':
                return {
                    label: 'Lida',
                    className: 'bg-blue-100 text-blue-700 dark:bg-blue-500/12 dark:text-blue-300'
                }
            case 'failed':
                return {
                    label: 'Falhou',
                    className: 'bg-rose-100 text-rose-700 dark:bg-rose-500/12 dark:text-rose-300'
                }
            default:
                return {
                    label: 'Enviada',
                    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/12 dark:text-emerald-300'
                }
        }
    }

    const getConversationStatusBadge = (conversation: WhatsAppConversationSummary) =>
        getWhatsAppStatusBadge(conversation.last_message_status, conversation.last_message_direction)

    const getMessageStatusBadge = (message: WhatsAppConversationMessage) =>
        getWhatsAppStatusBadge(
            String(message.metadata?.whatsapp_status || ''),
            message.direction,
            message.is_read
        )

    // Verificar se há leads aguardando para mostrar vignette
    const hasPendingLeads = unassignedConversations.length > 0

    const metricIconWell = inboxLight
        ? "flex shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-slate-100 text-slate-700 shadow-sm"
        : "flex shrink-0 items-center justify-center rounded-xl border border-border bg-muted/50 shadow-sm"

    const inboxShellClass = inboxLight
        ? "overflow-hidden rounded-[1.7rem] border border-border/60 bg-white/85 text-slate-950 shadow-[0_24px_64px_-40px_rgba(15,23,42,0.18)] backdrop-blur-sm"
        : "overflow-hidden rounded-[1.7rem] border border-white/[0.07] bg-card/60 text-card-foreground shadow-[0_30px_80px_-38px_rgba(0,0,0,0.78)] backdrop-blur-sm"

    const inboxPanelClass = inboxLight
        ? "rounded-[1.35rem] border border-border/50 bg-white/70 backdrop-blur-sm text-slate-950 shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
        : "rounded-[1.35rem] border border-white/[0.05] bg-white/[0.03] text-card-foreground shadow-sm dark:shadow-[0_18px_40px_-30px_rgba(0,0,0,0.55)]"

    const inboxRowClass = inboxLight
        ? "rounded-[1.15rem] border border-border/50 bg-white/70 backdrop-blur-sm text-slate-950 shadow-sm transition-all hover:border-border hover:bg-white/90"
        : "rounded-[1.15rem] border border-white/[0.05] bg-white/[0.03] text-card-foreground shadow-sm transition-all hover:border-white/[0.08] hover:bg-white/[0.06] dark:shadow-none"

    const inboxSidebarClass = inboxLight
        ? "flex min-h-0 flex-col border-r border-border/40 bg-white/50 backdrop-blur-sm"
        : "flex min-h-0 flex-col border-r border-white/[0.05] bg-white/[0.03]"

    const inboxSidebarCardClass = inboxLight
        ? "rounded-[1.35rem] border border-border/50 bg-white/80 backdrop-blur-sm p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        : "rounded-[1.35rem] border border-white/[0.07] bg-card/60 backdrop-blur-sm p-3 shadow-none"

    const inboxCanvasClass = inboxLight
        ? "flex min-h-0 min-w-0 flex-1 flex-col bg-white/40 backdrop-blur-sm"
        : "flex min-h-0 min-w-0 flex-1 flex-col bg-white/[0.02]"

    /** Tema claro força aba ativa branca (evita bg-card escuro se variáveis CSS estiverem erradas) */
    const tabsTriggerClass = cn(
        "appearance-none gap-2 rounded-lg border-0 px-3 py-2.5 text-xs font-semibold shadow-none outline-none ring-0 focus-visible:!border-transparent focus-visible:!ring-0 focus-visible:!outline-none data-[state=active]:!border-transparent data-[state=active]:!ring-0 data-[state=active]:!shadow-none dark:!text-slate-300 dark:data-[state=inactive]:hover:!bg-white/5 dark:data-[state=active]:!bg-white/6 dark:data-[state=active]:!text-slate-50",
        inboxLight &&
            "!text-slate-700 data-[state=inactive]:hover:!bg-white/65 data-[state=inactive]:hover:!text-slate-800 data-[state=active]:!bg-white data-[state=active]:!text-slate-950 data-[state=active]:!shadow-[0_1px_2px_rgba(15,23,42,0.08),0_10px_20px_-14px_rgba(37,99,235,0.45)] data-[state=active]:!ring-0"
    )
    const tabsIconClass = inboxLight
        ? "h-4 w-4 shrink-0 text-slate-900 opacity-80"
        : "h-4 w-4 shrink-0 text-slate-100 opacity-80"

    const tabsBarClass = inboxLight
        ? "border-b border-border/40 bg-white/60 backdrop-blur-sm px-4 py-4 sm:px-6"
        : "border-b border-white/[0.05] bg-white/[0.04] px-4 py-4 backdrop-blur-sm sm:px-6"

    const tabsListClass = inboxLight
        ? "grid h-11 w-full max-w-xl grid-cols-3 gap-0.5 rounded-xl border border-border/50 bg-white/70 backdrop-blur-sm p-1 sm:inline-flex sm:w-auto sm:grid-cols-none"
        : "grid h-11 w-full max-w-xl grid-cols-3 gap-0.5 rounded-xl border border-white/[0.07] bg-white/[0.06] p-1 sm:inline-flex sm:w-auto sm:grid-cols-none"

    /** Fundo transparente: herda o `bg-card` do painel e evita “segundo degradê” (inset) sobreposto ao card. */
    const searchShellClass = inboxLight
        ? "relative flex min-w-0 flex-1 items-center rounded-xl border border-slate-300 bg-transparent shadow-none"
        : "relative flex min-w-0 flex-1 items-center rounded-xl border border-border bg-transparent shadow-none"

    /** Input base usa `bg-input-background` / `dark:bg-input/30` — precisa neutralizar para uma única cor com o shell. */
    const inboxSearchInputClass =
        "h-11 min-w-0 flex-1 appearance-none rounded-none border-0 !bg-transparent pl-2 pr-3 text-sm shadow-none outline-none ring-0 focus-visible:border-0 focus-visible:shadow-none focus-visible:ring-0"

    const inboxScrollH = "min-h-[min(720px,82svh)] lg:min-h-[min(820px,85svh)]"
    const selectedConversationIsFile =
        !!selectedConversation?.last_message &&
        (
            selectedConversation.last_message.toLowerCase().includes('imagem sem legenda') ||
            selectedConversation.last_message.toLowerCase().includes('arquivo')
        )
    const selectedConversationIsPlanLimit =
        selectedConversation?.stuck_reason === 'plan_limit_atendimentos'

    const selectedConversationName = selectedConversation
        ? formatContactLabel(selectedConversation)
        : null
    const selectedWhatsappConversationName = selectedWhatsappConversation
        ? getWhatsappConversationLabel(selectedWhatsappConversation)
        : null
    const selectedHeaderLabel = activeTab === 'whatsapp'
        ? selectedWhatsappConversationName
        : selectedConversationName
    const quickStats = [
        {
            icon: AlertCircle,
            label: t('tabs.stuckMessages'),
            value: unassignedConversations.length,
            tone: 'text-amber-600 dark:text-amber-300',
            surface: 'bg-amber-500/[0.10] dark:bg-amber-400/15'
        },
        {
            icon: CheckCircle2,
            label: t('tabs.approvals'),
            value: pendingDecisions.length,
            tone: 'text-blue-700 dark:text-blue-300',
            surface: 'bg-blue-500/[0.10] dark:bg-blue-400/15'
        },
        {
            icon: Bell,
            label: 'Notificações',
            value: notificationPermission === 'granted' ? 'ON' : 'OFF',
            tone: notificationPermission === 'granted' ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-300',
            surface: notificationPermission === 'granted' ? 'bg-emerald-500/[0.10] dark:bg-emerald-400/15' : 'bg-muted dark:bg-white/[0.08]'
        }
    ]

    return (
        <div className="relative min-h-full w-full min-w-0 overflow-hidden animate-in fade-in duration-500 text-foreground px-3 pb-4 pt-6 font-sans sm:px-4 sm:pb-6 sm:pt-8 md:px-6 md:pb-8 md:pt-10">
            <div
                className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] opacity-100 dark:opacity-90"
                aria-hidden
                style={{
                    background:
                        "radial-gradient(circle at top left, hsl(var(--primary) / 0.08), transparent 40%), radial-gradient(circle at top right, hsl(var(--ring) / 0.06), transparent 34%), linear-gradient(180deg, hsl(var(--muted) / 0.45), transparent 72%)",
                }}
            />
            {hasPendingLeads && (
                <div
                    className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-500"
                    aria-hidden
                    style={{
                        background:
                            "radial-gradient(circle at 50% 12%, transparent 0%, hsl(var(--destructive) / 0.04) 42%, hsl(var(--destructive) / 0.08) 100%)",
                    }}
                />
            )}

            <div className="relative z-10 mx-auto w-full max-w-[1600px] space-y-5 sm:space-y-6">
                <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
                    <div
                        className={cn(
                            "relative overflow-hidden rounded-[1.75rem] p-5 pt-6 backdrop-blur-sm sm:p-6 sm:pt-7 md:p-7 md:pt-8",
                            inboxLight
                                ? "border border-border/60 bg-white/85 text-slate-950 shadow-[0_18px_48px_-32px_rgba(15,23,42,0.12)]"
                                : "border border-white/[0.07] bg-card/60 text-card-foreground dark:shadow-[0_24px_70px_-34px_rgba(0,0,0,0.72)]"
                        )}
                    >
                        <div
                            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.06] via-transparent to-transparent dark:hidden"
                            aria-hidden
                        />
                        <div
                            className="pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-60 dark:hidden"
                            aria-hidden
                            style={{
                                background:
                                    "radial-gradient(circle at center, hsl(var(--primary) / 0.1), transparent 60%)",
                            }}
                        />
                        <div className="relative flex flex-col gap-5">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0 space-y-2">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-primary/80">
                                        {t('tabs.stuckMessages')}
                                    </p>
                                    <div className="space-y-2">
                                        <h2 className="max-w-3xl text-2xl font-semibold tracking-tight text-foreground sm:text-3xl xl:text-4xl">
                                            {t('header.title')}
                                        </h2>
                                        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
                                            Centralize triagem manual, aprove mensagens pendentes e despache conversas para o agente certo sem perder contexto.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex w-full justify-start sm:w-auto sm:justify-center lg:justify-center">
                                <Badge
                                    variant={hasPendingLeads ? 'destructive' : 'outline'}
                                    className={cn(
                                        'mt-1 w-fit shrink-0 self-start gap-2 rounded-full px-2.5 py-1 text-[9px] font-semibold tracking-[0.12em] sm:mt-2 sm:self-center sm:text-[10px]',
                                        !hasPendingLeads &&
                                            (inboxLight
                                                ? 'border-slate-300 bg-slate-200/80 text-slate-700'
                                                : 'border-border bg-muted/50 text-muted-foreground dark:border-white/[0.12] dark:bg-white/[0.06]')
                                    )}
                                >
                                    <span
                                        className={cn(
                                            'h-1.5 w-1.5 shrink-0 rounded-full',
                                            hasPendingLeads ? 'bg-destructive-foreground/90' : 'bg-emerald-500'
                                        )}
                                        aria-hidden
                                    />
                                    {hasPendingLeads ? t('status.critical') : t('empty.queue')}
                                </Badge>
                                </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-3">
                                {quickStats.map((stat) => {
                                    const Icon = stat.icon

                                    return (
                                        <div
                                            key={stat.label}
                                            className={cn(
                                                "rounded-2xl border p-4 shadow-sm",
                                                inboxLight
                                                    ? "border-slate-300 bg-slate-100 shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
                                                    : "border-border bg-muted/50 dark:border-white/5 dark:bg-black/25 dark:shadow-none"
                                            )}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className={cn(metricIconWell, stat.surface, stat.tone, 'h-11 w-11')}>
                                                    <Icon className="h-5 w-5" strokeWidth={2.2} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                                        {stat.label}
                                                    </p>
                                                    <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                                                        {stat.value}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-1">
                        <div
                            className={cn(
                                "rounded-[1.5rem] border p-4 shadow-sm",
                                inboxLight
                                    ? "border-border/60 bg-white/85 backdrop-blur-sm text-slate-950"
                                    : "border-white/[0.07] bg-card/60 backdrop-blur-sm text-card-foreground dark:shadow-none"
                            )}
                        >
                            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                Fila ativa
                            </p>
                            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                                {hasPendingLeads
                                    ? 'Existem conversas aguardando distribuição manual. Priorize as mensagens mais recentes.'
                                    : 'Nenhuma conversa travada no momento. A operação está fluindo normalmente.'}
                            </p>
                        </div>
                        <div
                            className={cn(
                                "rounded-[1.5rem] border p-4 shadow-sm",
                                inboxLight
                                    ? "border-border/60 bg-white/85 backdrop-blur-sm text-slate-950"
                                    : "border-white/[0.07] bg-card/60 backdrop-blur-sm text-card-foreground dark:shadow-none"
                            )}
                        >
                            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                Ação rápida
                            </p>
                            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                                Use a aba de aprovações para revisar decisões pendentes e mantenha o inbox limpo antes da próxima rodada.
                            </p>
                        </div>
                    </div>
                </div>

                <div className={cn(inboxShellClass, inboxScrollH, 'flex flex-col')}>
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col">
                        <div className={tabsBarClass}>
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <TabsList className={tabsListClass}>
                                <TabsTrigger
                                    value="whatsapp"
                                    className={tabsTriggerClass}
                                >
                                    <MessageSquare className={tabsIconClass} strokeWidth={2} />
                                    <span className="truncate">WhatsApp</span>
                                    {whatsappConversations.length > 0 && (
                                        <span className="rounded-md bg-emerald-500/12 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-emerald-600 dark:text-emerald-300">
                                            {whatsappConversations.length}
                                        </span>
                                    )}
                                </TabsTrigger>
                                <TabsTrigger
                                    value="unassigned"
                                    className={tabsTriggerClass}
                                >
                                    <AlertCircle className={tabsIconClass} strokeWidth={2} />
                                    <span className="truncate">{t('tabs.stuckMessages')}</span>
                                    {unassignedConversations.length > 0 && (
                                        <span className="rounded-md bg-destructive/12 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-destructive">
                                            {unassignedConversations.length}
                                        </span>
                                    )}
                                </TabsTrigger>

                                <TabsTrigger
                                    value="decisions"
                                    className={tabsTriggerClass}
                                >
                                    <CheckCircle2 className={tabsIconClass} strokeWidth={2} />
                                    <span className="truncate">{t('tabs.approvals')}</span>
                                    {pendingDecisions.length > 0 && (
                                        <span className="rounded-md bg-primary/12 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-primary">
                                            {pendingDecisions.length}
                                        </span>
                                    )}
                                </TabsTrigger>
                                </TabsList>

                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge
                                        className={
                                            inboxLight
                                                ? 'rounded-full border border-slate-400 bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-800 shadow-sm'
                                                : 'rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-slate-200 shadow-sm'
                                        }
                                    >
                                        {selectedHeaderLabel ? `Contato selecionado: ${selectedHeaderLabel}` : 'Selecione uma conversa para ver detalhes'}
                                    </Badge>
                                </div>
                            </div>
                        </div>

                    <TabsContent value="whatsapp" className="m-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
                        <div className="grid min-h-0 h-full min-w-0 w-full flex-1 grid-cols-1 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
                            <div className={inboxSidebarClass}>
                                <div className="p-4 sm:p-5">
                                    <div className={inboxSidebarCardClass}>
                                        <div className="mb-3 flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                                                    Conversas reais
                                                </p>
                                                <p className="mt-1 text-sm text-muted-foreground">
                                                    {currentWhatsappNumber
                                                        ? `Número oficial conectado: ${currentWhatsappNumber}`
                                                        : 'Conecte um número oficial na área de Integrações para acompanhar o histórico.'}
                                                </p>
                                            </div>
                                            <Badge className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-300">
                                                {whatsappConversations.length}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className={searchShellClass}>
                                                <Search className="ml-3 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                                                <Input
                                                    placeholder="Histórico das conversas do número oficial"
                                                    type="search"
                                                    className={inboxSearchInputClass}
                                                />
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={async () => {
                                                    const id = await loadWhatsAppConversations(true)
                                                    if (id) await loadWhatsappMessages(id, false)
                                                }}
                                                className="h-11 w-11 rounded-xl"
                                            >
                                                <RefreshCw size={18} className={cn(isLoadingWhatsApp && 'animate-spin')} />
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                <ScrollArea className="min-h-0 flex-1 px-3 pb-4 sm:px-4 sm:pb-6">
                                    <div className="space-y-3 pb-4 pt-3">
                                        {isLoadingWhatsApp ? (
                                            <div
                                                className={
                                                    inboxLight
                                                        ? 'rounded-2xl border border-slate-300 bg-slate-50 p-8 text-center text-slate-600 shadow-sm'
                                                        : 'rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none'
                                                }
                                            >
                                                <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin opacity-50" />
                                                <p className="text-[10px] font-semibold uppercase tracking-widest">Sincronizando WhatsApp</p>
                                            </div>
                                        ) : whatsappConversations.length === 0 ? (
                                            <div
                                                className={
                                                    inboxLight
                                                        ? 'rounded-2xl border border-slate-300 bg-slate-50 p-10 text-center text-slate-600 shadow-sm'
                                                        : 'rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none'
                                                }
                                            >
                                                <MessageSquare size={40} className="mx-auto mb-4 opacity-25" />
                                                <p className="text-[10px] font-semibold uppercase tracking-[0.2em]">Nenhuma conversa encontrada</p>
                                                <p className="mt-2 text-sm text-muted-foreground">
                                                    As mensagens do número oficial vão aparecer aqui assim que a Meta entregar os eventos.
                                                </p>
                                            </div>
                                        ) : (
                                            whatsappConversations.map((conversation) => {
                                                const isSelected = selectedWhatsappConversation?.whatsapp_contact_id === conversation.whatsapp_contact_id
                                                const visibleLastMessage = extractVisibleMessageText(conversation.last_message)
                                                const snippet = visibleLastMessage.length > 70
                                                    ? `${visibleLastMessage.substring(0, 70)}...`
                                                    : visibleLastMessage
                                                const conversationStatus = getConversationStatusBadge(conversation)

                                                return (
                                                    <button
                                                        key={conversation.last_message_id}
                                                        type="button"
                                                        onClick={() => setSelectedWhatsappConversation(conversation)}
                                                        className={cn(
                                                            'group flex w-full items-center gap-4 rounded-[1.15rem] p-4 text-left outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                                                            inboxRowClass,
                                                            isSelected
                                                                ? inboxLight
                                                                    ? 'border-emerald-500 bg-emerald-200/90 shadow-[0_14px_36px_-24px_rgba(5,150,105,0.35)] ring-1 ring-emerald-400/40'
                                                                    : 'border-transparent bg-emerald-500/[0.12]'
                                                                : 'hover:-translate-y-0.5 hover:shadow-md'
                                                        )}
                                                    >
                                                        <div
                                                            className={cn(
                                                                metricIconWell,
                                                                'h-11 w-11 shrink-0',
                                                                inboxLight
                                                                    ? 'border-emerald-400 bg-emerald-100 text-emerald-900'
                                                                    : 'bg-emerald-500/[0.10] text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300'
                                                            )}
                                                        >
                                                            <MessageSquare size={20} strokeWidth={2} className="shrink-0" />
                                                        </div>

                                                        <div className="min-w-0 flex-1">
                                                            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                                                                <p className="min-w-0 truncate text-sm font-semibold leading-tight text-foreground">
                                                                    {getWhatsappConversationLabel(conversation)}
                                                                </p>
                                                                <div className="flex items-center gap-2">
                                                                    {conversation.unread_count > 0 && (
                                                                        <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
                                                                            {conversation.unread_count} nova{conversation.unread_count > 1 ? 's' : ''}
                                                                        </span>
                                                                    )}
                                                                    <time
                                                                        className="shrink-0 whitespace-nowrap text-[10px] tabular-nums text-muted-foreground"
                                                                        dateTime={conversation.last_message_at}
                                                                    >
                                                                        {formatRelativeTime(conversation.last_message_at)}
                                                                    </time>
                                                                </div>
                                                            </div>
                                                            <p className="line-clamp-2 text-left text-xs leading-snug text-muted-foreground">
                                                                {snippet}
                                                            </p>
                                                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                                                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                                                    {conversation.agent_name ? `Agente: ${conversation.agent_name}` : 'Sem agente vinculado'}
                                                                </p>
                                                                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", conversationStatus.className)}>
                                                                    {conversationStatus.label}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </button>
                                                )
                                            })
                                        )}
                                    </div>
                                </ScrollArea>
                            </div>

                            <div className={inboxCanvasClass}>
                                {selectedWhatsappConversation ? (
                                    <ScrollArea className="min-h-0 flex-1">
                                        <div className="mx-auto max-w-5xl space-y-6 px-4 py-5 animate-in slide-in-from-bottom-4 duration-500 sm:px-6 sm:py-6 md:space-y-8 lg:px-8 lg:py-8">
                                            <div
                                                className={
                                                    inboxLight
                                                        ? "relative flex shrink-0 flex-col gap-5 overflow-hidden rounded-[2rem] border border-emerald-400 bg-emerald-100 p-5 text-slate-950 shadow-[0_1px_3px_rgba(15,23,42,0.08)] sm:flex-row sm:items-center sm:gap-6 sm:p-6 md:p-7"
                                                        : "relative flex shrink-0 flex-col gap-5 overflow-hidden rounded-[2rem] border border-emerald-500/25 bg-card p-5 text-foreground shadow-[0_20px_50px_-36px_rgba(0,0,0,0.55)] sm:flex-row sm:items-center sm:gap-6 sm:p-6 md:p-7"
                                                }
                                            >
                                                {inboxLight && (
                                                    <>
                                                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-500/[0.12] via-transparent to-transparent" aria-hidden />
                                                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/40 to-transparent opacity-90" aria-hidden />
                                                    </>
                                                )}
                                                <div
                                                    className={
                                                        inboxLight
                                                            ? "relative flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.6rem] bg-white text-emerald-700 shadow-sm ring-2 ring-emerald-300/80 sm:h-20 sm:w-20"
                                                            : "relative flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.6rem] bg-white/[0.08] text-emerald-300 shadow-sm sm:h-20 sm:w-20"
                                                    }
                                                >
                                                    <MessageSquare size={32} strokeWidth={2.25} className="sm:h-10 sm:w-10" />
                                                </div>
                                                <div className="relative min-w-0 flex-1 space-y-3 pl-0 sm:pl-2">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <Badge className="rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.12)] dark:bg-emerald-400/10 dark:text-emerald-300">
                                                            Conversa ativa
                                                        </Badge>
                                                        <span className="text-xs font-medium text-muted-foreground">
                                                            {formatRelativeTime(selectedWhatsappConversation.last_message_at)}
                                                        </span>
                                                    </div>
                                                    <h3 className="text-xl font-semibold tracking-tight sm:text-2xl">
                                                        {selectedWhatsappConversationName}
                                                    </h3>
                                                    <p className="text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
                                                        {selectedWhatsappConversation.agent_name
                                                            ? `Atendida por ${selectedWhatsappConversation.agent_name}`
                                                            : 'Sem agente vinculado automaticamente a esta conversa'}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className={cn(inboxPanelClass, 'space-y-5 p-5 sm:p-6 md:p-7')}>
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="space-y-2">
                                                        <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-muted-foreground">
                                                            Histórico da conversa
                                                        </p>
                                                        <p className="text-sm text-muted-foreground">
                                                            Todas as mensagens persistidas para este contato no número oficial da Meta.
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            variant="outline"
                                                            onClick={handleDeleteSelectedWhatsappHistory}
                                                            disabled={isDeletingWhatsappHistory}
                                                            className={cn(
                                                                "h-11 rounded-full px-4 text-[11px] font-semibold uppercase tracking-[0.12em]",
                                                                inboxLight
                                                                    ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800"
                                                                    : "border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/15 hover:text-red-200"
                                                            )}
                                                        >
                                                            {isDeletingWhatsappHistory ? (
                                                                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                            )}
                                                            Apagar histórico
                                                        </Button>
                                                        <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.12)] sm:flex dark:text-emerald-300">
                                                            <MessageSquare className="h-5 w-5" strokeWidth={2.2} />
                                                        </div>
                                                    </div>
                                                </div>

                                                {isLoadingWhatsappMessages ? (
                                                    <div
                                                        className={
                                                            inboxLight
                                                                ? 'rounded-2xl border border-slate-300 bg-slate-50 p-10 text-center text-slate-600 shadow-sm'
                                                                : 'rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-muted-foreground shadow-none'
                                                        }
                                                    >
                                                        <RefreshCw className="mx-auto mb-3 h-6 w-6 animate-spin opacity-50" />
                                                        <p className="text-[10px] font-semibold uppercase tracking-widest">Carregando histórico</p>
                                                    </div>
                                                ) : whatsappMessages.length === 0 ? (
                                                    <div
                                                        className={
                                                            inboxLight
                                                                ? 'rounded-2xl border border-slate-300 bg-slate-50 p-10 text-center text-slate-600 shadow-sm'
                                                                : 'rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-muted-foreground shadow-none'
                                                        }
                                                    >
                                                        <MessageSquare size={38} className="mx-auto mb-4 opacity-25" />
                                                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em]">Sem mensagens salvas</p>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-4">
                                                        {whatsappMessages.map((message) => {
                                                            const isOutbound = message.direction === 'outbound'
                                                            const statusBadge = getMessageStatusBadge(message)

                                                            return (
                                                                <div
                                                                    key={message.id || message.message_id || `${message.direction}-${message.created_at}`}
                                                                    className={cn("flex", isOutbound ? "justify-end" : "justify-start")}
                                                                >
                                                                    <div className={cn("max-w-[88%] sm:max-w-[75%]", isOutbound ? "items-end" : "items-start")}>
                                                                        <div
                                                                            className={cn(
                                                                                "rounded-[1.4rem] px-4 py-3 sm:px-5 sm:py-4",
                                                                                isOutbound
                                                                                    ? inboxLight
                                                                                        ? "rounded-tr-sm border border-emerald-500 bg-emerald-200 text-emerald-950 shadow-sm"
                                                                                        : "rounded-tr-sm border-transparent bg-emerald-800 text-white shadow-[0_14px_32px_-14px_rgba(0,0,0,0.5)]"
                                                                                    : inboxLight
                                                                                        ? "rounded-tl-sm border border-slate-400 bg-slate-100 text-slate-900 shadow-sm"
                                                                                        : "rounded-tl-sm border border-border bg-muted text-foreground shadow-sm"
                                                                            )}
                                                                        >
                                                                            <p
                                                                                className={cn(
                                                                                    "text-sm leading-relaxed sm:text-[15px]",
                                                                                    isOutbound &&
                                                                                        (inboxLight ? "!text-emerald-950 font-medium" : "!text-white font-medium"),
                                                                                    !isOutbound &&
                                                                                        (inboxLight ? "!text-slate-900" : "!text-foreground")
                                                                                )}
                                                                            >
                                                                                {extractVisibleMessageText(message.message)}
                                                                            </p>
                                                                        </div>
                                                                        <div
                                                                            className={cn(
                                                                                "mt-2 flex items-center gap-2 text-[11px]",
                                                                                inboxLight ? "text-slate-700" : "text-slate-400",
                                                                                isOutbound ? "justify-end" : "justify-start"
                                                                            )}
                                                                        >
                                                                            <span>{getWhatsappSenderLabel(message)}</span>
                                                                            <span>•</span>
                                                                            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", statusBadge.className)}>
                                                                                {statusBadge.label}
                                                                            </span>
                                                                            <span>•</span>
                                                                            <time dateTime={message.created_at}>{formatMessageTime(message.created_at)}</time>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </ScrollArea>
                                ) : (
                                    <div className="flex flex-1 flex-col items-center justify-center p-8 text-muted-foreground sm:p-12 md:p-16">
                                        <div
                                            className={cn(
                                                metricIconWell,
                                                'mb-8 flex h-24 w-24 items-center justify-center rounded-[1.75rem] sm:h-28 sm:w-28',
                                                inboxLight
                                                    ? 'border-slate-300 bg-slate-200 text-slate-600'
                                                    : 'bg-muted text-muted-foreground dark:bg-white/[0.06] dark:text-slate-500'
                                            )}
                                        >
                                            <MessageSquare size={40} strokeWidth={1.5} />
                                        </div>
                                        <div className="max-w-md space-y-3 text-center">
                                            <p className="text-base font-semibold text-foreground">
                                                Selecione uma conversa para abrir o histórico do WhatsApp
                                            </p>
                                            <p className="text-sm font-medium text-muted-foreground">
                                                Aqui ficam as mensagens reais recebidas e enviadas pelo número oficial configurado na Cloud API.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="unassigned" className="m-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
                        <div className="grid min-h-0 h-full min-w-0 w-full flex-1 grid-cols-1 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
                            <div className={inboxSidebarClass}>
                                <div className="p-4 sm:p-5">
                                    <div className={inboxSidebarCardClass}>
                                        <div className="mb-3 flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                                                    Conversas pendentes
                                                </p>
                                                <p className="mt-1 text-sm text-muted-foreground">
                                                    Revise, selecione e encaminhe rapidamente.
                                                </p>
                                            </div>
                                            <Badge className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                                                {unassignedConversations.length}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className={searchShellClass}>
                                                <Search className="ml-3 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                                                <Input
                                                    placeholder={t('search.placeholder')}
                                                    type="text"
                                                    className={inboxSearchInputClass}
                                                />
                                            </div>
                                            <div className="flex shrink-0 gap-0.5">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={async () => {
                                                    if ('Notification' in window) {
                                                        const permission = await Notification.requestPermission()
                                                        setNotificationPermission(permission)
                                                        if (permission === 'granted') {
                                                            toast.success('Notificações ativadas!')
                                                        } else if (permission === 'denied') {
                                                            toast.error('Permissão de notificações negada. Ative nas configurações do navegador.')
                                                        }
                                                    }
                                                }}
                                                className="h-11 w-11 rounded-xl"
                                                title={notificationPermission === 'granted' ? 'Notificações ativas' : 'Ativar notificações'}
                                            >
                                                <Bell size={18} className={cn(notificationPermission === 'granted' && 'fill-primary text-primary')} />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={loadUnassignedConversations}
                                                className="h-11 w-11 rounded-xl"
                                            >
                                                <RefreshCw size={18} className={cn(isLoading && 'animate-spin')} />
                                            </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <ScrollArea className="min-h-0 flex-1 px-3 pb-4 sm:px-4 sm:pb-6">
                                    <div className="space-y-3 pb-4 pt-3">
                                        {isLoading ? (
                                            <div
                                                className={
                                                            inboxLight
                                                                ? 'rounded-2xl border border-slate-300 bg-slate-50 p-8 text-center text-slate-600 shadow-sm'
                                                                : 'rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-muted-foreground shadow-none'
                                                }
                                            >
                                                <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin opacity-50" />
                                                <p className="text-[10px] font-semibold uppercase tracking-widest">{t('loading')}</p>
                                            </div>
                                        ) : unassignedConversations.length === 0 ? (
                                            <div
                                                className={
                                                    inboxLight
                                                        ? 'rounded-2xl border border-slate-300 bg-slate-50 p-10 text-center text-slate-600 shadow-sm'
                                                        : 'rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-muted-foreground shadow-none'
                                                }
                                            >
                                                <CheckCircle2 size={40} className="mx-auto mb-4 opacity-25" />
                                                <p className="text-[10px] font-semibold uppercase tracking-[0.2em]">{t('empty.queue')}</p>
                                            </div>
                                        ) : (
                                            unassignedConversations.map((conv) => {
                                                const isSelected = selectedConversation?.message_id === conv.message_id
                                                const isPlanLimit = conv.stuck_reason === 'plan_limit_atendimentos'
                                                const snippet = conv.last_message
                                                    ? conv.last_message.length > 50
                                                        ? conv.last_message.substring(0, 50) + '...'
                                                        : conv.last_message
                                                    : t('message.sent')

                                                return (
                                                    <button
                                                        key={conv.message_id}
                                                        type="button"
                                                        onClick={() => setSelectedConversation(conv)}
                                                        className={cn(
                                                            'group flex w-full items-center gap-4 rounded-[1.15rem] p-4 text-left outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                                                            inboxRowClass,
                                                            isSelected
                                                                ? inboxLight
                                                                    ? 'border-blue-500 bg-blue-200/90 shadow-[0_14px_36px_-24px_rgba(37,99,235,0.3)] ring-1 ring-blue-400/40'
                                                                    : 'border-transparent bg-primary/[0.12]'
                                                                : 'hover:-translate-y-0.5 hover:shadow-md'
                                                        )}
                                                    >
                                                        <div
                                                            className={cn(
                                                                metricIconWell,
                                                                'h-11 w-11 shrink-0',
                                                                inboxLight
                                                                    ? 'border-slate-300 bg-slate-200 text-slate-700'
                                                                    : 'bg-muted text-muted-foreground dark:bg-white/[0.08] dark:text-slate-300'
                                                            )}
                                                        >
                                                            <User size={20} strokeWidth={2} className="shrink-0" />
                                                        </div>

                                                        <div className="min-w-0 flex-1">
                                                            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                                                                <p className="min-w-0 truncate text-sm font-semibold leading-tight text-foreground">
                                                                    {formatContactLabel(conv)}
                                                                </p>
                                                                <div className="flex items-center gap-2">
                                                                    {isPlanLimit && (
                                                                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                                                                            {t('stuck.planLimitBadge', { defaultValue: 'Limite do plano' })}
                                                                        </span>
                                                                    )}
                                                                    {isSelected && (
                                                                        <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                                                                            Ativa
                                                                        </span>
                                                                    )}
                                                                    {conv.last_message_at && (
                                                                        <time
                                                                            className="shrink-0 whitespace-nowrap text-[10px] tabular-nums text-muted-foreground"
                                                                            dateTime={conv.last_message_at}
                                                                        >
                                                                            {formatRelativeTime(conv.last_message_at)}
                                                                        </time>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <p className="line-clamp-2 text-left text-xs leading-snug text-muted-foreground">
                                                                {snippet}
                                                            </p>
                                                        </div>
                                                    </button>
                                                )
                                            })
                                        )}
                                    </div>
                                </ScrollArea>
                            </div>

                            <div className={inboxCanvasClass}>
                                {selectedConversation ? (
                                    <ScrollArea className="min-h-0 flex-1">
                                        <div className="mx-auto max-w-5xl space-y-6 px-4 py-5 animate-in slide-in-from-bottom-4 duration-500 sm:px-6 sm:py-6 md:space-y-8 lg:px-8 lg:py-8">

                                            <div
                                                className={
                                                    inboxLight
                                                        ? "relative flex shrink-0 flex-col gap-5 overflow-hidden rounded-[2rem] border border-blue-400 bg-blue-100 p-5 text-slate-950 shadow-[0_1px_3px_rgba(15,23,42,0.08)] sm:flex-row sm:items-center sm:gap-6 sm:p-6 md:p-7"
                                                        : "relative flex shrink-0 flex-col gap-5 overflow-hidden rounded-[2rem] border border-border bg-card p-5 text-foreground shadow-[0_20px_50px_-36px_rgba(0,0,0,0.55)] sm:flex-row sm:items-center sm:gap-6 sm:p-6 md:p-7"
                                                }
                                            >
                                                {inboxLight && (
                                                    <>
                                                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.1] via-transparent to-transparent" aria-hidden />
                                                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/40 to-transparent opacity-90" aria-hidden />
                                                    </>
                                                )}
                                                <div
                                                    className={
                                                        inboxLight
                                                            ? "relative flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.6rem] bg-white text-primary shadow-sm ring-2 ring-blue-300/90 sm:h-20 sm:w-20"
                                                            : "relative flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.6rem] bg-white/10 text-blue-300 shadow-sm ring-1 ring-white/10 sm:h-20 sm:w-20"
                                                    }
                                                >
                                                    <Bot size={32} strokeWidth={2.25} className="sm:h-10 sm:w-10" />
                                                </div>
                                                <div className="relative min-w-0 flex-1 space-y-3 pl-0 sm:pl-2">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <Badge
                                                            className={
                                                                selectedConversationIsPlanLimit
                                                                    ? inboxLight
                                                                        ? "rounded-full border border-amber-400 bg-amber-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-950 shadow-sm"
                                                                        : "rounded-full bg-amber-500/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-400"
                                                                    : inboxLight
                                                                      ? "rounded-full border border-blue-300 bg-blue-200 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-950 shadow-sm"
                                                                      : "rounded-full bg-blue-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-300 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.12)]"
                                                            }
                                                        >
                                                            {selectedConversationIsPlanLimit
                                                                ? t('stuck.planLimitBadge', { defaultValue: 'Limite do plano' })
                                                                : t('lead.manualIntervention')}
                                                        </Badge>
                                                        {selectedConversation?.last_message_at && (
                                                            <span className="text-xs font-medium text-muted-foreground">
                                                                {formatRelativeTime(selectedConversation.last_message_at)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h3 className="text-xl font-semibold tracking-tight sm:text-2xl">
                                                        {selectedConversationIsPlanLimit
                                                            ? t('stuck.planLimitTitle', {
                                                                  defaultValue: 'Agente não respondeu — limite do plano',
                                                              })
                                                            : t('lead.waiting')}
                                                    </h3>
                                                    <p className="text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
                                                        {selectedConversationName}
                                                    </p>
                                                </div>
                                            </div>

                                            {selectedConversationIsPlanLimit && (
                                                <div
                                                    className={
                                                        inboxLight
                                                            ? 'rounded-2xl border border-amber-400/80 bg-amber-50 p-5 text-amber-950 shadow-sm'
                                                            : 'rounded-2xl border border-amber-500/35 bg-amber-500/10 p-5 text-foreground'
                                                    }
                                                    role="alert"
                                                >
                                                    <div className="flex gap-3">
                                                        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                                                        <div className="space-y-2 text-sm">
                                                            <p className="font-semibold">
                                                                {t('stuck.planLimitAlertTitle', {
                                                                    defaultValue:
                                                                        'Mensagem recebida, mas o atendimento automatizado está bloqueado',
                                                                })}
                                                            </p>
                                                            <p className="leading-relaxed text-muted-foreground">
                                                                {selectedConversation.stuck_detail ||
                                                                    t('stuck.planLimitAlertBody', {
                                                                        defaultValue:
                                                                            'O limite mensal de atendimentos do seu plano foi atingido. Nenhum agente processou esta mensagem.',
                                                                    })}
                                                            </p>
                                                            {(selectedConversation.conversations_used != null ||
                                                                selectedConversation.conversations_limit != null) && (
                                                                <p className="text-xs font-medium tabular-nums text-muted-foreground">
                                                                    {t('stuck.planLimitUsage', {
                                                                        defaultValue: 'Uso no mês: {{used}} / {{limit}}',
                                                                        used:
                                                                            selectedConversation.conversations_used ??
                                                                            '—',
                                                                        limit:
                                                                            selectedConversation.conversations_limit ??
                                                                            '—',
                                                                    })}
                                                                </p>
                                                            )}
                                                            <p className="text-xs text-muted-foreground">
                                                                {t('stuck.planLimitHint', {
                                                                    defaultValue:
                                                                        'Atualize o plano ou solicite recarga em Configurações → Assinatura para voltar a receber respostas automáticas.',
                                                                })}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            <div className={cn(inboxPanelClass, 'space-y-5 p-5 sm:p-6 md:p-7')}>
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="space-y-2">
                                                        <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-muted-foreground">
                                                    {t('message.content')}
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    Última interação recebida antes do encaminhamento.
                                                </p>
                                                    </div>
                                                    <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-[inset_0_0_0_1px_rgba(59,130,246,0.12)] sm:flex">
                                                        <MessageSquare className="h-5 w-5" strokeWidth={2.2} />
                                                    </div>
                                                </div>
                                                {!selectedConversationIsFile ? (
                                                    <div className="flex justify-start">
                                                        <div className="relative max-w-full sm:max-w-[90%]">
                                                            <div
                                                                className={
                                                                    inboxLight
                                                                        ? "rounded-[1.4rem] rounded-tl-sm border border-slate-400 bg-slate-100 p-4 text-slate-900 shadow-sm sm:p-5"
                                                                        : "rounded-[1.4rem] rounded-tl-sm border border-border bg-muted p-4 text-foreground shadow-sm sm:p-5"
                                                                }
                                                            >
                                                                <p
                                                                    className={cn(
                                                                        "text-sm font-medium leading-relaxed sm:text-[15px]",
                                                                        inboxLight ? "!text-slate-900" : "!text-foreground"
                                                                    )}
                                                                >
                                                                    {selectedConversation.last_message}
                                                                </p>
                                                            </div>
                                                            <div
                                                                className={cn(
                                                                    "absolute -left-1.5 top-0 h-3.5 w-3.5 rotate-45",
                                                                    inboxLight ? "bg-slate-100" : "bg-muted"
                                                                )}
                                                                style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}
                                                            />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div
                                                        className={
                                                            inboxLight
                                                                ? "rounded-[1.4rem] border border-emerald-400 bg-emerald-100 p-4 text-emerald-950 shadow-sm selection:bg-emerald-300/90 selection:text-emerald-950 sm:p-5"
                                                                : "rounded-[1.4rem] border border-emerald-500/20 bg-emerald-950/40 p-4 text-emerald-100 shadow-none selection:bg-emerald-600/50 selection:text-white sm:p-5"
                                                        }
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div
                                                                className={
                                                                    inboxLight
                                                                        ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-400 bg-emerald-200 text-emerald-900"
                                                                        : "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/12 text-emerald-300"
                                                                }
                                                            >
                                                                <ImageIcon size={21} className="shrink-0" />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p
                                                                    className={
                                                                        inboxLight
                                                                            ? 'text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-800'
                                                                            : 'text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-300/90'
                                                                    }
                                                                >
                                                                    Anexo recebido
                                                                </p>
                                                                <p
                                                                    className={
                                                                        inboxLight
                                                                            ? 'mt-1 text-sm font-semibold text-emerald-950 sm:text-[15px]'
                                                                            : 'mt-1 text-sm font-semibold text-emerald-100 sm:text-[15px]'
                                                                    }
                                                                >
                                                                    {t('message.fileSent')}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {!selectedConversationIsPlanLimit && (
                                            <div className={cn(inboxPanelClass, 'p-5 sm:p-6 md:p-7')}>
                                                <div className="mb-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-5">
                                                    <div
                                                        className={cn(
                                                            metricIconWell,
                                                            'h-12 w-12',
                                                            inboxLight
                                                                ? 'border-blue-400 bg-blue-200 text-blue-900'
                                                                : 'bg-blue-500/[0.12] text-blue-700 dark:bg-blue-500/25 dark:text-blue-300'
                                                        )}
                                                    >
                                                        <Wrench size={24} strokeWidth={2.25} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <h4 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                                                            {t('action.resolveContact')}
                                                        </h4>
                                                        <p className="text-sm text-muted-foreground">
                                                            Direcione o atendimento para o agente correto e retire esse contato da fila manual.
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="mx-auto max-w-xl space-y-4">
                                                    <Button
                                                        variant="outline"
                                                        onClick={handleDeleteSelectedUnassignedHistory}
                                                        disabled={isDeletingUnassignedHistory}
                                                        className={cn(
                                                            "h-12 w-full rounded-full text-[11px] font-semibold uppercase tracking-[0.12em]",
                                                            inboxLight
                                                                ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800"
                                                                : "border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/15 hover:text-red-200"
                                                        )}
                                                    >
                                                        {isDeletingUnassignedHistory ? (
                                                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                        )}
                                                        Apagar histórico da conversa
                                                    </Button>
                                                    <div
                                                        className={
                                                            inboxLight
                                                                ? "rounded-[1.35rem] border border-slate-400 bg-slate-200/80 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]"
                                                                : "rounded-[1.35rem] border border-transparent bg-black/10 p-2.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05),0_18px_34px_-28px_rgba(0,0,0,0.35)]"
                                                        }
                                                    >
                                                        <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                                                            <SelectTrigger
                                                                className={cn(
                                                                    "h-13 rounded-[1.1rem] border-0 px-3 text-left text-sm font-semibold shadow-none focus:ring-1 focus:ring-ring sm:px-4",
                                                                    inboxLight
                                                                        ? "border border-slate-300 bg-white shadow-sm"
                                                                        : "bg-background dark:bg-white/[0.03]"
                                                                )}
                                                            >
                                                                <div className="flex w-full min-w-0 items-center gap-3">
                                                                    <Bot size={20} className="shrink-0 text-primary" />
                                                                    <SelectValue placeholder={t('select.agentPlaceholder')} />
                                                                </div>
                                                            </SelectTrigger>
                                                            <SelectContent className="rounded-xl border-border p-1 shadow-lg">
                                                                {agents.map((agent) => (
                                                                    <SelectItem
                                                                        key={agent.id}
                                                                        value={agent.id}
                                                                        className="cursor-pointer rounded-lg py-3 font-semibold"
                                                                    >
                                                                        {agent.nome}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    <Button
                                                        onClick={handleAssignAgent}
                                                        disabled={!selectedAgentId || isAssigning}
                                                        size="lg"
                                                        className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,hsl(var(--primary)),hsl(217_91%_56%))] px-6 text-sm font-semibold uppercase tracking-[0.14em] text-primary-foreground shadow-[0_22px_40px_-24px_rgba(37,99,235,0.95)] transition-transform hover:scale-[1.01] hover:brightness-105 active:scale-[0.99]"
                                                    >
                                                        {isAssigning ? (
                                                            <RefreshCw className="h-6 w-6 animate-spin" />
                                                        ) : (
                                                            <>
                                                                <Zap className="h-5 w-5 shrink-0" strokeWidth={2.5} />
                                                                <span className="truncate">{t('button.activateAgent')}</span>
                                                            </>
                                                        )}
                                                    </Button>
                                                </div>
                                            </div>
                                            )}

                                            {selectedConversationIsPlanLimit && (
                                                <div className={cn(inboxPanelClass, 'p-5 sm:p-6')}>
                                                    <Button
                                                        variant="outline"
                                                        onClick={handleDeleteSelectedUnassignedHistory}
                                                        disabled={isDeletingUnassignedHistory}
                                                        className={cn(
                                                            'h-12 w-full rounded-full text-[11px] font-semibold uppercase tracking-[0.12em]',
                                                            inboxLight
                                                                ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
                                                                : 'border-red-500/30 bg-red-500/10 text-red-300'
                                                        )}
                                                    >
                                                        {isDeletingUnassignedHistory ? (
                                                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                        )}
                                                        Apagar histórico da conversa
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </ScrollArea>
                                ) : (
                                    <div className="flex flex-1 flex-col items-center justify-center p-8 text-muted-foreground sm:p-12 md:p-16">
                                        <div
                                            className={cn(
                                                metricIconWell,
                                                'mb-8 flex h-24 w-24 items-center justify-center rounded-[1.75rem] sm:h-28 sm:w-28',
                                                inboxLight
                                                    ? 'border-slate-300 bg-slate-200 text-slate-600'
                                                    : 'bg-muted text-muted-foreground dark:bg-white/[0.06] dark:text-slate-500'
                                            )}
                                        >
                                            <MessageSquare size={40} strokeWidth={1.5} />
                                        </div>
                                        <div className="max-w-md space-y-3 text-center">
                                            <p className="text-base font-semibold text-foreground">
                                                Selecione uma conversa para abrir o painel de triagem
                                            </p>
                                            <p className="text-sm font-medium text-muted-foreground">
                                                A lista à esquerda mostra todas as conversas aguardando encaminhamento manual.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent
                        value="decisions"
                        className={cn(
                            "m-0 min-h-0 flex-1 overflow-auto p-4 data-[state=inactive]:hidden sm:p-6 md:p-8",
                            inboxLight ? "bg-slate-200/80" : "bg-background"
                        )}
                    >
                        <div className="mx-auto max-w-5xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 sm:space-y-8">
                            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(240px,0.55fr)]">
                                <div
                                    className={
                                        inboxLight
                                            ? "rounded-[1.5rem] border border-slate-300 bg-slate-50 p-5 text-slate-950 shadow-[0_1px_3px_rgba(15,23,42,0.07)]"
                                            : "rounded-[1.5rem] border border-border bg-card p-5 text-card-foreground shadow-sm dark:shadow-none"
                                    }
                                >
                                    <div className="min-w-0">
                                        <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{t('decisions.title')}</h2>
                                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                            {t('decisions.subtitle')}
                                        </p>
                                    </div>
                                </div>

                                <div
                                    className={
                                        inboxLight
                                            ? "rounded-[1.5rem] border border-slate-300 bg-slate-50 p-5 text-slate-950 shadow-[0_1px_3px_rgba(15,23,42,0.07)]"
                                            : "rounded-[1.5rem] border border-border bg-card p-5 text-card-foreground shadow-sm dark:shadow-none"
                                    }
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                                Pendências
                                            </p>
                                            <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                                                {pendingDecisions.length}
                                            </p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={loadPendingDecisions}
                                            disabled={isLoadingDecisions}
                                            className="h-10 w-10 shrink-0 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
                                        >
                                            <RefreshCw className={cn('h-4 w-4 text-muted-foreground', isLoadingDecisions && 'animate-spin')} />
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {isLoadingDecisions ? (
                                <div className={cn(inboxPanelClass, 'flex flex-col items-center justify-center gap-4 py-20 sm:py-24')}>
                                    <RefreshCw className="h-10 w-10 animate-spin text-primary/30" />
                                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t('decisions.syncing')}</p>
                                </div>
                            ) : pendingDecisions.length === 0 ? (
                                <div
                                    className={cn(
                                        inboxPanelClass,
                                        'rounded-xl py-16 text-center shadow-[0_12px_34px_-28px_rgba(15,23,42,0.22)] sm:py-20'
                                    )}
                                >
                                    <CheckCircle2 className="mx-auto mb-5 h-14 w-14 text-emerald-500/35 sm:h-16 sm:w-16" />
                                    <p className="font-semibold uppercase tracking-tight text-foreground">{t('decisions.allProcessed')}</p>
                                    <p className="mt-2 text-sm text-muted-foreground">{t('decisions.allProcessedDescription')}</p>
                                </div>
                            ) : (
                                <div className="space-y-6 sm:space-y-8">
                                    {pendingDecisions.map((decision) => (
                                        <div key={decision.id} className="px-1 py-1">
                                            <DecisionApprovalCard
                                                decision={decision}
                                                onApproved={loadPendingDecisions}
                                                onRejected={loadPendingDecisions}
                                                onDeleteHistory={handleDeleteDecisionHistory}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
                </div>
            </div>
        </div>
    )
}
