import { supabase } from '../lib/supabase'
import logger from '../lib/logger'

/**
 * Obtém o companies_id a partir do email do usuário
 * Segue o padrão: email → user_id → companies_id
 * 
 * @param email Email do usuário
 * @returns companies_id ou null se não encontrado
 */
export async function getCompanyIdByEmail(email: string): Promise<string | null> {
  try {
    if (!email || !email.trim()) {
      logger.warn('[getCompanyIdByEmail] Email vazio ou inválido')
      return null
    }

    const trimmed = email.trim()

    const { data: fromRpc, error: rpcError } = await supabase.rpc(
      'sp_get_analytics_company_id_by_email',
      { p_email: trimmed }
    )

    if (!rpcError && fromRpc) {
      logger.log(`[getCompanyIdByEmail] ✅ companies_id (RPC): ${fromRpc} para email: ${email}`)
      return String(fromRpc)
    }

    if (rpcError) {
      logger.warn('[getCompanyIdByEmail] RPC sp_get_analytics_company_id_by_email:', rpcError.message)
    }

    const { data: userData, error: userError } = await supabase
      .from('tb_users')
      .select('id')
      .ilike('email', trimmed)
      .limit(1)
      .maybeSingle()

    if (userError) {
      logger.error('[getCompanyIdByEmail] Erro ao buscar user_id:', userError)
      return null
    }

    if (!userData?.id) {
      logger.warn(`[getCompanyIdByEmail] Usuário não encontrado para email: ${email}`)
      return null
    }

    const { data: companyUserData, error: companyUserError } = await supabase
      .from('tb_company_users')
      .select('companies_id')
      .eq('user_id', userData.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (companyUserError) {
      logger.error('[getCompanyIdByEmail] Erro ao buscar companies_id:', companyUserError)
      return null
    }

    if (!companyUserData?.companies_id) {
      logger.warn(`[getCompanyIdByEmail] Nenhuma empresa encontrada para user_id: ${userData.id}`)
      return null
    }

    logger.log(`[getCompanyIdByEmail] ✅ companies_id encontrado: ${companyUserData.companies_id} para email: ${email}`)
    return companyUserData.companies_id
  } catch (err: any) {
    logger.error('[getCompanyIdByEmail] Erro:', err)
    return null
  }
}

/**
 * Obtém o user_id a partir do email do usuário
 * 
 * @param email Email do usuário
 * @returns user_id ou null se não encontrado
 */
export async function getUserIdByEmail(email: string): Promise<string | null> {
  try {
    if (!email || !email.trim()) {
      logger.warn('[getUserIdByEmail] Email vazio ou inválido')
      return null
    }

    const { data: userData, error: userError } = await supabase
      .from('tb_users')
      .select('id')
      .ilike('email', email.trim())
      .limit(1)
      .maybeSingle()

    if (userError) {
      logger.error('[getUserIdByEmail] Erro ao buscar user_id:', userError)
      return null
    }

    if (!userData?.id) {
      logger.warn(`[getUserIdByEmail] Usuário não encontrado para email: ${email}`)
      return null
    }

    return userData.id
  } catch (err: any) {
    logger.error('[getUserIdByEmail] Erro:', err)
    return null
  }
}

/**
 * Obtém o user_id e companies_id a partir do email do usuário
 * Combina getUserIdByEmail e getCompanyIdByEmail em uma única chamada
 * 
 * @param email Email do usuário
 * @returns Objeto com userId e companyId, ou ambos null se não encontrados
 */
export async function getUserIdAndCompanyIdByEmail(email: string): Promise<{ userId: string | null; companyId: string | null }> {
  try {
    if (!email || !email.trim()) {
      logger.warn('[getUserIdAndCompanyIdByEmail] Email vazio ou inválido')
      return { userId: null, companyId: null }
    }

    // 1. Buscar user_id pelo email
    const trimmedEmail = email.trim()
    const { data: userData, error: userError } = await supabase
      .from('tb_users')
      .select('id')
      .ilike('email', trimmedEmail)
      .limit(1)
      .maybeSingle()

    if (userError) {
      logger.error('[getUserIdAndCompanyIdByEmail] Erro ao buscar user_id:', userError)
      return { userId: null, companyId: null }
    }

    if (!userData?.id) {
      logger.warn(`[getUserIdAndCompanyIdByEmail] Usuário não encontrado para email: ${email}`)
      return { userId: null, companyId: null }
    }

    const userId = userData.id

    // 2. Buscar companies_id através de tb_company_users
    const { data: companyUserData, error: companyUserError } = await supabase
      .from('tb_company_users')
      .select('companies_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }) // Pega a primeira empresa (owner geralmente)
      .limit(1)
      .maybeSingle()

    if (companyUserError) {
      logger.error('[getUserIdAndCompanyIdByEmail] Erro ao buscar companies_id:', companyUserError)
      return { userId, companyId: null }
    }

    const companyId = companyUserData?.companies_id || null

    logger.log(`[getUserIdAndCompanyIdByEmail] ✅ user_id: ${userId}, companies_id: ${companyId} para email: ${email}`)
    return { userId, companyId }
  } catch (err: any) {
    logger.error('[getUserIdAndCompanyIdByEmail] Erro:', err)
    return { userId: null, companyId: null }
  }
}
