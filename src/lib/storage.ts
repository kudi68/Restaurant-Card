import { defaultMealHabit, type MealHabit } from './leftover.ts'
import { monthKey, remainingDays, taipeiParts, type DayCountMode } from './month.ts'
import type { Mode } from './money.ts'
import type { SizeKey, TicketLine } from './menu.ts'
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
  version: 1
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
  monthEndReserve: number
  entries: LedgerEntry[]
  history: Record<string, LedgerEntry[]>
}

export function defaultState(now: Date): AppState {
  return {
    version: 1,
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

function isLedgerEntry(value: unknown): value is LedgerEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as LedgerEntry
  return (
    typeof entry.id === 'string' &&
    typeof entry.at === 'string' &&
    (entry.type === 'spend' || entry.type === 'adjust') &&
    Number.isFinite(entry.amount)
  )
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

function isHabit(value: unknown): value is MealHabit {
  if (!value || typeof value !== 'object') return false
  const habit = value as MealHabit
  return (
    typeof habit.weekdayLunch === 'boolean' &&
    typeof habit.weekdayDinner === 'boolean' &&
    typeof habit.weekendLunch === 'boolean' &&
    typeof habit.weekendDinner === 'boolean' &&
    Number.isFinite(habit.lunchPrice) &&
    Number.isFinite(habit.dinnerPrice)
  )
}

export function normalizeState(raw: Record<string, unknown>, now: Date): AppState {
  const base = defaultState(now)
  const entries = Array.isArray(raw.entries) ? raw.entries.filter(isLedgerEntry) : base.entries
  const history =
    raw.history && typeof raw.history === 'object' && !Array.isArray(raw.history)
      ? (raw.history as Record<string, LedgerEntry[]>)
      : base.history
  return {
    version: 1,
    mode: isMode(raw.mode) ? raw.mode : base.mode,
    balance:
      raw.balance === null || Number.isFinite(raw.balance) ? (raw.balance as number | null) : base.balance,
    monthKey: typeof raw.monthKey === 'string' ? raw.monthKey : base.monthKey,
    mealUnitPrice: Number.isFinite(raw.mealUnitPrice) ? Number(raw.mealUnitPrice) : base.mealUnitPrice,
    drinkUnitPrice: Number.isFinite(raw.drinkUnitPrice) ? Number(raw.drinkUnitPrice) : base.drinkUnitPrice,
    dayCountMode: isDayCountMode(raw.dayCountMode) ? raw.dayCountMode : base.dayCountMode,
    customRemainingDays: Number.isFinite(raw.customRemainingDays)
      ? Number(raw.customRemainingDays)
      : base.customRemainingDays,
    defaultDrinkSize: isDefaultDrinkSize(raw.defaultDrinkSize)
      ? raw.defaultDrinkSize
      : base.defaultDrinkSize,
    appearance: isAppearance(raw.appearance) ? raw.appearance : base.appearance,
    habit: isHabit(raw.habit) ? raw.habit : base.habit,
    monthEndReserve: Number.isFinite(raw.monthEndReserve)
      ? Number(raw.monthEndReserve)
      : base.monthEndReserve,
    entries,
    history,
  }
}

export function parseState(raw: string | null, now: Date): AppState {
  if (!raw) return defaultState(now)
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return defaultState(now)
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

export function saveState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, serializeState(state))
}
