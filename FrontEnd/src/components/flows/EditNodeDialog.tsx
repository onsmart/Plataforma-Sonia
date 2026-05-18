import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { Switch } from '../ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { toast } from 'sonner'
import { ConditionBuilder } from './ConditionBuilder'
import { Wand2, RefreshCw, Infinity, Hash, Plus, Minus, Search, Clock, Info, FileText, Bug, SendHorizontal, Link2, BellRing } from 'lucide-react'
import { BASE_URL, getAuthHeaders } from '../../services/api'
import { supabase } from '../../utils/supabase/client'
import { ACCENT_BAR, type FlowAccent } from './flowBlockTheme'

interface AvailableAgent {
  id: string
  name: string
  bio: string | null
}

interface AvailableTemplate {
  id: string
  name: string
  description: string | null
}

interface AvailableFlow {
  id: string
  name: string
}

const WA_INTEGRATION_SELECT_CONTEXT = '__wa_ctx__'
const EMAIL_INTEGRATION_SELECT_CONTEXT = '__email_ctx__'

type EmailIntegrationOption = {
  id: string
  email_address?: string | null
  provider_family?: string | null
  can_read?: boolean
  can_send?: boolean
}

type WaCatalogTemplate = {
  name: string
  language: string
  status?: string | null
  category?: string | null
  components_json?: unknown[]
  synced_at?: string | null
}

type WaTemplateExactResult = {
  components: Array<Record<string, unknown>>
  missingRequirements: string[]
}

type CrmIntegrationOption = {
  id: string
  config?: {
    provider_slug?: string | null
    provider_name?: string | null
    auth_mode?: string | null
  } | null
  tb_crms?:
    | {
        id?: string
        name?: string
        slug?: string
      }
    | Array<{
        id?: string
        name?: string
        slug?: string
      }>
    | null
}

function getCrmOptionRelation(row: CrmIntegrationOption) {
  return Array.isArray(row.tb_crms) ? row.tb_crms[0] : row.tb_crms
}

function getCrmOptionSlug(row: CrmIntegrationOption) {
  const crm = getCrmOptionRelation(row)
  return String(crm?.slug || row.config?.provider_slug || '').trim().toLowerCase()
}

function getCrmOptionName(row: CrmIntegrationOption) {
  const crm = getCrmOptionRelation(row)
  return String(crm?.name || row.config?.provider_name || 'HubSpot').trim()
}

type CalendarIntegrationOption = {
  id: string
  email_address?: string | null
  provider?: string | null
}

type IntegrationToolDescriptor = {
  provider: 'calendly' | 'hubspot' | 'whatsapp' | 'email'
  toolName: string
  displayName: string
  description: string
  requiredFields: string[]
}

type IntegrationToolProvider = IntegrationToolDescriptor['provider']

function normalizeIntegrationToolData(currentData: Record<string, unknown>) {
  return {
    integrationToolEnabled: currentData.integrationToolEnabled === true,
    integrationToolProvider: String(currentData.integrationToolProvider || '').trim(),
    integrationToolName: String(currentData.integrationToolName || '').trim(),
    integrationToolIntegrationId: String(currentData.integrationToolIntegrationId || '').trim(),
    integrationToolResultKey: String(currentData.integrationToolResultKey || 'integration_action').trim() || 'integration_action',
    integrationToolPayloadJson:
      typeof currentData.integrationToolPayloadJson === 'string'
        ? currentData.integrationToolPayloadJson
        : JSON.stringify(currentData.integrationToolPayloadJson || {}, null, 2),
    integrationToolFailOnError: currentData.integrationToolFailOnError === true,
  }
}

const NODE_MODAL_ACCENT: Record<string, FlowAccent> = {
  agent: 'emerald',
  loop: 'purple',
  'if-else': 'orange',
  switch: 'indigo',
  subflow: 'indigo',
  delay: 'cyan',
  schedule: 'sky',
  comment: 'amber',
  debug: 'purple',
  email_send: 'amber',
  email_read: 'rose',
  whatsapp_message: 'green',
  hubspot_whatsapp_campaign: 'teal',
  crm_contact: 'teal',
  appointment: 'sky',
  document_intake: 'amber',
  human_handoff: 'rose',
  wa_template: 'purple',
  wa_session_window: 'sky',
}

function getNodeModalAccent(nodeType?: string): FlowAccent {
  return NODE_MODAL_ACCENT[String(nodeType || '')] || 'blue'
}

function buildAccentPanelStyle(accent: FlowAccent, alpha = 0.1, borderAlpha = 0.28): React.CSSProperties {
  const { rgb } = ACCENT_BAR[accent]
  return {
    backgroundColor: `rgba(${rgb}, ${alpha})`,
    borderColor: `rgba(${rgb}, ${borderAlpha})`,
    boxShadow: `0 18px 34px -28px rgba(${rgb}, 0.34)`,
  }
}

