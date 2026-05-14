import {
  CalendlyAvailableTimeResource,
  CalendlyCurrentUserResource,
  CalendlyEventTypeResource,
  CalendlyIntegrationConfig,
  CalendlyInviteeResource,
  CalendlyScheduledEventResource,
  CalendlyWebhookScope,
} from './calendly.types'

type CalendlyCollectionResponse<T> = {
  collection?: T[]
  pagination?: {
    next_page?: string | null
    count?: number
  }
}

type CalendlyResourceResponse<T> = {
  resource: T
}

export class CalendlyApiError extends Error {
  statusCode: number
  responseBody: string

  constructor(statusCode: number, responseBody: string) {
    super(`Calendly API ${statusCode}: ${responseBody}`)
    this.name = 'CalendlyApiError'
    this.statusCode = statusCode
    this.responseBody = responseBody
  }
}

export class CalendlyApiClient {
  constructor(private readonly config: CalendlyIntegrationConfig) {}

  private get accessToken(): string {
    const token = String(this.config.accessToken || '').trim()
    if (!token) {
      throw new Error('Credenciais do Calendly nao configuradas para esta integracao.')
    }
    return token
  }

  private buildUrl(pathname: string, query?: Record<string, string | number | boolean | null | undefined>) {
    const url = new URL(`https://api.calendly.com${pathname}`)
    Object.entries(query || {}).forEach(([key, value]) => {
      if (value == null || value === '') return
      url.searchParams.set(key, String(value))
    })
    return url.toString()
  }

  private async request<T>(
    method: 'GET' | 'POST',
    pathname: string,
    options?: {
      query?: Record<string, string | number | boolean | null | undefined>
      body?: Record<string, unknown>
    }
  ): Promise<T> {
    const response = await fetch(this.buildUrl(pathname, options?.query), {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText)
      throw new CalendlyApiError(response.status, errorText)
    }

    return (await response.json()) as T
  }

  async getCurrentUser(): Promise<CalendlyCurrentUserResource> {
    const payload = await this.request<CalendlyResourceResponse<CalendlyCurrentUserResource>>('GET', '/users/me')
    return payload.resource
  }

  async listEventTypes(input?: {
    organizationUri?: string | null
    ownerUri?: string | null
    active?: boolean
    count?: number
  }): Promise<CalendlyEventTypeResource[]> {
    const payload = await this.request<CalendlyCollectionResponse<CalendlyEventTypeResource>>('GET', '/event_types', {
      query: {
        organization: input?.organizationUri || this.config.organizationUri || undefined,
        user: input?.ownerUri || this.config.ownerUri || undefined,
        active: input?.active ?? true,
        count: input?.count || 100,
      },
    })
    return payload.collection || []
  }

  async getAvailableTimes(input: {
    eventTypeUri: string
    startTime: string
    endTime: string
  }): Promise<CalendlyAvailableTimeResource[]> {
    const payload = await this.request<CalendlyCollectionResponse<CalendlyAvailableTimeResource>>(
      'GET',
      '/event_type_available_times',
      {
        query: {
          event_type: input.eventTypeUri,
          start_time: input.startTime,
          end_time: input.endTime,
        },
      }
    )
    return payload.collection || []
  }

  async createInvitee(input: {
    eventTypeUri: string
    startTime: string
    name: string
    email: string
    timezone?: string | null
    location?: {
      kind: string
      location?: string
    } | null
    questionsAndAnswers?: Array<{ question: string; answer: string }>
    textRemindersEnabled?: boolean
  }): Promise<CalendlyInviteeResource> {
    const payload = await this.request<CalendlyResourceResponse<CalendlyInviteeResource>>('POST', '/invitees', {
      body: {
        event_type: input.eventTypeUri,
        start_time: input.startTime,
        invitee: {
          name: input.name,
          email: input.email,
          timezone: input.timezone || this.config.defaultTimezone || 'America/Sao_Paulo',
        },
        location: input.location || undefined,
        questions_and_answers: input.questionsAndAnswers || undefined,
        tracking: {
          utm_source: 'plataforma-sonia',
          utm_campaign: 'medical-clinic-flow',
        },
        text_reminder_number: undefined,
        text_reminders_enabled: input.textRemindersEnabled === true,
      },
    })
    return payload.resource
  }

  async getScheduledEvent(uriOrId: string): Promise<CalendlyScheduledEventResource | null> {
    const eventId = extractCalendlyUuid(uriOrId)
    if (!eventId) return null
    const payload = await this.request<CalendlyResourceResponse<CalendlyScheduledEventResource>>(
      'GET',
      `/scheduled_events/${eventId}`
    )
    return payload.resource
  }

  async cancelScheduledEvent(input: { uriOrId: string; reason?: string | null }): Promise<CalendlyScheduledEventResource | null> {
    const eventId = extractCalendlyUuid(input.uriOrId)
    if (!eventId) return null
    const payload = await this.request<CalendlyResourceResponse<CalendlyScheduledEventResource>>(
      'POST',
      `/scheduled_events/${eventId}/cancellation`,
      {
        body: {
          reason: String(input.reason || 'Cancelled via SONIA flow').trim(),
        },
      }
    )
    return payload.resource
  }

  async createWebhookSubscription(input: {
    callbackUrl: string
    scope: CalendlyWebhookScope
    organizationUri?: string | null
    ownerUri?: string | null
    signingKey?: string | null
  }): Promise<{ uri?: string | null; signing_key?: string | null }> {
    const organizationUri = input.organizationUri || this.config.organizationUri || undefined
    const ownerUri = input.ownerUri || this.config.ownerUri || undefined
    if (!organizationUri) {
      throw new Error('Organization URI do Calendly ausente para registrar webhook.')
    }
    if (input.scope === 'user' && !ownerUri) {
      throw new Error('User URI do Calendly ausente para registrar webhook no escopo user.')
    }

    const body: Record<string, unknown> = {
      url: input.callbackUrl,
      events: ['invitee.created', 'invitee.canceled'],
      scope: input.scope,
    }
    body.organization = organizationUri
    if (input.scope === 'user') {
      body.user = ownerUri
    }
    if (input.signingKey) {
      body.signing_key = input.signingKey
    }
    const payload = await this.request<CalendlyResourceResponse<{ uri?: string | null; signing_key?: string | null }>>(
      'POST',
      '/webhook_subscriptions',
      { body }
    )
    return payload.resource || {}
  }
}

export function extractCalendlyUuid(value: string): string | null {
  const normalized = String(value || '').trim()
  if (!normalized) return null
  const directMatch = normalized.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)
  if (directMatch?.[0]) return directMatch[0]
  return null
}
