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

const LANGUAGE_DISPLAY_NAME_MAP: Record<string, string> = {
  'pt-BR': 'Português (Brasil)',
  'en-US': 'English (US)',
  'es-ES': 'Español',
  'fr-FR': 'Français',
  'de-DE': 'Deutsch',
  'zh-CN': '中文 (简体)',
  'ja-JP': '日本語',
  'ru-RU': 'Русский',
}

export function normalizeAgentLanguageCode(value: string | null | undefined, fallback = 'pt-BR'): string {
  const raw = String(value || '').trim()
  if (!raw) return fallback

  const normalizedKey = raw.toLowerCase()
  return LEGACY_LANGUAGE_CODE_MAP[normalizedKey] || raw
}

export function getAgentLanguageDisplayName(value: string | null | undefined, fallback = 'Português (Brasil)'): string {
  const normalized = normalizeAgentLanguageCode(value)
  return LANGUAGE_DISPLAY_NAME_MAP[normalized] || fallback
}

export function buildAgentLanguageInstruction(primaryLanguage: string | null | undefined): string {
  const normalizedLanguage = normalizeAgentLanguageCode(primaryLanguage)
  const displayName = getAgentLanguageDisplayName(normalizedLanguage)

  return [
    `Idioma principal do agente: ${displayName} (${normalizedLanguage}).`,
    'Responda no mesmo idioma usado pelo usuario na mensagem atual sempre que ele estiver claro.',
    `Se o idioma do usuario nao estiver claro, responda em ${displayName}.`,
    'Nao misture idiomas na mesma resposta, a menos que o usuario peca explicitamente.',
  ].join('\n')
}
