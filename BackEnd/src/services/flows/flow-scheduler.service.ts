import { randomUUID } from 'crypto'
import logger from '../../lib/logger'
import { supabase } from '../../lib/supabase'
import { getKVValue } from '../kv-store.service'
import { saveSystemLog } from '../system-logs'
import { getUserIdAndCompanyIdByEmail } from '../../utils/company-helper'
import { FlowExecutionContext, FlowExecutionMode, NodeExecutionResult } from './flow.types'

const FLOW_SCHEDULE_TABLE = 'tb_flow_schedule_jobs'
const DEFAULT_FLOW_TIMEZONE = 'America/Sao_Paulo'
const MAX_SCHEDULE_ATTEMPTS = parseInt(process.env.FLOW_SCHEDULE_MAX_ATTEMPTS || '5', 10)
const SCHEDULE_RETRY_BASE_MS = parseInt(process.env.FLOW_SCHEDULE_RETRY_BASE_MS || '60000', 10)

type FlowResumeSnapshot = {
  data: Record<string, unknown>
  executionHistory: NodeExecutionResult[]
  __schedule_attempt?: number
}

type FlowScheduleJobRow = {
  id: string
  flow_id: string
  user_email: string
  user_id?: string | null
  companies_id?: string | null
  execution_id: string
  resume_node_id?: string | null
  scheduled_at: string
  timezone?: string | null
  context_json?: FlowResumeSnapshot | null
  trigger_source?: string | null
}

function getGeneralSettingsKey(userId: string) {
  return `tenant:${userId}:settings:general`
}

function getLegacyGeneralSettingsKey(userId: string) {
  return `tenant:${userId}:settings`
}

function isIsoWithOffset(value: string): boolean {
  return /\d(?:Z|[+-]\d{2}:\d{2})$/i.test(value)
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })

  const parts = dtf.formatToParts(date)
  const lookup = (type: string) => Number(parts.find((part) => part.type === type)?.value || '0')
  const asUtc = Date.UTC(
    lookup('year'),
    lookup('month') - 1,
    lookup('day'),
    lookup('hour'),
    lookup('minute'),
    lookup('second')
  )
  return asUtc - date.getTime()
}

function zonedDateTimeToUtc(dateTime: string, timeZone: string): Date {
  const match = String(dateTime || '')
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/)

  if (!match) {
    const parsed = new Date(dateTime)
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`Data/hora invalida para agendamento: ${dateTime}`)
    }
    return parsed
  }

  const [, year, month, day, hour, minute, second = '0'] = match
  const utcGuess = new Date(Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  ))

  const offset = getTimeZoneOffsetMs(utcGuess, timeZone)
  const corrected = new Date(utcGuess.getTime() - offset)
  const correctedOffset = getTimeZoneOffsetMs(corrected, timeZone)
  if (correctedOffset !== offset) {
    return new Date(utcGuess.getTime() - correctedOffset)
  }
  return corrected
}

export async function getDefaultFlowTimezoneForUser(
  userId?: string | null,
  userEmail?: string | null
): Promise<string> {
  const normalizedUserId = String(userId || '').trim()
  if (normalizedUserId) {
    try {
      const [primary, legacy] = await Promise.all([
        getKVValue<{ timezone?: string }>(getGeneralSettingsKey(normalizedUserId)),
        getKVValue<{ timezone?: string }>(getLegacyGeneralSettingsKey(normalizedUserId))
      ])
      const timezone = String(primary?.timezone || legacy?.timezone || '').trim()
      if (timezone) return timezone
    } catch (error: any) {
      logger.warn('[flow-scheduler] Falha ao buscar timezone do usuario', {
        userId: normalizedUserId,
        error: error?.message
      })
    }
  }

  const normalizedEmail = String(userEmail || '').trim()
  if (normalizedEmail) {
    try {
      const ids = await getUserIdAndCompanyIdByEmail(normalizedEmail)
      if (ids.userId && ids.userId !== normalizedUserId) {
        return await getDefaultFlowTimezoneForUser(ids.userId, null)
      }
    } catch (error: any) {
      logger.warn('[flow-scheduler] Falha ao resolver timezone via email', {
        userEmail: normalizedEmail,
        error: error?.message
      })
    }
  }

  return DEFAULT_FLOW_TIMEZONE
}

