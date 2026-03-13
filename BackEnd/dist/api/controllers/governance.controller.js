"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGovernanceConfig = getGovernanceConfig;
exports.updateGovernanceConfig = updateGovernanceConfig;
const supabase_1 = require("../../lib/supabase");
const company_helper_1 = require("../../utils/company-helper");
const plan_helper_1 = require("../../utils/plan-helper");
const governance_1 = require("../../services/governance");
const logger_1 = __importDefault(require("../../lib/logger"));
/**
 * Busca configuração de governança
 * GET /governance
 */
async function getGovernanceConfig(req, res) {
    try {
        const email = req.user?.email || req.query.email;
        if (!email) {
            return res.status(401).json({
                error: 'Email é obrigatório',
                details: 'Token de autenticação inválido ou email não fornecido'
            });
        }
        // Buscar companies_id
        const companiesId = await (0, company_helper_1.getCompanyIdByEmail)(email);
        if (!companiesId) {
            return res.status(403).json({
                error: 'Empresa não encontrada',
                details: 'Usuário não pertence a nenhuma empresa'
            });
        }
        // Buscar configuração
        const { data: configData, error: configError } = await supabase_1.supabase
            .from('tb_governance_configs')
            .select('*')
            .eq('companies_id', companiesId)
            .maybeSingle();
        if (configError) {
            logger_1.default.error('[getGovernanceConfig] Erro ao buscar configuração:', configError);
            return res.status(500).json({
                error: 'Erro ao buscar configuração',
                details: configError.message
            });
        }
        // Log para debug
        logger_1.default.log(`[getGovernanceConfig] Dados do banco para companies_id ${companiesId}:`, JSON.stringify(configData, null, 2));
        // Se não existe, retorna configuração padrão
        if (!configData) {
            const defaultConfig = {
                safetyThresholds: {
                    hateSpeech: 0.7,
                    sexualContent: 0.7,
                    dangerousContent: 0.7
                },
                filters: {
                    competitorBlocking: false,
                    antiHallucination: false,
                    jailbreakProtection: false
                },
                dlp: {
                    creditCard: false,
                    ssn: false,
                    email: false,
                    phone: false
                },
                retention: {
                    chatLogsRetentionDays: 90,
                    voiceRetentionDays: 30
                }
            };
            return res.json(defaultConfig);
        }
        // Converter para formato esperado pelo frontend
        // Usar valores diretos do banco, sem fallback para não mascarar valores 0
        const config = {
            safetyThresholds: {
                hateSpeech: configData.hate_speech_threshold != null ? configData.hate_speech_threshold : 0.7,
                sexualContent: configData.sexual_content_threshold != null ? configData.sexual_content_threshold : 0.7,
                dangerousContent: configData.dangerous_content_threshold != null ? configData.dangerous_content_threshold : 0.7
            },
            filters: {
                competitorBlocking: configData.competitor_blocking != null ? configData.competitor_blocking : false,
                antiHallucination: configData.anti_hallucination != null ? configData.anti_hallucination : false,
                jailbreakProtection: configData.jailbreak_protection != null ? configData.jailbreak_protection : false
            },
            dlp: {
                creditCard: configData.mask_credit_cards != null ? configData.mask_credit_cards : false,
                ssn: configData.mask_ssn != null ? configData.mask_ssn : false,
                email: configData.mask_emails != null ? configData.mask_emails : false,
                phone: configData.mask_phone != null ? configData.mask_phone : false
            },
            retention: {
                chatLogsRetentionDays: configData.chat_logs_retention_days != null ? configData.chat_logs_retention_days : 90,
                voiceRetentionDays: configData.voice_retention_days != null ? configData.voice_retention_days : 30
            },
            lastUpdated: configData.updated_at
        };
        logger_1.default.log(`[getGovernanceConfig] Configuração convertida:`, JSON.stringify(config, null, 2));
        return res.json(config);
    }
    catch (error) {
        logger_1.default.error('[getGovernanceConfig] Erro:', error);
        return res.status(500).json({
            error: 'Erro ao buscar configuração',
            details: error.message
        });
    }
}
/**
 * Atualiza configuração de governança
 * PUT /governance
 */
