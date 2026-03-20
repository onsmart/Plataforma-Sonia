import { Request, Response } from 'express'

/**
 * Rotas mínimas para o NotificationCenter do front (persistência pode ser adicionada depois).
 */
export async function listNotifications(_req: Request, res: Response) {
  return res.json({ notifications: [] as unknown[] })
}

export async function markNotificationRead(_req: Request, res: Response) {
  return res.json({ success: true })
}

export async function testNotification(_req: Request, res: Response) {
  return res.json({ success: true })
}
