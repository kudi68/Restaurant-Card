import {
  isTaipeiWeekday,
  lastDayOfMonth,
  taipeiParts,
  taipeiWeekday,
  type DayCountMode,
} from './month.ts'

export const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export type WeekdayKey = typeof WEEKDAY_KEYS[number]
export type MealChoice = { lunch: boolean; dinner: boolean }
export type MealDays = Record<WeekdayKey, MealChoice>

export type MealHabit = {
  // Kept for short-lived compatibility with an already-open v1 PWA tab.
  weekdayLunch: boolean
  weekdayDinner: boolean
  weekendLunch: boolean
  weekendDinner: boolean
  days: MealDays
  lunchPrice: number
  dinnerPrice: number
}

const WEEKDAYS: WeekdayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri']
const WEEKENDS: WeekdayKey[] = ['sat', 'sun']

export function createMealHabit(days: MealDays, lunchPrice: number, dinnerPrice: number): MealHabit {
  return {
    weekdayLunch: WEEKDAYS.some((key) => days[key].lunch),
    weekdayDinner: WEEKDAYS.some((key) => days[key].dinner),
    weekendLunch: WEEKENDS.some((key) => days[key].lunch),
    weekendDinner: WEEKENDS.some((key) => days[key].dinner),
    days,
    lunchPrice,
    dinnerPrice,
  }
}

export function mealDaysFromLegacy(input: {
  weekdayLunch: boolean
  weekdayDinner: boolean
  weekendLunch: boolean
  weekendDinner: boolean
}): MealDays {
  return {
    mon: { lunch: input.weekdayLunch, dinner: input.weekdayDinner },
    tue: { lunch: input.weekdayLunch, dinner: input.weekdayDinner },
    wed: { lunch: input.weekdayLunch, dinner: input.weekdayDinner },
    thu: { lunch: input.weekdayLunch, dinner: input.weekdayDinner },
    fri: { lunch: input.weekdayLunch, dinner: input.weekdayDinner },
    sat: { lunch: input.weekendLunch, dinner: input.weekendDinner },
    sun: { lunch: input.weekendLunch, dinner: input.weekendDinner },
  }
}

export const defaultMealHabit = (): MealHabit => createMealHabit(
  mealDaysFromLegacy({
    weekdayLunch: true,
    weekdayDinner: true,
    weekendLunch: true,
    weekendDinner: true,
  }),
  60,
  60,
)

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

export function weekdayKey(date: Date): WeekdayKey {
  const keys: WeekdayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  return keys[taipeiWeekday(date)] ?? 'sun'
}

export function mealsOnDate(habit: MealHabit, date: Date): MealChoice {
  return habit.days[weekdayKey(date)]
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
