import React, { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Button } from "../ui/button"
import { toast } from "sonner"
import { Loader2, MessageCircle, Phone, Mail, Save, Server, Database, Plus, Trash2, Clock } from "lucide-react"
import { Badge } from "../ui/badge"
import { supabase } from "../../utils/supabase/client"
import { useAuth } from "../../contexts/AuthContext"
import { CRMIntegrationSheet } from "./CRMIntegrationSheet"
import { useTheme } from "next-themes"
import { useTranslation } from "react-i18next"
import i18n from "../../i18n/config"
import { BASE_URL, getAuthHeaders } from "../../services/api"

type WhatsAppStatus = 'connected' | 'pending' | 'error' | 'unknown'

type WhatsAppIntegrationRow = {
    id: string
    phone_number?: string | null
    app_key?: string | null
    access_token?: string | null
    auth_token?: string | null
    provider?: string | null
    created_at?: string | null
}

export function Integrations() {
    const { theme } = useTheme()
    const { t } = useTranslation('configuration')
    const { userId } = useAuth()
    const [translationsReady, setTranslationsReady] = useState(false)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [isCRMSheetOpen, setIsCRMSheetOpen] = useState(false)
    const [crmIntegrations, setCrmIntegrations] = useState<any[]>([])
    
    // Status de conexão
    const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppStatus>('unknown')
    const [emailStatus, setEmailStatus] = useState<'connected' | 'pending' | 'error' | 'unknown'>('unknown')
    const [whatsappConfig, setWhatsappConfig] = useState({ phoneNumberId: "", accessToken: "", verifyToken: "", phoneNumber: "" })
    const [whatsappIntegrationId, setWhatsappIntegrationId] = useState<string | null>(null)
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

    const normalizePhoneNumber = (value: string) => value.replace(/\D/g, '')

    const hasAnyWhatsappConfig = (config: typeof whatsappConfig) =>
        !!(config.phoneNumberId.trim() || config.accessToken.trim() || config.verifyToken.trim() || normalizePhoneNumber(config.phoneNumber))

    const hasCompleteWhatsappConfig = (config: typeof whatsappConfig) =>
        !!(
            config.phoneNumberId.trim() &&
            config.accessToken.trim() &&
            config.verifyToken.trim() &&
            normalizePhoneNumber(config.phoneNumber)
        )

    const getPrimaryWhatsappIntegration = (rows: WhatsAppIntegrationRow[]) => rows[0] || null

    const refreshWhatsappStatus = async (
        integrationId: string | null,
        config: typeof whatsappConfig
    ) => {
        if (!hasAnyWhatsappConfig(config)) {
            setWhatsappStatus('unknown')
            return
        }

        if (!hasCompleteWhatsappConfig(config) || !integrationId) {
            setWhatsappStatus('pending')
            return
        }

        try {
            const response = await fetch(
                `${BASE_URL}/whatsapp/status?integration_id=${encodeURIComponent(integrationId)}`,
                {
                    method: 'GET',
                    headers: await getAuthHeaders(false)
                }
            )

            if (!response.ok) {
                setWhatsappStatus('error')
                return
            }

            const result = await response.json()
            if (result?.status === 'connected') {
                setWhatsappStatus('connected')
            } else if (result?.status === 'connecting') {
                setWhatsappStatus('pending')
            } else {
                setWhatsappStatus('error')
            }
        } catch (error) {
            console.error('Erro ao validar status do WhatsApp:', error)
            setWhatsappStatus('error')
        }
    }

    const updateWhatsappConfig = (patch: Partial<typeof whatsappConfig>) => {
        setWhatsappConfig((prev) => {
            const next = { ...prev, ...patch }
            setWhatsappStatus(hasAnyWhatsappConfig(next) ? 'pending' : 'unknown')
            return next
        })
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
                const email: any = {}
                data.forEach((item: any) => {
                    if (item.provider === 'email_host') email.smtpHost = item.api_key
                    if (item.provider === 'email_port') email.smtpPort = item.api_key
                    if (item.provider === 'email_user') email.smtpUser = item.api_key
                    if (item.provider === 'email_pass') email.smtpPass = item.api_key
                })
                setEmailConfig({ smtpHost: email.smtpHost || "", smtpPort: email.smtpPort || "", smtpUser: email.smtpUser || "", smtpPass: email.smtpPass || "" })
            }

            if (userId) {
                const { data: whatsappIntegrations, error: whatsappError } = await supabase
                    .from('tb_integrations')
                    .select('id, phone_number, app_key, access_token, auth_token, provider, created_at')
                    .eq('user_id', userId)
                    .eq('provider', 'whatsapp')
                    .order('created_at', { ascending: false })

                if (whatsappError) throw whatsappError

                const whatsappList = Array.isArray(whatsappIntegrations) ? whatsappIntegrations as WhatsAppIntegrationRow[] : []
                const whatsappIntegration = getPrimaryWhatsappIntegration(whatsappList)

                if (whatsappList.length > 1) {
                    console.warn('[Integrations] Múltiplas integrações WhatsApp encontradas para o usuário. Usando a mais recente.', {
                        count: whatsappList.length,
                        ids: whatsappList.map((item) => item.id)
                    })
                }

                const nextWhatsappConfig = {
                    phoneNumber: whatsappIntegration?.phone_number || "",
                    phoneNumberId: whatsappIntegration?.app_key || "",
                    accessToken: whatsappIntegration?.access_token || "",
                    verifyToken: whatsappIntegration?.auth_token || ""
                }

                setWhatsappIntegrationId(whatsappIntegration?.id || null)
                setWhatsappConfig(nextWhatsappConfig)
                await refreshWhatsappStatus(whatsappIntegration?.id || null, nextWhatsappConfig)
            } else {
                setWhatsappIntegrationId(null)
                setWhatsappStatus('unknown')
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

            if (!userId) {
                throw new Error(t('integrations.error.unauthorized'))
            }

            const { data: companyUser, error: companyUserError } = await supabase
                .from('tb_company_users')
                .select('companies_id')
                .eq('user_id', userId)
                .maybeSingle()

            if (companyUserError) throw companyUserError

            const normalizedPhoneNumber = normalizePhoneNumber(whatsappConfig.phoneNumber)
            const trimmedPhoneNumberId = whatsappConfig.phoneNumberId.trim()
            const trimmedAccessToken = whatsappConfig.accessToken.trim()
            const trimmedVerifyToken = whatsappConfig.verifyToken.trim()

            const { data: existingWhatsappRows, error: existingWhatsappError } = await supabase
                .from('tb_integrations')
                .select('id, created_at')
                .eq('user_id', userId)
                .eq('provider', 'whatsapp')
                .order('created_at', { ascending: false })

            if (existingWhatsappError) throw existingWhatsappError

            const existingWhatsappList = Array.isArray(existingWhatsappRows) ? existingWhatsappRows as Pick<WhatsAppIntegrationRow, 'id' | 'created_at'>[] : []
            const primaryWhatsapp = existingWhatsappList[0] || null
            const duplicateWhatsappIds = existingWhatsappList.slice(1).map((item) => item.id)

            const whatsappPayload = {
                user_id: userId,
                companies_id: companyUser?.companies_id || null,
                provider: 'whatsapp',
                phone_number: normalizedPhoneNumber || null,
                app_key: trimmedPhoneNumberId || null,
                access_token: trimmedAccessToken || null,
                auth_token: trimmedVerifyToken || null
            }

            const hasWhatsappConfig = !!(normalizedPhoneNumber || trimmedPhoneNumberId || trimmedAccessToken || trimmedVerifyToken)

            if (primaryWhatsapp?.id && !hasWhatsappConfig) {
                const { error: deleteWhatsappError } = await supabase
                    .from('tb_integrations')
                    .delete()
                    .in('id', existingWhatsappList.map((item) => item.id))

                if (deleteWhatsappError) throw deleteWhatsappError
                setWhatsappIntegrationId(null)
                setWhatsappStatus('unknown')
            } else if (primaryWhatsapp?.id) {
                const { error: updateWhatsappError } = await supabase
                    .from('tb_integrations')
                    .update(whatsappPayload)
                    .eq('id', primaryWhatsapp.id)

                if (updateWhatsappError) throw updateWhatsappError

                if (duplicateWhatsappIds.length > 0) {
                    const { error: deleteDuplicatesError } = await supabase
                        .from('tb_integrations')
                        .delete()
                        .in('id', duplicateWhatsappIds)

                    if (deleteDuplicatesError) throw deleteDuplicatesError
                }

                setWhatsappIntegrationId(primaryWhatsapp.id)
            } else if (hasWhatsappConfig) {
                const { data: insertedWhatsapp, error: insertWhatsappError } = await supabase
                    .from('tb_integrations')
                    .insert(whatsappPayload)
                    .select('id')
                    .single()

                if (insertWhatsappError) throw insertWhatsappError
                setWhatsappIntegrationId(insertedWhatsapp?.id || null)
            }

            const hasEmailConfig = !!(
                emailConfig.smtpHost.trim() ||
                emailConfig.smtpPort.trim() ||
                emailConfig.smtpUser.trim() ||
                emailConfig.smtpPass.trim()
            )

            if (hasEmailConfig) {
                const { error } = await supabase.rpc('sp_upsert_integration_by_email', {
                    p_user_email: user.email,
                    p_phone_number: null,
                    p_account_sid: null,
                    p_auth_token: null,
                    p_email: emailConfig.smtpUser || null,
                    p_smtp_host: emailConfig.smtpHost || null,
                    p_smtp_port: emailConfig.smtpPort ? parseInt(emailConfig.smtpPort) : null,
                    p_app_key: emailConfig.smtpPass || null
                })

                if (error) throw error
            }

            await loadConfig()
            toast.success(t('integrations.success.save'))
        } catch (error: any) {
            console.error("Erro ao salvar integrações:", error)
            toast.error(error.message || t('integrations.error.save'))
        } finally {
            setSaving(false)
        }
    }

    const getStatusBadge = (status: string) => {
        if (status === 'connected') return <Badge className="bg-emerald-50 text-emerald-700 border-none font-black text-[9px] px-3 gap-1.5"><div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"/>{t('integrations.crm.connected')}</Badge>
        if (status === 'pending') return <Badge className="bg-amber-50 text-amber-700 border-none font-black text-[9px] px-3">PENDENTE</Badge>
        if (status === 'error') return <Badge className="bg-rose-50 text-rose-700 border-none font-black text-[9px] px-3">ERRO</Badge>
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
                                    {getStatusBadge(whatsappStatus)}
                                </div>
                                <p className="text-sm font-medium" style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b' }}>
                                    Integre o numero oficial da Meta para testar mensagens reais com os agentes da plataforma.
                                </p>
                            </div>
                        </div>
                    </div>
                    <CardContent className="p-8">
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold" style={{ color: theme === "dark" ? "#cbd5e1" : "#475569" }}>Phone Number ID</Label>
                                <Input value={whatsappConfig.phoneNumberId} onChange={(e) => updateWhatsappConfig({ phoneNumberId: e.target.value })} className="h-12 rounded-xl border px-4 font-mono text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" style={{ backgroundColor: theme === "dark" ? "rgba(15, 23, 42, 0.5)" : "#f8fafc", borderColor: theme === "dark" ? "rgba(51, 65, 85, 0.5)" : "#e2e8f0", color: theme === "dark" ? "#e2e8f0" : "#1e293b" }} />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold" style={{ color: theme === "dark" ? "#cbd5e1" : "#475569" }}>Access Token</Label>
                                <Input type="password" value={whatsappConfig.accessToken} onChange={(e) => updateWhatsappConfig({ accessToken: e.target.value })} className="h-12 rounded-xl border px-4 font-mono text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" style={{ backgroundColor: theme === "dark" ? "rgba(15, 23, 42, 0.5)" : "#f8fafc", borderColor: theme === "dark" ? "rgba(51, 65, 85, 0.5)" : "#e2e8f0", color: theme === "dark" ? "#e2e8f0" : "#1e293b" }} />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold" style={{ color: theme === "dark" ? "#cbd5e1" : "#475569" }}>Verify Token</Label>
                                <Input value={whatsappConfig.verifyToken} onChange={(e) => updateWhatsappConfig({ verifyToken: e.target.value })} className="h-12 rounded-xl border px-4 font-mono text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" style={{ backgroundColor: theme === "dark" ? "rgba(15, 23, 42, 0.5)" : "#f8fafc", borderColor: theme === "dark" ? "rgba(51, 65, 85, 0.5)" : "#e2e8f0", color: theme === "dark" ? "#e2e8f0" : "#1e293b" }} />
                                <p className="text-xs" style={{ color: theme === "dark" ? "#94a3b8" : "#64748b" }}>
                                    Esse valor pode ser criado por voce e deve ser o mesmo usado na verificacao do webhook da Meta.
                                </p>
                            </div>
                            <div className="space-y-2 md:col-span-2 max-w-md">
                                <Label className="text-xs font-semibold" style={{ color: theme === "dark" ? "#cbd5e1" : "#475569" }}>Numero oficial da Meta</Label>
                                <Input placeholder="+1 555-899-1881" value={whatsappConfig.phoneNumber} onChange={(e) => updateWhatsappConfig({ phoneNumber: e.target.value })} className="h-12 rounded-xl border px-4 font-semibold focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" style={{ backgroundColor: theme === "dark" ? "rgba(15, 23, 42, 0.5)" : "#f8fafc", borderColor: theme === "dark" ? "rgba(51, 65, 85, 0.5)" : "#e2e8f0", color: theme === "dark" ? "#e2e8f0" : "#1e293b" }} />
                                <p className="text-xs" style={{ color: theme === "dark" ? "#94a3b8" : "#64748b" }}>
                                    Os dados sao salvos em tb_integrations como provider=whatsapp, phone_number, app_key, access_token e auth_token.
                                </p>
                                <p className="text-xs" style={{ color: theme === "dark" ? "#94a3b8" : "#64748b" }}>
                                    Configure na Meta o callback GET/POST /whatsapp/webhook para este numero oficial.
                                </p>
                            </div>
                        </div>
                        <div className="mt-8 flex justify-end">
                            <Button
                                onClick={handleSaveAll}
                                disabled={saving}
                                className="rounded-2xl px-6 h-11 font-black uppercase text-[10px] tracking-widest shadow-xl transition-all"
                                style={{
                                    background: saving
                                        ? "linear-gradient(135deg, #67e8f9 0%, #06b6d4 100%)"
                                        : "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)",
                                    color: "white",
                                    border: "none"
                                }}
                            >
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" style={{ color: "white" }} /> : <Save className="h-4 w-4 mr-2" style={{ color: "white" }} />}
                                Salvar integracao
                            </Button>
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
