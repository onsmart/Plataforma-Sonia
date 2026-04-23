import axios from 'axios'
import { EmailReader, EmailMessage } from '../email-reader.interface'
import { getOutlookAccessToken, OutlookOAuthClientConfigInput } from './outlook.oauth'

export class OutlookEmailReader implements EmailReader {
  constructor(
    private refreshToken: string,
    private oauthConfig?: OutlookOAuthClientConfigInput
  ) {}

  private async client() {
    const accessToken = await getOutlookAccessToken(this.refreshToken, this.oauthConfig)

    return axios.create({
      baseURL: 'https://graph.microsoft.com/v1.0',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
  }

  async listMessages(): Promise<EmailMessage[]> {
    const api = await this.client()

    const { data } = await api.get('/me/mailFolders/inbox/messages?$top=10')

    return data.value.map((msg: any) => ({
      id: msg.id,
      from: msg.from.emailAddress.address,
      subject: msg.subject,
      body: msg.body.content,
      receivedAt: msg.receivedDateTime,
    }))
  }

  async getMessage(id: string): Promise<EmailMessage> {
    const api = await this.client()

    const { data } = await api.get(`/me/messages/${id}`)

    return {
      id: data.id,
      from: data.from.emailAddress.address,
      subject: data.subject,
      body: data.body.content,
      receivedAt: data.receivedDateTime,
    }
  }
}
