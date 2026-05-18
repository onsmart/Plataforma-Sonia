"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHubSpotCredential = getHubSpotCredential;
exports.getCRMIntegration = getCRMIntegration;
exports.getHubSpotContacts = getHubSpotContacts;
exports.searchHubSpotContacts = searchHubSpotContacts;
exports.getHubSpotDeals = getHubSpotDeals;
exports.createHubSpotContact = createHubSpotContact;
exports.updateHubSpotContact = updateHubSpotContact;
exports.parseHubSpotApiError = parseHubSpotApiError;
exports.testHubSpotConnection = testHubSpotConnection;
const logger_1 = __importDefault(require("../../../lib/logger"));
const supabase_1 = require("../../../lib/supabase");
function getHubSpotCredential(integration) {
    const config = integration?.config && typeof integration.config === 'object'
        ? integration.config
        : null;
    const candidates = [
        integration.api_key,
        integration.access_token,
        config?.private_app_token,
        config?.access_token,
        config?.api_key,
        config?.token,
    ];
    for (const candidate of candidates) {
        const normalized = String(candidate || '').trim();
        if (normalized) {
            return normalized;
        }
    }
    return null;
}
/**
 * Busca a integração CRM do agente
 */
async function getCRMIntegration(crmIntegrationId) {
    try {
        const { data, error } = await supabase_1.supabase
            .from('tb_crm_integrations')
            .select(`
        id,
        api_key,
        access_token,
        config,
        tb_crms (
          id,
          slug,
          name,
          type
        )
      `)
            .eq('id', crmIntegrationId)
            .eq('is_active', true)
            .single();
        if (error)
            throw error;
        return data;
    }
    catch (error) {
        logger_1.default.error('[getCRMIntegration] Erro ao buscar integração CRM:', error);
        throw new Error(`Erro ao buscar integração CRM: ${error.message}`);
    }
}
/**
 * Faz requisição para API do HubSpot
 */
async function hubspotRequest(apiKey, endpoint, method = 'GET', body) {
    const baseUrl = 'https://api.hubapi.com';
    const url = `${baseUrl}${endpoint}`;
    const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
    };
    const options = {
        method,
        headers
    };
    if (body && method !== 'GET') {
        options.body = JSON.stringify(body);
    }
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            const errorText = await response.text();
            logger_1.default.error(`[hubspotRequest] Erro na API HubSpot: ${response.status} - ${errorText}`);
            throw new Error(`HubSpot API error: ${response.status} - ${errorText}`);
        }
        const data = await response.json();
        return data;
    }
    catch (error) {
        logger_1.default.error('[hubspotRequest] Erro na requisição:', error);
        throw error;
    }
}
/**
 * Busca contatos do HubSpot
 */
async function getHubSpotContacts(crmIntegrationId, limit = 10, properties) {
    try {
        const integration = await getCRMIntegration(crmIntegrationId);
        if (!integration) {
            throw new Error('Integração CRM não encontrada');
        }
        const crm = integration.tb_crms;
        if (crm?.slug !== 'hubspot') {
            throw new Error('Esta integração não é do HubSpot');
        }
        const apiKey = getHubSpotCredential(integration);
        if (!apiKey) {
            throw new Error('API Key não configurada para esta integração');
        }
        // Propriedades padrão do HubSpot
        const defaultProperties = ['firstname', 'lastname', 'email', 'phone', 'company', 'lifecyclestage'];
        const requestedProperties = properties && properties.length > 0
            ? properties
            : defaultProperties;
        const propertiesParam = requestedProperties.join(',');
        const response = await hubspotRequest(apiKey, `/crm/v3/objects/contacts?limit=${limit}&properties=${propertiesParam}`, 'GET');
        // Formata os contatos para um formato mais simples
        const formattedContacts = response.results.map((contact) => ({
            id: contact.id,
            firstname: contact.properties.firstname || '',
            lastname: contact.properties.lastname || '',
            email: contact.properties.email || '',
            phone: contact.properties.phone || '',
            company: contact.properties.company || '',
            lifecyclestage: contact.properties.lifecyclestage || '',
            properties: contact.properties,
            createdAt: contact.createdAt,
            updatedAt: contact.updatedAt
        }));
        logger_1.default.info(`[getHubSpotContacts] ${formattedContacts.length} contatos encontrados`);
        return formattedContacts;
    }
    catch (error) {
        logger_1.default.error('[getHubSpotContacts] Erro ao buscar contatos:', error);
        throw error;
    }
}
/**
 * Busca contatos do HubSpot com filtros usando a API de busca
 * Agora aceita filtros genéricos estruturados para qualquer campo
 */
