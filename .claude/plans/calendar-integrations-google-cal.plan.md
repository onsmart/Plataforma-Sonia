# Plano: Integrações de Agenda — Google Calendar e Cal.com

Status: **rascunho** — não executado

---

## Contexto e base existente

A plataforma já tem Calendly integrado com arquitetura extensível:
- Interface `AppointmentProvider` (getAvailability / book / cancel / reschedule)
- Tabela `tb_integrations` com coluna `provider` para distinguir ferramentas
- Padrão de serviços: `types → client → repository → manager → provider`
- Webhook com validação HMAC por middleware
- Nó de fluxo `appointment` agnóstico ao provedor (resolve pelo `provider` string)
- Frontend: `{Provider}IntegrationSheet.tsx` + catálogo de integrações

Adicionar um novo provedor = implementar a interface + plugar no catálogo.

---

## Cal.com

### Avaliação de complexidade: BAIXA-MÉDIA (~2–3 dias)

Cal.com é praticamente um "Calendly open-source". A API v2 é quase idêntica em conceito:
- Autenticação via **API Key** (igual ao PAT do Calendly — sem OAuth)
- Webhooks com **HMAC-SHA256** (mesmo mecanismo já implementado)
- Recursos: event types, slots disponíveis, criação de booking, cancelamento
- Suporta nuvem (`cal.com`) e auto-hospedagem (cliente pode ter instância própria)

**Diferenças em relação ao Calendly:**
1. API base URL pode variar (cloud: `https://api.cal.com/v2` ou instância própria)
2. Modelo de dados ligeiramente diferente (bookings vs invitees, mas conceito igual)
3. Webhook events: `BOOKING_CREATED`, `BOOKING_RESCHEDULED`, `BOOKING_CANCELLED`
4. Não há "organization scope" — autenticação é sempre por usuário/API key

**Reaproveitamento estimado do código Calendly: ~70%**

---

### Fase 1 — Backend Cal.com

#### 1.1 — Serviço de integração

Criar `BackEnd/src/services/integrations/calcom/`:

```
calcom/
├── calcom.types.ts       # CalComEventType, CalComSlot, CalComBooking, CalComWebhookPayload
├── calcom.client.ts      # HTTP client para api.cal.com/v2 (ou instância própria)
├── calcom.repository.ts  # CRUD em tb_integrations (provider = 'calcom')
├── calcom.manager.ts     # Lógica de negócio (testar, salvar, webhooks)
├── calcom.provider.ts    # Implementa AppointmentProvider
└── index.ts
```

**`calcom.types.ts` — principais interfaces:**
```typescript
interface CalComConfig {
  apiKey: string
  baseUrl: string          // 'https://api.cal.com/v2' ou instância própria
  webhookSecret: string
  defaultTimezone: string
  eventTypeMappings: CalComEventTypeMapping[]
  status: 'connected' | 'pending' | 'error'
}

interface CalComEventType {
  id: number
  slug: string
  title: string
  length: number           // duração em minutos
  schedulingType: 'ROUND_ROBIN' | 'COLLECTIVE' | null
}

interface CalComSlot {
  time: string             // ISO 8601
  attendees?: number
}

interface CalComBooking {
  id: number
  uid: string
  title: string
  startTime: string
  endTime: string
  status: 'ACCEPTED' | 'PENDING' | 'CANCELLED'
  attendees: Array<{ email: string; name: string }>
}

interface CalComWebhookPayload {
  triggerEvent: 'BOOKING_CREATED' | 'BOOKING_RESCHEDULED' | 'BOOKING_CANCELLED'
  payload: {
    bookingId: number
    uid: string
    startTime: string
    endTime: string
    attendees: Array<{ email: string; name: string; phone?: string }>
    organizer: { email: string; name: string }
    eventType: { id: number; title: string; slug: string }
    status: string
  }
}
```

**`calcom.client.ts` — endpoints principais:**
```typescript
class CalComApiClient {
  // autenticação: header 'Authorization: Bearer {apiKey}'
  getCurrentUser(): Promise<CalComUser>
  listEventTypes(): Promise<CalComEventType[]>
  getSlots(eventTypeId: number, startTime: string, endTime: string): Promise<CalComSlot[]>
  createBooking(input: CreateBookingInput): Promise<CalComBooking>
  cancelBooking(bookingId: number, reason?: string): Promise<void>
  getBooking(bookingId: number): Promise<CalComBooking>
  // webhooks
  createWebhook(input: CreateWebhookInput): Promise<CalComWebhook>
  listWebhooks(): Promise<CalComWebhook[]>
  deleteWebhook(webhookId: number): Promise<void>
}
```

