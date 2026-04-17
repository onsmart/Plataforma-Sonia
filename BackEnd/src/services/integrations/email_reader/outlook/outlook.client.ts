import axios from 'axios'
import { buildEmailHtml } from '../../email/buildEmailHtml'

export class OutlookClient {
  private baseUrl = 'https://graph.microsoft.com/v1.0'
  private accessToken: string

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  async getInboxMessages(limit = 5) {
    const response = await axios.get(
      `${this.baseUrl}/me/mailFolders/inbox/messages?$top=${limit}&$orderby=receivedDateTime desc`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    )

    return response.data
  }

  async getMessage(messageId: string) {
    const response = await axios.get(`${this.baseUrl}/me/messages/${messageId}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    })

    return response.data
  }

  async getCurrentMailbox() {
    const response = await axios.get(`${this.baseUrl}/me`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    })

    return response.data
  }

  async sendMail(data: {
    to: string
    subject: string
    text?: string
    html?: string
    style?: string
    visual_style?: string
  }) {
    console.log('[OutlookClient.sendMail] 📧 Iniciando envio de email:', {
      to: data.to,
      subject: data.subject,
      hasText: !!data.text,
      hasHtml: !!data.html,
      hasStyle: !!(data.style || data.visual_style)
    })

    // Se tiver style ou visual_style, gera HTML
    let finalHtml: string | undefined
    let finalText: string | undefined

    if (data.style || data.visual_style) {
      finalHtml = buildEmailHtml(data.text || '', data.style || data.visual_style)
      console.log('[OutlookClient.sendMail] HTML gerado com estilo:', data.style || data.visual_style)
    } else if (data.html) {
      finalHtml = data.html
    } else if (data.text) {
      finalText = data.text
    }

    const body: any = {
      message: {
        subject: data.subject,
        body: {
          contentType: finalHtml ? 'HTML' : 'Text',
          content: finalHtml || finalText || ''
        },
        toRecipients: [
          {
            emailAddress: {
              address: data.to
            }
          }
        ]
      },
      saveToSentItems: true
    }

    console.log('[OutlookClient.sendMail] 📤 Enviando para Microsoft Graph API...')

    try {
      const response = await axios.post(
        `${this.baseUrl}/me/sendMail`,
        body,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      )

      console.log('[OutlookClient.sendMail] ✅ Email enviado com sucesso via Graph API!', {
        status: response.status,
        to: data.to,
        subject: data.subject
      })

      return response.data
    } catch (error: any) {
      console.error('[OutlookClient.sendMail] ❌ Erro ao enviar email:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.message,
        to: data.to,
        subject: data.subject
      })
      throw error
    }
  }
}
