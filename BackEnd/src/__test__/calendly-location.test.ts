import { describe, expect, it } from 'vitest'
import { resolveInviteeLocationConfiguration } from '../services/integrations/calendly/calendly.provider'
import { CalendlyEventTypeResource } from '../services/integrations/calendly/calendly.types'

describe('calendly invitee location', () => {
  it('deve montar location_configuration a partir do event type', () => {
    const eventType: CalendlyEventTypeResource = {
      uri: 'https://api.calendly.com/event_types/abc',
      name: 'Cardiologia',
      locations: [{ kind: 'google_conference', location: 'Meet' }],
    }

    const config = resolveInviteeLocationConfiguration(eventType, {
      id: 'map-1',
      specialty: 'cardiologia',
      eventTypeUri: eventType.uri,
      eventTypeName: 'Cardiologia',
      locationKind: 'google_conference',
    })

    expect(config).toEqual({
      kind: 'google_conference',
      location: 'Meet',
    })
  })

  it('deve retornar null quando o event type nao exige local', () => {
    const eventType: CalendlyEventTypeResource = {
      uri: 'https://api.calendly.com/event_types/abc',
      name: 'Consulta',
    }

    expect(resolveInviteeLocationConfiguration(eventType, null)).toBeNull()
  })
})
