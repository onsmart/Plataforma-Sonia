import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  isPlatformAdminEmail,
  parsePlatformAdminEmails,
  PLATFORM_ADMIN_PLAN_TITLE,
} from '../utils/platform-admin'

describe('platform-admin', () => {
  const originalEnv = process.env.PLATFORM_ADMIN_EMAILS

  beforeEach(() => {
    process.env.PLATFORM_ADMIN_EMAILS = 'admin@example.com, Mateus@Onsmart.com.br'
  })

  afterEach(() => {
    process.env.PLATFORM_ADMIN_EMAILS = originalEnv
  })

  it('normaliza e-mails da allowlist', () => {
    const emails = parsePlatformAdminEmails()
    expect(emails.has('admin@example.com')).toBe(true)
    expect(emails.has('mateus@onsmart.com.br')).toBe(true)
  })

  it('identifica administrador da plataforma por e-mail', () => {
    expect(isPlatformAdminEmail('mateus.mantovani@onsmart.com.br')).toBe(false)
    expect(isPlatformAdminEmail('Mateus@Onsmart.com.br')).toBe(true)
    expect(isPlatformAdminEmail('')).toBe(false)
  })

  it('expõe titulo de plano administrador', () => {
    expect(PLATFORM_ADMIN_PLAN_TITLE).toBe('Administrador')
  })
})
