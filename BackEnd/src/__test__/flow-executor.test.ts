import { beforeEach, describe, it, expect, vi } from 'vitest'
import { FlowExecutor } from '../services/flows/flow-executor'
import { FlowData, FlowExecutionContext } from '../services/flows/flow.types'
import { chatWithAgent } from '../services/agents/chatwithAgent'
import { sendFlowWhatsAppMessage } from '../services/integrations/whatsapp/whatsapp-flow-message.service'
import { sendEmail } from '../services/integrations/email/email.service'
import { readInboxMessages } from '../services/integrations/mail'
import { searchHubSpotContacts } from '../services/integrations/crm/hubspot.service'
import { enqueueEmailAudienceJobs } from '../services/integrations/email/email-audience.service'
import { createCampaignRecord, enqueueCampaignContacts } from '../services/integrations/whatsapp/whatsapp-campaign.service'
import { enqueueFlowResumeJobs, resolveScheduledAtToUtcIso } from '../services/flows/flow-scheduler.service'
import { supabase } from '../lib/supabase'

const {
    getContactByPhoneNumberMock,
    createOrUpdateContactMock,
    sendEmailForUserMock,
    getAvailabilityMock,
    bookAppointmentMock,
    rescheduleAppointmentMock,
    cancelAppointmentMock,
    getAppointmentByIdMock
} = vi.hoisted(() => ({
    getContactByPhoneNumberMock: vi.fn(),
    createOrUpdateContactMock: vi.fn(),
    sendEmailForUserMock: vi.fn(),
    getAvailabilityMock: vi.fn(),
    bookAppointmentMock: vi.fn(),
    rescheduleAppointmentMock: vi.fn(),
    cancelAppointmentMock: vi.fn(),
    getAppointmentByIdMock: vi.fn()
}))

// Mocking dependencies to avoid real side effects and environment check errors
vi.mock('../lib/logger', () => ({
    default: {
        info: vi.fn(),
        log: vi.fn(),
        error: vi.fn(),
        warn: vi.fn()
    }
}))

vi.mock('../lib/supabase', () => ({
    supabase: {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        rpc: vi.fn().mockResolvedValue({ data: [] }),
        maybeSingle: vi.fn().mockResolvedValue({ data: { nome: 'Mock Agent' } }),
        single: vi.fn().mockResolvedValue({ data: { nodes: [] } })
    }
}))

vi.mock('../services/flows/fallback-events', () => ({
    saveFallbackEvent: vi.fn().mockResolvedValue(true)
}))

vi.mock('../services/system-logs', () => ({
    saveSystemLog: vi.fn().mockResolvedValue(true)
}))

vi.mock('../services/agents/chatwithAgent', () => ({
    chatWithAgent: vi.fn().mockResolvedValue('Mocked response')
}))

vi.mock('../services/flows/flow-template-runner', () => ({
    executeFlowTemplateNode: vi.fn().mockResolvedValue('{"intent":"agendamento"}')
}))

vi.mock('../services/integrations/whatsapp/whatsapp-flow-message.service', () => ({
    sendFlowWhatsAppMessage: vi.fn().mockResolvedValue({
        success: true,
        sendMode: 'normal',
    })
}))

vi.mock('../services/integrations/email/email.service', () => ({
    sendEmail: vi.fn().mockResolvedValue({
        provider: 'smtp'
    }),
    sendEmailForUser: sendEmailForUserMock
}))

vi.mock('../services/integrations/mail', () => ({
    readInboxMessages: vi.fn().mockResolvedValue([])
}))

vi.mock('../services/integrations/crm/hubspot.service', () => ({
    searchHubSpotContacts: vi.fn().mockResolvedValue([])
}))

vi.mock('../services/integrations/email/email-audience.service', () => ({
    enqueueEmailAudienceJobs: vi.fn().mockResolvedValue({
        inserted: 0,
        skippedWithoutEmail: 0
    })
}))

vi.mock('../services/integrations/whatsapp/whatsapp-campaign.service', () => ({
    createCampaignRecord: vi.fn().mockResolvedValue({ id: 'campaign-1' }),
    enqueueCampaignContacts: vi.fn().mockResolvedValue({ inserted: 0 })
}))

vi.mock('../services/flows/flow-scheduler.service', () => ({
    enqueueFlowResumeJobs: vi.fn().mockResolvedValue({ inserted: 0 }),
    resolveScheduledAtToUtcIso: vi.fn().mockResolvedValue({
        scheduledAtIso: '2026-05-13T12:00:00.000Z',
        timezone: 'America/Sao_Paulo'
    })
}))

vi.mock('../services/integrations/whatsapp/whatsapp.contacts', () => ({
    getContactByPhoneNumber: getContactByPhoneNumberMock,
    createOrUpdateContact: createOrUpdateContactMock
}))

