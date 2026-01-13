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
    User
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
    IconComponent?: any // Componente React do ícone
}

export function AgentsHub() {
    const { userId, user } = useAuth()
    
    const [agents, setAgents] = useState<Agent[]>([])
    const [templates, setTemplates] = useState<AgentTemplate[]>([])
    const [loading, setLoading] = useState(true)
    const [templatesLoading, setTemplatesLoading] = useState(true)
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
        selectedChannels: ["webchat"]
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
    
    // Refs para controlar carregamento inicial e evitar chamadas frequentes
    const hasLoadedInitialData = useRef(false)
    const lastActiveTab = useRef<string>("active")
    

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
        console.log("[fetchAgents] Called, userId:", userId, "user.email:", user?.email)
        
        // Verificar se user.email está disponível (mesmo padrão de fetchTemplates)
        if (!user?.email) {
            console.warn("[fetchAgents] User email not available, skipping fetch")
            setLoading(false)
            setAgents([])
            return
        }
        
        console.log("[fetchAgents] Starting fetch for email:", user.email)
        setLoading(true)
        try {
            const { data, error } = await supabase.rpc('sp_list_agents_by_email', {
                p_email: user.email
            })
            
            console.log("[fetchAgents] RPC response:", { data, error })
            
            if (error) {
                console.error("[fetchAgents] Failed to load agents", error)
                setAgents([])
            } else {
                // Mapear os dados retornados da RPC para o formato Agent
                // RPC retorna: id, nome, role_template_id, primary_language, channels, bio
                const rows = Array.isArray(data) ? data : (data ? [data] : [])
                
                const mappedAgents: Agent[] = rows.map((agent: any) => {
                    // Buscar o nome do template baseado no role_template_id se disponível
                    const template = agent.role_template_id 
                        ? templates.find(t => t.id === agent.role_template_id)
                        : null
                    
                    return {
                        id: agent.id,
                        name: agent.nome || '',
                        role: template?.role || template?.name || agent.role_template_id || '',
                        description: agent.bio || '',
                        status: 'active' as const,
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
                
                console.log("[fetchAgents] Mapped agents:", mappedAgents.length)
                setAgents(mappedAgents)
            }
        } catch (err: any) {
            // AbortError é esperado quando componente é desmontado
            if (err?.name !== 'AbortError') {
                console.error("[fetchAgents] Error fetching agents:", err)
            }
            setAgents([])
        } finally {
            setLoading(false)
        }
    }, [user?.email, templates])

    // ============================================================================
    // FUNÇÃO: fetchTemplates
    // ============================================================================
    // PROBLEMA ORIGINAL:
    // - Return antes do finally quando havia erro, impedindo setTemplatesLoading(false)
    // - Não tratava todos os casos de retorno da RPC (null, objeto único, array vazio)
    // - AbortError não era tratado adequadamente
    // - Loading ficava infinito se a RPC retornasse formato inesperado
    //
    // CORREÇÃO:
    // - Removido return antes do finally (loading sempre finaliza)
    // - Tratamento robusto de todos os formatos de retorno da RPC
    // - AbortError tratado como esperado (não é erro crítico)
    // - Validação de dados antes do mapeamento
    // ============================================================================
    const fetchTemplates = useCallback(async () => {
        console.log("[fetchTemplates] Called, userId:", userId, "user:", user?.email)
        
        // Verificar se user e email estão disponíveis
        if (!user?.email) {
            console.warn("[fetchTemplates] User email not available, skipping fetch")
            setTemplates([])
            setTemplatesLoading(false)
            return
        }
        
        console.log("[fetchTemplates] Starting fetch for email:", user.email)
        setTemplatesLoading(true)
        try {
            console.log("[fetchTemplates] Calling RPC sp_agents_templates_full_by_email with email:", user.email)
            const { data, error } = await supabase.rpc('sp_agents_templates_full_by_email', {
                p_email: user.email
              })
              
            
            console.log("[fetchTemplates] RPC response:", { data, error })
          
            // CORREÇÃO: Tratar erro sem return antes do finally
            // Isso garante que setTemplatesLoading(false) sempre execute
            if (error) {
              console.error("Failed to load templates", error)
              setTemplates([])
            } else {
              // CORREÇÃO: Tratar todos os casos de retorno da RPC
              // A RPC pode retornar: null, [], objeto único, ou array
              let rows: any[] = [];
              
              if (data === null || data === undefined) {
                rows = [];
              } else if (Array.isArray(data)) {
                rows = data;
              } else if (typeof data === 'object') {
                // Objeto único retornado
                rows = [data];
              }
          
              if (rows.length === 0) {
                setTemplates([])
              } else {
                // CORREÇÃO: Mapear templates com validação robusta
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
            // CORREÇÃO: AbortError é esperado quando componente é desmontado
            // Não deve ser tratado como erro crítico
            if (err?.name !== 'AbortError') {
              console.error("Error fetching templates:", err)
            }
            setTemplates([])
        } finally {
            // CORREÇÃO: SEMPRE finalizar loading, mesmo em caso de erro
            setTemplatesLoading(false)
        }
    }, [user?.email])

    // Fetch skills apenas uma vez na montagem
    useEffect(() => {
        fetchSkills()
    }, [fetchSkills])

    // ============================================================================
    // useEffect: Carregamento inicial de Agents e Templates
    // ============================================================================
    // CORREÇÃO: Carregar apenas uma vez quando user.email estiver disponível
    // Não recarregar a cada mudança de fetchAgents/fetchTemplates
    // ============================================================================
    useEffect(() => {
        // Se user.email não existe, apenas limpar estados
        if (!user?.email) {
            setAgents([])
            setTemplates([])
            setLoading(false)
            setTemplatesLoading(false)
            hasLoadedInitialData.current = false
            return
        }
        
        // Carregar dados apenas na primeira vez que user.email estiver disponível
        if (!hasLoadedInitialData.current) {
            console.log("[AgentsHub] Initial load, calling fetchAgents and fetchTemplates")
            hasLoadedInitialData.current = true
            
            fetchAgents().catch((err) => {
                if (err?.name !== 'AbortError') {
                    console.error("Error in fetchAgents:", err)
                }
            })
            
            fetchTemplates().catch((err) => {
                if (err?.name !== 'AbortError') {
                    console.error("Error in fetchTemplates:", err)
                }
            })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.email])

    // useEffect: Recarregar quando mudar de aba
    // Apenas quando a aba mudar, não a cada render
    useEffect(() => {
        // Se a aba mudou, recarregar dados da aba ativa
        if (lastActiveTab.current !== activeTab && user?.email) {
            console.log("[AgentsHub] Tab changed from", lastActiveTab.current, "to", activeTab)
            lastActiveTab.current = activeTab
            
            if (activeTab === "active") {
                // Recarregar agents quando voltar para aba Active
                fetchAgents().catch((err) => {
                    if (err?.name !== 'AbortError') {
                        console.error("Error in fetchAgents:", err)
                    }
                })
            } else if (activeTab === "templates") {
                // Recarregar templates quando abrir aba Templates
                fetchTemplates().catch((err) => {
                    if (err?.name !== 'AbortError') {
                        console.error("Error in fetchTemplates:", err)
                    }
                })
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, user?.email])

    // useEffect: Carregar templates quando o dialog de criação de agente for aberto
    // Apenas se não houver templates carregados
    useEffect(() => {
        if (isCreateOpen && user?.email && templates.length === 0) {
            console.log("[AgentsHub] Create agent dialog opened, loading templates")
            fetchTemplates().catch((err) => {
                if (err?.name !== 'AbortError') {
                    console.error("Error in fetchTemplates:", err)
                }
            })
        }
    }, [isCreateOpen, user?.email])
    

    const handleUseTemplate = (template: AgentTemplate) => {
        setNewAgent({
            name: `${template.name} (Copy)`,
            role: template.role,
            description: template.description,
            primaryLanguage: "EN",
            selectedChannels: template.defaultChannels
        })
        setIsCreateOpen(true)
    }

    const handleCreateAgent = async () => {
        console.log("[handleCreateAgent] Called, user.email:", user?.email)
        
        // Verificar se user.email está disponível
        if (!user?.email) {
            console.error("[handleCreateAgent] User email not available")
            return
        }
        
        // Validar campos obrigatórios
        if (!newAgent.name.trim()) {
            console.error("[handleCreateAgent] Agent name is required")
            return
        }
        
        // Buscar o template selecionado para obter o role_template_id
        // newAgent.role agora contém o ID do template (alterado no Select)
        const selectedTemplate = templates.find(t => t.id === newAgent.role)
        
        if (!selectedTemplate) {
            console.error("[handleCreateAgent] Template not found for role ID:", newAgent.role)
            console.error("[handleCreateAgent] Available templates:", templates.map(t => ({ id: t.id, name: t.name, role: t.role })))
            return
        }
        
        console.log("[handleCreateAgent] Found template:", { id: selectedTemplate.id, name: selectedTemplate.name, role: selectedTemplate.role })
        
        setIsSubmitting(true)
        try {
            console.log("[handleCreateAgent] Calling RPC sp_create_agent_by_email with:", {
                email: user.email,
                nome: newAgent.name,
                role_template_id: selectedTemplate.id,
                primary_language: newAgent.primaryLanguage,
                bio: newAgent.description
            })
            
            const { data, error } = await supabase.rpc('sp_create_agent_by_email', {
                p_email: user.email,
                p_nome: newAgent.name.trim(),
                p_role_template_id: selectedTemplate.id,
                p_primary_language: newAgent.primaryLanguage,
                p_bio: newAgent.description || ''
            })
            
            console.log("[handleCreateAgent] RPC response:", { data, error, v_new_id: data?.v_new_id })
            
            if (error) {
                console.error("[handleCreateAgent] Failed to create agent", error)
                throw error
            }
            
            if (data?.v_new_id) {
                console.log("[handleCreateAgent] Agent created successfully with ID:", data.v_new_id)
            }
            
            // Recarregar agents
            await fetchAgents()
            setIsCreateOpen(false)
            setNewAgent({ 
                name: "", 
                role: "", 
                description: "", 
                primaryLanguage: "EN",
                selectedChannels: ["webchat"]
            })
        } catch (error: any) {
            if (error.name !== 'TypeError' && error.message !== 'Failed to fetch') {
                console.error("[handleCreateAgent] Error:", error)
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDeleteAgent = async (id: string) => {
        if (confirm("Are you sure you want to delete this agent?")) {
            await AgentService.deleteAgent(id)
            fetchAgents()
        }
    }

    const handleOpenConfig = (agent: Agent) => {
        setSelectedAgent(agent)
        setIsConfigOpen(true)
    }

    const handleSaveConfig = async (id: string, updates: Partial<Agent>) => {
        try {
            await AgentService.updateAgent(id, updates)
            await fetchAgents() // Refresh list to show new info if relevant
            // Note: Sheet closes automatically via onClose callback in component
        } catch (error: any) {
            if (error.name !== 'TypeError' && error.message !== 'Failed to fetch') {
                console.error("Failed to update config", error)
            }
        }
    }

    const toggleChannel = (channelId: string) => {
        setNewAgent(prev => {
            const current = prev.selectedChannels
            if (current.includes(channelId)) {
                return { ...prev, selectedChannels: current.filter(c => c !== channelId) }
            } else {
                return { ...prev, selectedChannels: [...current, channelId] }
            }
        })
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
        console.log("[handleCreateTemplate] Called, userId:", userId, "user.email:", user?.email)
        
        // Verificar se user.email está disponível (mesmo padrão de fetchTemplates)
        if (!user?.email) {
            console.error("[handleCreateTemplate] User email not available")
            return
        }
        
        setIsSubmittingTemplate(true)
        try {
            console.log("[handleCreateTemplate] Calling RPC sp_create_agent_template with:", {
                name: newTemplate.name,
                role: newTemplate.role,
                email: user.email
            })
            
            const { data, error } = await supabase.rpc('sp_create_agent_template', {
                p_name: newTemplate.name,
                p_role: newTemplate.role,
                p_description: newTemplate.description,
                p_icon: newTemplate.icon,
                p_complexity: newTemplate.complexity,
                p_channel_names: newTemplate.selectedChannels,
                p_skill_names: newTemplate.skills,
                p_email: user.email   // ⚠️ aqui era p_user_email, deve ser p_email
            });
            
            console.log("[handleCreateTemplate] RPC response:", { data, error })

            if (error) {
                console.error("[handleCreateTemplate] Failed to create template", error)
                throw error
            }

            // Recarregar templates
            console.log("[handleCreateTemplate] Reloading templates")
            await fetchTemplates()
            setIsCreateTemplateOpen(false)
            
            // Reset form
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
            if (error.name !== 'TypeError' && error.message !== 'Failed to fetch') {
                console.error("[handleCreateTemplate] Error:", error)
            }
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
                                Configure identity, language, and channels for your new AI agent.
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
                                            // Encontrar o template selecionado pelo ID (val é o template.id)
                                            const selectedTemplate = templates.find(t => t.id === val)
                                            setNewAgent({ 
                                                ...newAgent, 
                                                role: selectedTemplate?.id || val, // Armazenar o ID do template
                                                description: selectedTemplate?.description || (val === "SDR" ? "Qualifies inbound leads and books meetings." : "Resolves L1 support tickets autonomously."),
                                                selectedChannels: selectedTemplate?.defaultChannels || newAgent.selectedChannels
                                            })
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select role template" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {templates.length === 0 ? (
                                                <SelectItem value="" disabled>
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
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                        Agent will automatically detect other languages if "Polyglot Mode" is enabled in settings.
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-4 items-start gap-4">
                                <Label className="text-right pt-2">
                                    Channels
                                </Label>
                                <div className="col-span-3 grid grid-cols-3 gap-2">
                                    {AVAILABLE_CHANNELS.map(channel => {
                                        const isSelected = newAgent.selectedChannels.includes(channel.id)
                                        return (
                                            <div 
                                                key={channel.id}
                                                onClick={() => toggleChannel(channel.id)}
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
                                    <InfoTooltip text="Nome identificador do template que será exibido na lista de templates. Use um nome descritivo e claro, como 'Support Agent L1' ou 'SDR Outbound Hunter'." />
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
                                    <InfoTooltip text="Função ou papel do agente no contexto organizacional. Exemplos: 'Customer Support', 'Sales Development Rep', 'Lead Qualification', 'Internal Support'." />
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
                                    <InfoTooltip text="Ex.: You are a sales agent who qualifies leads, schedules meetings, and responds professionally and politely." />
                                </Label>
                                <Textarea
                                    id="template-description"
                                    value={newTemplate.description}
                                    onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                                    className="col-span-3"
                                    placeholder="Ex.: You are a sales agent who qualifies leads, schedules meetings, and responds professionally and politely."
                                />
                            </div>

                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="template-icon" className="text-right flex items-center justify-end gap-1">
                                    Icon
                                    <InfoTooltip text="Ícone visual que representa o template na interface. Escolha um ícone que reflita a função do agente: Users para suporte, Bar Chart para análise, Settings para técnico, etc." />
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
                                    <InfoTooltip text="Nível de complexidade do template: Simple (tarefas básicas e diretas), Intermediate (requer múltiplas habilidades e integrações), Advanced (operações complexas com múltiplos sistemas e lógica avançada)." />
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
                                    <InfoTooltip text="Canais de comunicação onde o agente estará disponível. Selecione todos os canais onde este template será usado: Webchat para atendimento web, WhatsApp para mensagens, Email para suporte por email, LinkedIn para prospecção, etc." />
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
                                    <InfoTooltip text="Habilidades e capacidades específicas do agente. Selecione as skills disponíveis no sistema que definem o que este agente pode fazer, como 'Ticket Triage', 'KB Search (RAG)', 'Calendar Booking', 'CRM Sync', etc." />
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

            <Tabs value={activeTab} onValueChange={(value) => {
                setActiveTab(value)
            }}>
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

                                        <div className="grid grid-cols-3 gap-2 py-2 border-t border-b bg-muted/20 rounded-md px-2 mt-2">
                                            {Object.entries(agent.metrics || {}).map(([key, value]) => (
                                                <div key={key} className="flex flex-col items-center justify-center p-1">
                                                    <span className="text-lg font-bold tracking-tight">{value}</span>
                                                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                    <CardFooter className="pt-2 pb-4">
                                        <div className="flex items-center justify-between w-full">
                                            <Badge variant={agent.status === 'active' ? 'default' : 'secondary'} className={agent.status === 'active' ? 'bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 dark:text-emerald-400' : ''}>
                                                {agent.status === 'active' ? 'Running' : 'Paused'}
                                            </Badge>
                                            <Button variant="ghost" size="sm" className="gap-2 text-xs">
                                                View Logs
                                            </Button>
                                        </div>
                                    </CardFooter>
                                </Card>
                            ))}
                            
                            {/* Add New Placeholder */}
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
                            <p className="mb-4 text-sm text-muted-foreground">Templates will appear here once they are added to the database.</p>
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
                                                <Badge variant="outline" className="text-xs font-normal">{template.complexity}</Badge>
                                            </div>
                                            <CardTitle className="text-lg">{template.name}</CardTitle>
                                            <CardDescription className="text-xs">{template.role}</CardDescription>
                                        </CardHeader>
                                        <CardContent className="flex-1 space-y-4">
                                            <p className="text-sm text-muted-foreground line-clamp-3">
                                                {template.description}
                                            </p>
                                            <div className="space-y-2">
                                                <p className="text-[10px] font-medium uppercase text-muted-foreground">Key Capabilities</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {template.skills && template.skills.length > 0 ? (
                                                        template.skills.map(skill => (
                                                            <Badge key={skill} variant="secondary" className="text-[10px] px-1.5 py-0 h-5 font-normal bg-muted/50">
                                                                {skill}
                                                            </Badge>
                                                        ))
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">No skills defined</span>
                                                    )}
                                                </div>
                                            </div>
                                        </CardContent>
                                        <CardFooter className="pt-2">
                                            <Button className="w-full gap-2 group-hover:bg-primary group-hover:text-primary-foreground" variant="outline" onClick={() => handleUseTemplate(template)}>
                                                <Plus className="h-4 w-4" />
                                                Use Template
                                            </Button>
                                        </CardFooter>
                                    </Card>
                                )
                            })}
                            
                            {/* Add New Template Button */}
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
