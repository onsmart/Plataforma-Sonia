/**
 * URL pública do backend (HTTPS) usada em webhooks externos (Calendly, etc.).
 * Configure BACKEND_PUBLIC_URL no .env do servidor de produção.
 */
export function resolvePublicBackendBaseUrl(): string {
  const raw = String(
    process.env.BACKEND_PUBLIC_URL ||
      process.env.BACKEND_URL ||
      process.env.API_PUBLIC_URL ||
      ''
  )
    .trim()
    .replace(/\/+$/, '')

  return raw
}
