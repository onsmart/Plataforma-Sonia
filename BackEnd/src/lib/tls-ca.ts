import fs from 'fs'
import path from 'path'

let cachedCaBundle: Buffer | null | undefined

function resolveCandidatePaths(): string[] {
  const configuredPath = String(process.env.MAIL_TLS_CA_CERT_PATH || '').trim()

  return [
    configuredPath,
    path.resolve(process.cwd(), 'certs/corporate-ca.pem'),
    path.resolve(process.cwd(), 'certs/fortinet-ca.pem'),
  ].filter(Boolean)
}

export function loadOptionalMailTlsCaBundle(): Buffer | undefined {
  if (cachedCaBundle !== undefined) {
    return cachedCaBundle || undefined
  }

  for (const candidate of resolveCandidatePaths()) {
    const normalized = path.resolve(candidate)
    if (!fs.existsSync(normalized)) {
      continue
    }

    const content = fs.readFileSync(normalized)
    if (content.length > 0) {
      cachedCaBundle = content
      return cachedCaBundle
    }
  }

  cachedCaBundle = null
  return undefined
}
