import { useEffect, useState } from "react"
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
    Plug,
    Bell,
    CreditCard,
    Shield,
    AlertTriangle,
    Zap,
    Info,
    CheckCircle2,
    XCircle,
    Play
} from "lucide-react"
import { Settings } from "./Settings"
import { Integrations } from "../components/configuration/Integrations"
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

function NotificationPreferences() {
    const { theme } = useTheme()
    const [prefs, setPrefs] = useState({
        billing: true,
        security: true,
        system: false
    })

    const toggle = (key: keyof typeof prefs) => {
        setPrefs(prev => ({ ...prev, [key]: !prev[key] }))
        toast.success("Preferences saved")
    }

    const preferences = [
        {
            key: 'billing' as const,
            title: 'Billing Alerts',
            description: 'Receive alerts for failed payments and subscription changes.',
            icon: CreditCard,
            iconColor: '#d97706', // amarelo/dourado mais escuro
            iconBg: '#fef3c7', // amarelo pastel para o box do ícone
            cardBg: '#fef3c7' // amarelo pastel para billing
        },
        {
            key: 'security' as const,
            title: 'Security Incidents',
            description: 'Alerts for DLP violations, competitor mentions, and login attempts.',
            icon: Shield,
            iconColor: '#ef4444',
            iconBg: '#fee2e2',
            cardBg: '#fee2e2' // vermelho pastel para security
        },
        {
            key: 'system' as const,
            title: 'System Updates',
            description: 'Changelogs and maintenance windows.',
            icon: Bell,
            iconColor: '#6366f1',
            iconBg: '#e0e7ff',
            cardBg: '#e0f2fe' // azul/ciano pastel para system
        }
    ]

    return (
        <Card 
            className="border-none overflow-hidden"
            style={{ 
                borderRadius: '3rem',
                backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(6, 182, 212, 0.3), 0 0 20px rgba(6, 182, 212, 0.1)',
                border: '1px solid rgba(6, 182, 212, 0.2)'
            }}
        >
            <CardHeader>
                <CardTitle className="text-2xl font-black" style={{ color: theme === 'dark' ? '#e2e8f0' : '#0f172a' }}>Preferências de Notificação</CardTitle>
                <CardDescription style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b' }}>Controle quais eventos disparam alertas do sistema.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {preferences.map((pref) => {
                        const Icon = pref.icon
                        return (
                            <div
                                key={pref.key}
                                className="flex items-center justify-between p-6 hover:border-slate-200 transition-all"
                                style={{
                                    borderRadius: '2.5rem',
                                    border: '2px solid rgb(241, 245, 249)',
                                    backgroundColor: pref.cardBg,
                                    boxShadow: '0 2px 8px -2px rgba(0, 0, 0, 0.05), 0 1px 3px -1px rgba(0, 0, 0, 0.03)'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.boxShadow = '0 4px 12px -2px rgba(0, 0, 0, 0.08), 0 2px 4px -1px rgba(0, 0, 0, 0.04)'
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.boxShadow = '0 2px 8px -2px rgba(0, 0, 0, 0.05), 0 1px 3px -1px rgba(0, 0, 0, 0.03)'
                                }}
                            >
                                <div className="flex items-center gap-4 flex-1">
                                    <div 
                                        className="rounded-xl flex items-center justify-center shadow-sm"
                                        style={{ 
                                            backgroundColor: pref.iconBg, 
                                            width: '56px', 
                                            height: '56px' 
                                        }}
                                    >
                                        <Icon size={24} color={pref.iconColor} strokeWidth={2.5} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <Label className="text-base font-bold mb-1 block" style={{ color: theme === 'dark' ? '#0f172a' : '#0f172a' }}>{pref.title}</Label>
                                        <p className="text-xs leading-relaxed" style={{ color: theme === 'dark' ? '#1e293b' : '#475569' }}>{pref.description}</p>
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
    const { theme } = useTheme()
    const [activeTab, setActiveTab] = useState("general")
    const [settingsTab, setSettingsTab] = useState<string | undefined>(undefined)
    
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

    return (
        <div className="space-y-6 bg-[#F8FAFC] min-h-screen -m-4 p-8">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Platform Configuration</h2>
                <p className="text-muted-foreground">Admin controls, team management, and developer settings.</p>
            </div>

            <div className="flex gap-6">
                {/* Sidebar Lateral Fina */}
                <div className="w-20 flex-shrink-0">
                    <div className="flex flex-col gap-2 p-2 bg-muted/30 rounded-xl border">
                        <button
                            onClick={() => setActiveTab("general")}
                            className={`flex flex-col items-center gap-2 p-3 rounded-lg transition-all ${
                                activeTab === "general"
                                    ? "bg-slate-900 text-white shadow-lg"
                                    : "bg-transparent text-muted-foreground hover:bg-muted"
                            }`}
                        >
                            <SettingsIcon className="h-5 w-5" />
                            <span className="text-[10px] font-medium">General</span>
                        </button>
                        <button
                            onClick={() => setActiveTab("integrations")}
                            className={`flex flex-col items-center gap-2 p-3 rounded-lg transition-all ${
                                activeTab === "integrations"
                                    ? "bg-slate-900 text-white shadow-lg"
                                    : "bg-transparent text-muted-foreground hover:bg-muted"
                            }`}
                        >
                            <Plug className="h-5 w-5" />
                            <span className="text-[10px] font-medium">Integrations</span>
                        </button>
                        <button
                            onClick={() => setActiveTab("events")}
                            className={`flex flex-col items-center gap-2 p-3 rounded-lg transition-all ${
                                activeTab === "events"
                                    ? "bg-slate-900 text-white shadow-lg"
                                    : "bg-transparent text-muted-foreground hover:bg-muted"
                            }`}
                        >
                            <Bell className="h-5 w-5" />
                            <span className="text-[10px] font-medium">Events</span>
                        </button>
                    </div>
                </div>

                {/* Conteúdo Principal */}
                <div className="flex-1">
                    {activeTab === "general" && <Settings initialTab={settingsTab} />}
                    {activeTab === "integrations" && <Integrations />}
                    {activeTab === "events" && (
                        <div className="space-y-6 pb-24 animate-in fade-in duration-500 bg-[#F8FAFC] min-h-screen -m-4 p-8">
                            <NotificationPreferences />
                            
                            {/* SYSTEM NOTIFICATIONS CARD */}
                            <Card 
                                className="border-none overflow-hidden"
                                style={{ 
                                    borderRadius: '3rem',
                                    backgroundColor: theme === 'dark' ? '#0f172a' : '#F8FAFC',
                                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(6, 182, 212, 0.3), 0 0 20px rgba(6, 182, 212, 0.1)',
                                    border: '1px solid rgba(6, 182, 212, 0.2)'
                                }}
                            >
                                <CardHeader>
                                    <CardTitle className="text-2xl font-black" style={{ color: theme === 'dark' ? '#e2e8f0' : '#0f172a' }}>Playground de Notificações</CardTitle>
                                    <CardDescription style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b' }}>Teste o sistema de entrega de notificações.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex flex-wrap gap-4">
                                        <Button 
                                            onClick={async () => {
                                                await AgentService.triggerTestNotification('info')
                                                toast.info("Notificação Info enviada!", {
                                                    description: "Verifique o centro de notificações"
                                                })
                                            }}
                                            className="px-6 h-12 font-black uppercase text-[10px] tracking-widest transition-all"
                                            style={{ 
                                                backgroundColor: '#bfdbfe', // azul pastel
                                                color: '#1e40af', // azul escuro para contraste
                                                border: 'none',
                                                borderRadius: '2.5rem',
                                                boxShadow: '0 2px 8px -2px rgba(59, 130, 246, 0.2), 0 1px 3px -1px rgba(59, 130, 246, 0.15)'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.backgroundColor = '#93c5fd'
                                                e.currentTarget.style.boxShadow = '0 4px 12px -2px rgba(59, 130, 246, 0.3), 0 2px 4px -1px rgba(59, 130, 246, 0.2)'
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = '#bfdbfe'
                                                e.currentTarget.style.boxShadow = '0 2px 8px -2px rgba(59, 130, 246, 0.2), 0 1px 3px -1px rgba(59, 130, 246, 0.15)'
                                            }}
                                        >
                                            <Info className="mr-2 h-4 w-4" style={{ color: '#1e40af' }} />
                                            Test Info
                                        </Button>
                                        
                                        <Button 
                                            onClick={async () => {
                                                await AgentService.triggerTestNotification('warning')
                                                toast.warning("Notificação Warning enviada!", {
                                                    description: "Verifique o centro de notificações"
                                                })
                                            }}
                                            className="px-6 h-12 font-black uppercase text-[10px] tracking-widest transition-all"
                                            style={{ 
                                                backgroundColor: '#fde68a', // amarelo pastel
                                                color: '#92400e', // amarelo escuro para contraste
                                                border: 'none',
                                                borderRadius: '2.5rem',
                                                boxShadow: '0 2px 8px -2px rgba(245, 158, 11, 0.2), 0 1px 3px -1px rgba(245, 158, 11, 0.15)'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.backgroundColor = '#fcd34d'
                                                e.currentTarget.style.boxShadow = '0 4px 12px -2px rgba(245, 158, 11, 0.3), 0 2px 4px -1px rgba(245, 158, 11, 0.2)'
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = '#fde68a'
                                                e.currentTarget.style.boxShadow = '0 2px 8px -2px rgba(245, 158, 11, 0.2), 0 1px 3px -1px rgba(245, 158, 11, 0.15)'
                                            }}
                                        >
                                            <AlertTriangle className="mr-2 h-4 w-4" style={{ color: '#92400e' }} />
                                            Test Warning
                                        </Button>
                                        
                                        <Button 
                                            onClick={async () => {
                                                await AgentService.triggerTestNotification('error')
                                                toast.error("Notificação Error enviada!", {
                                                    description: "Verifique o centro de notificações"
                                                })
                                            }}
                                            className="px-6 h-12 font-black uppercase text-[10px] tracking-widest transition-all"
                                            style={{ 
                                                backgroundColor: '#fca5a5', // vermelho pastel
                                                color: '#991b1b', // vermelho escuro para contraste
                                                border: 'none',
                                                borderRadius: '2.5rem',
                                                boxShadow: '0 2px 8px -2px rgba(239, 68, 68, 0.2), 0 1px 3px -1px rgba(239, 68, 68, 0.15)'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.backgroundColor = '#f87171'
                                                e.currentTarget.style.boxShadow = '0 4px 12px -2px rgba(239, 68, 68, 0.3), 0 2px 4px -1px rgba(239, 68, 68, 0.2)'
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = '#fca5a5'
                                                e.currentTarget.style.boxShadow = '0 2px 8px -2px rgba(239, 68, 68, 0.2), 0 1px 3px -1px rgba(239, 68, 68, 0.15)'
                                            }}
                                        >
                                            <XCircle className="mr-2 h-4 w-4" style={{ color: '#991b1b' }} />
                                            Test Error
                                        </Button>
                                        
                                        <Button 
                                            onClick={async () => {
                                                await AgentService.triggerTestNotification('success')
                                                toast.success("Notificação Success enviada!", {
                                                    description: "Verifique o centro de notificações"
                                                })
                                            }}
                                            className="px-6 h-12 font-black uppercase text-[10px] tracking-widest transition-all"
                                            style={{ 
                                                backgroundColor: '#86efac', // verde pastel
                                                color: '#065f46', // verde escuro para contraste
                                                border: 'none',
                                                borderRadius: '2.5rem',
                                                boxShadow: '0 2px 8px -2px rgba(16, 185, 129, 0.2), 0 1px 3px -1px rgba(16, 185, 129, 0.15)'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.backgroundColor = '#4ade80'
                                                e.currentTarget.style.boxShadow = '0 4px 12px -2px rgba(16, 185, 129, 0.3), 0 2px 4px -1px rgba(16, 185, 129, 0.2)'
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = '#86efac'
                                                e.currentTarget.style.boxShadow = '0 2px 8px -2px rgba(16, 185, 129, 0.2), 0 1px 3px -1px rgba(16, 185, 129, 0.15)'
                                            }}
                                        >
                                            <CheckCircle2 className="mr-2 h-4 w-4" style={{ color: '#065f46' }} />
                                            Test Success
                                        </Button>
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
