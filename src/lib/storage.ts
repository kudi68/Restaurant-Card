import {
  createMealHabit,
  defaultMealHabit,
  mealDaysFromLegacy,
  WEEKDAY_KEYS,
  type MealDays,
  type MealHabit,
} from './leftover.ts'
import { monthKey, remainingDays, taipeiParts, type DayCountMode } from './month.ts'
import type { Mode } from './money.ts'
import type { Category, SizeKey, TicketLine } from './menu.ts'
import { compiledMenu } from './menu.ts'

export const STORAGE_KEY = 'restaurant-card:v1'

export type LedgerType = 'spend' | 'adjust'
export type DefaultDrinkSize = Extract<SizeKey, 'hot_m' | 'iced_m'>
export type Appearance = 'light' | 'dark'

export type LedgerEntry = {
  id: string
  at: string
  type: LedgerType
  amount: number
  note?: string
  lines?: TicketLine[]
}

export type AppState = {
  version: 2
  mode: Mode
  balance: number | null
  monthKey: string
  mealUnitPrice: number
  drinkUnitPrice: number
  dayCountMode: DayCountMode
  customRemainingDays: number
  defaultDrinkSize: DefaultDrinkSize
  appearance: Appearance
  habit: MealHabit
  // Deprecated v1 field retained until every old PWA tab has upgraded.
  monthEndReserve: number
  entries: LedgerEntry[]
  history: Record<string, LedgerEntry[]>
}

export function defaultState(now: Date): AppState {
  return {
    version: 2,
    mode: 'scarcity',
    balance: null,
    monthKey: monthKey(now),
    mealUnitPrice: compiledMenu.mealUnitPriceDefault,
    drinkUnitPrice: compiledMenu.drinkUnitPriceDefault,
    dayCountMode: 'calendar',
    customRemainingDays: remainingDays(now),
    defaultDrinkSize: 'iced_m',
    appearance: 'light',
    habit: defaultMealHabit(),
    monthEndReserve: 0,
    entries: [],
    history: {},
  }
}

const VALID_CATEGORIES = new Set<Category>([
  'buffet', 'nabeyaki', 'noodles', 'dessert', 'grocery', 'drink', 'custom',
])
const VALID_SIZES = new Set<SizeKey>(['hot_s', 'hot_m', 'iced_m', 'xl'])

function isMonthKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
}

function normalizeTicketLine(value: unknown): TicketLine | null {
  if (!value || typeof value !== 'object') return null
  const line = value as Record<string, unknown>
  if (
    typeof line.category !== 'string' || !VALID_CATEGORIES.has(line.category as Category)
    || typeof line.name !== 'string' || !line.name.trim()
    || !Number.isFinite(line.unitPrice) || Number(line.unitPrice) < 0
    || !Number.isFinite(line.qty) || Number(line.qty) <= 0
  ) return null
  if (line.size != null && (typeof line.size !== 'string' || !VALID_SIZES.has(line.size as SizeKey))) {
    return null
  }
  return {
    category: line.category as Category,
    name: line.name.slice(0, 200),
    size: line.size as SizeKey | undefined,
    unitPrice: Number(line.unitPrice),
    qty: Math.floor(Number(line.qty)),
  }
}

function normalizeLedgerEntry(value: unknown): LedgerEntry | null {
  if (!value || typeof value !== 'object') return null
  const entry = value as Record<string, unknown>
  if (
    typeof entry.id !== 'string' || !entry.id
    || typeof entry.at !== 'string' || Number.isNaN(new Date(entry.at).getTime())
    || (entry.type !== 'spend' && entry.type !== 'adjust')
    || !Number.isFinite(entry.amount)
  ) return null
  const note = typeof entry.note === 'string' ? entry.note.slice(0, 500) : undefined
  const rawLines = Array.isArray(entry.lines) ? entry.lines : []
  const lines = rawLines.map(normalizeTicketLine).filter((line): line is TicketLine => line != null)
  return {
    id: entry.id,
    at: entry.at,
    type: entry.type,
    amount: Number(entry.amount),
    note,
    lines: lines.length > 0 ? lines : undefined,
  }
}

function isMode(value: unknown): value is Mode {
  return value === 'surplus' || value === 'scarcity'
}

function isDayCountMode(value: unknown): value is DayCountMode {
  return value === 'calendar' || value === 'weekdays' || value === 'custom'
}

function isDefaultDrinkSize(value: unknown): value is DefaultDrinkSize {
  return value === 'hot_m' || value === 'iced_m'
}

