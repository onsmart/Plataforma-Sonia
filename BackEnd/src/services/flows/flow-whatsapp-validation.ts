/**
 * Validação opcional/estrita de nós Meta WhatsApp no JSON do fluxo (tb_flows.nodes).
 * Não altera execução legada: avisos sempre; erros só com FLOW_VALIDATE_META_WHATSAPP_STRICT=true.
 *
 * Pré-requisito operacional: migration `MIGRATION_WHATSAPP_TEMPLATES_AND_EVENTS.sql` aplicada;
 * RLS no Supabase é opcional — estes dados são escritos via backend com service role conforme sua política.
 */

export function extractNodesFromFlowPayload(nodesJson: unknown): any[] {
  if (Array.isArray(nodesJson)) {
    return nodesJson
  }
  if (nodesJson && typeof nodesJson === 'object' && Array.isArray((nodesJson as { nodes?: unknown }).nodes)) {
    return (nodesJson as { nodes: any[] }).nodes
  }
  return []
}

export function validateMetaWhatsappFlowPayload(nodesJson: unknown): { errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []
  const nodes = extractNodesFromFlowPayload(nodesJson)

  for (const n of nodes) {
    if (!n || typeof n !== 'object') continue
    const id = String(n.id || '?')
    if (n.type === 'wa_template') {
      const d = n.data || {}
      const name = String(d.waTemplateName || '').trim()
      const lang = String(d.waTemplateLanguage || '').trim()
      if (!name) {
        warnings.push(`Bloco template (node ${id}): nome do template Meta vazio`)
      }
      if (!lang) {
        warnings.push(`Bloco template (node ${id}): idioma vazio`)
      }
    }
    if (n.type === 'whatsapp_message') {
      const d = n.data || {}
      const text = String(d.waMessageText || '').trim()
      if (!text) {
        warnings.push(`Bloco Enviar mensagem WhatsApp (node ${id}): texto da mensagem vazio`)
      }
      if (String(d.waMessageType || '').trim() === 'buttons') {
        const buttons = Array.isArray(d.waButtons) ? d.waButtons : []
        if (buttons.length === 0) {
          warnings.push(`Bloco Enviar mensagem WhatsApp (node ${id}): adicione ao menos um botão`)
        }
      }
    }
  }
  if (nodes.some((n) => n && typeof n === 'object' && n.type === 'wa_session_window')) {
    warnings.push(
      'Fluxo com bloco Janela 24h: confirme ramificações dentro/fora; fora da janela costuma exigir template Meta.'
    )
  }

  const strict = String(process.env.FLOW_VALIDATE_META_WHATSAPP_STRICT || '').toLowerCase() === 'true'
  if (strict) {
    for (const n of nodes) {
      if (!n || typeof n !== 'object') continue
      const id = String(n.id || '?')
      if (n.type === 'wa_template') {
        const d = n.data || {}
        if (!String(d.waTemplateName || '').trim()) {
          errors.push(`Node ${id}: waTemplateName obrigatorio em modo estrito`)
        }
        if (!String(d.waTemplateLanguage || '').trim()) {
          errors.push(`Node ${id}: waTemplateLanguage obrigatorio em modo estrito`)
        }
      }
      if (n.type === 'whatsapp_message' && !String(n.data?.waMessageText || '').trim()) {
        errors.push(`Node ${id}: waMessageText obrigatorio em modo estrito`)
      }
    }
  }

  return { errors, warnings }
}