vi.mock('../services/appointments', () => ({
    resolveAppointmentProvider: vi.fn(() => ({
        providerKey: 'calendly',
        getAvailability: getAvailabilityMock,
        book: bookAppointmentMock,
        reschedule: rescheduleAppointmentMock,
        cancel: cancelAppointmentMock,
        getAppointmentById: getAppointmentByIdMock
    }))
}))

describe('FlowExecutor Smoke Test', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        getContactByPhoneNumberMock.mockResolvedValue({ success: true, contact: null })
        createOrUpdateContactMock.mockResolvedValue({
            success: true,
            contact: {
                id: 'wa-contact-1',
                phone_number: '551199991111',
                status: 'active'
            }
        })
        sendEmailForUserMock.mockResolvedValue({ provider: 'smtp' })
        getAvailabilityMock.mockResolvedValue([])
        bookAppointmentMock.mockResolvedValue({
            appointmentId: 'appt-1',
            status: 'confirmed',
            slot: {
                slotId: 'slot-1',
                startsAt: '2026-05-14T12:00:00.000Z',
                endsAt: '2026-05-14T12:30:00.000Z',
                specialty: 'cardiologia',
                doctor: 'Dra. Ana',
                consultationType: 'online',
                unit: 'Unidade Central',
                period: 'tarde',
                timezone: 'America/Sao_Paulo',
                mode: 'online',
                location: 'https://calendly.example/room/slot-1',
                provider: 'calendly',
            }
        })
        rescheduleAppointmentMock.mockResolvedValue({
            appointmentId: 'appt-2',
            status: 'rescheduled',
            slot: {
                slotId: 'slot-2',
                startsAt: '2026-05-15T12:00:00.000Z',
                endsAt: '2026-05-15T12:30:00.000Z',
                specialty: 'cardiologia',
                doctor: 'Dra. Ana',
                consultationType: 'online',
                unit: 'Unidade Central',
                period: 'tarde',
                timezone: 'America/Sao_Paulo',
                mode: 'online',
                location: 'https://calendly.example/room/slot-2',
                provider: 'calendly',
            }
        })
        cancelAppointmentMock.mockResolvedValue({
            appointmentId: 'appt-1',
            status: 'cancelled',
            slot: {
                slotId: 'slot-1',
                startsAt: '2026-05-14T12:00:00.000Z',
                endsAt: '2026-05-14T12:30:00.000Z',
                specialty: 'cardiologia',
                doctor: 'Dra. Ana',
                consultationType: 'online',
                unit: 'Unidade Central',
                period: 'tarde',
                timezone: 'America/Sao_Paulo',
                mode: 'online',
                location: 'https://calendly.example/room/slot-1',
                provider: 'calendly',
            }
        })
        getAppointmentByIdMock.mockResolvedValue(null)
    })

    it('deve executar um flow mínimo (start -> stop) com sucesso', async () => {
        const flowData: FlowData = {
            nodes: [
                {
                    id: 'node-1',
                    type: 'start',
                    data: { label: 'Início' },
                    position: { x: 0, y: 0 }
                },
                {
                    id: 'node-2',
                    type: 'stop',
                    data: { label: 'Fim' },
                    position: { x: 200, y: 0 }
                }
            ],
            edges: [
                { source: 'node-1', target: 'node-2' }
            ],
            startNodeId: 'node-1'
        }

        const context: FlowExecutionContext = {
            flowId: 'test-flow-id',
            userId: 'test-user-id',
            userEmail: 'test@example.com',
            data: {},
            executionHistory: []
        }

        const executor = new FlowExecutor(flowData, context)
        const result = await executor.execute()

        // Verificações básicas
        expect(result).toBeDefined()
        expect(result.executionHistory).toHaveLength(2)
        expect(result.executionHistory[0].nodeId).toBe('node-1')
        expect(result.executionHistory[1].nodeId).toBe('node-2')
        expect(result.executionHistory[1].output).toEqual({ stopped: true })
    })

    it('deve falhar se o node inicial não for encontrado', async () => {
        const flowData: FlowData = {
            nodes: [
                {
                    id: 'node-1',
                    type: 'start',
                    data: { label: 'Início' },
                    position: { x: 0, y: 0 }
                }
            ],
            edges: [],
            startNodeId: 'node-invalido'
        }

        const context: FlowExecutionContext = {
            flowId: 'test-flow-id',
            userId: 'test-user-id',
            userEmail: 'test@example.com',
            data: {},
            executionHistory: []
        }

        const executor = new FlowExecutor(flowData, context)

        await expect(executor.execute()).rejects.toThrow(/startNodeId .* não corresponde a nenhum node/)
    })

    it('deve executar um node agent em modo template sem exigir agentId', async () => {
        const flowData: FlowData = {
            nodes: [
                {
                    id: 'node-1',
                    type: 'start',
                    data: { label: 'Início' },
                    position: { x: 0, y: 0 }
                },
                {
                    id: 'node-2',
                    type: 'agent',
                    data: {
                        label: 'Classificador',
                        executionMode: 'template',
                        templateId: 'template-123',
                        templateName: 'Classificador',
                        additionalInstructions: 'Responda em JSON'
                    },
                    position: { x: 200, y: 0 }
                },
                {
                    id: 'node-3',
                    type: 'stop',
                    data: { label: 'Fim' },
                    position: { x: 400, y: 0 }
                }
            ],
            edges: [
                { source: 'node-1', target: 'node-2' },
                { source: 'node-2', target: 'node-3' }
            ],
            startNodeId: 'node-1'
        }

        const context: FlowExecutionContext = {
            flowId: 'test-flow-id',
            userId: 'test-user-id',
            userEmail: 'test@example.com',
            data: { message: 'Quero agendar uma consulta' },
            executionHistory: []
        }

        const executor = new FlowExecutor(flowData, context)
        const result = await executor.execute()

        expect(result.executionHistory).toHaveLength(3)
        expect(result.executionHistory[1].executionMode).toBe('template')
        expect(result.executionHistory[1].agentId).toBeUndefined()
        expect(result.executionHistory[1].templateId).toBe('template-123')
        expect(result.data.intent).toBe('agendamento')
    })

    it('deve executar um node agent legado usando agentId', async () => {
        const flowData: FlowData = {
            nodes: [
                {
                    id: 'node-1',
                    type: 'start',
                    data: { label: 'Inicio' },
                    position: { x: 0, y: 0 }
                },
                {
                    id: 'node-2',
                    type: 'agent',
                    data: {
                        label: 'Agente legado',
                        executionMode: 'agent',
                        agentId: 'agent-123',
                        agentName: 'Agente legado'
                    },
                    position: { x: 200, y: 0 }
                },
                {
                    id: 'node-3',
                    type: 'stop',
                    data: { label: 'Fim' },
                    position: { x: 400, y: 0 }
                }
            ],
            edges: [
                { source: 'node-1', target: 'node-2' },
                { source: 'node-2', target: 'node-3' }
            ],
            startNodeId: 'node-1'
        }

        const context: FlowExecutionContext = {
            flowId: 'test-flow-id',
            userId: 'test-user-id',
            userEmail: 'test@example.com',
            data: { message: 'Teste legado' },
            executionHistory: []
        }

        const executor = new FlowExecutor(flowData, context)
        const result = await executor.execute()

        expect(chatWithAgent).toHaveBeenCalledWith(
            'test@example.com',
            'agent-123',
            expect.any(String),
            expect.objectContaining({ message: 'Teste legado' })
        )
        expect(result.executionHistory[1].executionMode).toBe('agent')
        expect(result.executionHistory[1].agentId).toBe('agent-123')
    })

    it('deve executar node debug sem alterar context.data com saída do debug', async () => {
        const flowData: FlowData = {
            nodes: [
                {
                    id: 'node-1',
                    type: 'start',
                    data: { label: 'Início' },
                    position: { x: 0, y: 0 }
                },
                {
                    id: 'node-2',
                    type: 'debug',
                    data: { label: 'Debug', debugKeys: 'foo' },
                    position: { x: 100, y: 0 }
                },
                {
                    id: 'node-3',
                    type: 'stop',
                    data: { label: 'Fim' },
                    position: { x: 200, y: 0 }
                }
            ],
            edges: [
                { source: 'node-1', target: 'node-2' },
                { source: 'node-2', target: 'node-3' }
            ],
            startNodeId: 'node-1'
        }

        const context: FlowExecutionContext = {
            flowId: 'test-flow-id',
            userId: 'test-user-id',
            userEmail: 'test@example.com',
            data: { foo: 'bar', secret: 42 },
            executionHistory: []
        }

        const executor = new FlowExecutor(flowData, context)
        const result = await executor.execute()

        expect(result.data.foo).toBe('bar')
        expect(result.data.secret).toBe(42)
        expect(result.data.kind).toBeUndefined()
        expect(result.data.snapshot).toBeUndefined()

        const debugStep = result.executionHistory.find((h) => h.nodeId === 'node-2')
        expect(debugStep).toBeDefined()
        expect(debugStep?.success).toBe(true)
        expect(debugStep?.output?.kind).toBe('debug')
        expect(debugStep?.output?.snapshot).toEqual({ foo: 'bar' })
        expect(debugStep?.input).toEqual({ keysRequested: ['foo'] })
        expect(debugStep?.nodeType).toBe('debug')
        expect(debugStep?.startedAt).toBeDefined()
        expect(debugStep?.finishedAt).toBeDefined()
    })
    it('deve executar o novo bloco Enviar mensagem WhatsApp e marcar entrega interna', async () => {
        const flowData: FlowData = {
            nodes: [
                {
                    id: 'node-1',
                    type: 'start',
                    data: { label: 'Inicio' },
                    position: { x: 0, y: 0 }
                },
                {
                    id: 'node-2',
                    type: 'whatsapp_message',
                    data: {
                        label: 'Enviar mensagem WhatsApp',
                        waMessageType: 'buttons',
                        waMessageText: 'Como posso ajudar?',
                        waButtons: [{ id: 'btn_1', text: 'Falar agora' }]
                    },
                    position: { x: 100, y: 0 }
                },
                {
                    id: 'node-3',
                    type: 'stop',
                    data: { label: 'Fim' },
                    position: { x: 200, y: 0 }
                }
            ],
            edges: [
                { source: 'node-1', target: 'node-2' },
                { source: 'node-2', target: 'node-3' }
            ],
            startNodeId: 'node-1'
        }

        const context: FlowExecutionContext = {
            flowId: 'flow-wa',
            userId: 'user-1',
            userEmail: 'user@example.com',
            data: {
                integrations_id: 'integration-1',
                whatsapp_contact_id: 'contact-1'
            },
            executionHistory: []
        }

        const executor = new FlowExecutor(flowData, context)
        const result = await executor.execute()

        expect(sendFlowWhatsAppMessage).toHaveBeenCalledWith(expect.objectContaining({
            integrationsId: 'integration-1',
            to: 'contact-1',
            messageType: 'buttons',
            messageText: 'Como posso ajudar?'
        }))
        expect(result.data.__flow_whatsapp_outbound_already_sent).toBe(true)
        expect(result.executionHistory[1].output).toEqual(expect.objectContaining({
            kind: 'whatsapp_message',
            sendMode: 'normal'
        }))
    })

    it('deve executar o bloco email_send com templates do contexto', async () => {
        const flowData: FlowData = {
            nodes: [
                {
                    id: 'node-1',
                    type: 'start',
                    data: { label: 'Inicio' },
                    position: { x: 0, y: 0 }
                },
                {
                    id: 'node-2',
                    type: 'email_send',
                    data: {
                        label: 'Enviar email',
                        emailIntegrationId: 'integration-email-1',
                        emailTo: '{{lead_email}}',
                        emailSubject: 'Ola, {{lead_name}}',
                        emailText: 'Seu protocolo e {{protocol_number}}'
                    },
                    position: { x: 100, y: 0 }
                },
                {
                    id: 'node-3',
                    type: 'stop',
                    data: { label: 'Fim' },
                    position: { x: 200, y: 0 }
                }
            ],
            edges: [
                { source: 'node-1', target: 'node-2' },
                { source: 'node-2', target: 'node-3' }
            ],
            startNodeId: 'node-1'
        }

        const context: FlowExecutionContext = {
            flowId: 'flow-email-send',
            userId: 'user-1',
            userEmail: 'user@example.com',
            data: {
                lead_email: 'mateus.mantovani@onsmart.com.br',
                lead_name: 'Mateus',
                protocol_number: 'ABC-123'
            },
            executionHistory: []
        }

        const executor = new FlowExecutor(flowData, context)
        const result = await executor.execute()

        expect(sendEmail).toHaveBeenCalledWith('integration-email-1', {
            to: 'mateus.mantovani@onsmart.com.br',
            subject: 'Ola, Mateus',
            text: 'Seu protocolo e ABC-123'
        })
        expect(result.executionHistory[1].output).toEqual(expect.objectContaining({
            kind: 'email_send',
            integrationId: 'integration-email-1',
            provider: 'smtp'
        }))
    })

    it('deve simular email em audiencia no modo teste sem criar jobs persistentes', async () => {
        const flowData: FlowData = {
            nodes: [
                { id: 'node-1', type: 'start', data: { label: 'Inicio' }, position: { x: 0, y: 0 } },
                {
                    id: 'node-2',
                    type: 'email_send',
                    data: {
                        label: 'Email em lote',
                        emailIntegrationId: 'integration-email-1',
                        emailSubject: 'Ola {{firstname}}',
                        emailText: 'Conteudo para {{email}}'
                    },
                    position: { x: 100, y: 0 }
                },
                { id: 'node-3', type: 'stop', data: { label: 'Fim' }, position: { x: 200, y: 0 } }
            ],
            edges: [
                { source: 'node-1', target: 'node-2' },
                { source: 'node-2', target: 'node-3' }
            ],
            startNodeId: 'node-1'
        }

        const context: FlowExecutionContext = {
            flowId: 'flow-email-audience-test',
            userId: 'user-1',
            userEmail: 'user@example.com',
            data: {
                __flow_execution_mode: 'test',
                audience_contacts: [
                    { external_id: 'hs-1', firstname: 'Mateus', lastname: null, name: 'Mateus', email: 'mateus@example.com', phone: null, crm_integration_id: 'crm-1', source: 'hubspot', tags: ['vip'], properties: {} },
                    { external_id: 'hs-2', firstname: 'Ana', lastname: null, name: 'Ana', email: null, phone: '5511999991111', crm_integration_id: 'crm-1', source: 'hubspot', tags: ['vip'], properties: {} }
                ]
            },
            executionHistory: []
        }

        const executor = new FlowExecutor(flowData, context)
        const result = await executor.execute()

        expect(enqueueEmailAudienceJobs).not.toHaveBeenCalled()
        expect(sendEmail).not.toHaveBeenCalled()
        expect(result.executionHistory[1].output).toEqual(expect.objectContaining({
            kind: 'email_send_audience',
            audienceCount: 2,
            skippedWithoutEmail: 1,
            simulated: true
        }))
    })

    it('deve executar o bloco email_read e retornar mensagens no historico', async () => {
        vi.mocked(readInboxMessages).mockResolvedValueOnce([
            {
                external_message_id: 'msg-1',
                subject: 'Primeiro email',
                from: [{ address: 'cliente@empresa.com', name: 'Cliente' }],
                to: [],
                cc: [],
                bcc: [],
                body_text: 'Conteudo',
                body_html: null,
                preview: 'Preview do email',
                received_at: '2026-04-17T12:00:00.000Z',
                sent_at: '2026-04-17T11:59:00.000Z',
                is_read: false,
                flags: [],
                folder: 'INBOX',
                attachments: [],
                headers: {}
            }
        ])

        const flowData: FlowData = {
            nodes: [
                {
                    id: 'node-1',
                    type: 'start',
                    data: { label: 'Inicio' },
                    position: { x: 0, y: 0 }
                },
                {
                    id: 'node-2',
                    type: 'email_read',
                    data: {
                        label: 'Ler emails',
                        emailIntegrationId: 'integration-email-1',
                        emailReadLimit: 3
                    },
                    position: { x: 100, y: 0 }
                },
                {
                    id: 'node-3',
                    type: 'stop',
                    data: { label: 'Fim' },
                    position: { x: 200, y: 0 }
                }
            ],
            edges: [
                { source: 'node-1', target: 'node-2' },
                { source: 'node-2', target: 'node-3' }
            ],
            startNodeId: 'node-1'
        }

        const context: FlowExecutionContext = {
            flowId: 'flow-email-read',
            userId: 'user-1',
            userEmail: 'user@example.com',
            data: {},
            executionHistory: []
        }

        const executor = new FlowExecutor(flowData, context)
        const result = await executor.execute()

        expect(readInboxMessages).toHaveBeenCalledWith('integration-email-1', 3)
        expect(result.executionHistory[1].output).toEqual(expect.objectContaining({
            kind: 'email_read',
            total: 1
        }))
        expect(result.executionHistory[1].output?.messages?.[0]?.subject).toBe('Primeiro email')
    })

    it('deve executar o bloco hubspot_whatsapp_campaign e preparar contatos validos para campanha', async () => {
        vi.mocked(searchHubSpotContacts).mockResolvedValueOnce([
            {
                id: 'hs-1',
                firstname: 'Mateus',
                lastname: 'Mantovani',
                email: 'mateus@example.com',
                phone: '+55 (11) 99999-1111',
                properties: {
                    firstname: 'Mateus',
                    lastname: 'Mantovani',
                    email: 'mateus@example.com',
                    phone: '+55 (11) 99999-1111',
                    segment: 'vip'
                }
            },
            {
                id: 'hs-2',
                firstname: 'Sem',
                lastname: 'Telefone',
                email: 'semtelefone@example.com',
                phone: '',
                properties: {
                    firstname: 'Sem',
                    lastname: 'Telefone',
                    email: 'semtelefone@example.com',
                    phone: '',
                    segment: 'vip'
                }
            }
        ])

        const flowData: FlowData = {
            nodes: [
                {
                    id: 'node-1',
                    type: 'start',
                    data: { label: 'Inicio' },
                    position: { x: 0, y: 0 }
                },
                {
                    id: 'node-2',
                    type: 'hubspot_whatsapp_campaign',
                    data: {
                        label: 'Selecionar contatos HubSpot',
                        crmIntegrationId: 'crm-int-1',
                        crmFilterField: 'segment',
                        crmFilterOperator: 'equals',
                        crmFilterValue: 'vip',
                        crmPhoneField: 'phone',
                        crmResultLimit: 25
                    },
                    position: { x: 100, y: 0 }
                },
                {
                    id: 'node-3',
                    type: 'stop',
                    data: { label: 'Fim' },
                    position: { x: 200, y: 0 }
                }
            ],
            edges: [
                { source: 'node-1', target: 'node-2' },
                { source: 'node-2', target: 'node-3' }
            ],
            startNodeId: 'node-1'
        }

        const context: FlowExecutionContext = {
            flowId: 'flow-hubspot-campaign',
            userId: 'user-1',
            userEmail: 'user@example.com',
            data: {},
            executionHistory: []
        }

        const executor = new FlowExecutor(flowData, context)
        const result = await executor.execute()

        expect(searchHubSpotContacts).toHaveBeenCalledWith(
            'crm-int-1',
            25,
            undefined,
            ['firstname', 'lastname', 'email', 'phone', 'segment'],
            [{ field: 'segment', operator: 'equals', value: 'vip' }]
        )
        expect(result.executionHistory[1].output).toEqual(expect.objectContaining({
            kind: 'hubspot_contacts',
            crmIntegrationId: 'crm-int-1',
            matchedContacts: 2,
            contactsWithPhone: 1,
            contactsReadyForCampaign: 1,
            skippedNoPhoneCount: 1
        }))
        expect(result.data.audience_count).toBe(2)
        expect(result.data.audience_source).toBe('hubspot')
        expect(Array.isArray(result.data.audience_contacts)).toBe(true)
        expect(result.data.audience_contacts?.[0]).toEqual(expect.objectContaining({
            external_id: 'hs-1',
            email: 'mateus@example.com',
            phone: '+55 (11) 99999-1111',
            source: 'hubspot'
        }))
        expect(createOrUpdateContactMock).toHaveBeenCalledWith({
            lid: 'hubspot:crm-int-1:hs-1',
            phone_number: '5511999991111',
            status: 'active'
        })
        expect(result.data.whatsapp_campaign_contact_ids).toHaveLength(1)
        expect(result.data.sampleRecipients?.[0]).toEqual(expect.objectContaining({
            hubspotContactId: 'hs-1',
            email: 'mateus@example.com',
            name: 'Mateus Mantovani'
        }))
    })

    it('deve pausar no bloco schedule em modo live e criar job de retomada', async () => {
        const flowData: FlowData = {
            nodes: [
                { id: 'node-1', type: 'start', data: { label: 'Inicio' }, position: { x: 0, y: 0 } },
                {
                    id: 'node-2',
                    type: 'schedule',
                    data: {
                        label: 'Agendar amanha',
                        scheduleAt: '2026-05-13T09:00',
                        scheduleTimezone: 'America/Sao_Paulo'
                    },
                    position: { x: 120, y: 0 }
                },
                { id: 'node-3', type: 'stop', data: { label: 'Fim' }, position: { x: 240, y: 0 } }
            ],
            edges: [
                { source: 'node-1', target: 'node-2' },
                { source: 'node-2', target: 'node-3' }
            ],
            startNodeId: 'node-1'
        }

        const context: FlowExecutionContext = {
            flowId: 'flow-schedule-live',
            userId: 'user-1',
            userEmail: 'user@example.com',
            data: {
                __flow_execution_mode: 'live'
            },
            executionHistory: []
        }

        const executor = new FlowExecutor(flowData, context)
        const result = await executor.execute()

        expect(resolveScheduledAtToUtcIso).toHaveBeenCalledWith({
            rawValue: '2026-05-13T09:00',
            preferredTimezone: 'America/Sao_Paulo',
            userId: 'user-1',
            userEmail: 'user@example.com'
        })
        expect(enqueueFlowResumeJobs).toHaveBeenCalledWith(expect.objectContaining({
            flowId: 'flow-schedule-live',
            userEmail: 'user@example.com',
            resumeNodeIds: ['node-3'],
            scheduledAtIso: '2026-05-13T12:00:00.000Z',
            triggerSource: 'schedule'
        }))
        expect(result.data.__flow_paused_for_schedule).toBe(true)
        expect(result.data.__flow_paused_until).toBe('2026-05-13T12:00:00.000Z')
        expect(result.executionHistory[1].output).toEqual(expect.objectContaining({
            kind: 'schedule',
            paused: true,
            scheduledAt: '2026-05-13T12:00:00.000Z',
            timezone: 'America/Sao_Paulo'
        }))
    })

    it('deve simular campanha de template WhatsApp em audiencia no modo teste', async () => {
        const flowData: FlowData = {
            nodes: [
                { id: 'node-1', type: 'start', data: { label: 'Inicio' }, position: { x: 0, y: 0 } },
                {
                    id: 'node-2',
                    type: 'wa_template',
                    data: {
                        label: 'Template reativacao',
                        waTemplateName: 'reativacao',
                        waTemplateLanguage: 'pt_BR',
                        waIntegrationId: 'integration-1',
                        waTemplateComponents: [{ type: 'body', parameters: [] }]
                    },
                    position: { x: 100, y: 0 }
                },
                { id: 'node-3', type: 'stop', data: { label: 'Fim' }, position: { x: 200, y: 0 } }
            ],
            edges: [
                { source: 'node-1', target: 'node-2' },
                { source: 'node-2', target: 'node-3' }
            ],
            startNodeId: 'node-1'
        }

        const context: FlowExecutionContext = {
            flowId: 'flow-wa-template-audience-test',
            userId: 'user-1',
            userEmail: 'user@example.com',
            data: {
                __flow_execution_mode: 'test',
                whatsapp_campaign_contact_ids: ['contact-1', 'contact-2']
            },
            executionHistory: []
        }

        const executor = new FlowExecutor(flowData, context)
        const result = await executor.execute()

        expect(createCampaignRecord).not.toHaveBeenCalled()
        expect(enqueueCampaignContacts).not.toHaveBeenCalled()
        expect(result.executionHistory[1].output).toEqual(expect.objectContaining({
            kind: 'wa_template_campaign',
            campaignContacts: 2,
            enqueuedContacts: 0,
            simulated: true
        }))
    })

    it('deve executar crm_contact em lookup e retornar paciente existente', async () => {
        vi.mocked(searchHubSpotContacts).mockResolvedValueOnce([
            {
                id: 'hs-existing',
                firstname: 'Maria',
                lastname: 'Souza',
                email: 'maria@example.com',
                phone: '5511999990000',
                properties: {
                    firstname: 'Maria',
                    lastname: 'Souza',
                    email: 'maria@example.com',
                    phone: '5511999990000',
                    cpf: '12345678900'
                }
            }
        ])

        const flowData: FlowData = {
            nodes: [
                { id: 'node-1', type: 'start', data: { label: 'Inicio' }, position: { x: 0, y: 0 } },
                {
                    id: 'node-2',
                    type: 'crm_contact',
                    data: {
                        label: 'Consultar paciente',
                        crmOperation: 'lookup',
                        crmIntegrationId: 'crm-int-1',
                        lookupFields: ['patient_email']
                    },
                    position: { x: 120, y: 0 }
                },
                { id: 'node-3', type: 'stop', data: { label: 'Fim' }, position: { x: 240, y: 0 } }
            ],
            edges: [
                { source: 'node-1', target: 'node-2' },
                { source: 'node-2', target: 'node-3' }
            ],
            startNodeId: 'node-1'
        }

        const context: FlowExecutionContext = {
            flowId: 'flow-crm-contact',
            userId: 'user-1',
            userEmail: 'user@example.com',
            data: {
                patient_email: 'maria@example.com'
            },
            executionHistory: []
        }

        const executor = new FlowExecutor(flowData, context)
        const result = await executor.execute()

        expect(result.executionHistory[1].output).toEqual(expect.objectContaining({
            kind: 'crm_contact',
            status: 'existing',
            patient_id: 'hs-existing',
            patient_lookup_status: 'existing'
        }))
        expect(result.data.patient_name).toBe('Maria Souza')
    })

    it('deve executar appointment availability e publicar slots no contexto', async () => {
        getAvailabilityMock.mockResolvedValueOnce([
            {
                slotId: 'slot-1',
                startsAt: '2026-05-14T12:00:00.000Z',
                endsAt: '2026-05-14T12:30:00.000Z',
                specialty: 'cardiologia',
                doctor: 'Dra. Ana',
                consultationType: 'online',
                unit: 'Unidade Central',
                period: 'tarde',
                timezone: 'America/Sao_Paulo',
                mode: 'online',
                location: 'https://calendly.example/room/slot-1',
                provider: 'calendly',
            }
        ])

        const flowData: FlowData = {
            nodes: [
                { id: 'node-1', type: 'start', data: { label: 'Inicio' }, position: { x: 0, y: 0 } },
                {
                    id: 'node-2',
                    type: 'appointment',
                    data: {
                        label: 'Buscar horários',
                        appointmentOperation: 'availability',
                        appointmentProvider: 'calendly',
                        specialtyField: 'specialty'
                    },
                    position: { x: 120, y: 0 }
                },
                { id: 'node-3', type: 'stop', data: { label: 'Fim' }, position: { x: 240, y: 0 } }
            ],
            edges: [
                { source: 'node-1', target: 'node-2' },
                { source: 'node-2', target: 'node-3' }
            ],
            startNodeId: 'node-1'
        }

        const context: FlowExecutionContext = {
            flowId: 'flow-appointment-availability',
            userId: 'user-1',
            userEmail: 'user@example.com',
            data: {
                specialty: 'cardiologia'
            },
            executionHistory: []
        }

        const executor = new FlowExecutor(flowData, context)
        const result = await executor.execute()

        expect(getAvailabilityMock).toHaveBeenCalled()
        expect(result.executionHistory[1].output).toEqual(expect.objectContaining({
            kind: 'appointment',
            appointment_status: 'available'
        }))
        expect(Array.isArray(result.data.appointment_slots)).toBe(true)
        expect(result.data.appointment_slots?.[0]?.slotId).toBe('slot-1')
    })

    it('deve executar document_intake sem arquivo e manter status pending_upload', async () => {
        const flowData: FlowData = {
            nodes: [
                { id: 'node-1', type: 'start', data: { label: 'Inicio' }, position: { x: 0, y: 0 } },
                {
                    id: 'node-2',
                    type: 'document_intake',
                    data: {
                        label: 'Receber exames',
                        documentKinds: ['exam', 'document'],
                        notifyTeam: true,
                        acceptWithoutFile: false
                    },
                    position: { x: 120, y: 0 }
                },
                { id: 'node-3', type: 'stop', data: { label: 'Fim' }, position: { x: 240, y: 0 } }
            ],
            edges: [
                { source: 'node-1', target: 'node-2' },
                { source: 'node-2', target: 'node-3' }
            ],
            startNodeId: 'node-1'
        }

        const context: FlowExecutionContext = {
            flowId: 'flow-document-intake',
            userId: 'user-1',
            userEmail: 'user@example.com',
            data: {},
            executionHistory: []
        }

        const executor = new FlowExecutor(flowData, context)
        const result = await executor.execute()

        expect(result.executionHistory[1].output).toEqual(expect.objectContaining({
            kind: 'document_intake',
            document_status: 'pending_upload'
        }))
        expect(result.data.document_status).toBe('pending_upload')
    })

    it('deve executar human_handoff e expor resposta final ao paciente', async () => {
        const flowData: FlowData = {
            nodes: [
                { id: 'node-1', type: 'start', data: { label: 'Inicio' }, position: { x: 0, y: 0 } },
                {
                    id: 'node-2',
                    type: 'human_handoff',
                    data: {
                        label: 'Transferir humano',
                        handoffReasonField: 'handoff_reason',
                        handoffPriority: 'high',
                        notifyEmail: 'recepcao@clinica.com.br',
                        patientMessage: 'Nossa equipe humana continuará o atendimento em instantes.'
                    },
                    position: { x: 120, y: 0 }
                },
                { id: 'node-3', type: 'stop', data: { label: 'Fim' }, position: { x: 240, y: 0 } }
            ],
            edges: [
                { source: 'node-1', target: 'node-2' },
                { source: 'node-2', target: 'node-3' }
            ],
            startNodeId: 'node-1'
        }

        const context: FlowExecutionContext = {
            flowId: 'flow-human-handoff',
            userId: 'user-1',
            userEmail: 'user@example.com',
            data: {
                handoff_reason: 'Paciente solicitou atendente',
                patient_name: 'Paciente Teste'
            },
            executionHistory: []
        }

        const executor = new FlowExecutor(flowData, context)
        const result = await executor.execute()

        expect(sendEmailForUserMock).toHaveBeenCalled()
        expect(result.executionHistory[1].output).toEqual(expect.objectContaining({
            kind: 'human_handoff',
            response: 'Nossa equipe humana continuará o atendimento em instantes.'
        }))
    })

    it('deve executar subflow e mesclar o contexto no fluxo principal', async () => {
        const subFlowData: FlowData = {
            nodes: [
                { id: 'sub-start', type: 'start', data: { label: 'Início subfluxo' }, position: { x: 0, y: 0 } },
                { id: 'sub-agent', type: 'agent', data: { label: 'Agente subfluxo', agentId: 'agent-sub' }, position: { x: 120, y: 0 } },
                { id: 'sub-stop', type: 'stop', data: { label: 'Fim subfluxo' }, position: { x: 240, y: 0 } }
            ],
            edges: [
                { source: 'sub-start', target: 'sub-agent' },
                { source: 'sub-agent', target: 'sub-stop' }
            ],
            startNodeId: 'sub-start'
        }

        ;((supabase as any).single as any).mockResolvedValueOnce({
            data: { nome: 'Subfluxo Teste', nodes: subFlowData },
            error: null
        })

        const flowData: FlowData = {
            nodes: [
                { id: 'node-1', type: 'start', data: { label: 'Início' }, position: { x: 0, y: 0 } },
                {
                    id: 'node-2',
                    type: 'subflow',
                    data: {
                        label: 'Executar subfluxo',
                        subflowId: 'flow-child',
                        subflowResultKey: 'child_result'
                    },
                    position: { x: 120, y: 0 }
                },
                { id: 'node-3', type: 'stop', data: { label: 'Fim' }, position: { x: 240, y: 0 } }
            ],
            edges: [
                { source: 'node-1', target: 'node-2' },
                { source: 'node-2', target: 'node-3' }
            ],
            startNodeId: 'node-1'
        }

        const context: FlowExecutionContext = {
            flowId: 'flow-parent',
            userId: 'user-1',
            userEmail: 'user@example.com',
            data: { message: 'Olá' },
            executionHistory: []
        }

        const executor = new FlowExecutor(flowData, context)
        const result = await executor.execute()

        expect(chatWithAgent).toHaveBeenCalledWith(
            'user@example.com',
            'agent-sub',
            expect.any(String),
            expect.objectContaining({ message: 'Olá' })
        )
        expect(result.data.child_result).toEqual(expect.objectContaining({
            status: 'completed',
            flowId: 'flow-child',
            flowName: 'Subfluxo Teste'
        }))
        expect(result.data.subflow_status).toBe('completed')
        expect(result.executionHistory.some((entry) => entry.nodeId === 'sub-agent')).toBe(true)
    })
})
