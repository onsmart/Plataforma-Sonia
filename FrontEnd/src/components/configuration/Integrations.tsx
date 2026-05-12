import React, { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Button } from "../ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { toast } from "sonner"
import { ChevronDown, Loader2, MessageCircle, Phone, Mail, Save, Server, Database, Plus, Trash2, Clock, Bot } from "lucide-react"
import { Badge } from "../ui/badge"
import { supabase } from "../../utils/supabase/client"
import { useAuth } from "../../contexts/AuthContext"
import { CRMIntegrationSheet } from "./CRMIntegrationSheet"
import { useTheme } from "next-themes"
import { useTranslation } from "react-i18next"
import i18n from "../../i18n/config"
import { BASE_URL, getAuthHeaders } from "../../services/api"

const MICROSOFT_365_CONNECTED_EVENTS = new Set(['outlook-connected', 'microsoft365-connected'])
const SUPPORTED_CRM_SLUGS = new Set(['hubspot', 'mailchimp'])

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
type EmailProviderPreset = 'gmail' | 'microsoft365' | 'outlook_personal' | 'hotmail' | 'yahoo' | 'custom' | 'generic_imap_smtp'
type EmailAuthType = 'oauth2' | 'basic' | 'app_password'
type EmailReadMethod = 'graph' | 'imap' | 'none'
type EmailSendMethod = 'graph' | 'smtp' | 'none'
type EmailUiStatus = 'connected' | 'pending' | 'error' | 'unknown'

