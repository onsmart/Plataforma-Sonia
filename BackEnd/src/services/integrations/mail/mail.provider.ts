import {
  CanonicalMailMessage,
  MailConnectionTestResult,
  MailIntegrationConfig,
  MailSendInput,
  MailSendResult,
} from './mail.types'

export interface MailReader {
  listMessages(limit?: number): Promise<CanonicalMailMessage[]>
  getMessage(messageId: string): Promise<CanonicalMailMessage>
}

export interface MailSender {
  send(input: MailSendInput): Promise<MailSendResult>
}

export interface MailConnectionTester {
  testConnection(): Promise<MailConnectionTestResult>
}

export interface MailProvider {
  readonly config: MailIntegrationConfig
  readonly reader?: MailReader
  readonly sender?: MailSender
  readonly tester: MailConnectionTester
}

