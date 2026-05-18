import { AudienceContact, FlowData, FlowNode, FlowEdge, FlowExecutionContext, NodeExecutionResult } from './flow.types'
import { chatWithAgent } from '../agents/chatwithAgent'
import { executeFlowTemplateNode } from './flow-template-runner'
import logger from '../../lib/logger'
import { supabase } from '../../lib/supabase'
import { saveFallbackEvent } from './fallback-events'
import { saveSystemLog } from '../system-logs'
import { sendWhatsAppTemplate } from '../integrations/whatsapp/whatsapp.dispatcher'
import { getCustomerCareWindowState } from '../integrations/whatsapp/whatsapp-session-window.service'
import { sendFlowWhatsAppMessage } from '../integrations/whatsapp/whatsapp-flow-message.service'
import { searchHubSpotContacts } from '../integrations/crm/hubspot.service'
import { createCampaignRecord, enqueueCampaignContacts } from '../integrations/whatsapp/whatsapp-campaign.service'
import { createOrUpdateContact, getContactByPhoneNumber } from '../integrations/whatsapp/whatsapp.contacts'
import {
  buildExactTemplateSendComponentsFromCatalog,
  getStoredTemplateByNameAndLanguage,
} from '../integrations/whatsapp/whatsapp-template-catalog.service'
import { sendEmail } from '../integrations/email/email.service'
import { enqueueEmailAudienceJobs } from '../integrations/email/email-audience.service'
import { readInboxMessages } from '../integrations/mail'
import { enqueueFlowResumeJobs, resolveScheduledAtToUtcIso } from './flow-scheduler.service'
import { executeCrmContactNode } from './flow-node-crm-contact.service'
import { executeAppointmentNode } from './flow-node-appointment.service'
import { executeDocumentIntakeNode } from './flow-node-document-intake.service'
import { executeHumanHandoffNode } from './flow-node-human-handoff.service'
import { executeIntegrationTool } from '../integrations/toolkit/toolkit.service'

function safeLogPreview(value: unknown): string {
  const normalized = String(value || '').trim()
  return normalized ? `[redacted chars=${normalized.length}]` : ''
}

/**
 * Executa um flow de agentes sequencialmente
 * Cada node executa e passa dados para os próximos nodes conectados
 */
export class FlowExecutor {
  private context: FlowExecutionContext
  private flowData: FlowData
  private executedNodes: Set<string> = new Set()

  constructor(flowData: FlowData, context: FlowExecutionContext) {
    this.flowData = flowData
    this.context = context
  }

  private resolveNodeExecutionMode(node: FlowNode): 'agent' | 'template' {
    const d = node.data || ({} as FlowNode['data'])
    const tid = typeof d.templateId === 'string' ? d.templateId.trim() : ''
    const aid = d.agentId != null && String(d.agentId).trim() !== '' ? String(d.agentId).trim() : ''
    if (d.executionMode === 'template' || (tid !== '' && aid === '')) {
      return 'template'
    }
    if (d.executionMode === 'agent' && aid === '' && tid !== '') {
      return 'template'
    }
    return 'agent'
  }

  private isSubflowRuntime(): boolean {
    return (
      String(this.context.data.__flow_runtime_scope || '').trim() === 'subflow' ||
      this.flowData.meta?.kind === 'subflow'
    )
  }

  private resolveStopScope(node: FlowNode): 'flow' | 'subflow' | 'step' {
    const explicit = String(node.data.stopScope || '').trim().toLowerCase()
    if (explicit === 'flow' || explicit === 'subflow' || explicit === 'step') {
      return explicit
    }
    if (this.isSubflowRuntime()) {
      return 'subflow'
    }
    return 'flow'
  }

  private getNodeExecutionRef(node: FlowNode): { executionMode: 'agent' | 'template'; agentId?: string; templateId?: string } {
    const executionMode = this.resolveNodeExecutionMode(node)

    return {
      executionMode,
      agentId: executionMode === 'agent' ? node.data.agentId : undefined,
      templateId: executionMode === 'template' ? node.data.templateId : undefined
    }
  }

  private appendExecutionHistory(
    node: FlowNode,
    startedAt: string,
    partial: {
      success: boolean
      output?: any
      error?: string
      input?: unknown
      outputSummary?: string
      qrCode?: string
      nodeType?: string
      executionMode?: 'agent' | 'template'
      agentId?: string
      templateId?: string
    }
  ): void {
    const ref = this.getNodeExecutionRef(node)
    this.context.executionHistory.push({
      nodeId: node.id,
      executionMode: partial.executionMode ?? ref.executionMode,
      agentId: partial.agentId ?? ref.agentId,
      templateId: partial.templateId ?? ref.templateId,
      nodeType: partial.nodeType ?? node.type,
      startedAt,
      finishedAt: new Date().toISOString(),
      success: partial.success,
      output: partial.output,
      error: partial.error,
      input: partial.input,
      outputSummary: partial.outputSummary,
      qrCode: partial.qrCode
    })
  }

