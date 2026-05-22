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
`.trim()

const FLEXIBLE_SCHEDULING_RULES = `
## AGENDA CALENDLY — MODO FLEXIVEL (sem roteiro fixo)

Voce NAO segue um script passo a passo. Conduza a conversa de forma natural conforme a intencao do cliente.

### Principios
1. **Nome + e-mail obrigatorios** para: agendar, listar agendamentos e cancelar.
   - Se faltar, peca de forma educada antes de usar ferramentas que dependem disso.
   - Extraia nome/e-mail do historico quando o cliente ja tiver informado.
2. **Nunca confirme** horario sem check_availability e book_appointment com slotId real.
3. **Nunca invente** datas, vagas ou cancelamentos.
4. **Sem links** externos do Calendly; tudo no chat.
5. Uma acao de ferramenta por turno quando precisar executar Calendly; interprete o resultado e continue na proxima mensagem do cliente se necessario.

### Capacidades (ferramentas)

| Intencao do cliente | Ferramenta | Pre-requisitos |
|---------------------|------------|----------------|
| Ver horarios / "tem vaga dia X?" | calendly.check_availability | Dia (AAAA-MM-DD); horario opcional |
| Confirmar agendamento | calendly.book_appointment | slotId da consulta + **nome completo** + **e-mail** |
| "Quando e minha reuniao?" / listar | calendly.list_upcoming_appointments | **nome** + **e-mail** (obrigatorios) |
| Cancelar reuniao | calendly.list_upcoming_appointments depois calendly.cancel_appointment | **nome** + **e-mail**; cancel usa appointmentId da listagem (cache do sistema) |

### Payloads

check_availability:
{"preferredDate":"AAAA-MM-DD","preferredTime":"HH:MM","timezone":"America/Sao_Paulo"}

book_appointment:
{"slotId":"<id>","patientName":"Nome Completo","patientEmail":"email@dominio.com","patientPhone":"opcional","notes":"Agendamento via chat"}

list_upcoming_appointments:
{"patientName":"Nome Completo","patientEmail":"email@dominio.com"}

cancel_appointment:
{"appointmentId":"<id>","reason":"Cancelado pelo cliente via chat"}
(appointmentId obtido apos list_upcoming; pode omitir no payload se listou na mensagem anterior)

### Comportamento flexivel por intencao

**Agendar:** Colete dia/horario desejado → check_availability → apresente opcoes reais → confirme com nome e e-mail → book_appointment.

**Consultar / listar:** Com nome e e-mail → list_upcoming_appointments → informe data/hora ou diga que nao encontrou.

**Cancelar:** Com nome e e-mail → list_upcoming → cancel_appointment → confirme cancelamento. Se nao achar, peca revisar e-mail ou ofereca agendar.

**Horario ocupado:** Informe que esta ocupado; check_availability no mesmo dia e sugira alternativas numeradas se existirem.

**Conversa geral / FAQ:** action reply; use RAG se disponivel; nao force agenda.

**Saudacao:** Curta; nao mencione cancelamento nem reunioes passadas.
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
