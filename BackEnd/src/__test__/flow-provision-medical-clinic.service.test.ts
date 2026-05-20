import { describe, expect, it } from 'vitest'
import { __test__ } from '../services/flows/flow-provision-medical-clinic.service'

const builderParams = {
  agentIds: {
    initial: 'agent-initial',
    crm: 'agent-crm',
    triage: 'agent-triage',
    urgency: 'agent-urgency',
    communication: 'agent-communication',
    human: 'agent-human',
  },
  crmIntegrationId: 'crm-1',
  emailIntegrationId: 'email-1',
  teamNotifyEmail: '',
  teamNotifyWhatsApp: '5511999999999',
  appointmentProvider: 'calendly' as const,
  appointmentIntegrationId: 'cal-1',
}

describe('flow-provision-medical-clinic', () => {
  it('nao deve gravar notifyEmail de demo nos handoffs quando e-mail de equipe desligado', () => {
    const flow = __test__.createHumanHandoffSubflow(builderParams)
    const urgent = flow.nodes.find((node) => node.id === 'sf-human-urgent')
    const standard = flow.nodes.find((node) => node.id === 'sf-human-standard')
    expect(urgent?.data?.notifyEmail).toBeUndefined()
    expect(standard?.data?.notifyEmail).toBeUndefined()
  })

  it('deve marcar os blocos deterministicos no subfluxo de intake', () => {
    const flow = __test__.createIntakeTriageSubflow(builderParams)

    const collectNode = flow.nodes.find((node) => node.id === 'sf-intake-collect-data')
    const triageNode = flow.nodes.find((node) => node.id === 'sf-intake-triage')
    const urgencyNode = flow.nodes.find((node) => node.id === 'sf-intake-urgency')

    expect(collectNode?.data?.useDeterministicIntake).toBe(true)
    expect(collectNode?.data?.deterministic?.profile).toBe('patient_intake.collect')
    expect(triageNode?.data?.useDeterministicIntake).toBe(true)
    expect(triageNode?.data?.deterministic?.profile).toBe('patient_intake.triage')
    expect(urgencyNode?.data?.useDeterministicIntake).toBe(true)
    expect(urgencyNode?.data?.deterministic?.profile).toBe('patient_intake.urgency')
  })

  it('deve alinhar o subfluxo de appointment para escolher horario antes de confirmar o book', () => {
    const flow = __test__.createAppointmentSubflow(builderParams, 'followups-1')

    const specialtyNode = flow.nodes.find((node) => node.id === 'sf-appointment-specialty')
    const availableEdge = flow.edges.find(
      (edge) => edge.source === 'sf-appointment-status' && edge.sourceHandle === 'case:available'
    )
    const chooseSlotEdge = flow.edges.find(
      (edge) => edge.source === 'sf-appointment-choose-slot' && edge.target === 'sf-appointment-book'
    )

    expect(specialtyNode?.data?.useDeterministicIntake).toBe(true)
    expect(specialtyNode?.data?.deterministic?.profile).toBe('patient_intake.triage')
    const chooseSlotNode = flow.nodes.find((node) => node.id === 'sf-appointment-choose-slot')
    expect(chooseSlotNode?.data?.waBuildSlotSelectionMessage).toBe(true)
    expect(availableEdge?.target).toBe('sf-appointment-choose-slot')
    expect(chooseSlotEdge).toBeDefined()
  })
})
