export type KnowledgeFilePurpose = 'rag' | 'skills'

export type ValidationCriterion = {
  id: string
  label: string
  passed: boolean
  message?: string
}

export type KnowledgeValidationResult = {
  valid: boolean
  purpose: KnowledgeFilePurpose
  errors: string[]
  criteria: ValidationCriterion[]
  suggestions: string[]
}

const GENERIC_RAG_PATTERNS = [
  /^documento de teste\.?$/i,
  /^arquivo de exemplo\.?$/i,
  /^lorem ipsum/i,
  /^teste\.?$/i,
]

const RAG_KNOWLEDGE_SIGNAL =
  /\b(plano|hor[aá]rio|pre[cç]o|regra|c[oó]digo|procedimento|pol[ií]tica|servi[cç]o|produto|empresa|cliente|atendimento|integra[cç][aã]o|faq|como funciona|passo a passo)\b/i

const SKILL_RULE_SIGNAL =
  /\b(permitid[oa]s?|proibid[oa]s?|n[aã]o pode|nao pode|deve|fallback|regra[s]?|comportamento|##\s*skill|a[cç][oõ]es?\s+(permitidas|proibidas)|quando o usu[aá]rio|recusar|encaminhar)\b/i

function countUniqueWords(text: string): number {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2)
  return new Set(words).size
}

function countSubstantiveLines(text: string): number {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 20).length
}

function pushCriterion(
  criteria: ValidationCriterion[],
  errors: string[],
  id: string,
  label: string,
  passed: boolean,
  failMessage: string
) {
  criteria.push({ id, label, passed, message: passed ? undefined : failMessage })
  if (!passed) errors.push(failMessage)
}

/**
 * Valida conteúdo textual de arquivo RAG ou Skills antes de ativar/indexar.
 */
export function validateKnowledgeFileContent(
  rawText: string,
  purpose: KnowledgeFilePurpose
): KnowledgeValidationResult {
  const text = (rawText || '').trim()
  const errors: string[] = []
  const criteria: ValidationCriterion[] = []
  const suggestions: string[] = []
  const isRag = purpose === 'rag'

  pushCriterion(
    criteria,
    errors,
    'not_empty',
    'Arquivo não está vazio',
    text.length > 0,
    'O arquivo está vazio ou não contém texto legível.'
  )

  if (text.length === 0) {
    return { valid: false, purpose, errors, criteria, suggestions: buildSuggestions(purpose) }
  }

  const minLength = isRag ? 200 : 120
  pushCriterion(
    criteria,
    errors,
    'min_length',
    isRag ? 'Texto suficiente para base de conhecimento' : 'Texto suficiente para extrair regras',
    text.length >= minLength,
    isRag
      ? `O conteúdo é curto demais (${text.length} caracteres). Inclua pelo menos ${minLength} caracteres com informações úteis.`
      : `O conteúdo é curto demais (${text.length} caracteres). Descreva regras com pelo menos ${minLength} caracteres.`
  )

  const printableRatio =
    text.replace(/[\s\p{L}\p{N}\p{P}]/gu, '').length / Math.max(text.length, 1)
  pushCriterion(
    criteria,
    errors,
    'readable',
    'Conteúdo legível',
    printableRatio < 0.35,
    'O conteúdo parece ilegível ou corrompido (muitos caracteres inválidos).'
  )

  const substantiveLines = countSubstantiveLines(text)
  pushCriterion(
    criteria,
    errors,
    'structure',
    'Estrutura mínima (linhas ou parágrafos)',
    substantiveLines >= 2 || text.split(/\n\s*\n/).filter((p) => p.trim().length >= 40).length >= 2,
    'Adicione parágrafos ou seções com informação concreta (não apenas títulos ou uma linha).'
  )

  if (isRag) {
    const uniqueWords = countUniqueWords(text)
    const normalized = text.replace(/\s+/g, ' ').trim()
    const isGenericPhrase = GENERIC_RAG_PATTERNS.some((p) => p.test(normalized))
    const tooGeneric = uniqueWords < 12 && text.length < 400

    pushCriterion(
      criteria,
      errors,
      'not_generic',
      'Conteúdo não é genérico demais',
      !isGenericPhrase && !tooGeneric,
      'O texto é genérico demais para servir de base de conhecimento. Inclua fatos específicos (produto, horários, regras, procedimentos).'
    )

    const hasKnowledgeSignal =
      RAG_KNOWLEDGE_SIGNAL.test(text) ||
      (text.match(/^[\s]*[-*•]/gm) || []).length >= 3 ||
      (text.match(/\?/g) || []).length >= 1

    pushCriterion(
      criteria,
      errors,
      'knowledge_value',
      'Informações úteis para consulta',
      hasKnowledgeSignal,
      'Inclua dados consultáveis: nomes de planos/serviços, horários, políticas, procedimentos ou perguntas frequentes.'
    )

    suggestions.push(
      'RAG é conhecimento consultável — evite copiar o prompt do agente inteiro neste arquivo.',
      'Use fatos que o agente não saberia sem este documento (preços fictícios de teste, horários, códigos internos).'
    )
  } else {
    const ruleMatches = text.match(SKILL_RULE_SIGNAL) || []
    pushCriterion(
      criteria,
      errors,
      'has_rules',
      'Regras ou comportamentos explícitos',
      ruleMatches.length >= 2,
      'Inclua regras claras (permitido/proibido/deve/fallback). Use seções como "## SKILL:" ou listas de ações.'
    )

    const hasForbidden =
      /\b(proibid|n[aã]o pode|nao pode|nunca|não informar|nao informar)\b/i.test(text)
    const hasAllowed = /\b(permitid|pode|deve|orientar|encaminhar)\b/i.test(text)
    pushCriterion(
      criteria,
      errors,
      'constraints',
      'Limites ou permissões definidos',
      hasForbidden || hasAllowed,
      'Defina o que o agente pode e o que não pode fazer.'
    )

    const hasFallback =
      /\b(fallback|quando n[aã]o souber|não tenho essa informa|nao tenho essa informa|confirmar com a equipe)\b/i.test(
        text
      )
    pushCriterion(
      criteria,
      errors,
      'fallback',
      'Instrução quando não souber responder',
      hasFallback,
      'Inclua o que fazer quando faltar informação (ex.: transparência + contato humano).'
    )

    suggestions.push(
      'Skills definem comportamento — não use apenas FAQ ou lista de fatos.',
      'Separe Skills (regras) de RAG (conhecimento) em arquivos diferentes.'
    )
  }

  return {
    valid: errors.length === 0,
    purpose,
    errors,
    criteria,
    suggestions: errors.length > 0 ? [...suggestions, ...buildSuggestions(purpose)] : suggestions,
  }
}

function buildSuggestions(purpose: KnowledgeFilePurpose): string[] {
  if (purpose === 'rag') {
    return [
      'Exemplo válido: BackEnd/test-fixtures/knowledge/rag-teste-plano-aurora.md',
      'Corrija e envie novamente o arquivo.',
    ]
  }
  return [
    'Exemplo válido: BackEnd/test-fixtures/knowledge/skill-teste-validacao-comportamento.md',
    'Corrija e envie novamente o arquivo.',
  ]
}

export function formatValidationErrorResponse(result: KnowledgeValidationResult) {
  return {
    error: 'Arquivo inválido para Base de Conhecimento',
    valid: false,
    purpose: result.purpose,
    errors: result.errors,
    criteria: result.criteria,
    suggestions: result.suggestions,
  }
}
