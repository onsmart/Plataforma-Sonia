import { useEffect, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Badge } from "../components/ui/badge"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"
import { 
    Webhook, 
    Users, 
    Mail, 
    Plus, 
    MoreVertical, 
    Trash2,
    Loader2,
    Building2,
    AlertCircle
} from "lucide-react"
import { Settings } from "./Settings"
import { Integrations } from "../components/configuration/Integrations"
import { AgentService } from "../services/api"
import { toast } from "sonner@2.0.3"
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

function NotificationPreferences() {
    const [prefs, setPrefs] = useState({
        billing: true,
        security: true,
        iot: true,
        system: false
    })

    const toggle = (key: keyof typeof prefs) => {
        setPrefs(prev => ({ ...prev, [key]: !prev[key] }))
        toast.success("Preferences saved")
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Control which events trigger system alerts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label>Billing Alerts</Label>
                        <p className="text-sm text-muted-foreground">Receive alerts for failed payments and subscription changes.</p>
                    </div>
                    <Switch checked={prefs.billing} onCheckedChange={() => toggle('billing')} />
                </div>
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label>Security Incidents</Label>
                        <p className="text-sm text-muted-foreground">Alerts for DLP violations, competitor mentions, and login attempts.</p>
                    </div>
                    <Switch checked={prefs.security} onCheckedChange={() => toggle('security')} />
                </div>
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label>IoT Critical Failures</Label>
                        <p className="text-sm text-muted-foreground">Immediate notification when devices go offline or report errors.</p>
                    </div>
                    <Switch checked={prefs.iot} onCheckedChange={() => toggle('iot')} />
                </div>
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label>System Updates</Label>
                        <p className="text-sm text-muted-foreground">Changelogs and maintenance windows.</p>
                    </div>
                    <Switch checked={prefs.system} onCheckedChange={() => toggle('system')} />
                </div>
            </CardContent>
        </Card>
    )
}

