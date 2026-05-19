# Fluxo Clínica Médica — Atendimento Completo

Script de provisionamento:

```powershell
cd BackEnd
$env:OWNER_EMAIL="admin@suaempresa.com.br"
$env:CRM_INTEGRATION_ID="uuid-do-hubspot"
$env:EMAIL_INTEGRATION_ID="uuid-da-integracao-email"
$env:CALENDLY_INTEGRATION_ID="uuid-da-integracao-calendly"
$env:TEAM_NOTIFY_EMAIL="recepcao@clinica.com.br"
$env:TEAM_NOTIFY_WHATSAPP="5511999999999"
npx tsx scripts/seed-medical-clinic-demo.ts
```

O que o seed cria:

- 6 agentes especialistas
- 1 fluxo principal e subfluxos salvos em `tb_flows`
- uso dos blocos `crm_contact`, `appointment`, `document_intake`, `human_handoff`
- caminhos de agendamento, remarcação, cancelamento, documentos, humano, retorno e follow-up

Especialidades com agendamento automático neste ambiente:

- **Clínica geral** (`clinica_geral`)
- **Cardiologia** (`cardiologia`)

O paciente vê apenas essas duas opções no menu de triagem. Se mencionar outra especialidade, o fluxo informa que o agendamento automático está disponível somente para Clínica geral e Cardiologia e solicita uma nova escolha. Não há fallback implícito para outras especialidades.

Observações:

- O provider de agenda é sempre Calendly real. Configure uma integração Calendly ativa antes de provisionar ou informe `CALENDLY_INTEGRATION_ID`.
- Configure mapeamentos para `clinica_geral` e `cardiologia` na UI de integrações antes de ativar o fluxo em produção.
- Se `TEAM_NOTIFY_WHATSAPP` for informado, os blocos de handoff humano também notificam a equipe por WhatsApp usando a integração oficial da clínica.
- Se `CRM_INTEGRATION_ID` ou `EMAIL_INTEGRATION_ID` ficarem vazios, o fluxo é criado mesmo assim e pode ser ajustado depois no editor visual.
- O fluxo foi pensado para WhatsApp-first, mas a estrutura de contexto e os blocos podem ser reaproveitados em outros segmentos.