async function searchHubSpotContacts(crmIntegrationId, limit = 10, filters, properties, structuredFilters) {
    try {
        const integration = await getCRMIntegration(crmIntegrationId);
        if (!integration) {
            throw new Error('Integração CRM não encontrada');
        }
        const crm = integration.tb_crms;
        if (crm?.slug !== 'hubspot') {
            throw new Error('Esta integração não é do HubSpot');
        }
        const apiKey = getHubSpotCredential(integration);
        if (!apiKey) {
            throw new Error('API Key não configurada para esta integração');
        }
        // Propriedades padrão do HubSpot
        const defaultProperties = ['firstname', 'lastname', 'email', 'phone', 'company', 'lifecyclestage'];
        const requestedProperties = properties && properties.length > 0
            ? properties
            : defaultProperties;
        // Monta o body da requisição de busca
        // HubSpot tem limite máximo de 200 por requisição
        const HUBSPOT_MAX_LIMIT = 200;
        const searchBody = {
            limit: Math.min(limit, HUBSPOT_MAX_LIMIT),
            properties: requestedProperties
        };
        // Mapeia operadores do nosso formato para operadores do HubSpot
        // HubSpot suporta: EQ, NEQ, LT, LTE, GT, GTE, BETWEEN, IN, NOT_IN, CONTAINS_TOKEN, NOT_CONTAINS_TOKEN
        const operatorMap = {
            'equals': 'EQ',
            'gt': 'GT',
            'gte': 'GTE',
            'lt': 'LT',
            'lte': 'LTE',
            'contains': 'CONTAINS_TOKEN', // CONTAINS_TOKEN busca em qualquer parte do texto
            // 'starts_with' não é suportado diretamente, mas podemos usar CONTAINS_TOKEN e filtrar localmente se necessário
        };
        // Processa filtros estruturados primeiro (prioridade)
        const apiFilters = [];
        if (structuredFilters && structuredFilters.length > 0) {
            for (const filter of structuredFilters) {
                const { field, operator, value } = filter;
                // Mapeia o operador para o formato do HubSpot
                const hubspotOperator = operatorMap[operator];
                if (hubspotOperator) {
                    // HubSpot aceita filtros em qualquer campo, incluindo customizados
                    apiFilters.push({
                        propertyName: field,
                        operator: hubspotOperator,
                        value: String(value)
                    });
                    logger_1.default.info(`[searchHubSpotContacts] Adicionando filtro na API: ${field} ${hubspotOperator} ${value}`);
                }
                else if (operator === 'starts_with') {
                    // starts_with não é suportado diretamente pelo HubSpot
                    // Vamos usar CONTAINS_TOKEN e filtrar localmente depois
                    logger_1.default.info(`[searchHubSpotContacts] Operador "starts_with" não suportado diretamente pelo HubSpot para ${field}, será filtrado localmente`);
                }
                else {
                    logger_1.default.warn(`[searchHubSpotContacts] Operador "${operator}" não mapeado para HubSpot, será filtrado localmente`);
                }
            }
        }
        // Processa filtros legados (mantido para compatibilidade)
        if (filters?.firstnameEquals) {
            apiFilters.push({
                propertyName: 'firstname',
                operator: 'EQ',
                value: filters.firstnameEquals
            });
        }
        if (filters?.emailEquals) {
            apiFilters.push({
                propertyName: 'email',
                operator: 'EQ',
                value: filters.emailEquals
            });
        }
        // Adiciona filtros à requisição se houver
        if (apiFilters.length > 0) {
            searchBody.filterGroups = [{ filters: apiFilters }];
            logger_1.default.info(`[searchHubSpotContacts] Usando ${apiFilters.length} filtro(s) na API do HubSpot:`, apiFilters);
        }
        // Usa o endpoint de busca (POST) ao invés de listagem (GET)
        const response = await hubspotRequest(apiKey, '/crm/v3/objects/contacts/search', 'POST', searchBody);
        // Formata os contatos para um formato mais simples
        let formattedContacts = response.results.map((contact) => ({
            id: contact.id,
            firstname: contact.properties.firstname || '',
            lastname: contact.properties.lastname || '',
            email: contact.properties.email || '',
            phone: contact.properties.phone || '',
            company: contact.properties.company || '',
            lifecyclestage: contact.properties.lifecyclestage || '',
            properties: contact.properties,
            createdAt: contact.createdAt,
            updatedAt: contact.updatedAt
        }));
        // Aplica filtros locais APENAS para operadores não suportados pela API (ex: starts_with)
        const needsLocalFiltering = structuredFilters?.some(f => f.operator === 'starts_with');
        if (needsLocalFiltering) {
            for (const filter of structuredFilters || []) {
                if (filter.operator === 'starts_with') {
                    const filterValue = String(filter.value).toUpperCase();
                    formattedContacts = formattedContacts.filter(contact => {
                        const fieldValue = contact.properties[filter.field] || contact[filter.field] || '';
                        return String(fieldValue).toUpperCase().startsWith(filterValue);
                    });
                    logger_1.default.info(`[searchHubSpotContacts] Filtrado localmente: ${filter.field} começa com "${filter.value}"`);
                }
            }
        }
        // Aplica filtros legados locais (mantido para compatibilidade)
        if (filters?.firstnameStartsWith) {
            const filterValue = filters.firstnameStartsWith.toUpperCase();
            formattedContacts = formattedContacts.filter(contact => {
                const firstname = (contact.firstname || '').trim().toUpperCase();
                return firstname.startsWith(filterValue);
            });
            logger_1.default.info(`[searchHubSpotContacts] Filtrado localmente: firstname começa com "${filters.firstnameStartsWith}"`);
        }
        if (filters?.emailContains) {
            const filterValue = filters.emailContains.toLowerCase();
            formattedContacts = formattedContacts.filter(contact => {
                const email = (contact.email || '').toLowerCase();
                return email.includes(filterValue);
            });
            logger_1.default.info(`[searchHubSpotContacts] Filtrado localmente: email contém "${filters.emailContains}"`);
        }
        // Limita aos N primeiros após aplicar todos os filtros
        formattedContacts = formattedContacts.slice(0, limit);
        logger_1.default.info(`[searchHubSpotContacts] ${formattedContacts.length} contatos encontrados após aplicar filtros`);
        return formattedContacts;
    }
    catch (error) {
        logger_1.default.error('[searchHubSpotContacts] Erro ao buscar contatos com filtros:', error);
        throw error;
    }
}
/**
 * Busca negócios (deals) do HubSpot
 */