#### 1.2 — Webhook middleware

Criar `BackEnd/src/middleware/calcom-webhook.middleware.ts`:
```
Assinatura: header 'X-Cal-Signature-256' = HMAC-SHA256(secret, rawBody)
```
Mesmo padrão do `calendly-webhook.middleware.ts`.

#### 1.3 — Plugar no provider resolver

Em `BackEnd/src/services/appointments/index.ts`:
```typescript
if (provider === 'calcom') {
  return new RealCalComProvider(integrationId)
}
```

#### 1.4 — Rotas e controller

Em `calendar.routes.ts` e `calendar.controller.ts`, adicionar endpoints análogos ao Calendly:
```
GET    /calcom/integrations
POST   /calcom/integrations
PUT    /calcom/integrations/:id
DELETE /calcom/integrations/:id
POST   /calcom/integrations/:id/test
POST   /calcom/integrations/:id/webhook/sync
POST   /calcom/integrations/:id/mappings
POST   /calcom/webhook/:id          (público, validação HMAC)
```

---

### Fase 2 — Frontend Cal.com

#### 2.1 — `CalComIntegrationSheet.tsx`

Espelhar `CalendlyIntegrationSheet.tsx` com ajustes:
- **Tab Credenciais:** API Key + Base URL (campo extra para instâncias próprias) + Timezone
- **Tab Mapeamentos:** Lista de event types com mapeamento por specialty
- **Tab Webhook:** URL de callback + status + botão "Sincronizar"

#### 2.2 — Catálogo de integrações

Em `integration-catalog.ts`:
```typescript
INTEGRATION_SECTION_VISIBILITY.calcom = true
```

Em `Integrations.tsx`: adicionar seção Cal.com ao lado da Calendly.

---

### Fase 3 — Banco de dados

Nenhuma migration necessária. `tb_integrations` já suporta qualquer `provider`. O JSONB `metadata` armazena a config específica.

Atualizar `SUPABASE_SCHEMA_REFERENCE.md`: documentar valores válidos de `provider` ('calendly', 'calcom').

---

### Esforço Cal.com

| Fase | Estimativa |
|------|------------|
| 1.1 — Serviço backend | 6h |
| 1.2 — Webhook middleware | 1h |
| 1.3 — Provider resolver | 0.5h |
| 1.4 — Rotas + controller | 2h |
| 2.1 — Frontend Sheet | 3h |
| 2.2 — Catálogo | 0.5h |
| 3 — Docs DB | 0.5h |
| **Total** | **~13h (~2 dias)** |

---

## Google Calendar

### Avaliação de complexidade: ALTA (~4–6 dias)

Google Calendar é fundamentalmente diferente do Calendly/Cal.com. Não é uma ferramenta de "agendamento por link" — é um calendário. Para construir agendamento de consultas em cima dele, é preciso:

1. **OAuth 2.0 com refresh tokens** (muito mais complexo que PAT)
2. **Lógica de disponibilidade customizada** (não existe "slots disponíveis" nativo — precisa calcular a partir de eventos existentes e horários de trabalho)
3. **Google Cloud Project** com API Calendar habilitada + OAuth consent screen
4. **Push notifications** (substituto do webhook tradicional — usa canal de notificação por HTTP)
5. **Criação de eventos** como mecanismo de booking (sem "invitee" nativo)

### Por que é mais complexo:

| Aspecto | Calendly/Cal.com | Google Calendar |
|---------|-----------------|-----------------|
| Autenticação | API Key / PAT (estático) | OAuth 2.0 — access token (1h) + refresh token |
| Token refresh | Não precisa | Sim — `POST /token` com `grant_type=refresh_token` |
| Booking | API nativa (`createInvitee`) | Criar evento + convidar participante |
| Disponibilidade | API nativa (`getSlots`) | Calcular via Freebusy API + working hours |
| Webhooks | HMAC direto | Push Notifications — canal com expiração (max 30 dias) — precisa renovar |
| Configuração | Usuário cola API key | Usuário autoriza via OAuth (redirect flow) |
| Revogação | Usuário deleta key | Google pode revogar token; app precisa detectar e reautenticar |

