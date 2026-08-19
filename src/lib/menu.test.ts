import { describe, expect, it } from 'vitest'
import {
  compiledMenu,
  drinkPrice,
  lineTotal,
  resolveDrinkSize,
  visibleItems,
  type DrinkItem,
} from './menu.ts'

describe('visibleItems', () => {
  it('returns enabled drinks from the compiled menu', () => {
    const drinks = visibleItems(compiledMenu.items, 'drink')
    expect(drinks.length).toBeGreaterThanOrEqual(20)
    expect(drinks.every((item) => item.enabled && item.category === 'drink')).toBe(true)
  })
})

describe('drinkPrice', () => {
  const honeyGreen = compiledMenu.items.find(
    (item): item is DrinkItem => item.category === 'drink' && item.name === '蜂蜜綠茶',
  )

  it('reads only sizes that exist', () => {
    expect(honeyGreen).toBeTruthy()
    expect(drinkPrice(honeyGreen!, 'iced_m')).toBe(45)
    expect(drinkPrice(honeyGreen!, 'hot_s')).toBeNull()
  })
})

describe('lineTotal', () => {
  it('multiplies unit price by quantity', () => {
    expect(lineTotal({ unitPrice: 62, qty: 2 })).toBe(124)
  })
})

describe('resolveDrinkSize', () => {
  const honeyGreen = compiledMenu.items.find(
    (item): item is DrinkItem => item.category === 'drink' && item.name === '蜂蜜綠茶',
  )
  const blackTea = compiledMenu.items.find(
    (item): item is DrinkItem => item.category === 'drink' && item.name === '紅茶',
  )

  it('uses the preferred size when that drink has it', () => {
    expect(resolveDrinkSize(blackTea!, 'iced_m')).toBe('iced_m')
    expect(resolveDrinkSize(blackTea!, 'hot_m')).toBe('hot_m')
  })

  it('returns null when the preferred size is missing so the picker can ask', () => {
    expect(resolveDrinkSize(honeyGreen!, 'hot_m')).toBeNull()
    expect(resolveDrinkSize(honeyGreen!, 'iced_m')).toBe('iced_m')
  })
})
