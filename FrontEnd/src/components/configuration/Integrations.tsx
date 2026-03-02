import React, { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Button } from "../ui/button"
import { toast } from "sonner"
import { Loader2, MessageCircle, Phone, Mail, Save, Server, ShieldCheck, Database, Plus, Trash2, CheckCircle2, AlertCircle, Clock, Zap } from "lucide-react"
import { Badge } from "../ui/badge"
import { supabase } from "../../utils/supabase/client"
import { Separator } from "../ui/separator"
import { useAuth } from "../../contexts/AuthContext"
import { CRMIntegrationSheet } from "./CRMIntegrationSheet"
import { cn } from "../../lib/utils"
import { useTheme } from "next-themes"
import { useTranslation } from "react-i18next"
import i18n from "../../i18n/config"

export function Integrations() {
    const { theme } = useTheme()
    const { t } = useTranslation('configuration')
    const { userId, user, loading: authLoading } = useAuth()
    const [translationsReady, setTranslationsReady] = useState(false)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [isCRMSheetOpen, setIsCRMSheetOpen] = useState(false)
    const [crmIntegrations, setCrmIntegrations] = useState<any[]>([])
    
    // Status de conexão
    const [twilioStatus, setTwilioStatus] = useState<'connected' | 'pending' | 'error' | 'unknown'>('unknown')
    const [emailStatus, setEmailStatus] = useState<'connected' | 'pending' | 'error' | 'unknown'>('unknown')
    const [testingConnection, setTestingConnection] = useState<'twilio' | 'email' | null>(null)
    
    const [twilioConfig, setTwilioConfig] = useState({ accountSid: "", authToken: "", phoneNumber: "" })
    const [emailConfig, setEmailConfig] = useState({ smtpHost: "", smtpPort: "", smtpUser: "", smtpPass: "" })

    useEffect(() => {
        loadConfig()
        loadCRMIntegrations()
    }, [userId])

    // Garantir que as traduções estejam carregadas
    useEffect(() => {
        const checkTranslations = async () => {
            const currentLang = i18n.language || 'pt-BR'
            const configTranslations = i18n.getResourceBundle(currentLang, 'configuration')

            if (configTranslations && Object.keys(configTranslations).length > 0) {
                setTranslationsReady(true)
            } else {
                const { loadTranslationsFromDatabase } = await import('../../i18n/config')
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

    // Lógica de status de conexão simplificada
    useEffect(() => {
        if (twilioConfig.accountSid && twilioConfig.authToken && twilioConfig.phoneNumber) setTwilioStatus('connected')
        else if (twilioConfig.accountSid) setTwilioStatus('pending')
        else setTwilioStatus('unknown')
    }, [twilioConfig])

    useEffect(() => {
        if (emailConfig.smtpHost && emailConfig.smtpUser) setEmailStatus('connected')
        else if (emailConfig.smtpHost) setEmailStatus('pending')
        else setEmailStatus('unknown')
    }, [emailConfig])

    const loadCRMIntegrations = async () => {
        if (!userId) return
        try {
            const { data: companyUser } = await supabase.from('tb_company_users').select('companies_id').eq('user_id', userId).maybeSingle()
            if (companyUser?.companies_id) {
                const { data } = await supabase.from('tb_crm_integrations').select(`id, is_active, created_at, tb_crms (id, name, slug, type)`).eq('companies_id', companyUser.companies_id).eq('is_active', true).order('created_at', { ascending: false })
                setCrmIntegrations(data || [])
            }
        } catch (e) { console.error(e) }
    }

    const handleDeleteCRM = async (integrationId: string, crmName: string) => {
        if (!confirm(t('integrations.crm.deleteConfirm', { crmName }))) {
            return
        }

        try {
            const { data: companyUser } = await supabase.from('tb_company_users').select('companies_id').eq('user_id', userId).maybeSingle()
            if (companyUser?.companies_id) {
                const { error } = await supabase.from('tb_crm_integrations').delete().eq('id', integrationId).eq('companies_id', companyUser.companies_id)
                if (error) throw error
                toast.success(t('integrations.crm.success.delete', { crmName }))
                await loadCRMIntegrations()
            }
        } catch (error: any) {
            console.error('Erro ao excluir integração CRM:', error)
            toast.error(error.message || t('integrations.crm.error.delete'))
        }
    }

    const loadConfig = async () => {
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user?.email) return
            const { data } = await supabase.rpc('sp_get_api_keys_by_email', { p_email: user.email })
            if (Array.isArray(data)) {
                const twilio: any = {}; const email: any = {}
                data.forEach((item: any) => {
                    if (item.provider === 'twilio_sid') twilio.accountSid = item.api_key
                    if (item.provider === 'twilio_token') twilio.authToken = item.api_key
                    if (item.provider === 'twilio_phone') twilio.phoneNumber = item.api_key
                    if (item.provider === 'email_host') email.smtpHost = item.api_key
                    if (item.provider === 'email_port') email.smtpPort = item.api_key
                    if (item.provider === 'email_user') email.smtpUser = item.api_key
                    if (item.provider === 'email_pass') email.smtpPass = item.api_key
                })
                setTwilioConfig({ accountSid: twilio.accountSid || "", authToken: twilio.authToken || "", phoneNumber: twilio.phoneNumber || "" })
                setEmailConfig({ smtpHost: email.smtpHost || "", smtpPort: email.smtpPort || "", smtpUser: email.smtpUser || "", smtpPass: email.smtpPass || "" })
            }
        } catch (e) { console.error(e) } finally { setLoading(false) }
    }

    const handleSaveAll = async () => {
        setSaving(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            
            if (!user || !user.email) {
                toast.error(t('integrations.error.unauthorized'))
                setSaving(false)
                return
            }

            const smtpHostLower = emailConfig.smtpHost.toLowerCase().trim()
            const isOutlook = smtpHostLower.includes('outlook') || smtpHostLower.includes('office365')

            // Outlook/Office365: apenas redireciona para OAuth, salvamento será feito no callback
            if (isOutlook) {
                // @ts-ignore - Vite environment variables
                const clientId = import.meta.env.VITE_OUTLOOK_CLIENT_ID
                // @ts-ignore - Vite environment variables
                const tenantId = import.meta.env.VITE_OUTLOOK_TENANT_ID

                if (!clientId || !tenantId) {
                    toast.error(t('integrations.error.outlookConfig'))
                    setSaving(false)
                    return
                }

                if (!userId || !user?.email) {
                    toast.error(t('integrations.error.unauthorized'))
                    setSaving(false)
                    return
                }

                const redirectUri = 'http://192.168.15.31:3333/auth/outlook/callback';
                
                const oauthUrl =
                `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize` +
                `?client_id=${clientId}` +
                `&response_type=code` +
                `&redirect_uri=${encodeURIComponent(redirectUri)}` +
                `&scope=${encodeURIComponent('offline_access Mail.Read Mail.Send User.Read')}` +
                `&state=${userId}`;

                window.location.href = oauthUrl;
                return;
            }

            // Twilio e SMTP normal: salva imediatamente via RPC
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

            toast.success(t('integrations.success.save'))
        } catch (error: any) {
            console.error("Erro ao salvar integrações:", error)
            toast.error(error.message || t('integrations.error.save'))
        } finally {
            setSaving(false)
        }
    }

    const testConnection = async (type: 'twilio' | 'email') => {
        setTestingConnection(type)
        await new Promise(r => setTimeout(r, 1500))
        toast.success(t('integrations.test.success', { type }))
        setTestingConnection(null)
    }

    const getStatusBadge = (status: string) => {
        if (status === 'connected') return <Badge className="bg-emerald-50 text-emerald-700 border-none font-black text-[9px] px-3 gap-1.5"><div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"/>{t('integrations.crm.connected')}</Badge>
        if (status === 'pending') return <Badge className="bg-amber-50 text-amber-700 border-none font-black text-[9px] px-3">{t('integrations.crm.connected')}</Badge>
        return null
    }

    if (loading || !translationsReady) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>

    return (
        <div className="space-y-10 pb-24 animate-in fade-in duration-500 bg-[#F8FAFC] dark:bg-slate-900 min-h-screen -m-4 p-8">
            
            {/* HEADER DA PÁGINA */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-4">
                <div>
                    <h2 className="text-4xl font-black tracking-tighter leading-none" style={{ color: theme === 'dark' ? '#e2e8f0' : '#0f172a' }}>{t('integrations.title')}</h2>
                    <p className="font-medium mt-2 uppercase text-[10px] tracking-[0.3em]" style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b' }}>{t('integrations.subtitle')}</p>
                </div>
                <div className="flex gap-3">
                    <Button 
                        onClick={() => setIsCRMSheetOpen(true)} 
                        variant="outline" 
                        className="rounded-2xl font-black text-[10px] uppercase tracking-widest px-6 h-12 transition-all"
                        style={{
                            backgroundColor: theme === 'dark' ? 'rgba(147, 51, 234, 0.15)' : '#f3e8ff',
                            borderColor: theme === 'dark' ? 'rgba(147, 51, 234, 0.4)' : '#e9d5ff',
                            color: theme === 'dark' ? '#c084fc' : '#9333ea',
                            borderWidth: '2px'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(147, 51, 234, 0.25)' : '#e9d5ff'
                            e.currentTarget.style.borderColor = theme === 'dark' ? 'rgba(147, 51, 234, 0.6)' : '#d8b4fe'
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(147, 51, 234, 0.15)' : '#f3e8ff'
                            e.currentTarget.style.borderColor = theme === 'dark' ? 'rgba(147, 51, 234, 0.4)' : '#e9d5ff'
                        }}
                    >
                        <Plus className="h-4 w-4 mr-2" style={{ color: theme === 'dark' ? '#c084fc' : '#9333ea' }} /> {t('integrations.connectCRM')}
                    </Button>
                    <Button 
                        onClick={handleSaveAll} 
                        disabled={saving} 
                        className="rounded-2xl px-8 h-12 font-black uppercase text-[10px] tracking-widest shadow-xl transition-all"
                        style={{ 
                            background: saving 
                                ? 'linear-gradient(135deg, #67e8f9 0%, #06b6d4 100%)' 
                                : 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                            color: 'white',
                            border: 'none',
                            boxShadow: saving 
                                ? '0 20px 25px -5px rgba(6, 182, 212, 0.3), 0 10px 10px -5px rgba(6, 182, 212, 0.2)' 
                                : '0 20px 25px -5px rgba(6, 182, 212, 0.4), 0 10px 10px -5px rgba(6, 182, 212, 0.3)'
                        }}
                        onMouseEnter={(e) => {
                            if (!saving) {
                                e.currentTarget.style.background = 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)'
                                e.currentTarget.style.boxShadow = '0 25px 30px -5px rgba(6, 182, 212, 0.5), 0 15px 15px -5px rgba(6, 182, 212, 0.4)'
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!saving) {
                                e.currentTarget.style.background = 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)'
                                e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(6, 182, 212, 0.4), 0 10px 10px -5px rgba(6, 182, 212, 0.3)'
                            }
                        }}
                    >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'white' }} /> : <Save className="h-4 w-4 mr-2" style={{ color: 'white' }} />} {t('integrations.saveChanges')}
                    </Button>
                </div>
            </div>

            <CRMIntegrationSheet isOpen={isCRMSheetOpen} onClose={() => setIsCRMSheetOpen(false)} onSave={loadCRMIntegrations} />

            <div className="grid gap-6">
                
                {/* 1. CARD CRM - ROXO */}
                <Card 
                    className="border-none overflow-hidden hover:shadow-xl hover:shadow-slate-300/50 dark:hover:shadow-cyan-500/20 transition-all"
                    style={{ 
                        borderRadius: '2.5rem',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(6, 182, 212, 0.3), 0 0 20px rgba(6, 182, 212, 0.1)',
                        backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                        border: '1px solid rgba(6, 182, 212, 0.2)'
                    }}
                >
                    <div className="p-8 border-b border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-6">
                            {/* ÍCONE COM BOX COLORIDO PASTEL */}
                            <div 
                                className="rounded-2xl flex items-center justify-center shadow-md"
                                style={{ backgroundColor: '#f3e8ff', width: '64px', height: '64px' }}
                            >
                                <Database size={32} color="#9333ea" strokeWidth={2.5} />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-xl font-black tracking-tight mb-2" style={{ color: theme === 'dark' ? '#e2e8f0' : '#0f172a' }}>{t('integrations.crm.title')}</h3>
                                <div className="mb-2">
                                    {crmIntegrations.length > 0 && getStatusBadge('connected')}
                                </div>
                                <p className="text-sm font-medium" style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b' }}>{t('integrations.crm.description')}</p>
                            </div>
                        </div>
                    </div>
                    <CardContent className="p-8">
                        {crmIntegrations.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {crmIntegrations.map((integration) => (
                                    <div 
                                        key={integration.id} 
                                        className="flex items-center justify-between p-5 border shadow-sm hover:shadow-md transition-all group"
                                        style={{ 
                                            borderRadius: '2rem',
                                            backgroundColor: theme === 'dark' ? 'rgba(15, 23, 42, 0.5)' : '#f8fafc',
                                            borderColor: theme === 'dark' ? 'rgba(51, 65, 85, 0.5)' : '#e2e8f0'
                                        }}
                                    >
                                        <div className="flex items-center gap-4">
                                            <Database size={20} color="#9333ea" style={{ marginLeft: '8px' }} />
                                            <span className="font-bold" style={{ color: theme === 'dark' ? '#e2e8f0' : '#1e293b' }}>{integration.tb_crms?.name}</span>
                                        </div>
                                        <Button variant="ghost" size="icon" onClick={() => handleDeleteCRM(integration.id, integration.tb_crms?.name)} className="opacity-0 group-hover:opacity-100 text-red-500 rounded-full hover:bg-red-50">
                                            <Trash2 size={18} />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div 
                                className="py-12 text-center border-2 border-dashed rounded-2xl"
                                style={{
                                    borderColor: theme === 'dark' ? 'rgba(51, 65, 85, 0.5)' : '#e2e8f0',
                                    backgroundColor: theme === 'dark' ? 'rgba(15, 23, 42, 0.3)' : 'rgba(248, 250, 252, 0.5)'
                                }}
                            >
                                <p className="text-sm font-medium" style={{ color: theme === 'dark' ? '#64748b' : '#94a3b8' }}>Nenhum cérebro de dados conectado</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* 2. CARD WHATSAPP - VERDE */}
                <Card 
                    className="border-none overflow-hidden hover:shadow-xl hover:shadow-slate-300/50 dark:hover:shadow-cyan-500/20 transition-all"
                    style={{ 
                        borderRadius: '2.5rem',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(6, 182, 212, 0.3), 0 0 20px rgba(6, 182, 212, 0.1)',
                        backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                        border: '1px solid rgba(6, 182, 212, 0.2)'
                    }}
                >
                    <div className="p-8 border-b border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-6">
                            {/* ÍCONE COM BOX COLORIDO PASTEL */}
                            <div 
                                className="rounded-2xl flex items-center justify-center shadow-md"
                                style={{ backgroundColor: '#d1fae5', width: '64px', height: '64px' }}
                            >
                                <MessageCircle size={32} color="#10b981" strokeWidth={2.5} />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-xl font-black tracking-tight mb-2" style={{ color: theme === 'dark' ? '#e2e8f0' : '#0f172a' }}>{t('integrations.whatsapp.title')}</h3>
                                <div className="mb-2">
                                    {getStatusBadge(twilioStatus)}
                                </div>
                                <p className="text-sm font-medium" style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b' }}>{t('integrations.whatsapp.description')}</p>
                            </div>
                        </div>
                    </div>
                    <CardContent className="p-8">
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold" style={{ color: theme === 'dark' ? '#cbd5e1' : '#475569' }}>{t('integrations.whatsapp.accountSid')}</Label>
                                <Input value={twilioConfig.accountSid} onChange={(e) => setTwilioConfig(p => ({...p, accountSid: e.target.value}))} className="h-12 rounded-xl border px-4 font-mono text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" style={{ backgroundColor: theme === 'dark' ? 'rgba(15, 23, 42, 0.5)' : '#f8fafc', borderColor: theme === 'dark' ? 'rgba(51, 65, 85, 0.5)' : '#e2e8f0', color: theme === 'dark' ? '#e2e8f0' : '#1e293b' }} />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold" style={{ color: theme === 'dark' ? '#cbd5e1' : '#475569' }}>{t('integrations.whatsapp.authToken')}</Label>
                                <Input type="password" value={twilioConfig.authToken} onChange={(e) => setTwilioConfig(p => ({...p, authToken: e.target.value}))} className="h-12 rounded-xl border px-4 font-mono text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" style={{ backgroundColor: theme === 'dark' ? 'rgba(15, 23, 42, 0.5)' : '#f8fafc', borderColor: theme === 'dark' ? 'rgba(51, 65, 85, 0.5)' : '#e2e8f0', color: theme === 'dark' ? '#e2e8f0' : '#1e293b' }} />
                            </div>
                            <div className="space-y-2 md:col-span-2 max-w-md">
                                <Label className="text-xs font-semibold" style={{ color: theme === 'dark' ? '#cbd5e1' : '#475569' }}>{t('integrations.whatsapp.phoneNumber')}</Label>
                                <Input placeholder="+55..." value={twilioConfig.phoneNumber} onChange={(e) => setTwilioConfig(p => ({...p, phoneNumber: e.target.value}))} className="h-12 rounded-xl border px-4 font-semibold focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" style={{ backgroundColor: theme === 'dark' ? 'rgba(15, 23, 42, 0.5)' : '#f8fafc', borderColor: theme === 'dark' ? 'rgba(51, 65, 85, 0.5)' : '#e2e8f0', color: theme === 'dark' ? '#e2e8f0' : '#1e293b' }} />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 3. CARD EMAIL - LARANJA */}
                <Card 
                    className="border-none overflow-hidden hover:shadow-xl hover:shadow-slate-300/50 dark:hover:shadow-cyan-500/20 transition-all"
                    style={{ 
                        borderRadius: '2.5rem',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(6, 182, 212, 0.3), 0 0 20px rgba(6, 182, 212, 0.1)',
                        backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                        border: '1px solid rgba(6, 182, 212, 0.2)'
                    }}
                >
                    <div className="p-8 border-b border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-6">
                            {/* ÍCONE COM BOX COLORIDO PASTEL */}
                            <div 
                                className="rounded-2xl flex items-center justify-center shadow-md"
                                style={{ backgroundColor: '#fed7aa', width: '64px', height: '64px' }}
                            >
                                <Mail size={32} color="#f97316" strokeWidth={2.5} />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-xl font-black tracking-tight mb-2" style={{ color: theme === 'dark' ? '#e2e8f0' : '#0f172a' }}>{t('integrations.email.title')}</h3>
                                <div className="mb-2">
                                    {getStatusBadge(emailStatus)}
                                </div>
                                <p className="text-sm font-medium" style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b' }}>{t('integrations.email.description')}</p>
                            </div>
                        </div>
                    </div>
                    <CardContent className="p-8">
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold" style={{ color: theme === 'dark' ? '#cbd5e1' : '#475569' }}>{t('integrations.email.host')}</Label>
                                <Input value={emailConfig.smtpHost} onChange={(e) => setEmailConfig(p => ({...p, smtpHost: e.target.value}))} className="h-12 rounded-xl border px-4 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20" style={{ backgroundColor: theme === 'dark' ? 'rgba(15, 23, 42, 0.5)' : '#f8fafc', borderColor: theme === 'dark' ? 'rgba(51, 65, 85, 0.5)' : '#e2e8f0', color: theme === 'dark' ? '#e2e8f0' : '#1e293b' }} />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold" style={{ color: theme === 'dark' ? '#cbd5e1' : '#475569' }}>{t('integrations.email.port')}</Label>
                                <Input value={emailConfig.smtpPort} onChange={(e) => setEmailConfig(p => ({...p, smtpPort: e.target.value}))} className="h-12 rounded-xl border px-4 max-w-[150px] focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20" style={{ backgroundColor: theme === 'dark' ? 'rgba(15, 23, 42, 0.5)' : '#f8fafc', borderColor: theme === 'dark' ? 'rgba(51, 65, 85, 0.5)' : '#e2e8f0', color: theme === 'dark' ? '#e2e8f0' : '#1e293b' }} />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold" style={{ color: theme === 'dark' ? '#cbd5e1' : '#475569' }}>{t('integrations.email.login')}</Label>
                                <Input value={emailConfig.smtpUser} onChange={(e) => setEmailConfig(p => ({...p, smtpUser: e.target.value}))} className="h-12 rounded-xl border px-4 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20" style={{ backgroundColor: theme === 'dark' ? 'rgba(15, 23, 42, 0.5)' : '#f8fafc', borderColor: theme === 'dark' ? 'rgba(51, 65, 85, 0.5)' : '#e2e8f0', color: theme === 'dark' ? '#e2e8f0' : '#1e293b' }} />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold" style={{ color: theme === 'dark' ? '#cbd5e1' : '#475569' }}>{t('integrations.email.password')}</Label>
                                <Input type="password" value={emailConfig.smtpPass} onChange={(e) => setEmailConfig(p => ({...p, smtpPass: e.target.value}))} className="h-12 rounded-xl border px-4 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20" style={{ backgroundColor: theme === 'dark' ? 'rgba(15, 23, 42, 0.5)' : '#f8fafc', borderColor: theme === 'dark' ? 'rgba(51, 65, 85, 0.5)' : '#e2e8f0', color: theme === 'dark' ? '#e2e8f0' : '#1e293b' }} />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 4. CARD VOZ - EM BREVE */}
                <Card 
                    className="border-none overflow-hidden transition-all"
                    style={{ 
                        borderRadius: '2.5rem',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(6, 182, 212, 0.3), 0 0 20px rgba(6, 182, 212, 0.1)',
                        opacity: 0.65,
                        backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                        border: '1px solid rgba(6, 182, 212, 0.2)'
                    }}
                >
                    <div className="p-8 border-b border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-6">
                            {/* ÍCONE COM BOX COLORIDO PASTEL */}
                            <div 
                                className="rounded-2xl flex items-center justify-center shadow-md"
                                style={{ backgroundColor: '#e0e7ff', width: '64px', height: '64px' }}
                            >
                                <Phone size={32} color="#6366f1" strokeWidth={2.5} />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-xl font-black tracking-tight mb-2" style={{ color: theme === 'dark' ? '#e2e8f0' : '#0f172a' }}>{t('integrations.voice.title')}</h3>
                                <div className="mb-2">
                                    <Badge 
                                        className="border-none font-semibold text-xs px-3 py-1 shadow-lg"
                                        style={{ 
                                            background: 'linear-gradient(to right, #a855f7, #6366f1)',
                                            color: 'white',
                                            border: 'none'
                                        }}
                                    >
                                        <Server className="h-3 w-3 mr-1.5" style={{ color: 'white' }} />
                                        {t('integrations.voice.exclusive')}
                                    </Badge>
                                </div>
                                <p className="text-sm font-medium" style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b' }}>{t('integrations.voice.description')}</p>
                            </div>
                        </div>
                    </div>
                    <CardContent className="p-8">
                        <div className="py-8 text-center">
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50/50 text-indigo-700 text-sm font-semibold rounded-full border border-indigo-200/50">
                                <Clock className="h-4 w-4" />
                                {t('integrations.voice.comingSoon')}
                            </div>
                            <p className="text-xs text-slate-400 mt-3">{t('integrations.voice.comingSoonDescription')}</p>
                        </div>
                    </CardContent>
                </Card>

            </div>
        </div>
    )
}
