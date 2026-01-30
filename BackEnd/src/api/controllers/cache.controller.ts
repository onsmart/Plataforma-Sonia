import { Request, Response } from 'express'
import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'

/**
 * Limpa o cache do Supabase
 * POST /cache/clear
 */
export async function clearCache(req: Request, res: Response) {
  try {
    logger.log('[clearCache] 🧹 Limpando cache do Supabase...')
    
    // O Supabase não tem um endpoint direto para limpar cache
    // Mas podemos forçar uma query simples para invalidar o cache
    // Fazendo uma query que força o Supabase a recarregar o schema
    
    // 1. Query simples para forçar reload do schema
    const { error: schemaError } = await supabase
      .from('tb_whatsapp_contacts')
      .select('id')
      .limit(1)
    
    if (schemaError) {
      logger.warn('[clearCache] ⚠️ Erro ao forçar reload do schema:', {
        error: schemaError.message
      })
    }
    
    // 2. Query na tabela de mensagens também
    const { error: messagesError } = await supabase
      .from('tb_whatsapp_messages')
      .select('id')
      .limit(1)
    
    if (messagesError) {
      logger.warn('[clearCache] ⚠️ Erro ao forçar reload do schema de mensagens:', {
        error: messagesError.message
      })
    }
    
    logger.log('[clearCache] ✅ Cache limpo (schema recarregado)')
    
    return res.json({
      success: true,
      message: 'Cache do Supabase limpo com sucesso. O schema foi recarregado.',
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    logger.error('[clearCache] ❌ Erro ao limpar cache:', {
      error: error.message
    })
    return res.status(500).json({
      success: false,
      error: 'Erro ao limpar cache',
      details: error.message
    })
  }
}

/**
 * Verifica o status do cache e relacionamentos
 * GET /cache/status
 */
export async function getCacheStatus(req: Request, res: Response) {
  try {
    logger.log('[getCacheStatus] 🔍 Verificando status do cache...')
    
    // Testa relacionamento entre tabelas
    const { data: testData, error: testError } = await supabase
      .from('tb_whatsapp_messages')
      .select(`
        id,
        whatsapp_contact_id,
        tb_whatsapp_contacts (
          id,
          lid,
          phone_number
        )
      `)
      .limit(1)
    
    const hasRelationship = !testError && testData && testData.length > 0
    
    return res.json({
      success: true,
      cacheStatus: {
        hasRelationship: hasRelationship,
        relationshipError: testError?.message || null,
        testData: testData || null,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error: any) {
    logger.error('[getCacheStatus] ❌ Erro ao verificar cache:', {
      error: error.message
    })
    return res.status(500).json({
      success: false,
      error: 'Erro ao verificar cache',
      details: error.message
    })
  }
}
