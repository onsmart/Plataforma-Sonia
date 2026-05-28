
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
import { Download, Shield, Save, Loader2, Users, Mail, Trash2, CreditCard, Check, Ban, Brain, Lock, Send, Plus, Bot, MessageSquare, Database, Lightbulb, AlertTriangle, Building2, Info } from "lucide-react"
import { toast } from "sonner"
import { AgentService, GovernanceConfig } from "../services/api"
import { useTheme } from "next-themes"
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert"
import { getPermissionInfo } from "../lib/team-permissions"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { Avatar, AvatarFallback } from "../components/ui/avatar"
import { BillingPlansSection } from "../components/configuration/BillingPlansSection"
import { normalizePlanId, planTitle } from "../lib/plan-catalog"

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
    const [subscription, setSubscription] = useState<any>({ plan: 'free', status: 'inactive', plan_title: 'Plano gratuito', catalog_plan: 'free' })
    const [checkoutPlanId, setCheckoutPlanId] = useState<string | null>(null)
    const [teamWorkspace, setTeamWorkspace] = useState<{ can_manage_team: boolean; account_type: string; company_name: string | null }>({
        can_manage_team: false,
        account_type: 'individual',
        company_name: null,
    })
    const [activeTab, setActiveTab] = useState(initialTab || "team")
    const [translationsReady, setTranslationsReady] = useState(false)
    
    // Atualiza a aba quando initialTab mudar
    React.useEffect(() => {
        if (initialTab && initialTab !== 'api') {
            setActiveTab(initialTab)
        }
    }, [initialTab])
    const [usageStats, setUsageStats] = useState({
        conversationsUsed: 0,
        conversationsLimit: 200 as number | null,
        agentsUsed: 0,
        agentsLimit: 1 as number | null,
        usageLimitReached: false,
    })
    const [loadingUsage, setLoadingUsage] = useState(false)
    const language = i18n.language || 'pt-BR'
    const isEnglish = language.startsWith('en')
    const isSpanish = language.startsWith('es')
    const hasActiveSubscription = subscription.status === 'active' || subscription.status === 'trialing'
    const catalogPlanId = normalizePlanId(subscription.catalog_plan || subscription.plan)
    const currentPlanLabel = subscription.plan_title || planTitle(catalogPlanId)
    const normalizedSubscriptionPlan = catalogPlanId
    const billingCopy = isEnglish
        ? {
            plansTitle: 'Subscriptions',
            plansDescription: 'Six official plans: Receptive AI (inbound) and Complete AI (inbound + SDR).',
            recLineTitle: 'Sonia Receptive',
            recLineDescription: 'Inbound AI only — FAQ, triage and flows. No active SDR.',
            comLineTitle: 'Sonia Complete',
            comLineDescription: 'Receptive + active AI — cadences, prospecting and outbound.',
            conversations: 'Atendimentos (sessões/mês)',
            agents: 'Agents',
            unlimited: 'Unlimited',
            subscribe: 'Subscribe',
            perMonth: '/month',
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
            acquired: 'Acquired',
            contactSales: 'Talk to sales',
            currentPlanBadge: 'Current plan'
        }
        : isSpanish
            ? {
                plansTitle: 'Suscripciones',
                plansDescription: 'Seis planes oficiales: IA Receptiva y IA Completa (receptiva + SDR).',
                recLineTitle: 'Sonia Receptiva',
                recLineDescription: 'Solo IA receptiva — FAQ, triaje y flujos. Sin SDR activo.',
                comLineTitle: 'Sonia Completa',
                comLineDescription: 'IA receptiva + activa — cadencias, prospección y outbound.',
                conversations: 'Atendimentos (sesiones/mes)',
                agents: 'Agentes',
                unlimited: 'Ilimitado',
                subscribe: 'Contratar',
                perMonth: '/mes',
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
                acquired: 'Adquirido',
                contactSales: 'Hablar con ventas',
                currentPlanBadge: 'Plan actual'
            }
            : {
                plansTitle: 'Assinaturas',
                plansDescription: 'Seis planos oficiais: IA Receptiva e IA Completa (receptiva + SDR).',
                recLineTitle: 'Sonia Receptiva',
                recLineDescription: 'Somente IA receptiva — inbound, FAQ e triagem. Sem operação SDR.',
                comLineTitle: 'Sonia Completa',
                comLineDescription: 'IA receptiva + ativa — cadências, prospecção e campanhas outbound.',
                conversations: 'Atendimentos (sessões/mês)',
                agents: 'Agentes',
                unlimited: 'Ilimitado',
                subscribe: 'Contratar plano',
                perMonth: '/mês',
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
                acquired: 'Adquirido',
                contactSales: 'Falar com vendas',
                currentPlanBadge: 'Plano atual'
            }

    // General Settings State
    const [generalConfig, setGeneralConfig] = useState({
        workspaceName: "Acme Corp AI",
        customDomain: "acme.sonia.ai",
        reducedMotion: false,
        highContrast: true
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

    const loadTeam = async () => {
        try {
            const [workspace, teamData] = await Promise.all([
                AgentService.getTeamWorkspace(),
                AgentService.getTeam(),
            ])
            setTeamWorkspace(workspace)
            setTeam(teamData || [])
        } catch (e: any) {
            console.error('[Settings] team load:', e)
            toast.error(e.message || t('team.error.load'))
        }
    }

    const loadAllSettings = async () => {
        setLoading(true)
        try {
            await Promise.all([loadTeam(), loadPermissions()])
            const stats = await AgentService.getSubscriptionUsage()
            if (stats) {
                setSubscription({
                    plan: stats.effective_plan || stats.plan || 'free',
                    catalog_plan: stats.catalog_plan || stats.plan || 'free',
                    plan_title: stats.plan_title || planTitle(stats.catalog_plan || stats.plan),
                    status: stats.subscription_status || stats.status || 'inactive',
                    current_period_end: stats.current_period_end,
                    has_stripe_subscription: stats.has_stripe_subscription,
                })
                setUsageStats({
                    conversationsUsed: stats.conversations_used ?? stats.messages_used ?? 0,
                    conversationsLimit: stats.conversations_limit ?? stats.messages_limit ?? 200,
                    agentsUsed: stats.agents_used || 0,
                    agentsLimit: stats.agents_limit ?? 1,
                    usageLimitReached: Boolean(
                        stats.usage_limit_reached ??
                        (stats.conversations_limit != null &&
                            (stats.conversations_used ?? 0) >= stats.conversations_limit)
                    ),
                })
            }
            const gen = await AgentService.getGeneralSettings()
            if (gen && Object.keys(gen).length > 0) setGeneralConfig(gen)
        } catch (e) {
            console.error('[Settings] loadAllSettings:', e)
        } finally {
            setLoading(false)
        }
    }

    // --- BILLING HANDLERS ---
    const handleUpgrade = async (priceId: string) => {
        setCheckoutPlanId(priceId)
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
            const raw = e?.message || ''
            const errorMessage =
                raw.includes('STRIPE') || raw.includes('price') || raw.includes('Price')
                    ? 'Pagamento indisponível: configure os preços Stripe no servidor ou escolha outro plano.'
                    : raw || t('billing.error.checkout')
            toast.error(errorMessage)
            setCheckoutPlanId(null)
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
                await loadTeam()
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

    // Carregar dados de uso da subscription
    const loadUsageStats = useCallback(async () => {
        if (activeTab !== 'billing') return

        setLoadingUsage(true)
        try {
            const stats = await AgentService.getSubscriptionUsage()
            if (!stats) return
            setSubscription({
                plan: stats.effective_plan || stats.plan || 'free',
                catalog_plan: stats.catalog_plan || stats.plan || 'free',
                plan_title: stats.plan_title || planTitle(stats.catalog_plan || stats.plan),
                status: stats.subscription_status || stats.status || 'inactive',
                current_period_end: stats.current_period_end,
                has_stripe_subscription: stats.has_stripe_subscription,
            })
            setUsageStats({
                conversationsUsed: stats.conversations_used ?? stats.messages_used ?? 0,
                conversationsLimit:
                    stats.conversations_limit ?? stats.messages_limit ?? 200,
                agentsUsed: stats.agents_used || 0,
                agentsLimit: stats.agents_limit ?? 1,
                usageLimitReached: Boolean(
                    stats.usage_limit_reached ??
                    (stats.conversations_limit != null &&
                        (stats.conversations_used ?? 0) >= stats.conversations_limit)
                ),
            })
        } catch (error: any) {
            console.error('[loadUsageStats] Erro:', error)
        } finally {
            setLoadingUsage(false)
        }
    }, [activeTab])

    useEffect(() => {
        loadUsageStats()
    }, [loadUsageStats])

    return (
        <div className="min-h-screen -m-4 space-y-6 bg-[#F8FAFC] p-8 dark:bg-background">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                {/* Pílulas Escuras para Sub-abas */}
                <style>{`
                    @keyframes tabSlide {
                        from {
                            opacity: 0;
                        }
                        to {
                            opacity: 1;
                        }
                    }
                    .tab-trigger {
                        transition: background-color 0.16s ease, color 0.16s ease, box-shadow 0.16s ease !important;
                    }
                    .tab-trigger[data-state="active"] {
                        background: linear-gradient(135deg, #06b6d4 0%, #0891b2 50%, #0e7490 100%) !important;
                        box-shadow: 0 4px 12px rgba(6, 182, 212, 0.22), 0 0 0 1px rgba(6, 182, 212, 0.32) !important;
                    }
                    .tab-icon {
                        transition: color 0.16s ease !important;
                    }
                    .tab-content {
                        animation: tabSlide 0.16s ease-out !important;
                    }
                `}</style>
                <TabsList className="bg-transparent p-0 h-auto gap-2">
                    <TabsTrigger 
                        value="team" 
                        className="tab-trigger rounded-xl px-4 py-2 text-sm font-medium data-[state=active]:text-white data-[state=inactive]:bg-slate-100 data-[state=inactive]:text-slate-600 hover:data-[state=inactive]:bg-slate-200 dark:data-[state=inactive]:bg-zinc-800 dark:data-[state=inactive]:text-zinc-200 dark:hover:data-[state=inactive]:bg-zinc-700/80"
                    >
                        <Users className="tab-icon h-3.5 w-3.5 inline mr-2" /> {t('settings.tabs.team')}
                        </TabsTrigger>
                    <TabsTrigger 
                        value="billing" 
                        className="tab-trigger rounded-xl px-4 py-2 text-sm font-medium data-[state=active]:text-white data-[state=inactive]:bg-slate-100 data-[state=inactive]:text-slate-600 hover:data-[state=inactive]:bg-slate-200 dark:data-[state=inactive]:bg-zinc-800 dark:data-[state=inactive]:text-zinc-200 dark:hover:data-[state=inactive]:bg-zinc-700/80"
                    >
                        <CreditCard className="tab-icon h-3.5 w-3.5 inline mr-2" /> {t('settings.tabs.billing')}
                    </TabsTrigger>
                    </TabsList>

                <TabsContent value="team" className="tab-content space-y-4">
                    <Card 
                        className="rounded-[1.5rem] border shadow-sm transition-shadow duration-150"
                        style={{ 
                            backgroundColor: theme === 'dark' ? '#18181b' : '#F8FAFC',
                            boxShadow: theme === 'dark'
                                ? '0 10px 24px -18px rgba(0, 0, 0, 0.55)'
                                : '0 10px 24px -18px rgba(15, 23, 42, 0.22)',
                            border: theme === 'dark' ? '1px solid rgba(63, 63, 70, 0.65)' : '1px solid rgba(226, 232, 240, 0.9)'
                        }}
                    >
                        <CardHeader>
                            <CardTitle style={{ color: theme === 'dark' ? '#e2e8f0' : '#1e293b' }}>{t('team.title')}</CardTitle>
                            <CardDescription style={{ color: theme === 'dark' ? '#cbd5e1' : '#475569' }}>
                                {t('team.description')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {!teamWorkspace.can_manage_team && (
                                <Alert className="mb-6 border-amber-500/30 bg-amber-500/10">
                                    <Building2 className="h-4 w-4" />
                                    <AlertTitle>Equipe disponível para Pessoa Jurídica</AlertTitle>
                                    <AlertDescription>
                                        Contas Pessoa Física usam a plataforma individualmente. Para convidar colaboradores
                                        (contas PF cadastradas na Sonia), cadastre ou migre o workspace para Pessoa Jurídica.
                                    </AlertDescription>
                                </Alert>
                            )}

                            {teamWorkspace.can_manage_team && (
                            <>
                            {/* Card de Convite com Fundo Azulado */}
                            <Card 
                                className={`mb-6 rounded-[1rem] border shadow-sm transition-shadow duration-150 ${theme === 'dark' ? 'bg-zinc-800/80' : 'bg-slate-50'}`}
                                style={{
                                    boxShadow: theme === 'dark'
                                        ? '0 6px 16px -14px rgba(0, 0, 0, 0.7)'
                                        : '0 6px 16px -14px rgba(15, 23, 42, 0.25)',
                                    border: theme === 'dark' ? '1px solid rgba(63, 63, 70, 0.6)' : '1px solid rgba(226, 232, 240, 0.9)'
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
                                                className="border-slate-700/40 bg-white focus:border-slate-500 dark:border-border dark:bg-zinc-900/80 dark:text-foreground"
                                    />
                                </div>
                                <div className="space-y-2 w-[250px]">
                                            <Label className="text-sm font-semibold text-slate-700 dark:text-zinc-200">{t('team.permission.label')}</Label>
                                    <Select value={permissionKey} onValueChange={setPermissionKey}>
                                                <SelectTrigger className="border-slate-700/40 bg-white dark:border-border dark:bg-zinc-900/80 dark:text-foreground">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {permissions.map((perm) => {
                                                const info = getPermissionInfo(perm.key)
                                                return (
                                                <SelectItem key={perm.key} value={perm.key}>
                                                    {info.label} — {info.description}
                                                </SelectItem>
                                                )
                                            })}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        {getPermissionInfo(permissionKey).description}
                                    </p>
                                </div>
                                        <Button 
                                            onClick={handleInvite} 
                                            disabled={!inviteEmail || !teamWorkspace.can_manage_team}
                                            className="rounded-xl px-6 text-white shadow-sm transition-shadow duration-150 hover:shadow-md"
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
                            </>
                            )}

                            {/* Linhas-Card (sem tabela) */}
                            <div className="space-y-3">
                                        {team.length === 0 ? (
                                    <div className="flex h-24 items-center justify-center rounded-xl bg-slate-50 text-center text-muted-foreground dark:bg-muted">
                                                    {t('team.empty')}
                                    </div>
                                ) : team.map((member) => {
                                    const initials = (member.name || member.email || 'U').substring(0, 2).toUpperCase()
                                    const isAdmin = member.permissions?.some((p: any) => p.name?.toLowerCase().includes('admin') || p.key?.includes('admin'))
                                    
                                    const rowBg = theme === 'dark' ? 'rgba(39, 39, 42, 0.55)' : '#ffffff'
                                    const rowBgHover = theme === 'dark' ? 'rgba(63, 63, 70, 0.65)' : '#f8fafc'
                                    const rowBorder = theme === 'dark' ? 'rgba(63, 63, 70, 0.65)' : 'rgba(226, 232, 240, 0.9)'
                                    const rowShadow = theme === 'dark'
                                        ? '0 1px 3px 0 rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(63, 63, 70, 0.45)'
                                        : '0 1px 3px 0 rgba(15, 23, 42, 0.08)'
                                    const rowShadowHover = theme === 'dark'
                                        ? '0 4px 12px -2px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(82, 82, 91, 0.5)'
                                        : '0 4px 10px -8px rgba(15, 23, 42, 0.25)'

                                    return (
                                        <div
                                            key={member.email || member.user_id}
                                            className="group flex items-center gap-4 p-5 border-0 shadow-sm transition-colors duration-150"
                                            style={{
                                                borderRadius: '1rem',
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

                <TabsContent value="billing" className="tab-content space-y-4">
                    {usageStats.usageLimitReached && (
                        <div
                            className="flex gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm"
                            role="alert"
                        >
                            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                            <div className="space-y-1">
                                <p className="font-medium text-foreground">
                                    Limite de atendimentos atingido
                                </p>
                                <p className="text-muted-foreground">
                                    Você atingiu {usageStats.conversationsUsed}/
                                    {usageStats.conversationsLimit} atendimentos neste mês. Atualize seu plano
                                    para continuar recebendo novos atendimentos ou entre em contato conosco
                                    para uma possível recarga.
                                </p>
                            </div>
                        </div>
                    )}
                    {/* Botão de Export CSV - Sempre visível */}
                    <Card 
                        className="border-0 rounded-[1.5rem] shadow-lg shadow-blue-900/5 transition-shadow duration-150"
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
                        <Card 
                            className="border-0 rounded-[1.5rem] shadow-lg shadow-blue-900/5 transition-shadow duration-150 overflow-hidden"
                            style={{ backgroundColor: theme === 'dark' ? '#18181b' : '#F8FAFC' }}
                        >
                            <div className="h-1 w-full bg-gradient-to-r from-cyan-500 via-emerald-500 to-cyan-400" />
                            <CardHeader>
                                <CardTitle style={{ color: theme === 'dark' ? '#e2e8f0' : '#1e293b' }}>{t('billing.current.title')}</CardTitle>
                                <CardDescription style={{ color: theme === 'dark' ? '#cbd5e1' : '#475569' }}>{t('billing.current.description')}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex flex-col gap-4 rounded-xl border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex items-start gap-4">
                                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                                            <Check className="h-6 w-6 text-emerald-600" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-lg font-semibold">{currentPlanLabel}</p>
                                            <p className="text-sm text-muted-foreground">
                                                Status: {hasActiveSubscription ? 'Ativa' : 'Inativa / gratuita'}
                                            </p>
                                            {subscription.current_period_end && hasActiveSubscription && (
                                                <p className="text-sm text-muted-foreground">
                                                    Renova em: {new Date(subscription.current_period_end).toLocaleDateString(i18n.language || 'pt-BR')}
                                                </p>
                                            )}
                                            {!loadingUsage && (
                                                <p className="text-sm text-muted-foreground">
                                                    Uso: {usageStats.conversationsUsed}/{usageStats.conversationsLimit ?? '∞'} atendimentos · {usageStats.agentsUsed}/{usageStats.agentsLimit ?? '∞'} agentes
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    {hasActiveSubscription && subscription.has_stripe_subscription && (
                                        <Button variant="outline" onClick={handlePortal} disabled={saving} className="shrink-0">
                                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('billing.current.manage')}
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card 
                            className="border-0 rounded-[1.5rem] shadow-lg shadow-blue-900/5 transition-shadow duration-150"
                            style={{ backgroundColor: theme === 'dark' ? '#18181b' : '#F8FAFC' }}
                        >
                            <CardHeader className="space-y-4">
                                <div className="space-y-1">
                                    <CardTitle style={{ color: theme === 'dark' ? '#e2e8f0' : '#1e293b' }}>{billingCopy.plansTitle}</CardTitle>
                                    <CardDescription style={{ color: theme === 'dark' ? '#cbd5e1' : '#475569' }}>{billingCopy.plansDescription}</CardDescription>
                                </div>
                                <div className="flex justify-center">
                                    <div
                                        className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em]"
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
                                <BillingPlansSection
                                    theme={theme}
                                    catalogPlan={normalizedSubscriptionPlan}
                                    subscriptionStatus={subscription.status || 'inactive'}
                                    checkoutPlanId={checkoutPlanId}
                                    usageStats={usageStats}
                                    loadingUsage={loadingUsage}
                                    onUpgrade={handleUpgrade}
                                    labels={{
                                        recLineTitle: billingCopy.recLineTitle,
                                        recLineDescription: billingCopy.recLineDescription,
                                        comLineTitle: billingCopy.comLineTitle,
                                        comLineDescription: billingCopy.comLineDescription,
                                        conversations: billingCopy.conversations,
                                        agents: billingCopy.agents,
                                        unlimited: billingCopy.unlimited,
                                        acquired: billingCopy.acquired,
                                        subscribe: billingCopy.subscribe,
                                        popular: billingCopy.plusPlanBadge,
                                        usageLimitReached: billingCopy.usageLimitReached,
                                        perMonth: billingCopy.perMonth,
                                        contactSales: billingCopy.contactSales,
                                        currentPlanBadge: billingCopy.currentPlanBadge,
                                    }}
                                />
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