type EmailIntegrationRow = {
    id: string
    provider?: string | null
    provider_preset?: EmailProviderPreset | null
    provider_family?: EmailProviderFamily | null
    auth_type?: EmailAuthType | null
    read_method?: EmailReadMethod | null
    send_method?: EmailSendMethod | null
    email_address?: string | null
    username?: string | null
    oauth_client_id?: string | null
    oauth_redirect_uri?: string | null
    oauth_tenant_id?: string | null
    smtp_host?: string | null
    smtp_port?: number | null
    smtp_secure?: boolean | null
    imap_host?: string | null
    imap_port?: number | null
    imap_secure?: boolean | null
    status?: string | null
    can_read?: boolean
    can_send?: boolean
    is_default?: boolean
    is_active?: boolean
    has_password?: boolean
    has_oauth_client_secret?: boolean
    has_access_token?: boolean
    has_refresh_token?: boolean
    last_test_at?: string | null
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
    oauthClientId: string
    oauthClientSecret: string
    oauthRedirectUri: string
    oauthTenantId: string
    hasOAuthClientSecret: boolean
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

const EMAIL_PROVIDER_PRESETS: Record<EmailProviderPreset, {
    label: string
    providerFamily: EmailProviderFamily
    authType: EmailAuthType
    readMethod: EmailReadMethod
    sendMethod: EmailSendMethod
    smtpHost: string
    smtpPort: string
    smtpSecure: boolean
    imapHost: string
    imapPort: string
    imapSecure: boolean
}> = {
    gmail: {
        label: 'Gmail',
        providerFamily: 'generic_imap_smtp',
        authType: 'app_password',
        readMethod: 'imap',
        sendMethod: 'smtp',
        smtpHost: 'smtp.gmail.com',
        smtpPort: '587',
        smtpSecure: false,
        imapHost: 'imap.gmail.com',
        imapPort: '993',
        imapSecure: true,
    },
    microsoft365: {
        label: 'Microsoft 365 / Outlook',
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
    },
    outlook_personal: {
        label: 'Outlook.com pessoal',
        providerFamily: 'generic_imap_smtp',
        authType: 'app_password',
        readMethod: 'imap',
        sendMethod: 'smtp',
        smtpHost: 'smtp-mail.outlook.com',
        smtpPort: '587',
        smtpSecure: false,
        imapHost: 'outlook.office365.com',
        imapPort: '993',
        imapSecure: true,
    },
    hotmail: {
        label: 'Hotmail pessoal',
        providerFamily: 'generic_imap_smtp',
        authType: 'app_password',
        readMethod: 'imap',
        sendMethod: 'smtp',
        smtpHost: 'smtp-mail.outlook.com',
        smtpPort: '587',
        smtpSecure: false,
        imapHost: 'outlook.office365.com',
        imapPort: '993',
        imapSecure: true,
    },
    yahoo: {
        label: 'Yahoo Mail',
        providerFamily: 'generic_imap_smtp',
        authType: 'app_password',
        readMethod: 'imap',
        sendMethod: 'smtp',
        smtpHost: 'smtp.mail.yahoo.com',
        smtpPort: '587',
        smtpSecure: false,
        imapHost: 'imap.mail.yahoo.com',
        imapPort: '993',
        imapSecure: true,
    },
    custom: {
        label: 'IMAP/SMTP personalizado',
        providerFamily: 'generic_imap_smtp',
        authType: 'basic',
        readMethod: 'imap',
        sendMethod: 'smtp',
        smtpHost: '',
        smtpPort: '587',
        smtpSecure: false,
        imapHost: '',
        imapPort: '993',
        imapSecure: true,
    },
    generic_imap_smtp: {
        label: 'IMAP/SMTP personalizado',
        providerFamily: 'generic_imap_smtp',
        authType: 'basic',
        readMethod: 'imap',
        sendMethod: 'smtp',
        smtpHost: '',
        smtpPort: '587',
        smtpSecure: false,
        imapHost: '',
        imapPort: '993',
        imapSecure: true,
    },
}

const detectEmailPreset = (config: Partial<EmailConfigState>): EmailProviderPreset => {
    if (config.providerFamily === 'microsoft365') return 'microsoft365'
    if (
        String(config.smtpHost || '').trim().toLowerCase() === 'smtp.gmail.com' &&
        String(config.imapHost || '').trim().toLowerCase() === 'imap.gmail.com'
    ) {
        return 'gmail'
    }
    if (
        String(config.smtpHost || '').trim().toLowerCase() === 'smtp-mail.outlook.com' &&
        String(config.imapHost || '').trim().toLowerCase() === 'outlook.office365.com'
    ) {
        const email = String(config.emailAddress || config.username || '').trim().toLowerCase()
        if (email.endsWith('@hotmail.com') || email.endsWith('@live.com')) return 'hotmail'
        return 'outlook_personal'
    }
    if (
        String(config.smtpHost || '').trim().toLowerCase() === 'smtp.mail.yahoo.com' &&
        String(config.imapHost || '').trim().toLowerCase() === 'imap.mail.yahoo.com'
    ) {
        return 'yahoo'
    }
    return 'custom'
}

type WhatsAppConfigState = {
    phoneNumberId: string
    accessToken: string
    verifyToken: string
    phoneNumber: string
}

type VoiceRuntimeStatus = {
    provider: string
    supportsRealtimeCalls: boolean
    gatewayConfigured: boolean
    mediaAdapter: string
}

const createDefaultEmailConfig = (): EmailConfigState => ({
    integrationId: null,
    providerFamily: 'generic_imap_smtp',
    authType: 'app_password',
    readMethod: 'imap',
    sendMethod: 'smtp',
    emailAddress: '',
    username: '',
    password: '',
    oauthClientId: '',
    oauthClientSecret: '',
    oauthRedirectUri: '',
    oauthTenantId: 'common',
    hasOAuthClientSecret: false,
    smtpHost: 'smtp.gmail.com',
    smtpPort: '587',
    smtpSecure: false,
    imapHost: 'imap.gmail.com',
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
        password: '',
        oauthClientId: integration.oauth_client_id || '',
        oauthClientSecret: '',
        oauthRedirectUri: integration.oauth_redirect_uri || '',
        oauthTenantId: integration.oauth_tenant_id || 'common',
        hasOAuthClientSecret: !!integration.has_oauth_client_secret,
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
    const [expandedCRMIntegrationId, setExpandedCRMIntegrationId] = useState<string | null>(null)
    const [isWhatsAppExpanded, setIsWhatsAppExpanded] = useState(false)
    const [isEmailExpanded, setIsEmailExpanded] = useState(false)
    const [isVoiceExpanded, setIsVoiceExpanded] = useState(false)
    const [isAddingWhatsApp, setIsAddingWhatsApp] = useState(false)
    const [isAddingEmail, setIsAddingEmail] = useState(false)
    const [emailProviderPreset, setEmailProviderPreset] = useState<EmailProviderPreset>('gmail')
    const [isEmailAdvancedOpen, setIsEmailAdvancedOpen] = useState(false)
    const [newEmailProviderPreset, setNewEmailProviderPreset] = useState<EmailProviderPreset>('gmail')
    const [newWhatsappConfig, setNewWhatsappConfig] = useState<WhatsAppConfigState>({ phoneNumberId: "", accessToken: "", verifyToken: "", phoneNumber: "" })
    const [newEmailConfig, setNewEmailConfig] = useState<EmailConfigState>(createDefaultEmailConfig())
    const [emailIntegrations, setEmailIntegrations] = useState<EmailIntegrationRow[]>([])
    
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
    const [voiceRuntimeStatus, setVoiceRuntimeStatus] = useState<VoiceRuntimeStatus | null>(null)
    const [voiceRuntimeMessage, setVoiceRuntimeMessage] = useState("")

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
            emailConfig.providerFamily === 'microsoft365'
        )

        if (hasAnyEmailConfig) {
            setEmailStatus('pending')
        } else {
            setEmailStatus('unknown')
        }
    }, [emailConfig])

    useEffect(() => {
        const handleMicrosoft365Message = (event: MessageEvent) => {
            const message = String(event.data || '').trim()
            if (!MICROSOFT_365_CONNECTED_EVENTS.has(message)) {
                return
            }

            void (async () => {
                try {
                    await loadConfig()
                    toast.success('Conta Microsoft 365 conectada com sucesso.')
                } catch (error) {
                    console.error('[Integrations] Falha ao recarregar configuracao apos OAuth Microsoft 365:', error)
                    toast.error('A conta foi conectada, mas nao foi possivel atualizar a tela automaticamente.')
                }
            })()
        }

        window.addEventListener('message', handleMicrosoft365Message)
        return () => window.removeEventListener('message', handleMicrosoft365Message)
    }, [userId])

    const loadCRMIntegrations = async () => {
        if (!userId) return
        try {
            const { data: companyUser } = await supabase.from('tb_company_users').select('companies_id').eq('user_id', userId).maybeSingle()
            if (companyUser?.companies_id) {
                const { data } = await supabase.from('tb_crm_integrations').select(`id, is_active, created_at, config, tb_crms (id, name, slug, type, description)`).eq('companies_id', companyUser.companies_id).eq('is_active', true).order('created_at', { ascending: false })
                setCrmIntegrations((data || []).filter((integration: any) => SUPPORTED_CRM_SLUGS.has(getCRMSlug(integration))))
            }
        } catch (e) { console.error(e) }
    }

    const normalizePhoneNumber = (value: string) => value.replace(/\D/g, '')

    const fetchVoiceRuntimeStatus = async () => {
        try {
            const response = await fetch(`${BASE_URL}/voice/calls/runtime-status`, {
                headers: await getAuthHeaders()
            })

            if (response.status === 401 || response.status === 403) {
                setVoiceRuntimeStatus(null)
                setVoiceRuntimeMessage("")
                return
            }

            if (!response.ok) {
                throw new Error(`Erro ${response.status}`)
            }

            const data = await response.json()
            setVoiceRuntimeStatus(data)

            if (data?.supportsRealtimeCalls) {
                const adapterName = String(data?.mediaAdapter || 'desconhecido').trim()
                setVoiceRuntimeMessage(`Ambiente pronto para receber chamadas no WhatsApp com adapter ${adapterName}.`)
                return
            }

            setVoiceRuntimeMessage("O ambiente ainda nao esta pronto para receber chamadas de voz no WhatsApp.")
        } catch (error) {
            console.warn('[Integrations] Falha ao carregar status do runtime de voz:', error)
            setVoiceRuntimeStatus(null)
            setVoiceRuntimeMessage("Nao foi possivel validar agora se o canal de voz esta disponivel neste ambiente.")
        }
    }

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

    const buildEmailPayloadFromConfig = (
        config: EmailConfigState,
        preset: EmailProviderPreset,
        options: { isDefault?: boolean; isActive?: boolean } = {}
    ) => ({
        provider_preset: preset,
        provider_family: config.providerFamily,
        auth_type: config.providerFamily === 'microsoft365' ? 'oauth2' : config.authType,
        read_method: config.providerFamily === 'microsoft365' ? 'graph' : config.readMethod,
        send_method: config.providerFamily === 'microsoft365' ? 'graph' : config.sendMethod,
        email_address: config.emailAddress.trim() || config.username.trim() || null,
        username: config.username.trim() || config.emailAddress.trim() || null,
        password: config.password.trim() || null,
        oauth_client_id: config.providerFamily === 'microsoft365' ? config.oauthClientId.trim() || null : null,
        oauth_client_secret: config.providerFamily === 'microsoft365' ? config.oauthClientSecret.trim() || null : null,
        oauth_redirect_uri: config.providerFamily === 'microsoft365' ? config.oauthRedirectUri.trim() || null : null,
        oauth_tenant_id: config.providerFamily === 'microsoft365' ? config.oauthTenantId.trim() || null : null,
        smtp_host:
            config.providerFamily === 'microsoft365'
                ? 'smtp.office365.com'
                : config.sendMethod === 'smtp'
                    ? config.smtpHost.trim() || null
                    : null,
        smtp_port:
            config.providerFamily === 'microsoft365'
                ? 587
                : config.sendMethod === 'smtp' && config.smtpPort.trim()
                    ? parseInt(config.smtpPort, 10)
                    : null,
        smtp_secure:
            config.providerFamily === 'microsoft365'
                ? false
                : config.sendMethod === 'smtp'
                    ? config.smtpSecure
                    : null,
        imap_host:
            config.providerFamily === 'generic_imap_smtp' && config.readMethod === 'imap'
                ? config.imapHost.trim() || null
                : null,
        imap_port:
            config.providerFamily === 'generic_imap_smtp' && config.readMethod === 'imap' && config.imapPort.trim()
                ? parseInt(config.imapPort, 10)
                : null,
        imap_secure:
            config.providerFamily === 'generic_imap_smtp' && config.readMethod === 'imap'
                ? config.imapSecure
                : null,
        is_default: options.isDefault,
        is_active: options.isActive,
    })

    const buildEmailPayload = () => buildEmailPayloadFromConfig(emailConfig, emailProviderPreset, { isDefault: true, isActive: true })

    const persistEmailIntegration = async (): Promise<EmailIntegrationRow | null> => {
        if (emailConfig.providerFamily === 'microsoft365') {
            if (!emailConfig.emailAddress.trim()) {
                throw new Error('Informe o email principal da integracao Microsoft 365.')
            }

            if (!emailConfig.oauthClientId.trim()) {
                throw new Error('Informe o Client ID da integracao Microsoft 365.')
            }

            if (!emailConfig.oauthClientSecret.trim() && !emailConfig.hasOAuthClientSecret) {
                throw new Error('Informe o Client Secret da integracao Microsoft 365.')
            }

            if (!emailConfig.oauthRedirectUri.trim()) {
                throw new Error('Informe o Redirect URI da integracao Microsoft 365.')
            }
        } else {
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
        const mappedEmail = mapEmailIntegrationToState(savedIntegration)
        setEmailConfig(mappedEmail)
        setEmailProviderPreset(detectEmailPreset(mappedEmail))
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

    const fetchEmailIntegrations = async (): Promise<EmailIntegrationRow[]> => {
        const response = await fetch(`${BASE_URL}/email/integrations`, {
            method: 'GET',
            headers: await getAuthHeaders(false)
        })

        const result = await response.json().catch(() => null)

        if (!response.ok) {
            throw new Error(result?.details || result?.error || 'Erro ao carregar integracoes de email.')
        }

        return Array.isArray(result?.integrations) ? result.integrations : []
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

    const createEmailIntegration = async (payload: Record<string, unknown>): Promise<EmailIntegrationRow | null> => {
        const response = await fetch(`${BASE_URL}/email/integrations`, {
            method: 'POST',
            headers: await getAuthHeaders(),
            body: JSON.stringify(payload)
        })

        const result = await response.json().catch(() => null)

        if (!response.ok) {
            throw new Error(result?.details || result?.error || 'Erro ao criar integracao de email.')
        }

        return result?.integration || null
    }

    const testEmailIntegrationById = async (integrationId: string) => {
        const response = await fetch(`${BASE_URL}/email/integrations/${integrationId}/test`, {
            method: 'POST',
            headers: await getAuthHeaders()
        })

        const result = await response.json().catch(() => null)

        if (!response.ok) {
            throw new Error(result?.details || result?.error || 'Erro ao testar integracao de email.')
        }

        return result?.result || null
    }

    const setDefaultEmailIntegrationById = async (integrationId: string) => {
        const response = await fetch(`${BASE_URL}/email/integrations/${integrationId}/default`, {
            method: 'POST',
            headers: await getAuthHeaders()
        })

        const result = await response.json().catch(() => null)

        if (!response.ok) {
            throw new Error(result?.details || result?.error || 'Erro ao definir integracao padrao.')
        }

        return result?.integration || null
    }

    const setEmailIntegrationActiveById = async (integrationId: string, isActive: boolean) => {
        const response = await fetch(`${BASE_URL}/email/integrations/${integrationId}/${isActive ? 'activate' : 'deactivate'}`, {
            method: 'POST',
            headers: await getAuthHeaders()
        })

        const result = await response.json().catch(() => null)

        if (!response.ok) {
            throw new Error(result?.details || result?.error || 'Erro ao alterar status da integracao de email.')
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

    const fetchMicrosoft365AuthorizeUrl = async (integrationId?: string | null): Promise<string> => {
        const query = integrationId ? `?integration_id=${encodeURIComponent(integrationId)}` : ''
        const response = await fetch(`${BASE_URL}/email/oauth/microsoft365/authorize-url${query}`, {
            method: 'GET',
            headers: await getAuthHeaders(false)
        })

        const result = await response.json().catch(() => null)

        if (!response.ok || !result?.authorizeUrl) {
            throw new Error(result?.details || result?.error || 'Erro ao iniciar autenticacao do Microsoft 365.')
        }

        return result.authorizeUrl
    }

    const openMicrosoft365Popup = (authorizeUrl: string): boolean => {
        const width = 640
        const height = 760
        const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2))
        const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2))
        const popup = window.open(
            authorizeUrl,
            'sonia-microsoft365-oauth',
            `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
        )

        if (!popup) {
            return false
        }

        popup.focus()
        return true
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

    const getCurrentCompanyId = async () => {
        if (!userId) return null
        const { data, error } = await supabase
            .from('tb_company_users')
            .select('companies_id')
            .eq('user_id', userId)
            .maybeSingle()

        if (error) throw error
        return data?.companies_id || null
    }

    const handleAddWhatsAppIntegration = async () => {
        if (!userId) {
            toast.error(t('integrations.error.unauthorized'))
            return
        }

        const normalizedPhoneNumber = normalizePhoneNumber(newWhatsappConfig.phoneNumber)
        const trimmedPhoneNumberId = newWhatsappConfig.phoneNumberId.trim()
        const trimmedAccessToken = newWhatsappConfig.accessToken.trim()
        const trimmedVerifyToken = newWhatsappConfig.verifyToken.trim()

        if (!normalizedPhoneNumber || !trimmedPhoneNumberId || !trimmedAccessToken || !trimmedVerifyToken) {
            toast.error('Preencha numero oficial, Phone Number ID, Access Token e Verify Token para adicionar outra integracao.')
            return
        }

        setSaving(true)
        try {
            const companiesId = await getCurrentCompanyId()
            const { error } = await supabase.from('tb_integrations').insert({
                user_id: userId,
                companies_id: companiesId,
                provider: 'whatsapp',
                phone_number: normalizedPhoneNumber,
                app_key: trimmedPhoneNumberId,
                access_token: trimmedAccessToken,
                auth_token: trimmedVerifyToken,
                automation_mode: 'agent',
                linked_flow_id: null,
            })

            if (error) throw error

            setNewWhatsappConfig({ phoneNumberId: "", accessToken: "", verifyToken: "", phoneNumber: "" })
            setIsAddingWhatsApp(false)
            toast.success('Nova integracao WhatsApp adicionada.')
            await loadConfig()
        } catch (error: any) {
            console.error('Erro ao adicionar WhatsApp:', error)
            toast.error(error.message || 'Erro ao adicionar integracao WhatsApp.')
        } finally {
            setSaving(false)
        }
    }

    const handleAddEmailIntegration = async () => {
        if (!userId) {
            toast.error(t('integrations.error.unauthorized'))
            return
        }

        const login = newEmailConfig.username.trim() || newEmailConfig.emailAddress.trim()
        if (newEmailConfig.providerFamily === 'microsoft365') {
            if (!newEmailConfig.emailAddress.trim()) {
                toast.error('Informe o email principal da integracao Microsoft 365.')
                return
            }
            if (!newEmailConfig.oauthClientId.trim()) {
                toast.error('Informe o Client ID da integracao Microsoft 365.')
                return
            }
            if (!newEmailConfig.oauthClientSecret.trim() && !newEmailConfig.hasOAuthClientSecret) {
                toast.error('Informe o Client Secret da integracao Microsoft 365.')
                return
            }
            if (!newEmailConfig.oauthRedirectUri.trim()) {
                toast.error('Informe o Redirect URI da integracao Microsoft 365.')
                return
            }
        } else {
            if (!login) {
                toast.error('Informe ao menos o email ou usuario da nova integracao.')
                return
            }

            if (newEmailConfig.readMethod === 'imap' && (!newEmailConfig.imapHost.trim() || !newEmailConfig.imapPort.trim())) {
                toast.error('Preencha host e porta IMAP para a nova integracao.')
                return
            }

            if (newEmailConfig.sendMethod === 'smtp' && (!newEmailConfig.smtpHost.trim() || !newEmailConfig.smtpPort.trim())) {
                toast.error('Preencha host e porta SMTP para a nova integracao.')
                return
            }

            if (!newEmailConfig.password.trim()) {
                toast.error('Informe a senha ou app password da nova integracao.')
                return
            }
        }

        setSaving(true)
        try {
            const createdIntegration = await createEmailIntegration(
                buildEmailPayloadFromConfig(newEmailConfig, newEmailProviderPreset, {
                    isDefault: emailIntegrations.length === 0,
                    isActive: true,
                })
            )

            if (newEmailConfig.providerFamily === 'microsoft365') {
                const authorizeUrl = await fetchMicrosoft365AuthorizeUrl(createdIntegration?.id)
                const openedPopup = openMicrosoft365Popup(authorizeUrl)

                if (!openedPopup) {
                    window.location.href = authorizeUrl
                } else {
                    toast.success('Finalize a autorizacao do Microsoft 365 na nova janela para concluir a conexao.')
                }
            }

            setNewEmailConfig(createDefaultEmailConfig())
            setNewEmailProviderPreset('gmail')
            setIsAddingEmail(false)
            toast.success('Nova integracao de email adicionada.')
            await loadConfig()
        } catch (error: any) {
            console.error('Erro ao adicionar email:', error)
            toast.error(error.message || 'Erro ao adicionar integracao de email.')
        } finally {
            setSaving(false)
        }
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
                loadAssignableFlows(),
                fetchVoiceRuntimeStatus()
            ])
            try {
                const [emailIntegration, emailList] = await Promise.all([
                    fetchCurrentEmailIntegration(),
                    fetchEmailIntegrations()
                ])
                const mappedEmail = mapEmailIntegrationToState(emailIntegration)
                setEmailConfig(mappedEmail)
                setEmailProviderPreset(detectEmailPreset(mappedEmail))
                setEmailIntegrations(emailList)
            } catch (emailError) {
                console.warn('[Integrations] Falha ao carregar email pela API nova, usando fallback legado.', emailError)
                const legacyEmail = await loadLegacyEmailConfig(user.email)
                setEmailConfig(legacyEmail)
                setEmailProviderPreset(detectEmailPreset(legacyEmail))
                setEmailIntegrations([])
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
                const savedIntegration = await persistEmailIntegration()
                const authorizeUrl = await fetchMicrosoft365AuthorizeUrl(savedIntegration?.id)
                const openedPopup = openMicrosoft365Popup(authorizeUrl)

                if (openedPopup) {
                    toast.success('Finalize a autorizacao do Microsoft 365 na nova janela para concluir a conexao.')
                    return
                }

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
            toast.error(getFriendlyEmailError(error.message || t('integrations.error.save')))
        } finally {
            setSaving(false)
        }
    }

    const handleTestEmailConnection = async () => {
        setTestingEmail(true)
        try {
            let targetIntegrationId = String(emailConfig.integrationId || '').trim()

            if (emailConfig.providerFamily !== 'microsoft365') {
                const saved = await persistEmailIntegration()
                targetIntegrationId = String(saved?.id || targetIntegrationId).trim()
            } else if (!emailConfig.integrationId && !emailConfig.hasAccessToken) {
                throw new Error('Conecte primeiro a conta Microsoft 365 antes de testar.')
            }

            const result = targetIntegrationId
                ? await testEmailIntegrationById(targetIntegrationId)
                : await testCurrentEmailIntegration()
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
            toast.error(getFriendlyEmailError(error.message || 'Nao foi possivel testar a integracao de email.'))
        } finally {
            setTestingEmail(false)
        }
    }

    const handleTestEmailIntegration = async (integrationId: string) => {
        setTestingEmail(true)
        try {
            const result = await testEmailIntegrationById(integrationId)
            if (result?.success) {
                toast.success(result?.details || 'Conexao de email validada com sucesso.')
            } else {
                toast.error(result?.details || 'A integracao de email nao respondeu como esperado.')
            }
            await loadConfig()
        } catch (error: any) {
            console.error('[Integrations] Erro ao testar email:', error)
            toast.error(getFriendlyEmailError(error.message || 'Nao foi possivel testar a integracao de email.'))
        } finally {
            setTestingEmail(false)
        }
    }

    const handleSetDefaultEmailIntegration = async (integrationId: string) => {
        setSaving(true)
        try {
            await setDefaultEmailIntegrationById(integrationId)
            toast.success('Integracao de email definida como padrao.')
            await loadConfig()
        } catch (error: any) {
            console.error('[Integrations] Erro ao definir email padrao:', error)
            toast.error(error.message || 'Nao foi possivel definir a integracao padrao.')
        } finally {
            setSaving(false)
        }
    }

    const handleToggleEmailIntegration = async (integration: EmailIntegrationRow) => {
        setSaving(true)
        try {
            await setEmailIntegrationActiveById(integration.id, integration.is_active === false)
            toast.success(integration.is_active === false ? 'Integracao de email ativada.' : 'Integracao de email desativada.')
            await loadConfig()
        } catch (error: any) {
            console.error('[Integrations] Erro ao alterar status do email:', error)
            toast.error(error.message || 'Nao foi possivel alterar o status da integracao.')
        } finally {
            setSaving(false)
        }
    }

    const applyEmailPresetToConfig = (preset: EmailProviderPreset, config: EmailConfigState): EmailConfigState => {
        const presetConfig = EMAIL_PROVIDER_PRESETS[preset]
        return {
            ...config,
            providerFamily: presetConfig.providerFamily,
            authType: presetConfig.authType,
            readMethod: presetConfig.readMethod,
            sendMethod: presetConfig.sendMethod,
            username: preset === 'microsoft365' ? '' : config.username,
            password: preset === 'microsoft365' ? '' : config.password,
            smtpHost: presetConfig.smtpHost,
            smtpPort: presetConfig.smtpPort,
            smtpSecure: presetConfig.smtpSecure,
            imapHost: presetConfig.imapHost,
            imapPort: presetConfig.imapPort,
            imapSecure: presetConfig.imapSecure,
            oauthTenantId: preset === 'microsoft365' ? (config.oauthTenantId || 'common') : config.oauthTenantId,
            status: preset === 'microsoft365' && config.hasAccessToken ? 'connected' : 'configured',
        }
    }

    const handleEmailPresetChange = (value: EmailProviderPreset) => {
        const normalizedPreset = value === 'generic_imap_smtp' ? 'custom' : value
        setEmailProviderPreset(normalizedPreset)
        setIsEmailAdvancedOpen(normalizedPreset === 'custom')
        setEmailConfig((prev) => {
            const next = applyEmailPresetToConfig(normalizedPreset, prev)
            if (!next.username && next.emailAddress) {
                next.username = next.emailAddress
            }
            return next
        })
    }

    const handleNewEmailPresetChange = (value: EmailProviderPreset) => {
        const normalizedPreset = value === 'generic_imap_smtp' ? 'custom' : value
        setNewEmailProviderPreset(normalizedPreset)
        setNewEmailConfig((prev) => applyEmailPresetToConfig(normalizedPreset, prev))
    }

    const getEmailPresetHint = (preset: EmailProviderPreset) => {
        if (preset === 'gmail') return 'Gmail usa senha de app do Google. SMTP e IMAP ja ficam preenchidos automaticamente.'
        if (preset === 'outlook_personal') return 'Outlook.com pessoal usa as portas padrao da Microsoft. Em contas com 2FA, use senha de app.'
        if (preset === 'hotmail') return 'Hotmail usa a infraestrutura do Outlook.com. Em contas com 2FA, use senha de app.'
        if (preset === 'yahoo') return 'Yahoo Mail usa senha de app. SMTP e IMAP ja ficam preenchidos automaticamente.'
        if (preset === 'microsoft365') return 'Microsoft 365 usa OAuth pela Microsoft Graph. Salve Client ID, Client Secret, Redirect URI e Tenant na propria integracao.'
        return 'Use personalizado quando seu provedor informar hosts ou portas proprias.'
    }

    const getFriendlyEmailError = (message?: string | null) => {
        const normalized = String(message || '').trim()

        if (!normalized) {
            return 'Nao foi possivel testar a integracao de email.'
        }

        if (
            normalized.includes('OUTLOOK_CLIENT_ID') ||
            normalized.includes('OUTLOOK_CLIENT_SECRET')
        ) {
            return 'Esta integracao usa Microsoft 365 OAuth. Preencha Client ID e Client Secret na propria integracao antes de conectar.'
        }

        if (normalized.includes('OUTLOOK_REDIRECT_URI')) {
            return 'A integracao Microsoft 365 precisa de um Redirect URI valido salvo na propria integracao.'
        }

        if (/invalid login|auth failed|authentication failed|username and password not accepted/i.test(normalized)) {
            return 'Falha de autenticacao no email. Revise o usuario, a senha de app e as permissoes IMAP/SMTP da conta.'
        }

        if (/imap falhou|smtp falhou|command failed/i.test(normalized)) {
            return normalized.replace(/Command failed:?/gi, '').trim() || 'A conexao com o provedor de email falhou. Revise host, porta, seguranca e credenciais.'
        }

        return normalized
    }

    const getEmailProviderLabel = (integration: EmailIntegrationRow | null) => {
        const preset = integration?.provider_preset || detectEmailPreset(mapEmailIntegrationToState(integration))
        return EMAIL_PROVIDER_PRESETS[preset]?.label || 'IMAP/SMTP personalizado'
    }

    const getEmailStatusForRow = (integration: EmailIntegrationRow) => {
        if (integration.is_active === false) return 'disabled'
        return integration.status || 'unknown'
    }

    const getStatusBadge = (status: string) => {
        if (status === 'connected') {
            return (
                <Badge className="border-none font-black text-[9px] px-3 gap-1.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/55 dark:text-emerald-400">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                    {t('integrations.crm.connected')}
                </Badge>
            )
        }
        if (status === 'pending') {
            return <Badge className="border-none font-black text-[9px] px-3 bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">PENDENTE</Badge>
        }
        if (status === 'configured') {
            return <Badge className="border-none font-black text-[9px] px-3 bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">CONFIGURADO</Badge>
        }
        if (status === 'disabled') {
            return <Badge className="border-none font-black text-[9px] px-3 bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">DESATIVADO</Badge>
        }
        if (status === 'error') {
            return <Badge className="border-none font-black text-[9px] px-3 bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">ERRO</Badge>
        }
        return null
    }

    const formatIntegrationDate = (value?: string | null) => {
        if (!value) return 'Data indisponivel'
        return new Date(value).toLocaleDateString(i18n.language || 'pt-BR')
    }

    const formatIntegrationDateTime = (value?: string | null) => {
        if (!value) return 'Ainda nao testada'

        return new Date(value).toLocaleString(i18n.language || 'pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
    }

    const getCRMName = (integration: any) => integration?.tb_crms?.name || integration?.config?.provider_name || 'CRM'

    const getCRMSlug = (integration: any) => integration?.tb_crms?.slug || integration?.config?.provider_slug || 'crm'

    const getAuthModeLabel = (integration: any) => {
        const authMode = integration?.config?.auth_mode || integration?.tb_crms?.type || 'api_key'
        if (authMode === 'private_app_token') return 'Private App Token'
        if (authMode === 'api_key') return 'API Key'
        if (authMode === 'oauth') return 'OAuth'
        if (authMode === 'webhook') return 'Webhook'
        return String(authMode)
    }

    const getCRMStatusNote = (integration: any) => {
        const slug = getCRMSlug(integration)
        if (slug === 'hubspot') return 'Pronto para uso pelos agentes com contatos e negocios do HubSpot.'
        if (slug === 'mailchimp') return 'Credenciais persistidas para Mailchimp Marketing API. Acoes dos agentes dependem da camada de sincronizacao.'
        return 'Integracao persistida no workspace.'
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
    const emailSectionSurface: React.CSSProperties = isDark
        ? { backgroundColor: '#202024', borderColor: '#33343a' }
        : { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }
    const emailSummarySurface: React.CSSProperties = isDark
        ? { backgroundColor: '#232327', borderColor: '#36363d' }
        : { backgroundColor: '#ffffff', borderColor: '#e2e8f0' }
    const helperPanelSurface: React.CSSProperties = isDark
        ? { backgroundColor: '#18181b', borderColor: '#303036', color: '#e4e4e7' }
        : { backgroundColor: '#ffffff', borderColor: '#dbe3ee', color: '#475569' }
    const highlightInfoSurface: React.CSSProperties = isDark
        ? { backgroundColor: 'rgba(249, 115, 22, 0.08)', borderColor: 'rgba(249, 115, 22, 0.24)', color: '#fed7aa' }
        : { backgroundColor: '#fff7ed', borderColor: '#fdba74', color: '#9a3412' }

    if (loading || !translationsReady) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>

    return (
        <div className="space-y-10 pb-24 animate-in fade-in duration-500 bg-[#F8FAFC] dark:bg-background min-h-screen -m-4 p-8">
            
            {/* HEADER DA PÁGINA */}
            <div className="px-4">
                <div>
                    <h2 className="text-4xl font-black tracking-tighter leading-none" style={{ color: theme === 'dark' ? '#fafafa' : '#0f172a' }}>{t('integrations.title')}</h2>
                    <p className="font-medium mt-2 uppercase text-[10px] tracking-[0.3em]" style={{ color: theme === 'dark' ? '#a1a1aa' : '#64748b' }}>{t('integrations.subtitle')}</p>
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
                        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <p className="text-sm font-bold" style={{ color: theme === 'dark' ? '#fafafa' : '#0f172a' }}>
                                    {crmIntegrations.length} {crmIntegrations.length === 1 ? 'integracao conectada' : 'integracoes conectadas'}
                                </p>
                                <p className="text-xs" style={{ color: theme === 'dark' ? '#a1a1aa' : '#64748b' }}>
                                    Clique em uma integracao para ver configuracoes, data de conexao e acoes.
                                </p>
                            </div>
                            <Button variant="outline" onClick={() => setIsCRMSheetOpen(true)} className="h-10 rounded-xl px-4 text-xs font-bold">
                                <Plus className="mr-2 h-4 w-4" />
                                Adicionar CRM
                            </Button>
                        </div>
                        {crmIntegrations.length > 0 ? (
                            <div className="grid grid-cols-1 gap-3">
                                {crmIntegrations.map((integration) => {
                                    const isExpanded = expandedCRMIntegrationId === integration.id
                                    const crmName = getCRMName(integration)
                                    return (
                                        <div
                                            key={integration.id}
                                            className="overflow-hidden border shadow-sm transition-colors duration-150"
                                            style={{
                                                borderRadius: '1.25rem',
                                                backgroundColor: isDark ? '#27272a' : '#ffffff',
                                                borderColor: isExpanded ? (isDark ? 'rgba(168, 85, 247, 0.45)' : 'rgba(147, 51, 234, 0.28)') : (isDark ? '#3f3f46' : '#e2e8f0')
                                            }}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => setExpandedCRMIntegrationId(isExpanded ? null : integration.id)}
                                                className="flex w-full items-center justify-between gap-4 p-5 text-left"
                                            >
                                                <div className="flex min-w-0 items-center gap-4">
                                                    <Database size={20} color="#9333ea" style={{ marginLeft: '8px' }} />
                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="truncate font-bold" style={{ color: theme === 'dark' ? '#fafafa' : '#1e293b' }}>{crmName}</span>
                                                            {getStatusBadge('connected')}
                                                        </div>
                                                        <p className="mt-1 truncate text-xs" style={{ color: theme === 'dark' ? '#a1a1aa' : '#64748b' }}>
                                                            {integration.tb_crms?.description || integration.config?.provider_name || `Provedor ${getCRMSlug(integration)} conectado ao workspace.`}
                                                        </p>
                                                    </div>
                                                </div>
                                                <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`} />
                                            </button>
                                            {isExpanded && (
                                                <div className="border-t p-5" style={{ borderColor: isDark ? '#3f3f46' : '#e2e8f0' }}>
                                                    <div className="grid gap-3 md:grid-cols-3">
                                                        <div className="rounded-xl border p-4" style={{ borderColor: isDark ? '#3f3f46' : '#e2e8f0', backgroundColor: isDark ? '#18181b' : '#f8fafc' }}>
                                                            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: theme === 'dark' ? '#a1a1aa' : '#64748b' }}>Provedor</p>
                                                            <p className="mt-2 text-sm font-bold" style={{ color: theme === 'dark' ? '#fafafa' : '#0f172a' }}>{getCRMSlug(integration)}</p>
                                                        </div>
                                                        <div className="rounded-xl border p-4" style={{ borderColor: isDark ? '#3f3f46' : '#e2e8f0', backgroundColor: isDark ? '#18181b' : '#f8fafc' }}>
                                                            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: theme === 'dark' ? '#a1a1aa' : '#64748b' }}>Autenticacao</p>
                                                            <p className="mt-2 text-sm font-bold" style={{ color: theme === 'dark' ? '#fafafa' : '#0f172a' }}>{getAuthModeLabel(integration)}</p>
                                                        </div>
                                                        <div className="rounded-xl border p-4" style={{ borderColor: isDark ? '#3f3f46' : '#e2e8f0', backgroundColor: isDark ? '#18181b' : '#f8fafc' }}>
                                                            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: theme === 'dark' ? '#a1a1aa' : '#64748b' }}>Conectado em</p>
                                                            <p className="mt-2 text-sm font-bold" style={{ color: theme === 'dark' ? '#fafafa' : '#0f172a' }}>{formatIntegrationDate(integration.created_at)}</p>
                                                        </div>
                                                    </div>
                                                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4" style={{ borderColor: isDark ? '#3f3f46' : '#e2e8f0', backgroundColor: isDark ? '#18181b' : '#f8fafc' }}>
                                                        <p className="text-xs" style={{ color: theme === 'dark' ? '#a1a1aa' : '#64748b' }}>{getCRMStatusNote(integration)} Credenciais ficam ocultas por seguranca.</p>
                                                        <Button variant="ghost" size="sm" onClick={() => handleDeleteCRM(integration.id, crmName)} className="rounded-xl text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40">
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                            Remover
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                                <button
                                    type="button"
                                    onClick={() => setIsCRMSheetOpen(true)}
                                    className="flex items-center justify-center gap-3 rounded-2xl border border-dashed p-6 text-sm font-bold transition-colors duration-150"
                                    style={{
                                        borderColor: isDark ? '#3f3f46' : '#cbd5e1',
                                        backgroundColor: isDark ? 'rgba(39, 39, 42, 0.35)' : 'rgba(248, 250, 252, 0.7)',
                                        color: theme === 'dark' ? '#d4d4d8' : '#475569'
                                    }}
                                >
                                    <Plus className="h-5 w-5" />
                                    Conectar outra integracao de CRM
                                </button>
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
                        <button
                            type="button"
                            onClick={() => setIsWhatsAppExpanded((value) => !value)}
                            className="mb-5 flex w-full items-center justify-between gap-4 rounded-2xl border p-5 text-left transition-colors duration-150"
                            style={{
                                backgroundColor: isDark ? '#27272a' : '#ffffff',
                                borderColor: isWhatsAppExpanded ? (isDark ? 'rgba(16, 185, 129, 0.45)' : 'rgba(16, 185, 129, 0.28)') : (isDark ? '#3f3f46' : '#e2e8f0')
                            }}
                        >
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-bold" style={{ color: theme === 'dark' ? '#fafafa' : '#0f172a' }}>
                                        {whatsappConfig.phoneNumber || 'WhatsApp Business'}
                                    </span>
                                    {getStatusBadge(whatsappStatus)}
                                </div>
                                <p className="mt-1 truncate text-xs" style={{ color: theme === 'dark' ? '#a1a1aa' : '#64748b' }}>
                                    {whatsappStatus === 'connected'
                                        ? 'Numero oficial conectado. Clique para ver e editar configuracoes.'
                                        : 'Clique para configurar credenciais, webhook e automacao principal.'}
                                </p>
                            </div>
                            <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-150 ${isWhatsAppExpanded ? 'rotate-180' : ''}`} />
                        </button>
                        {isWhatsAppExpanded && (
                            <>
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
                            </>
                        )}
                        <button
                            type="button"
                            onClick={() => {
                                setIsAddingWhatsApp(true)
                                setIsWhatsAppExpanded(false)
                            }}
                            className="mt-5 flex w-full items-center justify-center gap-3 rounded-2xl border border-dashed p-6 text-sm font-bold transition-colors duration-150"
                            style={{
                                borderColor: isDark ? '#3f3f46' : '#cbd5e1',
                                backgroundColor: isDark ? 'rgba(39, 39, 42, 0.35)' : 'rgba(248, 250, 252, 0.7)',
                                color: theme === 'dark' ? '#d4d4d8' : '#475569'
                            }}
                        >
                            <Plus className="h-5 w-5" />
                            Adicionar integracao WhatsApp
                        </button>
                        {isAddingWhatsApp && (
                            <div className="mt-5 rounded-2xl border p-5" style={{ backgroundColor: isDark ? '#27272a' : '#ffffff', borderColor: isDark ? '#3f3f46' : '#e2e8f0' }}>
                                <div className="mb-5 flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-sm font-bold" style={{ color: theme === 'dark' ? '#fafafa' : '#0f172a' }}>Nova integracao WhatsApp</p>
                                        <p className="text-xs" style={{ color: theme === 'dark' ? '#a1a1aa' : '#64748b' }}>Preencha outro numero oficial sem alterar a integracao atual.</p>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={() => setIsAddingWhatsApp(false)} className="rounded-xl">Cancelar</Button>
                                </div>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <Input placeholder="Phone Number ID" value={newWhatsappConfig.phoneNumberId} onChange={(e) => setNewWhatsappConfig((p) => ({ ...p, phoneNumberId: e.target.value }))} className="h-12 rounded-xl" style={inputSurface} />
                                    <Input type="password" placeholder="Access Token" value={newWhatsappConfig.accessToken} onChange={(e) => setNewWhatsappConfig((p) => ({ ...p, accessToken: e.target.value }))} className="h-12 rounded-xl" style={inputSurface} />
                                    <Input placeholder="Verify Token" value={newWhatsappConfig.verifyToken} onChange={(e) => setNewWhatsappConfig((p) => ({ ...p, verifyToken: e.target.value }))} className="h-12 rounded-xl" style={inputSurface} />
                                    <Input placeholder="Numero oficial da Meta" value={newWhatsappConfig.phoneNumber} onChange={(e) => setNewWhatsappConfig((p) => ({ ...p, phoneNumber: e.target.value }))} className="h-12 rounded-xl" style={inputSurface} />
                                </div>
                                <div className="mt-5 flex justify-end">
                                    <Button onClick={handleAddWhatsAppIntegration} disabled={saving} className="rounded-xl">
                                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                                        Salvar nova integracao
                                    </Button>
                                </div>
                            </div>
                        )}
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
                                <h3 className="text-xl font-black tracking-tight mb-2" style={{ color: theme === 'dark' ? '#fafafa' : '#0f172a' }}>Integracoes de email</h3>
                                <div className="mb-2">
                                    {getStatusBadge(emailStatus)}
                                </div>
                                <p className="text-sm font-medium" style={{ color: theme === 'dark' ? '#a1a1aa' : '#64748b' }}>Conecte contas para leitura e envio pelos agentes.</p>
                            </div>
                        </div>
                    </div>
                    <CardContent className="p-8 space-y-6">
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest" style={{ color: theme === 'dark' ? '#a1a1aa' : '#64748b' }}>Integracao padrao de email</p>
                            <p className="text-xs" style={{ color: theme === 'dark' ? '#71717a' : '#94a3b8' }}>Os agentes usam esta conta por padrao para ler e enviar emails.</p>
                        </div>
                        <div
                            className="grid gap-4 rounded-3xl border p-5 lg:grid-cols-[minmax(0,1fr)_auto]"
                            style={emailSummarySurface}
                        >
                            <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-base font-bold" style={{ color: theme === 'dark' ? '#fafafa' : '#0f172a' }}>
                                        {getEmailProviderLabel({
                                            id: emailConfig.integrationId || 'current',
                                            provider_preset: emailProviderPreset,
                                            provider_family: emailConfig.providerFamily,
                                            email_address: emailConfig.emailAddress,
                                            username: emailConfig.username,
                                        })}
                                    </span>
                                    {getStatusBadge(emailStatus)}
                                </div>
                                <p className="text-sm" style={{ color: theme === 'dark' ? '#d4d4d8' : '#475569' }}>
                                    {emailConfig.emailAddress || emailConfig.username || 'Nenhuma conta padrao configurada'}
                                </p>
                                <p className="text-xs" style={{ color: theme === 'dark' ? '#71717a' : '#94a3b8' }}>
                                    Ultimo teste: {formatIntegrationDateTime(emailIntegrations.find((integration) => integration.id === emailConfig.integrationId)?.last_test_at)}
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                                <Badge variant="outline" className="rounded-full px-3 py-1 text-[10px] font-bold">
                                    {emailConfig.canRead ? 'Leitura ativa' : 'Sem leitura'}
                                </Badge>
                                <Badge variant="outline" className="rounded-full px-3 py-1 text-[10px] font-bold">
                                    {emailConfig.canSend ? 'Envio ativo' : 'Sem envio'}
                                </Badge>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsEmailExpanded((value) => !value)}
                            className="flex w-full items-center justify-between gap-4 rounded-2xl border p-5 text-left transition-colors duration-150"
                            style={{
                                backgroundColor: isDark ? '#27272a' : '#ffffff',
                                borderColor: isEmailExpanded ? (isDark ? 'rgba(249, 115, 22, 0.45)' : 'rgba(249, 115, 22, 0.28)') : (isDark ? '#3f3f46' : '#e2e8f0')
                            }}
                        >
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-bold" style={{ color: theme === 'dark' ? '#fafafa' : '#0f172a' }}>
                                        {emailConfig.emailAddress || emailConfig.username || 'Email'}
                                    </span>
                                    {getStatusBadge(emailStatus)}
                                </div>
                                <p className="mt-1 truncate text-xs" style={{ color: theme === 'dark' ? '#a1a1aa' : '#64748b' }}>
                                    {emailConfig.integrationId
                                        ? `${emailConfig.providerFamily === 'microsoft365' ? 'Microsoft 365 / Outlook' : 'IMAP + SMTP'} configurado. Clique para ver e editar.`
                                        : 'Clique para configurar Microsoft 365, Outlook, IMAP ou SMTP.'}
                                </p>
                                {emailConfig.integrationId && (
                                    <p className="mt-1 text-[11px]" style={{ color: theme === 'dark' ? '#71717a' : '#94a3b8' }}>
                                        Ultimo teste: {formatIntegrationDateTime(emailIntegrations.find((integration) => integration.id === emailConfig.integrationId)?.last_test_at)}
                                    </p>
                                )}
                            </div>
                            <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-150 ${isEmailExpanded ? 'rotate-180' : ''}`} />
                        </button>
                        {isEmailExpanded && (
                            <div className="space-y-6 rounded-3xl border p-6" style={emailSectionSurface}>
                        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                            <div>
                                <p className="text-sm font-bold" style={{ color: theme === 'dark' ? '#fafafa' : '#0f172a' }}>
                                    Configuracao principal
                                </p>
                                <p className="text-xs" style={{ color: theme === 'dark' ? '#a1a1aa' : '#64748b' }}>
                                    Defina o provedor, a conta principal e como os agentes vao ler e enviar emails.
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Button variant="outline" onClick={handleTestEmailConnection} disabled={testingEmail || saving} className="rounded-xl px-4">
                                    {testingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Testar conexao'}
                                </Button>
                                <Button
                                    onClick={handleSaveAll}
                                    disabled={saving}
                                    className="rounded-xl px-4"
                                    style={{
                                        background: saving
                                            ? 'linear-gradient(135deg, #fdba74 0%, #f97316 100%)'
                                            : 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                                        color: 'white',
                                        border: 'none'
                                    }}
                                >
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'white' }} /> : <Save className="h-4 w-4 mr-2" style={{ color: 'white' }} />}
                                    Salvar email
                                </Button>
                            </div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold" style={{ color: theme === 'dark' ? '#d4d4d8' : '#475569' }}>Modo da integração</Label>
                                <Select value={emailProviderPreset} onValueChange={(value: EmailProviderPreset) => handleEmailPresetChange(value)}>
                                    <SelectTrigger className="h-12 rounded-xl border px-4 font-semibold focus:ring-2 focus:ring-orange-500/20" style={inputSurface}>
                                        <SelectValue placeholder="Escolha o tipo de integração" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="gmail">Gmail</SelectItem>
                                        <SelectItem value="microsoft365">Microsoft 365 corporativo</SelectItem>
                                        <SelectItem value="outlook_personal">Outlook.com pessoal</SelectItem>
                                        <SelectItem value="hotmail">Hotmail pessoal</SelectItem>
                                        <SelectItem value="yahoo">Yahoo Mail</SelectItem>
                                        <SelectItem value="custom">IMAP/SMTP personalizado</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-semibold" style={{ color: theme === 'dark' ? '#d4d4d8' : '#475569' }}>Email principal</Label>
                                <Input
                                    value={emailConfig.emailAddress}
                                    onChange={(e) => {
                                        const value = e.target.value
                                        setEmailConfig((p) => ({
                                            ...p,
                                            emailAddress: value,
                                            username: !p.username || p.username === p.emailAddress ? value : p.username,
                                            status: 'configured',
                                        }))
                                    }}
                                    className="h-12 rounded-xl border px-4 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                                    style={inputSurface}
                                    placeholder={emailProviderPreset === 'gmail' ? 'seuemail@gmail.com' : emailProviderPreset === 'outlook_personal' ? 'seuemail@outlook.com' : emailProviderPreset === 'hotmail' ? 'seuemail@hotmail.com' : emailProviderPreset === 'yahoo' ? 'seuemail@yahoo.com' : 'contato@suaempresa.com'}
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
                                <p className="text-xs" style={{ color: theme === 'dark' ? '#d4d4d8' : '#7c2d12' }}>
                                    Preencha abaixo as credenciais OAuth desta integracao Microsoft 365. O Client Secret fica oculto depois de salvo e pode ser rotacionado aqui.
                                </p>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold" style={{ color: theme === 'dark' ? '#d4d4d8' : '#475569' }}>Client ID</Label>
                                        <Input
                                            value={emailConfig.oauthClientId}
                                            onChange={(e) => setEmailConfig((p) => ({ ...p, oauthClientId: e.target.value, status: 'configured' }))}
                                            className="h-12 rounded-xl border px-4"
                                            style={inputSurface}
                                            placeholder="Application (client) ID"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold" style={{ color: theme === 'dark' ? '#d4d4d8' : '#475569' }}>Client Secret</Label>
                                        <Input
                                            type="password"
                                            value={emailConfig.oauthClientSecret}
                                            onChange={(e) => setEmailConfig((p) => ({ ...p, oauthClientSecret: e.target.value, status: 'configured' }))}
                                            className="h-12 rounded-xl border px-4"
                                            style={inputSurface}
                                            placeholder={emailConfig.hasOAuthClientSecret ? 'Ja salvo - preencha para rotacionar' : 'Client secret'}
                                        />
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <Label className="text-xs font-semibold" style={{ color: theme === 'dark' ? '#d4d4d8' : '#475569' }}>Redirect URI</Label>
                                        <Input
                                            value={emailConfig.oauthRedirectUri}
                                            onChange={(e) => setEmailConfig((p) => ({ ...p, oauthRedirectUri: e.target.value, status: 'configured' }))}
                                            className="h-12 rounded-xl border px-4"
                                            style={inputSurface}
                                            placeholder="https://sua-plataforma.com/auth/outlook/callback"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold" style={{ color: theme === 'dark' ? '#d4d4d8' : '#475569' }}>Tenant ID</Label>
                                        <Input
                                            value={emailConfig.oauthTenantId}
                                            onChange={(e) => setEmailConfig((p) => ({ ...p, oauthTenantId: e.target.value, status: 'configured' }))}
                                            className="h-12 rounded-xl border px-4"
                                            style={inputSurface}
                                            placeholder="common"
                                        />
                                    </div>
                                </div>
                                <div className="grid md:grid-cols-3 gap-4">
                                    {(isEmailAdvancedOpen || emailProviderPreset === 'custom') && (
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold" style={{ color: theme === 'dark' ? '#d4d4d8' : '#475569' }}>SMTP host</Label>
                                        <Input value="smtp.office365.com" readOnly className="h-12 rounded-xl border px-4" style={inputSurface} />
                                    </div>
                                    )}
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
                            <div className="space-y-6">
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

                                {emailProviderPreset !== 'custom' && emailProviderPreset !== 'microsoft365' && (
                                    <p className="text-xs leading-5" style={{ color: theme === 'dark' ? '#71717a' : '#94a3b8' }}>
                                        {getEmailPresetHint(emailProviderPreset)}
                                    </p>
                                )}

                                <button
                                    type="button"
                                    onClick={() => setIsEmailAdvancedOpen((value) => !value)}
                                    className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-left text-[11px] font-bold uppercase tracking-[0.16em] transition-colors duration-150"
                                    style={{
                                        backgroundColor: isDark ? '#18181b' : '#ffffff',
                                        border: `1px solid ${isDark ? '#303036' : '#dbe3ee'}`,
                                        color: theme === 'dark' ? '#a1a1aa' : '#64748b'
                                    }}
                                >
                                    <span>Opcoes avancadas</span>
                                    {emailProviderPreset !== 'custom' && (
                                        <span className="normal-case tracking-normal text-[11px]" style={{ color: theme === 'dark' ? '#71717a' : '#94a3b8' }}>
                                            auto
                                        </span>
                                    )}
                                    <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform duration-150 ${isEmailAdvancedOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {(isEmailAdvancedOpen || emailProviderPreset === 'custom') && emailConfig.sendMethod === 'smtp' && (
                                    <div className="rounded-2xl border p-4 space-y-3" style={helperPanelSurface}>
                                        <p className="text-sm font-semibold" style={{ color: theme === 'dark' ? '#fdba74' : '#9a3412' }}>Configuração de envio SMTP</p>
                                        <div className="grid md:grid-cols-3 gap-3">
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

                                {(isEmailAdvancedOpen || emailProviderPreset === 'custom') && emailConfig.readMethod === 'imap' && (
                                    <div className="rounded-2xl border p-4 space-y-3" style={helperPanelSurface}>
                                        <p className="text-sm font-semibold" style={{ color: theme === 'dark' ? '#fdba74' : '#9a3412' }}>Configuração de leitura IMAP</p>
                                        <div className="grid md:grid-cols-3 gap-3">
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

                                <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-4" style={helperPanelSurface}>
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
                                    <Button
                                        onClick={handleSaveAll}
                                        disabled={saving}
                                        className="rounded-2xl px-6 h-11 font-black uppercase text-[10px] tracking-widest shadow-xl transition-all"
                                        style={{
                                            background: saving
                                                ? 'linear-gradient(135deg, #fdba74 0%, #f97316 100%)'
                                                : 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                                            color: 'white',
                                            border: 'none'
                                        }}
                                    >
                                        {saving ? <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'white' }} /> : <Save className="h-4 w-4 mr-2" style={{ color: 'white' }} />}
                                        Salvar email
                                    </Button>
                                    <Button variant="outline" onClick={handleTestEmailConnection} disabled={testingEmail || saving} className="rounded-2xl px-6 h-11 font-black uppercase text-[10px] tracking-widest">
                                        {testingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Testar conexão'}
                                    </Button>
                                </div>
                            </div>
                        )}
                            </div>
                        )}
                        {emailIntegrations.length > 0 && (
                            <div className="space-y-3">
                                <div>
                                    <p className="text-xs font-black uppercase tracking-widest" style={{ color: theme === 'dark' ? '#a1a1aa' : '#64748b' }}>Outras integracoes</p>
                                    <p className="text-xs" style={{ color: theme === 'dark' ? '#71717a' : '#94a3b8' }}>Dados sensiveis ficam ocultos. Clique nas acoes para testar, ativar ou trocar o padrao.</p>
                                </div>
                                {emailIntegrations
                                    .filter((integration) => integration.id !== emailConfig.integrationId)
                                    .map((integration) => (
                                        <div
                                            key={integration.id}
                                            className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-4"
                                            style={{
                                                backgroundColor: isDark ? '#27272a' : '#ffffff',
                                                borderColor: isDark ? '#3f3f46' : '#e2e8f0'
                                            }}
                                        >
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="font-bold" style={{ color: theme === 'dark' ? '#fafafa' : '#0f172a' }}>{integration.email_address || integration.username || getEmailProviderLabel(integration)}</span>
                                                    {getStatusBadge(getEmailStatusForRow(integration))}
                                                    {integration.is_default && <Badge variant="outline" className="rounded-lg text-[10px] font-bold">Padrao</Badge>}
                                                </div>
                                                <p className="mt-1 text-xs" style={{ color: theme === 'dark' ? '#a1a1aa' : '#64748b' }}>
                                                    {getEmailProviderLabel(integration)} - {integration.can_read ? 'leitura' : 'sem leitura'} / {integration.can_send ? 'envio' : 'sem envio'}
                                                </p>
                                                <p className="mt-1 text-[11px]" style={{ color: theme === 'dark' ? '#71717a' : '#94a3b8' }}>
                                                    Ultimo teste: {formatIntegrationDateTime(integration.last_test_at)}
                                                </p>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Button variant="outline" size="sm" onClick={() => handleTestEmailIntegration(integration.id)} disabled={testingEmail || saving} className="rounded-xl">
                                                    Testar
                                                </Button>
                                                {!integration.is_default && (
                                                    <Button variant="outline" size="sm" onClick={() => handleSetDefaultEmailIntegration(integration.id)} disabled={saving} className="rounded-xl">
                                                        Definir padrao
                                                    </Button>
                                                )}
                                                <Button variant="ghost" size="sm" onClick={() => handleToggleEmailIntegration(integration)} disabled={saving} className="rounded-xl">
                                                    {integration.is_active === false ? 'Ativar' : 'Desativar'}
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                {emailIntegrations.filter((integration) => integration.id !== emailConfig.integrationId).length === 0 && (
                                    <div className="rounded-2xl border p-4 text-xs" style={{ borderColor: isDark ? '#3f3f46' : '#e2e8f0', color: theme === 'dark' ? '#a1a1aa' : '#64748b' }}>
                                        Nenhuma integracao secundaria cadastrada.
                                    </div>
                                )}
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={() => {
                                setIsAddingEmail(true)
                                setIsEmailExpanded(false)
                            }}
                            className="flex w-full items-center justify-center gap-3 rounded-2xl border border-dashed p-6 text-sm font-bold transition-colors duration-150"
                            style={{
                                borderColor: isDark ? '#3f3f46' : '#cbd5e1',
                                backgroundColor: isDark ? 'rgba(39, 39, 42, 0.35)' : 'rgba(248, 250, 252, 0.7)',
                                color: theme === 'dark' ? '#d4d4d8' : '#475569'
                            }}
                        >
                            <Plus className="h-5 w-5" />
                            Adicionar integracao de email
                        </button>
                        {isAddingEmail && (
                            <div className="rounded-2xl border p-5" style={{ backgroundColor: isDark ? '#27272a' : '#ffffff', borderColor: isDark ? '#3f3f46' : '#e2e8f0' }}>
                                <div className="mb-5 flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-sm font-bold" style={{ color: theme === 'dark' ? '#fafafa' : '#0f172a' }}>Nova integracao de email</p>
                                        <p className="text-xs" style={{ color: theme === 'dark' ? '#a1a1aa' : '#64748b' }}>Crie outro conector de email sem sobrescrever o atual.</p>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={() => setIsAddingEmail(false)} className="rounded-xl">Cancelar</Button>
                                </div>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <Select value={newEmailProviderPreset} onValueChange={(value: EmailProviderPreset) => handleNewEmailPresetChange(value)}>
                                        <SelectTrigger className="h-12 rounded-xl" style={inputSurface}>
                                            <SelectValue placeholder="Provedor" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="gmail">Gmail</SelectItem>
                                            <SelectItem value="microsoft365">Microsoft 365 corporativo</SelectItem>
                                            <SelectItem value="outlook_personal">Outlook.com pessoal</SelectItem>
                                            <SelectItem value="hotmail">Hotmail pessoal</SelectItem>
                                            <SelectItem value="yahoo">Yahoo Mail</SelectItem>
                                            <SelectItem value="custom">IMAP/SMTP personalizado</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Input placeholder="Email principal" value={newEmailConfig.emailAddress} onChange={(e) => {
                                        const value = e.target.value
                                        setNewEmailConfig((p) => ({
                                            ...p,
                                            emailAddress: value,
                                            username: !p.username || p.username === p.emailAddress ? value : p.username,
                                            status: 'configured',
                                        }))
                                    }} className="h-12 rounded-xl" style={inputSurface} />
                                    {newEmailProviderPreset === 'microsoft365' ? (
                                    <>
                                    <Input placeholder="Client ID" value={newEmailConfig.oauthClientId} onChange={(e) => setNewEmailConfig((p) => ({ ...p, oauthClientId: e.target.value, status: 'configured' }))} className="h-12 rounded-xl" style={inputSurface} />
                                    <Input type="password" placeholder={newEmailConfig.hasOAuthClientSecret ? 'Ja salvo - preencha para rotacionar' : 'Client Secret'} value={newEmailConfig.oauthClientSecret} onChange={(e) => setNewEmailConfig((p) => ({ ...p, oauthClientSecret: e.target.value, status: 'configured' }))} className="h-12 rounded-xl" style={inputSurface} />
                                    <Input placeholder="Redirect URI" value={newEmailConfig.oauthRedirectUri} onChange={(e) => setNewEmailConfig((p) => ({ ...p, oauthRedirectUri: e.target.value, status: 'configured' }))} className="h-12 rounded-xl md:col-span-2" style={inputSurface} />
                                    <Input placeholder="Tenant ID (ou common)" value={newEmailConfig.oauthTenantId} onChange={(e) => setNewEmailConfig((p) => ({ ...p, oauthTenantId: e.target.value, status: 'configured' }))} className="h-12 rounded-xl" style={inputSurface} />
                                    </>
                                    ) : (
                                    <>
                                    <Input placeholder="Usuario / login" value={newEmailConfig.username} onChange={(e) => setNewEmailConfig((p) => ({ ...p, username: e.target.value, status: 'configured' }))} className="h-12 rounded-xl" style={inputSurface} />
                                    <Input type="password" placeholder="Senha / app password" value={newEmailConfig.password} onChange={(e) => setNewEmailConfig((p) => ({ ...p, password: e.target.value, status: 'configured' }))} className="h-12 rounded-xl" style={inputSurface} />
                                    </>
                                    )}
                                    {newEmailProviderPreset === 'custom' && (
                                    <Select value={newEmailConfig.authType} onValueChange={(value: EmailAuthType) => setNewEmailConfig((p) => ({ ...p, authType: value, status: 'configured' }))}>
                                        <SelectTrigger className="h-12 rounded-xl" style={inputSurface}>
                                            <SelectValue placeholder="Autenticacao" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="basic">Senha comum</SelectItem>
                                            <SelectItem value="app_password">App password</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    )}
                                    {newEmailProviderPreset !== 'custom' && (
                                        <div className="rounded-xl border px-4 py-3 text-xs md:col-span-2" style={{ borderColor: isDark ? '#3f3f46' : '#e2e8f0', color: theme === 'dark' ? '#d4d4d8' : '#475569' }}>
                                            {getEmailPresetHint(newEmailProviderPreset)}
                                        </div>
                                    )}
                                    {newEmailProviderPreset === 'custom' && (
                                    <>
                                    <Input placeholder="SMTP host" value={newEmailConfig.smtpHost} onChange={(e) => setNewEmailConfig((p) => ({ ...p, smtpHost: e.target.value, status: 'configured' }))} className="h-12 rounded-xl" style={inputSurface} />
                                    <Input placeholder="SMTP porta" value={newEmailConfig.smtpPort} onChange={(e) => setNewEmailConfig((p) => ({ ...p, smtpPort: e.target.value, status: 'configured' }))} className="h-12 rounded-xl" style={inputSurface} />
                                    <Input placeholder="IMAP host" value={newEmailConfig.imapHost} onChange={(e) => setNewEmailConfig((p) => ({ ...p, imapHost: e.target.value, status: 'configured' }))} className="h-12 rounded-xl" style={inputSurface} />
                                    <Input placeholder="IMAP porta" value={newEmailConfig.imapPort} onChange={(e) => setNewEmailConfig((p) => ({ ...p, imapPort: e.target.value, status: 'configured' }))} className="h-12 rounded-xl" style={inputSurface} />
                                    </>
                                    )}
                                </div>
                                <div className="mt-5 flex justify-end">
                                    <Button onClick={handleAddEmailIntegration} disabled={saving} className="rounded-xl">
                                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                                        Salvar nova integracao
                                    </Button>
                                </div>
                            </div>
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
                        <button
                            type="button"
                            onClick={() => setIsVoiceExpanded((value) => !value)}
                            className="flex w-full items-center justify-between gap-4 rounded-2xl border p-5 text-left transition-colors duration-150"
                            style={{
                                backgroundColor: isDark ? '#27272a' : '#ffffff',
                                borderColor: isVoiceExpanded ? (isDark ? 'rgba(99, 102, 241, 0.45)' : 'rgba(99, 102, 241, 0.28)') : (isDark ? '#3f3f46' : '#e2e8f0')
                            }}
                        >
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-bold" style={{ color: theme === 'dark' ? '#fafafa' : '#0f172a' }}>Voz IA</span>
                                    <Badge variant="outline" className="rounded-lg text-[10px] font-bold">
                                        {voiceRuntimeStatus?.supportsRealtimeCalls ? 'Recebe chamadas' : 'Nao configurado'}
                                    </Badge>
                                </div>
                                <p className="mt-1 truncate text-xs" style={{ color: theme === 'dark' ? '#a1a1aa' : '#64748b' }}>
                                    Clique para ver disponibilidade real e limites atuais do canal de voz.
                                </p>
                            </div>
                            <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-150 ${isVoiceExpanded ? 'rotate-180' : ''}`} />
                        </button>
                        {isVoiceExpanded && (
                        <div className="py-8 text-center">
                            <div className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-full border ${isDark ? 'bg-zinc-800/80 text-zinc-200 border-zinc-600/60' : 'bg-indigo-50/50 text-indigo-700 border-indigo-200/50'}`}>
                                <Clock className="h-4 w-4" />
                                {voiceRuntimeStatus?.supportsRealtimeCalls ? 'Chamadas recebidas disponiveis' : t('integrations.voice.comingSoon')}
                            </div>
                            <p className={`text-xs mt-3 ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
                                {voiceRuntimeMessage || t('integrations.voice.comingSoonDescription')}
                            </p>
                            <p className={`text-xs mt-2 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                                Hoje a plataforma esta preparada para receber chamadas que o proprio WhatsApp entregar ao numero oficial.
                                Ela ainda nao cria um botao proprio de "ligar" dentro da interface da SONIA para iniciar chamada de saida.
                            </p>
                        </div>
                        )}
                        <button
                            type="button"
                            disabled
                            className="mt-5 flex w-full cursor-not-allowed items-center justify-center gap-3 rounded-2xl border border-dashed p-6 text-sm font-bold opacity-70"
                            style={{
                                borderColor: isDark ? '#3f3f46' : '#cbd5e1',
                                backgroundColor: isDark ? 'rgba(39, 39, 42, 0.35)' : 'rgba(248, 250, 252, 0.7)',
                                color: theme === 'dark' ? '#d4d4d8' : '#475569'
                            }}
                        >
                            <Plus className="h-5 w-5" />
                            Adicionar integracao de voz em breve
                        </button>
                    </CardContent>
                </Card>

            </div>
        </div>
    )
}
