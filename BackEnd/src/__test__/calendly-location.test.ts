import { describe, expect, it } from 'vitest'
import {
  listInviteeLocationCandidates,
  pickEventTypePrimaryLocation,
  resolveInviteeLocationConfiguration,
} from '../services/integrations/calendly/calendly.provider'
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

  it('nao deve inventar endereco quando o event type presencial nao traz local', () => {
    const eventType: CalendlyEventTypeResource = {
      uri: 'https://api.calendly.com/event_types/abc',
      name: 'Clinica geral',
      location: { kind: 'physical' },
    }

    expect(
      listInviteeLocationCandidates(eventType, {
        id: 'map-1',
        specialty: 'clinica_geral',
        eventTypeUri: eventType.uri,
        eventTypeName: 'Clinica geral',
        locationKind: 'physical',
      })
    ).toEqual([])
  })

  it('deve priorizar custom com endereco real quando o mapeamento diz physical', () => {
    const eventType: CalendlyEventTypeResource = {
      uri: 'https://api.calendly.com/event_types/abc',
      name: 'Clinica geral',
      locations: [{ kind: 'custom', location: 'Rua das Flores, 100 - Sao Paulo' }],
    }

    const [config] = listInviteeLocationCandidates(eventType, {
      id: 'map-1',
      specialty: 'clinica_geral',
      eventTypeUri: eventType.uri,
      eventTypeName: 'Clinica geral',
      locationKind: 'physical',
    })

    expect(config).toEqual({
      kind: 'custom',
      location: 'Rua das Flores, 100 - Sao Paulo',
    })
  })

  it('deve usar endereco salvo no mapeamento como fallback', () => {
    const eventType: CalendlyEventTypeResource = {
      uri: 'https://api.calendly.com/event_types/abc',
      name: 'Clinica geral',
    }

    const [config] = listInviteeLocationCandidates(eventType, {
      id: 'map-1',
      specialty: 'clinica_geral',
      eventTypeUri: eventType.uri,
      eventTypeName: 'Clinica geral',
      locationKind: 'presencial',
      locationLabel: 'Av. Paulista, 1000',
    })

    expect(config).toEqual({
      kind: 'physical',
      location: 'Av. Paulista, 1000',
    })
  })

  it('deve expor kind e endereco corretos na listagem de event types', () => {
    const eventType: CalendlyEventTypeResource = {
      uri: 'https://api.calendly.com/event_types/abc',
      name: 'Clinica geral',
      location: { kind: 'physical' },
      locations: [{ kind: 'custom', location: 'Consultorio 2' }],
    }

    expect(pickEventTypePrimaryLocation(eventType)).toEqual({
      locationKind: 'custom',
      locationLabel: 'Consultorio 2',
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
