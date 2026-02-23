
import React, { useState, useEffect, useCallback, useRef } from "react"
import {
    MessageCircle,
    Mail,
    Phone,
    Globe,
    Users,
    Bot,
    Plus,
    MoreHorizontal,
    Play,
    Pause,
    Settings,
    MessageSquare,
    Linkedin,
    BarChart3,
    Loader2,
    Trash2,
    Check,
    User,
    Link as LinkIcon,
    ArrowRight,
    Sparkles,
    Cpu,
    Heart
} from "lucide-react"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs"
import { Badge } from "../components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar"
import { Separator } from "../components/ui/separator"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "../components/ui/dialog"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"
import { Textarea } from "../components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../components/ui/command"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui/accordion"
import { AgentService, Agent } from "../services/api"
import { supabase } from "../utils/supabase/client"
import { InfoTooltip } from "../components/ui/infoTooltip"
import { useAuth } from "../contexts/AuthContext"
import { useNavigation } from "../contexts/NavigationContext"
import { toast } from "sonner"

const channelsData = [
    { name: "WhatsApp Business", status: "connected", icon: MessageCircle, color: "text-emerald-500" },
    { name: "Web Widget", status: "connected", icon: MessageSquare, color: "text-blue-500" },
    { name: "Corporate Email", status: "connected", icon: Mail, color: "text-yellow-500" },
    { name: "LinkedIn Sales Nav", status: "partial", icon: Linkedin, color: "text-blue-700" },
    { name: "VoIP Telephony", status: "disconnected", icon: Phone, color: "text-red-500" }
]

const AVAILABLE_CHANNELS = [
    { id: "whatsapp", name: "WhatsApp", icon: MessageCircle },
    { id: "webchat", name: "Webchat", icon: MessageSquare },
    { id: "email", name: "Email", icon: Mail },
    { id: "linkedin", name: "LinkedIn", icon: Linkedin },
    { id: "phone", name: "Voice/VoIP", icon: Phone },
]

const SUPPORTED_LANGUAGES = [
    { code: "EN", name: "English" },
    { code: "PT", name: "Portuguese (BR/PT)" },
    { code: "ES", name: "Spanish" },
    { code: "FR", name: "French" },
    { code: "DE", name: "German" },
    { code: "ZH", name: "Chinese (Mandarin)" },
    { code: "JA", name: "Japanese" }
]

/* ---------------- ICON MAP ---------------- */
const TEMPLATE_ICON_MAP: Record<string, any> = {
    users: Users,
    "message-circle": MessageCircle,
    "bar-chart-3": BarChart3,
    settings: Settings,
    bot: Bot
}

const getTemplateIcon = (icon?: string) => {
    return TEMPLATE_ICON_MAP[icon ?? ""] ?? Bot
}

/* ---------------- TYPES ---------------- */
type AgentTemplate = {
    id: string
    name: string
    role: string
    description: string
    skills: string[]
    icon: string
    defaultChannels: string[]
    complexity: "Simple" | "Intermediate" | "Advanced"
    IconComponent?: any
}

interface Integration {
    id: string;
    phone_number: string | null;
    email: string | null;
    account_sid: string | null;
    smtp_host: string | null;
}

interface CRMIntegration {
    id: string;
    tb_crms: {
        id: string;
        name: string;
        slug: string;
    } | null;
}

