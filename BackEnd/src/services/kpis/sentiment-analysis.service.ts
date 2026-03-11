import logger from '../../lib/logger'

/**
 * Analisa sentimento de uma mensagem usando OpenAI
 * Retorna score de -1 (negativo) a 1 (positivo)
 */
export async function analyzeSentiment(message: string): Promise<number> {
  try {
    if (!message || message.trim().length === 0) {
      return 0 // Neutro se mensagem vazia
    }

    // Se não tiver OpenAI configurado, usa análise heurística simples
    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      logger.warn('[analyzeSentiment] OpenAI API key não configurada, usando análise heurística')
      return analyzeSentimentHeuristic(message)
    }

    // Usa OpenAI para análise de sentimento
    const { default: OpenAI } = await import('openai')
    const openai = new OpenAI({ apiKey: openaiApiKey })

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Modelo mais barato para análise de sentimento
      messages: [
        {
          role: 'system',
          content: 'Você é um analisador de sentimento. Analise a mensagem e retorne APENAS um número entre -1 e 1, onde -1 é muito negativo, 0 é neutro, e 1 é muito positivo. Retorne apenas o número, sem explicações.'
        },
        {
          role: 'user',
          content: message
        }
      ],
      temperature: 0.3,
      max_tokens: 10
    })

    const sentimentText = response.choices[0]?.message?.content?.trim()
    if (!sentimentText) {
      return analyzeSentimentHeuristic(message)
    }

    // Tenta extrair número da resposta
    const sentimentMatch = sentimentText.match(/-?\d+\.?\d*/)
    if (sentimentMatch) {
      const sentiment = parseFloat(sentimentMatch[0])
      // Garante que está entre -1 e 1
      return Math.max(-1, Math.min(1, sentiment))
    }

    return analyzeSentimentHeuristic(message)
  } catch (error: any) {
    logger.error('[analyzeSentiment] Erro ao analisar sentimento com OpenAI:', error)
    // Fallback para análise heurística
    return analyzeSentimentHeuristic(message)
  }
}

/**
 * Análise heurística simples de sentimento
 * Usa palavras-chave para determinar sentimento
 */
function analyzeSentimentHeuristic(message: string): number {
  const lowerMessage = message.toLowerCase()

  // Palavras positivas
  const positiveWords = [
    'obrigado', 'obrigada', 'obrigad', 'grato', 'gratidão', 'perfeito', 'excelente',
    'ótimo', 'bom', 'bem', 'legal', 'show', 'top', 'incrível', 'fantástico',
    'maravilhoso', 'adorei', 'amei', 'satisfeito', 'feliz', 'alegre', 'content',
    'resolvido', 'resolvi', 'ajudou', 'ajuda', 'sucesso', 'funcionou', 'ok', 'okay'
  ]

  // Palavras negativas
  const negativeWords = [
    'ruim', 'péssimo', 'horrível', 'terrível', 'não gostei', 'odiei', 'detestei',
    'insatisfeito', 'triste', 'chateado', 'bravo', 'irritado', 'frustrado',
    'problema', 'erro', 'falha', 'não funciona', 'não funcionou', 'não resolveu',
    'desapontado', 'decepcionado', 'pior', 'horror', 'péssimo', 'lixo', 'merda'
  ]

  let positiveCount = 0
  let negativeCount = 0

  for (const word of positiveWords) {
    if (lowerMessage.includes(word)) {
      positiveCount++
    }
  }

  for (const word of negativeWords) {
    if (lowerMessage.includes(word)) {
      negativeCount++
    }
  }

  // Calcula score: -1 a 1
  if (positiveCount === 0 && negativeCount === 0) {
    return 0 // Neutro
  }

  const total = positiveCount + negativeCount
  const score = (positiveCount - negativeCount) / Math.max(total, 1)

  // Normaliza para -1 a 1
  return Math.max(-1, Math.min(1, score))
}
