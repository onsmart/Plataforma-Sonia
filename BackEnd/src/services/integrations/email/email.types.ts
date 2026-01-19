export interface EmailCredentials {
    email: string
    smtp_host: string
    smtp_port: number
    app_key: string
  }
  
  export interface SendEmailInput {
    to: string
    subject: string
    text?: string
    html?: string
    style?: string // Estilo visual para gerar HTML (ex: "colorido_com_emojis")
    visual_style?: string // Alias para style (usado pelo chatWithAgent)
  }
  