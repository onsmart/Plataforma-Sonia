import { describe, expect, it } from 'vitest'
import {
  brazilDayBoundsUtc,
  trySwapMonthDayIfPast,
} from '../services/agents/agent-scheduling-datetime'

describe('trySwapMonthDayIfPast', () => {
  it('converte 2026-03-06 para 2026-06-03 quando março já passou (03/06 BR)', () => {
    expect(trySwapMonthDayIfPast('2026-03-06', '2026-06-02')).toBe('2026-06-03')
  })

  it('mantém data já futura', () => {
    expect(trySwapMonthDayIfPast('2026-06-10', '2026-06-02')).toBe('2026-06-10')
  })
})

describe('brazilDayBoundsUtc', () => {
  it('usa meia-noite de São Paulo (UTC-3) para 2026-06-03', () => {
    const { startTime, endTime } = brazilDayBoundsUtc('2026-06-03')
    expect(startTime).toBe('2026-06-03T03:00:00.000Z')
    expect(endTime).toBe('2026-06-04T03:00:00.000Z')
  })
})
