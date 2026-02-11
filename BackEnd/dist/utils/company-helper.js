"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCompanyIdByEmail = getCompanyIdByEmail;
exports.getUserIdByEmail = getUserIdByEmail;
exports.getUserIdAndCompanyIdByEmail = getUserIdAndCompanyIdByEmail;
const supabase_1 = require("../lib/supabase");
const logger_1 = __importDefault(require("../lib/logger"));
/**
 * Obtém o companies_id a partir do email do usuário
 * Segue o padrão: email → user_id → companies_id
 *
 * @param email Email do usuário
 * @returns companies_id ou null se não encontrado
 */
async function getCompanyIdByEmail(email) {
    try {
        if (!email || !email.trim()) {
            logger_1.default.warn('[getCompanyIdByEmail] Email vazio ou inválido');
            return null;
        }
        // 1. Buscar user_id pelo email
        const { data: userData, error: userError } = await supabase_1.supabase
            .from('tb_users')
            .select('id')
            .eq('email', email.trim().toLowerCase())
            .maybeSingle();
        if (userError) {
            logger_1.default.error('[getCompanyIdByEmail] Erro ao buscar user_id:', userError);
            return null;
        }
        if (!userData?.id) {
            logger_1.default.warn(`[getCompanyIdByEmail] Usuário não encontrado para email: ${email}`);
            return null;
        }
        // 2. Buscar companies_id através de tb_company_users
        const { data: companyUserData, error: companyUserError } = await supabase_1.supabase
            .from('tb_company_users')
            .select('companies_id')
            .eq('user_id', userData.id)
            .order('created_at', { ascending: true }) // Pega a primeira empresa (owner geralmente)
            .limit(1)
            .maybeSingle();
        if (companyUserError) {
            logger_1.default.error('[getCompanyIdByEmail] Erro ao buscar companies_id:', companyUserError);
            return null;
        }
        if (!companyUserData?.companies_id) {
            logger_1.default.warn(`[getCompanyIdByEmail] Nenhuma empresa encontrada para user_id: ${userData.id}`);
            return null;
        }
        logger_1.default.log(`[getCompanyIdByEmail] ✅ companies_id encontrado: ${companyUserData.companies_id} para email: ${email}`);
        return companyUserData.companies_id;
    }
    catch (err) {
        logger_1.default.error('[getCompanyIdByEmail] Erro:', err);
        return null;
    }
}
/**
 * Obtém o user_id a partir do email do usuário
 *
 * @param email Email do usuário
 * @returns user_id ou null se não encontrado
 */
async function getUserIdByEmail(email) {
    try {
        if (!email || !email.trim()) {
            logger_1.default.warn('[getUserIdByEmail] Email vazio ou inválido');
            return null;
        }
        const { data: userData, error: userError } = await supabase_1.supabase
            .from('tb_users')
            .select('id')
            .eq('email', email.trim().toLowerCase())
            .maybeSingle();
        if (userError) {
            logger_1.default.error('[getUserIdByEmail] Erro ao buscar user_id:', userError);
            return null;
        }
        if (!userData?.id) {
            logger_1.default.warn(`[getUserIdByEmail] Usuário não encontrado para email: ${email}`);
            return null;
        }
        return userData.id;
    }
    catch (err) {
        logger_1.default.error('[getUserIdByEmail] Erro:', err);
        return null;
    }
}
/**
 * Obtém o user_id e companies_id a partir do email do usuário
 * Combina getUserIdByEmail e getCompanyIdByEmail em uma única chamada
 *
 * @param email Email do usuário
 * @returns Objeto com userId e companyId, ou ambos null se não encontrados
 */
async function getUserIdAndCompanyIdByEmail(email) {
    try {
        if (!email || !email.trim()) {
            logger_1.default.warn('[getUserIdAndCompanyIdByEmail] Email vazio ou inválido');
            return { userId: null, companyId: null };
        }
        // 1. Buscar user_id pelo email
        const { data: userData, error: userError } = await supabase_1.supabase
            .from('tb_users')
            .select('id')
            .eq('email', email.trim().toLowerCase())
            .maybeSingle();
        if (userError) {
            logger_1.default.error('[getUserIdAndCompanyIdByEmail] Erro ao buscar user_id:', userError);
            return { userId: null, companyId: null };
        }
        if (!userData?.id) {
            logger_1.default.warn(`[getUserIdAndCompanyIdByEmail] Usuário não encontrado para email: ${email}`);
            return { userId: null, companyId: null };
        }
        const userId = userData.id;
        // 2. Buscar companies_id através de tb_company_users
        const { data: companyUserData, error: companyUserError } = await supabase_1.supabase
            .from('tb_company_users')
            .select('companies_id')
            .eq('user_id', userId)
            .order('created_at', { ascending: true }) // Pega a primeira empresa (owner geralmente)
            .limit(1)
            .maybeSingle();
        if (companyUserError) {
            logger_1.default.error('[getUserIdAndCompanyIdByEmail] Erro ao buscar companies_id:', companyUserError);
            return { userId, companyId: null };
        }
        const companyId = companyUserData?.companies_id || null;
        logger_1.default.log(`[getUserIdAndCompanyIdByEmail] ✅ user_id: ${userId}, companies_id: ${companyId} para email: ${email}`);
        return { userId, companyId };
    }
    catch (err) {
        logger_1.default.error('[getUserIdAndCompanyIdByEmail] Erro:', err);
        return { userId: null, companyId: null };
    }
}
