// outlook.types.ts

export interface OutlookEmail {
    id: string
    subject: string
    bodyPreview: string
    receivedDateTime: string
    from: {
      emailAddress: {
        name: string
        address: string
      }
    }
  }
  
  export interface OutlookMessagesResponse {
    value: OutlookEmail[]
  }
  