async function updateGovernanceConfig(req, res) {
    try {
        const email = req.user?.email || req.body.email || req.headers['x-user-email'];
        if (!email) {
            return res.status(401).json({
                error: 'Email é obrigatório',
                details: 'Token de autenticação inválido ou email não fornecido'
            });
        }
        // Buscar companies_id
        const companiesId = await (0, company_helper_1.getCompanyIdByEmail)(email);
        if (!companiesId) {
            return res.status(403).json({
                error: 'Empresa não encontrada',
                details: 'Usuário não pertence a nenhuma empresa'
            });
        }
        // Verificar se o plano permite Governance
        const checkResult = await (0, plan_helper_1.canUseGovernance)(companiesId);
        if (!checkResult.allowed) {
            logger_1.default.warn('[updateGovernanceConfig] 🚫 Governance não permitido:', {
                companiesId,
                reason: checkResult.reason
            });
            return res.status(403).json({
                error: checkResult.reason || 'A funcionalidade Governance está disponível apenas no plano Enterprise.',
                upgradePlan: 'enterprise'
            });
        }
        const { safetyThresholds, filters, dlp, retention } = req.body;
        // Preparar payload para atualização
        const updatePayload = {
            updated_at: new Date().toISOString()
        };
        if (safetyThresholds) {
            updatePayload.hate_speech_threshold = safetyThresholds.hateSpeech;
            updatePayload.sexual_content_threshold = safetyThresholds.sexualContent;
            updatePayload.dangerous_content_threshold = safetyThresholds.dangerousContent;
        }
        if (filters) {
            updatePayload.competitor_blocking = filters.competitorBlocking;
            updatePayload.anti_hallucination = filters.antiHallucination;
            updatePayload.jailbreak_protection = filters.jailbreakProtection;
        }
        if (dlp) {
            updatePayload.mask_credit_cards = dlp.creditCard;
            updatePayload.mask_ssn = dlp.ssn;
            updatePayload.mask_emails = dlp.email;
            updatePayload.mask_phone = dlp.phone;
        }
        if (retention) {
            updatePayload.chat_logs_retention_days = retention.chatLogsRetentionDays;
            updatePayload.voice_retention_days = retention.voiceRetentionDays;
        }
        // Verificar se já existe configuração
        const { data: existingConfig } = await supabase_1.supabase
            .from('tb_governance_configs')
            .select('id')
            .eq('companies_id', companiesId)
            .maybeSingle();
        let result;
        if (existingConfig) {
            // Atualizar existente
            const { data, error: updateError } = await supabase_1.supabase
                .from('tb_governance_configs')
                .update(updatePayload)
                .eq('id', existingConfig.id)
                .eq('companies_id', companiesId)
                .select()
                .single();
            if (updateError) {
                logger_1.default.error('[updateGovernanceConfig] Erro ao atualizar:', updateError);
                return res.status(500).json({
                    error: 'Erro ao atualizar configuração',
                    details: updateError.message
                });
            }
            result = data;
        }
        else {
            // Criar nova
            const { data, error: insertError } = await supabase_1.supabase
                .from('tb_governance_configs')
                .insert({
                companies_id: companiesId,
                ...updatePayload
            })
                .select()
                .single();
            if (insertError) {
                logger_1.default.error('[updateGovernanceConfig] Erro ao criar:', insertError);
                return res.status(500).json({
                    error: 'Erro ao criar configuração',
                    details: insertError.message
                });
            }
            result = data;
        }
        // Limpar cache
        (0, governance_1.clearGovernanceCache)(companiesId);
        // Converter para formato esperado pelo frontend
        const config = {
            safetyThresholds: {
                hateSpeech: result.hate_speech_threshold ?? 0.7,
                sexualContent: result.sexual_content_threshold ?? 0.7,
                dangerousContent: result.dangerous_content_threshold ?? 0.7
            },
            filters: {
                competitorBlocking: result.competitor_blocking ?? false,
                antiHallucination: result.anti_hallucination ?? false,
                jailbreakProtection: result.jailbreak_protection ?? false
            },
            dlp: {
                creditCard: result.mask_credit_cards ?? false,
                ssn: result.mask_ssn ?? false,
                email: result.mask_emails ?? false,
                phone: result.mask_phone ?? false
            },
            retention: {
                chatLogsRetentionDays: result.chat_logs_retention_days ?? 90,
                voiceRetentionDays: result.voice_retention_days ?? 30
            },
            lastUpdated: result.updated_at
        };
        logger_1.default.log(`[updateGovernanceConfig] ✅ Configuração atualizada com sucesso para companies_id: ${companiesId}`);
        return res.json(config);
    }
    catch (error) {
        logger_1.default.error('[updateGovernanceConfig] Erro:', error);
        return res.status(500).json({
            error: 'Erro ao atualizar configuração',
            details: error.message
        });
    }
}
