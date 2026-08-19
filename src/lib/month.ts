export const TAIPEI_TZ = 'Asia/Taipei'

export type DayCountMode = 'calendar' | 'weekdays' | 'custom'

type DateParts = {
  year: number
  month: number
  day: number
}

export function taipeiParts(now: Date, timeZone = TAIPEI_TZ): DateParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now)
  const num = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value)
  return { year: num('year'), month: num('month'), day: num('day') }
}

export function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function remainingDays(now: Date, timeZone = TAIPEI_TZ): number {
  const { year, month, day } = taipeiParts(now, timeZone)
  return lastDayOfMonth(year, month) - day + 1
}

export function monthKey(now: Date, timeZone = TAIPEI_TZ): string {
  const { year, month } = taipeiParts(now, timeZone)
  return `${year}-${String(month).padStart(2, '0')}`
}

export function millisecondsUntilNextTaipeiMidnight(now: Date): number {
  const { year, month, day } = taipeiParts(now)
  const nextMidnightUtc = Date.UTC(year, month - 1, day + 1) - 8 * 60 * 60 * 1000
  return Math.max(1, nextMidnightUtc - now.getTime())
}

export function taipeiWeekday(now: Date, timeZone = TAIPEI_TZ): number {
  const label = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  }).format(now)
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }
  return map[label] ?? 0
}

export function isTaipeiWeekday(now: Date, timeZone = TAIPEI_TZ): boolean {
  const day = taipeiWeekday(now, timeZone)
  return day >= 1 && day <= 5
}

function noonInTaipei(year: number, month: number, day: number): Date {
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return new Date(`${year}-${mm}-${dd}T12:00:00+08:00`)
}

export function remainingWeekdays(now: Date, timeZone = TAIPEI_TZ): number {
  const { year, month, day } = taipeiParts(now, timeZone)
  const last = lastDayOfMonth(year, month)
  let count = 0
  for (let d = day; d <= last; d++) {
    if (isTaipeiWeekday(noonInTaipei(year, month, d), timeZone)) count += 1
  }
  return count
}

export function planningDays(input: {
  mode: DayCountMode
  customDays: number
  now: Date
}): number {
  if (input.mode === 'custom') {
    if (!Number.isFinite(input.customDays) || input.customDays <= 0) return 0
    return Math.floor(input.customDays)
  }
  if (input.mode === 'weekdays') return remainingWeekdays(input.now)
  return remainingDays(input.now)
}
