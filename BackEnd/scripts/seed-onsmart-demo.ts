/**
 * Cria templates Onsmart.AI, agentes de demonstração e o fluxo "WhatsApp + Calendly"
 * na empresa do usuário informado.
 *
 * Uso (na pasta BackEnd, com .env contendo SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY):
 *   npx tsx scripts/seed-onsmart-demo.ts
 *
 * Opcional:
 *   OWNER_EMAIL=admin@suaempresa.com npx tsx scripts/seed-onsmart-demo.ts
 */

import path from 'path'
import dotenv from 'dotenv'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const OWNER_EMAIL = (process.env.OWNER_EMAIL || process.env.SEED_OWNER_EMAIL || '').trim().toLowerCase()
const CALENDLY_URL =
  'https://calendly.com/ricardo-palomar-onsmartai/30min/?month=2026-04'

const FLOW_NAME = 'Onsmart — WhatsApp roteamento + Calendly'

const TEMPLATES: { name: string; role: string; description: string }[] = [
  {
    name: 'Onsmart — Classificador de intenção',
    description: 'Classifica mensagem para roteamento no fluxo.',
    role: `Você classifica a última mensagem do visitante no WhatsApp da Onsmart.AI (consultoria e agentes de IA empresarial).

Categorias (use exatamente uma no JSON):
- agendar: quer marcar reunião, demo, call, falar com especialista, horário, calendário.
- metodologia: pergunta sobre LÍDER, como trabalham, processo, implementação em 30 dias.
- servicos: automação, agentes, integração, ROI, casos de uso, preço/orçamento genérico.
- suporte: problema técnico com solução já contratada, erro, bug.
- humano: pede pessoa, gerente, "quero falar com alguém" sem ser agendamento explícito.
- outro: não se encaixa.

Responda APENAS com JSON válido em uma linha, sem markdown:
{"intent":"agendar|metodologia|servicos|suporte|humano|outro","confidence":"alta|media|baixa","summary":"até 120 caracteres em português"}`,
  },
  {
    name: 'Onsmart — Agendamento Calendly 30min',
    description: 'Envia link Calendly e orientações.',
    role: `Você representa a Onsmart.AI. O cliente quer agendar.

1) Cumprimente de forma breve e profissional.
2) Explique que a conversa alinha diagnóstico / próximos passos.
3) Envie o link EXATO (copie literalmente): ${CALENDLY_URL}
4) Diga que pode escolher o horário no Calendly.
5) Opcional: pergunte segmento ou principal desafio (uma linha).

Responda só em texto, parágrafos curtos, tom WhatsApp.`,
  },
  {
    name: 'Onsmart — Metodologia LÍDER (resumo)',
    description: 'Explica framework LÍDER.',
    role: `Explique a metodologia LÍDER da Onsmart.AI (Laboral, Investimento, Desenvolvimento, Estruturação, Reconhecimento, Execução) de forma clara.
Relacione com agentes de IA no negócio. ~8 frases. Tom consultivo.
Ao final, sugira agendar: ${CALENDLY_URL}
Apenas texto WhatsApp.`,
  },
  {
    name: 'Onsmart — Suporte triagem',
    description: 'Triagem N1 com JSON severity.',
    role: `Cliente com possível problema técnico em solução Onsmart.

Responda APENAS JSON válido:
{"response":"texto curto pedindo produto afetado, o que tentou, print se possível","severity":"baixa|media|alta","area":"acesso|integracao|agente|outro"}

"alta" se indisponibilidade total ou bloqueio crítico.`,
  },
  {
    name: 'Onsmart — Handoff humano',
    description: 'Transbordo para humano.',
    role: `Informe que um especialista humano dará continuidade em breve. Cordial e breve.
Opcional: ${CALENDLY_URL}
Apenas texto WhatsApp.`,
  },
  {
    name: 'Onsmart — Fallback cordial',
    description: 'Quando intent não encaixa.',
    role: `Pedido não claro. Peça uma frase: agendar, metodologia, serviços ou suporte.
Ofereça conversa de 30 min: ${CALENDLY_URL}
Apenas texto WhatsApp.`,
  },
  {
    name: 'Onsmart — Role base Agente Comercial',
    description: 'Persona para agente de conta (fluxo).',
    role: `Você é a Sonia, consultora comercial da Onsmart.AI. Especialista em agentes de IA empresarial e metodologia LÍDER.
Tom consultivo, português BR. Não invente números de ROI. Quando fizer sentido, ofereça agendamento: ${CALENDLY_URL} (no máximo uma vez por resposta).`,
  },
  {
    name: 'Onsmart — Role base Agente Suporte N2',
    description: 'Persona para suporte N2.',
    role: `Você é suporte técnico N2 da Onsmart.AI. Colete sintomas, tentativas, ambiente (integração, WhatsApp, CRM).
Sugira passos seguros. Se risco alto, indique escalação humana sem inventar SLA. Português BR, claro.`,
  },
]

