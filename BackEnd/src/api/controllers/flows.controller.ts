import { Request, Response } from 'express'
import { FlowService } from '../../services/flows'
import { getCompanyIdByEmail } from '../../utils/company-helper'
import { supabase } from '../../lib/supabase'
import logger from '../../lib/logger'
import { executeFlowForChannel, parseFlowResumeSession } from '../../services/flows/flow-channel-runtime'
import {
  generateMvpFlowFromDescription,
  isAnthropicConfiguredForFlowRefine,
  refineFlowDescriptionWithClaudeForGeneration,
} from '../../services/flows/flow-generate-mvp.service'
import { generateConditionalSwitchTestFlow } from '../../services/flows/flow-generate-test-conditional-switch.service'
import { provisionMedicalClinicDemoFlow } from '../../services/flows/flow-provision-medical-clinic.service'
import { validateMetaWhatsappFlowPayload } from '../../services/flows/flow-whatsapp-validation'

/**
 * Lista flows do usuário (da empresa + globais)
 */
export async function listFlows(req: Request, res: Response) {
  try {
    // ✅ Email vem do middleware (validado) ou fallback para compatibilidade
    const email = req.user?.email || (req.query.email as string)

    if (!email) {
      return res.status(401).json({
        error: 'Email é obrigatório',
        details: 'Token de autenticação inválido ou email não fornecido'
      })
    }

    const flows = await FlowService.listFlows(email)
    return res.json(flows)
  } catch (error: any) {
    logger.error('[FlowsController] Erro ao listar flows:', error)
    return res.status(500).json({
      error: 'Erro ao buscar flows',
      details: error.message
    })
  }
}

/**
 * Executa um flow
 * O Flow é a orquestração central - decide a ordem de execução
 */
export async function executeFlow(req: Request, res: Response) {
  try {
    const {
      flow_id,
      email,
      initial_data,
      delivery_channel,
      execution_mode,
      scheduled_start_at,
      integrations_id,
      recipient_id,
      agent_id,
      request_started_at,
      resume_session
    } = req.body

    if (!flow_id || !email) {
      return res.status(400).json({ 
        error: 'flow_id e email são obrigatórios' 
      })
    }

    // Dados iniciais para o primeiro node (ex: { nome: "João", email: "joao@example.com" })
    const initialData = initial_data || {}

    // Executa o flow (orquestração central)
    const execution = await executeFlowForChannel({
      flowId: flow_id,
      userEmail: email,
      initialData,
      deliveryChannel: delivery_channel === 'whatsapp' ? 'whatsapp' : 'none',
      executionMode: execution_mode === 'live' ? 'live' : 'test',
      scheduledStartAt: typeof scheduled_start_at === 'string' ? scheduled_start_at : undefined,
      integrationsId: typeof integrations_id === 'string' ? integrations_id : undefined,
      recipientId: typeof recipient_id === 'string' ? recipient_id : undefined,
      agentId: typeof agent_id === 'string' ? agent_id : undefined,
      requestStartedAt: typeof request_started_at === 'string' ? request_started_at : undefined,
      resumeSession: parseFlowResumeSession(resume_session)
    })
    const result = execution.context

    // Log para debug: verifica se há QR codes no histórico
    const stepsWithQRCode = result.executionHistory.filter((h: any) => h.qrCode)
    if (stepsWithQRCode.length > 0) {
      console.log(`[FlowsController] ✅ ${stepsWithQRCode.length} step(s) com QR code no histórico:`, 
        stepsWithQRCode.map((h: any) => ({ nodeId: h.nodeId, qrCodeLength: h.qrCode?.length || 0 }))
      )
    }

    const pausedForUserReply = Boolean((result.data as Record<string, unknown>).__flow_paused_for_user_reply)
    const resumeNodeId = String((result.data as Record<string, unknown>).__flow_resume_node_id || '').trim() || null

    return res.json({
      success: true,
      flowId: result.flowId,
      executionId: result.executionId,
      executionHistory: result.executionHistory,
      finalData: result.data,
      outboundMessage: execution.outboundMessage,
      delivery: execution.delivery,
      nodesExecuted: result.executionHistory.length,
      pausedForUserReply,
      resumeNodeId
    })
  } catch (error: any) {
    console.error('[FlowsController] Erro ao executar flow:', error)
    return res.status(500).json({
      error: 'Erro ao executar flow',
      details: error.message
    })
  }
}

