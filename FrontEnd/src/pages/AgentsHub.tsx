
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react"
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
    ChevronDown,
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../components/ui/collapsible"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "../components/ui/dialog"
import { BulkDeleteResourcesDialog } from "../components/resources/BulkDeleteResourcesDialog"
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
import { SUPPORTED_AGENT_LANGUAGES, getAgentLanguageLabel, normalizeAgentLanguageCode } from "../lib/agent-language"

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

const withAlpha = (hex: string, alpha: number) => {
    const normalized = hex.replace('#', '')
    if (normalized.length !== 6) return hex
    const value = Math.max(0, Math.min(255, Math.round(alpha * 255)))
    return `#${normalized}${value.toString(16).padStart(2, '0')}`
}

/* ---------------- TYPES ---------------- */
type HubDeletionBlockers = {
    agentsInFlows: Record<string, string[]>
    templatesUsedByAgents: Record<string, Array<{ id: string; name: string; statusId?: number | null }>>
    flowsLinkedInIntegrations: Record<string, string[]>
}

function formatTemplateBlockerAgentLabel(a: { name: string; statusId?: number | null }): string {
    const s = a.statusId
    if (s === 2) return `${a.name} (cancelado — registro ainda no banco)`
    if (s === 3) return `${a.name} (pausado)`
    return a.name
}

type AgentTemplate = {
    id: string
    name: string
    role: string
    description: string
    skills: string[]
    icon: string
    defaultChannels: string[]
    complexity: "Simple" | "Intermediate" | "Advanced"
    companies_id?: string | null
    isShared?: boolean
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

type SurfaceTone = {
    card: string
    elevated: string
    muted: string
    text: string
    title: string
    border: string
    hoverBorder: string
}

function SectionBlock({
    eyebrow,
    title,
    description,
    action,
    children,
    tone,
    shellStyle,
    className = ""
}: {
    eyebrow?: string
    title: string
    description?: string
    action?: React.ReactNode
    children: React.ReactNode
    tone: SurfaceTone
    shellStyle: React.CSSProperties
    className?: string
}) {
    return (
        <section className={`space-y-6 rounded-2xl p-5 sm:p-6 lg:p-7 ${className}`} style={shellStyle}>
            <div className="flex min-w-0 flex-col gap-5 xl:flex-row xl:items-end xl:justify-between xl:gap-8">
                <div className="min-w-0 flex-1">
                    {eyebrow && (
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: tone.muted }}>
                            {eyebrow}
                        </p>
                    )}
                    <h3 className="mt-1 text-lg font-semibold md:text-xl" style={{ color: tone.title }}>
                        {title}
                    </h3>
                    {description && (
                        <p className="mt-1 max-w-3xl text-sm leading-6 sm:text-[15px] sm:leading-7" style={{ color: tone.muted }}>
                            {description}
                        </p>
                    )}
                </div>
                {action && (
                    <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3.5 xl:w-auto xl:max-w-[48%] xl:justify-end">
                        {action}
                    </div>
                )}
            </div>
            {children}
        </section>
    )
}

function MetricCard({
    icon: Icon,
    label,
    value,
    description,
    tone,
    accent = '#2563eb'
}: {
    icon: React.ComponentType<{ className?: string }>
    label: string
    value: React.ReactNode
    description: string
    tone: SurfaceTone
    accent?: string
}) {
    return (
        <div
            className="flex h-full min-h-[112px] min-w-0 flex-col rounded-[1.75rem] p-4"
            style={{
                background: tone.elevated,
                border: `1px solid ${tone.border.replace('0.9)', '0.18)').replace('1)', '0.32)')}`,
                boxShadow: 'none'
            }}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: tone.muted }}>
                        {label}
                    </p>
                    <p className="mt-2 text-[1.7rem] font-semibold leading-none" style={{ color: tone.title }}>
                        {value}
                    </p>
                </div>
                <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[1rem]"
                    style={{
                        background: tone.card,
                        color: accent
                    }}
                >
                    <Icon className="h-4 w-4" />
                </div>
            </div>
            <p className="mt-2.5 text-sm leading-5" style={{ color: tone.muted }}>
                {description}
            </p>
        </div>
    )
}

function SectionMetricPill({
    label,
    value,
    tone
}: {
    label: string
    value: React.ReactNode
    tone: SurfaceTone
}) {
    return (
        <div
            className="flex min-h-[94px] min-w-[128px] flex-col items-center justify-center border px-6 py-5 text-center"
            style={{
                background: tone.card,
                borderColor: tone.border,
                borderRadius: '24px'
            }}
        >
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: tone.muted }}>
                {label}
            </p>
            <p className="mt-2.5 text-[2rem] font-semibold leading-none" style={{ color: tone.title }}>
                {value}
            </p>
        </div>
    )
}

