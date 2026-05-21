import { BASE_URL, getAuthHeaders } from './api'
import { filterMainFlows, type FlowListEntry } from '../lib/flow-kind'

export type { FlowListEntry } from '../lib/flow-kind'

export async function fetchFlowsList(
  email: string,
  options?: { mainOnly?: boolean }
): Promise<FlowListEntry[]> {
  const params = new URLSearchParams({ email })
  if (options?.mainOnly) {
    params.set('main_only', 'true')
  }

  const response = await fetch(`${BASE_URL}/flows?${params.toString()}`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  })

  const result = await response.json().catch(() => [])

  if (!response.ok) {
    const message =
      (result && typeof result === 'object' && (result.details || result.error)) ||
      'Erro ao carregar fluxos.'
    throw new Error(String(message))
  }

  const rows = Array.isArray(result) ? (result as FlowListEntry[]) : []
  return options?.mainOnly ? filterMainFlows(rows) : rows
}
