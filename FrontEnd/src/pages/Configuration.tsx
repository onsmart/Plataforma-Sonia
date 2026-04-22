import { useEffect, useState, type ComponentType, type CSSProperties, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import i18n from "../i18n/config"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Badge } from "../components/ui/badge"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"
import { 
    Users, 
    Mail, 
    Plus, 
    MoreVertical, 
    Trash2,
    Loader2,
    Building2,
    AlertCircle,
    Settings as SettingsIcon,
    Bell,
    CreditCard,
    Shield,
    AlertTriangle,
    Zap,
    Info,
    CheckCircle2,
    XCircle
} from "lucide-react"
import { Settings } from "./Settings"
import { AgentService } from "../services/api"
import { toast } from "sonner"
import { Avatar, AvatarFallback } from "../components/ui/avatar"
import { useAuth } from "../contexts/AuthContext"
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu"

import { Switch } from "../components/ui/switch"
import { useTheme } from "next-themes"

type PlaygroundTone = "info" | "warning" | "error" | "success"

function PlaygroundToastButton({
    tone,
    isDark,
    onClick,
    icon: Icon,
    children,
}: {
    tone: PlaygroundTone
    isDark: boolean
    onClick: () => void | Promise<void>
    icon: ComponentType<{ className?: string; style?: CSSProperties }>
    children: ReactNode
}) {
    const light = {
        info: {
            bg: "#bfdbfe",
            fg: "#1e40af",
            icon: "#1e40af",
            border: "none" as const,
            shadow: "0 2px 8px -2px rgba(59, 130, 246, 0.2), 0 1px 3px -1px rgba(59, 130, 246, 0.15)",
            hoverBg: "#93c5fd",
            hoverShadow: "0 4px 12px -2px rgba(59, 130, 246, 0.3), 0 2px 4px -1px rgba(59, 130, 246, 0.2)",
        },
        warning: {
            bg: "#fde68a",
            fg: "#92400e",
            icon: "#92400e",
            border: "none" as const,
            shadow: "0 2px 8px -2px rgba(245, 158, 11, 0.2), 0 1px 3px -1px rgba(245, 158, 11, 0.15)",
            hoverBg: "#fcd34d",
            hoverShadow: "0 4px 12px -2px rgba(245, 158, 11, 0.3), 0 2px 4px -1px rgba(245, 158, 11, 0.2)",
        },
        error: {
            bg: "#fca5a5",
            fg: "#991b1b",
            icon: "#991b1b",
            border: "none" as const,
            shadow: "0 2px 8px -2px rgba(239, 68, 68, 0.2), 0 1px 3px -1px rgba(239, 68, 68, 0.15)",
            hoverBg: "#f87171",
            hoverShadow: "0 4px 12px -2px rgba(239, 68, 68, 0.3), 0 2px 4px -1px rgba(239, 68, 68, 0.2)",
        },
        success: {
            bg: "#86efac",
            fg: "#065f46",
            icon: "#065f46",
            border: "none" as const,
            shadow: "0 2px 8px -2px rgba(16, 185, 129, 0.2), 0 1px 3px -1px rgba(16, 185, 129, 0.15)",
            hoverBg: "#4ade80",
            hoverShadow: "0 4px 12px -2px rgba(16, 185, 129, 0.3), 0 2px 4px -1px rgba(16, 185, 129, 0.2)",
        },
    }[tone]

    const dark = {
        info: {
            bg: "#27272a",
            fg: "#fafafa",
            icon: "#60a5fa",
            border: "1px solid rgba(59, 130, 246, 0.38)",
            shadow: "0 2px 12px -2px rgba(0, 0, 0, 0.35)",
            hoverBg: "#3f3f46",
            hoverShadow: "0 4px 16px -2px rgba(0, 0, 0, 0.45)",
        },
        warning: {
            bg: "#27272a",
            fg: "#fafafa",
            icon: "#fbbf24",
            border: "1px solid rgba(245, 158, 11, 0.42)",
            shadow: "0 2px 12px -2px rgba(0, 0, 0, 0.35)",
            hoverBg: "#3f3f46",
            hoverShadow: "0 4px 16px -2px rgba(0, 0, 0, 0.45)",
        },
        error: {
            bg: "#27272a",
            fg: "#fafafa",
            icon: "#f87171",
            border: "1px solid rgba(248, 113, 113, 0.4)",
            shadow: "0 2px 12px -2px rgba(0, 0, 0, 0.35)",
            hoverBg: "#3f3f46",
            hoverShadow: "0 4px 16px -2px rgba(0, 0, 0, 0.45)",
        },
        success: {
            bg: "#27272a",
            fg: "#fafafa",
            icon: "#4ade80",
            border: "1px solid rgba(74, 222, 128, 0.38)",
            shadow: "0 2px 12px -2px rgba(0, 0, 0, 0.35)",
            hoverBg: "#3f3f46",
            hoverShadow: "0 4px 16px -2px rgba(0, 0, 0, 0.45)",
        },
    }[tone]

    const c = isDark ? dark : light

    return (
        <Button
            onClick={() => void onClick()}
            className="px-6 h-12 font-black uppercase text-[10px] tracking-widest transition-all"
            style={{
                backgroundColor: c.bg,
                color: c.fg,
                border: c.border,
                borderRadius: "2.5rem",
                boxShadow: c.shadow,
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = c.hoverBg
                e.currentTarget.style.boxShadow = c.hoverShadow
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = c.bg
                e.currentTarget.style.boxShadow = c.shadow
            }}
        >
            <Icon className="mr-2 h-4 w-4" style={{ color: c.icon }} />
            {children}
        </Button>
    )
}

