"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedisClient = getRedisClient;
exports.closeRedisClient = closeRedisClient;
exports.checkRedisHealth = checkRedisHealth;
const redis_1 = require("redis");
const logger_1 = __importDefault(require("./logger"));
let redisClient = null;
/**
 * Cliente Redis reutilizável
 * Conecta automaticamente na primeira chamada
 */
async function getRedisClient() {
    if (redisClient && redisClient.isOpen) {
        return redisClient;
    }
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const redisPassword = process.env.REDIS_PASSWORD || undefined;
    logger_1.default.log('[Redis] Conectando ao Redis...', {
        url: redisUrl.replace(/\/\/.*@/, '//***@'), // Ocultar senha no log
        hasPassword: !!redisPassword
    });
    try {
        redisClient = (0, redis_1.createClient)({
            url: redisUrl,
            password: redisPassword,
            socket: {
                reconnectStrategy: (retries) => {
                    if (retries > 10) {
                        logger_1.default.error('[Redis] ❌ Máximo de tentativas de reconexão atingido');
                        return new Error('Máximo de tentativas atingido');
                    }
                    return Math.min(retries * 100, 3000); // Backoff exponencial
                }
            }
        });
        redisClient.on('error', (err) => {
            logger_1.default.error('[Redis] ❌ Erro no cliente Redis:', {
                error: err.message
            });
        });
        redisClient.on('connect', () => {
            logger_1.default.log('[Redis] 🔌 Conectando...');
        });
        redisClient.on('ready', () => {
            logger_1.default.log('[Redis] ✅ Conectado e pronto');
        });
        redisClient.on('reconnecting', () => {
            logger_1.default.log('[Redis] 🔄 Reconectando...');
        });
        await redisClient.connect();
        logger_1.default.log('[Redis] ✅ Cliente Redis conectado com sucesso');
        return redisClient;
    }
    catch (error) {
        logger_1.default.error('[Redis] ❌ Erro ao conectar:', {
            error: error.message,
            url: redisUrl.replace(/\/\/.*@/, '//***@')
        });
        throw new Error(`Falha ao conectar ao Redis: ${error.message}`);
    }
}
/**
 * Fecha a conexão Redis (útil para testes ou shutdown)
 */
async function closeRedisClient() {
    if (redisClient && redisClient.isOpen) {
        await redisClient.quit();
        redisClient = null;
        logger_1.default.log('[Redis] 🔌 Conexão fechada');
    }
}
/**
 * Verifica se Redis está disponível
 */
async function checkRedisHealth() {
    try {
        const client = await getRedisClient();
        await client.ping();
        return true;
    }
    catch (error) {
        return false;
    }
}
