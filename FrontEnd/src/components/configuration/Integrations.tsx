import React, { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Button } from "../ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { toast } from "sonner"
import { Loader2, MessageCircle, Phone, Mail, Save, Server, Database, Plus, Trash2, Clock, Bot } from "lucide-react"
import { Badge } from "../ui/badge"
import { supabase } from "../../utils/supabase/client"
import { useAuth } from "../../contexts/AuthContext"
import { CRMIntegrationSheet } from "./CRMIntegrationSheet"
import { useTheme } from "next-themes"
import { useTranslation } from "react-i18next"
import i18n from "../../i18n/config"
import { BASE_URL, getAuthHeaders } from "../../services/api"

type WhatsAppStatus = 'connected' | 'pending' | 'error' | 'unknown'

type WhatsAppValidationResult = {
    uiStatus: WhatsAppStatus
    backendStatus?: 'connected' | 'connecting' | 'disconnected'
    message?: string
}

type WhatsAppIntegrationRow = {
    id: string
    phone_number?: string | null
    app_key?: string | null
    access_token?: string | null
    auth_token?: string | null
    provider?: string | null
    automation_mode?: 'agent' | 'flow' | 'hybrid' | null
    linked_flow_id?: string | null
    linked_flow_name?: string | null
    created_at?: string | null
    linked_agent_id?: string | null
    linked_agent_name?: string | null
    linked_agent_status_id?: number | string | null
}

type AssignableAgent = {
    id: string
    nome: string
    status_id?: number | string | null
}

type AssignableFlow = {
    id: string
    name: string
}

type EmailProviderFamily = 'microsoft365' | 'generic_imap_smtp'
type EmailAuthType = 'oauth2' | 'basic' | 'app_password'
type EmailReadMethod = 'graph' | 'imap' | 'none'
type EmailSendMethod = 'graph' | 'smtp' | 'none'
type EmailUiStatus = 'connected' | 'pending' | 'error' | 'unknown'

type EmailIntegrationRow = {
    id: string
    provider?: string | null
    provider_family?: EmailProviderFamily | null
    auth_type?: EmailAuthType | null
    read_method?: EmailReadMethod | null
    send_method?: EmailSendMethod | null
    email_address?: string | null
    username?: string | null
    password?: string | null
    smtp_host?: string | null
    smtp_port?: number | null
    smtp_secure?: boolean | null
    imap_host?: string | null
    imap_port?: number | null
    imap_secure?: boolean | null
    status?: string | null
    can_read?: boolean
    can_send?: boolean
    has_access_token?: boolean
    has_refresh_token?: boolean
}

type EmailConfigState = {
    integrationId: string | null
    providerFamily: EmailProviderFamily
    authType: EmailAuthType
    readMethod: EmailReadMethod
    sendMethod: EmailSendMethod
    emailAddress: string
    username: string
    password: string
    smtpHost: string
    smtpPort: string
    smtpSecure: boolean
    imapHost: string
    imapPort: string
    imapSecure: boolean
    status: string
    canRead: boolean
    canSend: boolean
    hasAccessToken: boolean
}

const createDefaultEmailConfig = (): EmailConfigState => ({
    integrationId: null,
    providerFamily: 'generic_imap_smtp',
    authType: 'basic',
    readMethod: 'imap',
    sendMethod: 'smtp',
    emailAddress: '',
    username: '',
    password: '',
    smtpHost: '',
    smtpPort: '587',
    smtpSecure: false,
    imapHost: '',
    imapPort: '993',
    imapSecure: true,
    status: 'unknown',
    canRead: false,
    canSend: false,
    hasAccessToken: false,
})