async function getHubSpotDeals(crmIntegrationId, limit = 10, properties) {
    try {
        const integration = await getCRMIntegration(crmIntegrationId);
        if (!integration) {
            throw new Error('Integração CRM não encontrada');
        }
        const crm = integration.tb_crms;
        if (crm?.slug !== 'hubspot') {
            throw new Error('Esta integração não é do HubSpot');
        }
        const apiKey = getHubSpotCredential(integration);
        if (!apiKey) {
            throw new Error('API Key não configurada para esta integração');
        }
        // Propriedades padrão do HubSpot
        const defaultProperties = ['dealname', 'amount', 'dealstage', 'pipeline', 'closedate'];
        const requestedProperties = properties && properties.length > 0
            ? properties
            : defaultProperties;
        const propertiesParam = requestedProperties.join(',');
        const response = await hubspotRequest(apiKey, `/crm/v3/objects/deals?limit=${limit}&properties=${propertiesParam}`, 'GET');
        // Formata os negócios para um formato mais simples
        const formattedDeals = response.results.map((deal) => ({
            id: deal.id,
            dealname: deal.properties.dealname || '',
            amount: deal.properties.amount || '',
            dealstage: deal.properties.dealstage || '',
            pipeline: deal.properties.pipeline || '',
            closedate: deal.properties.closedate || '',
            properties: deal.properties,
            createdAt: deal.createdAt,
            updatedAt: deal.updatedAt
        }));
        logger_1.default.log(`[getHubSpotDeals] ${formattedDeals.length} negócios encontrados`);
        return formattedDeals;
    }
    catch (error) {
        logger_1.default.error('[getHubSpotDeals] Erro ao buscar negócios:', error);
        throw error;
    }
}
/**
 * Cria um contato no HubSpot
 */
