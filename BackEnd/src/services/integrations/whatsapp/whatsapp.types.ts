export interface SendWhatsAppInput {
  to: string // Número de telefone do destinatário (formato: 5511999999999)
  message: string // Mensagem a ser enviada
}

export interface EvolutionAPIConfig {
  apiUrl: string
  apiKey: string
  instanceName: string
}
