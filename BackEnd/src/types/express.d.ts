import { Request } from 'express'

declare global {
  namespace Express {
    interface Request {
      user?: {
        email: string
        userId: string
        token: string
      }
    }
  }
}

export {}
