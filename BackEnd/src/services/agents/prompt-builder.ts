import { buildAgentLanguageInstruction } from '../../utils/agent-language'

/**
 * Constrói o prompt de sistema final do agente combinando a personalidade
 * com a parte técnica do template e a política de idioma.
 */
export function buildAgentSystemPrompt(
  personalityPrompt: string | null | undefined,
  templateRole: string | null | undefined,
  primaryLanguage?: string | null
): string {
  const personalityPart = personalityPrompt?.trim() || ''
  const technicalPart = templateRole?.trim() || ''
  const languageInstruction = buildAgentLanguageInstruction(primaryLanguage)

  const parts = [personalityPart, technicalPart, languageInstruction].filter(Boolean)

  if (parts.length > 0) {
    return parts.join('\n\n')
  }

  return `Você é um assistente virtual útil.\n\n${languageInstruction}`
}
