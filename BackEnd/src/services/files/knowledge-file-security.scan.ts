export type SecurityFinding = {
  id: string
  category: 'prompt_injection' | 'sensitive_data' | 'malicious_instruction' | 'credential_leak'
  label: string
  message: string
}

const PROMPT_INJECTION_PATTERNS: Array<{ id: string; label: string; pattern: RegExp }> = [
  {
    id: 'ignore_instructions',
    label: 'Tentativa de ignorar instruções do sistema',
    pattern: /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  },
  {
    id: 'ignore_instructions_pt',
    label: 'Tentativa de ignorar instruções (PT)',
    pattern: /desconsidere\s+(todas\s+as\s+)?instru(c|ç)(o|õ)es/i,
  },
  {
    id: 'role_override',
    label: 'Redefinição forçada de papel do agente',
    pattern: /voc[eê]\s+[eé]\s+agora\s+(um|uma)\s+/i,
  },
  {
    id: 'system_tag',
    label: 'Tag de sistema / jailbreak',
    pattern: /<\s*system\s*>|\[INST\]|\[\/INST\]|jailbreak|DAN\s+mode/i,
  },
  {
    id: 'reveal_prompt',
    label: 'Pedido para expor prompt interno',
    pattern: /revele?\s+(o\s+)?(prompt|system\s+prompt|instru(c|ç)(o|õ)es\s+internas)/i,
  },
]

const SENSITIVE_DATA_PATTERNS: Array<{ id: string; label: string; pattern: RegExp }> = [
  {
    id: 'cpf',
    label: 'CPF em texto',
    pattern: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/,
  },
  {
    id: 'credit_card',
    label: 'Número de cartão de crédito',
    pattern: /\b(?:\d{4}[\s-]?){3}\d{4}\b/,
  },
  {
    id: 'openai_key',
    label: 'Chave de API (OpenAI/Anthropic)',
    pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/,
  },
  {
    id: 'aws_key',
    label: 'Chave de acesso AWS',
    pattern: /\bAKIA[0-9A-Z]{16}\b/,
  },
  {
    id: 'password_assignment',
    label: 'Senha em texto claro',
    pattern: /\b(senha|password)\s*[:=]\s*\S{6,}/i,
  },
  {
    id: 'private_key',
    label: 'Chave privada (PEM)',
    pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/i,
  },
  {
    id: 'bearer_token',
    label: 'Token Bearer em texto',
    pattern: /\bBearer\s+[A-Za-z0-9._-]{24,}\b/i,
  },
]

const MALICIOUS_SKILL_PATTERNS: Array<{ id: string; label: string; pattern: RegExp }> = [
  {
    id: 'bypass_rules',
    label: 'Instrução para ignorar regras da plataforma',
    pattern: /ignore\s+(todas\s+as\s+)?(regras|skills|restri(c|ç)(o|õ)es)/i,
  },
  {
    id: 'exfiltrate',
    label: 'Instrução para vazar dados',
    pattern: /envie?\s+(todos\s+os\s+)?dados\s+(dos?\s+)?(clientes|usu[aá]rios|sistema)/i,
  },
  {
    id: 'always_obey_user',
    label: 'Subversão de políticas de segurança',
    pattern: /sempre\s+obede[cç]a\s+o\s+usu[aá]rio.*(mesmo\s+que|ainda\s+que)/i,
  },
  {
    id: 'no_refusal',
    label: 'Proibição de recusar pedidos perigosos',
    pattern: /nunca\s+recuse|n[aã]o\s+pode\s+recusar\s+nenhum/i,
  },
]

/**
 * Varre conteúdo de RAG/Skill em busca de injection, credenciais e instruções maliciosas.
 * Valores fictícios óbvios em fixtures de teste usam prefixos documentados (FAKE-, TESTE-).
 */
export function scanKnowledgeFileSecurity(
  text: string,
  purpose: 'rag' | 'skills'
): SecurityFinding[] {
  const findings: SecurityFinding[] = []
  const normalized = text || ''

  for (const item of PROMPT_INJECTION_PATTERNS) {
    if (item.pattern.test(normalized)) {
      findings.push({
        id: item.id,
        category: 'prompt_injection',
        label: item.label,
        message: `Conteúdo suspeito: ${item.label}. Remova instruções que tentem alterar o comportamento do agente.`,
      })
    }
  }

  for (const item of SENSITIVE_DATA_PATTERNS) {
    if (!item.pattern.test(normalized)) continue
    findings.push({
      id: item.id,
      category: 'sensitive_data',
      label: item.label,
      message: `Dado sensível detectado: ${item.label}. Não envie credenciais, CPF real, cartões ou tokens na base de conhecimento.`,
    })
  }

  if (purpose === 'skills') {
    for (const item of MALICIOUS_SKILL_PATTERNS) {
      if (item.pattern.test(normalized)) {
        findings.push({
          id: item.id,
          category: 'malicious_instruction',
          label: item.label,
          message: `Skill maliciosa: ${item.label}. Skills devem definir atendimento seguro, não contornar proteções.`,
        })
      }
    }
  }

  return dedupeFindings(findings)
}

function dedupeFindings(findings: SecurityFinding[]): SecurityFinding[] {
  const seen = new Set<string>()
  return findings.filter((f) => {
    if (seen.has(f.id)) return false
    seen.add(f.id)
    return true
  })
}
