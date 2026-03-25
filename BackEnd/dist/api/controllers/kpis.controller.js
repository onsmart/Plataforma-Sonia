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
exports.getKPIs = getKPIs;
exports.saveFeedback = saveFeedback;
const kpis_service_1 = require("../../services/kpis/kpis.service");
const company_helper_1 = require("../../utils/company-helper");
const logger_1 = __importDefault(require("../../lib/logger"));
const ZERO_KPIS = {
    taskSuccessRate: 0,
    averageResponseTime: 0,
    taskAbandonmentRate: 0,
    costPerInteraction: 0,
    totalCost: 0,
    violationsCount: 0,
    hallucinationsFlagged: 0,
    humanTransferRate: 0,
    quickReworkRate: 0,
    csatScore: 0,
    npsScore: 0,
    averageSentiment: 0,
    incorrectRoutingFrequency: 0
};
/**
 * GET /kpis
 * Retorna todos os KPIs calculados
 */
async function getKPIs(req, res) {
    try {
        // ✅ Email vem do middleware (validado) ou fallback para compatibilidade
        const userEmail = req.user?.email ||
            req.query.email ||
            req.headers['x-user-email'] ||
            req.body?.email;
        if (!userEmail) {
            return res.status(401).json({
                success: false,
                error: 'Email do usuário não fornecido. Token de autenticação inválido ou email não fornecido'
            });
        }
        // Extrai filtros opcionais da query string
        const filters = {
            email: userEmail,
            agentId: req.query.agentId,
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            channel: req.query.channel
        };
        logger_1.default.log('[getKPIs] Calculando KPIs:', filters);
        let kpis;
        try {
            kpis = await (0, kpis_service_1.calculateKPIs)(filters);
        }
        catch (calcErr) {
            if (calcErr?.message?.includes('Company ID não encontrado')) {
                logger_1.default.warn('[getKPIs] Sem empresa para o usuário — retornando KPIs zerados');
                return res.json({
                    success: true,
                    data: ZERO_KPIS,
                    filters
                });
            }
            throw calcErr;
        }
        logger_1.default.log('[getKPIs] KPIs calculados, retornando resposta:', {
            taskSuccessRate: kpis.taskSuccessRate,
            averageResponseTime: kpis.averageResponseTime,
            violationsCount: kpis.violationsCount,
            costPerInteraction: kpis.costPerInteraction,
            csatScore: kpis.csatScore,
            npsScore: kpis.npsScore
        });
        return res.json({
            success: true,
            data: kpis,
            filters
        });
    }
    catch (error) {
        logger_1.default.error('[getKPIs] Erro:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Erro ao calcular KPIs'
        });
    }
}
/**
 * POST /kpis/feedback
 * Salva feedback do usuário (CSAT, NPS, Sentimento)
 */
async function saveFeedback(req, res) {
    try {
        const userEmail = req.user?.email ||
            req.headers['x-user-email'] ||
            req.userEmail;
        if (!userEmail) {
            return res.status(401).json({
                success: false,
                error: 'Email do usuário não fornecido'
            });
        }
        const { agentId, conversationId, channel, csatScore, npsScore, sentimentScore, feedbackText, metadata } = req.body;
        // Validação básica
        if (csatScore !== undefined && (csatScore < 1 || csatScore > 5)) {
            return res.status(400).json({
                success: false,
                error: 'CSAT score deve estar entre 1 e 5'
            });
        }
        if (npsScore !== undefined && (npsScore < 0 || npsScore > 10)) {
            return res.status(400).json({
                success: false,
                error: 'NPS score deve estar entre 0 e 10'
            });
        }
        if (sentimentScore !== undefined && (sentimentScore < -1 || sentimentScore > 1)) {
            return res.status(400).json({
                success: false,
                error: 'Sentiment score deve estar entre -1 e 1'
            });
        }
        const { companyId, userId } = await (0, company_helper_1.getUserIdAndCompanyIdByEmail)(userEmail);
        if (!companyId) {
            return res.status(404).json({
                success: false,
                error: 'Company não encontrada'
            });
        }
        const { supabase } = await Promise.resolve().then(() => __importStar(require('../../lib/supabase')));
        const { data, error } = await supabase
            .from('tb_feedback')
            .insert({
            companies_id: companyId,
            user_id: userId || null,
            agent_id: agentId || null,
            conversation_id: conversationId || null,
            channel: channel || 'webchat',
            csat_score: csatScore || null,
            nps_score: npsScore || null,
            sentiment_score: sentimentScore || null,
            feedback_text: feedbackText || null,
            metadata: metadata || {}
        })
            .select('id')
            .single();
        if (error) {
            logger_1.default.error('[saveFeedback] Erro ao salvar feedback:', error);
            return res.status(500).json({
                success: false,
                error: error.message || 'Erro ao salvar feedback'
            });
        }
        logger_1.default.log('[saveFeedback] ✅ Feedback salvo:', { id: data.id });
        return res.json({
            success: true,
            data: { id: data.id }
        });
    }
    catch (error) {
        logger_1.default.error('[saveFeedback] Erro:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Erro ao salvar feedback'
        });
    }
}
