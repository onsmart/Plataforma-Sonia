"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHubSpotContacts = getHubSpotContacts;
exports.searchHubSpotContacts = searchHubSpotContacts;
exports.getHubSpotDeals = getHubSpotDeals;
exports.createHubSpotContact = createHubSpotContact;
exports.updateHubSpotContact = updateHubSpotContact;
const logger_1 = __importDefault(require("../../../lib/logger"));
const supabase_1 = require("../../../lib/supabase");
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
        const apiKey = integration.api_key || integration.access_token;
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
        const apiKey = integration.api_key || integration.access_token;
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
        const apiKey = integration.api_key || integration.access_token;
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
        const apiKey = integration.api_key || integration.access_token;
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
        const apiKey = integration.api_key || integration.access_token;
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