const mapEmailIntegrationToState = (integration: EmailIntegrationRow | null): EmailConfigState => {
    if (!integration) {
        return createDefaultEmailConfig()
    }

    const providerFamily = integration.provider_family === 'microsoft365' ? 'microsoft365' : 'generic_imap_smtp'
    const smtpPort = integration.smtp_port ? String(integration.smtp_port) : providerFamily === 'microsoft365' ? '587' : ''
    const imapPort = integration.imap_port ? String(integration.imap_port) : ''

    return {
        integrationId: integration.id,
        providerFamily,
        authType:
            integration.auth_type === 'oauth2'
                ? 'oauth2'
                : integration.auth_type === 'app_password'
                    ? 'app_password'
                    : 'basic',
        readMethod:
            integration.read_method === 'graph' || integration.read_method === 'none'
                ? integration.read_method
                : integration.read_method === 'imap'
                    ? 'imap'
                    : providerFamily === 'microsoft365'
                        ? 'graph'
                        : 'imap',
        sendMethod:
            integration.send_method === 'graph' || integration.send_method === 'none'
                ? integration.send_method
                : integration.send_method === 'smtp'
                    ? 'smtp'
                    : providerFamily === 'microsoft365'
                        ? 'graph'
                        : 'smtp',
        emailAddress: integration.email_address || '',
        username: integration.username || integration.email_address || '',
        password: integration.password || '',
        smtpHost: integration.smtp_host || (providerFamily === 'microsoft365' ? 'smtp.office365.com' : ''),
        smtpPort,
        smtpSecure: integration.smtp_secure ?? false,
        imapHost: integration.imap_host || '',
        imapPort,
        imapSecure: integration.imap_secure ?? true,
        status: integration.status || 'unknown',
        canRead: !!integration.can_read,
        canSend: !!integration.can_send,
        hasAccessToken: !!integration.has_access_token,
    }
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
    const [whatsappStatusMessage, setWhatsappStatusMessage] = useState("")
    const [emailStatus, setEmailStatus] = useState<EmailUiStatus>('unknown')
    const [whatsappConfig, setWhatsappConfig] = useState({ phoneNumberId: "", accessToken: "", verifyToken: "", phoneNumber: "" })
    const [whatsappIntegrationId, setWhatsappIntegrationId] = useState<string | null>(null)
    const [assignableAgents, setAssignableAgents] = useState<AssignableAgent[]>([])
    const [assignableFlows, setAssignableFlows] = useState<AssignableFlow[]>([])
    const [selectedLinkedAgentId, setSelectedLinkedAgentId] = useState("none")
    const [selectedLinkedFlowId, setSelectedLinkedFlowId] = useState("none")
    const [automationMode, setAutomationMode] = useState<'agent' | 'flow'>('agent')
    const [emailConfig, setEmailConfig] = useState<EmailConfigState>(createDefaultEmailConfig())
    const [testingEmail, setTestingEmail] = useState(false)

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
        if (emailConfig.status === 'connected') {
            setEmailStatus('connected')
            return
        }

        if (emailConfig.status === 'error') {
            setEmailStatus('error')
            return
        }

        const hasAnyEmailConfig = !!(
            emailConfig.emailAddress.trim() ||
            emailConfig.username.trim() ||
            emailConfig.password.trim() ||
            emailConfig.smtpHost.trim() ||
            emailConfig.imapHost.trim() ||
            emailConfig.providerFamily === 'microsoft365'
        )

        if (hasAnyEmailConfig) {
            setEmailStatus('pending')
        } else {
            setEmailStatus('unknown')
        }
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

    const loadLegacyEmailConfig = async (email: string): Promise<EmailConfigState> => {
        const { data } = await supabase.rpc('sp_get_api_keys_by_email', { p_email: email })
        const legacy = createDefaultEmailConfig()

        if (Array.isArray(data)) {
            data.forEach((item: any) => {
                if (item.provider === 'email_host') legacy.smtpHost = item.api_key || ''
                if (item.provider === 'email_port') legacy.smtpPort = item.api_key ? String(item.api_key) : ''
                if (item.provider === 'email_user') {
                    legacy.username = item.api_key || ''
                    legacy.emailAddress = item.api_key || ''
                }
                if (item.provider === 'email_pass') legacy.password = item.api_key || ''
            })
        }

        legacy.status =
            legacy.smtpHost || legacy.username || legacy.password
                ? 'configured'
                : 'unknown'

        return legacy
    }

    const buildEmailPayload = () => ({
        provider_family: emailConfig.providerFamily,
        auth_type: emailConfig.providerFamily === 'microsoft365' ? 'oauth2' : emailConfig.authType,
        read_method: emailConfig.providerFamily === 'microsoft365' ? 'graph' : emailConfig.readMethod,
        send_method: emailConfig.providerFamily === 'microsoft365' ? 'graph' : emailConfig.sendMethod,
        email_address: emailConfig.emailAddress.trim() || emailConfig.username.trim() || null,
        username: emailConfig.username.trim() || emailConfig.emailAddress.trim() || null,
        password: emailConfig.password.trim() || null,
        smtp_host:
            emailConfig.providerFamily === 'microsoft365'
                ? 'smtp.office365.com'
                : emailConfig.sendMethod === 'smtp'
                    ? emailConfig.smtpHost.trim() || null
                    : null,
        smtp_port:
            emailConfig.providerFamily === 'microsoft365'
                ? 587
                : emailConfig.sendMethod === 'smtp' && emailConfig.smtpPort.trim()
                    ? parseInt(emailConfig.smtpPort, 10)
                    : null,
        smtp_secure:
            emailConfig.providerFamily === 'microsoft365'
                ? false
                : emailConfig.sendMethod === 'smtp'
                    ? emailConfig.smtpSecure
                    : null,
        imap_host:
            emailConfig.providerFamily === 'generic_imap_smtp' && emailConfig.readMethod === 'imap'
                ? emailConfig.imapHost.trim() || null
                : null,
        imap_port:
            emailConfig.providerFamily === 'generic_imap_smtp' && emailConfig.readMethod === 'imap' && emailConfig.imapPort.trim()
                ? parseInt(emailConfig.imapPort, 10)
                : null,
        imap_secure:
            emailConfig.providerFamily === 'generic_imap_smtp' && emailConfig.readMethod === 'imap'
                ? emailConfig.imapSecure
                : null,
    })

    const persistEmailIntegration = async (): Promise<EmailIntegrationRow | null> => {
        if (emailConfig.providerFamily !== 'microsoft365') {
            const login = emailConfig.username.trim() || emailConfig.emailAddress.trim()
            if (!login) {
                throw new Error('Informe ao menos o email ou usuario da integracao.')
            }

            if (emailConfig.readMethod === 'imap' && (!emailConfig.imapHost.trim() || !emailConfig.imapPort.trim())) {
                throw new Error('Preencha host e porta IMAP para habilitar a leitura da inbox.')
            }

            if (emailConfig.sendMethod === 'smtp' && (!emailConfig.smtpHost.trim() || !emailConfig.smtpPort.trim())) {
                throw new Error('Preencha host e porta SMTP para habilitar o envio de emails.')
            }

            if (!emailConfig.password.trim() && !emailConfig.integrationId) {
                throw new Error('Informe a senha ou app password para criar a integracao de email.')
            }
        }

        const savedIntegration = await saveCurrentEmailIntegration(buildEmailPayload())
        setEmailConfig(mapEmailIntegrationToState(savedIntegration))
        return savedIntegration
    }

    const loadAssignableAgents = async (email: string) => {
        try {
            const { data, error } = await supabase.rpc('sp_list_agents_by_email', {
                p_email: email
            })

            if (error) {
                throw error
            }

            const rows = Array.isArray(data) ? data : data ? [data] : []
            setAssignableAgents(rows.map((item: any) => ({
                id: String(item.id),
                nome: item.nome || 'Agente sem nome',
                status_id: item.status_id ?? null
            })))
        } catch (error) {
            console.error('[Integrations] Erro ao carregar agentes disponíveis:', error)
            setAssignableAgents([])
        }
    }

    const loadAssignableFlows = async () => {
        try {
            const response = await fetch(`${BASE_URL}/flows`, {
                method: 'GET',
                headers: await getAuthHeaders(false)
            })

            const result = await response.json().catch(() => [])

            if (!response.ok) {
                throw new Error(result?.details || result?.error || 'Erro ao carregar flows disponiveis.')
            }

            const rows = Array.isArray(result) ? result : []
            setAssignableFlows(rows.map((item: any) => ({
                id: String(item.id),
                name: item.name || 'Flow sem nome'
            })))
        } catch (error) {
            console.error('[Integrations] Erro ao carregar flows disponiveis:', error)
            setAssignableFlows([])
        }
    }

    const hasAnyWhatsappConfig = (config: typeof whatsappConfig) =>
        !!(config.phoneNumberId.trim() || config.accessToken.trim() || config.verifyToken.trim() || normalizePhoneNumber(config.phoneNumber))

    const hasCompleteWhatsappConfig = (config: typeof whatsappConfig) =>
        !!(
            config.phoneNumberId.trim() &&
            config.accessToken.trim() &&
            config.verifyToken.trim() &&
            normalizePhoneNumber(config.phoneNumber)
        )

    const fetchCurrentWhatsappIntegration = async (): Promise<WhatsAppIntegrationRow | null> => {
        const response = await fetch(`${BASE_URL}/whatsapp/integration/current`, {
            method: 'GET',
            headers: await getAuthHeaders(false)
        })

        const result = await response.json().catch(() => null)

        if (!response.ok) {
            throw new Error(result?.details || result?.error || 'Erro ao carregar integracao do WhatsApp.')
        }

        return result?.integration || null
    }

    const fetchCurrentEmailIntegration = async (): Promise<EmailIntegrationRow | null> => {
        const response = await fetch(`${BASE_URL}/email/integration/current`, {
            method: 'GET',
            headers: await getAuthHeaders(false)
        })

        const result = await response.json().catch(() => null)

        if (!response.ok) {
            throw new Error(result?.details || result?.error || 'Erro ao carregar integracao de email.')
        }

        return result?.integration || null
    }

    const saveCurrentEmailIntegration = async (payload: Record<string, unknown>): Promise<EmailIntegrationRow | null> => {
        const response = await fetch(`${BASE_URL}/email/integration/current`, {
            method: 'POST',
            headers: await getAuthHeaders(),
            body: JSON.stringify(payload)
        })

        const result = await response.json().catch(() => null)

        if (!response.ok) {
            throw new Error(result?.details || result?.error || 'Erro ao salvar integracao de email.')
        }

        return result?.integration || null
    }

    const testCurrentEmailIntegration = async () => {
        const response = await fetch(`${BASE_URL}/email/integration/current/test`, {
            method: 'POST',
            headers: await getAuthHeaders()
        })

        const result = await response.json().catch(() => null)

        if (!response.ok) {
            throw new Error(result?.details || result?.error || 'Erro ao testar integracao de email.')
        }

        return result?.result || null
    }

    const fetchMicrosoft365AuthorizeUrl = async (): Promise<string> => {
        const response = await fetch(`${BASE_URL}/email/oauth/microsoft365/authorize-url`, {
            method: 'GET',
            headers: await getAuthHeaders(false)
        })

        const result = await response.json().catch(() => null)

        if (!response.ok || !result?.authorizeUrl) {
            throw new Error(result?.details || result?.error || 'Erro ao iniciar autenticacao do Microsoft 365.')
        }

        return result.authorizeUrl
    }

    const saveCurrentWhatsappIntegration = async (payload: {
        phone_number: string | null
        app_key: string | null
        access_token: string | null
        auth_token: string | null
        linked_agent_id?: string | null
        linked_flow_id?: string | null
        automation_mode?: 'agent' | 'flow'
    }): Promise<WhatsAppIntegrationRow | null> => {
        const response = await fetch(`${BASE_URL}/whatsapp/integration/current`, {
            method: 'POST',
            headers: await getAuthHeaders(),
            body: JSON.stringify(payload)
        })

        const result = await response.json().catch(() => null)

        if (!response.ok) {
            throw new Error(result?.details || result?.error || 'Erro ao salvar integracao do WhatsApp.')
        }

        return result?.integration || null
    }

    const refreshWhatsappStatus = async (
        integrationId: string | null,
        config: typeof whatsappConfig
    ): Promise<WhatsAppValidationResult> => {
        if (!hasAnyWhatsappConfig(config)) {
            setWhatsappStatus('unknown')
            setWhatsappStatusMessage("")
            return { uiStatus: 'unknown' }
        }

        if (!hasCompleteWhatsappConfig(config) || !integrationId) {
            setWhatsappStatus('pending')
            setWhatsappStatusMessage("Preencha todos os campos para validar a conexão com a Meta.")
            return {
                uiStatus: 'pending',
                backendStatus: 'connecting',
                message: 'Preencha todos os campos para validar a conexão com a Meta.'
            }
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
                const errorResult = await response.json().catch(() => null)
                setWhatsappStatus('error')
                setWhatsappStatusMessage(errorResult?.details || errorResult?.error || 'Nao foi possivel validar a conexao com a Meta.')
                return {
                    uiStatus: 'error',
                    message: errorResult?.details || errorResult?.error || 'Nao foi possivel validar a conexao com a Meta.'
                }
            }

            const result = await response.json()
            if (result?.status === 'connected') {
                setWhatsappStatus('connected')
                setWhatsappStatusMessage(result?.message || 'WhatsApp conectado com sucesso.')
                return {
                    uiStatus: 'connected',
                    backendStatus: 'connected',
                    message: result?.message || 'WhatsApp conectado com sucesso.'
                }
            } else if (result?.status === 'connecting') {
                setWhatsappStatus('pending')
                setWhatsappStatusMessage(result?.message || 'A conexao ainda esta em validacao.')
                return {
                    uiStatus: 'pending',
                    backendStatus: 'connecting',
                    message: result?.message || 'A conexao ainda esta em validacao.'
                }
            } else {
                setWhatsappStatus('error')
                setWhatsappStatusMessage(result?.message || 'A Meta nao validou esta integracao.')
                return {
                    uiStatus: 'error',
                    backendStatus: 'disconnected',
                    message: result?.message || 'A Meta nao validou esta integracao.'
                }
            }
        } catch (error) {
            console.error('Erro ao validar status do WhatsApp:', error)
            setWhatsappStatus('error')
            setWhatsappStatusMessage('Erro ao validar a conexao com a Meta. Verifique o servidor e tente novamente.')
            return {
                uiStatus: 'error',
                message: 'Erro ao validar a conexao com a Meta. Verifique o servidor e tente novamente.'
            }
        }
    }

    const updateWhatsappConfig = (patch: Partial<typeof whatsappConfig>) => {
        setWhatsappConfig((prev) => {
            const next = { ...prev, ...patch }
            setWhatsappStatus(hasAnyWhatsappConfig(next) ? 'pending' : 'unknown')
            setWhatsappStatusMessage(hasAnyWhatsappConfig(next) ? 'Existem alteracoes pendentes de validacao.' : '')
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

    const loadConfig = async (): Promise<WhatsAppValidationResult> => {
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user?.email) return { uiStatus: 'unknown' }
            await Promise.all([
                loadAssignableAgents(user.email),
                loadAssignableFlows()
            ])
            try {
                const emailIntegration = await fetchCurrentEmailIntegration()
                setEmailConfig(mapEmailIntegrationToState(emailIntegration))
            } catch (emailError) {
                console.warn('[Integrations] Falha ao carregar email pela API nova, usando fallback legado.', emailError)
                setEmailConfig(await loadLegacyEmailConfig(user.email))
            }

            if (userId) {
                const whatsappIntegration = await fetchCurrentWhatsappIntegration()
                const whatsappList = whatsappIntegration ? [whatsappIntegration] : []

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
                setSelectedLinkedAgentId(whatsappIntegration?.linked_agent_id ? String(whatsappIntegration.linked_agent_id) : "none")
                setSelectedLinkedFlowId(whatsappIntegration?.linked_flow_id ? String(whatsappIntegration.linked_flow_id) : "none")
                setAutomationMode(whatsappIntegration?.automation_mode === 'flow' ? 'flow' : 'agent')
                return await refreshWhatsappStatus(whatsappIntegration?.id || null, nextWhatsappConfig)
            } else {
                setWhatsappIntegrationId(null)
                setSelectedLinkedAgentId("none")
                setSelectedLinkedFlowId("none")
                setAutomationMode('agent')
                setWhatsappStatus('unknown')
                setWhatsappStatusMessage("")
                return { uiStatus: 'unknown' }
            }
        } catch (e) {
            console.error(e)
            setWhatsappStatus('error')
            setWhatsappStatusMessage('Erro ao carregar a configuracao do WhatsApp.')
            return {
                uiStatus: 'error',
                message: 'Erro ao carregar a configuracao do WhatsApp.'
            }
        } finally { setLoading(false) }
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

            const isMicrosoft365 = emailConfig.providerFamily === 'microsoft365'

            // Microsoft 365 / Outlook: redireciona para OAuth; o callback conclui o salvamento
            if (isMicrosoft365) {
                if (!user?.email) {
                    toast.error(t('integrations.error.unauthorized'))
                    setSaving(false)
                    return
                }

                const authorizeUrl = await fetchMicrosoft365AuthorizeUrl()
                window.location.href = authorizeUrl
                return
            }

            if (!userId) {
                throw new Error(t('integrations.error.unauthorized'))
            }

            const normalizedPhoneNumber = normalizePhoneNumber(whatsappConfig.phoneNumber)
            const trimmedPhoneNumberId = whatsappConfig.phoneNumberId.trim()
            const trimmedAccessToken = whatsappConfig.accessToken.trim()
            const trimmedVerifyToken = whatsappConfig.verifyToken.trim()
            const normalizedAutomationMode: 'agent' | 'flow' = automationMode === 'flow' ? 'flow' : 'agent'

            if (normalizedAutomationMode === 'flow' && selectedLinkedFlowId === 'none') {
                toast.error('Selecione um flow para este numero oficial antes de salvar.')
                setSaving(false)
                return
            }

            const whatsappPayload: {
                phone_number: string | null
                app_key: string | null
                access_token: string | null
                auth_token: string | null
                linked_agent_id?: string | null
                linked_flow_id?: string | null
                automation_mode?: 'agent' | 'flow'
            } = {
                phone_number: normalizedPhoneNumber || null,
                app_key: trimmedPhoneNumberId || null,
                access_token: trimmedAccessToken || null,
                auth_token: trimmedVerifyToken || null,
                linked_agent_id: normalizedAutomationMode === 'agent' && selectedLinkedAgentId !== 'none' ? selectedLinkedAgentId : null,
                linked_flow_id: normalizedAutomationMode === 'flow' && selectedLinkedFlowId !== 'none' ? selectedLinkedFlowId : null,
                automation_mode: normalizedAutomationMode
            }

            const hasWhatsappConfig = !!(normalizedPhoneNumber || trimmedPhoneNumberId || trimmedAccessToken || trimmedVerifyToken)

            if (!hasWhatsappConfig) {
                await saveCurrentWhatsappIntegration(whatsappPayload)
                setWhatsappIntegrationId(null)
                setWhatsappStatus('unknown')
            } else {
                const savedWhatsapp = await saveCurrentWhatsappIntegration(whatsappPayload)
                setWhatsappIntegrationId(savedWhatsapp?.id || null)
            }

            const hasEmailConfig = !!(
                emailConfig.providerFamily === 'microsoft365' ||
                emailConfig.emailAddress.trim() ||
                emailConfig.username.trim() ||
                emailConfig.password.trim() ||
                emailConfig.smtpHost.trim() ||
                emailConfig.imapHost.trim()
            )

            if (hasEmailConfig) {
                if (!isMicrosoft365) {
                    await persistEmailIntegration()
                }
            }

            const validationResult = await loadConfig()

            if (hasWhatsappConfig) {
                if (validationResult.uiStatus === 'connected') {
                    toast.success('Integracao salva e validada com a Meta.')
                } else if (validationResult.uiStatus === 'pending') {
                    toast.success('Integracao salva. Falta concluir a validacao com a Meta.')
                } else if (validationResult.uiStatus === 'error') {
                    toast.info(validationResult.message || 'Integracao salva, mas a Meta nao validou a conexao.')
                } else {
                    toast.success(t('integrations.success.save'))
                }
            } else {
                toast.success(t('integrations.success.save'))
            }
        } catch (error: any) {
            console.error("Erro ao salvar integrações:", error)
            toast.error(error.message || t('integrations.error.save'))
        } finally {
            setSaving(false)
        }
    }

    const handleTestEmailConnection = async () => {
        setTestingEmail(true)
        try {
            if (emailConfig.providerFamily !== 'microsoft365') {
                await persistEmailIntegration()
            } else if (!emailConfig.integrationId && !emailConfig.hasAccessToken) {
                throw new Error('Conecte primeiro a conta Microsoft 365 antes de testar.')
            }

            const result = await testCurrentEmailIntegration()
            setEmailConfig((prev) => ({
                ...prev,
                status: result?.success ? 'connected' : 'error',
                canRead: !!result?.capabilities?.canRead,
                canSend: !!result?.capabilities?.canSend,
            }))

            if (result?.success) {
                toast.success(result?.details || 'Conexao de email validada com sucesso.')
            } else {
                toast.error(result?.details || 'A integracao de email nao respondeu como esperado.')
            }

            await loadConfig()
        } catch (error: any) {
            console.error('[Integrations] Erro ao testar email:', error)
            setEmailConfig((prev) => ({ ...prev, status: 'error' }))
            toast.error(error.message || 'Nao foi possivel testar a integracao de email.')
        } finally {
            setTestingEmail(false)
        }
    }

    const handleEmailProviderChange = (value: EmailProviderFamily) => {
        setEmailConfig((prev) => {
            if (value === 'microsoft365') {
                return {
                    ...prev,
                    providerFamily: 'microsoft365',
                    authType: 'oauth2',
                    readMethod: 'graph',
                    sendMethod: 'graph',
                    smtpHost: 'smtp.office365.com',
                    smtpPort: '587',
                    smtpSecure: false,
                    imapHost: '',
                    imapPort: '',
                    imapSecure: true,
                    status: prev.hasAccessToken ? 'connected' : 'configured',
                }
            }

            return {
                ...prev,
                providerFamily: 'generic_imap_smtp',
                authType: prev.authType === 'oauth2' ? 'basic' : prev.authType,
                readMethod: prev.readMethod === 'graph' ? 'imap' : prev.readMethod,
                sendMethod: prev.sendMethod === 'graph' ? 'smtp' : prev.sendMethod,
                smtpHost: prev.smtpHost === 'smtp.office365.com' ? '' : prev.smtpHost,
                smtpPort: prev.smtpPort === '587' && prev.smtpHost === 'smtp.office365.com' ? '' : prev.smtpPort,
                status: 'configured',
            }
        })
    }

    const getStatusBadge = (status: string) => {
        if (status === 'connected') {
            return (
                <Badge className="border-none font-black text-[9px] px-3 gap-1.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/55 dark:text-emerald-400">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse dark:bg-emerald-400" />
                    {t('integrations.crm.connected')}
                </Badge>
            )
        }
        if (status === 'pending') {
            return <Badge className="border-none font-black text-[9px] px-3 bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">PENDENTE</Badge>
        }
        if (status === 'error') {
            return <Badge className="border-none font-black text-[9px] px-3 bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">ERRO</Badge>
        }
        return null
    }

    const isDark = theme === 'dark'
    const integrationCardStyle: React.CSSProperties = {
        borderRadius: '2.5rem',
        backgroundColor: isDark ? '#18181b' : '#ffffff',
        border: isDark ? '1px solid rgba(63, 63, 70, 0.5)' : '1px solid rgb(228 228 231)',
        boxShadow: isDark
            ? '0 12px 32px -12px rgba(0, 0, 0, 0.45)'
            : '0 10px 25px -5px rgba(0, 0, 0, 0.06), 0 4px 6px -2px rgba(0, 0, 0, 0.04)',
    }
    const inputSurface: React.CSSProperties = isDark
        ? { backgroundColor: '#27272a', borderColor: '#3f3f46', color: '#fafafa' }
        : { backgroundColor: '#f8fafc', borderColor: '#e2e8f0', color: '#1e293b' }

    if (loading || !translationsReady) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>

    return (
        <div className="space-y-10 pb-24 animate-in fade-in duration-500 bg-[#F8FAFC] dark:bg-background min-h-screen -m-4 p-8">
            
            {/* HEADER DA PÁGINA */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-4">
                <div>
                    <h2 className="text-4xl font-black tracking-tighter leading-none" style={{ color: theme === 'dark' ? '#fafafa' : '#0f172a' }}>{t('integrations.title')}</h2>
                    <p className="font-medium mt-2 uppercase text-[10px] tracking-[0.3em]" style={{ color: theme === 'dark' ? '#a1a1aa' : '#64748b' }}>{t('integrations.subtitle')}</p>
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
                    className="border-none overflow-hidden transition-all hover:shadow-xl hover:shadow-slate-300/40 dark:hover:shadow-black/40"
                    style={integrationCardStyle}
                >
                    <div className="p-8 border-b border-zinc-200 dark:border-zinc-700/80">
                        <div className="flex items-center gap-6">
                            <div 
                                className="rounded-2xl flex items-center justify-center shadow-md"
                                style={{ backgroundColor: isDark ? 'rgba(147, 51, 234, 0.18)' : '#f3e8ff', width: '64px', height: '64px' }}
                            >
                                <Database size={32} color="#9333ea" strokeWidth={2.5} />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-xl font-black tracking-tight mb-2" style={{ color: theme === 'dark' ? '#fafafa' : '#0f172a' }}>{t('integrations.crm.title')}</h3>
                                <div className="mb-2">
                                    {crmIntegrations.length > 0 && getStatusBadge('connected')}
                                </div>
                                <p className="text-sm font-medium" style={{ color: theme === 'dark' ? '#a1a1aa' : '#64748b' }}>{t('integrations.crm.description')}</p>
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
                                            backgroundColor: isDark ? '#27272a' : '#f8fafc',
                                            borderColor: isDark ? '#3f3f46' : '#e2e8f0'
                                        }}
                                    >
                                        <div className="flex items-center gap-4">
                                            <Database size={20} color="#9333ea" style={{ marginLeft: '8px' }} />
                                            <span className="font-bold" style={{ color: theme === 'dark' ? '#fafafa' : '#1e293b' }}>{integration.tb_crms?.name}</span>
                                        </div>
                                        <Button variant="ghost" size="icon" onClick={() => handleDeleteCRM(integration.id, integration.tb_crms?.name)} className="opacity-0 group-hover:opacity-100 text-red-500 rounded-full hover:bg-red-50 dark:hover:bg-red-950/40">
                                            <Trash2 size={18} />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div 
                                className="py-12 text-center border-2 border-dashed rounded-2xl"
                                style={{
                                    borderColor: isDark ? '#3f3f46' : '#e2e8f0',
                                    backgroundColor: isDark ? 'rgba(39, 39, 42, 0.35)' : 'rgba(248, 250, 252, 0.5)'
                                }}
                            >
                                <p className="text-sm font-medium" style={{ color: theme === 'dark' ? '#a1a1aa' : '#94a3b8' }}>Nenhum cérebro de dados conectado</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* 2. CARD WHATSAPP - VERDE */}
                <Card 
                    className="border-none overflow-hidden transition-all hover:shadow-xl hover:shadow-slate-300/40 dark:hover:shadow-black/40"
                    style={integrationCardStyle}
                >
                    <div className="p-8 border-b border-zinc-200 dark:border-zinc-700/80">
                        <div className="flex items-center gap-6">
                            <div 
                                className="rounded-2xl flex items-center justify-center shadow-md"
                                style={{ backgroundColor: isDark ? 'rgba(16, 185, 129, 0.18)' : '#d1fae5', width: '64px', height: '64px' }}
                            >
                                <MessageCircle size={32} color="#10b981" strokeWidth={2.5} />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-xl font-black tracking-tight mb-2" style={{ color: theme === 'dark' ? '#fafafa' : '#0f172a' }}>{t('integrations.whatsapp.title')}</h3>
                                <div className="mb-2">
                                    {getStatusBadge(whatsappStatus)}
                                </div>
                                <p className="text-sm font-medium" style={{ color: theme === 'dark' ? '#a1a1aa' : '#64748b' }}>
                                    Integre o numero oficial da Meta para testar mensagens reais com os agentes da plataforma.
                                </p>
                                {whatsappStatusMessage && (
                                    <p className="mt-3 text-sm leading-relaxed" style={{ color: whatsappStatus === 'error' ? '#fb7185' : theme === 'dark' ? '#a1a1aa' : '#64748b' }}>
                                        {whatsappStatusMessage}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                    <CardContent className="p-8">
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold" style={{ color: theme === "dark" ? "#d4d4d8" : "#475569" }}>Phone Number ID</Label>
                                <Input value={whatsappConfig.phoneNumberId} onChange={(e) => updateWhatsappConfig({ phoneNumberId: e.target.value })} className="h-12 rounded-xl border px-4 font-mono text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" style={inputSurface} />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold" style={{ color: theme === "dark" ? "#d4d4d8" : "#475569" }}>Access Token</Label>
                                <Input type="password" value={whatsappConfig.accessToken} onChange={(e) => updateWhatsappConfig({ accessToken: e.target.value })} className="h-12 rounded-xl border px-4 font-mono text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" style={inputSurface} />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold" style={{ color: theme === "dark" ? "#d4d4d8" : "#475569" }}>Verify Token</Label>
                                <Input value={whatsappConfig.verifyToken} onChange={(e) => updateWhatsappConfig({ verifyToken: e.target.value })} className="h-12 rounded-xl border px-4 font-mono text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" style={inputSurface} />
                                <p className="text-xs" style={{ color: theme === "dark" ? "#a1a1aa" : "#64748b" }}>
                                    Esse valor pode ser criado por voce e deve ser o mesmo usado na verificacao do webhook da Meta.
                                </p>
                            </div>
                            <div className="space-y-2 md:col-span-2 max-w-md">
                                <Label className="text-xs font-semibold" style={{ color: theme === "dark" ? "#d4d4d8" : "#475569" }}>Numero oficial da Meta</Label>
                                <Input placeholder="+1 555-899-1881" value={whatsappConfig.phoneNumber} onChange={(e) => updateWhatsappConfig({ phoneNumber: e.target.value })} className="h-12 rounded-xl border px-4 font-semibold focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" style={inputSurface} />
                                <p className="text-xs" style={{ color: theme === "dark" ? "#a1a1aa" : "#64748b" }}>
                                    Os dados sao salvos em tb_integrations como provider=whatsapp, phone_number, app_key, access_token e auth_token.
                                </p>
                                <p className="text-xs" style={{ color: theme === "dark" ? "#a1a1aa" : "#64748b" }}>
                                    Configure na Meta o callback GET/POST /whatsapp/webhook para este numero oficial.
                                </p>
                            </div>
                            <div
                                className="space-y-4 md:col-span-2 rounded-2xl border p-5"
                                style={{
                                    backgroundColor: isDark ? '#27272a' : 'rgba(248, 250, 252, 0.85)',
                                    borderColor: isDark ? '#3f3f46' : '#e2e8f0'
                                }}
                            >
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold" style={{ color: theme === "dark" ? "#d4d4d8" : "#475569" }}>Como este numero deve responder</Label>
                                    <Select value={automationMode} onValueChange={(value: 'agent' | 'flow') => setAutomationMode(value)}>
                                        <SelectTrigger
                                            className="h-12 rounded-xl border px-4 font-semibold focus:ring-2 focus:ring-emerald-500/20"
                                            style={inputSurface}
                                        >
                                            <SelectValue placeholder="Escolha a automacao principal" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                            <SelectItem value="agent">Agente existente</SelectItem>
                                            <SelectItem value="flow">Flow</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs leading-relaxed" style={{ color: theme === "dark" ? "#a1a1aa" : "#64748b" }}>
                                        A Meta envia tudo para um unico webhook. Aqui voce escolhe qual automacao principal esse numero oficial vai usar quando chegar uma nova mensagem.
                                    </p>
                                </div>

                                {automationMode === 'agent' ? (
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold" style={{ color: theme === "dark" ? "#d4d4d8" : "#475569" }}>Agente alocado a este numero</Label>
                                        <Select value={selectedLinkedAgentId} onValueChange={setSelectedLinkedAgentId}>
                                            <SelectTrigger
                                                className="h-12 rounded-xl border px-4 font-semibold focus:ring-2 focus:ring-emerald-500/20"
                                                style={inputSurface}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <Bot className="h-4 w-4 shrink-0 text-emerald-500" />
                                                    <SelectValue placeholder="Selecione o agente que atendera este numero" />
                                                </div>
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                <SelectItem value="none">Nenhum agente alocado</SelectItem>
                                                {assignableAgents.map((agent) => (
                                                    <SelectItem key={agent.id} value={agent.id}>
                                                        {agent.nome}
                                                        {agent.status_id === 1 ? ' • ativo' : agent.status_id === 3 || agent.status_id === 4 ? ' • pausado' : agent.status_id === 2 ? ' • cancelado' : ''}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-xs leading-relaxed" style={{ color: theme === "dark" ? "#a1a1aa" : "#64748b" }}>
                                            Use este modo quando quiser manter o comportamento atual: WhatsApp entra no webhook e o agente responde diretamente.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold" style={{ color: theme === "dark" ? "#d4d4d8" : "#475569" }}>Flow alocado a este numero</Label>
                                        <Select value={selectedLinkedFlowId} onValueChange={setSelectedLinkedFlowId}>
                                            <SelectTrigger
                                                className="h-12 rounded-xl border px-4 font-semibold focus:ring-2 focus:ring-emerald-500/20"
                                                style={inputSurface}
                                            >
                                                <SelectValue placeholder="Selecione o flow que atendera este numero" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                <SelectItem value="none">Nenhum flow alocado</SelectItem>
                                                {assignableFlows.map((flow) => (
                                                    <SelectItem key={flow.id} value={flow.id}>
                                                        {flow.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-xs leading-relaxed" style={{ color: theme === "dark" ? "#a1a1aa" : "#64748b" }}>
                                            Use este modo quando quiser que o WhatsApp entre primeiro no motor de flows. O mesmo flow pode ser testado no laboratorio e reutilizado em producao.
                                        </p>
                                    </div>
                                )}
                            </div>
                            {false && (
                            <div className="space-y-2 md:col-span-2">
                                <Label className="text-xs font-semibold" style={{ color: theme === "dark" ? "#d4d4d8" : "#475569" }}>Agente alocado a este numero</Label>
                                <Select value={selectedLinkedAgentId} onValueChange={setSelectedLinkedAgentId}>
                                    <SelectTrigger
                                        className="h-12 rounded-xl border px-4 font-semibold focus:ring-2 focus:ring-emerald-500/20"
                                        style={inputSurface}
                                    >
                                        <div className="flex items-center gap-3">
                                            <Bot className="h-4 w-4 shrink-0 text-emerald-500" />
                                            <SelectValue placeholder="Selecione o agente que atendera este numero" />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="none">Nenhum agente alocado</SelectItem>
                                        {assignableAgents.map((agent) => (
                                            <SelectItem key={agent.id} value={agent.id}>
                                                {agent.nome}
                                                {agent.status_id === 1 ? ' • ativo' : agent.status_id === 3 || agent.status_id === 4 ? ' • pausado' : agent.status_id === 2 ? ' • cancelado' : ''}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs" style={{ color: theme === "dark" ? "#a1a1aa" : "#64748b" }}>
                                    O agente escolhido passa a atender automaticamente este numero oficial no WhatsApp. Se nenhum agente for selecionado, as mensagens continuam entrando, mas ficam sem atendimento automatico.
                                </p>
                            </div>
                            )}
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
                    className="border-none overflow-hidden transition-all hover:shadow-xl hover:shadow-slate-300/40 dark:hover:shadow-black/40"
                    style={integrationCardStyle}
                >
                    <div className="p-8 border-b border-zinc-200 dark:border-zinc-700/80">
                        <div className="flex items-center gap-6">
                            <div 
                                className="rounded-2xl flex items-center justify-center shadow-md"
                                style={{ backgroundColor: isDark ? 'rgba(249, 115, 22, 0.18)' : '#fed7aa', width: '64px', height: '64px' }}
                            >
                                <Mail size={32} color="#f97316" strokeWidth={2.5} />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-xl font-black tracking-tight mb-2" style={{ color: theme === 'dark' ? '#fafafa' : '#0f172a' }}>{t('integrations.email.title')}</h3>
                                <div className="mb-2">
                                    {getStatusBadge(emailStatus)}
                                </div>
                                <p className="text-sm font-medium" style={{ color: theme === 'dark' ? '#a1a1aa' : '#64748b' }}>{t('integrations.email.description')}</p>
                            </div>
                        </div>
                    </div>
                    <CardContent className="p-8 space-y-6">
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold" style={{ color: theme === 'dark' ? '#d4d4d8' : '#475569' }}>Modo da integração</Label>
                                <Select value={emailConfig.providerFamily} onValueChange={(value: EmailProviderFamily) => handleEmailProviderChange(value)}>
                                    <SelectTrigger className="h-12 rounded-xl border px-4 font-semibold focus:ring-2 focus:ring-orange-500/20" style={inputSurface}>
                                        <SelectValue placeholder="Escolha o tipo de integração" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="microsoft365">Microsoft 365 / Outlook</SelectItem>
                                        <SelectItem value="generic_imap_smtp">IMAP + SMTP genérico</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-semibold" style={{ color: theme === 'dark' ? '#d4d4d8' : '#475569' }}>Email principal</Label>
                                <Input
                                    value={emailConfig.emailAddress}
                                    onChange={(e) => setEmailConfig((p) => ({ ...p, emailAddress: e.target.value, status: 'configured' }))}
                                    className="h-12 rounded-xl border px-4 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                                    style={inputSurface}
                                    placeholder="contato@suaempresa.com"
                                />
                            </div>
                        </div>

                        {emailConfig.providerFamily === 'microsoft365' ? (
                            <div
                                className="rounded-2xl border p-5 space-y-3"
                                style={{
                                    backgroundColor: isDark ? '#27272a' : 'rgba(255, 247, 237, 0.9)',
                                    borderColor: isDark ? '#3f3f46' : '#fdba74'
                                }}
                            >
                                <p className="text-sm font-semibold" style={{ color: theme === 'dark' ? '#fdba74' : '#9a3412' }}>
                                    Esse modo usa Microsoft Graph para leitura e envio. A autenticação é feita por OAuth e a mailbox real é sincronizada após o login.
                                </p>
                                <div className="grid md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold" style={{ color: theme === 'dark' ? '#d4d4d8' : '#475569' }}>SMTP host</Label>
                                        <Input value="smtp.office365.com" readOnly className="h-12 rounded-xl border px-4" style={inputSurface} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold" style={{ color: theme === 'dark' ? '#d4d4d8' : '#475569' }}>SMTP porta</Label>
                                        <Input value="587" readOnly className="h-12 rounded-xl border px-4 max-w-[150px]" style={inputSurface} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold" style={{ color: theme === 'dark' ? '#d4d4d8' : '#475569' }}>Status OAuth</Label>
                                        <div className="h-12 rounded-xl border px-4 flex items-center font-semibold" style={inputSurface}>
                                            {emailConfig.hasAccessToken ? 'Conta Microsoft conectada' : 'Aguardando conexão OAuth'}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    <Button
                                        onClick={handleSaveAll}
                                        disabled={saving}
                                        className="rounded-2xl px-6 h-11 font-black uppercase text-[10px] tracking-widest shadow-xl transition-all"
                                        style={{
                                            background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                                            color: 'white',
                                            border: 'none'
                                        }}
                                    >
                                        {saving ? <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'white' }} /> : 'Conectar Microsoft 365'}
                                    </Button>
                                    {emailConfig.integrationId && (
                                        <Button
                                            variant="outline"
                                            onClick={handleTestEmailConnection}
                                            disabled={testingEmail}
                                            className="rounded-2xl px-6 h-11 font-black uppercase text-[10px] tracking-widest"
                                        >
                                            {testingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Testar conexão'}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold" style={{ color: theme === 'dark' ? '#d4d4d8' : '#475569' }}>Usuário / login</Label>
                                        <Input
                                            value={emailConfig.username}
                                            onChange={(e) => setEmailConfig((p) => ({ ...p, username: e.target.value, status: 'configured' }))}
                                            className="h-12 rounded-xl border px-4 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                                            style={inputSurface}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold" style={{ color: theme === 'dark' ? '#d4d4d8' : '#475569' }}>Senha / app password</Label>
                                        <Input
                                            type="password"
                                            value={emailConfig.password}
                                            onChange={(e) => setEmailConfig((p) => ({ ...p, password: e.target.value, status: 'configured' }))}
                                            className="h-12 rounded-xl border px-4 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                                            style={inputSurface}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold" style={{ color: theme === 'dark' ? '#d4d4d8' : '#475569' }}>Autenticação</Label>
                                        <Select value={emailConfig.authType} onValueChange={(value: EmailAuthType) => setEmailConfig((p) => ({ ...p, authType: value, status: 'configured' }))}>
                                            <SelectTrigger className="h-12 rounded-xl border px-4 font-semibold focus:ring-2 focus:ring-orange-500/20" style={inputSurface}>
                                                <SelectValue placeholder="Tipo de autenticação" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                <SelectItem value="basic">Senha comum</SelectItem>
                                                <SelectItem value="app_password">App password</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold" style={{ color: theme === 'dark' ? '#d4d4d8' : '#475569' }}>Capacidades</Label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <Select value={emailConfig.sendMethod} onValueChange={(value: EmailSendMethod) => setEmailConfig((p) => ({ ...p, sendMethod: value, status: 'configured' }))}>
                                                <SelectTrigger className="h-12 rounded-xl border px-4 font-semibold focus:ring-2 focus:ring-orange-500/20" style={inputSurface}>
                                                    <SelectValue placeholder="Envio" />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl">
                                                    <SelectItem value="smtp">Enviar por SMTP</SelectItem>
                                                    <SelectItem value="none">Sem envio</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <Select value={emailConfig.readMethod} onValueChange={(value: EmailReadMethod) => setEmailConfig((p) => ({ ...p, readMethod: value, status: 'configured' }))}>
                                                <SelectTrigger className="h-12 rounded-xl border px-4 font-semibold focus:ring-2 focus:ring-orange-500/20" style={inputSurface}>
                                                    <SelectValue placeholder="Leitura" />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl">
                                                    <SelectItem value="imap">Ler inbox por IMAP</SelectItem>
                                                    <SelectItem value="none">Sem leitura</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>

                                {emailConfig.sendMethod === 'smtp' && (
                                    <div
                                        className="rounded-2xl border p-5 space-y-4"
                                        style={{
                                            backgroundColor: isDark ? '#27272a' : 'rgba(255, 247, 237, 0.6)',
                                            borderColor: isDark ? '#3f3f46' : '#fdba74'
                                        }}
                                    >
                                        <p className="text-sm font-semibold" style={{ color: theme === 'dark' ? '#fdba74' : '#9a3412' }}>Configuração de envio SMTP</p>
                                        <div className="grid md:grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs font-semibold" style={{ color: theme === 'dark' ? '#d4d4d8' : '#475569' }}>SMTP host</Label>
                                                <Input value={emailConfig.smtpHost} onChange={(e) => setEmailConfig((p) => ({ ...p, smtpHost: e.target.value, status: 'configured' }))} className="h-12 rounded-xl border px-4 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20" style={inputSurface} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs font-semibold" style={{ color: theme === 'dark' ? '#d4d4d8' : '#475569' }}>SMTP porta</Label>
                                                <Input value={emailConfig.smtpPort} onChange={(e) => setEmailConfig((p) => ({ ...p, smtpPort: e.target.value, status: 'configured' }))} className="h-12 rounded-xl border px-4 max-w-[150px] focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20" style={inputSurface} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs font-semibold" style={{ color: theme === 'dark' ? '#d4d4d8' : '#475569' }}>SMTP segurança</Label>
                                                <Select value={emailConfig.smtpSecure ? 'true' : 'false'} onValueChange={(value) => setEmailConfig((p) => ({ ...p, smtpSecure: value === 'true', status: 'configured' }))}>
                                                    <SelectTrigger className="h-12 rounded-xl border px-4 font-semibold focus:ring-2 focus:ring-orange-500/20" style={inputSurface}>
                                                        <SelectValue placeholder="Segurança SMTP" />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-xl">
                                                        <SelectItem value="false">STARTTLS / inseguro</SelectItem>
                                                        <SelectItem value="true">SSL / seguro</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {emailConfig.readMethod === 'imap' && (
                                    <div
                                        className="rounded-2xl border p-5 space-y-4"
                                        style={{
                                            backgroundColor: isDark ? '#27272a' : 'rgba(255, 247, 237, 0.6)',
                                            borderColor: isDark ? '#3f3f46' : '#fdba74'
                                        }}
                                    >
                                        <p className="text-sm font-semibold" style={{ color: theme === 'dark' ? '#fdba74' : '#9a3412' }}>Configuração de leitura IMAP</p>
                                        <div className="grid md:grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs font-semibold" style={{ color: theme === 'dark' ? '#d4d4d8' : '#475569' }}>IMAP host</Label>
                                                <Input value={emailConfig.imapHost} onChange={(e) => setEmailConfig((p) => ({ ...p, imapHost: e.target.value, status: 'configured' }))} className="h-12 rounded-xl border px-4 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20" style={inputSurface} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs font-semibold" style={{ color: theme === 'dark' ? '#d4d4d8' : '#475569' }}>IMAP porta</Label>
                                                <Input value={emailConfig.imapPort} onChange={(e) => setEmailConfig((p) => ({ ...p, imapPort: e.target.value, status: 'configured' }))} className="h-12 rounded-xl border px-4 max-w-[150px] focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20" style={inputSurface} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs font-semibold" style={{ color: theme === 'dark' ? '#d4d4d8' : '#475569' }}>IMAP segurança</Label>
                                                <Select value={emailConfig.imapSecure ? 'true' : 'false'} onValueChange={(value) => setEmailConfig((p) => ({ ...p, imapSecure: value === 'true', status: 'configured' }))}>
                                                    <SelectTrigger className="h-12 rounded-xl border px-4 font-semibold focus:ring-2 focus:ring-orange-500/20" style={inputSurface}>
                                                        <SelectValue placeholder="Segurança IMAP" />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-xl">
                                                        <SelectItem value="true">SSL / seguro</SelectItem>
                                                        <SelectItem value="false">STARTTLS / inseguro</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-5" style={{ backgroundColor: isDark ? '#27272a' : '#f8fafc', borderColor: isDark ? '#3f3f46' : '#e2e8f0' }}>
                                    <div className="space-y-1">
                                        <p className="text-sm font-semibold" style={{ color: theme === 'dark' ? '#fafafa' : '#0f172a' }}>
                                            {emailConfig.canRead || emailConfig.canSend
                                                ? `Pronto para ${emailConfig.canRead ? 'ler' : ''}${emailConfig.canRead && emailConfig.canSend ? ' e ' : ''}${emailConfig.canSend ? 'enviar' : ''} emails`
                                                : 'Salve e teste para validar a integração'}
                                        </p>
                                        <p className="text-xs" style={{ color: theme === 'dark' ? '#a1a1aa' : '#64748b' }}>
                                            A leitura e o envio são configurados separadamente. Você pode usar só SMTP, só IMAP ou os dois.
                                        </p>
                                    </div>
                                    <Button variant="outline" onClick={handleTestEmailConnection} disabled={testingEmail || saving} className="rounded-2xl px-6 h-11 font-black uppercase text-[10px] tracking-widest">
                                        {testingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Testar conexão'}
                                    </Button>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* 4. CARD VOZ - EM BREVE */}
                <Card 
                    className="border-none overflow-hidden transition-all"
                    style={{ 
                        ...integrationCardStyle,
                        opacity: 0.65,
                    }}
                >
                    <div className="p-8 border-b border-zinc-200 dark:border-zinc-700/80">
                        <div className="flex items-center gap-6">
                            <div 
                                className="rounded-2xl flex items-center justify-center shadow-md"
                                style={{ backgroundColor: isDark ? 'rgba(99, 102, 241, 0.18)' : '#e0e7ff', width: '64px', height: '64px' }}
                            >
                                <Phone size={32} color="#6366f1" strokeWidth={2.5} />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-xl font-black tracking-tight mb-2" style={{ color: theme === 'dark' ? '#fafafa' : '#0f172a' }}>{t('integrations.voice.title')}</h3>
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
                                <p className="text-sm font-medium" style={{ color: theme === 'dark' ? '#a1a1aa' : '#64748b' }}>{t('integrations.voice.description')}</p>
                            </div>
                        </div>
                    </div>
                    <CardContent className="p-8">
                        <div className="py-8 text-center">
                            <div className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-full border ${isDark ? 'bg-zinc-800/80 text-zinc-200 border-zinc-600/60' : 'bg-indigo-50/50 text-indigo-700 border-indigo-200/50'}`}>
                                <Clock className="h-4 w-4" />
                                {t('integrations.voice.comingSoon')}
                            </div>
                            <p className={`text-xs mt-3 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>{t('integrations.voice.comingSoonDescription')}</p>
                        </div>
                    </CardContent>
                </Card>

            </div>
        </div>
    )
}
