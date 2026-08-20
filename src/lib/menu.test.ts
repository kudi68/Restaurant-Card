import { describe, expect, it } from 'vitest'
import {
  categoryEmoji,
  compiledMenu,
  dealBestPrice,
  dealSplit,
  groupBySubcategory,
  isDrink,
  subcategoryEmoji,
  visibleItems,
  type MenuItem,
} from './menu.ts'

const latte: MenuItem = {
  category: 'drink',
  name: '拿鐵咖啡',
  enabled: true,
  prices: { hot_m: 65, iced_m: 55 },
  subcategory: '咖啡',
}

const apple: MenuItem = {
  category: 'fruit',
  name: '蘋果',
  price: 35,
  enabled: true,
  deal: { qty: 3, price: 100 },
  subcategory: '水果',
}

const soda: MenuItem = {
  category: 'grocery',
  name: '寶佳麗強氣泡水',
  price: 30,
  enabled: true,
  boxPrice: 720,
  subcategory: '寶佳麗',
}

describe('compiled menu schema', () => {
  it('compiles every category from the xlsx including new sheets', () => {
    const counts: Record<string, number> = {}
    for (const item of compiledMenu.items) {
      counts[item.category] = (counts[item.category] ?? 0) + 1
    }
    expect(counts).toEqual({
      buffet: 8,
      special: 3,
      fruit: 7,
      grocery: 12,
      nabeyaki: 5,
      noodles: 18,
      dessert: 1,
      drink: 32,
    })
  })

  it('imports structured addon rules from the xlsx', () => {
    const rules = compiledMenu.rules ?? []
    expect(rules.length).toBeGreaterThanOrEqual(14)
    const upgrades = rules.filter((rule) => rule.type === 'upgrade')
    expect(upgrades.map((rule) => rule.name)).toEqual(['套餐A', '套餐B', '套餐C'])
    expect(upgrades.every((rule) => rule.price === 30)).toBe(true)
    const addons = rules.filter((rule) => rule.type === 'addon')
    expect(addons.find((rule) => rule.name === '滷蛋')?.price).toBe(15)
    const noodleAddons = addons.filter((rule) => rule.appliesTo === '麵食:麵食水餃')
    expect(noodleAddons.length).toBeGreaterThanOrEqual(7)
  })
})

describe('deal pricing', () => {
  it('splits quantities into the cheapest deal combination', () => {
    // 4 apples = 1×(3 for 100) + 1×35 = 135
    expect(dealSplit(apple, 4)).toEqual({ total: 135, breakdown: [{ qty: 3, price: 100 }, { qty: 1, price: 35 }] })
    // 6 apples = 2×(3 for 100) = 200
    expect(dealSplit(apple, 6)).toEqual({ total: 200, breakdown: [{ qty: 3, price: 100 }, { qty: 3, price: 100 }] })
    // 2 apples = 2×35 = 70 (deal not worth it)
    expect(dealSplit(apple, 2)).toEqual({ total: 70, breakdown: [{ qty: 2, price: 35 }] })
  })

  it('prices per unit when there is no deal', () => {
    const berry: MenuItem = { category: 'fruit', name: '藍莓', price: 80, enabled: true }
    expect(dealSplit(berry, 3)).toEqual({ total: 240, breakdown: [{ qty: 3, price: 80 }] })
  })

  it('prices per unit when there is no deal', () => {
    const berry: MenuItem = { category: 'fruit', name: '藍莓', price: 80, enabled: true }
    expect(dealSplit(berry, 3)).toEqual({ total: 240, breakdown: [{ qty: 3, price: 80 }] })
  })

  it('exposes the effective single-unit best price', () => {
    expect(dealBestPrice(apple)).toBeCloseTo(100 / 3)
    const berry: MenuItem = { category: 'fruit', name: '藍莓', price: 80, enabled: true }
    expect(dealBestPrice(berry)).toBe(80)
  })
})

describe('subcategory grouping', () => {
  it('groups items by subcategory keeping xlsx order', () => {
    const tea: MenuItem = { category: 'drink', name: '紅茶', enabled: true, prices: { iced_m: 25 }, subcategory: '一般飲料' }
    const groups = groupBySubcategory([latte, tea, latte])
    expect(groups.map((group) => group.name)).toEqual(['咖啡', '一般飲料'])
    expect(groups[0]?.items).toEqual([latte, latte])
    expect(groups[1]?.items).toEqual([tea])
  })

  it('collects un-subcategorized items under 其他', () => {
    const plain: MenuItem = { category: 'dessert', name: '熱壓吐司', price: 55, enabled: true }
    const groups = groupBySubcategory([plain])
    expect(groups[0]?.name).toBe('其他')
  })
})

describe('box pricing', () => {
  it('keeps boxPrice available for grocery items', () => {
    expect(isDrink(soda)).toBe(false)
    expect(soda.boxPrice).toBe(720)
  })
})

describe('visibleItems with new categories', () => {
  it('returns fruit and special items', () => {
    expect(visibleItems(compiledMenu.items, 'fruit').length).toBe(7)
    expect(visibleItems(compiledMenu.items, 'special').length).toBe(3)
    expect(visibleItems(compiledMenu.items, 'grocery').length).toBe(12)
  })
})

describe('menu emoji labels', () => {
  it('provides stable category and subcategory emoji', () => {
    expect(categoryEmoji('drink')).toBe('🥤')
    expect(categoryEmoji('grocery')).toBe('🧺')
    expect(subcategoryEmoji('咖啡')).toBe('☕')
    expect(subcategoryEmoji('台灣小吃')).toBe('🍢')
    expect(subcategoryEmoji('未知')).toBe('•')
  })
})
