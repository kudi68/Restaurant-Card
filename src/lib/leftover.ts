import {
  isTaipeiWeekday,
  lastDayOfMonth,
  taipeiParts,
  type DayCountMode,
} from './month.ts'

export type MealHabit = {
  weekdayLunch: boolean
  weekdayDinner: boolean
  weekendLunch: boolean
  weekendDinner: boolean
  lunchPrice: number
  dinnerPrice: number
}

export const defaultMealHabit = (): MealHabit => ({
  weekdayLunch: true,
  weekdayDinner: true,
  weekendLunch: true,
  weekendDinner: true,
  lunchPrice: 60,
  dinnerPrice: 60,
})

function noonInTaipei(year: number, month: number, day: number): Date {
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return new Date(`${year}-${mm}-${dd}T12:00:00+08:00`)
}

export function remainingDateList(input: {
  now: Date
  mode: DayCountMode
  customDays: number
}): Date[] {
  const { year, month, day } = taipeiParts(input.now)
  const last = lastDayOfMonth(year, month)
  const calendar: Date[] = []
  for (let d = day; d <= last; d++) calendar.push(noonInTaipei(year, month, d))

  if (input.mode === 'weekdays') return calendar.filter((date) => isTaipeiWeekday(date))
  if (input.mode === 'custom') {
    const n = Math.max(0, Math.floor(input.customDays))
    return calendar.slice(0, n)
  }
  return calendar
}

export function mealsOnDate(habit: MealHabit, date: Date): { lunch: boolean; dinner: boolean } {
  const weekday = isTaipeiWeekday(date)
  return {
    lunch: weekday ? habit.weekdayLunch : habit.weekendLunch,
    dinner: weekday ? habit.weekdayDinner : habit.weekendDinner,
  }
}

export function necessaryOnDate(habit: MealHabit, date: Date): number {
  const meals = mealsOnDate(habit, date)
  let total = 0
  if (meals.lunch && habit.lunchPrice > 0) total += habit.lunchPrice
  if (meals.dinner && habit.dinnerPrice > 0) total += habit.dinnerPrice
  return total
}

export function necessaryTotal(habit: MealHabit, dates: Date[]): number {
  return dates.reduce((sum, date) => sum + necessaryOnDate(habit, date), 0)
}

export function leftoverOf(balance: number, necessary: number): number {
  if (!Number.isFinite(balance) || !Number.isFinite(necessary)) return 0
  return balance - necessary
}

export function spendableOf(leftover: number, reserve: number): number {
  const keep = Number.isFinite(reserve) && reserve > 0 ? reserve : 0
  return Math.max(0, leftover - keep)
}

export function countAffordable(spendable: number, unitPrice: number): number | null {
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) return null
  return Math.floor(Math.max(0, spendable) / unitPrice)
}
