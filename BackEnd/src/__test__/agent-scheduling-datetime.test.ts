import { describe, expect, it } from 'vitest'
import {
  brazilDayBoundsUtc,
  resolveCalendlyAvailabilityRange,
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

describe('resolveCalendlyAvailabilityRange', () => {
  it('marca dia civil já encerrado como dateInPast', () => {
    const past = resolveCalendlyAvailabilityRange('2020-01-15')
    expect(past.dateInPast).toBe(true)
  })

  it('garante startTime < endTime para dia futuro', () => {
    const far = resolveCalendlyAvailabilityRange('2099-06-03')
    expect(far.dateInPast).toBe(false)
    expect(Date.parse(far.startTime)).toBeLessThan(Date.parse(far.endTime))
  })
})

describe('brazilDayBoundsUtc', () => {
  it('usa meia-noite de São Paulo (UTC-3) para 2026-06-03', () => {
    const { startTime, endTime } = brazilDayBoundsUtc('2026-06-03')
    expect(startTime).toBe('2026-06-03T03:00:00.000Z')
    expect(endTime).toBe('2026-06-04T03:00:00.000Z')
  })
})