function buildAccentBadgeStyle(accent: FlowAccent): React.CSSProperties {
  const { rgb } = ACCENT_BAR[accent]
  return {
    ...buildAccentPanelStyle(accent, 0.13, 0.32),
    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.6), 0 20px 38px -30px rgba(${rgb}, 0.44)`,
  }
}

function buildAccentTextStyle(accent: FlowAccent, selected = true): React.CSSProperties {
  const tone = ACCENT_BAR[accent]
  return { color: selected ? tone.selected : tone.idle }
}

function buildAccentButtonStyle(accent: FlowAccent): React.CSSProperties {
  const tone = ACCENT_BAR[accent]
  return {
    backgroundColor: tone.idle,
    boxShadow: `0 10px 25px -5px rgba(${tone.rgb}, 0.38)`,
  }
}

function encodeWaCatalogValue(name: string, language: string) {
  return `${name}\t${language}`
}

function decodeWaCatalogValue(raw: string): { name: string; language: string } {
  const tab = raw.indexOf('\t')
  if (tab < 0) return { name: raw, language: 'pt_BR' }
  return { name: raw.slice(0, tab), language: raw.slice(tab + 1) || 'pt_BR' }
}

function ensureWaButtons(value: unknown): Array<{ id?: string; text: string }> {
  if (!Array.isArray(value)) return []
  return value
    .map((button, index) => ({
      id: typeof button === 'object' && button && 'id' in button ? String((button as { id?: string }).id || `btn_${index + 1}`) : `btn_${index + 1}`,
      text: typeof button === 'object' && button && 'text' in button ? String((button as { text?: string }).text || '') : '',
    }))
}

function ensureStringList(value: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(value)) return fallback
  return value.map((item) => String(item || '').trim()).filter(Boolean)
}

function normalizeWaCatalogRows(rows: unknown[]): WaCatalogTemplate[] {
  if (!Array.isArray(rows)) return []
  const normalized: WaCatalogTemplate[] = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const item = row as Record<string, unknown>
    const name = String(item.name || '').trim()
    const language = String(item.language || 'pt_BR').trim() || 'pt_BR'
    if (!name) continue
    normalized.push({
      name,
      language,
      status: item.status == null ? null : String(item.status),
      category: item.category == null ? null : String(item.category),
      components_json: Array.isArray(item.components_json) ? item.components_json : [],
      synced_at: item.synced_at == null ? null : String(item.synced_at),
    })
  }
  return normalized
}

function findWaCatalogTemplate(
  catalog: WaCatalogTemplate[],
  name?: string,
  language?: string
): WaCatalogTemplate | null {
  const normalizedName = String(name || '').trim()
  const normalizedLanguage = String(language || '').trim()
  if (!normalizedName || !normalizedLanguage) return null
  return (
    catalog.find((row) => row.name === normalizedName && row.language === normalizedLanguage) || null
  )
}

function waTemplateRequiresVariables(components: unknown[] | undefined): boolean {
  return /\{\{\d+\}\}/.test(JSON.stringify(components || []))
}

function waTemplateRequiresMediaHeader(components: unknown[] | undefined): boolean {
  if (!Array.isArray(components)) return false
  return components.some((item) => {
    if (!item || typeof item !== 'object') return false
    const entry = item as Record<string, unknown>
    return String(entry.type || '').toUpperCase() === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(String(entry.format || '').toUpperCase())
  })
}

function extractWaTemplateBodyPreview(components: unknown[] | undefined): string {
  if (!Array.isArray(components)) return ''
  for (const item of components) {
    if (!item || typeof item !== 'object') continue
    const entry = item as Record<string, unknown>
    if (String(entry.type || '').toUpperCase() !== 'BODY') continue
    const text = String(entry.text || '').trim()
    if (text) return text
  }
  return ''
}

function extractWaTemplateButtonTexts(components: unknown[] | undefined): string[] {
  if (!Array.isArray(components)) return []
  const values: string[] = []
  for (const item of components) {
    if (!item || typeof item !== 'object') continue
    const entry = item as Record<string, unknown>
    if (String(entry.type || '').toUpperCase() !== 'BUTTONS') continue
    const buttons = Array.isArray(entry.buttons) ? (entry.buttons as Array<Record<string, unknown>>) : []
    for (const button of buttons) {
      const text = String(button.text || '').trim()
      if (text) values.push(text)
    }
  }
  return values
}

function flattenWaTemplateStringValues(value: unknown): string[] {
  if (typeof value === 'string' && value.trim()) return [value.trim()]
  if (Array.isArray(value)) return value.flatMap((item) => flattenWaTemplateStringValues(item))
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flatMap((item) => flattenWaTemplateStringValues(item))
  }
  return []
}

function buildWaTemplateExactComponents(components: unknown[] | undefined): WaTemplateExactResult {
  if (!Array.isArray(components)) {
    return { components: [], missingRequirements: [] }
  }

  const exactComponents: Array<Record<string, unknown>> = []
  const missingRequirements: string[] = []

  for (const item of components) {
    if (!item || typeof item !== 'object') continue
    const entry = item as Record<string, unknown>
    const type = String(entry.type || '').toUpperCase()

    if (type === 'HEADER') {
      const format = String(entry.format || '').toUpperCase()
      const headerHandle = flattenWaTemplateStringValues(
        entry.example && typeof entry.example === 'object'
          ? (entry.example as Record<string, unknown>).header_handle
          : undefined
      )[0]

      if (format === 'IMAGE') {
        if (!headerHandle) {
          missingRequirements.push('Cabeçalho com imagem sem exemplo utilizável no catálogo da Meta.')
          continue
        }
        exactComponents.push({
          type: 'header',
          parameters: [
            {
              type: 'image',
              image: { link: headerHandle }
            }
          ]
        })
        continue
      }

      if (format === 'VIDEO') {
        if (!headerHandle) {
          missingRequirements.push('Cabeçalho com vídeo sem exemplo utilizável no catálogo da Meta.')
          continue
        }
        exactComponents.push({
          type: 'header',
          parameters: [
            {
              type: 'video',
              video: { link: headerHandle }
            }
          ]
        })
        continue
      }

      if (format === 'DOCUMENT') {
        if (!headerHandle) {
          missingRequirements.push('Cabeçalho com documento sem exemplo utilizável no catálogo da Meta.')
          continue
        }
        exactComponents.push({
          type: 'header',
          parameters: [
            {
              type: 'document',
              document: {
                link: headerHandle,
                filename: 'template-document.pdf'
              }
            }
          ]
        })
        continue
      }
    }
  }

  return { components: exactComponents, missingRequirements }
}

interface EditNodeDialogProps {
  isOpen: boolean
  onClose: () => void
  node: any
  onSave: (nodeId: string, data: any) => void
  availableAgents?: AvailableAgent[]
  /** Quando true (ex.: editor de Fluxos), só permite vincular agentes - sem modo template. */
  agentsOnly?: boolean
  availableTemplates?: AvailableTemplate[]
  availableFlows?: AvailableFlow[]
  currentFlowId?: string | null
  currentFlowName?: string | null
  currentFlowKind?: 'main' | 'subflow' | null
  nextSubflowOrder?: number
  onFlowCreated?: (flow: AvailableFlow) => void
  /** Para listar integrações WhatsApp ao configurar template Meta. */
  userEmail?: string | null
  companiesId?: string | null
  currentUserId?: string | null
}

export function EditNodeDialog({
  isOpen,
  onClose,
  node,
  onSave,
  availableAgents = [],
  agentsOnly = false,
  availableTemplates = [],
  availableFlows = [],
  currentFlowId = null,
  currentFlowName = null,
  currentFlowKind = null,
  nextSubflowOrder = 1,
  onFlowCreated,
  userEmail = null,
  companiesId = null,
  currentUserId = null,
}: EditNodeDialogProps) {
  const [formData, setFormData] = useState<any>({})
  const [isFlowDropdownOpen, setIsFlowDropdownOpen] = useState(false)
  const [delayTimeUnit, setDelayTimeUnit] = useState<'seconds' | 'minutes' | 'hours'>('seconds')
  const [waIntegrations, setWaIntegrations] = useState<{ id: string; phone_number?: string | null }[]>([])
  const [crmIntegrations, setCrmIntegrations] = useState<CrmIntegrationOption[]>([])
  const [calendarIntegrations, setCalendarIntegrations] = useState<CalendarIntegrationOption[]>([])
  const [emailIntegrations, setEmailIntegrations] = useState<EmailIntegrationOption[]>([])
  const [waCatalog, setWaCatalog] = useState<WaCatalogTemplate[]>([])
  const [waCatalogBusy, setWaCatalogBusy] = useState(false)
  const [creatingSubflow, setCreatingSubflow] = useState(false)
  const [integrationToolsCatalog, setIntegrationToolsCatalog] = useState<IntegrationToolDescriptor[]>([])

  const applyWaTemplateSelection = (template: WaCatalogTemplate | null, baseFormData: Record<string, unknown>) => {
    if (!template) {
      setFormData(baseFormData)
      return
    }

    const exact = buildWaTemplateExactComponents(template.components_json)
    setFormData({
      ...baseFormData,
      label: String(template.name || 'Template WhatsApp'),
      waTemplateComponentsJson:
        exact.components.length > 0 ? JSON.stringify(exact.components, null, 2) : '',
    })
  }

  const normalizeInitialData = (currentNode: any) => {
    if (!currentNode) return {}

    const currentData = currentNode.data || {}
    if (currentNode.type === 'whatsapp_message') {
      return {
        ...currentData,
        ...normalizeIntegrationToolData(currentData),
        label: currentData.label || 'Mensagem WhatsApp 24h',
        waWindowMode:
          currentData.waWindowMode ||
          (currentData.waFallbackTemplateName || currentData.waFallbackTemplateLanguage
            ? 'auto_template'
            : 'session_only'),
        waMessageType: currentData.waMessageType || 'text',
        waMessageText: currentData.waMessageText || '',
        waButtons: ensureWaButtons(currentData.waButtons),
        waLinkUrl: currentData.waLinkUrl || '',
        waReminderAt: currentData.waReminderAt || '',
        waIntegrationId: currentData.waIntegrationId || '',
        waFallbackTemplateName: currentData.waFallbackTemplateName || '',
        waFallbackTemplateLanguage: currentData.waFallbackTemplateLanguage || '',
      }
    }
    if (currentNode.type === 'wa_template') {
      let compJson = currentData.waTemplateComponentsJson || ''
      if (!compJson && Array.isArray(currentData.waTemplateComponents)) {
        try {
          compJson = JSON.stringify(currentData.waTemplateComponents, null, 2)
        } catch {
          compJson = ''
        }
      }
      return { ...currentData, waTemplateComponentsJson: compJson }
    }
    if (currentNode.type === 'hubspot_whatsapp_campaign') {
      return {
        ...currentData,
        label: currentData.label || 'Audiência HubSpot',
        crmIntegrationId: currentData.crmIntegrationId || '',
        crmFilterField: currentData.crmFilterField || 'tag',
        crmFilterOperator: 'equals',
        crmFilterValue: currentData.crmFilterValue || '',
        crmPhoneField: currentData.crmPhoneField || 'phone',
        crmResultLimit: String(currentData.crmResultLimit || '50'),
      }
    }
    if (currentNode.type === 'crm_contact') {
      return {
        ...currentData,
        label: currentData.label || 'Contato CRM',
        crmOperation: currentData.crmOperation || 'lookup',
        crmIntegrationId: currentData.crmIntegrationId || '',
        lookupFields: ensureStringList(currentData.lookupFields, ['patient_phone', 'patient_email', 'patient_cpf']),
        requiredFields: ensureStringList(currentData.requiredFields, ['patient_name', 'patient_email', 'patient_phone']),
        originTag: currentData.originTag || 'Atendimento IA Clínica',
        allowMissingDob: currentData.allowMissingDob !== false,
      }
    }
    if (currentNode.type === 'appointment') {
      return {
        ...currentData,
        label: currentData.label || 'Ação de agenda',
        appointmentOperation: currentData.appointmentOperation || 'availability',
        appointmentProvider: 'calendly',
        appointmentIntegrationId: currentData.appointmentIntegrationId || '',
        appointmentIntegrationName: currentData.appointmentIntegrationName || '',
        specialtyField: currentData.specialtyField || 'appointment_resource',
        doctorField: currentData.doctorField || 'appointment_owner',
        consultationTypeField: currentData.consultationTypeField || 'appointment_kind',
        unitField: currentData.unitField || 'appointment_location',
        periodField: currentData.periodField || 'appointment_time_preference',
        preferredDateField: currentData.preferredDateField || 'appointment_date',
      }
    }
    if (currentNode.type === 'document_intake') {
      return {
        ...currentData,
        label: currentData.label || 'Document Intake',
        documentKinds: ensureStringList(currentData.documentKinds, ['exam', 'pedido_medico', 'document']),
        notifyTeam: currentData.notifyTeam !== false,
        acceptWithoutFile: currentData.acceptWithoutFile === true,
      }
    }
    if (currentNode.type === 'subflow') {
      return {
        ...currentData,
        label: currentData.label || 'Executar subfluxo',
        subflowId: currentData.subflowId || currentData.flowId || '',
        subflowName: currentData.subflowName || currentData.flowName || '',
        subflowResultKey: currentData.subflowResultKey || 'subflow_result',
        subflowFailOnError: currentData.subflowFailOnError !== false,
      }
    }
    if (currentNode.type === 'human_handoff') {
      return {
        ...currentData,
        label: currentData.label || 'Handoff Humano',
        handoffReasonField: currentData.handoffReasonField || 'handoff_reason',
        handoffPriority: currentData.handoffPriority || 'medium',
        notifyEmail: currentData.notifyEmail || '',
        notifyWhatsApp: currentData.notifyWhatsApp || '',
        patientMessage:
          currentData.patientMessage ||
          'Vou encaminhar seu caso para nossa equipe humana e eles continuarão o atendimento em breve.',
      }
    }
    if (currentNode.type === 'email_send') {
      return {
        ...currentData,
        label: currentData.label || 'Enviar email',
        emailIntegrationId: currentData.emailIntegrationId || '',
        emailTo: currentData.emailTo || '',
        emailSubject: currentData.emailSubject || '',
        emailText: currentData.emailText || '',
      }
    }
    if (currentNode.type === 'schedule') {
      return {
        ...currentData,
        label: currentData.label || 'Agendar data e hora',
        scheduleAt: currentData.scheduleAt || '',
        scheduleTimezone: currentData.scheduleTimezone || 'America/Sao_Paulo',
      }
    }
    if (currentNode.type === 'email_read') {
      return {
        ...currentData,
        label: currentData.label || 'Ler inbox email',
        emailIntegrationId: currentData.emailIntegrationId || '',
        emailReadLimit: String(currentData.emailReadLimit || '5'),
      }
    }
    if (currentNode.type !== 'agent') {
      return currentData
    }

    if (agentsOnly) {
      return {
        ...currentData,
        ...normalizeIntegrationToolData(currentData),
        executionMode: 'agent' as const,
        label: currentData.label || 'Agente IA',
        agentId: currentData.agentId || '',
        agentName: currentData.agentName || '',
        templateId: '',
        templateName: '',
        bio: currentData.bio || '',
        additionalInstructions: currentData.additionalInstructions || '',
        skipReplyConfidence: currentData.skipReplyConfidence === true,
      }
    }

    return {
      ...currentData,
      ...normalizeIntegrationToolData(currentData),
      executionMode: currentData.executionMode || (currentData.templateId && !currentData.agentId ? 'template' : 'agent'),
      label: currentData.label || 'Agente IA',
      agentId: currentData.agentId || '',
      agentName: currentData.agentName || '',
      templateId: currentData.templateId || '',
      templateName: currentData.templateName || '',
      bio: currentData.bio || '',
      additionalInstructions: currentData.additionalInstructions || '',
    }
  }

  useEffect(() => {
    if (node) {
      setFormData(normalizeInitialData(node))
      setIsFlowDropdownOpen(false)
    }
  }, [node?.id, node?.type, agentsOnly])

  useEffect(() => {
    if (!isOpen || (node?.type !== 'agent' && node?.type !== 'whatsapp_message')) {
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const response = await fetch(`${BASE_URL}/integration-tools/catalog`, {
          method: 'GET',
          headers: await getAuthHeaders(false),
        })
        const result = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(result?.details || result?.error || 'Erro ao carregar catálogo de integrações.')
        }

        if (!cancelled) {
          setIntegrationToolsCatalog(Array.isArray(result?.tools) ? result.tools : [])
        }
      } catch {
        if (!cancelled) setIntegrationToolsCatalog([])
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isOpen, node?.type, node?.id])

  useEffect(() => {
    if (
      !isOpen ||
      !userEmail ||
      node?.type !== 'wa_template' &&
      node?.type !== 'whatsapp_message' &&
      node?.type !== 'agent'
    ) {
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const { WhatsAppService } = await import('../../services/api')
        const rows = await WhatsAppService.listIntegrationsByEmail(userEmail)
        if (!cancelled) {
          setWaIntegrations(rows)
        }
      } catch {
        if (!cancelled) setWaIntegrations([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isOpen, userEmail, node?.type, node?.id])

  useEffect(() => {
    if (!isOpen || (node?.type !== 'hubspot_whatsapp_campaign' && node?.type !== 'crm_contact' && node?.type !== 'agent')) {
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        let resolvedCompaniesId = String(companiesId || '').trim()

        if (!resolvedCompaniesId) {
          let fallbackUserId = String(currentUserId || '').trim()
          if (!fallbackUserId) {
            const { data: authData } = await supabase.auth.getUser()
            fallbackUserId = String(authData?.user?.id || '').trim()
          }

          if (!fallbackUserId) {
            if (!cancelled) setCrmIntegrations([])
            return
          }

          const { data: companyUser } = await supabase
            .from('tb_company_users')
            .select('companies_id')
            .eq('user_id', fallbackUserId)
            .maybeSingle()

          resolvedCompaniesId = String(companyUser?.companies_id || '').trim()
        }

        if (!resolvedCompaniesId) {
          if (!cancelled) setCrmIntegrations([])
          return
        }

        const { data } = await supabase
          .from('tb_crm_integrations')
          .select('id, config, tb_crms (id, name, slug)')
          .eq('companies_id', resolvedCompaniesId)
          .eq('is_active', true)

        const rows = Array.isArray(data)
          ? data.filter((row: any) => getCrmOptionSlug(row) === 'hubspot')
          : []

        if (!cancelled) {
          setCrmIntegrations(rows as CrmIntegrationOption[])
        }
      } catch {
        if (!cancelled) setCrmIntegrations([])
      }
    })()

    return () => {
      cancelled = true
    }
  }, [companiesId, currentUserId, isOpen, node?.type, node?.id])

  useEffect(() => {
    if (!isOpen || (node?.type !== 'appointment' && node?.type !== 'agent' && node?.type !== 'whatsapp_message')) {
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const response = await fetch(`${BASE_URL}/calendar/integrations`, {
          method: 'GET',
          headers: await getAuthHeaders(false),
        })
        const result = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(result?.details || result?.error || 'Erro ao carregar integrações de agenda.')
        }

        if (!cancelled) {
          setCalendarIntegrations(Array.isArray(result?.integrations) ? result.integrations : [])
        }
      } catch {
        if (!cancelled) setCalendarIntegrations([])
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isOpen, node?.type, node?.id])

  useEffect(() => {
    if (!isOpen || (node?.type !== 'email_send' && node?.type !== 'email_read' && node?.type !== 'agent' && node?.type !== 'whatsapp_message')) {
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const response = await fetch(`${BASE_URL}/email/integrations`, {
          method: 'GET',
          headers: await getAuthHeaders(false),
        })
        const result = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(result?.details || result?.error || 'Erro ao carregar integrações de email.')
        }

        if (!cancelled) {
          setEmailIntegrations(Array.isArray(result?.integrations) ? result.integrations : [])
        }
      } catch {
        if (!cancelled) setEmailIntegrations([])
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isOpen, node?.type, node?.id])

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isFlowDropdownOpen) {
        const target = event.target as HTMLElement
        if (!target.closest('.flow-dropdown-container')) {
          setIsFlowDropdownOpen(false)
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isFlowDropdownOpen])

  if (!node) {
    return null
  }

  const integrationToolProvider = String(formData.integrationToolProvider || '').trim() as IntegrationToolProvider | ''
  const integrationToolsForProvider = integrationToolProvider
    ? integrationToolsCatalog.filter((item) => item.provider === integrationToolProvider)
    : []

  const persistIntegrationToolConfig = () => {
    if (formData.integrationToolEnabled !== true) {
      return {
        integrationToolEnabled: false,
        integrationToolProvider: '',
        integrationToolName: '',
        integrationToolIntegrationId: '',
        integrationToolResultKey: '',
        integrationToolPayloadJson: '',
        integrationToolFailOnError: false,
      }
    }

    const provider = String(formData.integrationToolProvider || '').trim()
    const toolName = String(formData.integrationToolName || '').trim()
    const resultKey = String(formData.integrationToolResultKey || 'integration_action').trim() || 'integration_action'
    const payloadJson = String(formData.integrationToolPayloadJson || '').trim() || '{}'

    if (!provider || !toolName) {
      throw new Error('Selecione o provider e a ação da ferramenta de integração.')
    }

    try {
      const parsed = JSON.parse(payloadJson)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('O payload deve ser um objeto JSON.')
      }
    } catch (error: any) {
      throw new Error(error?.message || 'JSON inválido na ferramenta de integração.')
    }

    return {
      integrationToolEnabled: true,
      integrationToolProvider: provider,
      integrationToolName: toolName,
      integrationToolIntegrationId: String(formData.integrationToolIntegrationId || '').trim(),
      integrationToolResultKey: resultKey,
      integrationToolPayloadJson: payloadJson,
      integrationToolFailOnError: formData.integrationToolFailOnError === true,
    }
  }

  const createAndSelectSubflow = async () => {
    if (!userEmail) {
      toast.error('Faça login para criar um subfluxo.')
      return
    }

    const baseName = String(formData.label || node?.data?.label || 'Novo subfluxo').trim()
    const normalizedOrder = Math.max(1, Number.isFinite(Number(nextSubflowOrder)) ? Number(nextSubflowOrder) : 1)
    const orderLabel = String(normalizedOrder).padStart(2, '0')
    const parentPrefix = String(currentFlowName || '').trim()
    const cleanBaseName = baseName.replace(/^subfluxo\s*-\s*/i, '').trim() || 'Nova etapa'
    const subflowName = parentPrefix
      ? `${parentPrefix} - ${orderLabel} ${cleanBaseName}`
      : `Subfluxo ${orderLabel} - ${cleanBaseName}`

    setCreatingSubflow(true)
    try {
      const flowData = {
        startNodeId: 'subflow-start',
        meta: {
          kind: 'subflow',
          parentFlowId: currentFlowId || null,
          parentFlowName: currentFlowName || null,
          subflowOrder: normalizedOrder,
        },
        nodes: [
          { id: 'subflow-start', type: 'start', position: { x: 80, y: 80 }, data: { label: 'Inicio' } },
          {
            id: 'subflow-note',
            type: 'comment',
            position: { x: 80, y: 210 },
            data: {
              label: 'Novo subfluxo',
              comment: 'Monte aqui a etapa reutilizavel. O contexto do fluxo principal chega automaticamente.',
            },
          },
          {
            id: 'subflow-stop',
            type: 'stop',
            position: { x: 80, y: 370 },
            data: { label: 'Saída do subfluxo', stopScope: 'subflow' },
          },
        ],
        edges: [
          { source: 'subflow-start', target: 'subflow-note' },
          { source: 'subflow-note', target: 'subflow-stop', sourceHandle: 'pointer' },
        ],
      }

      const response = await fetch(`${BASE_URL}/flows`, {
        method: 'POST',
        headers: {
          ...(await getAuthHeaders()),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: subflowName,
          nodes: flowData,
          user_email: userEmail,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.flow?.id) {
        throw new Error(payload?.details || payload?.error || 'Nao foi possivel criar o subfluxo.')
      }

      const created = { id: String(payload.flow.id), name: String(payload.flow.name || subflowName) }
      onFlowCreated?.(created)
      setFormData({
        ...formData,
        subflowId: created.id,
        subflowName: created.name,
        subflowResultKey: formData.subflowResultKey || 'subflow_result',
      })
      toast.success('Subfluxo criado e conectado ao bloco.')
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao criar subfluxo.')
    } finally {
      setCreatingSubflow(false)
    }
  }

  const renderIntegrationToolConfig = (accent: FlowAccent) => (
    <div className="space-y-4 rounded-2xl border p-4" style={buildAccentPanelStyle(accent, 0.08, 0.2)}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Label className="text-sm font-semibold">Ação de integração</Label>
          <p className="text-xs text-muted-foreground">
            Execute uma ferramenta opcional antes do bloco principal e reaproveite o resultado no contexto.
          </p>
        </div>
        <Switch
          checked={formData.integrationToolEnabled === true}
          onCheckedChange={(checked) =>
            setFormData({
              ...formData,
              integrationToolEnabled: checked,
              integrationToolProvider: checked ? formData.integrationToolProvider || 'calendly' : '',
              integrationToolName: checked ? formData.integrationToolName || '' : '',
              integrationToolIntegrationId: checked ? formData.integrationToolIntegrationId || '' : '',
              integrationToolPayloadJson: checked ? formData.integrationToolPayloadJson || '{\n  \n}' : '',
            })
          }
        />
      </div>

      {formData.integrationToolEnabled === true && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Provider</Label>
              <Select
                value={integrationToolProvider || undefined}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    integrationToolProvider: value,
                    integrationToolName: '',
                    integrationToolIntegrationId: '',
                  })
                }
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecione o provider" />
                </SelectTrigger>
                <SelectContent>
                  {(['calendly', 'hubspot', 'whatsapp', 'email'] as IntegrationToolProvider[]).map((provider) => (
                    <SelectItem key={provider} value={provider}>
                      {provider === 'calendly'
                        ? 'Calendly'
                        : provider === 'hubspot'
                          ? 'HubSpot'
                          : provider === 'whatsapp'
                            ? 'WhatsApp'
                            : 'Email'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Ação</Label>
              <Select
                value={String(formData.integrationToolName || '') || undefined}
                onValueChange={(value) => setFormData({ ...formData, integrationToolName: value })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecione a ação" />
                </SelectTrigger>
                <SelectContent>
                  {integrationToolsForProvider.map((tool) => (
                    <SelectItem key={`${tool.provider}:${tool.toolName}`} value={tool.toolName}>
                      {tool.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {integrationToolProvider === 'calendly' && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Integração Calendly</Label>
              <Select
                value={String(formData.integrationToolIntegrationId || '__none__')}
                onValueChange={(value) => setFormData({ ...formData, integrationToolIntegrationId: value === '__none__' ? '' : value })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecione a integração" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem integração fixa</SelectItem>
                  {calendarIntegrations.map((integration) => (
                    <SelectItem key={integration.id} value={integration.id}>
                      {String(integration.email_address || integration.provider || integration.id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {crmIntegrations.length === 0 && (
                <p className="text-xs text-amber-500">
                  Nenhuma integração HubSpot ativa foi encontrada para este workspace.
                </p>
              )}
            </div>
          )}

          {integrationToolProvider === 'hubspot' && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Integração HubSpot</Label>
              <Select
                value={String(formData.integrationToolIntegrationId || '__none__')}
                onValueChange={(value) => setFormData({ ...formData, integrationToolIntegrationId: value === '__none__' ? '' : value })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecione a integração" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem integração fixa</SelectItem>
                  {crmIntegrations.map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {getCrmOptionName(row)} · {row.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {integrationToolProvider === 'whatsapp' && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Integração WhatsApp</Label>
              <Select
                value={String(formData.integrationToolIntegrationId || '__none__')}
                onValueChange={(value) => setFormData({ ...formData, integrationToolIntegrationId: value === '__none__' ? '' : value })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecione a integração" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem integração fixa</SelectItem>
                  {waIntegrations.map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.phone_number || row.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {integrationToolProvider === 'email' && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Integração Email</Label>
              <Select
                value={String(formData.integrationToolIntegrationId || '__none__')}
                onValueChange={(value) => setFormData({ ...formData, integrationToolIntegrationId: value === '__none__' ? '' : value })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecione a integração" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem integração fixa</SelectItem>
                  {emailIntegrations.map((integration) => (
                    <SelectItem key={integration.id} value={integration.id}>
                      {String(integration.email_address || integration.provider_family || integration.id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-sm font-semibold">Payload JSON</Label>
            <Textarea
              value={String(formData.integrationToolPayloadJson || '{\n  \n}')}
              onChange={(e) => setFormData({ ...formData, integrationToolPayloadJson: e.target.value })}
              rows={8}
              className="rounded-xl font-mono text-xs"
              placeholder={'{\n  "specialty": "{{specialty}}",\n  "preferredDate": "{{appointment_date}}"\n}'}
            />
            <p className="text-xs text-muted-foreground">
              Use `{{chaves_do_contexto}}` para preencher valores dinâmicos. O resultado fica salvo na chave definida abaixo.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Chave de resultado</Label>
              <Input
                value={String(formData.integrationToolResultKey || 'integration_action')}
                onChange={(e) => setFormData({ ...formData, integrationToolResultKey: e.target.value })}
                placeholder="integration_action"
                className="rounded-xl font-mono"
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border px-3 py-2">
              <div>
                <Label className="text-sm font-semibold">Falhar o bloco se der erro</Label>
                <p className="text-xs text-muted-foreground">Quando desligado, o erro fica no contexto e o fluxo continua.</p>
              </div>
              <Switch
                checked={formData.integrationToolFailOnError === true}
                onCheckedChange={(checked) => setFormData({ ...formData, integrationToolFailOnError: checked })}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )

  const handleSave = () => {
    if (node.type === 'whatsapp_message') {
      const messageType = (formData.waMessageType || 'text') as 'text' | 'buttons' | 'link' | 'reminder'
      const messageText = String(formData.waMessageText || '').trim()
      const waWindowMode =
        formData.waWindowMode === 'auto_template' ? 'auto_template' : 'session_only'
      const selectedFallbackTemplate = findWaCatalogTemplate(
        waCatalog,
        String(formData.waFallbackTemplateName || ''),
        String(formData.waFallbackTemplateLanguage || '')
      )
      const buttons = ensureWaButtons(formData.waButtons)
        .map((button, index) => ({ ...button, id: button.id || `btn_${index + 1}`, text: String(button.text || '').trim() }))
        .filter((button) => button.text)

      if (!messageText) {
        toast.error('Escreva a mensagem que será enviada.')
        return
      }
      if (messageType === 'buttons' && buttons.length === 0) {
        toast.error('Adicione pelo menos um botão.')
        return
      }
      if (messageType === 'link' && !String(formData.waLinkUrl || '').trim()) {
        toast.error('Informe o link que será mostrado na mensagem.')
        return
      }
      if (
        waWindowMode === 'auto_template' &&
        selectedFallbackTemplate &&
        (waTemplateRequiresVariables(selectedFallbackTemplate.components_json) ||
          waTemplateRequiresMediaHeader(selectedFallbackTemplate.components_json))
      ) {
        toast.error('Esse template da Meta exige mídia ou variáveis. Para usar o modelo exato, prefira o bloco Template WhatsApp.')
        return
      }

      let integrationToolConfig = {}
      try {
        integrationToolConfig = persistIntegrationToolConfig()
      } catch (error: any) {
        toast.error(error?.message || 'Configuração inválida na ferramenta de integração.')
        return
      }

      onSave(node.id, {
        ...formData,
        ...integrationToolConfig,
        label: formData.label?.trim() || 'Mensagem WhatsApp 24h',
        waWindowMode,
        waMessageType: messageType,
        waMessageText: messageText,
        waButtons: buttons,
        waLinkUrl: String(formData.waLinkUrl || '').trim(),
        waReminderAt: String(formData.waReminderAt || '').trim(),
        waIntegrationId: String(formData.waIntegrationId || '').trim(),
        waFallbackTemplateName: String(formData.waFallbackTemplateName || '').trim(),
        waFallbackTemplateLanguage: String(formData.waFallbackTemplateLanguage || '').trim(),
      })
      onClose()
      return
    }

    if (node.type === 'wa_template') {
      if (!formData.waTemplateName?.trim() || !formData.waTemplateLanguage?.trim()) {
        toast.error('Escolha um template sincronizado da Meta antes de salvar.')
        return
      }
      const selectedTemplate = findWaCatalogTemplate(
        waCatalog,
        String(formData.waTemplateName || ''),
        String(formData.waTemplateLanguage || '')
      )
      if (!selectedTemplate) {
        toast.error('Esse bloco agora usa somente templates sincronizados da Meta.')
        return
      }

      const exactTemplate = buildWaTemplateExactComponents(selectedTemplate.components_json)
      if (exactTemplate.missingRequirements.length > 0) {
        toast.error(exactTemplate.missingRequirements[0])
        return
      }

      const rawJson =
        exactTemplate.components.length > 0 ? JSON.stringify(exactTemplate.components, null, 2) : ''
      const components: unknown[] | undefined = exactTemplate.components.length > 0 ? exactTemplate.components : undefined
      const payload = {
        ...formData,
        label: selectedTemplate.name,
        waTemplateName: selectedTemplate.name,
        waTemplateLanguage: selectedTemplate.language,
        waIntegrationId: formData.waIntegrationId?.trim() || '',
        waTemplateComponents: components,
        waTemplateComponentsJson: rawJson,
      }
      onSave(node.id, payload)
      onClose()
      return
    }

    if (node.type === 'hubspot_whatsapp_campaign') {
      const crmIntegrationId = String(formData.crmIntegrationId || '').trim()
      const crmFilterField = 'tag'
      const crmFilterOperator = 'equals'
      const crmFilterValue = String(formData.crmFilterValue || '').trim()
      const crmPhoneField = 'phone'
      const crmResultLimit = '50'

      if (!crmIntegrationId) {
        toast.error('Selecione a integração HubSpot que será usada no bloco.')
        return
      }
      if (!crmFilterValue) {
        toast.error('Informe a tag do HubSpot que será buscada.')
        return
      }

      onSave(node.id, {
        ...formData,
        label: formData.label?.trim() || 'Audiência HubSpot',
        crmIntegrationId,
        crmFilterField,
        crmFilterOperator,
        crmFilterValue,
        crmPhoneField,
        crmResultLimit,
      })
      onClose()
      return
    }

    if (node.type === 'crm_contact') {
      const crmIntegrationId = String(formData.crmIntegrationId || '').trim()
      const crmOperation = String(formData.crmOperation || 'lookup').trim() || 'lookup'
      const lookupFields = String(formData.lookupFields || '')
        .split(/[,\n;|]+/)
        .map((item) => item.trim())
        .filter(Boolean)
      const requiredFields = String(formData.requiredFields || '')
        .split(/[,\n;|]+/)
        .map((item) => item.trim())
        .filter(Boolean)

      if (!crmIntegrationId) {
        toast.error('Selecione a integração HubSpot que será usada no bloco.')
        return
      }

      onSave(node.id, {
        ...formData,
        label: formData.label?.trim() || 'Contato CRM',
        crmIntegrationId,
        crmOperation,
        lookupFields,
        requiredFields,
        originTag: String(formData.originTag || 'Atendimento IA Clínica').trim() || 'Atendimento IA Clínica',
        allowMissingDob: formData.allowMissingDob === true,
      })
      onClose()
      return
    }

    if (node.type === 'appointment') {
      const appointmentOperation = String(formData.appointmentOperation || 'availability').trim() || 'availability'
      const appointmentProvider = 'calendly'
      const appointmentIntegrationId = String(formData.appointmentIntegrationId || '').trim()
      const selectedCalendarIntegration = calendarIntegrations.find((item) => item.id === appointmentIntegrationId)
      const specialtyField = String(formData.specialtyField || 'appointment_resource').trim() || 'appointment_resource'

      if (!appointmentIntegrationId) {
        toast.error('Selecione uma integração Calendly real para usar este bloco de agenda.')
        return
      }

      if (!specialtyField) {
        toast.error('Informe a chave do contexto principal usada para a ação de agenda.')
        return
      }

      onSave(node.id, {
        ...formData,
        label: formData.label?.trim() || 'Ação de agenda',
        appointmentOperation,
        appointmentProvider,
        appointmentIntegrationId,
        appointmentIntegrationName:
          String(selectedCalendarIntegration?.email_address || selectedCalendarIntegration?.provider || '').trim() || '',
        specialtyField,
        doctorField: String(formData.doctorField || 'appointment_owner').trim() || 'appointment_owner',
        consultationTypeField: String(formData.consultationTypeField || 'appointment_kind').trim() || 'appointment_kind',
        unitField: String(formData.unitField || 'appointment_location').trim() || 'appointment_location',
        periodField: String(formData.periodField || 'appointment_time_preference').trim() || 'appointment_time_preference',
        preferredDateField: String(formData.preferredDateField || 'appointment_date').trim() || 'appointment_date',
      })
      onClose()
      return
    }

    if (node.type === 'document_intake') {
      const documentKinds = String(formData.documentKinds || '')
        .split(/[,\n;|]+/)
        .map((item) => item.trim())
        .filter(Boolean)

      onSave(node.id, {
        ...formData,
        label: formData.label?.trim() || 'Document Intake',
        documentKinds,
        notifyTeam: formData.notifyTeam === true,
        acceptWithoutFile: formData.acceptWithoutFile === true,
      })
      onClose()
      return
    }

    if (node.type === 'subflow') {
      const subflowId = String(formData.subflowId || formData.flowId || '').trim()
      const selectedFlow = availableFlows.find((flow) => flow.id === subflowId)
      const subflowResultKey = String(formData.subflowResultKey || 'subflow_result').trim() || 'subflow_result'

      if (!subflowId) {
        toast.error('Selecione o fluxo que será executado como subfluxo.')
        return
      }

      onSave(node.id, {
        ...formData,
        label: formData.label?.trim() || 'Executar subfluxo',
        subflowId,
        subflowName: selectedFlow?.name || formData.subflowName || '',
        subflowResultKey,
        subflowFailOnError: formData.subflowFailOnError !== false,
      })
      onClose()
      return
    }

    if (node.type === 'human_handoff') {
      onSave(node.id, {
        ...formData,
        label: formData.label?.trim() || 'Handoff Humano',
        handoffReasonField: String(formData.handoffReasonField || 'handoff_reason').trim() || 'handoff_reason',
        handoffPriority: String(formData.handoffPriority || 'medium').trim() || 'medium',
        notifyEmail: String(formData.notifyEmail || '').trim(),
        notifyWhatsApp: String(formData.notifyWhatsApp || '').trim(),
        patientMessage:
          String(formData.patientMessage || '').trim() ||
          'Vou encaminhar seu caso para nossa equipe humana e eles continuarão o atendimento em breve.',
      })
      onClose()
      return
    }

    if (node.type === 'wa_session_window') {
      onSave(node.id, {
        ...formData,
        label: formData.label?.trim() || 'Janela 24h',
      })
      onClose()
      return
    }

    if (node.type === 'schedule') {
      const scheduleAt = String(formData.scheduleAt || '').trim()
      const scheduleTimezone = String(formData.scheduleTimezone || 'America/Sao_Paulo').trim() || 'America/Sao_Paulo'

      if (!scheduleAt) {
        toast.error('Defina a data e o horário em que o fluxo deve retomar.')
        return
      }

      onSave(node.id, {
        ...formData,
        label: formData.label?.trim() || 'Agendar data e hora',
        scheduleAt,
        scheduleTimezone,
      })
      onClose()
      return
    }

    if (node.type === 'email_send') {
      const integrationId = String(formData.emailIntegrationId || '').trim()
      const emailTo = String(formData.emailTo || '').trim()
      const emailSubject = String(formData.emailSubject || '').trim()
      const emailText = String(formData.emailText || '').trim()

      if (!integrationId) {
        toast.error('Selecione a integração de email que será usada neste bloco.')
        return
      }
      if (!emailSubject) {
        toast.error('Preencha o assunto do email.')
        return
      }
      if (!emailText) {
        toast.error('Escreva o corpo do email.')
        return
      }

      onSave(node.id, {
        ...formData,
        label: formData.label?.trim() || 'Enviar email',
        emailIntegrationId: integrationId,
        emailTo,
        emailSubject,
        emailText,
      })
      onClose()
      return
    }

    if (node.type === 'email_read') {
      const integrationId = String(formData.emailIntegrationId || '').trim()
      const emailReadLimit = String(formData.emailReadLimit || '5').trim() || '5'

      if (!integrationId) {
        toast.error('Selecione a integração de email que será usada na leitura.')
        return
      }

      onSave(node.id, {
        ...formData,
        label: formData.label?.trim() || 'Ler inbox email',
        emailIntegrationId: integrationId,
        emailReadLimit,
      })
      onClose()
      return
    }

    if (node.type === 'agent') {
      let integrationToolConfig = {}
      try {
        integrationToolConfig = persistIntegrationToolConfig()
      } catch (error: any) {
        toast.error(error?.message || 'Configuração inválida na ferramenta de integração.')
        return
      }

      if (agentsOnly) {
        if (!formData.agentId) {
          toast.error('Selecione um agente para este bloco.')
          return
        }
        const selectedAgent = availableAgents.find(agent => agent.id === formData.agentId)
        const payload = {
          ...formData,
          ...integrationToolConfig,
          executionMode: 'agent',
          label: formData.label?.trim() || selectedAgent?.name || 'Agente IA',
          agentName: selectedAgent?.name || formData.agentName || '',
          templateId: '',
          templateName: '',
          additionalInstructions: formData.additionalInstructions || '',
          skipReplyConfidence: formData.skipReplyConfidence === true,
        }
        onSave(node.id, payload)
        onClose()
        return
      }

      const executionMode = formData.executionMode === 'template' ? 'template' : 'agent'

      if (executionMode === 'agent') {
        if (!formData.agentId) {
          toast.error('Selecione um agente para este bloco.')
          return
        }

        const selectedAgent = availableAgents.find(agent => agent.id === formData.agentId)
        const payload = {
          ...formData,
          ...integrationToolConfig,
          executionMode: 'agent',
          label: formData.label?.trim() || selectedAgent?.name || 'Agente IA',
          agentName: selectedAgent?.name || formData.agentName || '',
          templateId: undefined,
          templateName: undefined,
          additionalInstructions: formData.additionalInstructions || '',
        }

        onSave(node.id, payload)
        onClose()
        return
      }

      if (!formData.templateId) {
        toast.error('Selecione um template para este bloco.')
        return
      }

      const selectedTemplate = availableTemplates.find(template => template.id === formData.templateId)
      const payload = {
        ...formData,
        ...integrationToolConfig,
        executionMode: 'template',
        label: formData.label?.trim() || selectedTemplate?.name || 'Template',
        templateName: selectedTemplate?.name || formData.templateName || '',
        agentId: undefined,
        agentName: undefined,
        additionalInstructions: formData.additionalInstructions || '',
      }

      onSave(node.id, payload)
      onClose()
      return
    }
    // Validação para Loop
    if (node.type === 'loop') {
      if (formData.infinite) {
        // Se infinito está marcado, garante que iterations seja '∞'
        formData.iterations = '∞'
      } else {
        // Se infinito não está marcado, valida o campo de iterações
        const iterationsValue = formData.iterations?.toString().trim()
        if (!iterationsValue || iterationsValue === '0' || iterationsValue === '' || iterationsValue === '∞' || parseInt(iterationsValue) <= 0) {
          // Mostra mensagem e define como 1
          toast.warning('O número de iterações não pode estar vazio ou ser zero. Será salvo com 1 repetição.')
          formData.iterations = '1'
        }
      }
    }

    if (node.type === 'if-else') {
      const payload = {
        ...formData,
        branchField: String(formData.branchField || 'message'),
        ifValue: String(formData.ifValue || 'sim, 1'),
        elseLabel: String(formData.elseLabel || 'não, 2'),
      }

      onSave(node.id, payload)
      onClose()
      return
    }

    if (node.type === 'switch') {
      const nextCases = Array.isArray(formData.switchCases)
        ? formData.switchCases
            .map((item: any, index: number) => ({
              id: String(item?.id || `case_${index + 1}`),
              label: String(item?.label || `Opção ${index + 1}`),
              value: String(item?.value || `${index + 1}`),
            }))
            .filter((item: { id: string; label: string; value: string }) => item.value.trim().length > 0)
        : []

      if (nextCases.length === 0) {
        toast.error('Adicione pelo menos uma opção no bloco de múltiplas opções.')
        return
      }

      const payload = {
        ...formData,
        branchField: String(formData.branchField || 'option'),
        switchCases: nextCases,
        switchDefaultLabel: String(formData.switchDefaultLabel || 'Outros'),
      }

      onSave(node.id, payload)
      onClose()
      return
    }
    
    onSave(node.id, formData)
    onClose()
  }

  const renderForm = () => {
    switch (node.type) {
      case 'agent': {
        const executionMode = formData.executionMode === 'template' ? 'template' : 'agent'
        const selectedAgent = availableAgents.find(agent => agent.id === formData.agentId)
        const selectedTemplate = availableTemplates.find(template => template.id === formData.templateId)

        return (
          <div className="space-y-6">
            <div className="flex justify-center">
              <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-200">
                <Wand2 className="h-12 w-12 text-emerald-600" strokeWidth={2} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="agent-node-label" className="text-sm font-semibold">Nome do bloco</Label>
              <Input
                id="agent-node-label"
                value={formData.label || ''}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="Ex: Classificador, Agendamento ou Suporte"
                className="rounded-xl"
                style={{ borderRadius: '12px' }}
              />
            </div>

            {!agentsOnly && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Modo de execução</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({
                      ...formData,
                      executionMode: 'agent',
                      templateId: '',
                      templateName: '',
                    })}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      executionMode === 'agent'
                        ? 'bg-emerald-50 border-emerald-400 shadow-lg ring-2 ring-emerald-200'
                        : 'bg-white border-slate-200 hover:border-emerald-200'
                    }`}
                    style={{ borderRadius: '12px' }}
                  >
                    <div className="font-bold text-sm mb-1">Agente existente</div>
                    <div className="text-xs text-slate-600">Reaproveita o runtime completo atual por `agentId`.</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({
                      ...formData,
                      executionMode: 'template',
                      agentId: '',
                      agentName: '',
                    })}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      executionMode === 'template'
                        ? 'bg-emerald-50 border-emerald-400 shadow-lg ring-2 ring-emerald-200'
                        : 'bg-white border-slate-200 hover:border-emerald-200'
                    }`}
                    style={{ borderRadius: '12px' }}
                  >
                    <div className="font-bold text-sm mb-1">Template</div>
                    <div className="text-xs text-slate-600">Executa o template direto no flow, sem criar agente no banco.</div>
                  </button>
                </div>
              </div>
            )}

            {agentsOnly || executionMode === 'agent' ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="agent-select" className="text-sm font-semibold">Agente</Label>
                  <Select
                    value={formData.agentId || ''}
                    onValueChange={(value) => {
                      const agent = availableAgents.find(item => item.id === value)
                      setFormData({
                        ...formData,
                        executionMode: 'agent',
                        agentId: value,
                        agentName: agent?.name || '',
                        label: formData.label || agent?.name || 'Agente IA',
                      })
                    }}
                  >
                    <SelectTrigger id="agent-select" className="rounded-xl" style={{ borderRadius: '12px' }}>
                      <SelectValue placeholder="Selecione um agente" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableAgents.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedAgent?.bio && (
                    <p className="text-xs text-slate-500">{selectedAgent.bio}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="additionalInstructions-agent" className="text-sm font-semibold">Instruções complementares</Label>
                  <Textarea
                    id="additionalInstructions-agent"
                    value={formData.additionalInstructions || ''}
                    onChange={(e) => setFormData({ ...formData, additionalInstructions: e.target.value })}
                    placeholder="Opcional: regras extras só para este bloco no fluxo."
                    rows={4}
                    className="rounded-xl resize-none"
                    style={{ borderRadius: '12px' }}
                  />
                </div>

                {renderIntegrationToolConfig('emerald')}

                {agentsOnly && (
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                    <div>
                      <Label htmlFor="skip-confidence" className="text-sm font-semibold">Classificador (JSON)</Label>
                      <p className="text-xs text-slate-500">Ignora bloqueio por confiança ao responder só com intent.</p>
                    </div>
                    <Switch
                      id="skip-confidence"
                      checked={formData.skipReplyConfidence === true}
                      onCheckedChange={(checked) => setFormData({ ...formData, skipReplyConfidence: checked })}
                    />
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="template-select" className="text-sm font-semibold">Template</Label>
                  <Select
                    value={formData.templateId || ''}
                    onValueChange={(value) => {
                      const template = availableTemplates.find(item => item.id === value)
                      setFormData({
                        ...formData,
                        executionMode: 'template',
                        templateId: value,
                        templateName: template?.name || '',
                        label: formData.label || template?.name || 'Template',
                      })
                    }}
                  >
                    <SelectTrigger id="template-select" className="rounded-xl" style={{ borderRadius: '12px' }}>
                      <SelectValue placeholder="Selecione um template" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedTemplate?.description && (
                    <p className="text-xs text-slate-500">{selectedTemplate.description}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="additionalInstructions" className="text-sm font-semibold">Instruções complementares</Label>
                  <Textarea
                    id="additionalInstructions"
                    value={formData.additionalInstructions || ''}
                    onChange={(e) => setFormData({ ...formData, additionalInstructions: e.target.value })}
                    placeholder="Opcional: complemente o comportamento deste bloco sem alterar o template original."
                    rows={5}
                    className="rounded-xl resize-none"
                    style={{ borderRadius: '12px' }}
                  />
                  <p className="text-xs text-slate-500">
                    Essas instruções serão combinadas com o template apenas neste node do fluxo.
                  </p>
                </div>
                {renderIntegrationToolConfig('emerald')}
              </>
            )}
          </div>
        )
      }

      case 'loop':
        const isInfinite = formData.infinite || false
        const iterations = parseInt(formData.iterations) || 10
        
        return (
          <div className="space-y-6">
            {/* Ícone grande no topo */}
            <div className="flex justify-center">
              <div className="p-4 rounded-2xl bg-purple-50 border-2 border-purple-200">
                <RefreshCw className="h-12 w-12 text-purple-600" strokeWidth={2} />
              </div>
            </div>

            {/* Seleção de Fluxo com busca */}
            <div className="space-y-2 flow-dropdown-container">
              <Label htmlFor="flow" className="text-sm font-semibold">Fluxo para Executar em Loop</Label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsFlowDropdownOpen(!isFlowDropdownOpen)}
                  className="w-full text-left flex items-center justify-between px-3 py-2 h-9 rounded-xl border border-purple-200 bg-input-background focus:border-purple-400 focus:ring-purple-400 focus:ring-2 focus:ring-offset-0 cursor-pointer hover:border-purple-300 transition-colors"
                  style={{ borderRadius: '12px' }}
                >
                  <span className={formData.flowId ? 'text-foreground' : 'text-muted-foreground'}>
                    {formData.flowId 
                      ? availableFlows.find(f => f.id === formData.flowId)?.name || 'Selecione um fluxo'
                      : 'Selecione um fluxo'}
                  </span>
                  <Search className="h-4 w-4 text-slate-400" />
                </button>
                {isFlowDropdownOpen && (
                  <div 
                    className="absolute z-50 w-full mt-1 bg-white border-2 border-purple-200 rounded-xl shadow-lg"
                    style={{
                      maxHeight: '240px',
                      overflowY: 'auto',
                      overflowX: 'hidden',
                      scrollbarWidth: 'thin',
                      scrollbarColor: '#c084fc #f3e8ff'
                    }}
                  >
                    {availableFlows.length === 0 ? (
                      <div className="p-3 text-sm text-slate-500 text-center">
                        Nenhum fluxo disponível
                      </div>
                    ) : (
                      availableFlows.map((flow) => (
                        <button
                          key={flow.id}
                          onClick={() => {
                            setFormData({ 
                              ...formData, 
                              flowId: flow.id,
                              flowName: flow.name
                            })
                            setIsFlowDropdownOpen(false)
                          }}
                          className={`w-full text-left px-4 py-3 hover:bg-purple-50 transition-colors border-b border-slate-100 last:border-b-0 ${
                            formData.flowId === flow.id ? 'bg-purple-50 font-semibold' : ''
                          }`}
                        >
                          <div className="font-medium text-slate-900">{flow.name}</div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              {formData.flowId && (
                <p className="text-xs text-purple-600 font-medium">
                  ✓ Fluxo selecionado: {availableFlows.find(f => f.id === formData.flowId)?.name || 'Desconhecido'}
                </p>
              )}
            </div>

            {/* Tiles de Decisão: Contagem Fixa vs Infinito */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Tipo de Repetição</Label>
              <div className="grid grid-cols-2 gap-3">
                {/* Card: Contagem Fixa */}
                <button
                  type="button"
                  onClick={() => {
                    setFormData({ 
                      ...formData, 
                      infinite: false, 
                      iterations: formData.iterations === '∞' || !formData.iterations ? '10' : formData.iterations 
                    })
                  }}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    !isInfinite 
                      ? 'bg-purple-50 border-purple-400 shadow-lg ring-2 ring-purple-200' 
                      : 'bg-white border-slate-200 hover:border-purple-200'
                  }`}
                  style={{ borderRadius: '12px' }}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${!isInfinite ? 'bg-purple-100' : 'bg-slate-100'}`}>
                      <Hash className={`h-5 w-5 ${!isInfinite ? 'text-purple-600' : 'text-slate-400'}`} strokeWidth={2.5} />
                    </div>
                    <div className="flex-1">
                      <div className={`font-bold text-sm mb-1 ${!isInfinite ? 'text-purple-900' : 'text-slate-700'}`}>
                        Contagem Fixa
                      </div>
                      <div className="text-xs text-slate-600">
                        O fluxo repete um número exato de vezes
                      </div>
                    </div>
                  </div>
                </button>

                {/* Card: Loop Infinito */}
                <button
                  type="button"
                  onClick={() => {
                    setFormData({ ...formData, infinite: true, iterations: '∞' })
                  }}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    isInfinite 
                      ? 'bg-purple-50 border-purple-400 shadow-lg ring-2 ring-purple-200' 
                      : 'bg-white border-slate-200 hover:border-purple-200'
                  }`}
                  style={{ borderRadius: '12px' }}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${isInfinite ? 'bg-purple-100' : 'bg-slate-100'}`}>
                      <Infinity className={`h-5 w-5 ${isInfinite ? 'text-purple-600' : 'text-slate-400'}`} strokeWidth={2.5} />
                    </div>
                    <div className="flex-1">
                      <div className={`font-bold text-sm mb-1 ${isInfinite ? 'text-purple-900' : 'text-slate-700'}`}>
                        Loop Infinito
                      </div>
                      <div className="text-xs text-slate-600">
                        O fluxo repete até ser interrompido manualmente
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Input com Stepper (só aparece se não for infinito) */}
            {!isInfinite && (
              <div className="space-y-2">
                <Label htmlFor="iterations" className="text-sm font-semibold">Número de Iterações</Label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const current = parseInt(formData.iterations) || 10
                      if (current > 1) {
                        setFormData({ ...formData, iterations: (current - 1).toString() })
                      }
                    }}
                    className="p-2 rounded-lg border-2 border-purple-200 hover:bg-purple-50 hover:border-purple-400 transition-all"
                    style={{ borderRadius: '12px' }}
                  >
                    <Minus className="h-4 w-4 text-purple-600" />
                  </button>
                  <Input
                    id="iterations"
                    type="number"
                    min="1"
                    value={formData.iterations === '∞' ? '' : (formData.iterations || '10')}
                    onChange={(e) => setFormData({ ...formData, iterations: e.target.value })}
                    className="text-center text-lg font-bold rounded-xl border-purple-200 focus:border-purple-400 focus:ring-purple-400"
                    style={{ borderRadius: '12px', fontSize: '18px', fontWeight: 'bold' }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const current = parseInt(formData.iterations) || 10
                      setFormData({ ...formData, iterations: (current + 1).toString() })
                    }}
                    className="p-2 rounded-lg border-2 border-purple-200 hover:bg-purple-50 hover:border-purple-400 transition-all"
                    style={{ borderRadius: '12px' }}
                  >
                    <Plus className="h-4 w-4 text-purple-600" />
                  </button>
                </div>
              </div>
            )}

            {/* Feedback Visual em Tempo Real */}
            <div className={`p-4 rounded-xl border-2 ${
              isInfinite 
                ? 'bg-orange-50 border-orange-200' 
                : 'bg-purple-50 border-purple-200'
            }`} style={{ borderRadius: '12px' }}>
              {isInfinite ? (
                <div className="flex items-start gap-2">
                  <span className="text-lg">⚠️</span>
                  <div>
                    <div className="font-semibold text-sm text-orange-900 mb-1">
                      Atenção: Loop Infinito
                    </div>
                    <div className="text-xs text-orange-700">
                      Este fluxo rodará para sempre. Use com cautela e certifique-se de ter uma forma de interrompê-lo.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <span className="text-lg">ðŸš€</span>
                  <div>
                    <div className="font-semibold text-sm text-purple-900 mb-1">
                      Resultado
                    </div>
                    <div className="text-xs text-purple-700">
                      Este fluxo vai rodar <strong>{iterations}</strong> {iterations === 1 ? 'vez' : 'vezes'} antes de encerrar.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )

      case 'if-else':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="if-else-label" className="text-sm font-semibold">Nome do bloco</Label>
              <Input
                id="if-else-label"
                value={formData.label || ''}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="Ex.: Cliente digitou uma opção válida?"
                className="rounded-xl"
                style={{ borderRadius: '12px' }}
              />
            </div>
            <ConditionBuilder formData={formData} setFormData={setFormData} mode="binary" />
          </div>
        )

      case 'switch':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="switch-label" className="text-sm font-semibold">Nome do bloco</Label>
              <Input
                id="switch-label"
                value={formData.label || ''}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="Ex.: Encaminhar por opção escolhida"
                className="rounded-xl"
                style={{ borderRadius: '12px' }}
              />
            </div>
            <ConditionBuilder formData={formData} setFormData={setFormData} mode="switch" />
          </div>
        )

      case 'subflow': {
        const selectedFlow = availableFlows.find((flow) => flow.id === String(formData.subflowId || formData.flowId || '').trim())

        return (
          <div className="space-y-5">
            <div className="rounded-xl border p-4 text-sm leading-relaxed" style={{ ...buildAccentPanelStyle('indigo'), ...buildAccentTextStyle('indigo') }}>
              Execute outro fluxo como uma etapa compacta. O contexto atual é enviado ao subfluxo e o resultado volta para o fluxo principal.
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Nome do bloco</Label>
              <Input
                value={formData.label || ''}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="Ex.: Executar agendamento"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2 flow-dropdown-container">
              <Label className="text-sm font-semibold">Subfluxo</Label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsFlowDropdownOpen(!isFlowDropdownOpen)}
                  className="flex h-10 w-full items-center justify-between rounded-xl border border-slate-200 bg-input-background px-3 py-2 text-left text-sm transition-colors hover:border-indigo-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400"
                >
                  <span className={selectedFlow ? 'text-foreground' : 'text-muted-foreground'}>
                    {selectedFlow?.name || 'Selecione um fluxo'}
                  </span>
                  <Search className="h-4 w-4 text-slate-400" />
                </button>
                {isFlowDropdownOpen && (
                  <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-popover p-1 shadow-lg">
                    {availableFlows.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum fluxo disponível</div>
                    ) : (
                      availableFlows.map((flow) => (
                        <button
                          key={flow.id}
                          type="button"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              subflowId: flow.id,
                              subflowName: flow.name,
                            })
                            setIsFlowDropdownOpen(false)
                          }}
                          className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${
                            formData.subflowId === flow.id ? 'bg-accent font-semibold' : ''
                          }`}
                        >
                          {flow.name}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-xl"
                disabled={creatingSubflow}
                onClick={() => void createAndSelectSubflow()}
              >
                {creatingSubflow ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Criar novo subfluxo e conectar
              </Button>
              <p className="text-xs text-muted-foreground">
                O novo subfluxo será criado como a próxima etapa do fluxo principal e aparecerá ordenado na navegação de partes.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Chave de resultado</Label>
              <Input
                value={formData.subflowResultKey || 'subflow_result'}
                onChange={(e) => setFormData({ ...formData, subflowResultKey: e.target.value })}
                placeholder="subflow_result"
                className="rounded-xl font-mono"
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border px-3 py-2">
              <div>
                <Label className="text-sm font-semibold">Falhar se o subfluxo falhar</Label>
                <p className="text-xs text-muted-foreground">Quando desligado, o erro volta no contexto e o fluxo principal continua.</p>
              </div>
              <Switch
                checked={formData.subflowFailOnError !== false}
                onCheckedChange={(checked) => setFormData({ ...formData, subflowFailOnError: checked })}
              />
            </div>
          </div>
        )
      }

      case 'delay':
        // Converte o valor para a unidade selecionada
        const getValueInUnit = () => {
          const seconds = parseInt(formData.duration) || 0
          if (delayTimeUnit === 'minutes') return Math.floor(seconds / 60)
          if (delayTimeUnit === 'hours') return Math.floor(seconds / 3600)
          return seconds
        }
        
        // Formata o tempo total em formato legível
        const formatTotalTime = (totalSeconds: number) => {
          if (totalSeconds === 0) return '0 segundos'
          
          const hours = Math.floor(totalSeconds / 3600)
          const minutes = Math.floor((totalSeconds % 3600) / 60)
          const seconds = totalSeconds % 60
          
          const parts = []
          if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'hora' : 'horas'}`)
          if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`)
          if (seconds > 0) parts.push(`${seconds} ${seconds === 1 ? 'segundo' : 'segundos'}`)
          
          return parts.join(' e ') || '0 segundos'
        }
        
        const totalSeconds = parseInt(formData.duration) || 0
        const currentValue = getValueInUnit()
        
        const handlePresetClick = (seconds: number) => {
          setFormData({ ...formData, duration: seconds.toString() })
          setDelayTimeUnit('seconds')
        }
        
        const handleValueChange = (newValue: number) => {
          let seconds = newValue
          if (delayTimeUnit === 'minutes') seconds = newValue * 60
          if (delayTimeUnit === 'hours') seconds = newValue * 3600
          setFormData({ ...formData, duration: seconds.toString() })
        }
        
        return (
          <div className="space-y-6">
            {/* Ícone grande no topo com fundo "nuvem" */}
            <div className="flex justify-center">
              <div className="p-6 rounded-full border-2 shadow-sm" style={{ backgroundColor: '#ecfeff', borderColor: '#a5f3fc' }}>
                <Clock className="h-14 w-14" strokeWidth={2} style={{ color: '#06b6d4' }} />
              </div>
            </div>

            {/* Atalhos de Tempo (Quick Presets) */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Atalhos Rápidos</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: '5s', seconds: 5 },
                  { label: '30s', seconds: 30 },
                  { label: '1min', seconds: 60 },
                  { label: '5min', seconds: 300 },
                  { label: '10min', seconds: 600 }
                ].map((preset) => {
                  const isSelected = totalSeconds === preset.seconds
                  return (
                    <button
                      key={preset.seconds}
                      type="button"
                      onClick={() => handlePresetClick(preset.seconds)}
                      className="px-4 py-2 rounded-xl border-2 transition-all text-sm font-medium"
                      style={{ 
                        borderRadius: '12px',
                        backgroundColor: isSelected ? '#06b6d4' : '#f8fafc',
                        color: isSelected ? 'white' : '#334155',
                        borderColor: isSelected ? '#06b6d4' : '#e2e8f0',
                        transform: 'translateY(0)',
                        boxShadow: isSelected 
                          ? '0 4px 12px rgba(6, 182, 212, 0.3)' 
                          : 'none'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.transform = 'translateY(-2px)'
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(6, 182, 212, 0.2)'
                          e.currentTarget.style.borderColor = '#06b6d4'
                          e.currentTarget.style.backgroundColor = '#ecfeff'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.transform = 'translateY(0)'
                          e.currentTarget.style.boxShadow = 'none'
                          e.currentTarget.style.borderColor = '#e2e8f0'
                          e.currentTarget.style.backgroundColor = '#f8fafc'
                        }
                      }}
                    >
                      {preset.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Stepper com Seletor de Unidade */}
            <div className="space-y-2">
              <Label htmlFor="duration" className="text-sm font-semibold">Duração</Label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const newValue = Math.max(0, currentValue - 1)
                    handleValueChange(newValue)
                  }}
                  className="p-2 rounded-lg border-2 border-cyan-200 hover:bg-cyan-50 hover:border-cyan-400 transition-all"
                  style={{ borderRadius: '12px' }}
                >
                  <Minus className="h-4 w-4 text-cyan-600" />
                </button>
                <Input
                  id="duration"
                  type="number"
                  min="0"
                  value={currentValue}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 0
                    handleValueChange(value)
                  }}
                  className="text-center text-lg font-bold rounded-xl border-cyan-200 focus:border-cyan-400 focus:ring-cyan-400"
                  style={{ borderRadius: '12px', fontSize: '18px', fontWeight: 'bold' }}
                />
                <Select
                  value={delayTimeUnit}
                  onValueChange={(value: 'seconds' | 'minutes' | 'hours') => {
                    setDelayTimeUnit(value)
                    // Recalcula o valor quando muda a unidade
                    const seconds = parseInt(formData.duration) || 0
                    if (value === 'minutes') {
                      setFormData({ ...formData, duration: Math.floor(seconds / 60).toString() })
                    } else if (value === 'hours') {
                      setFormData({ ...formData, duration: Math.floor(seconds / 3600).toString() })
                    } else {
                      setFormData({ ...formData, duration: seconds.toString() })
                    }
                  }}
                >
                  <SelectTrigger className="w-32 rounded-xl border-cyan-200 focus:border-cyan-400 focus:ring-cyan-400" style={{ borderRadius: '12px' }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="seconds">Segundos</SelectItem>
                    <SelectItem value="minutes">Minutos</SelectItem>
                    <SelectItem value="hours">Horas</SelectItem>
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  onClick={() => {
                    const newValue = currentValue + 1
                    handleValueChange(newValue)
                  }}
                  className="p-2 rounded-lg border-2 border-cyan-200 hover:bg-cyan-50 hover:border-cyan-400 transition-all"
                  style={{ borderRadius: '12px' }}
                >
                  <Plus className="h-4 w-4 text-cyan-600" />
                </button>
              </div>
            </div>

            {/* Conversor em Tempo Real com borda de identidade */}
            {totalSeconds > 0 && (
              <div 
                className="p-4 rounded-xl border-2 bg-cyan-50/50 border-cyan-200 relative overflow-hidden" 
                style={{ 
                  borderRadius: '12px',
                  borderLeftWidth: '4px',
                  borderLeftColor: '#06b6d4',
                  borderTopColor: 'rgba(6, 182, 212, 0.2)',
                  borderRightColor: 'rgba(6, 182, 212, 0.2)',
                  borderBottomColor: 'rgba(6, 182, 212, 0.2)'
                }}
              >
                <div className="flex items-start gap-2">
                  <span className="text-lg">ðŸ•’</span>
                  <div>
                    <div className="font-semibold text-sm text-cyan-900 mb-1">
                      Tempo Total
                    </div>
                    <div className="text-xs text-cyan-700">
                      {formatTotalTime(totalSeconds)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )

      case 'schedule':
        return (
          <div className="space-y-5">
            <div className="flex justify-center">
              <div className="rounded-2xl border-2 p-4" style={buildAccentBadgeStyle('sky')}>
                <span className="inline-flex items-center gap-2 text-sm font-semibold" style={buildAccentTextStyle('sky')}>
                  <Clock className="h-4 w-4" />
                  Agendar data e hora
                </span>
              </div>
            </div>
            <div className="rounded-xl border p-4 text-sm leading-relaxed" style={{ ...buildAccentPanelStyle('sky'), ...buildAccentTextStyle('sky') }}>
              Este bloco pausa o fluxo e retoma automaticamente na data e no horário definidos, usando o timezone configurado para a empresa.
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule-label" className="text-sm font-semibold">Nome do bloco</Label>
              <Input
                id="schedule-label"
                value={formData.label || ''}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="Ex.: Amanhã às 09:00"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule-at" className="text-sm font-semibold">Data e horário</Label>
              <Input
                id="schedule-at"
                type="datetime-local"
                value={formData.scheduleAt || ''}
                onChange={(e) => setFormData({ ...formData, scheduleAt: e.target.value })}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule-timezone" className="text-sm font-semibold">Timezone</Label>
              <Input
                id="schedule-timezone"
                value={formData.scheduleTimezone || 'America/Sao_Paulo'}
                onChange={(e) => setFormData({ ...formData, scheduleTimezone: e.target.value })}
                placeholder="America/Sao_Paulo"
                className="rounded-xl font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Ex.: <strong>America/Sao_Paulo</strong>. Se você não alterar, o fluxo usa o timezone padrão da empresa.
              </p>
            </div>
          </div>
        )

      case 'debug':
        return (
          <div className="space-y-4">
            <div className="flex justify-center mb-4">
              <div className="p-4 rounded-full bg-purple-50 border-2 border-purple-100 shadow-sm">
                <Bug className="h-12 w-12" strokeWidth={2.5} style={{ color: '#9333ea' }} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="debug-label" className="text-slate-700 font-semibold">Nome do bloco</Label>
              <Input
                id="debug-label"
                value={formData.label || ''}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="Ex.: Antes do agente X"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="debug-keys" className="text-slate-700 font-semibold">Chaves do contexto (opcional)</Label>
              <Textarea
                id="debug-keys"
                value={formData.debugKeys || ''}
                onChange={(e) => setFormData({ ...formData, debugKeys: e.target.value })}
                placeholder="Separadas por vírgula ou linha. Vazio = todas as chaves."
                rows={4}
                className="text-sm rounded-xl font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="debug-message" className="text-slate-700 font-semibold">Nota no histórico (opcional)</Label>
              <Textarea
                id="debug-message"
                value={formData.debugMessage || ''}
                onChange={(e) => setFormData({ ...formData, debugMessage: e.target.value })}
                placeholder="Aparece no registo de execução como message"
                rows={2}
                className="text-sm rounded-xl"
              />
            </div>
            <div className="mt-4 flex items-start gap-3 rounded-xl border p-4" style={buildAccentPanelStyle('purple')}>
              <Info className="h-5 w-5 flex-shrink-0 mt-0.5" strokeWidth={2.5} style={buildAccentTextStyle('purple', false)} />
              <p className="text-sm leading-relaxed" style={buildAccentTextStyle('purple')}>
                O bloco Debug só grava um snapshot no histórico de execução; não altera os dados do fluxo.
              </p>
            </div>
          </div>
        )

      case 'email_send': {
        const integrationId = String(formData.emailIntegrationId || '').trim()
        const integrationSelectValue = integrationId || EMAIL_INTEGRATION_SELECT_CONTEXT

        return (
          <div className="space-y-5">
            <div className="flex justify-center">
              <div className="rounded-2xl border-2 p-4" style={buildAccentBadgeStyle('amber')}>
                <span className="inline-flex items-center gap-2 text-sm font-semibold" style={buildAccentTextStyle('amber')}>
                  <FileText className="h-4 w-4" />
                  Enviar email
                </span>
              </div>
            </div>
            <div className="rounded-xl border p-4 text-sm leading-relaxed" style={{ ...buildAccentPanelStyle('amber'), ...buildAccentTextStyle('amber') }}>
              Use este bloco em dois modos: <strong>destinatário único</strong> ou <strong>audiência HubSpot</strong>. Se uma audiência estiver pronta no passo anterior, o envio vai para todos os contatos elegíveis automaticamente.
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-send-label" className="text-sm font-semibold">Nome do bloco</Label>
              <Input
                id="email-send-label"
                value={formData.label || ''}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="Ex.: Enviar proposta"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Integração de email</Label>
              <Select
                value={integrationSelectValue}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    emailIntegrationId: value === EMAIL_INTEGRATION_SELECT_CONTEXT ? '' : value,
                  })
                }
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecione a integração de email" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMAIL_INTEGRATION_SELECT_CONTEXT} disabled>
                    Escolha uma integração
                  </SelectItem>
                  {emailIntegrations.map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.email_address || row.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-send-to" className="text-sm font-semibold">Destinatário</Label>
              <Input
                id="email-send-to"
                value={formData.emailTo || ''}
                onChange={(e) => setFormData({ ...formData, emailTo: e.target.value })}
                placeholder="{{email}} ou deixe vazio para usar a audiência HubSpot"
                className="rounded-xl font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Preencha para envio individual. Deixe vazio quando este bloco vier depois de uma audiência HubSpot.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-send-subject" className="text-sm font-semibold">Assunto</Label>
              <Input
                id="email-send-subject"
                value={formData.emailSubject || ''}
                onChange={(e) => setFormData({ ...formData, emailSubject: e.target.value })}
                placeholder="Ex.: Olá {{nome}}, segue sua proposta"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-send-text" className="text-sm font-semibold">Corpo do email</Label>
              <Textarea
                id="email-send-text"
                value={formData.emailText || ''}
                onChange={(e) => setFormData({ ...formData, emailText: e.target.value })}
                placeholder="Escreva o conteúdo do email. Você pode usar variáveis do fluxo."
                rows={7}
                className="rounded-xl"
              />
            </div>
          </div>
        )
      }

      case 'email_read': {
        const integrationId = String(formData.emailIntegrationId || '').trim()
        const integrationSelectValue = integrationId || EMAIL_INTEGRATION_SELECT_CONTEXT

        return (
          <div className="space-y-5">
            <div className="flex justify-center">
              <div className="rounded-2xl border-2 p-4" style={buildAccentBadgeStyle('rose')}>
                <span className="inline-flex items-center gap-2 text-sm font-semibold" style={buildAccentTextStyle('rose')}>
                  <Search className="h-4 w-4" />
                  Ler inbox email
                </span>
              </div>
            </div>
            <div className="rounded-xl border p-4 text-sm leading-relaxed" style={{ ...buildAccentPanelStyle('rose'), ...buildAccentTextStyle('rose') }}>
              Este bloco puxa as mensagens mais recentes da inbox e coloca o resultado no contexto do fluxo em <strong>messages</strong>.
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-read-label" className="text-sm font-semibold">Nome do bloco</Label>
              <Input
                id="email-read-label"
                value={formData.label || ''}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="Ex.: Ler novos emails"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Integração de email</Label>
              <Select
                value={integrationSelectValue}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    emailIntegrationId: value === EMAIL_INTEGRATION_SELECT_CONTEXT ? '' : value,
                  })
                }
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecione a integração de email" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMAIL_INTEGRATION_SELECT_CONTEXT} disabled>
                    Escolha uma integração
                  </SelectItem>
                  {emailIntegrations.map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.email_address || row.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-read-limit" className="text-sm font-semibold">Quantidade máxima</Label>
              <Input
                id="email-read-limit"
                type="number"
                min="1"
                max="20"
                value={formData.emailReadLimit || '5'}
                onChange={(e) => setFormData({ ...formData, emailReadLimit: e.target.value })}
                className="max-w-[160px] rounded-xl"
              />
            </div>
          </div>
        )
      }

      case 'whatsapp_message': {
        const messageType = (formData.waMessageType || 'text') as 'text' | 'buttons' | 'link' | 'reminder'
        const buttons = ensureWaButtons(formData.waButtons)
        const windowMode = formData.waWindowMode === 'auto_template' ? 'auto_template' : 'session_only'
        const integrationId = String(formData.waIntegrationId || '').trim()
        const integrationSelectValue = integrationId || WA_INTEGRATION_SELECT_CONTEXT
        const previewMessage =
          messageType === 'link' && String(formData.waLinkUrl || '').trim()
            ? `${String(formData.waMessageText || '').trim()}\n${String(formData.waLinkUrl || '').trim()}`.trim()
            : messageType === 'reminder' && String(formData.waReminderAt || '').trim()
              ? `${String(formData.waMessageText || '').trim()}\n\nLembrete: ${String(formData.waReminderAt || '').trim()}`
              : String(formData.waMessageText || '').trim()

        return (
          <div className="space-y-5">
            <div className="flex justify-center">
              <div className="rounded-2xl border-2 p-4" style={buildAccentBadgeStyle('green')}>
                <span className="inline-flex items-center gap-2 text-sm font-semibold" style={buildAccentTextStyle('green')}>
                  <SendHorizontal className="h-4 w-4" />
                  Mensagem WhatsApp 24h
                </span>
              </div>
            </div>
            <div className="rounded-xl border p-4 text-sm leading-relaxed" style={{ ...buildAccentPanelStyle('green'), ...buildAccentTextStyle('green') }}>
              Use este bloco para enviar uma mensagem livre em conversas com a janela da Meta aberta.
              Se o contato estiver fora da janela, use o bloco <strong>Janela 24h</strong> e envie um
              <strong> Template WhatsApp</strong> no ramo de saída.
            </div>
            {windowMode === 'auto_template' && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                Este node foi salvo no modo legado de conversão automática para template quando a janela estiver fechada.
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="wa-message-label" className="text-sm font-semibold">
                Nome do bloco
              </Label>
              <Input
                id="wa-message-label"
                value={formData.label || ''}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="Ex.: Confirmar atendimento"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Tipo de mensagem</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'text', label: 'Texto simples' },
                  { value: 'buttons', label: 'Texto com botões' },
                  { value: 'link', label: 'Texto com link' },
                  { value: 'reminder', label: 'Lembrete' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, waMessageType: option.value })}
                    className={`rounded-xl border px-3 py-3 text-left text-sm transition ${
                      messageType === option.value
                        ? 'border-green-500 bg-green-50 text-green-950'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wa-message-text" className="text-sm font-semibold">
                Texto da mensagem
              </Label>
              <Textarea
                id="wa-message-text"
                value={formData.waMessageText || ''}
                onChange={(e) => setFormData({ ...formData, waMessageText: e.target.value })}
                placeholder="Digite a mensagem como ela deve aparecer para o cliente."
                rows={5}
                className="rounded-xl"
              />
            </div>
            {messageType === 'buttons' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Botões</Label>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        waButtons: [...buttons, { id: `btn_${buttons.length + 1}`, text: '' }],
                      })
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar botão
                  </Button>
                </div>
                {buttons.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500">
                    Nenhum botão adicionado ainda.
                  </div>
                )}
                {buttons.map((button, index) => (
                  <div key={`${button.id || index}`} className="flex items-center gap-2">
                    <Input
                      value={button.text}
                      onChange={(e) => {
                        const nextButtons = [...buttons]
                        nextButtons[index] = { ...button, text: e.target.value }
                        setFormData({ ...formData, waButtons: nextButtons })
                      }}
                      placeholder={`Botão ${index + 1}`}
                      className="rounded-xl"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl px-3"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          waButtons: buttons.filter((_: unknown, buttonIndex: number) => buttonIndex !== index),
                        })
                      }
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {messageType === 'link' && (
              <div className="space-y-2">
                <Label htmlFor="wa-link-url" className="text-sm font-semibold">
                  Link
                </Label>
                <div className="relative">
                  <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="wa-link-url"
                    value={formData.waLinkUrl || ''}
                    onChange={(e) => setFormData({ ...formData, waLinkUrl: e.target.value })}
                    placeholder="https://seusite.com.br/atendimento"
                    className="rounded-xl pl-10"
                  />
                </div>
              </div>
            )}
            {messageType === 'reminder' && (
              <div className="space-y-2">
                <Label htmlFor="wa-reminder-at" className="text-sm font-semibold">
                  Data ou horário do lembrete
                </Label>
                <div className="relative">
                  <BellRing className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="wa-reminder-at"
                    value={formData.waReminderAt || ''}
                    onChange={(e) => setFormData({ ...formData, waReminderAt: e.target.value })}
                    placeholder="Ex.: amanhã às 10h"
                    className="rounded-xl pl-10"
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Integração WhatsApp</Label>
              <Select
                value={integrationSelectValue}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    waIntegrationId: value === WA_INTEGRATION_SELECT_CONTEXT ? '' : value,
                  })
                }
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Usar integração da conversa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={WA_INTEGRATION_SELECT_CONTEXT}>
                    Usar integração da conversa
                  </SelectItem>
                  {waIntegrations.map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.phone_number || row.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Se vazio, o fluxo usa a integração da própria conversa.
              </p>
            </div>

            {renderIntegrationToolConfig('green')}

            <div className="space-y-3">
              <Label className="text-sm font-semibold">Pré-visualização</Label>
              <div className="mx-auto w-full max-w-[320px] rounded-[2rem] border border-slate-200 bg-[#e9f7ee] p-3 shadow-sm">
                <div className="rounded-[1.4rem] bg-[#efeae2] p-3">
                  <div className="mb-3 text-center text-[11px] font-medium text-slate-500">WhatsApp</div>
                  <div className="rounded-2xl rounded-tl-md bg-[#dcf8c6] px-3 py-2 text-sm text-slate-800 shadow-sm">
                    <div className="whitespace-pre-wrap break-words">{previewMessage || 'Sua mensagem aparecerá aqui.'}</div>
                    {messageType === 'link' && String(formData.waLinkUrl || '').trim() && (
                      <div className="mt-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs text-emerald-700">
                        Link clicável
                      </div>
                    )}
                  </div>
                  {messageType === 'buttons' && buttons.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {buttons.map((button, index) => (
                        <div key={`${button.id || index}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-sm font-medium text-emerald-700 shadow-sm">
                          {button.text || `Botão ${index + 1}`}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      }

      case 'hubspot_whatsapp_campaign': {
        const crmIntegrationId = String(formData.crmIntegrationId || '').trim()

        return (
          <div className="space-y-5">
            <div className="rounded-xl border p-4 text-sm leading-relaxed" style={{ ...buildAccentPanelStyle('teal'), ...buildAccentTextStyle('teal') }}>
              Esse bloco busca contatos no HubSpot por tag e prepara uma audiência reutilizável pelos próximos blocos de
              <strong> Template WhatsApp</strong> ou <strong>email</strong>.
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Nome do bloco</Label>
              <Input
                value={formData.label || ''}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="Ex.: Audiência clientes VIP"
                className="rounded-xl"
                style={{ borderRadius: '12px' }}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Integração HubSpot</Label>
              <Select
                value={crmIntegrationId || undefined}
                onValueChange={(value) => setFormData({ ...formData, crmIntegrationId: value })}
              >
                <SelectTrigger className="rounded-xl" style={{ borderRadius: '12px' }}>
                  <SelectValue placeholder="Selecione a integração HubSpot" />
                </SelectTrigger>
                <SelectContent>
                  {crmIntegrations.map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {getCrmOptionName(row)} · {row.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {crmIntegrations.length === 0 && (
                <p className="text-xs text-amber-500">
                  Nenhuma integração HubSpot ativa foi encontrada para este workspace. Confirme se o CRM está ativo em Configurações &gt; Integrações.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Tag do HubSpot</Label>
              <Input
                value={formData.crmFilterValue || ''}
                onChange={(e) => setFormData({ ...formData, crmFilterValue: e.target.value })}
                placeholder="Ex.: webinar_abril"
                className="rounded-xl"
                style={{ borderRadius: '12px' }}
              />
              <p className="text-xs text-muted-foreground">
                A tag seleciona os clientes que serão usados nos próximos envios automáticos.
              </p>
            </div>

            <div className="rounded-xl border p-4 text-sm" style={{ ...buildAccentPanelStyle('teal', 0.06, 0.18), color: '#475569' }}>
              Os próximos blocos de <strong>Template WhatsApp</strong> e <strong>Enviar email</strong> podem consumir essa audiência automaticamente.
            </div>
          </div>
        )
      }

      case 'crm_contact': {
        const crmIntegrationId = String(formData.crmIntegrationId || '').trim()
        const lookupFields = Array.isArray(formData.lookupFields)
          ? formData.lookupFields.join(', ')
          : String(formData.lookupFields || 'patient_phone, patient_email, patient_cpf')
        const requiredFields = Array.isArray(formData.requiredFields)
          ? formData.requiredFields.join(', ')
          : String(formData.requiredFields || 'patient_name, patient_email, patient_phone')

        return (
          <div className="space-y-5">
            <div className="rounded-xl border p-4 text-sm leading-relaxed" style={{ ...buildAccentPanelStyle('teal'), ...buildAccentTextStyle('teal') }}>
              Consulta, cria ou atualiza o cadastro do paciente no HubSpot com saída determinística para o fluxo.
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Nome do bloco</Label>
              <Input
                value={formData.label || ''}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="Ex.: Identificar paciente no CRM"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Operação</Label>
              <Select
                value={String(formData.crmOperation || 'lookup')}
                onValueChange={(value) => setFormData({ ...formData, crmOperation: value })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecione a operação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lookup">Lookup</SelectItem>
                  <SelectItem value="create">Create</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                  <SelectItem value="upsert">Upsert</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Integração HubSpot</Label>
              <Select
                value={crmIntegrationId || undefined}
                onValueChange={(value) => setFormData({ ...formData, crmIntegrationId: value })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecione a integração HubSpot" />
                </SelectTrigger>
                <SelectContent>
                  {crmIntegrations.map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {getCrmOptionName(row)} · {row.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {crmIntegrations.length === 0 && (
                <p className="text-xs text-amber-500">
                  Nenhuma integração HubSpot ativa foi encontrada para este workspace. Confirme se o CRM está ativo em Configurações &gt; Integrações.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Campos de lookup</Label>
              <Input
                value={lookupFields}
                onChange={(e) => setFormData({ ...formData, lookupFields: e.target.value })}
                placeholder="patient_phone, patient_email, patient_cpf"
                className="rounded-xl"
              />
              <p className="text-xs text-muted-foreground">Separe por vírgula as chaves do contexto usadas na busca.</p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Campos obrigatórios</Label>
              <Input
                value={requiredFields}
                onChange={(e) => setFormData({ ...formData, requiredFields: e.target.value })}
                placeholder="patient_name, patient_email, patient_phone"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Tag de origem</Label>
              <Input
                value={formData.originTag || ''}
                onChange={(e) => setFormData({ ...formData, originTag: e.target.value })}
                placeholder="Atendimento IA Clínica"
                className="rounded-xl"
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border p-4" style={buildAccentPanelStyle('teal', 0.06, 0.18)}>
              <div>
                <p className="text-sm font-semibold" style={buildAccentTextStyle('teal')}>Permitir ausência de data de nascimento</p>
                <p className="text-xs text-slate-500">Mantém o fluxo funcional mesmo sem DOB na primeira coleta.</p>
              </div>
              <Switch
                checked={formData.allowMissingDob === true}
                onCheckedChange={(checked) => setFormData({ ...formData, allowMissingDob: checked })}
              />
            </div>
          </div>
        )
      }

      case 'appointment': {
        return (
          <div className="space-y-5">
            <div className="rounded-xl border p-4 text-sm leading-relaxed" style={{ ...buildAccentPanelStyle('sky'), ...buildAccentTextStyle('sky') }}>
              Bloco generico de agenda com Calendly real. Use para consultar disponibilidade, criar booking, remarcar ou cancelar pelo chat.
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Nome do bloco</Label>
                <Input
                  value={formData.label || ''}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  placeholder="Ex.: Consultar disponibilidade"
                  className="rounded-xl"
                />
              </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Operação</Label>
              <Select
                value={String(formData.appointmentOperation || 'availability')}
                onValueChange={(value) => setFormData({ ...formData, appointmentOperation: value })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecione a operação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="availability">Consultar disponibilidade</SelectItem>
                  <SelectItem value="book">Criar booking</SelectItem>
                  <SelectItem value="reschedule">Remarcar booking</SelectItem>
                  <SelectItem value="cancel">Cancelar booking</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Integração Calendly</Label>
              <Select
                value={String(formData.appointmentIntegrationId || '__none__')}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    appointmentProvider: 'calendly',
                    appointmentIntegrationId: value === '__none__' ? '' : value,
                  })
                }
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecione a integração Calendly" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Selecione uma integração</SelectItem>
                  {calendarIntegrations.map((integration) => (
                    <SelectItem key={integration.id} value={integration.id}>
                      {String(integration.email_address || integration.provider || integration.id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                Este bloco usa apenas Calendly real para consultar horários e criar agendamentos direto no chat.
              </p>
            </div>

            {[
              ['specialtyField', 'Campo principal do recurso', 'appointment_resource'],
              ['doctorField', 'Campo do responsável', 'appointment_owner'],
              ['consultationTypeField', 'Campo do tipo', 'appointment_kind'],
              ['unitField', 'Campo da localização', 'appointment_location'],
              ['periodField', 'Campo da preferência de horário', 'appointment_time_preference'],
              ['preferredDateField', 'Campo da data preferida', 'appointment_date'],
            ].map(([field, label, placeholder]) => (
              <div className="space-y-2" key={field}>
                <Label className="text-sm font-semibold">{label}</Label>
                <Input
                  value={String(formData[field] || placeholder)}
                  onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                  placeholder={placeholder}
                  className="rounded-xl"
                />
                {field === 'specialtyField' ? (
                  <p className="text-xs text-slate-500">
                    Essa chave representa o assunto principal da ação de agenda: serviço, especialidade, tipo de reunião ou categoria do booking.
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )
      }

      case 'document_intake': {
        const documentKinds = Array.isArray(formData.documentKinds)
          ? formData.documentKinds.join(', ')
          : String(formData.documentKinds || 'exam, pedido_medico, document')

        return (
          <div className="space-y-5">
            <div className="rounded-xl border p-4 text-sm leading-relaxed" style={{ ...buildAccentPanelStyle('amber'), ...buildAccentTextStyle('amber') }}>
              Bloco mock para metadados de exames e documentos. Ele mantém o fluxo funcional mesmo antes da integração real de upload.
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Nome do bloco</Label>
              <Input
                value={formData.label || ''}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="Ex.: Receber exames do paciente"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Tipos aceitos</Label>
              <Input
                value={documentKinds}
                onChange={(e) => setFormData({ ...formData, documentKinds: e.target.value })}
                placeholder="exam, pedido_medico, document"
                className="rounded-xl"
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border p-4" style={buildAccentPanelStyle('amber', 0.06, 0.18)}>
              <div>
                <p className="text-sm font-semibold" style={buildAccentTextStyle('amber')}>Notificar equipe</p>
                <p className="text-xs text-slate-500">Usa o caminho interno de notificação e log.</p>
              </div>
              <Switch
                checked={formData.notifyTeam === true}
                onCheckedChange={(checked) => setFormData({ ...formData, notifyTeam: checked })}
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border p-4" style={buildAccentPanelStyle('amber', 0.06, 0.18)}>
              <div>
                <p className="text-sm font-semibold" style={buildAccentTextStyle('amber')}>Permitir sem arquivo real</p>
                <p className="text-xs text-slate-500">Deixa o fluxo seguir em modo placeholder com status pending_upload.</p>
              </div>
              <Switch
                checked={formData.acceptWithoutFile === true}
                onCheckedChange={(checked) => setFormData({ ...formData, acceptWithoutFile: checked })}
              />
            </div>
          </div>
        )
      }

      case 'human_handoff': {
        return (
          <div className="space-y-5">
            <div className="rounded-xl border p-4 text-sm leading-relaxed" style={{ ...buildAccentPanelStyle('rose'), ...buildAccentTextStyle('rose') }}>
              Transfere o caso para atendimento humano, registra o motivo e tenta notificar a equipe sem quebrar o fluxo.
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Nome do bloco</Label>
              <Input
                value={formData.label || ''}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="Ex.: Encaminhar para recepção humana"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Campo do motivo</Label>
              <Input
                value={formData.handoffReasonField || ''}
                onChange={(e) => setFormData({ ...formData, handoffReasonField: e.target.value })}
                placeholder="handoff_reason"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Prioridade</Label>
              <Select
                value={String(formData.handoffPriority || 'medium')}
                onValueChange={(value) => setFormData({ ...formData, handoffPriority: value })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecione a prioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">low</SelectItem>
                  <SelectItem value="medium">medium</SelectItem>
                  <SelectItem value="high">high</SelectItem>
                  <SelectItem value="urgent">urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Email interno para alerta</Label>
              <Input
                value={formData.notifyEmail || ''}
                onChange={(e) => setFormData({ ...formData, notifyEmail: e.target.value })}
                placeholder="recepcao@clinica.com.br"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">WhatsApp interno placeholder</Label>
              <Input
                value={formData.notifyWhatsApp || ''}
                onChange={(e) => setFormData({ ...formData, notifyWhatsApp: e.target.value })}
                placeholder="5511999999999"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Mensagem ao paciente</Label>
              <Textarea
                value={formData.patientMessage || ''}
                onChange={(e) => setFormData({ ...formData, patientMessage: e.target.value })}
                rows={4}
                placeholder="Vou encaminhar seu caso para nossa equipe humana e eles continuarão o atendimento em breve."
                className="rounded-xl"
              />
            </div>
          </div>
        )
      }

      case 'wa_template': {
        const integrationId = String(formData.waIntegrationId || '').trim()
        const integrationSelectValue = integrationId || WA_INTEGRATION_SELECT_CONTEXT
        const selectedMetaTemplate = findWaCatalogTemplate(
          waCatalog,
          String(formData.waTemplateName || ''),
          String(formData.waTemplateLanguage || '')
        )
        const selectedMetaTemplatePreview = extractWaTemplateBodyPreview(selectedMetaTemplate?.components_json)
        const selectedMetaTemplateNeedsVariables = waTemplateRequiresVariables(selectedMetaTemplate?.components_json)
        const selectedMetaTemplateNeedsMedia = waTemplateRequiresMediaHeader(selectedMetaTemplate?.components_json)
        const selectedMetaTemplateExact = buildWaTemplateExactComponents(selectedMetaTemplate?.components_json)
        const selectedMetaTemplateButtons = extractWaTemplateButtonTexts(selectedMetaTemplate?.components_json)

        return (
          <div className="space-y-5">
            <div className="flex justify-center">
              <div className="rounded-2xl border-2 p-4" style={buildAccentBadgeStyle('purple')}>
                <span className="text-sm font-semibold" style={buildAccentTextStyle('purple')}>
                  WhatsApp · Template bloqueado
                </span>
              </div>
            </div>
            <div className="rounded-xl border p-4 text-sm leading-relaxed" style={{ ...buildAccentPanelStyle('purple'), ...buildAccentTextStyle('purple') }}>
              <p className="font-semibold">Como funciona este bloco</p>
              <p className="mt-2 opacity-95">
                Este bloco usa <strong>exatamente</strong> o template aprovado na <strong>Meta</strong>, sem edição de
                texto, imagem, idioma ou botões dentro da plataforma. Você só escolhe a integração e o template
                sincronizado.
              </p>
              <p className="mt-2 opacity-95">
                Ele continua servindo para iniciar conversa com um contato único e também pode disparar em lote quando uma audiência HubSpot vier do bloco anterior.
              </p>
              <p className="mt-2 opacity-95">
                Se o modelo exigir dados que não estejam no catálogo da Meta, o bloco avisa e bloqueia o uso em modo
                exato.
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Integração WhatsApp</Label>
              <Select
                value={integrationSelectValue}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    waIntegrationId: value === WA_INTEGRATION_SELECT_CONTEXT ? '' : value,
                  })
                }
              >
                <SelectTrigger className="rounded-xl" style={{ borderRadius: '12px' }}>
                  <SelectValue placeholder="Usar integração do contexto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={WA_INTEGRATION_SELECT_CONTEXT}>
                    Usar integração do contexto (recomendado)
                  </SelectItem>
                  {waIntegrations.map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.phone_number || row.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Se vazio, o fluxo usa a integração do contexto (mensagem recebida).
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                disabled={!integrationId || waCatalogBusy}
                onClick={async () => {
                  setWaCatalogBusy(true)
                  try {
                    const { WhatsAppService } = await import('../../services/api')
                    const sync = await WhatsAppService.syncTemplatesForIntegration(integrationId)
                    if (!sync.success) {
                      toast.error(sync.error || 'Falha ao sincronizar templates')
                      return
                    }
                    const list = await WhatsAppService.listCatalogTemplatesForIntegration(integrationId)
                    setWaCatalog(normalizeWaCatalogRows(list))
                    toast.success(`Catálogo atualizado (${sync.synced ?? list.length})`)
                  } catch (e: any) {
                    toast.error(e?.message || 'Erro ao carregar catálogo')
                  } finally {
                    setWaCatalogBusy(false)
                  }
                }}
              >
                {waCatalogBusy ? 'Carregando...' : 'Sincronizar e listar templates'}
              </Button>
            </div>
            {waCatalog.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Template sincronizado da Meta</Label>
                <Select
                  value={
                    formData.waTemplateName && formData.waTemplateLanguage
                      ? encodeWaCatalogValue(String(formData.waTemplateName), String(formData.waTemplateLanguage))
                      : undefined
                  }
                  onValueChange={(value) => {
                    const { name, language } = decodeWaCatalogValue(value)
                    const nextFormData = {
                      ...formData,
                      waTemplateName: name,
                      waTemplateLanguage: language,
                    }
                    const template = findWaCatalogTemplate(waCatalog, name, language)
                    applyWaTemplateSelection(template, nextFormData)
                  }}
                >
                  <SelectTrigger className="rounded-xl" style={{ borderRadius: '12px' }}>
                    <SelectValue placeholder="Escolha o modelo aprovado" />
                  </SelectTrigger>
                  <SelectContent>
                    {waCatalog.map((row, idx) => (
                      <SelectItem
                        key={`${row.name}-${row.language}-${idx}`}
                        value={encodeWaCatalogValue(row.name, row.language)}
                      >
                        {row.name} ({row.language})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {selectedMetaTemplate && (
              <div className="rounded-xl border p-4 text-sm" style={{ ...buildAccentPanelStyle('purple', selectedMetaTemplateNeedsVariables || selectedMetaTemplateNeedsMedia ? 0.12 : 0.08, selectedMetaTemplateNeedsVariables || selectedMetaTemplateNeedsMedia ? 0.32 : 0.24), ...buildAccentTextStyle('purple') }}>
                <p className="font-semibold">
                  Template bloqueado da Meta: {selectedMetaTemplate.name} ({selectedMetaTemplate.language})
                </p>
                {selectedMetaTemplatePreview && (
                  <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed opacity-90">
                    {selectedMetaTemplatePreview}
                  </p>
                )}
                <p className="mt-2 text-xs opacity-90">
                  {selectedMetaTemplateNeedsVariables || selectedMetaTemplateNeedsMedia
                    ? 'Esse template foi encontrado no catálogo da Meta. O sistema vai tentar montar o envio exato sem expor edição manual.'
                    : 'Esse template já está completo no catálogo da Meta e será enviado exatamente como foi aprovado.'}
                </p>
                {selectedMetaTemplateExact.missingRequirements.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {selectedMetaTemplateExact.missingRequirements.map((requirement, index) => (
                      <p key={`${selectedMetaTemplate?.name || 'template'}-requirement-${index}`} className="text-xs opacity-90">
                        {`${index + 1}. ${requirement}`}
                      </p>
                    ))}
                  </div>
                )}
                {selectedMetaTemplateButtons.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedMetaTemplateButtons.map((buttonText, index) => (
                      <span
                        key={`${selectedMetaTemplate.name}-button-${index}`}
                        className="rounded-full border border-current/20 px-3 py-1 text-xs font-medium"
                      >
                        {buttonText}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
            {selectedMetaTemplate && (
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Pré-visualização bloqueada</Label>
                <div className="mx-auto w-full max-w-[320px] rounded-[2rem] border border-slate-200 bg-[#e9f7ee] p-3 shadow-sm">
                  <div className="rounded-[1.4rem] bg-[#efeae2] p-3">
                    <div className="mb-3 text-center text-[11px] font-medium text-slate-500">WhatsApp</div>
                    {selectedMetaTemplateNeedsMedia && (
                      <div className="mb-2 rounded-xl border border-slate-200 bg-white px-3 py-6 text-center text-xs font-medium text-slate-500">
                        Cabeçalho com mídia da Meta
                      </div>
                    )}
                    <div className="rounded-2xl rounded-tl-md bg-[#dcf8c6] px-3 py-2 text-sm text-slate-800 shadow-sm">
                      <div className="whitespace-pre-wrap break-words">
                        {selectedMetaTemplatePreview || 'Este template não possui texto de corpo visível no catálogo.'}
                      </div>
                    </div>
                    {selectedMetaTemplateButtons.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {selectedMetaTemplateButtons.map((buttonText, index) => (
                          <div key={`${selectedMetaTemplate.name}-preview-button-${index}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-sm font-medium text-emerald-700 shadow-sm">
                            {buttonText}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      }

      case 'wa_session_window':
        return (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="rounded-2xl border-2 p-4" style={buildAccentBadgeStyle('sky')}>
                <span className="text-sm font-semibold" style={buildAccentTextStyle('sky')}>WhatsApp · Janela 24h</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wa-session-label" className="text-sm font-semibold">
                Nome do bloco
              </Label>
              <Input
                id="wa-session-label"
                value={formData.label || ''}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="Ex.: Dentro da sessão?"
                className="rounded-xl"
                style={{ borderRadius: '12px' }}
              />
            </div>
            <div className="rounded-xl border p-4 text-sm" style={{ ...buildAccentPanelStyle('sky'), ...buildAccentTextStyle('sky') }}>
              Conecte o handle verde (24h) ao fluxo quando o contato está dentro da janela de atendimento; o vermelho
              (Fora) quando não há sessão ou ela expirou - costuma exigir envio por template Meta.
            </div>
          </div>
        )

      case 'comment':
        const commentLength = (formData.comment || '').length
        const maxCommentLength = 200
        return (
          <div className="space-y-4">
            {/* Ícone no topo */}
            <div className="flex justify-center mb-4">
              <div className="p-4 rounded-full bg-amber-50 border-2 border-amber-100 shadow-sm">
                <FileText className="h-12 w-12" strokeWidth={2.5} style={{ color: '#f59e0b' }} />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="comment" className="text-slate-700 font-semibold">Comentário</Label>
              <div className="relative">
                <Textarea
                  id="comment"
                  value={formData.comment || ''}
                  onChange={(e) => {
                    const value = e.target.value
                    if (value.length <= maxCommentLength) {
                      setFormData({ ...formData, comment: value })
                    }
                  }}
                  placeholder="Adicione uma nota explicativa sobre este ponto do fluxo..."
                  rows={6}
                  className="text-sm rounded-[2rem] border-slate-200 focus:border-amber-400 focus:ring-amber-400/50 focus:ring-2 transition-all resize-none"
                  style={{
                    padding: '1rem 1.25rem',
                  }}
                />
                <div className="absolute bottom-3 right-4 text-xs text-slate-400">
                  {commentLength}/{maxCommentLength}
                </div>
              </div>
            </div>
            
            {/* Banner de Informação */}
            <div className="mt-4 flex items-start gap-3 rounded-xl border p-4" style={buildAccentPanelStyle('amber')}>
              <Info className="h-5 w-5 flex-shrink-0 mt-0.5" strokeWidth={2.5} style={buildAccentTextStyle('amber', false)} />
              <p className="text-sm leading-relaxed" style={buildAccentTextStyle('amber')}>
                Este comentário não será executado, serve apenas para documentação e ajuda a explicar o fluxo.
              </p>
            </div>
          </div>
        )

      case 'stop': {
        const isSubflowCanvas = currentFlowKind === 'subflow'
        const stopScopeOptions = isSubflowCanvas
          ? [{ value: 'subflow', label: 'Saída do subfluxo', hint: 'Volta ao fluxo pai para seguir a ordem dos blocos conectados após o subfluxo.' }]
          : [
              { value: 'flow', label: 'Encerrar atendimento', hint: 'Encerra o fluxo por completo. Use quando não houver próximo passo.' },
              { value: 'step', label: 'Próximo passo', hint: 'Conecte a saída inferior ao próximo bloco (subfluxo, condicional, etc.).' },
            ]

        return (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="stop-node-label" className="text-sm font-semibold">Nome do bloco</Label>
              <Input
                id="stop-node-label"
                value={formData.label || ''}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="Ex: Após triagem, Fim do agendamento"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Comportamento</Label>
              <Select
                value={String(formData.stopScope || (isSubflowCanvas ? 'subflow' : 'flow'))}
                onValueChange={(value) => {
                  const labels: Record<string, string> = {
                    subflow: 'Saída do subfluxo',
                    flow: 'Encerrar atendimento',
                    step: 'Próximo passo',
                  }
                  setFormData({
                    ...formData,
                    stopScope: value,
                    label: labels[value] || formData.label,
                  })
                }}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecione o comportamento" />
                </SelectTrigger>
                <SelectContent>
                  {stopScopeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {stopScopeOptions.find((option) => option.value === String(formData.stopScope || (isSubflowCanvas ? 'subflow' : 'flow')))?.hint}
              </p>
            </div>
          </div>
        )
      }

      default:
        return <p className="text-sm text-muted-foreground">Este node não possui configurações editáveis.</p>
    }
  }

  const getTitle = () => {
    switch (node.type) {
      case 'stop': return 'Configurar parada'
      case 'agent': return 'Editar Agente IA'
      case 'loop': return 'Editar Loop'
      case 'subflow': return 'Executar subfluxo'
      case 'if-else': return 'Editar Condicional'
      case 'switch': return 'Editar Múltiplas opções'
      case 'delay': return 'Editar Aguardar'
      case 'schedule': return 'Agendar data e hora'
      case 'comment': return 'Editar Comentário'
      case 'debug': return 'Editar Debug'
      case 'email_send': return 'Enviar email'
      case 'email_read': return 'Ler inbox email'
      case 'whatsapp_message': return 'Mensagem WhatsApp 24h'
      case 'hubspot_whatsapp_campaign': return 'Audiência HubSpot'
      case 'crm_contact': return 'Contato CRM'
      case 'appointment': return 'Ação de agenda'
      case 'document_intake': return 'Document Intake'
      case 'human_handoff': return 'Handoff Humano'
      case 'wa_template': return 'Template WhatsApp'
      case 'wa_session_window': return 'Janela 24h (WhatsApp)'
      default: return 'Editar Node'
    }
  }

  const modalAccent = getNodeModalAccent(node.type)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="sm:max-w-[500px] max-h-[90vh] flex flex-col"
        style={{ 
          borderRadius: '16px', 
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        <DialogHeader className="flex-shrink-0 pb-4">
          <DialogTitle>{getTitle()}</DialogTitle>
          <DialogDescription>
            Configure as propriedades deste node
          </DialogDescription>
        </DialogHeader>
        <div 
          style={{ 
            flex: '1 1 auto',
            overflowY: 'auto',
            overflowX: 'hidden',
            minHeight: 0,
            paddingRight: '8px',
            marginRight: '-8px'
          }}
        >
          <div className="py-4">
            {renderForm()}
          </div>
        </div>
        <DialogFooter className="flex-shrink-0 border-t pt-4 mt-4">
          <Button variant="outline" onClick={onClose} className="rounded-xl">
            Cancelar
          </Button>
          <Button 
            onClick={handleSave}
            className="rounded-xl text-white shadow-lg"
            style={buildAccentButtonStyle(modalAccent)}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}





