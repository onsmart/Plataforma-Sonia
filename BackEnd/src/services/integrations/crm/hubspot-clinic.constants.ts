/** Propriedades de contato HubSpot para status de consulta (criar no portal HubSpot). */
export const HUBSPOT_SONIA_APPOINTMENT_STATUS_PROPERTY = 'sonia_status_agendamento'
export const HUBSPOT_SONIA_APPOINTMENT_AT_PROPERTY = 'sonia_ultima_consulta_em'
export const HUBSPOT_SONIA_CALENDLY_EVENT_PROPERTY = 'sonia_calendly_event_id'
export const HUBSPOT_SONIA_APPOINTMENT_SPECIALTY_PROPERTY = 'sonia_especialidade_consulta'

export const SONIA_APPOINTMENT_STATUS_SCHEDULED = 'agendado'
export const SONIA_APPOINTMENT_STATUS_CANCELLED = 'cancelado'
export const SONIA_APPOINTMENT_STATUS_NONE = 'sem_consulta'

export const HUBSPOT_SONIA_PATIENT_PROPERTIES = [
  'firstname',
  'lastname',
  'email',
  'phone',
  'cpf',
  'birthdate',
  'date_of_birth',
  'documento',
  'lead_source',
  HUBSPOT_SONIA_APPOINTMENT_STATUS_PROPERTY,
  HUBSPOT_SONIA_APPOINTMENT_AT_PROPERTY,
  HUBSPOT_SONIA_CALENDLY_EVENT_PROPERTY,
  HUBSPOT_SONIA_APPOINTMENT_SPECIALTY_PROPERTY,
] as const

export function normalizeSoniaAppointmentStatus(value: unknown): string {
  return String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function isScheduledAppointmentStatus(value: unknown): boolean {
  const normalized = normalizeSoniaAppointmentStatus(value)
  return (
    normalized === SONIA_APPOINTMENT_STATUS_SCHEDULED ||
    normalized === 'scheduled' ||
    normalized === 'confirmado' ||
    normalized === 'confirmed'
  )
}
