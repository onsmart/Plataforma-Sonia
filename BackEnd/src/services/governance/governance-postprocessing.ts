import logger from '../../lib/logger'
import { GovernanceConfig } from './governance.service'

/**
 * Mascara números de cartão de crédito
 * @param text Texto a ser processado
 * @returns Texto com cartões mascarados
 */
function maskCreditCards(text: string): string {
  // Padrões para cartões de crédito (com ou sem espaços/hífens)
  // Detecta sequências de 13-19 dígitos
  return text.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[DADOS SENSÍVEIS PROTEGIDOS]')
    .replace(/\b\d{13,19}\b/g, '[DADOS SENSÍVEIS PROTEGIDOS]')
}

/**
 * Mascara CPF/SSN
 * @param text Texto a ser processado
 * @returns Texto com CPF/SSN mascarados
 */
function maskSSN(text: string): string {
  // CPF brasileiro: XXX.XXX.XXX-XX ou XXXXXXXXXXX
  text = text.replace(/\b\d{3}[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d{2}\b/g, '[DADOS SENSÍVEIS PROTEGIDOS]')
  
  // SSN americano: XXX-XX-XXXX
  text = text.replace(/\b\d{3}[\s-]?\d{2}[\s-]?\d{4}\b/g, '[DADOS SENSÍVEIS PROTEGIDOS]')
  
  return text
}

/**
 * Mascara endereços de email
 * @param text Texto a ser processado
 * @returns Texto com emails mascarados
 */
function maskEmails(text: string): string {
  return text.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[DADOS SENSÍVEIS PROTEGIDOS]')
}

/**
 * Mascara números de telefone
 * @param text Texto a ser processado
 * @returns Texto com telefones mascarados
 */
function maskPhones(text: string): string {
  // Formato brasileiro: (XX) XXXXX-XXXX ou XX XXXXXXXX
  text = text.replace(/\b(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}[\s-]?\d{4}\b/g, '[DADOS SENSÍVEIS PROTEGIDOS]')
  
  // Formato internacional genérico
  text = text.replace(/\b\+?\d{1,3}[\s-]?\d{2,4}[\s-]?\d{4,9}\b/g, '[DADOS SENSÍVEIS PROTEGIDOS]')
  
  return text
}

/**
 * Aplica pós-processamento DLP (Data Loss Prevention) na resposta
 * @param text Texto da resposta
 * @param config Configuração de governança
 * @returns Texto com dados sensíveis mascarados
 */
export function applyDLP(text: string, config: GovernanceConfig): string {
  if (!text || !text.trim()) return text

  let maskedText = text

  // Aplicar máscaras conforme configuração
  if (config.dlp.creditCard) {
    maskedText = maskCreditCards(maskedText)
  }

  if (config.dlp.ssn) {
    maskedText = maskSSN(maskedText)
  }

  if (config.dlp.email) {
    maskedText = maskEmails(maskedText)
  }

  if (config.dlp.phone) {
    maskedText = maskPhones(maskedText)
  }

  // Log se houver mudanças (dados foram mascarados)
  if (maskedText !== text) {
    logger.log('[applyDLP] 🛡️ Dados sensíveis mascarados na resposta')
  }

  return maskedText
}