export async function resolveScheduledAtToUtcIso(params: {
  rawValue: string
  preferredTimezone?: string | null
  userId?: string | null
  userEmail?: string | null
}): Promise<{ scheduledAtIso: string; timezone: string }> {
  const rawValue = String(params.rawValue || '').trim()
  if (!rawValue) {
    throw new Error('Data/hora de agendamento obrigatoria')
  }

  const timezone =
    String(params.preferredTimezone || '').trim() ||
    await getDefaultFlowTimezoneForUser(params.userId, params.userEmail)

  const parsed = isIsoWithOffset(rawValue)
    ? new Date(rawValue)
    : zonedDateTimeToUtc(rawValue, timezone)

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Data/hora de agendamento invalida: ${rawValue}`)
  }

  return {
    scheduledAtIso: parsed.toISOString(),
    timezone
  }
}

async function persistFlowScheduleRows(rows: Array<Record<string, unknown>>): Promise<{ inserted: number; firstId?: string }> {
  if (rows.length === 0) {
    return { inserted: 0 }
  }

  const { data, error } = await supabase
    .from(FLOW_SCHEDULE_TABLE)
    .insert(rows)
    .select('id')

  if (error) {
    const message = String(error.message || '')
    if (message.includes('tb_flow_schedule_jobs')) {
      logger.warn('[flow-scheduler] Tabela de agendamento ausente; follow-ups internos ignorados', {
        error: message
      })
      return { inserted: 0 }
    }
    logger.error('[flow-scheduler] Erro ao persistir jobs de fluxo', { error: message })
    throw new Error(message)
  }

  const first = Array.isArray(data) && data.length > 0 ? String((data[0] as any).id || '') : ''
  return {
    inserted: Array.isArray(data) ? data.length : rows.length,
    firstId: first || undefined
  }
}

export async function scheduleFlowStart(params: {
  flowId: string
  userEmail: string
  initialData?: Record<string, any>
  scheduledStartAt: string
  preferredTimezone?: string | null
  executionMode?: FlowExecutionMode
}): Promise<{
  jobId?: string
  executionId: string
  scheduledAtIso: string
  timezone: string
  userId: string
  companiesId?: string
}> {
  const ids = await getUserIdAndCompanyIdByEmail(params.userEmail)
  const executionId = randomUUID()
  const { scheduledAtIso, timezone } = await resolveScheduledAtToUtcIso({
    rawValue: params.scheduledStartAt,
    preferredTimezone: params.preferredTimezone,
    userId: ids.userId,
    userEmail: params.userEmail
  })

  const payload = {
    data: {
      ...(params.initialData || {}),
      __flow_execution_mode: params.executionMode || 'live'
    },
    executionHistory: []
  }

  const inserted = await persistFlowScheduleRows([
    {
      flow_id: params.flowId,
      user_email: params.userEmail,
      user_id: ids.userId || null,
      companies_id: ids.companyId || null,
      execution_id: executionId,
      resume_node_id: null,
      scheduled_at: scheduledAtIso,
      timezone,
      status: 'pending',
      trigger_source: 'scheduled_start',
      context_json: payload
    }
  ])

  await saveSystemLog({
    user_id: ids.userId || undefined,
    companies_id: ids.companyId || undefined,
    user_email: params.userEmail,
    workflow_id: params.flowId,
    execution_id: executionId,
    log_type: 'workflow_scheduled',
    level: 'info',
    message: `Workflow agendado para ${scheduledAtIso} (${timezone}).`,
    metadata: {
      scheduled_at: scheduledAtIso,
      timezone,
      trigger_source: 'scheduled_start'
    },
    impact_level: 'low'
  }).catch(() => undefined)

  return {
    jobId: inserted.firstId,
    executionId,
    scheduledAtIso,
    timezone,
    userId: ids.userId || '',
    companiesId: ids.companyId || undefined
  }
}

export async function enqueueFlowResumeJobs(params: {
  flowId: string
  userEmail: string
  userId?: string | null
  companiesId?: string | null
  executionId?: string
  resumeNodeIds: string[]
  scheduledAtIso: string
  timezone?: string | null
  contextData: Record<string, any>
  executionHistory: NodeExecutionResult[]
  triggerSource: 'delay' | 'schedule'
}): Promise<{ inserted: number }> {
  const executionId = String(params.executionId || '').trim() || randomUUID()
  const timezone =
    String(params.timezone || '').trim() ||
    await getDefaultFlowTimezoneForUser(params.userId, params.userEmail)

  const rows = params.resumeNodeIds
    .map((resumeNodeId) => String(resumeNodeId || '').trim())
    .filter((resumeNodeId) => resumeNodeId.length > 0)
    .map((resumeNodeId) => ({
      flow_id: params.flowId,
      user_email: params.userEmail,
      user_id: params.userId || null,
      companies_id: params.companiesId || null,
      execution_id: executionId,
      resume_node_id: resumeNodeId,
      scheduled_at: params.scheduledAtIso,
      timezone,
      status: 'pending',
      trigger_source: params.triggerSource,
      context_json: {
        data: {
          ...(params.contextData || {}),
          __flow_execution_mode: 'live'
        },
        executionHistory: Array.isArray(params.executionHistory) ? params.executionHistory : []
      }
    }))

  const inserted = await persistFlowScheduleRows(rows)

  await saveSystemLog({
    user_id: params.userId || undefined,
    companies_id: params.companiesId || undefined,
    user_email: params.userEmail,
    workflow_id: params.flowId,
    execution_id: executionId,
    log_type: 'workflow_scheduled',
    level: 'info',
    message: `Fluxo pausado e agendado para retomada em ${params.scheduledAtIso}.`,
    metadata: {
      scheduled_at: params.scheduledAtIso,
      timezone,
      resume_node_ids: rows.map((row) => row.resume_node_id),
      trigger_source: params.triggerSource
    },
    impact_level: 'low'
  }).catch(() => undefined)

  return { inserted: inserted.inserted }
}

export async function processFlowScheduleJobsOnce(maxJobs: number): Promise<{ processed: number; errors: number }> {
  let processed = 0
  let errors = 0

  const { data, error } = await supabase
    .from(FLOW_SCHEDULE_TABLE)
    .select('id, flow_id, user_email, user_id, companies_id, execution_id, resume_node_id, scheduled_at, timezone, context_json, trigger_source')
    .eq('status', 'pending')
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(maxJobs)

  if (error || !Array.isArray(data) || data.length === 0) {
    return { processed: 0, errors: 0 }
  }

  const { FlowService } = await import('./flow.service')

  for (const rawJob of data as FlowScheduleJobRow[]) {
    const jobId = String(rawJob.id || '').trim()
    if (!jobId) continue

    await supabase
      .from(FLOW_SCHEDULE_TABLE)
      .update({ status: 'processing', processed_at: new Date().toISOString() })
      .eq('id', jobId)

    try {
      const snapshot = rawJob.context_json || { data: {}, executionHistory: [] }
      const flowInitialData = {
        ...(snapshot.data || {}),
        __flow_execution_mode: 'live'
      }

      await FlowService.executeFlow(
        String(rawJob.flow_id || ''),
        String(rawJob.user_email || ''),
        flowInitialData,
        {
          executionMode: 'live',
          executionId: String(rawJob.execution_id || '').trim() || undefined,
          executionHistory: Array.isArray(snapshot.executionHistory) ? snapshot.executionHistory : [],
          resumeFromNodeId: String(rawJob.resume_node_id || '').trim() || undefined
        }
      )

      await supabase
        .from(FLOW_SCHEDULE_TABLE)
        .update({ status: 'completed', processed_at: new Date().toISOString(), last_error: null })
        .eq('id', jobId)

      await saveSystemLog({
        user_id: rawJob.user_id || undefined,
        companies_id: rawJob.companies_id || undefined,
        user_email: rawJob.user_email,
        workflow_id: rawJob.flow_id,
        execution_id: rawJob.execution_id,
        log_type: 'workflow_resumed',
        level: 'info',
        message: `Workflow retomado a partir do job ${jobId}.`,
        metadata: {
          resume_node_id: rawJob.resume_node_id,
          trigger_source: rawJob.trigger_source,
          scheduled_at: rawJob.scheduled_at
        },
        impact_level: 'low'
      }).catch(() => undefined)

      processed++
    } catch (jobError: any) {
      const snapshot = (rawJob.context_json || { data: {}, executionHistory: [] }) as FlowResumeSnapshot
      const attempt = Number(snapshot.__schedule_attempt || 0) + 1
      const errorMessage = jobError?.message || 'Erro desconhecido ao retomar fluxo'

      if (attempt < MAX_SCHEDULE_ATTEMPTS) {
        const retryDelayMs = Math.min(SCHEDULE_RETRY_BASE_MS * attempt, 15 * 60 * 1000)
        const retryAt = new Date(Date.now() + retryDelayMs).toISOString()
        const retrySnapshot: FlowResumeSnapshot = {
          ...snapshot,
          __schedule_attempt: attempt,
        }

        await supabase
          .from(FLOW_SCHEDULE_TABLE)
          .update({
            status: 'pending',
            scheduled_at: retryAt,
            processed_at: null,
            last_error: errorMessage,
            context_json: retrySnapshot,
          })
          .eq('id', jobId)

        logger.warn('[flow-scheduler] Job reagendado apos falha', {
          jobId,
          attempt,
          retryAt,
          error: errorMessage,
        })
      } else {
        await supabase
          .from(FLOW_SCHEDULE_TABLE)
          .update({
            status: 'failed',
            processed_at: new Date().toISOString(),
            last_error: errorMessage,
          })
          .eq('id', jobId)
        errors++
      }
    }
  }

  return { processed, errors }
}

export function buildPausedExecutionContext(params: {
  flowId: string
  userEmail: string
  userId?: string
  companiesId?: string
  executionId: string
  initialData?: Record<string, any>
  scheduledAtIso: string
  timezone: string
}): FlowExecutionContext {
  return {
    flowId: params.flowId,
    userId: params.userId || '',
    companiesId: params.companiesId,
    userEmail: params.userEmail,
    executionId: params.executionId,
    data: {
      ...(params.initialData || {}),
      __flow_execution_mode: 'live',
      __flow_paused_for_schedule: true,
      __flow_paused_until: params.scheduledAtIso,
      __flow_pause_timezone: params.timezone
    },
    executionHistory: []
  }
}
