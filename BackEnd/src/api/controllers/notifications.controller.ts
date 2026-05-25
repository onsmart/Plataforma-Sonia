import { Request, Response } from 'express'
import { supabase } from '../../lib/supabase'
import { getCompanyIdByEmail } from '../../utils/company-helper'
import logger from '../../lib/logger'

/**
 * Lista notificações in-app da empresa do usuário autenticado.
 */
export async function listNotifications(req: Request, res: Response) {
  try {
    const email = req.user?.email
    if (!email) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const companiesId = await getCompanyIdByEmail(email)
    if (!companiesId) {
      return res.json({ notifications: [] })
    }

    const { data, error } = await supabase
      .from('tb_notifications')
      .select('id, type, title, body, read, metadata, created_at')
      .eq('companies_id', companiesId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      logger.warn('[listNotifications] Erro:', error.message)
      return res.json({ notifications: [] })
    }

    const notifications = (data || []).map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      message: row.body,
      read: row.read,
      metadata: row.metadata,
      createdAt: row.created_at,
    }))

    return res.json({ notifications })
  } catch (err: unknown) {
    logger.error('[listNotifications] Erro:', err)
    return res.status(500).json({ error: 'Erro ao listar notificações' })
  }
}

export async function markNotificationRead(req: Request, res: Response) {
  try {
    const email = req.user?.email
    if (!email) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const companiesId = await getCompanyIdByEmail(email)
    if (!companiesId) {
      return res.json({ success: true })
    }

    const id = typeof req.body?.id === 'string' ? req.body.id.trim() : ''

    if (id === 'all') {
      await supabase
        .from('tb_notifications')
        .update({ read: true })
        .eq('companies_id', companiesId)
        .eq('read', false)
    } else if (id) {
      await supabase
        .from('tb_notifications')
        .update({ read: true })
        .eq('companies_id', companiesId)
        .eq('id', id)
    }

    return res.json({ success: true })
  } catch (err: unknown) {
    logger.error('[markNotificationRead] Erro:', err)
    return res.status(500).json({ error: 'Erro ao marcar notificação' })
  }
}

export async function testNotification(_req: Request, res: Response) {
  return res.json({ success: true })
}
