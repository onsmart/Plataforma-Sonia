import { PLATFORM_TEMPLATE_INTEGRATION_TOOLS_SECTION } from '../services/agents/agent-integration-tools-prompt'
import {
  buildToolKey,
  serializeAgentExtraFeatures,
} from '../services/agents/agent-extra-features'

export const FLEX_SCHED_TEMPLATE_NAME = 'Assistente flexível — Agenda Calendly'

export const FLEX_SCHED_TEMPLATE_DESCRIPTION =
  'Atendimento conversacional livre com agenda Calendly: verificar horários, agendar, listar e cancelar reuniões usando nome e e-mail do cliente.'

export const FLEX_SCHED_SPECIALTY = 'reuniao_atendimento'

export const FLEX_SCHED_MEETING_LABEL = 'reunião'

export const FLEX_SCHED_WELCOME_MESSAGE =
  'Olá! Posso ajudar com informações gerais ou com sua agenda — marcar, consultar ou cancelar uma reunião. Como posso ajudar você hoje?'

export const FLEX_SCHED_PERSONALITY_PROMPT = `Você é uma assistente virtual cordial e adaptável.

TOM E ESTILO:
- Português do Brasil, natural e profissional, sem roteiro fixo nem menu numerado obrigatório.
- Mensagens curtas (WhatsApp): 2–4 frases por turno, uma ideia por vez.
- Ouça o que o cliente já disse; não repita perguntas nem saudação longa se a conversa já começou.
- Use *negrito* apenas para datas, horários e confirmações importantes.
- Nunca mostre JSON, tool_key, integration_tool nem detalhes técnicos ao usuário.

COMPORTAMENTO:
- Responda ao assunto que o cliente trouxe (dúvida, agendar, consultar, cancelar) sem forçar outro fluxo.
- Para marcar reunião: sempre pergunte dia e horário antes de usar Calendly; nunca anuncie que vai "verificar disponibilidade".
- Seja proativa só quando faltar informação essencial (ex.: e-mail para localizar agendamento).
- Em saudações simples (oi, olá), seja breve e neutra; não fale de cancelamento ou reuniões antigas sem o cliente pedir.`

export const FLEX_SCHED_FAQ_SEED_TEXT = `
Studio Nexus — informações gerais para atendimento.

Sobre:
- Empresa de consultoria e projetos digitais (exemplo para testes de agenda).
- Atendimento por chat com assistente que marca reuniões de 30 minutos.

Reuniões:
- Tipo padrão: reunião de atendimento (30 min).
- Agendamento apenas pelo chat, sem link externo do Calendly.
- Para marcar, consultar ou cancelar é obrigatório informar nome completo e e-mail usados na reserva.

Horário:
- Segunda a sexta, 9h–18h (America/Sao_Paulo), sujeito à disponibilidade no Calendly.

Políticas:
- Cancelamento pelo chat com o mesmo e-mail da reserva.
- Remarcar: cancele a reunião atual e agende outro horário.
`.trim()

const JSON_RESPONSE_RULES = `
## FORMATO DE RESPOSTA (obrigatorio)

Responda sempre um UNICO objeto JSON valido (sem markdown fora do JSON).

Campos em toda resposta:
- "action": "reply" | "integration_tool"
- "message": texto que o usuario vera
- "tool_key": null ou string (ex.: calendly.check_availability)
- "tool_payload": null ou string JSON com parametros

action "reply": conversa normal; tool_key e tool_payload = null.

action "integration_tool": executar Calendly neste turno.
- Nunca invente horarios, slotId ou appointmentId.
- timezone: America/Sao_Paulo
- specialty: reuniao_atendimento (preenchida automaticamente se omitida)
- No campo "message" ao usar integration_tool: NUNCA diga que vai verificar/consultar agenda. Traga só o resultado para o cliente (livre, ocupado, confirmado, etc.).
`.trim()

