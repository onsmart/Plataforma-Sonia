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
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatWithAgent = chatWithAgent;
const openai_1 = require("../llm/openai");
const index_1 = require("./index");
const getagentfromcache_1 = require("./getagentfromcache");
const email_service_1 = require("../integrations/email/email.service");
const readEmailsWithAgent_1 = require("./readEmailsWithAgent");
const whatsapp_service_1 = require("../integrations/whatsapp/whatsapp.service");
const whatsapp_dispatcher_1 = require("../integrations/whatsapp/whatsapp.dispatcher");
const whatsapp_redis_1 = require("../integrations/whatsapp/whatsapp.redis");
const confidence_calculator_1 = require("./confidence-calculator");
const save_decision_1 = require("./save-decision");
const system_logs_1 = require("../system-logs");
const consultarArquivos_1 = require("./consultarArquivos");
const company_helper_1 = require("../../utils/company-helper");
const prompt_builder_1 = require("./prompt-builder");
const voiceRuntime_service_1 = require("../../modules/voice/services/voiceRuntime.service");
// Esquema de resposta estruturada para garantir que a IA não retorne null e mantenha o formato JSON
// Nota: O campo 'messages' não está no schema porque o código busca as mensagens do banco quando action é 'read_whatsapp_db'
// Nota: 'message' é obrigatório no schema (OpenAI strict mode exige), mas pode ser string vazia para ações que não precisam
const AGENT_RESPONSE_SCHEMA = {
    type: "json_schema",
    json_schema: {
        name: "agent_response",
        strict: true,
        schema: {
            type: "object",
            additionalProperties: false,
            required: ["action", "message"],
            properties: {
                action: {
                    type: "string",
                    enum: ["reply", "send_whatsapp", "send_email", "read_whatsapp_db", "read_whatsapp_database", "read_whatsapp", "read_whatsapp_messages"]
                },
                message: {
                    type: "string"
                }
            }
        }
    }
};
/**
 * Salva uso de tokens na tabela tb_agent_token_usage
 */