function MetaPill({
    icon: Icon,
    label,
    tone,
    subtle = false
}: {
    icon?: React.ComponentType<{ className?: string }>
    label: string
    tone: SurfaceTone
    subtle?: boolean
}) {
    return (
        <div
            className="inline-flex max-w-full items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium"
            style={{
                background: subtle ? tone.elevated : tone.card,
                borderColor: tone.border,
                color: tone.muted
            }}
        >
            {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
            <span className="truncate">{label}</span>
        </div>
    )
}

export function AgentsHub() {
    const { theme } = useTheme()
    const { userId, user } = useAuth()
    const { navigate } = useNavigation()
    const { t } = useTranslation('agentsHub')

    const [agents, setAgents] = useState<Agent[]>([])
    const [showCancelledAgents, setShowCancelledAgents] = useState(false)
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
    const [bulkAgentsOpen, setBulkAgentsOpen] = useState(false)
    const [bulkTemplatesOpen, setBulkTemplatesOpen] = useState(false)
    const [deletionBlockers, setDeletionBlockers] = useState<HubDeletionBlockers | null>(null)
    const [bulkBlockersFetchBusy, setBulkBlockersFetchBusy] = useState(false)
    const [bulkDeleteRunning, setBulkDeleteRunning] = useState(false)


    // New Agent Form State
    const [newAgent, setNewAgent] = useState({
        name: "",
        role: "",
        description: "",
        primaryLanguage: "pt-BR",
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
                primaryLanguage: "pt-BR",
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
        shell: '16px',
        card: '12px',
        inner: '8px',
        control: '8px',
        pill: '8px'
    }
    const pageShellStyle = {
        background: isDark
            ? 'linear-gradient(180deg, #09090b 0%, #18181b 100%)'
            : 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)'
    }
    const sectionShellStyle = {
        background: isDark ? 'rgba(24, 24, 27, 0.92)' : 'rgba(255, 255, 255, 0.96)',
        border: `1px solid ${isDark ? 'rgba(63, 63, 70, 0.56)' : 'rgba(226, 232, 240, 0.9)'}`,
        boxShadow: isDark
            ? '0 16px 40px -32px rgba(0, 0, 0, 0.8)'
            : '0 12px 30px -24px rgba(15, 23, 42, 0.12)',
        borderRadius: radius.shell,
        backdropFilter: 'blur(10px)'
    } as React.CSSProperties
    const elevatedInsetStyle = {
        background: isDark ? 'rgba(39, 39, 42, 0.56)' : 'rgba(248, 250, 252, 0.92)',
        boxShadow: isDark
            ? 'inset 0 1px 0 rgba(255,255,255,0.03)'
            : 'inset 0 1px 0 rgba(255,255,255,0.75)'
    } as React.CSSProperties
    const contentCardStyle = {
        background: isDark ? 'rgba(24, 24, 27, 0.98)' : 'rgba(255, 255, 255, 0.98)',
        border: `1px solid ${isDark ? 'rgba(63, 63, 70, 0.28)' : 'rgba(226, 232, 240, 0.88)'}`,
        boxShadow: isDark
            ? '0 12px 28px -22px rgba(0, 0, 0, 0.76)'
            : '0 14px 28px -24px rgba(15, 23, 42, 0.1)'
    } as React.CSSProperties
    const chromeSurfaceStyle = {
        background: isDark ? 'rgba(39, 39, 42, 0.42)' : 'rgba(248, 250, 252, 0.92)',
        border: `1px solid ${isDark ? 'rgba(63, 63, 70, 0.18)' : 'rgba(226, 232, 240, 0.76)'}`
    } as React.CSSProperties
    const heroShellStyle = {
        ...sectionShellStyle,
        background: isDark
            ? 'linear-gradient(135deg, rgba(9, 9, 11, 0.98) 0%, rgba(24, 24, 27, 0.96) 58%, rgba(24, 24, 27, 0.92) 100%)'
            : 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.98) 58%, rgba(241, 245, 249, 0.98) 100%)',
        boxShadow: isDark
            ? '0 26px 60px -42px rgba(0, 0, 0, 0.88)'
            : '0 22px 48px -36px rgba(15, 23, 42, 0.18)'
    } as React.CSSProperties
    const mainButtonStyle = {
        background: isDark
            ? '#2563eb'
            : '#2563eb',
        color: '#f8fafc',
        border: '1px solid rgba(37, 99, 235, 0.4)',
        borderRadius: radius.control,
        boxShadow: isDark
            ? '0 8px 20px -16px rgba(37, 99, 235, 0.65)'
            : '0 8px 20px -16px rgba(37, 99, 235, 0.35)'
    } as React.CSSProperties
    const secondaryHeaderButtonStyle = {
        background: isDark ? 'rgba(39, 39, 42, 0.92)' : 'rgba(255, 255, 255, 0.96)',
        color: isDark ? '#e2e8f0' : '#0f172a',
        border: `1px solid ${isDark ? 'rgba(63, 63, 70, 0.9)' : 'rgba(228, 228, 231, 1)'}`,
        borderRadius: radius.control,
        boxShadow: isDark
            ? '0 10px 24px -20px rgba(0, 0, 0, 0.65)'
            : '0 10px 24px -20px rgba(15, 23, 42, 0.12)'
    } as React.CSSProperties
    const panelTone = isDark
        ? {
            card: 'rgba(24, 24, 27, 0.96)',
            elevated: 'rgba(39, 39, 42, 0.88)',
            muted: '#a1a1aa',
            text: '#e2e8f0',
            title: '#f8fafc',
            border: 'rgba(63, 63, 70, 0.9)',
            hoverBorder: 'rgba(82, 82, 91, 1)'
        }
        : {
            card: 'rgba(255, 255, 255, 0.98)',
            elevated: 'rgba(244, 244, 245, 0.95)',
            muted: '#64748b',
            text: '#0f172a',
            title: '#020617',
            border: 'rgba(228, 228, 231, 1)',
            hoverBorder: 'rgba(212, 212, 216, 1)'
        }
    const dialogContentStyle = {
        ...sectionShellStyle,
        maxHeight: '90vh',
        marginTop: '1rem',
        marginBottom: '1rem',
        overflow: 'hidden',
        gridTemplateRows: 'auto 1fr auto',
        padding: 0
    } as React.CSSProperties
    const dialogInputStyle = {
        backgroundColor: isDark ? 'rgba(39, 39, 42, 0.9)' : 'rgba(248, 250, 252, 0.98)',
        borderColor: panelTone.border,
        color: panelTone.title,
        borderRadius: radius.control,
        boxShadow: 'none'
    } as React.CSSProperties
    const dialogMutedTextStyle = { color: panelTone.muted } as React.CSSProperties
    const dialogFooterShellStyle = {
        padding: '0 1.5rem 1.5rem 1.5rem',
        borderTop: `1px solid ${panelTone.border}`,
        background: isDark ? 'rgba(9, 9, 11, 0.76)' : 'rgba(248, 250, 252, 0.94)'
    } as React.CSSProperties
    const progressTrackStyle = {
        width: '100%',
        height: '8px',
        backgroundColor: isDark ? 'rgba(39, 39, 42, 0.92)' : '#e4e4e7',
        borderRadius: radius.pill,
        overflow: 'hidden',
        position: 'relative'
    } as React.CSSProperties

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
                        languages: [normalizeAgentLanguageCode(agent.primary_language, 'pt-BR')],
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
                        companies_id: template.companies_id ?? null,
                        isShared: !template.companies_id,
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
            primaryLanguage: "pt-BR",
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
                    p_primary_language: normalizeAgentLanguageCode(newAgent.primaryLanguage, 'pt-BR'),
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
                primaryLanguage: "pt-BR",
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

    const agentsInLibrary = useMemo(
        () => agents.filter((a) => Number((a as any).status_id) !== 2),
        [agents]
    )
    const cancelledAgents = useMemo(
        () => agents.filter((a) => Number((a as any).status_id) === 2),
        [agents]
    )

    const openBulkDeletionModal = useCallback(
        async (kind: 'agents' | 'templates') => {
            if (!user?.email) return
            setBulkBlockersFetchBusy(true)
            try {
                const { BASE_URL, getAuthHeaders } = await import('../services/api')
                const r = await fetch(`${BASE_URL}/deletion-blockers`, { headers: await getAuthHeaders() })
                if (!r.ok) {
                    const err = await r.json().catch(() => ({}))
                    toast.error(err?.details || err?.error || 'Não foi possível carregar dependências para exclusão em lote.')
                    return
                }
                const data = (await r.json()) as HubDeletionBlockers
                setDeletionBlockers(data)
                if (kind === 'agents') setBulkAgentsOpen(true)
                else setBulkTemplatesOpen(true)
            } catch {
                toast.error('Erro de rede ao carregar dependências.')
            } finally {
                setBulkBlockersFetchBusy(false)
            }
        },
        [user?.email]
    )

    const agentsForBulkDelete = useMemo(
        () => [...agentsInLibrary, ...cancelledAgents],
        [agentsInLibrary, cancelledAgents]
    )

    const bulkAgentDeleteItems = useMemo(() => {
        return agentsForBulkDelete.map((agent) => {
            const flows = deletionBlockers?.agentsInFlows?.[agent.id]
            const blocked = Boolean(flows?.length)
            return {
                id: agent.id,
                label: agent.name,
                blocked,
                blockReason: blocked ? `Em uso no(s) fluxo(s): ${flows!.join(', ')}` : undefined,
            }
        })
    }, [agentsForBulkDelete, deletionBlockers])

    const bulkTemplateDeleteItems = useMemo(() => {
        return templates.map((tpl) => {
            if (tpl.isShared) {
                return {
                    id: tpl.id,
                    label: tpl.name,
                    blocked: true,
                    blockReason: 'Template compartilhado da plataforma — não pode ser excluído por aqui.',
                }
            }
            const used = deletionBlockers?.templatesUsedByAgents?.[tpl.id]
            const blocked = Boolean(used?.length)
            return {
                id: tpl.id,
                label: tpl.name,
                blocked,
                blockReason: blocked
                    ? `Ainda ligado a agente(s) ativo(s) ou pausado(s): ${used!.map((u) => formatTemplateBlockerAgentLabel(u)).join('; ')}. Para remover de vez, use «Excluir em lote» em Agentes (referências em fluxos são limpas automaticamente).`
                    : undefined,
            }
        })
    }, [templates, deletionBlockers])

    const runBulkDeleteAgents = useCallback(
        async (ids: string[]) => {
            if (!user?.email || ids.length === 0) return
            setBulkDeleteRunning(true)
            let ok = 0
            let fail = 0
            try {
                const { BASE_URL, getAuthHeaders } = await import('../services/api')
                const authHeaders = await getAuthHeaders()
                for (const id of ids) {
                    const r = await fetch(`${BASE_URL}/agents/${id}`, {
                        method: 'DELETE',
                        headers: { ...authHeaders, 'x-user-email': user.email },
                    })
                    if (r.ok) ok++
                    else fail++
                }
                if (ok) toast.success(`${ok} agente(s) excluído(s).`)
                if (fail) {
                    toast.error(
                        `${fail} exclusão(ões) falharam. Verifique se o agente ainda aparece em algum fluxo ou permissões.`
                    )
                }
                await fetchAgents()
                setBulkAgentsOpen(false)
                setDeletionBlockers(null)
            } finally {
                setBulkDeleteRunning(false)
            }
        },
        [user?.email, fetchAgents]
    )

    const runBulkDeleteTemplates = useCallback(
        async (ids: string[]) => {
            if (!user?.email || ids.length === 0) return
            setBulkDeleteRunning(true)
            let ok = 0
            let fail = 0
            try {
                const { BASE_URL, getAuthHeaders } = await import('../services/api')
                const authHeaders = await getAuthHeaders()
                for (const id of ids) {
                    const r = await fetch(`${BASE_URL}/templates/${id}`, {
                        method: 'DELETE',
                        headers: { ...authHeaders, 'x-user-email': user.email },
                    })
                    if (r.ok) ok++
                    else fail++
                }
                if (ok) toast.success(`${ok} template(s) excluído(s).`)
                if (fail) {
                    toast.error(
                        `${fail} exclusão(ões) falharam. Templates ainda vinculados a agentes não podem ser removidos.`
                    )
                }
                await fetchTemplates()
                setBulkTemplatesOpen(false)
                setDeletionBlockers(null)
            } finally {
                setBulkDeleteRunning(false)
            }
        },
        [user?.email, fetchTemplates]
    )

    const customTemplatesCount = templates.filter(template => !template.isShared).length
    const sharedTemplatesCount = templates.filter(template => template.isShared).length
    const activeAgentsCount = agents.filter(agent => (agent as any).status_id === 1).length
    const templatesInUseCount = agentsInLibrary.filter(agent => Boolean((agent as any).role_template_id)).length
    const connectedChannelsCount = channelsData.filter(channel => channel.status !== 'disconnected').length
    const connectedIntegrationsCount = integrations.filter(integration =>
        Boolean(integration.phone_number || integration.email || integration.account_sid || integration.smtp_host)
    ).length + crmIntegrations.length
    const overviewCards = [
        {
            label: t('overview.activeAgentsLabel', { defaultValue: 'Agentes ativos' }),
            value: activeAgentsCount,
            description: t('overview.activeAgentsDescription', { defaultValue: 'operando agora' }),
            icon: Bot,
            accent: '#3b82f6'
        },
        {
            label: t('overview.connectedChannelsLabel', { defaultValue: 'Canais conectados' }),
            value: connectedChannelsCount,
            description: t('overview.connectedChannelsDescription', { defaultValue: 'canais ativos' }),
            icon: MessageSquare,
            accent: '#38bdf8'
        },
        {
            label: t('overview.integrationsLabel', { defaultValue: 'Integrações' }),
            value: connectedIntegrationsCount,
            description: t('overview.integrationsDescription', { defaultValue: 'fontes conectadas' }),
            icon: Cpu,
            accent: '#f59e0b'
        },
        {
            label: t('overview.templatesInUseLabel', { defaultValue: 'Templates em uso' }),
            value: templatesInUseCount,
            description: t('overview.templatesInUseDescription', { defaultValue: 'agentes com template' }),
            icon: Sparkles,
            accent: '#60a5fa'
        }
    ]
    const activeLibraryDescription = 'Acompanhe status, canais e atalhos de gestão sem blocos redundantes.'
    const templateLibraryDescription = 'Mantenha sua biblioteca organizada com ownership, complexidade e ações visíveis.'


    const libraryActiveCopy = t('librarySection.agentsDescription', {
        defaultValue: 'Acompanhe status, canais e atalhos de gestão com mais clareza e menos ruído visual.'
    })
    const libraryTemplateCopy = t('librarySection.templatesDescription', {
        defaultValue: 'Organize templates com ownership, complexidade e ações sem blocos redundantes.'
    })

    const buildPairedGridItems = <T,>(items: T[], createKey: string) => {
        const entries = items.map((item, index) => ({
            kind: 'item' as const,
            item,
            key: `${createKey}-item-${index}`
        }))

        entries.push({
            kind: 'create' as const,
            key: createKey
        })

        if (entries.length % 2 !== 0) {
            entries.push({
                kind: 'placeholder' as const,
                key: `${createKey}-placeholder`
            })
        }

        return entries
    }

    const agentGridItems = agentsInLibrary.length > 0 ? buildPairedGridItems(agentsInLibrary, 'create-agent') : []
    const templateGridItems = templates.length > 0 ? buildPairedGridItems(templates, 'create-template') : []

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
                background: 'rgba(24, 24, 27, 0.98)',
                iconWrap: 'rgba(39, 39, 42, 0.92)',
                borderGlow: 'rgba(63, 63, 70, 0.9)',
                text: '#f8fafc',
                muted: '#a1a1aa'
            }
            : {
                background: 'rgba(255, 255, 255, 0.98)',
                iconWrap: 'rgba(244, 244, 245, 0.95)',
                borderGlow: 'rgba(228, 228, 231, 1)',
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
                background: isDark ? 'rgba(37, 99, 235, 0.14)' : 'rgba(37, 99, 235, 0.08)',
                color: isDark ? '#bfdbfe' : '#1d4ed8',
                border: `1px solid ${isDark ? 'rgba(59, 130, 246, 0.22)' : 'rgba(191, 219, 254, 1)'}`
            } as React.CSSProperties
        }
        if (complexity === 'Intermediate') {
            return {
                background: isDark ? 'rgba(161, 161, 170, 0.12)' : 'rgba(244, 244, 245, 1)',
                color: isDark ? '#e4e4e7' : '#3f3f46',
                border: `1px solid ${isDark ? 'rgba(82, 82, 91, 1)' : 'rgba(228, 228, 231, 1)'}`
            } as React.CSSProperties
        }
        return {
            background: isDark ? 'rgba(34, 197, 94, 0.12)' : 'rgba(34, 197, 94, 0.08)',
            color: isDark ? '#bbf7d0' : '#15803d',
            border: `1px solid ${isDark ? 'rgba(34, 197, 94, 0.22)' : 'rgba(187, 247, 208, 1)'}`
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
            className="min-h-screen -m-4 p-3 sm:p-4 md:p-6 animate-in fade-in duration-500"
            style={pageShellStyle}
        >
            <div className="mx-auto flex w-full min-w-0 max-w-[1680px] flex-col gap-6 sm:gap-7 lg:gap-8">
                <section
                    className="relative overflow-hidden rounded-[1.75rem] p-6 sm:p-7 lg:p-8 xl:p-9"
                    style={heroShellStyle}
                >
                    <div
                        className="pointer-events-none absolute inset-0 opacity-80"
                        aria-hidden="true"
                        style={{
                            background: isDark
                                ? 'radial-gradient(circle at top right, rgba(255, 255, 255, 0.045), transparent 38%), radial-gradient(circle at bottom left, rgba(255, 255, 255, 0.02), transparent 32%)'
                                : 'radial-gradient(circle at top right, rgba(37, 99, 235, 0.08), transparent 36%), radial-gradient(circle at bottom left, rgba(14, 165, 233, 0.08), transparent 30%)'
                        }}
                    />
                    <div className="relative flex min-w-0 flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                        <div className="min-w-0 flex-1 basis-0">
                            <div className="max-w-3xl min-w-0">
                                <h1 className="text-[2.35rem] font-semibold tracking-tight sm:text-[2.7rem] xl:text-[3rem]" style={{ color: panelTone.title }}>
                                    {t('header.title')}
                                </h1>
                                <p className="mt-3 max-w-3xl text-sm leading-7 sm:text-[15px] sm:leading-7 lg:text-base" style={{ color: panelTone.muted }}>
                                    {t('header.subtitleOverview')}
                                </p>
                            </div>
                        </div>
                        <div className="flex w-full min-w-0 flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center xl:w-auto xl:max-w-none xl:justify-end">
                    <Button
                        type="button"
                        className="h-10 min-w-[172px] justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-all duration-200"
                        style={secondaryHeaderButtonStyle}
                        onClick={() => setIsCreateTemplateOpen(true)}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-1px)'
                            e.currentTarget.style.boxShadow = isDark
                                ? '0 12px 24px -18px rgba(0, 0, 0, 0.75)'
                                : '0 12px 24px -18px rgba(15, 23, 42, 0.14)'
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
                        <Button className="h-10 min-w-[172px] justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-all duration-200"
                        style={mainButtonStyle}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-1px)'
                            e.currentTarget.style.boxShadow = isDark
                                ? '0 12px 24px -18px rgba(37, 99, 235, 0.65)'
                                : '0 12px 24px -18px rgba(37, 99, 235, 0.3)'
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
                        className="sm:max-w-[600px] rounded-xl border p-0"
                        style={dialogContentStyle}
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
                                <div className="flex items-center gap-3 border-b pb-3" style={{ borderColor: panelTone.border }}>
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{
                                        background: isDark ? 'rgba(37, 99, 235, 0.14)' : 'rgba(37, 99, 235, 0.08)',
                                        border: `1px solid ${panelTone.border}`
                                    }}>
                                        <Sparkles className="h-5 w-5" style={{ color: '#2563eb' }} />
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
                                        className="h-11 rounded-md border text-sm transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/30"
                                        style={dialogInputStyle}
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
                                        <SelectTrigger className="h-11 rounded-md border transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/30" style={dialogInputStyle}>
                                            <SelectValue placeholder={t('form.identity.languagePlaceholder')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {SUPPORTED_AGENT_LANGUAGES.map(lang => (
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
                                <div className="flex items-center gap-3 border-b pb-3" style={{ borderColor: panelTone.border }}>
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{
                                        background: isDark ? 'rgba(59, 130, 246, 0.12)' : 'rgba(59, 130, 246, 0.08)',
                                        border: `1px solid ${panelTone.border}`
                                    }}>
                                        <Cpu className="h-5 w-5" style={{ color: '#2563eb' }} />
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
                                                className="h-11 w-full justify-between rounded-md border transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/30"
                                                style={dialogInputStyle}
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
                                        <AccordionTrigger className="py-2 text-sm" style={dialogMutedTextStyle}>
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
                                                    <SelectTrigger className="h-11 rounded-md border transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/30" style={dialogInputStyle}>
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
                                                    <SelectTrigger className="h-11 rounded-md border transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/30" style={dialogInputStyle}>
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
                                <div className="flex items-center gap-3 border-b pb-3" style={{ borderColor: panelTone.border }}>
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{
                                        background: isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.08)',
                                        border: `1px solid ${panelTone.border}`
                                    }}>
                                        <Heart className="h-5 w-5" style={{ color: '#059669' }} />
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
                                        className="min-h-[100px] max-h-[100px] overflow-y-auto rounded-md border text-sm transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500/20"
                                        style={dialogInputStyle}
                                    placeholder={t('form.personality.behaviorPlaceholder')}
                                />
                            </div>
                        </div>
                        </div>
                        <div style={dialogFooterShellStyle}>
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
                                            <span className="text-sm font-medium" style={dialogMutedTextStyle}>
                                                {t('form.progress.step', { current: currentStep, total: 4 })}
                                            </span>
                                            <span className="text-sm font-bold" style={{ color: '#06b6d4' }}>
                                                {Math.round(progress)}%
                                            </span>
                                        </div>
                                        
                                        {/* Barra de Progresso com Animação de Energia */}
                                        <div style={progressTrackStyle}>
                                            <div 
                                                style={{ 
                                                    width: `${progress}%`,
                                                    height: '100%',
                                                    background: isComplete 
                                                        ? 'linear-gradient(90deg, #06b6d4 0%, #0891b2 50%, #0e7490 100%)'
                                                        : 'linear-gradient(90deg, #06b6d4 0%, #0891b2 100%)',
                                                    transition: 'width 0.5s ease-out',
                                                    borderRadius: radius.pill,
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
                                                        borderRadius: radius.pill
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
                                                        borderRadius: radius.pill
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
                                                        borderRadius: radius.pill
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
                                                className="h-11 rounded-lg px-8 font-semibold transition-all duration-200"
                                                style={{
                                                    background: isComplete ? '#2563eb' : (isDark ? '#52525b' : '#94a3b8'),
                                                    color: '#ffffff',
                                                    border: `1px solid ${isComplete ? 'rgba(59, 130, 246, 0.45)' : 'transparent'}`,
                                                    boxShadow: isComplete 
                                                        ? '0 10px 20px -16px rgba(37, 99, 235, 0.55)'
                                                        : 'none'
                                                }}
                                            >
                                                <span className="flex items-center" style={{ color: '#ffffff', fontWeight: '700' }}>
                                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" style={{ color: '#ffffff' }} />}
                                                    {isComplete && !isSubmitting && <Sparkles className="mr-2 h-4 w-4" style={{ color: '#ffffff' }} />}
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
                        className="sm:max-w-[600px] rounded-xl border p-0"
                        style={dialogContentStyle}
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
                                <div className="flex items-center gap-3 border-b pb-3" style={{ borderColor: panelTone.border }}>
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{
                                        background: isDark ? 'rgba(37, 99, 235, 0.14)' : 'rgba(37, 99, 235, 0.08)',
                                        border: `1px solid ${panelTone.border}`
                                    }}>
                                        <Sparkles className="h-5 w-5" style={{ color: '#2563eb' }} />
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
                                        className="h-11 rounded-md border text-sm transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/30"
                                        style={dialogInputStyle}
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
                                        className="h-11 rounded-md border text-sm transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/30"
                                        style={dialogInputStyle}
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
                                <div className="flex items-center gap-3 border-b pb-3" style={{ borderColor: panelTone.border }}>
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{
                                        background: isDark ? 'rgba(59, 130, 246, 0.12)' : 'rgba(59, 130, 246, 0.08)',
                                        border: `1px solid ${panelTone.border}`
                                    }}>
                                        <Cpu className="h-5 w-5" style={{ color: '#2563eb' }} />
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
                                        className="min-h-[150px] max-h-[150px] overflow-y-auto rounded-md border text-sm transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/30"
                                        style={dialogInputStyle}
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
                                            <SelectTrigger className="h-11 rounded-md border transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/30" style={dialogInputStyle}>
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
                                            <SelectTrigger className="h-11 rounded-md border transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/30" style={dialogInputStyle}>
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
                                        <AccordionTrigger className="py-2 text-sm" style={dialogMutedTextStyle}>
                                            <span className="text-xs font-medium">{t('form.template.optional.title')}</span>
                                        </AccordionTrigger>
                                        <AccordionContent className="space-y-4 pt-2">
                                            <div className="space-y-2">
                                                <Label className="text-sm font-semibold" style={{ color: theme === 'dark' ? '#f1f5f9' : '#1e293b' }}>
                                                    {t('form.template.optional.channelsLabel')}
                                </Label>
                                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                    {AVAILABLE_CHANNELS.map(channel => {
                                        const isSelected = newTemplate.selectedChannels.includes(channel.id)
                                        return (
                                            <div
                                                key={channel.id}
                                                onClick={() => toggleTemplateChannel(channel.id)}
                                                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border p-3 text-xs transition-all duration-200"
                                                style={{
                                                    background: isSelected
                                                        ? (isDark ? 'rgba(37, 99, 235, 0.16)' : 'rgba(37, 99, 235, 0.08)')
                                                        : panelTone.elevated,
                                                    borderColor: isSelected ? '#2563eb' : panelTone.border,
                                                    color: isSelected ? '#2563eb' : panelTone.title
                                                }}
                                            >
                                                                <channel.icon className="h-5 w-5" style={{ color: isSelected ? '#2563eb' : panelTone.muted }} />
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
                                                            className="h-11 w-full justify-between rounded-md border transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/30"
                                                            style={dialogInputStyle}
                                            >
                                                            <span style={dialogMutedTextStyle}>{t('form.template.optional.skillsPlaceholder')}</span>
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
                                            <Badge key={skill} variant="secondary" className="gap-1 rounded-md" style={{ background: panelTone.elevated, border: `1px solid ${panelTone.border}`, color: panelTone.title }}>
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
                        <div style={dialogFooterShellStyle}>
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
                                            <span className="text-sm font-medium" style={dialogMutedTextStyle}>
                                                {t('form.progress.step', { current: currentStep, total: 3 })}
                                            </span>
                                            <span className="text-sm font-bold" style={{ color: '#06b6d4' }}>
                                                {Math.round(progress)}%
                                            </span>
                                        </div>
                                        
                                        {/* Barra de Progresso com Animação de Energia */}
                                        <div style={progressTrackStyle}>
                                            <div 
                                                style={{ 
                                                    width: `${progress}%`,
                                                    height: '100%',
                                                    background: isComplete 
                                                        ? 'linear-gradient(90deg, #0891b2 0%, #06b6d4 50%, #22d3ee 100%)'
                                                        : 'linear-gradient(90deg, #0891b2 0%, #06b6d4 100%)',
                                                    transition: 'width 0.5s ease-out',
                                                    borderRadius: radius.pill,
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
                                                        borderRadius: radius.pill
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
                                                        borderRadius: radius.pill
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
                                                        borderRadius: radius.pill
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
                                                className="h-11 rounded-lg px-8 font-semibold transition-all duration-200"
                                                style={{
                                                    background: isComplete ? '#2563eb' : (isDark ? '#52525b' : '#94a3b8'),
                                                    color: '#ffffff',
                                                    border: `1px solid ${isComplete ? 'rgba(59, 130, 246, 0.45)' : 'transparent'}`,
                                                    boxShadow: isComplete 
                                                        ? '0 10px 20px -16px rgba(37, 99, 235, 0.55)'
                                                        : 'none'
                                                }}
                                            >
                                                <span className="flex items-center" style={{ color: '#ffffff', fontWeight: '700' }}>
                                                    {isSubmittingTemplate && <Loader2 className="mr-2 h-4 w-4 animate-spin" style={{ color: '#ffffff' }} />}
                                                    {isComplete && !isSubmittingTemplate && <Sparkles className="mr-2 h-4 w-4" style={{ color: '#ffffff' }} />}
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
                </section>

            <div className="grid max-w-[1180px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {overviewCards.map((item) => (
                    <div key={item.label} className="min-w-0">
                        <MetricCard
                            icon={item.icon}
                            label={item.label}
                            value={item.value}
                            description={item.description}
                            tone={panelTone}
                            accent={item.accent}
                        />
                    </div>
                ))}
            </div>

            <div className="flex flex-col gap-5">
            <SectionBlock
                eyebrow={t('channelsSection.eyebrow', { defaultValue: 'Canais & Integrações' })}
                title={t('channelsSection.title', { defaultValue: 'Status centralizado dos pontos de contato' })}
                description="Veja cobertura por canal e integrações conectadas sem navegar para outra área."
                tone={panelTone}
                shellStyle={sectionShellStyle}
                className="order-2 space-y-7 p-6 md:p-7"
                action={
                    <>
                        <SectionMetricPill
                            label={t('channelsSection.channelsLabel', { defaultValue: 'Canais' })}
                            value={connectedChannelsCount}
                            tone={panelTone}
                        />
                        <SectionMetricPill
                            label={t('channelsSection.integrationsLabel', { defaultValue: 'Integrações' })}
                            value={connectedIntegrationsCount}
                            tone={panelTone}
                        />
                    </>
                }
            >
                <div
                    className="hidden"
                    style={sectionShellStyle}
                >
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: panelTone.muted }}>
                            Canais e integrações
                        </p>
                        <h3 className="mt-1 text-lg font-semibold" style={{ color: panelTone.title }}>
                            Status centralizado dos pontos de contato
                        </h3>
                        <p className="mt-1 text-sm leading-6" style={{ color: panelTone.muted }}>
                            Visualize rapidamente o que já está conectado e o que ainda precisa ser configurado.
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:w-auto">
                        <div className="rounded-lg px-4 py-3" style={{ background: panelTone.elevated, border: `1px solid ${panelTone.border}` }}>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: panelTone.muted }}>Canais</p>
                            <p className="mt-1 text-xl font-semibold" style={{ color: panelTone.title }}>{connectedChannelsCount}</p>
                        </div>
                        <div className="rounded-lg px-4 py-3" style={{ background: panelTone.elevated, border: `1px solid ${panelTone.border}` }}>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: panelTone.muted }}>Integrações</p>
                            <p className="mt-1 text-xl font-semibold" style={{ color: panelTone.title }}>{connectedIntegrationsCount}</p>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                {channelsData.map((channel, i) => {
                    const statusMeta = getChannelStatusMeta(channel.status)
                    const channelTone = getChannelCardTone(channel.name, channel.status)
                    return (
                        <div
                            key={i}
                            className="min-h-[104px] transition-all duration-200"
                            style={{
                                background: channelTone.background,
                                border: `1px solid ${panelTone.border}`,
                                borderRadius: '24px',
                                opacity: 0.92,
                                boxShadow: isDark
                                    ? '0 14px 30px -26px rgba(0, 0, 0, 0.8)'
                                    : '0 12px 22px -20px rgba(15, 23, 42, 0.1)'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-1px)'
                                e.currentTarget.style.boxShadow = `0 0 0 1px ${withAlpha(channelTone.accent, 0.3)}, 0 0 26px ${withAlpha(channelTone.accent, 0.18)}`
                                e.currentTarget.style.borderColor = withAlpha(channelTone.accent, 0.7)
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)'
                                e.currentTarget.style.boxShadow = isDark
                                    ? '0 14px 30px -26px rgba(0, 0, 0, 0.8)'
                                    : '0 12px 22px -20px rgba(15, 23, 42, 0.1)'
                                e.currentTarget.style.borderColor = panelTone.border
                            }}
                        >
                            <div
                                className="flex h-full items-center justify-between gap-4 px-4 py-4"
                                style={{
                                    background: 'transparent',
                                    borderRadius: radius.card
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
                                    <p className="mt-1 line-clamp-2 text-sm leading-6" style={{ color: channelTone.muted, opacity: 0.78 }}>
                                        {channel.status === 'connected'
                                            ? 'Canal ativo e pronto para operação.'
                                            : channel.status === 'partial'
                                                ? 'Integração ativa com pontos pendentes.'
                                                : 'Canal disponível, aguardando conexão.'}
                                    </p>
                                    </div>
                                </div>
                                <Badge className="shrink-0 rounded-md px-2.5 py-0.5 text-[10px] font-semibold shadow-none" style={{ ...statusMeta.badgeStyle, borderRadius: radius.pill }}>
                                    {statusMeta.label}
                                </Badge>
                            </div>
                        </div>
                    )
                })}
                </div>
            </SectionBlock>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value)} className="order-1 space-y-6">
                <SectionBlock
                    eyebrow={t('librarySection.eyebrow', { defaultValue: 'Agentes & Templates' })}
                    title={activeTab === 'active'
                        ? t('librarySection.agentsTitle', { defaultValue: 'Agentes em produção' })
                        : t('librarySection.templatesTitle', { defaultValue: 'Biblioteca de templates' })}
                    description={activeTab === 'active' ? libraryActiveCopy : libraryTemplateCopy}
                    tone={panelTone}
                    shellStyle={sectionShellStyle}
                    className="space-y-7 p-6 md:p-7"
                    action={
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={bulkBlockersFetchBusy}
                                className="shrink-0 gap-2 border-destructive/40 text-destructive hover:bg-destructive/10"
                                onClick={() =>
                                    void openBulkDeletionModal(activeTab === 'active' ? 'agents' : 'templates')
                                }
                            >
                                {bulkBlockersFetchBusy ? (
                                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                ) : (
                                    <Trash2 className="h-4 w-4" aria-hidden />
                                )}
                                Excluir em lote
                            </Button>
                            <SectionMetricPill
                                label={activeTab === 'active'
                                    ? t('librarySection.agentsMetricLabel', { defaultValue: 'Agentes' })
                                    : t('librarySection.templatesMetricLabel', { defaultValue: 'Templates' })}
                                value={activeTab === 'active' ? agentsInLibrary.length : templates.length}
                                tone={panelTone}
                            />
                            <TabsList
                                className="flex h-auto flex-wrap gap-2 border p-1.5"
                                style={{
                                    background: panelTone.card,
                                    borderColor: panelTone.border,
                                    borderRadius: '22px',
                                    boxShadow: 'none'
                                }}
                            >
                    <TabsTrigger
                        value="active"
                        className="flex-1 px-5 py-3 text-sm font-semibold transition-all duration-200 sm:flex-none"
                        style={activeTab === 'active'
                            ? {
                                background: '#2563eb',
                                color: '#f8fafc',
                                borderRadius: radius.control,
                                border: '1px solid rgba(37, 99, 235, 0.4)',
                                boxShadow: isDark
                                    ? '0 8px 18px -14px rgba(37, 99, 235, 0.55)'
                                    : '0 8px 16px -12px rgba(37, 99, 235, 0.24)'
                            }
                            : {
                                color: panelTone.muted,
                                borderRadius: radius.control
                            }}
                    >
                        {t('tabs.agents')}
                    </TabsTrigger>
                    <TabsTrigger
                        value="templates"
                        className="flex-1 px-5 py-3 text-sm font-semibold transition-all duration-200 sm:flex-none"
                        style={activeTab === 'templates'
                            ? {
                                background: '#2563eb',
                                color: '#f8fafc',
                                borderRadius: radius.control,
                                border: '1px solid rgba(37, 99, 235, 0.4)',
                                boxShadow: isDark
                                    ? '0 8px 18px -14px rgba(37, 99, 235, 0.55)'
                                    : '0 8px 16px -12px rgba(37, 99, 235, 0.24)'
                            }
                            : {
                                color: panelTone.muted,
                                borderRadius: radius.control
                            }}
                    >
                        {t('tabs.templates')}
                    </TabsTrigger>
                            </TabsList>
                        </>
                    }
                >

                <TabsContent value="active" className="mt-0">
                    <div
                        className="hidden"
                        style={sectionShellStyle}
                    >
                        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: panelTone.muted }}>
                                    Overview
                                </p>
                                <h3 className="mt-1 text-xl font-semibold" style={{ color: panelTone.title }}>
                                    Operação de agentes em um painel mais limpo
                                </h3>
                                <p className="mt-1 text-sm leading-6" style={{ color: panelTone.muted }}>
                                    Veja volume, cobertura e uso de templates sem blocos extras nem hierarquia quebrada.
                                </p>
                            </div>
                            <Button
                                type="button"
                                onClick={() => setIsCreateOpen(true)}
                                className="h-11 rounded-lg px-5 text-sm font-semibold sm:w-auto"
                                style={mainButtonStyle}
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                {t('button.deployNewAgent')}
                            </Button>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            {[
                                { label: 'Active Agents', value: activeAgentsCount, copy: 'prontos para operar', icon: Bot },
                                { label: 'Channels Connected', value: connectedChannelsCount, copy: 'canais com status ativo', icon: MessageSquare },
                                { label: 'Integrations', value: connectedIntegrationsCount, copy: 'fontes externas conectadas', icon: Cpu },
                                { label: 'Templates in Use', value: templatesInUseCount, copy: 'agentes usando template', icon: Sparkles },
                            ].map((item) => (
                                <div
                                    key={item.label}
                                    className="rounded-lg p-4"
                                    style={{ background: panelTone.elevated, border: `1px solid ${panelTone.border}` }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="flex h-10 w-10 items-center justify-center rounded-md"
                                            style={{ background: isDark ? 'rgba(37, 99, 235, 0.14)' : 'rgba(37, 99, 235, 0.08)', color: '#2563eb' }}
                                        >
                                            <item.icon className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: panelTone.muted }}>{item.label}</p>
                                            <p className="mt-1 text-2xl font-semibold" style={{ color: panelTone.title }}>{item.value}</p>
                                        </div>
                                    </div>
                                    <p className="mt-3 text-sm" style={{ color: panelTone.muted }}>{item.copy}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex h-40 items-center justify-center rounded-xl" style={sectionShellStyle}>
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : agents.length === 0 ? (
                        <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed px-6 text-center" style={{ ...sectionShellStyle, borderStyle: 'dashed' }}>
                            <Bot className="h-10 w-10" style={{ color: panelTone.muted }} />
                            <h3 className="mt-4 text-lg font-semibold" style={{ color: panelTone.title }}>{t('empty.noAgents')}</h3>
                            <p className="mb-5 mt-2 max-w-md text-sm leading-6" style={{ color: panelTone.muted }}>{t('empty.noAgentsDescription')}</p>
                            <Button onClick={() => setIsCreateOpen(true)} className="rounded-lg px-5" style={mainButtonStyle}>{t('button.deployAgent')}</Button>
                        </div>
                    ) : (
                        <div className="space-y-8">
                        {agentsInLibrary.length === 0 && cancelledAgents.length > 0 ? (
                            <div
                                className="rounded-xl px-4 py-3 text-sm"
                                style={{ ...sectionShellStyle, borderStyle: 'solid', color: panelTone.muted }}
                            >
                                {t('agentsHub.allCancelledBanner', {
                                    defaultValue:
                                        'Todos os agentes desta empresa estão cancelados. Expanda “Agentes cancelados” abaixo para reativar ou crie um novo agente.',
                                })}
                            </div>
                        ) : null}
                        <div className="grid gap-6 md:grid-cols-2">
                            {agentsInLibrary.map((agent) => (
                                    <Card key={agent.id} className="group relative flex h-full min-h-[312px] cursor-pointer flex-col overflow-hidden rounded-[2.5rem] border-0 transition-all duration-200" style={{
                                        background: panelTone.card,
                                        borderRadius: '36px',
                                        boxShadow: isDark
                                            ? '0 12px 28px -22px rgba(0, 0, 0, 0.8)'
                                            : '0 12px 24px -20px rgba(15, 23, 42, 0.12)',
                                        border: `1px solid ${panelTone.border}`
                                    }} onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-2px)'
                                        e.currentTarget.style.borderColor = panelTone.hoverBorder
                                        e.currentTarget.style.boxShadow = isDark
                                            ? '0 16px 32px -24px rgba(0, 0, 0, 0.82)'
                                            : '0 14px 28px -20px rgba(15, 23, 42, 0.14)'
                                    }} onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)'
                                        e.currentTarget.style.borderColor = panelTone.border
                                        e.currentTarget.style.boxShadow = isDark
                                            ? '0 12px 28px -22px rgba(0, 0, 0, 0.8)'
                                            : '0 12px 24px -20px rgba(15, 23, 42, 0.12)'
                                    }}>
                                        <div className="flex flex-1 flex-col gap-5 p-6 sm:p-7">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex min-w-0 flex-1 items-center gap-4">
                                                    <div className="relative shrink-0">
                                                        <Avatar className="size-14 shrink-0 rounded-[2rem]">
                                                            <AvatarFallback className="rounded-[2rem] text-base font-bold text-white" style={{
                                                                background: 'linear-gradient(135deg, #0891b2 0%, #2563eb 58%, #8b5cf6 100%)',
                                                                boxShadow: '0 18px 30px -18px rgba(37, 99, 235, 0.65)'
                                                            }}>{agent.avatar}</AvatarFallback>
                                                    </Avatar>
                                                        <div className={`absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full ${(agent as any).status_id === 1 ? 'bg-emerald-500' : (agent as any).status_id === 3 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{
                                                            border: `2px solid ${isDark ? '#09090b' : '#ffffff'}`,
                                                            boxShadow: isDark ? '0 0 0 3px rgba(0, 0, 0, 0.35)' : '0 0 0 3px rgba(15, 23, 42, 0.16)'
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
                                                                    : Number((agent as any).status_id) === 2
                                                                        ? t('agentsHub.statusCancelled', { defaultValue: 'Cancelado' })
                                                                        : t('channels.status.disconnected')}
                                                        </div>
                                                </div>
                                            </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <div className="flex -space-x-1.5">
                                                        {agent.channels?.slice(0, 3).map(c => (
                                                            <div key={c} className="flex h-9 w-9 items-center justify-center rounded-full p-1.5" title={c} style={{
                                                                background: isDark ? 'rgba(24, 24, 27, 0.95)' : 'rgba(248, 250, 252, 0.96)',
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
                                                                background: isDark ? 'rgba(39, 39, 42, 0.85)' : 'rgba(248, 250, 252, 0.9)',
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
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </div>

                                            <div
                                                className="rounded-[2.25rem] px-4 py-3.5"
                                                style={{
                                                    ...elevatedInsetStyle,
                                                    border: `1px solid ${isDark ? 'rgba(63, 63, 70, 0.16)' : 'rgba(226, 232, 240, 0.72)'}`
                                                }}
                                            >
                                                <p className="line-clamp-2 text-sm leading-6" style={{ color: panelTone.muted }}>
                                                    {(() => {
                                                        const templateId = (agent as any).role_template_id
                                                        if (!templateId) {
                                                            return t('agent.noTemplateAssigned')
                                                        }
                                                        const template = templates.find(t => t.id === templateId)
                                                        return template?.role || t('agent.templateNotFound')
                                                    })()}
                                                </p>
                                            </div>

                                            <div className="mt-auto flex flex-wrap items-end justify-between gap-4 pt-1">
                                                <div
                                                    className="rounded-[2.25rem] px-4 py-3.5"
                                                    style={{
                                                        ...elevatedInsetStyle,
                                                        border: `1px solid ${isDark ? 'rgba(63, 63, 70, 0.16)' : 'rgba(226, 232, 240, 0.72)'}`
                                                    }}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{
                                                            background: isDark ? 'rgba(14, 165, 233, 0.1)' : 'rgba(37, 99, 235, 0.08)',
                                                            color: isDark ? '#67e8f9' : '#2563eb'
                                                        }}>
                                                            <Globe className="h-4 w-4" />
                                                        </div>
                                                        <div>
                                                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: panelTone.muted }}>Idioma</p>
                                                            <p className="text-sm font-semibold" style={{ color: panelTone.title }}>
                                                                {getAgentLanguageLabel(agent.languages?.[0], 'Português (Brasil)')}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-11 rounded-2xl px-4.5 text-xs font-semibold transition-all duration-200"
                                                    style={{
                                                        background: isDark ? 'rgba(37, 99, 235, 0.12)' : 'rgba(37, 99, 235, 0.08)',
                                                        border: `1px solid ${isDark ? 'rgba(59, 130, 246, 0.22)' : 'rgba(191, 219, 254, 1)'}`,
                                                        color: isDark ? '#e0f2fe' : '#1d4ed8',
                                                        borderRadius: radius.control
                                                    }}
                                                    onClick={() => navigate(`agent-config?id=${agent.id}`)}
                                                >
                                                    <Settings className="mr-1.5 h-3.5 w-3.5" />
                                                    {t('button.manage')}
                                                </Button>
                                            </div>
                                    </div>
                                </Card>
                            ))}

                            <Button
                                variant="outline"
                                onClick={() => setIsCreateOpen(true)}
                                className="group flex h-full min-h-[312px] flex-col items-center justify-center gap-5 rounded-[2.5rem] border border-dashed px-6 text-center transition-all duration-200"
                                style={{
                                    background: panelTone.card,
                                    border: `1px dashed ${panelTone.border}`,
                                    borderRadius: '36px',
                                    boxShadow: isDark
                                        ? '0 12px 28px -22px rgba(0, 0, 0, 0.78)'
                                        : '0 12px 24px -20px rgba(15, 23, 42, 0.12)'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-2px)'
                                    e.currentTarget.style.borderColor = panelTone.hoverBorder
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)'
                                    e.currentTarget.style.borderColor = panelTone.border
                                }}
                            >
                                    <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{
                                        background: isDark ? 'rgba(14, 165, 233, 0.12)' : 'rgba(37, 99, 235, 0.08)',
                                        color: isDark ? '#67e8f9' : '#2563eb',
                                        border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.16)' : 'rgba(37, 99, 235, 0.12)'}`
                                    }}>
                                        <Plus className="h-6 w-6" />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-lg font-semibold" style={{ color: panelTone.title }}>{t('button.deployNewAgent')}</h3>
                                        <p className="text-sm leading-6" style={{ color: panelTone.muted }}>{t('button.startFromTemplate')}</p>
                                    </div>
                            </Button>
                        </div>

                        {cancelledAgents.length > 0 ? (
                            <Collapsible open={showCancelledAgents} onOpenChange={setShowCancelledAgents}>
                                <CollapsibleTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="flex w-full items-center justify-between gap-2 rounded-xl px-4 py-3 text-left text-sm font-medium"
                                        style={{
                                            background: panelTone.elevated,
                                            border: `1px solid ${panelTone.border}`,
                                            color: panelTone.title,
                                        }}
                                    >
                                        <span>
                                            {t('agentsHub.cancelledSectionTitle', {
                                                defaultValue: 'Agentes cancelados',
                                            })}{' '}
                                            <span style={{ color: panelTone.muted }}>({cancelledAgents.length})</span>
                                        </span>
                                        <ChevronDown
                                            className={`h-4 w-4 shrink-0 transition-transform ${showCancelledAgents ? 'rotate-180' : ''}`}
                                            style={{ color: panelTone.muted }}
                                        />
                                    </Button>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-3 space-y-2">
                                    <p className="text-xs leading-relaxed" style={{ color: panelTone.muted }}>
                                        {t('agentsHub.cancelledSectionHint', {
                                            defaultValue:
                                                'Cancelar não remove o registro no banco de dados; o agente deixa de contar como ativo no plano e pode ser reativado.',
                                        })}
                                    </p>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        {cancelledAgents.map((agent) => (
                                            <div
                                                key={agent.id}
                                                className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3"
                                                style={{
                                                    background: panelTone.card,
                                                    border: `1px solid ${panelTone.border}`,
                                                }}
                                            >
                                                <div className="min-w-0">
                                                    <p className="truncate font-medium text-sm" style={{ color: panelTone.title }}>
                                                        {agent.name}
                                                    </p>
                                                    <p className="text-xs" style={{ color: panelTone.muted }}>
                                                        {t('agentsHub.statusCancelled', { defaultValue: 'Cancelado' })}
                                                    </p>
                                                </div>
                                                <div className="flex shrink-0 flex-wrap gap-2">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        className="rounded-lg"
                                                        onClick={() => void handleReactivateAgent(agent.id)}
                                                    >
                                                        <Play className="mr-1.5 h-3.5 w-3.5 text-emerald-500" />
                                                        {t('actions.reactivate')}
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                        ) : null}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="templates" className="mt-0">
                    <div
                        className="hidden"
                        style={sectionShellStyle}
                    >
                        <div className="space-y-2">
                            <div className="inline-flex items-center gap-2 rounded-md px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]" style={{
                                background: isDark ? 'rgba(14, 165, 233, 0.1)' : 'rgba(37, 99, 235, 0.08)',
                                color: isDark ? '#67e8f9' : '#2563eb',
                                border: `1px solid ${isDark ? 'rgba(103, 232, 249, 0.16)' : 'rgba(37, 99, 235, 0.12)'}`
                            }}>
                                <Sparkles className="h-3.5 w-3.5" />
                                Biblioteca de templates
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold" style={{ color: panelTone.title }}>
                                    Adicione e limpe templates com mais clareza
                                </h3>
                                <p className="mt-1 text-sm leading-6" style={{ color: panelTone.muted }}>
                                    Seus modelos ficam separados do que e compartilhado, com acoes visiveis direto em cada card.
                                </p>
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[460px]">
                            <div className="rounded-lg p-4" style={{
                                background: panelTone.elevated,
                                border: `1px solid ${panelTone.border}`
                            }}>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: panelTone.muted }}>Seus templates</p>
                                <p className="mt-2 text-2xl font-semibold" style={{ color: panelTone.title }}>{customTemplatesCount}</p>
                                <p className="mt-1 text-sm" style={{ color: panelTone.muted }}>
                                    {sharedTemplatesCount > 0 ? `${sharedTemplatesCount} compartilhados alem dos seus` : 'editaveis agora'}
                                </p>
                            </div>
                            <div className="rounded-lg p-4" style={{
                                background: panelTone.elevated,
                                border: `1px solid ${panelTone.border}`
                            }}>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: panelTone.muted }}>Em uso</p>
                                <p className="mt-2 text-2xl font-semibold" style={{ color: panelTone.title }}>{templatesInUseCount}</p>
                                <p className="mt-1 text-sm" style={{ color: panelTone.muted }}>agentes com template</p>
                            </div>
                            <Button
                                type="button"
                                onClick={() => setIsCreateTemplateOpen(true)}
                                className="h-full min-h-[104px] justify-start rounded-lg px-5 py-4 text-left transition-all duration-200"
                                style={mainButtonStyle}
                            >
                                <div className="flex flex-col items-start gap-2">
                                    <div className="flex items-center gap-2 text-sm font-semibold">
                                        <Plus className="h-4 w-4" />
                                        {t('button.createTemplate')}
                                    </div>
                                    <p className="text-xs leading-5 text-sky-50/90">
                                        Crie um template novo sem procurar a acao no fim da grade.
                                    </p>
                                </div>
                            </Button>
                        </div>
                    </div>

                    {templatesLoading ? (
                        <div className="flex h-40 items-center justify-center rounded-xl" style={sectionShellStyle}>
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : templates.length === 0 ? (
                        <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed px-6 text-center" style={{ ...sectionShellStyle, borderStyle: 'dashed' }}>
                            <Bot className="h-10 w-10" style={{ color: panelTone.muted }} />
                            <h3 className="mt-4 text-lg font-semibold" style={{ color: panelTone.title }}>{t('empty.noTemplates')}</h3>
                            <p className="mb-5 mt-2 max-w-md text-sm leading-6" style={{ color: panelTone.muted }}>{t('empty.noTemplatesDescription')}</p>
                            <Button onClick={() => setIsCreateTemplateOpen(true)} className="rounded-lg px-5" style={mainButtonStyle}>
                                <Plus className="h-4 w-4 mr-2" />
                                {t('button.createTemplate')}
                            </Button>
                        </div>
                    ) : (
                        <div className="grid gap-6 md:grid-cols-2">
                            {templates.map((template) => {
                                const IconComponent = template.IconComponent || getTemplateIcon(template.icon)
                                const ownershipMeta = template.isShared
                                    ? {
                                        label: 'Compartilhado',
                                        style: {
                                            background: isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(148, 163, 184, 0.14)',
                                            color: isDark ? '#cbd5e1' : '#475569',
                                            border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.16)' : 'rgba(148, 163, 184, 0.24)'}`
                                        }
                                    }
                                    : {
                                        label: 'Seu template',
                                        style: {
                                            background: isDark ? 'rgba(34, 197, 94, 0.12)' : 'rgba(34, 197, 94, 0.1)',
                                            color: isDark ? '#86efac' : '#15803d',
                                            border: `1px solid ${isDark ? 'rgba(34, 197, 94, 0.18)' : 'rgba(34, 197, 94, 0.2)'}`
                                        }
                                    }

                                return (
                                    <Card
                                        key={template.id}
                                        className="group relative flex h-full min-h-[320px] flex-col overflow-hidden rounded-[2.5rem] border-0 transition-all duration-200"
                                        style={{
                                            background: panelTone.card,
                                            borderRadius: '36px',
                                            boxShadow: isDark
                                                ? '0 12px 28px -22px rgba(0, 0, 0, 0.8)'
                                                : '0 12px 24px -20px rgba(15, 23, 42, 0.12)',
                                            border: `1px solid ${panelTone.border}`
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = 'translateY(-2px)'
                                            e.currentTarget.style.borderColor = panelTone.hoverBorder
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'translateY(0)'
                                            e.currentTarget.style.borderColor = panelTone.border
                                        }}
                                    >
                                        <div className="flex flex-1 flex-col gap-5 p-5 sm:p-6">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex min-w-0 flex-1 items-center gap-4">
                                                    <div
                                                        className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-[2rem] text-white"
                                                        style={{
                                                            background: 'linear-gradient(135deg, #0891b2 0%, #2563eb 58%, #8b5cf6 100%)',
                                                            boxShadow: '0 18px 30px -18px rgba(37, 99, 235, 0.65)'
                                                        }}
                                                    >
                                                        <IconComponent className="h-5 w-5" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <CardTitle className="truncate text-lg font-semibold leading-tight" style={{ color: panelTone.title }}>
                                                            {template.name}
                                                        </CardTitle>
                                                        <div className="mt-1 flex flex-wrap items-center gap-2">
                                                            <span className="truncate text-sm font-medium" style={{ color: panelTone.muted }}>
                                                                {template.role}
                                                            </span>
                                                            <Badge
                                                                variant="outline"
                                                                className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold shadow-none"
                                                                style={{ ...ownershipMeta.style, borderRadius: radius.pill }}
                                                            >
                                                                {ownershipMeta.label}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <Badge 
                                                        variant="outline"
                                                        className="rounded-full px-3 py-1 text-[11px] font-semibold shadow-none"
                                                        style={{ ...getComplexityMeta(template.complexity), borderRadius: radius.pill }}
                                                    >
                                                        {template.complexity}
                                                    </Badge>
                                                </div>
                                            </div>

                                            <div
                                                className="w-full px-[18px] py-[10px]"
                                                style={{
                                                    background: isDark ? '#232326' : '#f3f4f6',
                                                    borderRadius: '4px'
                                                }}
                                            >
                                                <p className="line-clamp-2 text-sm leading-6" style={{ color: panelTone.muted }}>
                                                    {template.description || t('template.noDescription')}
                                                </p>
                                            </div>

                                            <div className="mt-auto space-y-4 pt-1">
                                                <div className="space-y-4">
                                                    <div
                                                        className="w-full p-4"
                                                        style={{
                                                            background: isDark ? '#232326' : '#f3f4f6',
                                                            borderRadius: '4px'
                                                        }}
                                                    >
                                                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: panelTone.muted }}>
                                                            <LinkIcon className="h-3.5 w-3.5" />
                                                            Canais
                                                        </div>
                                                        <p className="mt-2 text-sm leading-6" style={{ color: panelTone.title }}>
                                                            {template.defaultChannels.length > 0 ? template.defaultChannels.join(', ') : 'Webchat'}
                                                        </p>
                                                    </div>
                                                    <div
                                                        className="w-full p-4"
                                                        style={{
                                                            background: isDark ? '#232326' : '#f3f4f6',
                                                            borderRadius: '4px'
                                                        }}
                                                    >
                                                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: panelTone.muted }}>
                                                            <Cpu className="h-3.5 w-3.5" />
                                                            Skills
                                                        </div>
                                                        <p className="mt-2 text-sm leading-6" style={{ color: panelTone.title }}>
                                                            {template.skills.length > 0 ? `${template.skills.length} vinculadas` : 'Nenhuma extra'}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap items-center gap-3">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-10 rounded-[18px] px-4 text-sm font-semibold transition-all duration-200"
                                                        style={{
                                                            background: isDark ? 'rgba(37, 99, 235, 0.12)' : 'rgba(37, 99, 235, 0.08)',
                                                            border: `1px solid ${isDark ? 'rgba(59, 130, 246, 0.22)' : 'rgba(191, 219, 254, 1)'}`,
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
                                        </div>
                                    </Card>
                                )
                            })}

                            <Button
                                variant="outline"
                                onClick={() => setIsCreateTemplateOpen(true)}
                                className="group flex h-full min-h-[320px] flex-col items-center justify-center gap-5 rounded-[2.5rem] border border-dashed px-6 text-center transition-all duration-200"
                                style={{
                                    background: panelTone.card,
                                    border: `1px dashed ${panelTone.border}`,
                                    borderRadius: '36px',
                                    boxShadow: isDark
                                        ? '0 12px 28px -22px rgba(0, 0, 0, 0.78)'
                                        : '0 12px 24px -20px rgba(15, 23, 42, 0.12)'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-2px)'
                                    e.currentTarget.style.borderColor = panelTone.hoverBorder
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)'
                                    e.currentTarget.style.borderColor = panelTone.border
                                }}
                            >
                                    <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{
                                        background: isDark ? 'rgba(14, 165, 233, 0.12)' : 'rgba(37, 99, 235, 0.08)',
                                        color: isDark ? '#67e8f9' : '#2563eb',
                                        border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.16)' : 'rgba(37, 99, 235, 0.12)'}`
                                    }}>
                                        <Plus className="h-6 w-6" />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-lg font-semibold" style={{ color: panelTone.title }}>{t('button.createTemplate')}</h3>
                                        <p className="text-sm leading-6" style={{ color: panelTone.muted }}>{t('button.startFromScratch')}</p>
                                    </div>
                            </Button>
                        </div>
                    )}
                </TabsContent>
                </SectionBlock>
            </Tabs>
            </div>

            <BulkDeleteResourcesDialog
                open={bulkAgentsOpen}
                onOpenChange={(o) => {
                    setBulkAgentsOpen(o)
                    if (!o) setDeletionBlockers(null)
                }}
                title="Excluir agentes em lote"
                description="Marque os agentes que deseja remover permanentemente. Itens usados em fluxos ficam bloqueados até você ajustar o fluxo. Esta ação não pode ser desfeita."
                items={bulkAgentDeleteItems}
                loading={false}
                confirmBusy={bulkDeleteRunning}
                onConfirm={runBulkDeleteAgents}
            />

            <BulkDeleteResourcesDialog
                open={bulkTemplatesOpen}
                onOpenChange={(o) => {
                    setBulkTemplatesOpen(o)
                    if (!o) setDeletionBlockers(null)
                }}
                title="Excluir templates em lote"
                description="Marque os modelos de papel que deseja excluir. Templates vinculados a agentes ou compartilhados da plataforma não podem ser selecionados."
                items={bulkTemplateDeleteItems}
                loading={false}
                confirmBusy={bulkDeleteRunning}
                onConfirm={runBulkDeleteTemplates}
            />
        </div>
        </div>
    )
}