### Fases de implementação

#### Fase 1 — Google Cloud Project (pré-requisito externo)

1. Criar projeto no Google Cloud Console
2. Habilitar Google Calendar API
3. Configurar OAuth consent screen (nome app, domínios autorizados, escopos)
4. Criar credenciais OAuth 2.0:
   - Tipo: Web application
   - Redirect URI: `{BACKEND_PUBLIC_URL}/google-calendar/oauth/callback`
5. Anotar `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`
6. Configurar no `.env` do backend

**Escopos necessários:**
```
https://www.googleapis.com/auth/calendar.readonly
https://www.googleapis.com/auth/calendar.events
```

#### Fase 2 — Backend OAuth 2.0 (mais crítica)

Criar `BackEnd/src/services/integrations/google-calendar/`:
```
google-calendar/
├── google-calendar.types.ts
├── google-calendar.client.ts       # OAuth2 client + Calendar API
├── google-calendar.oauth.ts        # Fluxo authorization code → tokens
├── google-calendar.repository.ts   # Armazena tokens criptografados
├── google-calendar.manager.ts
├── google-calendar.provider.ts     # Implementa AppointmentProvider
└── index.ts
```

**Fluxo OAuth:**
```
1. Frontend chama GET /google-calendar/oauth/start
   → Backend gera authorization URL com state (CSRF) e redirect_uri
   → Retorna URL para frontend

2. Frontend abre popup ou redirect para Google
   → Usuário autoriza escopos

3. Google redireciona para GET /google-calendar/oauth/callback?code=...&state=...
   → Backend valida state (anti-CSRF)
   → Troca code por access_token + refresh_token
   → Armazena tokens criptografados em tb_integrations
   → Redireciona para frontend com sucesso

4. Uso: access_token para chamadas (expira em 1h)
   → Ao receber 401, usar refresh_token para obter novo access_token
   → Atualizar tb_integrations com novo token
```

**Armazenamento seguro de tokens:**
```typescript
// tb_integrations.metadata (JSONB)
{
  access_token: string      // criptografado em repouso (AES-256 ou pgcrypto)
  refresh_token: string     // criptografado em repouso
  token_expiry: ISO 8601
  scope: string
  google_user_email: string
  google_calendar_id: string  // qual calendário usar (primary ou específico)
  working_hours: WorkingHours
  push_channel_id: string
  push_channel_expiry: ISO 8601
  event_type_mappings: GoogleCalMapping[]
}
```

#### Fase 3 — Lógica de disponibilidade

`getAvailability()` via Google Calendar não é trivial:

```
1. GET /calendars/{calendarId}/events
   → Listar eventos no intervalo (ocupados)

2. POST /freeBusy
   → Retorna blocos de tempo ocupado para um ou mais calendários

3. Cruzar com "working hours" configurados pelo usuário
   (ex: seg-sex 9h-18h, exceto feriados)

4. Gerar lista de slots livres (ex: a cada 30/60 min)
   → Slots = working hours - blocos ocupados
```

Esta lógica não existe no Calendly/Cal.com (eles fornecem prontamente via API). Precisa ser implementada do zero.

#### Fase 4 — Booking via Events

Não há `createInvitee`. Booking = criar evento no Google Calendar:
```typescript
POST /calendars/{calendarId}/events
{
  summary: `Consulta — ${patientName}`,
  start: { dateTime: slot.start, timeZone },
  end: { dateTime: slot.end, timeZone },
  attendees: [
    { email: doctorEmail },
    { email: patientEmail }
  ],
  conferenceData: {  // opcional: Google Meet
    createRequest: { requestId: uuid }
  }
}
```

#### Fase 5 — Push Notifications (substituto de webhook)

Google não faz POST para seu servidor quando evento muda. Usa "watch" + canal HTTP:

