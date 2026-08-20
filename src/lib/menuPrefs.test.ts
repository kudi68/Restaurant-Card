import { describe, expect, it } from 'vitest'
import {
  addCustomItem,
  addFavorite,
  addPreset,
  defaultMenuPrefs,
  isPresetNameTaken,
  loadMenuPrefs,
  normalizeMenuPrefs,
  removeCustomItem,
  removeFavorite,
  removePreset,
  saveMenuPrefs,
  moveItem,
  toggleTabHidden,
  toggleItemHidden,
  type MenuPrefs,
} from './menuPrefs.ts'

const base = defaultMenuPrefs()

describe('favorites', () => {
  it('adds and removes favorite items', () => {
    const withFav = addFavorite(base, 'drink', '拿鐵咖啡')
    expect(withFav.favorites).toContain('drink:拿鐵咖啡')
    const removed = removeFavorite(withFav, 'drink', '拿鐵咖啡')
    expect(removed.favorites).not.toContain('drink:拿鐵咖啡')
  })

  it('does not duplicate the same favorite', () => {
    const once = addFavorite(base, 'drink', '拿鐵咖啡')
    const twice = addFavorite(once, 'drink', '拿鐵咖啡')
    expect(twice.favorites).toEqual(['drink:拿鐵咖啡'])
  })
})

describe('presets', () => {
  it('adds a preset with lines and brings it in as a whole', () => {
    const preset = addPreset(base, '我的午餐', [
      { category: 'noodles', name: '古早味乾麵', unitPrice: 63, qty: 1 },
      { category: 'drink', name: '紅茶', size: 'iced_m', unitPrice: 25, qty: 1 },
    ])
    expect(preset.presets).toHaveLength(1)
    expect(preset.presets[0]?.lines).toHaveLength(2)
    expect(isPresetNameTaken(preset, '我的午餐')).toBe(true)
    expect(isPresetNameTaken(preset, '另一個')).toBe(false)
    const without = removePreset(preset, preset.presets[0]!.id)
    expect(without.presets).toHaveLength(0)
  })

  it('rejects an empty preset name', () => {
    expect(() => addPreset(base, '  ', [])).toThrow()
  })
})

describe('custom items', () => {
  it('adds and removes a custom item with a generated id', () => {
    const withItem = addCustomItem(base, {
      category: 'drink',
      name: '店員特調',
      price: 50,
      subcategory: '新品',
    })
    expect(withItem.customItems).toHaveLength(1)
    expect(withItem.customItems[0]?.category).toBe('custom')
    const id = withItem.customItems[0]!.id
    expect(id).toBeTruthy()
    const without = removeCustomItem(withItem, id)
    expect(without.customItems).toHaveLength(0)
  })

  it('rejects a custom item with a bad price', () => {
    expect(() => addCustomItem(base, { category: 'drink', name: '壞的', price: -5 })).toThrow()
  })
})

describe('tab ordering and hiding', () => {
  it('moves a tab to the front and toggles hidden', () => {
    const moved: MenuPrefs = { ...base, tabOrder: ['noodles', 'drink', 'buffet'] }
    expect(moved.tabOrder[0]).toBe('noodles')
    const hidden = toggleTabHidden(base, 'drink')
    expect(hidden.hiddenTabs).toContain('drink')
    const shown = toggleTabHidden(hidden, 'drink')
    expect(shown.hiddenTabs).not.toContain('drink')
  })

  it('moves and hides individual items', () => {
    const moved = moveItem(base, 'drink', '紅茶', 0, ['拿鐵咖啡', '紅茶', '奶茶'])
    expect(moved.itemOrder.drink).toEqual(['紅茶', '拿鐵咖啡', '奶茶'])
    const hidden = toggleItemHidden(moved, 'drink', '紅茶')
    expect(hidden.hiddenItems).toContain('drink:紅茶')
  })
})

describe('persistence', () => {
  it('normalizes corrupted prefs into defaults', () => {
    expect(normalizeMenuPrefs(null)).toEqual(defaultMenuPrefs())
    expect(normalizeMenuPrefs('not json')).toEqual(defaultMenuPrefs())
    expect(normalizeMenuPrefs(JSON.stringify({ version: 99 }))).toEqual(defaultMenuPrefs())
  })

  it('round-trips through localStorage-style storage', () => {
    const prefs = addFavorite(addPreset(base, 'A', [{ category: 'drink', name: '紅茶', unitPrice: 25, qty: 1 }]), 'drink', '紅茶')
    const raw = JSON.stringify(prefs)
    expect(normalizeMenuPrefs(raw)).toEqual(prefs)
  })

  it('keeps unknown tabs out of the order and fills missing ones at the end', () => {
    const weird = normalizeMenuPrefs(JSON.stringify({ version: 1, tabOrder: ['drink', 'nope'], hiddenTabs: ['nope'] }))
    expect(weird.tabOrder).toEqual(['drink', 'buffet', 'special', 'nabeyaki', 'noodles', 'dessert', 'fruit', 'grocery', 'custom'])
    expect(weird.hiddenTabs).toEqual([])
  })
})

describe('loadMenuPrefs / saveMenuPrefs', () => {
  it('returns defaults when storage throws', () => {
    expect(loadMenuPrefs({ getItem: () => { throw new Error('denied') }, setItem: () => {} })).toEqual(defaultMenuPrefs())
  })

  it('returns false when saving throws', () => {
    expect(saveMenuPrefs(base, { getItem: () => null, setItem: () => { throw new Error('denied') } })).toBe(false)
  })
})
