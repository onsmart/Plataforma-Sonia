"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlowExecutor = void 0;
const chatwithAgent_1 = require("../agents/chatwithAgent");
const flow_template_runner_1 = require("./flow-template-runner");
const logger_1 = __importDefault(require("../../lib/logger"));
const supabase_1 = require("../../lib/supabase");
const fallback_events_1 = require("./fallback-events");
const system_logs_1 = require("../system-logs");
const whatsapp_dispatcher_1 = require("../integrations/whatsapp/whatsapp.dispatcher");
const whatsapp_session_window_service_1 = require("../integrations/whatsapp/whatsapp-session-window.service");
const whatsapp_flow_message_service_1 = require("../integrations/whatsapp/whatsapp-flow-message.service");
const hubspot_service_1 = require("../integrations/crm/hubspot.service");
const whatsapp_campaign_service_1 = require("../integrations/whatsapp/whatsapp-campaign.service");
const whatsapp_contacts_1 = require("../integrations/whatsapp/whatsapp.contacts");
const whatsapp_template_catalog_service_1 = require("../integrations/whatsapp/whatsapp-template-catalog.service");
const email_service_1 = require("../integrations/email/email.service");
const mail_1 = require("../integrations/mail");
/**
 * Executa um flow de agentes sequencialmente
 * Cada node executa e passa dados para os próximos nodes conectados
 */
