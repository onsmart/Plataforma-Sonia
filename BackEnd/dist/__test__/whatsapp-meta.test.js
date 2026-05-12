"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const whatsapp_meta_1 = require("../services/integrations/whatsapp/whatsapp.meta");
const META_TEST_BUSINESS_NUMBER = '0000000000';
(0, vitest_1.describe)('WhatsApp Meta helpers', () => {
    (0, vitest_1.it)('deve validar o handshake do webhook da Meta', () => {
        const result = (0, whatsapp_meta_1.validateMetaWebhookVerification)({
            'hub.mode': 'subscribe',
            'hub.verify_token': 'token-ok',
            'hub.challenge': '12345'
        }, 'token-ok');
        (0, vitest_1.expect)(result.ok).toBe(true);
        (0, vitest_1.expect)(result.challenge).toBe('12345');
        (0, vitest_1.expect)(result.status).toBe(200);
    });
    (0, vitest_1.it)('deve rejeitar o handshake com token invalido', () => {
        const result = (0, whatsapp_meta_1.validateMetaWebhookVerification)({
            'hub.mode': 'subscribe',
            'hub.verify_token': 'token-ruim',
            'hub.challenge': '12345'
        }, 'token-ok');
        (0, vitest_1.expect)(result.ok).toBe(false);
        (0, vitest_1.expect)(result.status).toBe(403);
    });
    (0, vitest_1.it)('deve extrair mensagens do payload oficial da Meta', () => {
        const payload = {
            object: 'whatsapp_business_account',
            entry: [
                {
                    changes: [
                        {
                            field: 'messages',
                            value: {
                                messaging_product: 'whatsapp',
                                metadata: {
                                    display_phone_number: '+00 0000-0000',
                                    phone_number_id: '1234567890'
                                },
                                messages: [
                                    {
                                        from: '5511999999999',
                                        id: 'wamid.abc',
                                        timestamp: '1710000000',
                                        type: 'text',
                                        text: {
                                            body: 'Teste oficial Meta'
                                        }
                                    }
                                ]
                            }
                        }
                    ]
                }
            ]
        };
        const messages = (0, whatsapp_meta_1.extractMetaWebhookMessages)(payload);
        (0, vitest_1.expect)(messages).toHaveLength(1);
        (0, vitest_1.expect)(messages[0].instance).toBe(META_TEST_BUSINESS_NUMBER);
        (0, vitest_1.expect)(messages[0].remoteJid).toBe('5511999999999@s.whatsapp.net');
        (0, vitest_1.expect)(messages[0].messageText).toBe('Teste oficial Meta');
        (0, vitest_1.expect)(messages[0].phoneNumberId).toBe('1234567890');
        (0, vitest_1.expect)(messages[0].nativeMessageType).toBe('text');
    });
    (0, vitest_1.it)('deve extrair chamadas recebidas com SDP do payload oficial da Meta', () => {
        const payload = {
            object: 'whatsapp_business_account',
            entry: [
                {
                    changes: [
                        {
                            field: 'messages',
                            value: {
                                messaging_product: 'whatsapp',
                                metadata: {
                                    display_phone_number: '+55 11 4002-8922',
                                    phone_number_id: 'phone-number-id-1'
                                },
                                calls: [
                                    {
                                        id: 'wacid.call-1',
                                        from: '5511999999999',
                                        event: 'connect',
                                        timestamp: '1710000000',
                                        session: {
                                            sdp_type: 'offer',
                                            sdp: 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111'
                                        }
                                    }
                                ]
                            }
                        }
                    ]
                }
            ]
        };
        const calls = (0, whatsapp_meta_1.extractMetaWebhookCalls)(payload);
        (0, vitest_1.expect)(calls).toHaveLength(1);
        (0, vitest_1.expect)(calls[0]).toEqual(vitest_1.expect.objectContaining({
            callId: 'wacid.call-1',
            from: '5511999999999',
            event: 'connect',
            instance: '551140028922',
            phoneNumberId: 'phone-number-id-1',
            sdpOffer: 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111'
        }));
    });
});
