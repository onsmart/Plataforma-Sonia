
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
    const [subscription, setSubscription] = useState<any>({ plan: 'pro', status: 'inactive' })
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
    const [usageStats, setUsageStats] = useState({ messagesUsed: 0, messagesLimit: 50, agentsUsed: 0, agentsLimit: 1 })
    const [loadingUsage, setLoadingUsage] = useState(false)
    const language = i18n.language || 'pt-BR'
    const isEnglish = language.startsWith('en')
    const isSpanish = language.startsWith('es')
    const hasActiveSubscription = subscription.status === 'active'
    const currentPlanLabel = subscription.plan === 'enterprise'
        ? 'Enterprise'
        : subscription.plan === 'plus'
            ? 'Plus'
            : 'Pro'
    const isCurrentPlan = (plan: 'pro' | 'plus' | 'enterprise') =>
        hasActiveSubscription && subscription.plan === plan
    const billingCopy = isEnglish
        ? {
            plansTitle: 'Subscriptions',
            plansDescription: 'Compare the available subscriptions and identify which plan is currently active.',
            basePlanBadge: 'Base plan',
            basePlanDescription: 'For initial operations',
            basePlanPrice: '$0',
            basePlanPeriod: '/month',
            basePlanMessages: 'Messages',
            basePlanAgent: 'Agent',
            basePlanMessagesLimit: 'messages/month',
            basePlanSupport: 'Community Support',
            plusPlanBadge: 'POPULAR',
            plusPlanDescription: 'For growing teams',
            plusPlanPrice: '$49',
            plusPlanPeriod: '/month',
            plusPlanAgents: 'Agents',
            plusPlanMessages: 'Unlimited Messages',
            plusPlanRag: 'RAG Knowledge Base',
            plusPlanSupport: 'Priority Support',
            usageLimitReached: 'Limit reached! Some features may be disabled.',
            upgradeToPro: 'Upgrade to Pro',
            upgradeToPlus: 'Upgrade to Plus',
            upgradeToEnterprise: 'Upgrade to Enterprise',
            prioritySupport: 'Priority Support',
            acquired: 'Acquired'
        }
        : isSpanish
            ? {
                plansTitle: 'Suscripciones',
                plansDescription: 'Compara las suscripciones disponibles e identifica cuál es tu plan actual.',
                basePlanBadge: 'Plan base',
                basePlanDescription: 'Para operaciones iniciales',
                basePlanPrice: '$0',
                basePlanPeriod: '/mes',
                basePlanMessages: 'Mensajes',
                basePlanAgent: 'Agente',
                basePlanMessagesLimit: 'mensajes/mes',
                basePlanSupport: 'Soporte Comunitario',
                plusPlanBadge: 'POPULAR',
                plusPlanDescription: 'Para equipos en crecimiento',
                plusPlanPrice: '$49',
                plusPlanPeriod: '/mes',
                plusPlanAgents: 'Agentes',
                plusPlanMessages: 'Mensajes Ilimitados',
                plusPlanRag: 'RAG Knowledge Base',
                plusPlanSupport: 'Prioridad en el Soporte',
                usageLimitReached: 'Limite alcanzado. Algunas funciones pueden estar desactivadas.',
                upgradeToPro: 'Hacer upgrade a Pro',
                upgradeToPlus: 'Hacer upgrade a Plus',
                upgradeToEnterprise: 'Hacer upgrade a Enterprise',
                prioritySupport: 'Soporte Prioritario',
                acquired: 'Adquirido'
            }
            : {
                plansTitle: 'Assinaturas',
                plansDescription: 'Compare as assinaturas disponíveis e veja qual plano está ativo no momento.',
                basePlanBadge: 'Plano base',
                basePlanDescription: 'Para operações iniciais',
                basePlanPrice: '$0',
                basePlanPeriod: '/mês',
                basePlanMessages: 'Mensagens',
                basePlanAgent: 'Agente',
                basePlanMessagesLimit: 'mensagens/mês',
                basePlanSupport: 'Suporte Comunitário',
                plusPlanBadge: 'POPULAR',
                plusPlanDescription: 'Para times em crescimento',
                plusPlanPrice: '$49',
                plusPlanPeriod: '/mês',
                plusPlanAgents: 'Agentes',
                plusPlanMessages: 'Mensagens Ilimitadas',
                plusPlanRag: 'RAG Knowledge Base',
                plusPlanSupport: 'Prioridade no Suporte',
                usageLimitReached: 'Limite atingido! Algumas funções podem estar desativadas.',
                upgradeToPro: 'Fazer upgrade para Pro',
                upgradeToPlus: 'Fazer upgrade para Plus',
                upgradeToEnterprise: 'Fazer upgrade para Enterprise',
                prioritySupport: 'Suporte Prioritário',
                acquired: 'Adquirido'
            }

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
                                                        Ativo
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

                    <div className="space-y-6">
                        {hasActiveSubscription && (
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
                                                <p className="font-medium capitalize">{t('billing.current.plan', { plan: currentPlanLabel })}</p>
                                                <p className="text-sm text-muted-foreground">{t('billing.current.status')}</p>
                                            </div>
                                        </div>
                                        <Button variant="outline" onClick={handlePortal} disabled={saving}>
                                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('billing.current.manage')}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        <Card 
                            className="border-0 rounded-[2.5rem] shadow-xl shadow-blue-900/5 hover:shadow-2xl hover:shadow-blue-900/10 transition-all"
                            style={{ backgroundColor: theme === 'dark' ? '#18181b' : '#F8FAFC' }}
                        >
                            <CardHeader className="space-y-4">
                                <div className="space-y-1">
                                    <CardTitle style={{ color: theme === 'dark' ? '#e2e8f0' : '#1e293b' }}>{billingCopy.plansTitle}</CardTitle>
                                    <CardDescription style={{ color: theme === 'dark' ? '#cbd5e1' : '#475569' }}>{billingCopy.plansDescription}</CardDescription>
                                </div>
                                <div className="flex justify-center">
                                    <div
                                        className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em]"
                                        style={{
                                            backgroundColor: theme === 'dark' ? 'rgba(15, 23, 42, 0.78)' : 'rgba(241, 245, 249, 0.95)',
                                            borderColor: theme === 'dark' ? 'rgba(34, 211, 238, 0.3)' : 'rgba(148, 163, 184, 0.35)',
                                            color: theme === 'dark' ? '#cbd5e1' : '#475569',
                                            boxShadow: theme === 'dark'
                                                ? '0 12px 30px -22px rgba(34, 211, 238, 0.35)'
                                                : '0 10px 24px -20px rgba(15, 23, 42, 0.18)'
                                        }}
                                    >
                                        <CreditCard className="h-3.5 w-3.5" style={{ color: theme === 'dark' ? '#22d3ee' : '#0f172a' }} />
                                        {t('billing.period.monthly')}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="grid gap-6 md:grid-cols-3">
                                <Card
                                    className="flex flex-col rounded-[2.25rem] border transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
                                    style={{
                                        background: theme === 'dark'
                                            ? 'linear-gradient(180deg, rgba(8, 145, 178, 0.14) 0%, #151821 28%, #101827 100%)'
                                            : 'linear-gradient(180deg, rgba(207, 250, 254, 0.72) 0%, #ffffff 34%, #f8fafc 100%)',
                                        borderColor: theme === 'dark' ? 'rgba(34, 211, 238, 0.2)' : 'rgba(6, 182, 212, 0.18)',
                                        boxShadow: theme === 'dark'
                                            ? '0 24px 44px -32px rgba(8, 145, 178, 0.28), 0 0 0 1px rgba(34, 211, 238, 0.05)'
                                            : '0 22px 40px -30px rgba(8, 145, 178, 0.2)'
                                    }}
                                >
                                    <div className="absolute right-5 top-5">
                                        <Badge
                                            className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]"
                                            style={{
                                                backgroundColor: theme === 'dark' ? 'rgba(34, 211, 238, 0.12)' : 'rgba(8, 145, 178, 0.1)',
                                                color: theme === 'dark' ? '#67e8f9' : '#0f766e',
                                                border: `1px solid ${theme === 'dark' ? 'rgba(34, 211, 238, 0.18)' : 'rgba(8, 145, 178, 0.16)'}`
                                            }}
                                        >
                                            {billingCopy.basePlanBadge}
                                        </Badge>
                                    </div>
                                    <CardHeader>
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="flex h-10 w-10 items-center justify-center rounded-2xl"
                                                style={{ backgroundColor: theme === 'dark' ? 'rgba(34, 211, 238, 0.14)' : 'rgba(8, 145, 178, 0.14)' }}
                                            >
                                                <Lightbulb className="h-5 w-5" style={{ color: theme === 'dark' ? '#22d3ee' : '#0f172a' }} />
                                            </div>
                                            <div>
                                                <CardTitle style={{ color: theme === 'dark' ? '#f8fafc' : '#0f172a' }}>Pro</CardTitle>
                                                <CardDescription style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b' }}>{billingCopy.basePlanDescription}</CardDescription>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="flex-1">
                                        <div className="mb-5 text-3xl font-bold tracking-tight" style={{ color: theme === 'dark' ? '#f8fafc' : '#0f172a' }}>
                                            {billingCopy.basePlanPrice}
                                            <span className="ml-1 text-sm font-normal" style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b' }}>
                                                {billingCopy.basePlanPeriod}
                                            </span>
                                        </div>

                                        <div
                                            className="mb-5 rounded-2xl border p-4"
                                            style={{
                                                backgroundColor: usageStats.messagesUsed > usageStats.messagesLimit
                                                    ? (theme === 'dark' ? 'rgba(127, 29, 29, 0.22)' : 'rgba(254, 226, 226, 0.9)')
                                                    : (theme === 'dark' ? 'rgba(15, 23, 42, 0.54)' : 'rgba(240, 249, 255, 0.9)'),
                                                borderColor: usageStats.messagesUsed > usageStats.messagesLimit
                                                    ? 'rgba(239, 68, 68, 0.32)'
                                                    : (theme === 'dark' ? 'rgba(34, 211, 238, 0.14)' : 'rgba(6, 182, 212, 0.14)')
                                            }}
                                        >
                                            <div className="mb-2 flex items-center justify-between">
                                                <span className="text-xs font-semibold" style={{ color: usageStats.messagesUsed > usageStats.messagesLimit ? '#ef4444' : (theme === 'dark' ? '#cbd5e1' : '#475569') }}>
                                                    {billingCopy.basePlanMessages}
                                                </span>
                                                <span className="text-xs font-bold" style={{ color: usageStats.messagesUsed > usageStats.messagesLimit ? '#ef4444' : (theme === 'dark' ? '#f8fafc' : '#0f172a') }}>
                                                    {usageStats.messagesUsed}/{usageStats.messagesLimit}
                                                </span>
                                            </div>
                                            <div
                                                className="h-2 overflow-hidden rounded-full"
                                                style={{ backgroundColor: theme === 'dark' ? 'rgba(51, 65, 85, 0.7)' : '#e2e8f0' }}
                                            >
                                                <div
                                                    className={`h-full rounded-full transition-all duration-300 ${usageStats.messagesUsed > usageStats.messagesLimit ? 'animate-pulse' : ''}`}
                                                    style={{
                                                        width: `${Math.min((usageStats.messagesUsed / usageStats.messagesLimit) * 100, 100)}%`,
                                                        background: usageStats.messagesUsed > usageStats.messagesLimit
                                                            ? 'linear-gradient(90deg, #dc2626 0%, #ef4444 100%)'
                                                            : 'linear-gradient(90deg, #2563eb 0%, #06b6d4 100%)'
                                                    }}
                                                />
                                            </div>
                                            {usageStats.messagesUsed > usageStats.messagesLimit && (
                                                <div className="mt-3 flex items-center gap-2 text-xs font-semibold" style={{ color: '#ef4444' }}>
                                                    <AlertTriangle className="h-3.5 w-3.5" />
                                                    <span>{billingCopy.usageLimitReached}</span>
                                                </div>
                                            )}
                                        </div>

                                        <ul className="space-y-4 text-sm">
                                            <li className="flex items-center gap-3" style={{ color: theme === 'dark' ? '#e2e8f0' : '#0f172a' }}>
                                                <div className="flex h-5 w-5 items-center justify-center rounded-lg" style={{ backgroundColor: theme === 'dark' ? 'rgba(51, 65, 85, 0.75)' : '#e2e8f0' }}>
                                                    <Bot className="h-3.5 w-3.5" strokeWidth={2.5} style={{ color: theme === 'dark' ? '#cbd5e1' : '#334155' }} />
                                                </div>
                                                <span><span className="font-black">1</span> {billingCopy.basePlanAgent}</span>
                                            </li>
                                            <li className="flex items-center gap-3" style={{ color: theme === 'dark' ? '#e2e8f0' : '#0f172a' }}>
                                                <div className="flex h-5 w-5 items-center justify-center rounded-lg" style={{ backgroundColor: theme === 'dark' ? 'rgba(51, 65, 85, 0.75)' : '#e2e8f0' }}>
                                                    <MessageSquare className="h-3.5 w-3.5" strokeWidth={2.5} style={{ color: theme === 'dark' ? '#cbd5e1' : '#334155' }} />
                                                </div>
                                                <span><span className="font-black">50</span> {billingCopy.basePlanMessagesLimit}</span>
                                            </li>
                                            <li className="flex items-center gap-3" style={{ color: theme === 'dark' ? '#cbd5e1' : '#475569' }}>
                                                <div className="flex h-5 w-5 items-center justify-center rounded-lg" style={{ backgroundColor: theme === 'dark' ? 'rgba(51, 65, 85, 0.75)' : '#e2e8f0' }}>
                                                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} style={{ color: theme === 'dark' ? '#cbd5e1' : '#334155' }} />
                                                </div>
                                                <span>{billingCopy.basePlanSupport}</span>
                                            </li>
                                            <li className="flex items-center gap-3" style={{ color: theme === 'dark' ? '#64748b' : '#94a3b8' }}>
                                                <div className="flex h-5 w-5 items-center justify-center rounded-lg" style={{ backgroundColor: theme === 'dark' ? 'rgba(30, 41, 59, 0.95)' : '#f1f5f9' }}>
                                                    <Lock className="h-3.5 w-3.5" strokeWidth={2.5} />
                                                </div>
                                                <span className="flex items-center gap-1.5">
                                                    <Brain className="h-3.5 w-3.5" />
                                                    RAG Knowledge Base
                                                </span>
                                            </li>
                                            <li className="flex items-center gap-3" style={{ color: theme === 'dark' ? '#64748b' : '#94a3b8' }}>
                                                <div className="flex h-5 w-5 items-center justify-center rounded-lg" style={{ backgroundColor: theme === 'dark' ? 'rgba(30, 41, 59, 0.95)' : '#f1f5f9' }}>
                                                    <Lock className="h-3.5 w-3.5" strokeWidth={2.5} />
                                                </div>
                                                <span>{billingCopy.prioritySupport}</span>
                                            </li>
                                        </ul>
                                    </CardContent>
                                    <CardFooter>
                                        {isCurrentPlan('pro') ? (
                                            <div
                                                className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border text-[11px] font-black uppercase tracking-[0.08em]"
                                                style={{
                                                    backgroundColor: theme === 'dark' ? 'rgba(34, 197, 94, 0.14)' : 'rgba(220, 252, 231, 0.95)',
                                                    color: theme === 'dark' ? '#86efac' : '#166534',
                                                    borderColor: theme === 'dark' ? 'rgba(34, 197, 94, 0.25)' : 'rgba(34, 197, 94, 0.2)'
                                                }}
                                            >
                                                <Check className="h-4 w-4" />
                                                {billingCopy.acquired}
                                            </div>
                                        ) : (
                                            <Button
                                                className="h-11 w-full rounded-2xl text-[11px] font-black uppercase tracking-[0.08em]"
                                                onClick={() => handleUpgrade('price_pro_monthly')}
                                                disabled={saving}
                                                style={{
                                                backgroundColor: saving ? '#94a3b8' : (theme === 'dark' ? '#e2e8f0' : '#0f172a'),
                                                    color: saving ? '#ffffff' : '#ffffff',
                                                    background: saving ? '#94a3b8' : (theme === 'dark'
                                                        ? 'linear-gradient(135deg, #0f172a 0%, #164e63 52%, #0891b2 100%)'
                                                        : 'linear-gradient(135deg, #0f172a 0%, #155e75 52%, #0891b2 100%)'),
                                                    boxShadow: saving ? 'none' : '0 16px 28px -18px rgba(8, 145, 178, 0.38)'
                                                }}
                                            >
                                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : billingCopy.upgradeToPro}
                                            </Button>
                                        )}
                                    </CardFooter>
                                </Card>

                                <Card
                                    className="relative flex flex-col rounded-[2.25rem] border transition-all duration-300 hover:-translate-y-1 md:-translate-y-2"
                                    style={{
                                        background: theme === 'dark'
                                            ? 'linear-gradient(180deg, rgba(14, 116, 144, 0.16) 0%, #111827 24%, #0f172a 100%)'
                                            : 'linear-gradient(180deg, rgba(186, 230, 253, 0.55) 0%, #ffffff 32%, #f8fafc 100%)',
                                        borderColor: theme === 'dark' ? 'rgba(34, 211, 238, 0.34)' : 'rgba(14, 165, 233, 0.28)',
                                        boxShadow: theme === 'dark'
                                            ? '0 28px 54px -32px rgba(6, 182, 212, 0.38), 0 0 0 1px rgba(34, 211, 238, 0.08)'
                                            : '0 26px 48px -30px rgba(14, 165, 233, 0.26)'
                                    }}
                                >
                                    <div className="absolute right-5 top-5">
                                        <Badge
                                            className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]"
                                            style={{
                                                backgroundColor: theme === 'dark' ? 'rgba(34, 211, 238, 0.14)' : 'rgba(8, 145, 178, 0.12)',
                                                color: theme === 'dark' ? '#67e8f9' : '#155e75',
                                                border: `1px solid ${theme === 'dark' ? 'rgba(34, 211, 238, 0.24)' : 'rgba(8, 145, 178, 0.18)'}`
                                            }}
                                        >
                                            {billingCopy.plusPlanBadge}
                                        </Badge>
                                    </div>
                                    <CardHeader>
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="flex h-10 w-10 items-center justify-center rounded-2xl"
                                                style={{ backgroundColor: theme === 'dark' ? 'rgba(34, 211, 238, 0.14)' : 'rgba(8, 145, 178, 0.12)' }}
                                            >
                                                <Plus className="h-5 w-5" style={{ color: theme === 'dark' ? '#22d3ee' : '#0f172a' }} />
                                            </div>
                                            <div>
                                                <CardTitle style={{ color: theme === 'dark' ? '#f8fafc' : '#0f172a' }}>Plus</CardTitle>
                                                <CardDescription style={{ color: theme === 'dark' ? '#cbd5e1' : '#475569' }}>{billingCopy.plusPlanDescription}</CardDescription>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="flex-1">
                                        <div className="mb-5 text-4xl font-black tracking-tight" style={{ color: theme === 'dark' ? '#f8fafc' : '#0f172a' }}>
                                            {billingCopy.plusPlanPrice}
                                            <span className="text-sm font-normal" style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b' }}>
                                                {billingCopy.plusPlanPeriod}
                                            </span>
                                        </div>
                                        <ul className="space-y-4 text-sm" style={{ color: theme === 'dark' ? '#cbd5e1' : '#475569' }}>
                                            <li className="flex items-center gap-3 font-medium" style={{ color: theme === 'dark' ? '#f8fafc' : '#0f172a' }}>
                                                <div className="flex h-5 w-5 items-center justify-center rounded-lg" style={{ backgroundColor: theme === 'dark' ? 'rgba(37, 99, 235, 0.2)' : '#dbeafe' }}>
                                                    <Bot className="h-3.5 w-3.5" strokeWidth={2.5} style={{ color: theme === 'dark' ? '#93c5fd' : '#2563eb' }} />
                                                </div>
                                                <span><span className="font-black">5</span> {billingCopy.plusPlanAgents}</span>
                                            </li>
                                            <li className="flex items-center gap-3 font-medium" style={{ color: theme === 'dark' ? '#f8fafc' : '#0f172a' }}>
                                                <div className="flex h-5 w-5 items-center justify-center rounded-lg" style={{ backgroundColor: theme === 'dark' ? 'rgba(16, 185, 129, 0.2)' : '#d1fae5' }}>
                                                    <MessageSquare className="h-3.5 w-3.5" strokeWidth={2.5} style={{ color: theme === 'dark' ? '#6ee7b7' : '#059669' }} />
                                                </div>
                                                <span>{billingCopy.plusPlanMessages}</span>
                                            </li>
                                            <li className="flex items-center gap-3 font-medium" style={{ color: theme === 'dark' ? '#f8fafc' : '#0f172a' }}>
                                                <div className="flex h-5 w-5 items-center justify-center rounded-lg" style={{ backgroundColor: theme === 'dark' ? 'rgba(14, 165, 233, 0.18)' : '#e0f2fe' }}>
                                                    <Brain className="h-3.5 w-3.5" strokeWidth={2.5} style={{ color: theme === 'dark' ? '#67e8f9' : '#0284c7' }} />
                                                </div>
                                                <span>{billingCopy.plusPlanRag}</span>
                                            </li>
                                            <li className="flex items-center gap-3 font-medium" style={{ color: theme === 'dark' ? '#f8fafc' : '#0f172a' }}>
                                                <div className="flex h-5 w-5 items-center justify-center rounded-lg" style={{ backgroundColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.18)' : '#dbeafe' }}>
                                                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} style={{ color: theme === 'dark' ? '#93c5fd' : '#2563eb' }} />
                                                </div>
                                                <span>{billingCopy.plusPlanSupport}</span>
                                            </li>
                                        </ul>
                                    </CardContent>
                                    <CardFooter>
                                        {isCurrentPlan('plus') ? (
                                            <div
                                                className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border text-[11px] font-black uppercase tracking-[0.08em]"
                                                style={{
                                                    backgroundColor: theme === 'dark' ? 'rgba(34, 197, 94, 0.14)' : 'rgba(220, 252, 231, 0.95)',
                                                    color: theme === 'dark' ? '#86efac' : '#166534',
                                                    borderColor: theme === 'dark' ? 'rgba(34, 197, 94, 0.25)' : 'rgba(34, 197, 94, 0.2)'
                                                }}
                                            >
                                                <Check className="h-4 w-4" />
                                                {billingCopy.acquired}
                                            </div>
                                        ) : (
                                            <Button
                                                className="h-11 w-full rounded-2xl text-[11px] font-black uppercase tracking-[0.08em] text-white"
                                                onClick={() => handleUpgrade('price_plus_monthly')}
                                                disabled={saving}
                                                style={{
                                                    background: saving ? '#94a3b8' : 'linear-gradient(135deg, #0f172a 0%, #155e75 48%, #06b6d4 100%)',
                                                    boxShadow: saving ? 'none' : '0 16px 28px -18px rgba(6, 182, 212, 0.5)'
                                                }}
                                            >
                                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : billingCopy.upgradeToPlus}
                                            </Button>
                                        )}
                                    </CardFooter>
                                </Card>

                                <Card
                                    className="flex flex-col rounded-[2.25rem] border transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
                                    style={{
                                        background: theme === 'dark'
                                            ? 'linear-gradient(180deg, rgba(37, 99, 235, 0.12) 0%, #111827 26%, #0f172a 100%)'
                                            : 'linear-gradient(180deg, rgba(219, 234, 254, 0.8) 0%, #f8fafc 100%)',
                                        borderColor: theme === 'dark' ? 'rgba(96, 165, 250, 0.26)' : 'rgba(59, 130, 246, 0.18)',
                                        boxShadow: theme === 'dark'
                                            ? '0 22px 44px -30px rgba(37, 99, 235, 0.32)'
                                            : '0 22px 40px -30px rgba(37, 99, 235, 0.18)'
                                    }}
                                >
                                    <CardHeader>
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="flex h-10 w-10 items-center justify-center rounded-2xl"
                                                style={{ backgroundColor: theme === 'dark' ? 'rgba(96, 165, 250, 0.14)' : '#dbeafe' }}
                                            >
                                                <Shield className="h-5 w-5" style={{ color: theme === 'dark' ? '#93c5fd' : '#1d4ed8' }} />
                                            </div>
                                            <div>
                                                <CardTitle style={{ color: theme === 'dark' ? '#f8fafc' : '#0f172a' }}>{t('billing.plans.enterprise.title')}</CardTitle>
                                                <CardDescription style={{ color: theme === 'dark' ? '#cbd5e1' : '#475569' }}>{t('billing.plans.enterprise.description')}</CardDescription>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="flex-1">
                                        <div className="mb-5 text-3xl font-bold tracking-tight" style={{ color: theme === 'dark' ? '#f8fafc' : '#0f172a' }}>
                                            {t('billing.plans.enterprise.price.monthly')}
                                            <span className="text-sm font-normal" style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b' }}>
                                                /{t('billing.plans.enterprise.period.monthly')}
                                            </span>
                                        </div>
                                        <ul className="space-y-4 text-sm" style={{ color: theme === 'dark' ? '#cbd5e1' : '#475569' }}>
                                            <li className="flex items-center gap-3">
                                                <div className="flex h-5 w-5 items-center justify-center rounded-lg" style={{ backgroundColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.18)' : '#dbeafe' }}>
                                                    <Bot className="h-3.5 w-3.5" strokeWidth={2.5} style={{ color: theme === 'dark' ? '#93c5fd' : '#2563eb' }} />
                                                </div>
                                                <span>{t('billing.plans.enterprise.agents')}</span>
                                            </li>
                                            <li className="flex items-center gap-3">
                                                <div className="flex h-5 w-5 items-center justify-center rounded-lg" style={{ backgroundColor: theme === 'dark' ? 'rgba(14, 165, 233, 0.18)' : '#e0f2fe' }}>
                                                    <Shield className="h-3.5 w-3.5" strokeWidth={2.5} style={{ color: theme === 'dark' ? '#67e8f9' : '#0284c7' }} />
                                                </div>
                                                <span>{t('billing.plans.enterprise.sso')}</span>
                                            </li>
                                            <li className="flex items-center gap-3">
                                                <div className="flex h-5 w-5 items-center justify-center rounded-lg" style={{ backgroundColor: theme === 'dark' ? 'rgba(99, 102, 241, 0.18)' : '#e0e7ff' }}>
                                                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} style={{ color: theme === 'dark' ? '#a5b4fc' : '#4f46e5' }} />
                                                </div>
                                                <span>{t('billing.plans.enterprise.support')}</span>
                                            </li>
                                            <li className="flex items-center gap-3">
                                                <div className="flex h-5 w-5 items-center justify-center rounded-lg" style={{ backgroundColor: theme === 'dark' ? 'rgba(34, 197, 94, 0.18)' : '#dcfce7' }}>
                                                    <Database className="h-3.5 w-3.5" strokeWidth={2.5} style={{ color: theme === 'dark' ? '#86efac' : '#16a34a' }} />
                                                </div>
                                                <span>{t('billing.plans.enterprise.deployment')}</span>
                                            </li>
                                        </ul>
                                    </CardContent>
                                    <CardFooter>
                                        {isCurrentPlan('enterprise') ? (
                                            <div
                                                className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border text-[11px] font-black uppercase tracking-[0.08em]"
                                                style={{
                                                    backgroundColor: theme === 'dark' ? 'rgba(34, 197, 94, 0.14)' : 'rgba(220, 252, 231, 0.95)',
                                                    color: theme === 'dark' ? '#86efac' : '#166534',
                                                    borderColor: theme === 'dark' ? 'rgba(34, 197, 94, 0.25)' : 'rgba(34, 197, 94, 0.2)'
                                                }}
                                            >
                                                <Check className="h-4 w-4" />
                                                {billingCopy.acquired}
                                            </div>
                                        ) : (
                                            <Button
                                                className="h-11 w-full rounded-2xl text-[11px] font-black uppercase tracking-[0.08em]"
                                                onClick={() => handleUpgrade('price_ent_monthly')}
                                                disabled={saving}
                                                style={{
                                                    backgroundColor: saving ? '#94a3b8' : (theme === 'dark' ? '#e2e8f0' : '#0f172a'),
                                                    color: saving ? '#ffffff' : (theme === 'dark' ? '#0f172a' : '#ffffff'),
                                                    boxShadow: saving ? 'none' : (theme === 'dark'
                                                        ? '0 16px 28px -22px rgba(226, 232, 240, 0.35)'
                                                        : '0 16px 28px -22px rgba(15, 23, 42, 0.4)')
                                                }}
                                            >
                                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : billingCopy.upgradeToEnterprise}
                                            </Button>
                                        )}
                                    </CardFooter>
                                </Card>
                            </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
