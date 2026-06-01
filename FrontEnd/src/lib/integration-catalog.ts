export type IntegrationSectionKey = 'crm' | 'calendly' | 'whatsapp' | 'email' | 'voice'

/**
 * Seções visíveis na página Integrações.
 * Ocultar integrações ainda não prontas para uso em produção.
 */
export const INTEGRATION_SECTION_VISIBILITY: Record<IntegrationSectionKey, boolean> = {
  crm: true,
  calendly: true,
  whatsapp: true,
  email: false,
  voice: false,
}

export function isIntegrationSectionVisible(section: IntegrationSectionKey): boolean {
  return INTEGRATION_SECTION_VISIBILITY[section] === true
}