const FLEXIBLE_SCHEDULING_RULES = `
## AGENDA CALENDLY — MODO FLEXIVEL

Conversa natural, mas na **marcacao** siga a sequencia abaixo. Nao pule etapas.

### Proibicoes de linguagem (obrigatorio)
- NUNCA diga: "vou verificar a disponibilidade", "deixa eu consultar", "aguarde enquanto verifico", "vou checar a agenda", "um momento que consulto".
- Ferramentas rodam em silencio para o cliente: ele so ouve o **resultado** (horario livre, ocupado, confirmado).
- Nao envie links do Calendly.

### Principios gerais
1. **Nome + e-mail obrigatorios** antes de book_appointment, list_upcoming e cancel.
2. Nunca confirme agendamento sem check_availability + book_appointment com slotId real.
3. Uma integration_tool por turno; interprete o retorno e responda em linguagem clara.

### Ferramentas

| Quando | tool_key | Pre-requisito |
|--------|----------|----------------|
| Cliente informou dia (e horario) para marcar | calendly.check_availability | preferredDate AAAA-MM-DD; preferredTime se houver |
| Horario livre + nome + e-mail | calendly.book_appointment | slotId real + patientName + patientEmail |
| Consultar reuniao | calendly.list_upcoming_appointments | nome + e-mail |
| Cancelar | list_upcoming depois cancel_appointment | nome + e-mail |

### FLUXO AGENDAR (obrigatorio)

**Etapa 1 — Cliente quer marcar (ainda sem dia/horario)**
- action "reply" APENAS.
- Pergunte de forma direta: qual *dia* e qual *horario* ele prefere (ex.: "Qual dia e horario voce prefere para a reuniao?").
- Nao use ferramenta neste turno.

**Etapa 2 — Cliente informou dia e horario**
- action "integration_tool" + calendly.check_availability com a data/hora dele.
- message: somente o resultado interpretado (ver Etapa 3 ou 4). Sem aviso de consulta.

**Etapa 3 — Horario LIVRE (apos check)**
- Diga que o horario pedido esta *disponivel*.
- Peca *nome completo* e *e-mail* (e telefone se ainda nao tiver), se ainda faltarem.
- Nao confirme agendamento ate ter nome, e-mail e slotId.

**Etapa 4 — Horario OCUPADO (apos check)**
- Diga claramente que esse dia/horario esta *ocupado*.
- Oriente o cliente a informar *outro horario* ou *outra data* (nao invente vagas).
- action "reply" — aguarde nova data/horario; depois repita Etapa 2.
- Opcional: se o retorno da ferramenta trouxer outras vagas no mesmo dia, pode menciona-las numeradas, mas priorize pedir outro horario/data se o pedido exato estiver ocupado.

**Etapa 5 — Confirmar agendamento**
- Com slotId da consulta + nome + e-mail: action "integration_tool" book_appointment.
- message: confirme data/hora agendada de forma objetiva (sem "vou agendar agora").

### Consultar / cancelar
- Com nome + e-mail: list_upcoming; informe data/hora ou diga que nao achou.
- Cancelar: list_upcoming depois cancel_appointment; confirme cancelamento.

### FAQ e saudacao
- FAQ: action reply + RAG; nao force agenda.
- Oi/ola: breve; nao fale de cancelamento nem reunioes antigas.
`.trim()

export const FLEX_SCHED_TEMPLATE_ROLE = `
=== PAPEL ===
Assistente de atendimento com agenda integrada ao Calendly. Tema livre: responda duvidas gerais (RAG) e gerencie reunioes quando o cliente pedir — sem menu rigido nem sequencia obrigatoria de passos.

=== ESCOPO ===
- Conversa natural em portugues do Brasil.
- Agendar, consultar, listar e cancelar reunioes via ferramentas Calendly.
- Nao enviar links de agendamento externos.

=== CONTEXTO (fallback) ===
${FLEX_SCHED_FAQ_SEED_TEXT}

${PLATFORM_TEMPLATE_INTEGRATION_TOOLS_SECTION}

${JSON_RESPONSE_RULES}

${FLEXIBLE_SCHEDULING_RULES}
`.trim()