```typescript
// Criar canal de notificação (expira em max 30 dias)
POST /calendars/{calendarId}/events/watch
{
  id: uuid,                          // identificador do canal
  type: "web_hook",
  address: "{BACKEND_PUBLIC_URL}/google-calendar/push/:channelId",
  token: hmacToken,
  expiration: Date.now() + 30 * 24 * 60 * 60 * 1000
}
```

Implicações:
- Precisa de **job agendado** para renovar canais antes de expirarem (PM2 cron ou `node-cron`)
- Google envia `POST {address}` com headers X-Goog-Channel-ID, X-Goog-Resource-State
- Receber notificação → buscar eventos modificados via `syncToken` (incremental sync)

#### Fase 6 — Frontend

Diferente do Calendly: não há campo "colar API key". É um botão "Conectar com Google":

```tsx
// GoogleCalendarIntegrationSheet.tsx
<Button onClick={startOAuthFlow}>
  <GoogleIcon />
  Conectar com Google Calendar
</Button>
// Abre popup OAuth → retorna ao sheet com sucesso/erro
```

Após conexão:
- Tab configurações: timezone, calendar ID, horários de trabalho (seg-sex, horários)
- Tab mapeamentos: mapear tipos de consulta (specialty) para agenda/evento padrão
- Tab status: último sync, canal de push e validade

---

### Esforço Google Calendar

| Fase | Estimativa |
|------|------------|
| 1 — Google Cloud setup | 2h (externo) |
| 2 — OAuth2 flow + token storage | 6h |
| 3 — Lógica de disponibilidade | 5h |
| 4 — Booking via Events | 3h |
| 5 — Push notifications + renovação | 4h |
| 6 — Frontend Sheet (OAuth flow) | 4h |
| Catálogo + rotas | 1h |
| **Total** | **~25h (~4–5 dias)** |

---

## Comparativo final

| | Cal.com | Google Calendar |
|---|---------|----------------|
| Complexidade | Baixa-Média | Alta |
| Esforço estimado | ~13h (~2 dias) | ~25h (~4–5 dias) |
| Pré-requisitos externos | Nenhum | Google Cloud Project + OAuth consent |
| Autenticação | API Key (igual ao Calendly) | OAuth 2.0 com refresh tokens |
| Disponibilidade de slots | API nativa | Precisa calcular (Free/Busy + working hours) |
| Booking | API nativa | Criar evento + attendees |
| Webhooks | HMAC (igual ao Calendly) | Push Notifications com renovação periódica |
| Auto-hospedagem | Sim (para clientes com Cal.com próprio) | Não |
| Reaproveitamento do código Calendly | ~70% | ~30% |
| Risco de regressão | Baixo | Médio (OAuth + push notifications) |

**Recomendação de ordem:** Cal.com primeiro (menor risco, entrega mais rápida, mesmo modelo). Google Calendar em sprint separada, especialmente porque requer criação de projeto Google Cloud externo e tem lógica de disponibilidade customizada.

---

## Ordem de execução recomendada

1. **Cal.com** — integração rápida, baixo risco, aproveita 70% do Calendly existente
2. **Google Calendar** — integração completa com OAuth, lógica de slots e push notifications

---

## Arquivos que serão criados/alterados

| Arquivo | Cal.com | Google Calendar |
|---------|---------|----------------|
| `BackEnd/src/services/integrations/calcom/` | novo | — |
| `BackEnd/src/services/integrations/google-calendar/` | — | novo |
| `BackEnd/src/middleware/calcom-webhook.middleware.ts` | novo | — |
| `BackEnd/src/middleware/google-calendar-push.middleware.ts` | — | novo |
| `BackEnd/src/api/routes/calendar.routes.ts` | editar | editar |
| `BackEnd/src/api/controllers/calendar.controller.ts` | editar | editar |
| `BackEnd/src/services/appointments/index.ts` | editar | editar |
| `FrontEnd/src/components/configuration/CalComIntegrationSheet.tsx` | novo | — |
| `FrontEnd/src/components/configuration/GoogleCalendarIntegrationSheet.tsx` | — | novo |
| `FrontEnd/src/lib/integration-catalog.ts` | editar | editar |
| `FrontEnd/src/components/configuration/Integrations.tsx` | editar | editar |
| `BackEnd/database/SUPABASE_SCHEMA_REFERENCE.md` | editar | editar |
| `.env` (backend) | `CALCOM_*` opcional | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` obrigatório |
