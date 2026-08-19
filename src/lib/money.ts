export type Mode = 'surplus' | 'scarcity'

export type TodayAdvice = {
  mode: Mode
  daily: number
  spentToday: number
  remainingAllowance: number
  stillNeed: number
  overspent: boolean
}

export type Conversions = {
  mealsLeft: number | null
  drinksLeft: number | null
  daysPerMeal: number | null
  daysPerDrink: number | null
}

function usable(n: number): boolean {
  return Number.isFinite(n) && n > 0
}

export function dailyAverage(balance: number, remainingDays: number): number | null {
  if (remainingDays <= 0 || !Number.isFinite(balance)) return null
  return balance / remainingDays
}

export function todayAdvice(
  mode: Mode,
  daily: number,
  spentToday: number,
): TodayAdvice {
  const remainingAllowance = daily - spentToday
  const stillNeed = mode === 'surplus' ? Math.max(0, remainingAllowance) : 0
  return {
    mode,
    daily,
    spentToday,
    remainingAllowance,
    stillNeed,
    overspent: remainingAllowance < 0,
  }
}

export function conversions(
  balance: number,
  daily: number,
  mealUnitPrice: number,
  drinkUnitPrice: number,
): Conversions {
  return {
    mealsLeft: usable(mealUnitPrice) && Number.isFinite(balance) ? balance / mealUnitPrice : null,
    drinksLeft: usable(drinkUnitPrice) && Number.isFinite(balance) ? balance / drinkUnitPrice : null,
    daysPerMeal: usable(mealUnitPrice) && usable(daily) ? mealUnitPrice / daily : null,
    daysPerDrink: usable(drinkUnitPrice) && usable(daily) ? drinkUnitPrice / daily : null,
  }
}

export function applySpend(balance: number, amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return balance
  return balance - amount
}

export function applyAdjust(amount: number): number {
  return amount
}