  private parseDebugKeys(raw?: string): string[] | null {
    if (raw == null || String(raw).trim() === '') return null
    return String(raw)
      .split(/[\s,\n\r]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
  }

  private normalizeDelaySeconds(raw: string | number | undefined): number {
    const parsed = typeof raw === 'number' ? raw : parseFloat(String(raw ?? '0'))
    if (!Number.isFinite(parsed) || parsed < 0) {
      logger.warn(`[FlowExecutor] Duração de delay inválida (${String(raw)}), usando 0`)
      return 0
    }
    const capped = Math.min(Math.floor(parsed), 3600)
    if (parsed > 3600) {
      logger.warn(`[FlowExecutor] Delay limitado a 3600s (pedido: ${parsed})`)
    }
    return capped
  }

  private renderScopedTemplate(template: string, scope: Record<string, unknown>): string {
    return String(template || '').replace(/\{\{([\w.]+)\}\}/g, (_match, key) => {
      const value = this.resolveTemplateValue(scope, key)
      if (value === undefined || value === null) return ''
      if (typeof value === 'string') return value
      if (typeof value === 'number' || typeof value === 'boolean') return String(value)
      try {
        return JSON.stringify(value)
      } catch {
        return ''
      }
    })
  }

  private parseStructuredTextOutput(output: string): Record<string, unknown> | null {
    const text = String(output || '').trim()
    if (!text) return null

    const internalMarker = /(?:^|\n)\s*dados internos\s*:/i
    const messageMarker = /(?:^|\n)\s*mensagem ao paciente\s*:/i
    if (!internalMarker.test(text) && !messageMarker.test(text)) {
      return null
    }

    const internalMatch = text.match(internalMarker)
    const internalStart = internalMatch?.index ?? -1
    const beforeInternal = internalStart >= 0 ? text.slice(0, internalStart).trim() : text
    const internalSection =
      internalStart >= 0 ? text.slice(internalStart + (internalMatch?.[0]?.length || 0)).trim() : ''

    const messageMatch = beforeInternal.match(messageMarker)
    const response = messageMatch
      ? beforeInternal.slice((messageMatch.index ?? 0) + messageMatch[0].length).trim()
      : beforeInternal.trim()

    const parsed: Record<string, unknown> = {}
    if (response) {
      parsed.response = response
    }

    for (const line of internalSection.split(/\r?\n/)) {
      const match = line.trim().match(/^([a-zA-Z_][\w.]*)\s*[:=]\s*(.*)$/)
      if (!match) continue
      const key = match[1].trim()
      const rawValue = match[2].trim()
      if (!key) continue
      if (key === 'missing_fields') {
        parsed[key] = rawValue
          .split(/[,\n;|]+/)
          .map((item) => item.trim())
          .filter(Boolean)
        continue
      }
      parsed[key] = rawValue
    }

    return Object.keys(parsed).length > 0 ? parsed : null
  }

  private resolveTemplateValue(scope: Record<string, unknown>, keyPath: string): unknown {
    const normalizedPath = String(keyPath || '').trim()
    if (!normalizedPath) return undefined
    if (Object.prototype.hasOwnProperty.call(scope, normalizedPath)) {
      return scope[normalizedPath]
    }

    return normalizedPath.split('.').reduce<unknown>((current, part) => {
      if (current == null || typeof current !== 'object') return undefined
      return (current as Record<string, unknown>)[part]
    }, scope)
  }

  private renderIntegrationToolPayloadValue(value: unknown, scope: Record<string, unknown>): unknown {
    if (typeof value === 'string') {
      return this.renderScopedTemplate(value, scope)
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.renderIntegrationToolPayloadValue(item, scope))
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
          key,
          this.renderIntegrationToolPayloadValue(nestedValue, scope),
        ])
      )
    }
    return value
  }

  private buildIntegrationToolScope(nodeId: string): Record<string, unknown> {
    return {
      ...this.context.data,
      ...this.collectPredecessorData(nodeId),
    }
  }

  private mergeIntegrationToolResultIntoContext(resultKey: string, result: Awaited<ReturnType<typeof executeIntegrationTool>>): void {
    const normalizedKey = String(resultKey || 'integration_action').trim() || 'integration_action'
    const payload = result.data && typeof result.data === 'object' && !Array.isArray(result.data) ? result.data : {}

    this.context.data[normalizedKey] = payload
    this.context.data[`${normalizedKey}_status`] = result.status
    this.context.data[`${normalizedKey}_success`] = result.success
    this.context.data[`${normalizedKey}_message`] = result.userSafeMessage

    for (const [key, value] of Object.entries(payload)) {
      this.context.data[`${normalizedKey}_${key}`] = value
    }
  }

  private async executeOptionalIntegrationAction(node: FlowNode): Promise<Awaited<ReturnType<typeof executeIntegrationTool>> | null> {
    const d = (node.data || {}) as Record<string, unknown>
    if (d.integrationToolEnabled !== true) {
      return null
    }

    const provider = String(d.integrationToolProvider || '').trim().toLowerCase()
    const toolName = String(d.integrationToolName || '').trim().toLowerCase()
    if (!provider || !toolName) {
      return null
    }

    let rawPayload: Record<string, unknown> = {}
    if (d.integrationToolPayloadJson != null && String(d.integrationToolPayloadJson).trim()) {
      try {
        const parsed = JSON.parse(String(d.integrationToolPayloadJson))
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          rawPayload = parsed as Record<string, unknown>
        }
      } catch (error: any) {
        throw new Error(`Ferramenta de integração com JSON inválido: ${error?.message || 'payload inválido'}`)
      }
    }

    const scope = this.buildIntegrationToolScope(node.id)
    const renderedPayload = this.renderIntegrationToolPayloadValue(rawPayload, scope)
    const payload =
      renderedPayload && typeof renderedPayload === 'object' && !Array.isArray(renderedPayload)
        ? { ...(renderedPayload as Record<string, unknown>) }
        : {}

    const integrationId = String(d.integrationToolIntegrationId || '').trim()
    if (integrationId) {
      if (provider === 'hubspot') {
        payload.crmIntegrationId = payload.crmIntegrationId || integrationId
      } else {
        payload.integrationId = payload.integrationId || integrationId
      }
    }

    const result = await executeIntegrationTool({
      provider,
      toolName,
      payload,
    })

    const resultKey = String(d.integrationToolResultKey || 'integration_action').trim() || 'integration_action'
    this.mergeIntegrationToolResultIntoContext(resultKey, result)

    if (!result.success && d.integrationToolFailOnError === true) {
      throw new Error(result.userSafeMessage || result.error || 'Falha ao executar a ferramenta de integração.')
    }

    return result
  }

  private parsePositiveInt(raw: string | number | undefined, fallback: number, max: number): number {
    const parsed = typeof raw === 'number' ? raw : parseInt(String(raw ?? fallback), 10)
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback
    return Math.min(Math.floor(parsed), max)
  }

  private isLiveExecution(): boolean {
    return String(this.context.data.__flow_execution_mode || 'live').trim().toLowerCase() === 'live'
  }

  private normalizeFlowControlValue(value: unknown): string {
    return String(value ?? '').trim().toLowerCase()
  }

  private getContextPathValue(path: unknown): unknown {
    const normalizedPath = String(path || '').trim()
    if (!normalizedPath) return undefined

    return normalizedPath.split('.').reduce((current: any, segment) => {
      if (current === null || current === undefined) return undefined
      return current[segment]
    }, this.context.data as any)
  }

  private hasMinimalPatientProfile(): boolean {
    const name = String(this.context.data.patient_name || this.context.data.lead_name || '').trim()
    const email = String(this.context.data.patient_email || this.context.data.lead_email || '').trim()
    const phone = String(
      this.context.data.patient_phone ||
      this.context.data.phone_number ||
      this.context.data.from ||
      ''
    ).trim()
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    const phoneOk = phone.replace(/\D/g, '').length >= 10
    return Boolean(name && emailOk && phoneOk)
  }

  private syncPatientProfileFromContext(): void {
    if (!this.hasMinimalPatientProfile()) return

    const current = this.normalizeFlowControlValue(this.context.data.patient_lookup_status)
    if (current === 'existing' || current === 'new') return

    this.context.data.patient_lookup_status = 'new'
    if (!this.context.data.patient_phone) {
      const phone = String(this.context.data.phone_number || this.context.data.from || '').trim()
      if (phone) this.context.data.patient_phone = phone
    }
  }

  private isMissingConversationalValue(value: unknown): boolean {
    if (value === null || value === undefined) return true
    const normalized = this.normalizeFlowControlValue(value)
    return (
      !normalized ||
      normalized === 'unknown' ||
      normalized === 'indefinido' ||
      normalized === 'indefinida' ||
      normalized === 'nao_informado' ||
      normalized === 'não_informado' ||
      normalized === 'incomplete' ||
      normalized === 'pending' ||
      normalized === 'pendente'
    )
  }

  private shouldPauseForUserReply(
    currentNode: FlowNode,
    nextNodes: FlowNode[]
  ): { pause: boolean; reason?: string; resumeNodeId?: string; waitingNodeId?: string } {
    if (!this.isLiveExecution()) return { pause: false }
    if (currentNode.type !== 'agent') return { pause: false }

    const missingFields = this.context.data.missing_fields || this.context.data.required_missing_fields
    if (Array.isArray(missingFields) && missingFields.length > 0) {
      return { pause: true, reason: 'missing_required_fields' }
    }

    const incompleteStatusKeys = [
      'patient_lookup_status',
      'appointment_status',
      'document_status',
      'integration_status'
    ]
    for (const key of incompleteStatusKeys) {
      const value = this.normalizeFlowControlValue(this.context.data[key])
      if (value === 'incomplete' || value === 'pending' || value === 'pending_upload' || value === 'needs_input') {
        if (
          key === 'patient_lookup_status' &&
          this.normalizeFlowControlValue(this.context.data.integration_status) === 'not_configured' &&
          this.hasMinimalPatientProfile()
        ) {
          continue
        }
        if (key === 'integration_status' && value === 'not_configured') {
          continue
        }
        return { pause: true, reason: `incomplete_status:${key}` }
      }
    }

    if (!nextNodes.length) return { pause: false }

    const nextDecisionNode = nextNodes.find((node) => node.type === 'switch' || node.type === 'if-else')
    if (!nextDecisionNode) return { pause: false }

    const branchField = String(nextDecisionNode.data?.branchField || '').trim()
    if (!branchField) return { pause: false }

    const value = this.getContextPathValue(branchField)
    if (!this.isMissingConversationalValue(value)) return { pause: false }

    return {
      pause: true,
      reason: `missing_branch_field:${branchField}`,
      resumeNodeId: nextDecisionNode.id,
      waitingNodeId: nextDecisionNode.id
    }
  }

  private pauseForUserReply(
    node: FlowNode,
    reason: string,
    options?: { resumeNodeId?: string; waitingNodeId?: string }
  ): void {
    const resumeNodeId = String(options?.resumeNodeId || node.id).trim() || node.id
    const waitingNodeId = String(options?.waitingNodeId || resumeNodeId).trim() || resumeNodeId
    const waitingNode = this.flowData.nodes.find((candidate) => candidate.id === waitingNodeId) || node

    this.context.data.__flow_paused_for_user_reply = true
    this.context.data.__flow_resume_node_id = resumeNodeId
    this.context.data.__flow_waiting_node_id = waitingNodeId
    this.context.data.__flow_waiting_node_label = waitingNode.data?.label || waitingNode.id
    this.context.data.__flow_pause_reason = reason
    logger.info('[FlowExecutor] Fluxo pausado aguardando resposta do usuario', {
      flowId: this.context.flowId,
      nodeId: node.id,
      resumeNodeId,
      reason
    })
  }

  private splitAudienceTags(value: unknown): string[] {
    return String(value || '')
      .split(/[,\n;|]+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
  }

  private normalizeAudienceContact(
    crmIntegrationId: string,
    contact: Record<string, any>,
    tagField: string
  ): AudienceContact {
    const properties = contact?.properties && typeof contact.properties === 'object'
      ? (contact.properties as Record<string, unknown>)
      : {}
    const firstname = String(contact.firstname || properties.firstname || '').trim() || null
    const lastname = String(contact.lastname || properties.lastname || '').trim() || null
    const resolvedName =
      String(contact.name || '').trim() ||
      [firstname || '', lastname || ''].filter(Boolean).join(' ').trim() ||
      null
    const email = String(contact.email || properties.email || '').trim() || null
    const phone = String(contact.phone || properties.phone || '').trim() || null
    const tagValue = properties[tagField] ?? contact[tagField] ?? properties.tag ?? contact.tag ?? ''

    return {
      external_id: String(contact.id || '').trim(),
      firstname,
      lastname,
      name: resolvedName,
      email,
      phone,
      crm_integration_id: crmIntegrationId,
      source: 'hubspot',
      tags: this.splitAudienceTags(tagValue),
      properties
    }
  }

  private normalizeBranchToken(raw: unknown): string {
    return String(raw ?? '')
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
  }

  private splitBranchCandidates(raw: unknown): string[] {
    return String(raw ?? '')
      .split(/[,\n;/|]+/)
      .map((item) => this.normalizeBranchToken(item))
      .filter((item) => item.length > 0)
  }

  private resolveBranchFieldValue(node: FlowNode): string {
    const data = node.data || ({} as FlowNode['data'])
    const branchField = String(data.branchField || 'message').trim() || 'message'
    const customKey = String(data.branchCustomField || '').trim()
    const fieldMap: Record<string, string> = {
      message: 'message',
      intent: 'intent',
      option: 'option',
      input: 'input',
      last_response: 'lastResponse',
      message_count: 'message_count',
      phone_number: 'phone_number',
      user_name: 'user_name',
    }

    const resolvedKey = branchField === 'custom'
      ? customKey
      : (fieldMap[branchField] || branchField)

    if (!resolvedKey) {
      return ''
    }

    const directValue = this.context.data[resolvedKey]
    if (directValue !== undefined && directValue !== null) {
      return String(directValue)
    }

    const aliases: Record<string, string[]> = {
      message: ['userMessage', 'originalMessage'],
      input: ['message', 'userMessage', 'originalMessage'],
      option: ['message', 'input'],
      lastResponse: ['last_response', 'response', 'reply'],
    }

    for (const alias of aliases[resolvedKey] || []) {
      const aliasValue = this.context.data[alias]
      if (aliasValue !== undefined && aliasValue !== null && String(aliasValue).trim()) {
        return String(aliasValue)
      }
    }

    if (node.type === 'switch') {
      const inferredValue = this.inferSwitchValueFromConversation(node)
      if (inferredValue) {
        this.context.data[resolvedKey] = inferredValue
        return inferredValue
      }
    }

    return ''
  }

  private inferSwitchValueFromConversation(node: FlowNode): string {
    const rawMessage = String(
      this.context.data.message ??
      this.context.data.userMessage ??
      this.context.data.originalMessage ??
      this.context.data.input ??
      ''
    ).trim()
    if (!rawMessage) {
      return ''
    }

    const cases = Array.isArray(node.data.switchCases) ? node.data.switchCases : []
    if (cases.length === 0) {
      return ''
    }

    const numericMatch = rawMessage.match(/^\s*(\d+)\s*$/)
    if (numericMatch) {
      const optionIndex = Number.parseInt(numericMatch[1], 10) - 1
      const selectedCase = optionIndex >= 0 ? cases[optionIndex] : null
      if (selectedCase) {
        return String(selectedCase.value || selectedCase.id || '').trim()
      }
    }

    const normalizedMessage = this.normalizeBranchToken(rawMessage)
    for (const item of cases) {
      const caseId = String(item?.id || '').trim()
      if (!caseId) continue

      const labels = [
        ...this.splitBranchCandidates(item?.value || ''),
        this.normalizeBranchToken(item?.label || ''),
        this.normalizeBranchToken(caseId)
      ].filter((value, index, values) => value.length > 0 && values.indexOf(value) === index)

      if (labels.includes(normalizedMessage)) {
        return String(item?.value || caseId).trim()
      }
    }

    return ''
  }

  private evaluateSimpleBranch(node: FlowNode): { matched: boolean; actualValue: string; expectedValues: string[] } {
    const actualValue = this.resolveBranchFieldValue(node)
    const normalizedActual = this.normalizeBranchToken(actualValue)
    const expectedValues = this.splitBranchCandidates(node.data.ifValue || '')
    const matched = normalizedActual.length > 0 && expectedValues.includes(normalizedActual)

    return { matched, actualValue, expectedValues }
  }

  private applyRoutingDefaultsBeforeSwitch(node: FlowNode): void {
    const branchField = String(node.data?.branchField || '').trim()
    if (branchField !== 'urgency_status') return

    const current = this.normalizeBranchToken(this.context.data.urgency_status)
    if (current && current !== 'unknown') return

    const intent = this.normalizeBranchToken(this.context.data.intent)
    const schedulingIntents = new Set([
      'agendar',
      'remarcar',
      'cancelar',
      'especialidades',
      'documentos',
    ])
    if (schedulingIntents.has(intent)) {
      this.context.data.urgency_status = 'non_urgent'
    }
  }

  private enrichAgentOutputForContext(output: unknown): unknown {
    if (!output || typeof output !== 'object' || Array.isArray(output)) {
      return output
    }

    const record = { ...(output as Record<string, unknown>) }
    const message = record.message ?? record.response
    if (typeof message === 'string') {
      const structured = this.parseStructuredTextOutput(message)
      if (structured) {
        Object.assign(record, structured)
      }
    }

    return record
  }

  private evaluateSwitchBranch(node: FlowNode): {
    selectedHandle: string
    actualValue: string
    matchedCase: { id: string; label: string; value: string } | null
  } {
    this.applyRoutingDefaultsBeforeSwitch(node)
    const actualValue = this.resolveBranchFieldValue(node)
    const normalizedActual = this.normalizeBranchToken(actualValue)
    const cases = Array.isArray(node.data.switchCases) ? node.data.switchCases : []

    for (const item of cases) {
      const caseId = String(item?.id || '').trim()
      if (!caseId) continue
      const expectedValues = this.splitBranchCandidates(item?.value || '')
      if (normalizedActual.length > 0 && expectedValues.includes(normalizedActual)) {
        return {
          selectedHandle: `case:${caseId}`,
          actualValue,
          matchedCase: {
            id: caseId,
            label: String(item?.label || caseId).trim() || caseId,
            value: String(item?.value || '').trim(),
          }
        }
      }
    }

    return {
      selectedHandle: 'default',
      actualValue,
      matchedCase: null
    }
  }

  private renderContextTemplate(raw: unknown): string {
    const template = String(raw || '')
    if (!template) return ''

    return template.replace(/\{\{([\w.]+)\}\}/g, (_match, key) => {
      const value = this.resolveTemplateValue(this.context.data, key)
      if (value === undefined || value === null) return ''
      if (typeof value === 'string') return value
      if (typeof value === 'number' || typeof value === 'boolean') return String(value)
      try {
        return JSON.stringify(value)
      } catch {
        return String(value)
      }
    })
  }

  private parseWaTemplateComponents(node: FlowNode): unknown[] | undefined {
    const d = node.data || ({} as FlowNode['data'])
    if (Array.isArray(d.waTemplateComponents)) {
      return d.waTemplateComponents as unknown[]
    }
    if (typeof d.waTemplateComponentsJson === 'string' && d.waTemplateComponentsJson.trim()) {
      const parsed = JSON.parse(d.waTemplateComponentsJson) as unknown
      if (!Array.isArray(parsed)) {
        throw new Error('components JSON deve ser um array')
      }
      return parsed
    }
    return undefined
  }

  private async resolveWaTemplateComponents(
    integrationsId: string,
    templateName: string,
    languageCode: string,
    node: FlowNode
  ): Promise<unknown[] | undefined> {
    let components = this.parseWaTemplateComponents(node)

    if (!components || components.length === 0) {
      const storedTemplate = await getStoredTemplateByNameAndLanguage(integrationsId, templateName, languageCode)
      if (!storedTemplate) {
        throw new Error(
          'template nao encontrado no catalogo sincronizado. Sincronize os templates aprovados antes de salvar o bloco.'
        )
      }

      const exactComponents = buildExactTemplateSendComponentsFromCatalog(
        Array.isArray(storedTemplate.components_json) ? storedTemplate.components_json : []
      )
      if (exactComponents.missingRequirements.length > 0) {
        throw new Error(
          `nao foi possivel montar o template exato com os dados sincronizados. ${exactComponents.missingRequirements[0]}`
        )
      }
      components = exactComponents.components
    }

    return components
  }

  private normalizePhoneForWhatsApp(raw: unknown): string {
    const digits = String(raw || '').replace(/\D/g, '').trim()
    if (!digits) return ''
    if (digits.length < 10 || digits.length > 16) return ''
    return digits
  }

  private async upsertCampaignContact(contactSeed: string, phoneNumber: string): Promise<string> {
    const existing = await getContactByPhoneNumber(phoneNumber)
    if (!existing.success) {
      throw new Error(existing.error || 'Erro ao buscar contato WhatsApp existente')
    }

    if (existing.contact?.id) {
      if (existing.contact.status !== 'active' || String(existing.contact.phone_number || '').trim() !== phoneNumber) {
        const updated = await createOrUpdateContact({
          lid: existing.contact.lid,
          phone_number: phoneNumber,
          status: 'active'
        })
        if (!updated.success || !updated.contact?.id) {
          throw new Error(updated.error || 'Erro ao atualizar contato WhatsApp existente')
        }
        return updated.contact.id
      }
      return existing.contact.id
    }

    const created = await createOrUpdateContact({
      lid: contactSeed,
      phone_number: phoneNumber,
      status: 'active'
    })
    if (!created.success || !created.contact?.id) {
      throw new Error(created.error || 'Erro ao criar contato WhatsApp para campanha')
    }
    return created.contact.id
  }

  private async executeHubSpotWhatsAppCampaign(node: FlowNode): Promise<Record<string, unknown>> {
    const d = node.data || ({} as FlowNode['data'])
    const crmIntegrationId = String(d.crmIntegrationId || '').trim()
    const filterField = String(d.crmFilterField || 'tag').trim() || 'tag'
    const filterOperator = (String(d.crmFilterOperator || 'equals').trim() || 'equals') as NonNullable<
      FlowNode['data']['crmFilterOperator']
    >
    const filterValue = this.renderContextTemplate(d.crmFilterValue || '')
    const phoneField = String(d.crmPhoneField || 'phone').trim() || 'phone'
    const resultLimit = this.parsePositiveInt(d.crmResultLimit, 50, 200)

    if (!crmIntegrationId) {
      throw new Error('hubspot_whatsapp_campaign: crmIntegrationId obrigatorio')
    }
    if (!filterField || !filterValue) {
      throw new Error('hubspot_whatsapp_campaign: crmFilterField e crmFilterValue obrigatorios')
    }
    const properties = Array.from(
      new Set(['firstname', 'lastname', 'email', 'phone', filterField, phoneField].filter(Boolean))
    )
    const hubspotContacts = await searchHubSpotContacts(
      crmIntegrationId,
      resultLimit,
      undefined,
      properties,
      [{ field: filterField, operator: filterOperator, value: filterValue }]
    )

    const contactIds = new Set<string>()
    const sampleRecipients: Array<Record<string, unknown>> = []
    const audienceContacts: AudienceContact[] = []
    const skippedNoPhone: string[] = []
    const skippedInvalidPhone: string[] = []
    const skippedErrors: Array<{ hubspotContactId: string; error: string }> = []
    const skippedNoChannel: string[] = []
    let contactsWithPhone = 0

    for (const contact of hubspotContacts) {
      const contactId = String(contact?.id || '').trim()
      const normalizedAudienceContact = this.normalizeAudienceContact(
        crmIntegrationId,
        contact as Record<string, any>,
        filterField
      )
      audienceContacts.push(normalizedAudienceContact)

      if (!normalizedAudienceContact.email && !normalizedAudienceContact.phone && contactId) {
        skippedNoChannel.push(contactId)
      }

      const rawPhone =
        contact?.properties?.[phoneField] ||
        contact?.[phoneField] ||
        (phoneField !== 'phone' ? contact?.phone : '') ||
        contact?.properties?.phone ||
        ''

      if (!String(rawPhone || '').trim()) {
        if (contactId) skippedNoPhone.push(contactId)
        continue
      }

      contactsWithPhone++
      const normalizedPhone = this.normalizePhoneForWhatsApp(rawPhone)
      if (!normalizedPhone) {
        if (contactId) skippedInvalidPhone.push(contactId)
        continue
      }

      try {
        const localContactId = await this.upsertCampaignContact(`hubspot:${crmIntegrationId}:${contactId}`, normalizedPhone)
        contactIds.add(localContactId)
        if (sampleRecipients.length < 10) {
          sampleRecipients.push({
            hubspotContactId: contactId,
            phoneNumber: normalizedPhone,
            email: String(contact?.email || contact?.properties?.email || '').trim() || null,
            name:
              [String(contact?.firstname || contact?.properties?.firstname || '').trim(), String(contact?.lastname || contact?.properties?.lastname || '').trim()]
                .filter(Boolean)
                .join(' ') || null
          })
        }
      } catch (error: any) {
        skippedErrors.push({
          hubspotContactId: contactId,
          error: error?.message || 'Erro desconhecido ao preparar contato'
        })
      }
    }

    const uniqueContactIds = Array.from(contactIds)

    return {
      kind: 'hubspot_contacts' as const,
      crmIntegrationId,
      filter: {
        field: filterField,
        operator: filterOperator,
        value: filterValue
      },
      phoneField,
      resultLimit,
      matchedContacts: hubspotContacts.length,
      audience_source: 'hubspot',
      audience_count: audienceContacts.length,
      audience_contacts: audienceContacts,
      contactsWithPhone,
      contactsReadyForCampaign: uniqueContactIds.length,
      whatsapp_campaign_contact_ids: uniqueContactIds,
      skippedNoPhoneCount: skippedNoPhone.length,
      skippedInvalidPhoneCount: skippedInvalidPhone.length,
      skippedNoChannelCount: skippedNoChannel.length,
      skippedErrorCount: skippedErrors.length,
      skippedNoPhone: skippedNoPhone.slice(0, 20),
      skippedInvalidPhone: skippedInvalidPhone.slice(0, 20),
      skippedNoChannel: skippedNoChannel.slice(0, 20),
      skippedErrors: skippedErrors.slice(0, 20),
      sampleRecipients
    }
  }

  private safeCloneForDebug(value: unknown, depth: number, seen: WeakSet<object>): unknown {
    const maxDepth = 5
    const maxStr = 500
    if (depth > maxDepth) return '[MaxDepth]'
    if (value === null || value === undefined) return value
    if (typeof value === 'string') {
      return value.length > maxStr ? `${value.slice(0, maxStr)}…` : value
    }
    if (typeof value === 'number' || typeof value === 'boolean') return value
    if (typeof value === 'bigint') return value.toString()
    if (typeof value === 'function') return '[Function]'
    if (typeof value === 'symbol') return value.toString()
    if (value instanceof Date) return value.toISOString()
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) return '[Buffer]'
    if (Array.isArray(value)) {
      const maxItems = 50
      const arr = value.slice(0, maxItems).map((item) => this.safeCloneForDebug(item, depth + 1, seen))
      if (value.length > maxItems) arr.push(`… +${value.length - maxItems} itens`)
      return arr
    }
    if (typeof value === 'object') {
      if (seen.has(value as object)) return '[Circular]'
      seen.add(value as object)
      const out: Record<string, unknown> = {}
      const keys = Object.keys(value as Record<string, unknown>).slice(0, 80)
      for (const k of keys) {
        try {
          out[k] = this.safeCloneForDebug((value as Record<string, unknown>)[k], depth + 1, seen)
        } catch {
          out[k] = '[Erro ao serializar]'
        }
      }
      if (Object.keys(value as object).length > 80) {
        out['…'] = 'truncado'
      }
      return out
    }
    return String(value)
  }

  private buildDebugSnapshot(keysFilter: string[] | null): Record<string, unknown> {
    const data = this.context.data
    const seen = new WeakSet<object>()
    const keyList =
      keysFilter && keysFilter.length > 0 ? keysFilter : Object.keys(data)
    const out: Record<string, unknown> = {}
    for (const k of keyList) {
      if (keysFilter && keysFilter.length > 0 && !(k in data)) {
        out[k] = undefined
        continue
      }
      out[k] = this.safeCloneForDebug(data[k], 0, seen)
    }
    return out
  }

  private summarizeLastHistoryForDebug(): Record<string, unknown> | null {
    const h = this.context.executionHistory
    if (h.length === 0) return null
    const last = h[h.length - 1]
    let outputApproxBytes = 0
    const out = last.output
    if (out == null) outputApproxBytes = 0
    else if (typeof out === 'string') outputApproxBytes = out.length
    else {
      try {
        outputApproxBytes = JSON.stringify(out).length
      } catch {
        outputApproxBytes = -1
      }
    }
    return {
      nodeId: last.nodeId,
      success: last.success,
      nodeType: last.nodeType,
      outputApproxBytes,
      hasError: !!last.error
    }
  }

  /**
   * Executa o flow completo
   */
  async execute(): Promise<FlowExecutionContext> {
    try {
      logger.info(`[FlowExecutor] Iniciando execução do flow ${this.context.flowId}`)
      logger.log(`[FlowExecutor] Flow data:`, {
        startNodeId: this.flowData.startNodeId,
        nodesCount: this.flowData.nodes.length,
        edgesCount: this.flowData.edges.length,
        nodes: this.flowData.nodes.map(n => ({ id: n.id, label: n.data.label })),
        edges: this.flowData.edges.map(e => `${e.source} -> ${e.target}`)
      })
      
      // Valida o flow
      this.validateFlow()
      
      // Encontra o node inicial
      const startNode = this.findStartNode()
      if (!startNode) {
        throw new Error('Node inicial não encontrado')
      }

      logger.info(`[FlowExecutor] Node inicial encontrado: ${startNode.id} (${startNode.data.label})`)

      // Executa a partir do node inicial
      await this.executeNode(startNode.id)

      logger.info(`[FlowExecutor] Flow executado com sucesso. Nodes executados: ${this.executedNodes.size}`)
      if ((this.context.data as Record<string, unknown>).__flow_paused_for_schedule) {
        return this.context
      }
      
      // ✅ Salvar log de execução completa com sucesso (necessário para KPIs)
      // Usa level 'info' para não poluir a tela de erros, mas salva para analytics
      await this.saveWorkflowExecutionCompleted(true)
      
      return this.context
    } catch (error: any) {
      logger.error(`[FlowExecutor] Erro ao executar flow: ${error.message}`, error)
      
      // ✅ Salvar log de erro na execução
      await this.saveWorkflowExecutionCompleted(false, error.message)
      
      throw error
    }
  }

  /**
   * Valida a estrutura do flow
   */
  private validateFlow(): void {
    if (!this.flowData.nodes || this.flowData.nodes.length === 0) {
      throw new Error('Flow não possui nodes')
    }

    if (!this.flowData.startNodeId) {
      throw new Error('Flow não possui startNodeId definido')
    }

    const nodeIds = new Set(this.flowData.nodes.map(n => n.id))
    if (!nodeIds.has(this.flowData.startNodeId)) {
      throw new Error(`startNodeId '${this.flowData.startNodeId}' não corresponde a nenhum node`)
    }

    // Valida que todas as edges referenciam nodes existentes
    for (const edge of this.flowData.edges) {
      if (!nodeIds.has(edge.source)) {
        throw new Error(`Edge inválida: source node '${edge.source}' não existe`)
      }
      if (!nodeIds.has(edge.target)) {
        throw new Error(`Edge inválida: target node '${edge.target}' não existe`)
      }
    }
  }

  /**
   * Encontra o node inicial
   */
  private findStartNode(): FlowNode | null {
    const resumeFromNodeId = String(this.context.data.__resume_from_node_id || '').trim()
    if (resumeFromNodeId) {
      return this.flowData.nodes.find((node) => node.id === resumeFromNodeId) || null
    }
    return this.flowData.nodes.find(n => n.id === this.flowData.startNodeId) || null
  }

  /**
   * Executa um node específico e seus sucessores
   */
  private async executeNode(nodeId: string): Promise<void> {
    // Evita execução duplicada
    if (this.executedNodes.has(nodeId)) {
      logger.warn(`[FlowExecutor] Node ${nodeId} já foi executado, pulando...`)
      return
    }

    const node = this.flowData.nodes.find(n => n.id === nodeId)
    if (!node) {
      throw new Error(`Node ${nodeId} não encontrado`)
    }

    logger.info(`[FlowExecutor] nodeId=${nodeId} type=${node.type} label=${node.data.label}`)

    const nodeStartedAt = new Date().toISOString()
    let preparedAgentMessage: string | undefined

    try {
      let processedResult: any = null
      let shouldContinue = true
      let skipContextUpdate = false
      let ifElseBranch: boolean | undefined
      let selectedBranchHandle: string | undefined
      let agentHistoryInput: unknown
      let agentOutputSummary: string | undefined
      let pauseExecutionAtIso: string | undefined
      let pauseTimezone: string | undefined
      let pauseReason: 'delay' | 'schedule' | undefined
      let integrationToolSummary: Record<string, unknown> | undefined

      const runAgentBranch = async () => {
        const integrationToolResult = await this.executeOptionalIntegrationAction(node)
        if (integrationToolResult) {
          integrationToolSummary = {
            provider: integrationToolResult.provider,
            toolName: integrationToolResult.toolName,
            status: integrationToolResult.status,
            success: integrationToolResult.success,
          }
        }
        preparedAgentMessage = this.prepareNodeInput(node)
        agentHistoryInput = {
          integrationTool: integrationToolSummary,
          messagePreview: safeLogPreview(preparedAgentMessage),
          messageLength: preparedAgentMessage.length
        }
        const result = await this.executeAgent(node, preparedAgentMessage)
        processedResult = result
        if (typeof result === 'string') {
          try {
            processedResult = JSON.parse(result)
            logger.log(`[FlowExecutor] Resultado do node ${nodeId} parseado como JSON`)

            if (processedResult.action === 'read_whatsapp_db' && processedResult.messages) {
              if (processedResult.messages.length === 1) {
                processedResult = processedResult.messages[0]
                logger.log(`[FlowExecutor] Extraída 1 mensagem do read_whatsapp_db para o próximo node`)
              } else if (processedResult.messages.length > 1) {
                processedResult = {
                  messages: processedResult.messages
                }
                logger.log(`[FlowExecutor] Extraídas ${processedResult.messages.length} mensagens do read_whatsapp_db`)
              } else {
                processedResult = { messages: [] }
                logger.log(`[FlowExecutor] Nenhuma mensagem encontrada no read_whatsapp_db`)
              }
            }
          } catch (e) {
            processedResult = this.parseStructuredTextOutput(result) || result
            logger.log(`[FlowExecutor] Resultado do node ${nodeId} mantido como texto estruturado/string`)
          }
        }
        agentOutputSummary = this.formatAgentOutput(processedResult)
        logger.info(
          `[FlowExecutor] nodeId=${nodeId} type=${node.type} outputSummary="${(agentOutputSummary || '').slice(0, 120)}"`
        )
      }

      switch (node.type) {
        case 'start':
          logger.info(
            `[FlowExecutor] nodeId=${nodeId} type=start flowId=${this.context.flowId} executionId=${this.context.executionId ?? 'n/a'} contextDataKeys=${Object.keys(this.context.data).length}`
          )
          processedResult = { started: true, contextDataKeyCount: Object.keys(this.context.data).length }
          break

        case 'stop': {
          const stopScope = this.resolveStopScope(node)
          const continuationNodes = this.getNextNodes(nodeId)
          const hasContinuation = continuationNodes.length > 0

          if (stopScope === 'step' && hasContinuation) {
            logger.info(
              `[FlowExecutor] stop nodeId=${nodeId} scope=step continuaPara=${continuationNodes.map((n) => n.id).join(',')}`
            )
            processedResult = {
              stopped: false,
              stop_scope: 'step',
              stop_action: 'continue_branch',
              continuation_node_ids: continuationNodes.map((nextNode) => nextNode.id)
            }
            break
          }

          if (stopScope === 'subflow' || (this.isSubflowRuntime() && stopScope !== 'flow')) {
            logger.info(
              `[FlowExecutor] stop nodeId=${nodeId} scope=subflow retornaAoFluxoPai label=${node.data.label ?? ''}`
            )
            processedResult = {
              stopped: true,
              stop_scope: 'subflow',
              stop_action: 'return_to_parent'
            }
            shouldContinue = false
            break
          }

          if (hasContinuation) {
            logger.info(
              `[FlowExecutor] stop nodeId=${nodeId} scope=${stopScope} segueFluxograma continuaPara=${continuationNodes.map((n) => n.id).join(',')}`
            )
            processedResult = {
              stopped: false,
              stop_scope: stopScope,
              stop_action: 'continue_branch',
              continuation_node_ids: continuationNodes.map((nextNode) => nextNode.id)
            }
            break
          }

          logger.info(
            `[FlowExecutor] stop nodeId=${nodeId} scope=flow encerraFluxo label=${node.data.label ?? ''}`
          )
          processedResult = {
            stopped: true,
            stop_scope: 'flow',
            stop_action: 'end_flow'
          }
          shouldContinue = false
          break
        }

        case 'delay': {
          const delaySec = this.normalizeDelaySeconds(node.data.duration)
          logger.info(`[FlowExecutor] nodeId=${nodeId} type=delay begin durationSec=${delaySec}`)
          if (this.isLiveExecution() && delaySec > 0) {
            pauseExecutionAtIso = new Date(Date.now() + delaySec * 1000).toISOString()
            pauseReason = 'delay'
            shouldContinue = false
            processedResult = {
              kind: 'delay' as const,
              delayed: delaySec,
              durationMs: delaySec * 1000,
              scheduledAt: pauseExecutionAtIso,
              paused: true
            }
            break
          }
          if (delaySec > 0) {
            await new Promise((resolve) => setTimeout(resolve, delaySec * 1000))
          }
          logger.info(`[FlowExecutor] nodeId=${nodeId} type=delay end durationMs=${delaySec * 1000}`)
          processedResult = { kind: 'delay' as const, delayed: delaySec, durationMs: delaySec * 1000 }
          break
        }

        case 'schedule': {
          const rawScheduleAt = this.renderContextTemplate(node.data.scheduleAt || '').trim()
          if (!rawScheduleAt) {
            throw new Error('schedule: scheduleAt obrigatorio')
          }

          const resolvedSchedule = await resolveScheduledAtToUtcIso({
            rawValue: rawScheduleAt,
            preferredTimezone: String(node.data.scheduleTimezone || '').trim() || undefined,
            userId: this.context.userId,
            userEmail: this.context.userEmail
          })

          if (this.isLiveExecution()) {
            pauseExecutionAtIso = resolvedSchedule.scheduledAtIso
            pauseTimezone = resolvedSchedule.timezone
            pauseReason = 'schedule'
            shouldContinue = false
            processedResult = {
              kind: 'schedule' as const,
              scheduleAt: rawScheduleAt,
              scheduledAt: resolvedSchedule.scheduledAtIso,
              timezone: resolvedSchedule.timezone,
              paused: true
            }
            break
          }

          processedResult = {
            kind: 'schedule' as const,
            scheduleAt: rawScheduleAt,
            scheduledAt: resolvedSchedule.scheduledAtIso,
            timezone: resolvedSchedule.timezone,
            simulated: true
          }
          break
        }

        case 'if-else': {
          const branchResult = this.evaluateSimpleBranch(node)
          ifElseBranch = branchResult.matched
          selectedBranchHandle = ifElseBranch ? 'true' : 'false'
          processedResult = {
            kind: 'simple_branch' as const,
            condition: node.data.condition || '',
            branchField: node.data.branchField || 'message',
            actualValue: branchResult.actualValue,
            expectedValues: branchResult.expectedValues,
            conditionResult: ifElseBranch,
            branch: selectedBranchHandle
          }
          logger.info(
            `[FlowExecutor] nodeId=${nodeId} type=if-else actual=${JSON.stringify(branchResult.actualValue)} result=${ifElseBranch} branch=${processedResult.branch}`
          )
          break
        }

        case 'switch': {
          const switchResult = this.evaluateSwitchBranch(node)
          selectedBranchHandle = switchResult.selectedHandle
          processedResult = {
            kind: 'switch' as const,
            branchField: node.data.branchField || 'message',
            actualValue: switchResult.actualValue,
            matchedCase: switchResult.matchedCase,
            selectedHandle: selectedBranchHandle,
            defaultLabel: node.data.switchDefaultLabel || 'Outros'
          }
          logger.info(
            `[FlowExecutor] nodeId=${nodeId} type=switch actual=${JSON.stringify(switchResult.actualValue)} handle=${selectedBranchHandle}`
          )
          break
        }

        case 'loop':
          await this.executeLoop(node)
          processedResult = { loopCompleted: true }
          shouldContinue = false
          break

        case 'subflow':
          processedResult = await this.executeSubflow(node)
          if (processedResult?.subflow_status === 'paused') {
            shouldContinue = false
          }
          logger.info(
            `[FlowExecutor] subflow nodeId=${nodeId} subflowId=${processedResult.subflow_id || 'n/a'} status=${processedResult.subflow_status}`
          )
          break

        case 'comment':
          logger.log(
            `[FlowExecutor] Node de comentário encontrado: "${node.data?.comment || 'sem comentário'}"`
          )
          skipContextUpdate = true
          processedResult = {
            kind: 'comment' as const,
            comment: node.data?.comment || '',
            label: node.data?.label || ''
          }
          break

        case 'debug': {
          skipContextUpdate = true
          const keysFilter = this.parseDebugKeys(node.data.debugKeys)
          agentHistoryInput = { keysRequested: keysFilter ?? 'all' }
          const predecessorSummary = this.summarizeLastHistoryForDebug()
          const snapshot = this.buildDebugSnapshot(keysFilter)
          const at = new Date().toISOString()
          processedResult = {
            kind: 'debug' as const,
            at,
            snapshot,
            predecessorSummary,
            message: node.data.debugMessage || undefined,
            label: node.data.label
          }
          let snapSize = 0
          try {
            snapSize = JSON.stringify(snapshot).length
          } catch {
            snapSize = -1
          }
          logger.info(
            `[FlowExecutor][debug] nodeId=${nodeId} keys=${keysFilter ? keysFilter.join(',') : 'all'} snapshotBytes≈${snapSize}`
          )
          break
        }

        case 'wa_session_window': {
          const d = node.data || ({} as FlowNode['data'])
          const integrationsId = String(
            d.waIntegrationId || this.context.data.integrations_id || this.context.data.integration_id || ''
          ).trim()
          const contactId = String(this.context.data.whatsapp_contact_id || '').trim()
          if (!integrationsId || !contactId) {
            logger.warn('[FlowExecutor] wa_session_window sem integrations_id ou whatsapp_contact_id', {
              nodeId
            })
            ifElseBranch = false
            processedResult = {
              kind: 'wa_session_window' as const,
              error: 'missing_integration_or_contact',
              insideWindow: false,
              conservativeUnknown: true
            }
            this.context.data.wa_session_inside_window = false
            this.context.data.wa_session_conservative_unknown = true
            break
          }
          const state = await getCustomerCareWindowState(integrationsId, contactId)
          ifElseBranch = state.insideWindow === true
          processedResult = {
            kind: 'wa_session_window' as const,
            insideWindow: state.insideWindow,
            conservativeUnknown: state.conservativeUnknown,
            expiresAt: state.expiresAt ? state.expiresAt.toISOString() : null,
            lastInboundAt: state.lastInboundAt
          }
          this.context.data.wa_session_inside_window = ifElseBranch
          this.context.data.wa_session_conservative_unknown = state.conservativeUnknown
          logger.info(
            `[FlowExecutor] wa_session_window nodeId=${nodeId} insideWindow=${state.insideWindow} conservativeUnknown=${state.conservativeUnknown}`
          )
          break
        }

        case 'wa_template': {
          const d = node.data || ({} as FlowNode['data'])
          const integrationsId = String(d.waIntegrationId || this.context.data.integrations_id || '').trim()
          const batchContactIds = Array.isArray(this.context.data.whatsapp_campaign_contact_ids)
            ? (this.context.data.whatsapp_campaign_contact_ids as unknown[])
                .map((value) => String(value || '').trim())
                .filter((value) => value.length > 0)
            : []
          const to = String(this.context.data.whatsapp_contact_id || this.context.data.phone_number || '').trim()
          const templateName = String(d.waTemplateName || '').trim()
          const languageCode = String(d.waTemplateLanguage || 'pt_BR').trim()

          if (!integrationsId || !templateName || (batchContactIds.length === 0 && !to)) {
            throw new Error(
              'wa_template: integrations_id (ou waIntegrationId no no), template e destino (ou lista preparada pelo HubSpot) sao obrigatorios'
            )
          }

          const components = await this.resolveWaTemplateComponents(integrationsId, templateName, languageCode, node)

          const agentFromCtx = this.context.data.agent_id || this.context.data.agentId
          const agentId =
            agentFromCtx != null && String(agentFromCtx).trim() !== '' ? String(agentFromCtx).trim() : undefined

          if (batchContactIds.length > 0) {
            if (!this.isLiveExecution()) {
              processedResult = {
                kind: 'wa_template_campaign' as const,
                waMetaTemplateSent: false,
                templateName,
                languageCode,
                campaignContacts: batchContactIds.length,
                enqueuedContacts: 0,
                simulated: true
              }
              logger.info(
                `[FlowExecutor] wa_template em lote simulado nodeId=${nodeId} template=${templateName} contacts=${batchContactIds.length}`
              )
              break
            }

            const fallbackCampaignName = `${String(node.data.label || 'Fluxo').trim() || 'Fluxo'} -> ${templateName}`
            const created = await createCampaignRecord({
              integrationId: integrationsId,
              companiesId: this.context.companiesId || null,
              name: fallbackCampaignName,
              templateName,
              templateLanguage: languageCode,
              components
            })

            if ('error' in created) {
              throw new Error(created.error)
            }

            const enqueueResult = await enqueueCampaignContacts({
              campaignId: created.id,
              integrationId: integrationsId,
              contactIds: batchContactIds,
              rateLimitPerMinute: this.parsePositiveInt(node.data.waRateLimitPerMinute, 30, 120)
            })

            if (enqueueResult.error) {
              throw new Error(enqueueResult.error)
            }

            processedResult = {
              kind: 'wa_template_campaign' as const,
              waMetaTemplateSent: enqueueResult.inserted > 0,
              templateName,
              languageCode,
              campaignId: created.id,
              campaignContacts: batchContactIds.length,
              enqueuedContacts: enqueueResult.inserted
            }

            logger.info(
              `[FlowExecutor] wa_template em lote nodeId=${nodeId} template=${templateName} enqueued=${enqueueResult.inserted}`
            )
            break
          }

          const sendRes = await sendWhatsAppTemplate(integrationsId, {
            to,
            templateName,
            languageCode,
            components,
            agentId,
            context: {
              automation_source: 'flow',
              flow_id: this.context.flowId,
              flow_execution_id: this.context.executionId
            }
          })

          processedResult = {
            kind: 'wa_template' as const,
            waMetaTemplateSent: !!sendRes.success,
            waTemplateMessageId: sendRes.messageId,
            templateName,
            languageCode,
            error: sendRes.error
          }

          if (!sendRes.success) {
            throw new Error(sendRes.error || 'Falha ao enviar template WhatsApp Meta')
          }

          ;(this.context.data as Record<string, unknown>).__flow_meta_outbound_already_sent = true
          logger.info(`[FlowExecutor] wa_template enviado nodeId=${nodeId} template=${templateName}`)
          break
        }

        case 'hubspot_whatsapp_campaign': {
          processedResult = await this.executeHubSpotWhatsAppCampaign(node)
          logger.info(
            `[FlowExecutor] hubspot_whatsapp_campaign nodeId=${nodeId} matched=${processedResult.matchedContacts} prepared=${processedResult.contactsReadyForCampaign}`
          )
          break
        }

        case 'crm_contact': {
          processedResult = await executeCrmContactNode({
            node,
            contextData: this.context.data,
          })
          logger.info(
            `[FlowExecutor] crm_contact nodeId=${nodeId} operation=${node.data.crmOperation || 'lookup'} status=${processedResult.status}`
          )
          break
        }

        case 'appointment': {
          processedResult = await executeAppointmentNode({
            node,
            contextData: this.context.data,
          })
          logger.info(
            `[FlowExecutor] appointment nodeId=${nodeId} operation=${node.data.appointmentOperation || 'availability'} status=${processedResult.status}`
          )
          break
        }

        case 'document_intake': {
          processedResult = await executeDocumentIntakeNode({
            node,
            contextData: this.context.data,
          })
          logger.info(
            `[FlowExecutor] document_intake nodeId=${nodeId} status=${processedResult.status}`
          )
          break
        }

        case 'human_handoff': {
          processedResult = await executeHumanHandoffNode({
            node,
            contextData: this.context.data,
            userEmail: this.context.userEmail,
            companiesId: this.context.companiesId,
            flowId: this.context.flowId,
            executionId: this.context.executionId,
          })
          logger.info(
            `[FlowExecutor] human_handoff nodeId=${nodeId} status=${processedResult.status}`
          )
          break
        }

        case 'whatsapp_message': {
          const d = node.data || ({} as FlowNode['data'])
          const integrationToolResult = await this.executeOptionalIntegrationAction(node)
          const integrationsId = String(
            d.waIntegrationId || this.context.data.integrations_id || this.context.data.integration_id || ''
          ).trim()
          const to = String(this.context.data.whatsapp_contact_id || this.context.data.phone_number || '').trim()
          const messageType = (String(d.waMessageType || 'text').trim() || 'text') as
            | 'text'
            | 'buttons'
            | 'link'
            | 'reminder'
          const messageText = this.renderContextTemplate(d.waMessageText || '').trim()
          const buttons = Array.isArray(d.waButtons)
            ? (d.waButtons as Array<{ id?: string; text: string }>)
                .map((button) => ({
                  ...button,
                  text: this.renderContextTemplate(button?.text || '').trim(),
                }))
                .filter((button) => String(button?.text || '').trim())
            : []

          if (!integrationsId || !to || !messageText) {
            throw new Error(
              'whatsapp_message: integrations_id, destino (whatsapp_contact_id) e waMessageText sao obrigatorios'
            )
          }

          const agentFromCtx = this.context.data.agent_id || this.context.data.agentId
          const agentId =
            agentFromCtx != null && String(agentFromCtx).trim() !== '' ? String(agentFromCtx).trim() : undefined

          const sendRes = await sendFlowWhatsAppMessage({
            integrationsId,
            to,
            flowId: this.context.flowId,
            flowExecutionId: this.context.executionId,
            agentId,
            requestStartedAt: String(this.context.data.request_started_at || '').trim() || undefined,
            nodeId,
            label: String(d.label || '').trim() || undefined,
            windowMode: d.waWindowMode === 'auto_template' ? 'auto_template' : 'session_only',
            messageType,
            messageText,
            buttons,
            linkUrl: this.renderContextTemplate(d.waLinkUrl || '').trim() || undefined,
            reminderAt: this.renderContextTemplate(d.waReminderAt || '').trim() || undefined,
            fallbackTemplateName: String(d.waFallbackTemplateName || '').trim() || undefined,
            fallbackTemplateLanguage: String(d.waFallbackTemplateLanguage || '').trim() || undefined
          })

          processedResult = {
            kind: 'whatsapp_message' as const,
            integrationToolStatus: integrationToolResult?.status || null,
            sendMode: sendRes.sendMode || null,
            messageType,
            messageText,
            templateName: sendRes.templateName || null,
            languageCode: sendRes.languageCode || null,
            userMessage: sendRes.userMessage || null,
            error: sendRes.error
          }

          if (!sendRes.success) {
            throw new Error(sendRes.userMessage || sendRes.error || 'Falha ao enviar mensagem WhatsApp')
          }

          ;(this.context.data as Record<string, unknown>).__flow_whatsapp_outbound_already_sent = true
          logger.info(
            `[FlowExecutor] whatsapp_message enviado nodeId=${nodeId} mode=${sendRes.sendMode || 'unknown'}`
          )
          break
        }

        case 'email_send': {
          const d = node.data || ({} as FlowNode['data'])
          const emailIntegrationId = String(
            d.emailIntegrationId ||
              this.context.data.email_integration_id ||
              this.context.data.emailIntegrationId ||
              ''
          ).trim()
          const audienceContacts = Array.isArray(this.context.data.audience_contacts)
            ? (this.context.data.audience_contacts as AudienceContact[])
            : []
          const to = this.renderContextTemplate(
            d.emailTo ||
              this.context.data.recipient_email ||
              this.context.data.contact_email ||
              this.context.data.lead_email ||
              this.context.data.email ||
              ''
          ).trim()
          const subject = this.renderContextTemplate(d.emailSubject || '').trim()
          const text = this.renderContextTemplate(d.emailText || '').trim()

          if (!emailIntegrationId || !subject || !text) {
            throw new Error(
              'email_send: emailIntegrationId, assunto e corpo sao obrigatorios'
            )
          }

          if (audienceContacts.length > 0) {
            if (!this.isLiveExecution()) {
              processedResult = {
                kind: 'email_send_audience' as const,
                integrationId: emailIntegrationId,
                audienceCount: audienceContacts.length,
                enqueuedContacts: 0,
                skippedWithoutEmail: audienceContacts.filter((contact) => !String(contact.email || '').trim()).length,
                simulated: true,
                message: 'Envio de audiencia simulado no modo teste.'
              }
              break
            }

            const enqueueResult = await enqueueEmailAudienceJobs({
              emailIntegrationId,
              audienceContacts,
              subjectTemplate: String(d.emailSubject || ''),
              textTemplate: String(d.emailText || ''),
              flowId: this.context.flowId,
              executionId: this.context.executionId,
              companiesId: this.context.companiesId || null
            })

            processedResult = {
              kind: 'email_send_audience' as const,
              integrationId: emailIntegrationId,
              audienceCount: audienceContacts.length,
              enqueuedContacts: enqueueResult.inserted,
              skippedWithoutEmail: enqueueResult.skippedWithoutEmail,
              message: 'Emails enfileirados com sucesso.'
            }
            break
          }

          if (!to) {
            throw new Error(
              'email_send: destinatario obrigatorio no modo individual'
            )
          }

          const sendRes = await sendEmail(emailIntegrationId, {
            to,
            subject,
            text,
          })

          processedResult = {
            kind: 'email_send' as const,
            integrationId: emailIntegrationId,
            to,
            subject,
            provider: sendRes.provider,
            message: 'Email enviado com sucesso.',
          }

          logger.info(
            `[FlowExecutor] email_send enviado nodeId=${nodeId} integrationId=${emailIntegrationId} to=${to}`
          )
          break
        }

        case 'email_read': {
          const d = node.data || ({} as FlowNode['data'])
          const emailIntegrationId = String(
            d.emailIntegrationId ||
              this.context.data.email_integration_id ||
              this.context.data.emailIntegrationId ||
              ''
          ).trim()
          const limitRaw =
            typeof d.emailReadLimit === 'number'
              ? d.emailReadLimit
              : parseInt(String(d.emailReadLimit || '5'), 10)
          const limit = Number.isFinite(limitRaw)
            ? Math.min(Math.max(Number(limitRaw) || 5, 1), 20)
            : 5

          if (!emailIntegrationId) {
            throw new Error('email_read: emailIntegrationId e obrigatorio')
          }

          const messages = await readInboxMessages(emailIntegrationId, limit)
          processedResult = {
            kind: 'email_read' as const,
            integrationId: emailIntegrationId,
            total: messages.length,
            messages,
          }

          logger.info(
            `[FlowExecutor] email_read executado nodeId=${nodeId} integrationId=${emailIntegrationId} total=${messages.length}`
          )
          break
        }

        case 'agent':
          await runAgentBranch()
          break

        default:
          await runAgentBranch()
          break
      }

      this.executedNodes.add(nodeId)
      this.appendExecutionHistory(node, nodeStartedAt, {
        success: true,
        output: processedResult,
        input: agentHistoryInput,
        outputSummary: agentOutputSummary
      })

      if (!skipContextUpdate) {
        this.updateContextWithOutput(nodeId, processedResult)
        if (node.type === 'agent') {
          this.syncPatientProfileFromContext()
        }
      } else if (node.type === 'comment') {
        this.updateContextWithOutput(nodeId, { comment: (processedResult as { comment?: string }).comment ?? '' })
      }

      if (!shouldContinue && node.type === 'stop') {
        const stopOutput = processedResult as { stop_action?: string }
        if (stopOutput?.stop_action === 'return_to_parent' || stopOutput?.stop_action === 'end_flow') {
          logger.info(`[FlowExecutor] Execução interrompida pelo node de parada action=${stopOutput.stop_action}`)
          return
        }
      }

      if (!shouldContinue && node.type === 'loop') {
        logger.info(`[FlowExecutor] Loop completado, continuando para próximos nodes`)
      }

      if (!shouldContinue && node.type === 'subflow') {
        logger.info(`[FlowExecutor] Subfluxo pausado aguardando resposta do usuario`)
        return
      }

      const nextNodes = this.getNextNodes(
        nodeId,
        node.type === 'switch'
          ? selectedBranchHandle
          : node.type === 'if-else' || node.type === 'wa_session_window'
            ? (ifElseBranch ? 'true' : 'false')
            : undefined
      )
      logger.info(`[FlowExecutor] Node ${nodeId} executado. Próximos nodes encontrados: ${nextNodes.length}`)

      const userReplyPause = this.shouldPauseForUserReply(node, nextNodes)
      if (userReplyPause.pause) {
        this.pauseForUserReply(node, userReplyPause.reason || 'awaiting_user_reply', {
          resumeNodeId: userReplyPause.resumeNodeId,
          waitingNodeId: userReplyPause.waitingNodeId
        })
        return
      }

      if (nextNodes.length === 0) {
        logger.log(
          `[FlowExecutor] Nenhum próximo node encontrado para ${nodeId}. Edges disponíveis:`,
          this.flowData.edges.map((e) => `${e.source} -> ${e.target}`)
        )
      } else {
        logger.log(
          `[FlowExecutor] Executando próximos nodes:`,
          nextNodes.map((n) => `${n.id} (${n.data.label})`)
        )
      }

      if (pauseExecutionAtIso && pauseReason) {
        const nextNodeIds = nextNodes.map((nextNode) => nextNode.id)
        if (nextNodeIds.length > 0) {
          const inserted = await enqueueFlowResumeJobs({
            flowId: this.context.flowId,
            userEmail: this.context.userEmail,
            userId: this.context.userId,
            companiesId: this.context.companiesId || null,
            executionId: this.context.executionId,
            resumeNodeIds: nextNodeIds,
            scheduledAtIso: pauseExecutionAtIso,
            timezone: pauseTimezone,
            contextData: this.context.data,
            executionHistory: this.context.executionHistory,
            triggerSource: pauseReason
          })
          logger.info(
            `[FlowExecutor] Fluxo pausado nodeId=${nodeId} reason=${pauseReason} jobs=${inserted.inserted} scheduledAt=${pauseExecutionAtIso}`
          )
        }

        ;(this.context.data as Record<string, unknown>).__flow_paused_for_schedule = true
        ;(this.context.data as Record<string, unknown>).__flow_paused_until = pauseExecutionAtIso
        ;(this.context.data as Record<string, unknown>).__flow_pause_timezone = pauseTimezone || null
        return
      }

      for (const nextNode of nextNodes) {
        await this.executeNode(nextNode.id)
      }
    } catch (error: any) {
      logger.error(`[FlowExecutor] Erro ao executar node ${nodeId} (tipo: ${node.type}): ${error.message}`, error)

      const executionRef = this.getNodeExecutionRef(node)
      await this.saveWorkflowNodeLog(
        nodeId,
        executionRef.agentId,
        false,
        null,
        error.message,
        executionRef.templateId
      )

      let failInput: unknown = undefined
      if (preparedAgentMessage !== undefined) {
        failInput = {
          messagePreview: safeLogPreview(preparedAgentMessage),
          messageLength: preparedAgentMessage.length
        }
      } else if (node.type === 'if-else') {
        failInput = {
          branchField: node.data.branchField || 'message',
          ifValue: node.data.ifValue || '',
        }
      } else if (node.type === 'switch') {
        failInput = {
          branchField: node.data.branchField || 'message',
          switchCases: node.data.switchCases || [],
        }
      } else if (node.type === 'delay') {
        failInput = { duration: node.data.duration }
      } else if (node.type === 'loop') {
        failInput = {
          flowId: node.data.flowId,
          iterations: node.data.iterations,
          infinite: node.data.infinite
        }
      } else if (node.type === 'subflow') {
        failInput = {
          subflowId: node.data.subflowId || node.data.flowId,
          subflowName: node.data.subflowName || node.data.flowName,
          resultKey: node.data.subflowResultKey || 'subflow_result'
        }
      }

      this.appendExecutionHistory(node, nodeStartedAt, {
        success: false,
        error: error.message,
        input: failInput,
        output: { failedNodeType: node.type }
      })

      throw error
    }
  }

  /**
   * Prepara o input para um node baseado no contexto e dados dos nodes anteriores
   * O Flow orquestra e prepara os dados para cada agente
   */
  private prepareNodeInput(node: FlowNode): string {
    // Coleta todos os dados disponíveis (iniciais + predecessores)
    const allData = {
      ...this.context.data,
      ...this.collectPredecessorData(node.id)
    }

    // Se é o node inicial, usa dados iniciais do contexto
    if (node.id === this.flowData.startNodeId) {
      // Formata mensagem clara para o agente
      const dataSummary = Object.keys(allData).length > 0 
        ? `\n\nDados disponíveis:\n${JSON.stringify(allData, null, 2)}`
        : ''
      
      return `Execute sua tarefa como agente "${node.data.label}".${dataSummary}`
    }

    // Para nodes subsequentes, coleta dados dos nodes predecessores
    const predecessorData = this.collectPredecessorData(node.id)
    const predecessorSummary = Object.keys(predecessorData).length > 0
      ? `\n\nDados recebidos dos nodes anteriores:\n${JSON.stringify(predecessorData, null, 2)}`
      : ''
    
    const contextSummary = Object.keys(this.context.data).length > 0
      ? `\n\nContexto global:\n${JSON.stringify(this.context.data, null, 2)}`
      : ''

    const finalMessage = `Execute sua tarefa como agente "${node.data.label}".${predecessorSummary}${contextSummary}`
    
    logger.log(`[FlowExecutor] Input preparado para node ${node.id}:`, {
      predecessorDataKeys: Object.keys(predecessorData),
      contextDataKeys: Object.keys(this.context.data),
      messageLength: finalMessage.length,
      messagePreview: safeLogPreview(finalMessage)
    })

    return finalMessage
  }

  /**
   * Coleta dados dos nodes predecessores (que apontam para este node)
   */
  private collectPredecessorData(nodeId: string): Record<string, any> {
    const predecessorData: Record<string, any> = {}

    // Encontra edges que apontam para este node
    const incomingEdges = this.flowData.edges.filter(e => e.target === nodeId)
    
    for (const edge of incomingEdges) {
      const predecessorNode = this.flowData.nodes.find(n => n.id === edge.source)
      if (predecessorNode && this.executedNodes.has(edge.source)) {
        // Busca o resultado do node predecessor no histórico
        const predecessorResult = this.context.executionHistory.find(
          h => h.nodeId === edge.source
        )
        
        if (predecessorResult?.output) {
          // Adiciona os dados do predecessor com prefixo do nodeId para evitar conflitos
          predecessorData[`${predecessorNode.id}_output`] = predecessorResult.output
          // Também mescla diretamente se for um objeto
          if (typeof predecessorResult.output === 'object') {
            Object.assign(predecessorData, predecessorResult.output)
          }
        }
      }
    }

    return predecessorData
  }

  /**
   * Executa o agente do node
   * O Flow orquestra e chama o agente com os dados preparados
   */
  private async executeAgent(node: FlowNode, input: string): Promise<any> {
    const executionMode = this.resolveNodeExecutionMode(node)

    if (executionMode === 'template') {
      return this.executeTemplateNode(node, input)
    }

    return this.executeAgentLegacy(node, input)
  }

  private async executeTemplateNode(node: FlowNode, input: string): Promise<any> {
    try {
      if (!node.data.templateId) {
        throw new Error(`Template ID não encontrado no node ${node.id}`)
      }

      const allContext = {
        ...this.context.data,
        ...this.collectPredecessorData(node.id)
      }

      if (!allContext.originalMessage && !allContext.userMessage) {
        if (!input.includes('Execute sua tarefa como agente') && !input.includes('Dados recebidos dos nodes anteriores')) {
          allContext.originalMessage = input
          allContext.userMessage = input
        } else if (this.context.data.message || this.context.data.originalMessage || this.context.data.userMessage) {
          allContext.originalMessage = this.context.data.originalMessage || this.context.data.userMessage || this.context.data.message
          allContext.userMessage = this.context.data.originalMessage || this.context.data.userMessage || this.context.data.message
        }
      }

      logger.info(`[FlowExecutor] Executando template ${node.data.templateId} (${node.data.templateName || node.data.label}) no node ${node.id}`)
      logger.log(`[FlowExecutor] Contexto do template ${node.id}:`, {
        contextKeys: Object.keys(allContext),
        hasAdditionalInstructions: !!node.data.additionalInstructions
      })

      const templateNodePrimaryLanguage =
        typeof (node.data as Record<string, unknown>).primaryLanguage === 'string' &&
        String((node.data as Record<string, unknown>).primaryLanguage).trim()
          ? String((node.data as Record<string, unknown>).primaryLanguage).trim()
          : undefined

      const result = await executeFlowTemplateNode({
        userEmail: this.context.userEmail,
        templateId: node.data.templateId,
        agentId:
          typeof (node.data as Record<string, unknown>).agentId === 'string' &&
          String((node.data as Record<string, unknown>).agentId).trim()
            ? String((node.data as Record<string, unknown>).agentId).trim()
            : undefined,
        message: input,
        context: allContext,
        primaryLanguage: templateNodePrimaryLanguage,
        additionalInstructions: node.data.additionalInstructions
      })

      logger.log(`[FlowExecutor] Resultado bruto do template ${node.id}:`, {
        type: typeof result,
        preview: safeLogPreview(typeof result === 'string' ? result : JSON.stringify(result))
      })

      return result
    } catch (error: any) {
      logger.error(`[FlowExecutor] Erro ao executar template ${node.data.templateId}: ${error.message}`, error)
      throw new Error(`Falha ao executar template ${node.data.label}: ${error.message}`)
    }
  }

  private async executeAgentLegacy(node: FlowNode, input: string): Promise<any> {
    try {
      // O input já vem formatado como string (mensagem para o agente)
      const message = input

      logger.info(`[FlowExecutor] 🎯 Orquestrando execução do node ${node.id}`)
      logger.info(`[FlowExecutor] 📤 Chamando agente ${node.data.agentId} (${node.data.label})`)
      logger.log(`[FlowExecutor] Mensagem preparada`, {
        messagePreview: safeLogPreview(message),
        messageLength: message.length
      })

      // Combina contexto global + dados dos predecessores para passar ao agente
      const allContext = {
        ...this.context.data,
        ...this.collectPredecessorData(node.id)
      }

      // 🎯 IMPORTANTE: Armazenar a mensagem original do usuário no contexto
      // Se a mensagem original estiver em initialData ou no contexto, preserva para cálculo de confiança
      // A mensagem original pode estar em: initialMessage, userMessage, originalMessage, ou message (se não for instrução do flow)
      if (!allContext.originalMessage && !allContext.userMessage) {
        // Se a mensagem atual não parece ser uma instrução do flow, pode ser a mensagem original
        if (!message.includes('Execute sua tarefa como agente') && !message.includes('Dados recebidos dos nodes anteriores')) {
          allContext.originalMessage = message
          allContext.userMessage = message
        } else if (this.context.data.message || this.context.data.originalMessage || this.context.data.userMessage) {
          // Se a mensagem é uma instrução do flow, busca a mensagem original do contexto
          allContext.originalMessage = this.context.data.originalMessage || this.context.data.userMessage || this.context.data.message
          allContext.userMessage = this.context.data.originalMessage || this.context.data.userMessage || this.context.data.message
        }
      }

      logger.log(`[FlowExecutor] Contexto para substituição de templates no node ${node.id}:`, {
        contextKeys: Object.keys(allContext),
        contextKeyCount: Object.keys(allContext).length,
        originalMessage: safeLogPreview(allContext.originalMessage || allContext.userMessage || '')
      })

      // O Flow orquestra - o agente apenas executa
      // Chama o serviço de chat do agente (já existente) passando o contexto para substituição de templates
      if (!node.data.agentId) {
        throw new Error(`Agent ID não encontrado no node ${node.id}`)
      }

      if (node.data.skipReplyConfidence === true) {
        allContext.flow_skip_reply_confidence = true
      }

      const result = await chatWithAgent(
        this.context.userEmail,
        node.data.agentId,
        message,
        allContext // Passa o contexto para substituição de templates
      )
      
      // ✅ Detectar se o agente caiu no inbox (retorna string vazia quando bloqueado)
      const agentBlocked = result === '' || (typeof result === 'string' && result.trim() === '')
      
      if (agentBlocked) {
        // Buscar informações do agente para o log
        const { data: agentData } = await supabase
          .from('tb_agents')
          .select('nome')
          .eq('id', node.data.agentId)
          .maybeSingle()
        
        const agentName = agentData?.nome || node.data.agentId
        
        // ✅ Salvar log específico quando agente cai no inbox
        await this.saveWorkflowNodeLog(
          node.id,
          node.data.agentId,
          false, // Não é sucesso, mas não é erro fatal
          null,
          `Agente "${agentName}" bloqueado - resposta enviada para aprovação no inbox`
        )
        
        logger.warn(`[FlowExecutor] ⚠️ Agente "${agentName}" (${node.data.agentId}) bloqueado - resposta caiu no inbox`)
      }
      
      logger.log(`[FlowExecutor] Resultado bruto do agente ${node.id}:`, {
        type: typeof result,
        isString: typeof result === 'string',
        isBlocked: agentBlocked,
        preview: safeLogPreview(typeof result === 'string' ? result : JSON.stringify(result))
      })

      if (!agentBlocked) {
        logger.info(`[FlowExecutor] ✅ Agente ${node.data.agentId} executado com sucesso`)
        logger.log(`[FlowExecutor] Resultado preparado`, {
          resultPreview: safeLogPreview(typeof result === 'string' ? result : JSON.stringify(result))
        })
      }

      // Retorna o resultado para ser passado aos próximos nodes
      return result
    } catch (error: any) {
      logger.error(`[FlowExecutor] ❌ Erro ao executar agente ${node.data.agentId}: ${error.message}`, error)
      throw new Error(`Falha ao executar agente ${node.data.label}: ${error.message}`)
    }
  }

  /**
   * Atualiza o contexto com os dados de saída do node
   * Tenta fazer parse de JSON se o output for string
   */
  private updateContextWithOutput(nodeId: string, output: any): void {
    let parsedOutput = output

    // Se o output é uma string, tenta fazer parse de JSON
    if (typeof output === 'string') {
      try {
        // Tenta fazer parse do JSON
        parsedOutput = JSON.parse(output)
        logger.log(`[FlowExecutor] JSON parseado do node ${nodeId}`, {
          outputType: typeof parsedOutput,
          outputPreview: safeLogPreview(JSON.stringify(parsedOutput))
        })
      } catch (e) {
        // Se não for JSON válido, mantém como string
        logger.log(`[FlowExecutor] Output do node ${nodeId} não é JSON, mantendo como string`)
      }
    }

    parsedOutput = this.enrichAgentOutputForContext(parsedOutput)

    // Adiciona os dados de saída ao contexto global
    if (typeof parsedOutput === 'object' && parsedOutput !== null && !Array.isArray(parsedOutput)) {
      // Se for objeto, mescla diretamente no contexto
      Object.assign(this.context.data, parsedOutput)
      logger.log(`[FlowExecutor] Dados do node ${nodeId} mesclados no contexto:`, Object.keys(parsedOutput))
    } else {
      // Se for string, array ou outro tipo, guarda com prefixo do nodeId
      this.context.data[`${nodeId}_output`] = parsedOutput
      logger.log(`[FlowExecutor] Dados do node ${nodeId} guardados como ${nodeId}_output`)
    }
  }

  /**
   * Encontra os próximos nodes (sucessores) conectados a este node
   */
  private getNextNodes(nodeId: string, selectedHandle?: string): FlowNode[] {
    const outgoingEdges = this.flowData.edges.filter(e => e.source === nodeId)
    logger.log(`[FlowExecutor] Buscando próximos nodes para ${nodeId}. Edges encontradas: ${outgoingEdges.length}`, outgoingEdges.map(e => `${e.source} -> ${e.target}`))
    
    // Se o node definiu um handle de saída específico, filtra por ele.
    let filteredEdges = outgoingEdges
    if (selectedHandle !== undefined) {
      filteredEdges = outgoingEdges.filter(e => e.sourceHandle === selectedHandle)
      logger.log(`[FlowExecutor] Filtrado para sourceHandle '${selectedHandle}': ${filteredEdges.length} edges`)
    }
    
    const nextNodeIds = filteredEdges.map(e => e.target)
    const nextNodes = this.flowData.nodes.filter(n => nextNodeIds.includes(n.id))
    
    logger.log(`[FlowExecutor] Nodes encontrados: ${nextNodes.length}`, nextNodes.map(n => n.id))
    
    return nextNodes
  }

  /**
   * Avalia uma condição usando o contexto atual
   */
  private evaluateCondition(condition: string, nodeId: string): boolean {
    if (!condition || condition.trim() === '') {
      logger.warn(`[FlowExecutor] Condição vazia no node ${nodeId}, retornando false`)
      return false
    }

    try {
      // Substitui variáveis do contexto no formato {{variavel}}
      let evaluatedCondition = condition
      const context = this.context.data
      
      // Substitui todas as variáveis {{variavel}} pelos valores do contexto
      // Usa Set para evitar duplicatas de variáveis faltando (se a mesma variável aparecer múltiplas vezes)
      const missingVariablesSet = new Set<string>()
      evaluatedCondition = evaluatedCondition.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
        const value = context[varName]
        if (value === undefined || value === null) {
          // Adiciona ao Set (evita duplicatas se a mesma variável aparecer múltiplas vezes na condição)
          missingVariablesSet.add(varName)
          logger.warn(`[FlowExecutor] Variável ${varName} não encontrada no contexto, usando fallback`)
          return 'undefined'
        }
        // Se for string, adiciona aspas, senão converte para string
        return typeof value === 'string' ? `'${value}'` : String(value)
      })
      
      // Converte Set para Array (remove duplicatas)
      const missingVariables = Array.from(missingVariablesSet)
      
      // Se houve variáveis faltando, pode precisar usar fallback na avaliação
      if (missingVariables.length > 0) {
        logger.warn(`[FlowExecutor] ⚠️ FALLBACK: ${missingVariables.length} variável(is) faltando na condição: ${missingVariables.join(', ')}`)
      }

      logger.log(`[FlowExecutor] Condição original: ${condition}`)
      logger.log(`[FlowExecutor] Condição avaliada: ${evaluatedCondition}`)

      // 🎯 FALLBACK: Se a condição contém 'undefined', usa fallback (retorna false por padrão)
      let usedFallback = false
      let fallbackResult = false
      
      // ✅ Salva eventos APENAS UMA VEZ quando há variáveis faltando
      if (evaluatedCondition.includes('undefined') && missingVariables.length > 0) {
        usedFallback = true
        fallbackResult = false // Fallback padrão: condição falsa quando variável não existe
        logger.warn(`[FlowExecutor] ⚠️ FALLBACK: Condição contém 'undefined', usando resultado padrão: false`)
        
        // ✅ Garantir que user_id seja passado corretamente (não string vazia)
        const userIdForFallback = (this.context.userId && this.context.userId.trim() !== '') ? this.context.userId : undefined
        
        logger.log(`[FlowExecutor] Salvando fallback consolidado para condição:`, {
          missing_variables: missingVariables,
          user_id: userIdForFallback || 'undefined',
          workflow_id: this.context.flowId,
          node_id: nodeId
        })
        
        // ✅ Salva APENAS UM evento consolidado com todas as variáveis faltando
        // Isso evita duplicação: um evento por variável + um evento de condição = muitos eventos
        // Agora: apenas um evento consolidado com todas as informações
        saveFallbackEvent({
          user_id: userIdForFallback,
          user_email: this.context.userEmail, // Para buscar companies_id automaticamente
          workflow_id: this.context.flowId,
          node_id: undefined, // nodeId é string (ex: "node-3"), não UUID, então passa undefined
          event_type: 'condition_defaulted',
          level: 'warn',
          message: `Condição avaliada com ${missingVariables.length} variável(is) faltando: ${missingVariables.join(', ')}. Usando resultado padrão: false.`,
          metadata: {
            original_condition: condition,
            evaluated_condition: evaluatedCondition,
            node_id_string: nodeId, // Salva node_id como string no metadata
            workflow_id: this.context.flowId,
            default_result: false,
            missing_variables: missingVariables, // Array com todas as variáveis faltando
            context_keys: Object.keys(context) // Chaves disponíveis no contexto
          },
          impact_level: 'medium'
        }).catch(err => {
          logger.error('[FlowExecutor] Erro ao salvar evento de fallback:', err)
        })
      }

      const normalizedCondition = evaluatedCondition
        .replace(/\s+contem\s+/gi, ' contém ')
        .replace(/\s+nao contem\s+/gi, ' não contém ')
        .replace(/\s+esta vazio/gi, ' está vazio')
        .replace(/\s+nao esta vazio/gi, ' não está vazio')
        .replace(/\s+comeca com\s+/gi, ' começa com ')

      // Avalia operadores de texto
      if (normalizedCondition.includes(' contém ')) {
        const [left, right] = normalizedCondition.split(' contém ').map(s => s.trim().replace(/^'|'$/g, ''))
        const result = usedFallback ? fallbackResult : String(left).includes(String(right))
        logger.log(`[FlowExecutor] Avaliação 'contém': "${left}" contém "${right}" = ${result}${usedFallback ? ' (FALLBACK)' : ''}`)
        return result
      }

      if (normalizedCondition.includes(' não contém ')) {
        const [left, right] = normalizedCondition.split(' não contém ').map(s => s.trim().replace(/^'|'$/g, ''))
        const result = usedFallback ? fallbackResult : !String(left).includes(String(right))
        logger.log(`[FlowExecutor] Avaliação 'não contém': "${left}" não contém "${right}" = ${result}${usedFallback ? ' (FALLBACK)' : ''}`)
        return result
      }

      if (normalizedCondition.includes(' está vazio')) {
        const left = normalizedCondition.split(' está vazio')[0].trim().replace(/^'|'$/g, '')
        const result = usedFallback ? fallbackResult : (!left || left === 'undefined' || left === '')
        logger.log(`[FlowExecutor] Avaliação 'está vazio': "${left}" = ${result}${usedFallback ? ' (FALLBACK)' : ''}`)
        return result
      }

      if (normalizedCondition.includes(' não está vazio')) {
        const left = normalizedCondition.split(' não está vazio')[0].trim().replace(/^'|'$/g, '')
        const result = usedFallback ? fallbackResult : !!(left && left !== 'undefined' && left !== '')
        logger.log(`[FlowExecutor] Avaliação 'não está vazio': "${left}" = ${result}${usedFallback ? ' (FALLBACK)' : ''}`)
        return result
      }
      
      // Se usou fallback mas não entrou em nenhum operador específico, retorna o fallback
      if (usedFallback) {
        return fallbackResult
      }

      if (normalizedCondition.includes(' começa com ')) {
        const [left, right] = normalizedCondition.split(' começa com ').map(s => s.trim().replace(/^'|'$/g, ''))
        const result = String(left).startsWith(String(right))
        logger.log(`[FlowExecutor] Avaliação 'começa com': "${left}" começa com "${right}" = ${result}`)
        return result
      }

      if (normalizedCondition.includes(' termina com ')) {
        const [left, right] = normalizedCondition.split(' termina com ').map(s => s.trim().replace(/^'|'$/g, ''))
        const result = String(left).endsWith(String(right))
        logger.log(`[FlowExecutor] Avaliação 'termina com': "${left}" termina com "${right}" = ${result}`)
        return result
      }

      // Avalia operadores numéricos e de igualdade
      // Remove aspas simples para comparação
      evaluatedCondition = normalizedCondition.replace(/'/g, '')

      // Substitui operadores por JavaScript
      evaluatedCondition = evaluatedCondition.replace(/==/g, '===')
      evaluatedCondition = evaluatedCondition.replace(/!=/g, '!==')

      // Usa Function para avaliar de forma segura (apenas comparações)
      const safeCondition = evaluatedCondition.replace(/[^a-zA-Z0-9_$.\s=<>!&|()'"]/g, '')
      const result = new Function('return ' + safeCondition)()
      
      logger.log(`[FlowExecutor] Resultado da avaliação: ${result}`)
      return Boolean(result)
    } catch (error: any) {
      logger.error(`[FlowExecutor] Erro ao avaliar condição "${condition}": ${error.message}`)
      return false
    }
  }

  /**
   * Executa um loop - executa um fluxo completo repetidamente
   */
  private async executeLoop(node: FlowNode): Promise<void> {
    const iterations = node.data.infinite ? Infinity : parseInt(String(node.data.iterations || 1))
    const flowIdRaw = node.data.flowId
    const flowId = typeof flowIdRaw === 'string' ? flowIdRaw.trim() : String(flowIdRaw || '').trim()

    if (!flowId) {
      throw new Error('Loop: flowId não definido ou vazio.')
    }

    if (flowId === this.context.flowId) {
      logger.error(
        `[FlowExecutor] Tentativa de executar o próprio flow em loop (recursão infinita). Flow ${flowId} não pode executar a si mesmo.`
      )
      throw new Error(`Não é possível executar o próprio flow em loop. Isso causaria recursão infinita.`)
    }

    logger.info(
      `[FlowExecutor] nodeId=${node.id} type=loop start subFlowId=${flowId} ${node.data.infinite ? 'infinite' : `iterations=${iterations}`}`
    )

    let iteration = 0
    while (node.data.infinite || iteration < iterations) {
      iteration++
      logger.info(
        `[FlowExecutor] nodeId=${node.id} type=loop iteration=${iteration}${node.data.infinite ? ' (infinite)' : `/${iterations}`} subFlowId=${flowId}`
      )

      let query = supabase.from('tb_flows').select('nodes').eq('id', flowId)

      if (this.context.companiesId) {
        query = query.eq('companies_id', this.context.companiesId)
      } else {
        const { getCompanyIdByEmail } = await import('../../utils/company-helper')
        const companiesId = await getCompanyIdByEmail(this.context.userEmail)
        if (companiesId) {
          query = query.eq('companies_id', companiesId)
        } else {
          query = query.eq('user_email', this.context.userEmail)
        }
      }

      const { data, error } = await query.single()

      if (error || !data) {
        logger.error(`[FlowExecutor] Flow ${flowId} não encontrado no loop:`, error)
        throw new Error(`Loop: fluxo subordinado não encontrado (flowId=${flowId})`)
      }

      const subFlowData = data?.nodes as FlowData | null

      if (!subFlowData || !Array.isArray(subFlowData.nodes) || subFlowData.nodes.length === 0) {
        throw new Error(`Loop: dados do fluxo subordinado inválidos (flowId=${flowId})`)
      }

      const subContext: FlowExecutionContext = {
        flowId: flowId,
        userId: this.context.userId,
        companiesId: this.context.companiesId,
        userEmail: this.context.userEmail,
        executionId: this.context.executionId,
        data: { ...this.context.data },
        executionHistory: []
      }

      const subExecutor = new FlowExecutor(subFlowData, subContext)
      const subResult = await subExecutor.execute()

      Object.assign(this.context.data, subResult.data)
      this.context.executionHistory.push(...subResult.executionHistory)

      logger.info(`[FlowExecutor] nodeId=${node.id} type=loop subFlowId=${flowId} iteration=${iteration} ok`)

      if (!node.data.infinite && iteration >= iterations) {
        break
      }

      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    logger.info(`[FlowExecutor] nodeId=${node.id} type=loop completed totalIterations=${iteration}`)
  }

  private async executeSubflow(node: FlowNode): Promise<Record<string, unknown>> {
    const flowIdRaw = node.data.subflowId || node.data.flowId
    const flowId = typeof flowIdRaw === 'string' ? flowIdRaw.trim() : String(flowIdRaw || '').trim()
    const resultKey = String(node.data.subflowResultKey || 'subflow_result').trim() || 'subflow_result'
    const failOnError = node.data.subflowFailOnError !== false

    if (!flowId) {
      const output = {
        kind: 'subflow' as const,
        subflow_status: 'failed',
        subflow_id: null,
        subflow_name: node.data.subflowName || node.data.flowName || null,
        error_code: 'subflow_id_required',
        user_safe_message: 'Selecione um subfluxo para executar.',
        [resultKey]: { status: 'failed', error: 'subflow_id_required' }
      }
      if (failOnError) throw new Error('Subfluxo: flowId nao definido ou vazio.')
      return output
    }

    const stack = Array.isArray(this.context.data.__flow_call_stack)
      ? (this.context.data.__flow_call_stack as unknown[]).map((item) => String(item || '').trim()).filter(Boolean)
      : []

    if (flowId === this.context.flowId || stack.includes(flowId)) {
      const output = {
        kind: 'subflow' as const,
        subflow_status: 'failed',
        subflow_id: flowId,
        subflow_name: node.data.subflowName || node.data.flowName || null,
        error_code: 'subflow_recursion_detected',
        user_safe_message: 'O subfluxo selecionado criaria uma recursao.',
        [resultKey]: { status: 'failed', flowId, error: 'subflow_recursion_detected' }
      }
      if (failOnError) throw new Error(`Subfluxo: recursao detectada para flowId=${flowId}.`)
      return output
    }

    try {
      let query = supabase.from('tb_flows').select('name, nodes').eq('id', flowId)

      if (this.context.companiesId) {
        query = query.eq('companies_id', this.context.companiesId)
      } else {
        const { getCompanyIdByEmail } = await import('../../utils/company-helper')
        const companiesId = await getCompanyIdByEmail(this.context.userEmail)
        query = companiesId ? query.eq('companies_id', companiesId) : query.eq('user_email', this.context.userEmail)
      }

      const { data, error } = await query.single()
      if (error || !data) {
        throw new Error(`Subfluxo: fluxo nao encontrado (flowId=${flowId})`)
      }

      const subFlowData = data?.nodes as FlowData | null
      if (!subFlowData || !Array.isArray(subFlowData.nodes) || subFlowData.nodes.length === 0) {
        throw new Error(`Subfluxo: dados do fluxo invalidos (flowId=${flowId})`)
      }

      logger.info(`[FlowExecutor] nodeId=${node.id} type=subflow start subFlowId=${flowId}`)

      const waitingSubflowId = String(this.context.data.__flow_waiting_subflow_id || '').trim()
      const waitingSubflowNodeId = String(this.context.data.__flow_waiting_subflow_node_id || '').trim()
      const isResumingSameSubflow = waitingSubflowId === flowId && !!waitingSubflowNodeId

      const subflowContextData: Record<string, unknown> = {
        ...this.context.data,
        __flow_runtime_scope: 'subflow',
        __flow_call_stack: [...stack, this.context.flowId],
      }

      delete subflowContextData.__flow_resume_node_id
      delete subflowContextData.__flow_paused_for_user_reply
      delete subflowContextData.__flow_waiting_node_id
      delete subflowContextData.__flow_pause_reason
      delete subflowContextData.__flow_waiting_node_label

      if (isResumingSameSubflow) {
        subflowContextData.__resume_from_node_id = waitingSubflowNodeId
      } else {
        delete subflowContextData.__resume_from_node_id
      }

      const subContext: FlowExecutionContext = {
        flowId,
        userId: this.context.userId,
        companiesId: this.context.companiesId,
        userEmail: this.context.userEmail,
        executionId: this.context.executionId,
        data: subflowContextData,
        executionHistory: []
      }

      const subExecutor = new FlowExecutor(subFlowData, subContext)
      const subResult = await subExecutor.execute()
      const cleanedData = { ...subResult.data }
      delete cleanedData.__flow_call_stack
      delete cleanedData.__resume_from_node_id

      Object.assign(this.context.data, cleanedData)
      this.context.executionHistory.push(...subResult.executionHistory)

      const dataRecord = data as { name?: unknown; nome?: unknown; nodes?: unknown }
      const subflowName =
        String(dataRecord?.name || dataRecord?.nome || node.data.subflowName || node.data.flowName || '').trim() || null
      if (cleanedData.__flow_paused_for_user_reply) {
        this.context.data.__flow_resume_node_id = node.id
        this.context.data.__flow_waiting_subflow_id = flowId
        this.context.data.__flow_waiting_subflow_node_id = cleanedData.__flow_resume_node_id || null
        logger.info(
          `[FlowExecutor] nodeId=${node.id} type=subflow paused subFlowId=${flowId} waitingNode=${cleanedData.__flow_resume_node_id || 'n/a'}`
        )

        return {
          kind: 'subflow' as const,
          subflow_status: 'paused',
          subflow_id: flowId,
          subflow_name: subflowName,
          subflow_result_key: resultKey,
          subflow_executed_nodes: subResult.executionHistory.length,
          [resultKey]: {
            status: 'paused',
            flowId,
            flowName: subflowName,
            executedNodes: subResult.executionHistory.length
          }
        }
      }

      logger.info(
        `[FlowExecutor] nodeId=${node.id} type=subflow completed subFlowId=${flowId} executedNodes=${subResult.executionHistory.length}`
      )

      delete this.context.data.__flow_waiting_subflow_id
      delete this.context.data.__flow_waiting_subflow_node_id
      delete this.context.data.__flow_resume_node_id
      delete this.context.data.__flow_paused_for_user_reply

      return {
        kind: 'subflow' as const,
        subflow_status: 'completed',
        subflow_id: flowId,
        subflow_name: subflowName,
        subflow_result_key: resultKey,
        subflow_executed_nodes: subResult.executionHistory.length,
        [resultKey]: {
          status: 'completed',
          flowId,
          flowName: subflowName,
          executedNodes: subResult.executionHistory.length
        }
      }
    } catch (error: any) {
      logger.error(`[FlowExecutor] Erro ao executar subfluxo nodeId=${node.id}: ${error?.message || error}`, error)
      const output = {
        kind: 'subflow' as const,
        subflow_status: 'failed',
        subflow_id: flowId,
        subflow_name: node.data.subflowName || node.data.flowName || null,
        error_code: 'subflow_failed',
        user_safe_message: 'Nao foi possivel executar o subfluxo.',
        [resultKey]: {
          status: 'failed',
          flowId,
          error: error?.message || 'subflow_failed'
        }
      }
      if (failOnError) throw error
      return output
    }
  }

  /**
   * Salva log de execução de um node do workflow
   */
  /**
   * Formata o output do agente para exibição legível (sem JSON puro)
   */
  private formatAgentOutput(output: any): string {
    if (!output) return 'Sem resposta'
    
    if (typeof output === 'string') {
      // Se for string, retorna até 150 caracteres
      return output.length > 150 ? output.substring(0, 150) + '...' : output
    }
    
    if (typeof output === 'object') {
      // Se for objeto, tenta extrair informações relevantes
      if (output.message) {
        const msg = String(output.message)
        return msg.length > 150 ? msg.substring(0, 150) + '...' : msg
      }
      if (output.answer) {
        const ans = String(output.answer)
        return ans.length > 150 ? ans.substring(0, 150) + '...' : ans
      }
      if (output.content) {
        const cont = String(output.content)
        return cont.length > 150 ? cont.substring(0, 150) + '...' : cont
      }
      if (output.action) {
        const actionDesc = output.action === 'reply' ? 'Resposta enviada' :
                          output.action === 'send_whatsapp' ? 'WhatsApp enviado' :
                          output.action === 'send_email' ? 'Email enviado' :
                          `Ação: ${output.action}`
        const msg = output.message ? String(output.message) : ''
        if (msg) {
          const fullMsg = `${actionDesc} - ${msg}`
          return fullMsg.length > 150 ? fullMsg.substring(0, 150) + '...' : fullMsg
        }
        return actionDesc
      }
      // ✅ Se for objeto simples com poucos campos, formata de forma legível
      const keys = Object.keys(output)
      if (keys.length === 1) {
        // Objeto com 1 campo: mostra chave e valor
        const key = keys[0]
        const value = output[key]
        if (typeof value === 'boolean') {
          return `${key}: ${value ? 'sim' : 'não'}`
        }
        if (typeof value === 'string' && value.length < 100) {
          return `${key}: ${value}`
        }
        return `${key}: ${typeof value}`
      }
      if (keys.length <= 3) {
        // Objeto com poucos campos: formata como lista
        const parts = keys.map(k => {
          const v = output[k]
          if (typeof v === 'boolean') return `${k}=${v ? 'sim' : 'não'}`
          if (typeof v === 'string' && v.length < 50) return `${k}="${v}"`
          return `${k}=${typeof v}`
        })
        return parts.join(', ')
      }
      // Objeto complexo: apenas indica tipo
      return `Objeto com ${keys.length} campos`
    }
    
    return String(output)
  }

  /**
   * Busca nome do agente para usar nos logs
   */
  private async getAgentName(agentId: string): Promise<string> {
    try {
      const { data: agentData } = await supabase
        .from('tb_agents')
        .select('nome')
        .eq('id', agentId)
        .maybeSingle()
      
      return agentData?.nome || agentId
    } catch {
      return agentId
    }
  }

  private async getTemplateName(templateId: string): Promise<string> {
    try {
      let query = supabase
        .from('tb_agents_templates')
        .select('name, companies_id')
        .eq('id', templateId)

      if (this.context.companiesId) {
        query = query.or(`companies_id.eq.${this.context.companiesId},companies_id.is.null`)
      } else {
        query = query.is('companies_id', null)
      }

      const { data: templateData } = await query.maybeSingle()
      return (templateData as any)?.name || templateId
    } catch {
      return templateId
    }
  }

  private async saveWorkflowNodeLog(
    nodeId: string,
    agentId: string | undefined,
    success: boolean,
    output: any,
    error?: string,
    templateId?: string
  ): Promise<void> {
    // ✅ Só loga erros - sucessos não são logados para não poluir a tela
    if (success && !error) {
      return
    }
    
    try {
      // Buscar companies_id do contexto ou do workflow
      let companiesId = this.context.companiesId
      
      if (!companiesId && this.context.flowId) {
        const { data: flowData } = await supabase
          .from('tb_flows')
          .select('companies_id, user_email')
          .eq('id', this.context.flowId)
          .maybeSingle()
        
        if (flowData?.companies_id) {
          companiesId = flowData.companies_id
        } else if (flowData?.user_email) {
          const { getCompanyIdByEmail } = await import('../../utils/company-helper')
          const companyId = await getCompanyIdByEmail(flowData.user_email)
          companiesId = companyId || undefined // Converte null para undefined
        }
      }

      // Buscar nome do agente e do node
      const resourceType = templateId ? 'template' : 'agent'
      const resourceName = templateId
        ? await this.getTemplateName(templateId)
        : agentId
          ? await this.getAgentName(agentId)
          : 'recurso desconhecido'
      const node = this.flowData.nodes.find(n => n.id === nodeId)
      const nodeLabel = node?.data?.label || nodeId

      // ✅ Formatar mensagem de forma legível (sem JSON puro)
      const message = error || `Erro ao executar ${resourceType} "${resourceName}" no node "${nodeLabel}"`

      await saveSystemLog({
        companies_id: companiesId || undefined,
        user_id: this.context.userId || undefined,
        user_email: this.context.userEmail || undefined,
        workflow_id: this.context.flowId || undefined,
        execution_id: this.context.executionId || undefined,
        node_id: nodeId,
        agent_id: agentId || undefined,
        log_type: 'workflow_node_executed',
        level: 'error',
        message,
        metadata: {
          nodeId,
          nodeLabel: nodeLabel,
          agentId,
          templateId: templateId || null,
          resourceType,
          resourceName,
          workflowId: this.context.flowId,
          executionId: this.context.executionId,
          error: error || null,
          timestamp: new Date().toISOString()
        },
        impact_level: 'medium'
      })
    } catch (err: any) {
      logger.warn(`[FlowExecutor] Erro ao salvar log de node: ${err.message}`)
      // Não quebra a execução se falhar ao salvar log
    }
  }

  /**
   * Salva log de execução completa do workflow
   */
  private async saveWorkflowExecutionCompleted(
    success: boolean,
    error?: string
  ): Promise<void> {
    try {
      // Buscar companies_id do contexto ou do workflow
      let companiesId = this.context.companiesId
      
      logger.log(`[saveWorkflowExecutionCompleted] 🔍 Buscando companies_id:`, {
        hasContextCompaniesId: !!this.context.companiesId,
        contextCompaniesId: this.context.companiesId,
        flowId: this.context.flowId,
        userEmail: this.context.userEmail
      })
      
      if (!companiesId && this.context.flowId) {
        const { data: flowData } = await supabase
          .from('tb_flows')
          .select('companies_id, user_email')
          .eq('id', this.context.flowId)
          .maybeSingle()
        
        logger.log(`[saveWorkflowExecutionCompleted] 📋 Dados do flow:`, {
          hasFlowData: !!flowData,
          flowCompaniesId: flowData?.companies_id,
          flowUserEmail: flowData?.user_email
        })
        
        if (flowData?.companies_id) {
          companiesId = flowData.companies_id
          logger.log(`[saveWorkflowExecutionCompleted] ✅ companies_id do flow: ${companiesId}`)
        } else if (flowData?.user_email) {
          const { getCompanyIdByEmail } = await import('../../utils/company-helper')
          const companyId = await getCompanyIdByEmail(flowData.user_email)
          companiesId = companyId || undefined // Converte null para undefined
          logger.log(`[saveWorkflowExecutionCompleted] ✅ companies_id via email: ${companiesId}`)
        }
      }
      
      // ✅ FALLBACK: Se ainda não tem companies_id, tenta buscar via userEmail do contexto
      if (!companiesId && this.context.userEmail) {
        const { getCompanyIdByEmail } = await import('../../utils/company-helper')
        const companyId = await getCompanyIdByEmail(this.context.userEmail)
        companiesId = companyId || undefined
        logger.log(`[saveWorkflowExecutionCompleted] ✅ companies_id via contexto userEmail: ${companiesId}`)
      }
      
      if (!companiesId) {
        logger.warn(`[saveWorkflowExecutionCompleted] ⚠️ companies_id não encontrado! Log pode não ser salvo corretamente.`)
      }

      // Buscar nome do workflow para o log
      let workflowName = this.context.flowId
      try {
        const { data: flowData } = await supabase
          .from('tb_flows')
          .select('nome')
          .eq('id', this.context.flowId)
          .maybeSingle()
        
        if (flowData?.nome) {
          workflowName = flowData.nome
        }
      } catch {
        // Ignora erro ao buscar nome
      }

      // ✅ Formatar mensagem de forma legível
      const message = success
        ? `Workflow "${workflowName}" executado com sucesso. ${this.executedNodes.size} de ${this.flowData.nodes.length} node(s) executado(s).`
        : `Erro ao executar workflow "${workflowName}": ${error || 'Erro desconhecido'}`

      const logResult = await saveSystemLog({
        companies_id: companiesId || undefined,
        user_id: this.context.userId || undefined,
        user_email: this.context.userEmail || undefined,
        workflow_id: this.context.flowId || undefined,
        execution_id: this.context.executionId || undefined,
        log_type: 'workflow_execution_completed',
        level: success ? 'info' : 'error',
        message,
        metadata: {
          flowId: this.context.flowId,
          flowName: workflowName,
          executionId: this.context.executionId,
          nodesExecuted: this.executedNodes.size,
          totalNodes: this.flowData.nodes.length,
          success,
          error: error || null,
          executionHistory: this.context.executionHistory.map(h => ({
            nodeId: h.nodeId,
            executionMode: h.executionMode,
            agentId: h.agentId,
            templateId: h.templateId,
            success: h.success,
            hasOutput: !!h.output,
            hasError: !!h.error
          })),
          timestamp: new Date().toISOString()
        },
        impact_level: success ? 'low' : 'high'
      })
      
      if (logResult.success) {
        logger.log(`[saveWorkflowExecutionCompleted] ✅ Log salvo com sucesso:`, {
          logId: logResult.id,
          companiesId,
          success,
          nodesExecuted: this.executedNodes.size
        })
      } else {
        logger.error(`[saveWorkflowExecutionCompleted] ❌ Erro ao salvar log:`, logResult.error)
      }
    } catch (err: any) {
      logger.warn(`[FlowExecutor] Erro ao salvar log de execução completa: ${err.message}`)
      // Não quebra a execução se falhar ao salvar log
    }
  }
}
