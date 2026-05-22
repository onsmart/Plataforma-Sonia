import { buildAgentLanguageInstruction } from '../../utils/agent-language'
import { buildAgentSystemPromptSections } from './agent-integration-tools-prompt'

/**
 * Prompt de sistema: personalidade + papel do template (editavel) + ferramentas ativas (automatico).
 * Nao despeja JSON de extra_features — comportamento de negocio vem do template.
 */
export function buildAgentSystemPrompt(
  personalityPrompt: string | null | undefined,
  templateRole: string | null | undefined,
  primaryLanguage?: string | null,
  extraFeaturesRaw?: string | null | unknown
): string {
  const parts = buildAgentSystemPromptSections({
    personalityPrompt,
    templateRole,
    extraFeaturesRaw,
  })

  const languageInstruction = buildAgentLanguageInstruction(primaryLanguage)
  parts.push(languageInstruction)

  if (parts.length > 1) {
    return parts.join('\n\n')
  }

  return `Você é um assistente virtual útil.\n\n${languageInstruction}`
}
