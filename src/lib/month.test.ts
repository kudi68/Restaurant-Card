import { describe, expect, it } from 'vitest'
import { monthKey, planningDays, remainingDays, remainingWeekdays } from './month.ts'

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
    expect(remainingDays(new Date('2026-08-31T22:00:00Z'))).toBe(30)
  })
})

describe('remainingWeekdays', () => {
  it('counts Mon-Fri from today through month end in Taipei', () => {
    // 2026-08-19 Wednesday → weekdays 19-21, 24-28, 31 = 9
    expect(remainingWeekdays(new Date('2026-08-19T12:00:00+08:00'))).toBe(9)
  })

  it('skips today when today is Saturday', () => {
    // 2026-08-22 Saturday → 24-28, 31 = 6
    expect(remainingWeekdays(new Date('2026-08-22T12:00:00+08:00'))).toBe(6)
  })

  it('is 1 on a weekday that is also month end', () => {
    expect(remainingWeekdays(new Date('2026-08-31T09:00:00+08:00'))).toBe(1)
  })
})

describe('planningDays', () => {
  const wed = new Date('2026-08-19T12:00:00+08:00')

  it('uses calendar days by default', () => {
    expect(planningDays({ mode: 'calendar', customDays: 99, now: wed })).toBe(13)
  })

  it('uses remaining weekdays when asked', () => {
    expect(planningDays({ mode: 'weekdays', customDays: 99, now: wed })).toBe(9)
  })

  it('uses a positive custom day count', () => {
    expect(planningDays({ mode: 'custom', customDays: 7, now: wed })).toBe(7)
  })

  it('treats non-positive custom days as 0', () => {
    expect(planningDays({ mode: 'custom', customDays: 0, now: wed })).toBe(0)
    expect(planningDays({ mode: 'custom', customDays: -3, now: wed })).toBe(0)
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
