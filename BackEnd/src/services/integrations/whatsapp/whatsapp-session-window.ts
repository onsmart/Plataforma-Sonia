/**
 * Janela de atendimento ao cliente (24h) — lógica pura testável.
 * O comportamento exato de cobrança/conversa segue a documentação oficial da Meta;
 * aqui usamos heurística conservadora: último inbound do usuário + 24h.
 */

const DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000

export interface CustomerCareWindowComputation {
  /** true se há evidência de inbound recente dentro da janela */
  insideWindow: boolean
  expiresAt: Date | null
  /** true se não há dados de inbound — o caller deve preferir template (modo seguro) */
  conservativeUnknown: boolean
}

export function computeCustomerCareWindow(params: {
  lastInboundAt: Date | null
  now: Date
  windowMs?: number
}): CustomerCareWindowComputation {
  const windowMs = params.windowMs ?? DEFAULT_WINDOW_MS

  if (!params.lastInboundAt) {
    return {
      insideWindow: false,
      expiresAt: null,
      conservativeUnknown: true
    }
  }

  const expiresAt = new Date(params.lastInboundAt.getTime() + windowMs)
  const insideWindow = params.now.getTime() < expiresAt.getTime()

  return {
    insideWindow,
    expiresAt,
    conservativeUnknown: false
  }
}
