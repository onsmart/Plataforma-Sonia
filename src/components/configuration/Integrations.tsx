import React, { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Button } from "../ui/button"
import { toast } from "sonner"
import { Loader2, MessageCircle, Phone, Mail, Save, Server, ShieldCheck } from "lucide-react"
import { supabase } from "../../utils/supabase/client"
import { Separator } from "../ui/separator"

export function Integrations() {
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    
    const [twilioConfig, setTwilioConfig] = useState({
        accountSid: "",
        authToken: "",
        phoneNumber: ""
    })

    const [emailConfig, setEmailConfig] = useState({
        smtpHost: "",
        smtpPort: "",
        smtpUser: "",
        smtpPass: ""
    })

    useEffect(() => {
        loadConfig()
    }, [])

    const loadConfig = async () => {
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            
            if (!user || !user.email) return

            const { data, error } = await supabase.rpc('sp_get_api_keys_by_email', {
                p_email: user.email
            })

            if (error) throw error

            if (Array.isArray(data)) {
                const twilio: any = {}
                const email: any = {}
                
                data.forEach((item: any) => {
                    // Mapeamento Twilio
                    if (item.provider === 'twilio_sid') twilio.accountSid = item.api_key
                    if (item.provider === 'twilio_token') twilio.authToken = item.api_key
                    if (item.provider === 'twilio_phone') twilio.phoneNumber = item.api_key
                    
                    // Mapeamento Email
                    if (item.provider === 'email_host') email.smtpHost = item.api_key
                    if (item.provider === 'email_port') email.smtpPort = item.api_key
                    if (item.provider === 'email_user') email.smtpUser = item.api_key
                    if (item.provider === 'email_pass') email.smtpPass = item.api_key
                })
                
                setTwilioConfig({
                    accountSid: twilio.accountSid || "",
                    authToken: twilio.authToken || "",
                    phoneNumber: twilio.phoneNumber || ""
                })

                setEmailConfig({
                    smtpHost: email.smtpHost || "",
                    smtpPort: email.smtpPort || "",
                    smtpUser: email.smtpUser || "",
                    smtpPass: email.smtpPass || ""
                })
            }
        } catch (err) {
            console.error("Failed to load integrations config:", err)
        } finally {
            setLoading(false)
        }
    }

    const handleSaveAll = async () => {
        setSaving(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            
            if (!user || !user.email) {
                toast.error("Usuário não autenticado.")
                return
            }

            // Chamada unificada para sp_upsert_integration_by_email
            const { error } = await supabase.rpc('sp_upsert_integration_by_email', {
                p_user_email: user.email,
                
                // Twilio
                p_phone_number: twilioConfig.phoneNumber || null,
                p_account_sid: twilioConfig.accountSid || null,
                p_auth_token: twilioConfig.authToken || null,

                // Email SMTP
                p_email: emailConfig.smtpUser || null,
                p_smtp_host: emailConfig.smtpHost || null,
                p_smtp_port: emailConfig.smtpPort ? parseInt(emailConfig.smtpPort) : null,
                
                // App Key
                p_app_key: emailConfig.smtpPass || null
            })

            if (error) throw error

            toast.success("Todas as integrações foram salvas com sucesso!")
        } catch (error: any) {
            console.error("Erro ao salvar integrações:", error)
            toast.error(error.message || "Erro ao salvar integrações")
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
            </div>
        )
    }

    return (
        <div className="space-y-6 pb-24 relative animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">Integrações</h2>
                    <p className="text-slate-500">Configure canais de comunicação externa para seus agentes.</p>
                </div>
                <Button onClick={handleSaveAll} disabled={saving} className="gap-2 shadow-md !bg-blue-600 hover:!bg-blue-700 text-white border-none">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Salvar Alterações
                </Button>
            </div>

            <Separator className="bg-slate-200" />

            <div className="grid gap-8">
                {/* WHATSAPP / TWILIO */}
                <Card className="overflow-hidden border-indigo-100 shadow-sm">
                    <CardHeader className="bg-slate-50/50 border-b">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                                <MessageCircle className="h-6 w-6" />
                            </div>
                            <div>
                                <CardTitle>WhatsApp (Twilio)</CardTitle>
                                <CardDescription>Habilite o envio de mensagens reais via API do Twilio.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="sid">Account SID</Label>
                                <Input 
                                    id="sid" 
                                    placeholder="ACxxxxxxxxxxxxxxxx" 
                                    value={twilioConfig.accountSid}
                                    onChange={(e) => setTwilioConfig(prev => ({ ...prev, accountSid: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="token">Auth Token</Label>
                                <Input 
                                    id="token" 
                                    type="password" 
                                    placeholder="••••••••••••••••"
                                    value={twilioConfig.authToken}
                                    onChange={(e) => setTwilioConfig(prev => ({ ...prev, authToken: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="space-y-2 max-w-md">
                            <Label htmlFor="phone">Número Twilio (WhatsApp)</Label>
                            <Input 
                                id="phone" 
                                placeholder="+14155552671" 
                                value={twilioConfig.phoneNumber}
                                onChange={(e) => setTwilioConfig(prev => ({ ...prev, phoneNumber: e.target.value }))}
                            />
                            <p className="text-[11px] text-slate-400">Use o formato internacional: +[DDI][DDD][Número]</p>
                        </div>
                    </CardContent>
                </Card>

                {/* E-MAIL SMTP */}
                <Card className="overflow-hidden border-orange-100 shadow-sm">
                    <CardHeader className="bg-slate-50/50 border-b">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-orange-100 rounded-lg text-orange-600">
                                <Mail className="h-6 w-6" />
                            </div>
                            <div>
                                <CardTitle>E-mail (Servidor SMTP)</CardTitle>
                                <CardDescription>Configure o envio de e-mails automáticos através do seu provedor.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="grid md:grid-cols-4 gap-6">
                            <div className="md:col-span-3 space-y-2">
                                <Label htmlFor="smtpHost">Host do Servidor SMTP</Label>
                                <Input 
                                    id="smtpHost" 
                                    placeholder="smtp.gmail.com ou smtp.office365.com" 
                                    value={emailConfig.smtpHost}
                                    onChange={(e) => setEmailConfig(prev => ({ ...prev, smtpHost: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="smtpPort">Porta</Label>
                                <Input 
                                    id="smtpPort" 
                                    type="number"
                                    placeholder="587" 
                                    value={emailConfig.smtpPort}
                                    onChange={(e) => setEmailConfig(prev => ({ ...prev, smtpPort: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="smtpUser">Usuário / E-mail de Login</Label>
                                <Input 
                                    id="smtpUser" 
                                    placeholder="seu-email@dominio.com" 
                                    value={emailConfig.smtpUser}
                                    onChange={(e) => setEmailConfig(prev => ({ ...prev, smtpUser: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="smtpPass">Senha ou App Key</Label>
                                <Input 
                                    id="smtpPass" 
                                    type="password" 
                                    placeholder="Senha do servidor de e-mail" 
                                    value={emailConfig.smtpPass}
                                    onChange={(e) => setEmailConfig(prev => ({ ...prev, smtpPass: e.target.value }))}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* VOZ (COMING SOON) */}
                <Card className="bg-slate-50 border-dashed border-slate-300 opacity-60 grayscale">
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                                <Phone className="h-6 w-6" />
                            </div>
                            <div>
                                <CardTitle>Voz (AI Voice Agents)</CardTitle>
                                <CardDescription>Chamadas telefônicas inteligentes com latência ultra-baixa.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full border border-blue-100">
                            <Server className="h-3 w-3" /> Em Breve no Plano Enterprise
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Barra Flutuante de Salvamento */}
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-10 z-50">
                 <Button 
                    onClick={handleSaveAll} 
                    disabled={saving} 
                    size="lg" 
                    className="rounded-full h-14 px-8 shadow-2xl gap-3 !bg-blue-600 hover:!bg-blue-700 text-white border-2 border-white"
                >
                    {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
                    <span className="font-bold">Salvar Tudo</span>
                </Button>
            </div>
        </div>
    )
}
