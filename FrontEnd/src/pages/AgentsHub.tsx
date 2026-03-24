
import React, { useState, useEffect, useCallback, useRef } from "react"
import { useTranslation } from "react-i18next"
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
import { useTheme } from "next-themes"
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
    const { theme } = useTheme()
    const { userId, user } = useAuth()
    const { navigate } = useNavigation()
    const { t } = useTranslation('agentsHub')

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
    const isDark = theme === 'dark'
    const radius = {
        shell: '24px',
        card: '20px',
        inner: '16px',
        control: '14px',
        pill: '999px'
    }
    const pageShellStyle = {
        background: isDark
            ? 'radial-gradient(circle at top left, rgba(34, 211, 238, 0.08), transparent 22%), linear-gradient(180deg, #0b1120 0%, #0f172a 48%, #111827 100%)'
            : 'linear-gradient(180deg, #eef6ff 0%, #f7fbff 46%, #f8fafc 100%)'
    }
    const sectionShellStyle = {
        background: isDark ? 'rgba(15, 23, 42, 0.78)' : 'rgba(255, 255, 255, 0.92)',
        border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(148, 163, 184, 0.18)'}`,
        boxShadow: isDark
            ? '0 24px 60px -34px rgba(2, 6, 23, 0.95), inset 0 1px 0 rgba(255, 255, 255, 0.03)'
            : '0 24px 50px -34px rgba(15, 23, 42, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.72)',
        borderRadius: radius.shell,
        backdropFilter: 'blur(16px)'
    } as React.CSSProperties
    const mainButtonStyle = {
        background: isDark
            ? 'linear-gradient(135deg, #0891b2 0%, #2563eb 58%, #3b82f6 100%)'
            : 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)',
        color: '#f8fafc',
        border: '1px solid rgba(125, 211, 252, 0.28)',
        borderRadius: radius.control,
        boxShadow: isDark
            ? '0 18px 34px -20px rgba(14, 165, 233, 0.7), 0 0 0 1px rgba(125, 211, 252, 0.08)'
            : '0 16px 30px -22px rgba(37, 99, 235, 0.45)'
    } as React.CSSProperties
    const secondaryHeaderButtonStyle = {
        background: isDark ? 'rgba(15, 23, 42, 0.76)' : 'rgba(255, 255, 255, 0.92)',
        color: isDark ? '#e2e8f0' : '#0f172a',
        border: `1px solid ${isDark ? 'rgba(103, 232, 249, 0.18)' : 'rgba(37, 99, 235, 0.14)'}`,
        borderRadius: radius.control,
        boxShadow: isDark
            ? '0 18px 34px -24px rgba(2, 6, 23, 0.9), inset 0 1px 0 rgba(255,255,255,0.03)'
            : '0 14px 24px -20px rgba(15, 23, 42, 0.16)'
    } as React.CSSProperties
    const panelTone = isDark
        ? {
            card: 'linear-gradient(180deg, rgba(15, 23, 42, 0.96) 0%, rgba(17, 24, 39, 0.94) 100%)',
            elevated: 'rgba(15, 23, 42, 0.72)',
            muted: '#94a3b8',
            text: '#e2e8f0',
            title: '#f8fafc',
            border: 'rgba(148, 163, 184, 0.12)',
            hoverBorder: 'rgba(56, 189, 248, 0.26)'
        }
        : {
            card: 'linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(241, 245, 249, 0.98) 100%)',
            elevated: 'rgba(248, 250, 252, 0.9)',
            muted: '#64748b',
            text: '#0f172a',
            title: '#020617',
            border: 'rgba(148, 163, 184, 0.18)',
            hoverBorder: 'rgba(37, 99, 235, 0.22)'
        }

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
                    // status_id: 1 = ativo, 2 = cancelado, 3 = pausado, null/undefined = inativo
                    let status: 'active' | 'paused' | 'error' = 'paused' // Padrão: pausado/inativo
                    if (statusId === 1) {
                        status = 'active' // Conectado/Funcionando
                    } else if (statusId === 2) {
                        status = 'error' // Cancelado
                    } else if (statusId === 3 || statusId === 4) {
                        status = 'paused' // Pausado
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
            // ✅ USAR API DO BACKEND (inclui templates globais + da empresa)
            const { BASE_URL, getAuthHeaders } = await import('../services/api')
            
            const response = await fetch(`${BASE_URL}/templates?email=${encodeURIComponent(user.email)}`, {
                method: 'GET',
                headers: await getAuthHeaders()
            })

            if (!response.ok) {
                const error = await response.json().catch(() => ({}))
                console.error("Failed to load templates", error)
                setTemplates([])
                return
            }

            const data = await response.json()
            const rows: any[] = Array.isArray(data) ? data : []

            if (rows.length === 0) {
                setTemplates([])
            } else {
                // Processar templates para incluir skills e channels das tabelas relacionadas
                const processedTemplates = rows.map((template: any) => {
                    const skills = Array.isArray(template.skills) ? template.skills : []
                    const defaultChannels =
                        Array.isArray(template.defaultChannels) && template.defaultChannels.length > 0
                            ? template.defaultChannels
                            : ['webchat']

                    return {
                        id: template.id,
                        name: template.name || '',
                        role: template.role || '',
                        description: template.description || '',
                        skills: skills,
                        icon: template.icon || "bot",
                        defaultChannels: defaultChannels,
                        complexity: template.complexity || "Intermediate",
                        IconComponent: getTemplateIcon(template.icon)
                    }
                })

                setTemplates(processedTemplates)
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
            toast.error(t('errors.error'), {
                description: t('errors.emailNotFound')
            })
            return
        }

        if (!newAgent.name.trim()) {
            toast.error(t('errors.nameRequired'), {
                description: t('errors.nameRequiredDescription')
            })
            return
        }

        const selectedTemplate = templates.find(t => t.id === newAgent.role)
        if (!selectedTemplate) {
            toast.error(t('errors.templateNotSelected'), {
                description: t('errors.templateNotSelectedDescription')
            })
            return
        }

        if (!newAgent.description.trim()) {
            toast.error(t('errors.personalityRequired'), {
                description: t('errors.personalityRequiredDescription')
            })
            return
        }

        setIsSubmitting(true)
        try {
            // Usa o novo endpoint que verifica o plano antes de criar
            const { BASE_URL } = await import('../services/api')
            const { getAuthHeaders } = await import('../services/api')
            
            const response = await fetch(`${BASE_URL}/agents/create`, {
                method: 'POST',
                headers: await getAuthHeaders(),
                body: JSON.stringify({
                    email: user.email,
                    p_nome: newAgent.name.trim(),
                    p_role_template_id: selectedTemplate.id,
                    p_primary_language: newAgent.primaryLanguage,
                    p_bio: newAgent.description || '',
                    p_integrations_id: (newAgent.integrationId === "" || newAgent.integrationId === "none" || newAgent.integrationId === "loading") ? null : newAgent.integrationId
                })
            })

            const result = await response.json()

            if (!response.ok) {
                console.error("[handleCreateAgent] Erro:", result)

                // Tratamento específico por tipo de erro
                let errorMessage = t('errors.createAgent')
                let errorDescription = result.error || result.details || t('errors.unknownError')

                // Se for erro de plano, mostra mensagem específica
                if (response.status === 403 && result.upgradePlan) {
                    errorMessage = 'Limite de agentes atingido'
                    errorDescription = result.error || 'Você não tem permissão para criar mais agentes. Faça upgrade do seu plano.'
                } else if (result.error?.includes('não encontrado')) {
                    errorMessage = t('errors.resourceNotFound')
                    errorDescription = result.error
                } else if (result.error?.includes('Template')) {
                    errorMessage = t('errors.invalidTemplate')
                    errorDescription = result.error
                } else if (result.error?.includes('Usuário')) {
                    errorMessage = t('errors.userNotFound')
                    errorDescription = result.error
                }

                toast.error(errorMessage, {
                    description: errorDescription,
                    duration: 5000
                })
                return
            }

            // Sucesso
            toast.success(t('success.agentCreated'), {
                description: t('success.agentCreatedDescription', { name: newAgent.name.trim() })
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
            
            // Usa data do resultado
            const data = result.agent || result
        } catch (error: any) {
            console.error("[handleCreateAgent] Erro inesperado:", error)

            // Tratamento de erros não relacionados ao Supabase
            const errorMessage = error?.message || t('errors.unknownErrorCreatingAgent')

            toast.error(t('errors.createAgent'), {
                description: errorMessage,
                duration: 5000
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    const handlePauseAgent = async (id: string) => {
        try {
            // ✅ USAR API DO BACKEND ao invés de Supabase direto (protege com requireAdmin)
            const { BASE_URL, getAuthHeaders } = await import('../services/api')
            
            const response = await fetch(`${BASE_URL}/agents/${id}`, {
                method: 'PUT',
                headers: await getAuthHeaders(),
                body: JSON.stringify({
                    email: user?.email,
                    status_id: 3 // Pausar agente
                })
            })

            if (!response.ok) {
                let errorMessage = t('errors.pauseAgent')
                
                try {
                    const error = await response.json()
                    console.error('[handlePauseAgent] Erro ao pausar agente:', error)
                    
                    // Mensagem específica para não-admin
                    if (response.status === 403) {
                        errorMessage = error.error || error.details || 'Você não tem permissão para pausar agentes. Apenas administradores podem realizar esta ação.'
                    } else {
                        errorMessage = error.error || error.details || error.message || t('errors.pauseAgent')
                    }
                } catch (parseError) {
                    // Se não conseguir parsear o JSON, usar mensagem padrão
                    if (response.status === 403) {
                        errorMessage = 'Você não tem permissão para pausar agentes. Apenas administradores podem realizar esta ação.'
                    }
                }
                
                toast.error(errorMessage, {
                    duration: 5000
                })
                return
            }

            toast.success(t('success.agentPaused'))
            await fetchAgents()
        } catch (error: any) {
            console.error('[handlePauseAgent] Erro:', error)
            toast.error(error?.message || t('errors.pauseAgent'), {
                duration: 5000
            })
        }
    }

    const handleReactivateAgent = async (id: string) => {
        try {
            // ✅ Usar novo endpoint com validação
            await AgentService.activateAgent(id, user?.email)

            toast.success(t('success.agentReactivated'))
            await fetchAgents()
        } catch (error: any) {
            console.error('[handleReactivateAgent] Erro:', error)
            toast.error(t('errors.reactivateAgent'), {
                description: error.message || error.reason || 'Não foi possível ativar o agente'
            })
        }
    }

    const handleDeleteAgent = async (id: string) => {
        if (confirm(t('confirm.cancelAgent'))) {
            try {
                // ✅ USAR API DO BACKEND ao invés de Supabase direto (protege com requireAdmin)
                const { BASE_URL, getAuthHeaders } = await import('../services/api')
                
                const response = await fetch(`${BASE_URL}/agents/${id}`, {
                    method: 'PUT',
                    headers: await getAuthHeaders(),
                    body: JSON.stringify({
                        email: user?.email,
                        status_id: 2 // Cancelar agente
                    })
                })

                if (!response.ok) {
                    let errorMessage = t('errors.cancelAgent')
                    
                    try {
                        const error = await response.json()
                        console.error('[handleDeleteAgent] Erro ao cancelar agente:', error)
                        
                        // Mensagem específica para não-admin
                        if (response.status === 403) {
                            errorMessage = error.error || error.details || 'Você não tem permissão para cancelar agentes. Apenas administradores podem realizar esta ação.'
                        } else {
                            errorMessage = error.error || error.details || error.message || t('errors.cancelAgent')
                        }
                    } catch (parseError) {
                        // Se não conseguir parsear o JSON, usar mensagem padrão
                        if (response.status === 403) {
                            errorMessage = 'Você não tem permissão para cancelar agentes. Apenas administradores podem realizar esta ação.'
                        }
                    }
                    
                    toast.error(errorMessage, {
                        duration: 5000
                    })
                    return
                }

                toast.success(t('success.agentCancelled'))
                await fetchAgents()
            } catch (error: any) {
                console.error('[handleDeleteAgent] Erro:', error)
                toast.error(error?.message || t('errors.cancelAgent'), {
                    duration: 5000
                })
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

    const getChannelStatusMeta = (status: string) => {
        if (status === 'connected') {
            return {
                label: t('channels.status.connected'),
                badgeStyle: {
                    background: isDark ? 'rgba(16, 185, 129, 0.14)' : 'rgba(16, 185, 129, 0.12)',
                    color: '#6ee7b7',
                    border: '1px solid rgba(16, 185, 129, 0.22)'
                } as React.CSSProperties
            }
        }
        if (status === 'partial') {
            return {
                label: t('channels.status.partial'),
                badgeStyle: {
                    background: isDark ? 'rgba(245, 158, 11, 0.14)' : 'rgba(245, 158, 11, 0.12)',
                    color: '#fbbf24',
                    border: '1px solid rgba(245, 158, 11, 0.22)'
                } as React.CSSProperties
            }
        }
        return {
            label: t('channels.status.disconnected'),
            badgeStyle: {
                background: isDark ? 'rgba(239, 68, 68, 0.14)' : 'rgba(239, 68, 68, 0.1)',
                color: '#f87171',
                border: '1px solid rgba(239, 68, 68, 0.22)'
            } as React.CSSProperties
        }
    }

    const getChannelCardTone = (name: string, status: string) => {
        const base = isDark
            ? {
                background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.88) 0%, rgba(17, 24, 39, 0.96) 100%)',
                iconWrap: 'rgba(15, 23, 42, 0.88)',
                borderGlow: 'rgba(56, 189, 248, 0.14)',
                text: '#f8fafc',
                muted: '#94a3b8'
            }
            : {
                background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(241, 245, 249, 0.98) 100%)',
                iconWrap: 'rgba(248, 250, 252, 0.96)',
                borderGlow: 'rgba(37, 99, 235, 0.12)',
                text: '#0f172a',
                muted: '#64748b'
            }

        const channelColorMap: Record<string, string> = {
            'WhatsApp Business': '#10b981',
            'Web Widget': '#38bdf8',
            'Corporate Email': '#f59e0b',
            'LinkedIn Sales Nav': '#3b82f6',
            'VoIP Telephony': '#ef4444'
        }

        const accent = status === 'partial'
            ? '#f59e0b'
            : status === 'disconnected'
                ? '#ef4444'
                : (channelColorMap[name] || '#38bdf8')

        return { ...base, accent }
    }

    const getAgentStatusMeta = (statusId?: number | null) => {
        if (statusId === 1) {
            return {
                label: t('channels.status.connected'),
                dot: '#10b981',
                text: '#6ee7b7',
                surface: 'rgba(16, 185, 129, 0.12)'
            }
        }
        if (statusId === 3 || statusId === 4) {
            return {
                label: t('channels.status.partial'),
                dot: '#f59e0b',
                text: '#fbbf24',
                surface: 'rgba(245, 158, 11, 0.12)'
            }
        }
        return {
            label: t('channels.status.disconnected'),
            dot: '#ef4444',
            text: '#f87171',
            surface: 'rgba(239, 68, 68, 0.12)'
        }
    }

    const getComplexityMeta = (complexity: AgentTemplate["complexity"]) => {
        if (complexity === 'Advanced') {
            return {
                background: 'rgba(59, 130, 246, 0.14)',
                color: isDark ? '#93c5fd' : '#1d4ed8',
                border: '1px solid rgba(59, 130, 246, 0.22)'
            } as React.CSSProperties
        }
        if (complexity === 'Intermediate') {
            return {
                background: 'rgba(14, 165, 233, 0.12)',
                color: isDark ? '#67e8f9' : '#0f766e',
                border: '1px solid rgba(14, 165, 233, 0.2)'
            } as React.CSSProperties
        }
        return {
            background: 'rgba(148, 163, 184, 0.12)',
            color: isDark ? '#cbd5e1' : '#475569',
            border: '1px solid rgba(148, 163, 184, 0.18)'
        } as React.CSSProperties
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
            // ✅ USAR API DO BACKEND ao invés de Supabase direto (protege com requireAdmin)
            const { BASE_URL, getAuthHeaders } = await import('../services/api')
            
            const response = await fetch(`${BASE_URL}/templates`, {
                method: 'POST',
                headers: await getAuthHeaders(),
                body: JSON.stringify({
                    email: user.email,
                    p_name: newTemplate.name,
                    p_role: newTemplate.role,
                    p_description: newTemplate.description,
                    p_icon: newTemplate.icon,
                    p_complexity: newTemplate.complexity,
                    p_channel_names: newTemplate.selectedChannels,
                    p_skill_names: newTemplate.skills
                })
            })

            if (!response.ok) {
                let errorMessage = 'Erro ao criar template'
                
                try {
                    const error = await response.json()
                    console.error('[handleCreateTemplate] Erro ao criar template:', error)
                    
                    // Mensagem específica para não-admin
                    if (response.status === 403) {
                        errorMessage = error.error || error.details || 'Você não tem permissão para criar templates. Apenas administradores podem realizar esta ação.'
                    } else {
                        errorMessage = error.error || error.details || error.message || 'Erro ao criar template'
                    }
                } catch (parseError) {
                    // Se não conseguir parsear o JSON, usar mensagem padrão
                    if (response.status === 403) {
                        errorMessage = 'Você não tem permissão para criar templates. Apenas administradores podem realizar esta ação.'
                    }
                }
                
                toast.error(errorMessage, {
                    duration: 5000
                })
                return
            }

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
            
            toast.success('Template criado com sucesso!')
        } catch (error: any) {
            console.error("[handleCreateTemplate] Error:", error)
            toast.error(error?.message || 'Erro ao criar template', {
                duration: 5000
            })
        } finally {
            setIsSubmittingTemplate(false)
        }
    }

    return (
        <div
            className="min-h-screen -m-4 space-y-8 p-6 md:p-8 animate-in fade-in duration-500"
            style={pageShellStyle}
        >

            <div
                className="flex flex-col justify-between gap-8 px-8 py-8 md:flex-row md:items-center md:px-10 md:py-9 lg:px-11"
                style={sectionShellStyle}
            >
                <div className="max-w-3xl pr-2 md:pr-4">
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em]" style={{
                        background: isDark ? 'rgba(14, 165, 233, 0.1)' : 'rgba(37, 99, 235, 0.08)',
                        color: isDark ? '#67e8f9' : '#2563eb',
                        border: `1px solid ${isDark ? 'rgba(103, 232, 249, 0.16)' : 'rgba(37, 99, 235, 0.12)'}`
                    }}>
                        <Sparkles className="h-3.5 w-3.5" />
                        SONIA AGENT OPS
                    </div>
                    <h2 className="text-3xl font-semibold tracking-tight md:text-[2rem]" style={{ color: panelTone.title }}>{t('header.title')}</h2>
                    <p className="mt-4 max-w-3xl text-sm leading-7 md:text-[15px]" style={{ color: panelTone.muted }}>
                        {t('header.subtitleOverview')}
                    </p>
                </div>
                <div className="flex shrink-0 self-start gap-3 md:ml-6 md:self-center">
                    <Button
                        type="button"
                        className="h-12 gap-2 px-5 text-sm font-semibold transition-all duration-300"
                        style={secondaryHeaderButtonStyle}
                        onClick={() => setIsCreateTemplateOpen(true)}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-1px)'
                            e.currentTarget.style.boxShadow = isDark
                                ? '0 22px 36px -22px rgba(14, 165, 233, 0.22), inset 0 1px 0 rgba(255,255,255,0.04)'
                                : '0 18px 28px -20px rgba(37, 99, 235, 0.18)'
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)'
                            e.currentTarget.style.boxShadow = secondaryHeaderButtonStyle.boxShadow || ''
                        }}
                    >
                        <Sparkles className="h-4 w-4" />
                        {t('button.createTemplate')}
                    </Button>
                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button className="h-12 gap-2 px-5 text-sm font-semibold transition-all duration-300"
                        style={mainButtonStyle}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-1px)'
                            e.currentTarget.style.boxShadow = isDark
                                ? '0 22px 36px -18px rgba(14, 165, 233, 0.82), 0 0 0 1px rgba(125, 211, 252, 0.14)'
                                : '0 20px 34px -20px rgba(37, 99, 235, 0.5)'
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)'
                            e.currentTarget.style.boxShadow = mainButtonStyle.boxShadow || ''
                        }}>
                            <Plus className="h-4 w-4" />
                            {t('button.deployNewAgent')}
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
                            <DialogTitle style={{ color: theme === 'dark' ? '#e2e8f0' : '#0f172a' }}>{t('dialog.createAgent.title')}</DialogTitle>
                            <DialogDescription style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b' }}>
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
                                        return t('dialog.createAgent.progress.100')
                                    } else if (progress >= 75) {
                                        return t('dialog.createAgent.progress.75')
                                    } else if (progress >= 50) {
                                        return t('dialog.createAgent.progress.50')
                                    } else if (progress >= 25) {
                                        return t('dialog.createAgent.progress.25')
                                    }
                                    return t('dialog.createAgent.progress.0')
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
                                        <h3 className="text-base font-bold" style={{ color: theme === 'dark' ? '#e2e8f0' : '#0f172a' }}>{t('form.identity.title')}</h3>
                                        <p className="text-xs mt-0.5" style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b' }}>{t('form.identity.description')}</p>
                                    </div>
                                </div>
                                
                                <div className="space-y-2">
                                    <Label htmlFor="name" className="text-sm font-semibold" style={{ color: theme === 'dark' ? '#e2e8f0' : '#1e293b' }}>
                                        {t('form.identity.nameLabel')}
                                </Label>
                                <Input
                                    id="name"
                                    value={newAgent.name}
                                    onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                                        className="rounded-2xl bg-slate-50/80 border-slate-200/60 h-11 text-sm shadow-sm focus:bg-white focus:border-blue-300 transition-colors"
                                        placeholder={t('form.identity.namePlaceholder')}
                                />
                            </div>

                                <div className="space-y-2">
                                    <Label htmlFor="language" className="text-sm font-semibold" style={{ color: theme === 'dark' ? '#e2e8f0' : '#1e293b' }}>
                                        {t('form.identity.languageLabel')}
                                </Label>
                                    <Select
                                        value={newAgent.primaryLanguage}
                                        onValueChange={(val) => setNewAgent({ ...newAgent, primaryLanguage: val })}
                                    >
                                        <SelectTrigger className="rounded-2xl bg-slate-50/80 border-slate-200/60 h-11 shadow-sm focus:bg-white focus:border-blue-300 transition-colors">
                                            <SelectValue placeholder={t('form.identity.languagePlaceholder')} />
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
                                        <h3 className="text-base font-bold" style={{ color: theme === 'dark' ? '#e2e8f0' : '#0f172a' }}>{t('form.technical.title')}</h3>
                                        <p className="text-xs mt-0.5" style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b' }}>{t('form.technical.description')}</p>
                                    </div>
                                </div>
                                
                                <div className="space-y-2">
                                    <Label htmlFor="role" className="text-sm font-semibold" style={{ color: theme === 'dark' ? '#e2e8f0' : '#1e293b' }}>
                                        {t('form.technical.roleLabel')}
                                    </Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                className="w-full justify-between rounded-2xl bg-slate-50/80 border-slate-200/60 h-11 shadow-sm focus:bg-white focus:border-purple-300 transition-colors"
                                                style={{ 
                                                    backgroundColor: theme === 'dark' ? '#1e293b' : '#f8fafc',
                                                    borderColor: theme === 'dark' ? '#334155' : '#e2e8f0',
                                                    color: theme === 'dark' ? '#e2e8f0' : '#0f172a'
                                                }}
                                            >
                                                <span className="truncate">
                                                    {newAgent.role 
                                                        ? templates.find(t => t.id === newAgent.role)?.name + ' - ' + templates.find(t => t.id === newAgent.role)?.role
                                                        : t('form.technical.rolePlaceholder')}
                                                </span>
                                                <svg
                                                    className="ml-2 h-4 w-4 shrink-0 opacity-50"
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                >
                                                    <path d="m6 9 6 6 6-6" />
                                                </svg>
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-full p-0" align="start" style={{ width: 'var(--radix-popover-trigger-width)' }}>
                                            <Command>
                                                <CommandInput 
                                                    placeholder={t('form.technical.rolePlaceholder') || "Buscar template..."} 
                                                    className="h-9"
                                                />
                                                <CommandList>
                                                    <CommandEmpty>
                                                        {templatesLoading ? t('loading.templates') : t('empty.noTemplates')}
                                                    </CommandEmpty>
                                                    {templates.length > 0 && (
                                                        <CommandGroup>
                                                            {templates.map((template) => (
                                                                <CommandItem
                                                                    key={template.id}
                                                                    value={`${template.name} ${template.role}`}
                                                                    onSelect={() => {
                                                                        setNewAgent({
                                                                            ...newAgent,
                                                                            role: template.id
                                                                        })
                                                                    }}
                                                                    className="cursor-pointer"
                                                                >
                                                                    {template.name} - {template.role}
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    )}
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                            </div>

                                {/* Campos Opcionais em Accordion */}
                                <Accordion type="single" collapsible className="w-full">
                                    <AccordionItem value="advanced" className="border-none">
                                        <AccordionTrigger className="text-sm py-2" style={{ color: theme === 'dark' ? '#cbd5e1' : '#475569' }}>
                                            <span className="text-xs font-medium">{t('form.advanced.title')}</span>
                                        </AccordionTrigger>
                                        <AccordionContent className="space-y-4 pt-2">
                                            <div className="space-y-2">
                                                <Label className="text-sm font-semibold" style={{ color: theme === 'dark' ? '#e2e8f0' : '#1e293b' }}>
                                                    {t('form.advanced.communicationLabel')}
                                </Label>
                                    <Select
                                        value={newAgent.integrationId}
                                        onValueChange={(val) => setNewAgent({ ...newAgent, integrationId: val })}
                                    >
                                                    <SelectTrigger className="rounded-2xl bg-slate-50/80 border-slate-200/60 h-11 shadow-sm focus:bg-white focus:border-purple-300 transition-colors">
                                                        <SelectValue placeholder={t('form.advanced.communicationPlaceholder')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {integrationsLoading ? (
                                                <SelectItem value="loading" disabled>{t('loading.integrations')}</SelectItem>
                                            ) : integrations.length === 0 ? (
                                                <SelectItem value="none" disabled>{t('empty.noIntegrations')}</SelectItem>
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
                                                <Label className="text-sm font-semibold" style={{ color: theme === 'dark' ? '#e2e8f0' : '#1e293b' }}>
                                                    {t('form.advanced.crmLabel')}
                                </Label>
                                    <Select
                                        value={newAgent.crmIntegrationId || "__none__"}
                                        onValueChange={(val) => setNewAgent({ ...newAgent, crmIntegrationId: val === "__none__" ? "" : val })}
                                    >
                                                    <SelectTrigger className="rounded-2xl bg-slate-50/80 border-slate-200/60 h-11 shadow-sm focus:bg-white focus:border-purple-300 transition-colors">
                                                        <SelectValue placeholder={t('form.advanced.crmPlaceholder')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                                        <SelectItem value="__none__">{t('form.advanced.noCRM')}</SelectItem>
                                            {crmIntegrationsLoading ? (
                                                <SelectItem value="loading" disabled>{t('loading.crms')}</SelectItem>
                                            ) : crmIntegrations.length === 0 ? (
                                                <SelectItem value="none" disabled>{t('empty.noCRMs')}</SelectItem>
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
                                        <h3 className="text-base font-bold" style={{ color: theme === 'dark' ? '#e2e8f0' : '#0f172a' }}>{t('form.personality.title')}</h3>
                                        <p className="text-xs mt-0.5" style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b' }}>{t('form.personality.description')}</p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="description" className="text-sm font-semibold" style={{ color: theme === 'dark' ? '#e2e8f0' : '#1e293b' }}>
                                        {t('form.personality.behaviorLabel')}
                                    <InfoTooltip text={t('form.personality.behaviorTooltip')} />
                                </Label>
                                <Textarea
                                    id="description"
                                    value={newAgent.description}
                                    onChange={(e) => setNewAgent({ ...newAgent, description: e.target.value })}
                                        className="rounded-2xl bg-slate-50/80 border-slate-200/60 min-h-[100px] max-h-[100px] overflow-y-auto text-sm shadow-sm focus:bg-white focus:border-emerald-300 transition-colors"
                                    placeholder={t('form.personality.behaviorPlaceholder')}
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
                                            <span className="text-sm font-medium" style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b' }}>
                                                {t('form.progress.step', { current: currentStep, total: 4 })}
                                            </span>
                                            <span className="text-sm font-bold" style={{ color: '#06b6d4' }}>
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
                                                        ? 'linear-gradient(90deg, #06b6d4 0%, #0891b2 50%, #0e7490 100%)'
                                                        : 'linear-gradient(90deg, #06b6d4 0%, #0891b2 100%)',
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
                                                        background: 'linear-gradient(90deg, #06b6d4 0%, #22d3ee 50%, #06b6d4 100%)',
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
                                                    background: isComplete 
                                                        ? 'linear-gradient(135deg, #0891b2 0%, #22d3ee 100%)' 
                                                        : '#94a3b8',
                                                    color: '#ffffff',
                                                    border: 'none',
                                                    boxShadow: isComplete 
                                                        ? '0 10px 25px -5px rgba(8, 145, 178, 0.4), 0 0 20px rgba(34, 211, 238, 0.3)'
                                                        : 'none',
                                                    animation: isComplete 
                                                        ? 'buttonGlow 2s ease-in-out infinite, buttonPulse 2s ease-in-out infinite' 
                                                        : 'none',
                                                    transform: isComplete ? 'scale(1)' : 'scale(1)',
                                                    position: 'relative',
                                                    zIndex: 10
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (isComplete && !isSubmitting) {
                                                        e.currentTarget.style.boxShadow = '0 15px 35px -5px rgba(8, 145, 178, 0.5), 0 0 30px rgba(34, 211, 238, 0.4)'
                                                    }
                                                }}
                                                onMouseLeave={(e) => {
                                                    if (isComplete && !isSubmitting) {
                                                        e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(8, 145, 178, 0.4), 0 0 20px rgba(34, 211, 238, 0.3)'
                                                    }
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
                                                <span className="relative z-10 flex items-center" style={{ color: '#ffffff', fontWeight: '700', textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)' }}>
                                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" style={{ color: '#ffffff' }} />}
                                                    {isComplete && !isSubmitting && <Sparkles className="mr-2 h-4 w-4 animate-pulse" style={{ color: '#ffffff' }} />}
                                                    {t('button.createSonia')}
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
                                                ? 'linear-gradient(90deg, #0891b2 0%, #06b6d4 50%, #22d3ee 100%)'
                                                : 'linear-gradient(90deg, #0891b2 0%, #06b6d4 100%)',
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
                                                background: 'linear-gradient(90deg, #0891b2 0%, #06b6d4 50%, #22d3ee 100%)',
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
                            <DialogTitle style={{ color: theme === 'dark' ? '#f1f5f9' : '#0f172a' }}>{t('dialog.createTemplate.title')}</DialogTitle>
                            <DialogDescription style={{ color: theme === 'dark' ? '#cbd5e1' : '#64748b' }}>
                                {(() => {
                                    const progress = (() => {
                                        let completed = 0
                                        if (newTemplate.name.trim()) completed++
                                        if (newTemplate.role.trim()) completed++
                                        if (newTemplate.description.trim()) completed++
                                        return (completed / 3) * 100
                                    })()
                                    if (progress === 100) {
                                        return t('dialog.createTemplate.progress.100')
                                    } else if (progress >= 66) {
                                        return t('dialog.createTemplate.progress.66')
                                    } else if (progress >= 33) {
                                        return t('dialog.createTemplate.progress.33')
                                    }
                                    return t('dialog.createTemplate.progress.0')
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
                                        <h3 className="text-base font-bold" style={{ color: theme === 'dark' ? '#f1f5f9' : '#0f172a' }}>{t('form.template.identity.title')}</h3>
                                        <p className="text-xs mt-0.5" style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b' }}>{t('form.template.identity.description')}</p>
                                    </div>
                                </div>
                                
                                <div className="space-y-2">
                                    <Label htmlFor="template-name" className="text-sm font-semibold" style={{ color: theme === 'dark' ? '#f1f5f9' : '#1e293b' }}>
                                        {t('form.template.identity.nameLabel')}
                                </Label>
                                <Input
                                    id="template-name"
                                    value={newTemplate.name}
                                    onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                                        className="rounded-2xl bg-slate-50/80 border-slate-200/60 h-11 text-sm shadow-sm focus:bg-white focus:border-blue-300 transition-colors"
                                        placeholder={t('form.template.identity.namePlaceholder')}
                                />
                            </div>

                                <div className="space-y-2">
                                    <Label htmlFor="template-role" className="text-sm font-semibold" style={{ color: theme === 'dark' ? '#f1f5f9' : '#1e293b' }}>
                                        {t('form.template.identity.roleLabel')}
                                </Label>
                                <Input
                                    id="template-role"
                                    value={newTemplate.role}
                                    onChange={(e) => setNewTemplate({ ...newTemplate, role: e.target.value })}
                                        className="rounded-2xl bg-slate-50/80 border-slate-200/60 h-11 text-sm shadow-sm focus:bg-white focus:border-blue-300 transition-colors"
                                        placeholder={t('form.template.identity.rolePlaceholder')}
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
                                        <h3 className="text-base font-bold" style={{ color: theme === 'dark' ? '#f1f5f9' : '#0f172a' }}>{t('form.template.configuration.title')}</h3>
                                        <p className="text-xs mt-0.5" style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b' }}>{t('form.template.configuration.description')}</p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="template-description" className="text-sm font-semibold" style={{ color: theme === 'dark' ? '#f1f5f9' : '#1e293b' }}>
                                        {t('form.template.configuration.systemScriptLabel')}
                                        <InfoTooltip text={t('form.template.configuration.systemScriptTooltip')} />
                                </Label>
                                <Textarea
                                    id="template-description"
                                    value={newTemplate.description}
                                    onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                                        className="rounded-2xl bg-slate-50/80 border-slate-200/60 min-h-[150px] max-h-[150px] overflow-y-auto text-sm shadow-sm focus:bg-white focus:border-purple-300 transition-colors"
                                        placeholder={t('form.template.configuration.systemScriptPlaceholder')}
                                />
                            </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="template-icon" className="text-sm font-semibold" style={{ color: theme === 'dark' ? '#f1f5f9' : '#1e293b' }}>
                                            {t('form.template.configuration.iconLabel')}
                                </Label>
                                    <Select
                                        value={newTemplate.icon}
                                        onValueChange={(val) => setNewTemplate({ ...newTemplate, icon: val })}
                                    >
                                            <SelectTrigger className="rounded-2xl bg-slate-50/80 border-slate-200/60 h-11 shadow-sm focus:bg-white focus:border-purple-300 transition-colors">
                                                <SelectValue placeholder={t('form.template.configuration.iconPlaceholder')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="users">{t('form.template.configuration.icon.users')}</SelectItem>
                                            <SelectItem value="message-circle">{t('form.template.configuration.icon.messageCircle')}</SelectItem>
                                            <SelectItem value="bar-chart-3">{t('form.template.configuration.icon.barChart')}</SelectItem>
                                            <SelectItem value="settings">{t('form.template.configuration.icon.settings')}</SelectItem>
                                            <SelectItem value="bot">{t('form.template.configuration.icon.bot')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                            </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="template-complexity" className="text-sm font-semibold" style={{ color: theme === 'dark' ? '#f1f5f9' : '#1e293b' }}>
                                            {t('form.template.configuration.complexityLabel')}
                                </Label>
                                    <Select
                                        value={newTemplate.complexity}
                                        onValueChange={(val: "Simple" | "Intermediate" | "Advanced") => setNewTemplate({ ...newTemplate, complexity: val })}
                                    >
                                            <SelectTrigger className="rounded-2xl bg-slate-50/80 border-slate-200/60 h-11 shadow-sm focus:bg-white focus:border-purple-300 transition-colors">
                                                <SelectValue placeholder={t('form.template.configuration.complexityPlaceholder')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                                <SelectItem value="Simple">{t('form.template.configuration.complexity.simple')}</SelectItem>
                                                <SelectItem value="Intermediate">{t('form.template.configuration.complexity.intermediate')}</SelectItem>
                                                <SelectItem value="Advanced">{t('form.template.configuration.complexity.advanced')}</SelectItem>
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
                                        <AccordionTrigger className="text-sm py-2" style={{ color: theme === 'dark' ? '#94a3b8' : '#475569' }}>
                                            <span className="text-xs font-medium">{t('form.template.optional.title')}</span>
                                        </AccordionTrigger>
                                        <AccordionContent className="space-y-4 pt-2">
                                            <div className="space-y-2">
                                                <Label className="text-sm font-semibold" style={{ color: theme === 'dark' ? '#f1f5f9' : '#1e293b' }}>
                                                    {t('form.template.optional.channelsLabel')}
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
                                                <Label className="text-sm font-semibold" style={{ color: theme === 'dark' ? '#f1f5f9' : '#1e293b' }}>
                                                    {t('form.template.optional.skillsLabel')}
                                </Label>
                                    <Popover open={skillsComboboxOpen} onOpenChange={setSkillsComboboxOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={skillsComboboxOpen}
                                                            className="w-full justify-between rounded-2xl bg-slate-50/80 border-slate-200/60 h-11 shadow-sm focus:bg-white focus:border-purple-300 transition-colors"
                                            >
                                                            <span className="text-slate-500">{t('form.template.optional.skillsPlaceholder')}</span>
                                                <Plus className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                            <Command>
                                                            <CommandInput placeholder={t('form.template.optional.skillsSearch')} />
                                                <CommandList>
                                                    {skillsLoading ? (
                                                        <div className="flex items-center justify-center p-4">
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        </div>
                                                    ) : (
                                                        <>
                                                                        <CommandEmpty>{t('empty.noSkills')}</CommandEmpty>
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
                                                {t('form.progress.step', { current: currentStep, total: 3 })}
                                            </span>
                                            <span className="text-sm font-bold" style={{ color: '#06b6d4' }}>
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
                                                        ? 'linear-gradient(90deg, #0891b2 0%, #06b6d4 50%, #22d3ee 100%)'
                                                        : 'linear-gradient(90deg, #0891b2 0%, #06b6d4 100%)',
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
                                                        background: 'linear-gradient(90deg, #0891b2 0%, #06b6d4 50%, #22d3ee 100%)',
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
                                                    background: isComplete 
                                                        ? 'linear-gradient(135deg, #0891b2 0%, #22d3ee 100%)' 
                                                        : '#94a3b8',
                                                    color: '#ffffff',
                                                    border: 'none',
                                                    boxShadow: isComplete 
                                                        ? '0 10px 25px -5px rgba(8, 145, 178, 0.4), 0 0 20px rgba(34, 211, 238, 0.3)'
                                                        : 'none',
                                                    animation: isComplete 
                                                        ? 'buttonGlow 2s ease-in-out infinite, buttonPulse 2s ease-in-out infinite' 
                                                        : 'none',
                                                    transform: isComplete ? 'scale(1)' : 'scale(1)',
                                                    position: 'relative',
                                                    zIndex: 10
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (isComplete && !isSubmittingTemplate) {
                                                        e.currentTarget.style.boxShadow = '0 15px 35px -5px rgba(8, 145, 178, 0.5), 0 0 30px rgba(34, 211, 238, 0.4)'
                                                    }
                                                }}
                                                onMouseLeave={(e) => {
                                                    if (isComplete && !isSubmittingTemplate) {
                                                        e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(8, 145, 178, 0.4), 0 0 20px rgba(34, 211, 238, 0.3)'
                                                    }
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
                                                <span className="relative z-10 flex items-center" style={{ color: '#ffffff', fontWeight: '700', textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)' }}>
                                                    {isSubmittingTemplate && <Loader2 className="mr-2 h-4 w-4 animate-spin" style={{ color: '#ffffff' }} />}
                                                    {isComplete && !isSubmittingTemplate && <Sparkles className="mr-2 h-4 w-4 animate-pulse" style={{ color: '#ffffff' }} />}
                                                    {t('button.createTemplate')}
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
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                {channelsData.map((channel, i) => {
                    const statusMeta = getChannelStatusMeta(channel.status)
                    const channelTone = getChannelCardTone(channel.name, channel.status)
                    return (
                        <div
                            key={i}
                            className="group min-h-[92px] p-[1px] transition-all duration-300"
                            style={{
                                background: `linear-gradient(180deg, ${channelTone.borderGlow} 0%, rgba(255, 255, 255, 0.02) 100%)`,
                                borderRadius: radius.card,
                                boxShadow: isDark
                                    ? '0 24px 50px -34px rgba(2, 6, 23, 0.95)'
                                    : '0 24px 44px -30px rgba(15, 23, 42, 0.18)'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-4px)'
                                e.currentTarget.style.boxShadow = isDark
                                    ? '0 28px 60px -30px rgba(2, 6, 23, 1)'
                                    : '0 30px 52px -30px rgba(15, 23, 42, 0.22)'
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)'
                                e.currentTarget.style.boxShadow = isDark
                                    ? '0 24px 50px -34px rgba(2, 6, 23, 0.95)'
                                    : '0 24px 44px -30px rgba(15, 23, 42, 0.18)'
                            }}
                        >
                            <div
                                className="flex h-full items-center justify-between gap-4 px-4 py-3"
                                style={{
                                    background: channelTone.background,
                                    border: `1px solid ${panelTone.border}`,
                                    borderRadius: `calc(${radius.card} - 1px)`
                                }}
                            >
                                <div className="flex min-w-0 flex-1 items-center gap-3">
                                    <div
                                        className="flex h-11 w-11 shrink-0 items-center justify-center"
                                        style={{
                                            background: channelTone.iconWrap,
                                            border: `1px solid ${panelTone.border}`,
                                            borderRadius: radius.inner,
                                            boxShadow: isDark ? 'inset 0 1px 0 rgba(255,255,255,0.04)' : 'inset 0 1px 0 rgba(255,255,255,0.72)'
                                        }}
                                    >
                                        <channel.icon className="h-5 w-5" style={{ color: channelTone.accent }} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                    <h3 className="truncate text-sm font-semibold leading-snug" style={{ color: channelTone.text }}>
                                        {channel.name}
                                    </h3>
                                    <p className="mt-0.5 line-clamp-2 text-[12px] leading-[1.35]" style={{ color: channelTone.muted, opacity: 0.84 }}>
                                        {channel.status === 'connected'
                                            ? 'Canal ativo e pronto para operação.'
                                            : channel.status === 'partial'
                                                ? 'Integração ativa com pontos pendentes.'
                                                : 'Canal disponível, aguardando conexão.'}
                                    </p>
                                    </div>
                                </div>
                                <Badge className="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold shadow-none" style={{ ...statusMeta.badgeStyle, borderRadius: radius.pill }}>
                                    {statusMeta.label}
                                </Badge>
                            </div>
                        </div>
                    )
                })}
            </div>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value)} className="space-y-6">
                <TabsList
                    className="h-auto gap-1 rounded-full p-1.5"
                    style={{
                        background: isDark ? 'rgba(15, 23, 42, 0.7)' : 'rgba(255, 255, 255, 0.82)',
                        border: `1px solid ${panelTone.border}`,
                        boxShadow: isDark
                            ? '0 20px 40px -34px rgba(2, 6, 23, 0.95)'
                            : '0 18px 40px -34px rgba(15, 23, 42, 0.18)'
                    }}
                >
                    <TabsTrigger
                        value="active"
                        className="rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-300"
                        style={activeTab === 'active'
                            ? {
                                background: 'linear-gradient(135deg, #0891b2 0%, #2563eb 58%, #3b82f6 100%)',
                                color: '#f8fafc',
                                borderRadius: radius.pill,
                                border: '1px solid rgba(125, 211, 252, 0.24)',
                                boxShadow: isDark
                                    ? '0 16px 30px -18px rgba(14, 165, 233, 0.6), inset 0 1px 0 rgba(255,255,255,0.16)'
                                    : '0 14px 24px -18px rgba(37, 99, 235, 0.32)'
                            }
                            : {
                                color: panelTone.muted,
                                borderRadius: radius.pill
                            }}
                    >
                        {t('tabs.agents')}
                    </TabsTrigger>
                    <TabsTrigger
                        value="templates"
                        className="rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-300"
                        style={activeTab === 'templates'
                            ? {
                                background: 'linear-gradient(135deg, #0891b2 0%, #2563eb 58%, #3b82f6 100%)',
                                color: '#f8fafc',
                                borderRadius: radius.pill,
                                border: '1px solid rgba(125, 211, 252, 0.24)',
                                boxShadow: isDark
                                    ? '0 16px 30px -18px rgba(14, 165, 233, 0.6), inset 0 1px 0 rgba(255,255,255,0.16)'
                                    : '0 14px 24px -18px rgba(37, 99, 235, 0.32)'
                            }
                            : {
                                color: panelTone.muted,
                                borderRadius: radius.pill
                            }}
                    >
                        {t('tabs.templates')}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="active" className="mt-0">
                    {loading ? (
                        <div className="flex h-40 items-center justify-center rounded-[24px]" style={sectionShellStyle}>
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : agents.length === 0 ? (
                        <div className="flex h-64 flex-col items-center justify-center rounded-[24px] border border-dashed px-6 text-center" style={{ ...sectionShellStyle, borderStyle: 'dashed' }}>
                            <Bot className="h-10 w-10" style={{ color: panelTone.muted }} />
                            <h3 className="mt-4 text-lg font-semibold" style={{ color: panelTone.title }}>{t('empty.noAgents')}</h3>
                            <p className="mb-5 mt-2 max-w-md text-sm leading-6" style={{ color: panelTone.muted }}>{t('empty.noAgentsDescription')}</p>
                            <Button onClick={() => setIsCreateOpen(true)} className="rounded-[16px] px-5" style={mainButtonStyle}>{t('button.deployAgent')}</Button>
                        </div>
                    ) : (
                        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                            {agents.map((agent) => (
                                    <Card key={agent.id} className="group relative flex h-full min-h-[312px] cursor-pointer flex-col overflow-hidden rounded-[20px] border-0 transition-all duration-300" style={{
                                        background: panelTone.card,
                                        borderRadius: radius.card,
                                        boxShadow: isDark
                                            ? '0 30px 64px -36px rgba(2, 6, 23, 1), inset 0 1px 0 rgba(255,255,255,0.03)'
                                            : '0 28px 50px -32px rgba(15, 23, 42, 0.18)',
                                        border: `1px solid ${panelTone.border}`
                                    }} onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-6px)'
                                        e.currentTarget.style.borderColor = panelTone.hoverBorder
                                        e.currentTarget.style.boxShadow = isDark
                                            ? '0 34px 72px -34px rgba(2, 6, 23, 1), 0 0 0 1px rgba(56, 189, 248, 0.12)'
                                            : '0 32px 56px -30px rgba(15, 23, 42, 0.22)'
                                    }} onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)'
                                        e.currentTarget.style.borderColor = panelTone.border
                                        e.currentTarget.style.boxShadow = isDark
                                            ? '0 28px 60px -36px rgba(2, 6, 23, 0.98), inset 0 1px 0 rgba(255,255,255,0.03)'
                                            : '0 26px 46px -32px rgba(15, 23, 42, 0.18)'
                                    }}>
                                        <div className="flex flex-1 flex-col p-6">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                                    <div className="relative shrink-0">
                                                        <Avatar className="h-14 w-14">
                                                            <AvatarFallback className="text-base font-bold text-white" style={{
                                                                background: 'linear-gradient(135deg, #0891b2 0%, #2563eb 58%, #8b5cf6 100%)',
                                                                boxShadow: '0 18px 30px -18px rgba(37, 99, 235, 0.65)'
                                                            }}>{agent.avatar}</AvatarFallback>
                                                    </Avatar>
                                                        <div className={`absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full ${(agent as any).status_id === 1 ? 'bg-emerald-500' : (agent as any).status_id === 3 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{
                                                            border: `2px solid ${isDark ? '#0f172a' : '#ffffff'}`,
                                                            boxShadow: '0 0 0 3px rgba(15, 23, 42, 0.16)'
                                                        }} />
                                                </div>
                                                    <div className="min-w-0 flex-1">
                                                        <CardTitle className="truncate text-lg font-semibold leading-tight" style={{ color: panelTone.title }}>
                                                        {agent.name}
                                                    </CardTitle>
                                                        <div className="flex items-center gap-2">
                                                            <span className="truncate text-sm font-medium" style={{ color: panelTone.muted }}>
                                                                {(() => {
                                                                    // Buscar o template pelo role_template_id para exibir o role
                                                                    const templateId = (agent as any).role_template_id
                                                                    if (!templateId) return t('agent.noTemplate')
                                                                    const template = templates.find(t => t.id === templateId)
                                                                    return template?.role || t('agent.templateNotFound')
                                                                })()}
                                                        </span>
                                                    </div>
                                                        <div className="mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold" style={{
                                                            background: (agent as any).status_id === 1
                                                                ? 'rgba(16, 185, 129, 0.12)'
                                                                : (agent as any).status_id === 3 || (agent as any).status_id === 4
                                                                    ? 'rgba(245, 158, 11, 0.12)'
                                                                    : 'rgba(239, 68, 68, 0.12)',
                                                            color: (agent as any).status_id === 1
                                                                ? '#6ee7b7'
                                                                : (agent as any).status_id === 3 || (agent as any).status_id === 4
                                                                    ? '#fbbf24'
                                                                    : '#f87171',
                                                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.06)'}`
                                                        }}>
                                                            <span className="h-1.5 w-1.5 rounded-full" style={{
                                                                background: (agent as any).status_id === 1
                                                                    ? '#10b981'
                                                                    : (agent as any).status_id === 3 || (agent as any).status_id === 4
                                                                        ? '#f59e0b'
                                                                        : '#ef4444'
                                                            }} />
                                                            {(agent as any).status_id === 1
                                                                ? t('channels.status.connected')
                                                                : (agent as any).status_id === 3 || (agent as any).status_id === 4
                                                                    ? t('channels.status.partial')
                                                                    : t('channels.status.disconnected')}
                                                        </div>
                                                </div>
                                            </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <div className="flex -space-x-1.5">
                                                        {agent.channels?.slice(0, 3).map(c => (
                                                            <div key={c} className="flex h-9 w-9 items-center justify-center rounded-full p-1.5" title={c} style={{
                                                                background: isDark ? 'rgba(15, 23, 42, 0.78)' : 'rgba(248, 250, 252, 0.96)',
                                                                border: `1px solid ${panelTone.border}`,
                                                                color: panelTone.muted
                                                            }}>
                                                            {getChannelIcon(c)}
                                                        </div>
                                                    ))}
                                                </div>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" className="h-9 w-9 rounded-full p-0 transition-colors" style={{
                                                                color: panelTone.muted,
                                                                background: isDark ? 'rgba(30, 41, 59, 0.72)' : 'rgba(248, 250, 252, 0.9)',
                                                                border: `1px solid ${panelTone.border}`
                                                            }}>
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        {(agent as any).status_id !== 1 && (
                                                            <DropdownMenuItem onClick={() => handleReactivateAgent(agent.id)}>
                                                                <Play className="mr-2 h-4 w-4 text-emerald-500" />
                                                                {t('actions.reactivate')}
                                                            </DropdownMenuItem>
                                                        )}
                                                        {(agent as any).status_id === 1 && (
                                                            <DropdownMenuItem onClick={() => handlePauseAgent(agent.id)}>
                                                                <Pause className="mr-2 h-4 w-4 text-yellow-500" />
                                                                {t('actions.pause')}
                                                            </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteAgent(agent.id)}>
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                            {t('actions.delete')}
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </div>

                                            <div className="mt-5 rounded-[16px] p-4" style={{
                                                background: isDark ? 'rgba(15, 23, 42, 0.62)' : 'rgba(248, 250, 252, 0.82)',
                                                border: `1px solid ${panelTone.border}`,
                                                borderRadius: radius.inner
                                            }}>
                                                <p className="text-sm leading-7" style={{ color: panelTone.muted }}>
                                                    {(() => {
                                                        // Buscar o template pelo role_template_id do agente
                                                        // O campo 'role' da tabela tb_agents_templates contém o role do template
                                                        const templateId = (agent as any).role_template_id
                                                        if (!templateId) {
                                                            return t('agent.noTemplateAssigned')
                                                        }
                                                        const template = templates.find(t => t.id === templateId)
                                                        // Retornar o campo 'role' da tabela tb_agents_templates
                                                        return template?.role || t('agent.templateNotFound')
                                                    })()}
                                            </p>
                                        </div>

                                            <div className="mt-auto flex items-center justify-between gap-4 rounded-[16px] p-4" style={{
                                                background: isDark ? 'rgba(8, 15, 30, 0.76)' : 'rgba(255,255,255,0.82)',
                                                border: `1px solid ${panelTone.border}`,
                                                borderRadius: radius.inner
                                            }}>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{
                                                        background: isDark ? 'rgba(14, 165, 233, 0.1)' : 'rgba(37, 99, 235, 0.08)',
                                                        color: isDark ? '#67e8f9' : '#2563eb'
                                                    }}>
                                                        <Globe className="h-4 w-4" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: panelTone.muted }}>Idioma</p>
                                                        <p className="text-sm font-semibold" style={{ color: panelTone.title }}>{agent.languages?.join(", ") || "EN"}</p>
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-10 rounded-full px-4 text-xs font-semibold transition-all duration-300"
                                                    style={{
                                                        background: isDark ? 'rgba(14, 165, 233, 0.08)' : 'rgba(37, 99, 235, 0.06)',
                                                        border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.18)' : 'rgba(37, 99, 235, 0.14)'}`,
                                                        color: isDark ? '#e0f2fe' : '#1d4ed8',
                                                        borderRadius: radius.control
                                                    }}
                                                    onClick={() => navigate(`agent-config?id=${agent.id}`)}
                                                >
                                                    <Settings className="h-3.5 w-3.5 mr-1.5" />
                                                    {t('button.manage')}
                                                </Button>
                                        </div>
                                    </div>
                                </Card>
                            ))}

                            <Button
                                variant="outline"
                                onClick={() => setIsCreateOpen(true)}
                                className="group h-full min-h-[312px] rounded-[20px] border-0 p-[1px] transition-all duration-300"
                                style={{
                                    background: 'linear-gradient(180deg, rgba(56, 189, 248, 0.18) 0%, rgba(14, 165, 233, 0.05) 100%)',
                                    borderRadius: radius.card,
                                    boxShadow: isDark
                                        ? '0 28px 58px -36px rgba(2, 6, 23, 0.95)'
                                        : '0 26px 46px -32px rgba(15, 23, 42, 0.18)'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-6px)'
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)'
                                }}
                            >
                                <div className="flex h-full min-h-[310px] flex-col items-center justify-center gap-5 rounded-[19px] px-6 text-center" style={{
                                    background: isDark
                                        ? 'linear-gradient(180deg, rgba(15, 23, 42, 0.92) 0%, rgba(8, 15, 30, 0.96) 100%)'
                                        : 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(241,245,249,0.98) 100%)',
                                    border: `1px dashed ${isDark ? 'rgba(56, 189, 248, 0.22)' : 'rgba(37, 99, 235, 0.18)'}`,
                                    borderRadius: `calc(${radius.card} - 1px)`
                                }}>
                                    <div className="flex h-16 w-16 items-center justify-center rounded-full" style={{
                                        background: isDark ? 'rgba(14, 165, 233, 0.12)' : 'rgba(37, 99, 235, 0.08)',
                                        color: isDark ? '#67e8f9' : '#2563eb',
                                        boxShadow: isDark ? '0 16px 30px -20px rgba(14, 165, 233, 0.55)' : '0 14px 24px -18px rgba(37, 99, 235, 0.25)'
                                    }}>
                                        <Plus className="h-7 w-7" />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-lg font-semibold" style={{ color: panelTone.title }}>{t('button.deployNewAgent')}</h3>
                                        <p className="text-sm leading-6" style={{ color: panelTone.muted }}>{t('button.startFromTemplate')}</p>
                                    </div>
                                </div>
                            </Button>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="templates" className="mt-0">
                    {templatesLoading ? (
                        <div className="flex h-40 items-center justify-center rounded-[24px]" style={sectionShellStyle}>
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : templates.length === 0 ? (
                        <div className="flex h-64 flex-col items-center justify-center rounded-[24px] border border-dashed px-6 text-center" style={{ ...sectionShellStyle, borderStyle: 'dashed' }}>
                            <Bot className="h-10 w-10" style={{ color: panelTone.muted }} />
                            <h3 className="mt-4 text-lg font-semibold" style={{ color: panelTone.title }}>{t('empty.noTemplates')}</h3>
                            <p className="mb-5 mt-2 max-w-md text-sm leading-6" style={{ color: panelTone.muted }}>{t('empty.noTemplatesDescription')}</p>
                            <Button onClick={() => setIsCreateTemplateOpen(true)} className="rounded-[16px] px-5" style={mainButtonStyle}>
                                <Plus className="h-4 w-4 mr-2" />
                                {t('button.createTemplate')}
                            </Button>
                        </div>
                    ) : (
                        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                            {templates.map((template) => {
                                const IconComponent = template.IconComponent || getTemplateIcon(template.icon)
                                return (
                                    <Card
                                        key={template.id}
                                        className="group relative flex h-full min-h-[312px] cursor-pointer flex-col overflow-hidden rounded-[20px] border-0 transition-all duration-300"
                                        style={{
                                            background: panelTone.card,
                                            borderRadius: radius.card,
                                            boxShadow: isDark
                                                ? '0 30px 64px -36px rgba(2, 6, 23, 1), inset 0 1px 0 rgba(255,255,255,0.03)'
                                                : '0 28px 50px -32px rgba(15, 23, 42, 0.18)',
                                            border: `1px solid ${panelTone.border}`
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = 'translateY(-6px)'
                                            e.currentTarget.style.borderColor = panelTone.hoverBorder
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'translateY(0)'
                                            e.currentTarget.style.borderColor = panelTone.border
                                        }}
                                    >
                                        <div className="flex flex-1 flex-col p-6">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                                    <div className="relative shrink-0">
                                                        <Avatar className="h-14 w-14">
                                                            <AvatarFallback className="text-base font-bold text-white" style={{
                                                                background: 'linear-gradient(135deg, #0891b2 0%, #2563eb 58%, #8b5cf6 100%)',
                                                                boxShadow: '0 18px 30px -18px rgba(37, 99, 235, 0.65)'
                                                            }}>
                                                                {template.name.charAt(0).toUpperCase()}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                </div>
                                                    <div className="min-w-0 flex-1">
                                                        <CardTitle className="truncate text-lg font-semibold leading-tight" style={{ color: panelTone.title }}>
                                                            {template.name}
                                                        </CardTitle>
                                                        <div className="flex items-center gap-2">
                                                            <span className="truncate text-sm font-medium" style={{ color: panelTone.muted }}>
                                                                {template.role}
                                                            </span>
                                            </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <Badge 
                                                        variant="outline"
                                                        className="rounded-full px-3 py-1 text-[11px] font-semibold shadow-none"
                                                        style={getComplexityMeta(template.complexity)}
                                                    >
                                                        {template.complexity}
                                                    </Badge>
                                                </div>
                                            </div>

                                            <div className="mt-5 rounded-[16px] p-4" style={{
                                                background: isDark ? 'rgba(15, 23, 42, 0.62)' : 'rgba(248, 250, 252, 0.82)',
                                                border: `1px solid ${panelTone.border}`,
                                                borderRadius: radius.inner
                                            }}>
                                                <p className="text-sm leading-7" style={{ color: panelTone.muted }}>
                                                    {template.description || t('template.noDescription')}
                                                </p>
                                            </div>

                                            <div className="mt-auto pt-6">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-11 w-full rounded-full px-4 text-sm font-semibold transition-all duration-300"
                                                    style={{
                                                        background: isDark ? 'rgba(14, 165, 233, 0.08)' : 'rgba(37, 99, 235, 0.06)',
                                                        border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.18)' : 'rgba(37, 99, 235, 0.14)'}`,
                                                        color: isDark ? '#e0f2fe' : '#1d4ed8',
                                                        borderRadius: radius.control
                                                    }}
                                                    onClick={() => handleUseTemplate(template)}
                                                >
                                                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                                                    {t('button.useTemplate')}
                                            </Button>
                                            </div>
                                        </div>
                                    </Card>
                                )
                            })}

                            <Button
                                variant="outline"
                                onClick={() => setIsCreateTemplateOpen(true)}
                                className="group h-full min-h-[312px] rounded-[20px] border-0 p-[1px] transition-all duration-300"
                                style={{
                                    background: 'linear-gradient(180deg, rgba(56, 189, 248, 0.18) 0%, rgba(14, 165, 233, 0.05) 100%)',
                                    borderRadius: radius.card,
                                    boxShadow: isDark
                                        ? '0 28px 58px -36px rgba(2, 6, 23, 0.95)'
                                        : '0 26px 46px -32px rgba(15, 23, 42, 0.18)'
                                }}
                            >
                                <div className="flex h-full min-h-[310px] flex-col items-center justify-center gap-5 rounded-[19px] px-6 text-center" style={{
                                    background: isDark
                                        ? 'linear-gradient(180deg, rgba(15, 23, 42, 0.92) 0%, rgba(8, 15, 30, 0.96) 100%)'
                                        : 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(241,245,249,0.98) 100%)',
                                    border: `1px dashed ${isDark ? 'rgba(56, 189, 248, 0.22)' : 'rgba(37, 99, 235, 0.18)'}`,
                                    borderRadius: `calc(${radius.card} - 1px)`
                                }}>
                                    <div className="flex h-16 w-16 items-center justify-center rounded-full" style={{
                                        background: isDark ? 'rgba(14, 165, 233, 0.12)' : 'rgba(37, 99, 235, 0.08)',
                                        color: isDark ? '#67e8f9' : '#2563eb'
                                    }}>
                                        <Plus className="h-7 w-7" />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-lg font-semibold" style={{ color: panelTone.title }}>{t('button.createTemplate')}</h3>
                                        <p className="text-sm leading-6" style={{ color: panelTone.muted }}>{t('button.startFromScratch')}</p>
                                    </div>
                                </div>
                            </Button>
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    )
}
