import { useEffect, useState, useRef } from "react"
import { useTheme } from "next-themes"
import { useTranslation } from "react-i18next"
import {
    MessageSquare,
    MessageCircle,
    Phone,
    Search,
    User,
    Clock,
    Send,
    Bot,
    PauseCircle,
    PlayCircle,
    Loader2,
    Wrench,
    Check,
    AlertCircle,
    CheckCircle2,
    RefreshCw,
    Zap,
    Image as ImageIcon,
    Bell
} from "lucide-react"
import { Input } from "../components/ui/input"
import { Button } from "../components/ui/button"
import { Badge } from "../components/ui/badge"
import { ScrollArea } from "../components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"
import { AgentService, Conversation, ChatMessage } from "../services/api"
import { toast } from "sonner"
import { supabase } from "../utils/supabase/client"
import { useAuth } from "../contexts/AuthContext"
import { DecisionApprovalCard } from "../components/inbox/DecisionApprovalCard"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs"

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
    const { theme } = useTheme()
    const { t } = useTranslation('inbox')
    const [unassignedConversations, setUnassignedConversations] = useState<UnassignedConversation[]>([])
    const [agents, setAgents] = useState<Agent[]>([])
    const [selectedConversation, setSelectedConversation] = useState<UnassignedConversation | null>(null)
    const [selectedAgentId, setSelectedAgentId] = useState<string>("")
    const [isLoading, setIsLoading] = useState(false)
    const [isAssigning, setIsAssigning] = useState(false)
    const [pendingDecisions, setPendingDecisions] = useState<any[]>([])
    const [isLoadingDecisions, setIsLoadingDecisions] = useState(false)
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
            if (tab === 'decisions') {
                setActiveTab('decisions')
            }
        }

        // Também verifica query string tradicional (fallback)
        const urlParams = new URLSearchParams(window.location.search)
        const tab = urlParams.get('tab')
        if (tab === 'decisions') {
            setActiveTab('decisions')
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
                }
            )
            .subscribe((status) => {
                console.log('[Inbox] Status da subscription Realtime:', status)
            })

        // Polling como fallback (caso Realtime não funcione)
        const pollingInterval = setInterval(() => {
            loadUnassignedConversations()
        }, 10000) // Verifica a cada 10 segundos

        return () => {
            supabase.removeChannel(channel)
            clearInterval(pollingInterval)
        }
    }, [user?.email])

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
            // Atualizar a mensagem com agent_id
            const { error } = await supabase
                .from('tb_whatsapp_messages')
                .update({ agent_id: selectedAgentId })
                .eq('id', selectedConversation.message_id)

            if (error) {
                console.error("[Inbox] Erro ao atribuir agente:", error)
                toast.error(t('errors.assignAgent'))
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

    const formatTime = (iso: string) => {
        if (!iso) return ""
        const date = new Date(iso)
        const now = new Date()
        const diff = Math.floor((now.getTime() - date.getTime()) / 1000)

        if (diff < 60) return `${diff}${t('time.secondsAgo')}`
        if (diff < 3600) return `${Math.floor(diff / 60)}${t('time.minutesAgo')}`
        if (diff < 86400) return `${Math.floor(diff / 3600)}${t('time.hoursAgo')}`
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
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

    // Função para gerar iniciais do contato
    const getInitials = (contactId: string) => {
        const name = formatPhoneNumber(contactId)
        if (name === t('contact.noAgent') || name === t('contact.unknown')) {
            return "?"
        }
        // Pega as primeiras letras (máximo 2)
        const words = name.split(' ').filter(w => w.length > 0)
        if (words.length >= 2) {
            return (words[0][0] + words[1][0]).toUpperCase()
        }
        return name.substring(0, 2).toUpperCase()
    }

    // Função para gerar cor do avatar baseada no nome
    const getAvatarColor = (contactId: string) => {
        const colors = [
            { bg: '#3b82f6', text: '#ffffff' }, // blue-500
            { bg: '#8b5cf6', text: '#ffffff' }, // purple-500
            { bg: '#ec4899', text: '#ffffff' }, // pink-500
            { bg: '#f59e0b', text: '#ffffff' }, // amber-500
            { bg: '#10b981', text: '#ffffff' }, // emerald-500
            { bg: '#06b6d4', text: '#ffffff' }, // cyan-500
            { bg: '#ef4444', text: '#ffffff' }, // red-500
            { bg: '#6366f1', text: '#ffffff' }, // indigo-500
        ]
        // Gera um índice baseado no hash do nome
        let hash = 0
        const name = formatPhoneNumber(contactId)
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash)
        }
        return colors[Math.abs(hash) % colors.length]
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

    // Verificar se há leads aguardando para mostrar vignette
    const hasPendingLeads = unassignedConversations.length > 0

    return (
        // FUNDO: Azul Gelo Premium com Vignette Vermelho quando há leads aguardando
        <div className="flex flex-col min-h-screen bg-[#F0F5FA] -m-4 p-8 animate-in fade-in duration-500 font-sans relative">
            {/* VIGNETTE VERMELHO quando há leads aguardando */}
            {hasPendingLeads && (
                <div 
                    className="fixed inset-0 pointer-events-none z-0 transition-opacity duration-500"
                    style={{
                        background: 'radial-gradient(circle at center, transparent 0%, rgba(239, 68, 68, 0.08) 50%, rgba(239, 68, 68, 0.15) 100%)',
                        opacity: hasPendingLeads ? 1 : 0
                    }}
                />
            )}

            <div className="max-w-[1550px] mx-auto w-full flex-1 flex flex-col min-h-[850px] bg-white rounded-[3.5rem] shadow-[0_30px_90px_rgba(0,0,0,0.04)] overflow-hidden border-[6px] border-white relative z-10">

                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">

                    {/* BARRA DE ABAS - CORES VIBRANTES */}
                    <div className={`px-12 pt-10 pb-6 border-b-2 ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-50'}`}>
                        <TabsList className="bg-slate-100 p-1.5 rounded-full flex w-fit border-none shadow-inner outline-none">
                            <TabsTrigger
                                value="unassigned"
                                style={{ 
                                    backgroundColor: activeTab === 'unassigned' ? '#ef4444' : 'transparent',
                                    color: activeTab === 'unassigned' ? '#ffffff' : '#475569'
                                }}
                                className={`rounded-full font-black text-[11px] uppercase tracking-wider px-8 h-11 transition-all border-none outline-none ring-0 flex items-center gap-1.5
                                    ${activeTab === "unassigned" ? "!text-white shadow-lg shadow-red-200" : "hover:text-red-500"}`}
                            >
                                <AlertCircle 
                                    size={15} 
                                    strokeWidth={3} 
                                    style={{ color: activeTab === 'unassigned' ? '#ffffff' : '#475569' }} 
                                />
                                <span style={{ color: activeTab === 'unassigned' ? '#ffffff' : '#475569' }}>
                                    {t('tabs.stuckMessages')}
                                </span>
                                {unassignedConversations.length > 0 && (
                                    <span className="ml-0.5 px-2 py-0.5 rounded-md text-[10px] font-black bg-white/20 text-white">
                                        {unassignedConversations.length}
                                    </span>
                                )}
                            </TabsTrigger>

                            <TabsTrigger
                                value="decisions"
                                style={{ 
                                    backgroundColor: activeTab === 'decisions' ? '#2563eb' : 'transparent',
                                    color: activeTab === 'decisions' ? '#ffffff' : '#475569'
                                }}
                                className={`rounded-full font-black text-[11px] uppercase tracking-wider px-8 h-11 transition-all border-none outline-none ring-0 flex items-center gap-1.5
                                    ${activeTab === "decisions" ? "!text-white shadow-lg shadow-blue-200" : "hover:text-blue-600"}`}
                            >
                                <CheckCircle2 
                                    size={15} 
                                    strokeWidth={3} 
                                    style={{ color: activeTab === 'decisions' ? '#ffffff' : '#475569' }} 
                                />
                                <span style={{ color: activeTab === 'decisions' ? '#ffffff' : '#475569' }}>
                                    {t('tabs.approvals')}
                                </span>
                                {pendingDecisions.length > 0 && (
                                    <span className="ml-0.5 px-2 py-0.5 rounded-md text-[10px] font-black bg-white/20 text-white">
                                        {pendingDecisions.length}
                                    </span>
                                )}
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="unassigned" className="flex-1 flex overflow-hidden m-0">
                        <div className="flex h-full w-full">

                            {/* SIDEBAR: FILA DE PRIORIDADE */}
                            <div className={`w-[420px] flex flex-col ${theme === 'dark' ? 'bg-slate-900' : 'bg-[#F9FBFE]'}`} style={{ borderRight: theme === 'dark' ? '1px solid #334155' : '1px solid #e2e8f0' }}>
                                <div className="p-8 space-y-5">
                                    <div className="flex items-center justify-between">
                                        <h2 className="font-black text-[11px] uppercase tracking-[0.2em] flex items-center gap-2" style={{ color: '#06b6d4' }}>
                                            <div className="h-2 w-2 rounded-full animate-pulse" style={{ backgroundColor: '#06b6d4' }} />
                                            {t('header.title')}
                                        </h2>
                                        <div className="flex items-center gap-2">
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
                                                className="rounded-full hover:bg-blue-50"
                                                title={notificationPermission === 'granted' ? 'Notificações ativas' : 'Ativar notificações'}
                                            >
                                                <Bell 
                                                    size={16} 
                                                    className={`text-blue-400 ${notificationPermission === 'granted' ? 'fill-blue-400' : ''}`} 
                                                />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={loadUnassignedConversations} className="rounded-full hover:bg-blue-50">
                                                <RefreshCw size={16} className={`text-blue-400 ${isLoading ? 'animate-spin' : ''}`} />
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="relative">
                                        <Input 
                                            placeholder={t('search.placeholder')} 
                                            className="h-14 border-2 shadow-sm text-sm font-medium transition-all" 
                                            style={{
                                                backgroundColor: theme === 'dark' ? '#0f172a' : '#F9FBFE',
                                                borderColor: '#06b6d4',
                                                borderRadius: '2rem',
                                                color: theme === 'dark' ? '#f1f5f9' : '#0f172a'
                                            }}
                                            onFocus={(e) => {
                                                e.target.style.borderColor = '#22d3ee'
                                                e.target.style.boxShadow = '0 0 0 3px rgba(6, 182, 212, 0.1)'
                                            }}
                                            onBlur={(e) => {
                                                e.target.style.borderColor = '#06b6d4'
                                                e.target.style.boxShadow = 'none'
                                            }}
                                        />
                                    </div>
                                </div>

                                <ScrollArea className="flex-1 px-6">
                                    <div className="space-y-4 pb-10">
                                        {isLoading ? (
                                            <div className="p-8 text-center text-slate-400">
                                                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 opacity-50" />
                                                <p className="text-[10px] font-black uppercase tracking-widest">{t('loading')}</p>
                                            </div>
                                        ) : unassignedConversations.length === 0 ? (
                                            <div className="p-12 text-center text-slate-300">
                                                <CheckCircle2 size={40} className="mx-auto mb-4 opacity-20" />
                                                <p className="text-[10px] font-black uppercase tracking-[0.2em]">{t('empty.queue')}</p>
                                            </div>
                                        ) : (
                                            unassignedConversations.map(conv => {
                                                const isSelected = selectedConversation?.message_id === conv.message_id
                                                const snippet = conv.last_message ? (conv.last_message.length > 50 ? conv.last_message.substring(0, 50) + '...' : conv.last_message) : t('message.sent')
                                                
                                                return (
                                                    <button
                                                        key={conv.message_id}
                                                        onClick={() => setSelectedConversation(conv)}
                                                        className={`w-full flex items-center gap-5 p-5 rounded-[2.2rem] text-left transition-all group relative
                                                            ${isSelected
                                                                ? "shadow-2xl scale-[1.02] z-10"
                                                                : "hover:shadow-xl"
                                                            } ${!isSelected && (theme === 'dark' ? 'bg-slate-800' : 'bg-white')}`}
                                                        style={isSelected ? {
                                                            backgroundColor: '#d1fae5', // verde pastel (emerald-100)
                                                            borderLeft: '4px solid #06b6d4',
                                                            boxShadow: '0 20px 25px -5px rgba(6, 182, 212, 0.2), 0 10px 10px -5px rgba(6, 182, 212, 0.1)'
                                                        } : {
                                                            borderLeft: '4px solid transparent'
                                                        }}
                                                    >
                                                        {/* AVATAR COM ÍCONE DE USER E COR CIANO */}
                                                        <div 
                                                            className="h-14 w-14 rounded-2xl shrink-0 shadow-md flex items-center justify-center"
                                                            style={{ 
                                                                backgroundColor: '#06b6d4', // cyan-500
                                                            }}
                                                        >
                                                            <User size={28} className="text-white" strokeWidth={2.5} />
                                                        </div>
                                                        
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between gap-2 mb-1.5">
                                                                <p className={`font-black text-[14px] truncate leading-none ${isSelected ? 'text-black' : (theme === 'dark' ? 'text-slate-100' : 'text-slate-800')}`}>
                                                                    {formatPhoneNumber(conv.whatsapp_contact_id)}
                                                                </p>
                                                                {conv.last_message_at && (
                                                                    <span className={`text-[10px] font-bold whitespace-nowrap shrink-0 ${isSelected ? 'text-slate-700' : (theme === 'dark' ? 'text-slate-400' : 'text-slate-400')}`}>
                                                                        {formatRelativeTime(conv.last_message_at)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className={`text-[12px] font-medium line-clamp-2 leading-snug ${isSelected ? 'text-slate-800' : (theme === 'dark' ? 'text-slate-300' : 'text-slate-500')}`}>
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

                            {/* CONTEÚDO: CORREÇÃO DE CORES E TEXTO */}
                            <div className={`flex-1 flex flex-col ${theme === 'dark' ? 'bg-slate-900' : 'bg-slate-50'}`}>
                                {selectedConversation ? (
                                    <ScrollArea className="flex-1">
                                        <div className="p-14 max-w-4xl mx-auto space-y-10 animate-in slide-in-from-bottom-4 duration-500">

                                            {/* HEADER BOX - GRADIENTE AZUL->CIANO COM TEXTO BRANCO E STATUS VERMELHO COM BLUR */}
                                            <div 
                                                className="p-10 rounded-2xl shadow-2xl flex items-center relative overflow-hidden text-white shrink-0"
                                                style={{
                                                    background: 'linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)',
                                                    gap: '2.5rem'
                                                }}
                                            >
                                                <div className="h-24 w-24 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border-4 border-white/30 shrink-0 shadow-2xl">
                                                    <Bot size={48} className="text-white" strokeWidth={2.5} />
                                                </div>
                                                <div className="flex-1 min-w-0 pt-1" style={{ paddingLeft: '16px' }}>
                                                    <h3 className="font-black text-3xl tracking-tight leading-none mb-3 text-white">{t('lead.waiting')}</h3>
                                                    <p className="text-white font-bold text-xs uppercase tracking-[0.2em] opacity-90">{t('lead.manualIntervention')}</p>
                                                </div>
                                                {/* STATUS CRÍTICO COM BLUR E GLOW PULSANTE */}
                                                <div className="relative">
                                                    {/* BLUR BACKGROUND */}
                                                    <div 
                                                        className="absolute inset-0 rounded-full blur-xl"
                                                        style={{
                                                            backgroundColor: 'rgba(239, 68, 68, 0.4)',
                                                            animation: 'pulse-glow-blur 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                                                        }}
                                                    />
                                                    {/* BADGE */}
                                                    <div 
                                                        className="relative text-white font-black text-[10px] uppercase px-6 py-3 rounded-full border-2 border-red-400"
                                                        style={{
                                                            backgroundColor: '#ef4444',
                                                            boxShadow: '0 0 20px rgba(239, 68, 68, 0.6), 0 0 40px rgba(239, 68, 68, 0.4)',
                                                            animation: 'pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                                                        }}
                                                    >
                                                        {t('status.critical')}
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* CSS para animações de glow pulsante */}
                                            <style>{`
                                                @keyframes pulse-glow {
                                                    0%, 100% {
                                                        box-shadow: 0 0 20px rgba(239, 68, 68, 0.6), 0 0 40px rgba(239, 68, 68, 0.4);
                                                    }
                                                    50% {
                                                        box-shadow: 0 0 30px rgba(239, 68, 68, 0.8), 0 0 60px rgba(239, 68, 68, 0.6);
                                                    }
                                                }
                                                @keyframes pulse-glow-blur {
                                                    0%, 100% {
                                                        opacity: 0.4;
                                                        transform: scale(1);
                                                    }
                                                    50% {
                                                        opacity: 0.6;
                                                        transform: scale(1.1);
                                                    }
                                                }
                                            `}</style>

                                            {/* MENSAGEM - BALÃO DE CHAT ESTILO WHATSAPP */}
                                            <div className="space-y-4 px-4">
                                                <p className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400 text-center">{t('message.content')}</p>
                                                {selectedConversation.last_message && !selectedConversation.last_message.toLowerCase().includes('imagem sem legenda') && !selectedConversation.last_message.toLowerCase().includes('arquivo') ? (
                                                    <div className="flex justify-start">
                                                        <div className="max-w-[80%] relative">
                                                            {/* BALÃO DE CHAT */}
                                                            <div className="bg-white rounded-2xl rounded-tl-sm p-5 shadow-lg border border-slate-200">
                                                                <p className="text-slate-900 font-medium text-base leading-relaxed">
                                                                    {selectedConversation.last_message}
                                                                </p>
                                                            </div>
                                                            {/* CAUDA DO BALÃO */}
                                                            <div className="absolute -left-2 top-0 w-4 h-4 bg-white border-l border-b border-slate-200 transform rotate-45" style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }} />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex justify-start">
                                                        <div className="max-w-[80%] relative">
                                                            <div 
                                                                className="rounded-2xl rounded-tl-sm p-5 shadow-lg flex items-center gap-3"
                                                                style={{ 
                                                                    backgroundColor: '#d1fae5', // emerald-100 (verde pastel)
                                                                    border: '1px solid #a7f3d0',
                                                                    borderColor: '#a7f3d0'
                                                                }}
                                                            >
                                                                <ImageIcon size={24} style={{ color: '#059669' }} />
                                                                <p className="font-medium text-base" style={{ color: '#064e3b' }}>
                                                                    {t('message.fileSent')}
                                                                </p>
                                                            </div>
                                                            <div 
                                                                className="absolute -left-2 top-0 w-4 h-4 transform rotate-45" 
                                                                style={{ 
                                                                    backgroundColor: '#d1fae5',
                                                                    borderLeft: '1px solid #a7f3d0',
                                                                    borderBottom: '1px solid #a7f3d0',
                                                                    clipPath: 'polygon(0 0, 100% 0, 0 100%)'
                                                                }} 
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* BOX DE AÇÃO - PREMIUM COM GRADIENTE CIANO */}
                                            <div className={`p-12 rounded-3xl border-2 shadow-xl ${theme === 'dark' ? 'bg-slate-800 border-cyan-900' : 'bg-slate-100 border-cyan-100'}`}>
                                                <div className="flex items-start gap-6 justify-center mb-10">
                                                    <div className="h-14 w-14 rounded-2xl flex items-center justify-center text-white shadow-xl shrink-0" style={{ 
                                                        background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                                                        marginTop: '-8px'
                                                    }}>
                                                        <Wrench size={28} strokeWidth={3} />
                                                    </div>
                                                    <h4 className={`font-black text-2xl tracking-tight ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`} style={{ marginTop: '-8px' }}>{t('action.resolveContact')}</h4>
                                                </div>

                                                <div className="space-y-6 max-w-xl mx-auto" style={{ marginTop: '12px' }}>
                                                    {/* SELETOR PREMIUM COM ÍCONES */}
                                                    <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                                                        <SelectTrigger className="h-16 bg-white border-2 border-cyan-200 rounded-2xl text-slate-800 font-black text-lg focus:ring-cyan-500 focus:border-cyan-500 shadow-md px-8 transition-all hover:border-cyan-300">
                                                            <div className="flex items-center gap-3 w-full">
                                                                <Bot size={20} className="text-cyan-500 shrink-0" />
                                                                <SelectValue placeholder={t('select.agentPlaceholder')} />
                                                            </div>
                                                        </SelectTrigger>
                                                        <SelectContent className="rounded-2xl border-2 border-cyan-100 shadow-2xl p-2 bg-white">
                                                            {agents.map((agent, index) => {
                                                                // Cores pastéis variadas
                                                                const pastelColors = [
                                                                    { bg: '#fef3c7', border: '#fde68a' }, // yellow-100/200
                                                                    { bg: '#fce7f3', border: '#fbcfe8' }, // pink-100/200
                                                                    { bg: '#e0e7ff', border: '#c7d2fe' }, // indigo-100/200
                                                                    { bg: '#dbeafe', border: '#bfdbfe' }, // blue-100/200
                                                                    { bg: '#d1fae5', border: '#a7f3d0' }, // emerald-100/200
                                                                    { bg: '#f3e8ff', border: '#e9d5ff' }, // purple-100/200
                                                                ]
                                                                const color = pastelColors[index % pastelColors.length]
                                                                
                                                                return (
                                                                    <SelectItem 
                                                                        key={agent.id} 
                                                                        value={agent.id} 
                                                                        className="py-4 rounded-xl focus:bg-cyan-50 cursor-pointer border-b border-black/20 last:border-b-0"
                                                                        style={{
                                                                            backgroundColor: color.bg,
                                                                            borderColor: color.border
                                                                        }}
                                                                    >
                                                                        <span className="font-black text-black" style={{ color: '#000000', fontWeight: 900 }}>
                                                                            {agent.nome}
                                                                        </span>
                                                                    </SelectItem>
                                                                )
                                                            })}
                                                        </SelectContent>
                                                    </Select>

                                                    {/* BOTÃO COM GRADIENTE CIANO E ÍCONE DE RELÂMPAGO */}
                                                    <Button
                                                        onClick={handleAssignAgent}
                                                        disabled={!selectedAgentId || isAssigning}
                                                        className="w-full h-20 rounded-2xl font-black text-xl uppercase tracking-[0.2em] shadow-2xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-4 border-none hover:scale-105"
                                                        style={{
                                                            background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                                                            boxShadow: '0 20px 25px -5px rgba(6, 182, 212, 0.4), 0 10px 10px -5px rgba(6, 182, 212, 0.2)',
                                                            color: '#000000'
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.boxShadow = '0 25px 30px -5px rgba(6, 182, 212, 0.6), 0 15px 15px -5px rgba(6, 182, 212, 0.4)'
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(6, 182, 212, 0.4), 0 10px 10px -5px rgba(6, 182, 212, 0.2)'
                                                        }}
                                                    >
                                                        {isAssigning ? (
                                                            <RefreshCw className="animate-spin" size={28} style={{ color: '#000000' }} />
                                                        ) : (
                                                            <>
                                                                <Zap size={28} strokeWidth={3} className="shrink-0" style={{ color: '#000000' }} />
                                                                <span style={{ color: '#000000' }}>{t('button.activateAgent')}</span>
                                                            </>
                                                        )}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </ScrollArea>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center p-20 opacity-50">
                                        <div className="h-44 w-44 rounded-[4.5rem] bg-blue-50 shadow-inner flex items-center justify-center mb-10 border-4 border-white relative">
                                            <MessageSquare size={64} className="text-blue-300" strokeWidth={2.5} />
                                        </div>
                                        <h4 className="text-2xl font-black text-slate-400 uppercase tracking-[0.4em]">{t('empty.queue')}</h4>
                                    </div>
                                )}
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="decisions" className="flex-1 overflow-auto m-0 p-8" style={{ backgroundColor: theme === 'dark' ? '#0a1628' : '#f8fafc' }}>
                        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h2 className="text-2xl font-black tracking-tight" style={{ color: theme === 'dark' ? '#f1f5f9' : '#0f172a' }}>{t('decisions.title')}</h2>
                                    <p className="text-sm font-medium mt-1 uppercase tracking-tight" style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b' }}>
                                        {t('decisions.subtitle')}
                                    </p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={loadPendingDecisions}
                                    disabled={isLoadingDecisions}
                                    className={`rounded-full h-10 w-10 ${theme === 'dark' ? 'hover:bg-white/10 border border-white/10' : 'hover:bg-slate-200 border border-slate-300'}`}
                                >
                                    <RefreshCw className={`h-4 w-4 ${isLoadingDecisions ? 'animate-spin' : ''}`} style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b' }} />
                                </Button>
                            </div>

                            {isLoadingDecisions ? (
                                <div className="flex flex-col items-center justify-center py-24 gap-4">
                                    <RefreshCw className="h-10 w-10 animate-spin" style={{ color: '#06b6d4', opacity: 0.3 }} />
                                    <p className="text-xs font-black uppercase tracking-widest" style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b' }}>{t('decisions.syncing')}</p>
                                </div>
                            ) : pendingDecisions.length === 0 ? (
                                <div className="text-center py-24 rounded-3xl border-2 border-dashed shadow-sm" style={{ backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff', borderColor: theme === 'dark' ? '#334155' : '#e2e8f0' }}>
                                    <CheckCircle2 className="h-16 w-16 mx-auto mb-6" style={{ color: '#10b981', opacity: 0.3 }} />
                                    <p className="font-black uppercase tracking-tight" style={{ color: theme === 'dark' ? '#f1f5f9' : '#0f172a' }}>{t('decisions.allProcessed')}</p>
                                    <p className="text-sm font-medium" style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b' }}>{t('decisions.allProcessedDescription')}</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {pendingDecisions.map((decision) => (
                                        <div key={decision.id} className="transition-transform hover:scale-[1.01] active:scale-[0.99]">
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
    )
}
