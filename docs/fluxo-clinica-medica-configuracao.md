# Fluxo Clínica Médica — Atendimento Completo

Script de provisionamento:

```powershell
cd BackEnd
$env:OWNER_EMAIL="admin@suaempresa.com.br"
$env:CRM_INTEGRATION_ID="uuid-do-hubspot"
$env:EMAIL_INTEGRATION_ID="uuid-da-integracao-email"
$env:TEAM_NOTIFY_EMAIL="recepcao@clinica.com.br"
npx tsx scripts/seed-medical-clinic-demo.ts
```

O que o seed cria:

- 6 agentes especialistas
- 1 fluxo salvo em `tb_flows`
- uso dos blocos `crm_contact`, `appointment`, `document_intake`, `human_handoff`
- caminhos de agendamento, remarcação, cancelamento, documentos, humano, retorno e follow-up

Observações:

- O provider de agenda da v1 é `mock_calendly`.
- A tabela opcional para persistir a agenda mock está em `docs/sql/2026-05-13-add-flow-mock-appointments.sql`.
- Se `CRM_INTEGRATION_ID` ou `EMAIL_INTEGRATION_ID` ficarem vazios, o fluxo é criado mesmo assim e pode ser ajustado depois no editor visual.
- O fluxo foi pensado para WhatsApp-first, mas a estrutura de contexto e os blocos podem ser reaproveitados em outros segmentos.
