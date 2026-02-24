
import { useEffect, useState, useCallback } from "react"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "../components/ui/card"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Switch } from "../components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs"
import { Separator } from "../components/ui/separator"
import { Badge } from "../components/ui/badge"
import { Slider } from "../components/ui/slider"
import { Download, Shield, Save, Loader2, Key, Users, Mail, Trash2, CreditCard, Check, Ban, Brain, Lock, Send, Plus, Eye, EyeOff, Zap, Sparkles, Bot, MessageSquare, Database } from "lucide-react"
import { toast } from "sonner"
import { AgentService, GovernanceConfig } from "../services/api"
import { supabase } from "../utils/supabase/client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { Avatar, AvatarFallback } from "../components/ui/avatar"

export function Settings() {
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [govConfig, setGovConfig] = useState<GovernanceConfig | null>(null)
    const [team, setTeam] = useState<any[]>([])
    const [inviteEmail, setInviteEmail] = useState("")
    const [permissions, setPermissions] = useState<any[]>([])
    const [permissionKey, setPermissionKey] = useState("basic.read")
    const [subscription, setSubscription] = useState<any>({ plan: 'free', status: 'inactive' })
    const [activeTab, setActiveTab] = useState("governance")
    const [showOpenAIKey, setShowOpenAIKey] = useState(false)
    const [showAnthropicKey, setShowAnthropicKey] = useState(false)
    const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly')
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
            toast.error("Failed to load settings")
        } finally {
            setLoading(false)
        }
    }

    // --- BILLING HANDLERS ---
    const handleUpgrade = async (priceId: string) => {
        setSaving(true)
        try {
            const { url } = await AgentService.createCheckoutSession(priceId)
            if (url) window.location.href = url
        } catch (e) {
            toast.error("Checkout failed. Please try again.")
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
            toast.error(e.message || "Billing portal unavailable. Try refreshing.")
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
                toast.success(result.message || `Membro ${inviteEmail} adicionado ao time`)
                setInviteEmail("")
                const members = await AgentService.getTeam()
                setTeam(members)
            } else {
                throw new Error(result?.message || "Falha ao adicionar membro")
            }
        } catch (e: any) {
            toast.error(e.message || "Erro ao adicionar membro. Verifique se o usuário está cadastrado na plataforma.")
        }
    }

    const handleRemoveMember = async (email: string) => {
        try {
            await AgentService.removeMember(email)
            toast.success("Member removed")
            setTeam(team.filter(m => m.email !== email))
        } catch (e) {
            toast.error("Failed to remove member")
        }
    }

    // --- GOVERNANCE HANDLERS ---
    const handleSaveGovernance = async () => {
        if (!govConfig) return
        setSaving(true)
        try {
            await AgentService.updateGovernanceConfig(govConfig)
            toast.success("Governance policies updated")
        } catch (e) {
            toast.error("Failed to save policies")
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
            toast.success("Workspace settings saved")
        } catch (e) {
            toast.error("Failed to save settings")
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
                toast.info("No API keys to update")
                return
            }

            const results = await Promise.all(calls)

            const rpcError = results.find(r => r.error)?.error
            if (rpcError) {
                throw rpcError
            }

            toast.success("API keys updated successfully")

            // Reload masked keys
            const keys = await AgentService.getApiKeys()
            if (keys) setApiKeys(keys)

        } catch (err: any) {
            console.error("[handleSaveApiKeys]", err)
            toast.error(err?.message ?? "Failed to update API keys")
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
        <div className="space-y-6 animate-in fade-in duration-500 bg-[#F8FAFC] min-h-screen -m-4 p-8">
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
                        value="governance" 
                        className="tab-trigger px-4 py-2 rounded-full text-sm font-medium data-[state=active]:text-white data-[state=inactive]:bg-slate-100 data-[state=inactive]:text-slate-600 hover:data-[state=inactive]:bg-slate-200"
                    >
                        <Shield className="tab-icon h-3.5 w-3.5 inline mr-2" /> Governança
                    </TabsTrigger>
                    <TabsTrigger 
                        value="team" 
                        className="tab-trigger px-4 py-2 rounded-full text-sm font-medium data-[state=active]:text-white data-[state=inactive]:bg-slate-100 data-[state=inactive]:text-slate-600 hover:data-[state=inactive]:bg-slate-200"
                    >
                        <Users className="tab-icon h-3.5 w-3.5 inline mr-2" /> Time
                    </TabsTrigger>
                    <TabsTrigger 
                        value="api" 
                        className="tab-trigger px-4 py-2 rounded-full text-sm font-medium data-[state=active]:text-white data-[state=inactive]:bg-slate-100 data-[state=inactive]:text-slate-600 hover:data-[state=inactive]:bg-slate-200"
                    >
                        <Key className="tab-icon h-3.5 w-3.5 inline mr-2" /> API Keys
                    </TabsTrigger>
                    <TabsTrigger 
                        value="billing" 
                        className="tab-trigger px-4 py-2 rounded-full text-sm font-medium data-[state=active]:text-white data-[state=inactive]:bg-slate-100 data-[state=inactive]:text-slate-600 hover:data-[state=inactive]:bg-slate-200"
                    >
                        <CreditCard className="tab-icon h-3.5 w-3.5 inline mr-2" /> Faturamento
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="governance" className="tab-content space-y-4">
                    {loading ? (
                        <div className="flex h-40 items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : govConfig ? (
                        <>
                            {/* Cards Modulares de Governança */}
                            <div className="space-y-4">
                                {/* Competitor Blocking Card */}
                                <Card className="border-0 rounded-[2.5rem] shadow-xl shadow-blue-900/5 hover:shadow-2xl hover:shadow-blue-900/10 transition-all bg-white">
                                    <CardContent className="p-6">
                                        <div className="flex items-center gap-6">
                                            {/* Ícone Grande Colorido (Laranja) - Box Pastel */}
                                            <div className="h-16 w-16 rounded-2xl flex items-center justify-center shrink-0 bg-orange-50">
                                                <Ban className="h-8 w-8 text-orange-600" strokeWidth={2.5} />
                                            </div>
                                            {/* Título e Descrição */}
                                            <div className="flex-1 min-w-0">
                                                <Label className="text-lg font-bold text-slate-900">Competitor Blocking</Label>
                                                <p className="text-sm text-slate-600 mt-1">
                                                    Prevent agents from discussing rival companies or services.
                                                </p>
                                            </div>
                                            {/* Switch */}
                                            <div className="shrink-0">
                                                <Switch
                                                    checked={govConfig.filters.competitorBlocking}
                                                    onCheckedChange={(c) => updateGovFilter('competitorBlocking', c)}
                                                />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Anti-Hallucination Card */}
                                <Card className="border-0 rounded-[2.5rem] shadow-xl shadow-blue-900/5 hover:shadow-2xl hover:shadow-blue-900/10 transition-all bg-white">
                                    <CardContent className="p-6">
                                        <div className="flex items-center gap-6">
                                            {/* Ícone Grande Colorido (Roxo) - Box Pastel */}
                                            <div className="h-16 w-16 rounded-2xl flex items-center justify-center shrink-0 bg-purple-50">
                                                <Brain className="h-8 w-8 text-purple-600" strokeWidth={2.5} />
                                            </div>
                                            {/* Título e Descrição */}
                                            <div className="flex-1 min-w-0">
                                                <Label className="text-lg font-bold text-slate-900">Anti-Hallucination Mode</Label>
                                                <p className="text-sm text-slate-600 mt-1">
                                                    Strictly limit answers to the Knowledge Base context only.
                                                </p>
                                            </div>
                                            {/* Switch */}
                                            <div className="shrink-0">
                                                <Switch
                                                    checked={govConfig.filters.antiHallucination}
                                                    onCheckedChange={(c) => updateGovFilter('antiHallucination', c)}
                                                />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            <Card className="border-0 rounded-[2.5rem] shadow-xl shadow-blue-900/5 hover:shadow-2xl hover:shadow-blue-900/10 transition-all bg-white">
                                <CardHeader>
                                    <CardTitle>Data Loss Prevention (DLP)</CardTitle>
                                    <CardDescription>
                                        Automatically redact sensitive information from chat logs.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {/* Grid de Mini-Cards DLP */}
                                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                        {/* Credit Card Mini-Card */}
                                        <div
                                            className={`p-4 rounded-[2rem] border-0 transition-all cursor-pointer ${
                                                govConfig.dlp.creditCard
                                                    ? 'bg-blue-50 shadow-lg shadow-blue-900/10'
                                                    : 'bg-white shadow-xl shadow-blue-900/5 hover:shadow-2xl hover:shadow-blue-900/10'
                                            }`}
                                            onClick={() => updateGovDLP('creditCard', !govConfig.dlp.creditCard)}
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <div
                                                    className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                                                        govConfig.dlp.creditCard
                                                            ? 'bg-blue-100'
                                                            : 'bg-slate-200'
                                                    }`}
                                                >
                                                    <CreditCard
                                                        className={`h-6 w-6 ${
                                                            govConfig.dlp.creditCard
                                                                ? 'text-blue-600'
                                                                : 'text-slate-400'
                                                        }`}
                                                        strokeWidth={2.5}
                                                    />
                                                </div>
                                                <Switch
                                                    checked={govConfig.dlp.creditCard}
                                                    onCheckedChange={(c) => updateGovDLP('creditCard', c)}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </div>
                                            <Label className="text-sm font-bold text-slate-900">Credit Cards</Label>
                                            <p className="text-xs text-slate-600 mt-1">Redact 16-digit numbers.</p>
                                        </div>

                                        {/* Email Addresses Mini-Card */}
                                        <div
                                            className={`p-4 rounded-[2rem] border-0 transition-all cursor-pointer ${
                                                govConfig.dlp.email
                                                    ? 'bg-emerald-50 shadow-lg shadow-emerald-900/10'
                                                    : 'bg-white shadow-xl shadow-blue-900/5 hover:shadow-2xl hover:shadow-blue-900/10'
                                            }`}
                                            onClick={() => updateGovDLP('email', !govConfig.dlp.email)}
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <div
                                                    className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                                                        govConfig.dlp.email
                                                            ? 'bg-emerald-100'
                                                            : 'bg-slate-200'
                                                    }`}
                                                >
                                                    <Mail
                                                        className={`h-6 w-6 ${
                                                            govConfig.dlp.email
                                                                ? 'text-emerald-600'
                                                                : 'text-slate-400'
                                                        }`}
                                                        strokeWidth={2.5}
                                                    />
                                                </div>
                                                <Switch
                                                    checked={govConfig.dlp.email}
                                                    onCheckedChange={(c) => updateGovDLP('email', c)}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </div>
                                            <Label className="text-sm font-bold text-slate-900">Email Addresses</Label>
                                            <p className="text-xs text-slate-600 mt-1">Redact email patterns.</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-0 rounded-[2.5rem] shadow-xl shadow-blue-900/5 hover:shadow-2xl hover:shadow-blue-900/10 transition-all bg-white">
                                <CardFooter className="flex justify-end gap-2 border-t px-6 py-4 bg-muted/10">
                                    <Button onClick={handleSaveGovernance} disabled={saving} className="gap-2">
                                        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                                        Save Policies
                                    </Button>
                                </CardFooter>
                            </Card>
                        </>
                    ) : (
                        <div className="text-center py-10">Failed to load configuration.</div>
                    )}
                </TabsContent>

                <TabsContent value="team" className="tab-content space-y-4">
                    <Card className="border-0 rounded-[2.5rem] shadow-xl shadow-blue-900/5 hover:shadow-2xl hover:shadow-blue-900/10 transition-all bg-white">
                        <CardHeader>
                            <CardTitle>Team Members</CardTitle>
                            <CardDescription>
                                Invite colleagues to manage agents and view analytics.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {/* Card de Convite com Fundo Azulado */}
                            <Card className="mb-6 border-0 bg-gradient-to-br from-blue-50 to-cyan-50/50 shadow-md">
                                <CardContent className="p-6">
                                    <div className="flex gap-4 items-end">
                                        <div className="space-y-2 flex-1">
                                            <Label className="text-sm font-semibold text-slate-700">Email Address</Label>
                                            <Input
                                                placeholder="colleague@company.com"
                                                value={inviteEmail}
                                                onChange={(e) => setInviteEmail(e.target.value)}
                                                className="bg-white border-blue-200 focus:border-blue-500"
                                            />
                                        </div>
                                        <div className="space-y-2 w-[250px]">
                                            <Label className="text-sm font-semibold text-slate-700">Permissão</Label>
                                            <Select value={permissionKey} onValueChange={setPermissionKey}>
                                                <SelectTrigger className="bg-white border-blue-200">
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
                                            className="px-6"
                                            style={{
                                                backgroundColor: '#2563eb',
                                                color: 'white',
                                                boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.3), 0 4px 6px -2px rgba(37, 99, 235, 0.2)'
                                            }}
                                            onMouseEnter={(e) => {
                                                if (!inviteEmail) return
                                                e.currentTarget.style.backgroundColor = '#1d4ed8'
                                            }}
                                            onMouseLeave={(e) => {
                                                if (!inviteEmail) return
                                                e.currentTarget.style.backgroundColor = '#2563eb'
                                            }}
                                        >
                                            <Send className="mr-2 h-4 w-4" /> Invite
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Linhas-Card (sem tabela) */}
                            <div className="space-y-3">
                                {team.length === 0 ? (
                                    <div className="h-24 flex items-center justify-center text-center text-muted-foreground rounded-xl bg-slate-50">
                                        No team members found. Invite someone above.
                                    </div>
                                ) : team.map((member) => {
                                    const initials = (member.name || member.email || 'U').substring(0, 2).toUpperCase()
                                    const isAdmin = member.permissions?.some((p: any) => p.name?.toLowerCase().includes('admin') || p.key?.includes('admin'))
                                    
                                    return (
                                        <div
                                            key={member.email || member.user_id}
                                            className="group flex items-center gap-4 p-5 rounded-2xl bg-white border-0 shadow-sm hover:shadow-md hover:bg-slate-50/50 transition-all duration-200"
                                        >
                                            {/* Avatar com Iniciais - Gradiente Azul Suave */}
                                            <Avatar className="h-12 w-12 shrink-0 ring-2 ring-blue-100">
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
                                                    <span className="font-semibold text-slate-900">{member.name || member.email}</span>
                                                </div>
                                                {member.name && (
                                                    <span className="text-xs text-slate-500">{member.email}</span>
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
                                                                    ? 'bg-slate-900 text-white font-black' 
                                                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                                            }`}
                                                        >
                                                            {perm.name}
                                                        </Badge>
                                                    ))
                                                ) : (
                                                    <Badge className="text-xs text-slate-400 bg-slate-50 border-slate-200 rounded-full">
                                                        Sem permissões
                                                    </Badge>
                                                )}
                                            </div>

                                            {/* Status Badge - Pílula Verde Pastel */}
                                            <Badge className="bg-emerald-50 text-emerald-700 font-semibold text-xs px-3 py-1.5 rounded-full shrink-0 border border-emerald-200/50 shadow-sm">
                                                Ativo
                                            </Badge>

                                            {/* Data de Entrada */}
                                            <div className="text-xs text-slate-400 shrink-0 w-24 text-right">
                                                {member.created_at ? new Date(member.created_at).toLocaleDateString('pt-BR') : 'N/A'}
                                            </div>

                                            {/* Botão de Remover */}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-9 w-9 text-slate-400 hover:text-destructive hover:bg-red-50 shrink-0"
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
                        <Card className="border-0 rounded-[2.5rem] shadow-xl shadow-blue-900/5 hover:shadow-2xl hover:shadow-blue-900/10 transition-all bg-white">
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
                                            <Label htmlFor="openai" className="text-lg font-bold text-slate-900">OpenAI API Key</Label>
                                            <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs font-semibold px-2.5 py-1">
                                                GPT-4o + Embeddings
                                            </Badge>
                                        </div>
                                        
                                        <div className="relative">
                                            <Input
                                                id="openai"
                                                type={showOpenAIKey ? "text" : "password"}
                                                value={apiKeys.openai}
                                                className="pl-4 pr-20 bg-slate-50 border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                                                placeholder="sk-..."
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
                                        
                                        <p className="text-xs text-slate-500">Used for GPT-4o and Embeddings.</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Card Anthropic */}
                        <Card className="border-0 rounded-[2.5rem] shadow-xl shadow-blue-900/5 hover:shadow-2xl hover:shadow-blue-900/10 transition-all bg-white">
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
                                            <Label htmlFor="anthropic" className="text-lg font-bold text-slate-900">Anthropic API Key</Label>
                                            <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-xs font-semibold px-2.5 py-1">
                                                Claude Models
                                            </Badge>
                                        </div>
                                        
                                        <div className="relative">
                                            <Input
                                                id="anthropic"
                                                type={showAnthropicKey ? "text" : "password"}
                                                value={apiKeys.anthropic}
                                                className="pl-4 pr-20 bg-slate-50 border-slate-200 focus:border-purple-500 focus:ring-purple-500 rounded-xl"
                                                placeholder="sk-ant-..."
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
                                        
                                        <p className="text-xs text-slate-500">Used for Claude models.</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Botão de Salvar - Flutuante à Direita */}
                        <div className="flex justify-end">
                            <Button 
                                onClick={handleSaveApiKeys} 
                                disabled={saving}
                                className="rounded-2xl px-8 py-6 text-base font-semibold shadow-xl shadow-blue-500/40 hover:shadow-2xl hover:shadow-blue-500/50 transition-all"
                                style={{
                                    backgroundColor: '#2563eb',
                                    color: 'white'
                                }}
                                onMouseEnter={(e) => {
                                    if (!saving) {
                                        e.currentTarget.style.backgroundColor = '#1d4ed8'
                                        e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(37, 99, 235, 0.5), 0 10px 10px -5px rgba(37, 99, 235, 0.3)'
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!saving) {
                                        e.currentTarget.style.backgroundColor = '#2563eb'
                                        e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(37, 99, 235, 0.4), 0 4px 6px -2px rgba(37, 99, 235, 0.2)'
                                    }
                                }}
                            >
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Update Keys
                            </Button>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="billing" className="tab-content space-y-4">
                    {subscription.status === 'active' && subscription.plan !== 'free' && subscription.stripeId ? (
                        <Card className="border-0 rounded-[2.5rem] shadow-xl shadow-blue-900/5 hover:shadow-2xl hover:shadow-blue-900/10 transition-all bg-white">
                            <CardHeader>
                                <CardTitle>Current Subscription</CardTitle>
                                <CardDescription>Manage your plan and billing method.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between bg-muted/50 p-4 rounded-lg border">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                                            <Check className="h-5 w-5 text-emerald-600" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-medium capitalize">{subscription.plan || 'Pro'} Plan</p>
                                            <p className="text-sm text-muted-foreground">Active • Renews next month</p>
                                        </div>
                                    </div>
                                    <Button variant="outline" onClick={handlePortal} disabled={saving}>
                                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Manage Billing"}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-6">
                            {/* Seletor Mensal/Anual - Pílula Sólida */}
                            <Card className="border-0 rounded-[2.5rem] shadow-xl shadow-blue-900/5 bg-white">
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-center gap-3">
                                        <button
                                            onClick={() => setBillingPeriod('monthly')}
                                            className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 ${
                                                billingPeriod === 'monthly'
                                                    ? 'bg-slate-900 text-white shadow-lg'
                                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                        >
                                            Mensal
                                        </button>
                                        <button
                                            onClick={() => setBillingPeriod('yearly')}
                                            className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 relative ${
                                                billingPeriod === 'yearly'
                                                    ? 'bg-slate-900 text-white shadow-lg'
                                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                        >
                                            Anual
                                            <Badge 
                                                className="absolute -top-1 -right-1 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg"
                                                style={{
                                                    backgroundColor: '#10b981',
                                                    color: 'white'
                                                }}
                                            >
                                                20%
                                            </Badge>
                                        </button>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="grid gap-6 md:grid-cols-3">
                                {/* Card Starter */}
                                <Card className="flex flex-col border-0 rounded-[2.5rem] shadow-xl shadow-blue-900/5 hover:shadow-2xl hover:shadow-blue-900/10 transition-all bg-white relative">
                                    {/* Badge "ATIVO" no topo direito */}
                                    <div className="absolute top-4 right-4 z-10">
                                        <Badge 
                                            className="text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full"
                                            style={{
                                                backgroundColor: '#ecfdf5',
                                                color: '#10b981',
                                                border: '1px solid #a7f3d0'
                                            }}
                                        >
                                            Ativo
                                        </Badge>
                                    </div>
                                    <CardHeader>
                                        <div className="flex items-center justify-between">
                                            <CardTitle>Starter</CardTitle>
                                            <Badge variant="secondary" className="bg-muted text-muted-foreground border-none">Grátis</Badge>
                                        </div>
                                        <CardDescription>Para indivíduos e testes</CardDescription>
                                    </CardHeader>
                                    <CardContent className="flex-1">
                                        <div className="text-3xl font-bold mb-4 tracking-tight">$0 <span className="text-sm font-normal text-muted-foreground">/mês</span></div>
                                        
                                        {/* Barra de Progresso de Consumo */}
                                        <div className="mb-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-semibold text-slate-700">Mensagens</span>
                                                <span className="text-xs font-bold text-slate-900">{usageStats.messagesUsed}/{usageStats.messagesLimit}</span>
                                            </div>
                                            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-300"
                                                    style={{ width: `${(usageStats.messagesUsed / usageStats.messagesLimit) * 100}%` }}
                                                />
                                            </div>
                                        </div>

                                        <ul className="space-y-4 text-sm text-muted-foreground">
                                            <li className="flex items-center gap-3">
                                                <div className="h-5 w-5 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                                                    <Bot className="h-3.5 w-3.5 text-blue-600" strokeWidth={2.5} />
                                                </div>
                                                <span><span className="font-black text-slate-900">1</span> Agente</span>
                                            </li>
                                            <li className="flex items-center gap-3">
                                                <div className="h-5 w-5 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                                                    <MessageSquare className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2.5} />
                                                </div>
                                                <span><span className="font-black text-slate-900">50</span> mensagens/mês</span>
                                            </li>
                                            <li className="flex items-center gap-3">
                                                <div className="h-5 w-5 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                                                    <Check className="h-3.5 w-3.5 text-slate-600" strokeWidth={2.5} />
                                                </div>
                                                <span>Suporte Comunitário</span>
                                            </li>
                                        </ul>
                                    </CardContent>
                                </Card>

                                {/* Card Pro - Efeito Holofote */}
                                <Card 
                                    className="flex flex-col border-0 rounded-[2.5rem] relative overflow-visible transition-all bg-white"
                                    style={{
                                        transform: 'scale(1.05)',
                                        minHeight: 'calc(100% + 20px)',
                                        boxShadow: '0 25px 70px -15px rgba(37, 99, 235, 0.4), 0 0 0 1px rgba(59, 130, 246, 0.15)',
                                        background: 'linear-gradient(to bottom, rgba(59, 130, 246, 0.03), rgba(255, 255, 255, 1))'
                                    }}
                                >
                                    {/* Badge Popular Flutuante - Lado Direito */}
                                    <div className="absolute -top-4 right-4 z-10">
                                        <Badge 
                                            className="text-xs font-black uppercase tracking-widest px-5 py-2 rounded-full shadow-xl"
                                            style={{
                                                backgroundColor: 'rgba(37, 99, 235, 0.7)',
                                                color: 'white',
                                                border: 'none',
                                                boxShadow: '0 10px 25px -5px rgba(37, 99, 235, 0.3), 0 0 0 2px rgba(255, 255, 255, 0.8)'
                                            }}
                                        >
                                            Popular
                                        </Badge>
                                    </div>
                                    <CardHeader className="pt-8">
                                        <CardTitle>Pro</CardTitle>
                                        <CardDescription>Para times em crescimento</CardDescription>
                                    </CardHeader>
                                    <CardContent className="flex-1">
                                        <div className="text-4xl font-black mb-4 tracking-tight">
                                            <span 
                                                key={billingPeriod}
                                                className="inline-block animate-in fade-in duration-300"
                                            >
                                                ${billingPeriod === 'yearly' ? '39' : '49'} 
                                            </span>
                                            <span className="text-sm font-normal text-muted-foreground">/{billingPeriod === 'yearly' ? 'ano' : 'mês'}</span>
                                        </div>
                                        {billingPeriod === 'yearly' && (
                                            <p 
                                                key="economy-pro"
                                                className="text-xs text-emerald-600 font-semibold mb-4 animate-in fade-in duration-300"
                                            >
                                                Economize $120/ano
                                            </p>
                                        )}
                                        <ul className="space-y-4 text-sm text-muted-foreground">
                                            <li className="flex items-center gap-3 font-medium text-foreground">
                                                <div className="h-5 w-5 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                                                    <Bot className="h-3.5 w-3.5 text-blue-600" strokeWidth={2.5} />
                                                </div>
                                                <span><span className="font-black text-slate-900">5</span> Agentes</span>
                                            </li>
                                            <li className="flex items-center gap-3 font-medium text-foreground">
                                                <div className="h-5 w-5 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                                                    <MessageSquare className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2.5} />
                                                </div>
                                                <span><span className="font-black text-slate-900">Mensagens</span> Ilimitadas</span>
                                            </li>
                                            <li className="flex items-center gap-3 font-medium text-foreground">
                                                <div className="h-5 w-5 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                                                    <Brain className="h-3.5 w-3.5 text-purple-600" strokeWidth={2.5} />
                                                </div>
                                                <span><span className="font-black text-slate-900">RAG</span> Knowledge Base</span>
                                            </li>
                                            <li className="flex items-center gap-3 font-medium text-foreground">
                                                <div className="h-5 w-5 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                                                    <Check className="h-3.5 w-3.5 text-amber-600" strokeWidth={2.5} />
                                                </div>
                                                <span><span className="font-black text-slate-900">Prioridade</span> no Suporte</span>
                                            </li>
                                        </ul>
                                    </CardContent>
                                    <CardFooter>
                                        <Button 
                                            className="w-full h-11 font-bold uppercase tracking-tight text-[11px] shadow-xl shadow-blue-500/40 hover:shadow-2xl hover:shadow-blue-500/50 transition-all rounded-2xl" 
                                            onClick={() => handleUpgrade(billingPeriod === 'yearly' ? 'price_pro_yearly' : 'price_pro_monthly')} 
                                            disabled={saving}
                                            style={{
                                                backgroundColor: '#2563eb',
                                                color: 'white'
                                            }}
                                        >
                                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fazer Upgrade para Pro"}
                                        </Button>
                                    </CardFooter>
                                </Card>

                                {/* Card Enterprise */}
                                <Card className="flex flex-col border-0 rounded-[2.5rem] shadow-xl shadow-blue-900/5 hover:shadow-2xl hover:shadow-blue-900/10 transition-all bg-white">
                                    <CardHeader>
                                        <CardTitle>Enterprise</CardTitle>
                                        <CardDescription>Para organizações</CardDescription>
                                    </CardHeader>
                                    <CardContent className="flex-1">
                                        <div className="text-3xl font-bold mb-4 tracking-tight">
                                            <span 
                                                key={billingPeriod}
                                                className="inline-block animate-in fade-in duration-300"
                                            >
                                                ${billingPeriod === 'yearly' ? '399' : '499'} 
                                            </span>
                                            <span className="text-sm font-normal text-muted-foreground">/{billingPeriod === 'yearly' ? 'ano' : 'mês'}</span>
                                        </div>
                                        {billingPeriod === 'yearly' && (
                                            <p 
                                                key="economy-enterprise"
                                                className="text-xs text-emerald-600 font-semibold mb-4 animate-in fade-in duration-300"
                                            >
                                                Economize $1.200/ano
                                            </p>
                                        )}
                                        <ul className="space-y-4 text-sm text-muted-foreground">
                                            <li className="flex items-center gap-3">
                                                <div className="h-5 w-5 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                                                    <Bot className="h-3.5 w-3.5 text-blue-600" strokeWidth={2.5} />
                                                </div>
                                                <span><span className="font-black text-slate-900">Agentes</span> Ilimitados</span>
                                            </li>
                                            <li className="flex items-center gap-3">
                                                <div className="h-5 w-5 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                                                    <Shield className="h-3.5 w-3.5 text-slate-600" strokeWidth={2.5} />
                                                </div>
                                                <span><span className="font-black text-slate-900">SSO</span> & Governança</span>
                                            </li>
                                            <li className="flex items-center gap-3">
                                                <div className="h-5 w-5 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                                                    <Check className="h-3.5 w-3.5 text-amber-600" strokeWidth={2.5} />
                                                </div>
                                                <span><span className="font-black text-slate-900">Suporte</span> Dedicado (SLA)</span>
                                            </li>
                                            <li className="flex items-center gap-3">
                                                <div className="h-5 w-5 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                                                    <Database className="h-3.5 w-3.5 text-purple-600" strokeWidth={2.5} />
                                                </div>
                                                <span><span className="font-black text-slate-900">Custom</span> Deployment</span>
                                            </li>
                                        </ul>
                                    </CardContent>
                                    <CardFooter>
                                        <Button 
                                            className="w-full h-10 font-bold uppercase tracking-tight text-[11px] rounded-2xl" 
                                            variant="outline" 
                                            onClick={() => handleUpgrade(billingPeriod === 'yearly' ? 'price_ent_yearly' : 'price_ent_monthly')} 
                                            disabled={saving}
                                        >
                                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Contactar Vendas"}
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
