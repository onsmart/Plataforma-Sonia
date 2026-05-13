import { AppointmentProvider } from './appointment-provider'
import { MockCalendlyProvider } from './mock-calendly.provider'
import { RealCalendlyProvider } from '../integrations/calendly'

export * from './appointment-provider'

export function resolveAppointmentProvider(
  provider?: string | null,
  options?: { integrationId?: string | null }
): AppointmentProvider {
  const normalized = String(provider || '').trim().toLowerCase()
  if (normalized === 'calendly') {
    const integrationId = String(options?.integrationId || '').trim()
    if (!integrationId) {
      throw new Error('calendar_integration_required')
    }
    return new RealCalendlyProvider(integrationId)
  }
  if (!normalized || normalized === 'mock_calendly' || normalized === 'calendly_mock') {
    return new MockCalendlyProvider()
  }
  return new MockCalendlyProvider()
}