/**
 * Busca um flow específico
 */
export async function getFlow(req: Request, res: Response) {
  try {
    const flowId = typeof req.params.id === 'string' ? req.params.id : req.params.id[0]
    // ✅ Email vem do middleware (validado) ou fallback para compatibilidade
    const email = req.user?.email || (req.query.email as string)

    if (!email) {
      return res.status(401).json({
        error: 'Email é obrigatório',
        details: 'Token de autenticação inválido ou email não fornecido'
      })
    }

    const flow = await FlowService.getFlow(flowId, email)
    
    if (!flow) {
      return res.status(404).json({ error: 'Flow não encontrado' })
    }

    return res.json(flow)
  } catch (error: any) {
    logger.error('[FlowsController] Erro ao buscar flow:', error)
    return res.status(500).json({
      error: 'Erro ao buscar flow',
      details: error.message
    })
  }
}

/**
 * Cria um novo flow
 * POST /flows
 */
export async function createFlow(req: Request, res: Response) {
  try {
    const email = req.user?.email || req.body.email || req.headers['x-user-email'] as string

    if (!email) {
      return res.status(401).json({
        error: 'Email é obrigatório',
        details: 'Token de autenticação inválido ou email não fornecido'
      })
    }

    // Buscar companies_id
    const companiesId = await getCompanyIdByEmail(email)
    if (!companiesId) {
      return res.status(403).json({
        error: 'Empresa não encontrada',
        details: 'Usuário não pertence a nenhuma empresa'
      })
    }

    const { name, nodes, user_email } = req.body

    if (!name || !nodes) {
      return res.status(400).json({
        error: 'Campos obrigatórios faltando',
        details: 'name e nodes são obrigatórios'
      })
    }

    const metaValidation = validateMetaWhatsappFlowPayload(nodes)
    if (metaValidation.errors.length > 0) {
      return res.status(400).json({
        error: 'Flow invalido (validacao Meta WhatsApp)',
        details: metaValidation.errors
      })
    }
    if (metaValidation.warnings.length > 0) {
      logger.warn('[createFlow] Avisos validacao Meta WhatsApp', { warnings: metaValidation.warnings })
    }

    // Criar flow
    const payload = {
      name: name.trim(),
      nodes: nodes,
      user_email: user_email || email,
      companies_id: companiesId
    }

    const { data, error } = await supabase
      .from('tb_flows')
      .insert(payload)
      .select()
      .single()

    if (error) {
      logger.error('[createFlow] Erro ao criar flow:', error)
      return res.status(500).json({
        error: 'Erro ao criar flow',
        details: error.message
      })
    }

    logger.log(`[createFlow] ✅ Flow criado com sucesso`)
    return res.json({
      success: true,
      flow: data
    })
  } catch (error: any) {
    logger.error('[createFlow] Erro:', error)
    return res.status(500).json({
      error: 'Erro ao criar flow',
      details: error.message
    })
  }
}

/**
 * Atualiza um flow
 * PUT /flows/:id
 */
