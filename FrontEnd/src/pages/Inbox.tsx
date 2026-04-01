import { useEffect, useState } from "react"
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
    Search
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
import { WhatsAppService, type WhatsAppConversationMessage, type WhatsAppConversationSummary } from "../services/api"

interface UnassignedConversation {
    message_id: string
    whatsapp_contact_id: string
    last_message: string
    last_message_at: string
    integrations_id: string
}

interface Agent {
    id: string
    nome: string
}

export function Inbox() {
    const { user } = useAuth()
    const { t } = useTranslation('inbox')
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
    const [currentWhatsappNumber, setCurrentWhatsappNumber] = useState<string | null>(null)
    const [lastMessageCount, setLastMessageCount] = useState(0)
    const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default')
    const [isPageVisible, setIsPageVisible] = useState(!document.hidden)

    // Estado para controlar qual aba está ativa (permite controle externo via URL)
    const [activeTab, setActiveTab] = useState<string>("unassigned")

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

    // Carregar conversas não atribuídas e agentes (apenas uma vez ao montar)
    useEffect(() => {
        if (user?.email || user?.id) {
            loadUnassignedConversations()
            loadAgents()
            loadPendingDecisions()
            loadWhatsAppConversations()
        }
    }, [user])

    // Escutar mudanças em tempo real via Supabase Realtime + Polling como fallback
    useEffect(() => {
        if (!user?.email) return

        // Salvar contagem inicial
        setLastMessageCount(unassignedConversations.length)

        // Configurar subscription do Supabase Realtime
        const channel = supabase
            .channel('inbox-messages')
            .on(
                'postgres_changes',
                {
                    event: '*', // INSERT, UPDATE, DELETE
                    schema: 'public',
                    table: 'tb_whatsapp_messages',
                    filter: 'agent_id=is.null' // Apenas mensagens não atribuídas
                },
                (payload) => {
                    console.log('[Inbox] Mudança detectada via Realtime:', payload)
                    // Recarregar conversas quando houver mudança
                    loadUnassignedConversations()
                    loadWhatsAppConversations()
                }
            )
            .subscribe((status) => {
                console.log('[Inbox] Status da subscription Realtime:', status)
            })

        // Polling como fallback (caso Realtime não funcione)
        const pollingInterval = setInterval(() => {
            loadUnassignedConversations()
            loadWhatsAppConversations()
        }, 10000) // Verifica a cada 10 segundos

        return () => {
            supabase.removeChannel(channel)
            clearInterval(pollingInterval)
        }
    }, [user?.email, selectedWhatsappConversation?.whatsapp_contact_id])

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

    const loadWhatsAppConversations = async (preferredContactId?: string) => {
        try {
            setIsLoadingWhatsApp(true)
            const result = await WhatsAppService.listCurrentConversations()
            const conversations = result.conversations || []

            setWhatsappConversations(conversations)
            setCurrentWhatsappNumber(result.integration?.phone_number || null)

            const preferredId = preferredContactId || selectedWhatsappConversation?.whatsapp_contact_id
            const preferredConversation = preferredId
                ? conversations.find((conversation) => conversation.whatsapp_contact_id === preferredId) || null
                : null

            setSelectedWhatsappConversation(preferredConversation || conversations[0] || null)
        } catch (error) {
            console.error("[Inbox] Erro ao carregar conversas do WhatsApp:", error)
            setWhatsappConversations([])
            setSelectedWhatsappConversation(null)
        } finally {
            setIsLoadingWhatsApp(false)
        }
    }

    const loadWhatsappMessages = async (contactId: string) => {
        try {
            setIsLoadingWhatsappMessages(true)
            const messages = await WhatsAppService.getCurrentConversationMessages(contactId, 100)
            setWhatsappMessages(messages)
        } catch (error) {
            console.error("[Inbox] Erro ao carregar histórico da conversa:", error)
            setWhatsappMessages([])
        } finally {
            setIsLoadingWhatsappMessages(false)
        }
    }

    const loadUnassignedConversations = async () => {
        if (!user?.email) return

        try {
            setIsLoading(true)
            const { data, error } = await supabase.rpc('sp_list_unassigned_whatsapp_conversations', {
                p_email: user.email
            })

            if (error) {
                console.error("[Inbox] Erro ao buscar conversas não atribuídas:", error)
                toast.error(t('errors.loading'))
                return
            }

            if (data) {
                setUnassignedConversations(Array.isArray(data) ? data : [data])
            }
        } catch (error: any) {
            console.error("[Inbox] Erro:", error)
            toast.error(t('errors.loading'))
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        if (selectedWhatsappConversation?.whatsapp_contact_id) {
            loadWhatsappMessages(selectedWhatsappConversation.whatsapp_contact_id)
        } else {
            setWhatsappMessages([])
        }
    }, [selectedWhatsappConversation?.whatsapp_contact_id])

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

    const getWhatsappConversationLabel = (conversation: WhatsAppConversationSummary) => {
        const reference =
            conversation.phone_number ||
            conversation.contact_label ||
            conversation.lid ||
            conversation.whatsapp_contact_id

        return formatPhoneNumber(reference)
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

    // Verificar se há leads aguardando para mostrar vignette
    const hasPendingLeads = unassignedConversations.length > 0

    const metricIconWell =
        "flex shrink-0 items-center justify-center rounded-xl bg-white/55 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.28),inset_0_1px_0_rgba(255,255,255,0.8)] dark:bg-white/[0.08] dark:shadow-[0_18px_40px_-24px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.05)]"

    /** Shell: mesma elevação do Cockpit (card principal) */
    const inboxShellClass =
        "overflow-hidden rounded-2xl bg-card/92 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.22)] dark:bg-[hsl(222_32%_15%/0.96)] dark:shadow-[0_30px_80px_-38px_rgba(0,0,0,0.78)]"

    const inboxPanelClass =
        "rounded-xl bg-slate-50/72 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.24)] dark:bg-[hsl(222_36%_13%)] dark:shadow-[0_18px_40px_-30px_rgba(0,0,0,0.55)]"

    const inboxRowClass =
        "rounded-xl bg-white/78 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.22)] transition-colors dark:bg-[hsl(222_36%_11.5%)] dark:hover:bg-[hsl(222_36%_13%)]"

    const inboxScrollH = "min-h-[min(720px,82svh)] lg:min-h-[min(820px,85svh)]"
    const selectedConversationIsFile =
        !!selectedConversation?.last_message &&
        (
            selectedConversation.last_message.toLowerCase().includes('imagem sem legenda') ||
            selectedConversation.last_message.toLowerCase().includes('arquivo')
        )
    const selectedConversationName = selectedConversation
        ? formatPhoneNumber(selectedConversation.whatsapp_contact_id)
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
            surface: notificationPermission === 'granted' ? 'bg-emerald-500/[0.10] dark:bg-emerald-400/15' : 'bg-slate-500/[0.08] dark:bg-white/[0.08]'
        }
    ]

    return (
        <div className="relative min-h-full w-full min-w-0 overflow-hidden animate-in fade-in duration-500 bg-background px-3 pb-4 pt-6 font-sans sm:px-4 sm:pb-6 sm:pt-8 md:px-6 md:pb-8 md:pt-10">
            <div
                className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] opacity-90"
                aria-hidden
                style={{
                    background:
                        "radial-gradient(circle at top left, hsl(var(--primary) / 0.14), transparent 38%), radial-gradient(circle at top right, hsl(var(--ring) / 0.12), transparent 32%), linear-gradient(180deg, hsl(var(--muted) / 0.28), transparent 72%)",
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
                    <div className="relative overflow-hidden rounded-[1.75rem] bg-white/80 p-5 pt-6 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.18)] backdrop-blur-sm dark:bg-[hsl(222_38%_14%/0.88)] dark:shadow-[0_24px_70px_-34px_rgba(0,0,0,0.72)] sm:p-6 sm:pt-7 md:p-7 md:pt-8">
                        <div
                            className="pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-80"
                            aria-hidden
                            style={{
                                background:
                                    "radial-gradient(circle at center, hsl(var(--primary) / 0.16), transparent 60%)",
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
                                        !hasPendingLeads && 'border-slate-200/80 bg-white/70 text-muted-foreground dark:border-white/[0.12] dark:bg-white/[0.06] dark:text-muted-foreground'
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
                                            className="rounded-2xl bg-slate-50/78 p-4 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.3)] dark:bg-black/20"
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
                        <div className="rounded-[1.5rem] bg-card/82 p-4 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.22)] dark:bg-[hsl(222_33%_15%/0.88)]">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                Fila ativa
                            </p>
                            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                                {hasPendingLeads
                                    ? 'Existem conversas aguardando distribuição manual. Priorize as mensagens mais recentes.'
                                    : 'Nenhuma conversa travada no momento. A operação está fluindo normalmente.'}
                            </p>
                        </div>
                        <div className="rounded-[1.5rem] bg-card/82 p-4 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.22)] dark:bg-[hsl(222_33%_15%/0.88)]">
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
                        <div className="bg-slate-50/42 px-4 py-4 backdrop-blur-sm dark:bg-black/18 sm:px-6">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <TabsList className="grid h-11 w-full max-w-xl grid-cols-3 gap-0.5 rounded-xl bg-white/62 p-1 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.18)] dark:bg-white/[0.04] sm:inline-flex sm:w-auto sm:grid-cols-none">
                                <TabsTrigger
                                    value="whatsapp"
                                    className="gap-2 rounded-lg px-3 py-2.5 text-xs font-medium text-muted-foreground transition-all data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-[0_1px_2px_rgba(0,0,0,0.06)] dark:data-[state=active]:bg-[hsl(222_32%_18%)] dark:data-[state=active]:text-foreground dark:data-[state=active]:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
                                >
                                    <MessageSquare className="h-4 w-4 shrink-0 opacity-80" strokeWidth={2} />
                                    <span className="truncate">WhatsApp</span>
                                    {whatsappConversations.length > 0 && (
                                        <span className="rounded-md bg-emerald-500/12 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-emerald-600 dark:text-emerald-300">
                                            {whatsappConversations.length}
                                        </span>
                                    )}
                                </TabsTrigger>
                                <TabsTrigger
                                    value="unassigned"
                                    className="gap-2 rounded-lg px-3 py-2.5 text-xs font-medium text-muted-foreground transition-all data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-[0_1px_2px_rgba(0,0,0,0.06)] dark:data-[state=active]:bg-[hsl(222_32%_18%)] dark:data-[state=active]:text-foreground dark:data-[state=active]:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
                                >
                                    <AlertCircle className="h-4 w-4 shrink-0 opacity-80" strokeWidth={2} />
                                    <span className="truncate">{t('tabs.stuckMessages')}</span>
                                    {unassignedConversations.length > 0 && (
                                        <span className="rounded-md bg-destructive/12 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-destructive">
                                            {unassignedConversations.length}
                                        </span>
                                    )}
                                </TabsTrigger>

                                <TabsTrigger
                                    value="decisions"
                                    className="gap-2 rounded-lg px-3 py-2.5 text-xs font-medium text-muted-foreground transition-all data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-[0_1px_2px_rgba(0,0,0,0.06)] dark:data-[state=active]:bg-[hsl(222_32%_18%)] dark:data-[state=active]:text-foreground dark:data-[state=active]:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
                                >
                                    <CheckCircle2 className="h-4 w-4 shrink-0 opacity-80" strokeWidth={2} />
                                    <span className="truncate">{t('tabs.approvals')}</span>
                                    {pendingDecisions.length > 0 && (
                                        <span className="rounded-md bg-primary/12 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-primary">
                                            {pendingDecisions.length}
                                        </span>
                                    )}
                                </TabsTrigger>
                                </TabsList>

                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge className="rounded-full bg-white/72 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-[0_8px_24px_-18px_rgba(15,23,42,0.18)] dark:bg-white/[0.05] dark:text-slate-300">
                                        {selectedHeaderLabel ? `Contato selecionado: ${selectedHeaderLabel}` : 'Selecione uma conversa para ver detalhes'}
                                    </Badge>
                                </div>
                            </div>
                        </div>

                    <TabsContent value="whatsapp" className="m-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
                        <div className="grid min-h-0 h-full min-w-0 w-full flex-1 grid-cols-1 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
                            <div className="flex min-h-0 flex-col bg-slate-50/40 dark:bg-[hsl(222_32%_12%)]">
                                <div className="p-4 sm:p-5">
                                    <div className="rounded-[1.35rem] bg-white/76 p-3 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.28)] dark:bg-[hsl(222_32%_14%)]">
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
                                            <div className="relative flex min-w-0 flex-1 items-center rounded-xl bg-white shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)] dark:bg-[hsl(222_32%_14%)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
                                                <Search className="ml-3 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                                                <Input
                                                    placeholder="Histórico das conversas do número oficial"
                                                    type="search"
                                                    className="h-11 min-w-0 flex-1 border-0 bg-transparent pl-2 pr-3 text-sm shadow-none focus-visible:ring-0"
                                                />
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => loadWhatsAppConversations()}
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
                                            <div className="rounded-2xl bg-white/65 p-8 text-center text-muted-foreground shadow-[0_12px_30px_-24px_rgba(15,23,42,0.18)] dark:bg-white/[0.03]">
                                                <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin opacity-50" />
                                                <p className="text-[10px] font-semibold uppercase tracking-widest">Sincronizando WhatsApp</p>
                                            </div>
                                        ) : whatsappConversations.length === 0 ? (
                                            <div className="rounded-2xl bg-white/65 p-10 text-center text-muted-foreground shadow-[0_12px_30px_-24px_rgba(15,23,42,0.18)] dark:bg-white/[0.03]">
                                                <MessageSquare size={40} className="mx-auto mb-4 opacity-25" />
                                                <p className="text-[10px] font-semibold uppercase tracking-[0.2em]">Nenhuma conversa encontrada</p>
                                                <p className="mt-2 text-sm text-muted-foreground">
                                                    As mensagens do número oficial vão aparecer aqui assim que a Meta entregar os eventos.
                                                </p>
                                            </div>
                                        ) : (
                                            whatsappConversations.map((conversation) => {
                                                const isSelected = selectedWhatsappConversation?.whatsapp_contact_id === conversation.whatsapp_contact_id
                                                const snippet = conversation.last_message.length > 70
                                                    ? `${conversation.last_message.substring(0, 70)}...`
                                                    : conversation.last_message

                                                return (
                                                    <button
                                                        key={conversation.last_message_id}
                                                        type="button"
                                                        onClick={() => setSelectedWhatsappConversation(conversation)}
                                                        className={cn(
                                                            'group flex w-full items-center gap-4 rounded-[1.15rem] p-4 text-left outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                                                            inboxRowClass,
                                                            isSelected
                                                                ? 'bg-emerald-500/[0.08] shadow-[0_18px_40px_-26px_rgba(16,185,129,0.28)] dark:bg-emerald-500/[0.12]'
                                                                : 'hover:-translate-y-0.5 hover:shadow-md'
                                                        )}
                                                    >
                                                        <div
                                                            className={cn(
                                                                metricIconWell,
                                                                'h-11 w-11 shrink-0',
                                                                'bg-emerald-500/[0.10] text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300'
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
                                                            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                                                {conversation.agent_name ? `Agente: ${conversation.agent_name}` : 'Sem agente vinculado'}
                                                            </p>
                                                        </div>
                                                    </button>
                                                )
                                            })
                                        )}
                                    </div>
                                </ScrollArea>
                            </div>

                            <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--muted)/0.32)_100%)] dark:bg-[linear-gradient(180deg,hsl(222_47%_10%)_0%,hsl(222_47%_9%)_100%)]">
                                {selectedWhatsappConversation ? (
                                    <ScrollArea className="min-h-0 flex-1">
                                        <div className="mx-auto max-w-5xl space-y-6 px-4 py-5 animate-in slide-in-from-bottom-4 duration-500 sm:px-6 sm:py-6 md:space-y-8 lg:px-8 lg:py-8">
                                            <div className="relative flex shrink-0 flex-col gap-5 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,rgba(16,185,129,0.18),rgba(6,182,212,0.08)_55%,rgba(15,23,42,0.02))] p-5 text-foreground shadow-[0_24px_60px_-34px_rgba(16,185,129,0.25)] dark:bg-[linear-gradient(135deg,rgba(16,185,129,0.12),rgba(34,211,238,0.05)_55%,rgba(15,23,42,0.02))] dark:text-foreground sm:flex-row sm:items-center sm:gap-6 sm:p-6 md:p-7">
                                                <div className="absolute inset-0 opacity-70" aria-hidden style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.08), transparent 58%)' }} />
                                                <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.6rem] bg-white/75 text-emerald-600 shadow-[0_16px_32px_-20px_rgba(16,185,129,0.28)] backdrop-blur-sm dark:bg-white/[0.08] dark:text-emerald-300 sm:h-20 sm:w-20">
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
                                                    <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.12)] sm:flex dark:text-emerald-300">
                                                        <MessageSquare className="h-5 w-5" strokeWidth={2.2} />
                                                    </div>
                                                </div>

                                                {isLoadingWhatsappMessages ? (
                                                    <div className="rounded-2xl bg-white/65 p-10 text-center text-muted-foreground shadow-[0_12px_30px_-24px_rgba(15,23,42,0.18)] dark:bg-white/[0.03]">
                                                        <RefreshCw className="mx-auto mb-3 h-6 w-6 animate-spin opacity-50" />
                                                        <p className="text-[10px] font-semibold uppercase tracking-widest">Carregando histórico</p>
                                                    </div>
                                                ) : whatsappMessages.length === 0 ? (
                                                    <div className="rounded-2xl bg-white/65 p-10 text-center text-muted-foreground shadow-[0_12px_30px_-24px_rgba(15,23,42,0.18)] dark:bg-white/[0.03]">
                                                        <MessageSquare size={38} className="mx-auto mb-4 opacity-25" />
                                                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em]">Sem mensagens salvas</p>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-4">
                                                        {whatsappMessages.map((message) => {
                                                            const isOutbound = message.direction === 'outbound'

                                                            return (
                                                                <div
                                                                    key={message.id || message.message_id || `${message.direction}-${message.created_at}`}
                                                                    className={cn("flex", isOutbound ? "justify-end" : "justify-start")}
                                                                >
                                                                    <div className={cn("max-w-[88%] sm:max-w-[75%]", isOutbound ? "items-end" : "items-start")}>
                                                                        <div
                                                                            className={cn(
                                                                                "rounded-[1.4rem] px-4 py-3 shadow-[0_18px_36px_-28px_rgba(15,23,42,0.25)] sm:px-5 sm:py-4",
                                                                                isOutbound
                                                                                    ? "rounded-tr-sm bg-emerald-500 text-white"
                                                                                    : "rounded-tl-sm bg-white text-foreground dark:bg-[hsl(222_36%_14%)]"
                                                                            )}
                                                                        >
                                                                            <p className="text-sm font-medium leading-relaxed sm:text-[15px]">
                                                                                {message.message}
                                                                            </p>
                                                                        </div>
                                                                        <div className={cn("mt-2 flex items-center gap-2 text-[11px] text-muted-foreground", isOutbound ? "justify-end" : "justify-start")}>
                                                                            <span>{isOutbound ? (selectedWhatsappConversation.agent_name || 'Agente') : 'Contato'}</span>
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
                                                'mb-8 flex h-24 w-24 items-center justify-center rounded-[1.75rem] bg-slate-100 text-slate-400 dark:bg-white/[0.06] dark:text-slate-500 sm:h-28 sm:w-28'
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
                            <div className="flex min-h-0 flex-col bg-slate-50/40 dark:bg-[hsl(222_32%_12%)]">
                                <div className="p-4 sm:p-5">
                                    <div className="rounded-[1.35rem] bg-white/76 p-3 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.28)] dark:bg-[hsl(222_32%_14%)]">
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
                                            <div className="relative flex min-w-0 flex-1 items-center rounded-xl bg-white shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)] dark:bg-[hsl(222_32%_14%)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
                                                <Search className="ml-3 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                                                <Input
                                                    placeholder={t('search.placeholder')}
                                                    type="search"
                                                    className="h-11 min-w-0 flex-1 border-0 bg-transparent pl-2 pr-3 text-sm shadow-none focus-visible:ring-0"
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
                                            <div className="rounded-2xl bg-white/65 p-8 text-center text-muted-foreground shadow-[0_12px_30px_-24px_rgba(15,23,42,0.18)] dark:bg-white/[0.03]">
                                                <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin opacity-50" />
                                                <p className="text-[10px] font-semibold uppercase tracking-widest">{t('loading')}</p>
                                            </div>
                                        ) : unassignedConversations.length === 0 ? (
                                            <div className="rounded-2xl bg-white/65 p-10 text-center text-muted-foreground shadow-[0_12px_30px_-24px_rgba(15,23,42,0.18)] dark:bg-white/[0.03]">
                                                <CheckCircle2 size={40} className="mx-auto mb-4 opacity-25" />
                                                <p className="text-[10px] font-semibold uppercase tracking-[0.2em]">{t('empty.queue')}</p>
                                            </div>
                                        ) : (
                                            unassignedConversations.map((conv) => {
                                                const isSelected = selectedConversation?.message_id === conv.message_id
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
                                                                ? 'bg-primary/[0.08] shadow-[0_18px_40px_-26px_rgba(37,99,235,0.38)] dark:bg-primary/[0.12]'
                                                                : 'hover:-translate-y-0.5 hover:shadow-md'
                                                        )}
                                                    >
                                                        <div
                                                            className={cn(
                                                                metricIconWell,
                                                                'h-11 w-11 shrink-0',
                                                                'bg-slate-100 text-slate-600 dark:bg-white/[0.08] dark:text-slate-300'
                                                            )}
                                                        >
                                                            <User size={20} strokeWidth={2} className="shrink-0" />
                                                        </div>

                                                        <div className="min-w-0 flex-1">
                                                            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                                                                <p className="min-w-0 truncate text-sm font-semibold leading-tight text-foreground">
                                                                    {formatPhoneNumber(conv.whatsapp_contact_id)}
                                                                </p>
                                                                <div className="flex items-center gap-2">
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

                            <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--muted)/0.32)_100%)] dark:bg-[linear-gradient(180deg,hsl(222_47%_10%)_0%,hsl(222_47%_9%)_100%)]">
                                {selectedConversation ? (
                                    <ScrollArea className="min-h-0 flex-1">
                                        <div className="mx-auto max-w-5xl space-y-6 px-4 py-5 animate-in slide-in-from-bottom-4 duration-500 sm:px-6 sm:py-6 md:space-y-8 lg:px-8 lg:py-8">

                                            <div className="relative flex shrink-0 flex-col gap-5 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,rgba(59,130,246,0.2),rgba(6,182,212,0.08)_55%,rgba(15,23,42,0.02))] p-5 text-foreground shadow-[0_24px_60px_-34px_rgba(37,99,235,0.28)] dark:bg-[linear-gradient(135deg,rgba(96,165,250,0.12),rgba(34,211,238,0.05)_55%,rgba(15,23,42,0.02))] dark:text-foreground sm:flex-row sm:items-center sm:gap-6 sm:p-6 md:p-7">
                                                <div className="absolute inset-0 opacity-70" aria-hidden style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.08), transparent 58%)' }} />
                                                <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.6rem] bg-white/75 text-primary shadow-[0_16px_32px_-20px_rgba(37,99,235,0.35)] backdrop-blur-sm dark:bg-white/[0.08] dark:text-blue-300 sm:h-20 sm:w-20">
                                                    <Bot size={32} strokeWidth={2.25} className="sm:h-10 sm:w-10" />
                                                </div>
                                                <div className="relative min-w-0 flex-1 space-y-3 pl-0 sm:pl-2">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <Badge className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary shadow-[inset_0_0_0_1px_rgba(59,130,246,0.12)] dark:bg-blue-400/10 dark:text-blue-300">
                                                            {t('lead.manualIntervention')}
                                                        </Badge>
                                                        {selectedConversation?.last_message_at && (
                                                            <span className="text-xs font-medium text-muted-foreground">
                                                                {formatRelativeTime(selectedConversation.last_message_at)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h3 className="text-xl font-semibold tracking-tight sm:text-2xl">{t('lead.waiting')}</h3>
                                                    <p className="text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
                                                        {selectedConversationName}
                                                    </p>
                                                </div>
                                                <div className="relative flex shrink-0 justify-start sm:justify-end">
                                                    <Badge className="inline-flex w-fit items-center justify-center whitespace-nowrap rounded-full bg-[linear-gradient(135deg,#991b1b,#7f1d1d)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white shadow-[0_12px_24px_-18px_rgba(127,29,29,0.76)]">
                                                        {t('status.critical')}
                                                    </Badge>
                                                </div>
                                            </div>

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
                                                            <div className="rounded-[1.4rem] rounded-tl-sm bg-white p-4 shadow-[0_18px_36px_-28px_rgba(15,23,42,0.25)] dark:bg-[hsl(222_36%_14%)] sm:p-5">
                                                                <p className="text-sm font-medium leading-relaxed text-foreground sm:text-[15px]">
                                                                    {selectedConversation.last_message}
                                                                </p>
                                                            </div>
                                                            <div
                                                                className="absolute -left-1.5 top-0 h-3.5 w-3.5 rotate-45 bg-white dark:bg-[hsl(222_36%_14%)]"
                                                                style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}
                                                            />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="rounded-[1.4rem] bg-emerald-50/88 p-4 shadow-[0_18px_36px_-28px_rgba(5,150,105,0.3)] dark:bg-emerald-950/35 sm:p-5">
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-600 dark:bg-emerald-400/12 dark:text-emerald-300">
                                                                <ImageIcon size={21} className="shrink-0" />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700/75 dark:text-emerald-300/75">
                                                                    Anexo recebido
                                                                </p>
                                                                <p className="mt-1 text-sm font-semibold text-emerald-950 dark:text-emerald-100 sm:text-[15px]">
                                                                    {t('message.fileSent')}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div className={cn(inboxPanelClass, 'p-5 sm:p-6 md:p-7')}>
                                                <div className="mb-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-5">
                                                    <div
                                                        className={cn(
                                                            metricIconWell,
                                                            'h-12 w-12 bg-blue-500/[0.12] text-blue-700 dark:bg-blue-500/25 dark:text-blue-300'
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
                                                    <div className="rounded-[1.35rem] bg-background/90 p-2.5 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12),0_14px_30px_-24px_rgba(15,23,42,0.24)] dark:bg-black/10 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05),0_18px_34px_-28px_rgba(0,0,0,0.35)]">
                                                        <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                                                            <SelectTrigger className="h-13 rounded-[1.1rem] border-0 bg-white/70 px-3 text-left text-sm font-semibold shadow-none focus:ring-1 focus:ring-ring dark:bg-white/[0.03] sm:px-4">
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
                                        </div>
                                    </ScrollArea>
                                ) : (
                                    <div className="flex flex-1 flex-col items-center justify-center p-8 text-muted-foreground sm:p-12 md:p-16">
                                        <div
                                            className={cn(
                                                metricIconWell,
                                                'mb-8 flex h-24 w-24 items-center justify-center rounded-[1.75rem] bg-slate-100 text-slate-400 dark:bg-white/[0.06] dark:text-slate-500 sm:h-28 sm:w-28'
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

                    <TabsContent value="decisions" className="m-0 min-h-0 flex-1 overflow-auto bg-muted/5 p-4 data-[state=inactive]:hidden dark:bg-transparent sm:p-6 md:p-8">
                        <div className="mx-auto max-w-5xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 sm:space-y-8">
                            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(240px,0.55fr)]">
                                <div className="rounded-[1.5rem] bg-card/82 p-5 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.2)] dark:bg-[hsl(222_33%_15%/0.88)]">
                                    <div className="min-w-0">
                                        <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{t('decisions.title')}</h2>
                                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                            {t('decisions.subtitle')}
                                        </p>
                                    </div>
                                </div>

                                <div className="rounded-[1.5rem] bg-card/82 p-5 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.2)] dark:bg-[hsl(222_33%_15%/0.88)]">
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