async function createHubSpotContact(crmIntegrationId, contactData) {
    try {
        const integration = await getCRMIntegration(crmIntegrationId);
        if (!integration) {
            throw new Error('Integração CRM não encontrada');
        }
        const crm = integration.tb_crms;
        if (crm?.slug !== 'hubspot') {
            throw new Error('Esta integração não é do HubSpot');
        }
        const apiKey = getHubSpotCredential(integration);
        if (!apiKey) {
            throw new Error('API Key não configurada para esta integração');
        }
        const properties = {};
        if (contactData.firstname)
            properties.firstname = contactData.firstname;
        if (contactData.lastname)
            properties.lastname = contactData.lastname;
        if (contactData.email)
            properties.email = contactData.email;
        if (contactData.phone)
            properties.phone = contactData.phone;
        if (contactData.company)
            properties.company = contactData.company;
        // Adiciona outras propriedades customizadas
        Object.keys(contactData).forEach(key => {
            if (!['firstname', 'lastname', 'email', 'phone', 'company'].includes(key)) {
                properties[key] = String(contactData[key]);
            }
        });
        const response = await hubspotRequest(apiKey, '/crm/v3/objects/contacts', 'POST', { properties });
        logger_1.default.info(`[createHubSpotContact] Contato criado com sucesso: ${response.id}`);
        return {
            id: response.id,
            ...response.properties,
            createdAt: response.createdAt
        };
    }
    catch (error) {
        logger_1.default.error('[createHubSpotContact] Erro ao criar contato:', error);
        throw error;
    }
}
/**
 * Atualiza um contato no HubSpot
 */
async function updateHubSpotContact(crmIntegrationId, contactId, contactData) {
    try {
        const integration = await getCRMIntegration(crmIntegrationId);
        if (!integration) {
            throw new Error('Integração CRM não encontrada');
        }
        const crm = integration.tb_crms;
        if (crm?.slug !== 'hubspot') {
            throw new Error('Esta integração não é do HubSpot');
        }
        const apiKey = getHubSpotCredential(integration);
        if (!apiKey) {
            throw new Error('API Key não configurada para esta integração');
        }
        const response = await hubspotRequest(apiKey, `/crm/v3/objects/contacts/${contactId}`, 'PATCH', { properties: contactData });
        logger_1.default.info(`[updateHubSpotContact] Contato atualizado com sucesso: ${contactId}`);
        return {
            id: response.id,
            ...response.properties,
            updatedAt: response.updatedAt
        };
    }
    catch (error) {
        logger_1.default.error('[updateHubSpotContact] Erro ao atualizar contato:', error);
        throw error;
    }
}
function parseHubSpotApiError(error) {
    const raw = String(error?.message || error || '').trim();
    const statusMatch = raw.match(/HubSpot API error:\s*(\d{3})/i);
    const httpStatus = statusMatch ? Number.parseInt(statusMatch[1], 10) : undefined;
    let errorCode;
    try {
        const jsonStart = raw.indexOf('{');
        if (jsonStart >= 0) {
            const payload = JSON.parse(raw.slice(jsonStart));
            errorCode = String(payload.category || '').trim() || undefined;
            if (payload.message) {
                return {
                    httpStatus,
                    errorCode,
                    message: String(payload.message).trim(),
                };
            }
        }
    }
    catch {
        // ignore malformed json fragments
    }
    if (httpStatus === 401 || /authentication credentials/i.test(raw)) {
        return {
            httpStatus: httpStatus || 401,
            errorCode: errorCode || 'INVALID_AUTHENTICATION',
            message: 'Token do HubSpot invalido ou expirado. Gere um novo Private App token e salve novamente na integracao.',
        };
    }
    if (httpStatus === 403) {
        return {
            httpStatus: 403,
            errorCode: errorCode || 'MISSING_SCOPES',
            message: 'Token autenticado, mas sem permissao para CRM. Revise os escopos do Private App (contatos/leitura e escrita).',
        };
    }
    return {
        httpStatus,
        errorCode,
        message: raw || 'Falha ao comunicar com o HubSpot.',
    };
}
function buildTokenHint(token) {
    const normalized = String(token || '').trim();
    if (!normalized)
        return '';
    if (normalized.length <= 8)
        return '********';
    return `${normalized.slice(0, 6)}...`;
}
function resolveHubSpotSlug(integration) {
    const crm = integration.tb_crms;
    if (Array.isArray(crm))
        return String(crm[0]?.slug || '').trim();
    return String(crm?.slug || '').trim();
}
/**
 * Teste de conectividade LGPD-friendly: valida autenticacao e acesso ao schema de contatos,
 * sem listar ou retornar dados pessoais de pacientes/contatos.
 */