class FlowExecutor {
    constructor(flowData, context) {
        this.executedNodes = new Set();
        this.flowData = flowData;
        this.context = context;
    }
    resolveNodeExecutionMode(node) {
        const d = node.data || {};
        const tid = typeof d.templateId === 'string' ? d.templateId.trim() : '';
        const aid = d.agentId != null && String(d.agentId).trim() !== '' ? String(d.agentId).trim() : '';
        if (d.executionMode === 'template' || (tid !== '' && aid === '')) {
            return 'template';
        }
        if (d.executionMode === 'agent' && aid === '' && tid !== '') {
            return 'template';
        }
        return 'agent';
    }
    getNodeExecutionRef(node) {
        const executionMode = this.resolveNodeExecutionMode(node);
        return {
            executionMode,
            agentId: executionMode === 'agent' ? node.data.agentId : undefined,
            templateId: executionMode === 'template' ? node.data.templateId : undefined
        };
    }
    appendExecutionHistory(node, startedAt, partial) {
        const ref = this.getNodeExecutionRef(node);
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
        });
    }
    parseDebugKeys(raw) {
        if (raw == null || String(raw).trim() === '')
            return null;
        return String(raw)
            .split(/[\s,\n\r]+/)
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
    }
    normalizeDelaySeconds(raw) {
        const parsed = typeof raw === 'number' ? raw : parseFloat(String(raw ?? '0'));
        if (!Number.isFinite(parsed) || parsed < 0) {
            logger_1.default.warn(`[FlowExecutor] Duração de delay inválida (${String(raw)}), usando 0`);
            return 0;
        }
        const capped = Math.min(Math.floor(parsed), 3600);
        if (parsed > 3600) {
            logger_1.default.warn(`[FlowExecutor] Delay limitado a 3600s (pedido: ${parsed})`);
        }
        return capped;
    }
    parsePositiveInt(raw, fallback, max) {
        const parsed = typeof raw === 'number' ? raw : parseInt(String(raw ?? fallback), 10);
        if (!Number.isFinite(parsed) || parsed <= 0)
            return fallback;
        return Math.min(Math.floor(parsed), max);
    }
    renderContextTemplate(raw) {
        const template = String(raw || '');
        if (!template)
            return '';
        return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
            const value = this.context.data[key];
            if (value === undefined || value === null)
                return '';
            if (typeof value === 'string')
                return value;
            if (typeof value === 'number' || typeof value === 'boolean')
                return String(value);
            try {
                return JSON.stringify(value);
            }
            catch {
                return String(value);
            }
        });
    }
    parseWaTemplateComponents(node) {
        const d = node.data || {};
        if (Array.isArray(d.waTemplateComponents)) {
            return d.waTemplateComponents;
        }
        if (typeof d.waTemplateComponentsJson === 'string' && d.waTemplateComponentsJson.trim()) {
            const parsed = JSON.parse(d.waTemplateComponentsJson);
            if (!Array.isArray(parsed)) {
                throw new Error('components JSON deve ser um array');
            }
            return parsed;
        }
        return undefined;
    }
    async resolveWaTemplateComponents(integrationsId, templateName, languageCode, node) {
        let components = this.parseWaTemplateComponents(node);
        if (!components || components.length === 0) {
            const storedTemplate = await (0, whatsapp_template_catalog_service_1.getStoredTemplateByNameAndLanguage)(integrationsId, templateName, languageCode);
            if (!storedTemplate) {
                throw new Error('template nao encontrado no catalogo sincronizado. Sincronize os templates aprovados antes de salvar o bloco.');
            }
            const exactComponents = (0, whatsapp_template_catalog_service_1.buildExactTemplateSendComponentsFromCatalog)(Array.isArray(storedTemplate.components_json) ? storedTemplate.components_json : []);
            if (exactComponents.missingRequirements.length > 0) {
                throw new Error(`nao foi possivel montar o template exato com os dados sincronizados. ${exactComponents.missingRequirements[0]}`);
            }
            components = exactComponents.components;
        }
        return components;
    }
    normalizePhoneForWhatsApp(raw) {
        const digits = String(raw || '').replace(/\D/g, '').trim();
        if (!digits)
            return '';
        if (digits.length < 10 || digits.length > 16)
            return '';
        return digits;
    }
    async upsertCampaignContact(contactSeed, phoneNumber) {
        const existing = await (0, whatsapp_contacts_1.getContactByPhoneNumber)(phoneNumber);
        if (!existing.success) {
            throw new Error(existing.error || 'Erro ao buscar contato WhatsApp existente');
        }
        if (existing.contact?.id) {
            if (existing.contact.status !== 'active' || String(existing.contact.phone_number || '').trim() !== phoneNumber) {
                const updated = await (0, whatsapp_contacts_1.createOrUpdateContact)({
                    lid: existing.contact.lid,
                    phone_number: phoneNumber,
                    status: 'active'
                });
                if (!updated.success || !updated.contact?.id) {
                    throw new Error(updated.error || 'Erro ao atualizar contato WhatsApp existente');
                }
                return updated.contact.id;
            }
            return existing.contact.id;
        }
        const created = await (0, whatsapp_contacts_1.createOrUpdateContact)({
            lid: contactSeed,
            phone_number: phoneNumber,
            status: 'active'
        });
        if (!created.success || !created.contact?.id) {
            throw new Error(created.error || 'Erro ao criar contato WhatsApp para campanha');
        }
        return created.contact.id;
    }
    async executeHubSpotWhatsAppCampaign(node) {
        const d = node.data || {};
        const crmIntegrationId = String(d.crmIntegrationId || '').trim();
        const filterField = String(d.crmFilterField || 'tag').trim() || 'tag';
        const filterOperator = (String(d.crmFilterOperator || 'equals').trim() || 'equals');
        const filterValue = this.renderContextTemplate(d.crmFilterValue || '');
        const phoneField = String(d.crmPhoneField || 'phone').trim() || 'phone';
        const resultLimit = this.parsePositiveInt(d.crmResultLimit, 50, 200);
        if (!crmIntegrationId) {
            throw new Error('hubspot_whatsapp_campaign: crmIntegrationId obrigatorio');
        }
        if (!filterField || !filterValue) {
            throw new Error('hubspot_whatsapp_campaign: crmFilterField e crmFilterValue obrigatorios');
        }
        const properties = Array.from(new Set(['firstname', 'lastname', 'email', 'phone', filterField, phoneField].filter(Boolean)));
        const hubspotContacts = await (0, hubspot_service_1.searchHubSpotContacts)(crmIntegrationId, resultLimit, undefined, properties, [{ field: filterField, operator: filterOperator, value: filterValue }]);
        const contactIds = new Set();
        const sampleRecipients = [];
        const skippedNoPhone = [];
        const skippedInvalidPhone = [];
        const skippedErrors = [];
        let contactsWithPhone = 0;
        for (const contact of hubspotContacts) {
            const contactId = String(contact?.id || '').trim();
            const rawPhone = contact?.properties?.[phoneField] ||
                contact?.[phoneField] ||
                (phoneField !== 'phone' ? contact?.phone : '') ||
                contact?.properties?.phone ||
                '';
            if (!String(rawPhone || '').trim()) {
                if (contactId)
                    skippedNoPhone.push(contactId);
                continue;
            }
            contactsWithPhone++;
            const normalizedPhone = this.normalizePhoneForWhatsApp(rawPhone);
            if (!normalizedPhone) {
                if (contactId)
                    skippedInvalidPhone.push(contactId);
                continue;
            }
            try {
                const localContactId = await this.upsertCampaignContact(`hubspot:${crmIntegrationId}:${contactId}`, normalizedPhone);
                contactIds.add(localContactId);
                if (sampleRecipients.length < 10) {
                    sampleRecipients.push({
                        hubspotContactId: contactId,
                        phoneNumber: normalizedPhone,
                        email: String(contact?.email || contact?.properties?.email || '').trim() || null,
                        name: [String(contact?.firstname || contact?.properties?.firstname || '').trim(), String(contact?.lastname || contact?.properties?.lastname || '').trim()]
                            .filter(Boolean)
                            .join(' ') || null
                    });
                }
            }
            catch (error) {
                skippedErrors.push({
                    hubspotContactId: contactId,
                    error: error?.message || 'Erro desconhecido ao preparar contato'
                });
            }
        }
        const uniqueContactIds = Array.from(contactIds);
        return {
            kind: 'hubspot_contacts',
            crmIntegrationId,
            filter: {
                field: filterField,
                operator: filterOperator,
                value: filterValue
            },
            phoneField,
            resultLimit,
            matchedContacts: hubspotContacts.length,
            contactsWithPhone,
            contactsReadyForCampaign: uniqueContactIds.length,
            whatsapp_campaign_contact_ids: uniqueContactIds,
            skippedNoPhoneCount: skippedNoPhone.length,
            skippedInvalidPhoneCount: skippedInvalidPhone.length,
            skippedErrorCount: skippedErrors.length,
            skippedNoPhone: skippedNoPhone.slice(0, 20),
            skippedInvalidPhone: skippedInvalidPhone.slice(0, 20),
            skippedErrors: skippedErrors.slice(0, 20),
            sampleRecipients
        };
    }
    safeCloneForDebug(value, depth, seen) {
        const maxDepth = 5;
        const maxStr = 500;
        if (depth > maxDepth)
            return '[MaxDepth]';
        if (value === null || value === undefined)
            return value;
        if (typeof value === 'string') {
            return value.length > maxStr ? `${value.slice(0, maxStr)}…` : value;
        }
        if (typeof value === 'number' || typeof value === 'boolean')
            return value;
        if (typeof value === 'bigint')
            return value.toString();
        if (typeof value === 'function')
            return '[Function]';
        if (typeof value === 'symbol')
            return value.toString();
        if (value instanceof Date)
            return value.toISOString();
        if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value))
            return '[Buffer]';
        if (Array.isArray(value)) {
            const maxItems = 50;
            const arr = value.slice(0, maxItems).map((item) => this.safeCloneForDebug(item, depth + 1, seen));
            if (value.length > maxItems)
                arr.push(`… +${value.length - maxItems} itens`);
            return arr;
        }
        if (typeof value === 'object') {
            if (seen.has(value))
                return '[Circular]';
            seen.add(value);
            const out = {};
            const keys = Object.keys(value).slice(0, 80);
            for (const k of keys) {
                try {
                    out[k] = this.safeCloneForDebug(value[k], depth + 1, seen);
                }
                catch {
                    out[k] = '[Erro ao serializar]';
                }
            }
            if (Object.keys(value).length > 80) {
                out['…'] = 'truncado';
            }
            return out;
        }
        return String(value);
    }
    buildDebugSnapshot(keysFilter) {
        const data = this.context.data;
        const seen = new WeakSet();
        const keyList = keysFilter && keysFilter.length > 0 ? keysFilter : Object.keys(data);
        const out = {};
        for (const k of keyList) {
            if (keysFilter && keysFilter.length > 0 && !(k in data)) {
                out[k] = undefined;
                continue;
            }
            out[k] = this.safeCloneForDebug(data[k], 0, seen);
        }
        return out;
    }
    summarizeLastHistoryForDebug() {
        const h = this.context.executionHistory;
        if (h.length === 0)
            return null;
        const last = h[h.length - 1];
        let outputApproxBytes = 0;
        const out = last.output;
        if (out == null)
            outputApproxBytes = 0;
        else if (typeof out === 'string')
            outputApproxBytes = out.length;
        else {
            try {
                outputApproxBytes = JSON.stringify(out).length;
            }
            catch {
                outputApproxBytes = -1;
            }
        }
        return {
            nodeId: last.nodeId,
            success: last.success,
            nodeType: last.nodeType,
            outputApproxBytes,
            hasError: !!last.error
        };
    }
    /**
     * Executa o flow completo
     */
    async execute() {
        try {
            logger_1.default.info(`[FlowExecutor] Iniciando execução do flow ${this.context.flowId}`);
            logger_1.default.log(`[FlowExecutor] Flow data:`, {
                startNodeId: this.flowData.startNodeId,
                nodesCount: this.flowData.nodes.length,
                edgesCount: this.flowData.edges.length,
                nodes: this.flowData.nodes.map(n => ({ id: n.id, label: n.data.label })),
                edges: this.flowData.edges.map(e => `${e.source} -> ${e.target}`)
            });
            // Valida o flow
            this.validateFlow();
            // Encontra o node inicial
            const startNode = this.findStartNode();
            if (!startNode) {
                throw new Error('Node inicial não encontrado');
            }
            logger_1.default.info(`[FlowExecutor] Node inicial encontrado: ${startNode.id} (${startNode.data.label})`);
            // Executa a partir do node inicial
            await this.executeNode(startNode.id);
            logger_1.default.info(`[FlowExecutor] Flow executado com sucesso. Nodes executados: ${this.executedNodes.size}`);
            // ✅ Salvar log de execução completa com sucesso (necessário para KPIs)
            // Usa level 'info' para não poluir a tela de erros, mas salva para analytics
            await this.saveWorkflowExecutionCompleted(true);
            return this.context;
        }
        catch (error) {
            logger_1.default.error(`[FlowExecutor] Erro ao executar flow: ${error.message}`, error);
            // ✅ Salvar log de erro na execução
            await this.saveWorkflowExecutionCompleted(false, error.message);
            throw error;
        }
    }
    /**
     * Valida a estrutura do flow
     */
    validateFlow() {
        if (!this.flowData.nodes || this.flowData.nodes.length === 0) {
            throw new Error('Flow não possui nodes');
        }
        if (!this.flowData.startNodeId) {
            throw new Error('Flow não possui startNodeId definido');
        }
        const nodeIds = new Set(this.flowData.nodes.map(n => n.id));
        if (!nodeIds.has(this.flowData.startNodeId)) {
            throw new Error(`startNodeId '${this.flowData.startNodeId}' não corresponde a nenhum node`);
        }
        // Valida que todas as edges referenciam nodes existentes
        for (const edge of this.flowData.edges) {
            if (!nodeIds.has(edge.source)) {
                throw new Error(`Edge inválida: source node '${edge.source}' não existe`);
            }
            if (!nodeIds.has(edge.target)) {
                throw new Error(`Edge inválida: target node '${edge.target}' não existe`);
            }
        }
    }
    /**
     * Encontra o node inicial
     */
    findStartNode() {
        return this.flowData.nodes.find(n => n.id === this.flowData.startNodeId) || null;
    }
    /**
     * Executa um node específico e seus sucessores
     */
    async executeNode(nodeId) {
        // Evita execução duplicada
        if (this.executedNodes.has(nodeId)) {
            logger_1.default.warn(`[FlowExecutor] Node ${nodeId} já foi executado, pulando...`);
            return;
        }
        const node = this.flowData.nodes.find(n => n.id === nodeId);
        if (!node) {
            throw new Error(`Node ${nodeId} não encontrado`);
        }
        logger_1.default.info(`[FlowExecutor] nodeId=${nodeId} type=${node.type} label=${node.data.label}`);
        const nodeStartedAt = new Date().toISOString();
        let preparedAgentMessage;
        try {
            let processedResult = null;
            let shouldContinue = true;
            let skipContextUpdate = false;
            let ifElseBranch;
            let agentHistoryInput;
            let agentOutputSummary;
            const runAgentBranch = async () => {
                preparedAgentMessage = this.prepareNodeInput(node);
                agentHistoryInput = {
                    messagePreview: preparedAgentMessage.substring(0, 400),
                    messageLength: preparedAgentMessage.length
                };
                const result = await this.executeAgent(node, preparedAgentMessage);
                processedResult = result;
                if (typeof result === 'string') {
                    try {
                        processedResult = JSON.parse(result);
                        logger_1.default.log(`[FlowExecutor] Resultado do node ${nodeId} parseado como JSON`);
                        if (processedResult.action === 'read_whatsapp_db' && processedResult.messages) {
                            if (processedResult.messages.length === 1) {
                                processedResult = processedResult.messages[0];
                                logger_1.default.log(`[FlowExecutor] Extraída 1 mensagem do read_whatsapp_db para o próximo node`);
                            }
                            else if (processedResult.messages.length > 1) {
                                processedResult = {
                                    messages: processedResult.messages
                                };
                                logger_1.default.log(`[FlowExecutor] Extraídas ${processedResult.messages.length} mensagens do read_whatsapp_db`);
                            }
                            else {
                                processedResult = { messages: [] };
                                logger_1.default.log(`[FlowExecutor] Nenhuma mensagem encontrada no read_whatsapp_db`);
                            }
                        }
                    }
                    catch (e) {
                        logger_1.default.log(`[FlowExecutor] Resultado do node ${nodeId} mantido como string`);
                    }
                }
                agentOutputSummary = this.formatAgentOutput(processedResult);
                logger_1.default.info(`[FlowExecutor] nodeId=${nodeId} type=${node.type} outputSummary="${(agentOutputSummary || '').slice(0, 120)}"`);
            };
            switch (node.type) {
                case 'start':
                    logger_1.default.info(`[FlowExecutor] nodeId=${nodeId} type=start flowId=${this.context.flowId} executionId=${this.context.executionId ?? 'n/a'} contextDataKeys=${Object.keys(this.context.data).length}`);
                    processedResult = { started: true, contextDataKeyCount: Object.keys(this.context.data).length };
                    break;
                case 'stop':
                    logger_1.default.info(`[FlowExecutor] Execução interrompida pelo node de parada nodeId=${nodeId} label=${node.data.label ?? ''}`);
                    processedResult = { stopped: true };
                    shouldContinue = false;
                    break;
                case 'delay': {
                    const delaySec = this.normalizeDelaySeconds(node.data.duration);
                    logger_1.default.info(`[FlowExecutor] nodeId=${nodeId} type=delay begin durationSec=${delaySec}`);
                    if (delaySec > 0) {
                        await new Promise((resolve) => setTimeout(resolve, delaySec * 1000));
                    }
                    logger_1.default.info(`[FlowExecutor] nodeId=${nodeId} type=delay end durationMs=${delaySec * 1000}`);
                    processedResult = { delayed: delaySec, durationMs: delaySec * 1000 };
                    break;
                }
                case 'if-else': {
                    const condStr = node.data.condition || '';
                    ifElseBranch = this.evaluateCondition(condStr, nodeId);
                    processedResult = {
                        condition: condStr,
                        conditionResult: ifElseBranch,
                        branch: ifElseBranch ? 'true' : 'false'
                    };
                    logger_1.default.info(`[FlowExecutor] nodeId=${nodeId} type=if-else condition=${JSON.stringify(condStr)} result=${ifElseBranch} branch=${processedResult.branch}`);
                    break;
                }
                case 'loop':
                    await this.executeLoop(node);
                    processedResult = { loopCompleted: true };
                    shouldContinue = false;
                    break;
                case 'comment':
                    logger_1.default.log(`[FlowExecutor] Node de comentário encontrado: "${node.data?.comment || 'sem comentário'}"`);
                    skipContextUpdate = true;
                    processedResult = {
                        kind: 'comment',
                        comment: node.data?.comment || '',
                        label: node.data?.label || ''
                    };
                    break;
                case 'debug': {
                    skipContextUpdate = true;
                    const keysFilter = this.parseDebugKeys(node.data.debugKeys);
                    agentHistoryInput = { keysRequested: keysFilter ?? 'all' };
                    const predecessorSummary = this.summarizeLastHistoryForDebug();
                    const snapshot = this.buildDebugSnapshot(keysFilter);
                    const at = new Date().toISOString();
                    processedResult = {
                        kind: 'debug',
                        at,
                        snapshot,
                        predecessorSummary,
                        message: node.data.debugMessage || undefined,
                        label: node.data.label
                    };
                    let snapSize = 0;
                    try {
                        snapSize = JSON.stringify(snapshot).length;
                    }
                    catch {
                        snapSize = -1;
                    }
                    logger_1.default.info(`[FlowExecutor][debug] nodeId=${nodeId} keys=${keysFilter ? keysFilter.join(',') : 'all'} snapshotBytes≈${snapSize}`);
                    break;
                }
                case 'wa_session_window': {
                    const d = node.data || {};
                    const integrationsId = String(d.waIntegrationId || this.context.data.integrations_id || this.context.data.integration_id || '').trim();
                    const contactId = String(this.context.data.whatsapp_contact_id || '').trim();
                    if (!integrationsId || !contactId) {
                        logger_1.default.warn('[FlowExecutor] wa_session_window sem integrations_id ou whatsapp_contact_id', {
                            nodeId
                        });
                        ifElseBranch = false;
                        processedResult = {
                            kind: 'wa_session_window',
                            error: 'missing_integration_or_contact',
                            insideWindow: false,
                            conservativeUnknown: true
                        };
                        this.context.data.wa_session_inside_window = false;
                        this.context.data.wa_session_conservative_unknown = true;
                        break;
                    }
                    const state = await (0, whatsapp_session_window_service_1.getCustomerCareWindowState)(integrationsId, contactId);
                    ifElseBranch = state.insideWindow === true;
                    processedResult = {
                        kind: 'wa_session_window',
                        insideWindow: state.insideWindow,
                        conservativeUnknown: state.conservativeUnknown,
                        expiresAt: state.expiresAt ? state.expiresAt.toISOString() : null,
                        lastInboundAt: state.lastInboundAt
                    };
                    this.context.data.wa_session_inside_window = ifElseBranch;
                    this.context.data.wa_session_conservative_unknown = state.conservativeUnknown;
                    logger_1.default.info(`[FlowExecutor] wa_session_window nodeId=${nodeId} insideWindow=${state.insideWindow} conservativeUnknown=${state.conservativeUnknown}`);
                    break;
                }
                case 'wa_template': {
                    const d = node.data || {};
                    const integrationsId = String(d.waIntegrationId || this.context.data.integrations_id || '').trim();
                    const batchContactIds = Array.isArray(this.context.data.whatsapp_campaign_contact_ids)
                        ? this.context.data.whatsapp_campaign_contact_ids
                            .map((value) => String(value || '').trim())
                            .filter((value) => value.length > 0)
                        : [];
                    const to = String(this.context.data.whatsapp_contact_id || this.context.data.phone_number || '').trim();
                    const templateName = String(d.waTemplateName || '').trim();
                    const languageCode = String(d.waTemplateLanguage || 'pt_BR').trim();
                    if (!integrationsId || !templateName || (batchContactIds.length === 0 && !to)) {
                        throw new Error('wa_template: integrations_id (ou waIntegrationId no no), template e destino (ou lista preparada pelo HubSpot) sao obrigatorios');
                    }
                    const components = await this.resolveWaTemplateComponents(integrationsId, templateName, languageCode, node);
                    const agentFromCtx = this.context.data.agent_id || this.context.data.agentId;
                    const agentId = agentFromCtx != null && String(agentFromCtx).trim() !== '' ? String(agentFromCtx).trim() : undefined;
                    if (batchContactIds.length > 0) {
                        const fallbackCampaignName = `${String(node.data.label || 'Fluxo').trim() || 'Fluxo'} -> ${templateName}`;
                        const created = await (0, whatsapp_campaign_service_1.createCampaignRecord)({
                            integrationId: integrationsId,
                            companiesId: this.context.companiesId || null,
                            name: fallbackCampaignName,
                            templateName,
                            templateLanguage: languageCode,
                            components
                        });
                        if ('error' in created) {
                            throw new Error(created.error);
                        }
                        const enqueueResult = await (0, whatsapp_campaign_service_1.enqueueCampaignContacts)({
                            campaignId: created.id,
                            integrationId: integrationsId,
                            contactIds: batchContactIds,
                            rateLimitPerMinute: this.parsePositiveInt(node.data.waRateLimitPerMinute, 30, 120)
                        });
                        if (enqueueResult.error) {
                            throw new Error(enqueueResult.error);
                        }
                        processedResult = {
                            kind: 'wa_template_campaign',
                            waMetaTemplateSent: enqueueResult.inserted > 0,
                            templateName,
                            languageCode,
                            campaignId: created.id,
                            campaignContacts: batchContactIds.length,
                            enqueuedContacts: enqueueResult.inserted
                        };
                        logger_1.default.info(`[FlowExecutor] wa_template em lote nodeId=${nodeId} template=${templateName} enqueued=${enqueueResult.inserted}`);
                        break;
                    }
                    const sendRes = await (0, whatsapp_dispatcher_1.sendWhatsAppTemplate)(integrationsId, {
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
                    });
                    processedResult = {
                        kind: 'wa_template',
                        waMetaTemplateSent: !!sendRes.success,
                        waTemplateMessageId: sendRes.messageId,
                        templateName,
                        languageCode,
                        error: sendRes.error
                    };
                    if (!sendRes.success) {
                        throw new Error(sendRes.error || 'Falha ao enviar template WhatsApp Meta');
                    }
                    ;
                    this.context.data.__flow_meta_outbound_already_sent = true;
                    logger_1.default.info(`[FlowExecutor] wa_template enviado nodeId=${nodeId} template=${templateName}`);
                    break;
                }
                case 'hubspot_whatsapp_campaign': {
                    processedResult = await this.executeHubSpotWhatsAppCampaign(node);
                    logger_1.default.info(`[FlowExecutor] hubspot_whatsapp_campaign nodeId=${nodeId} matched=${processedResult.matchedContacts} prepared=${processedResult.contactsReadyForCampaign}`);
                    break;
                }
                case 'whatsapp_message': {
                    const d = node.data || {};
                    const integrationsId = String(d.waIntegrationId || this.context.data.integrations_id || this.context.data.integration_id || '').trim();
                    const to = String(this.context.data.whatsapp_contact_id || this.context.data.phone_number || '').trim();
                    const messageType = (String(d.waMessageType || 'text').trim() || 'text');
                    const messageText = String(d.waMessageText || '').trim();
                    const buttons = Array.isArray(d.waButtons)
                        ? d.waButtons.filter((button) => String(button?.text || '').trim())
                        : [];
                    if (!integrationsId || !to || !messageText) {
                        throw new Error('whatsapp_message: integrations_id, destino (whatsapp_contact_id) e waMessageText sao obrigatorios');
                    }
                    const agentFromCtx = this.context.data.agent_id || this.context.data.agentId;
                    const agentId = agentFromCtx != null && String(agentFromCtx).trim() !== '' ? String(agentFromCtx).trim() : undefined;
                    const sendRes = await (0, whatsapp_flow_message_service_1.sendFlowWhatsAppMessage)({
                        integrationsId,
                        to,
                        flowId: this.context.flowId,
                        flowExecutionId: this.context.executionId,
                        agentId,
                        requestStartedAt: String(this.context.data.request_started_at || '').trim() || undefined,
                        nodeId,
                        label: String(d.label || '').trim() || undefined,
                        messageType,
                        messageText,
                        buttons,
                        linkUrl: String(d.waLinkUrl || '').trim() || undefined,
                        reminderAt: String(d.waReminderAt || '').trim() || undefined,
                        fallbackTemplateName: String(d.waFallbackTemplateName || '').trim() || undefined,
                        fallbackTemplateLanguage: String(d.waFallbackTemplateLanguage || '').trim() || undefined
                    });
                    processedResult = {
                        kind: 'whatsapp_message',
                        sendMode: sendRes.sendMode || null,
                        messageType,
                        messageText,
                        templateName: sendRes.templateName || null,
                        languageCode: sendRes.languageCode || null,
                        userMessage: sendRes.userMessage || null,
                        error: sendRes.error
                    };
                    if (!sendRes.success) {
                        throw new Error(sendRes.userMessage || sendRes.error || 'Falha ao enviar mensagem WhatsApp');
                    }
                    ;
                    this.context.data.__flow_whatsapp_outbound_already_sent = true;
                    logger_1.default.info(`[FlowExecutor] whatsapp_message enviado nodeId=${nodeId} mode=${sendRes.sendMode || 'unknown'}`);
                    break;
                }
                case 'email_send': {
                    const d = node.data || {};
                    const emailIntegrationId = String(d.emailIntegrationId ||
                        this.context.data.email_integration_id ||
                        this.context.data.emailIntegrationId ||
                        '').trim();
                    const to = this.renderContextTemplate(d.emailTo ||
                        this.context.data.recipient_email ||
                        this.context.data.contact_email ||
                        this.context.data.lead_email ||
                        this.context.data.email ||
                        '').trim();
                    const subject = this.renderContextTemplate(d.emailSubject || '').trim();
                    const text = this.renderContextTemplate(d.emailText || '').trim();
                    if (!emailIntegrationId || !to || !subject || !text) {
                        throw new Error('email_send: emailIntegrationId, destinatario, assunto e corpo sao obrigatorios');
                    }
                    const sendRes = await (0, email_service_1.sendEmail)(emailIntegrationId, {
                        to,
                        subject,
                        text,
                    });
                    processedResult = {
                        kind: 'email_send',
                        integrationId: emailIntegrationId,
                        to,
                        subject,
                        provider: sendRes.provider,
                        message: 'Email enviado com sucesso.',
                    };
                    logger_1.default.info(`[FlowExecutor] email_send enviado nodeId=${nodeId} integrationId=${emailIntegrationId} to=${to}`);
                    break;
                }
                case 'email_read': {
                    const d = node.data || {};
                    const emailIntegrationId = String(d.emailIntegrationId ||
                        this.context.data.email_integration_id ||
                        this.context.data.emailIntegrationId ||
                        '').trim();
                    const limitRaw = typeof d.emailReadLimit === 'number'
                        ? d.emailReadLimit
                        : parseInt(String(d.emailReadLimit || '5'), 10);
                    const limit = Number.isFinite(limitRaw)
                        ? Math.min(Math.max(Number(limitRaw) || 5, 1), 20)
                        : 5;
                    if (!emailIntegrationId) {
                        throw new Error('email_read: emailIntegrationId e obrigatorio');
                    }
                    const messages = await (0, mail_1.readInboxMessages)(emailIntegrationId, limit);
                    processedResult = {
                        kind: 'email_read',
                        integrationId: emailIntegrationId,
                        total: messages.length,
                        messages,
                    };
                    logger_1.default.info(`[FlowExecutor] email_read executado nodeId=${nodeId} integrationId=${emailIntegrationId} total=${messages.length}`);
                    break;
                }
                case 'agent':
                    await runAgentBranch();
                    break;
                default:
                    await runAgentBranch();
                    break;
            }
            this.executedNodes.add(nodeId);
            this.appendExecutionHistory(node, nodeStartedAt, {
                success: true,
                output: processedResult,
                input: agentHistoryInput,
                outputSummary: agentOutputSummary
            });
            if (!skipContextUpdate) {
                this.updateContextWithOutput(nodeId, processedResult);
            }
            else if (node.type === 'comment') {
                this.updateContextWithOutput(nodeId, { comment: processedResult.comment ?? '' });
            }
            if (!shouldContinue && node.type === 'stop') {
                logger_1.default.info(`[FlowExecutor] Execução interrompida pelo node de parada`);
                return;
            }
            if (!shouldContinue && node.type === 'loop') {
                logger_1.default.info(`[FlowExecutor] Loop completado, continuando para próximos nodes`);
            }
            const nextNodes = this.getNextNodes(nodeId, node.type === 'if-else' || node.type === 'wa_session_window' ? ifElseBranch : undefined);
            logger_1.default.info(`[FlowExecutor] Node ${nodeId} executado. Próximos nodes encontrados: ${nextNodes.length}`);
            if (nextNodes.length === 0) {
                logger_1.default.log(`[FlowExecutor] Nenhum próximo node encontrado para ${nodeId}. Edges disponíveis:`, this.flowData.edges.map((e) => `${e.source} -> ${e.target}`));
            }
            else {
                logger_1.default.log(`[FlowExecutor] Executando próximos nodes:`, nextNodes.map((n) => `${n.id} (${n.data.label})`));
            }
            for (const nextNode of nextNodes) {
                await this.executeNode(nextNode.id);
            }
        }
        catch (error) {
            logger_1.default.error(`[FlowExecutor] Erro ao executar node ${nodeId} (tipo: ${node.type}): ${error.message}`, error);
            const executionRef = this.getNodeExecutionRef(node);
            await this.saveWorkflowNodeLog(nodeId, executionRef.agentId, false, null, error.message, executionRef.templateId);
            let failInput = undefined;
            if (preparedAgentMessage !== undefined) {
                failInput = {
                    messagePreview: preparedAgentMessage.substring(0, 400),
                    messageLength: preparedAgentMessage.length
                };
            }
            else if (node.type === 'if-else') {
                failInput = { condition: node.data.condition || '' };
            }
            else if (node.type === 'delay') {
                failInput = { duration: node.data.duration };
            }
            else if (node.type === 'loop') {
                failInput = {
                    flowId: node.data.flowId,
                    iterations: node.data.iterations,
                    infinite: node.data.infinite
                };
            }
            this.appendExecutionHistory(node, nodeStartedAt, {
                success: false,
                error: error.message,
                input: failInput,
                output: { failedNodeType: node.type }
            });
            throw error;
        }
    }
    /**
     * Prepara o input para um node baseado no contexto e dados dos nodes anteriores
     * O Flow orquestra e prepara os dados para cada agente
     */
    prepareNodeInput(node) {
        // Coleta todos os dados disponíveis (iniciais + predecessores)
        const allData = {
            ...this.context.data,
            ...this.collectPredecessorData(node.id)
        };
        // Se é o node inicial, usa dados iniciais do contexto
        if (node.id === this.flowData.startNodeId) {
            // Formata mensagem clara para o agente
            const dataSummary = Object.keys(allData).length > 0
                ? `\n\nDados disponíveis:\n${JSON.stringify(allData, null, 2)}`
                : '';
            return `Execute sua tarefa como agente "${node.data.label}".${dataSummary}`;
        }
        // Para nodes subsequentes, coleta dados dos nodes predecessores
        const predecessorData = this.collectPredecessorData(node.id);
        const predecessorSummary = Object.keys(predecessorData).length > 0
            ? `\n\nDados recebidos dos nodes anteriores:\n${JSON.stringify(predecessorData, null, 2)}`
            : '';
        const contextSummary = Object.keys(this.context.data).length > 0
            ? `\n\nContexto global:\n${JSON.stringify(this.context.data, null, 2)}`
            : '';
        const finalMessage = `Execute sua tarefa como agente "${node.data.label}".${predecessorSummary}${contextSummary}`;
        logger_1.default.log(`[FlowExecutor] Input preparado para node ${node.id}:`, {
            predecessorDataKeys: Object.keys(predecessorData),
            contextDataKeys: Object.keys(this.context.data),
            messageLength: finalMessage.length,
            messagePreview: finalMessage.substring(0, 300) + '...'
        });
        return finalMessage;
    }
    /**
     * Coleta dados dos nodes predecessores (que apontam para este node)
     */
    collectPredecessorData(nodeId) {
        const predecessorData = {};
        // Encontra edges que apontam para este node
        const incomingEdges = this.flowData.edges.filter(e => e.target === nodeId);
        for (const edge of incomingEdges) {
            const predecessorNode = this.flowData.nodes.find(n => n.id === edge.source);
            if (predecessorNode && this.executedNodes.has(edge.source)) {
                // Busca o resultado do node predecessor no histórico
                const predecessorResult = this.context.executionHistory.find(h => h.nodeId === edge.source);
                if (predecessorResult?.output) {
                    // Adiciona os dados do predecessor com prefixo do nodeId para evitar conflitos
                    predecessorData[`${predecessorNode.id}_output`] = predecessorResult.output;
                    // Também mescla diretamente se for um objeto
                    if (typeof predecessorResult.output === 'object') {
                        Object.assign(predecessorData, predecessorResult.output);
                    }
                }
            }
        }
        return predecessorData;
    }
    /**
     * Executa o agente do node
     * O Flow orquestra e chama o agente com os dados preparados
     */
    async executeAgent(node, input) {
        const executionMode = this.resolveNodeExecutionMode(node);
        if (executionMode === 'template') {
            return this.executeTemplateNode(node, input);
        }
        return this.executeAgentLegacy(node, input);
    }
    async executeTemplateNode(node, input) {
        try {
            if (!node.data.templateId) {
                throw new Error(`Template ID não encontrado no node ${node.id}`);
            }
            const allContext = {
                ...this.context.data,
                ...this.collectPredecessorData(node.id)
            };
            if (!allContext.originalMessage && !allContext.userMessage) {
                if (!input.includes('Execute sua tarefa como agente') && !input.includes('Dados recebidos dos nodes anteriores')) {
                    allContext.originalMessage = input;
                    allContext.userMessage = input;
                }
                else if (this.context.data.message || this.context.data.originalMessage || this.context.data.userMessage) {
                    allContext.originalMessage = this.context.data.originalMessage || this.context.data.userMessage || this.context.data.message;
                    allContext.userMessage = this.context.data.originalMessage || this.context.data.userMessage || this.context.data.message;
                }
            }
            logger_1.default.info(`[FlowExecutor] Executando template ${node.data.templateId} (${node.data.templateName || node.data.label}) no node ${node.id}`);
            logger_1.default.log(`[FlowExecutor] Contexto do template ${node.id}:`, {
                contextKeys: Object.keys(allContext),
                hasAdditionalInstructions: !!node.data.additionalInstructions
            });
            const result = await (0, flow_template_runner_1.executeFlowTemplateNode)({
                userEmail: this.context.userEmail,
                templateId: node.data.templateId,
                message: input,
                context: allContext,
                additionalInstructions: node.data.additionalInstructions
            });
            logger_1.default.log(`[FlowExecutor] Resultado bruto do template ${node.id}:`, {
                type: typeof result,
                preview: typeof result === 'string' ? result.substring(0, 200) : JSON.stringify(result).substring(0, 200)
            });
            return result;
        }
        catch (error) {
            logger_1.default.error(`[FlowExecutor] Erro ao executar template ${node.data.templateId}: ${error.message}`, error);
            throw new Error(`Falha ao executar template ${node.data.label}: ${error.message}`);
        }
    }
    async executeAgentLegacy(node, input) {
        try {
            // O input já vem formatado como string (mensagem para o agente)
            const message = input;
            logger_1.default.info(`[FlowExecutor] 🎯 Orquestrando execução do node ${node.id}`);
            logger_1.default.info(`[FlowExecutor] 📤 Chamando agente ${node.data.agentId} (${node.data.label})`);
            logger_1.default.log(`[FlowExecutor] Mensagem: ${message.substring(0, 200)}...`);
            // Combina contexto global + dados dos predecessores para passar ao agente
            const allContext = {
                ...this.context.data,
                ...this.collectPredecessorData(node.id)
            };
            // 🎯 IMPORTANTE: Armazenar a mensagem original do usuário no contexto
            // Se a mensagem original estiver em initialData ou no contexto, preserva para cálculo de confiança
            // A mensagem original pode estar em: initialMessage, userMessage, originalMessage, ou message (se não for instrução do flow)
            if (!allContext.originalMessage && !allContext.userMessage) {
                // Se a mensagem atual não parece ser uma instrução do flow, pode ser a mensagem original
                if (!message.includes('Execute sua tarefa como agente') && !message.includes('Dados recebidos dos nodes anteriores')) {
                    allContext.originalMessage = message;
                    allContext.userMessage = message;
                }
                else if (this.context.data.message || this.context.data.originalMessage || this.context.data.userMessage) {
                    // Se a mensagem é uma instrução do flow, busca a mensagem original do contexto
                    allContext.originalMessage = this.context.data.originalMessage || this.context.data.userMessage || this.context.data.message;
                    allContext.userMessage = this.context.data.originalMessage || this.context.data.userMessage || this.context.data.message;
                }
            }
            logger_1.default.log(`[FlowExecutor] Contexto para substituição de templates no node ${node.id}:`, {
                contextKeys: Object.keys(allContext),
                contextData: allContext,
                originalMessage: allContext.originalMessage || allContext.userMessage || 'não encontrada'
            });
            // O Flow orquestra - o agente apenas executa
            // Chama o serviço de chat do agente (já existente) passando o contexto para substituição de templates
            if (!node.data.agentId) {
                throw new Error(`Agent ID não encontrado no node ${node.id}`);
            }
            if (node.data.skipReplyConfidence === true) {
                allContext.flow_skip_reply_confidence = true;
            }
            const result = await (0, chatwithAgent_1.chatWithAgent)(this.context.userEmail, node.data.agentId, message, allContext // Passa o contexto para substituição de templates
            );
            // ✅ Detectar se o agente caiu no inbox (retorna string vazia quando bloqueado)
            const agentBlocked = result === '' || (typeof result === 'string' && result.trim() === '');
            if (agentBlocked) {
                // Buscar informações do agente para o log
                const { data: agentData } = await supabase_1.supabase
                    .from('tb_agents')
                    .select('nome')
                    .eq('id', node.data.agentId)
                    .maybeSingle();
                const agentName = agentData?.nome || node.data.agentId;
                // ✅ Salvar log específico quando agente cai no inbox
                await this.saveWorkflowNodeLog(node.id, node.data.agentId, false, // Não é sucesso, mas não é erro fatal
                null, `Agente "${agentName}" bloqueado - resposta enviada para aprovação no inbox`);
                logger_1.default.warn(`[FlowExecutor] ⚠️ Agente "${agentName}" (${node.data.agentId}) bloqueado - resposta caiu no inbox`);
            }
            logger_1.default.log(`[FlowExecutor] Resultado bruto do agente ${node.id}:`, {
                type: typeof result,
                isString: typeof result === 'string',
                isBlocked: agentBlocked,
                preview: typeof result === 'string' ? result.substring(0, 200) : JSON.stringify(result).substring(0, 200)
            });
            if (!agentBlocked) {
                logger_1.default.info(`[FlowExecutor] ✅ Agente ${node.data.agentId} executado com sucesso`);
                logger_1.default.log(`[FlowExecutor] Resultado: ${typeof result === 'string' ? result.substring(0, 100) : JSON.stringify(result).substring(0, 100)}...`);
            }
            // Retorna o resultado para ser passado aos próximos nodes
            return result;
        }
        catch (error) {
            logger_1.default.error(`[FlowExecutor] ❌ Erro ao executar agente ${node.data.agentId}: ${error.message}`, error);
            throw new Error(`Falha ao executar agente ${node.data.label}: ${error.message}`);
        }
    }
    /**
     * Atualiza o contexto com os dados de saída do node
     * Tenta fazer parse de JSON se o output for string
     */
    updateContextWithOutput(nodeId, output) {
        let parsedOutput = output;
        // Se o output é uma string, tenta fazer parse de JSON
        if (typeof output === 'string') {
            try {
                // Tenta fazer parse do JSON
                parsedOutput = JSON.parse(output);
                logger_1.default.log(`[FlowExecutor] JSON parseado do node ${nodeId}:`, parsedOutput);
            }
            catch (e) {
                // Se não for JSON válido, mantém como string
                logger_1.default.log(`[FlowExecutor] Output do node ${nodeId} não é JSON, mantendo como string`);
            }
        }
        // Adiciona os dados de saída ao contexto global
        if (typeof parsedOutput === 'object' && parsedOutput !== null && !Array.isArray(parsedOutput)) {
            // Se for objeto, mescla diretamente no contexto
            Object.assign(this.context.data, parsedOutput);
            logger_1.default.log(`[FlowExecutor] Dados do node ${nodeId} mesclados no contexto:`, Object.keys(parsedOutput));
        }
        else {
            // Se for string, array ou outro tipo, guarda com prefixo do nodeId
            this.context.data[`${nodeId}_output`] = parsedOutput;
            logger_1.default.log(`[FlowExecutor] Dados do node ${nodeId} guardados como ${nodeId}_output`);
        }
    }
    /**
     * Encontra os próximos nodes (sucessores) conectados a este node
     */
    getNextNodes(nodeId, conditionResult) {
        const outgoingEdges = this.flowData.edges.filter(e => e.source === nodeId);
        logger_1.default.log(`[FlowExecutor] Buscando próximos nodes para ${nodeId}. Edges encontradas: ${outgoingEdges.length}`, outgoingEdges.map(e => `${e.source} -> ${e.target}`));
        // Se for um if-else e tiver resultado da condição, filtra pelo sourceHandle
        let filteredEdges = outgoingEdges;
        if (conditionResult !== undefined) {
            const expectedHandle = conditionResult ? 'true' : 'false';
            filteredEdges = outgoingEdges.filter(e => e.sourceHandle === expectedHandle);
            logger_1.default.log(`[FlowExecutor] Filtrado para sourceHandle '${expectedHandle}': ${filteredEdges.length} edges`);
        }
        const nextNodeIds = filteredEdges.map(e => e.target);
        const nextNodes = this.flowData.nodes.filter(n => nextNodeIds.includes(n.id));
        logger_1.default.log(`[FlowExecutor] Nodes encontrados: ${nextNodes.length}`, nextNodes.map(n => n.id));
        return nextNodes;
    }
    /**
     * Avalia uma condição usando o contexto atual
     */
    evaluateCondition(condition, nodeId) {
        if (!condition || condition.trim() === '') {
            logger_1.default.warn(`[FlowExecutor] Condição vazia no node ${nodeId}, retornando false`);
            return false;
        }
        try {
            // Substitui variáveis do contexto no formato {{variavel}}
            let evaluatedCondition = condition;
            const context = this.context.data;
            // Substitui todas as variáveis {{variavel}} pelos valores do contexto
            // Usa Set para evitar duplicatas de variáveis faltando (se a mesma variável aparecer múltiplas vezes)
            const missingVariablesSet = new Set();
            evaluatedCondition = evaluatedCondition.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
                const value = context[varName];
                if (value === undefined || value === null) {
                    // Adiciona ao Set (evita duplicatas se a mesma variável aparecer múltiplas vezes na condição)
                    missingVariablesSet.add(varName);
                    logger_1.default.warn(`[FlowExecutor] Variável ${varName} não encontrada no contexto, usando fallback`);
                    return 'undefined';
                }
                // Se for string, adiciona aspas, senão converte para string
                return typeof value === 'string' ? `'${value}'` : String(value);
            });
            // Converte Set para Array (remove duplicatas)
            const missingVariables = Array.from(missingVariablesSet);
            // Se houve variáveis faltando, pode precisar usar fallback na avaliação
            if (missingVariables.length > 0) {
                logger_1.default.warn(`[FlowExecutor] ⚠️ FALLBACK: ${missingVariables.length} variável(is) faltando na condição: ${missingVariables.join(', ')}`);
            }
            logger_1.default.log(`[FlowExecutor] Condição original: ${condition}`);
            logger_1.default.log(`[FlowExecutor] Condição avaliada: ${evaluatedCondition}`);
            // 🎯 FALLBACK: Se a condição contém 'undefined', usa fallback (retorna false por padrão)
            let usedFallback = false;
            let fallbackResult = false;
            // ✅ Salva eventos APENAS UMA VEZ quando há variáveis faltando
            if (evaluatedCondition.includes('undefined') && missingVariables.length > 0) {
                usedFallback = true;
                fallbackResult = false; // Fallback padrão: condição falsa quando variável não existe
                logger_1.default.warn(`[FlowExecutor] ⚠️ FALLBACK: Condição contém 'undefined', usando resultado padrão: false`);
                // ✅ Garantir que user_id seja passado corretamente (não string vazia)
                const userIdForFallback = (this.context.userId && this.context.userId.trim() !== '') ? this.context.userId : undefined;
                logger_1.default.log(`[FlowExecutor] Salvando fallback consolidado para condição:`, {
                    missing_variables: missingVariables,
                    user_id: userIdForFallback || 'undefined',
                    workflow_id: this.context.flowId,
                    node_id: nodeId
                });
                // ✅ Salva APENAS UM evento consolidado com todas as variáveis faltando
                // Isso evita duplicação: um evento por variável + um evento de condição = muitos eventos
                // Agora: apenas um evento consolidado com todas as informações
                (0, fallback_events_1.saveFallbackEvent)({
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
                    logger_1.default.error('[FlowExecutor] Erro ao salvar evento de fallback:', err);
                });
            }
            const normalizedCondition = evaluatedCondition
                .replace(/\s+contem\s+/gi, ' contém ')
                .replace(/\s+nao contem\s+/gi, ' não contém ')
                .replace(/\s+esta vazio/gi, ' está vazio')
                .replace(/\s+nao esta vazio/gi, ' não está vazio')
                .replace(/\s+comeca com\s+/gi, ' começa com ');
            // Avalia operadores de texto
            if (normalizedCondition.includes(' contém ')) {
                const [left, right] = normalizedCondition.split(' contém ').map(s => s.trim().replace(/^'|'$/g, ''));
                const result = usedFallback ? fallbackResult : String(left).includes(String(right));
                logger_1.default.log(`[FlowExecutor] Avaliação 'contém': "${left}" contém "${right}" = ${result}${usedFallback ? ' (FALLBACK)' : ''}`);
                return result;
            }
            if (normalizedCondition.includes(' não contém ')) {
                const [left, right] = normalizedCondition.split(' não contém ').map(s => s.trim().replace(/^'|'$/g, ''));
                const result = usedFallback ? fallbackResult : !String(left).includes(String(right));
                logger_1.default.log(`[FlowExecutor] Avaliação 'não contém': "${left}" não contém "${right}" = ${result}${usedFallback ? ' (FALLBACK)' : ''}`);
                return result;
            }
            if (normalizedCondition.includes(' está vazio')) {
                const left = normalizedCondition.split(' está vazio')[0].trim().replace(/^'|'$/g, '');
                const result = usedFallback ? fallbackResult : (!left || left === 'undefined' || left === '');
                logger_1.default.log(`[FlowExecutor] Avaliação 'está vazio': "${left}" = ${result}${usedFallback ? ' (FALLBACK)' : ''}`);
                return result;
            }
            if (normalizedCondition.includes(' não está vazio')) {
                const left = normalizedCondition.split(' não está vazio')[0].trim().replace(/^'|'$/g, '');
                const result = usedFallback ? fallbackResult : !!(left && left !== 'undefined' && left !== '');
                logger_1.default.log(`[FlowExecutor] Avaliação 'não está vazio': "${left}" = ${result}${usedFallback ? ' (FALLBACK)' : ''}`);
                return result;
            }
            // Se usou fallback mas não entrou em nenhum operador específico, retorna o fallback
            if (usedFallback) {
                return fallbackResult;
            }
            if (normalizedCondition.includes(' começa com ')) {
                const [left, right] = normalizedCondition.split(' começa com ').map(s => s.trim().replace(/^'|'$/g, ''));
                const result = String(left).startsWith(String(right));
                logger_1.default.log(`[FlowExecutor] Avaliação 'começa com': "${left}" começa com "${right}" = ${result}`);
                return result;
            }
            if (normalizedCondition.includes(' termina com ')) {
                const [left, right] = normalizedCondition.split(' termina com ').map(s => s.trim().replace(/^'|'$/g, ''));
                const result = String(left).endsWith(String(right));
                logger_1.default.log(`[FlowExecutor] Avaliação 'termina com': "${left}" termina com "${right}" = ${result}`);
                return result;
            }
            // Avalia operadores numéricos e de igualdade
            // Remove aspas simples para comparação
            evaluatedCondition = normalizedCondition.replace(/'/g, '');
            // Substitui operadores por JavaScript
            evaluatedCondition = evaluatedCondition.replace(/==/g, '===');
            evaluatedCondition = evaluatedCondition.replace(/!=/g, '!==');
            // Usa Function para avaliar de forma segura (apenas comparações)
            const safeCondition = evaluatedCondition.replace(/[^a-zA-Z0-9_$.\s=<>!&|()'"]/g, '');
            const result = new Function('return ' + safeCondition)();
            logger_1.default.log(`[FlowExecutor] Resultado da avaliação: ${result}`);
            return Boolean(result);
        }
        catch (error) {
            logger_1.default.error(`[FlowExecutor] Erro ao avaliar condição "${condition}": ${error.message}`);
            return false;
        }
    }
    /**
     * Executa um loop - executa um fluxo completo repetidamente
     */
    async executeLoop(node) {
        const iterations = node.data.infinite ? Infinity : parseInt(String(node.data.iterations || 1));
        const flowIdRaw = node.data.flowId;
        const flowId = typeof flowIdRaw === 'string' ? flowIdRaw.trim() : String(flowIdRaw || '').trim();
        if (!flowId) {
            throw new Error('Loop: flowId não definido ou vazio.');
        }
        if (flowId === this.context.flowId) {
            logger_1.default.error(`[FlowExecutor] Tentativa de executar o próprio flow em loop (recursão infinita). Flow ${flowId} não pode executar a si mesmo.`);
            throw new Error(`Não é possível executar o próprio flow em loop. Isso causaria recursão infinita.`);
        }
        logger_1.default.info(`[FlowExecutor] nodeId=${node.id} type=loop start subFlowId=${flowId} ${node.data.infinite ? 'infinite' : `iterations=${iterations}`}`);
        let iteration = 0;
        while (node.data.infinite || iteration < iterations) {
            iteration++;
            logger_1.default.info(`[FlowExecutor] nodeId=${node.id} type=loop iteration=${iteration}${node.data.infinite ? ' (infinite)' : `/${iterations}`} subFlowId=${flowId}`);
            let query = supabase_1.supabase.from('tb_flows').select('nodes').eq('id', flowId);
            if (this.context.companiesId) {
                query = query.eq('companies_id', this.context.companiesId);
            }
            else {
                const { getCompanyIdByEmail } = await Promise.resolve().then(() => __importStar(require('../../utils/company-helper')));
                const companiesId = await getCompanyIdByEmail(this.context.userEmail);
                if (companiesId) {
                    query = query.eq('companies_id', companiesId);
                }
                else {
                    query = query.eq('user_email', this.context.userEmail);
                }
            }
            const { data, error } = await query.single();
            if (error || !data) {
                logger_1.default.error(`[FlowExecutor] Flow ${flowId} não encontrado no loop:`, error);
                throw new Error(`Loop: fluxo subordinado não encontrado (flowId=${flowId})`);
            }
            const subFlowData = data?.nodes;
            if (!subFlowData || !Array.isArray(subFlowData.nodes) || subFlowData.nodes.length === 0) {
                throw new Error(`Loop: dados do fluxo subordinado inválidos (flowId=${flowId})`);
            }
            const subContext = {
                flowId: flowId,
                userId: this.context.userId,
                companiesId: this.context.companiesId,
                userEmail: this.context.userEmail,
                executionId: this.context.executionId,
                data: { ...this.context.data },
                executionHistory: []
            };
            const subExecutor = new FlowExecutor(subFlowData, subContext);
            const subResult = await subExecutor.execute();
            Object.assign(this.context.data, subResult.data);
            this.context.executionHistory.push(...subResult.executionHistory);
            logger_1.default.info(`[FlowExecutor] nodeId=${node.id} type=loop subFlowId=${flowId} iteration=${iteration} ok`);
            if (!node.data.infinite && iteration >= iterations) {
                break;
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
        logger_1.default.info(`[FlowExecutor] nodeId=${node.id} type=loop completed totalIterations=${iteration}`);
    }
    /**
     * Salva log de execução de um node do workflow
     */
    /**
     * Formata o output do agente para exibição legível (sem JSON puro)
     */
    formatAgentOutput(output) {
        if (!output)
            return 'Sem resposta';
        if (typeof output === 'string') {
            // Se for string, retorna até 150 caracteres
            return output.length > 150 ? output.substring(0, 150) + '...' : output;
        }
        if (typeof output === 'object') {
            // Se for objeto, tenta extrair informações relevantes
            if (output.message) {
                const msg = String(output.message);
                return msg.length > 150 ? msg.substring(0, 150) + '...' : msg;
            }
            if (output.answer) {
                const ans = String(output.answer);
                return ans.length > 150 ? ans.substring(0, 150) + '...' : ans;
            }
            if (output.content) {
                const cont = String(output.content);
                return cont.length > 150 ? cont.substring(0, 150) + '...' : cont;
            }
            if (output.action) {
                const actionDesc = output.action === 'reply' ? 'Resposta enviada' :
                    output.action === 'send_whatsapp' ? 'WhatsApp enviado' :
                        output.action === 'send_email' ? 'Email enviado' :
                            `Ação: ${output.action}`;
                const msg = output.message ? String(output.message) : '';
                if (msg) {
                    const fullMsg = `${actionDesc} - ${msg}`;
                    return fullMsg.length > 150 ? fullMsg.substring(0, 150) + '...' : fullMsg;
                }
                return actionDesc;
            }
            // ✅ Se for objeto simples com poucos campos, formata de forma legível
            const keys = Object.keys(output);
            if (keys.length === 1) {
                // Objeto com 1 campo: mostra chave e valor
                const key = keys[0];
                const value = output[key];
                if (typeof value === 'boolean') {
                    return `${key}: ${value ? 'sim' : 'não'}`;
                }
                if (typeof value === 'string' && value.length < 100) {
                    return `${key}: ${value}`;
                }
                return `${key}: ${typeof value}`;
            }
            if (keys.length <= 3) {
                // Objeto com poucos campos: formata como lista
                const parts = keys.map(k => {
                    const v = output[k];
                    if (typeof v === 'boolean')
                        return `${k}=${v ? 'sim' : 'não'}`;
                    if (typeof v === 'string' && v.length < 50)
                        return `${k}="${v}"`;
                    return `${k}=${typeof v}`;
                });
                return parts.join(', ');
            }
            // Objeto complexo: apenas indica tipo
            return `Objeto com ${keys.length} campos`;
        }
        return String(output);
    }
    /**
     * Busca nome do agente para usar nos logs
     */
    async getAgentName(agentId) {
        try {
            const { data: agentData } = await supabase_1.supabase
                .from('tb_agents')
                .select('nome')
                .eq('id', agentId)
                .maybeSingle();
            return agentData?.nome || agentId;
        }
        catch {
            return agentId;
        }
    }
    async getTemplateName(templateId) {
        try {
            let query = supabase_1.supabase
                .from('tb_agents_templates')
                .select('name, companies_id')
                .eq('id', templateId);
            if (this.context.companiesId) {
                query = query.or(`companies_id.eq.${this.context.companiesId},companies_id.is.null`);
            }
            else {
                query = query.is('companies_id', null);
            }
            const { data: templateData } = await query.maybeSingle();
            return templateData?.name || templateId;
        }
        catch {
            return templateId;
        }
    }
    async saveWorkflowNodeLog(nodeId, agentId, success, output, error, templateId) {
        // ✅ Só loga erros - sucessos não são logados para não poluir a tela
        if (success && !error) {
            return;
        }
        try {
            // Buscar companies_id do contexto ou do workflow
            let companiesId = this.context.companiesId;
            if (!companiesId && this.context.flowId) {
                const { data: flowData } = await supabase_1.supabase
                    .from('tb_flows')
                    .select('companies_id, user_email')
                    .eq('id', this.context.flowId)
                    .maybeSingle();
                if (flowData?.companies_id) {
                    companiesId = flowData.companies_id;
                }
                else if (flowData?.user_email) {
                    const { getCompanyIdByEmail } = await Promise.resolve().then(() => __importStar(require('../../utils/company-helper')));
                    const companyId = await getCompanyIdByEmail(flowData.user_email);
                    companiesId = companyId || undefined; // Converte null para undefined
                }
            }
            // Buscar nome do agente e do node
            const resourceType = templateId ? 'template' : 'agent';
            const resourceName = templateId
                ? await this.getTemplateName(templateId)
                : agentId
                    ? await this.getAgentName(agentId)
                    : 'recurso desconhecido';
            const node = this.flowData.nodes.find(n => n.id === nodeId);
            const nodeLabel = node?.data?.label || nodeId;
            // ✅ Formatar mensagem de forma legível (sem JSON puro)
            const message = error || `Erro ao executar ${resourceType} "${resourceName}" no node "${nodeLabel}"`;
            await (0, system_logs_1.saveSystemLog)({
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
            });
        }
        catch (err) {
            logger_1.default.warn(`[FlowExecutor] Erro ao salvar log de node: ${err.message}`);
            // Não quebra a execução se falhar ao salvar log
        }
    }
    /**
     * Salva log de execução completa do workflow
     */
    async saveWorkflowExecutionCompleted(success, error) {
        try {
            // Buscar companies_id do contexto ou do workflow
            let companiesId = this.context.companiesId;
            logger_1.default.log(`[saveWorkflowExecutionCompleted] 🔍 Buscando companies_id:`, {
                hasContextCompaniesId: !!this.context.companiesId,
                contextCompaniesId: this.context.companiesId,
                flowId: this.context.flowId,
                userEmail: this.context.userEmail
            });
            if (!companiesId && this.context.flowId) {
                const { data: flowData } = await supabase_1.supabase
                    .from('tb_flows')
                    .select('companies_id, user_email')
                    .eq('id', this.context.flowId)
                    .maybeSingle();
                logger_1.default.log(`[saveWorkflowExecutionCompleted] 📋 Dados do flow:`, {
                    hasFlowData: !!flowData,
                    flowCompaniesId: flowData?.companies_id,
                    flowUserEmail: flowData?.user_email
                });
                if (flowData?.companies_id) {
                    companiesId = flowData.companies_id;
                    logger_1.default.log(`[saveWorkflowExecutionCompleted] ✅ companies_id do flow: ${companiesId}`);
                }
                else if (flowData?.user_email) {
                    const { getCompanyIdByEmail } = await Promise.resolve().then(() => __importStar(require('../../utils/company-helper')));
                    const companyId = await getCompanyIdByEmail(flowData.user_email);
                    companiesId = companyId || undefined; // Converte null para undefined
                    logger_1.default.log(`[saveWorkflowExecutionCompleted] ✅ companies_id via email: ${companiesId}`);
                }
            }
            // ✅ FALLBACK: Se ainda não tem companies_id, tenta buscar via userEmail do contexto
            if (!companiesId && this.context.userEmail) {
                const { getCompanyIdByEmail } = await Promise.resolve().then(() => __importStar(require('../../utils/company-helper')));
                const companyId = await getCompanyIdByEmail(this.context.userEmail);
                companiesId = companyId || undefined;
                logger_1.default.log(`[saveWorkflowExecutionCompleted] ✅ companies_id via contexto userEmail: ${companiesId}`);
            }
            if (!companiesId) {
                logger_1.default.warn(`[saveWorkflowExecutionCompleted] ⚠️ companies_id não encontrado! Log pode não ser salvo corretamente.`);
            }
            // Buscar nome do workflow para o log
            let workflowName = this.context.flowId;
            try {
                const { data: flowData } = await supabase_1.supabase
                    .from('tb_flows')
                    .select('nome')
                    .eq('id', this.context.flowId)
                    .maybeSingle();
                if (flowData?.nome) {
                    workflowName = flowData.nome;
                }
            }
            catch {
                // Ignora erro ao buscar nome
            }
            // ✅ Formatar mensagem de forma legível
            const message = success
                ? `Workflow "${workflowName}" executado com sucesso. ${this.executedNodes.size} de ${this.flowData.nodes.length} node(s) executado(s).`
                : `Erro ao executar workflow "${workflowName}": ${error || 'Erro desconhecido'}`;
            const logResult = await (0, system_logs_1.saveSystemLog)({
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
            });
            if (logResult.success) {
                logger_1.default.log(`[saveWorkflowExecutionCompleted] ✅ Log salvo com sucesso:`, {
                    logId: logResult.id,
                    companiesId,
                    success,
                    nodesExecuted: this.executedNodes.size
                });
            }
            else {
                logger_1.default.error(`[saveWorkflowExecutionCompleted] ❌ Erro ao salvar log:`, logResult.error);
            }
        }
        catch (err) {
            logger_1.default.warn(`[FlowExecutor] Erro ao salvar log de execução completa: ${err.message}`);
            // Não quebra a execução se falhar ao salvar log
        }
    }
}
exports.FlowExecutor = FlowExecutor;
