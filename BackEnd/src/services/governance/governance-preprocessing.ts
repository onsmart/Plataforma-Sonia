import logger from '../../lib/logger'
import { GovernanceConfig } from './governance.service'

const INVISIBLE_AND_BIDI =
  /[\u200B-\u200D\uFEFF\u2060\u00AD\u034F\u061C\u202A-\u202E\u2066-\u2069\u180E]/g

const BLOCKED_RESPONSES = {
  generic:
    'Desculpe, não posso processar essa solicitação. Por favor, reformule sua pergunta de forma mais direta.',
  technicalCodeRequest:
    'Desculpe, não posso fornecer código, comandos ou instruções técnicas executáveis neste canal. Posso ajudar com uma orientação não técnica ou encaminhar para o suporte adequado.',
  suspiciousRequest:
    'Desculpe, não posso ajudar com esse tipo de solicitação neste canal. Se precisar de atendimento legítimo sobre produtos ou serviços, posso continuar por esse caminho.',
  sensitiveInfoRequest:
    'Desculpe, não posso compartilhar informações internas, sensíveis ou operacionais neste canal. Posso ajudar com informações públicas e seguras sobre a empresa ou o serviço.',
} as const

export type GovernanceBlockReason =
  | 'prompt_injection_critical'
  | 'jailbreak_detected'
  | 'technical_code_request'
  | 'suspicious_request'
  | 'sensitive_info_request'

export interface PreProcessingResult {
  blocked: boolean
  reason?: GovernanceBlockReason
  response?: string
}

export function normalizeForPromptInjectionScan(raw: string): string {
  if (!raw || !raw.trim()) return ''

  let s = raw.normalize('NFKC')
  s = s.replace(INVISIBLE_AND_BIDI, '')
  s = s.replace(/[\uFF01-\uFF5E]/g, (ch) => {
    const c = ch.charCodeAt(0)
    return String.fromCharCode(c - 0xfee0)
  })
  s = s.replace(/[\sÂ·â€¢âˆ™â€§ã€‚ï¼Žï½¡]+/g, ' ')
  s = s.replace(/[._*\-â€â€‘â€’â€“â€”â€•/\\|]+/g, ' ')
  s = s.replace(/\s+/g, ' ').trim().toLowerCase()

  return s
}

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
  /\b(esqueça|esqueca|esquecer)\s+(tudo\s+)?(as\s+)?instru/i,
  /ignore\s+(as\s+)?instru/i,
  /desconsidere\s+(as\s+)?(instru|regras)/i,
  /substitua\s+(as\s+)?(instru|regras)/i,
  /mostre\s+(o\s+)?(seu\s+)?(prompt|system)/i,
  /qual\s+(é|e)\s+(o\s+)?(seu\s+)?prompt(\s+do\s+sistema)?/i,
  /divulgue\s+(o\s+)?(prompt|system)/i,
]

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

const TECHNICAL_CODE_PATTERNS: RegExp[] = [
  /\bif\s*else\b/i,
  /\bpython\b|\bjavascript\b|\btypescript\b|\bjava\b|\bc#\b|\bc\+\+\b|\bphp\b|\bruby\b|\bgo\b/i,
  /\bsql\b|\bselect\s+.+\s+from\b|\binsert\s+into\b|\bupdate\s+.+\s+set\b|\bdelete\s+from\b/i,
  /\bscript\b|\bsnippet\b|\bpayload\b|\bquery\b|\bregex\b|\bexpress(?:ão)?\s+regular\b/i,
  /\bcurl\b|\bwget\b|\bbash\b|\bshell\b|\bpowershell\b|\bterminal\b|\bcommand line\b|\bcmd\b/i,
  /\bapi\b.+\brequest\b|\bhttp\b.+\brequest\b|\bjson\b.+\bbody\b/i,
  /\bwrite\b.+\bcode\b|\bshow\b.+\bcode\b|\bgive\b.+\bcode\b|\bprovide\b.+\bscript\b/i,
  /\bescrev(a|a um|a uma)\b.+\bc[oó]digo\b/i,
  /\bme\s+passa\b.+\bscript\b|\bgera\b.+\bc[oó]digo\b/i,
]

const SUSPICIOUS_REQUEST_PATTERNS: RegExp[] = [
  /\bbypass\b|\bcontornar\b|\bevade\b|\bdriblar\b/i,
  /\bexploit\b|\bexploração\b|\bvulnerabilit(?:y|ies|dade)\b|\bpentest\b/i,
  /\bscrap(?:e|ing)\b|\braspar\b|\bcrawl(?:er)?\b/i,
  /\benumerat(?:e|ion)\b|\benumerar\b|\bmass\s+collect\b/i,
  /\bphishing\b|\bengenharia\s+social\b|\bsocial\s+engineering\b/i,
  /\bimpersonat(?:e|ion)\b|\bpersonate\b|\bse\s+passar\s+por\b/i,
  /\bsteal\b|\broubar\b|\bexfiltrat(?:e|ion)\b|\bleak\b|\bvazar\b/i,
  /\bbrute\s+force\b|\bcredential\s+stuffing\b|\bbotnet\b/i,
  /\btoken\b.+\btest\b|\bcookie\b.+\bcapture\b/i,
]