async function testHubSpotConnection(params) {
    const testedAt = new Date().toISOString();
    const lgpdNotice = 'Teste tecnico sem exibicao de dados pessoais de contatos. Apenas validacao de autenticacao e permissao de API.';
    let token = String(params.token || '').trim();
    let tokenHint = buildTokenHint(token);
    if (!token && params.crmIntegrationId) {
        const integration = await getCRMIntegration(params.crmIntegrationId);
        if (resolveHubSpotSlug(integration) !== 'hubspot') {
            return {
                success: false,
                provider: 'hubspot',
                status: 'misconfigured',
                message: 'Esta integracao nao e do HubSpot.',
                testedAt,
                crmSchemaAccessVerified: false,
                lgpdNotice,
            };
        }
        token = String(getHubSpotCredential(integration) || '').trim();
        tokenHint = buildTokenHint(token);
    }
    if (!token) {
        return {
            success: false,
            provider: 'hubspot',
            status: 'misconfigured',
            message: 'Nenhum token do HubSpot foi encontrado. Informe o Private App token e salve a integracao.',
            testedAt,
            crmSchemaAccessVerified: false,
            tokenHint,
            lgpdNotice,
        };
    }
    try {
        const accountDetails = await hubspotRequest(token, '/account-info/v3/details', 'GET');
        let crmSchemaAccessVerified = false;
        try {
            await hubspotRequest(token, '/crm/v3/schemas/contacts', 'GET');
            crmSchemaAccessVerified = true;
        }
        catch (schemaError) {
            const parsed = parseHubSpotApiError(schemaError);
            if (parsed.httpStatus === 403) {
                return {
                    success: false,
                    provider: 'hubspot',
                    status: 'forbidden',
                    message: parsed.message,
                    testedAt,
                    portalId: accountDetails.portalId,
                    accountType: accountDetails.accountType,
                    crmSchemaAccessVerified: false,
                    httpStatus: parsed.httpStatus,
                    errorCode: parsed.errorCode,
                    tokenHint,
                    lgpdNotice,
                };
            }
            throw schemaError;
        }
        return {
            success: true,
            provider: 'hubspot',
            status: 'connected',
            message: 'Conexao com HubSpot validada com sucesso.',
            testedAt,
            portalId: accountDetails.portalId,
            accountType: accountDetails.accountType,
            crmSchemaAccessVerified,
            tokenHint,
            lgpdNotice,
        };
    }
    catch (error) {
        const parsed = parseHubSpotApiError(error);
        const status = parsed.httpStatus === 401
            ? 'auth_failed'
            : parsed.httpStatus === 403
                ? 'forbidden'
                : 'unavailable';
        logger_1.default.warn('[testHubSpotConnection] Falha no teste de conexao HubSpot', {
            status,
            httpStatus: parsed.httpStatus,
            errorCode: parsed.errorCode,
        });
        return {
            success: false,
            provider: 'hubspot',
            status,
            message: parsed.message,
            testedAt,
            crmSchemaAccessVerified: false,
            httpStatus: parsed.httpStatus,
            errorCode: parsed.errorCode,
            tokenHint,
            lgpdNotice,
        };
    }
}
