import { Request, Response } from 'express'
import { getAgentsByEmail } from '../../services/agents'
import { chatWithAgent } from '../../services/agents/chatwithAgent'
import { supabase } from '../../lib/supabase'
import { sendWhatsApp } from '../../services/integrations/whatsapp/whatsapp.service'

export async function listAgents(req: Request, res: Response) {
  try {
    const email = req.query.email as string

    if (!email) {
      return res.status(400).json({ error: 'Email é obrigatório' })
    }

    const agents = await getAgentsByEmail(email)
    return res.json(agents)
  } catch (error) {
    console.error('ERRO REAL DO SUPABASE:', error)

    return res.status(500).json({
      error: 'Erro ao buscar agentes',
      details: error instanceof Error ? error.message : error
    })
  }
}


export async function agentChat(req: Request, res: Response) {
    try {
      const { email, agent_id, message } = req.body
  
      if (!email || !agent_id) {
        return res
          .status(400)
          .json({ error: 'email e agent_id são obrigatórios' })
      }
  
      const reply = await chatWithAgent(
        email,
        agent_id,
        message
      )
  
      return res.json({ reply })
    } catch (error: any) {
      console.error(error)
      return res.status(500).json({
        error: 'Erro ao conversar com o agente',
        details: error.message,
      })
    }
  }

export async function approveDecision(req: Request, res: Response) {
  try {
    const { id } = req.params
    const { edited_answer, user_id } = req.body
    
    if (!user_id) {
      return res.status(400).json({ error: 'user_id é obrigatório' })
    }
    
    if (!id) {
      return res.status(400).json({ error: 'id é obrigatório' })
    }
    
    // 1. Buscar decisão
    const { data: decision, error: fetchError } = await supabase
      .from('tb_agent_decisions')
      .select('*')
      .eq('id', id)
      .single()
    
    if (fetchError) {
      console.error('[approveDecision] Erro ao buscar decisão:', fetchError)
      return res.status(500).json({ 
        error: 'Erro ao buscar decisão',
        details: fetchError.message 
      })
    }
    
    if (!decision) {
      return res.status(404).json({ error: 'Decisão não encontrada' })
    }
    
    if (decision.status !== 'pending_approval') {
      return res.status(400).json({ error: 'Decisão já foi processada' })
    }
    
    // 2. Atualizar decisão
    const finalAnswer = edited_answer || decision.answer
    const wasEdited = edited_answer && edited_answer !== decision.answer
    
    const updateData: any = {
      status: 'approved',
      approved_by: user_id,
      approved_at: new Date().toISOString(),
      approved_answer: finalAnswer
    }
    
    if (wasEdited) {
      updateData.edited_by = user_id
      updateData.edited_at = new Date().toISOString()
    }
    
    const { error: updateError } = await supabase
      .from('tb_agent_decisions')
      .update(updateData)
      .eq('id', id)
    
    if (updateError) {
      console.error('[approveDecision] Erro ao atualizar:', updateError)
      return res.status(500).json({ 
        error: 'Erro ao atualizar decisão',
        details: updateError.message,
        code: updateError.code
      })
    }
    
    // ✅ Salvar log de aprovação
    try {
      const { saveSystemLog } = await import('../../services/system-logs')
      const { getUserIdAndCompanyIdByEmail } = await import('../../utils/company-helper')
      
      // Buscar email do usuário que aprovou
      const { data: userData } = await supabase
        .from('tb_users')
        .select('email')
        .eq('id', user_id)
        .maybeSingle()
      
      let companiesId = decision.companies_id
      if (!companiesId && userData?.email) {
        const userCompanyData = await getUserIdAndCompanyIdByEmail(userData.email)
        companiesId = userCompanyData.companyId || undefined
      }
      
      // Buscar nome do agente
      const { data: agentData } = await supabase
        .from('tb_agents')
        .select('nome')
        .eq('id', decision.agent_id)
        .maybeSingle()
      
      const agentName = agentData?.nome || decision.agent_id
      const message = wasEdited 
        ? `Decisão do agente "${agentName}" aprovada e editada pelo usuário`
        : `Decisão do agente "${agentName}" aprovada pelo usuário`
      
      await saveSystemLog({
        companies_id: companiesId,
        user_id: user_id,
        user_email: userData?.email,
        agent_id: decision.agent_id,
        log_type: 'decision_approved',
        level: 'info',
        message,
        metadata: {
          decision_id: id,
          agent_id: decision.agent_id,
          agent_name: agentName,
          was_edited: wasEdited,
          original_answer: decision.answer,
          approved_answer: finalAnswer,
          confidence_score: decision.confidence_score,
          reason: decision.reason,
          channel: decision.channel
        },
        impact_level: 'low'
      })
    } catch (logError: any) {
      console.warn('[approveDecision] Erro ao salvar log de aprovação:', logError)
      // Não bloqueia a aprovação se falhar ao salvar log
    }
    
    // 3. Enviar mensagem via canal apropriado
    if (decision.channel === 'whatsapp' && decision.integrations_id && decision.contact_id) {
      try {
        const result = await sendWhatsApp(decision.integrations_id, {
          message: finalAnswer,
          to: decision.contact_id,
          agentId: decision.agent_id
        })
        
        if (!result.success) {
          console.error('[approveDecision] Erro ao enviar WhatsApp:', result.error)
          return res.status(500).json({ 
            error: 'Erro ao enviar mensagem',
            details: result.error 
          })
        }
      } catch (sendError: any) {
        console.error('[approveDecision] Erro ao enviar:', sendError)
        return res.status(500).json({ 
          error: 'Erro ao enviar mensagem',
          details: sendError.message 
        })
      }
    } else if (decision.channel === 'email' && decision.contact_id) {
      // TODO: Implementar envio de email
      console.warn('[approveDecision] Envio de email ainda não implementado')
    }
    
    return res.json({ 
      success: true, 
      decision_id: id,
      message: 'Decisão aprovada e mensagem enviada com sucesso'
    })
  } catch (error: any) {
    console.error('[approveDecision] Erro:', error)
    return res.status(500).json({ 
      error: 'Erro ao aprovar decisão',
      details: error.message 
    })
  }
}

