import rawMenu from '../data/menu.json'

export type SizeKey = 'hot_s' | 'hot_m' | 'iced_m' | 'xl'

export type SimpleCategory = 'buffet' | 'special' | 'fruit' | 'nabeyaki' | 'noodles' | 'dessert' | 'grocery' | 'custom'
export type Category = SimpleCategory | 'drink'

export type Deal = {
  qty: number
  price: number
}

export type SimpleItem = {
  category: SimpleCategory
  name: string
  price: number
  enabled: boolean
  subcategory?: string
  deal?: Deal
  boxPrice?: number
  note?: string
}

export type DrinkItem = {
  category: 'drink'
  name: string
  prices: Partial<Record<SizeKey, number>>
  enabled: boolean
  subcategory?: string
  note?: string
}

export type MenuItem = SimpleItem | DrinkItem

export type MenuRule = {
  type: 'upgrade' | 'addon' | 'option' | 'info'
  appliesTo: string
  name: string
  price?: number
  content?: string
  note?: string
}

export type TicketLine = {
  category: Category
  name: string
  size?: SizeKey
  unitPrice: number
  qty: number
  note?: string
}

export const SIZE_ORDER: SizeKey[] = ['hot_s', 'hot_m', 'iced_m', 'xl']

export const SIZE_LABEL: Record<SizeKey, string> = {
  hot_s: '熱小',
  hot_m: '熱中',
  iced_m: '冰中',
  xl: '特大',
}

export const CATEGORY_LABEL: Record<Category, string> = {
  buffet: '自助餐',
  special: '特色餐',
  fruit: '水果',
  grocery: '冰箱雜貨',
  nabeyaki: '鍋燒',
  noodles: '麵食',
  drink: '飲料',
  dessert: '甜點',
  custom: '自訂',
}

export const CATEGORY_EMOJI: Record<Category, string> = {
  buffet: '🍱',
  special: '⭐',
  fruit: '🍎',
  grocery: '🧺',
  nabeyaki: '🍲',
  noodles: '🍜',
  drink: '🥤',
  dessert: '🍞',
  custom: '✨',
}

export function categoryEmoji(category: Category): string {
  return CATEGORY_EMOJI[category]
}

export function subcategoryEmoji(name: string): string {
  const normalized = name.trim()
  if (normalized.includes('咖啡')) return '☕'
  if (normalized.includes('一般飲料')) return '🥤'
  if (normalized.includes('新品')) return '✨'
  if (normalized.includes('水果')) return '🍎'
  if (normalized.includes('台灣小吃')) return '🍢'
  if (normalized.includes('健康餐')) return '🥗'
  if (normalized.includes('特色餐')) return '⭐'
  if (normalized.includes('寶佳麗') || normalized.includes('養樂多') || normalized.includes('愛之味') || normalized.includes('波蜜')) return '🧃'
  if (normalized.includes('麵食')) return '🍜'
  if (normalized.includes('甜點')) return '🍞'
  return '•'
}

export const MENU_TAB_ORDER: Category[] = [
  'buffet',
  'special',
  'nabeyaki',
  'noodles',
  'drink',
  'dessert',
  'fruit',
  'grocery',
  'custom',
]

export function visibleItems(items: MenuItem[], category: Category): MenuItem[] {
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

export function resolveDrinkSize(item: DrinkItem, preferred: SizeKey): SizeKey | null {
  return drinkPrice(item, preferred) != null ? preferred : null
}

// ── Deal pricing ──────────────────────────────────────────────

export type DealBreakdown = { qty: number; price: number }
export type DealSplit = { total: number; breakdown: DealBreakdown[] }

export function dealSplit(item: Pick<SimpleItem, 'price' | 'deal'>, qty: number): DealSplit {
  const count = Math.max(0, Math.floor(qty))
  if (count === 0) return { total: 0, breakdown: [] }
  const unit = item.price
  const deal = item.deal
  if (!deal || deal.qty < 2 || deal.price <= 0) {
    return { total: unit * count, breakdown: [{ qty: count, price: unit }] }
  }
  // Greedy on the best per-unit price: the deal is only applied while it
  // actually beats paying unit price for the same amount.
  const dealUnit = deal.price / deal.qty
  if (dealUnit >= unit) {
    return { total: unit * count, breakdown: [{ qty: count, price: unit }] }
  }
  const dealCount = Math.floor(count / deal.qty)
  const remainder = count % deal.qty
  const breakdown: DealBreakdown[] = []
  let total = 0
  if (dealCount > 0) {
    for (let i = 0; i < dealCount; i++) {
      breakdown.push({ qty: deal.qty, price: deal.price })
    }
    total += deal.price * dealCount
  }
  if (remainder > 0) {
    breakdown.push({ qty: remainder, price: unit })
    total += unit * remainder
  }
  return { total, breakdown }
}

export function dealBestPrice(item: Pick<SimpleItem, 'price' | 'deal'>): number {
  const deal = item.deal
  if (deal && deal.qty >= 2 && deal.price > 0) {
    return Math.min(item.price, deal.price / deal.qty)
  }
  return item.price
}

// ── Subcategory grouping ──────────────────────────────────────

export type SubcategoryGroup = {
  name: string
  items: MenuItem[]
}

export function groupBySubcategory(items: MenuItem[]): SubcategoryGroup[] {
  const groups: SubcategoryGroup[] = []
  const index = new Map<string, SubcategoryGroup>()
  for (const item of items) {
    const name = item.subcategory?.trim() || '其他'
    let group = index.get(name)
    if (!group) {
      group = { name, items: [] }
      index.set(name, group)
      groups.push(group)
    }
    group.items.push(item)
  }
  return groups
}

// ── Addon rules ───────────────────────────────────────────────

export function rulesFor(rules: MenuRule[], appliesTo: string, type: MenuRule['type']): MenuRule[] {
  return rules.filter((rule) => rule.type === type && rule.appliesTo === appliesTo)
}

export const compiledMenu = rawMenu as {
  restaurantName: string
  mealUnitPriceDefault: number
  drinkUnitPriceDefault: number
  timezone: 'Asia/Taipei'
  items: MenuItem[]
  rules?: MenuRule[]
}