function Team() {
    const { hasCompany, refreshCompany } = useAuth()
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
            toast.error(e.message || "Erro ao carregar membros do time")
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
                toast.success(result.message || `Membro ${email} adicionado ao time`)
                setEmail("")
                loadTeam()
            } else {
                throw new Error(result?.message || "Falha ao adicionar membro")
            }
        } catch (e: any) {
            toast.error(e.message || "Erro ao adicionar membro. Verifique se o usuário está cadastrado na plataforma.")
        } finally {
            setInviting(false)
        }
    }

    const handleRemove = async (email: string) => {
        if (!confirm(`Remover ${email} do time?`)) return
        try {
            await AgentService.removeMember(email)
            toast.success("Membro removido com sucesso")
            loadTeam()
        } catch (e: any) {
            toast.error(e.message || "Erro ao remover membro")
        }
    }

    const handleUpdatePermission = async (email: string, oldPermissionKey: string, newPermissionKey: string) => {
        try {
            const result = await AgentService.updateMemberPermission(email, oldPermissionKey, newPermissionKey)
            if (result?.success) {
                toast.success("Permissão atualizada com sucesso")
                loadTeam()
            }
        } catch (e: any) {
            toast.error(e.message || "Erro ao atualizar permissão")
        }
    }

    const handleCreateCompany = async () => {
        if (!companyName.trim()) {
            toast.error("Nome da empresa é obrigatório")
            return
        }
        
        setCreatingCompany(true)
        try {
            const result = await AgentService.createCompany(companyName.trim())
            if (result?.success) {
                toast.success(result.message || "Empresa criada com sucesso!")
                setCompanyName("")
                // Atualizar companiesId no contexto
                await refreshCompany()
                // Recarregar team
                loadTeam()
            } else {
                throw new Error(result?.message || "Falha ao criar empresa")
            }
        } catch (e: any) {
            toast.error(e.message || "Erro ao criar empresa")
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
                    <AlertTitle className="text-yellow-800 dark:text-yellow-200">Empresa não configurada</AlertTitle>
                    <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                        Você precisa criar uma empresa para acessar o sistema. Preencha o formulário abaixo para começar.
                    </AlertDescription>
                </Alert>
                
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Building2 className="h-5 w-5" />
                            Criar Empresa
                        </CardTitle>
                        <CardDescription>
                            Crie sua empresa para começar a usar a plataforma
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <Label htmlFor="company-name">Nome da Empresa</Label>
                            <Input
                                id="company-name"
                                placeholder="Minha Empresa LTDA"
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
                                    Criando...
                                </>
                            ) : (
                                <>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Criar Empresa
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
                        <CardTitle>Team Members</CardTitle>
                        <CardDescription>Manage who has access to this workspace.</CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-4 items-end mb-6 p-4 bg-muted/30 rounded-lg border">
                        <div className="grid gap-2 flex-1">
                            <Label htmlFor="email">Email Address</Label>
                            <div className="relative">
                                <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    id="email" 
                                    placeholder="colleague@company.com" 
                                    className="pl-9"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="grid gap-2 w-[250px]">
                            <Label>Permissão</Label>
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
                            Invite
                        </Button>
                    </div>

                    <div className="space-y-4">
                        {loading ? (
                            <div className="text-center py-8 text-muted-foreground">Loading team...</div>
                        ) : members.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">No members found. Invite someone above.</div>
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
                                                        Sem permissões
                                                    </Badge>
                                                )}
                                            </div>
                                            {member.created_at && (
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Adicionado em {new Date(member.created_at).toLocaleDateString('pt-BR')}
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
                                                <DropdownMenuLabel>Alterar Permissão</DropdownMenuLabel>
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
                                                    Remover do Time
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
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Platform Configuration</h2>
                <p className="text-muted-foreground">Admin controls, team management, and developer settings.</p>
            </div>

            <Tabs defaultValue="general">
                <TabsList>
                    <TabsTrigger value="general">General & API</TabsTrigger>
                    <TabsTrigger value="integrations">Integrations</TabsTrigger>
                    <TabsTrigger value="team">Team & RBAC</TabsTrigger>
                    <TabsTrigger value="events">Events & Notifications</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="mt-4">
                    <Settings />
                </TabsContent>

                <TabsContent value="integrations" className="mt-4">
                    <Integrations />
                </TabsContent>

                <TabsContent value="team" className="mt-4">
                    <Team />
                </TabsContent>

                <TabsContent value="events" className="mt-4 space-y-4">
                    <NotificationPreferences />
                    
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Webhook Endpoints</CardTitle>
                                <CardDescription>Receive real-time events from your agents.</CardDescription>
                            </div>
                            <Button size="sm">
                                <Webhook className="mr-2 h-4 w-4" />
                                Add Endpoint
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between p-4 border rounded-lg">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold">Production Slack Bot</span>
                                        <Badge variant="outline" className="text-emerald-500 border-emerald-500/20">Active</Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground font-mono">https://hooks.slack.com/services/T000/B000/XXXX</p>
                                </div>
                                <Button variant="ghost" size="sm">Edit</Button>
                            </div>
                             <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold">Staging Logger</span>
                                        <Badge variant="secondary">Disabled</Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground font-mono">https://api.staging.internal/events</p>
                                </div>
                                <Button variant="ghost" size="sm">Edit</Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>System Notifications</CardTitle>
                            <CardDescription>Test the notification delivery system.</CardDescription>
                        </CardHeader>
                        <CardContent className="flex gap-4">
                            <Button variant="outline" onClick={async () => {
                                await AgentService.triggerTestNotification('info')
                                toast.success("Sent Info Notification")
                            }}>
                                Test Info
                            </Button>
                            <Button variant="outline" onClick={async () => {
                                await AgentService.triggerTestNotification('warning')
                                toast.success("Sent Warning Notification")
                            }}>
                                Test Warning
                            </Button>
                             <Button variant="outline" onClick={async () => {
                                await AgentService.triggerTestNotification('error')
                                toast.success("Sent Error Notification")
                            }}>
                                Test Error
                            </Button>
                             <Button variant="outline" onClick={async () => {
                                await AgentService.triggerTestNotification('success')
                                toast.success("Sent Success Notification")
                            }}>
                                Test Success
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