function unwrapRpcId(data: unknown): string {
  if (data == null) throw new Error('RPC retornou vazio')
  if (typeof data === 'string' && data.length > 0) return data
  if (typeof data === 'object' && data !== null && 'id' in data && typeof (data as { id: unknown }).id === 'string') {
    return (data as { id: string }).id
  }
  if (Array.isArray(data) && data.length > 0) {
    const row = data[0] as { id?: string }
    if (row?.id) return row.id
  }
  throw new Error(`Resposta RPC inesperada: ${JSON.stringify(data).slice(0, 200)}`)
}

async function getCompanyAndUser(supabase: SupabaseClient, email: string) {
  const { data: userRow, error: uErr } = await supabase
    .from('tb_users')
    .select('id')
    .eq('email', email)
    .maybeSingle()
  if (uErr) throw uErr
  if (!userRow?.id) throw new Error(`Usuário não encontrado em tb_users: ${email}`)

  const { data: cu, error: cErr } = await supabase
    .from('tb_company_users')
    .select('companies_id')
    .eq('user_id', userRow.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (cErr) throw cErr
  if (!cu?.companies_id) throw new Error(`Nenhuma empresa para o usuário ${email}`)

  return { userId: userRow.id as string, companiesId: cu.companies_id as string }
}

async function ensureTemplate(
  supabase: SupabaseClient,
  email: string,
  companiesId: string,
  def: (typeof TEMPLATES)[0]
): Promise<string> {
  const { data: existing } = await supabase
    .from('tb_agents_templates')
    .select('id')
    .eq('name', def.name)
    .eq('companies_id', companiesId)
    .maybeSingle()
  if (existing?.id) {
    console.log(`  template já existe: ${def.name}`)
    return existing.id as string
  }

  const { data, error } = await supabase.rpc('sp_create_agent_template', {
    p_name: def.name,
    p_role: def.role,
    p_description: def.description,
    p_icon: 'bot',
    p_complexity: 'Intermediate',
    p_channel_names: ['whatsapp', 'webchat'],
    p_skill_names: [],
    p_email: email,
  })
  if (error) throw error
  const id = unwrapRpcId(data)
  console.log(`  template criado: ${def.name} → ${id}`)
  return id
}

async function ensureAgent(
  supabase: SupabaseClient,
  email: string,
  companiesId: string,
  nome: string,
  roleTemplateId: string,
  personalityPrompt: string
): Promise<string> {
  const { data: existing } = await supabase
    .from('tb_agents')
    .select('id')
    .eq('nome', nome)
    .eq('companies_id', companiesId)
    .maybeSingle()
  if (existing?.id) {
    console.log(`  agente já existe: ${nome}`)
    const { error: upErr } = await supabase
      .from('tb_agents')
      .update({
        personality_prompt: personalityPrompt,
        provider: 'openai',
        provider_model: 'gpt-4o-mini',
        temperature: 0.55,
        max_tokens: 1200,
      })
      .eq('id', existing.id)
    if (upErr) console.warn(`  aviso ao atualizar agente ${nome}:`, upErr.message)
    return existing.id as string
  }

  const { data, error } = await supabase.rpc('sp_create_agent_by_email', {
    p_email: email,
    p_nome: nome,
    p_role_template_id: roleTemplateId,
    p_primary_language: 'pt-BR',
    p_bio: 'Criado pelo seed Onsmart (demo).',
    p_integrations_id: null,
  })
  if (error) throw error
  const id = unwrapRpcId(data)
  console.log(`  agente criado: ${nome} → ${id}`)

  const { error: upErr } = await supabase
    .from('tb_agents')
    .update({
      personality_prompt: personalityPrompt,
      provider: 'openai',
      provider_model: 'gpt-4o-mini',
      temperature: nome.includes('Suporte') ? 0.4 : 0.55,
      max_tokens: nome.includes('Suporte') ? 1800 : 1200,
    })
    .eq('id', id)
  if (upErr) throw upErr

  return id
}

function buildFlowPayload(
  ids: {
    tplClassifier: string
    tplCal: string
    tplMet: string
    tplSupp: string
    tplHand: string
    tplFb: string
    agCommercial: string
    agSupport: string
  }
) {
  const { tplClassifier, tplCal, tplMet, tplSupp, tplHand, tplFb, agCommercial, agSupport } = ids

  const nodes = [
    { id: 'n-start', type: 'start', position: { x: 420, y: 0 }, data: { label: 'Início' } },
    {
      id: 'n-classifier',
      type: 'agent',
      position: { x: 380, y: 100 },
      data: {
        label: 'Classificador',
        executionMode: 'template',
        templateId: tplClassifier,
        templateName: 'Onsmart — Classificador de intenção',
        additionalInstructions: '',
      },
    },
    {
      id: 'if-a',
      type: 'if-else',
      position: { x: 380, y: 220 },
      data: { label: 'É agendar?', condition: "{{intent}} contem 'agendar'" },
    },
    {
      id: 'tpl-cal',
      type: 'agent',
      position: { x: 120, y: 340 },
      data: {
        label: 'Calendly',
        executionMode: 'template',
        templateId: tplCal,
        templateName: 'Onsmart — Agendamento Calendly 30min',
        additionalInstructions: '',
      },
    },
    { id: 'st-a', type: 'stop', position: { x: 120, y: 460 }, data: { label: 'Fim' } },
    {
      id: 'if-b',
      type: 'if-else',
      position: { x: 380, y: 340 },
      data: { label: 'É metodologia?', condition: "{{intent}} contem 'metodologia'" },
    },
    {
      id: 'tpl-met',
      type: 'agent',
      position: { x: 120, y: 480 },
      data: {
        label: 'Metodologia LÍDER',
        executionMode: 'template',
        templateId: tplMet,
        templateName: 'Onsmart — Metodologia LÍDER (resumo)',
        additionalInstructions: '',
      },
    },
    { id: 'st-b', type: 'stop', position: { x: 120, y: 600 }, data: { label: 'Fim' } },
    {
      id: 'if-c',
      type: 'if-else',
      position: { x: 380, y: 460 },
      data: { label: 'É serviços?', condition: "{{intent}} contem 'servicos'" },
    },
    {
      id: 'ag-serv',
      type: 'agent',
      position: { x: 120, y: 640 },
      data: {
        label: 'Sonia Comercial',
        executionMode: 'agent',
        agentId: agCommercial,
        agentName: 'Sonia Onsmart — Especialista Comercial',
        additionalInstructions: '',
      },
    },
    { id: 'st-c', type: 'stop', position: { x: 120, y: 760 }, data: { label: 'Fim' } },
    {
      id: 'if-d',
      type: 'if-else',
      position: { x: 380, y: 580 },
      data: { label: 'É suporte?', condition: "{{intent}} contem 'suporte'" },
    },
    {
      id: 'tpl-supp',
      type: 'agent',
      position: { x: 120, y: 800 },
      data: {
        label: 'Suporte N1',
        executionMode: 'template',
        templateId: tplSupp,
        templateName: 'Onsmart — Suporte triagem',
        additionalInstructions: '',
      },
    },
    {
      id: 'if-sev',
      type: 'if-else',
      position: { x: 120, y: 920 },
      data: { label: 'Severity alta?', condition: "{{severity}} contem 'alta'" },
    },
    {
      id: 'ag-s2',
      type: 'agent',
      position: { x: -80, y: 1040 },
      data: {
        label: 'Suporte N2',
        executionMode: 'agent',
        agentId: agSupport,
        agentName: 'Sonia Onsmart — Suporte N2',
        additionalInstructions: '',
      },
    },
    { id: 'st-d1', type: 'stop', position: { x: -80, y: 1160 }, data: { label: 'Fim' } },
    { id: 'st-d2', type: 'stop', position: { x: 200, y: 1040 }, data: { label: 'Fim' } },
    {
      id: 'if-e',
      type: 'if-else',
      position: { x: 380, y: 700 },
      data: { label: 'É humano?', condition: "{{intent}} contem 'humano'" },
    },
    {
      id: 'tpl-hand',
      type: 'agent',
      position: { x: 120, y: 820 },
      data: {
        label: 'Handoff',
        executionMode: 'template',
        templateId: tplHand,
        templateName: 'Onsmart — Handoff humano',
        additionalInstructions: '',
      },
    },
    { id: 'st-e', type: 'stop', position: { x: 120, y: 940 }, data: { label: 'Fim' } },
    {
      id: 'tpl-fb',
      type: 'agent',
      position: { x: 380, y: 820 },
      data: {
        label: 'Fallback',
        executionMode: 'template',
        templateId: tplFb,
        templateName: 'Onsmart — Fallback cordial',
        additionalInstructions: '',
      },
    },
    { id: 'st-f', type: 'stop', position: { x: 380, y: 940 }, data: { label: 'Fim' } },
  ]

  const edges: { source: string; target: string; sourceHandle?: string }[] = [
    { source: 'n-start', target: 'n-classifier' },
    { source: 'n-classifier', target: 'if-a' },
    { source: 'if-a', target: 'tpl-cal', sourceHandle: 'true' },
    { source: 'if-a', target: 'if-b', sourceHandle: 'false' },
    { source: 'tpl-cal', target: 'st-a' },
    { source: 'if-b', target: 'tpl-met', sourceHandle: 'true' },
    { source: 'if-b', target: 'if-c', sourceHandle: 'false' },
    { source: 'tpl-met', target: 'st-b' },
    { source: 'if-c', target: 'ag-serv', sourceHandle: 'true' },
    { source: 'if-c', target: 'if-d', sourceHandle: 'false' },
    { source: 'ag-serv', target: 'st-c' },
    { source: 'if-d', target: 'tpl-supp', sourceHandle: 'true' },
    { source: 'if-d', target: 'if-e', sourceHandle: 'false' },
    { source: 'tpl-supp', target: 'if-sev' },
    { source: 'if-sev', target: 'ag-s2', sourceHandle: 'true' },
    { source: 'if-sev', target: 'st-d2', sourceHandle: 'false' },
    { source: 'ag-s2', target: 'st-d1' },
    { source: 'if-e', target: 'tpl-hand', sourceHandle: 'true' },
    { source: 'if-e', target: 'tpl-fb', sourceHandle: 'false' },
    { source: 'tpl-hand', target: 'st-e' },
    { source: 'tpl-fb', target: 'st-f' },
  ]

  return {
    startNodeId: 'n-start',
    nodes,
    edges,
  }
}

async function ensureFlow(
  supabase: SupabaseClient,
  email: string,
  companiesId: string,
  nodesJson: ReturnType<typeof buildFlowPayload>
) {
  const { data: existing } = await supabase
    .from('tb_flows')
    .select('id')
    .eq('companies_id', companiesId)
    .eq('name', FLOW_NAME)
    .maybeSingle()

  const payload = {
    name: FLOW_NAME,
    nodes: nodesJson,
    user_email: email,
    companies_id: companiesId,
  }

  if (existing?.id) {
    const { error } = await supabase.from('tb_flows').update({ nodes: nodesJson }).eq('id', existing.id)
    if (error) throw error
    console.log(`Fluxo atualizado: ${FLOW_NAME} (${existing.id})`)
    return existing.id as string
  }

  const { data, error } = await supabase.from('tb_flows').insert(payload).select('id').single()
  if (error) throw error
  console.log(`Fluxo criado: ${FLOW_NAME} (${data.id})`)
  return data.id as string
}

async function main() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env do BackEnd.')
    process.exit(1)
  }
  if (!OWNER_EMAIL) {
    console.error('Defina OWNER_EMAIL (ou SEED_OWNER_EMAIL) com o e-mail de um usuário admin da empresa.')
    process.exit(1)
  }

  const supabase = createClient(url, key)

  console.log(`Usuário dono: ${OWNER_EMAIL}`)
  const { companiesId } = await getCompanyAndUser(supabase, OWNER_EMAIL)

  console.log('\nTemplates…')
  const tplIds: Record<string, string> = {}
  for (const t of TEMPLATES) {
    tplIds[t.name] = await ensureTemplate(supabase, OWNER_EMAIL, companiesId, t)
  }

  const idClassifier = tplIds['Onsmart — Classificador de intenção']
  const idCal = tplIds['Onsmart — Agendamento Calendly 30min']
  const idMet = tplIds['Onsmart — Metodologia LÍDER (resumo)']
  const idSupp = tplIds['Onsmart — Suporte triagem']
  const idHand = tplIds['Onsmart — Handoff humano']
  const idFb = tplIds['Onsmart — Fallback cordial']
  const idRoleComm = tplIds['Onsmart — Role base Agente Comercial']
  const idRoleSup = tplIds['Onsmart — Role base Agente Suporte N2']

  const commercialPrompt = `Você é a Sonia, consultora da Onsmart.AI. Domina agentes de IA empresarial e metodologia LÍDER.
Tom consultivo, português BR. Não invente números de ROI. Ofereça agendamento quando fizer sentido: ${CALENDLY_URL} (no máximo uma vez por resposta).`

  const supportPrompt = `Você é suporte técnico N2 da Onsmart.AI. Colete sintomas, tentativas e ambiente. Passos seguros. Escalação humana se necessário, sem inventar SLA.`

  console.log('\nAgentes…')
  const agCommercial = await ensureAgent(
    supabase,
    OWNER_EMAIL,
    companiesId,
    'Sonia Onsmart — Especialista Comercial',
    idRoleComm,
    commercialPrompt
  )
  const agSupport = await ensureAgent(
    supabase,
    OWNER_EMAIL,
    companiesId,
    'Sonia Onsmart — Suporte N2',
    idRoleSup,
    supportPrompt
  )

  console.log('\nFluxo…')
  const flowBody = buildFlowPayload({
    tplClassifier: idClassifier,
    tplCal: idCal,
    tplMet: idMet,
    tplSupp: idSupp,
    tplHand: idHand,
    tplFb: idFb,
    agCommercial,
    agSupport: agSupport,
  })

  const flowId = await ensureFlow(supabase, OWNER_EMAIL, companiesId, flowBody)

  console.log('\n✅ Concluído.')
  console.log(`   Fluxo: ${FLOW_NAME}`)
  console.log(`   ID: ${flowId}`)
  console.log('   Associe este fluxo ao número WhatsApp (modo Flow) em Integrações.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
