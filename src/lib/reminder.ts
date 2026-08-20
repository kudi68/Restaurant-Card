import { taipeiParts } from './month.ts'
import type { LedgerEntry } from './storage.ts'

export const BALANCE_REMINDER_DAYS = 3

function isValidDate(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime())
}

function taipeiDayOrdinal(date: Date): number {
  const { year, month, day } = taipeiParts(date)
  return Date.UTC(year, month - 1, day) / 86_400_000
}

export function latestBalanceRecord(entries: LedgerEntry[]): LedgerEntry | null {
  return entries
    .filter((entry) => entry.type === 'adjust' && isValidDate(entry.at))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())[0] ?? null
}

export function balanceReminderFor(
  entries: LedgerEntry[],
  now: Date,
  thresholdDays = BALANCE_REMINDER_DAYS,
): { days: number } | null {
  const latest = latestBalanceRecord(entries)
  if (!latest) return null
  const days = taipeiDayOrdinal(now) - taipeiDayOrdinal(new Date(latest.at))
  if (days <= thresholdDays) return null
  return { days }
}
