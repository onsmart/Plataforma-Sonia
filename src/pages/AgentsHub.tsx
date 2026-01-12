import React, { useState, useEffect } from "react"
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
    Check
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
import { AgentService, Agent } from "../services/api"
import { AgentConfigSheet } from "../components/agents/AgentConfigSheet"
import { LiveMonitoring } from "../components/agents/LiveMonitoring"
import { supabase } from "../utils/supabase/client"

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
    const [newSkillInput, setNewSkillInput] = useState("")

    useEffect(() => {
        fetchAgents()
        fetchTemplates()
    }, [])

    const fetchAgents = async () => {
        setLoading(true)
        try {
            const data = await AgentService.listAgents()
            setAgents(data || [])
        } catch (err: any) {
            console.error("Error fetching agents:", err)
            setAgents([])
        } finally {
            setLoading(false)
        }
    }

    const fetchTemplates = async () => {
        setTemplatesLoading(true)
        try {
            const { data, error } = await supabase
                .from("vw_agents_templates_full")
                .select("*")
                .order("name")

            if (error) {
                console.error("Failed to load templates", error)
                setTemplates([])
            } else if (data) {
                // Mapear os dados da view para o formato esperado, incluindo o componente de ícone
                const mappedTemplates: AgentTemplate[] = data.map((template: any) => ({
                    id: template.id,
                    name: template.name,
                    role: template.role,
                    description: template.description,
                    skills: Array.isArray(template.skills) ? template.skills : (template.skills ? [template.skills] : []),
                    icon: template.icon || "bot",
                    defaultChannels: Array.isArray(template.defaultChannels) 
                        ? template.defaultChannels 
                        : (template.defaultChannels ? [template.defaultChannels] : ["webchat"]),
                    complexity: template.complexity || "Intermediate",
                    IconComponent: getTemplateIcon(template.icon)
                }))
                setTemplates(mappedTemplates)
            }
        } catch (err: any) {
            console.error("Error fetching templates:", err)
            setTemplates([])
        } finally {
            setTemplatesLoading(false)
        }
    }

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
        setIsSubmitting(true)
        try {
            await AgentService.createAgent({
                name: newAgent.name,
                role: newAgent.role,
                description: newAgent.description,
                languages: [newAgent.primaryLanguage], // Future: Multi-language array
                channels: newAgent.selectedChannels,
                avatar: newAgent.name.charAt(0).toUpperCase()
            })
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
                console.error("Failed to create agent", error)
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

    const addSkill = () => {
        if (newSkillInput.trim() && !newTemplate.skills.includes(newSkillInput.trim())) {
            setNewTemplate(prev => ({
                ...prev,
                skills: [...prev.skills, newSkillInput.trim()]
            }))
            setNewSkillInput("")
        }
    }

    const removeSkill = (skill: string) => {
        setNewTemplate(prev => ({
            ...prev,
            skills: prev.skills.filter(s => s !== skill)
        }))
    }

    const handleCreateTemplate = async () => {
        setIsSubmittingTemplate(true)
        try {
            const { data, error } = await supabase.rpc('sp_create_agent_template', {
                p_name: newTemplate.name,
                p_role: newTemplate.role,
                p_description: newTemplate.description,
                p_icon: newTemplate.icon,
                p_complexity: newTemplate.complexity,
                p_channel_names: newTemplate.selectedChannels,
                p_skill_names: newTemplate.skills
            })

            if (error) {
                console.error("Failed to create template", error)
                throw error
            }

            // Recarregar templates
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
            setNewSkillInput("")
        } catch (error: any) {
            if (error.name !== 'TypeError' && error.message !== 'Failed to fetch') {
                console.error("Failed to create template", error)
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
                                        onValueChange={(val) => setNewAgent({ 
                                            ...newAgent, 
                                            role: val,
                                            description: val === "SDR" ? "Qualifies inbound leads and books meetings." : "Resolves L1 support tickets autonomously."
                                        })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select role template" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Customer Support L1">Customer Support L1</SelectItem>
                                            <SelectItem value="SDR - Outbound">SDR - Outbound Prospecting</SelectItem>
                                            <SelectItem value="SDR - Inbound">SDR - Inbound Qualification</SelectItem>
                                            <SelectItem value="Technical Account Manager">Technical Account Manager</SelectItem>
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
                                <Label htmlFor="template-name" className="text-right">
                                    Name
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
                                <Label htmlFor="template-role" className="text-right">
                                    Role
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
                                <Label htmlFor="template-description" className="text-right">
                                    Description
                                </Label>
                                <Textarea
                                    id="template-description"
                                    value={newTemplate.description}
                                    onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                                    className="col-span-3"
                                    placeholder="Brief description of the template..."
                                />
                            </div>

                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="template-icon" className="text-right">
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
                                <Label htmlFor="template-complexity" className="text-right">
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
                                <Label className="text-right pt-2">
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
                                <Label className="text-right pt-2">
                                    Skills
                                </Label>
                                <div className="col-span-3 space-y-2">
                                    <div className="flex gap-2">
                                        <Input
                                            value={newSkillInput}
                                            onChange={(e) => setNewSkillInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault()
                                                    addSkill()
                                                }
                                            }}
                                            placeholder="Add a skill..."
                                            className="flex-1"
                                        />
                                        <Button type="button" onClick={addSkill} variant="outline" size="sm">
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {newTemplate.skills.map(skill => (
                                            <Badge key={skill} variant="secondary" className="gap-1">
                                                {skill}
                                                <button
                                                    onClick={() => removeSkill(skill)}
                                                    className="ml-1 hover:text-destructive"
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

            <Tabs defaultValue="active">
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
