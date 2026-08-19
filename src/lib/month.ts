export const TAIPEI_TZ = 'Asia/Taipei'

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

