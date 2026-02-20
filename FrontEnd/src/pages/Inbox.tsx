import { useEffect, useState, useRef } from "react"
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
    RefreshCw
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
    const [unassignedConversations, setUnassignedConversations] = useState<UnassignedConversation[]>([])
    const [agents, setAgents] = useState<Agent[]>([])
    const [selectedConversation, setSelectedConversation] = useState<UnassignedConversation | null>(null)
    const [selectedAgentId, setSelectedAgentId] = useState<string>("")
    const [isLoading, setIsLoading] = useState(false)
    const [isAssigning, setIsAssigning] = useState(false)
    const [pendingDecisions, setPendingDecisions] = useState<any[]>([])
    const [isLoadingDecisions, setIsLoadingDecisions] = useState(false)

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

    // Carregar conversas não atribuídas e agentes (apenas uma vez ao montar)
    useEffect(() => {
        if (user?.email || user?.id) {
            loadUnassignedConversations()
            loadAgents()
            loadPendingDecisions()
        }
    }, [user])

    const loadUnassignedConversations = async () => {
        if (!user?.email) return

        try {
            setIsLoading(true)
            const { data, error } = await supabase.rpc('sp_list_unassigned_whatsapp_conversations', {
                p_email: user.email
            })

            if (error) {
                console.error("[Inbox] Erro ao buscar conversas não atribuídas:", error)
                toast.error("Erro ao carregar conversas")
                return
            }

            if (data) {
                setUnassignedConversations(Array.isArray(data) ? data : [data])
            }
        } catch (error: any) {
            console.error("[Inbox] Erro:", error)
            toast.error("Erro ao carregar conversas")
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
            toast.error("Selecione um agente para atribuir")
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
                toast.error("Erro ao atribuir agente")
                return
            }

            toast.success("Agente atribuído com sucesso!")

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
            toast.error("Erro ao atribuir agente")
        } finally {
            setIsAssigning(false)
        }
    }

    const formatTime = (iso: string) => {
        if (!iso) return ""
        const date = new Date(iso)
        const now = new Date()
        const diff = Math.floor((now.getTime() - date.getTime()) / 1000)

        if (diff < 60) return `${diff}s atrás`
        if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`
        if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`
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
                toast.error("Erro ao carregar aprovações pendentes")
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
            return "Falta de agente"
        }

        // Se parecer com número de telefone, retorna formatado
        if (/^\d+$/.test(cleaned) && cleaned.length >= 10) {
            return cleaned
        }

        // Caso contrário, retorna o texto limpo
        return cleaned || "Contato desconhecido"
    }

    return (
        // FUNDO: Azul Gelo Premium
        <div className="flex flex-col min-h-screen bg-[#F0F5FA] -m-4 p-8 animate-in fade-in duration-500 font-sans">

            <div className="max-w-[1550px] mx-auto w-full flex-1 flex flex-col min-h-[850px] bg-white rounded-[3.5rem] shadow-[0_30px_90px_rgba(0,0,0,0.04)] overflow-hidden border-[6px] border-white">

                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">

                    {/* BARRA DE ABAS - CORES VIBRANTES */}
                    <div className="px-12 pt-10 pb-6 bg-white border-b-2 border-slate-50">
                        <TabsList className="bg-slate-100 p-1.5 rounded-full flex w-fit border-none shadow-inner outline-none">
                            <TabsTrigger
                                value="unassigned"
                                style={{ backgroundColor: activeTab === 'unassigned' ? '#ef4444' : 'transparent' }}
                                className={`rounded-full font-black text-[11px] uppercase tracking-wider px-8 h-11 transition-all border-none outline-none ring-0 flex items-center gap-1.5
                                    ${activeTab === "unassigned" ? "!text-white shadow-lg shadow-red-200" : "text-slate-400 hover:text-red-500"}`}
                            >
                                <AlertCircle size={15} strokeWidth={3} />
                                <span>Mensagens Travadas</span>
                                {unassignedConversations.length > 0 && (
                                    <span className="ml-0.5 px-2 py-0.5 rounded-md text-[10px] font-black bg-white/20 text-white">
                                        {unassignedConversations.length}
                                    </span>
                                )}
                            </TabsTrigger>

                            <TabsTrigger
                                value="decisions"
                                style={{ backgroundColor: activeTab === 'decisions' ? '#2563eb' : 'transparent' }}
                                className={`rounded-full font-black text-[11px] uppercase tracking-wider px-8 h-11 transition-all border-none outline-none ring-0 flex items-center gap-1.5
                                    ${activeTab === "decisions" ? "!text-white shadow-lg shadow-blue-200" : "text-slate-400 hover:text-blue-600"}`}
                            >
                                <CheckCircle2 size={15} strokeWidth={3} />
                                <span>Aprovações</span>
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
                            <div className="w-[420px] border-r-2 border-slate-50 bg-[#F9FBFE] flex flex-col">
                                <div className="p-8 space-y-5">
                                    <div className="flex items-center justify-between">
                                        <h2 className="font-black text-[11px] uppercase tracking-[0.2em] text-blue-600 flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                                            Inbox SONIA
                                        </h2>
                                        <Button variant="ghost" size="icon" onClick={loadUnassignedConversations} className="rounded-full hover:bg-blue-50">
                                            <RefreshCw size={16} className={`text-blue-400 ${isLoading ? 'animate-spin' : ''}`} />
                                        </Button>
                                    </div>
                                    <div className="relative">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                                        <Input placeholder="Localizar lead..." className="pl-12 h-14 bg-white border-2 border-slate-100 shadow-sm rounded-2xl text-sm font-medium focus:border-blue-300 transition-all" />
                                    </div>
                                </div>

                                <ScrollArea className="flex-1 px-6">
                                    <div className="space-y-4 pb-10">
                                        {isLoading ? (
                                            <div className="p-8 text-center text-slate-400">
                                                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 opacity-50" />
                                                <p className="text-[10px] font-black uppercase tracking-widest">Carregando...</p>
                                            </div>
                                        ) : unassignedConversations.length === 0 ? (
                                            <div className="p-12 text-center text-slate-300">
                                                <CheckCircle2 size={40} className="mx-auto mb-4 opacity-20" />
                                                <p className="text-[10px] font-black uppercase tracking-[0.2em]">Fila Limpa</p>
                                            </div>
                                        ) : (
                                            unassignedConversations.map(conv => (
                                                <button
                                                    key={conv.message_id}
                                                    onClick={() => setSelectedConversation(conv)}
                                                    className={`w-full flex items-center gap-6 p-6 rounded-[2.2rem] text-left transition-all group relative
                                                        ${selectedConversation?.message_id === conv.message_id
                                                            ? "bg-white shadow-2xl ring-4 ring-blue-50 scale-[1.02] z-10"
                                                            : "hover:bg-white hover:shadow-xl border border-transparent"
                                                        }`}
                                                >
                                                    <div className="h-14 w-14 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600 shadow-sm shrink-0">
                                                        <User size={26} strokeWidth={2.5} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-black text-slate-800 text-[14px] truncate leading-none mb-1.5">
                                                            {formatPhoneNumber(conv.whatsapp_contact_id)}
                                                        </p>
                                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-tighter truncate">
                                                            {conv.last_message || "Mensagem enviada"}
                                                        </p>
                                                    </div>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </ScrollArea>
                            </div>

                            {/* CONTEÚDO: CORREÇÃO DE CORES E TEXTO */}
                            <div className="flex-1 flex flex-col bg-white">
                                {selectedConversation ? (
                                    <ScrollArea className="flex-1">
                                        <div className="p-14 max-w-4xl mx-auto space-y-10 animate-in slide-in-from-bottom-4 duration-500">

                                            {/* HEADER BOX - AZUL COM TEXTO BRANCO E STATUS VERMELHO PISCANDO */}
                                            <div className="p-10 rounded-[3.5rem] shadow-2xl flex items-center gap-10 relative overflow-hidden text-white shrink-0" style={{ backgroundColor: '#2563eb' }}>
                                                <div className="h-24 w-24 rounded-[2rem] bg-white/20 backdrop-blur-md flex items-center justify-center border-4 border-white/30 shrink-0 shadow-2xl">
                                                    <Bot size={48} className="text-white" strokeWidth={2.5} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-black text-3xl tracking-tight leading-none mb-2 text-white">Lead Aguardando</h3>
                                                    <p className="text-white font-bold text-xs uppercase tracking-[0.2em] opacity-90">Intervenção manual necessária agora</p>
                                                </div>
                                                {/* STATUS CRÍTICO PISCANDO EM VERMELHO */}
                                                <div className="bg-red-500 text-white font-black text-[10px] uppercase px-6 py-2.5 rounded-full shadow-xl shadow-red-500/40 animate-pulse border-2 border-red-400">
                                                    Status: Crítico
                                                </div>
                                            </div>

                                            {/* MENSAGEM */}
                                            <div className="space-y-4 px-4 text-center">
                                                <p className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-300">Conteúdo da Mensagem</p>
                                                <div className="p-12 rounded-[4rem] bg-[#F8FAFC] border-4 border-white shadow-xl italic">
                                                    <p className="text-slate-800 font-black text-3xl leading-tight">
                                                        "{selectedConversation.last_message || "Arquivo ou anexo enviado."}"
                                                    </p>
                                                </div>
                                            </div>

                                            {/* BOX DE AÇÃO - DIDÁTICO */}
                                            <div className="p-12 rounded-[4.5rem] border-4 border-blue-100 shadow-sm" style={{ backgroundColor: '#F0F7FF' }}>
                                                <div className="flex items-center gap-6 justify-center mb-10">
                                                    <div className="h-14 w-14 rounded-2xl flex items-center justify-center text-white shadow-xl" style={{ backgroundColor: '#2563eb' }}>
                                                        <Wrench size={28} strokeWidth={3} />
                                                    </div>
                                                    <h4 className="font-black text-2xl text-[#1e40af] tracking-tight">Resolver este contato</h4>
                                                </div>

                                                <div className="space-y-6 max-w-xl mx-auto text-center">
                                                    <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                                                        <SelectTrigger className="h-16 bg-white border-2 border-blue-200 rounded-[2rem] text-slate-800 font-black text-lg focus:ring-blue-500 shadow-sm px-8 transition-all">
                                                            <SelectValue placeholder="Escolher agente responsável..." />
                                                        </SelectTrigger>
                                                        <SelectContent className="rounded-[2rem] border-none shadow-2xl p-2 bg-white">
                                                            {agents.map(agent => (
                                                                <SelectItem key={agent.id} value={agent.id} className="py-4 rounded-2xl focus:bg-blue-50 cursor-pointer">
                                                                    <div className="flex items-center gap-3 font-black text-slate-700">
                                                                        <div className="h-3 w-3 rounded-full bg-emerald-500" />
                                                                        {agent.nome}
                                                                    </div>
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>

                                                    <Button
                                                        onClick={handleAssignAgent}
                                                        disabled={!selectedAgentId || isAssigning}
                                                        className="w-full h-20 text-white rounded-[2.5rem] font-black text-xl uppercase tracking-[0.2em] shadow-2xl shadow-blue-600/30 transition-all active:scale-95 flex items-center justify-center gap-4"
                                                        style={{ backgroundColor: '#2563eb' }}
                                                    >
                                                        {isAssigning ? <RefreshCw className="animate-spin" size={28} /> : <PlayCircle size={30} strokeWidth={3} />}
                                                        ATIVAR AGENTE AGORA
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
                                        <h4 className="text-2xl font-black text-slate-400 uppercase tracking-[0.4em]">Fila Vazia</h4>
                                    </div>
                                )}
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="decisions" className="flex-1 overflow-auto m-0 p-8 bg-slate-50">
                        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">Aprovações Pendentes</h2>
                                    <p className="text-sm text-slate-400 font-medium mt-1 uppercase tracking-tight">
                                        Mensagens com baixa confiança aguardando seu aval
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={loadPendingDecisions}
                                    disabled={isLoadingDecisions}
                                    className="rounded-full font-black text-[10px] uppercase tracking-widest px-6 h-10 border-slate-200"
                                >
                                    <RefreshCw className={`h-3.5 w-3.5 mr-2 ${isLoadingDecisions ? 'animate-spin' : ''}`} />
                                    Sincronizar
                                </Button>
                            </div>

                            {isLoadingDecisions ? (
                                <div className="flex flex-col items-center justify-center py-24 gap-4">
                                    <RefreshCw className="h-10 w-10 animate-spin text-primary opacity-20" />
                                    <p className="text-xs font-black text-slate-300 uppercase tracking-widest">Sincronizando decisões...</p>
                                </div>
                            ) : pendingDecisions.length === 0 ? (
                                <div className="text-center py-24 bg-white rounded-3xl border-2 border-dashed border-slate-100 shadow-sm">
                                    <CheckCircle2 className="h-16 w-16 mx-auto mb-6 text-emerald-500 opacity-20" />
                                    <p className="font-black text-slate-700 uppercase tracking-tight">Operação em dia!</p>
                                    <p className="text-sm text-slate-400 font-medium">Todas as mensagens foram processadas com sucesso.</p>
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
