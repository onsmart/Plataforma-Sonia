import { useCallback } from 'react'
import { toast } from 'sonner'

/**
 * Hook para tratamento de erros assíncronos
 * O ErrorBoundary do React não captura erros em:
 * - Event handlers
 * - Requisições assíncronas
 * - setTimeout/setInterval
 * - Durante renderização de componentes filhos
 * 
 * Use este hook para capturar esses erros
 */
export function useErrorHandler() {
  const handleError = useCallback((error: unknown, context?: string) => {
    // Log do erro
    console.error(`[ErrorHandler]${context ? ` [${context}]` : ''} Erro capturado:`, error)

    // Determinar mensagem amigável
    let message = 'Ocorreu um erro inesperado. Tente novamente.'

    if (error instanceof Error) {
      // Erros de rede
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        message = 'Erro de conexão. Verifique sua internet e tente novamente.'
      }
      // Erros de autenticação
      else if (error.message.includes('Unauthorized') || error.message.includes('401')) {
        message = 'Sua sessão expirou. Por favor, faça login novamente.'
      }
      // Erros de servidor
      else if (error.message.includes('500') || error.message.includes('Internal Server Error')) {
        message = 'Erro no servidor. Nossa equipe foi notificada. Tente novamente em alguns instantes.'
      }
      // Outros erros
      else if (error.message) {
        message = error.message
      }
    } else if (typeof error === 'string') {
      message = error
    }

    // Mostrar toast de erro
    toast.error(message, {
      duration: 5000,
    })

    // Aqui você pode enviar o erro para um serviço de monitoramento
    // Ex: Sentry, LogRocket, etc.
    // if (window.Sentry) {
    //   window.Sentry.captureException(error, { tags: { context } })
    // }
  }, [])

  return { handleError }
}

/**
 * Wrapper para funções assíncronas que automaticamente trata erros
 */
export function withErrorHandler<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: string
): T {
  const { handleError } = useErrorHandler()
  
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args)
    } catch (error) {
      handleError(error, context)
      throw error // Re-throw para que o caller possa tratar se necessário
    }
  }) as T
}
