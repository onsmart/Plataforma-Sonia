"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const flow_executor_1 = require("../services/flows/flow-executor");
const chatwithAgent_1 = require("../services/agents/chatwithAgent");
const whatsapp_flow_message_service_1 = require("../services/integrations/whatsapp/whatsapp-flow-message.service");
const email_service_1 = require("../services/integrations/email/email.service");
const mail_1 = require("../services/integrations/mail");
// Mocking dependencies to avoid real side effects and environment check errors
vitest_1.vi.mock('../lib/logger', () => ({
    default: {
        info: vitest_1.vi.fn(),
        log: vitest_1.vi.fn(),
        error: vitest_1.vi.fn(),
        warn: vitest_1.vi.fn()
    }
}));
vitest_1.vi.mock('../lib/supabase', () => ({
    supabase: {
        from: vitest_1.vi.fn().mockReturnThis(),
        select: vitest_1.vi.fn().mockReturnThis(),
        eq: vitest_1.vi.fn().mockReturnThis(),
        rpc: vitest_1.vi.fn().mockResolvedValue({ data: [] }),
        maybeSingle: vitest_1.vi.fn().mockResolvedValue({ data: { nome: 'Mock Agent' } }),
        single: vitest_1.vi.fn().mockResolvedValue({ data: { nodes: [] } })
    }
}));
vitest_1.vi.mock('../services/flows/fallback-events', () => ({
    saveFallbackEvent: vitest_1.vi.fn().mockResolvedValue(true)
}));
vitest_1.vi.mock('../services/system-logs', () => ({
    saveSystemLog: vitest_1.vi.fn().mockResolvedValue(true)
}));
vitest_1.vi.mock('../services/agents/chatwithAgent', () => ({
    chatWithAgent: vitest_1.vi.fn().mockResolvedValue('Mocked response')
}));
vitest_1.vi.mock('../services/flows/flow-template-runner', () => ({
    executeFlowTemplateNode: vitest_1.vi.fn().mockResolvedValue('{"intent":"agendamento"}')
}));
vitest_1.vi.mock('../services/integrations/whatsapp/whatsapp-flow-message.service', () => ({
    sendFlowWhatsAppMessage: vitest_1.vi.fn().mockResolvedValue({
        success: true,
        sendMode: 'normal',
    })
}));
vitest_1.vi.mock('../services/integrations/email/email.service', () => ({
    sendEmail: vitest_1.vi.fn().mockResolvedValue({
        provider: 'smtp'
    })
}));
vitest_1.vi.mock('../services/integrations/mail', () => ({
    readInboxMessages: vitest_1.vi.fn().mockResolvedValue([])
}));
(0, vitest_1.describe)('FlowExecutor Smoke Test', () => {
    (0, vitest_1.it)('deve executar um flow mínimo (start -> stop) com sucesso', async () => {
        const flowData = {
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
        };
        const context = {
            flowId: 'test-flow-id',
            userId: 'test-user-id',
            userEmail: 'test@example.com',
            data: {},
            executionHistory: []
        };
        const executor = new flow_executor_1.FlowExecutor(flowData, context);
        const result = await executor.execute();
        // Verificações básicas
        (0, vitest_1.expect)(result).toBeDefined();
        (0, vitest_1.expect)(result.executionHistory).toHaveLength(2);
        (0, vitest_1.expect)(result.executionHistory[0].nodeId).toBe('node-1');
        (0, vitest_1.expect)(result.executionHistory[1].nodeId).toBe('node-2');
        (0, vitest_1.expect)(result.executionHistory[1].output).toEqual({ stopped: true });
    });
    (0, vitest_1.it)('deve falhar se o node inicial não for encontrado', async () => {
        const flowData = {
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
        };
        const context = {
            flowId: 'test-flow-id',
            userId: 'test-user-id',
            userEmail: 'test@example.com',
            data: {},
            executionHistory: []
        };
        const executor = new flow_executor_1.FlowExecutor(flowData, context);
        await (0, vitest_1.expect)(executor.execute()).rejects.toThrow(/startNodeId .* não corresponde a nenhum node/);
    });
    (0, vitest_1.it)('deve executar um node agent em modo template sem exigir agentId', async () => {
        const flowData = {
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
        };
        const context = {
            flowId: 'test-flow-id',
            userId: 'test-user-id',
            userEmail: 'test@example.com',
            data: { message: 'Quero agendar uma consulta' },
            executionHistory: []
        };
        const executor = new flow_executor_1.FlowExecutor(flowData, context);
        const result = await executor.execute();
        (0, vitest_1.expect)(result.executionHistory).toHaveLength(3);
        (0, vitest_1.expect)(result.executionHistory[1].executionMode).toBe('template');
        (0, vitest_1.expect)(result.executionHistory[1].agentId).toBeUndefined();
        (0, vitest_1.expect)(result.executionHistory[1].templateId).toBe('template-123');
        (0, vitest_1.expect)(result.data.intent).toBe('agendamento');
    });
    (0, vitest_1.it)('deve executar um node agent legado usando agentId', async () => {
        const flowData = {
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
        };
        const context = {
            flowId: 'test-flow-id',
            userId: 'test-user-id',
            userEmail: 'test@example.com',
            data: { message: 'Teste legado' },
            executionHistory: []
        };
        const executor = new flow_executor_1.FlowExecutor(flowData, context);
        const result = await executor.execute();
        (0, vitest_1.expect)(chatwithAgent_1.chatWithAgent).toHaveBeenCalledWith('test@example.com', 'agent-123', vitest_1.expect.any(String), vitest_1.expect.objectContaining({ message: 'Teste legado' }));
        (0, vitest_1.expect)(result.executionHistory[1].executionMode).toBe('agent');
        (0, vitest_1.expect)(result.executionHistory[1].agentId).toBe('agent-123');
    });
    (0, vitest_1.it)('deve executar node debug sem alterar context.data com saída do debug', async () => {
        const flowData = {
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
        };
        const context = {
            flowId: 'test-flow-id',
            userId: 'test-user-id',
            userEmail: 'test@example.com',
            data: { foo: 'bar', secret: 42 },
            executionHistory: []
        };
        const executor = new flow_executor_1.FlowExecutor(flowData, context);
        const result = await executor.execute();
        (0, vitest_1.expect)(result.data.foo).toBe('bar');
        (0, vitest_1.expect)(result.data.secret).toBe(42);
        (0, vitest_1.expect)(result.data.kind).toBeUndefined();
        (0, vitest_1.expect)(result.data.snapshot).toBeUndefined();
        const debugStep = result.executionHistory.find((h) => h.nodeId === 'node-2');
        (0, vitest_1.expect)(debugStep).toBeDefined();
        (0, vitest_1.expect)(debugStep?.success).toBe(true);
        (0, vitest_1.expect)(debugStep?.output?.kind).toBe('debug');
        (0, vitest_1.expect)(debugStep?.output?.snapshot).toEqual({ foo: 'bar' });
        (0, vitest_1.expect)(debugStep?.input).toEqual({ keysRequested: ['foo'] });
        (0, vitest_1.expect)(debugStep?.nodeType).toBe('debug');
        (0, vitest_1.expect)(debugStep?.startedAt).toBeDefined();
        (0, vitest_1.expect)(debugStep?.finishedAt).toBeDefined();
    });
    (0, vitest_1.it)('deve executar o novo bloco Enviar mensagem WhatsApp e marcar entrega interna', async () => {
        const flowData = {
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
        };
        const context = {
            flowId: 'flow-wa',
            userId: 'user-1',
            userEmail: 'user@example.com',
            data: {
                integrations_id: 'integration-1',
                whatsapp_contact_id: 'contact-1'
            },
            executionHistory: []
        };
        const executor = new flow_executor_1.FlowExecutor(flowData, context);
        const result = await executor.execute();
        (0, vitest_1.expect)(whatsapp_flow_message_service_1.sendFlowWhatsAppMessage).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
            integrationsId: 'integration-1',
            to: 'contact-1',
            messageType: 'buttons',
            messageText: 'Como posso ajudar?'
        }));
        (0, vitest_1.expect)(result.data.__flow_whatsapp_outbound_already_sent).toBe(true);
        (0, vitest_1.expect)(result.executionHistory[1].output).toEqual(vitest_1.expect.objectContaining({
            kind: 'whatsapp_message',
            sendMode: 'normal'
        }));
    });
    (0, vitest_1.it)('deve executar o bloco email_send com templates do contexto', async () => {
        const flowData = {
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
        };
        const context = {
            flowId: 'flow-email-send',
            userId: 'user-1',
            userEmail: 'user@example.com',
            data: {
                lead_email: 'mateus.mantovani@onsmart.com.br',
                lead_name: 'Mateus',
                protocol_number: 'ABC-123'
            },
            executionHistory: []
        };
        const executor = new flow_executor_1.FlowExecutor(flowData, context);
        const result = await executor.execute();
        (0, vitest_1.expect)(email_service_1.sendEmail).toHaveBeenCalledWith('integration-email-1', {
            to: 'mateus.mantovani@onsmart.com.br',
            subject: 'Ola, Mateus',
            text: 'Seu protocolo e ABC-123'
        });
        (0, vitest_1.expect)(result.executionHistory[1].output).toEqual(vitest_1.expect.objectContaining({
            kind: 'email_send',
            integrationId: 'integration-email-1',
            provider: 'smtp'
        }));
    });
    (0, vitest_1.it)('deve executar o bloco email_read e retornar mensagens no historico', async () => {
        vitest_1.vi.mocked(mail_1.readInboxMessages).mockResolvedValueOnce([
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
        ]);
        const flowData = {
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
        };
        const context = {
            flowId: 'flow-email-read',
            userId: 'user-1',
            userEmail: 'user@example.com',
            data: {},
            executionHistory: []
        };
        const executor = new flow_executor_1.FlowExecutor(flowData, context);
        const result = await executor.execute();
        (0, vitest_1.expect)(mail_1.readInboxMessages).toHaveBeenCalledWith('integration-email-1', 3);
        (0, vitest_1.expect)(result.executionHistory[1].output).toEqual(vitest_1.expect.objectContaining({
            kind: 'email_read',
            total: 1
        }));
        (0, vitest_1.expect)(result.executionHistory[1].output?.messages?.[0]?.subject).toBe('Primeiro email');
    });
});
