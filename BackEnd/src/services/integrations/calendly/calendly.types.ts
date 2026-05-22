export type CalendlyWebhookScope = 'user' | 'organization'

export interface CalendlyEventTypeMapping {
  id: string
  specialty: string
  eventTypeUri: string
  eventTypeName: string
  doctor?: string | null
  unit?: string | null
  consultationType?: string | null
  locationKind?: string | null
  locationLabel?: string | null
  timezone?: string | null
  active?: boolean
}

export interface CalendlyIntegrationConfig {
  integrationId: string
  companyId?: string | null
  userId?: string | null
  provider: string
  accessToken?: string | null
  emailAddress?: string | null
  ownerUri?: string | null
  organizationUri?: string | null
  schedulingUrl?: string | null
  webhookScope: CalendlyWebhookScope
  webhookBaseUrl?: string | null
  webhookSigningKey?: string | null
  webhookSubscriptionUri?: string | null
  defaultTimezone?: string | null
  status?: string | null
  isDefault?: boolean
  isActive?: boolean
  lastTestAt?: string | null
  lastSyncAt?: string | null
  lastWebhookSyncAt?: string | null
  eventTypeMappings: CalendlyEventTypeMapping[]
  rawIntegration?: Record<string, unknown> | null
  rawMetadata?: Record<string, unknown> | null
}

export interface CalendlyIntegrationResponse {
  id: string
  provider: string
  email_address: string | null
  owner_uri: string | null
  organization_uri: string | null
  scheduling_url: string | null
  webhook_scope: CalendlyWebhookScope
  webhook_base_url: string | null
  webhook_subscription_uri: string | null
  default_timezone: string | null
  status: string
  is_default: boolean
  is_active: boolean
  has_access_token: boolean
  last_test_at: string | null
  last_sync_at: string | null
  last_webhook_sync_at: string | null
  event_type_mappings: CalendlyEventTypeMapping[]
}

export interface CalendlyCurrentUserResource {
  uri: string
  name?: string
  slug?: string
  email?: string
  scheduling_url?: string
  timezone?: string
  current_organization?: string
}

export type CalendlyCustomQuestion = {
  name?: string
  type?: string
  position?: number
  enabled?: boolean
  required?: boolean
}

export interface CalendlyEventTypeResource {
  uri: string
  name: string
  slug?: string
  duration?: number
  scheduling_url?: string
  active?: boolean
  custom_questions?: CalendlyCustomQuestion[] | null
  color?: string
  created_at?: string
  updated_at?: string
  internal_note?: string | null
  description_plain?: string | null
  profile?: {
    type?: string
    name?: string
    owner?: string
  } | null
  location?: {
    kind?: string
    location?: string
    phone_number?: string
    additional_info?: string
  } | null
  locations?: Array<{
    kind?: string
    location?: string
    phone_number?: string
    additional_info?: string
  }> | null
}

export type CalendlyInviteeLocationConfiguration = {
  kind: string
  location?: string
  phone_number?: string
  additional_info?: string
}

export interface CalendlyWebhookSubscriptionResource {
  uri?: string | null
  callback_url?: string | null
  url?: string | null
  state?: string | null
  scope?: CalendlyWebhookScope
  organization?: string | null
  user?: string | null
  signing_key?: string | null
}

export interface CalendlyAvailableTimeResource {
  start_time: string
  end_time: string
  scheduling_url?: string
  invitees_remaining?: number
  status?: string
}

export interface CalendlyScheduledEventResource {
  uri: string
  name?: string
  status?: string
  start_time?: string
  end_time?: string
  event_type?: string
  location?: {
    type?: string
    join_url?: string
    location?: string
  } | null
  event_memberships?: Array<{
    user?: string
    user_email?: string
    user_name?: string
  }>
  cancellation?: {
    canceled_by?: string
    reason?: string
    canceler_type?: string
    created_at?: string
  } | null
}

export interface CalendlyInviteeResource {
  uri: string
  email?: string
  name?: string
  timezone?: string
  cancel_url?: string
  reschedule_url?: string
  event?: string
  status?: string
  text_reminder_number?: string
  questions_and_answers?: Array<{
    question?: string
    answer?: string
  }>
}