export function AgentsHub() {
    const { userId, user } = useAuth()
    const { navigate } = useNavigation()

    const [agents, setAgents] = useState<Agent[]>([])
    const [templates, setTemplates] = useState<AgentTemplate[]>([])
    const [integrations, setIntegrations] = useState<Integration[]>([])
    const [crmIntegrations, setCrmIntegrations] = useState<CRMIntegration[]>([])

    const [loading, setLoading] = useState(true)
    const [templatesLoading, setTemplatesLoading] = useState(true)
    const [integrationsLoading, setIntegrationsLoading] = useState(false)
    const [crmIntegrationsLoading, setCrmIntegrationsLoading] = useState(false)

    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isCreateTemplateOpen, setIsCreateTemplateOpen] = useState(false)
    const [isSubmittingTemplate, setIsSubmittingTemplate] = useState(false)


    // New Agent Form State
    const [newAgent, setNewAgent] = useState({
        name: "",
        role: "",
        description: "",
        primaryLanguage: "EN",
        integrationId: "",
        crmIntegrationId: ""
    })

    // Limpar campos quando o modal abrir
    useEffect(() => {
        if (isCreateOpen) {
            setNewAgent({
                name: "",
                role: "",
                description: "",
                primaryLanguage: "EN",
                integrationId: "",
                crmIntegrationId: ""
            })
        }
    }, [isCreateOpen])

    // Limpar campos do template quando o modal abrir
    useEffect(() => {
        if (isCreateTemplateOpen) {
            setNewTemplate({
                name: "",
                role: "",
                description: "",
                icon: "bot",
                complexity: "Intermediate" as "Simple" | "Intermediate" | "Advanced",
                selectedChannels: ["webchat"],
                skills: [] as string[]
            })
        }
    }, [isCreateTemplateOpen])

    // New Template Form State
    const [newTemplate, setNewTemplate] = useState({
        name: "",
        role: "",
        description: "",
        icon: "bot",
        complexity: "Intermediate" as "Simple" | "Intermediate" | "Advanced",
        selectedChannels: ["webchat"],
        skills: [] as string[]
    })
    const [availableSkills, setAvailableSkills] = useState<{ name: string }[]>([])
    const [skillsLoading, setSkillsLoading] = useState(false)
    const [skillsComboboxOpen, setSkillsComboboxOpen] = useState(false)
    const [activeTab, setActiveTab] = useState("active")

    const hasLoadedInitialData = useRef(false)
    const lastActiveTab = useRef<string>("active")

    const fetchIntegrations = useCallback(async () => {
        if (!user?.email) return
        setIntegrationsLoading(true)
        try {
            const { data, error } = await supabase.rpc('sp_get_integration_by_email', {
                p_user_email: user.email
            })
            if (error) throw error
            setIntegrations(data || [])
        } catch (err) {
            console.error("Error fetching integrations:", err)
            setIntegrations([])
        } finally {
            setIntegrationsLoading(false)
        }
    }, [user?.email])

    const fetchCRMIntegrations = useCallback(async () => {
        if (!userId || !user?.email) return
        setCrmIntegrationsLoading(true)
        try {
            // 1. Buscar companies_id a partir do user_id
            const { data: companyUser, error: companyError } = await supabase
                .from('tb_company_users')
                .select('companies_id')
                .eq('user_id', userId)
                .maybeSingle()

            if (companyError || !companyUser?.companies_id) {
                console.error("Error fetching company_id:", companyError)
                setCrmIntegrations([])
                return
            }

            const companiesId = companyUser.companies_id

            // 2. Buscar CRMs usando companies_id
            const { data, error } = await supabase
                .from('tb_crm_integrations')
                .select(`
                    id,
                    tb_crms (
                        id,
                        name,
                        slug
                    )
                `)
                .eq('companies_id', companiesId)
                .eq('is_active', true)
                .order('created_at', { ascending: false })

            if (error) throw error
            // Ajustar o tipo: tb_crms pode ser um objeto ou array
            const formattedData = (data || []).map((item: any) => ({
                id: item.id,
                tb_crms: Array.isArray(item.tb_crms) ? item.tb_crms[0] : item.tb_crms
            }))
            setCrmIntegrations(formattedData)
        } catch (err) {
            console.error("Error fetching CRM integrations:", err)
            setCrmIntegrations([])
        } finally {
            setCrmIntegrationsLoading(false)
        }
    }, [userId, user?.email])

    const fetchSkills = useCallback(async () => {
        setSkillsLoading(true)
        try {
            const { data, error } = await supabase
                .from("vw_skills")
                .select("name")
                .order("name")

            if (error) {
                console.error("Failed to load skills", error)
                setAvailableSkills([])
            } else if (data) {
                setAvailableSkills(data)
            }
        } catch (err: any) {
            console.error("Error fetching skills:", err)
            setAvailableSkills([])
        } finally {
            setSkillsLoading(false)
        }
    }, [])

    const fetchAgents = useCallback(async () => {
        if (!user?.email) {
            setLoading(false)
            setAgents([])
            return
        }

        setLoading(true)
        try {
            const { data, error } = await supabase.rpc('sp_list_agents_by_email', {
                p_email: user.email
            })

            if (error) {
                console.error("[fetchAgents] Failed to load agents", error)
                setAgents([])
            } else {
                const rows = Array.isArray(data) ? data : (data ? [data] : [])

                const mappedAgents: Agent[] = rows.map((agent: any) => {
                    const template = agent.role_template_id
                        ? templates.find(t => t.id === agent.role_template_id)
                        : null

                    // Processar status_id
                    let statusId: number | null = null
                    if (agent.status_id !== null && agent.status_id !== undefined) {
                        statusId = typeof agent.status_id === 'string' ? parseInt(agent.status_id, 10) : Number(agent.status_id)
                        if (isNaN(statusId)) {
                            statusId = null
                        }
                    }

                    // Mapear status_id para status string (para compatibilidade)
                    let status: 'active' | 'paused' | 'error' = 'active'
                    if (statusId === 2) {
                        status = 'error' // Cancelado
                    } else if (statusId === 3) {
                        status = 'paused' // Pausado
                    } else if (statusId === 1) {
                        status = 'active' // Conectado/Funcionando
                    }

                    return {
                        id: agent.id,
                        name: agent.nome || '',
                        role: template?.role || template?.name || '',
                        description: agent.bio || '',
                        status: status,
                        status_id: statusId, // Adicionar status_id ao objeto
                        role_template_id: agent.role_template_id || null, // Salvar o role_template_id para buscar o template depois
                        channels: Array.isArray(agent.channels) ? agent.channels : (agent.channels ? [agent.channels] : []),
                        languages: agent.primary_language ? [agent.primary_language] : ['EN'],
                        avatar: (agent.nome || 'A').charAt(0).toUpperCase(),
                        metrics: {
                            conversations: 0,
                            csat: "N/A",
                            avgResponseTime: "0s"
                        }
                    }
                })

                setAgents(mappedAgents)
            }
        } catch (err: any) {
            if (err?.name !== 'AbortError') {
                console.error("[fetchAgents] Error fetching agents:", err)
            }
            setAgents([])
        } finally {
            setLoading(false)
        }
    }, [user?.email, templates])

    const fetchTemplates = useCallback(async () => {
        if (!user?.email) {
            setTemplates([])
            setTemplatesLoading(false)
            return
        }

        setTemplatesLoading(true)
        try {
            const { data, error } = await supabase.rpc('sp_agents_templates_full_by_email', {
                p_email: user.email
            })

            if (error) {
                console.error("Failed to load templates", error)
                setTemplates([])
            } else {
                let rows: any[] = [];
                if (data === null || data === undefined) {
                    rows = [];
                } else if (Array.isArray(data)) {
                    rows = data;
                } else if (typeof data === 'object') {
                    rows = [data];
                }

                if (rows.length === 0) {
                    setTemplates([])
                } else {
                    const mappedTemplates: AgentTemplate[] = rows.map((template: any) => ({
                        id: template.id,
                        name: template.name || '',
                        role: template.role || '',
                        description: template.description || '',
                        skills: Array.isArray(template.skills)
                            ? template.skills
                            : (template.skills ? [template.skills] : []),
                        icon: template.icon || "bot",
                        defaultChannels: Array.isArray(template.defaultChannels)
                            ? template.defaultChannels
                            : (template.defaultChannels ? [template.defaultChannels] : ["webchat"]),
                        complexity: template.complexity || "Intermediate",
                        IconComponent: getTemplateIcon(template.icon)
                    }))

                    setTemplates(mappedTemplates)
                }
            }

        } catch (err: any) {
            if (err?.name !== 'AbortError') {
                console.error("Error fetching templates:", err)
            }
            setTemplates([])
        } finally {
            setTemplatesLoading(false)
        }
    }, [user?.email])

    useEffect(() => {
        fetchSkills()
    }, [fetchSkills])

    useEffect(() => {
        if (!user?.email) {
            setAgents([])
            setTemplates([])
            setLoading(false)
            setTemplatesLoading(false)
            hasLoadedInitialData.current = false
            return
        }

        if (!hasLoadedInitialData.current) {
            hasLoadedInitialData.current = true
            fetchAgents()
            fetchTemplates()
            fetchIntegrations()
            fetchCRMIntegrations()
        }
    }, [user?.email, fetchAgents, fetchTemplates, fetchIntegrations, fetchCRMIntegrations])

    useEffect(() => {
        if (lastActiveTab.current !== activeTab && user?.email) {
            lastActiveTab.current = activeTab
            if (activeTab === "active") {
                fetchAgents()
            } else if (activeTab === "templates") {
                fetchTemplates()
            }
        }
    }, [activeTab, user?.email])

    useEffect(() => {
        if (isCreateOpen && user?.email) {
            if (templates.length === 0) fetchTemplates()
            fetchIntegrations()
            fetchCRMIntegrations()
        }
    }, [isCreateOpen, user?.email, fetchTemplates, fetchIntegrations, fetchCRMIntegrations])


    const handleUseTemplate = (template: AgentTemplate) => {
        setNewAgent({
            name: `${template.name} (Copy)`,
            role: template.id,
            description: "", // Mantém em branco para o usuário definir o comportamento
            primaryLanguage: "EN",
            integrationId: "",
            crmIntegrationId: ""
        })
        setIsCreateOpen(true)
    }

    const handleCreateAgent = async () => {
        if (!user?.email) {
            toast.error("Erro", {
                description: "Email do usuário não encontrado. Faça login novamente."
            })
            return
        }

        if (!newAgent.name.trim()) {
            toast.error("Nome obrigatório", {
                description: "Por favor, informe um nome para o agente."
            })
            return
        }

        const selectedTemplate = templates.find(t => t.id === newAgent.role)
        if (!selectedTemplate) {
            toast.error("Template não selecionado", {
                description: "Por favor, selecione um template para o agente."
            })
            return
        }

        if (!newAgent.description.trim()) {
            toast.error("Personalidade obrigatória", {
                description: "Por favor, descreva como sua Sonia deve se comportar."
            })
            return
        }

        setIsSubmitting(true)
        try {
            // A função sp_create_agent_by_email aceita apenas:
            // p_email, p_nome, p_role_template_id, p_primary_language, p_bio, p_integrations_id
            const { data, error } = await supabase.rpc('sp_create_agent_by_email', {
                p_email: user.email,
                p_nome: newAgent.name.trim(),
                p_role_template_id: selectedTemplate.id,
                p_primary_language: newAgent.primaryLanguage,
                p_bio: newAgent.description || '',
                p_integrations_id: (newAgent.integrationId === "" || newAgent.integrationId === "none" || newAgent.integrationId === "loading") ? null : newAgent.integrationId
                // p_crm_integration_id não é suportado pela função atual
            })

            if (error) {
                console.error("[handleCreateAgent] Erro RPC:", error)

                // Tratamento específico por tipo de erro
                let errorMessage = "Erro ao criar agente"
                let errorDescription = error.message || "Erro desconhecido"

                if (error.code === 'PGRST202' || error.message?.includes('does not exist')) {
                    errorMessage = "Função não encontrada"
                    errorDescription = "A função sp_create_agent_by_email não existe no banco de dados. Execute o script SQL para criá-la."
                } else if (error.code === '42883' || error.message?.includes('function') && error.message?.includes('does not exist')) {
                    errorMessage = "Função não encontrada"
                    errorDescription = "A função sp_create_agent_by_email não foi encontrada. Verifique se ela foi criada no banco de dados."
                } else if (error.message?.includes('não encontrado')) {
                    errorMessage = "Recurso não encontrado"
                    errorDescription = error.message
                } else if (error.message?.includes('Template')) {
                    errorMessage = "Template inválido"
                    errorDescription = error.message
                } else if (error.message?.includes('Usuário')) {
                    errorMessage = "Usuário não encontrado"
                    errorDescription = error.message
                }

                toast.error(errorMessage, {
                    description: errorDescription,
                    duration: 5000
                })
                return
            }

            // Sucesso
            toast.success("Agente criado com sucesso!", {
                description: `${newAgent.name.trim()} foi criado e está ativo.`
            })

            await fetchAgents()
            setIsCreateOpen(false)
            setNewAgent({
                name: "",
                role: "",
                description: "",
                primaryLanguage: "EN",
                integrationId: "",
                crmIntegrationId: ""
            })
        } catch (error: any) {
            console.error("[handleCreateAgent] Erro inesperado:", error)

            // Tratamento de erros não relacionados ao Supabase
            const errorMessage = error?.message || "Erro desconhecido ao criar agente"

            toast.error("Erro ao criar agente", {
                description: errorMessage,
                duration: 5000
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    const handlePauseAgent = async (id: string) => {
        try {
            const { error } = await supabase
                .from('tb_agents')
                .update({ status_id: 3 })
                .eq('id', id)

            if (error) {
                console.error('[handlePauseAgent] Erro ao pausar agente:', error)
                toast.error('Erro ao pausar agente')
                return
            }

            toast.success('Agente pausado com sucesso')
            await fetchAgents()
        } catch (error: any) {
            console.error('[handlePauseAgent] Erro:', error)
            toast.error('Erro ao pausar agente')
        }
    }

    const handleReactivateAgent = async (id: string) => {
        try {
            const { error } = await supabase
                .from('tb_agents')
                .update({ status_id: 1 })
                .eq('id', id)

            if (error) {
                console.error('[handleReactivateAgent] Erro ao reativar agente:', error)
                toast.error('Erro ao reativar agente')
                return
            }

            toast.success('Agente reativado com sucesso')
            await fetchAgents()
        } catch (error: any) {
            console.error('[handleReactivateAgent] Erro:', error)
            toast.error('Erro ao reativar agente')
        }
    }

    const handleDeleteAgent = async (id: string) => {
        if (confirm("Tem certeza que deseja cancelar este agente?")) {
            try {
                const { error } = await supabase
                    .from('tb_agents')
                    .update({ status_id: 2 })
                    .eq('id', id)

                if (error) {
                    console.error('[handleDeleteAgent] Erro ao cancelar agente:', error)
                    toast.error('Erro ao cancelar agente')
                    return
                }

                toast.success('Agente cancelado com sucesso')
                await fetchAgents()
            } catch (error: any) {
                console.error('[handleDeleteAgent] Erro:', error)
                toast.error('Erro ao cancelar agente')
            }
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

    const toggleTemplateChannel = (channelId: string) => {
        setNewTemplate(prev => {
            const current = prev.selectedChannels
            if (current.includes(channelId)) {
                return { ...prev, selectedChannels: current.filter(c => c !== channelId) }
            } else {
                return { ...prev, selectedChannels: [...current, channelId] }
            }
        })
    }

    const addSkill = (skillName: string) => {
        if (skillName.trim() && !newTemplate.skills.includes(skillName.trim())) {
            setNewTemplate(prev => ({
                ...prev,
                skills: [...prev.skills, skillName.trim()]
            }))
            setSkillsComboboxOpen(false)
        }
    }

    const removeSkill = (skill: string) => {
        setNewTemplate(prev => ({
            ...prev,
            skills: prev.skills.filter(s => s !== skill)
        }))
    }

    const handleCreateTemplate = async () => {
        if (!user?.email) return
        setIsSubmittingTemplate(true)
        try {
            const { error } = await supabase.rpc('sp_create_agent_template', {
                p_name: newTemplate.name,
                p_role: newTemplate.role,
                p_description: newTemplate.description,
                p_icon: newTemplate.icon,
                p_complexity: newTemplate.complexity,
                p_channel_names: newTemplate.selectedChannels,
                p_skill_names: newTemplate.skills,
                p_email: user.email
            });

            if (error) throw error

            await fetchTemplates()
            setIsCreateTemplateOpen(false)

            setNewTemplate({
                name: "",
                role: "",
                description: "",
                icon: "bot",
                complexity: "Intermediate",
                selectedChannels: ["webchat"],
                skills: []
            })
        } catch (error: any) {
            console.error("[handleCreateTemplate] Error:", error)
        } finally {
            setIsSubmittingTemplate(false)
        }
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500 bg-[#F0F4F8] -m-4 p-8 min-h-screen">

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Agents Hub</h2>
                    <p className="text-muted-foreground">
                        Manage your global, omnichannel workforce for SDR and Support.
                    </p>
                </div>
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <Plus className="h-4 w-4" />
                            Deploy New Agent
                        </Button>
                    </DialogTrigger>
                    <DialogContent 
                        className="sm:max-w-[600px]"
                        style={{
                            maxHeight: '90vh',
                            marginTop: '1rem',
                            marginBottom: '1rem',
                            overflow: 'hidden',
                            gridTemplateRows: 'auto 1fr auto',
                            padding: 0
                        }}
                    >
                        <style>{`
                            @keyframes popIn {
                                0% {
                                    transform: scale(0);
                                    opacity: 0;
                                }
                                50% {
                                    transform: scale(1.2);
                                }
                                100% {
                                    transform: scale(1);
                                    opacity: 1;
                                }
                            }
                            @keyframes energyFlow {
                                0% {
                                    transform: translateX(0);
                                    opacity: 0;
                                }
                                10% {
                                    opacity: 1;
                                }
                                90% {
                                    opacity: 1;
                                }
                                100% {
                                    transform: translateX(500%);
                                    opacity: 0;
                                }
                            }
                            @keyframes shimmer {
                                0% {
                                    background-position: -200% 0;
                                }
                                100% {
                                    background-position: 200% 0;
                                }
                            }
                            @keyframes buttonGlow {
                                0%, 100% {
                                    box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.3), 0 0 20px rgba(37, 99, 235, 0.2), 0 0 0 0 rgba(37, 99, 235, 0.4);
                                }
                                50% {
                                    box-shadow: 0 10px 35px -5px rgba(37, 99, 235, 0.5), 0 0 30px rgba(37, 99, 235, 0.4), 0 0 0 8px rgba(37, 99, 235, 0.1);
                                }
                            }
                            @keyframes buttonPulse {
                                0%, 100% {
                                    transform: scale(1);
                                }
                                50% {
                                    transform: scale(1.02);
                                }
                            }
                        `}</style>
                        <div style={{ padding: '1.5rem 1.5rem 0 1.5rem' }}>
                        <DialogHeader className="pt-6">
                            <DialogTitle>Criar Nova Sonia</DialogTitle>
                            <DialogDescription>
                                {(() => {
                                    const progress = (() => {
                                        let completed = 0
                                        if (newAgent.name.trim()) completed++
                                        if (newAgent.primaryLanguage) completed++
                                        if (newAgent.role) completed++
                                        if (newAgent.description.trim()) completed++
                                        return (completed / 4) * 100
                                    })()
                                    if (progress === 100) {
                                        return "✨ Falta pouco para sua Sonia ganhar vida!"
                                    } else if (progress >= 75) {
                                        return "Quase lá! Complete os campos restantes."
                                    } else if (progress >= 50) {
                                        return "Continue preenchendo os campos para criar sua Sonia."
                                    } else if (progress >= 25) {
                                        return "Você está no caminho certo!"
                                    }
                                    return "Configure sua assistente virtual personalizada em poucos passos."
                                })()}
                            </DialogDescription>
                        </DialogHeader>
                        </div>
                        <div 
                            className="space-y-6"
                            style={{
                                overflowY: 'auto',
                                padding: '0 1.5rem',
                                minHeight: 0
                            }}
                        >
                            {/* SEÇÃO: IDENTIDADE */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 pb-3 border-b border-blue-100">
                                    <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center shadow-sm">
                                        <Sparkles className="h-5 w-5 text-blue-600" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-base font-bold text-slate-900">Identidade</h3>
                                        <p className="text-xs text-slate-500 mt-0.5">Informações básicas da sua Sonia</p>
                                    </div>
                                </div>
                                
                                <div className="space-y-2">
                                    <Label htmlFor="name" className="text-sm font-semibold text-slate-800">
                                        Dê um nome para sua Sonia
                                    </Label>
                                    <Input
                                        id="name"
                                        value={newAgent.name}
                                        onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                                        className="rounded-2xl bg-slate-50/80 border-slate-200/60 h-11 text-sm shadow-sm focus:bg-white focus:border-blue-300 transition-colors"
                                        placeholder="Ex: Maria Atendimento ou João Vendas"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="language" className="text-sm font-semibold text-slate-800">
                                        Em qual idioma ela vai conversar?
                                    </Label>
                                    <Select
                                        value={newAgent.primaryLanguage}
                                        onValueChange={(val) => setNewAgent({ ...newAgent, primaryLanguage: val })}
                                    >
                                        <SelectTrigger className="rounded-2xl bg-slate-50/80 border-slate-200/60 h-11 shadow-sm focus:bg-white focus:border-blue-300 transition-colors">
                                            <SelectValue placeholder="Selecione o idioma principal" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {SUPPORTED_LANGUAGES.map(lang => (
                                                <SelectItem key={lang.code} value={lang.code}>
                                                    {lang.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* SEÇÃO: CONFIGURAÇÃO TÉCNICA */}
                            <div 
                                className="space-y-4 transition-all duration-500"
                                style={{
                                    opacity: (newAgent.name.trim() && newAgent.primaryLanguage) ? 1 : 0.4,
                                    pointerEvents: (newAgent.name.trim() && newAgent.primaryLanguage) ? 'auto' : 'none'
                                }}
                            >
                                <div className="flex items-center gap-3 pb-3 border-b border-purple-100">
                                    <div className="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center shadow-sm">
                                        <Cpu className="h-5 w-5 text-purple-600" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-base font-bold text-slate-900">Configuração Técnica</h3>
                                        <p className="text-xs text-slate-500 mt-0.5">Defina como sua Sonia vai funcionar</p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="role" className="text-sm font-semibold text-slate-800">
                                        Qual o papel da sua Sonia?
                                    </Label>
                                    <Select
                                        value={newAgent.role}
                                        onValueChange={(val) => {
                                            setNewAgent({
                                                ...newAgent,
                                                role: val
                                            })
                                        }}
                                    >
                                        <SelectTrigger className="rounded-2xl bg-slate-50/80 border-slate-200/60 h-11 shadow-sm focus:bg-white focus:border-purple-300 transition-colors">
                                            <SelectValue placeholder="Escolha um template de função" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {templates.length === 0 ? (
                                                <SelectItem value="none" disabled>
                                                    {templatesLoading ? "Carregando templates..." : "Nenhum template disponível"}
                                                </SelectItem>
                                            ) : (
                                                templates.map((template) => (
                                                    <SelectItem key={template.id} value={template.id}>
                                                        {template.name} - {template.role}
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Campos Opcionais em Accordion */}
                                <Accordion type="single" collapsible className="w-full">
                                    <AccordionItem value="advanced" className="border-none">
                                        <AccordionTrigger className="text-sm text-slate-600 hover:text-slate-800 py-2">
                                            <span className="text-xs font-medium">Configurações Avançadas (opcional)</span>
                                        </AccordionTrigger>
                                        <AccordionContent className="space-y-4 pt-2">
                                            <div className="space-y-2">
                                                <Label className="text-sm font-semibold text-slate-800">
                                                    Conexão de Comunicação
                                                </Label>
                                                <Select
                                                    value={newAgent.integrationId}
                                                    onValueChange={(val) => setNewAgent({ ...newAgent, integrationId: val })}
                                                >
                                                    <SelectTrigger className="rounded-2xl bg-slate-50/80 border-slate-200/60 h-11 shadow-sm focus:bg-white focus:border-purple-300 transition-colors">
                                                        <SelectValue placeholder="Selecione como ela vai se comunicar" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {integrationsLoading ? (
                                                            <SelectItem value="loading" disabled>Carregando integrações...</SelectItem>
                                                        ) : integrations.length === 0 ? (
                                                            <SelectItem value="none" disabled>Nenhuma integração encontrada</SelectItem>
                                                        ) : (
                                                            integrations.map(int => (
                                                                <SelectItem key={int.id} value={int.id}>
                                                                    {`${int.phone_number || 'Sem Telefone'} | ${int.email || 'Sem Email'}`}
                                                                </SelectItem>
                                                            ))
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-sm font-semibold text-slate-800">
                                                    Integração com CRM
                                                </Label>
                                                <Select
                                                    value={newAgent.crmIntegrationId || "__none__"}
                                                    onValueChange={(val) => setNewAgent({ ...newAgent, crmIntegrationId: val === "__none__" ? "" : val })}
                                                >
                                                    <SelectTrigger className="rounded-2xl bg-slate-50/80 border-slate-200/60 h-11 shadow-sm focus:bg-white focus:border-purple-300 transition-colors">
                                                        <SelectValue placeholder="Conecte com seu CRM" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="__none__">Não usar CRM</SelectItem>
                                                        {crmIntegrationsLoading ? (
                                                            <SelectItem value="loading" disabled>Carregando CRMs...</SelectItem>
                                                        ) : crmIntegrations.length === 0 ? (
                                                            <SelectItem value="none" disabled>Nenhum CRM conectado. Configure na tela de Integrações.</SelectItem>
                                                        ) : (
                                                            crmIntegrations.map(crm => (
                                                                <SelectItem key={crm.id} value={crm.id}>
                                                                    {crm.tb_crms?.name || 'CRM'}
                                                                </SelectItem>
                                                            ))
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                </Accordion>
                            </div>

                            {/* PERSONALIDADE */}
                            <div 
                                className="space-y-4 transition-all duration-500"
                                style={{
                                    opacity: newAgent.role ? 1 : 0.4,
                                    pointerEvents: newAgent.role ? 'auto' : 'none'
                                }}
                            >
                                <div className="flex items-center gap-3 pb-3 border-b border-emerald-100">
                                    <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center shadow-sm">
                                        <Heart className="h-5 w-5 text-emerald-600" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-base font-bold text-slate-900">Personalidade</h3>
                                        <p className="text-xs text-slate-500 mt-0.5">Defina como sua Sonia se comporta</p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="description" className="text-sm font-semibold text-slate-800">
                                        Como ela deve se comportar?
                                        <InfoTooltip text="Descreva o tom de voz e como a IA deve se portar (ex: amigável, formal, usa emojis)." />
                                    </Label>
                                    <Textarea
                                        id="description"
                                        value={newAgent.description}
                                        onChange={(e) => setNewAgent({ ...newAgent, description: e.target.value })}
                                        className="rounded-2xl bg-slate-50/80 border-slate-200/60 min-h-[100px] max-h-[100px] overflow-y-auto text-sm shadow-sm focus:bg-white focus:border-emerald-300 transition-colors"
                                        placeholder="Ex: Seja cordial, responda de forma direta e use um tom profissional..."
                                    />
                                </div>
                            </div>
                        </div>
                        <div style={{ padding: '0 1.5rem 1.5rem 1.5rem', borderTop: '1px solid rgb(226 232 240)' }}>
                        <DialogFooter className="pt-4">
                            {(() => {
                                const getCurrentStep = () => {
                                    if (!newAgent.name.trim() || !newAgent.primaryLanguage) return 1
                                    if (!newAgent.role) return 2
                                    if (!newAgent.description.trim()) return 3
                                    return 4
                                }
                                const progress = (() => {
                                    let completed = 0
                                    if (newAgent.name.trim()) completed++
                                    if (newAgent.primaryLanguage) completed++
                                    if (newAgent.role) completed++
                                    if (newAgent.description.trim()) completed++
                                    return (completed / 4) * 100
                                })()
                                const currentStep = getCurrentStep()
                                const isComplete = currentStep === 4
                                
                                return (
                                    <div className="flex flex-col gap-3 w-full">
                                        {/* Indicador de Passo e Porcentagem */}
                                        <div className="flex items-center justify-between w-full">
                                            <span className="text-sm font-medium text-slate-600">
                                                Passo {currentStep} de 4
                                            </span>
                                            <span className="text-sm font-bold text-blue-600">
                                                {Math.round(progress)}%
                                            </span>
                                        </div>
                                        
                                        {/* Barra de Progresso com Animação de Energia */}
                                        <div 
                                            style={{ 
                                                width: '100%',
                                                height: '10px',
                                                backgroundColor: '#e2e8f0',
                                                borderRadius: '9999px',
                                                overflow: 'hidden',
                                                position: 'relative'
                                            }}
                                        >
                                            <div 
                                                style={{ 
                                                    width: `${progress}%`,
                                                    height: '100%',
                                                    background: isComplete 
                                                        ? 'linear-gradient(90deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)'
                                                        : 'linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)',
                                                    transition: 'width 0.5s ease-out',
                                                    borderRadius: '9999px',
                                                    position: 'relative',
                                                    overflow: 'hidden'
                                                }}
                                            >
                                                {/* Animação de shimmer - brilho passando */}
                                                <div 
                                                    style={{ 
                                                        position: 'absolute',
                                                        top: 0,
                                                        left: 0,
                                                        width: '100%',
                                                        height: '100%',
                                                        background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.4) 50%, transparent 100%)',
                                                        backgroundSize: '200% 100%',
                                                        animation: 'shimmer 2s linear infinite',
                                                        borderRadius: '9999px'
                                                    }} 
                                                />
                                                {/* Onda de energia fluindo sempre para a direita */}
                                                <div 
                                                    style={{ 
                                                        position: 'absolute',
                                                        top: 0,
                                                        left: '-100%',
                                                        width: '30%',
                                                        height: '100%',
                                                        background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.7), transparent)',
                                                        animation: 'energyFlow 2s linear infinite',
                                                        borderRadius: '9999px'
                                                    }} 
                                                />
                                            </div>
                                            {isComplete && (
                                                <div 
                                                    style={{ 
                                                        position: 'absolute',
                                                        top: 0,
                                                        left: 0,
                                                        right: 0,
                                                        height: '100%',
                                                        background: 'linear-gradient(90deg, #3b82f6 0%, #60a5fa 50%, #3b82f6 100%)',
                                                        animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                                                        opacity: 0.6,
                                                        borderRadius: '9999px'
                                                    }} 
                                                />
                                            )}
                                        </div>
                                        
                                        {/* Botão Criar Sonia */}
                                        <div className="flex justify-end">
                                            <Button 
                                                type="submit" 
                                                onClick={handleCreateAgent} 
                                                disabled={isSubmitting || !isComplete}
                                                className="rounded-xl h-11 px-8 font-semibold transition-all duration-300 relative overflow-hidden"
                                                style={{
                                                    backgroundColor: isComplete 
                                                        ? '#2563eb' 
                                                        : '#94a3b8',
                                                    boxShadow: isComplete 
                                                        ? '0 10px 25px -5px rgba(37, 99, 235, 0.3), 0 0 20px rgba(37, 99, 235, 0.2)'
                                                        : 'none',
                                                    animation: isComplete 
                                                        ? 'buttonGlow 2s ease-in-out infinite, buttonPulse 2s ease-in-out infinite' 
                                                        : 'none',
                                                    transform: isComplete ? 'scale(1)' : 'scale(1)',
                                                    position: 'relative',
                                                    zIndex: 10
                                                }}
                                            >
                                                {/* Efeito de brilho interno */}
                                                {isComplete && !isSubmitting && (
                                                    <div 
                                                        className="absolute inset-0"
                                                        style={{
                                                            background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent)',
                                                            animation: 'shimmer 2s linear infinite',
                                                            pointerEvents: 'none'
                                                        }}
                                                    />
                                                )}
                                                <span className="relative z-10 flex items-center">
                                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                    {isComplete && !isSubmitting && <Sparkles className="mr-2 h-4 w-4 animate-pulse" />}
                                                    Criar Sonia
                                                </span>
                                            </Button>
                                        </div>
                                    </div>
                                )
                            })()}
                        </DialogFooter>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Create Template Dialog */}
                <Dialog open={isCreateTemplateOpen} onOpenChange={setIsCreateTemplateOpen}>
                    <DialogContent 
                        className="sm:max-w-[600px]"
                        style={{
                            maxHeight: '90vh',
                            marginTop: '1rem',
                            marginBottom: '1rem',
                            overflow: 'hidden',
                            gridTemplateRows: 'auto 1fr auto',
                            padding: 0
                        }}
                    >
                        {/* Barra de Progresso no Topo com Animação de Energia */}
                        {(() => {
                            const progress = (() => {
                                let completed = 0
                                if (newTemplate.name.trim()) completed++
                                if (newTemplate.role.trim()) completed++
                                if (newTemplate.description.trim()) completed++
                                return (completed / 3) * 100
                            })()
                            const isComplete = progress === 100
                            return (
                                <div 
                                    style={{ 
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        height: '3px',
                                        backgroundColor: '#e2e8f0',
                                        zIndex: 100,
                                        borderRadius: '0',
                                        overflow: 'hidden'
                                    }}
                                >
                                    <div 
                                        style={{ 
                                            width: `${progress}%`,
                                            height: '100%',
                                            background: isComplete 
                                                ? 'linear-gradient(90deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)'
                                                : 'linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)',
                                            transition: 'width 0.5s ease-out',
                                            borderRadius: '0',
                                            position: 'relative',
                                            overflow: 'hidden'
                                        }}
                                    >
                                        {/* Animação de shimmer - brilho passando */}
                                        <div 
                                            style={{ 
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                width: '100%',
                                                height: '100%',
                                                background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.4) 50%, transparent 100%)',
                                                backgroundSize: '200% 100%',
                                                animation: 'shimmer 2s linear infinite',
                                                borderRadius: '0'
                                            }} 
                                        />
                                        {/* Onda de energia fluindo sempre para a direita */}
                                        <div 
                                            style={{ 
                                                position: 'absolute',
                                                top: 0,
                                                left: '-100%',
                                                width: '30%',
                                                height: '100%',
                                                background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.7), transparent)',
                                                animation: 'energyFlow 2s linear infinite',
                                                borderRadius: '0'
                                            }} 
                                        />
                                    </div>
                                    {isComplete && (
                                        <div 
                                            style={{ 
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                right: 0,
                                                height: '100%',
                                                background: 'linear-gradient(90deg, #3b82f6 0%, #60a5fa 50%, #3b82f6 100%)',
                                                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                                                opacity: 0.6,
                                                borderRadius: '0'
                                            }} 
                                        />
                                    )}
                                </div>
                            )
                        })()}
                        <div style={{ padding: '1.5rem 1.5rem 0 1.5rem' }}>
                        <DialogHeader className="pt-6">
                            <DialogTitle>Criar Template</DialogTitle>
                            <DialogDescription>
                                {(() => {
                                    const progress = (() => {
                                        let completed = 0
                                        if (newTemplate.name.trim()) completed++
                                        if (newTemplate.role.trim()) completed++
                                        if (newTemplate.description.trim()) completed++
                                        return (completed / 3) * 100
                                    })()
                                    if (progress === 100) {
                                        return "✨ Template pronto para ser criado!"
                                    } else if (progress >= 66) {
                                        return "Quase lá! Complete os campos restantes."
                                    } else if (progress >= 33) {
                                        return "Continue preenchendo os campos para criar seu template."
                                    }
                                    return "Configure um template reutilizável para criar agentes."
                                })()}
                            </DialogDescription>
                        </DialogHeader>
                        </div>
                        <div 
                            className="space-y-6"
                            style={{
                                overflowY: 'auto',
                                padding: '0 1.5rem',
                                minHeight: 0
                            }}
                        >
                            {/* SEÇÃO: IDENTIDADE */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 pb-3 border-b border-blue-100">
                                    <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center shadow-sm">
                                        <Sparkles className="h-5 w-5 text-blue-600" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-base font-bold text-slate-900">Identidade</h3>
                                        <p className="text-xs text-slate-500 mt-0.5">Informações básicas do template</p>
                                    </div>
                                </div>
                                
                                <div className="space-y-2">
                                    <Label htmlFor="template-name" className="text-sm font-semibold text-slate-800">
                                        Dê um nome para o template
                                    </Label>
                                    <Input
                                        id="template-name"
                                        value={newTemplate.name}
                                        onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                                        className="rounded-2xl bg-slate-50/80 border-slate-200/60 h-11 text-sm shadow-sm focus:bg-white focus:border-blue-300 transition-colors"
                                        placeholder="Ex: Atendente L1 ou Vendedor Especialista"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="template-role" className="text-sm font-semibold text-slate-800">
                                        Qual o papel/função deste template?
                                    </Label>
                                    <Input
                                        id="template-role"
                                        value={newTemplate.role}
                                        onChange={(e) => setNewTemplate({ ...newTemplate, role: e.target.value })}
                                        className="rounded-2xl bg-slate-50/80 border-slate-200/60 h-11 text-sm shadow-sm focus:bg-white focus:border-blue-300 transition-colors"
                                        placeholder="Ex: Suporte ao Cliente ou Vendas"
                                    />
                                </div>
                            </div>

                            {/* SEÇÃO: CONFIGURAÇÃO */}
                            <div 
                                className="space-y-4 transition-all duration-500"
                                style={{
                                    opacity: (newTemplate.name.trim() && newTemplate.role.trim()) ? 1 : 0.4,
                                    pointerEvents: (newTemplate.name.trim() && newTemplate.role.trim()) ? 'auto' : 'none'
                                }}
                            >
                                <div className="flex items-center gap-3 pb-3 border-b border-purple-100">
                                    <div className="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center shadow-sm">
                                        <Cpu className="h-5 w-5 text-purple-600" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-base font-bold text-slate-900">Configuração</h3>
                                        <p className="text-xs text-slate-500 mt-0.5">Defina como o template funciona</p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="template-description" className="text-sm font-semibold text-slate-800">
                                        Script do Sistema
                                        <InfoTooltip text="Prompt do sistema que define o comportamento do agente." />
                                    </Label>
                                    <Textarea
                                        id="template-description"
                                        value={newTemplate.description}
                                        onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                                        className="rounded-2xl bg-slate-50/80 border-slate-200/60 min-h-[150px] max-h-[150px] overflow-y-auto text-sm shadow-sm focus:bg-white focus:border-purple-300 transition-colors"
                                        placeholder="Ex: Você é um agente de atendimento especializado em resolver problemas técnicos..."
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="template-icon" className="text-sm font-semibold text-slate-800">
                                            Ícone
                                        </Label>
                                        <Select
                                            value={newTemplate.icon}
                                            onValueChange={(val) => setNewTemplate({ ...newTemplate, icon: val })}
                                        >
                                            <SelectTrigger className="rounded-2xl bg-slate-50/80 border-slate-200/60 h-11 shadow-sm focus:bg-white focus:border-purple-300 transition-colors">
                                                <SelectValue placeholder="Selecione um ícone" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="users">Users</SelectItem>
                                                <SelectItem value="message-circle">Message Circle</SelectItem>
                                                <SelectItem value="bar-chart-3">Bar Chart</SelectItem>
                                                <SelectItem value="settings">Settings</SelectItem>
                                                <SelectItem value="bot">Bot</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="template-complexity" className="text-sm font-semibold text-slate-800">
                                            Complexidade
                                        </Label>
                                        <Select
                                            value={newTemplate.complexity}
                                            onValueChange={(val: "Simple" | "Intermediate" | "Advanced") => setNewTemplate({ ...newTemplate, complexity: val })}
                                        >
                                            <SelectTrigger className="rounded-2xl bg-slate-50/80 border-slate-200/60 h-11 shadow-sm focus:bg-white focus:border-purple-300 transition-colors">
                                                <SelectValue placeholder="Selecione a complexidade" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Simple">Simples</SelectItem>
                                                <SelectItem value="Intermediate">Intermediário</SelectItem>
                                                <SelectItem value="Advanced">Avançado</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            {/* SEÇÃO: OPCIONAL */}
                            <div 
                                className="space-y-4 transition-all duration-500"
                                style={{
                                    opacity: newTemplate.description.trim() ? 1 : 0.4,
                                    pointerEvents: newTemplate.description.trim() ? 'auto' : 'none'
                                }}
                            >
                                <Accordion type="single" collapsible className="w-full">
                                    <AccordionItem value="optional" className="border-none">
                                        <AccordionTrigger className="text-sm text-slate-600 hover:text-slate-800 py-2">
                                            <span className="text-xs font-medium">Configurações Opcionais</span>
                                        </AccordionTrigger>
                                        <AccordionContent className="space-y-4 pt-2">
                                            <div className="space-y-2">
                                                <Label className="text-sm font-semibold text-slate-800">
                                                    Canais de Comunicação
                                                </Label>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {AVAILABLE_CHANNELS.map(channel => {
                                                        const isSelected = newTemplate.selectedChannels.includes(channel.id)
                                                        return (
                                                            <div
                                                                key={channel.id}
                                                                onClick={() => toggleTemplateChannel(channel.id)}
                                                                className={`
                                                                    cursor-pointer rounded-xl border p-3 flex flex-col items-center justify-center gap-2 text-xs transition-all
                                                                    ${isSelected
                                                                        ? "border-blue-500 bg-blue-50 text-blue-600 ring-1 ring-blue-300"
                                                                        : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"
                                                                    }
                                                                `}
                                                            >
                                                                <channel.icon className={`h-5 w-5 ${isSelected ? "text-blue-600" : "text-slate-400"}`} />
                                                                <span className="font-medium">{channel.name}</span>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-sm font-semibold text-slate-800">
                                                    Habilidades
                                                </Label>
                                                <Popover open={skillsComboboxOpen} onOpenChange={setSkillsComboboxOpen}>
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            role="combobox"
                                                            aria-expanded={skillsComboboxOpen}
                                                            className="w-full justify-between rounded-2xl bg-slate-50/80 border-slate-200/60 h-11 shadow-sm focus:bg-white focus:border-purple-300 transition-colors"
                                                        >
                                                            <span className="text-slate-500">Selecione uma habilidade...</span>
                                                            <Plus className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                                        <Command>
                                                            <CommandInput placeholder="Buscar habilidades..." />
                                                            <CommandList>
                                                                {skillsLoading ? (
                                                                    <div className="flex items-center justify-center p-4">
                                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                                    </div>
                                                                ) : (
                                                                    <>
                                                                        <CommandEmpty>Nenhuma habilidade encontrada.</CommandEmpty>
                                                                        <CommandGroup>
                                                                            {availableSkills
                                                                                .filter(skill => !newTemplate.skills.includes(skill.name))
                                                                                .map((skill) => (
                                                                                    <CommandItem
                                                                                        key={skill.name}
                                                                                        value={skill.name}
                                                                                        onSelect={() => addSkill(skill.name)}
                                                                                    >
                                                                                        <Check
                                                                                            className={`mr-2 h-4 w-4 ${newTemplate.skills.includes(skill.name) ? "opacity-100" : "opacity-0"
                                                                                                }`}
                                                                                        />
                                                                                        {skill.name}
                                                                                    </CommandItem>
                                                                                ))}
                                                                        </CommandGroup>
                                                                    </>
                                                                )}
                                                            </CommandList>
                                                        </Command>
                                                    </PopoverContent>
                                                </Popover>
                                                <div className="flex flex-wrap gap-2">
                                                    {newTemplate.skills.map(skill => (
                                                        <Badge key={skill} variant="secondary" className="gap-1">
                                                            {skill}
                                                            <button
                                                                onClick={() => removeSkill(skill)}
                                                                className="ml-1 hover:text-destructive"
                                                                type="button"
                                                            >
                                                                <Trash2 className="h-3 w-3" />
                                                            </button>
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                </Accordion>
                            </div>
                        </div>
                        <div style={{ padding: '0 1.5rem 1.5rem 1.5rem', borderTop: '1px solid rgb(226 232 240)' }}>
                        <DialogFooter className="pt-4">
                            {(() => {
                                const getCurrentStep = () => {
                                    if (!newTemplate.name.trim() || !newTemplate.role.trim()) return 1
                                    if (!newTemplate.description.trim()) return 2
                                    return 3
                                }
                                const progress = (() => {
                                    let completed = 0
                                    if (newTemplate.name.trim()) completed++
                                    if (newTemplate.role.trim()) completed++
                                    if (newTemplate.description.trim()) completed++
                                    return (completed / 3) * 100
                                })()
                                const currentStep = getCurrentStep()
                                const isComplete = currentStep === 3
                                
                                return (
                                    <div className="flex flex-col gap-3 w-full">
                                        {/* Indicador de Passo e Porcentagem */}
                                        <div className="flex items-center justify-between w-full">
                                            <span className="text-sm font-medium text-slate-600">
                                                Passo {currentStep} de 3
                                            </span>
                                            <span className="text-sm font-bold text-blue-600">
                                                {Math.round(progress)}%
                                            </span>
                                        </div>
                                        
                                        {/* Barra de Progresso com Animação de Energia */}
                                        <div 
                                            style={{ 
                                                width: '100%',
                                                height: '10px',
                                                backgroundColor: '#e2e8f0',
                                                borderRadius: '9999px',
                                                overflow: 'hidden',
                                                position: 'relative'
                                            }}
                                        >
                                            <div 
                                                style={{ 
                                                    width: `${progress}%`,
                                                    height: '100%',
                                                    background: isComplete 
                                                        ? 'linear-gradient(90deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)'
                                                        : 'linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)',
                                                    transition: 'width 0.5s ease-out',
                                                    borderRadius: '9999px',
                                                    position: 'relative',
                                                    overflow: 'hidden'
                                                }}
                                            >
                                                {/* Animação de shimmer - brilho passando */}
                                                <div 
                                                    style={{ 
                                                        position: 'absolute',
                                                        top: 0,
                                                        left: 0,
                                                        width: '100%',
                                                        height: '100%',
                                                        background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.4) 50%, transparent 100%)',
                                                        backgroundSize: '200% 100%',
                                                        animation: 'shimmer 2s linear infinite',
                                                        borderRadius: '9999px'
                                                    }} 
                                                />
                                                {/* Onda de energia fluindo sempre para a direita */}
                                                <div 
                                                    style={{ 
                                                        position: 'absolute',
                                                        top: 0,
                                                        left: '-100%',
                                                        width: '30%',
                                                        height: '100%',
                                                        background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.7), transparent)',
                                                        animation: 'energyFlow 2s linear infinite',
                                                        borderRadius: '9999px'
                                                    }} 
                                                />
                                            </div>
                                            {isComplete && (
                                                <div 
                                                    style={{ 
                                                        position: 'absolute',
                                                        top: 0,
                                                        left: 0,
                                                        right: 0,
                                                        height: '100%',
                                                        background: 'linear-gradient(90deg, #3b82f6 0%, #60a5fa 50%, #3b82f6 100%)',
                                                        animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                                                        opacity: 0.6,
                                                        borderRadius: '9999px'
                                                    }} 
                                                />
                                            )}
                                        </div>
                                        
                                        {/* Botão Criar Template */}
                                        <div className="flex justify-end">
                                            <Button 
                                                type="button" 
                                                onClick={handleCreateTemplate} 
                                                disabled={isSubmittingTemplate || !isComplete}
                                                className="rounded-xl h-11 px-8 font-semibold transition-all duration-300 relative overflow-hidden"
                                                style={{
                                                    backgroundColor: isComplete 
                                                        ? '#2563eb' 
                                                        : '#94a3b8',
                                                    boxShadow: isComplete 
                                                        ? '0 10px 25px -5px rgba(37, 99, 235, 0.3), 0 0 20px rgba(37, 99, 235, 0.2)'
                                                        : 'none',
                                                    animation: isComplete 
                                                        ? 'buttonGlow 2s ease-in-out infinite, buttonPulse 2s ease-in-out infinite' 
                                                        : 'none',
                                                    transform: isComplete ? 'scale(1)' : 'scale(1)',
                                                    position: 'relative',
                                                    zIndex: 10
                                                }}
                                            >
                                                {/* Efeito de brilho interno */}
                                                {isComplete && !isSubmittingTemplate && (
                                                    <div 
                                                        className="absolute inset-0"
                                                        style={{
                                                            background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent)',
                                                            animation: 'shimmer 2s linear infinite',
                                                            pointerEvents: 'none'
                                                        }}
                                                    />
                                                )}
                                                <span className="relative z-10 flex items-center">
                                                    {isSubmittingTemplate && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                    {isComplete && !isSubmittingTemplate && <Sparkles className="mr-2 h-4 w-4 animate-pulse" />}
                                                    Criar Template
                                                </span>
                                            </Button>
                                        </div>
                                    </div>
                                )
                            })()}
                        </DialogFooter>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-5">
                {channelsData.map((channel, i) => {
                    const getStatusBadgeColor = () => {
                        if (channel.status === 'connected') return 'bg-emerald-500 text-white'
                        if (channel.status === 'partial') return 'bg-yellow-500 text-white'
                        return 'bg-red-500 text-white'
                    }
                    const getStatusText = () => {
                        if (channel.status === 'connected') return 'Conectado'
                        if (channel.status === 'partial') return 'Parcial'
                        return 'Desconectado'
                    }
                    const getCardBgStyle = () => {
                        if (channel.status === 'connected') {
                            if (channel.name === 'WhatsApp Business') return { background: 'linear-gradient(to bottom right, #ecfdf5, #d1fae5)' }
                            if (channel.name === 'LinkedIn Sales Nav') return { background: 'linear-gradient(to bottom right, #eff6ff, #dbeafe)' }
                            if (channel.name === 'Web Widget') return { background: 'linear-gradient(to bottom right, #eff6ff, #e0e7ff)' }
                            if (channel.name === 'Corporate Email') return { background: 'linear-gradient(to bottom right, #fefce8, #fef3c7)' }
                            if (channel.name === 'VoIP Telephony') return { background: 'linear-gradient(to bottom right, #fef2f2, #fee2e2)' }
                        }
                        return { background: 'linear-gradient(to bottom right, #f8fafc, #f1f5f9)' }
                    }
                    return (
                        <div key={i} style={{
                            position: 'relative',
                            borderRadius: '12px',
                            padding: '2px',
                            background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 50%, #8b5cf6 100%)',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                            transition: 'all 0.3s ease'
                        }} onMouseEnter={(e) => {
                            e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                        }} onMouseLeave={(e) => {
                            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                        }}>
                            <div className="flex flex-col justify-center p-6 h-36 w-full" style={{
                                ...getCardBgStyle(),
                                borderRadius: '10px',
                                width: '100%',
                                height: '100%'
                            }}>
                                <div className="flex items-center gap-4">
                                <div className="h-14 w-14 rounded-xl bg-white shadow-sm flex items-center justify-center">
                                    <channel.icon className={`h-8 w-8`} style={{ 
                                        color: channel.status === 'connected' && channel.name === 'WhatsApp Business' ? '#10b981' :
                                               channel.status === 'connected' && channel.name === 'LinkedIn Sales Nav' ? '#0077b5' :
                                               channel.status === 'connected' && channel.name === 'Web Widget' ? '#3b82f6' :
                                               channel.status === 'connected' && channel.name === 'Corporate Email' ? '#eab308' :
                                               channel.status === 'connected' && channel.name === 'VoIP Telephony' ? '#ef4444' :
                                               channel.status === 'partial' ? '#eab308' :
                                               '#ef4444'
                                    }} />
                                </div>
                                <div className="flex flex-col gap-2 flex-1">
                                    <span className="text-base font-bold text-slate-800">{channel.name}</span>
                                    <Badge className={`${getStatusBadgeColor()} text-xs px-3 py-1 w-fit capitalize shadow-sm`}>
                                        {getStatusText()}
                                    </Badge>
                                </div>
                            </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value)}>
                <TabsList>
                    <TabsTrigger value="active">Active Workforce</TabsTrigger>
                    <TabsTrigger value="templates">Templates</TabsTrigger>
                </TabsList>

                <TabsContent value="active" className="mt-6">
                    {loading ? (
                        <div className="flex h-40 items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : agents.length === 0 ? (
                        <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20">
                            <Bot className="h-10 w-10 text-muted-foreground" />
                            <h3 className="mt-4 text-lg font-semibold">No agents deployed</h3>
                            <p className="mb-4 text-sm text-muted-foreground">Deploy your first AI agent to get started.</p>
                            <Button onClick={() => setIsCreateOpen(true)}>Deploy Agent</Button>
                        </div>
                    ) : (
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {agents.map((agent) => (
                                    <Card key={agent.id} className="group relative overflow-hidden h-full min-h-[280px] transition-all border-0 shadow-md cursor-pointer flex flex-col" style={{
                                        background: 'linear-gradient(to bottom right, #e0f2fe, #dbeafe)'
                                    }} onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-8px)'
                                        e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(59, 130, 246, 0.15), 0 10px 10px -5px rgba(59, 130, 246, 0.1)'
                                    }} onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)'
                                        e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                                    }}>
                                        <div className="p-6 flex flex-col flex-1">
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                                    <div className="relative shrink-0">
                                                        <Avatar className="h-14 w-14 border-2 border-white shadow-md">
                                                            <AvatarFallback className="text-white font-bold text-lg" style={{
                                                                background: 'linear-gradient(to bottom right, #3b82f6, #9333ea)'
                                                            }}>{agent.avatar}</AvatarFallback>
                                                        </Avatar>
                                                        <div className={`absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-white shadow-sm ${(agent as any).status_id === 1 ? 'bg-emerald-500' : (agent as any).status_id === 3 ? 'bg-yellow-500' : 'bg-red-500'}`} />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <CardTitle className="text-base font-bold truncate leading-tight text-slate-800 mb-1">
                                                            {agent.name}
                                                        </CardTitle>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs text-slate-500 font-medium truncate">
                                                                {(() => {
                                                                    // Buscar o template pelo role_template_id para exibir o role
                                                                    const templateId = (agent as any).role_template_id
                                                                    if (!templateId) return "Sem template"
                                                                    const template = templates.find(t => t.id === templateId)
                                                                    return template?.role || "Template não encontrado"
                                                                })()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <div className="flex -space-x-1.5">
                                                        {agent.channels?.slice(0, 3).map(c => (
                                                            <div key={c} className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center shadow-sm border border-slate-200 text-slate-600 p-1.5" title={c}>
                                                                {getChannelIcon(c)}
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-slate-100 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            {(agent as any).status_id !== 1 && (
                                                                <DropdownMenuItem onClick={() => handleReactivateAgent(agent.id)}>
                                                                    <Play className="mr-2 h-4 w-4 text-emerald-500" />
                                                                    Reativar
                                                                </DropdownMenuItem>
                                                            )}
                                                            {(agent as any).status_id === 1 && (
                                                                <DropdownMenuItem onClick={() => handlePauseAgent(agent.id)}>
                                                                    <Pause className="mr-2 h-4 w-4 text-yellow-500" />
                                                                    Pause
                                                                </DropdownMenuItem>
                                                            )}
                                                            <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteAgent(agent.id)}>
                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                Delete Agent
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </div>

                                            <div className="mb-4">
                                                <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
                                                    {(() => {
                                                        // Buscar o template pelo role_template_id do agente
                                                        // O campo 'role' da tabela tb_agents_templates contém o role do template
                                                        const templateId = (agent as any).role_template_id
                                                        if (!templateId) {
                                                            return "Nenhum template atribuído."
                                                        }
                                                        const template = templates.find(t => t.id === templateId)
                                                        // Retornar o campo 'role' da tabela tb_agents_templates
                                                        return template?.role || "Template não encontrado"
                                                    })()}
                                                </p>
                                            </div>

                                            <div className="pt-4 border-t border-slate-200/50 mt-auto">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <Globe className="h-4 w-4 text-slate-400" />
                                                    <span className="text-xs text-slate-500 font-medium uppercase tracking-tight">
                                                        {agent.languages?.join(", ") || "EN"}
                                                    </span>
                                                </div>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="w-full h-9 rounded-xl border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-all font-medium text-xs"
                                                    onClick={() => navigate(`agent-config?id=${agent.id}`)}
                                                >
                                                    <Settings className="h-3.5 w-3.5 mr-1.5" />
                                                    Gerenciar
                                                </Button>
                                            </div>
                                        </div>
                                    </Card>
                                ))}

                            <Button
                                variant="outline"
                                onClick={() => setIsCreateOpen(true)}
                                className="h-full min-h-[280px] flex flex-col gap-4 border-dashed hover:border-primary/50 hover:bg-accent/5"
                            >
                                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                                    <Plus className="h-6 w-6 text-muted-foreground" />
                                </div>
                                <div className="space-y-1 text-center">
                                    <h3 className="font-semibold">Deploy New Agent</h3>
                                    <p className="text-sm text-muted-foreground">Start from a template</p>
                                </div>
                            </Button>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="templates" className="mt-6">
                    {templatesLoading ? (
                        <div className="flex h-40 items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : templates.length === 0 ? (
                        <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20">
                            <Bot className="h-10 w-10 text-muted-foreground" />
                            <h3 className="mt-4 text-lg font-semibold">No templates available</h3>
                            <p className="mt-2 text-sm text-muted-foreground mb-4">Create your first template to get started</p>
                            <Button onClick={() => setIsCreateTemplateOpen(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Create Template
                            </Button>
                        </div>
                    ) : (
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {templates.map((template) => {
                                const IconComponent = template.IconComponent || getTemplateIcon(template.icon)
                                return (
                                    <Card 
                                        key={template.id} 
                                        className="group relative overflow-hidden h-full min-h-[280px] transition-all border-0 shadow-md cursor-pointer flex flex-col" 
                                        style={{
                                            background: 'linear-gradient(to bottom right, #e0f2fe, #dbeafe)'
                                        }} 
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = 'translateY(-8px)'
                                            e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(59, 130, 246, 0.15), 0 10px 10px -5px rgba(59, 130, 246, 0.1)'
                                        }} 
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'translateY(0)'
                                            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                                        }}
                                    >
                                        <div className="p-6 flex flex-col flex-1">
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                                    <div className="relative shrink-0">
                                                        <Avatar className="h-14 w-14 border-2 border-white shadow-md">
                                                            <AvatarFallback className="text-white font-bold text-lg" style={{
                                                                background: 'linear-gradient(to bottom right, #3b82f6, #9333ea)'
                                                            }}>
                                                                {template.name.charAt(0).toUpperCase()}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <CardTitle className="text-base font-bold truncate leading-tight text-slate-800 mb-1">
                                                            {template.name}
                                                        </CardTitle>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs text-slate-500 font-medium truncate">
                                                                {template.role}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <Badge 
                                                        variant="outline" 
                                                        className="text-xs px-2 py-1 border-slate-300 text-slate-600 bg-white/50"
                                                    >
                                                        {template.complexity}
                                                    </Badge>
                                                </div>
                                            </div>

                                            <div className="mb-4">
                                                <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
                                                    {template.description || "Sem descrição disponível."}
                                                </p>
                                            </div>

                                            <div className="pt-4 border-t border-slate-200/50 mt-auto">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="w-full h-9 rounded-xl border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-all font-medium text-xs"
                                                    onClick={() => handleUseTemplate(template)}
                                                >
                                                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                                                    Usar Template
                                                </Button>
                                            </div>
                                        </div>
                                    </Card>
                                )
                            })}

                            <Button
                                variant="outline"
                                onClick={() => setIsCreateTemplateOpen(true)}
                                className="h-full min-h-[280px] flex flex-col gap-4 border-dashed hover:border-primary/50 hover:bg-accent/5"
                            >
                                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                                    <Plus className="h-6 w-6 text-muted-foreground" />
                                </div>
                                <div className="space-y-1 text-center">
                                    <h3 className="font-semibold">Criar Template</h3>
                                    <p className="text-sm text-muted-foreground">Começar do zero</p>
                                </div>
                            </Button>
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    )
}
