export type VoiceProviderName = 'elevenlabs'

export type VoiceChannel = 'preview' | 'web' | 'whatsapp_audio' | 'whatsapp_call'

export interface VoiceSettings {
  stability?: number | null
  similarityBoost?: number | null
  style?: number | null
  speed?: number | null
  useSpeakerBoost?: boolean
}

export interface VoiceProfileRecord {
  id: string
  agentId: string
  provider: VoiceProviderName
  voiceId: string
  voiceName: string | null
  modelId: string | null
  stability: number | null
  similarityBoost: number | null
  style: number | null
  speed: number | null
  useSpeakerBoost: boolean
  previewText: string | null
  enabled: boolean
  callsEnabled: boolean
  createdAt: string
  updatedAt: string
}

export interface VoiceProfileResponse {
  profile: VoiceProfileRecord | null
  defaults: {
    provider: VoiceProviderName
    modelId: string | null
    previewText: string
  }
  providerConfigured: boolean
}

export interface UpdateVoiceProfileInput extends VoiceSettings {
  provider?: VoiceProviderName
  voiceId: string
  voiceName?: string | null
  modelId?: string | null
  previewText?: string | null
  enabled?: boolean
  callsEnabled?: boolean
}

export interface VoicePreviewInput extends VoiceSettings {
  text: string
  provider?: VoiceProviderName
  voiceId: string
  modelId?: string | null
}

export interface VoiceGenerationInput extends VoiceSettings {
  agentId: string
  text: string
  channel: VoiceChannel
  recipient?: string | null
  contactId?: string | null
  integrationId?: string | null
  provider?: VoiceProviderName
  voiceId?: string
  voiceName?: string | null
  modelId?: string | null
}

export interface VoiceCatalogItem {
  voiceId: string
  name: string
  category: string | null
  labels: Record<string, string>
  previewUrl: string | null
  description: string | null
}

export interface GeneratedVoiceAudio {
  buffer: Buffer
  mimeType: string
  fileExtension: string
  provider: VoiceProviderName
  voiceId: string
  voiceName: string | null
  modelId: string | null
  channel: VoiceChannel
  convertedForChannel: boolean
}

export interface ElevenLabsVoice {
  voice_id: string
  name: string
  category?: string | null
  labels?: Record<string, string> | null
  preview_url?: string | null
  description?: string | null
  settings?: {
    stability?: number | null
    similarity_boost?: number | null
    style?: number | null
    speed?: number | null
    use_speaker_boost?: boolean | null
  } | null
}

export interface ElevenLabsSpeechRequest extends VoiceSettings {
  text: string
  voiceId: string
  modelId?: string | null
  outputFormat?: string
}

export interface VoiceProvider {
  readonly name: VoiceProviderName
  isConfigured(): boolean
  listVoices(): Promise<ElevenLabsVoice[]>
  getVoice(voiceId: string): Promise<ElevenLabsVoice | null>
  generateSpeech(input: ElevenLabsSpeechRequest): Promise<Buffer>
  generatePreview(input: ElevenLabsSpeechRequest): Promise<Buffer>
  transcribeAudio?(input: Buffer, mimeType?: string): Promise<string>
}

export interface VoiceModuleErrorOptions {
  code: string
  statusCode?: number
  cause?: unknown
}

export class VoiceModuleError extends Error {
  public readonly code: string
  public readonly statusCode: number
  public readonly cause?: unknown

  constructor(message: string, options: VoiceModuleErrorOptions) {
    super(message)
    this.name = 'VoiceModuleError'
    this.code = options.code
    this.statusCode = options.statusCode ?? 400
    this.cause = options.cause
  }
}

export interface WhatsAppMediaAudioPayload {
  integrationId: string
  recipient: string
  agentId: string
  textFallback: string
  audio: GeneratedVoiceAudio
  metadata?: Record<string, unknown>
}

export interface WhatsAppMediaSender {
  supportsAudioMessages(params: { integrationId: string; agentId: string }): Promise<boolean> | boolean
  sendAudioMessage(
    payload: WhatsAppMediaAudioPayload
  ): Promise<{ success: boolean; messageId?: string; error?: string }>
}

export interface VoiceCallSession {
  sessionId: string
  agentId: string
  integrationId: string
  provider: 'whatsapp_calling'
  startedAt: string
  caller?: string | null
  phoneNumberId?: string | null
  callId?: string | null
  sdpOffer?: string | null
  sdpAnswer?: string | null
  metadata?: Record<string, unknown>
  userEmail?: string | null
}

export interface PreparedVoiceCallSession {
  sdpAnswer: string
  metadata?: Record<string, unknown>
}

export interface VoiceCallProvider {
  readonly name: string
  supportsRealtimeCalls(): Promise<boolean> | boolean
  startSession(session: VoiceCallSession): Promise<void>
}

export interface WhatsAppCallingProvider extends VoiceCallProvider {
  readonly name: 'whatsapp_calling'
}

export interface RealtimeVoiceAgentService {
  supportsRealtimeCalls(): Promise<boolean> | boolean
  prepareInboundWhatsAppCall?(session: VoiceCallSession): Promise<PreparedVoiceCallSession>
  attachAgentVoice(session: VoiceCallSession): Promise<void>
  closeSession?(callId: string): Promise<void>
}
