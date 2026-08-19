import { mealsOnDate, necessaryOnDate, type MealHabit } from './leftover.ts'
import { drinkPrice, isDrink, type MenuItem, type SizeKey } from './menu.ts'
import { monthKey, taipeiParts } from './month.ts'

export const PLAN_STORAGE_KEY = 'restaurant-card:plan:v1'

export type PlanCartLine = {
  category: 'drink' | 'grocery'
  name: string
  size?: SizeKey
  qty: number
}

export type PlanDraft = {
  version: 1
  monthKey: string
  dateKey: string
  eatenToday: { lunch: boolean; dinner: boolean }
  lines: PlanCartLine[]
}

export function taipeiDateKey(now: Date): string {
  const { year, month, day } = taipeiParts(now)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function defaultPlanDraft(now: Date): PlanDraft {
  return {
    version: 1,
    monthKey: monthKey(now),
    dateKey: taipeiDateKey(now),
    eatenToday: { lunch: false, dinner: false },
    lines: [],
  }
}

function isPlanLine(value: unknown): value is PlanCartLine {
  if (!value || typeof value !== 'object') return false
  const line = value as PlanCartLine
  return (line.category === 'drink' || line.category === 'grocery')
    && typeof line.name === 'string'
    && line.name.length > 0
    && line.name.length <= 200
    && (line.size == null || ['hot_s', 'hot_m', 'iced_m', 'xl'].includes(line.size))
    && Number.isFinite(line.qty)
    && Number.isInteger(line.qty)
    && line.qty > 0
    && line.qty <= 99
}

export function parsePlanDraft(raw: string | null, now: Date): PlanDraft {
  const base = defaultPlanDraft(now)
  if (!raw) return base
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value)) return base
    const record = value as Record<string, unknown>
    if (record.monthKey !== base.monthKey) return base
    const eaten = record.eatenToday && typeof record.eatenToday === 'object'
      ? record.eatenToday as Record<string, unknown>
      : {}
    return {
      ...base,
      lines: Array.isArray(record.lines) ? record.lines.filter(isPlanLine) : [],
      eatenToday: record.dateKey === base.dateKey
        ? { lunch: eaten.lunch === true, dinner: eaten.dinner === true }
        : base.eatenToday,
    }
  } catch {
    return base
  }
}

export function loadPlanDraft(now = new Date()): PlanDraft {
  try {
    return parsePlanDraft(localStorage.getItem(PLAN_STORAGE_KEY), now)
  } catch {
    return defaultPlanDraft(now)
  }
}

export function savePlanDraft(draft: PlanDraft): boolean {
  try {
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(draft))
    return true
  } catch {
    return false
  }
}

function lineKey(line: Pick<PlanCartLine, 'category' | 'name' | 'size'>): string {
  return `${line.category}\u0000${line.name}\u0000${line.size ?? ''}`
}

export function addPlanLine(lines: PlanCartLine[], incoming: PlanCartLine): PlanCartLine[] {
  const key = lineKey(incoming)
  const found = lines.find((line) => lineKey(line) === key)
  if (!found) return [...lines, { ...incoming, qty: Math.max(1, Math.floor(incoming.qty)) }]
  return lines.map((line) => lineKey(line) === key
    ? { ...line, qty: Math.min(99, line.qty + Math.max(1, Math.floor(incoming.qty))) }
    : line)
}

export function setPlanLineQuantity(lines: PlanCartLine[], target: PlanCartLine, qty: number): PlanCartLine[] {
  const key = lineKey(target)
  if (qty <= 0) return lines.filter((line) => lineKey(line) !== key)
  return lines.map((line) => lineKey(line) === key ? { ...line, qty: Math.min(99, Math.floor(qty)) } : line)
}

export function resolvePlanUnitPrice(line: PlanCartLine, items: MenuItem[]): number | null {
  const item = items.find((candidate) => candidate.enabled
    && candidate.category === line.category
    && candidate.name === line.name)
  if (!item) return null
  if (isDrink(item)) return line.size ? drinkPrice(item, line.size) : null
  return item.price > 0 ? item.price : null
}

export function cartTotal(lines: PlanCartLine[], items: MenuItem[]): number {
  return lines.reduce((sum, line) => {
    const price = resolvePlanUnitPrice(line, items)
    return price == null ? sum : sum + price * line.qty
  }, 0)
}

export function projectedAfterCart(leftover: number, lines: PlanCartLine[], items: MenuItem[]): number {
  return leftover - cartTotal(lines, items)
}

export function necessaryTotalForPlan(
  habit: MealHabit,
  dates: Date[],
  eaten: { dateKey: string; lunch: boolean; dinner: boolean },
): number {
  return dates.reduce((sum, date) => {
    let necessary = necessaryOnDate(habit, date)
    if (taipeiDateKey(date) === eaten.dateKey) {
      const meals = mealsOnDate(habit, date)
      if (eaten.lunch && meals.lunch) necessary -= habit.lunchPrice
      if (eaten.dinner && meals.dinner) necessary -= habit.dinnerPrice
    }
    return sum + necessary
  }, 0)
}
