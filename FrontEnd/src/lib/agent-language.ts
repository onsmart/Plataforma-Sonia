export type AgentLanguageOption = {
  code: string
  name: string
}

const LEGACY_LANGUAGE_CODE_MAP: Record<string, string> = {
  en: 'en-US',
  'en-us': 'en-US',
  english: 'en-US',
  'english-us': 'en-US',
  pt: 'pt-BR',
  'pt-br': 'pt-BR',
  ptbr: 'pt-BR',
  portuguese: 'pt-BR',
  portugues: 'pt-BR',
  'portuguese-br': 'pt-BR',
  'portuguese-brazil': 'pt-BR',
  es: 'es-ES',
  'es-es': 'es-ES',
  spanish: 'es-ES',
  espanol: 'es-ES',
  español: 'es-ES',
  fr: 'fr-FR',
  'fr-fr': 'fr-FR',
  french: 'fr-FR',
  francais: 'fr-FR',
  français: 'fr-FR',
  de: 'de-DE',
  'de-de': 'de-DE',
  german: 'de-DE',
  deutsch: 'de-DE',
  zh: 'zh-CN',
  'zh-cn': 'zh-CN',
  chinese: 'zh-CN',
  mandarin: 'zh-CN',
  ja: 'ja-JP',
  'ja-jp': 'ja-JP',
  japanese: 'ja-JP',
  jp: 'ja-JP',
  ru: 'ru-RU',
  'ru-ru': 'ru-RU',
  russian: 'ru-RU',
  russkiy: 'ru-RU',
}

export const SUPPORTED_AGENT_LANGUAGES: AgentLanguageOption[] = [
  { code: 'pt-BR', name: 'Português (Brasil)' },
  { code: 'en-US', name: 'English (US)' },
  { code: 'es-ES', name: 'Español' },
  { code: 'fr-FR', name: 'Français' },
  { code: 'de-DE', name: 'Deutsch' },
  { code: 'zh-CN', name: '中文 (简体)' },
  { code: 'ja-JP', name: '日本語' },
  { code: 'ru-RU', name: 'Русский' },
]

export function normalizeAgentLanguageCode(value: string | null | undefined, fallback = 'pt-BR'): string {
  const raw = String(value || '').trim()
  if (!raw) return fallback

  const normalizedKey = raw.toLowerCase()
  return LEGACY_LANGUAGE_CODE_MAP[normalizedKey] || raw
}

export function getAgentLanguageLabel(value: string | null | undefined, fallback = 'Português (Brasil)'): string {
  const normalized = normalizeAgentLanguageCode(value)
  return SUPPORTED_AGENT_LANGUAGES.find(language => language.code === normalized)?.name || fallback
}
