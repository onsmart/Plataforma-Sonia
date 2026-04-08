
import { useEffect, useState, useCallback } from "react"
import * as React from "react"
import { useTranslation } from "react-i18next"
import i18n from "../i18n/config"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "../components/ui/card"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Switch } from "../components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs"
import { Separator } from "../components/ui/separator"
import { Badge } from "../components/ui/badge"
import { Slider } from "../components/ui/slider"
import { Download, Shield, Save, Loader2, Key, Users, Mail, Trash2, CreditCard, Check, Ban, Brain, Lock, Send, Plus, Eye, EyeOff, Zap, Sparkles, Bot, MessageSquare, Database, Lightbulb, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { AgentService, GovernanceConfig } from "../services/api"
import { supabase } from "../utils/supabase/client"
import { useTheme } from "next-themes"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { Avatar, AvatarFallback } from "../components/ui/avatar"

export function Settings({ initialTab }: { initialTab?: string } = {}) {
    const { theme } = useTheme()
    const { t } = useTranslation('configuration')
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [govConfig, setGovConfig] = useState<GovernanceConfig | null>(null)
    const [team, setTeam] = useState<any[]>([])
    const [inviteEmail, setInviteEmail] = useState("")
    const [permissions, setPermissions] = useState<any[]>([])
    const [permissionKey, setPermissionKey] = useState("basic.read")
    const [subscription, setSubscription] = useState<any>({ plan: 'free', status: 'inactive' })
    const [activeTab, setActiveTab] = useState(initialTab || "team")
    const [translationsReady, setTranslationsReady] = useState(false)
    
    // Atualiza a aba quando initialTab mudar
    React.useEffect(() => {
        if (initialTab) {
            setActiveTab(initialTab)
        }
    }, [initialTab])
    const [showOpenAIKey, setShowOpenAIKey] = useState(false)
    const [showAnthropicKey, setShowAnthropicKey] = useState(false)
    const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly')
    
    // Garantir que sempre use monthly (yearly está desabilitado por enquanto)
    useEffect(() => {
        if (billingPeriod === 'yearly') {
            setBillingPeriod('monthly')
        }
    }, [billingPeriod])
    const [usageStats, setUsageStats] = useState({ messagesUsed: 0, messagesLimit: 50, agentsUsed: 0, agentsLimit: 1 })
    const [loadingUsage, setLoadingUsage] = useState(false)

    // General Settings State
    const [generalConfig, setGeneralConfig] = useState({
        workspaceName: "Acme Corp AI",
        customDomain: "acme.sonia.ai",
        reducedMotion: false,
        highContrast: true
    })

    // API Keys State
    const [apiKeys, setApiKeys] = useState({
        openai: "",
        anthropic: ""
    })

    useEffect(() => {
        loadAllSettings()
        loadPermissions()
    }, [])

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
    }, [])

    const loadPermissions = async () => {
        try {
            const data = await AgentService.getAvailablePermissions()
            setPermissions(data)
            if (data.length > 0 && !permissionKey) {
                setPermissionKey(data[0].key)
            }
        } catch (e) {
            console.error("Failed to load permissions", e)
        }
    }

    const loadAllSettings = async () => {
        setLoading(true)
        try {
            const [gov, gen, keys, teamData, sub] = await Promise.all([
                AgentService.getGovernanceConfig(),
                AgentService.getGeneralSettings(),
                AgentService.getApiKeys(),
                AgentService.getTeam(),
                AgentService.getSubscription()
            ])

            setGovConfig(gov)
            if (gen && Object.keys(gen).length > 0) setGeneralConfig(gen)
            if (keys) setApiKeys(keys)
            if (teamData) setTeam(teamData)
            if (sub) setSubscription(sub)

        } catch (e) {
            toast.error(t('team.error.load'))
        } finally {
            setLoading(false)
        }
    }

    // --- BILLING HANDLERS ---
    const handleUpgrade = async (priceId: string) => {
        setSaving(true)
        try {
            console.log('[Settings] Iniciando checkout com priceId:', priceId)
            const { url } = await AgentService.createCheckoutSession(priceId)
            console.log('[Settings] URL recebida:', url)
            if (url) {
                window.location.href = url
            } else {
                throw new Error('URL não retornada pelo servidor')
            }
        } catch (e: any) {
            console.error('[Settings] Erro no checkout:', e)
            const errorMessage = e?.message || t('billing.error.checkout')
            toast.error(errorMessage)
        } finally {
            setSaving(false)
        }
    }

    const handlePortal = async () => {
        setSaving(true)
        try {
            const { url, error } = await AgentService.createPortalSession()
            if (error) throw new Error(error)
            if (url) window.location.href = url
        } catch (e: any) {
            toast.error(e.message || t('billing.error.portal'))
        } finally {
            setSaving(false)
        }
    }

    // --- TEAM HANDLERS ---
    const handleInvite = async () => {
        if (!inviteEmail) return
        try {
            const result = await AgentService.inviteMember(inviteEmail, permissionKey)
            if (result?.success) {
                toast.success(result.message || t('team.success.add', { email: inviteEmail }))
                setInviteEmail("")
                const members = await AgentService.getTeam()
                setTeam(members)
            } else {
                throw new Error(result?.message || t('team.error.addFailed'))
            }
        } catch (e: any) {
            toast.error(e.message || t('team.error.add'))
        }
    }

    const handleRemoveMember = async (email: string) => {
        try {
            await AgentService.removeMember(email)
            toast.success(t('team.success.remove'))
            setTeam(team.filter(m => m.email !== email))
        } catch (e) {
            toast.error(t('team.error.remove'))
        }
    }

    // --- GOVERNANCE HANDLERS ---
    const handleSaveGovernance = async () => {
        if (!govConfig) return
        setSaving(true)
        try {
            await AgentService.updateGovernanceConfig(govConfig)
            toast.success(t('governance.success.save'))
        } catch (e) {
            toast.error(t('governance.error.save'))
        } finally {
            setSaving(false)
        }
    }

    const updateGovFilter = (key: keyof GovernanceConfig['filters'], val: boolean) => {
        if (!govConfig) return
        setGovConfig({
            ...govConfig,
            filters: { ...govConfig.filters, [key]: val }
        })
    }

    const updateGovDLP = (key: keyof GovernanceConfig['dlp'], val: boolean) => {
        if (!govConfig) return
        setGovConfig({
            ...govConfig,
            dlp: { ...govConfig.dlp, [key]: val }
        })
    }

    const updateGovThreshold = (key: keyof GovernanceConfig['safetyThresholds'], val: number) => {
        if (!govConfig) return
        setGovConfig({
            ...govConfig,
            safetyThresholds: { ...govConfig.safetyThresholds, [key]: val }
        })
    }

    // --- GENERAL HANDLERS ---
    const handleSaveGeneral = async () => {
        setSaving(true)
        try {
            await AgentService.updateGeneralSettings(generalConfig)
            toast.success(t('team.success.updatePermission')) // Reutilizando tradução similar
        } catch (e) {
            toast.error(t('team.error.updatePermission')) // Reutilizando tradução similar
        } finally {
            setSaving(false)
        }
    }

    // --- API KEY HANDLERS ---
    const handleSaveApiKeys = async () => {
        setSaving(true)

        try {
            const {
                data: { user },
                error: userError
            } = await supabase.auth.getUser()

            if (userError || !user?.email) {
                throw new Error("User not authenticated")
            }

            const calls = []

            if (apiKeys.openai?.trim()) {
                calls.push(
                    supabase.rpc('sp_create_api_key_by_email', {
                        p_email: user.email,
                        p_provider: 'openai',
                        p_api_key: apiKeys.openai.trim()
                    })
                )
            }

            if (apiKeys.anthropic?.trim()) {
                calls.push(
                    supabase.rpc('sp_create_api_key_by_email', {
                        p_email: user.email,
                        p_provider: 'anthropic',
                        p_api_key: apiKeys.anthropic.trim()
                    })
                )
            }

            if (calls.length === 0) {
                toast.info(t('apiKeys.error.save'))
                return
            }

            const results = await Promise.all(calls)

            const rpcError = results.find(r => r.error)?.error
            if (rpcError) {
                throw rpcError
            }

            toast.success(t('apiKeys.success.save'))

            // Reload masked keys
            const keys = await AgentService.getApiKeys()
            if (keys) setApiKeys(keys)

        } catch (err: any) {
            console.error("[handleSaveApiKeys]", err)
            toast.error(err?.message ?? t('apiKeys.error.save'))
        } finally {
            setSaving(false)
        }
    }

    // Carregar dados de uso da subscription
    const loadUsageStats = useCallback(async () => {
        if (activeTab !== 'billing') return; // Só carregar quando estiver na aba de billing
        
        setLoadingUsage(true)
        try {
            const stats = await AgentService.getSubscriptionUsage()
            setUsageStats({
                messagesUsed: stats.messages_used || 0,
                messagesLimit: stats.messages_limit || 50,
                agentsUsed: stats.agents_used || 0,
                agentsLimit: stats.agents_limit || 1
            })
        } catch (error: any) {
            console.error('[loadUsageStats] Erro:', error)
            // Manter valores padrão em caso de erro
        } finally {
            setLoadingUsage(false)
        }
    }, [activeTab])

    useEffect(() => {
        loadUsageStats()
    }, [loadUsageStats])

    return (
        <div className="min-h-screen -m-4 space-y-6 bg-[#F8FAFC] p-8 animate-in fade-in duration-500 dark:bg-background">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                {/* Pílulas Escuras para Sub-abas */}
                <style>{`
                    @keyframes tabSlide {
                        from {
                            opacity: 0;
                            transform: translateY(-4px);
                        }
                        to {
                            opacity: 1;
                            transform: translateY(0);
                        }
                    }
                    .tab-trigger {
                        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                    }
                    .tab-trigger[data-state="active"] {
                        transform: scale(1.05) !important;
                        background: linear-gradient(135deg, #06b6d4 0%, #0891b2 50%, #0e7490 100%) !important;
                        box-shadow: 0 4px 16px rgba(6, 182, 212, 0.5), 0 0 0 2px rgba(6, 182, 212, 0.4), inset 0 0 30px rgba(165, 243, 252, 0.3) !important;
                    }
                    .tab-trigger[data-state="inactive"]:hover {
                        transform: scale(1.02) !important;
                    }
                    .tab-icon {
                        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                    }
                    .tab-trigger[data-state="active"] .tab-icon {
                        transform: scale(1.15) !important;
                    }
                    .tab-content {
                        animation: tabSlide 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                    }
                `}</style>
                <TabsList className="bg-transparent p-0 h-auto gap-2">
                    <TabsTrigger 
                        value="team" 
                        className="tab-trigger rounded-full px-4 py-2 text-sm font-medium data-[state=active]:text-white data-[state=inactive]:bg-slate-100 data-[state=inactive]:text-slate-600 hover:data-[state=inactive]:bg-slate-200 dark:data-[state=inactive]:bg-zinc-800 dark:data-[state=inactive]:text-zinc-200 dark:hover:data-[state=inactive]:bg-zinc-700/80"
                    >
                        <Users className="tab-icon h-3.5 w-3.5 inline mr-2" /> {t('settings.tabs.team')}
                        </TabsTrigger>
                    <TabsTrigger 
                        value="api" 
                        className="tab-trigger rounded-full px-4 py-2 text-sm font-medium data-[state=active]:text-white data-[state=inactive]:bg-slate-100 data-[state=inactive]:text-slate-600 hover:data-[state=inactive]:bg-slate-200 dark:data-[state=inactive]:bg-zinc-800 dark:data-[state=inactive]:text-zinc-200 dark:hover:data-[state=inactive]:bg-zinc-700/80"
                    >
                        <Key className="tab-icon h-3.5 w-3.5 inline mr-2" /> {t('settings.tabs.api')}
                    </TabsTrigger>
                    <TabsTrigger 
                        value="billing" 
                        className="tab-trigger rounded-full px-4 py-2 text-sm font-medium data-[state=active]:text-white data-[state=inactive]:bg-slate-100 data-[state=inactive]:text-slate-600 hover:data-[state=inactive]:bg-slate-200 dark:data-[state=inactive]:bg-zinc-800 dark:data-[state=inactive]:text-zinc-200 dark:hover:data-[state=inactive]:bg-zinc-700/80"
                    >
                        <CreditCard className="tab-icon h-3.5 w-3.5 inline mr-2" /> {t('settings.tabs.billing')}
                    </TabsTrigger>
                    </TabsList>

                <TabsContent value="team" className="tab-content space-y-4">
                    <Card 
                        className="border-0 rounded-[2.5rem] shadow-xl shadow-blue-900/5 hover:shadow-2xl hover:shadow-blue-900/10 transition-all"
                        style={{ 
                            backgroundColor: theme === 'dark' ? '#18181b' : '#F8FAFC',
                            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(6, 182, 212, 0.3), 0 0 20px rgba(6, 182, 212, 0.1)',
                            border: '1px solid rgba(6, 182, 212, 0.2)'
                        }}
                    >
                        <CardHeader>
                            <CardTitle style={{ color: theme === 'dark' ? '#e2e8f0' : '#1e293b' }}>{t('team.title')}</CardTitle>
                            <CardDescription style={{ color: theme === 'dark' ? '#cbd5e1' : '#475569' }}>
                                {t('team.description')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {/* Card de Convite com Fundo Azulado */}
                            <Card 
                                className={`mb-6 border-0 shadow-md transition-all ${theme === 'dark' ? 'bg-zinc-800/80' : 'bg-gradient-to-br from-blue-50 to-cyan-50/50'}`}
                                style={{
                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(6, 182, 212, 0.3), 0 0 15px rgba(6, 182, 212, 0.1)',
                                    border: theme === 'dark' ? '1px solid rgba(63, 63, 70, 0.6)' : '1px solid rgba(6, 182, 212, 0.2)'
                                }}
                            >
                                <CardContent className="p-6">
                                    <div className="flex gap-4 items-end">
                                <div className="space-y-2 flex-1">
                                            <Label className="text-sm font-semibold text-slate-700 dark:text-zinc-200">{t('team.email.label')}</Label>
                                    <Input
                                        placeholder={t('team.email.placeholder')}
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                                className="border-blue-200 bg-white focus:border-blue-500 dark:border-border dark:bg-zinc-900/80 dark:text-foreground"
                                    />
                                </div>
                                <div className="space-y-2 w-[250px]">
                                            <Label className="text-sm font-semibold text-slate-700 dark:text-zinc-200">{t('team.permission.label')}</Label>
                                    <Select value={permissionKey} onValueChange={setPermissionKey}>
                                                <SelectTrigger className="border-blue-200 bg-white dark:border-border dark:bg-zinc-900/80 dark:text-foreground">
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
                                        <Button 
                                            onClick={handleInvite} 
                                            disabled={!inviteEmail}
                                            className="px-6 text-white shadow-lg transition-all hover:shadow-xl"
                                            style={{
                                                background: !inviteEmail ? '#94a3b8' : 'linear-gradient(135deg, #0891b2 0%, #22d3ee 100%)',
                                                boxShadow: !inviteEmail 
                                                    ? '0 4px 12px rgba(0, 0, 0, 0.1)' 
                                                    : (theme === 'dark' 
                                                        ? '0 0 20px rgba(34, 211, 238, 0.4), 0 8px 20px rgba(8, 145, 178, 0.3)' 
                                                        : '0 8px 20px rgba(8, 145, 178, 0.4)')
                                            }}
                                            onMouseEnter={(e) => {
                                                if (!inviteEmail) return
                                                e.currentTarget.style.boxShadow = theme === 'dark'
                                                    ? '0 0 30px rgba(34, 211, 238, 0.6), 0 12px 30px rgba(8, 145, 178, 0.4)'
                                                    : '0 12px 30px rgba(8, 145, 178, 0.5)'
                                            }}
                                            onMouseLeave={(e) => {
                                                if (!inviteEmail) return
                                                e.currentTarget.style.boxShadow = theme === 'dark'
                                                    ? '0 0 20px rgba(34, 211, 238, 0.4), 0 8px 20px rgba(8, 145, 178, 0.3)'
                                                    : '0 8px 20px rgba(8, 145, 178, 0.4)'
                                            }}
                                        >
                                            <Send className="mr-2 h-4 w-4" /> {t('team.invite')}
                                </Button>
                            </div>
                                </CardContent>
                            </Card>

                            {/* Linhas-Card (sem tabela) */}
                            <div className="space-y-3">
                                        {team.length === 0 ? (
                                    <div className="flex h-24 items-center justify-center rounded-xl bg-slate-50 text-center text-muted-foreground dark:bg-muted">
                                                    {t('team.empty')}
                                    </div>
                                ) : team.map((member) => {
                                    const initials = (member.name || member.email || 'U').substring(0, 2).toUpperCase()
                                    const isAdmin = member.permissions?.some((p: any) => p.name?.toLowerCase().includes('admin') || p.key?.includes('admin'))
                                    
                                    const rowBg = theme === 'dark' ? 'rgba(39, 39, 42, 0.55)' : '#ecfeff'
                                    const rowBgHover = theme === 'dark' ? 'rgba(63, 63, 70, 0.65)' : '#cffafe'
                                    const rowBorder = theme === 'dark' ? 'rgba(63, 63, 70, 0.65)' : 'rgba(6, 182, 212, 0.2)'
                                    const rowShadow = theme === 'dark'
                                        ? '0 1px 3px 0 rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(63, 63, 70, 0.45)'
                                        : '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(6, 182, 212, 0.2), 0 0 10px rgba(6, 182, 212, 0.08)'
                                    const rowShadowHover = theme === 'dark'
                                        ? '0 4px 12px -2px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(82, 82, 91, 0.5)'
                                        : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(6, 182, 212, 0.3), 0 0 15px rgba(6, 182, 212, 0.12)'

                                    return (
                                        <div
                                            key={member.email || member.user_id}
                                            className="group flex items-center gap-4 p-5 border-0 shadow-sm hover:shadow-md transition-all duration-200"
                                            style={{
                                                borderRadius: '2.5rem',
                                                backgroundColor: rowBg,
                                                borderColor: rowBorder,
                                                borderWidth: '1px',
                                                borderStyle: 'solid',
                                                boxShadow: rowShadow
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.backgroundColor = rowBgHover
                                                e.currentTarget.style.boxShadow = rowShadowHover
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = rowBg
                                                e.currentTarget.style.boxShadow = rowShadow
                                            }}
                                        >
                                            {/* Avatar com Iniciais - Gradiente Azul Suave */}
                                            <Avatar className="h-12 w-12 shrink-0 ring-2 ring-blue-100 dark:ring-zinc-600">
                                                <AvatarFallback 
                                                    className="text-white font-bold text-sm shadow-sm"
                                                    style={{
                                                        background: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #06b6d4 100%)',
                                                        color: 'white'
                                                    }}
                                                >
                                                    {initials}
                                                </AvatarFallback>
                                            </Avatar>

                                            {/* Nome e Email */}
                                            <div className="flex-1 min-w-0">
                                                <div className="mb-1">
                                                    <span className="font-semibold text-slate-900 dark:text-zinc-100">{member.name || member.email}</span>
                                                </div>
                                                        {member.name && (
                                                    <span className="text-xs text-slate-500 dark:text-zinc-400">{member.email}</span>
                                                        )}
                                                    </div>

                                            {/* Role Badges */}
                                            <div className="flex flex-wrap gap-1.5 shrink-0">
                                                        {member.permissions && member.permissions.length > 0 ? (
                                                            member.permissions.map((perm: any, idx: number) => (
                                                        <Badge 
                                                            key={idx} 
                                                            className={`text-xs px-2.5 py-1 rounded-full ${
                                                                isAdmin 
                                                                    ? 'bg-zinc-900 text-white font-black dark:bg-zinc-800' 
                                                                    : 'border border-slate-200 bg-slate-100 text-slate-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200'
                                                            }`}
                                                        >
                                                                    {perm.name}
                                                                </Badge>
                                                            ))
                                                        ) : (
                                                    <Badge className="rounded-full border border-slate-200 bg-slate-50 text-xs text-slate-400 dark:border-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-400">
                                                                {t('team.noPermissions')}
                                                            </Badge>
                                                        )}
                                                    </div>

                                            {/* Status Badge - Pílula Verde Pastel */}
                                            <Badge className="shrink-0 rounded-full border border-emerald-200/50 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-400">
                                                        {t('billing.plans.starter.active')}
                                                    </Badge>

                                            {/* Data de Entrada */}
                                            <div className="w-24 shrink-0 text-right text-xs text-slate-400 dark:text-zinc-500">
                                                    {member.created_at ? new Date(member.created_at).toLocaleDateString(i18n.language || 'pt-BR') : 'N/A'}
                                            </div>

                                            {/* Botão de Remover */}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                className="h-9 w-9 shrink-0 text-slate-400 hover:bg-red-50 hover:text-destructive dark:hover:bg-red-950/35"
                                                        onClick={() => handleRemoveMember(member.email)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                        </div>
                                    )
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="api" className="tab-content space-y-4">
                    <div className="space-y-4">
                        {/* Card OpenAI */}
                        <Card 
                            className="border-0 rounded-[2.5rem] shadow-xl shadow-blue-900/5 hover:shadow-2xl hover:shadow-blue-900/10 transition-all"
                            style={{ 
                                backgroundColor: theme === 'dark' ? '#18181b' : '#F8FAFC',
                                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(6, 182, 212, 0.3), 0 0 20px rgba(6, 182, 212, 0.1)',
                                border: '1px solid rgba(6, 182, 212, 0.2)'
                            }}
                        >
                            <CardContent className="p-6">
                                <div className="flex items-start gap-6">
                                    {/* Ícone Grande do Provedor */}
                                    <div 
                                        className="h-16 w-16 rounded-2xl flex items-center justify-center shrink-0 shadow-lg"
                                        style={{
                                            background: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)'
                                        }}
                                    >
                                        <Zap className="h-8 w-8" strokeWidth={2.5} style={{ color: 'white' }} />
                            </div>
                                    
                                    {/* Conteúdo */}
                                    <div className="flex-1 space-y-4">
                                        <div className="flex items-center gap-3">
                                            <Label htmlFor="openai" className="text-lg font-bold" style={{ color: theme === 'dark' ? '#e2e8f0' : '#1e293b' }}>{t('apiKeys.openai.label')}</Label>
                                            <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs font-semibold px-2.5 py-1">
                                                {t('apiKeys.openai.badge')}
                                            </Badge>
                                </div>
                                        
                                        <div className="relative">
                                        <Input
                                            id="openai"
                                                type={showOpenAIKey ? "text" : "password"}
                                            value={apiKeys.openai}
                                                className="rounded-xl border-slate-200 bg-slate-50 pl-4 pr-20 focus:border-blue-500 focus:ring-blue-500 dark:border-border dark:bg-zinc-900/80 dark:text-foreground"
                                            placeholder={t('apiKeys.openai.placeholder')}
                                            onChange={(e) => setApiKeys(prev => ({ ...prev, openai: e.target.value }))}
                                        />
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                <Key className="h-4 w-4 text-slate-400" />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowOpenAIKey(!showOpenAIKey)}
                                                    className="h-4 w-4 text-slate-400 hover:text-slate-600 transition-colors"
                                                >
                                                    {showOpenAIKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </button>
                                    </div>
                                </div>
                                        
                                        <p className="text-xs" style={{ color: theme === 'dark' ? '#cbd5e1' : '#475569' }}>{t('apiKeys.openai.description')}</p>
                            </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Card Anthropic */}
                        <Card 
                            className="border-0 rounded-[2.5rem] shadow-xl shadow-blue-900/5 hover:shadow-2xl hover:shadow-blue-900/10 transition-all"
                            style={{ 
                                backgroundColor: theme === 'dark' ? '#18181b' : '#F8FAFC',
                                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(6, 182, 212, 0.3), 0 0 20px rgba(6, 182, 212, 0.1)',
                                border: '1px solid rgba(6, 182, 212, 0.2)'
                            }}
                        >
                            <CardContent className="p-6">
                                <div className="flex items-start gap-6">
                                    {/* Ícone Grande do Provedor */}
                                    <div 
                                        className="h-16 w-16 rounded-2xl flex items-center justify-center shrink-0 shadow-lg"
                                        style={{
                                            background: 'linear-gradient(135deg, #a78bfa 0%, #6366f1 100%)'
                                        }}
                                    >
                                        <Sparkles className="h-8 w-8" strokeWidth={2.5} style={{ color: 'white' }} />
                                    </div>
                                    
                                    {/* Conteúdo */}
                                    <div className="flex-1 space-y-4">
                                        <div className="flex items-center gap-3">
                                            <Label htmlFor="anthropic" className="text-lg font-bold" style={{ color: theme === 'dark' ? '#e2e8f0' : '#1e293b' }}>{t('apiKeys.anthropic.label')}</Label>
                                            <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-xs font-semibold px-2.5 py-1">
                                                {t('apiKeys.anthropic.badge')}
                                            </Badge>
                                        </div>
                                        
                                        <div className="relative">
                                        <Input
                                            id="anthropic"
                                                type={showAnthropicKey ? "text" : "password"}
                                            value={apiKeys.anthropic}
                                                className="rounded-xl border-slate-200 bg-slate-50 pl-4 pr-20 focus:border-purple-500 focus:ring-purple-500 dark:border-border dark:bg-zinc-900/80 dark:text-foreground"
                                            placeholder={t('apiKeys.anthropic.placeholder')}
                                            onChange={(e) => setApiKeys(prev => ({ ...prev, anthropic: e.target.value }))}
                                        />
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                <Key className="h-4 w-4 text-slate-400" />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                                                    className="h-4 w-4 text-slate-400 hover:text-slate-600 transition-colors"
                                                >
                                                    {showAnthropicKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </button>
                                    </div>
                                </div>
                                        
                                        <p className="text-xs" style={{ color: theme === 'dark' ? '#cbd5e1' : '#475569' }}>{t('apiKeys.anthropic.description')}</p>
                                    </div>
                            </div>
                        </CardContent>
                        </Card>

                        {/* Botão de Salvar - Flutuante à Direita */}
                        <div className="flex justify-end">
                            <Button 
                                onClick={handleSaveApiKeys} 
                                disabled={saving}
                                className="rounded-2xl px-8 py-6 text-base font-semibold text-white shadow-lg transition-all hover:shadow-xl"
                                style={{
                                    background: saving ? '#94a3b8' : 'linear-gradient(135deg, #0891b2 0%, #22d3ee 100%)',
                                    boxShadow: saving 
                                        ? '0 4px 12px rgba(0, 0, 0, 0.1)' 
                                        : (theme === 'dark' 
                                            ? '0 0 20px rgba(34, 211, 238, 0.4), 0 8px 20px rgba(8, 145, 178, 0.3)' 
                                            : '0 8px 20px rgba(8, 145, 178, 0.4)')
                                }}
                                onMouseEnter={(e) => {
                                    if (!saving) {
                                        e.currentTarget.style.boxShadow = theme === 'dark'
                                            ? '0 0 30px rgba(34, 211, 238, 0.6), 0 12px 30px rgba(8, 145, 178, 0.4)'
                                            : '0 12px 30px rgba(8, 145, 178, 0.5)'
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!saving) {
                                        e.currentTarget.style.boxShadow = theme === 'dark'
                                            ? '0 0 20px rgba(34, 211, 238, 0.4), 0 8px 20px rgba(8, 145, 178, 0.3)'
                                            : '0 8px 20px rgba(8, 145, 178, 0.4)'
                                    }
                                }}
                            >
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {t('apiKeys.update')}
                            </Button>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="billing" className="tab-content space-y-4">
                    {/* Botão de Export CSV - Sempre visível */}
                    <Card 
                        className="border-0 rounded-[2.5rem] shadow-xl shadow-blue-900/5 hover:shadow-2xl hover:shadow-blue-900/10 transition-all"
                        style={{ backgroundColor: theme === 'dark' ? '#18181b' : '#F8FAFC' }}
                    >
                        <CardHeader>
                            <CardTitle style={{ color: theme === 'dark' ? '#e2e8f0' : '#1e293b' }}>Exportar Dados de Uso</CardTitle>
                            <CardDescription style={{ color: theme === 'dark' ? '#cbd5e1' : '#475569' }}>
                                Baixe um relatório CSV com suas métricas de uso e informações de assinatura
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button 
                                variant="outline" 
                                onClick={async () => {
                                    try {
                                        setSaving(true)
                                        await AgentService.exportBillingCSV()
                                        toast.success('CSV exportado com sucesso!')
                                    } catch (error: any) {
                                        toast.error(error.message || 'Erro ao exportar CSV')
                                    } finally {
                                        setSaving(false)
                                    }
                                }}
                                disabled={saving}
                                className="w-full sm:w-auto"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        Exportando...
                                    </>
                                ) : (
                                    <>
                                        <Download className="h-4 w-4 mr-2" />
                                        Exportar CSV
                                    </>
                                )}
                            </Button>
                        </CardContent>
                    </Card>

                    {subscription.status === 'active' && subscription.plan !== 'free' && subscription.stripeId ? (
                        <Card 
                            className="border-0 rounded-[2.5rem] shadow-xl shadow-blue-900/5 hover:shadow-2xl hover:shadow-blue-900/10 transition-all"
                            style={{ backgroundColor: theme === 'dark' ? '#18181b' : '#F8FAFC' }}
                        >
                            <CardHeader>
                                <CardTitle style={{ color: theme === 'dark' ? '#e2e8f0' : '#1e293b' }}>{t('billing.current.title')}</CardTitle>
                                <CardDescription style={{ color: theme === 'dark' ? '#cbd5e1' : '#475569' }}>{t('billing.current.description')}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between bg-muted/50 p-4 rounded-lg border">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                                            <Check className="h-5 w-5 text-emerald-600" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-medium capitalize">{t('billing.current.plan', { plan: subscription.plan || 'Pro' })}</p>
                                            <p className="text-sm text-muted-foreground">{t('billing.current.status')}</p>
                                        </div>
                                    </div>
                                    <Button variant="outline" onClick={handlePortal} disabled={saving}>
                                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('billing.current.manage')}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-6">
                            {/* Seletor Mensal/Anual - Pílula Sólida */}
                            <div 
                                className="shadow-xl shadow-blue-900/5 rounded-[2.5rem] flex flex-col gap-6"
                                style={{ 
                                    backgroundColor: theme === 'dark' ? '#18181b' : '#F8FAFC',
                                    border: '2px solid #06b6d4',
                                    borderRadius: '2.5rem'
                                }}
                            >
                                <div className="p-6">
                                    <div className="flex items-center justify-center gap-3">
                                        <button
                                            onClick={() => setBillingPeriod('monthly')}
                                            className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 ${
                                                billingPeriod === 'monthly'
                                                    ? 'bg-zinc-900 text-white shadow-lg dark:bg-zinc-800'
                                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
                                            }`}
                                            style={{
                                                border: billingPeriod === 'monthly' ? '2px solid #06b6d4' : '2px solid transparent'
                                            }}
                                        >
                                            {t('billing.period.monthly')}
                                        </button>
                                        <button
                                            onClick={() => setBillingPeriod('yearly')}
                                            disabled={true}
                                            className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 relative ${
                                                billingPeriod === 'yearly'
                                                    ? 'bg-zinc-900 text-white shadow-lg dark:bg-zinc-800'
                                                    : 'cursor-not-allowed bg-slate-100 text-slate-400 opacity-60 dark:bg-zinc-800/80 dark:text-zinc-500'
                                            }`}
                                            style={{
                                                border: billingPeriod === 'yearly' ? '2px solid #06b6d4' : '2px solid transparent'
                                            }}
                                            title="Em breve"
                                        >
                                            {t('billing.period.yearly')}
                                            <Badge 
                                                className="absolute -top-1 -right-1 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg"
                                                style={{
                                                    backgroundColor: '#94a3b8', // Cinza quando desabilitado
                                                    color: 'white',
                                                    boxShadow: '0 2px 6px rgba(148, 163, 184, 0.3)'
                                                }}
                                            >
                                                {t('billing.period.discount')}
                                            </Badge>
                                        </button>
                                    </div>
                                </div>
                            </div>

                        <div className="grid gap-6 md:grid-cols-3">
                                {/* Card Starter - Visual "Ardósia" (Slate) */}
                                <Card 
                                    className="flex flex-col border rounded-[2.5rem] shadow-sm transition-all relative cursor-pointer"
                                    style={{
                                        backgroundColor: '#18181b',
                                        borderColor: 'rgba(63, 63, 70, 0.55)',
                                        borderWidth: '1px',
                                        borderStyle: 'solid',
                                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'scale(1.02) translateY(-4px)'
                                        e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.6)'
                                        e.currentTarget.style.boxShadow = '0 0 40px rgba(6, 182, 212, 0.4), 0 0 80px rgba(34, 211, 238, 0.2), 0 10px 30px rgba(0, 0, 0, 0.3), inset 0 0 20px rgba(6, 182, 212, 0.1)'
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'scale(1) translateY(0)'
                                        e.currentTarget.style.borderColor = 'rgba(63, 63, 70, 0.55)'
                                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.2)'
                                    }}
                                >
                                    {/* Badge "ATIVO" no topo direito - Ciano */}
                                    <div className="absolute top-4 right-4 z-10">
                                        <Badge 
                                            className="text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full"
                                            style={{
                                                backgroundColor: 'rgba(6, 182, 212, 0.2)',
                                                color: '#22d3ee',
                                                border: '1px solid rgba(6, 182, 212, 0.4)',
                                                boxShadow: '0 0 10px rgba(6, 182, 212, 0.3)'
                                            }}
                                        >
                                            {t('billing.plans.starter.active')}
                                        </Badge>
                                    </div>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Lightbulb className="h-5 w-5" style={{ color: '#22d3ee' }} />
                                            <CardTitle style={{ color: '#e2e8f0' }}>{t('billing.plans.starter.title')}</CardTitle>
                                        </div>
                                    </div>
                                    <CardDescription style={{ color: '#cbd5e1' }}>{t('billing.plans.starter.description')}</CardDescription>
                                </CardHeader>
                                <CardContent className="flex-1">
                                    <div className="text-3xl font-bold mb-4 tracking-tight" style={{ color: '#e2e8f0' }}>
                                        {t('billing.plans.starter.price')} <span className="text-sm font-normal" style={{ color: '#94a3b8' }}>{t('billing.plans.starter.period')}</span>
                                    </div>
                                        
                                        {/* Barra de Progresso de Consumo - Integrada com Alerta Vermelho Escuro */}
                                        <div 
                                            className="mb-4 p-3 rounded-xl border"
                                            style={{
                                                backgroundColor: usageStats.messagesUsed > usageStats.messagesLimit 
                                                    ? 'rgba(127, 29, 29, 0.3)' // bg-red-900/20
                                                    : 'rgba(30, 41, 59, 0.5)',
                                                borderColor: usageStats.messagesUsed > usageStats.messagesLimit 
                                                    ? 'rgba(220, 38, 38, 0.4)' 
                                                    : 'rgba(148, 163, 184, 0.2)'
                                            }}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-semibold" style={{ color: usageStats.messagesUsed > usageStats.messagesLimit ? '#fca5a5' : '#cbd5e1' }}>
                                                    {t('billing.plans.starter.messages')}
                                                </span>
                                                <span 
                                                    className="text-xs font-bold"
                                                    style={{ color: usageStats.messagesUsed > usageStats.messagesLimit ? '#fca5a5' : '#e2e8f0' }}
                                                >
                                                    {usageStats.messagesUsed}/{usageStats.messagesLimit}
                                                </span>
                                            </div>
                                            <div className="w-full h-2 rounded-full overflow-hidden relative" style={{ backgroundColor: 'rgba(51, 65, 85, 0.5)' }}>
                                                <div 
                                                    className={`h-full rounded-full transition-all duration-300 ${
                                                        usageStats.messagesUsed > usageStats.messagesLimit ? 'animate-pulse' : ''
                                                    }`}
                                                    style={{ 
                                                        width: `${Math.min((usageStats.messagesUsed / usageStats.messagesLimit) * 100, 100)}%`,
                                                        background: usageStats.messagesUsed > usageStats.messagesLimit 
                                                            ? 'linear-gradient(to right, #dc2626, #ef4444, #f87171)' 
                                                            : 'linear-gradient(to right, #3b82f6, #06b6d4)',
                                                        boxShadow: usageStats.messagesUsed > usageStats.messagesLimit 
                                                            ? '0 0 10px rgba(220, 38, 38, 0.6), 0 0 20px rgba(220, 38, 38, 0.4)' 
                                                            : 'none'
                                                    }}
                                                />
                                            </div>
                                            {/* Alerta quando ultrapassa o limite */}
                                            {usageStats.messagesUsed > usageStats.messagesLimit && (
                                                <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold" style={{ color: '#fca5a5' }}>
                                                    <AlertTriangle className="h-3.5 w-3.5" />
                                                    <span>Limite atingido! Algumas funções podem estar desativadas.</span>
                                                </div>
                                            )}
                                        </div>

                                        <ul className="space-y-4 text-sm">
                                            {/* Funcionalidades disponíveis - Grayscale claro */}
                                            <li className="flex items-center gap-3">
                                                <div className="h-5 w-5 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(148, 163, 184, 0.2)' }}>
                                                    <Bot className="h-3.5 w-3.5" strokeWidth={2.5} style={{ color: '#cbd5e1' }} />
                                                </div>
                                                <span style={{ color: '#e2e8f0' }}>
                                                    <span className="font-black" style={{ color: '#f1f5f9' }}>1</span> {t('billing.plans.starter.agent')}
                                                </span>
                                            </li>
                                            <li className="flex items-center gap-3">
                                                <div className="h-5 w-5 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(148, 163, 184, 0.2)' }}>
                                                    <MessageSquare className="h-3.5 w-3.5" strokeWidth={2.5} style={{ color: '#cbd5e1' }} />
                                                </div>
                                                <span style={{ color: '#e2e8f0' }}>
                                                    <span className="font-black" style={{ color: '#f1f5f9' }}>50</span> {t('billing.plans.starter.messagesLimit')}
                                                </span>
                                            </li>
                                            <li className="flex items-center gap-3">
                                                <div className="h-5 w-5 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(148, 163, 184, 0.2)' }}>
                                                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} style={{ color: '#cbd5e1' }} />
                                                </div>
                                                <span style={{ color: '#cbd5e1' }}>{t('billing.plans.starter.support')}</span>
                                            </li>
                                            {/* Funcionalidades bloqueadas - Grayscale escuro com cadeado */}
                                            <li className="flex items-center gap-3">
                                                <div className="h-5 w-5 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(51, 65, 85, 0.5)' }}>
                                                    <Lock className="h-3.5 w-3.5" strokeWidth={2.5} style={{ color: '#475569' }} />
                                                </div>
                                                <span className="flex items-center gap-1.5" style={{ color: '#475569' }}>
                                                    <Brain className="h-3.5 w-3.5" />
                                                    RAG Knowledge Base
                                                </span>
                                            </li>
                                            <li className="flex items-center gap-3">
                                                <div className="h-5 w-5 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(51, 65, 85, 0.5)' }}>
                                                    <Lock className="h-3.5 w-3.5" strokeWidth={2.5} style={{ color: '#475569' }} />
                                                </div>
                                                <span style={{ color: '#475569' }}>
                                                    Suporte Prioritário
                                                </span>
                                            </li>
                                    </ul>
                                </CardContent>
                            </Card>

                                {/* Card Pro - Efeito Holofote */}
                                <Card 
                                    className="flex flex-col border-2 rounded-[2.5rem] relative overflow-hidden transition-all cursor-pointer"
                                    style={{
                                        transform: 'scale(1.05)',
                                        minHeight: 'calc(100% + 20px)',
                                        borderColor: 'rgba(245, 158, 11, 0.6)',
                                        boxShadow: '0 25px 70px -15px rgba(37, 99, 235, 0.4), 0 0 0 1px rgba(59, 130, 246, 0.15), 0 0 30px rgba(245, 158, 11, 0.4), inset 0 0 20px rgba(245, 158, 11, 0.1)',
                                        background: theme === 'dark' 
                                            ? 'linear-gradient(to bottom, rgba(245, 158, 11, 0.1) 0%, rgba(24, 24, 27, 0.98) 32%, rgba(9, 9, 11, 1) 100%)'
                                            : 'linear-gradient(to bottom, rgba(251, 191, 36, 0.2), rgba(255, 255, 255, 1))',
                                        position: 'relative',
                                        transition: 'all 0.3s ease-in-out'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'scale(1.08) translateY(-8px)'
                                        e.currentTarget.style.boxShadow = '0 40px 100px -20px rgba(245, 158, 11, 0.8), 0 0 0 1px rgba(59, 130, 246, 0.15), 0 0 80px rgba(245, 158, 11, 0.7), 0 0 120px rgba(245, 158, 11, 0.5), inset 0 0 30px rgba(245, 158, 11, 0.2)'
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'scale(1.05) translateY(0)'
                                        e.currentTarget.style.boxShadow = '0 25px 70px -15px rgba(37, 99, 235, 0.4), 0 0 0 1px rgba(59, 130, 246, 0.15), 0 0 30px rgba(245, 158, 11, 0.4), inset 0 0 20px rgba(245, 158, 11, 0.1)'
                                    }}
                                >
                                    {/* Luz amarela vindo de cima */}
                                    <div 
                                        className="absolute top-0 left-0 right-0 h-32 rounded-t-[2.5rem] pointer-events-none"
                                        style={{
                                            background: theme === 'dark'
                                                ? 'linear-gradient(to bottom, rgba(251, 191, 36, 0.12), transparent)'
                                                : 'linear-gradient(to bottom, rgba(251, 191, 36, 0.3), transparent)',
                                            filter: 'blur(20px)',
                                            opacity: theme === 'dark' ? 0.65 : 1
                                        }}
                                    />
                                    {/* Efeito de energia passando - Dourado */}
                                    <div 
                                        className="absolute inset-0 pointer-events-none"
                                        style={{
                                            opacity: theme === 'dark' ? 0.22 : 0.7,
                                            background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.6) 0%, transparent 30%, rgba(245, 158, 11, 0.4) 50%, transparent 70%, rgba(251, 191, 36, 0.3) 100%)',
                                            animation: 'shimmer-gold 3s ease-in-out infinite',
                                            zIndex: 1
                                        }}
                                    />
                                    <style>{`
                                        @keyframes shimmer-gold {
                                            0% {
                                                transform: translateX(-100%) translateY(-100%) rotate(45deg);
                                            }
                                            100% {
                                                transform: translateX(200%) translateY(200%) rotate(45deg);
                                            }
                                        }
                                    `}</style>
                                    <CardHeader className="relative" style={{ zIndex: 2, paddingTop: '1.5rem' }}>
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1">
                                                <CardTitle style={{ color: theme === 'dark' ? '#fafafa' : '#1e293b' }}>{t('billing.plans.pro.title')}</CardTitle>
                                                <CardDescription style={{ color: theme === 'dark' ? '#d4d4d8' : '#475569' }}>{t('billing.plans.pro.description')}</CardDescription>
                                            </div>
                                            {/* Badge Popular - Quadrado Arredondado */}
                                            <div 
                                                className="pointer-events-none shrink-0"
                                                style={{ 
                                                    marginTop: '12px',
                                                    marginRight: '-10px',
                                                    zIndex: 50
                                                }}
                                            >
                                                <style>{`
                                                    @keyframes comic-pulse {
                                                        0%, 100% {
                                                            transform: rotate(15deg) scale(1);
                                                            filter: drop-shadow(0 0 10px rgba(6, 182, 212, 0.6)) drop-shadow(0 0 20px rgba(6, 182, 212, 0.4));
                                                        }
                                                        50% {
                                                            transform: rotate(15deg) scale(1.05);
                                                            filter: drop-shadow(0 0 15px rgba(6, 182, 212, 0.8)) drop-shadow(0 0 30px rgba(6, 182, 212, 0.6));
                                                        }
                                                    }
                                                `}</style>
                                                <div
                                                    className="relative"
                                                    style={{
                                                        animation: 'comic-pulse 2s ease-in-out infinite',
                                                        filter: 'drop-shadow(0 0 10px rgba(6, 182, 212, 0.6)) drop-shadow(0 0 20px rgba(6, 182, 212, 0.4))',
                                                        transform: 'rotate(15deg)'
                                                    }}
                                                >
                                                    {/* Quadrado com bordas arredondadas */}
                                                    <div
                                                        style={{
                                                            padding: '8px 16px',
                                                            backgroundColor: '#06b6d4',
                                                            color: '#000000',
                                                            fontWeight: 900,
                                                            fontSize: '10px',
                                                            letterSpacing: '0.15em',
                                                            textTransform: 'uppercase',
                                                            borderRadius: '12px',
                                                            border: '2px solid #000000',
                                                            outline: '2px solid #06b6d4',
                                                            outlineOffset: '2px',
                                                            boxShadow: 'inset 0 0 20px rgba(255, 255, 255, 0.3), 0 0 30px rgba(6, 182, 212, 0.5), 0 4px 15px rgba(0, 0, 0, 0.3)',
                                                            background: 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 50%, #0891b2 100%)'
                                                        }}
                                                    >
                                                        {t('billing.plans.pro.badge')}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                </CardHeader>
                                    <CardContent className="flex-1 relative" style={{ zIndex: 2 }}>
                                        <div className="text-4xl font-black mb-4 tracking-tight" style={{ color: theme === 'dark' ? '#e2e8f0' : '#1e293b' }}>
                                            <span 
                                                key={billingPeriod}
                                                className="inline-block animate-in fade-in duration-300"
                                            >
                                                {billingPeriod === 'yearly' ? t('billing.plans.pro.price.yearly') : t('billing.plans.pro.price.monthly')} 
                                            </span>
                                            <span className="text-sm font-normal" style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b' }}>/{billingPeriod === 'yearly' ? t('billing.plans.pro.period.yearly') : t('billing.plans.pro.period.monthly')}</span>
                                        </div>
                                        {billingPeriod === 'yearly' && (
                                            <p 
                                                key="economy-pro"
                                                className="text-xs font-semibold mb-4 animate-in fade-in duration-300"
                                                style={{ color: '#10b981' }}
                                            >
                                                {t('billing.plans.pro.economy')}
                                            </p>
                                        )}
                                        <ul className="space-y-4 text-sm" style={{ color: theme === 'dark' ? '#cbd5e1' : '#64748b' }}>
                                            <li className="flex items-center gap-3 font-medium" style={{ color: theme === 'dark' ? '#e2e8f0' : '#1e293b' }}>
                                                <div className="h-5 w-5 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.2)' : '#dbeafe' }}>
                                                    <Bot className="h-3.5 w-3.5" strokeWidth={2.5} style={{ color: theme === 'dark' ? '#60a5fa' : '#2563eb' }} />
                                                </div>
                                                <span><span className="font-black" style={{ color: theme === 'dark' ? '#e2e8f0' : '#1e293b' }}>5</span> {t('billing.plans.pro.agents')}</span>
                                            </li>
                                            <li className="flex items-center gap-3 font-medium" style={{ color: theme === 'dark' ? '#e2e8f0' : '#1e293b' }}>
                                                <div className="h-5 w-5 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: theme === 'dark' ? 'rgba(16, 185, 129, 0.2)' : '#d1fae5' }}>
                                                    <MessageSquare className="h-3.5 w-3.5" strokeWidth={2.5} style={{ color: theme === 'dark' ? '#34d399' : '#10b981' }} />
                                                </div>
                                                <span>{t('billing.plans.pro.messages')}</span>
                                            </li>
                                            <li className="flex items-center gap-3 font-medium" style={{ color: theme === 'dark' ? '#e2e8f0' : '#1e293b' }}>
                                                <div className="h-5 w-5 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: theme === 'dark' ? 'rgba(168, 85, 247, 0.2)' : '#f3e8ff' }}>
                                                    <Brain className="h-3.5 w-3.5" strokeWidth={2.5} style={{ color: theme === 'dark' ? '#a78bfa' : '#9333ea' }} />
                                                </div>
                                                <span>{t('billing.plans.pro.rag')}</span>
                                            </li>
                                            <li className="flex items-center gap-3 font-medium" style={{ color: theme === 'dark' ? '#e2e8f0' : '#1e293b' }}>
                                                <div className="h-5 w-5 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: theme === 'dark' ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7' }}>
                                                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} style={{ color: theme === 'dark' ? '#fbbf24' : '#d97706' }} />
                                                </div>
                                                <span>{t('billing.plans.pro.support')}</span>
                                            </li>
                                    </ul>
                                </CardContent>
                                    <CardFooter style={{ zIndex: 2 }}>
                                        <style>{`
                                            @keyframes gold-pulse {
                                                0%, 100% {
                                                    box-shadow: 0 15px 40px rgba(245, 158, 11, 0.8), 0 0 60px rgba(245, 158, 11, 0.6), 0 0 100px rgba(245, 158, 11, 0.4), 0 0 120px rgba(245, 158, 11, 0.2);
                                                    transform: scale(1);
                                                }
                                                50% {
                                                    box-shadow: 0 20px 60px rgba(245, 158, 11, 1), 0 0 100px rgba(245, 158, 11, 0.8), 0 0 150px rgba(245, 158, 11, 0.6), 0 0 200px rgba(245, 158, 11, 0.3);
                                                    transform: scale(1.02);
                                                }
                                            }
                                        `}</style>
                                        <Button 
                                            className="w-full h-11 font-black uppercase tracking-tight text-[11px] transition-all rounded-2xl text-white relative z-10" 
                                            onClick={() => handleUpgrade(billingPeriod === 'yearly' ? 'price_pro_yearly' : 'price_pro_monthly')} 
                                            disabled={saving}
                                            style={{
                                                background: saving 
                                                    ? '#94a3b8' 
                                                    : 'linear-gradient(135deg, #f59e0b 0%, #eab308 30%, #fbbf24 60%, #fcd34d 100%)',
                                                color: 'white',
                                                textShadow: saving ? 'none' : '0 0 20px rgba(255, 255, 255, 0.8), 0 0 40px rgba(245, 158, 11, 0.6)',
                                                animation: saving ? 'none' : 'gold-pulse 1.5s ease-in-out infinite',
                                                boxShadow: saving 
                                                    ? '0 4px 12px rgba(0, 0, 0, 0.1)' 
                                                    : '0 15px 40px rgba(245, 158, 11, 0.8), 0 0 60px rgba(245, 158, 11, 0.6), 0 0 100px rgba(245, 158, 11, 0.4)'
                                            }}
                                            onMouseEnter={(e) => {
                                                if (!saving) {
                                                    e.currentTarget.style.boxShadow = '0 25px 70px rgba(245, 158, 11, 1), 0 0 120px rgba(245, 158, 11, 0.9), 0 0 180px rgba(245, 158, 11, 0.7)'
                                                    e.currentTarget.style.transform = 'scale(1.05)'
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (!saving) {
                                                    e.currentTarget.style.boxShadow = '0 15px 40px rgba(245, 158, 11, 0.8), 0 0 60px rgba(245, 158, 11, 0.6), 0 0 100px rgba(245, 158, 11, 0.4)'
                                                    e.currentTarget.style.transform = 'scale(1)'
                                                }
                                            }}
                                        >
                                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('billing.plans.pro.upgrade')}
                                    </Button>
                                </CardFooter>
                            </Card>

                                {/* Card Enterprise - Roxo Galáctico */}
                                <Card 
                                    className="flex flex-col border-2 rounded-[2.5rem] shadow-xl transition-all relative overflow-hidden cursor-pointer"
                                    style={{
                                        background: theme === 'dark'
                                            ? 'linear-gradient(to bottom, #27272a 0%, #09090b 100%)'
                                            : 'linear-gradient(to bottom, #1e1b4b 0%, #0f172a 100%)',
                                        backgroundColor: theme === 'dark' ? '#18181b' : '#1e1b4b',
                                        borderColor: theme === 'dark' ? 'rgba(109, 40, 217, 0.45)' : 'rgba(109, 40, 217, 0.6)',
                                        boxShadow: theme === 'dark'
                                            ? '0 24px 56px -24px rgba(0,0,0,0.7), 0 0 0 1px rgba(109, 40, 217, 0.32), inset 0 1px 0 0 rgba(255,255,255,0.05)'
                                            : '0 0 80px rgba(109, 40, 217, 0.6), 0 0 120px rgba(34, 211, 238, 0.4), 0 25px 70px -15px rgba(109, 40, 217, 0.4), 0 0 0 1px rgba(109, 40, 217, 0.3), inset 0 0 30px rgba(109, 40, 217, 0.2)',
                                        transition: 'all 0.3s ease-in-out',
                                        position: 'relative'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'scale(1.03) translateY(-8px)'
                                        if (theme === 'dark') {
                                            e.currentTarget.style.borderColor = 'rgba(109, 40, 217, 0.6)'
                                            e.currentTarget.style.boxShadow = '0 32px 64px -20px rgba(0,0,0,0.78), 0 0 0 1px rgba(109, 40, 217, 0.45), inset 0 1px 0 0 rgba(255,255,255,0.07)'
                                        } else {
                                            e.currentTarget.style.background = 'linear-gradient(to bottom, #1e1b4b 0%, #0f172a 100%)'
                                            e.currentTarget.style.backgroundColor = '#1e1b4b'
                                            e.currentTarget.style.borderColor = 'rgba(109, 40, 217, 0.8)'
                                            e.currentTarget.style.boxShadow = '0 0 120px rgba(109, 40, 217, 0.9), 0 0 180px rgba(34, 211, 238, 0.6), 0 40px 100px -20px rgba(109, 40, 217, 0.7), 0 0 0 1px rgba(109, 40, 217, 0.5), inset 0 0 50px rgba(109, 40, 217, 0.3)'
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'scale(1) translateY(0)'
                                        if (theme === 'dark') {
                                            e.currentTarget.style.borderColor = 'rgba(109, 40, 217, 0.45)'
                                            e.currentTarget.style.boxShadow = '0 24px 56px -24px rgba(0,0,0,0.7), 0 0 0 1px rgba(109, 40, 217, 0.32), inset 0 1px 0 0 rgba(255,255,255,0.05)'
                                        } else {
                                            e.currentTarget.style.background = 'linear-gradient(to bottom, #1e1b4b 0%, #0f172a 100%)'
                                            e.currentTarget.style.backgroundColor = '#1e1b4b'
                                            e.currentTarget.style.borderColor = 'rgba(109, 40, 217, 0.6)'
                                            e.currentTarget.style.boxShadow = '0 0 80px rgba(109, 40, 217, 0.6), 0 0 120px rgba(34, 211, 238, 0.4), 0 25px 70px -15px rgba(109, 40, 217, 0.4), 0 0 0 1px rgba(109, 40, 217, 0.3), inset 0 0 30px rgba(109, 40, 217, 0.2)'
                                        }
                                    }}
                                >
                                    {/* Glow roxo atrás do card - Efeito de hardware flutuante */}
                                    <div 
                                        className="absolute -inset-[20px] rounded-[2.5rem] pointer-events-none"
                                        style={{
                                            background: 'radial-gradient(ellipse at center, rgba(109, 40, 217, 0.4) 0%, rgba(34, 211, 238, 0.2) 50%, transparent 70%)',
                                            filter: 'blur(30px)',
                                            zIndex: -1,
                                            opacity: 0.8
                                        }}
                                    />
                                    {/* Brilho nas bordas - Gradiente roxo/ciano */}
                                    <div 
                                        className="absolute -inset-[2px] rounded-[2.5rem] pointer-events-none opacity-70"
                                        style={{
                                            background: 'linear-gradient(135deg, rgba(109, 40, 217, 0.8), rgba(34, 211, 238, 0.6), rgba(109, 40, 217, 0.8))',
                                            filter: 'blur(3px)',
                                            zIndex: -1
                                        }}
                                    />
                                    {/* Efeito de energia passando - Roxo Galáctico */}
                                    <div 
                                        className="absolute inset-0 opacity-70 pointer-events-none"
                                        style={{
                                            background: 'linear-gradient(135deg, rgba(109, 40, 217, 0.6) 0%, transparent 30%, rgba(34, 211, 238, 0.5) 50%, transparent 70%, rgba(109, 40, 217, 0.4) 100%)',
                                            animation: 'shimmer-galactic 3s ease-in-out infinite',
                                            zIndex: 1
                                        }}
                                    />
                                    <style>{`
                                        @keyframes shimmer-galactic {
                                            0% {
                                                transform: translateX(-100%) translateY(-100%) rotate(45deg);
                                            }
                                            100% {
                                                transform: translateX(200%) translateY(200%) rotate(45deg);
                                            }
                                        }
                                    `}</style>
                                    <CardHeader className="relative" style={{ zIndex: 2, paddingTop: '1.5rem' }}>
                                        <CardTitle style={{ color: '#e2e8f0' }}>{t('billing.plans.enterprise.title')}</CardTitle>
                                        <CardDescription style={{ color: '#cbd5e1' }}>{t('billing.plans.enterprise.description')}</CardDescription>
                                </CardHeader>
                                    <CardContent className="flex-1 relative" style={{ zIndex: 2 }}>
                                        <div className="text-3xl font-bold mb-4 tracking-tight" style={{ color: '#e2e8f0' }}>
                                            <span 
                                                key={billingPeriod}
                                                className="inline-block animate-in fade-in duration-300"
                                            >
                                                {billingPeriod === 'yearly' ? t('billing.plans.enterprise.price.yearly') : t('billing.plans.enterprise.price.monthly')} 
                                            </span>
                                            <span className="text-sm font-normal" style={{ color: '#94a3b8' }}>/{billingPeriod === 'yearly' ? t('billing.plans.enterprise.period.yearly') : t('billing.plans.enterprise.period.monthly')}</span>
                                        </div>
                                        {billingPeriod === 'yearly' && (
                                            <p 
                                                key="economy-enterprise"
                                                className="text-xs font-semibold mb-4 animate-in fade-in duration-300"
                                                style={{ color: '#10b981' }}
                                            >
                                                {t('billing.plans.enterprise.economy')}
                                            </p>
                                        )}
                                        <ul className="space-y-4 text-sm" style={{ color: '#cbd5e1' }}>
                                            <li className="flex items-center gap-3">
                                                <div className="h-5 w-5 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(109, 40, 217, 0.3)' }}>
                                                    <Bot className="h-3.5 w-3.5" strokeWidth={2.5} style={{ color: '#a78bfa' }} />
                                                </div>
                                                <span>{t('billing.plans.enterprise.agents')}</span>
                                            </li>
                                            <li className="flex items-center gap-3">
                                                <div className="h-5 w-5 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(34, 211, 238, 0.3)' }}>
                                                    <Shield className="h-3.5 w-3.5" strokeWidth={2.5} style={{ color: '#22d3ee' }} />
                                                </div>
                                                <span>{t('billing.plans.enterprise.sso')}</span>
                                            </li>
                                            <li className="flex items-center gap-3">
                                                <div className="h-5 w-5 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(109, 40, 217, 0.3)' }}>
                                                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} style={{ color: '#a78bfa' }} />
                                                </div>
                                                <span>{t('billing.plans.enterprise.support')}</span>
                                            </li>
                                            <li className="flex items-center gap-3">
                                                <div className="h-5 w-5 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(34, 211, 238, 0.3)' }}>
                                                    <Database className="h-3.5 w-3.5" strokeWidth={2.5} style={{ color: '#22d3ee' }} />
                                                </div>
                                                <span>{t('billing.plans.enterprise.deployment')}</span>
                                            </li>
                                    </ul>
                                </CardContent>
                                    <CardFooter className="relative" style={{ zIndex: 2 }}>
                                        <style>{`
                                            @keyframes galactic-pulse {
                                                0%, 100% {
                                                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 30px rgba(109, 40, 217, 0.6), 0 0 60px rgba(34, 211, 238, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3);
                                                }
                                                50% {
                                                    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5), 0 0 50px rgba(109, 40, 217, 0.8), 0 0 100px rgba(34, 211, 238, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.4);
                                                }
                                            }
                                        `}</style>
                                        <Button 
                                            className="w-full h-10 font-black uppercase tracking-tight text-[11px] rounded-2xl text-white relative" 
                                            onClick={() => handleUpgrade(billingPeriod === 'yearly' ? 'price_ent_yearly' : 'price_ent_monthly')} 
                                            disabled={saving}
                                            style={{
                                                background: saving 
                                                    ? 'rgba(148, 163, 184, 0.3)' 
                                                    : 'linear-gradient(135deg, #6d28d9 0%, #7c3aed 30%, #8b5cf6 50%, #a78bfa 70%, #22d3ee 100%)',
                                                border: '1px solid rgba(109, 40, 217, 0.5)',
                                                color: '#ffffff',
                                                textShadow: saving ? 'none' : '0 0 20px rgba(255, 255, 255, 0.8), 0 0 40px rgba(109, 40, 217, 0.6), 0 0 60px rgba(34, 211, 238, 0.4)',
                                                animation: saving ? 'none' : 'galactic-pulse 2s ease-in-out infinite',
                                                boxShadow: saving 
                                                    ? 'none' 
                                                    : '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 30px rgba(109, 40, 217, 0.6), 0 0 60px rgba(34, 211, 238, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)'
                                            }}
                                            onMouseEnter={(e) => {
                                                if (!saving) {
                                                    e.currentTarget.style.background = 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 30%, #a78bfa 50%, #c084fc 70%, #34d399 100%)'
                                                    e.currentTarget.style.boxShadow = '0 15px 50px rgba(0, 0, 0, 0.6), 0 0 80px rgba(109, 40, 217, 1), 0 0 120px rgba(34, 211, 238, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.5)'
                                                    e.currentTarget.style.borderColor = 'rgba(109, 40, 217, 0.8)'
                                                    e.currentTarget.style.transform = 'scale(1.05)'
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (!saving) {
                                                    e.currentTarget.style.background = 'linear-gradient(135deg, #6d28d9 0%, #7c3aed 30%, #8b5cf6 50%, #a78bfa 70%, #22d3ee 100%)'
                                                    e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 30px rgba(109, 40, 217, 0.6), 0 0 60px rgba(34, 211, 238, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)'
                                                    e.currentTarget.style.borderColor = 'rgba(109, 40, 217, 0.5)'
                                                    e.currentTarget.style.transform = 'scale(1)'
                                                }
                                            }}
                                        >
                                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('billing.plans.enterprise.contact')}
                                    </Button>
                                </CardFooter>
                            </Card>
                            </div>
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    )
}
