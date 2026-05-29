export type AccountType = 'individual' | 'company'

export const ACCOUNT_TYPE_OPTIONS: {
  value: AccountType
  label: string
  description: string
}[] = [
  {
    value: 'individual',
    label: 'Pessoa física',
    description: 'Uso pessoal — o workspace usa seu nome',
  },
  {
    value: 'company',
    label: 'Pessoa jurídica',
    description: 'Empresa ou organização com nome fantasia',
  },
]

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

/** Máscara CPF: 000.000.000-00 */
export function formatCpf(value: string): string {
  const digits = digitsOnly(value).slice(0, 11)
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

/** Máscara CNPJ: 00.000.000/0000-00 */
export function formatCnpj(value: string): string {
  const digits = digitsOnly(value).slice(0, 14)
  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

export function formatDocument(accountType: AccountType, value: string): string {
  return accountType === 'individual' ? formatCpf(value) : formatCnpj(value)
}

export function maskDocument(
  accountType: AccountType,
  document: string | null | undefined
): string | null {
  const digits = digitsOnly(String(document || ''))
  if (!digits) return null
  if (accountType === 'individual' && digits.length === 11) {
    return `***.***.***-${digits.slice(-2)}`
  }
  if (digits.length === 14) {
    return `**.***.***/****-${digits.slice(-2)}`
  }
  return '••••••'
}

export function accountTypeLabel(accountType: string | null | undefined): string {
  return accountType === 'company' ? 'Pessoa jurídica (PJ)' : 'Pessoa física (PF)'
}

function isRepeatedDigits(digits: string): boolean {
  return /^(\d)\1+$/.test(digits)
}

function isValidCpf(digits: string): boolean {
  if (digits.length !== 11 || isRepeatedDigits(digits)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) sum += Number(digits[i]) * (10 - i)
  let check = (sum * 10) % 11
  if (check === 10) check = 0
  if (check !== Number(digits[9])) return false
  sum = 0
  for (let i = 0; i < 10; i++) sum += Number(digits[i]) * (11 - i)
  check = (sum * 10) % 11
  if (check === 10) check = 0
  return check === Number(digits[10])
}

function isValidCnpj(digits: string): boolean {
  if (digits.length !== 14 || isRepeatedDigits(digits)) return false
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(digits[i]) * weights1[i]
  let check = sum % 11
  check = check < 2 ? 0 : 11 - check
  if (check !== Number(digits[12])) return false
  sum = 0
  for (let i = 0; i < 13; i++) sum += Number(digits[i]) * weights2[i]
  check = sum % 11
  check = check < 2 ? 0 : 11 - check
  return check === Number(digits[13])
}

export function validateDocument(accountType: AccountType, document: string): string | null {
  const digits = digitsOnly(document)
  if (!digits) {
    return accountType === 'individual' ? 'CPF é obrigatório' : 'CNPJ é obrigatório'
  }
  if (accountType === 'individual') {
    if (digits.length !== 11) return 'CPF deve ter 11 dígitos'
    if (!isValidCpf(digits)) return 'CPF inválido'
  } else {
    if (digits.length !== 14) return 'CNPJ deve ter 14 dígitos'
    if (!isValidCnpj(digits)) return 'CNPJ inválido'
  }
  return null
}