async function saveTokenUsage(agentId, companiesId, usage, model, provider, userId, conversationId, metadata) {
    if (!companiesId || !usage || usage.total_tokens === 0) {
        console.warn('[saveTokenUsage] ⚠️ Não salvando tokens:', {
            hasCompaniesId: !!companiesId,
            companiesId,
            hasUsage: !!usage,
            totalTokens: usage?.total_tokens || 0
        });
        return; // Não salva se não tiver companies_id ou tokens
    }
    try {
        const { supabase } = await Promise.resolve().then(() => __importStar(require('../../lib/supabase')));
        const { data, error } = await supabase
            .from('tb_agent_token_usage')
            .insert({
            companies_id: companiesId,
            agent_id: agentId,
            user_id: userId || null,
            conversation_id: conversationId || null,
            input_tokens: usage.prompt_tokens,
            output_tokens: usage.completion_tokens,
            total_tokens: usage.total_tokens,
            model: model || 'gpt-4o',
            provider: provider || 'openai',
            metadata: metadata || {}
        })
            .select('id, companies_id')
            .single();
        if (error) {
            console.warn('[saveTokenUsage] ❌ Erro ao salvar uso de tokens:', {
                error: error.message,
                code: error.code,
                details: error.details,
                companiesId,
                agentId
            });
        }
        else {
            console.log('[saveTokenUsage] ✅ Uso de tokens salvo:', {
                id: data?.id,
                agentId,
                companiesId: data?.companies_id,
                totalTokens: usage.total_tokens,
                inputTokens: usage.prompt_tokens,
                outputTokens: usage.completion_tokens,
                model: model || 'gpt-4o'
            });
        }
    }
    catch (err) {
        console.warn('[saveTokenUsage] ❌ Erro ao salvar tokens:', {
            error: err.message,
            companiesId,
            agentId
        });
    }
}
// Variável para armazenar configuração de governança durante o processamento
let governanceConfigForDLP = null;
function safeLogPreview(value) {
    const normalized = String(value || '').trim();
    return normalized ? `[redacted chars=${normalized.length}]` : '';
}
function safeLogContextKeys(value) {
    return value ? Object.keys(value) : [];
}
function getPositiveIntFromEnv(name, fallback, minValue = 1) {
    const parsed = parseInt(process.env[name] || String(fallback), 10);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }
    return Math.max(parsed, minValue);
}
function shouldSkipHeavyContextLookup(message, context) {
    if (context?.force_rag === true) {
        return false;
    }
    if (String(context?.channel || '').trim().toLowerCase() === 'whatsapp_call') {
        return true;
    }
    const normalizedMessage = String(message || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    if (!normalizedMessage) {
        return true;
    }
    const wordCount = normalizedMessage.split(/\s+/).filter(Boolean).length;
    if (wordCount <= 3 && normalizedMessage.length <= 24) {
        return true;
    }
    if (/^(oi|ola|alo|hey|hello|e ai|bom dia|boa tarde|boa noite|tudo bem)$/.test(normalizedMessage)) {
        return true;
    }
    if (wordCount <= 7 &&
        /(sua finalidade|seu objetivo|quem e voce|o que voce faz|como pode ajudar|como voce pode ajudar)/.test(normalizedMessage)) {
        return true;
    }
    return false;
}
// Função auxiliar para aplicar DLP em uma mensagem
async function applyDLPToMessage(message) {
    if (!message || !governanceConfigForDLP)
        return message;
    try {
        const { applyDLP } = await Promise.resolve().then(() => __importStar(require('../governance')));
        return applyDLP(message, governanceConfigForDLP);
    }
    catch (err) {
        console.error('[applyDLPToMessage] Erro ao aplicar DLP:', err);
        return message; // Retorna original se falhar
    }
}
// Função auxiliar para extrair texto de mensagem, removendo JSON aninhado
function extractMessageText(msg) {
    // Se for string, tenta fazer parse
    if (typeof msg === 'string') {
        // Se começar com {, tenta fazer parse
        if (msg.trim().startsWith('{')) {
            try {
                const parsed = JSON.parse(msg);
                // Se tiver campo message, extrai recursivamente
                if (parsed.message) {
                    return extractMessageText(parsed.message);
                }
                // Se for um objeto send_whatsapp completo, extrai o message
                if (parsed.action === 'send_whatsapp' && parsed.message) {
                    return extractMessageText(parsed.message);
                }
                // Se não tiver campo message válido, retorna string vazia (evita enviar JSON)
                return '';
            }
            catch (e) {
                // Não é JSON válido, retorna a string original
                return msg;
            }
        }
        return msg;
    }
    // Se for objeto, procura campo message
    if (typeof msg === 'object' && msg !== null) {
        if (msg.message && typeof msg.message === 'string') {
            return extractMessageText(msg.message);
        }
        if (msg.action === 'send_whatsapp' && msg.message) {
            return extractMessageText(msg.message);
        }
        // Se for objeto sem campo message válido, retorna string vazia
        return '';
    }
    // Se não conseguir extrair, converte para string
    return String(msg);
}
const DEFAULT_MESSAGE = 'Olá! Como posso te ajudar hoje? 😊';
async function chatWithAgent(email, agentId, message, context // Contexto para substituição de templates
) {
    const confidenceApprovalThreshold = (0, confidence_calculator_1.getConfidenceApprovalThreshold)();
    // 1️⃣ Carrega agentes do usuário
    const agents = await (0, index_1.getAgentsByEmail)(email);
    const agent = (0, getagentfromcache_1.getAgentFromCache)(agents, agentId);
    // 🛡️ GUARDRAIL: Valida status_id ANTES de qualquer processamento
    // status_id: 1=ativo, 2=cancelado, 3=pausado, 4=pausado
    const statusId = agent.status_id !== null && agent.status_id !== undefined
        ? (typeof agent.status_id === 'string' ? parseInt(agent.status_id, 10) : Number(agent.status_id))
        : null;
    if (statusId !== 1) {
        const reason = statusId === 2 ? 'cancelado' : statusId === 3 || statusId === 4 ? 'pausado' : 'inativo';
        console.warn('[chatWithAgent] 🛡️ GUARDRAIL: Agente bloqueado - não está ativo:', {
            agentId: agent.id,
            agentNome: agent.nome,
            status_id: statusId,
            reason
        });
        // 🎯 LOG: Salva log do sistema quando agente está bloqueado
        try {
            // Buscar user_id da tabela tb_users pelo email
            const { supabase } = await Promise.resolve().then(() => __importStar(require('../../lib/supabase')));
            const { data: userData, error: userError } = await supabase
                .from('tb_users')
                .select('id')
                .eq('email', email)
                .maybeSingle();
            if (!userError && userData?.id) {
                console.log('[chatWithAgent] 🎯 Salvando log do sistema para agente bloqueado:', {
                    user_id: userData.id,
                    agent_id: agent.id,
                    agent_nome: agent.nome,
                    status_id: statusId,
                    reason: reason,
                    email: email
                });
                const result = await (0, system_logs_1.saveSystemLog)({
                    user_id: userData.id,
                    user_email: email,
                    agent_id: agent.id,
                    log_type: 'agent_blocked',
                    level: 'warn',
                    message: `Tentativa de usar agente "${agent.nome || agent.id}" que está ${reason}. Agente bloqueado pelo guardrail.`,
                    metadata: {
                        agent_id: agent.id,
                        agent_nome: agent.nome,
                        status_id: statusId,
                        reason: reason,
                        attempted_message_length: message?.length || 0,
                        channel: context?.channel || context?.phone_number ? 'whatsapp' : context?.email ? 'email' : 'webchat'
                    },
                    impact_level: 'high' // Alto impacto pois impede o funcionamento do agente
                });
                if (result.success) {
                    console.log('[chatWithAgent] ✅ Log do sistema salvo com sucesso! ID:', result.id);
                }
                else {
                    console.error('[chatWithAgent] ❌ Erro ao salvar log do sistema:', result.error);
                }
            }
            else {
                console.warn('[chatWithAgent] ⚠️ Não foi possível salvar log:', {
                    userError: userError,
                    hasUserData: !!userData,
                    userDataId: userData?.id,
                    email: email
                });
            }
        }
        catch (err) {
            console.error('[chatWithAgent] Erro ao salvar log para agente bloqueado:', err);
        }
        return `❌ Agente ${agent.nome || 'indisponível'} está ${reason} e não pode responder no momento.`;
    }
    // Log detalhado do agente
    console.log('[chatWithAgent] 🔍 Agente carregado:', {
        id: agent.id,
        nome: agent.nome,
        status_id: agent.status_id,
        crm_integration_id: agent.crm_integration_id,
        hasCrmIntegration: !!agent.crm_integration_id,
        agentKeys: Object.keys(agent)
    });
    const accountContextPromise = (0, company_helper_1.getUserIdAndCompanyIdByEmail)(email);
    const getCachedCompanyId = async () => (await accountContextPromise).companyId;
    const getCachedUserId = async () => (await accountContextPromise).userId;
    // Se o agente não tem crm_integration_id, tenta buscar diretamente do banco
    // Isso é necessário porque a função SQL pode não estar retornando o campo ainda
    if (!agent.crm_integration_id) {
        console.log('[chatWithAgent] ⚠️ Agente não tem crm_integration_id no objeto, buscando diretamente do banco...');
        try {
            const { supabase } = await Promise.resolve().then(() => __importStar(require('../../lib/supabase')));
            // 🎯 PADRÃO MULTI-TENANT: email → companies_id
            const companyId = await getCachedCompanyId();
            if (companyId) {
                const { data: agentData, error: agentError } = await supabase
                    .from('tb_agents')
                    .select('crm_integration_id, companies_id')
                    .eq('id', agentId)
                    .eq('companies_id', companyId)
                    .single();
                console.log('[chatWithAgent] 🔍 Resultado da busca direta:', {
                    agentData,
                    agentError,
                    hasCrmIntegrationId: !!agentData?.crm_integration_id
                });
                if (!agentError && agentData?.crm_integration_id) {
                    console.log('[chatWithAgent] ✅ CRM encontrado diretamente no banco:', agentData.crm_integration_id);
                    agent.crm_integration_id = agentData.crm_integration_id;
                }
                else if (agentError) {
                    console.log('[chatWithAgent] ❌ Erro ao buscar CRM do banco:', agentError);
                }
                else {
                    console.log('[chatWithAgent] ⚠️ Agente encontrado mas sem CRM configurado no banco');
                }
            }
            else {
                console.log('[chatWithAgent] ❌ Usuário não encontrado para buscar CRM');
            }
        }
        catch (err) {
            console.error('[chatWithAgent] ❌ Erro ao buscar CRM do banco:', err);
        }
    }
    else {
        console.log('[chatWithAgent] ✅ CRM já presente no objeto do agente:', agent.crm_integration_id);
    }
    // Busca credenciais da integração apenas quando realmente necessário
    let creds = null;
    // 2️⃣ Mensagem vazia
    if (!message || message.trim() === '') {
        return DEFAULT_MESSAGE;
    }
    const channelContext = String(context?.channel || '').trim().toLowerCase();
    const isWhatsAppCallContext = channelContext === 'whatsapp_call';
    const skipHeavyContextLookup = shouldSkipHeavyContextLookup(message, context);
    // Contexto para armazenar emails lidos durante a conversa
    let lastEmails = [];
    let fileContext = null;
    let ragSources = [];
    let ragSourceNames = [];
    let agentSkills = [];
    if (skipHeavyContextLookup) {
        console.log('[chatWithAgent] ⚡ Pulando RAG/skills para mensagem curta ou simples', {
            agentId,
            messagePreview: safeLogPreview(message),
        });
    }
    else {
        console.log('[chatWithAgent] 🚀 [RAG] PONTO DE ENTRADA - Iniciando busca de arquivos RAG...', {
            agentId,
            email,
            messageLength: message?.length || 0,
            hasMessage: !!message
        });
        try {
            console.log('[chatWithAgent] 🔍 [RAG] Iniciando busca de arquivos...', {
                agentId,
                email
            });
            const companyId = await getCachedCompanyId();
            console.log('[chatWithAgent] 🔍 [RAG] Company ID obtido:', companyId);
            // 🎯 Buscar skills dos arquivos do agente (processados como Skills)
            try {
                const { getAgentSkills } = await Promise.resolve().then(() => __importStar(require('./get-agent-skills')));
                agentSkills = await getAgentSkills(agentId, companyId || '');
                console.log('[chatWithAgent] 🎯 [SKILLS] Skills encontrados:', {
                    count: agentSkills.length,
                    skills: agentSkills.map(s => s.name)
                });
            }
            catch (skillsError) {
                console.warn('[chatWithAgent] ⚠️ [SKILLS] Erro ao buscar skills:', skillsError.message);
            }
            if (companyId) {
                console.log('[chatWithAgent] 📚 [RAG] Buscando contexto dos arquivos vinculados ao agente...', {
                    agentId,
                    companyId,
                    messageLength: message?.length || 0
                });
                const result = await (0, consultarArquivos_1.consultarArquivos)(agentId, companyId, message);
                fileContext = result.context;
                ragSources = result.sources || [];
                ragSourceNames = result.sourceNames || [];
                console.log('[chatWithAgent] 🔍 [RAG] Resultado da consulta:', {
                    hasContext: !!fileContext,
                    contextLength: fileContext?.length || 0,
                    contextPreview: safeLogPreview(fileContext),
                    sourcesCount: ragSources.length,
                    sourceNames: ragSourceNames
                });
                if (fileContext) {
                    console.log('[chatWithAgent] ✅ [RAG] Contexto dos arquivos encontrado', {
                        contextLength: fileContext.length,
                        preview: safeLogPreview(fileContext)
                    });
                }
                else {
                    console.log('[chatWithAgent] ℹ️ [RAG] Nenhum arquivo relevante encontrado para esta mensagem');
                }
            }
            else {
                console.warn('[chatWithAgent] ⚠️ [RAG] Não foi possível obter companies_id para buscar arquivos');
            }
        }
        catch (error) {
            console.error('[chatWithAgent] ❌ [RAG] Erro ao buscar contexto dos arquivos:', error);
            console.error('[chatWithAgent] ❌ [RAG] Stack trace:', error?.stack);
        }
    }
    // 🛡️ CAMADA 1: PRÉ-PROCESSAMENTO (Filtro de Entrada)
    // Buscar configuração de governança
    const { getGovernanceConfig, applyPreProcessing, FALLBACK_GOVERNANCE_FOR_PREPROCESS } = await Promise.resolve().then(() => __importStar(require('../governance')));
    const governanceCompanyId = await getCachedCompanyId();
    const governanceConfig = governanceCompanyId ? await getGovernanceConfig(governanceCompanyId) : null;
    const effectiveGovernanceConfig = governanceConfig ?? FALLBACK_GOVERNANCE_FOR_PREPROCESS;
    // Armazenar globalmente para uso no DLP (sempre com defaults recomendados se não houver BD)
    governanceConfigForDLP = effectiveGovernanceConfig;
    if (message) {
        const preProcessResult = applyPreProcessing(message, effectiveGovernanceConfig);
        if (preProcessResult.blocked) {
            console.warn('[chatWithAgent] 🛡️ Mensagem bloqueada pelo pré-processamento:', {
                reason: preProcessResult.reason,
                messagePreview: safeLogPreview(message)
            });
            // Salvar log do bloqueio
            try {
                const userId = await getCachedUserId();
                const companyId = governanceCompanyId ?? await getCachedCompanyId();
                await (0, system_logs_1.saveSystemLog)({
                    user_id: userId || undefined,
                    user_email: email,
                    companies_id: companyId || undefined,
                    agent_id: agent.id,
                    log_type: 'governance_blocked',
                    level: 'warn',
                    message: `Mensagem bloqueada pelo filtro de governança: ${preProcessResult.reason}`,
                    metadata: {
                        reason: preProcessResult.reason,
                        message_length: message.length,
                        agent_id: agent.id,
                        agent_nome: agent.nome
                    },
                    impact_level: 'medium'
                });
            }
            catch (logError) {
                console.error('[chatWithAgent] Erro ao salvar log de bloqueio:', logError);
            }
            // Aplicar DLP na resposta de bloqueio antes de retornar
            const blockedResponse = preProcessResult.response || 'Desculpe, não posso processar essa solicitação.';
            const dlpBlockedResponse = await applyDLPToMessage(blockedResponse);
            return dlpBlockedResponse;
        }
    }
    // 3️⃣ Preparar system prompt com contexto dos arquivos (se houver)
    // 🔍 DEBUG: Log detalhado dos campos do agente para verificar o que está vindo do banco
    // 🛠️ CORREÇÃO: O banco retorna 'template_role' mas o código espera 'role'
    const templateRole = agent.template_role || agent.role || "";
    console.log('[chatWithAgent] 🔍 DEBUG - Campos do agente para system prompt:', {
        agentId: agent.id,
        agentNome: agent.nome,
        hasRole: !!agent.role,
        hasTemplateRole: !!agent.template_role,
        roleType: typeof agent.role,
        templateRoleType: typeof agent.template_role,
        roleLength: agent.role?.length || 0,
        templateRoleLength: agent.template_role?.length || 0,
        rolePreview: safeLogPreview(agent.role),
        templateRolePreview: safeLogPreview(agent.template_role),
        hasPersonalityPrompt: !!agent.personality_prompt,
        personalityPromptType: typeof agent.personality_prompt,
        personalityPromptLength: agent.personality_prompt?.length || 0,
        personalityPromptPreview: safeLogPreview(agent.personality_prompt),
        roleTemplateId: agent.role_template_id
    });
    const baseSystemPrompt = (0, prompt_builder_1.buildAgentSystemPrompt)(agent.personality_prompt, templateRole, agent.primary_language);
    console.log('[chatWithAgent] 🔍 DEBUG - System prompt construído:', {
        hasBaseSystemPrompt: !!baseSystemPrompt,
        baseSystemPromptLength: baseSystemPrompt.length,
        baseSystemPromptPreview: safeLogPreview(baseSystemPrompt),
        isEmpty: baseSystemPrompt.trim().length === 0
    });
    let enhancedSystemPrompt = baseSystemPrompt;
    const isInternalWebchat = channelContext === 'webchat' || channelContext === 'playground';
    const hasWhatsAppContext = !isWhatsAppCallContext && (channelContext === 'whatsapp' ||
        (!isInternalWebchat && !!(context?.phone_number || context?.from || context?.to)));
    const disableChannelDelivery = Boolean(context?.disable_channel_delivery);
    // 🎯 Adicionar skills ao system prompt se houver
    if (agentSkills && agentSkills.length > 0) {
        const skillsText = agentSkills
            .map(skill => {
            let skillLine = `- ${skill.name}`;
            if (skill.description) {
                skillLine += `: ${skill.description}`;
            }
            if (skill.type && skill.type !== 'other') {
                skillLine += ` (${skill.type})`;
            }
            return skillLine;
        })
            .join('\n');
        enhancedSystemPrompt = `${enhancedSystemPrompt}

CAPACIDADES E HABILIDADES DISPONÍVEIS:
Você possui as seguintes habilidades e capacidades baseadas nos documentos vinculados (modo Skills — extraídas do arquivo, não são busca por trecho a cada pergunta):
${skillsText}

Instruções:
- Se a pergunta do usuário se encaixar em alguma capacidade acima, siga a descrição por completo, mesmo quando não houver "Contexto adicional" (RAG) nesta mensagem.
- Não responda que "não encontrou na base" só porque o RAG não trouxe texto, se a resposta estiver descrita nas capacidades acima.
- Use essas habilidades quando apropriado para fornecer uma resposta precisa e útil.`;
        console.log('[chatWithAgent] 🎯 [SKILLS] Skills adicionados ao system prompt:', {
            skillsCount: agentSkills.length
        });
    }
    // 🛠️ CORREÇÃO: Adiciona instrução específica para read_whatsapp_db
    // O template pode estar pedindo para retornar 'messages', mas o schema não permite
    // O agente só precisa retornar a ação, o sistema busca as mensagens automaticamente
    if (templateRole && templateRole.includes('read_whatsapp_db')) {
        enhancedSystemPrompt = `${enhancedSystemPrompt}

IMPORTANTE SOBRE read_whatsapp_db:
- Você DEVE retornar APENAS: {"action": "read_whatsapp_db", "message": ""}
- NÃO inclua o campo "messages" no JSON - o sistema busca as mensagens automaticamente do banco de dados
- O campo "message" pode ser uma string vazia ""
- O sistema irá buscar e processar as mensagens não lidas automaticamente quando você retornar esta ação`;
        console.log('[chatWithAgent] 🛠️ Instrução específica para read_whatsapp_db adicionada ao system prompt');
    }
    // 🛡️ CAMADA 2: INJETAR REGRAS DE GOVERNANÇA NO SYSTEM PROMPT
    {
        const { injectGovernanceRules } = await Promise.resolve().then(() => __importStar(require('../governance')));
        enhancedSystemPrompt = injectGovernanceRules(enhancedSystemPrompt, effectiveGovernanceConfig);
        console.log('[chatWithAgent] 🛡️ Regras de governança injetadas no system prompt');
    }
    if (isInternalWebchat) {
        enhancedSystemPrompt = `${enhancedSystemPrompt}

CONTEXTO DO CANAL:
- Esta conversa esta acontecendo no chat interno da plataforma (webchat/playground).
- Para responder ao usuario neste canal, retorne a acao "reply".
- Nao use "send_whatsapp" nem tente disparar mensagens externas a partir deste canal.`;
        console.log('[chatWithAgent] Contexto de webchat adicionado ao system prompt');
    }
    if (hasWhatsAppContext) {
        enhancedSystemPrompt = `${enhancedSystemPrompt}

CONTEXTO DO CANAL:
- Esta conversa esta acontecendo via WhatsApp.
- Se voce responder com a acao "reply", o sistema enviara essa resposta automaticamente ao contato no WhatsApp.
- Use "send_whatsapp" quando quiser explicitar o envio da mensagem ao contato.`;
        console.log('[chatWithAgent] Contexto de WhatsApp adicionado ao system prompt');
    }
    if (isWhatsAppCallContext) {
        enhancedSystemPrompt = `${enhancedSystemPrompt}

CONTEXTO DO CANAL:
- Esta conversa esta acontecendo em uma chamada de voz do WhatsApp.
- Retorne apenas a resposta que deve ser falada pelo agente na ligacao.
- Use a acao "reply"; nao use "send_whatsapp" e nao tente enviar mensagens de texto no chat.
- Se a mensagem trouxer historico da chamada, use esse historico para interpretar a ultima fala do usuario.
- Nao repita saudacao generica depois que o usuario ja fez uma pergunta; responda diretamente a ultima fala.`;
        console.log('[chatWithAgent] Contexto de chamada WhatsApp adicionado ao system prompt');
    }
    if (disableChannelDelivery) {
        enhancedSystemPrompt = `${enhancedSystemPrompt}

CONTEXTO DE EXECUCAO:
- Voce esta executando dentro de um flow.
- Nao envie mensagens diretamente para canais externos neste passo.
- Produza apenas o conteudo da resposta ou JSON estruturado para o flow decidir o proximo passo.`;
        console.log('[chatWithAgent] Entrega direta por canal desativada para execucao dentro de flow');
    }
    if (disableChannelDelivery && hasWhatsAppContext) {
        enhancedSystemPrompt = `${enhancedSystemPrompt}

PRIORIDADE DO TEMPLATE (FLOW WHATSAPP):
- O campo JSON "message" deve refletir o FLUXO PRINCIPAL e as MENSAGENS EXATAS do template de papel (role), com prioridade sobre respostas genericas de "assistente de loja".
- Na primeira resposta ao usuario, se o template pedir identificacao, saudacao e lista de opcoes, inclua tudo de forma curta e legivel no celular.
- Entradas como "1", "2", "3" ou "4" devem mapear para as opcoes correspondentes do template, nao para uma nova saudacao generica.`;
    }
    if (fileContext) {
        const filesList = ragSourceNames.length > 0 ? `\nArquivos disponíveis: ${ragSourceNames.join(', ')}` : '';
        const ragInstructions = `
IMPORTANTE: Use as informações do "Contexto adicional" abaixo para responder ao usuário. ${filesList}
Sempre que usar informações desses arquivos, cite explicitamente o nome do arquivo de onde a informação foi retirada na sua resposta (ex: "Segundo o arquivo [nome]", "De acordo com o documento [nome]").
Os nomes dos arquivos estão identificados como "[Fonte: nome_do_arquivo]" no texto abaixo.`;
        enhancedSystemPrompt = `${enhancedSystemPrompt}

${ragInstructions}

Contexto adicional:
---
${fileContext}
---`;
        console.log('[chatWithAgent] 📝 System prompt enriquecido com contexto dos arquivos e instruções de citação');
    }
    let messageForLlm = message;
    if (disableChannelDelivery &&
        hasWhatsAppContext &&
        agent.integrations_id &&
        context) {
        const chatRef = String(context.phone_number || context.from || context.to || '').trim();
        if (chatRef) {
            try {
                const waHist = await (0, whatsapp_redis_1.getHistoryFromRedis)(agent.integrations_id, chatRef, 20);
                if (waHist.length > 0) {
                    const historyText = waHist.map((m) => `${m.role}: ${m.content}`).join('\n');
                    messageForLlm = `Histórico recente da conversa no WhatsApp (ordem cronológica):\n${historyText}\n\n---\n\n${message}`;
                    enhancedSystemPrompt = `${enhancedSystemPrompt}

CONTINUIDADE (FLOW WHATSAPP):
- Use o histórico acima e o FLUXO PRINCIPAL do seu template de papel para saber a etapa correta.
- Se ainda NÃO houver nenhuma mensagem anterior do assistente neste histórico, faça a primeira resposta conforme o template (saudação, identificação, opções numeradas ou temas iniciais quando o template pedir).
- Depois que o assistente já tiver enviado mensagens, não repita o menu inteiro nem uma saudação longa; interprete a última mensagem do usuário (ex.: "1", "2", pergunta direta) e execute o passo correspondente do template (textos exatos quando indicados).
- O campo JSON "message" deve conter a mensagem completa ao usuário no WhatsApp, fiel ao template.
- Envie UMA mensagem coesa por vez.`;
                    console.log('[chatWithAgent] Histórico WhatsApp injetado na execução de flow', {
                        messages: waHist.length
                    });
                }
            }
            catch (e) {
                console.warn('[chatWithAgent] Falha ao carregar histórico Redis para flow WhatsApp:', e?.message);
            }
        }
    }
    // 4️⃣ Primeira chamada ao LLM
    console.log('[chatWithAgent] 📤 Enviando mensagem para o agente:', {
        agentId,
        agentName: agent.nome,
        messageLength: messageForLlm?.length || 0,
        messagePreview: safeLogPreview(messageForLlm),
        hasContext: !!context,
        contextKeys: context ? Object.keys(context) : [],
        hasFileContext: !!fileContext
    });
    const llmResult = await (0, openai_1.chatText)({
        system: enhancedSystemPrompt,
        user: messageForLlm,
        model: isWhatsAppCallContext
            ? String(process.env.VOICE_CALL_AGENT_MODEL || agent.provider_model || 'gpt-4o-mini').trim()
            : agent.provider_model,
        temperature: agent.temperature,
        maxTokens: isWhatsAppCallContext
            ? Math.min(agent.max_tokens || 160, getPositiveIntFromEnv('VOICE_CALL_AGENT_MAX_TOKENS', 160, 32))
            : agent.max_tokens,
        apiKey: agent.api_key,
        responseFormat: AGENT_RESPONSE_SCHEMA,
    });
    // 🛡️ [OPENAI ERROR HANDLER] Verifica se a chamada falhou
    if (!llmResult.success) {
        console.error('[chatWithAgent] ❌ Erro na chamada do LLM:', llmResult.error);
        return llmResult.content; // Retorna a mensagem amigável para o usuário
    }
    // 🎯 Salvar uso de tokens
    if (llmResult.usage) {
        const usage = llmResult.usage;
        void (async () => {
            const companyId = await getCachedCompanyId();
            await saveTokenUsage(agent.id, companyId, usage, agent.provider_model || 'gpt-4o', agent.provider || 'openai', context?.userId || context?.phone_number || context?.sessionId, context?.conversationId, {
                channel: context?.channel || 'webchat',
                has_rag_context: !!fileContext
            });
        })();
    }
    console.log('[chatWithAgent] Resposta bruta do agente recebida', {
        contentLength: llmResult.content.length,
        preview: safeLogPreview(llmResult.content)
    });
    // 4️⃣ Limpa a resposta (remove markdown code blocks se houver)
    let cleanedResponse = llmResult.content.trim();
    // Remove blocos de código markdown (```json ... ``` ou ``` ... ```)
    cleanedResponse = cleanedResponse.replace(/^```(?:json)?\s*\n?/i, ''); // Remove início
    cleanedResponse = cleanedResponse.replace(/\n?```\s*$/i, ''); // Remove fim
    cleanedResponse = cleanedResponse.trim();
    // 🛡️ CAMADA 3: PÓS-PROCESSAMENTO (DLP - Data Loss Prevention)
    cleanedResponse = await applyDLPToMessage(cleanedResponse);
    console.log('[chatWithAgent] 🛡️ DLP aplicado na resposta');
    // 4️⃣ Parse do JSON
    let parsed = null;
    let isPlainText = false;
    try {
        parsed = JSON.parse(cleanedResponse);
        console.log('[chatWithAgent] JSON do agente parseado', {
            action: parsed.action || null,
            hasMessage: !!parsed.message,
            messageLength: parsed.message?.length || 0
        });
        console.log('[chatWithAgent] 🔍 Ação retornada pelo agente:', {
            action: parsed.action,
            hasMessage: !!parsed.message,
            messageLength: parsed.message?.length || 0,
            messagePreview: safeLogPreview(parsed.message),
            isReadWhatsAppDb: parsed.action === 'read_whatsapp_db' || parsed.action === 'read_whatsapp_database'
        });
        // Validação imediata: Se o parsed.message contiver JSON completo, extrai apenas o texto
        if (parsed.message && typeof parsed.message === 'string' && parsed.message.trim().startsWith('{')) {
            try {
                const nestedJson = JSON.parse(parsed.message);
                if (nestedJson.message && typeof nestedJson.message === 'string') {
                    parsed.message = nestedJson.message;
                    console.log('[chatWithAgent] ✅ Extraído message de JSON aninhado no parse inicial');
                }
                else if (nestedJson.action === 'send_whatsapp' && nestedJson.message) {
                    parsed.message = nestedJson.message;
                    console.log('[chatWithAgent] ✅ Extraído message de send_whatsapp aninhado no parse inicial');
                }
            }
            catch (e) {
                // Não é JSON válido, mantém como está
            }
        }
    }
    catch (err) {
        // Se não for JSON válido, tenta extrair JSON do texto
        console.log('📝 Resposta não é JSON puro, tentando extrair JSON do texto...');
        // Tenta encontrar um objeto JSON no texto usando regex
        const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                const extractedJson = jsonMatch[0];
                parsed = JSON.parse(extractedJson);
                console.log('[chatWithAgent] JSON extraido do texto', {
                    action: parsed.action || null,
                    hasMessage: !!parsed.message,
                    messageLength: parsed.message?.length || 0
                });
                // Extrai o texto antes do JSON como mensagem, se houver
                const textBeforeJson = cleanedResponse.substring(0, jsonMatch.index).trim();
                if (textBeforeJson) {
                    parsed.message = textBeforeJson;
                    console.log('[chatWithAgent] Texto antes do JSON extraido como mensagem', {
                        messagePreview: safeLogPreview(textBeforeJson)
                    });
                }
            }
            catch (parseErr) {
                console.log('❌ Erro ao parsear JSON extraído:', parseErr);
                isPlainText = true;
                parsed = {
                    action: null,
                    message: cleanedResponse
                };
            }
        }
        else {
            // Se não encontrar JSON, trata como texto simples
            console.log('📝 Nenhum JSON encontrado no texto, tratando como texto simples');
            isPlainText = true;
            parsed = {
                action: null,
                message: cleanedResponse
            };
        }
    }
    if ((isInternalWebchat || isWhatsAppCallContext) && (parsed.action === 'send_whatsapp' || parsed.action === 'whatsapp')) {
        console.warn('[chatWithAgent] Acao send_whatsapp convertida para reply no contexto sem envio direto');
        parsed = {
            ...parsed,
            action: 'reply'
        };
    }
    // 5️⃣ Ação: ler emails
    if (parsed.action === 'read_emails') {
        try {
            const emails = await (0, readEmailsWithAgent_1.readEmailsWithAgent)(email, agentId, parsed.provider || 'microsoft365', parsed.limit || 5);
            if (!emails || emails.length === 0) {
                return '📭 Nenhum email encontrado na caixa de entrada.';
            }
            // Armazena os emails no contexto
            lastEmails = emails;
            // Formata emails para exibição
            const emailsFormatted = emails.map((email, index) => {
                const date = email.receivedAt
                    ? new Date(email.receivedAt).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    })
                    : 'Data não disponível';
                return `\n${index + 1}. 📧 ${email.subject || '(Sem assunto)'}\n   De: ${email.from || 'Remetente desconhecido'}\n   Data: ${date}\n   ${email.preview ? `Preview: ${email.preview.substring(0, 100)}${email.preview.length > 100 ? '...' : ''}` : ''}`;
            }).join('\n\n');
            // Se a mensagem original pediu para ler E responder, continua o fluxo
            const messageLower = message.toLowerCase();
            const shouldReply = messageLower.includes('responda') ||
                messageLower.includes('responder') ||
                messageLower.includes('reply') ||
                parsed.action === 'read_and_reply';
            if (shouldReply && lastEmails.length > 0) {
                // Prepara contexto do último email para o LLM gerar resposta
                const lastEmail = lastEmails[0];
                const contextForReply = `
Emails carregados com sucesso. Agora você precisa responder ao último email:

De: ${lastEmail.from || 'Remetente desconhecido'}
Assunto: ${lastEmail.subject || '(Sem assunto)'}
Conteúdo: ${lastEmail.preview || 'Sem preview disponível'}
Data: ${lastEmail.receivedAt ? new Date(lastEmail.receivedAt).toLocaleString('pt-BR') : 'Data não disponível'}

Por favor, gere uma resposta apropriada para este email.
`;
                // Segunda chamada ao LLM para gerar a resposta
                const templateRoleForEmail = agent.template_role || agent.role || "";
                const llmResultEmail = await (0, openai_1.chatText)({
                    system: (0, prompt_builder_1.buildAgentSystemPrompt)(agent.personality_prompt, templateRoleForEmail, agent.primary_language),
                    user: contextForReply,
                    model: agent.provider_model,
                    temperature: agent.temperature,
                    maxTokens: agent.max_tokens,
                    apiKey: agent.api_key,
                    responseFormat: AGENT_RESPONSE_SCHEMA,
                });
                // 🛡️ [OPENAI ERROR HANDLER] Verifica se a chamada falhou
                if (!llmResultEmail.success) {
                    console.error('[chatWithAgent] ❌ Erro na chamada de resposta de email:', llmResultEmail.error);
                    return `📬 Encontrei ${emails.length} email(s), mas erro ao gerar resposta: ${llmResultEmail.content}`;
                }
                // 🎯 Salvar uso de tokens
                if (llmResultEmail.usage) {
                    const usage = llmResultEmail.usage;
                    void (async () => {
                        const companyId = await getCachedCompanyId();
                        await saveTokenUsage(agent.id, companyId, usage, agent.provider_model || 'gpt-4o', agent.provider || 'openai', context?.userId || context?.phone_number || context?.sessionId, context?.conversationId, { channel: 'email', action: 'read_emails' });
                    })();
                }
                const llmResponse = llmResultEmail.content;
                console.log('[chatWithAgent] Resposta bruta do agente recebida na segunda chamada', {
                    contentLength: String(llmResponse || '').length,
                    preview: safeLogPreview(llmResponse)
                });
                // Limpa a resposta (remove markdown code blocks se houver)
                let cleanedResponse2 = llmResponse.trim();
                cleanedResponse2 = cleanedResponse2.replace(/^```(?:json)?\s*\n?/i, '');
                cleanedResponse2 = cleanedResponse2.replace(/\n?```\s*$/i, '');
                cleanedResponse2 = cleanedResponse2.trim();
                try {
                    parsed = JSON.parse(cleanedResponse2);
                    console.log('[chatWithAgent] JSON parseado na resposta de email', {
                        action: parsed.action || null,
                        hasMessage: !!parsed.message,
                        messageLength: parsed.message?.length || 0
                    });
                }
                catch (err) {
                    console.warn('⚠️ Resposta não é JSON válido na segunda chamada');
                    // Retorna apenas a lista de emails se não conseguir gerar resposta
                    return `📬 Encontrei ${emails.length} email(s) na sua caixa de entrada:\n${emailsFormatted}\n\n⚠️ Não foi possível gerar uma resposta automática.`;
                }
                // Se a segunda resposta for send_email ou reply (com dados de envio), envia
                const shouldSendEmail = parsed.action === 'send_email' ||
                    (parsed.action === 'reply' && (parsed.to || parsed.body));
                if (shouldSendEmail) {
                    try {
                        // Função para substituir templates {{variavel}} usando o contexto
                        const replaceTemplates = (text) => {
                            if (!text || typeof text !== 'string' || !context)
                                return text;
                            return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
                                let value = context[key];
                                if (value === undefined) {
                                    for (const [contextKey, contextValue] of Object.entries(context)) {
                                        if (typeof contextValue === 'object' && contextValue !== null && !Array.isArray(contextValue)) {
                                            if (contextValue[key] !== undefined) {
                                                value = contextValue[key];
                                                break;
                                            }
                                        }
                                    }
                                }
                                return value !== undefined ? String(value) : match;
                            });
                        };
                        let emailTo = parsed.to || lastEmail.from;
                        let emailSubject = parsed.subject || `Re: ${lastEmail.subject || 'Sem assunto'}`;
                        let emailBody = parsed.body || parsed.message || 'Resposta gerada automaticamente.';
                        // Substitui templates se houver contexto
                        if (context) {
                            emailTo = replaceTemplates(emailTo);
                            emailSubject = replaceTemplates(emailSubject);
                            emailBody = replaceTemplates(emailBody);
                        }
                        if (!creds && agent.integrations_id) {
                            const { supabase } = await Promise.resolve().then(() => __importStar(require('../../lib/supabase')));
                            const { data } = await supabase
                                .from('tb_integrations')
                                .select('email, provider')
                                .eq('id', agent.integrations_id)
                                .single();
                            creds = data;
                        }
                        console.log('[chatWithAgent] 📧 Preparando para enviar email:', {
                            from: creds?.email || 'desconhecido',
                            to: emailTo,
                            subject: emailSubject,
                            bodyLength: emailBody.length,
                            integrationsId: agent.integrations_id
                        });
                        await (0, email_service_1.sendEmailForUser)(email, agent.integrations_id, {
                            to: emailTo,
                            subject: emailSubject,
                            text: emailBody,
                            visual_style: parsed.visual_style,
                        });
                        console.log('[chatWithAgent] ✅ Email enviado com sucesso!', {
                            from: creds?.email || 'desconhecido',
                            to: emailTo,
                            subject: emailSubject
                        });
                        return `✅ Email lido e respondido com sucesso!\n\n📧 De: ${creds?.email || 'você'}\n📧 Para: ${emailTo}\n📋 Assunto: ${emailSubject}\n\n📬 Lista de emails:\n${emailsFormatted}`;
                    }
                    catch (err) {
                        console.error('[chatWithAgent] ❌ Erro ao enviar resposta:', err);
                        return `📬 Encontrei ${emails.length} email(s) na sua caixa de entrada:\n${emailsFormatted}\n\n❌ Erro ao enviar resposta: ${err.message || 'Erro desconhecido'}`;
                    }
                }
                else {
                    console.warn('[chatWithAgent] ⚠️ Agente não retornou ação de envio. Ação:', parsed.action);
                }
            }
            // Se não pediu para responder, apenas retorna a lista
            return `📬 Encontrei ${emails.length} email(s) na sua caixa de entrada:\n${emailsFormatted}`;
        }
        catch (err) {
            console.error('❌ Erro ao ler emails:', err);
            return `❌ Erro ao ler emails: ${err.message || 'Erro desconhecido'}`;
        }
    }
    // 6️⃣ Ação: enviar email (resposta direta)
    if (parsed.action === 'send_email') {
        try {
            // Função para substituir templates {{variavel}} usando o contexto
            const replaceTemplates = (text) => {
                if (!text || typeof text !== 'string' || !context)
                    return text;
                return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
                    // Busca a chave no contexto (pode estar em vários níveis)
                    let value = context[key];
                    // Se não encontrar direto, busca em objetos aninhados
                    if (value === undefined) {
                        for (const [contextKey, contextValue] of Object.entries(context)) {
                            if (typeof contextValue === 'object' && contextValue !== null && !Array.isArray(contextValue)) {
                                if (contextValue[key] !== undefined) {
                                    value = contextValue[key];
                                    break;
                                }
                            }
                        }
                    }
                    return value !== undefined ? String(value) : match; // Se não encontrar, mantém o template
                });
            };
            // Se não tem lastEmails, tenta usar os dados do parsed
            let toEmail = parsed.to || (lastEmails[0]?.from);
            let subject = parsed.subject || (lastEmails[0] ? `Re: ${lastEmails[0].subject}` : 'Sem assunto');
            let body = parsed.body || parsed.message || 'Resposta gerada automaticamente.';
            // Substitui templates se houver contexto
            if (context) {
                console.log('[chatWithAgent] Contexto disponível para substituição:', {
                    contextKeys: safeLogContextKeys(context)
                });
                console.log('[chatWithAgent] Antes da substituição', {
                    hasToEmail: !!toEmail,
                    hasSubject: !!subject,
                    bodyPreview: safeLogPreview(body)
                });
                toEmail = replaceTemplates(toEmail);
                subject = replaceTemplates(subject);
                body = replaceTemplates(body);
                console.log('[chatWithAgent] Templates substituidos', {
                    hasToEmail: !!toEmail,
                    hasSubject: !!subject,
                    bodyPreview: safeLogPreview(body)
                });
            }
            else {
                console.warn('[chatWithAgent] ⚠️ Nenhum contexto fornecido para substituição de templates');
            }
            if (!toEmail) {
                return '❌ Não foi possível determinar o destinatário do email.';
            }
            await (0, email_service_1.sendEmailForUser)(email, agent.integrations_id, {
                to: toEmail,
                subject: subject,
                text: body,
                visual_style: parsed.visual_style,
            });
            return `📧 Email enviado com sucesso para: ${toEmail}`;
        }
        catch (err) {
            console.error('❌ Erro ao enviar email:', err);
            return `❌ Não foi possível enviar o email: ${err.message || 'Erro desconhecido'}`;
        }
    }
    // 6️⃣ Ação: ler mensagens do WhatsApp (do Redis)
    if (parsed.action === 'read_whatsapp' || parsed.action === 'read_whatsapp_messages') {
        if (isWhatsAppCallContext) {
            console.warn('[chatWithAgent] Acao de leitura WhatsApp bloqueada em chamada de voz para evitar mistura de conversas', {
                agentId,
                action: parsed.action,
                contextKeys: safeLogContextKeys(context)
            });
            return 'Estou aqui na chamada com você. Pode repetir sua pergunta para eu te responder por voz?';
        }
        try {
            if (!agent.integrations_id) {
                return '❌ Agente não possui integração WhatsApp configurada.';
            }
            // Busca todas as conversas não lidas do Redis
            const unreadNumbers = await (0, whatsapp_redis_1.getUnreadConversations)(agent.integrations_id);
            if (!unreadNumbers || unreadNumbers.length === 0) {
                return '📭 Nenhuma mensagem não lida encontrada no WhatsApp.';
            }
            // Busca histórico de cada conversa não lida
            const messagesByPhone = {};
            for (const phoneNumber of unreadNumbers) {
                const history = await (0, whatsapp_redis_1.getHistoryFromRedis)(agent.integrations_id, phoneNumber);
                if (history.length > 0 && history[history.length - 1].role === 'user') {
                    messagesByPhone[phoneNumber] = history;
                }
            }
            // Formata mensagens para exibição
            const totalUnread = Object.values(messagesByPhone).reduce((sum, msgs) => {
                return sum + msgs.filter(m => m.role === 'user').length;
            }, 0);
            let formattedMessages = `📱 Encontrei ${totalUnread} mensagem(ns) não lida(s) de ${Object.keys(messagesByPhone).length} contato(s):\n\n`;
            for (const [phoneNumber, messages] of Object.entries(messagesByPhone)) {
                const unreadCount = messages.filter(m => m.role === 'user').length;
                formattedMessages += `📞 ${phoneNumber} (${unreadCount} mensagem${unreadCount > 1 ? 'ns' : ''}):\n`;
                // Mostra apenas mensagens não lidas (últimas do usuário)
                const unreadMsgs = messages.filter(m => m.role === 'user');
                unreadMsgs.forEach((msg, index) => {
                    const date = new Date(msg.timestamp).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    formattedMessages += `  ${index + 1}. [${date}] ${msg.content}\n`;
                });
                formattedMessages += '\n';
            }
            formattedMessages += '\n💡 Use a ação send_whatsapp para responder às mensagens.';
            // Marca mensagens como lidas
            for (const phoneNumber of Object.keys(messagesByPhone)) {
                await (0, whatsapp_service_1.markMessagesAsRead)(phoneNumber, agent.integrations_id);
            }
            return formattedMessages;
        }
        catch (err) {
            console.error('❌ Erro ao ler mensagens do WhatsApp:', err);
            return `❌ Não foi possível ler as mensagens: ${err.message || 'Erro desconhecido'}`;
        }
    }
    // 6️⃣ Ação: ler mensagens do WhatsApp (do BANCO DE DADOS)
    if (parsed.action === 'read_whatsapp_db' || parsed.action === 'read_whatsapp_database') {
        if (isWhatsAppCallContext) {
            console.warn('[chatWithAgent] Acao de leitura WhatsApp DB bloqueada em chamada de voz para evitar mistura de conversas', {
                agentId,
                action: parsed.action,
                contextKeys: safeLogContextKeys(context)
            });
            return 'Estou aqui na chamada com você. Pode repetir sua pergunta para eu te responder por voz?';
        }
        try {
            if (!agent.integrations_id) {
                return JSON.stringify({
                    action: 'read_whatsapp_db',
                    messages: [],
                    error: 'Agente não possui integração WhatsApp configurada'
                });
            }
            // Busca todas as mensagens não lidas do banco
            const { getAllUnreadMessages, getWhatsAppHistory } = await Promise.resolve().then(() => __importStar(require('../integrations/whatsapp/whatsapp.service')));
            const unreadMessages = await getAllUnreadMessages(agent.integrations_id, agentId);
            if (!unreadMessages || unreadMessages.length === 0) {
                return JSON.stringify({
                    action: 'read_whatsapp_db',
                    messages: []
                });
            }
            // Agrupa mensagens por contato (whatsapp_contact_id)
            const messagesByContact = {};
            for (const msg of unreadMessages) {
                const contactId = msg.whatsapp_contact_id || 'unknown';
                if (!messagesByContact[contactId]) {
                    messagesByContact[contactId] = [];
                }
                messagesByContact[contactId].push(msg);
            }
            // Para cada contato, busca histórico completo
            const formattedMessages = [];
            for (const [contactId, messages] of Object.entries(messagesByContact)) {
                // Pega a mensagem mais recente não lida
                const latestMessage = messages[messages.length - 1];
                // Busca histórico completo (últimas 20 mensagens) usando contactId
                const history = await getWhatsAppHistory(contactId, agent.integrations_id, 20);
                // Formata histórico
                const formattedHistory = history.map(msg => ({
                    role: msg.direction === 'inbound' ? 'user' : 'assistant',
                    content: msg.message,
                    timestamp: msg.created_at
                }));
                // Busca o contato para obter o número
                const { supabase } = await Promise.resolve().then(() => __importStar(require('../../lib/supabase')));
                const { data: contact } = await supabase
                    .from('tb_whatsapp_contacts')
                    .select('id, lid, phone_number, status')
                    .eq('id', contactId)
                    .maybeSingle();
                // Prioriza número real, senão usa LID
                let phoneNumberForDisplay = contactId;
                if (contact) {
                    if (contact.phone_number && contact.status === 'active') {
                        phoneNumberForDisplay = `${contact.phone_number}@s.whatsapp.net`;
                    }
                    else if (contact.lid) {
                        phoneNumberForDisplay = contact.lid.endsWith('@lid') ? contact.lid : `${contact.lid}@lid`;
                    }
                }
                formattedMessages.push({
                    whatsapp_contact_id: contactId,
                    phone_number: phoneNumberForDisplay,
                    message: latestMessage.message,
                    message_id: latestMessage.message_id || latestMessage.id,
                    created_at: latestMessage.created_at,
                    history: formattedHistory
                });
            }
            return JSON.stringify({
                action: 'read_whatsapp_db',
                messages: formattedMessages
            });
        }
        catch (error) {
            console.error('❌ Erro ao ler mensagens do banco:', error);
            return JSON.stringify({
                action: 'read_whatsapp_db',
                messages: [],
                error: error.message
            });
        }
    }
    // 7️⃣ Ação: enviar WhatsApp
    if (parsed.action === 'send_whatsapp' || parsed.action === 'whatsapp') {
        if (isWhatsAppCallContext) {
            return extractMessageText(parsed.message || cleanedResponse || '');
        }
        if (disableChannelDelivery) {
            return JSON.stringify({
                action: 'send_whatsapp',
                message: extractMessageText(parsed.message || cleanedResponse || '')
            });
        }
        // 🎯 DECISÃO DA IA COM CONFIANÇA: Verificar antes de enviar
        let historyLength = 0;
        let contactId = context?.phone_number || context?.from || context?.to || context?.whatsapp_contact_id;
        const channel = 'whatsapp';
        if (agent.integrations_id && contactId) {
            try {
                const history = await (0, whatsapp_redis_1.getHistoryFromRedis)(agent.integrations_id, contactId, 10);
                historyLength = history.length;
            }
            catch (err) {
                console.warn('[chatWithAgent] Erro ao buscar histórico para confiança:', err);
            }
        }
        // Buscar mensagem original do contexto se disponível (para workflows/flows)
        // A mensagem original do usuário pode estar em context.originalMessage, context.userMessage, context.input, ou context.whatsappMessage
        const originalMessage = context?.originalMessage || context?.userMessage || context?.input || context?.whatsappMessage || context?.text || message || '';
        console.log('[chatWithAgent] 🔍 Mensagem original para cálculo de confiança (send_whatsapp):', {
            fromContext: !!(context?.originalMessage || context?.userMessage || context?.input || context?.whatsappMessage || context?.text),
            originalMessage: safeLogPreview(originalMessage),
            messageParam: safeLogPreview(message),
            contextKeys: safeLogContextKeys(context)
        });
        const decision = (0, confidence_calculator_1.calculateConfidence)(parsed, originalMessage, context, historyLength, !!fileContext, ragSources);
        // 📊 LOG DO RESULTADO DA DECISÃO
        console.log('');
        console.log('🔍 [chatWithAgent] Resultado da Decisão para send_whatsapp:');
        console.log('  Score:', (decision.confidence_score * 100).toFixed(1) + '%');
        console.log('  Threshold:', (confidenceApprovalThreshold * 100).toFixed(1) + '%');
        console.log('  Status:', decision.confidence_score < confidenceApprovalThreshold ? '🛡️ BLOQUEADO' : '✅ APROVADO');
        console.log('  Motivo:', decision.reason);
        console.log('');
        if (decision.confidence_score < confidenceApprovalThreshold && parsed.message) {
            console.warn('[chatWithAgent] 🛡️ BLOQUEADO: Confiança baixa para send_whatsapp:', {
                confidence: decision.confidence_score,
                reason: decision.reason
            });
            // SEMPRE buscar user_id da tabela tb_users pelo email (não usar Supabase Auth)
            let userId;
            try {
                const { supabase } = await Promise.resolve().then(() => __importStar(require('../../lib/supabase')));
                const { data: userData, error: userError } = await supabase
                    .from('tb_users')
                    .select('id')
                    .eq('email', email)
                    .maybeSingle();
                if (userError) {
                    console.error('[chatWithAgent] Erro ao buscar user_id da tb_users:', userError);
                }
                else if (userData?.id) {
                    userId = userData.id;
                    console.log('[chatWithAgent] user_id encontrado na tb_users:', userId, 'para email:', email);
                }
                else {
                    console.warn('[chatWithAgent] Usuário não encontrado na tb_users para email:', email);
                }
            }
            catch (err) {
                console.error('[chatWithAgent] Erro ao buscar user_id:', err);
            }
            if (userId) {
                // Usa 'webchat' como padrão se não tiver channel (playground/teste)
                const finalChannel = channel || 'webchat';
                const finalContactId = contactId || context?.sessionId || 'playground';
                console.log('[chatWithAgent] Salvando decisão bloqueada:', {
                    agentId: agent.id,
                    userId,
                    channel: finalChannel,
                    contactId: finalContactId,
                    confidence: decision.confidence_score
                });
                await (0, save_decision_1.saveBlockedDecision)(agent.id, userId, message || '', decision, context, finalChannel, agent.integrations_id, finalContactId, email // Passa email para buscar companies_id
                );
                console.log('[chatWithAgent] ✅ Decisão salva com sucesso!');
            }
            else {
                console.error('[chatWithAgent] ❌ Não foi possível salvar decisão: userId não encontrado');
            }
            // Não retorna mensagem de aviso - apenas bloqueia silenciosamente
            // A mensagem aparecerá no Inbox para aprovação
            return ''; // Retorna vazio para não mostrar nada no chat
        }
        try {
            // Função para substituir templates {{variavel}} usando o contexto
            const replaceTemplates = (text) => {
                if (!text || typeof text !== 'string' || !context)
                    return text;
                return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
                    let value = context[key];
                    if (value === undefined) {
                        for (const [contextKey, contextValue] of Object.entries(context)) {
                            if (typeof contextValue === 'object' && contextValue !== null && !Array.isArray(contextValue)) {
                                if (contextValue[key] !== undefined) {
                                    value = contextValue[key];
                                    break;
                                }
                            }
                        }
                    }
                    return value !== undefined ? String(value) : match;
                });
            };
            let phoneNumber = parsed.to || parsed.phone || parsed.phone_number || '';
            let message = parsed.message || parsed.body || '';
            // Validação robusta: Extrai apenas o texto, mesmo se vier JSON completo
            message = extractMessageText(message);
            console.log('[chatWithAgent] 📝 Mensagem extraída após validação:', {
                originalLength: (parsed.message || parsed.body || '').length,
                extractedLength: message.length,
                preview: safeLogPreview(message)
            });
            // Garante que message é uma string válida e não contém JSON
            if (typeof message !== 'string') {
                message = String(message);
            }
            // Última validação: se ainda contiver JSON, remove
            if (message.trim().startsWith('{') && message.trim().endsWith('}')) {
                try {
                    const finalParse = JSON.parse(message);
                    if (finalParse.message && typeof finalParse.message === 'string') {
                        message = finalParse.message;
                        console.log('[chatWithAgent] ✅ Extraído texto do JSON (validação final)');
                    }
                    else if (finalParse.action === 'send_whatsapp' && finalParse.message) {
                        message = finalParse.message;
                        console.log('[chatWithAgent] ✅ Extraído texto do send_whatsapp (validação final)');
                    }
                    else {
                        // Se não tiver campo message, usa JSON stringificado (não ideal, mas melhor que nada)
                        message = JSON.stringify(finalParse);
                        console.warn('[chatWithAgent] ⚠️ JSON sem campo message, usando stringificado');
                    }
                }
                catch (e) {
                    // Não é JSON válido, mantém como está
                }
            }
            // Substitui templates se houver contexto
            if (context) {
                console.log('[chatWithAgent] Contexto disponível para substituição WhatsApp:', {
                    contextKeys: safeLogContextKeys(context)
                });
                phoneNumber = replaceTemplates(phoneNumber);
                message = replaceTemplates(message);
                console.log('[chatWithAgent] Templates substituidos WhatsApp', {
                    hasPhoneNumber: !!phoneNumber,
                    messagePreview: safeLogPreview(message)
                });
            }
            console.log('[chatWithAgent] 🔍 Buscando número do contato para envio:', {
                phoneNumberDoParsed: phoneNumber,
                contextWhatsappContactId: context?.whatsapp_contact_id,
                contextPhoneNumber: context?.phone_number,
                contextFrom: context?.from,
                contextTo: context?.to
            });
            // PRIORIDADE 1: Se tiver whatsapp_contact_id no contexto (UUID do contato), usa ele
            if (context?.whatsapp_contact_id) {
                try {
                    const { supabase } = await Promise.resolve().then(() => __importStar(require('../../lib/supabase')));
                    const { data: contact, error } = await supabase
                        .from('tb_whatsapp_contacts')
                        .select('id, lid, phone_number, status')
                        .eq('id', context.whatsapp_contact_id)
                        .maybeSingle();
                    if (contact && !error) {
                        // Prioriza número real, senão usa LID
                        if (contact.phone_number && contact.status === 'active') {
                            phoneNumber = `${contact.phone_number}@s.whatsapp.net`;
                            console.log('[chatWithAgent] ✅ Número obtido do whatsapp_contact_id (número real):', {
                                contactId: contact.id,
                                phoneNumber
                            });
                        }
                        else if (contact.lid) {
                            phoneNumber = contact.lid.endsWith('@lid') ? contact.lid : `${contact.lid}@lid`;
                            console.log('[chatWithAgent] ✅ Número obtido do whatsapp_contact_id (LID):', {
                                contactId: contact.id,
                                phoneNumber
                            });
                        }
                        else {
                            phoneNumber = contact.id; // Usa UUID do contato
                            console.log('[chatWithAgent] ✅ Usando UUID do contato:', {
                                contactId: contact.id,
                                phoneNumber
                            });
                        }
                    }
                    else {
                        console.warn('[chatWithAgent] ⚠️ whatsapp_contact_id não encontrado no banco:', {
                            whatsapp_contact_id: context.whatsapp_contact_id,
                            error: error?.message
                        });
                    }
                }
                catch (err) {
                    console.error('[chatWithAgent] ❌ Erro ao buscar contato pelo whatsapp_contact_id:', err);
                }
            }
            // PRIORIDADE 2: Se não tiver whatsapp_contact_id, mas tiver número no contexto, VALIDA no banco
            if (!phoneNumber && context) {
                const contextNumber = context.phone_number || context.from || context.to || '';
                if (contextNumber) {
                    console.log('[chatWithAgent] 🔍 Validando número do contexto no banco:', contextNumber);
                    // Tenta buscar contato pelo número no banco
                    try {
                        const { getContactByPhoneNumber, getContactByLid } = await Promise.resolve().then(() => __importStar(require('../integrations/whatsapp/whatsapp.contacts')));
                        // Remove sufixos para normalizar
                        const normalizedNumber = contextNumber.replace(/@s\.whatsapp\.net$/, '').replace(/@lid$/, '').trim();
                        // Tenta buscar pelo número
                        const contactResult = await getContactByPhoneNumber(normalizedNumber);
                        if (contactResult.success && contactResult.contact) {
                            // Contato encontrado no banco, usa número real ou LID
                            if (contactResult.contact.phone_number && contactResult.contact.status === 'active') {
                                phoneNumber = `${contactResult.contact.phone_number}@s.whatsapp.net`;
                                console.log('[chatWithAgent] ✅ Número do contexto validado no banco (número real):', phoneNumber);
                            }
                            else if (contactResult.contact.lid) {
                                phoneNumber = contactResult.contact.lid.endsWith('@lid') ? contactResult.contact.lid : `${contactResult.contact.lid}@lid`;
                                console.log('[chatWithAgent] ✅ Número do contexto validado no banco (LID):', phoneNumber);
                            }
                            else {
                                phoneNumber = contactResult.contact.id; // Usa UUID
                                console.log('[chatWithAgent] ✅ Usando UUID do contato encontrado:', phoneNumber);
                            }
                        }
                        else if (contextNumber.endsWith('@lid')) {
                            // Se for LID, tenta buscar pelo LID
                            const lidResult = await getContactByLid(contextNumber);
                            if (lidResult.success && lidResult.contact) {
                                if (lidResult.contact.phone_number && lidResult.contact.status === 'active') {
                                    phoneNumber = `${lidResult.contact.phone_number}@s.whatsapp.net`;
                                    console.log('[chatWithAgent] ✅ LID do contexto validado no banco (número real):', phoneNumber);
                                }
                                else {
                                    phoneNumber = contextNumber; // Usa o LID original
                                    console.log('[chatWithAgent] ✅ Usando LID do contexto:', phoneNumber);
                                }
                            }
                            else {
                                console.warn('[chatWithAgent] ⚠️ Número do contexto não encontrado no banco:', contextNumber);
                            }
                        }
                        else {
                            console.warn('[chatWithAgent] ⚠️ Número do contexto não encontrado no banco (não é LID nem número válido):', normalizedNumber);
                        }
                    }
                    catch (err) {
                        console.error('[chatWithAgent] ❌ Erro ao validar número do contexto:', err);
                    }
                }
            }
            // Segurança/LGPD: não inferir destinatário pela última mensagem não lida.
            if (!phoneNumber && agent.integrations_id) {
                console.warn('[chatWithAgent] Destinatario ausente; fallback por ultima mensagem nao lida bloqueado para evitar mistura de conversas', {
                    agentId,
                    integrationId: agent.integrations_id,
                    contextKeys: safeLogContextKeys(context)
                });
            }
            if (!phoneNumber || phoneNumber.trim() === '') {
                console.error('[chatWithAgent] ❌ Número não encontrado em nenhum lugar:', {
                    parsed: { to: parsed.to, phone: parsed.phone, phone_number: parsed.phone_number },
                    context: {
                        whatsapp_contact_id: context?.whatsapp_contact_id,
                        phone_number: context?.phone_number,
                        from: context?.from,
                        to: context?.to
                    }
                });
                return '❌ Não foi possível determinar o número de telefone do destinatário. Verifique se há mensagens não lidas ou forneça o whatsapp_contact_id (UUID do contato) no contexto.';
            }
            // Usa o ID da conversa diretamente (sem normalizar/converter)
            // O ID pode ser número ou ID completo com @lid, @s.whatsapp.net, etc.
            const conversationId = phoneNumber;
            console.log('[chatWithAgent] 📱 ID da conversa para envio:', conversationId);
            if (!message) {
                return '❌ Mensagem vazia. Não é possível enviar WhatsApp sem conteúdo.';
            }
            if (!agent.integrations_id) {
                return '❌ Agente não possui integração WhatsApp configurada.';
            }
            // Busca histórico do Redis antes de enviar (para contexto da IA)
            console.log('[chatWithAgent] 📚 Buscando histórico do Redis para contexto...');
            const history = await (0, whatsapp_redis_1.getHistoryFromRedis)(agent.integrations_id, conversationId, // Usa ID da conversa completo
            10 // últimas 10 mensagens
            );
            if (history.length > 0) {
                console.log(`[chatWithAgent] ✅ Histórico encontrado no Redis: ${history.length} mensagens`);
                // Se tem histórico, passa para a IA gerar resposta com contexto
                const historyContext = history.map(msg => {
                    return `${msg.role}: ${msg.content}`;
                }).join('\n');
                const contextualMessage = `Histórico da conversa:\n${historyContext}\n\nNova mensagem do usuário: ${message}\n\nGere uma resposta considerando o contexto acima.`;
                // Chama a IA novamente com contexto
                console.log('[chatWithAgent] 🤖 Gerando resposta com contexto do histórico...');
                const templateRoleForWhatsApp = agent.template_role || agent.role || "";
                const contextualResult = await (0, openai_1.chatText)({
                    system: (0, prompt_builder_1.buildAgentSystemPrompt)(agent.personality_prompt, templateRoleForWhatsApp, agent.primary_language) + '\n\nVocê está em uma conversa via WhatsApp. Use o histórico da conversa para dar respostas mais contextuais e naturais.',
                    user: contextualMessage,
                    model: agent.provider_model,
                    temperature: agent.temperature,
                    maxTokens: agent.max_tokens,
                    apiKey: agent.api_key,
                    responseFormat: AGENT_RESPONSE_SCHEMA,
                });
                // 🛡️ [OPENAI ERROR HANDLER] Verifica se a chamada falhou
                if (!contextualResult.success) {
                    console.error('[chatWithAgent] ❌ Erro na chamada do LLM (contextual):', contextualResult.error);
                    return contextualResult.content;
                }
                // 🎯 Salvar uso de tokens
                if (contextualResult.usage) {
                    const usage = contextualResult.usage;
                    void (async () => {
                        const companyId = await getCachedCompanyId();
                        await saveTokenUsage(agent.id, companyId, usage, agent.provider_model || 'gpt-4o', agent.provider || 'openai', context?.userId || context?.phone_number || context?.sessionId, context?.conversationId, { channel: 'whatsapp', has_history: true });
                    })();
                }
                // Usa a resposta contextualizada e extrai apenas o texto (remove JSON se houver)
                message = extractMessageText(contextualResult.content.trim());
                // 🛡️ Aplicar DLP na mensagem contextual
                message = await applyDLPToMessage(message);
                console.log('[chatWithAgent] ✅ Resposta gerada com contexto');
            }
            else {
                console.log('[chatWithAgent] ℹ️ Nenhum histórico encontrado no Redis, enviando mensagem original');
            }
            // Marca início da requisição para calcular tempo de resposta
            const requestStartedAt = new Date().toISOString();
            const voiceDelivery = await (0, voiceRuntime_service_1.sendAgentWhatsAppResponseWithVoiceFallback)({
                integrationId: agent.integrations_id,
                to: conversationId,
                text: message,
                agentId,
                context: {
                    request_started_at: requestStartedAt,
                },
            });
            const result = voiceDelivery.sendResult;
            if (result.success) {
                // Mensagem já foi aplicada DLP, salvar no histórico
                await (0, whatsapp_redis_1.saveMessageToHistory)(agent.integrations_id, conversationId, // Usa ID da conversa completo
                'assistant', message);
                // Se foi para fila (queued), retorna mensagem informativa
                if (result.queued) {
                    return `✅ Resposta gerada e salva na fila. Será enviada automaticamente quando o número real estiver disponível.`;
                }
                return `📱 WhatsApp enviado com sucesso para: ${conversationId}`;
            }
            else {
                // Se falhou, mas não é erro crítico, continua o fluxo
                let errorMsg = `❌ Erro ao enviar WhatsApp: ${result.error || 'Erro desconhecido'}`;
                errorMsg += '\n\n💡 DICA: esta plataforma aceita apenas WhatsApp oficial da Meta. Verifique Access Token, Phone Number ID, Verify Token e webhook oficial da Meta.';
                return errorMsg;
            }
        }
        catch (err) {
            console.error('❌ Erro ao enviar WhatsApp:', err);
            return `❌ Não foi possível enviar o WhatsApp: ${err.message || 'Erro desconhecido'}`;
        }
    }
    // 8️⃣ Ação: reply (mensagem simples)
    if (parsed.action === 'reply') {
        // 🎯 DECISÃO DA IA COM CONFIANÇA: Verificar antes de retornar reply
        // Reply pode ser usado em contextos onde a mensagem será enviada depois
        let historyLength = 0;
        let channel = channelContext || undefined;
        let contactId = context?.whatsapp_contact_id ||
            context?.phone_number ||
            context?.from ||
            context?.to ||
            context?.email ||
            context?.to_email ||
            context?.sessionId;
        if (channel === 'whatsapp') {
            contactId =
                context?.whatsapp_contact_id ||
                    context?.phone_number ||
                    context?.from ||
                    context?.to ||
                    contactId;
        }
        else if (channel === 'email') {
            contactId = context?.email || context?.to_email || contactId;
        }
        else if (channel === 'webchat' || channel === 'playground') {
            contactId = context?.sessionId || contactId;
            channel = 'webchat';
        }
        else if (context && !isWhatsAppCallContext) {
            if (context.phone_number || context.from || context.to || context.whatsapp_contact_id) {
                channel = 'whatsapp';
                contactId = context.whatsapp_contact_id || context.phone_number || context.from || context.to;
            }
            else if (context.email || context.to_email) {
                channel = 'email';
                contactId = context.email || context.to_email;
            }
            else if (context.sessionId) {
                channel = 'webchat';
                contactId = context.sessionId;
            }
        }
        if (agent.integrations_id && contactId && channel === 'whatsapp') {
            try {
                const history = await (0, whatsapp_redis_1.getHistoryFromRedis)(agent.integrations_id, contactId, 10);
                historyLength = history.length;
            }
            catch (err) {
                console.warn('[chatWithAgent] Erro ao buscar histórico para confiança:', err);
            }
        }
        // Buscar mensagem original do contexto se disponível (para workflows/flows)
        // A mensagem original do usuário pode estar em context.originalMessage, context.userMessage, context.input, ou context.whatsappMessage
        const originalMessage = context?.originalMessage || context?.userMessage || context?.input || context?.whatsappMessage || context?.text || message || '';
        console.log('[chatWithAgent] 🔍 Mensagem original para cálculo de confiança (reply):', {
            fromContext: !!(context?.originalMessage || context?.userMessage || context?.input || context?.whatsappMessage || context?.text),
            originalMessage: safeLogPreview(originalMessage),
            messageParam: safeLogPreview(message),
            contextKeys: safeLogContextKeys(context)
        });
        const decision = (0, confidence_calculator_1.calculateConfidence)(parsed, originalMessage, context, historyLength, !!fileContext, ragSources);
        // 📊 LOG DO RESULTADO DA DECISÃO
        console.log('');
        console.log('🔍 [chatWithAgent] Resultado da Decisão para reply:');
        console.log('  Score:', (decision.confidence_score * 100).toFixed(1) + '%');
        console.log('  Threshold:', (confidenceApprovalThreshold * 100).toFixed(1) + '%');
        console.log('  Channel:', channel || 'nenhum (webchat/playground)');
        console.log('  ContactId:', contactId || 'nenhum');
        console.log('  Status:', decision.confidence_score < confidenceApprovalThreshold ? '🛡️ BLOQUEADO' : '✅ APROVADO');
        console.log('  Motivo:', decision.reason);
        console.log('');
        if (isWhatsAppCallContext &&
            decision.confidence_score < confidenceApprovalThreshold &&
            parsed.message) {
            console.log('[chatWithAgent] Ligacao WhatsApp: confianca abaixo do limiar, mas resposta segue para TTS (bloqueio por confianca desativado neste canal)');
        }
        // Se confiança baixa, bloquear (mesmo sem channel/contactId - pode ser webchat/playground).
        // Ligação WhatsApp em tempo real: não bloquear — retorno vazio = usuário ouve silêncio (pior que uma resposta prudente).
        if (!context?.flow_skip_reply_confidence &&
            !isWhatsAppCallContext &&
            decision.confidence_score < confidenceApprovalThreshold &&
            parsed.message) {
            console.warn('[chatWithAgent] 🛡️ BLOQUEADO: Confiança baixa para reply');
            console.log('[chatWithAgent] Detalhes do bloqueio:', {
                score: decision.confidence_score,
                reason: decision.reason,
                channel: channel || 'webchat',
                contactId: contactId || 'playground',
                hasContext: !!context
            });
            // SEMPRE buscar user_id da tabela tb_users pelo email (não usar Supabase Auth)
            let userId;
            try {
                const { supabase } = await Promise.resolve().then(() => __importStar(require('../../lib/supabase')));
                const { data: userData, error: userError } = await supabase
                    .from('tb_users')
                    .select('id')
                    .eq('email', email)
                    .maybeSingle();
                if (userError) {
                    console.error('[chatWithAgent] Erro ao buscar user_id da tb_users:', userError);
                }
                else if (userData?.id) {
                    userId = userData.id;
                    console.log('[chatWithAgent] user_id encontrado na tb_users:', userId, 'para email:', email);
                }
                else {
                    console.warn('[chatWithAgent] Usuário não encontrado na tb_users para email:', email);
                }
            }
            catch (err) {
                console.error('[chatWithAgent] Erro ao buscar user_id:', err);
            }
            if (userId) {
                // Usa 'webchat' como padrão se não tiver channel (playground/teste)
                const finalChannel = channel || 'webchat';
                const finalContactId = contactId || context?.sessionId || 'playground';
                console.log('[chatWithAgent] Salvando decisão bloqueada:', {
                    agentId: agent.id,
                    userId,
                    channel: finalChannel,
                    contactId: finalContactId,
                    confidence: decision.confidence_score
                });
                await (0, save_decision_1.saveBlockedDecision)(agent.id, userId, message || '', decision, context, finalChannel, agent.integrations_id, finalContactId, email // Passa email para buscar companies_id
                );
                console.log('[chatWithAgent] ✅ Decisão salva com sucesso!');
            }
            else {
                console.error('[chatWithAgent] ❌ Não foi possível salvar decisão: userId não encontrado');
            }
            // Não retorna mensagem de aviso - apenas bloqueia silenciosamente
            // A mensagem aparecerá no Inbox para aprovação
            return ''; // Retorna vazio para não mostrar nada no chat
        }
        const replyMessage = parsed.message || 'Resposta gerada.';
        if (isWhatsAppCallContext) {
            return replyMessage;
        }
        if (disableChannelDelivery && channel === 'whatsapp') {
            return replyMessage;
        }
        if (channel === 'whatsapp') {
            if (!agent.integrations_id) {
                return '❌ Agente não possui integração WhatsApp configurada.';
            }
            const targetConversationId = context?.whatsapp_contact_id ||
                context?.phone_number ||
                context?.from ||
                context?.to ||
                contactId;
            if (!targetConversationId) {
                return '❌ Não foi possível determinar o destinatário da conversa no WhatsApp.';
            }
            const dlpReplyMessage = await applyDLPToMessage(replyMessage);
            const requestStartedAt = context?.request_started_at && typeof context.request_started_at === 'string'
                ? context.request_started_at
                : new Date().toISOString();
            const voiceDelivery = await (0, voiceRuntime_service_1.sendAgentWhatsAppResponseWithVoiceFallback)({
                integrationId: agent.integrations_id,
                to: targetConversationId,
                text: dlpReplyMessage,
                agentId,
                context: {
                    request_started_at: requestStartedAt,
                },
            });
            const result = voiceDelivery.sendResult;
            if (result.success) {
                await (0, whatsapp_redis_1.saveMessageToHistory)(agent.integrations_id, targetConversationId, 'assistant', dlpReplyMessage);
                if (result.queued) {
                    return `✅ Resposta gerada e salva na fila. Será enviada automaticamente quando o número real estiver disponível.`;
                }
                return `📱 Resposta enviada automaticamente para ${targetConversationId}`;
            }
            return `❌ Erro ao enviar WhatsApp: ${result.error || 'Erro desconhecido'}`;
        }
        return replyMessage;
    }
    // 9️⃣ Ação: ler dados do CRM
    if (parsed.action === 'read_crm' || parsed.action === 'get_crm_data') {
        try {
            // Última tentativa: se ainda não tem CRM, busca novamente
            if (!agent.crm_integration_id) {
                console.log('[chatWithAgent] ⚠️ Última tentativa: buscando CRM antes de executar ação read_crm...');
                try {
                    const { supabase } = await Promise.resolve().then(() => __importStar(require('../../lib/supabase')));
                    const { data: userData } = await supabase
                        .from('tb_users')
                        .select('id')
                        .eq('email', email)
                        .single();
                    const { getCompanyIdByEmail } = await Promise.resolve().then(() => __importStar(require('../../utils/company-helper')));
                    const companyId = await getCompanyIdByEmail(email);
                    if (companyId) {
                        const { data: agentData } = await supabase
                            .from('tb_agents')
                            .select('crm_integration_id')
                            .eq('id', agentId)
                            .eq('companies_id', companyId)
                            .single();
                        if (agentData?.crm_integration_id) {
                            console.log('[chatWithAgent] ✅ CRM encontrado na última tentativa:', agentData.crm_integration_id);
                            agent.crm_integration_id = agentData.crm_integration_id;
                        }
                    }
                }
                catch (err) {
                    console.error('[chatWithAgent] ❌ Erro na última tentativa de buscar CRM:', err);
                }
            }
            console.log('[chatWithAgent] 🔍 Verificando CRM do agente:', {
                agentId: agent.id,
                agentName: agent.nome,
                crm_integration_id: agent.crm_integration_id,
                hasCrmIntegration: !!agent.crm_integration_id,
                agentObject: JSON.stringify(agent, null, 2)
            });
            if (!agent.crm_integration_id) {
                console.log('[chatWithAgent] ❌ Agente não possui CRM configurado após todas as tentativas');
                return JSON.stringify({
                    action: 'read_crm',
                    data: [],
                    error: 'Agente não possui integração CRM configurada. Configure um CRM na tela de Integrações e salve as configurações do agente.'
                });
            }
            const entityType = parsed.entity_type || parsed.entity || 'contacts'; // contacts, deals, companies
            const requestedLimit = parsed.limit || parsed.count || 10;
            const properties = parsed.properties || undefined; // Array de propriedades específicas
            // ✅ NOVA ABORDAGEM: Usa filtros estruturados do JSON retornado pelo LLM
            // 
            // O LLM deve retornar filtros no formato estruturado no JSON da ação read_crm:
            // {
            //   "action": "read_crm",
            //   "entity_type": "contacts",
            //   "limit": 10,
            //   "filters": [
            //     { "field": "firstname", "operator": "starts_with", "value": "C" },
            //     { "field": "email", "operator": "contains", "value": "@gmail.com" }
            //   ]
            // }
            //
            // Campos suportados: firstname, lastname, email, phone, company
            // Operadores suportados: starts_with, equals, contains, ends_with
            //
            // Exemplos de como o usuário pode pedir:
            // - "começam com C" → { field: "firstname", operator: "starts_with", value: "C" }
            // - "que comecem com Carlos" → { field: "firstname", operator: "starts_with", value: "Carlos" }
            // - "email contém @gmail.com" → { field: "email", operator: "contains", value: "@gmail.com" }
            // - "nome é João" → { field: "firstname", operator: "equals", value: "João" }
            //
            // NOTA: Adicione estas instruções ao system_instructions do agente quando ele tiver CRM configurado
            const filters = parsed.filters || parsed.filter || [];
            // Processa filtros estruturados
            let structuredFilters = [];
            if (Array.isArray(filters) && filters.length > 0) {
                // Filtros já vêm estruturados do LLM
                structuredFilters = filters.filter((f) => f && typeof f === 'object' && f.field && f.operator && f.value !== undefined);
                console.log(`[chatWithAgent] 🔍 Filtros estruturados recebidos do LLM:`, structuredFilters);
            }
            else if (filters && typeof filters === 'object' && !Array.isArray(filters)) {
                // Se for um único objeto de filtro, converte para array
                if (filters.field && filters.operator && filters.value !== undefined) {
                    structuredFilters = [filters];
                    console.log(`[chatWithAgent] 🔍 Filtro único estruturado recebido do LLM:`, structuredFilters);
                }
            }
            // Busca mais dados do que o solicitado para ter opções de filtrar
            // Se o usuário pediu 10, busca 50 para ter mais opções
            const fetchLimit = requestedLimit > 20 ? requestedLimit * 2 : 50;
            // Busca a integração CRM para saber qual CRM usar
            // Valida que o CRM pertence à empresa do usuário
            const { supabase } = await Promise.resolve().then(() => __importStar(require('../../lib/supabase')));
            const { getCompanyIdByEmail } = await Promise.resolve().then(() => __importStar(require('../../utils/company-helper')));
            const companiesId = await getCompanyIdByEmail(email);
            if (!companiesId) {
                return JSON.stringify({
                    action: 'read_crm',
                    data: [],
                    error: 'Empresa do usuário não encontrada'
                });
            }
            const { data: crmIntegration, error: crmError } = await supabase
                .from('tb_crm_integrations')
                .select(`
          id,
          tb_crms (
            id,
            slug,
            name
          )
        `)
                .eq('id', agent.crm_integration_id)
                .eq('companies_id', companiesId)
                .eq('is_active', true)
                .single();
            if (crmError || !crmIntegration) {
                return JSON.stringify({
                    action: 'read_crm',
                    data: [],
                    error: 'Integração CRM não encontrada, inativa ou não pertence à sua empresa'
                });
            }
            const crm = crmIntegration.tb_crms;
            const crmSlug = crm?.slug;
            if (!crmSlug) {
                return JSON.stringify({
                    action: 'read_crm',
                    data: [],
                    error: 'Tipo de CRM não identificado'
                });
            }
            // Importa serviços de CRM baseado no slug
            let data = [];
            let filterParams = {}; // Declara fora do bloco para poder usar depois
            if (crmSlug === 'hubspot') {
                const { getHubSpotContacts, getHubSpotDeals, searchHubSpotContacts } = await Promise.resolve().then(() => __importStar(require('../integrations/crm/hubspot.service')));
                if (entityType === 'contacts' || entityType === 'contact') {
                    // Processa filtros estruturados para o formato esperado pelo serviço
                    filterParams = {};
                    for (const filter of structuredFilters) {
                        const { field, operator, value } = filter;
                        // Mapeia operadores para o formato esperado pelo serviço
                        if (field === 'firstname' && operator === 'starts_with') {
                            filterParams.firstnameStartsWith = String(value);
                        }
                        else if (field === 'firstname' && operator === 'equals') {
                            filterParams.firstnameEquals = String(value);
                        }
                        else if (field === 'email' && operator === 'contains') {
                            filterParams.emailContains = String(value);
                        }
                        else if (field === 'email' && operator === 'equals') {
                            filterParams.emailEquals = String(value);
                        }
                        // Adicione mais mapeamentos conforme necessário
                    }
                    // Se há filtros estruturados (mesmo que não mapeados para API), usa searchHubSpotContacts
                    // para buscar mais contatos e aplicar filtros localmente
                    if (structuredFilters.length > 0) {
                        console.log(`[chatWithAgent] 🚀 Buscando contatos com filtros estruturados (${structuredFilters.length} filtro(s)):`, structuredFilters);
                        // Extrai todos os campos usados nos filtros para incluí-los na busca
                        const fieldsInFilters = structuredFilters.map((f) => f.field).filter((f) => f);
                        const defaultFields = ['firstname', 'lastname', 'email', 'phone', 'company', 'lifecyclestage'];
                        // Combina propriedades solicitadas + campos dos filtros (sem duplicatas)
                        const allProperties = new Set();
                        if (properties && properties.length > 0) {
                            properties.forEach((p) => allProperties.add(p));
                        }
                        else {
                            defaultFields.forEach((p) => allProperties.add(p));
                        }
                        // Adiciona campos dos filtros que não são campos padrão
                        fieldsInFilters.forEach((field) => {
                            if (!defaultFields.includes(field.toLowerCase())) {
                                allProperties.add(field);
                            }
                        });
                        const propertiesToFetch = Array.from(allProperties);
                        console.log(`[chatWithAgent] 📋 Propriedades a buscar:`, propertiesToFetch);
                        // Passa os filtros estruturados diretamente para a API do HubSpot
                        // A função searchHubSpotContacts agora aceita filtros estruturados e os envia para a API
                        data = await searchHubSpotContacts(agent.crm_integration_id, requestedLimit, filterParams, // Filtros legados (mantido para compatibilidade)
                        propertiesToFetch, structuredFilters // Filtros estruturados - serão enviados diretamente para a API
                        );
                        console.log(`[chatWithAgent] ✅ API retornou ${data.length} contatos (filtros aplicados na API do HubSpot)`);
                    }
                    else {
                        // Busca normal sem filtros
                        console.log(`[chatWithAgent] 📋 Buscando ${fetchLimit} contatos sem filtros`);
                        data = await getHubSpotContacts(agent.crm_integration_id, fetchLimit, properties);
                        // Limita aos N primeiros
                        data = data.slice(0, requestedLimit);
                    }
                }
                else if (entityType === 'deals' || entityType === 'deal') {
                    data = await getHubSpotDeals(agent.crm_integration_id, fetchLimit, properties);
                    data = data.slice(0, requestedLimit);
                }
                else {
                    return JSON.stringify({
                        action: 'read_crm',
                        data: [],
                        error: `Tipo de entidade não suportado: ${entityType}. Use 'contacts' ou 'deals'.`
                    });
                }
            }
            else if (crmSlug === 'mailchimp') {
                const { getMailchimpContacts, getMailchimpLists, searchMailchimpContacts } = await Promise.resolve().then(() => __importStar(require('../integrations/crm/mailchimp.service')));
                const listId = parsed.list_id || parsed.audience_id || parsed.mailchimp_list_id;
                if (entityType === 'contacts' || entityType === 'contact' || entityType === 'members' || entityType === 'member') {
                    if (structuredFilters.length > 0) {
                        data = await searchMailchimpContacts(agent.crm_integration_id, requestedLimit, listId, structuredFilters);
                    }
                    else {
                        data = await getMailchimpContacts(agent.crm_integration_id, fetchLimit, listId);
                        data = data.slice(0, requestedLimit);
                    }
                }
                else if (entityType === 'lists' || entityType === 'audiences' || entityType === 'audience') {
                    data = await getMailchimpLists(agent.crm_integration_id, requestedLimit);
                }
                else {
                    return JSON.stringify({
                        action: 'read_crm',
                        data: [],
                        error: `Tipo de entidade nao suportado para Mailchimp: ${entityType}. Use 'contacts' ou 'lists'.`
                    });
                }
            }
            else {
                return JSON.stringify({
                    action: 'read_crm',
                    data: [],
                    error: `CRM '${crmSlug}' ainda não está implementado. CRMs suportados: hubspot, mailchimp`
                });
            }
            // ✅ Aplica filtros adicionais localmente APENAS para operadores não suportados pela API (ex: starts_with)
            // Operadores suportados pela API (equals, contains, gt, gte, lt, lte) já foram aplicados na API
            const needsLocalFiltering = structuredFilters.some(f => f.operator === 'starts_with');
            if (needsLocalFiltering) {
                // Função auxiliar para normalizar telefone (remove espaços, traços, parênteses, etc.)
                const normalizePhone = (phone) => {
                    if (!phone)
                        return '';
                    // Remove tudo exceto números e o sinal de +
                    return phone.replace(/[^\d+]/g, '');
                };
                // Função auxiliar para remover código do país do telefone (ex: +55, 55)
                // Isso permite buscar por "11" e encontrar "+55119999431006"
                const removeCountryCode = (phone) => {
                    if (!phone)
                        return '';
                    // Remove códigos de país comuns (Brasil: +55, 55)
                    let cleaned = phone.replace(/^\+?55/, '');
                    // Se ainda começar com +, remove também
                    cleaned = cleaned.replace(/^\+/, '');
                    return cleaned;
                };
                // Função genérica para buscar valor de campo (busca em item direto e em properties)
                // Funciona para qualquer campo, incluindo campos customizados do HubSpot
                // Tenta variações do nome do campo (case-insensitive, com/sem prefixo hs_)
                // Aceita valores numéricos, null, undefined e strings
                const getFieldValue = (item, fieldName) => {
                    // Normaliza o nome do campo para busca case-insensitive
                    const normalizedFieldName = fieldName.toLowerCase();
                    // Função auxiliar para verificar se um valor existe (inclui 0 e false como valores válidos)
                    const hasValue = (val) => {
                        return val !== undefined && val !== null && val !== '';
                    };
                    // Função auxiliar para converter valor para string (aceita números, null, undefined)
                    const valueToString = (val) => {
                        if (val === null || val === undefined)
                            return '';
                        if (typeof val === 'number')
                            return String(val);
                        return String(val);
                    };
                    // 1. Tenta campo direto com nome exato (ex: item.phone, item.firstname)
                    if (item[fieldName] !== undefined) {
                        return valueToString(item[fieldName]);
                    }
                    // 2. Tenta em properties com nome exato
                    if (item.properties && item.properties[fieldName] !== undefined) {
                        return valueToString(item.properties[fieldName]);
                    }
                    // 3. Tenta variações do nome do campo em properties (case-insensitive)
                    if (item.properties) {
                        // Busca case-insensitive nas chaves de properties
                        for (const key in item.properties) {
                            if (key.toLowerCase() === normalizedFieldName) {
                                return valueToString(item.properties[key]);
                            }
                        }
                        // Tenta com prefixo hs_ se não tiver
                        if (!fieldName.startsWith('hs_')) {
                            const withPrefix = `hs_${fieldName}`;
                            if (item.properties[withPrefix] !== undefined) {
                                return valueToString(item.properties[withPrefix]);
                            }
                            // Tenta case-insensitive com prefixo
                            for (const key in item.properties) {
                                if (key.toLowerCase() === withPrefix.toLowerCase()) {
                                    return valueToString(item.properties[key]);
                                }
                            }
                        }
                        // Tenta sem prefixo hs_ se tiver
                        if (fieldName.startsWith('hs_')) {
                            const withoutPrefix = fieldName.replace(/^hs_/, '');
                            if (item.properties[withoutPrefix] !== undefined) {
                                return valueToString(item.properties[withoutPrefix]);
                            }
                        }
                    }
                    return '';
                };
                // Aplica filtros locais APENAS para operadores não suportados pela API (ex: starts_with)
                // Operadores suportados pela API (equals, contains, gt, gte, lt, lte) já foram aplicados na API
                for (const filter of structuredFilters) {
                    const { field, operator, value } = filter;
                    // Pula filtros que já foram aplicados na API
                    if (operator === 'equals' || operator === 'contains' || operator === 'gt' || operator === 'gte' || operator === 'lt' || operator === 'lte') {
                        console.log(`[chatWithAgent] ⏭️ Filtro ${field} ${operator} ${value} já foi aplicado na API do HubSpot, pulando filtragem local`);
                        continue;
                    }
                    const valueStr = String(value).toLowerCase();
                    if (operator === 'starts_with') {
                        if (field === 'firstname') {
                            data = data.filter((item) => getFieldValue(item, 'firstname').trim().toLowerCase() === valueStr);
                        }
                        else if (field === 'lastname') {
                            data = data.filter((item) => getFieldValue(item, 'lastname').trim().toLowerCase() === valueStr);
                        }
                        else if (field === 'email') {
                            data = data.filter((item) => getFieldValue(item, 'email').toLowerCase() === valueStr);
                        }
                        else if (field === 'phone') {
                            const normalizedValue = normalizePhone(String(value));
                            const valueWithoutCountry = removeCountryCode(normalizedValue);
                            data = data.filter((item) => {
                                const itemPhone = normalizePhone(getFieldValue(item, 'phone'));
                                if (!itemPhone)
                                    return false;
                                const itemPhoneWithoutCountry = removeCountryCode(itemPhone);
                                // Para equals, compara tanto com código do país quanto sem
                                return itemPhone === normalizedValue || itemPhoneWithoutCountry === valueWithoutCountry;
                            });
                        }
                        else {
                            // Campo genérico - busca em qualquer lugar (ex: score, cellphone, custom_field, etc.)
                            let foundFieldInAnyItem = false;
                            data = data.filter((item) => {
                                // Busca o valor bruto diretamente de properties (mesmo que seja null/undefined)
                                let rawValue = undefined;
                                let foundKey = null;
                                if (item.properties) {
                                    // Tenta nome exato primeiro
                                    if (item.properties[field] !== undefined) {
                                        rawValue = item.properties[field];
                                        foundKey = field;
                                    }
                                    else {
                                        // Tenta case-insensitive
                                        for (const key in item.properties) {
                                            if (key.toLowerCase() === field.toLowerCase()) {
                                                rawValue = item.properties[key];
                                                foundKey = key;
                                                break;
                                            }
                                        }
                                    }
                                }
                                // Se não encontrou em properties, tenta no item direto
                                if (rawValue === undefined && item[field] !== undefined) {
                                    rawValue = item[field];
                                    foundKey = field;
                                }
                                // Converte para string para comparação
                                let fieldValue = '';
                                if (rawValue !== undefined && rawValue !== null) {
                                    if (typeof rawValue === 'number') {
                                        fieldValue = String(rawValue);
                                    }
                                    else {
                                        fieldValue = String(rawValue);
                                    }
                                }
                                const matches = fieldValue.toLowerCase() === valueStr;
                                // Se encontrou o campo (mesmo que não faça match), marca como encontrado
                                if (rawValue !== undefined) {
                                    foundFieldInAnyItem = true;
                                }
                                // Log de debug para os primeiros itens quando busca campos customizados
                                if (data.indexOf(item) < 3) {
                                    console.log(`[chatWithAgent] 🔍 Debug generic field filter: field="${field}", foundKey="${foundKey}", rawValue=${JSON.stringify(rawValue)}, rawValueType=${typeof rawValue}, convertedValue="${fieldValue}", searchValue="${valueStr}", matches=${matches}`);
                                    if (item.properties && foundKey) {
                                        console.log(`[chatWithAgent] 📋 Valor completo do campo em properties:`, {
                                            key: foundKey,
                                            value: item.properties[foundKey],
                                            type: typeof item.properties[foundKey],
                                            isNull: item.properties[foundKey] === null,
                                            isUndefined: item.properties[foundKey] === undefined,
                                            isEmptyString: item.properties[foundKey] === ''
                                        });
                                    }
                                    // Se não encontrou o campo, mostra propriedades disponíveis
                                    if (rawValue === undefined && item.properties) {
                                        // Verifica se o campo existe mas tem valor undefined/null
                                        const hasField = item.properties.hasOwnProperty(field) ||
                                            Object.keys(item.properties).some(k => k.toLowerCase() === field.toLowerCase());
                                        if (hasField) {
                                            const exactKey = Object.keys(item.properties).find(k => k.toLowerCase() === field.toLowerCase());
                                            console.log(`[chatWithAgent] ⚠️ Campo "${field}" EXISTE mas valor é: ${JSON.stringify(exactKey ? item.properties[exactKey] : 'N/A')} (chave exata: "${exactKey}")`);
                                            console.log(`[chatWithAgent] 📋 Todas as propriedades com valores:`, Object.entries(item.properties).slice(0, 20).map(([k, v]) => `${k}=${JSON.stringify(v)}`));
                                        }
                                        else {
                                            const allProperties = Object.keys(item.properties);
                                            const matchingProperties = allProperties.filter(p => p.toLowerCase().includes(field.toLowerCase()) ||
                                                field.toLowerCase().includes(p.toLowerCase()));
                                            console.log(`[chatWithAgent] ⚠️ Campo "${field}" não encontrado. Propriedades similares:`, matchingProperties.slice(0, 10));
                                            console.log(`[chatWithAgent] 📋 Todas as propriedades disponíveis (primeiras 30):`, allProperties.slice(0, 30));
                                        }
                                    }
                                }
                                return matches;
                            });
                            if (!foundFieldInAnyItem && data.length > 0) {
                                console.log(`[chatWithAgent] ⚠️ Campo "${field}" não foi encontrado em nenhum item. Verifique o nome do campo no HubSpot.`);
                            }
                        }
                    }
                    else if (operator === 'contains') {
                        if (field === 'email') {
                            data = data.filter((item) => getFieldValue(item, 'email').toLowerCase().includes(valueStr));
                        }
                        else if (field === 'firstname') {
                            data = data.filter((item) => getFieldValue(item, 'firstname').toLowerCase().includes(valueStr));
                        }
                        else if (field === 'lastname') {
                            data = data.filter((item) => getFieldValue(item, 'lastname').toLowerCase().includes(valueStr));
                        }
                        else if (field === 'phone') {
                            const normalizedValue = normalizePhone(String(value));
                            const valueWithoutCountry = removeCountryCode(normalizedValue);
                            data = data.filter((item) => {
                                const itemPhone = normalizePhone(getFieldValue(item, 'phone'));
                                if (!itemPhone)
                                    return false;
                                const itemPhoneWithoutCountry = removeCountryCode(itemPhone);
                                // Para contains, verifica tanto no telefone completo quanto sem código do país
                                return itemPhone.includes(normalizedValue) || itemPhoneWithoutCountry.includes(valueWithoutCountry);
                            });
                        }
                        else {
                            // Campo genérico - busca em qualquer lugar
                            data = data.filter((item) => getFieldValue(item, field).toLowerCase().includes(valueStr));
                        }
                    }
                    else if (operator === 'starts_with') {
                        // Se não foi aplicado na API, aplica localmente
                        if (field === 'firstname' && !filterParams.firstnameStartsWith) {
                            data = data.filter((item) => getFieldValue(item, 'firstname').trim().toUpperCase().startsWith(valueStr.toUpperCase()));
                        }
                        else if (field === 'lastname') {
                            data = data.filter((item) => getFieldValue(item, 'lastname').trim().toUpperCase().startsWith(valueStr.toUpperCase()));
                        }
                        else if (field === 'phone') {
                            // Normaliza o valor e o telefone do item antes de comparar
                            const normalizedValue = normalizePhone(String(value));
                            // Remove código do país do valor também, se houver
                            const valueWithoutCountry = removeCountryCode(normalizedValue);
                            data = data.filter((item) => {
                                const itemPhone = normalizePhone(getFieldValue(item, 'phone'));
                                if (!itemPhone)
                                    return false;
                                // Remove código do país do telefone do item
                                const itemPhoneWithoutCountry = removeCountryCode(itemPhone);
                                // Verifica AMBAS as possibilidades para pegar números com ou sem código do país:
                                // 1. Telefone normalizado começa com valor normalizado (ex: "+5511..." começa com "+5511" ou "5511")
                                // 2. Telefone sem código do país começa com valor sem código do país (ex: "11999431006" começa com "11")
                                const matchesWithCountry = itemPhone.startsWith(normalizedValue);
                                const matchesWithoutCountry = itemPhoneWithoutCountry.startsWith(valueWithoutCountry);
                                const matches = matchesWithCountry || matchesWithoutCountry;
                                // Log de debug para os primeiros itens
                                if (data.indexOf(item) < 3) {
                                    console.log(`[chatWithAgent] 🔍 Debug phone filter: itemPhone="${itemPhone}" -> withoutCountry="${itemPhoneWithoutCountry}", value="${normalizedValue}" -> withoutCountry="${valueWithoutCountry}", matchesWithCountry=${matchesWithCountry}, matchesWithoutCountry=${matchesWithoutCountry}, final=${matches}`);
                                }
                                return matches;
                            });
                            console.log(`[chatWithAgent] 🔍 Filtrado por phone starts_with "${value}" (normalizado: "${normalizedValue}", sem código país: "${valueWithoutCountry}")`);
                        }
                        else {
                            // Campo genérico - busca em qualquer lugar
                            data = data.filter((item) => getFieldValue(item, field).toUpperCase().startsWith(valueStr.toUpperCase()));
                        }
                    }
                    else if (operator === 'ends_with') {
                        if (field === 'email') {
                            data = data.filter((item) => getFieldValue(item, 'email').toLowerCase().endsWith(valueStr));
                        }
                        else if (field === 'firstname') {
                            data = data.filter((item) => getFieldValue(item, 'firstname').toLowerCase().endsWith(valueStr));
                        }
                        else if (field === 'phone') {
                            const normalizedValue = normalizePhone(String(value));
                            const valueWithoutCountry = removeCountryCode(normalizedValue);
                            data = data.filter((item) => {
                                const itemPhone = normalizePhone(getFieldValue(item, 'phone'));
                                if (!itemPhone)
                                    return false;
                                const itemPhoneWithoutCountry = removeCountryCode(itemPhone);
                                // Para ends_with, verifica tanto no telefone completo quanto sem código do país
                                return itemPhone.endsWith(normalizedValue) || itemPhoneWithoutCountry.endsWith(valueWithoutCountry);
                            });
                        }
                        else {
                            // Campo genérico - busca em qualquer lugar
                            data = data.filter((item) => getFieldValue(item, field).toLowerCase().endsWith(valueStr));
                        }
                    }
                }
                // Limita aos N primeiros após filtrar
                data = data.slice(0, requestedLimit);
                console.log(`[chatWithAgent] ✅ Após aplicar filtros locais: ${data.length} contatos`);
            }
            // Se propriedades adicionais foram especificadas, inclui-as no nível raiz de cada item
            if (properties && properties.length > 0) {
                data = data.map((item) => {
                    const formattedItem = { ...item };
                    // Para cada propriedade solicitada, inclui no nível raiz se existir em properties
                    for (const prop of properties) {
                        // Propriedades padrão já estão no nível raiz, então só adiciona as adicionais
                        const defaultProps = ['firstname', 'lastname', 'email', 'phone', 'company', 'lifecyclestage'];
                        if (!defaultProps.includes(prop.toLowerCase())) {
                            // Busca a propriedade em item.properties ou item direto
                            const propValue = item.properties?.[prop] || item[prop];
                            if (propValue !== undefined && propValue !== null && propValue !== '') {
                                formattedItem[prop] = propValue;
                            }
                        }
                    }
                    return formattedItem;
                });
                console.log(`[chatWithAgent] ✅ Propriedades adicionais incluídas no nível raiz:`, properties);
            }
            console.log(`[chatWithAgent] ✅ Retornando ${data.length} contatos (solicitados: ${requestedLimit}, filtros aplicados: ${structuredFilters.length})`);
            return JSON.stringify({
                action: 'read_crm',
                entity_type: entityType,
                crm: crmSlug,
                count: data.length,
                filters_applied: structuredFilters,
                properties_requested: properties || null,
                data: data
            });
        }
        catch (error) {
            console.error('❌ Erro ao ler dados do CRM:', error);
            return JSON.stringify({
                action: 'read_crm',
                data: [],
                error: error.message || 'Erro ao acessar CRM'
            });
        }
    }
    // 🔟 Ação: criar contato no CRM
    if (parsed.action === 'create_crm_contact' || parsed.action === 'create_crm_lead') {
        try {
            if (!agent.crm_integration_id) {
                return JSON.stringify({
                    action: 'create_crm_contact',
                    success: false,
                    error: 'Agente não possui integração CRM configurada'
                });
            }
            const contactData = parsed.data || parsed.contact || {
                firstname: parsed.firstname || parsed.first_name,
                lastname: parsed.lastname || parsed.last_name,
                email: parsed.email,
                phone: parsed.phone || parsed.phone_number,
                company: parsed.company
            };
            // Busca o tipo de CRM (valida que pertence à empresa do usuário)
            const { supabase } = await Promise.resolve().then(() => __importStar(require('../../lib/supabase')));
            const { getCompanyIdByEmail } = await Promise.resolve().then(() => __importStar(require('../../utils/company-helper')));
            const companiesId = await getCompanyIdByEmail(email);
            if (!companiesId) {
                return JSON.stringify({
                    action: 'crm_capture_lead',
                    success: false,
                    error: 'Empresa do usuário não encontrada'
                });
            }
            const { data: crmIntegration } = await supabase
                .from('tb_crm_integrations')
                .select(`
          id,
          tb_crms (
            slug
          )
        `)
                .eq('id', agent.crm_integration_id)
                .eq('companies_id', companiesId)
                .eq('is_active', true)
                .single();
            if (!crmIntegration) {
                return JSON.stringify({
                    action: 'crm_capture_lead',
                    success: false,
                    error: 'Integração CRM não encontrada ou não pertence à sua empresa'
                });
            }
            const crm = crmIntegration?.tb_crms;
            const crmSlug = crm?.slug;
            if (crmSlug === 'hubspot') {
                const { createHubSpotContact } = await Promise.resolve().then(() => __importStar(require('../integrations/crm/hubspot.service')));
                const result = await createHubSpotContact(agent.crm_integration_id, contactData);
                return JSON.stringify({
                    action: 'create_crm_contact',
                    success: true,
                    crm: 'hubspot',
                    contact: result
                });
            }
            else if (crmSlug === 'mailchimp') {
                const { createMailchimpContact } = await Promise.resolve().then(() => __importStar(require('../integrations/crm/mailchimp.service')));
                const listId = parsed.list_id || parsed.audience_id || parsed.mailchimp_list_id || contactData.list_id;
                const result = await createMailchimpContact(agent.crm_integration_id, contactData, listId);
                return JSON.stringify({
                    action: 'create_crm_contact',
                    success: true,
                    crm: 'mailchimp',
                    contact: result
                });
            }
            else {
                return JSON.stringify({
                    action: 'create_crm_contact',
                    success: false,
                    error: `CRM '${crmSlug}' ainda não está implementado para criação de contatos`
                });
            }
        }
        catch (error) {
            console.error('❌ Erro ao criar contato no CRM:', error);
            return JSON.stringify({
                action: 'create_crm_contact',
                success: false,
                error: error.message || 'Erro ao criar contato no CRM'
            });
        }
    }
    // 1️⃣1️⃣ Ação: atualizar contato no CRM
    if (parsed.action === 'update_crm_contact' || parsed.action === 'update_crm_lead') {
        try {
            if (!agent.crm_integration_id) {
                return JSON.stringify({
                    action: 'update_crm_contact',
                    success: false,
                    error: 'Agente não possui integração CRM configurada'
                });
            }
            const contactId = parsed.contact_id || parsed.id;
            if (!contactId) {
                return JSON.stringify({
                    action: 'update_crm_contact',
                    success: false,
                    error: 'ID do contato é obrigatório'
                });
            }
            const contactData = parsed.data || parsed.contact || {
                ...(parsed.firstname || parsed.first_name ? { firstname: parsed.firstname || parsed.first_name } : {}),
                ...(parsed.lastname || parsed.last_name ? { lastname: parsed.lastname || parsed.last_name } : {}),
                ...(parsed.email ? { email: parsed.email } : {}),
                ...(parsed.phone || parsed.phone_number ? { phone: parsed.phone || parsed.phone_number } : {}),
                ...(parsed.company ? { company: parsed.company } : {})
            };
            // Busca o tipo de CRM (valida que pertence à empresa do usuário)
            const { supabase } = await Promise.resolve().then(() => __importStar(require('../../lib/supabase')));
            const { getCompanyIdByEmail } = await Promise.resolve().then(() => __importStar(require('../../utils/company-helper')));
            const companiesId = await getCompanyIdByEmail(email);
            if (!companiesId) {
                return JSON.stringify({
                    action: 'crm_update_contact',
                    success: false,
                    error: 'Empresa do usuário não encontrada'
                });
            }
            const { data: crmIntegration } = await supabase
                .from('tb_crm_integrations')
                .select(`
          id,
          tb_crms (
            slug
          )
        `)
                .eq('id', agent.crm_integration_id)
                .eq('companies_id', companiesId)
                .eq('is_active', true)
                .single();
            if (!crmIntegration) {
                return JSON.stringify({
                    action: 'crm_update_contact',
                    success: false,
                    error: 'Integração CRM não encontrada ou não pertence à sua empresa'
                });
            }
            const crm = crmIntegration?.tb_crms;
            const crmSlug = crm?.slug;
            if (crmSlug === 'hubspot') {
                const { updateHubSpotContact } = await Promise.resolve().then(() => __importStar(require('../integrations/crm/hubspot.service')));
                const result = await updateHubSpotContact(agent.crm_integration_id, contactId, contactData);
                return JSON.stringify({
                    action: 'update_crm_contact',
                    success: true,
                    crm: 'hubspot',
                    contact: result
                });
            }
            else if (crmSlug === 'mailchimp') {
                const { updateMailchimpContact } = await Promise.resolve().then(() => __importStar(require('../integrations/crm/mailchimp.service')));
                const listId = parsed.list_id || parsed.audience_id || parsed.mailchimp_list_id || contactData.list_id;
                const result = await updateMailchimpContact(agent.crm_integration_id, contactId, contactData, listId);
                return JSON.stringify({
                    action: 'update_crm_contact',
                    success: true,
                    crm: 'mailchimp',
                    contact: result
                });
            }
            else {
                return JSON.stringify({
                    action: 'update_crm_contact',
                    success: false,
                    error: `CRM '${crmSlug}' ainda não está implementado para atualização de contatos`
                });
            }
        }
        catch (error) {
            console.error('❌ Erro ao atualizar contato no CRM:', error);
            return JSON.stringify({
                action: 'update_crm_contact',
                success: false,
                error: error.message || 'Erro ao atualizar contato no CRM'
            });
        }
    }
    // 8.5️⃣ Se for texto simples (não JSON) ou JSON sem action mas com contexto de WhatsApp
    if (isPlainText || (!parsed.action && typeof parsed === 'object' && parsed !== null && parsed.message)) {
        if (isWhatsAppCallContext) {
            return extractMessageText(parsed.message || cleanedResponse || '');
        }
        // Verifica se há contexto de WhatsApp (vem do webhook)
        if (context && hasWhatsAppContext && disableChannelDelivery) {
            return extractMessageText(parsed.message || cleanedResponse || '');
        }
        if (context && hasWhatsAppContext) {
            console.log('[chatWithAgent] 📱 Texto simples detectado com contexto WhatsApp, enviando automaticamente...');
            try {
                // Extrai número do contexto - DEVE vir do banco de dados
                // Prioriza whatsapp_contact_id (UUID do contato no banco)
                let phoneNumber = context.whatsapp_contact_id || context.phone_number || context.from || context.to || '';
                console.log('[chatWithAgent] 🔍 Buscando número do contato:', {
                    whatsapp_contact_id: context.whatsapp_contact_id,
                    phone_number: context.phone_number,
                    from: context.from,
                    to: context.to,
                    phoneNumberEncontrado: phoneNumber
                });
                // Segurança/LGPD: não inferir destinatário pela última mensagem não lida.
                if (!phoneNumber) {
                    console.warn('[chatWithAgent] Destinatario ausente; fallback por ultima mensagem nao lida bloqueado para evitar mistura de conversas', {
                        agentId,
                        integrationId: agent.integrations_id,
                        contextKeys: safeLogContextKeys(context)
                    });
                }
                // Se ainda não tiver número, tenta extrair do parsed (última tentativa)
                if (!phoneNumber && parsed.phone_number) {
                    phoneNumber = parsed.phone_number;
                    console.log('[chatWithAgent] ⚠️ Usando número do parsed (última tentativa):', phoneNumber);
                }
                if (!phoneNumber || phoneNumber.trim() === '') {
                    console.error('[chatWithAgent] ❌ Número não encontrado em nenhum lugar:', {
                        context,
                        parsed: parsed.phone_number
                    });
                    return '❌ Não foi possível determinar o número de telefone do destinatário. Verifique se o contato existe no banco de dados.';
                }
                // Extrai mensagem
                let messageToSend = parsed.message || cleanedResponse || '';
                // Extrai o texto da mensagem (remove qualquer JSON)
                messageToSend = extractMessageText(messageToSend);
                // 🛡️ Aplicar DLP na mensagem extraída
                messageToSend = await applyDLPToMessage(messageToSend);
                console.log('[chatWithAgent] 📝 Mensagem extraída (texto simples):', {
                    originalLength: (parsed.message || cleanedResponse || '').length,
                    extractedLength: messageToSend.length,
                    preview: safeLogPreview(messageToSend)
                });
                // Garante que messageToSend é uma string válida
                if (typeof messageToSend !== 'string') {
                    messageToSend = String(messageToSend);
                }
                // Última validação: se ainda contiver JSON, remove
                if (messageToSend.trim().startsWith('{') && messageToSend.trim().endsWith('}')) {
                    try {
                        const finalParse = JSON.parse(messageToSend);
                        if (finalParse.message && typeof finalParse.message === 'string') {
                            messageToSend = finalParse.message;
                            console.log('[chatWithAgent] ✅ Extraído texto do JSON (validação final - texto simples)');
                        }
                        else if (finalParse.action === 'send_whatsapp' && finalParse.message) {
                            messageToSend = finalParse.message;
                            console.log('[chatWithAgent] ✅ Extraído texto do send_whatsapp (validação final - texto simples)');
                        }
                    }
                    catch (e) {
                        // Não é JSON válido, mantém como está
                    }
                }
                if (!messageToSend || messageToSend.trim() === '') {
                    return '❌ Mensagem vazia. Não é possível enviar WhatsApp sem conteúdo.';
                }
                if (!agent.integrations_id) {
                    return '❌ Agente não possui integração WhatsApp configurada.';
                }
                // Usa ID da conversa diretamente (sem normalizar)
                const conversationId = phoneNumber;
                console.log('[chatWithAgent] 📱 Enviando mensagem simples via WhatsApp:', {
                    conversationId,
                    messageLength: messageToSend.length
                });
                // 🛡️ Aplicar DLP antes de enviar
                const dlpMessageToSend = await applyDLPToMessage(messageToSend);
                // Envia via WhatsApp
                const voiceDelivery = await (0, voiceRuntime_service_1.sendAgentWhatsAppResponseWithVoiceFallback)({
                    integrationId: agent.integrations_id,
                    to: conversationId,
                    text: dlpMessageToSend,
                    agentId,
                });
                const result = voiceDelivery.sendResult;
                if (result.success) {
                    // Mensagem já foi aplicada DLP antes de enviar, usar a mesma
                    await (0, whatsapp_redis_1.saveMessageToHistory)(agent.integrations_id, conversationId, // Usa ID da conversa completo
                    'assistant', dlpMessageToSend);
                    return `📱 Mensagem enviada com sucesso para: ${conversationId}`;
                }
                else {
                    return `❌ Erro ao enviar WhatsApp: ${result.error || 'Erro desconhecido'}`;
                }
            }
            catch (error) {
                console.error('[chatWithAgent] ❌ Erro ao processar texto simples:', error);
                return `❌ Erro ao processar mensagem: ${error?.message || 'Erro desconhecido'}`;
            }
        }
    }
    // 9️⃣ Se não tem action mas tem dados (usado em flows para passar dados entre nodes)
    // MAS: Se a mensagem do usuário pediu uma ação específica, tenta detectar e executar
    if (!parsed.action && typeof parsed === 'object' && parsed !== null) {
        console.log('[chatWithAgent] JSON sem action detectado:', parsed);
        // Detecta se a mensagem do usuário pediu uma ação específica
        const messageLower = message.toLowerCase();
        // Detecta pedido de WhatsApp
        if (messageLower.includes('whatsapp') || messageLower.includes('send_whatsapp') || messageLower.includes('enviar whatsapp')) {
            console.log('[chatWithAgent] 🔄 Detectado pedido de WhatsApp na mensagem, mas agente retornou dados sem action. Tentando extrair dados da mensagem...');
            // Tenta extrair número e mensagem da mensagem original
            // Procura por padrões como: "numero "11999431006"", "número 11999431006", "para 11999431006"
            const phonePatterns = [
                /(?:numero|número|para|to|phone)[\s:"]*(\d{10,15})/i,
                /"(\d{10,15})"/,
                /(\d{10,15})/
            ];
            let phoneNumber = '';
            for (const pattern of phonePatterns) {
                const match = message.match(pattern);
                if (match && match[1]) {
                    phoneNumber = match[1];
                    break;
                }
            }
            // Procura por mensagem entre aspas ou após "mensagem de"
            const messagePatterns = [
                /mensagem[\s:]*["']([^"']+)["']/i,
                /com[\s]+a[\s]+mensagem[\s]+de[\s]+["']([^"']+)["']/i,
                /["']([^"']+)["']/
            ];
            let whatsappMessage = '';
            for (const pattern of messagePatterns) {
                const match = message.match(pattern);
                if (match && match[1]) {
                    whatsappMessage = match[1];
                    break;
                }
            }
            // Se não encontrou mensagem, tenta pegar texto após "mensagem de"
            if (!whatsappMessage) {
                const afterMessage = message.split(/mensagem[\s]+de/i)[1];
                if (afterMessage) {
                    whatsappMessage = afterMessage.trim().replace(/^["']|["']$/g, '');
                }
            }
            console.log('[chatWithAgent] 📱 Dados extraídos da mensagem:', { phoneNumber, whatsappMessage });
            if (phoneNumber && whatsappMessage) {
                if (!agent.integrations_id) {
                    return '❌ Agente não possui integração WhatsApp configurada.';
                }
                try {
                    const result = await (0, whatsapp_dispatcher_1.sendWhatsApp)(agent.integrations_id, {
                        to: phoneNumber,
                        message: whatsappMessage
                    });
                    if (result.success) {
                        return `📱 WhatsApp enviado com sucesso para: ${phoneNumber}`;
                    }
                    else {
                        let errorMsg = `❌ Erro ao enviar WhatsApp: ${result.error || 'Erro desconhecido'}`;
                        errorMsg += '\n\n💡 DICA: esta plataforma aceita apenas WhatsApp oficial da Meta. Verifique Access Token, Phone Number ID, Verify Token e webhook oficial da Meta.';
                        return errorMsg;
                    }
                }
                catch (err) {
                    console.error('❌ Erro ao enviar WhatsApp:', err);
                    return `❌ Não foi possível enviar o WhatsApp: ${err.message || 'Erro desconhecido'}`;
                }
            }
            else {
                console.warn('[chatWithAgent] ⚠️ Não foi possível extrair número ou mensagem da solicitação:', { phoneNumber, whatsappMessage });
            }
        }
        // Se não detectou ação específica, retorna como dados para flow
        console.log('[chatWithAgent] JSON sem action detectado (provavelmente dados para flow):', parsed);
        return JSON.stringify(parsed);
    }
    // 🔟 Fallback: Se veio de webhook (tem contexto com phone_number) e agente retornou apenas texto,
    //    envia automaticamente como WhatsApp
    if (context && hasWhatsAppContext && !disableChannelDelivery) {
        const autoPhoneNumber = context.phone_number || context.from || context.to;
        const hasWhatsAppIntegration = agent.integrations_id;
        if (autoPhoneNumber && hasWhatsAppIntegration && cleanedResponse.trim().length > 0) {
            console.log('[chatWithAgent] 🔄 Fallback: Enviando resposta automática via WhatsApp (webhook)...', {
                phoneNumber: autoPhoneNumber,
                messageLength: cleanedResponse.length
            });
            try {
                // 🎯 DECISÃO DA IA COM CONFIANÇA: Verificar antes de enviar no fallback
                let historyLength = 0;
                try {
                    const history = await (0, whatsapp_redis_1.getHistoryFromRedis)(agent.integrations_id, autoPhoneNumber, 10);
                    historyLength = history.length;
                }
                catch (err) {
                    console.warn('[chatWithAgent] Erro ao buscar histórico para confiança no fallback:', err);
                }
                // Criar parsed temporário para calcular confiança
                const tempParsed = { message: cleanedResponse, action: null };
                // Buscar mensagem original do contexto se disponível (para workflows/flows)
                const originalMessage = context?.originalMessage || context?.userMessage || context?.input || context?.whatsappMessage || context?.text || message || '';
                const decision = (0, confidence_calculator_1.calculateConfidence)(tempParsed, originalMessage, context, historyLength, !!fileContext, ragSources);
                if (decision.confidence_score < confidenceApprovalThreshold) {
                    console.warn('[chatWithAgent] 🛡️ BLOQUEADO: Confiança baixa no fallback de webhook');
                    let userId;
                    try {
                        const { supabase } = await Promise.resolve().then(() => __importStar(require('../../lib/supabase')));
                        const { data: userData } = await supabase
                            .from('tb_users')
                            .select('id')
                            .eq('email', email)
                            .maybeSingle();
                        if (userData?.id)
                            userId = userData.id;
                    }
                    catch (err) {
                        console.error('[chatWithAgent] Erro ao buscar user_id:', err);
                    }
                    if (userId) {
                        await (0, save_decision_1.saveBlockedDecision)(agent.id, userId, message || '', decision, context, 'whatsapp', agent.integrations_id, autoPhoneNumber);
                    }
                    // Não retorna mensagem de aviso - apenas bloqueia silenciosamente
                    // A mensagem aparecerá no Inbox para aprovação
                    return ''; // Retorna vazio para não mostrar nada no chat
                }
                // 🛡️ Aplicar DLP antes de enviar
                const dlpCleanedResponse = await applyDLPToMessage(cleanedResponse);
                // Envia a resposta automaticamente
                const voiceDelivery = await (0, voiceRuntime_service_1.sendAgentWhatsAppResponseWithVoiceFallback)({
                    integrationId: agent.integrations_id,
                    to: autoPhoneNumber,
                    text: dlpCleanedResponse,
                    agentId,
                });
                const result = voiceDelivery.sendResult;
                if (result.success) {
                    // Mensagem já foi aplicada DLP antes de enviar, salvar no histórico
                    await (0, whatsapp_redis_1.saveMessageToHistory)(agent.integrations_id, autoPhoneNumber, 'assistant', dlpCleanedResponse);
                    console.log('[chatWithAgent] ✅ Resposta automática enviada com sucesso');
                    return `📱 Resposta enviada automaticamente para ${autoPhoneNumber}`;
                }
                else {
                    console.error('[chatWithAgent] ❌ Erro ao enviar resposta automática:', result.error);
                    return cleanedResponse; // Retorna a resposta mesmo se falhar o envio
                }
            }
            catch (err) {
                console.error('[chatWithAgent] ❌ Erro no fallback de envio automático:', err);
                return cleanedResponse; // Retorna a resposta mesmo se falhar
            }
        }
    }
    // 🔟 Fallback de segurança
    console.warn('⚠️ Ação não reconhecida:', parsed);
    // Limpar variável global ao final
    governanceConfigForDLP = null;
    const fallbackMessage = '❌ Ação não reconhecida pelo agente.';
    return await applyDLPToMessage(fallbackMessage);
}
