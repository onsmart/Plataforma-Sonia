import { useEffect, useState } from "react"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "../components/ui/card"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Switch } from "../components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs"
import { Separator } from "../components/ui/separator"
import { Badge } from "../components/ui/badge"
import { Slider } from "../components/ui/slider"
import { Download, Shield, Save, Loader2, Key, Users, Mail, Trash2, CreditCard, Check } from "lucide-react"
import { toast } from "sonner@2.0.3"
import { AgentService, GovernanceConfig } from "../services/api"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"

export function Settings() {
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [govConfig, setGovConfig] = useState<GovernanceConfig | null>(null)
    const [team, setTeam] = useState<any[]>([])
    const [inviteEmail, setInviteEmail] = useState("")
    const [inviteRole, setInviteRole] = useState("viewer")
    const [subscription, setSubscription] = useState<any>({ plan: 'free', status: 'inactive' })
    
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
    }, [])

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
        } catch (e) {
            toast.error(e.message || "Billing portal unavailable. Try refreshing.")
        } finally {
            setSaving(false)
        }
    }

    // --- TEAM HANDLERS ---
    const handleInvite = async () => {
        if (!inviteEmail) return
        try {
            await AgentService.inviteMember(inviteEmail, inviteRole)
            toast.success(`Invited ${inviteEmail}`)
            setInviteEmail("")
            const members = await AgentService.getTeam()
            setTeam(members)
        } catch (e) {
            toast.error("Failed to invite member")
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
            await AgentService.updateApiKeys(apiKeys)
            toast.success("API Keys updated securely")
            // Reload to get masked versions back
            const keys = await AgentService.getApiKeys()
            setApiKeys(keys)
        } catch (e) {
            toast.error("Failed to update API Keys")
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div>
                <h3 className="text-lg font-medium">Settings</h3>
                <p className="text-sm text-muted-foreground">
                    Manage workspace preferences, security policies, and billing.
                </p>
            </div>
            <Separator />
            <Tabs defaultValue="governance" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="governance" className="gap-2">
                         <Shield className="h-3.5 w-3.5" /> Governance
                    </TabsTrigger>
                    <TabsTrigger value="team" className="gap-2">
                        <Users className="h-3.5 w-3.5" /> Team
                    </TabsTrigger>
                    <TabsTrigger value="general">General</TabsTrigger>
                    <TabsTrigger value="api">API Keys</TabsTrigger>
                    <TabsTrigger value="billing">Billing</TabsTrigger>
                </TabsList>
                
                <TabsContent value="governance" className="space-y-4">
                    {loading ? (
                         <div className="flex h-40 items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : govConfig ? (
                        <>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Content Filters & Guardrails</CardTitle>
                                    <CardDescription>
                                        Control what your agents can discuss and generate.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="flex items-center justify-between space-x-2">
                                        <div className="space-y-0.5">
                                            <Label className="text-base">Competitor Blocking</Label>
                                            <p className="text-sm text-muted-foreground">
                                                Prevent agents from discussing rival companies or services.
                                            </p>
                                        </div>
                                        <Switch 
                                            checked={govConfig.filters.competitorBlocking}
                                            onCheckedChange={(c) => updateGovFilter('competitorBlocking', c)}
                                        />
                                    </div>
                                    <Separator />
                                    <div className="flex items-center justify-between space-x-2">
                                        <div className="space-y-0.5">
                                            <Label className="text-base">Anti-Hallucination Mode</Label>
                                            <p className="text-sm text-muted-foreground">
                                                Strictly limit answers to the Knowledge Base context only.
                                            </p>
                                        </div>
                                        <Switch 
                                            checked={govConfig.filters.antiHallucination}
                                            onCheckedChange={(c) => updateGovFilter('antiHallucination', c)}
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Data Loss Prevention (DLP)</CardTitle>
                                    <CardDescription>
                                        Automatically redact sensitive information from chat logs.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="grid gap-6 md:grid-cols-2">
                                    <div className="flex items-center justify-between space-x-2 border p-3 rounded-lg">
                                        <Label htmlFor="dlp-cc" className="flex flex-col space-y-1">
                                            <span>Credit Cards</span>
                                            <span className="font-normal text-xs text-muted-foreground">Redact 16-digit numbers.</span>
                                        </Label>
                                        <Switch 
                                            id="dlp-cc" 
                                            checked={govConfig.dlp.creditCard}
                                            onCheckedChange={(c) => updateGovDLP('creditCard', c)}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between space-x-2 border p-3 rounded-lg">
                                        <Label htmlFor="dlp-email" className="flex flex-col space-y-1">
                                            <span>Email Addresses</span>
                                            <span className="font-normal text-xs text-muted-foreground">Redact email patterns.</span>
                                        </Label>
                                        <Switch 
                                            id="dlp-email"
                                            checked={govConfig.dlp.email}
                                            onCheckedChange={(c) => updateGovDLP('email', c)}
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
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

                <TabsContent value="team" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Team Members</CardTitle>
                            <CardDescription>
                                Invite colleagues to manage agents and view analytics.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex gap-4 mb-6 items-end">
                                <div className="space-y-2 flex-1">
                                    <Label>Email Address</Label>
                                    <Input 
                                        placeholder="colleague@company.com" 
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2 w-[180px]">
                                    <Label>Role</Label>
                                    <Select value={inviteRole} onValueChange={setInviteRole}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="admin">Admin</SelectItem>
                                            <SelectItem value="editor">Editor</SelectItem>
                                            <SelectItem value="viewer">Viewer</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button onClick={handleInvite} disabled={!inviteEmail}>
                                    <Mail className="mr-2 h-4 w-4" /> Invite
                                </Button>
                            </div>

                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>User</TableHead>
                                            <TableHead>Role</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Joined</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {team.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                                    No team members found. Invite someone above.
                                                </TableCell>
                                            </TableRow>
                                        ) : team.map((member) => (
                                            <TableRow key={member.email}>
                                                <TableCell className="font-medium">{member.email}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="capitalize">
                                                        {member.role}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">
                                                        {member.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-sm">
                                                    {member.invitedAt ? new Date(member.invitedAt).toLocaleDateString() : 'N/A'}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                        onClick={() => handleRemoveMember(member.email)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="general" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Workspace Details</CardTitle>
                            <CardDescription>
                                This is how your organization will appear to team members.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1">
                                <Label htmlFor="name">Workspace Name</Label>
                                <Input 
                                    id="name" 
                                    value={generalConfig.workspaceName} 
                                    onChange={(e) => setGeneralConfig(prev => ({ ...prev, workspaceName: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="url">Custom Domain</Label>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground">https://</span>
                                    <Input 
                                        id="url" 
                                        value={generalConfig.customDomain} 
                                        onChange={(e) => setGeneralConfig(prev => ({ ...prev, customDomain: e.target.value }))}
                                    />
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button onClick={handleSaveGeneral} disabled={saving}>
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Changes
                            </Button>
                        </CardFooter>
                    </Card>
                </TabsContent>
                
                <TabsContent value="api" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>API Configuration</CardTitle>
                            <CardDescription>
                                Manage access to LLM providers. Keys are stored securely and masked.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="openai">OpenAI API Key</Label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Key className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input 
                                            id="openai" 
                                            type="password" 
                                            value={apiKeys.openai} 
                                            className="pl-9"
                                            placeholder="sk-..."
                                            onChange={(e) => setApiKeys(prev => ({ ...prev, openai: e.target.value }))}
                                        />
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground">Used for GPT-4o and Embeddings.</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="anthropic">Anthropic API Key</Label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Key className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input 
                                            id="anthropic" 
                                            type="password" 
                                            value={apiKeys.anthropic} 
                                            className="pl-9"
                                            placeholder="sk-ant-..."
                                            onChange={(e) => setApiKeys(prev => ({ ...prev, anthropic: e.target.value }))}
                                        />
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground">Used for Claude models.</p>
                            </div>
                        </CardContent>
                        <CardFooter className="border-t px-6 py-4 bg-muted/10">
                             <Button onClick={handleSaveApiKeys} disabled={saving}>
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Update Keys
                             </Button>
                        </CardFooter>
                    </Card>
                </TabsContent>

                <TabsContent value="billing" className="space-y-4">
                    {/* Only show management portal if we have a valid stripeId (paid plan) */}
                    {subscription.status === 'active' && subscription.plan !== 'free' && subscription.stripeId ? (
                        <Card>
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
                        <div className="grid gap-6 md:grid-cols-3">
                            <Card className="flex flex-col">
                                <CardHeader>
                                    <CardTitle>Starter</CardTitle>
                                    <CardDescription>For individuals</CardDescription>
                                </CardHeader>
                                <CardContent className="flex-1">
                                    <div className="text-3xl font-bold mb-4">$0 <span className="text-sm font-normal text-muted-foreground">/mo</span></div>
                                    <ul className="space-y-2 text-sm text-muted-foreground">
                                        <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> 1 Agent</li>
                                        <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> 50 msgs/mo</li>
                                        <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Community Support</li>
                                    </ul>
                                </CardContent>
                                <CardFooter>
                                    <Button className="w-full" variant="outline" disabled>Current Plan</Button>
                                </CardFooter>
                            </Card>
                            
                            <Card className="flex flex-col border-primary shadow-md relative overflow-hidden">
                                <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-bl">Popular</div>
                                <CardHeader>
                                    <CardTitle>Pro</CardTitle>
                                    <CardDescription>For growing teams</CardDescription>
                                </CardHeader>
                                <CardContent className="flex-1">
                                    <div className="text-3xl font-bold mb-4">$49 <span className="text-sm font-normal text-muted-foreground">/mo</span></div>
                                    <ul className="space-y-2 text-sm text-muted-foreground">
                                        <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> 5 Agents</li>
                                        <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Unlimited Messages</li>
                                        <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> RAG Knowledge Base</li>
                                    </ul>
                                </CardContent>
                                <CardFooter>
                                    <Button className="w-full" onClick={() => handleUpgrade('price_pro_monthly')} disabled={saving}>
                                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Upgrade to Pro"}
                                    </Button>
                                </CardFooter>
                            </Card>

                            <Card className="flex flex-col">
                                <CardHeader>
                                    <CardTitle>Enterprise</CardTitle>
                                    <CardDescription>For organizations</CardDescription>
                                </CardHeader>
                                <CardContent className="flex-1">
                                    <div className="text-3xl font-bold mb-4">$499 <span className="text-sm font-normal text-muted-foreground">/mo</span></div>
                                    <ul className="space-y-2 text-sm text-muted-foreground">
                                        <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Unlimited Agents</li>
                                        <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> SSO & Governance</li>
                                        <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Dedicated Support</li>
                                    </ul>
                                </CardContent>
                                <CardFooter>
                                    <Button className="w-full" variant="outline" onClick={() => handleUpgrade('price_ent_monthly')} disabled={saving}>
                                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Contact Sales"}
                                    </Button>
                                </CardFooter>
                            </Card>
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    )
}
