import { Request, Response } from 'express'
import logger from '../../lib/logger'
import {
  getAuthenticatedEmail,
  getAuthenticatedCompaniesId,
  getAuthenticatedUserId,
} from '../../utils/request-auth'
import {
  assertIntegrationToolPayloadOwned,
  TenantOwnershipError,
} from '../../utils/tenant-ownership'
import { supabase } from '../../lib/supabase'
import {
  buildToolKey,
  getEnabledTools,
  parseAgentExtraFeatures,
} from '../../services/agents/agent-extra-features'
import { buildIntegrationToolsCatalogForSetup } from '../../services/integrations/toolkit/toolkit-catalog-for-setup.service'
import { executeIntegrationTool, listIntegrationToolkitCatalog } from '../../services/integrations/toolkit/toolkit.service'

function handleControllerError(res: Response, scope: string, fallbackMessage: string, error: any) {
  logger.error(`[${scope}] ${fallbackMessage}`, {
    error: error?.message || error,
  })
  return res.status(500).json({
    error: fallbackMessage,
    details: error?.message || String(error),
  })
}

export async function listIntegrationToolsCatalog(req: Request, res: Response) {
  try {
    void req
    const tools = listIntegrationToolkitCatalog().map((t) => ({
      ...t,
      toolKey: t.toolKey || buildToolKey(t.provider, t.toolName),
    }))
    return res.json({ success: true, tools })
  } catch (error: any) {
    return handleControllerError(res, 'listIntegrationToolsCatalog', 'Nao foi possivel listar o catalogo de ferramentas de integracao.', error)
  }
}

export async function listIntegrationToolsCatalogForSetup(req: Request, res: Response) {
  try {
    const email = getAuthenticatedEmail(req)
    if (!email) {
      return res.status(401).json({ error: 'Usuario nao autenticado.' })
    }
    const catalog = await buildIntegrationToolsCatalogForSetup(email, {
      userId: getAuthenticatedUserId(req) || null,
      companyId: getAuthenticatedCompaniesId(req) || null,
    })
    return res.json({ success: true, ...catalog })
  } catch (error: any) {
    return handleControllerError(
      res,
      'listIntegrationToolsCatalogForSetup',
      'Nao foi possivel listar ferramentas para configuracao.',
      error
    )
  }
}

export async function getAgentEnabledTools(req: Request, res: Response) {
  try {
    const agentId = String(req.params.agentId || '').trim()
    const companiesId = getAuthenticatedCompaniesId(req)
    if (!agentId || !companiesId) {
      return res.status(400).json({ error: 'agentId e autenticacao sao obrigatorios.' })
    }

    const { data: agent, error } = await supabase
      .from('tb_agents')
      .select('id, extra_features')
      .eq('id', agentId)
      .eq('companies_id', companiesId)
      .maybeSingle()

    if (error || !agent) {
      return res.status(404).json({ error: 'Agente nao encontrado.' })
    }

    const extra = parseAgentExtraFeatures(agent.extra_features)
    const tools = getEnabledTools(extra)

    return res.json({
      success: true,
      agentId,
      tools,
      toolKeys: tools.map((t) => t.toolKey),
    })
  } catch (error: any) {
    return handleControllerError(res, 'getAgentEnabledTools', 'Nao foi possivel ler ferramentas do agente.', error)
  }
}

export async function runIntegrationTool(req: Request, res: Response) {
  try {
    const email = getAuthenticatedEmail(req)
    if (!email) {
      return res.status(401).json({ error: 'Usuario nao autenticado.' })
    }

    const provider = String(req.body?.provider || '').trim()
    const toolName = String(req.body?.toolName || req.body?.tool_name || '').trim()
    const payload =
      req.body?.payload && typeof req.body.payload === 'object' && !Array.isArray(req.body.payload)
        ? (req.body.payload as Record<string, unknown>)
        : {}

    try {
      await assertIntegrationToolPayloadOwned(email, provider, payload)
    } catch (err) {
      if (err instanceof TenantOwnershipError) {
        return res.status(err.statusCode).json({ error: err.message, code: err.code })
      }
      throw err
    }

    const result = await executeIntegrationTool({ provider, toolName, payload })
    return res.json({ success: result.success, result })
  } catch (error: any) {
    return handleControllerError(res, 'runIntegrationTool', 'Nao foi possivel executar a ferramenta de integracao.', error)
  }
}

