import { describe, expect, it } from 'vitest'
import { monthKey, remainingDays } from './month.ts'

describe('remainingDays', () => {
  it('counts today through month end in Asia/Taipei', () => {
    expect(remainingDays(new Date('2026-08-19T01:00:00+08:00'))).toBe(13)
  })

  it('is 1 on the last day of the month', () => {
    expect(remainingDays(new Date('2026-08-31T23:59:00+08:00'))).toBe(1)
  })

  it('is the full month length on the 1st', () => {
    expect(remainingDays(new Date('2026-02-01T00:00:00+08:00'))).toBe(28)
  })

  it('uses Taipei calendar date when UTC is still the previous day', () => {
    // 2026-08-31 22:00 UTC = 2026-09-01 06:00 Taipei
    expect(remainingDays(new Date('2026-08-31T22:00:00Z'))).toBe(30)
  })
})

describe('monthKey', () => {
  it('formats the Taipei year-month', () => {
    expect(monthKey(new Date('2026-08-19T01:00:00+08:00'))).toBe('2026-08')
  })

  it('rolls to September after Taipei midnight', () => {
    expect(monthKey(new Date('2026-08-31T22:00:00Z'))).toBe('2026-09')
  })
})
