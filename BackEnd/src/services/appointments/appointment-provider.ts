export interface AppointmentAvailabilityQuery {
  specialty: string
  doctor?: string | null
  consultationType?: string | null
  unit?: string | null
  period?: string | null
  preferredDate?: string | null
  timezone?: string | null
  patientName?: string | null
}

export interface AppointmentSlot {
  slotId: string
  startsAt: string
  endsAt: string
  specialty: string
  doctor: string
  consultationType: string
  unit: string
  period: string
  timezone: string
  mode: 'presencial' | 'online'
  location: string
  provider: string
  eventTypeUri?: string
  eventTypeName?: string
}

export interface AppointmentRecord {
  appointmentId: string
  status: 'confirmed' | 'cancelled' | 'rescheduled'
  slot: AppointmentSlot
  patientName?: string | null
  patientEmail?: string | null
  patientPhone?: string | null
  notes?: string | null
}

export interface AppointmentBookingInput {
  specialty: string
  slotId: string
  patientName?: string | null
  patientEmail?: string | null
  patientPhone?: string | null
  consultationType?: string | null
  unit?: string | null
  notes?: string | null
}

export interface AppointmentRescheduleInput extends AppointmentBookingInput {
  appointmentId: string
}

export interface AppointmentCancelInput {
  appointmentId: string
  reason?: string | null
}

export interface AppointmentProvider {
  providerKey: string
  getAvailability(query: AppointmentAvailabilityQuery): Promise<AppointmentSlot[]>
  book(input: AppointmentBookingInput): Promise<AppointmentRecord>
  reschedule(input: AppointmentRescheduleInput): Promise<AppointmentRecord>
  cancel(input: AppointmentCancelInput): Promise<AppointmentRecord | null>
  getAppointmentById(appointmentId: string): Promise<AppointmentRecord | null>
}