export async function rejectDecision(req: Request, res: Response) {
  try {
    const { id } = req.params
    const { user_id } = req.body
    
    // Buscar decisão antes de atualizar para ter os dados
    const { data: decision, error: fetchError } = await supabase
      .from('tb_agent_decisions')
      .select('*')
      .eq('id', id)
      .single()
    
    if (fetchError || !decision) {
      return res.status(404).json({ error: 'Decisão não encontrada' })
    }
    
    const { error } = await supabase
      .from('tb_agent_decisions')
      .update({
        status: 'rejected',
        rejected_at: new Date().toISOString(),
        rejected_by: user_id || null
      })
      .eq('id', id)
    
    if (error) {
      console.error('[rejectDecision] Erro:', error)
      return res.status(500).json({ error: 'Erro ao rejeitar decisão' })
    }
    
    // ✅ Salvar log de rejeição
    try {
      const { saveSystemLog } = await import('../../services/system-logs')
      const { getUserIdAndCompanyIdByEmail } = await import('../../utils/company-helper')
      
      // Buscar email do usuário que rejeitou (se tiver user_id)
      let userEmail: string | undefined
      let companiesId = decision.companies_id
      
      if (user_id) {
        const { data: userData } = await supabase
          .from('tb_users')
          .select('email')
          .eq('id', user_id)
          .maybeSingle()
        
        userEmail = userData?.email
        if (!companiesId && userEmail) {
          const userCompanyData = await getUserIdAndCompanyIdByEmail(userEmail)
          companiesId = userCompanyData.companyId || undefined
        }
      }
      
      // Buscar nome do agente
      const { data: agentData } = await supabase
        .from('tb_agents')
        .select('nome')
        .eq('id', decision.agent_id)
        .maybeSingle()
      
      const agentName = agentData?.nome || decision.agent_id
      const message = `Decisão do agente "${agentName}" rejeitada pelo usuário`
      
      await saveSystemLog({
        companies_id: companiesId,
        user_id: user_id || undefined,
        user_email: userEmail,
        agent_id: decision.agent_id,
        log_type: 'decision_rejected',
        level: 'info',
        message,
        metadata: {
          decision_id: id,
          agent_id: decision.agent_id,
          agent_name: agentName,
          original_answer: decision.answer,
          confidence_score: decision.confidence_score,
          reason: decision.reason,
          channel: decision.channel
        },
        impact_level: 'low'
      })
    } catch (logError: any) {
      console.warn('[rejectDecision] Erro ao salvar log de rejeição:', logError)
      // Não bloqueia a rejeição se falhar ao salvar log
    }
    
    return res.json({ success: true, decision_id: id })
  } catch (error: any) {
    console.error('[rejectDecision] Erro:', error)
    return res.status(500).json({ 
      error: 'Erro ao rejeitar decisão',
      details: error.message 
    })
  }
}
