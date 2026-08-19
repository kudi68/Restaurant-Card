import { describe, expect, it } from 'vitest'
import {
  applyAdjust,
  applySpend,
  conversions,
  dailyAverage,
  todayAdvice,
} from './money.ts'

describe('dailyAverage', () => {
  it('splits remaining balance across inclusive remaining days', () => {
    expect(dailyAverage(1300, 13)).toBe(100)
  })

  it('returns null when there are no remaining days', () => {
    expect(dailyAverage(100, 0)).toBeNull()
  })

  it('returns null when balance is not a finite number', () => {
    expect(dailyAverage(Number.NaN, 10)).toBeNull()
  })
})

describe('todayAdvice', () => {
  it('scarcity: remaining allowance is daily minus already spent', () => {
    expect(todayAdvice('scarcity', 100, 30)).toEqual({
      mode: 'scarcity',
      daily: 100,
      spentToday: 30,
      remainingAllowance: 70,
      stillNeed: 0,
      overspent: false,
    })
  })

  it('scarcity: marks overspent when spent exceeds daily', () => {
    expect(todayAdvice('scarcity', 100, 150).overspent).toBe(true)
    expect(todayAdvice('scarcity', 100, 150).remainingAllowance).toBe(-50)
  })

  it('surplus: stillNeed is daily minus already spent, floored at 0', () => {
    expect(todayAdvice('surplus', 100, 40)).toEqual({
      mode: 'surplus',
      daily: 100,
      spentToday: 40,
      remainingAllowance: 60,
      stillNeed: 60,
      overspent: false,
    })
    expect(todayAdvice('surplus', 100, 120).stillNeed).toBe(0)
  })
})

describe('conversions', () => {
  it('converts a 1300 / 13-day example into meals, drinks, and days-to-item', () => {
    expect(conversions(1300, 100, 120, 55)).toEqual({
      mealsLeft: 1300 / 120,
      drinksLeft: 1300 / 55,
      daysPerMeal: 120 / 100,
      daysPerDrink: 55 / 100,
    })
  })

  it('returns null fields when unit price or daily is not usable', () => {
    expect(conversions(1300, 0, 120, 55).daysPerMeal).toBeNull()
    expect(conversions(1300, 100, 0, 55).mealsLeft).toBeNull()
  })
})

describe('ledger math', () => {
  it('applySpend subtracts a positive amount', () => {
    expect(applySpend(1300, 80)).toBe(1220)
  })

  it('applySpend ignores non-positive amounts', () => {
    expect(applySpend(1300, 0)).toBe(1300)
    expect(applySpend(1300, -20)).toBe(1300)
  })

  it('applyAdjust sets an absolute balance', () => {
    expect(applyAdjust(999)).toBe(999)
  })
})
