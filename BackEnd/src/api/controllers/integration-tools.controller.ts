import { Request, Response } from 'express'
import logger from '../../lib/logger'
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
    return res.json({ success: true, tools: listIntegrationToolkitCatalog() })
  } catch (error: any) {
    return handleControllerError(res, 'listIntegrationToolsCatalog', 'Nao foi possivel listar o catalogo de ferramentas de integracao.', error)
  }
}

export async function runIntegrationTool(req: Request, res: Response) {
  try {
    const provider = String(req.body?.provider || '').trim()
    const toolName = String(req.body?.toolName || req.body?.tool_name || '').trim()
    const payload =
      req.body?.payload && typeof req.body.payload === 'object' && !Array.isArray(req.body.payload)
        ? (req.body.payload as Record<string, unknown>)
        : {}
    const result = await executeIntegrationTool({ provider, toolName, payload })
    return res.json({ success: result.success, result })
  } catch (error: any) {
    return handleControllerError(res, 'runIntegrationTool', 'Nao foi possivel executar a ferramenta de integracao.', error)
  }
}

