
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
    Link as LinkIcon
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
import { AgentService, Agent } from "../services/api"
import { AgentConfigSheet } from "../components/agents/AgentConfigSheet"
import { LiveMonitoring } from "../components/agents/LiveMonitoring"
import { supabase } from "../utils/supabase/client"
import { InfoTooltip } from "../components/ui/infoTooltip"
import { useAuth } from "../contexts/AuthContext"
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

    // Config Sheet State
    const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
    const [isConfigOpen, setIsConfigOpen] = useState(false)

    // New Agent Form State
    const [newAgent, setNewAgent] = useState({
        name: "",
        role: "",
        description: "",
        primaryLanguage: "EN",
        integrationId: "",
        crmIntegrationId: ""
    })

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
        if (!userId) return
        setCrmIntegrationsLoading(true)
        try {
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
                .eq('user_id', userId)
                .eq('is_active', true)
                .order('created_at', { ascending: false })

            if (error) throw error
            setCrmIntegrations(data || [])
        } catch (err) {
            console.error("Error fetching CRM integrations:", err)
            setCrmIntegrations([])
        } finally {
            setCrmIntegrationsLoading(false)
        }
    }, [userId])

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
                        role: template?.role || template?.name || agent.role_template_id || '',
                        description: agent.bio || '',
                        status: status,
                        status_id: statusId, // Adicionar status_id ao objeto
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
            description: template.description,
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

    const handleOpenConfig = (agent: Agent) => {
        setSelectedAgent(agent)
        setIsConfigOpen(true)
    }

    const handleSaveConfig = async (id: string, updates: Partial<Agent>) => {
        try {
            await AgentService.updateAgent(id, updates)
            await fetchAgents() 
        } catch (error: any) {
            console.error("Failed to update config", error)
        }
    }

    const getChannelIcon = (channel: string) => {
        switch(channel) {
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
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Configuration Sheet */}
            <AgentConfigSheet 
                agent={selectedAgent} 
                isOpen={isConfigOpen} 
                onClose={() => setIsConfigOpen(false)}
                onSave={handleSaveConfig}
            />

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
                    <DialogContent className="sm:max-w-[550px]">
                        <DialogHeader>
                            <DialogTitle>Deploy Global Agent</DialogTitle>
                            <DialogDescription>
                                Configure identity, language, and integration for your new AI agent.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="name" className="text-right">
                                    Name
                                </Label>
                                <Input
                                    id="name"
                                    value={newAgent.name}
                                    onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                                    className="col-span-3"
                                    placeholder="e.g., Sarah Support"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="role" className="text-right">
                                    Role Template
                                </Label>
                                <div className="col-span-3">
                                    <Select 
                                        value={newAgent.role} 
                                        onValueChange={(val) => {
                                            const selectedTemplate = templates.find(t => t.id === val)
                                            setNewAgent({ 
                                                ...newAgent, 
                                                role: val,
                                                description: selectedTemplate?.description || ""
                                            })
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select role template" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {templates.length === 0 ? (
                                                <SelectItem value="none" disabled>
                                                    {templatesLoading ? "Loading templates..." : "No templates available"}
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
                            </div>
                            
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="language" className="text-right">
                                    Primary Language
                                </Label>
                                <div className="col-span-3">
                                    <Select 
                                        value={newAgent.primaryLanguage} 
                                        onValueChange={(val) => setNewAgent({ ...newAgent, primaryLanguage: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select language" />
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

                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right">
                                    Integration
                                </Label>
                                <div className="col-span-3">
                                    <Select 
                                        value={newAgent.integrationId} 
                                        onValueChange={(val) => setNewAgent({ ...newAgent, integrationId: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select primary integration" />
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
                            </div>

                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right">
                                    CRM
                                </Label>
                                <div className="col-span-3">
                                    <Select 
                                        value={newAgent.crmIntegrationId || "__none__"} 
                                        onValueChange={(val) => setNewAgent({ ...newAgent, crmIntegrationId: val === "__none__" ? "" : val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione um CRM (opcional)" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__none__">Nenhum CRM</SelectItem>
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
                            </div>

                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="description" className="text-right">
                                    Bio
                                </Label>
                                <Textarea
                                    id="description"
                                    value={newAgent.description}
                                    onChange={(e) => setNewAgent({ ...newAgent, description: e.target.value })}
                                    className="col-span-3"
                                    placeholder="Brief description of responsibilities..."
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="submit" onClick={handleCreateAgent} disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Deploy Agent
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Create Template Dialog */}
                <Dialog open={isCreateTemplateOpen} onOpenChange={setIsCreateTemplateOpen}>
                    <DialogContent className="sm:max-w-[550px]">
                        <DialogHeader>
                            <DialogTitle>Create Agent Template</DialogTitle>
                            <DialogDescription>
                                Configure a new template that can be reused to create agents.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="template-name" className="text-right flex items-center justify-end gap-1">
                                    Name
                                    <InfoTooltip text="Nome identificador do template." />
                                </Label>
                                <Input
                                    id="template-name"
                                    value={newTemplate.name}
                                    onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                                    className="col-span-3"
                                    placeholder="e.g., Support Agent L1"
                                />
                            </div>
                            
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="template-role" className="text-right flex items-center justify-end gap-1">
                                    Role
                                    <InfoTooltip text="Função ou papel do agente." />
                                </Label>
                                <Input
                                    id="template-role"
                                    value={newTemplate.role}
                                    onChange={(e) => setNewTemplate({ ...newTemplate, role: e.target.value })}
                                    className="col-span-3"
                                    placeholder="e.g., Customer Support"
                                />
                            </div>

                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="template-description" className="text-right flex items-center justify-end gap-1">
                                    Script
                                    <InfoTooltip text="Prompt do sistema para o agente." />
                                </Label>
                                <Textarea
                                    id="template-description"
                                    value={newTemplate.description}
                                    onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                                    className="col-span-3"
                                    placeholder="You are a sales agent..."
                                />
                            </div>

                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="template-icon" className="text-right flex items-center justify-end gap-1">
                                    Icon
                                </Label>
                                <div className="col-span-3">
                                    <Select 
                                        value={newTemplate.icon} 
                                        onValueChange={(val) => setNewTemplate({ ...newTemplate, icon: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select icon" />
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
                            </div>

                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="template-complexity" className="text-right flex items-center justify-end gap-1">
                                    Complexity
                                </Label>
                                <div className="col-span-3">
                                    <Select 
                                        value={newTemplate.complexity} 
                                        onValueChange={(val: "Simple" | "Intermediate" | "Advanced") => setNewTemplate({ ...newTemplate, complexity: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select complexity" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Simple">Simple</SelectItem>
                                            <SelectItem value="Intermediate">Intermediate</SelectItem>
                                            <SelectItem value="Advanced">Advanced</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-4 items-start gap-4">
                                <Label className="text-right pt-2 flex items-start justify-end gap-1">
                                    Channels
                                </Label>
                                <div className="col-span-3 grid grid-cols-3 gap-2">
                                    {AVAILABLE_CHANNELS.map(channel => {
                                        const isSelected = newTemplate.selectedChannels.includes(channel.id)
                                        return (
                                            <div 
                                                key={channel.id}
                                                onClick={() => toggleTemplateChannel(channel.id)}
                                                className={`
                                                    cursor-pointer rounded-md border p-2 flex flex-col items-center justify-center gap-2 text-xs transition-all
                                                    ${isSelected 
                                                        ? "border-primary bg-primary/5 text-primary ring-1 ring-primary" 
                                                        : "border-muted hover:border-primary/50 hover:bg-accent"
                                                    }
                                                `}
                                            >
                                                <channel.icon className={`h-4 w-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                                                <span className="font-medium">{channel.name}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            <div className="grid grid-cols-4 items-start gap-4">
                                <Label className="text-right pt-2 flex items-start justify-end gap-1">
                                    Skills
                                </Label>
                                <div className="col-span-3 space-y-2">
                                    <Popover open={skillsComboboxOpen} onOpenChange={setSkillsComboboxOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={skillsComboboxOpen}
                                                className="w-full justify-between"
                                            >
                                                <span className="text-muted-foreground">Select a skill...</span>
                                                <Plus className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                            <Command>
                                                <CommandInput placeholder="Search skills..." />
                                                <CommandList>
                                                    {skillsLoading ? (
                                                        <div className="flex items-center justify-center p-4">
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <CommandEmpty>No skills found.</CommandEmpty>
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
                                                                                className={`mr-2 h-4 w-4 ${
                                                                                    newTemplate.skills.includes(skill.name) ? "opacity-100" : "opacity-0"
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
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" onClick={handleCreateTemplate} disabled={isSubmittingTemplate || !newTemplate.name || !newTemplate.role}>
                                {isSubmittingTemplate && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Create Template
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-5">
                {channelsData.map((channel, i) => (
                    <Card key={i} className="flex flex-col justify-center p-4 h-24">
                        <div className="flex items-center gap-3">
                            <channel.icon className={`h-8 w-8 ${channel.color}`} />
                            <div className="flex flex-col">
                                <span className="text-sm font-medium">{channel.name}</span>
                                <div className="flex items-center gap-1.5">
                                    <div className={`h-2 w-2 rounded-full ${
                                        channel.status === 'connected' ? 'bg-emerald-500' : 
                                        channel.status === 'partial' ? 'bg-yellow-500' : 'bg-red-500'
                                    }`} />
                                    <span className="text-xs text-muted-foreground capitalize">{channel.status}</span>
                                </div>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value)}>
                <TabsList>
                    <TabsTrigger value="active">Active Workforce</TabsTrigger>
                    <TabsTrigger value="templates">Templates</TabsTrigger>
                    <TabsTrigger value="monitoring">Live Monitoring</TabsTrigger>
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
                                <Card key={agent.id} className="flex flex-col">
                                    <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
                                        <div className="flex items-center gap-3">
                                            <Avatar>
                                                <AvatarFallback>{agent.avatar}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <CardTitle className="text-base">{agent.name}</CardTitle>
                                                <CardDescription className="text-xs">{agent.role}</CardDescription>
                                            </div>
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <span className="sr-only">Open menu</span>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => handleOpenConfig(agent)}>
                                                    <Settings className="mr-2 h-4 w-4" />
                                                    Configuration
                                                </DropdownMenuItem>
                                                <DropdownMenuItem>
                                                    <BarChart3 className="mr-2 h-4 w-4" />
                                                    View Analytics
                                                </DropdownMenuItem>
                                                {(agent as any).status_id !== 1 && (
                                                    <DropdownMenuItem onClick={() => handleReactivateAgent(agent.id)}>
                                                        <Play className="mr-2 h-4 w-4" />
                                                        Reativar
                                                    </DropdownMenuItem>
                                                )}
                                                {(agent as any).status_id === 1 && (
                                                    <DropdownMenuItem onClick={() => handlePauseAgent(agent.id)}>
                                                        <Pause className="mr-2 h-4 w-4" />
                                                        Pause
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteAgent(agent.id)}>
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Delete Agent
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </CardHeader>
                                    <CardContent className="flex-1 space-y-4 pt-4">
                                        <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px]">
                                            {agent.description}
                                        </p>
                                        
                                        <div className="flex items-center gap-4 text-sm">
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Globe className="h-3.5 w-3.5" />
                                                <span className="text-xs">{agent.languages?.join(", ") || "EN"}</span>
                                            </div>
                                            <Separator orientation="vertical" className="h-4" />
                                            <div className="flex items-center gap-2">
                                                {agent.channels?.map(c => (
                                                    <div key={c} className="text-muted-foreground" title={c}>
                                                        {getChannelIcon(c)}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </CardContent>
                                    <CardFooter className="pt-2 pb-4">
                                        <div className="flex items-center justify-between w-full">
                                            <Badge 
                                                className={
                                                    (agent as any).status_id === 1 
                                                        ? "bg-emerald-500 text-white hover:bg-emerald-600 border-transparent" 
                                                        : (agent as any).status_id === 2
                                                        ? "bg-red-500 text-white hover:bg-red-600 border-transparent"
                                                        : (agent as any).status_id === 3
                                                        ? "bg-yellow-500 text-white hover:bg-yellow-600 border-transparent"
                                                        : agent.status === 'active'
                                                        ? "bg-emerald-500 text-white hover:bg-emerald-600 border-transparent"
                                                        : "bg-red-500 text-white hover:bg-red-600 border-transparent"
                                                }
                                            >
                                                {(agent as any).status_id === 1 
                                                    ? 'Conectado' 
                                                    : (agent as any).status_id === 2
                                                    ? 'Cancelado'
                                                    : (agent as any).status_id === 3
                                                    ? 'Pausado'
                                                    : agent.status === 'active' 
                                                    ? 'Running' 
                                                    : 'Paused'}
                                            </Badge>
                                            <Button variant="ghost" size="sm" className="gap-2 text-xs">
                                                View Logs
                                            </Button>
                                        </div>
                                    </CardFooter>
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
                        </div>
                    ) : (
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                            {templates.map((template) => {
                                const IconComponent = template.IconComponent || getTemplateIcon(template.icon)
                                return (
                                    <Card key={template.id} className="flex flex-col hover:border-primary/50 transition-colors group">
                                        <CardHeader>
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                                                    <IconComponent className="h-6 w-6 text-primary" />
                                                </div>
                                                <Badge variant="outline">{template.complexity}</Badge>
                                            </div>
                                            <CardTitle className="text-lg">{template.name}</CardTitle>
                                            <CardDescription className="text-xs">{template.role}</CardDescription>
                                        </CardHeader>
                                        <CardContent className="flex-1 space-y-4">
                                            <p className="text-sm text-muted-foreground line-clamp-3">
                                                {template.description}
                                            </p>
                                        </CardContent>
                                        <CardFooter className="pt-2">
                                            <Button className="w-full gap-2" variant="outline" onClick={() => handleUseTemplate(template)}>
                                                <Plus className="h-4 w-4" />
                                                Use Template
                                            </Button>
                                        </CardFooter>
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
                                    <h3 className="font-semibold">Create New Template</h3>
                                    <p className="text-sm text-muted-foreground">Add a custom agent template</p>
                                </div>
                            </Button>
                        </div>
                    )}
                </TabsContent>
                
                <TabsContent value="monitoring" className="mt-6">
                    <LiveMonitoring />
                </TabsContent>
            </Tabs>
        </div>
    )
}
