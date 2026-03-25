"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInsightsApi = getInsightsApi;
const supabase_1 = require("../../lib/supabase");
const logger_1 = __importDefault(require("../../lib/logger"));
const emptySummary = {
    total_interactions: 0,
    total_cost: 0,
    active_channels: 0,
    total_tokens: 0,
    rag_usage_count: 0,
    rag_usage_rate: 0
};
/**
 * GET /insights?period=7d|30d
 * Mesma lógica da Edge Function (RPCs de analytics por email).
 */
async function getInsightsApi(req, res) {
    try {
        // Mesmo email do JWT usado no front nas RPCs (Insights/Cockpit)
        const userEmail = req.user?.email;
        if (!userEmail) {
            return res.json({
                overview: [],
                channels: [],
                summary: emptySummary
            });
        }
        const period = req.query.period || '7d';
        const days = period === '30d' ? 30 : 7;
        const [overviewResult, channelsResult, summaryResult] = await Promise.all([
            supabase_1.supabase.rpc('sp_get_analytics_overview_by_email', {
                p_email: userEmail,
                p_days: days
            }),
            supabase_1.supabase.rpc('sp_get_analytics_channel_distribution_by_email', {
                p_email: userEmail,
                p_days: days
            }),
            supabase_1.supabase.rpc('sp_get_analytics_summary_by_email', {
                p_email: userEmail,
                p_days: days
            })
        ]);
        if (overviewResult.error) {
            logger_1.default.error('[getInsightsApi] overview:', overviewResult.error);
        }
        if (channelsResult.error) {
            logger_1.default.error('[getInsightsApi] channels:', channelsResult.error);
        }
        if (summaryResult.error) {
            logger_1.default.error('[getInsightsApi] summary:', summaryResult.error);
        }
        const overview = overviewResult.data && Array.isArray(overviewResult.data) ? overviewResult.data : [];
        const channels = channelsResult.data && Array.isArray(channelsResult.data) ? channelsResult.data : [];
        const summary = summaryResult.data && Array.isArray(summaryResult.data) && summaryResult.data.length > 0
            ? summaryResult.data[0]
            : emptySummary;
        return res.json({ overview, channels, summary });
    }
    catch (error) {
        logger_1.default.error('[getInsightsApi] Erro:', error);
        return res.json({
            overview: [],
            channels: [],
            summary: emptySummary
        });
    }
}