const SENSITIVE_INFO_PATTERNS: RegExp[] = [
  /\baccess\s*token\b|\brefresh\s*token\b|\bapi\s*key\b|\bsecret\b|\bsecreto\b/i,
  /\bcredential(?:s)?\b|\bcredenciais\b|\bsenha\b|\bpassword\b/i,
  /\bwebhook\b.+\b(secret|token|url)\b/i,
  /\binternal\s+(prompt|instruction|rule|policy|architecture|endpoint)\b/i,
  /\bprompt\s+interno\b|\binstru[cç][aã]o\s+interna\b|\barquitetura\s+interna\b/i,
  /\binfra(?:structure)?\b|\bservidor(?:es)?\b|\bip\s+(interno|privado)?\b/i,
  /\bphone\s*number\s*id\b|\bverify\s*token\b/i,
  /\blocaliza[cç][aã]o\s+(privada|exata|interna)\b|\bendere[cç]o\s+privado\b/i,
]

export function detectCriticalPromptInjection(normalized: string): boolean {
  if (!normalized) return false
  return CRITICAL_INJECTION_PATTERNS.some((p) => p.test(normalized))
}

export function detectExtendedJailbreak(normalized: string): boolean {
  if (!normalized) return false
  return EXTENDED_JAILBREAK_PATTERNS.some((p) => p.test(normalized))
}

export function detectTechnicalCodeRequest(normalized: string): boolean {
  if (!normalized) return false
  return TECHNICAL_CODE_PATTERNS.some((p) => p.test(normalized))
}

export function detectSuspiciousRequest(normalized: string): boolean {
  if (!normalized) return false
  return SUSPICIOUS_REQUEST_PATTERNS.some((p) => p.test(normalized))
}

export function detectSensitiveInfoRequest(normalized: string): boolean {
  if (!normalized) return false
  return SENSITIVE_INFO_PATTERNS.some((p) => p.test(normalized))
}

export function detectJailbreak(message: string): boolean {
  const n = normalizeForPromptInjectionScan(message)
  return detectCriticalPromptInjection(n) || detectExtendedJailbreak(n)
}

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

export function applyPreProcessing(
  message: string,
  config: GovernanceConfig
): PreProcessingResult {
  const normalized = normalizeForPromptInjectionScan(message)
  const jailbreakOn = Boolean(config.filters.jailbreakProtection)
  const { blocked, layer } = evaluatePromptInjectionBlock(message, jailbreakOn)

  if (blocked) {
    logger.warn('[applyPreProcessing] 🛡️ Entrada bloqueada (prompt injection / jailbreak):', {
      layer,
      jailbreakProtectionEnabled: jailbreakOn,
      messagePreview: message ? `[redacted chars=${message.length}]` : '',
    })
    return {
      blocked: true,
      reason: layer === 'critical' ? 'prompt_injection_critical' : 'jailbreak_detected',
      response: BLOCKED_RESPONSES.generic,
    }
  }

  if (config.filters.blockSensitiveOperationalInfo && detectSensitiveInfoRequest(normalized)) {
    logger.warn('[applyPreProcessing] 🛡️ Entrada bloqueada (informação sensível):', {
      messagePreview: message ? `[redacted chars=${message.length}]` : '',
    })
    return {
      blocked: true,
      reason: 'sensitive_info_request',
      response: BLOCKED_RESPONSES.sensitiveInfoRequest,
    }
  }

  if (config.filters.blockSuspiciousRequests && detectSuspiciousRequest(normalized)) {
    logger.warn('[applyPreProcessing] 🛡️ Entrada bloqueada (pedido suspeito):', {
      messagePreview: message ? `[redacted chars=${message.length}]` : '',
    })
    return {
      blocked: true,
      reason: 'suspicious_request',
      response: BLOCKED_RESPONSES.suspiciousRequest,
    }
  }

  if (config.filters.blockTechnicalCodeRequests && detectTechnicalCodeRequest(normalized)) {
    logger.warn('[applyPreProcessing] 🛡️ Entrada bloqueada (pedido técnico/código):', {
      messagePreview: message ? `[redacted chars=${message.length}]` : '',
    })
    return {
      blocked: true,
      reason: 'technical_code_request',
      response: BLOCKED_RESPONSES.technicalCodeRequest,
    }
  }

  return { blocked: false }
}