function NotificationPreferences() {
    const { theme } = useTheme()
    const { t } = useTranslation('configuration')
    const [prefs, setPrefs] = useState({
        billing: true,
        security: true,
        system: false
    })

    const toggle = (key: keyof typeof prefs) => {
        setPrefs(prev => ({ ...prev, [key]: !prev[key] }))
        toast.success(t('notifications.saved'))
    }

    const preferences = [
        {
            key: 'billing' as const,
            title: t('notifications.billing.title'),
            description: t('notifications.billing.description'),
            icon: CreditCard,
            iconColor: '#d97706', // amarelo/dourado mais escuro
            iconBg: '#fef3c7', // amarelo pastel para o box do ícone
            cardBg: '#fef3c7' // amarelo pastel para billing
        },
        {
            key: 'security' as const,
            title: t('notifications.security.title'),
            description: t('notifications.security.description'),
            icon: Shield,
            iconColor: '#ef4444',
            iconBg: '#fee2e2',
            cardBg: '#fee2e2' // vermelho pastel para security
        },
        {
            key: 'system' as const,
            title: t('notifications.system.title'),
            description: t('notifications.system.description'),
            icon: Bell,
            iconColor: '#6366f1',
            iconBg: '#e0e7ff',
            cardBg: '#e0f2fe' // azul/ciano pastel para system
        }
    ]

    const isDark = theme === 'dark'

    const iconBgFor = (key: (typeof preferences)[number]['key']) => {
        if (!isDark) return null
        if (key === 'billing') return 'rgba(234, 179, 8, 0.14)'
        if (key === 'security') return 'rgba(248, 113, 113, 0.12)'
        return 'rgba(99, 102, 241, 0.14)'
    }

    return (
        <Card 
            className="border-none overflow-hidden"
            style={{ 
                borderRadius: '3rem',
                backgroundColor: isDark ? '#18181b' : '#ffffff',
                border: isDark ? '1px solid rgba(63, 63, 70, 0.5)' : '1px solid rgb(228 228 231)',
                boxShadow: isDark
                    ? '0 12px 32px -12px rgba(0, 0, 0, 0.45)'
                    : '0 10px 25px -5px rgba(0, 0, 0, 0.06), 0 4px 6px -2px rgba(0, 0, 0, 0.04)',
            }}
        >
            <CardHeader>
                <CardTitle className="text-2xl font-black" style={{ color: isDark ? '#fafafa' : '#0f172a' }}>{t('notifications.title')}</CardTitle>
                <CardDescription style={{ color: isDark ? '#a1a1aa' : '#64748b' }}>{t('notifications.description')}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {preferences.map((pref) => {
                        const Icon = pref.icon
                        const iconBg = iconBgFor(pref.key) ?? pref.iconBg
                        const cardBg = isDark ? '#27272a' : pref.cardBg
                        const cardBorder = isDark ? '1px solid rgba(63, 63, 70, 0.55)' : '2px solid rgb(241, 245, 249)'
                        const restShadow = isDark
                            ? '0 2px 12px -2px rgba(0, 0, 0, 0.35)'
                            : '0 2px 8px -2px rgba(0, 0, 0, 0.05), 0 1px 3px -1px rgba(0, 0, 0, 0.03)'
                        const hoverShadow = isDark
                            ? '0 4px 18px -2px rgba(0, 0, 0, 0.45)'
                            : '0 4px 12px -2px rgba(0, 0, 0, 0.08), 0 2px 4px -1px rgba(0, 0, 0, 0.04)'
                        return (
                            <div
                                key={pref.key}
                                className="flex items-center justify-between p-6 transition-all"
                                style={{
                                    borderRadius: '2.5rem',
                                    border: cardBorder,
                                    backgroundColor: cardBg,
                                    boxShadow: restShadow,
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.boxShadow = hoverShadow
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.boxShadow = restShadow
                                }}
                            >
                                <div className="flex items-center gap-4 flex-1">
                                    <div 
                                        className="rounded-xl flex items-center justify-center shadow-sm"
                                        style={{ 
                                            backgroundColor: iconBg, 
                                            width: '56px', 
                                            height: '56px' 
                                        }}
                                    >
                                        <Icon size={24} color={pref.iconColor} strokeWidth={2.5} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <Label className="text-base font-bold mb-1 block" style={{ color: isDark ? '#fafafa' : '#0f172a' }}>{pref.title}</Label>
                                        <p className="text-xs leading-relaxed" style={{ color: isDark ? '#a1a1aa' : '#475569' }}>{pref.description}</p>
                                    </div>
                                </div>
                                <Switch 
                                    checked={prefs[pref.key]} 
                                    onCheckedChange={() => toggle(pref.key)}
                                    className="ml-4"
                                />
                            </div>
                        )
                    })}
                </div>
            </CardContent>
        </Card>
    )
}

