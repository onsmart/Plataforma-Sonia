import { createClient, RedisClientType } from 'redis'
import logger from './logger'

let redisClient: RedisClientType | null = null

/**
 * Cliente Redis reutilizável
 * Conecta automaticamente na primeira chamada
 */
export async function getRedisClient(): Promise<RedisClientType> {
  if (redisClient && redisClient.isOpen) {
    return redisClient
  }

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
  const redisPassword = process.env.REDIS_PASSWORD || undefined

  logger.log('[Redis] Conectando ao Redis...', {
    url: redisUrl.replace(/\/\/.*@/, '//***@'), // Ocultar senha no log
    hasPassword: !!redisPassword
  })

  try {
    redisClient = createClient({
      url: redisUrl,
      password: redisPassword,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('[Redis] ❌ Máximo de tentativas de reconexão atingido')
            return new Error('Máximo de tentativas atingido')
          }
          return Math.min(retries * 100, 3000) // Backoff exponencial
        }
      }
    })

    redisClient.on('error', (err) => {
      logger.error('[Redis] ❌ Erro no cliente Redis:', {
        error: err.message
      })
    })

    redisClient.on('connect', () => {
      logger.log('[Redis] 🔌 Conectando...')
    })

    redisClient.on('ready', () => {
      logger.log('[Redis] ✅ Conectado e pronto')
    })

    redisClient.on('reconnecting', () => {
      logger.log('[Redis] 🔄 Reconectando...')
    })

    await redisClient.connect()

    logger.log('[Redis] ✅ Cliente Redis conectado com sucesso')
    return redisClient
  } catch (error: any) {
    logger.error('[Redis] ❌ Erro ao conectar:', {
      error: error.message,
      url: redisUrl.replace(/\/\/.*@/, '//***@')
    })
    throw new Error(`Falha ao conectar ao Redis: ${error.message}`)
  }
}

/**
 * Fecha a conexão Redis (útil para testes ou shutdown)
 */
export async function closeRedisClient(): Promise<void> {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit()
    redisClient = null
    logger.log('[Redis] 🔌 Conexão fechada')
  }
}

/**
 * Verifica se Redis está disponível
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    const client = await getRedisClient()
    await client.ping()
    return true
  } catch (error) {
    return false
  }
}