export async function updateFlow(req: Request, res: Response) {
  try {
    const { id } = req.params
    const email = req.user?.email || req.body.email || req.headers['x-user-email'] as string

    if (!email) {
      return res.status(401).json({
        error: 'Email é obrigatório',
        details: 'Token de autenticação inválido ou email não fornecido'
      })
    }

    if (!id) {
      return res.status(400).json({
        error: 'ID do flow é obrigatório'
      })
    }

    // Buscar companies_id
    const companiesId = await getCompanyIdByEmail(email)
    if (!companiesId) {
      return res.status(403).json({
        error: 'Empresa não encontrada',
        details: 'Usuário não pertence a nenhuma empresa'
      })
    }

    // Verificar se o flow pertence à empresa (não pode atualizar globais)
    const { data: flow, error: flowError } = await supabase
      .from('tb_flows')
      .select('id, companies_id')
      .eq('id', id)
      .maybeSingle()

    if (flowError || !flow) {
      return res.status(404).json({
        error: 'Flow não encontrado',
        details: 'Flow não existe'
      })
    }

    // Só pode atualizar flows da própria empresa (não globais)
    if (flow.companies_id && flow.companies_id !== companiesId) {
      return res.status(403).json({
        error: 'Flow não pertence à sua empresa',
        details: 'Você não pode atualizar flows de outras empresas'
      })
    }

    // Preparar payload (remover email se vier no body)
    const { email: _, ...updatePayload } = req.body

    if (updatePayload.nodes != null) {
      const metaValidation = validateMetaWhatsappFlowPayload(updatePayload.nodes)
      if (metaValidation.errors.length > 0) {
        return res.status(400).json({
          error: 'Flow invalido (validacao Meta WhatsApp)',
          details: metaValidation.errors
        })
      }
      if (metaValidation.warnings.length > 0) {
        logger.warn('[updateFlow] Avisos validacao Meta WhatsApp', { warnings: metaValidation.warnings })
      }
    }

    // Atualizar flow
    const { data: updatedFlow, error: updateError } = await supabase
      .from('tb_flows')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      logger.error('[updateFlow] Erro ao atualizar flow:', updateError)
      return res.status(500).json({
        error: 'Erro ao atualizar flow',
        details: updateError.message
      })
    }

    logger.log(`[updateFlow] ✅ Flow ${id} atualizado com sucesso`)
    return res.json({
      success: true,
      flow: updatedFlow
    })
  } catch (error: any) {
    logger.error('[updateFlow] Erro:', error)
    return res.status(500).json({
      error: 'Erro ao atualizar flow',
      details: error.message
    })
  }
}

/**
 * Deleta um flow
 * DELETE /flows/:id
 */
export async function deleteFlow(req: Request, res: Response) {
  try {
    const { id } = req.params
    const email = req.user?.email || req.body.email || req.headers['x-user-email'] as string

    if (!email) {
      return res.status(401).json({
        error: 'Email é obrigatório',
        details: 'Token de autenticação inválido ou email não fornecido'
      })
    }

    if (!id) {
      return res.status(400).json({
        error: 'ID do flow é obrigatório'
      })
    }

    // Buscar companies_id
    const companiesId = await getCompanyIdByEmail(email)
    if (!companiesId) {
      return res.status(403).json({
        error: 'Empresa não encontrada',
        details: 'Usuário não pertence a nenhuma empresa'
      })
    }

    // Verificar se o flow pertence à empresa (não pode deletar globais)
    const { data: flow, error: flowError } = await supabase
      .from('tb_flows')
      .select('id, companies_id')
      .eq('id', id)
      .maybeSingle()

    if (flowError || !flow) {
      return res.status(404).json({
        error: 'Flow não encontrado',
        details: 'Flow não existe'
      })
    }

    if (!flow.companies_id) {
      return res.status(403).json({
        error: 'Fluxo global',
        details: 'Fluxos globais da plataforma não podem ser excluídos.',
        code: 'FLOW_GLOBAL',
      })
    }

    if (flow.companies_id !== companiesId) {
      return res.status(403).json({
        error: 'Flow não pertence à sua empresa',
        details: 'Você não pode deletar flows de outras empresas',
      })
    }

    const { data: linkedInts, error: linkedErr } = await supabase
      .from('tb_integrations')
      .select('provider, phone_number')
      .eq('companies_id', companiesId)
      .eq('linked_flow_id', id)

    if (!linkedErr && linkedInts && linkedInts.length > 0) {
      const labels = linkedInts.map((row: { provider?: string; phone_number?: string | null }) => {
        const p = row.provider || 'integração'
        return row.phone_number ? `${p} (${row.phone_number})` : p
      })
      return res.status(409).json({
        error: 'Fluxo em uso',
        details: `Desvincule o fluxo nas integrações antes de excluir: ${labels.join('; ')}`,
        code: 'FLOW_LINKED_INTEGRATION',
      })
    }

    // Deletar flow
    const { error: deleteError } = await supabase
      .from('tb_flows')
      .delete()
      .eq('id', id)

    if (deleteError) {
      logger.error('[deleteFlow] Erro ao deletar flow:', deleteError)
      return res.status(500).json({
        error: 'Erro ao deletar flow',
        details: deleteError.message
      })
    }

    logger.log(`[deleteFlow] ✅ Flow ${id} deletado com sucesso`)
    return res.json({
      success: true,
      message: 'Flow deletado com sucesso'
    })
  } catch (error: any) {
    logger.error('[deleteFlow] Erro:', error)
    return res.status(500).json({
      error: 'Erro ao deletar flow',
      details: error.message
    })
  }
}

