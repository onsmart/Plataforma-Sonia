export interface EmailMessage {
    id: string
    from: string
    subject: string
    body: string
    receivedAt: string
  }
  
  export interface EmailReader {
    listMessages(): Promise<EmailMessage[]>
    getMessage(id: string): Promise<EmailMessage>
  }
  