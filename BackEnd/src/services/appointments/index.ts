import { AppointmentProvider } from './appointment-provider'
import { RealCalendlyProvider } from '../integrations/calendly'

export * from './appointment-provider'

export function resolveAppointmentProvider(
  provider?: string | null,
  options?: { integrationId?: string | null }
): AppointmentProvider {
  const normalized = String(provider || 'calendly').trim().toLowerCase()
  if (normalized === 'calendly') {
    const integrationId = String(options?.integrationId || '').trim()
    if (!integrationId) {
      throw new Error('calendar_integration_required')
    }
    return new RealCalendlyProvider(integrationId)
  }
  throw new Error(`unsupported_appointment_provider:${normalized}`)
}
