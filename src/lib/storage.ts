import { monthKey, taipeiParts } from './month.ts'
import type { Mode } from './money.ts'

export const STORAGE_KEY = 'restaurant-card:v1'

export type LedgerType = 'spend' | 'adjust'

export type LedgerEntry = {
  id: string
  at: string
  type: LedgerType
  amount: number
  note?: string
}

export type AppState = {
  version: 1
  mode: Mode
  balance: number | null
  monthKey: string
  mealUnitPrice: number
  drinkUnitPrice: number
  entries: LedgerEntry[]
  history: Record<string, LedgerEntry[]>
}

export function defaultState(now: Date): AppState {
  return {
    version: 1,
    mode: 'scarcity',
    balance: null,
    monthKey: monthKey(now),
    mealUnitPrice: 100,
    drinkUnitPrice: 30,
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

function isAppState(value: unknown): value is AppState {
  if (!value || typeof value !== 'object') return false
  const state = value as AppState
  return (
    state.version === 1 &&
    (state.mode === 'surplus' || state.mode === 'scarcity') &&
    (state.balance === null || Number.isFinite(state.balance)) &&
    typeof state.monthKey === 'string' &&
    Number.isFinite(state.mealUnitPrice) &&
    Number.isFinite(state.drinkUnitPrice) &&
    Array.isArray(state.entries) &&
    state.entries.every(isLedgerEntry) &&
    !!state.history &&
    typeof state.history === 'object'
  )
}

export function parseState(raw: string | null, now: Date): AppState {
  if (!raw) return defaultState(now)
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isAppState(parsed)) return defaultState(now)
    return rolloverIfNeeded(parsed, now)
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