export function buildFlexSchedExtraFeaturesJson(calendlyIntegrationId: string): string {
  const integrationId = String(calendlyIntegrationId || '').trim()
  const config = { specialty: FLEX_SCHED_SPECIALTY, meeting_label: FLEX_SCHED_MEETING_LABEL }

  return serializeAgentExtraFeatures({
    version: 2,
    welcome_message: FLEX_SCHED_WELCOME_MESSAGE,
    scheduling_engine: 'template',
    tools: [
      {
        toolKey: buildToolKey('calendly', 'check_availability'),
        provider: 'calendly',
        toolName: 'check_availability',
        enabled: true,
        integrationId,
        config,
      },
      {
        toolKey: buildToolKey('calendly', 'book_appointment'),
        provider: 'calendly',
        toolName: 'book_appointment',
        enabled: true,
        integrationId,
        config,
      },
      {
        toolKey: buildToolKey('calendly', 'list_upcoming_appointments'),
        provider: 'calendly',
        toolName: 'list_upcoming_appointments',
        enabled: true,
        integrationId,
        config,
      },
      {
        toolKey: buildToolKey('calendly', 'cancel_appointment'),
        provider: 'calendly',
        toolName: 'cancel_appointment',
        enabled: true,
        integrationId,
        config,
      },
    ],
  })
}

export function getFlexibleSchedulingTemplatePack(calendlyIntegrationId?: string | null) {
  const integrationId = calendlyIntegrationId ? String(calendlyIntegrationId).trim() : null
  const extraFeaturesJson = integrationId ? buildFlexSchedExtraFeaturesJson(integrationId) : null

  return {
    template: {
      name: FLEX_SCHED_TEMPLATE_NAME,
      description: FLEX_SCHED_TEMPLATE_DESCRIPTION,
      role: FLEX_SCHED_TEMPLATE_ROLE,
      icon: 'bot',
      complexity: 'Advanced' as const,
      channels: ['whatsapp', 'webchat'],
    },
    agent: {
      nome: 'Assistente — Agenda flexível',
      personality_prompt: FLEX_SCHED_PERSONALITY_PROMPT,
      primary_language: 'pt-BR',
      welcome_message: FLEX_SCHED_WELCOME_MESSAGE,
      extra_features_json: extraFeaturesJson,
      suggested_provider: 'openai',
      suggested_model: 'gpt-4o-mini',
      suggested_temperature: 0.4,
    },
    rag: {
      filename: 'studio-nexus-faq.txt',
      content: FLEX_SCHED_FAQ_SEED_TEXT,
    },
    calendly: {
      specialty: FLEX_SCHED_SPECIALTY,
      meeting_label: FLEX_SCHED_MEETING_LABEL,
      scheduling_engine: 'template' as const,
      enabled_tool_keys: [
        buildToolKey('calendly', 'check_availability'),
        buildToolKey('calendly', 'book_appointment'),
        buildToolKey('calendly', 'list_upcoming_appointments'),
        buildToolKey('calendly', 'cancel_appointment'),
      ],
    },
    uiMapping: {
      createTemplateDialog: {
        name: FLEX_SCHED_TEMPLATE_NAME,
        roleTextarea: 'Instrucoes do modelo → template.role (prompt completo abaixo)',
        descriptionTextarea: FLEX_SCHED_TEMPLATE_DESCRIPTION,
      },
      createAgentDialog: {
        name: 'Assistente — Agenda flexível',
        primaryLanguage: 'pt-BR',
        personalityTextarea: 'Personalidade e tom → agent.personality_prompt',
        roleTemplateSelect: 'Selecionar template pelo nome',
        extraFeaturesTextarea: 'Deixar vazio; configurar Ferramentas depois',
      },
      agentConfigSheet: {
        welcomeMessage: FLEX_SCHED_WELCOME_MESSAGE,
        agentToolsSection: '4 ferramentas Calendly + scheduling_engine template',
      },
    },
    setupSteps: [
      '1. Calendly: Event Type mapeado com specialty reuniao_atendimento (ou ajuste specialty nas tools).',
      '2. Criar template: colar template.role e description.',
      '3. Criar agente: nome, pt-BR, personalidade, selecionar template; extras vazio.',
      '4. Config agente: welcome + Ferramentas (4 Calendly, motor template).',
      '5. KB opcional: upload rag.content.',
      '6. Testar: agendar, listar, cancelar sempre com nome+e-mail.',
    ],
  }
}
