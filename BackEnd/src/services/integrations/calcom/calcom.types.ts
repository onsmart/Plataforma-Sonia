export interface CalComEventTypeMapping {
  id: string
  specialty: string
  eventTypeId: number
  eventTypeName: string
  eventTypeSlug?: string | null
  doctor?: string | null
  unit?: string | null
  consultationType?: string | null
  locationKind?: string | null
  locationLabel?: string | null
  timezone?: string | null
  active?: boolean
}

export interface CalComIntegrationConfig {
  integrationId: string
  companyId?: string | null
  userId?: string | null
  provider: string
  apiKey?: string | null
  baseUrl?: string | null
  emailAddress?: string | null
  calUsername?: string | null
  webhookSecret?: string | null
  webhookSubscriptionId?: string | null
  webhookCallbackUrl?: string | null
  defaultTimezone?: string | null
  status?: string | null
  isDefault?: boolean
  isActive?: boolean
  lastTestAt?: string | null
  lastSyncAt?: string | null
  lastWebhookSyncAt?: string | null
  eventTypeMappings: CalComEventTypeMapping[]
  rawMetadata?: Record<string, unknown> | null
}

export interface CalComIntegrationResponse {
  id: string
  provider: string
  email_address: string | null
  cal_username: string | null
  base_url: string
  webhook_callback_url: string | null
  webhook_subscription_id: string | null
  default_timezone: string | null
  status: string
  is_default: boolean
  is_active: boolean
  has_api_key: boolean
  last_test_at: string | null
  last_sync_at: string | null
  last_webhook_sync_at: string | null
  event_type_mappings: CalComEventTypeMapping[]
}

export interface CalComUserResource {
  id?: number
  username?: string
  email?: string
  name?: string
  timeZone?: string
}

export interface CalComEventTypeResource {
  id: number
  title: string
  slug: string
  length: number
  description?: string | null
  hidden?: boolean
  schedulingType?: string | null
  locations?: CalComLocation[] | null
}

export interface CalComLocation {
  type: string
  address?: string | null
  link?: string | null
  hostPhoneNumber?: string | null
  displayLocationPublicly?: boolean
}

export interface CalComSlotResource {
  time: string
  attendees?: number
  bookingUid?: string | null
}

export interface CalComBookingAttendee {
  id?: number
  email: string
  name: string
  timeZone?: string
  phoneNumber?: string | null
}

export interface CalComBookingResource {
  id: number
  uid: string
  title: string
  start: string
  end: string
  status: 'accepted' | 'pending' | 'cancelled' | 'rejected'
  eventTypeId?: number
  attendees?: CalComBookingAttendee[]
  cancelUrl?: string | null
  rescheduleUrl?: string | null
  metadata?: Record<string, unknown>
}

export interface CalComWebhookResource {
  id: number
  payloadTemplate?: string | null
  active: boolean
  eventTriggers: string[]
  subscriberUrl: string
  createdAt?: string
  secret?: string | null
}
