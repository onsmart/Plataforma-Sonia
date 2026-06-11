import {
  CalComBookingResource,
  CalComEventTypeResource,
  CalComIntegrationConfig,
  CalComSlotResource,
  CalComUserResource,
  CalComWebhookResource,
} from './calcom.types'

export const CAL_COM_DEFAULT_BASE_URL = 'https://api.cal.com/v2'
export const CAL_COM_API_VERSION_HEADER = '2024-08-13'

export class CalComApiError extends Error {
  statusCode: number
  responseBody: string

  constructor(statusCode: number, responseBody: string) {
    super(`Cal.com API ${statusCode}: ${responseBody}`)
    this.name = 'CalComApiError'
    this.statusCode = statusCode
    this.responseBody = responseBody
  }
}

export function formatCalComApiErrorDetail(error: unknown): string | null {
  if (!(error instanceof CalComApiError)) return null
  const body = String(error.responseBody || '').trim()
  if (!body) return `HTTP ${error.statusCode}`
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>
    const message = String(parsed.message || parsed.error || parsed.detail || '').trim()
    return message.slice(0, 600) || body.slice(0, 600)
  } catch {
    return body.slice(0, 600)
  }
}

type CalComV2Response<T> = {
  status: 'success' | 'error'
  data: T
  error?: string
}

export class CalComApiClient {
  private readonly baseUrl: string

  constructor(private readonly config: CalComIntegrationConfig) {
    this.baseUrl = String(config.baseUrl || CAL_COM_DEFAULT_BASE_URL).trim().replace(/\/+$/, '')
  }

  private get apiKey(): string {
    const key = String(this.config.apiKey || '').trim()
    if (!key) throw new Error('API Key do Cal.com nao configurada para esta integracao.')
    return key
  }

  private buildUrl(
    pathname: string,
    query?: Record<string, string | number | boolean | null | undefined>
  ): string {
    const url = new URL(`${this.baseUrl}${pathname}`)
    Object.entries(query || {}).forEach(([key, value]) => {
      if (value == null || value === '') return
      url.searchParams.set(key, String(value))
    })
    return url.toString()
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'DELETE' | 'PATCH',
    pathname: string,
    options?: {
      query?: Record<string, string | number | boolean | null | undefined>
      body?: Record<string, unknown>
    }
  ): Promise<T> {
    const response = await fetch(this.buildUrl(pathname, options?.query), {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'cal-api-version': CAL_COM_API_VERSION_HEADER,
        'Content-Type': 'application/json',
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText)
      throw new CalComApiError(response.status, errorText)
    }

    const json = (await response.json()) as CalComV2Response<T>
    if (json.status === 'error') {
      throw new CalComApiError(400, json.error || 'Cal.com API error')
    }
    return json.data
  }

  async getCurrentUser(): Promise<CalComUserResource> {
    return this.request<CalComUserResource>('GET', '/me')
  }

  async listEventTypes(): Promise<CalComEventTypeResource[]> {
    const data = await this.request<CalComEventTypeResource[] | { eventTypes: CalComEventTypeResource[] }>(
      'GET',
      '/event-types'
    )
    if (Array.isArray(data)) return data
    if (data && typeof data === 'object' && Array.isArray((data as any).eventTypes)) {
      return (data as any).eventTypes as CalComEventTypeResource[]
    }
    return []
  }

  async getEventType(eventTypeId: number): Promise<CalComEventTypeResource | null> {
    try {
      return await this.request<CalComEventTypeResource>('GET', `/event-types/${eventTypeId}`)
    } catch {
      return null
    }
  }

  async getAvailableSlots(input: {
    eventTypeId: number
    startTime: string
    endTime: string
    timezone?: string | null
  }): Promise<CalComSlotResource[]> {
    const data = await this.request<Record<string, CalComSlotResource[]>>(
      'GET',
      '/slots/available',
      {
        query: {
          startTime: input.startTime,
          endTime: input.endTime,
          eventTypeId: input.eventTypeId,
          timeZone: input.timezone || this.config.defaultTimezone || 'America/Sao_Paulo',
        },
      }
    )
    // Response: { slots: { "YYYY-MM-DD": [{time: "...", ...}] } }
    const slotsMap = (data as any)?.slots ?? data
    if (!slotsMap || typeof slotsMap !== 'object') return []
    return Object.values(slotsMap as Record<string, CalComSlotResource[]>).flat()
  }

  async createBooking(input: {
    eventTypeId: number
    startTime: string
    name: string
    email: string
    timezone?: string | null
    phoneNumber?: string | null
    notes?: string | null
    metadata?: Record<string, unknown>
  }): Promise<CalComBookingResource> {
    const attendee: Record<string, unknown> = {
      name: input.name,
      email: input.email,
      timeZone: input.timezone || this.config.defaultTimezone || 'America/Sao_Paulo',
    }
    if (input.phoneNumber) attendee.phoneNumber = input.phoneNumber

    const body: Record<string, unknown> = {
      eventTypeId: input.eventTypeId,
      start: input.startTime,
      attendee,
      metadata: input.metadata || {},
    }
    if (input.notes) body.additionalNotes = input.notes

    return this.request<CalComBookingResource>('POST', '/bookings', { body })
  }

  async getBooking(bookingUid: string): Promise<CalComBookingResource | null> {
    try {
      return await this.request<CalComBookingResource>('GET', `/bookings/${bookingUid}`)
    } catch {
      return null
    }
  }

  async cancelBooking(bookingUid: string, reason?: string | null): Promise<void> {
    const body: Record<string, unknown> = {}
    if (reason) body.cancellationReason = reason
    await this.request<unknown>('POST', `/bookings/${bookingUid}/cancel`, { body })
  }

  async rescheduleBooking(
    bookingUid: string,
    newStartTime: string
  ): Promise<CalComBookingResource> {
    return this.request<CalComBookingResource>('POST', `/bookings/${bookingUid}/reschedule`, {
      body: { start: newStartTime },
    })
  }

  async createWebhook(input: {
    subscriberUrl: string
    triggers: string[]
    secret?: string | null
  }): Promise<CalComWebhookResource> {
    const body: Record<string, unknown> = {
      subscriberUrl: input.subscriberUrl,
      triggers: input.triggers,
      active: true,
    }
    if (input.secret) body.secret = input.secret
    return this.request<CalComWebhookResource>('POST', '/webhooks', { body })
  }

  async listWebhooks(): Promise<CalComWebhookResource[]> {
    const data = await this.request<CalComWebhookResource[] | { webhooks: CalComWebhookResource[] }>(
      'GET',
      '/webhooks'
    )
    if (Array.isArray(data)) return data
    if (data && typeof data === 'object' && Array.isArray((data as any).webhooks)) {
      return (data as any).webhooks as CalComWebhookResource[]
    }
    return []
  }

  async deleteWebhook(webhookId: number): Promise<void> {
    await this.request<unknown>('DELETE', `/webhooks/${webhookId}`)
  }
}
