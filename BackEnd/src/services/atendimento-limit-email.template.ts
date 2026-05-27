/**
 * Template transacional: limite mensal de atendimentos (Plataforma Sonia / Onsmart.ai).
 */

export type AtendimentoLimitEmailInput = {
  planTitle: string
  used: number
  limit: number | null
  billingMonth: string
}

const ONSMART_SITE = String(process.env.ONSMART_SITE_URL || 'https://www.onsmart.ai').replace(/\/$/, '')
const PLATFORM_APP = String(process.env.PLATFORM_APP_URL || process.env.FRONTEND_URL || '').replace(
  /\/$/,
  ''
)

function formatBillingMonthPt(isoDate: string): string {
  const [year, month] = isoDate.split('-').map(Number)
  if (!year || !month) return isoDate
  const label = new Date(year, month - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function usagePercent(used: number, limit: number | null): number {
  if (!limit || limit <= 0) return 100
  return Math.min(100, Math.round((used / limit) * 100))
}

function limitLabel(limit: number | null): string {
  return limit != null ? String(limit) : 'ilimitado'
}

/** Área de suporte da plataforma (em desenvolvimento). Defina PLATFORM_SUPPORT_URL ou PLATFORM_APP_URL. */
function platformSupportUrl(): string | null {
  const explicit = String(process.env.PLATFORM_SUPPORT_URL || '').trim().replace(/\/$/, '')
  if (explicit) return explicit
  if (PLATFORM_APP) return `${PLATFORM_APP}/support`
  return null
}

export function buildAtendimentoLimitEmail(input: AtendimentoLimitEmailInput): {
  subject: string
  text: string
  html: string
} {
  const { planTitle, used, limit, billingMonth } = input
  const periodLabel = formatBillingMonthPt(billingMonth)
  const percent = usagePercent(used, limit)
  const limitStr = limitLabel(limit)
  const supportUrl = platformSupportUrl()
  const supportLinkLine = supportUrl
    ? `Acesse a área de Suporte da Plataforma Sonia: ${supportUrl}`
    : 'Acesse a área de Suporte da Plataforma Sonia (em breve no menu da plataforma).'

  const subject = `Limite de atendimentos atingido — ${planTitle}`

  const text = [
    'ONSMART.AI · Plataforma Sonia',
    '',
    'Limite mensal de atendimentos atingido',
    '',
    `Olá,`,
    '',
    `Informamos que sua empresa atingiu o limite de atendimentos do ciclo atual (${periodLabel}) no plano ${planTitle}.`,
    '',
    `Uso no período: ${used} de ${limitStr} atendimentos (${percent}%)`,
    '',
    'O que isso significa?',
    '- Novas conversas de clientes via WhatsApp podem ser bloqueadas até a renovação do ciclo ou upgrade do plano.',
    '- Atendimentos já em andamento e o painel da plataforma continuam acessíveis normalmente.',
    '',
    'Próximos passos:',
    supportLinkLine,
    '- Solicite upgrade de plano, recarga de atendimentos ou fale com nosso time pelo canal de suporte.',
    '',
    'Sobre a Onsmart.ai',
    'Somos pioneiros em IA empresarial no Brasil. A Plataforma Sonia é nossa solução de agentes inteligentes para atendimento, automação e escala com qualidade.',
    '',
    `Site institucional: ${ONSMART_SITE}`,
    '',
    '— Equipe Onsmart.ai · Plataforma Sonia',
    'Notificação automática de uso do plano.',
  ].join('\n')

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
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#312e81 0%,#4f46e5 50%,#6366f1 100%);padding:28px 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.75);">Onsmart.ai</p>
                    <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;">Plataforma Sonia</h1>
                  </td>
                  <td align="right" valign="top">
                    <span style="display:inline-block;background:rgba(255,255,255,0.2);color:#fff;font-size:11px;font-weight:600;padding:6px 12px;border-radius:20px;">Alerta de plano</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Alert banner -->
          <tr>
            <td style="padding:24px 32px 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#fef2f2;border:1px solid #fecaca;border-radius:8px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#b91c1c;text-transform:uppercase;letter-spacing:0.05em;">Limite atingido</p>
                    <p style="margin:0;font-size:15px;line-height:1.5;color:#7f1d1d;">
                      Sua empresa utilizou <strong>${used}</strong> de <strong>${limitStr}</strong> atendimentos previstos para <strong>${periodLabel}</strong>.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:24px 32px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">
                Olá,
              </p>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155;">
                Este é um aviso automático da <strong>Plataforma Sonia</strong>, solução de agentes de IA da
                <a href="${ONSMART_SITE}" style="color:#4f46e5;text-decoration:none;font-weight:600;">Onsmart.ai</a>.
                O plano <strong>${planTitle}</strong> atingiu o teto mensal de atendimentos configurado para o seu ciclo de faturamento.
              </p>
              <!-- Usage card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px;">
                    <p style="margin:0 0 12px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">Resumo de uso</p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:14px;color:#64748b;">Plano atual</td>
                        <td align="right" style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:14px;font-weight:600;color:#0f172a;">${planTitle}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:14px;color:#64748b;">Período</td>
                        <td align="right" style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:14px;font-weight:600;color:#0f172a;">${periodLabel}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:14px;color:#64748b;">Atendimentos utilizados</td>
                        <td align="right" style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:14px;font-weight:600;color:#0f172a;">${used} / ${limitStr}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;font-size:14px;color:#64748b;">Percentual</td>
                        <td align="right" style="padding:8px 0;font-size:14px;font-weight:700;color:#dc2626;">${percent}%</td>
                      </tr>
                    </table>
                    <div style="margin-top:16px;height:8px;background-color:#e2e8f0;border-radius:4px;overflow:hidden;">
                      <div style="height:8px;width:${percent}%;background:linear-gradient(90deg,#f97316,#dc2626);border-radius:4px;"></div>
                    </div>
                  </td>
                </tr>
              </table>
              <!-- Impact -->
              <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#0f172a;">O que acontece agora?</p>
              <ul style="margin:0 0 24px;padding-left:20px;font-size:14px;line-height:1.7;color:#475569;">
                <li style="margin-bottom:8px;">Novas mensagens de clientes via WhatsApp podem ser <strong>bloqueadas</strong> até upgrade ou renovação do ciclo.</li>
                <li style="margin-bottom:8px;">O painel, histórico e configurações da Sonia permanecem disponíveis.</li>
                <li>Para retomar o atendimento automático, solicite upgrade ou recarga pela área de Suporte da plataforma.</li>
              </ul>
              <!-- Suporte -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#eef2ff;border:1px solid #c7d2fe;border-radius:8px;margin-bottom:8px;">
                <tr>
                  <td style="padding:20px;">
                    <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#312e81;">Precisa de ajuda?</p>
                    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#4338ca;">
                      Entre em contato com nosso time pela <strong>área de Suporte da Plataforma Sonia</strong>
                      para solicitar upgrade de plano, recarga de atendimentos ou tirar dúvidas sobre seu ciclo de uso.
                    </p>
                    ${
                      supportUrl
                        ? `<p style="margin:0;font-size:14px;line-height:1.5;color:#4338ca;">
                      Acesse: <a href="${supportUrl}" style="color:#4f46e5;font-weight:600;text-decoration:underline;">${supportUrl}</a>
                    </p>`
                        : `<p style="margin:0;font-size:13px;line-height:1.5;color:#6366f1;">
                      A área de Suporte estará disponível em breve no menu da plataforma. Enquanto isso, nossa equipe pode auxiliá-lo pelos canais habituais da Onsmart.ai.
                    </p>`
                    }
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- About -->
          <tr>
            <td style="padding:0 32px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
                <tr>
                  <td style="padding:20px;">
                    <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#0f172a;">Sobre a Onsmart.ai</p>
                    <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">
                      Pioneiros em transformação empresarial com inteligência artificial no Brasil. Desenvolvemos a
                      <strong>Plataforma Sonia</strong> para automatizar atendimento, escalar operações e entregar
                      experiências consistentes com agentes de IA — com a metodologia e suporte da equipe Onsmart.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background-color:#0f172a;text-align:center;">
              <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#ffffff;">Onsmart.ai · Plataforma Sonia</p>
              <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;">
                <a href="${ONSMART_SITE}" style="color:#a5b4fc;text-decoration:none;">www.onsmart.ai</a>
              </p>
              <p style="margin:0;font-size:11px;color:#64748b;line-height:1.5;">
                Notificação automática de uso do plano. Você recebe este e-mail por ser administrador da conta.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { subject, text, html }
}
