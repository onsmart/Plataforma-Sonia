import { Request, Response } from 'express'
import logger from '../../lib/logger'
import { supabase } from '../../lib/supabase'
import { getCompanyIdByEmail } from '../../utils/company-helper'
import { getKVValue, setKVValue } from '../../services/kv-store.service'

type GeneralSettings = {
  workspaceName: string
  customDomain: string
  reducedMotion: boolean
  highContrast: boolean
}

type LegacyGeneralSettings = {
  name?: string
  timezone?: string
  currency?: string
}

const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  workspaceName: 'My Workspace',
  customDomain: '',
  reducedMotion: false,
  highContrast: true
}

function getGeneralSettingsKey(userId: string) {
  return `tenant:${userId}:settings:general`
}

function getLegacyGeneralSettingsKey(userId: string) {
  return `tenant:${userId}:settings`
}

function normalizeGeneralSettings(
  raw: Partial<GeneralSettings & LegacyGeneralSettings> | null | undefined,
  fallback: Partial<GeneralSettings> = {}
): GeneralSettings {
  return {
    workspaceName:
      typeof raw?.workspaceName === 'string' && raw.workspaceName.trim()
        ? raw.workspaceName.trim()
        : typeof raw?.name === 'string' && raw.name.trim()
          ? raw.name.trim()
          : fallback.workspaceName || DEFAULT_GENERAL_SETTINGS.workspaceName,
    customDomain:
      typeof raw?.customDomain === 'string'
        ? raw.customDomain.trim().toLowerCase()
        : fallback.customDomain || DEFAULT_GENERAL_SETTINGS.customDomain,
    reducedMotion:
      typeof raw?.reducedMotion === 'boolean'
        ? raw.reducedMotion
        : fallback.reducedMotion ?? DEFAULT_GENERAL_SETTINGS.reducedMotion,
    highContrast:
      typeof raw?.highContrast === 'boolean'
        ? raw.highContrast
        : fallback.highContrast ?? DEFAULT_GENERAL_SETTINGS.highContrast
  }
}

async function getDefaultSettingsForUser(email?: string): Promise<GeneralSettings> {
  if (!email) {
    return DEFAULT_GENERAL_SETTINGS
  }

  const companiesId = await getCompanyIdByEmail(email)
  if (!companiesId) {
    return DEFAULT_GENERAL_SETTINGS
  }

  const { data, error } = await supabase
    .from('tb_companies')
    .select('name, slug')
    .eq('id', companiesId)
    .maybeSingle()

  if (error) {
    logger.warn('[getDefaultSettingsForUser] Erro ao buscar empresa:', error.message)
    return DEFAULT_GENERAL_SETTINGS
  }

  const companyName =
    typeof data?.name === 'string' && data.name.trim()
      ? data.name.trim()
      : DEFAULT_GENERAL_SETTINGS.workspaceName

  const companySlug =
    typeof data?.slug === 'string' && data.slug.trim()
      ? `${data.slug.trim().toLowerCase()}.sonia.ai`
      : DEFAULT_GENERAL_SETTINGS.customDomain

  return {
    ...DEFAULT_GENERAL_SETTINGS,
    workspaceName: companyName,
    customDomain: companySlug
  }
}

export async function getGeneralSettings(req: Request, res: Response) {
  try {
    const userId = req.user?.userId
    const email = req.user?.email

    if (!userId) {
      return res.status(401).json({
        error: 'Usuário não autenticado',
        code: 'AUTH_REQUIRED'
      })
    }

    const defaults = await getDefaultSettingsForUser(email)
    const primaryKey = getGeneralSettingsKey(userId)
    const legacyKey = getLegacyGeneralSettingsKey(userId)

    const [primarySettings, legacySettings] = await Promise.all([
      getKVValue<Partial<GeneralSettings>>(primaryKey),
      getKVValue<Partial<LegacyGeneralSettings>>(legacyKey)
    ])

    const normalized = normalizeGeneralSettings(primarySettings || legacySettings, defaults)

    return res.json(normalized)
  } catch (error: any) {
    logger.error('[getGeneralSettings] Erro:', error)
    return res.status(500).json({
      error: 'Erro ao buscar configurações gerais',
      details: error.message
    })
  }
}

export async function updateGeneralSettings(req: Request, res: Response) {
  try {
    const userId = req.user?.userId
    const email = req.user?.email

    if (!userId) {
      return res.status(401).json({
        error: 'Usuário não autenticado',
        code: 'AUTH_REQUIRED'
      })
    }

    const defaults = await getDefaultSettingsForUser(email)
    const normalized = normalizeGeneralSettings(req.body, defaults)

    await setKVValue(getGeneralSettingsKey(userId), normalized)

    logger.log(`[updateGeneralSettings] Configurações gerais salvas para user_id: ${userId}`)
    return res.json({
      success: true,
      settings: normalized
    })
  } catch (error: any) {
    logger.error('[updateGeneralSettings] Erro:', error)
    return res.status(500).json({
      error: 'Erro ao salvar configurações gerais',
      details: error.message
    })
  }
}