function isAppearance(value: unknown): value is Appearance {
  return value === 'light' || value === 'dark'
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function finiteNonNegative(value: unknown, fallback: number): number {
  return Number.isFinite(value) && Number(value) >= 0 ? Number(value) : fallback
}

function normalizeHabit(value: unknown, base: MealHabit): MealHabit {
  if (!value || typeof value !== 'object') return base
  const raw = value as Record<string, unknown>
  const legacy = {
    weekdayLunch: bool(raw.weekdayLunch, base.weekdayLunch),
    weekdayDinner: bool(raw.weekdayDinner, base.weekdayDinner),
    weekendLunch: bool(raw.weekendLunch, base.weekendLunch),
    weekendDinner: bool(raw.weekendDinner, base.weekendDinner),
  }
  const legacyDays = mealDaysFromLegacy(legacy)
  const rawDays = raw.days && typeof raw.days === 'object'
    ? raw.days as Record<string, unknown>
    : {}
  const days = {} as MealDays
  for (const key of WEEKDAY_KEYS) {
    const candidate = rawDays[key]
    const record = candidate && typeof candidate === 'object'
      ? candidate as Record<string, unknown>
      : {}
    days[key] = {
      lunch: bool(record.lunch, legacyDays[key].lunch),
      dinner: bool(record.dinner, legacyDays[key].dinner),
    }
  }
  return createMealHabit(
    days,
    finiteNonNegative(raw.lunchPrice, base.lunchPrice),
    finiteNonNegative(raw.dinnerPrice, base.dinnerPrice),
  )
}

function normalizeHistory(value: unknown): Record<string, LedgerEntry[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const history: Record<string, LedgerEntry[]> = {}
  for (const [key, rawEntries] of Object.entries(value)) {
    if (!isMonthKey(key) || !Array.isArray(rawEntries)) continue
    history[key] = rawEntries
      .map(normalizeLedgerEntry)
      .filter((entry): entry is LedgerEntry => entry != null)
  }
  return history
}

export function normalizeState(raw: Record<string, unknown>, now: Date): AppState {
  const base = defaultState(now)
  const entries = Array.isArray(raw.entries)
    ? raw.entries.map(normalizeLedgerEntry).filter((entry): entry is LedgerEntry => entry != null)
    : base.entries
  return {
    version: 2,
    mode: isMode(raw.mode) ? raw.mode : base.mode,
    balance: raw.balance === null || Number.isFinite(raw.balance)
      ? raw.balance as number | null
      : base.balance,
    monthKey: isMonthKey(raw.monthKey) ? raw.monthKey : base.monthKey,
    mealUnitPrice: finiteNonNegative(raw.mealUnitPrice, base.mealUnitPrice),
    drinkUnitPrice: finiteNonNegative(raw.drinkUnitPrice, base.drinkUnitPrice),
    dayCountMode: isDayCountMode(raw.dayCountMode) ? raw.dayCountMode : base.dayCountMode,
    customRemainingDays: Number.isFinite(raw.customRemainingDays)
      ? Math.max(0, Math.min(31, Math.floor(Number(raw.customRemainingDays))))
      : base.customRemainingDays,
    defaultDrinkSize: isDefaultDrinkSize(raw.defaultDrinkSize)
      ? raw.defaultDrinkSize
      : base.defaultDrinkSize,
    appearance: isAppearance(raw.appearance) ? raw.appearance : base.appearance,
    habit: normalizeHabit(raw.habit, base.habit),
    monthEndReserve: finiteNonNegative(raw.monthEndReserve, 0),
    entries,
    history: normalizeHistory(raw.history),
  }
}

export function parseState(raw: string | null, now: Date): AppState {
  if (!raw) return defaultState(now)
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return defaultState(now)
    return rolloverIfNeeded(normalizeState(parsed as Record<string, unknown>, now), now)
  } catch {
    return defaultState(now)
  }
}

export function serializeState(state: AppState): string {
  return JSON.stringify(state)
}

export function rolloverIfNeeded(state: AppState, now: Date): AppState {
  const current = monthKey(now)
  if (state.monthKey === current) return state
  return {
    ...state,
    monthKey: current,
    balance: null,
    customRemainingDays: remainingDays(now),
    entries: [],
    history: {
      ...state.history,
      [state.monthKey]: state.entries,
    },
  }
}

export function spentOnTaipeiDay(entries: LedgerEntry[], now: Date): number {
  const today = taipeiParts(now)
  return entries.reduce((sum, entry) => {
    if (entry.type !== 'spend') return sum
    const at = new Date(entry.at)
    if (Number.isNaN(at.getTime())) return sum
    const parts = taipeiParts(at)
    if (parts.year !== today.year || parts.month !== today.month || parts.day !== today.day) {
      return sum
    }
    return sum + entry.amount
  }, 0)
}

export function loadState(now = new Date()): AppState {
  try {
    return parseState(localStorage.getItem(STORAGE_KEY), now)
  } catch {
    return defaultState(now)
  }
}

export function saveState(state: AppState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, serializeState(state))
    return true
  } catch {
    return false
  }
}
