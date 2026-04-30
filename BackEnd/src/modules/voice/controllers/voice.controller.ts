import { Request, Response } from 'express'
import logger from '../../../lib/logger'
import {
  listElevenLabsVoices,
} from '../services/voiceCatalog.service'
import {
  getAgentVoiceProfile,
  saveAgentVoiceProfile,
} from '../services/voiceProfile.service'
import { generateVoicePreview } from '../services/voicePreview.service'
import { generateVoiceResponse } from '../services/voiceGeneration.service'
import { VoiceModuleError } from '../types/voice.types'
import { getRealtimeVoiceAgentService } from '../services/voiceRuntime.service'

function getParamAsString(value: string | string[] | undefined): string {
  if (typeof value === 'string') {
    return value
  }

  if (Array.isArray(value)) {
    return value[0] || ''
  }

  return ''
}

function handleVoiceError(res: Response, error: unknown, fallbackMessage: string) {
  if (error instanceof VoiceModuleError) {
    return res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
      details: error.cause ?? null,
    })
  }

  return res.status(500).json({
    error: fallbackMessage,
    details: error instanceof Error ? error.message : String(error),
  })
}

export async function getAgentVoiceProfileController(req: Request, res: Response) {
  try {
    const email = req.user?.email
    const agentId = getParamAsString(req.params.agentId)
    if (!email) {
      return res.status(401).json({ error: 'Usuario nao autenticado.' })
    }

    const profile = await getAgentVoiceProfile(agentId, email)
    return res.json(profile)
  } catch (error) {
    logger.error('[voice.controller] Erro ao buscar perfil de voz', error)
    return handleVoiceError(res, error, 'Erro ao buscar perfil de voz do agente.')
  }
}

export async function updateAgentVoiceProfileController(req: Request, res: Response) {
  try {
    const email = req.user?.email
    const agentId = getParamAsString(req.params.agentId)
    if (!email) {
      return res.status(401).json({ error: 'Usuario nao autenticado.' })
    }

    const profile = await saveAgentVoiceProfile(agentId, email, req.body || {})
    return res.json(profile)
  } catch (error) {
    logger.error('[voice.controller] Erro ao salvar perfil de voz', error)
    return handleVoiceError(res, error, 'Erro ao salvar perfil de voz do agente.')
  }
}

export async function listElevenLabsVoicesController(_req: Request, res: Response) {
  try {
    const voices = await listElevenLabsVoices()
    return res.json({
      provider: 'elevenlabs',
      voices,
    })
  } catch (error) {
    logger.error('[voice.controller] Erro ao listar vozes ElevenLabs', error)
    return handleVoiceError(res, error, 'Erro ao listar vozes da ElevenLabs.')
  }
}

export async function getVoiceCallRuntimeStatusController(_req: Request, res: Response) {
  try {
    const runtime = getRealtimeVoiceAgentService()
    const supportsRealtimeCalls = await runtime.supportsRealtimeCalls()

    return res.json({
      provider: runtime.constructor?.name || 'RealtimeVoiceAgentService',
      supportsRealtimeCalls,
      gatewayConfigured: supportsRealtimeCalls,
      mediaAdapter: String(process.env.VOICE_CALL_MEDIA_ADAPTER || 'unconfigured').trim().toLowerCase(),
    })
  } catch (error) {
    logger.error('[voice.controller] Erro ao consultar runtime de ligacoes', error)
    return handleVoiceError(res, error, 'Erro ao consultar runtime de ligacoes.')
  }
}

export async function createAgentVoicePreviewController(req: Request, res: Response) {
  try {
    const audio = await generateVoicePreview({
      ...(req.body || {}),
      provider: 'elevenlabs',
    })

    res.setHeader('Content-Type', audio.mimeType)
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Content-Length', String(audio.buffer.length))
    return res.send(audio.buffer)
  } catch (error) {
    logger.error('[voice.controller] Erro ao gerar preview de voz', error)
    return handleVoiceError(res, error, 'Erro ao gerar preview de voz.')
  }
}

export async function generateAgentVoiceResponseController(req: Request, res: Response) {
  try {
    const agentId = getParamAsString(req.params.agentId)
    const audio = await generateVoiceResponse({
      ...(req.body || {}),
      agentId,
      channel: req.body?.channel || 'web',
    })

    res.setHeader('Content-Type', audio.mimeType)
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Content-Length', String(audio.buffer.length))
    res.setHeader('X-Voice-Provider', audio.provider)
    res.setHeader('X-Voice-Id', audio.voiceId)
    return res.send(audio.buffer)
  } catch (error) {
    logger.error('[voice.controller] Erro ao gerar audio final do agente', error)
    return handleVoiceError(res, error, 'Erro ao gerar audio do agente.')
  }
}
