import logger from '../../lib/logger'
import { GovernanceConfig } from './governance.service'

/** Caracteres invisíveis / direcionais usados para ofuscar injeção */
const INVISIBLE_AND_BIDI =
  /[\u200B-\u200D\uFEFF\u2060\u00AD\u034F\u061C\u202A-\u202E\u2066-\u2069\u180E]/g

const BLOCKED_RESPONSE =
  'Desculpe, não posso processar essa solicitação. Por favor, reformule sua pergunta de forma mais direta.'

/**
 * Normaliza texto para varredura de injeção (Unicode homóglifos comuns, espaços, NFKC).
 */
export function normalizeForPromptInjectionScan(raw: string): string {
  if (!raw || !raw.trim()) return ''

  let s = raw.normalize('NFKC')
  s = s.replace(INVISIBLE_AND_BIDI, '')

  // Latinos de largura total (Ａ-Ｚａ-ｚ０-９) → ASCII
  s = s.replace(/[\uFF01-\uFF5E]/g, (ch) => {
    const c = ch.charCodeAt(0)
    return String.fromCharCode(c - 0xfee0)
  })

  // Separadores repetidos / misturados → espaço (reduz "i g n o r e" e "i.g.n.o.r.e" levemente)
  s = s.replace(/[\s·•∙‧。．｡]+/g, ' ')
  s = s.replace(/[._*\-‐‑‒–—―/\\|]+/g, ' ')
  s = s.replace(/\s+/g, ' ').trim().toLowerCase()

  return s
}

/** Padrões de alto risco / baixo falso positivo — sempre bloqueados no chat */
const CRITICAL_INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(previous|all|above|prior)\s+(instructions?|prompts?|rules?)/i,
  /forget\s+(previous|all|above|prior)\s+(instructions?|prompts?|rules?)/i,
  /disregard\s+(previous|all|above|prior)\s+(instructions?|prompts?|rules?)/i,
  /override\s+(previous|all|above|prior)\s+(instructions?|prompts?|rules?)/i,
  /\bnew\s+system\s+prompt\b/i,
  /\b(end\s+of\s+)?system\s*[\]:]+\s*(prompt|message|instruction|override)/i,
  /\[(system|instruction|override)\]/i,
  /```\s*system\b/i,
  /^---+[\s]*system\b/im,
  /<\|system\|>|<\|assistant\|>|<\|user\|>|<\|im_start\|>|<\|im_end\|>/i,
  /\[(\/)?INST\]/i,
  /\bendoftext\b|<\|endoftext\|>/i,
  /reveal\s+(your|the)\s+(full\s+)?(system\s+)?(prompt|instructions?)/i,
  /print\s+(your|the)\s+(full\s+)?(system\s+)?(prompt|instructions?|rules?)/i,
  /what\s+(is|are)\s+your\s+(system\s+)?(prompt|instructions?)/i,
  /leak\s+(the\s+)?(prompt|instructions?|rules?)/i,
  /* pt */
  /\b(esqueça|esqueca|esquecer)\s+(tudo\s+)?(as\s+)?instru/i,
  /ignore\s+(as\s+)?instru/i,
  /desconsidere\s+(as\s+)?(instru|regras)/i,
  /substitua\s+(as\s+)?(instru|regras)/i,
  /mostre\s+(o\s+)?(seu\s+)?(prompt|system)/i,
  /qual\s+(é|e)\s+(o\s+)?(seu\s+)?prompt(\s+do\s+sistema)?/i,
  /divulgue\s+(o\s+)?(prompt|system)/i,
]

/** Heurísticas extras quando jailbreakProtection está ligado */
const EXTENDED_JAILBREAK_PATTERNS: RegExp[] = [
  /system\s*:?\s*(prompt|instruction|override)/i,
  /pretend\s+(you\s+)?(are|to\s+be)/i,
  /act\s+as\s+if/i,
  /act\s+as\s+(a|an|the)\s+(?!customer\b|client\b|user\b|human\b|person\b|friend\b)/i,
  /role-?play\s+as/i,
  /simulate\s+being/i,
  /you\s+are\s+now\s+(a|an)\s+(gpt|chatgpt|assistant|ai|bot|llm|model|unrestricted|hacker)/i,
  /você\s+(é|e)\s+(agora\s+)?(um\s+)?(assistente\s+)?(sem\s+restri|desbloqueado|livre)/i,
  /finja\s+que\s+(você\s+)?(é|e|fosse)/i,
  /aja\s+como\s+se/i,
  /modo\s+dan\b|developer\s+mode|jailbreak\s+mode/i,
  /bypass\s+(the\s+)?(filter|rules?|restrictions?|guardrails?)/i,
  /contorn(ar|e)\s+(as\s+)?(regras|restri|filtros)/i,
  /without\s+(any\s+)?restrictions/i,
  /ignore\s+safety/i,
  /disregard\s+ethical/i,
]

export function detectCriticalPromptInjection(normalized: string): boolean {
  if (!normalized) return false
  return CRITICAL_INJECTION_PATTERNS.some((p) => p.test(normalized))
}

export function detectExtendedJailbreak(normalized: string): boolean {
  if (!normalized) return false
  return EXTENDED_JAILBREAK_PATTERNS.some((p) => p.test(normalized))
}

/**
 * Compatível com testes e ferramentas: bloqueia se camada crítica OU estendida acionar.
 */
export function detectJailbreak(message: string): boolean {
  const n = normalizeForPromptInjectionScan(message)
  return detectCriticalPromptInjection(n) || detectExtendedJailbreak(n)
}

/**
 * Avalia bloqueio respeitando o toggle jailbreak (crítico sempre).
 */
export function evaluatePromptInjectionBlock(
  message: string,
  jailbreakProtectionEnabled: boolean
): { blocked: boolean; layer?: 'critical' | 'extended' } {
  const n = normalizeForPromptInjectionScan(message)
  if (detectCriticalPromptInjection(n)) {
    return { blocked: true, layer: 'critical' }
  }
  if (jailbreakProtectionEnabled && detectExtendedJailbreak(n)) {
    return { blocked: true, layer: 'extended' }
  }
  return { blocked: false }
}

/**
 * Aplica pré-processamento de governança na mensagem do usuário
 */
export function applyPreProcessing(
  message: string,
  config: GovernanceConfig
): { blocked: boolean; reason?: string; response?: string } {
  const jailbreakOn = Boolean(config.filters.jailbreakProtection)
  const { blocked, layer } = evaluatePromptInjectionBlock(message, jailbreakOn)

  if (blocked) {
    logger.warn('[applyPreProcessing] 🛡️ Entrada bloqueada (prompt injection / jailbreak):', {
      layer,
      jailbreakProtectionEnabled: jailbreakOn,
      messagePreview: message.substring(0, 120),
    })
    return {
      blocked: true,
      reason: layer === 'critical' ? 'prompt_injection_critical' : 'jailbreak_detected',
      response: BLOCKED_RESPONSE,
    }
  }

  return { blocked: false }
}
