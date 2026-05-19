# Configuração das integrações da Clínica: HubSpot e Calendly

Este guia concentra o que precisa estar configurado para o fluxo `Clinica Medica - Atendimento Completo` operar sem cair em handoff por erro de integração.

## 1. HubSpot

### 1.1 Private App

No HubSpot:

1. `Configurações -> Integrações -> Private Apps`
2. Criar um app novo ou editar o existente
3. Copiar o `Access token` da aba `Auth`

Escopos obrigatórios:

- `crm.objects.contacts.read`
- `crm.objects.contacts.write`
- `crm.objects.deals.read`
- `crm.schemas.contacts.read`

### 1.2 Salvar na plataforma

Na plataforma:

1. `Configurações -> Integrações -> HubSpot`
2. Colar o `Access token`
3. Salvar
4. Clicar em `Testar conexão`

### 1.3 Propriedades opcionais recomendadas

O fluxo já funciona sem elas, mas o backend tenta preencher estas propriedades quando existem:

- `lead_source`
- `last_flow_channel`

Recomendação:

- criar ambas no objeto `Contact`
- tipo simples de texto / single-line text

Sem isso, o backend faz fallback seguro, mas os logs ficam com warning de propriedade inexistente.

### 1.4 Campos de contato usados pelo fluxo

Campos principais:

- `firstname`
- `lastname`
- `email`
- `phone`

Campos opcionais já suportados:

- `cpf`
- `birthdate`

## 2. Calendly

### 2.1 Pré-requisitos

Você precisa de:

- um `Personal Access Token (PAT)` do Calendly
- pelo menos um `event type` ativo para cada especialidade que vai ser agendada
- uma URL pública HTTPS para webhook

Exemplo de base pública:

- `https://webhook.onsmart.ai`

O callback final é montado pela plataforma como:

- `/calendar/webhook/:integrationId`

### 2.2 Salvar a integração

Na plataforma:

1. `Configurações -> Integrações -> Calendly`
2. Colar o `PAT`
3. Informar o email da conta
4. Confirmar timezone, normalmente `America/Sao_Paulo`
5. Informar a `Webhook base URL`
6. Salvar
7. Clicar em `Testar conexão`
8. Clicar em `Registrar webhook`

### 2.3 Event type mappings obrigatórios

O fluxo clínico usa especialidade estruturada. Para evitar `event_type_mapping_not_found`, salve mapeamentos para as especialidades configuradas neste ambiente.

**Especialidades com agendamento automático neste ambiente:**

- `clinica_geral`
- `cardiologia`

> O fluxo só aceita e apresenta ao paciente essas duas opções. Se o paciente mencionar qualquer outra especialidade (dermatologia, ginecologia, etc.), a plataforma responde informando que o agendamento automático está disponível apenas para Clínica geral e Cardiologia e solicita uma nova escolha. Não há mapeamento implícito para outras especialidades.

Na UI do Calendly da plataforma:

1. abrir a integração
2. carregar os `event types`
3. na seção `Mapeamento por especialidade`
4. adicionar uma regra por especialidade
5. escolher o `event type` correspondente
6. salvar os mapeamentos

Campos úteis por regra:

- `specialty`
- `eventTypeUri`
- `eventTypeName`
- `doctor` opcional
- `unit` opcional
- `consultationType` opcional
- `timezone` opcional

### 2.4 Como o backend resolve o mapeamento

A ordem é:

1. procurar em `event_type_mappings`
2. se não achar, tentar fallback por nome/slug/descrição do event type
3. se não achar nada, lançar `event_type_mapping_not_found`

Então, para produção, o certo é usar sempre mapeamento salvo.

## 3. Checklist mínimo para o fluxo da Clínica

- HubSpot salvo e testado
- Calendly salvo e testado
- webhook do Calendly registrado
- integração Calendly marcada como ativa
- integração Calendly marcada como padrão, se for a principal da empresa
- mapeamento salvo para:
  - `clinica_geral`
  - `cardiologia`
- seed reaplicado com `npm run seed:medical-clinic`

## 4. Endpoints úteis

Calendly:

- `GET /calendar/integrations`
- `POST /calendar/integrations`
- `PUT /calendar/integrations/:id`
- `POST /calendar/integrations/:id/test`
- `GET /calendar/integrations/:id/event-types`
- `POST /calendar/integrations/:id/mappings`
- `POST /calendar/integrations/:id/webhook/sync`

HubSpot:

- `POST /crm/integrations`
- `POST /crm/integrations/test`
- `POST /crm/integrations/:id/test`

## 5. Sinais de que algo ainda está faltando

Se aparecer:

- `event_type_mapping_not_found`
  - faltam mapeamentos do Calendly

- `Webhook base URL invalida` / `HTTPS`
  - a URL do webhook do Calendly não está pública/correta

- `PROPERTY_DOESNT_EXIST` para `lead_source` ou `last_flow_channel`
  - faltam propriedades customizadas no HubSpot

- `crm schema access partial`
  - revisar scopes do Private App do HubSpot
