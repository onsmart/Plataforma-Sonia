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
        // Remove @lid ou @s.whatsapp.net se existir
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
        <div className="flex flex-col h-[calc(100vh-2rem)] border rounded-lg overflow-hidden bg-background shadow-sm">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                <div className="border-b px-6 pt-4">
                    <TabsList>
                        <TabsTrigger value="unassigned">
                            Mensagens Travadas
                            {unassignedConversations.length > 0 && (
                                <Badge variant="destructive" className="ml-2 h-4 px-1.5 text-[10px]">
                                    {unassignedConversations.length}
                                </Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="decisions">
                            Aprovações Pendentes
                            {pendingDecisions.length > 0 && (
                                <Badge variant="destructive" className="ml-2 h-4 px-1.5 text-[10px]">
                                    {pendingDecisions.length}
                                </Badge>
                            )}
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="unassigned" className="flex-1 flex overflow-hidden m-0">
                    <div className="flex h-full w-full">
                        {/* Sidebar List - Conversas Não Atribuídas */}
                        <div className="w-[420px] border-r bg-muted/10 flex flex-col">
                            <div className="p-6 border-b space-y-4">
                                <div className="flex items-center justify-between gap-4">
                                    <h2 className="font-semibold text-lg">Mensagens Travadas</h2>
                        <div className="flex items-center gap-3">
                            <Badge variant="destructive" className="h-5">
                                {unassignedConversations.length}
                            </Badge>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    loadUnassignedConversations()
                                    loadAgents()
                                }}
                                disabled={isLoading}
                                className="h-8 w-8 p-0"
                            >
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            </Button>
                        </div>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Buscar conversas..." className="pl-8 bg-background" />
                    </div>
                </div>
                <ScrollArea className="flex-1">
                    <div className="flex flex-col">
                        {isLoading ? (
                            <div className="p-8 text-center">
                                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
                                <p className="text-sm text-muted-foreground">Carregando...</p>
                            </div>
                        ) : unassignedConversations.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground text-sm">
                                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500 opacity-50" />
                                <p>Nenhuma conversa travada.</p>
                                <p className="text-xs mt-1">Todas as mensagens têm agente atribuído.</p>
                            </div>
                        ) : (
                            unassignedConversations.map(conv => (
                                <button
                                    key={conv.message_id}
                                    onClick={() => setSelectedConversation(conv)}
                                    className={`flex items-start gap-4 p-5 text-left border-b transition-colors hover:bg-muted/50 ${
                                        selectedConversation?.message_id === conv.message_id ? "bg-muted border-l-4 border-l-red-500" : ""
                                    }`}
                                >
                                    <Avatar className="bg-red-100 dark:bg-red-950">
                                        <AvatarFallback className="bg-red-500/10 text-red-600 dark:text-red-400">
                                            <AlertCircle className="h-4 w-4" />
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 overflow-hidden min-w-0">
                                        <div className="flex items-center justify-between mb-2 gap-3">
                                            <span className="font-medium truncate text-sm">
                                                {formatPhoneNumber(conv.whatsapp_contact_id)}
                                            </span>
                                            <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                                                {formatTime(conv.last_message_at)}
                                            </span>
                                        </div>
                                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                            {conv.last_message || "Sem mensagem"}
                                        </p>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </ScrollArea>
            </div>

            {/* Detalhes e Atribuição */}
            <div className="flex-1 flex flex-col bg-background">
                {selectedConversation ? (
                    <div className="flex-1 flex flex-col p-6">
                        <div className="space-y-6 max-w-2xl mx-auto w-full">
                            {/* Header */}
                            <div className="space-y-2">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-12 w-12 bg-red-100 dark:bg-red-950">
                                        <AvatarFallback className="bg-red-500/10 text-red-600 dark:text-red-400">
                                            <Phone className="h-6 w-6" />
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <h3 className="font-semibold text-lg">
                                            {formatPhoneNumber(selectedConversation.whatsapp_contact_id)}
                                        </h3>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Clock className="h-4 w-4" />
                                            <span>Última mensagem: {formatTime(selectedConversation.last_message_at)}</span>
                                        </div>
                                        {formatPhoneNumber(selectedConversation.whatsapp_contact_id) === "Falta de agente" && (
                                            <Badge variant="destructive" className="mt-2 text-xs">
                                                Sem agente atribuído
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Última Mensagem */}
                            <div className="border rounded-lg p-4 bg-muted/30">
                                <div className="flex items-start gap-3">
                                    <MessageCircle className="h-5 w-5 text-emerald-500 mt-0.5" />
                                    <div className="flex-1">
                                        <p className="text-sm font-medium mb-1">Última Mensagem Recebida</p>
                                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                            {selectedConversation.last_message || "Sem conteúdo"}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Seleção de Agente */}
                            <div className="border rounded-lg p-4 space-y-4">
                                <div className="flex items-center gap-2">
                                    <Wrench className="h-5 w-5 text-primary" />
                                    <h4 className="font-semibold">Atribuir Agente</h4>
                                </div>
                                
                                {agents.length === 0 ? (
                                    <div className="text-center py-6 text-muted-foreground">
                                        <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                        <p className="text-sm">Nenhum agente disponível.</p>
                                        <p className="text-xs mt-1">Crie um agente primeiro.</p>
                                    </div>
                                ) : (
                                    <>
                                        <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecione um agente..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {agents.map(agent => (
                                                    <SelectItem key={agent.id} value={agent.id}>
                                                        {agent.nome}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        
                                        <Button
                                            onClick={handleAssignAgent}
                                            disabled={!selectedAgentId || isAssigning}
                                            className="w-full"
                                            size="lg"
                                        >
                                            {isAssigning ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                    Atribuindo...
                                                </>
                                            ) : (
                                                <>
                                                    <Check className="h-4 w-4 mr-2" />
                                                    Atribuir Agente
                                                </>
                                            )}
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-20" />
                            <p>Selecione uma conversa para atribuir um agente.</p>
                        </div>
                    </div>
                )}
            </div>
                    </div>
                </TabsContent>

                <TabsContent value="decisions" className="flex-1 overflow-auto m-0 p-6">
                    <div className="max-w-4xl mx-auto space-y-4">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-2xl font-bold">Aprovações Pendentes</h2>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Mensagens com baixa confiança aguardando sua aprovação
                                </p>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={loadPendingDecisions}
                                disabled={isLoadingDecisions}
                            >
                                <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingDecisions ? 'animate-spin' : ''}`} />
                                Atualizar
                            </Button>
                        </div>

                        {isLoadingDecisions ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : pendingDecisions.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50 text-emerald-500" />
                                <p className="font-medium">Nenhuma aprovação pendente</p>
                                <p className="text-sm mt-1">Todas as mensagens foram processadas.</p>
                            </div>
                        ) : (
                            pendingDecisions.map((decision) => (
                                <DecisionApprovalCard
                                    key={decision.id}
                                    decision={decision}
                                    onApproved={loadPendingDecisions}
                                    onRejected={loadPendingDecisions}
                                />
                            ))
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