/**
 * Gera rascunho de fluxo a partir de texto: modo estruturado (classificador + Se/Senão + ramos) quando há templates,
 * ou fluxo simples (Início → 1 agente/template → Fim). Refino da descrição via OpenAI e/ou Claude conforme env.
 */
export async function generateFlowMvp(req: Request, res: Response) {
  try {
    const email = req.user?.email || req.body.email

    if (!email) {
      return res.status(401).json({
        error: 'Email é obrigatório',
        details: 'Token de autenticação inválido ou email não fornecido',
      })
    }

    const description = typeof req.body.description === 'string' ? req.body.description.trim() : ''
    const language =
      typeof req.body.language === 'string' && req.body.language.trim()
        ? req.body.language.trim()
        : 'pt-BR'

    if (!description) {
      return res.status(400).json({
        error: 'Descrição obrigatória',
        details: 'Envie "description" com o que o fluxo deve fazer.',
      })
    }

    if (description.length > 8000) {
      return res.status(400).json({
        error: 'Descrição muito longa',
        details: 'Use no máximo 8000 caracteres.',
      })
    }

    const result = await generateMvpFlowFromDescription(email, description, language)
    return res.json(result)
  } catch (error: any) {
    logger.error('[generateFlowMvp] Erro:', error)
    return res.status(500).json({
      error: 'Erro ao gerar fluxo',
      details: error?.message || 'Falha desconhecida',
    })
  }
}

/**
 * Cria 1 template compartilhado, 4 agentes e 1 fluxo de teste com:
 * Início -> Classificador -> Condicional -> Múltiplas opções -> Agente especializado -> Fim
 */
export async function generateConditionalSwitchTestFlowController(req: Request, res: Response) {
  try {
    const email = req.user?.email || req.body.email

    if (!email) {
      return res.status(401).json({
        error: 'Email é obrigatório',
        details: 'Token de autenticação inválido ou email não fornecido',
      })
    }

    const language =
      typeof req.body.language === 'string' && req.body.language.trim()
        ? req.body.language.trim()
        : 'pt-BR'
    const flowName =
      typeof req.body.name === 'string' && req.body.name.trim()
        ? req.body.name.trim()
        : undefined

    const result = await generateConditionalSwitchTestFlow(email, {
      language,
      flowName,
    })

    return res.json({
      success: true,
      flowId: result.flowId,
      flowName: result.flowName,
      template: {
        id: result.templateId,
        name: result.templateName,
        description: result.templateDescription,
      },
      agents: result.agents.map((agent) => ({
        key: agent.key,
        id: agent.id,
        name: agent.name,
        bio: agent.bio,
      })),
      flow: result.flow,
    })
  } catch (error: any) {
    logger.error('[generateConditionalSwitchTestFlowController] Erro:', error)
    return res.status(500).json({
      error: 'Erro ao criar fluxo de teste',
      details: error?.message || 'Falha desconhecida',
    })
  }
}

/**
 * Cria ou atualiza o demo completo de clinica medica no workspace atual.
 * Provisiona templates, agentes, o fluxo principal e seus subfluxos em tb_flows.
 */
