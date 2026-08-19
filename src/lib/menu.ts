import rawMenu from '../data/menu.json'

export type SizeKey = 'hot_s' | 'hot_m' | 'iced_m' | 'xl'

export type SimpleCategory = 'buffet' | 'nabeyaki' | 'noodles' | 'dessert'
export type Category = SimpleCategory | 'drink' | 'custom'

export type SimpleItem = {
  category: SimpleCategory
  name: string
  price: number
  enabled: boolean
  note?: string
}

export type DrinkItem = {
  category: 'drink'
  name: string
  prices: Partial<Record<SizeKey, number>>
  enabled: boolean
  note?: string
}

export type MenuItem = SimpleItem | DrinkItem

export type TicketLine = {
  category: Category
  name: string
  size?: SizeKey
  unitPrice: number
  qty: number
}

export const SIZE_ORDER: SizeKey[] = ['hot_s', 'hot_m', 'iced_m', 'xl']

export const SIZE_LABEL: Record<SizeKey, string> = {
  hot_s: '熱小',
  hot_m: '熱中',
  iced_m: '冰中',
  xl: '特大',
}

export const CATEGORY_LABEL: Record<Exclude<Category, 'custom'>, string> = {
  buffet: '自助餐',
  nabeyaki: '鍋燒',
  noodles: '麵食',
  drink: '飲料',
  dessert: '甜點',
}

export function visibleItems(items: MenuItem[], category: Exclude<Category, 'custom'>): MenuItem[] {
  return items.filter((item) => item.enabled && item.category === category)
}

export function drinkPrice(item: DrinkItem, size: SizeKey): number | null {
  const value = item.prices[size]
  return typeof value === 'number' && value > 0 ? value : null
}

export function availableSizes(item: DrinkItem): SizeKey[] {
  return SIZE_ORDER.filter((size) => drinkPrice(item, size) != null)
}

export function lineTotal(line: Pick<TicketLine, 'unitPrice' | 'qty'>): number {
  return line.unitPrice * line.qty
}

export function ticketTotal(lines: TicketLine[]): number {
  return lines.reduce((sum, line) => sum + lineTotal(line), 0)
}

export function isDrink(item: MenuItem): item is DrinkItem {
  return item.category === 'drink'
}

export const compiledMenu = rawMenu as {
  restaurantName: string
  mealUnitPriceDefault: number
  drinkUnitPriceDefault: number
  timezone: 'Asia/Taipei'
  items: MenuItem[]
}
