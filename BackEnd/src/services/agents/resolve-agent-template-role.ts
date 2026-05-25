import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'

/** RPC fn_get_agents_with_api_key costuma devolver template_role curto (resumo); o papel real fica em tb_agents_templates.role */
export async function resolveAgentTemplateRole(agent: {
  role_template_id?: string | null
  template_role?: string | null
  role?: string | null
}): Promise<string> {
  const fromRpc = String(agent.template_role || agent.role || '').trim()
  const templateId = String(agent.role_template_id || '').trim()

  if (!templateId) {
    return fromRpc
  }

  try {
    const { data, error } = await supabase
      .from('tb_agents_templates')
      .select('role, description')
      .eq('id', templateId)
      .maybeSingle()

    if (error) {
      logger.warn('[resolveAgentTemplateRole] Falha ao carregar template', {
        templateId,
        error: error.message,
      })
      return fromRpc
    }

    const dbRole = String(data?.role || '').trim()
    if (dbRole.length >= 200) {
      if (fromRpc.length > 0 && fromRpc.length < 200) {
        logger.info('[resolveAgentTemplateRole] Usando role completo do template (RPC era resumo)', {
          templateId,
          rpcLength: fromRpc.length,
          dbRoleLength: dbRole.length,
        })
      }
      return dbRole
    }

    return dbRole || fromRpc
  } catch (err: any) {
    logger.warn('[resolveAgentTemplateRole] Erro inesperado', {
      templateId,
      error: err?.message || err,
    })
    return fromRpc
  }
}