export async function provisionMedicalClinicDemoController(req: Request, res: Response) {
  try {
    const email = req.user?.email || req.body.email

    if (!email) {
      return res.status(401).json({
        error: 'Email e obrigatorio',
        details: 'Token de autenticacao invalido ou email nao fornecido',
      })
    }

    const result = await provisionMedicalClinicDemoFlow(email, {
      crmIntegrationId:
        typeof req.body.crmIntegrationId === 'string' ? req.body.crmIntegrationId : undefined,
      emailIntegrationId:
        typeof req.body.emailIntegrationId === 'string' ? req.body.emailIntegrationId : undefined,
      calendlyIntegrationId:
        typeof req.body.calendlyIntegrationId === 'string' ? req.body.calendlyIntegrationId : undefined,
      teamNotifyEmail:
        typeof req.body.teamNotifyEmail === 'string' ? req.body.teamNotifyEmail : undefined,
    })

    return res.json({
      success: true,
      flowId: result.flowId,
      flowName: result.flowName,
      subflowIds: result.subflowIds,
      appointmentProvider: result.appointmentProvider,
      appointmentIntegrationId: result.appointmentIntegrationId,
      templates: result.templatesCreated,
      agents: result.agentsCreated,
      flow: result.flow,
    })
  } catch (error: any) {
    logger.error('[provisionMedicalClinicDemoController] Erro:', error)
    return res.status(500).json({
      error: 'Erro ao provisionar demo da clinica',
      details: error?.message || 'Falha desconhecida',
    })
  }
}

/**
 * Refina só o texto com Claude (modal “Melhorar descrição”) — não cria agentes nem fluxo.
 * POST /flows/refine-description
 */
export async function refineFlowDescriptionClaude(req: Request, res: Response) {
  try {
    const email = req.user?.email || req.body.email

    if (!email) {
      return res.status(401).json({
        error: 'Email é obrigatório',
        details: 'Token de autenticação inválido ou email não fornecido',
      })
    }

    const description = typeof req.body.description === 'string' ? req.body.description.trim() : ''
    const language =
      typeof req.body.language === 'string' && req.body.language.trim()
        ? req.body.language.trim()
        : 'pt-BR'

    if (!description) {
      return res.status(400).json({
        error: 'Descrição obrigatória',
        details: 'Envie "description" com o texto a refinar.',
      })
    }

    if (description.length > 8000) {
      return res.status(400).json({
        error: 'Descrição muito longa',
        details: 'Use no máximo 8000 caracteres.',
      })
    }

    if (!isAnthropicConfiguredForFlowRefine()) {
      return res.status(503).json({
        error: 'Claude não configurado',
        details: 'Configure ANTHROPIC_API_KEY ou CLAUDE_API_KEY no servidor.',
        code: 'ANTHROPIC_MISSING',
      })
    }

    const refined = await refineFlowDescriptionWithClaudeForGeneration(description, language)
    if (!refined.ok) {
      return res.status(502).json({
        error: 'Não foi possível refinar com Claude',
        details: refined.message,
        code: 'CLAUDE_REFINE_FAILED',
        anthropicStatus: refined.status,
      })
    }

    return res.json({
      success: true,
      refinedDescription: refined.text,
      refinementProvider: 'claude' as const,
    })
  } catch (error: unknown) {
    logger.error('[refineFlowDescriptionClaude] Erro:', error)
    return res.status(500).json({
      error: 'Erro ao refinar descrição',
      details: error instanceof Error ? error.message : 'Falha desconhecida',
    })
  }
}

/** GET /flows/refine-description/status — se Claude está disponível (para habilitar botão no front). */
export async function refineFlowDescriptionStatus(req: Request, res: Response) {
  try {
    const email = req.user?.email || (req.query.email as string)
    if (!email) {
      return res.status(401).json({
        error: 'Email é obrigatório',
        details: 'Token de autenticação inválido ou email não fornecido',
      })
    }
    return res.json({
      claudeAvailable: isAnthropicConfiguredForFlowRefine(),
    })
  } catch (error: unknown) {
    logger.error('[refineFlowDescriptionStatus] Erro:', error)
    return res.status(500).json({ error: 'Erro ao consultar status' })
  }
}