function Team() {
    const { hasCompany, refreshCompany } = useAuth()
    const { t } = useTranslation('configuration')
    const [members, setMembers] = useState<any[]>([])
    const [permissions, setPermissions] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [inviting, setInviting] = useState(false)
    const [email, setEmail] = useState("")
    const [permissionKey, setPermissionKey] = useState("basic.read")
    const [companyName, setCompanyName] = useState("")
    const [creatingCompany, setCreatingCompany] = useState(false)

    useEffect(() => {
        if (hasCompany) {
            loadPermissions()
            loadTeam()
        }
    }, [hasCompany])

    const loadPermissions = async () => {
        const data = await AgentService.getAvailablePermissions()
        setPermissions(data)
        if (data.length > 0 && !permissionKey) {
            setPermissionKey(data[0].key)
        }
    }

    const loadTeam = async () => {
        setLoading(true)
        try {
            const data = await AgentService.getTeam()
            setMembers(data)
        } catch (e: any) {
            toast.error(e.message || t('team.error.load'))
        } finally {
            setLoading(false)
        }
    }

    const handleInvite = async () => {
        if (!email) return
        setInviting(true)
        try {
            const result = await AgentService.inviteMember(email, permissionKey)
            if (result?.success) {
                toast.success(result.message || t('team.success.add', { email }))
                setEmail("")
                loadTeam()
            } else {
                throw new Error(result?.message || t('team.error.addFailed'))
            }
        } catch (e: any) {
            toast.error(e.message || t('team.error.add'))
        } finally {
            setInviting(false)
        }
    }

    const handleRemove = async (email: string) => {
        if (!confirm(t('team.confirm.remove', { email }))) return
        try {
            await AgentService.removeMember(email)
            toast.success(t('team.success.remove'))
            loadTeam()
        } catch (e: any) {
            toast.error(e.message || t('team.error.remove'))
        }
    }

    const handleUpdatePermission = async (email: string, oldPermissionKey: string, newPermissionKey: string) => {
        try {
            const result = await AgentService.updateMemberPermission(email, oldPermissionKey, newPermissionKey)
            if (result?.success) {
                toast.success(t('team.success.updatePermission'))
                loadTeam()
            }
        } catch (e: any) {
            toast.error(e.message || t('team.error.updatePermission'))
        }
    }

    const handleCreateCompany = async () => {
        if (!companyName.trim()) {
            toast.error(t('company.create.error.nameRequired'))
            return
        }
        
        setCreatingCompany(true)
        try {
            const result = await AgentService.createCompany(companyName.trim())
            if (result?.success) {
                toast.success(result.message || t('company.create.success'))
                setCompanyName("")
                // Atualizar companiesId no contexto
                await refreshCompany()
                // Recarregar team
                loadTeam()
            } else {
                throw new Error(result?.message || t('company.create.error.failed'))
            }
        } catch (e: any) {
            toast.error(e.message || t('company.create.error'))
        } finally {
            setCreatingCompany(false)
        }
    }

    // ✅ Se não tiver empresa, mostrar formulário de criação
    if (!hasCompany) {
        return (
            <div className="space-y-6">
                <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <AlertTitle className="text-yellow-800 dark:text-yellow-200">{t('company.notConfigured.title')}</AlertTitle>
                    <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                        {t('company.notConfigured.description')}
                    </AlertDescription>
                </Alert>
                
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Building2 className="h-5 w-5" />
                            {t('company.create.title')}
                        </CardTitle>
                        <CardDescription>
                            {t('company.create.description')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <Label htmlFor="company-name">{t('company.create.name.label')}</Label>
                            <Input
                                id="company-name"
                                placeholder={t('company.create.name.placeholder')}
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !creatingCompany) {
                                        handleCreateCompany()
                                    }
                                }}
                            />
                        </div>
                        <Button 
                            onClick={handleCreateCompany} 
                            disabled={creatingCompany || !companyName.trim()}
                            className="w-full"
                        >
                            {creatingCompany ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    {t('company.create.creating')}
                                </>
                            ) : (
                                <>
                                    <Plus className="h-4 w-4 mr-2" />
                                    {t('company.create.button')}
                                </>
                            )}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>{t('team.title')}</CardTitle>
                        <CardDescription>{t('team.description')}</CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-4 items-end mb-6 p-4 bg-muted/30 rounded-lg border">
                        <div className="grid gap-2 flex-1">
                            <Label htmlFor="email">{t('team.email.label')}</Label>
                            <div className="relative">
                                <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    id="email" 
                                    placeholder={t('team.email.placeholder')} 
                                    className="pl-9"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="grid gap-2 w-[250px]">
                            <Label>{t('team.permission.label')}</Label>
                            <Select value={permissionKey} onValueChange={setPermissionKey}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {permissions.map((perm) => (
                                        <SelectItem key={perm.key} value={perm.key}>
                                            {perm.name} ({perm.category})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button onClick={handleInvite} disabled={inviting || !email}>
                            {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                            {t('team.invite')}
                        </Button>
                    </div>

                    <div className="space-y-4">
                        {loading ? (
                            <div className="text-center py-8 text-muted-foreground">{t('team.loading')}</div>
                        ) : members.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">{t('team.empty')}</div>
                        ) : (
                            members.map((member, i) => (
                                <div key={i} className="flex items-center justify-between p-4 border rounded-lg bg-card">
                                    <div className="flex items-center gap-4 flex-1">
                                        <Avatar>
                                            <AvatarFallback className="uppercase">
                                                {(member.name || member.email).substring(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1">
                                            <p className="font-medium text-sm">{member.name || member.email}</p>
                                            <p className="text-xs text-muted-foreground">{member.email}</p>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {member.permissions && member.permissions.length > 0 ? (
                                                    member.permissions.map((perm: any, idx: number) => (
                                                        <Badge key={idx} variant="outline" className="text-xs">
                                                            {perm.name}
                                                        </Badge>
                                                    ))
                                                ) : (
                                                    <Badge variant="outline" className="text-xs text-muted-foreground">
                                                        {t('team.noPermissions')}
                                                    </Badge>
                                                )}
                                            </div>
                                            {member.created_at && (
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {t('team.addedAt')} {new Date(member.created_at).toLocaleDateString(i18n.language || 'pt-BR')}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>{t('team.changePermission')}</DropdownMenuLabel>
                                                {permissions.map((perm) => {
                                                    const hasPermission = member.permissions?.some((p: any) => p.key === perm.key)
                                                    if (hasPermission) return null
                                                    return (
                                                        <DropdownMenuItem 
                                                            key={perm.key}
                                                            onClick={() => {
                                                                const oldPermission = member.permissions?.[0]?.key || 'basic.read'
                                                                handleUpdatePermission(member.email, oldPermission, perm.key)
                                                            }}
                                                        >
                                                            {perm.name}
                                                        </DropdownMenuItem>
                                                    )
                                                })}
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem className="text-destructive" onClick={() => handleRemove(member.email)}>
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    {t('team.remove')}
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

export function Configuration() {
    const { theme } = useTheme()
    const { t, i18n } = useTranslation('configuration')
    const [activeTab, setActiveTab] = useState("general")
    const [settingsTab, setSettingsTab] = useState<string | undefined>(undefined)
    const [translationsReady, setTranslationsReady] = useState(false)
    
    // Garantir que as traduções estejam carregadas
    useEffect(() => {
        const checkTranslations = async () => {
            const currentLang = i18n.language || 'pt-BR'
            const configTranslations = i18n.getResourceBundle(currentLang, 'configuration')

            if (configTranslations && Object.keys(configTranslations).length > 0) {
                setTranslationsReady(true)
            } else {
                const { loadTranslationsFromDatabase } = await import('../i18n/config')
                const companiesId = localStorage.getItem('companies_id') || undefined
                await loadTranslationsFromDatabase(currentLang, companiesId)
                i18n.emit('loaded')
                setTranslationsReady(true)
            }
        }
        checkTranslations()
        const handleLanguageChanged = () => { checkTranslations() }
        const handleLoaded = () => {
            const currentLang = i18n.language || 'pt-BR'
            const translations = i18n.getResourceBundle(currentLang, 'configuration')
            if (translations && Object.keys(translations).length > 0) {
                setTranslationsReady(true)
            }
        }
        const handleAdded = () => { handleLoaded() }
        i18n.on('languageChanged', handleLanguageChanged)
        i18n.on('loaded', handleLoaded)
        i18n.on('added', handleAdded)
        return () => {
            i18n.off('languageChanged', handleLanguageChanged)
            i18n.off('loaded', handleLoaded)
            i18n.off('added', handleAdded)
        }
    }, [i18n])
    
    // Verifica se há query param para definir a aba do Settings
    useEffect(() => {
        const hash = window.location.hash.replace('#', '')
        const hashParts = hash.split('?')
        if (hashParts.length > 1) {
            const urlParams = new URLSearchParams(hashParts[1])
            const tab = urlParams.get('tab')
            if (tab === 'billing') {
                setSettingsTab('billing')
                setActiveTab('general') // Garante que está na aba general
            }
        }
    }, [])

    if (!translationsReady) {
        return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
    }

    return (
        <div className="space-y-6 min-h-screen -m-4 bg-[#F8FAFC] p-8 dark:bg-background">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">{t('header.title')}</h2>
                <p className="text-muted-foreground">{t('header.description')}</p>
            </div>

            <div className="flex gap-6">
                {/* Sidebar Lateral Fina */}
                <div className="w-20 flex-shrink-0">
                    <div className="flex flex-col gap-2 p-2 bg-muted/30 rounded-xl border">
                        <button
                            onClick={() => setActiveTab("general")}
                            className={`flex flex-col items-center gap-2 p-3 rounded-lg transition-all ${
                                activeTab === "general"
                                    ? "bg-zinc-900 text-white shadow-lg dark:bg-zinc-800"
                                    : "bg-transparent text-muted-foreground hover:bg-muted"
                            }`}
                        >
                            <SettingsIcon className="h-5 w-5" />
                            <span className="text-[10px] font-medium">{t('tabs.general')}</span>
                        </button>
                        <button
                            onClick={() => setActiveTab("events")}
                            className={`flex flex-col items-center gap-2 p-3 rounded-lg transition-all ${
                                activeTab === "events"
                                    ? "bg-zinc-900 text-white shadow-lg dark:bg-zinc-800"
                                    : "bg-transparent text-muted-foreground hover:bg-muted"
                            }`}
                        >
                            <Bell className="h-5 w-5" />
                            <span className="text-[10px] font-medium">{t('tabs.events')}</span>
                        </button>
                    </div>
                </div>

                {/* Conteúdo Principal */}
                <div className="flex-1">
                    {activeTab === "general" && <Settings initialTab={settingsTab} />}
                    {activeTab === "events" && (
                        <div className="min-h-screen -m-4 space-y-6 bg-[#F8FAFC] p-8 pb-24 animate-in fade-in duration-500 dark:bg-background">
                            <NotificationPreferences />
                            
                            {/* SYSTEM NOTIFICATIONS CARD */}
                            <Card 
                                className="border-none overflow-hidden"
                                style={{ 
                                    borderRadius: '3rem',
                                    backgroundColor: theme === 'dark' ? '#18181b' : '#ffffff',
                                    border: theme === 'dark' ? '1px solid rgba(63, 63, 70, 0.5)' : '1px solid rgb(228 228 231)',
                                    boxShadow: theme === 'dark'
                                        ? '0 12px 32px -12px rgba(0, 0, 0, 0.45)'
                                        : '0 10px 25px -5px rgba(0, 0, 0, 0.06), 0 4px 6px -2px rgba(0, 0, 0, 0.04)',
                                }}
                            >
                                <CardHeader>
                                    <CardTitle className="text-2xl font-black" style={{ color: theme === 'dark' ? '#fafafa' : '#0f172a' }}>{t('playground.title')}</CardTitle>
                                    <CardDescription style={{ color: theme === 'dark' ? '#a1a1aa' : '#64748b' }}>{t('playground.description')}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex flex-wrap gap-4">
                                        <PlaygroundToastButton
                                            tone="info"
                                            isDark={theme === 'dark'}
                                            icon={Info}
                                            onClick={async () => {
                                                await AgentService.triggerTestNotification('info')
                                                toast.info(t('playground.notification.info.sent'), {
                                                    description: t('playground.notification.info.description')
                                                })
                                            }}
                                        >
                                            {t('playground.test.info')}
                                        </PlaygroundToastButton>
                                        <PlaygroundToastButton
                                            tone="warning"
                                            isDark={theme === 'dark'}
                                            icon={AlertTriangle}
                                            onClick={async () => {
                                                await AgentService.triggerTestNotification('warning')
                                                toast.warning(t('playground.notification.warning.sent'), {
                                                    description: t('playground.notification.warning.description')
                                                })
                                            }}
                                        >
                                            {t('playground.test.warning')}
                                        </PlaygroundToastButton>
                                        <PlaygroundToastButton
                                            tone="error"
                                            isDark={theme === 'dark'}
                                            icon={XCircle}
                                            onClick={async () => {
                                                await AgentService.triggerTestNotification('error')
                                                toast.error(t('playground.notification.error.sent'), {
                                                    description: t('playground.notification.error.description')
                                                })
                                            }}
                                        >
                                            {t('playground.test.error')}
                                        </PlaygroundToastButton>
                                        <PlaygroundToastButton
                                            tone="success"
                                            isDark={theme === 'dark'}
                                            icon={CheckCircle2}
                                            onClick={async () => {
                                                await AgentService.triggerTestNotification('success')
                                                toast.success(t('playground.notification.success.sent'), {
                                                    description: t('playground.notification.success.description')
                                                })
                                            }}
                                        >
                                            {t('playground.test.success')}
                                        </PlaygroundToastButton>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
