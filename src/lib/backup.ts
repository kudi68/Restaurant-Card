import { type PlanCartLine, type PlanDraft } from './plan.ts'
import { monthKey, taipeiParts } from './month.ts'
import { normalizeState, type AppState, type LedgerEntry } from './storage.ts'

export const BACKUP_FORMAT = 'restaurant-card-backup'
export const BACKUP_VERSION = 1
export const MAX_BACKUP_BYTES = 2_000_000

type BackupEnvelope = {
  format: typeof BACKUP_FORMAT
  version: typeof BACKUP_VERSION
  exportedAt: string
  app: AppState
  plan: PlanDraft
}

export type BackupSummary = {
  exportedAt: string
  monthKey: string
  balance: number | null
  entryCount: number
  planLineCount: number
}

export type RestoreResult =
  | { ok: true; state: AppState; plan: PlanDraft; summary: BackupSummary }
  | { ok: false; error: string }

export type ValidBackup = Extract<RestoreResult, { ok: true }>

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/
const DATE_KEY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
const CATEGORIES = new Set(['buffet', 'nabeyaki', 'noodles', 'dessert', 'grocery', 'drink', 'custom'])
const PLAN_CATEGORIES = new Set(['drink', 'grocery'])
const SIZES = new Set(['hot_s', 'hot_m', 'iced_m', 'xl'])
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const date = new Date(value)
  return !Number.isNaN(date.getTime()) && date.toISOString() === value
}

function isTaipeiDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_KEY.test(value)) return false
  const date = new Date(`${value}T12:00:00+08:00`)
  if (Number.isNaN(date.getTime())) return false
  const parts = taipeiParts(date)
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}` === value
}

function isTicketLine(value: unknown): boolean {
  if (!isRecord(value)) return false
  return typeof value.category === 'string'
    && CATEGORIES.has(value.category)
    && typeof value.name === 'string'
    && value.name.length > 0
    && value.name.length <= 200
    && (value.size == null || (typeof value.size === 'string' && SIZES.has(value.size)))
    && isFiniteNumber(value.unitPrice)
    && value.unitPrice >= 0
    && isFiniteNumber(value.qty)
    && Number.isInteger(value.qty)
    && value.qty > 0
}

function isLedgerEntry(value: unknown): value is LedgerEntry {
  if (!isRecord(value)) return false
  return typeof value.id === 'string'
    && value.id.length > 0
    && isIsoTimestamp(value.at)
    && (value.type === 'spend' || value.type === 'adjust')
    && isFiniteNumber(value.amount)
    && (value.note == null || (typeof value.note === 'string' && value.note.length <= 500))
    && (value.lines == null || (Array.isArray(value.lines) && value.lines.every(isTicketLine)))
}

function isHabit(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (!['weekdayLunch', 'weekdayDinner', 'weekendLunch', 'weekendDinner'].every((key) => typeof value[key] === 'boolean')) return false
  if (!isFiniteNumber(value.lunchPrice) || value.lunchPrice < 0 || !isFiniteNumber(value.dinnerPrice) || value.dinnerPrice < 0) return false
  const days = value.days
  if (!isRecord(days)) return false
  return DAYS.every((day) => {
    const meal = days[day]
    return isRecord(meal) && typeof meal.lunch === 'boolean' && typeof meal.dinner === 'boolean'
  })
}

function isAppState(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false
  if (value.version !== 2 || (value.mode !== 'scarcity' && value.mode !== 'surplus')) return false
  if (value.balance !== null && !isFiniteNumber(value.balance)) return false
  if (typeof value.monthKey !== 'string' || !MONTH_KEY.test(value.monthKey)) return false
  if (!isFiniteNumber(value.mealUnitPrice) || value.mealUnitPrice < 0) return false
  if (!isFiniteNumber(value.drinkUnitPrice) || value.drinkUnitPrice < 0) return false
  if (!['calendar', 'weekdays', 'custom'].includes(String(value.dayCountMode))) return false
  if (!isFiniteNumber(value.customRemainingDays) || value.customRemainingDays < 0 || value.customRemainingDays > 31) return false
  if (!SIZES.has(String(value.defaultDrinkSize)) || !['hot_m', 'iced_m'].includes(String(value.defaultDrinkSize))) return false
  if (value.appearance !== 'light' && value.appearance !== 'dark') return false
  if (!isHabit(value.habit)) return false
  if (!isFiniteNumber(value.monthEndReserve) || value.monthEndReserve < 0) return false
  if (!Array.isArray(value.entries) || !value.entries.every(isLedgerEntry)) return false
  if (!isRecord(value.history) || Object.entries(value.history).some(([key, entries]) => !MONTH_KEY.test(key) || !Array.isArray(entries) || !entries.every(isLedgerEntry))) return false
  return true
}

function isPlanLine(value: unknown): value is PlanCartLine {
  if (!isRecord(value)) return false
  return typeof value.category === 'string'
    && PLAN_CATEGORIES.has(value.category)
    && typeof value.name === 'string'
    && value.name.length > 0
    && value.name.length <= 200
    && (value.size == null || (typeof value.size === 'string' && SIZES.has(value.size)))
    && isFiniteNumber(value.qty)
    && Number.isInteger(value.qty)
    && value.qty > 0
    && value.qty <= 99
}

function isPlanDraft(value: unknown): value is PlanDraft {
  if (!isRecord(value)) return false
  if (value.version !== 1 || typeof value.monthKey !== 'string' || !MONTH_KEY.test(value.monthKey)) return false
  if (!isTaipeiDateKey(value.dateKey) || value.dateKey.slice(0, 7) !== value.monthKey) return false
  if (!isRecord(value.eatenToday) || typeof value.eatenToday.lunch !== 'boolean' || typeof value.eatenToday.dinner !== 'boolean') return false
  return Array.isArray(value.lines) && value.lines.every(isPlanLine)
}

function summaryOf(envelope: BackupEnvelope): BackupSummary {
  return {
    exportedAt: envelope.exportedAt,
    monthKey: envelope.app.monthKey,
    balance: envelope.app.balance,
    entryCount: envelope.app.entries.length,
    planLineCount: envelope.plan.lines.length,
  }
}

export function createBackup(state: AppState, plan: PlanDraft, now: Date): string {
  const envelope: BackupEnvelope = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    app: state,
    plan,
  }
  return JSON.stringify(envelope, null, 2)
}

export function restoreBackup(raw: string, now: Date): RestoreResult {
  if (typeof raw !== 'string' || new TextEncoder().encode(raw).byteLength > MAX_BACKUP_BYTES) {
    return { ok: false, error: '備份檔太大，沒有套用。' }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, error: '備份檔不是有效 JSON。' }
  }
  if (!isRecord(parsed) || parsed.format !== BACKUP_FORMAT || parsed.version !== BACKUP_VERSION) {
    return { ok: false, error: '這不是餐卡備份檔。' }
  }
  if (!isIsoTimestamp(parsed.exportedAt) || !isAppState(parsed.app) || !isPlanDraft(parsed.plan)) {
    return { ok: false, error: '備份檔結構不完整或資料已損壞。' }
  }
  const currentMonth = monthKey(now)
  if (parsed.app.monthKey !== currentMonth || parsed.plan.monthKey !== currentMonth || parsed.app.monthKey !== parsed.plan.monthKey) {
    return { ok: false, error: `備份月份不是目前的 ${currentMonth}，為避免靜默清除資料，沒有套用。` }
  }
  try {
    const state = normalizeState(parsed.app, now)
    const plan = parsed.plan
    const envelope: BackupEnvelope = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: parsed.exportedAt,
      app: state,
      plan,
    }
    return { ok: true, state, plan, summary: summaryOf(envelope) }
  } catch {
    return { ok: false, error: '備份檔無法套用，沒有修改目前資料。' }
  }
}
