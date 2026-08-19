import { describe, expect, it } from 'vitest'
import { addPlanLine, cartTotal, necessaryTotalForPlan, parsePlanDraft, projectedAfterCart, type PlanCartLine } from './plan.ts'
import { defaultMealHabit, remainingDateList } from './leftover.ts'
import type { DrinkItem, MenuItem } from './menu.ts'

const latte: DrinkItem = {
  category: 'drink',
  name: '拿鐵',
  enabled: true,
  prices: { iced_m: 60, hot_m: 55 },
}
const drinks: MenuItem[] = [latte]

describe('plan cart', () => {
  it('merges the same item and size into one quantity', () => {
    const once = addPlanLine([], { category: 'drink', name: '拿鐵', size: 'iced_m', qty: 1 })
    const twice = addPlanLine(once, { category: 'drink', name: '拿鐵', size: 'iced_m', qty: 1 })
    expect(twice).toEqual([{ category: 'drink', name: '拿鐵', size: 'iced_m', qty: 2 }])
  })

  it('recalculates from the latest menu price without changing the card balance', () => {
    const lines: PlanCartLine[] = [{ category: 'drink', name: '拿鐵', size: 'iced_m', qty: 2 }]
    expect(cartTotal(lines, drinks)).toBe(120)
    const repriced: MenuItem[] = [{ ...latte, prices: { iced_m: 65 } }]
    expect(cartTotal(lines, repriced)).toBe(130)
    expect(projectedAfterCart(500, lines, repriced)).toBe(370)
  })
})

describe('today meal completion', () => {
  it('excludes only the checked meal on today', () => {
    const now = new Date('2026-08-24T12:00:00+08:00')
    const dates = remainingDateList({ now, mode: 'calendar', customDays: 99 })
    const total = necessaryTotalForPlan(defaultMealHabit(), dates, {
      dateKey: '2026-08-24',
      lunch: true,
      dinner: false,
    })
    expect(total).toBe(900)
  })
})

describe('plan draft rollover', () => {
  it('drops a damaged persisted line with a fractional quantity', () => {
    const raw = JSON.stringify({
      version: 1,
      monthKey: '2026-08',
      dateKey: '2026-08-19',
      eatenToday: { lunch: false, dinner: false },
      lines: [{ category: 'drink', name: '拿鐵', size: 'iced_m', qty: 1.5 }],
    })
    expect(parsePlanDraft(raw, new Date('2026-08-19T12:00:00+08:00')).lines).toEqual([])
  })

  it('keeps this month cart but resets eaten meals on a new Taipei day', () => {
    const raw = JSON.stringify({
      version: 1,
      monthKey: '2026-08',
      dateKey: '2026-08-19',
      eatenToday: { lunch: true, dinner: false },
      lines: [{ category: 'drink', name: '拿鐵', size: 'iced_m', qty: 2 }],
    })
    const draft = parsePlanDraft(raw, new Date('2026-08-20T08:00:00+08:00'))
    expect(draft.eatenToday).toEqual({ lunch: false, dinner: false })
    expect(draft.lines).toHaveLength(1)
  })

  it('clears the simulation cart when the month changes', () => {
    const raw = JSON.stringify({
      version: 1,
      monthKey: '2026-08',
      dateKey: '2026-08-31',
      eatenToday: { lunch: true, dinner: true },
      lines: [{ category: 'drink', name: '拿鐵', size: 'iced_m', qty: 2 }],
    })
    const draft = parsePlanDraft(raw, new Date('2026-09-01T08:00:00+08:00'))
    expect(draft.monthKey).toBe('2026-09')
    expect(draft.lines).toEqual([])
    expect(draft.eatenToday).toEqual({ lunch: false, dinner: false })
  })
})
