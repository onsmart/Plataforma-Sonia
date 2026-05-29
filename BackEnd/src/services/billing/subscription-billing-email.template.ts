/**
 * E-mails transacionais: encerramento de assinatura (Plataforma Sonia).
 * Renovação e falha de pagamento inicial ficam com o Stripe Customer emails.
 */

export type SubscriptionBillingEmailKind = 'ended_user_cancel' | 'ended_payment_failed'

export type SubscriptionBillingEmailInput = {
  kind: SubscriptionBillingEmailKind
  planTitle: string
  periodEndLabel?: string | null
  billingPortalUrl?: string | null
}

const ONSMART_SITE = String(process.env.ONSMART_SITE_URL || 'https://www.onsmart.ai').replace(/\/$/, '')
const PLATFORM_APP = String(process.env.PLATFORM_APP_URL || process.env.FRONTEND_URL || '').replace(
  /\/$/,
  ''
)

function billingSettingsUrl(): string | null {
  if (!PLATFORM_APP) return null
  return `${PLATFORM_APP}/configuration?tab=billing`
}

function platformSupportUrl(): string | null {
  const explicit = String(process.env.PLATFORM_SUPPORT_URL || '').trim().replace(/\/$/, '')
  if (explicit) return explicit
  if (PLATFORM_APP) return `${PLATFORM_APP}/support`
  return null
}

function formatDatePt(isoOrLabel?: string | null): string {
  if (!isoOrLabel) return '—'
  const parsed = Date.parse(isoOrLabel)
  if (Number.isNaN(parsed)) return isoOrLabel
  return new Date(parsed).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function kindCopy(kind: SubscriptionBillingEmailKind): {
  badge: string
  headline: string
  accent: string
  bannerBg: string
  bannerBorder: string
  bannerText: string
} {
  if (kind === 'ended_payment_failed') {
    return {
      badge: 'Assinatura encerrada',
      headline: 'Não foi possível manter sua assinatura',
      accent: '#dc2626',
      bannerBg: '#fef2f2',
      bannerBorder: '#fecaca',
      bannerText: '#7f1d1d',
    }
  }

  return {
    badge: 'Assinatura encerrada',
    headline: 'Seu plano foi encerrado',
    accent: '#64748b',
    bannerBg: '#f8fafc',
    bannerBorder: '#e2e8f0',
    bannerText: '#334155',
  }
}

function buildBodyParagraphs(input: SubscriptionBillingEmailInput): string[] {
  const { kind, planTitle, periodEndLabel } = input
  const end = formatDatePt(periodEndLabel)
  const billingUrl = input.billingPortalUrl || billingSettingsUrl()
  const billingLine = billingUrl
    ? `Contrate novamente em: ${billingUrl}`
    : 'Acesse Configuração → Faturamento na Plataforma Sonia para contratar um plano.'

  if (kind === 'ended_payment_failed') {
    return [
      `O ciclo do plano ${planTitle} encerrou e a renovação não foi concluída por falha de pagamento.`,
      periodEndLabel ? `O acesso pago foi encerrado em ${end}.` : 'O acesso pago foi encerrado.',
      'Sua conta voltou ao plano gratuito. Atualize a forma de pagamento e contrate novamente para retomar agentes, integrações e limites do plano pago.',
      'Você pode continuar recebendo e-mails do Stripe sobre cobranças e recibos.',
      billingLine,
    ]
  }

  return [
    `O ciclo do plano ${planTitle} chegou ao fim conforme o cancelamento solicitado anteriormente.`,
    periodEndLabel ? `O acesso pago foi encerrado em ${end}.` : 'O acesso pago foi encerrado.',
    'Sua conta voltou ao plano gratuito. Você pode contratar novamente a qualquer momento.',
    billingLine,
  ]
}

function inAppTitle(kind: SubscriptionBillingEmailKind): string {
  return kind === 'ended_payment_failed'
    ? 'Assinatura encerrada por falha de pagamento'
    : 'Assinatura encerrada'
}

export function buildSubscriptionBillingEmail(input: SubscriptionBillingEmailInput): {
  subject: string
  text: string
  html: string
  inAppTitle: string
  inAppBody: string
} {
  const copy = kindCopy(input.kind)
  const paragraphs = buildBodyParagraphs(input)
  const supportUrl = platformSupportUrl()
  const billingUrl = input.billingPortalUrl || billingSettingsUrl()
  const periodEnd = formatDatePt(input.periodEndLabel)

  const subject =
    input.kind === 'ended_payment_failed'
      ? `Assinatura encerrada — falha de pagamento (${input.planTitle})`
      : `Assinatura encerrada — ${input.planTitle}`

  const text = [
    'ONSMART.AI · Plataforma Sonia',
    '',
    copy.headline,
    '',
    'Olá,',
    '',
    ...paragraphs,
    '',
    supportUrl ? `Suporte: ${supportUrl}` : '',
    `Site: ${ONSMART_SITE}`,
    '',
    '— Equipe Onsmart.ai · Plataforma Sonia',
    'Notificação automática de faturamento.',
  ]
    .filter(Boolean)
    .join('\n')

  const inAppTitleText = inAppTitle(input.kind)
  const inAppBody = paragraphs.join(' ')

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#312e81 0%,#4f46e5 50%,#6366f1 100%);padding:28px 32px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.75);">Onsmart.ai</p>
              <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">Plataforma Sonia</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:${copy.bannerBg};border:1px solid ${copy.bannerBorder};border-radius:8px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:${copy.accent};text-transform:uppercase;letter-spacing:0.05em;">${copy.badge}</p>
                    <p style="margin:0;font-size:16px;line-height:1.5;color:${copy.bannerText};font-weight:600;">${copy.headline}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">Olá,</p>
              ${paragraphs
                .map(
                  (p) =>
                    `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">${p}</p>`
                )
                .join('')}
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:20px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;">Resumo</p>
                    <p style="margin:0 0 4px;font-size:14px;color:#334155;"><strong>Plano:</strong> ${input.planTitle}</p>
                    ${input.periodEndLabel ? `<p style="margin:0;font-size:14px;color:#334155;"><strong>Fim do ciclo:</strong> ${periodEnd}</p>` : ''}
                  </td>
                </tr>
              </table>
              ${
                billingUrl
                  ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#4338ca;">
                <a href="${billingUrl}" style="color:#4f46e5;font-weight:600;text-decoration:underline;">Abrir faturamento na plataforma</a>
              </p>`
                  : ''
              }
              ${
                supportUrl
                  ? `<p style="margin:0;font-size:13px;line-height:1.5;color:#64748b;">Precisa de ajuda? <a href="${supportUrl}" style="color:#4f46e5;">Fale com o suporte</a></p>`
                  : ''
              }
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background-color:#0f172a;text-align:center;">
              <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#ffffff;">Onsmart.ai · Plataforma Sonia</p>
              <p style="margin:0;font-size:11px;color:#64748b;">Notificação automática de faturamento.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { subject, text, html, inAppTitle: inAppTitleText, inAppBody }
}
