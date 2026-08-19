import { describe, expect, it } from 'vitest'
import {
  createMealHabit,
  defaultMealHabit,
  leftoverOf,
  mealDaysFromLegacy,
  necessaryTotal,
  remainingDateList,
  spendableOf,
  type MealHabit,
} from './leftover.ts'

const habitBoth60: MealHabit = defaultMealHabit()

describe('remainingDateList', () => {
  it('lists inclusive calendar days through month end', () => {
    const days = remainingDateList({
      now: new Date('2026-08-24T12:00:00+08:00'),
      mode: 'calendar',
      customDays: 99,
    })
    expect(days).toHaveLength(8)
  })
})

describe('necessaryTotal / leftover', () => {
  it('matches the 1000 / 8 days / 60+60 example', () => {
    const now = new Date('2026-08-24T12:00:00+08:00')
    const dates = remainingDateList({ now, mode: 'calendar', customDays: 99 })
    const necessary = necessaryTotal(habitBoth60, dates)
    expect(necessary).toBe(960)
    expect(leftoverOf(1000, necessary)).toBe(40)
    expect(spendableOf(40, 0)).toBe(40)
    expect(spendableOf(40, 50)).toBe(0)
  })

  it('skips dinners when habit says lunch only on weekdays', () => {
    const now = new Date('2026-08-24T12:00:00+08:00')
    const dates = remainingDateList({ now, mode: 'weekdays', customDays: 99 })
    const habit = createMealHabit(mealDaysFromLegacy({
      weekdayLunch: true,
      weekdayDinner: false,
      weekendLunch: false,
      weekendDinner: false,
    }), 60, 60)
    // Aug 24-28, 31 = 6 weekdays, lunch only 60
    expect(dates).toHaveLength(6)
    expect(necessaryTotal(habit, dates)).toBe(360)
  })

  it('uses the individual weekday meal switches', () => {
    const dates = remainingDateList({
      now: new Date('2026-08-24T12:00:00+08:00'),
      mode: 'calendar',
      customDays: 99,
    })
    const habit = createMealHabit({
      ...habitBoth60.days,
      tue: { lunch: true, dinner: false },
    }, 60, 60)

    // Eight days normally cost 960; Tuesday 8/25 has no dinner.
    expect(necessaryTotal(habit, dates)).toBe(900)
  })
})
