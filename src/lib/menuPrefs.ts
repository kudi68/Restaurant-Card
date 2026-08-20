import type { Category, SizeKey } from './menu.ts'
import { MENU_TAB_ORDER } from './menu.ts'

export const MENU_PREFS_KEY = 'restaurant-card:menu-prefs:v1'
export const MENU_PREFS_VERSION = 1

export type MenuTab = Category

export type PresetLine = {
  category: Category
  name: string
  size?: SizeKey
  unitPrice: number
  qty: number
  note?: string
}

export type Preset = {
  id: string
  name: string
  lines: PresetLine[]
}

export type CustomItem = {
  id: string
  category: MenuTab
  name: string
  price: number
  subcategory?: string
  note?: string
}

export type MenuPrefs = {
  version: typeof MENU_PREFS_VERSION
  tabOrder: MenuTab[]
  hiddenTabs: MenuTab[]
  itemOrder: Partial<Record<MenuTab, string[]>>
  hiddenItems: string[]
  favorites: string[]
  presets: Preset[]
  customItems: CustomItem[]
}

const ALL_TABS: MenuTab[] = MENU_TAB_ORDER
const TAB_SET = new Set<string>(ALL_TABS)
const SIZE_SET = new Set<string>(['hot_s', 'hot_m', 'iced_m', 'xl'])
const CATEGORY_SET = new Set<string>([...ALL_TABS, 'drink', 'custom'])

export function defaultMenuPrefs(): MenuPrefs {
  return {
    version: MENU_PREFS_VERSION,
    tabOrder: [...ALL_TABS],
    hiddenTabs: [],
    itemOrder: {},
    hiddenItems: [],
    favorites: [],
    presets: [],
    customItems: [],
  }
}

export function itemKey(category: string, name: string): string {
  return `${category}:${name}`
}

// ── favorites ──────────────────────────────────────────────

export function addFavorite(prefs: MenuPrefs, category: string, name: string): MenuPrefs {
  const key = itemKey(category, name)
  if (prefs.favorites.includes(key)) return prefs
  return { ...prefs, favorites: [...prefs.favorites, key] }
}

export function removeFavorite(prefs: MenuPrefs, category: string, name: string): MenuPrefs {
  const key = itemKey(category, name)
  return { ...prefs, favorites: prefs.favorites.filter((entry) => entry !== key) }
}

// ── presets ────────────────────────────────────────────────

export function isPresetNameTaken(prefs: MenuPrefs, name: string): boolean {
  return prefs.presets.some((preset) => preset.name === name.trim())
}

export function addPreset(prefs: MenuPrefs, name: string, lines: PresetLine[]): MenuPrefs {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('套餐名稱不可為空')
  if (lines.length === 0) throw new Error('套餐至少要一個品項')
  const preset: Preset = {
    id: crypto.randomUUID(),
    name: trimmed,
    lines,
  }
  return { ...prefs, presets: [...prefs.presets, preset] }
}

export function removePreset(prefs: MenuPrefs, id: string): MenuPrefs {
  return { ...prefs, presets: prefs.presets.filter((preset) => preset.id !== id) }
}

// ── custom items ───────────────────────────────────────────

export function addCustomItem(
  prefs: MenuPrefs,
  item: { category?: MenuTab; name: string; price: number; subcategory?: string; note?: string },
): MenuPrefs {
  const name = item.name.trim()
  if (!name) throw new Error('品項名稱不可為空')
  if (!Number.isFinite(item.price) || item.price <= 0) throw new Error('價格必須是正數')
  const custom: CustomItem = {
    id: crypto.randomUUID(),
    category: 'custom',
    name,
    price: item.price,
    subcategory: item.subcategory?.trim() || undefined,
    note: item.note?.trim() || undefined,
  }
  return { ...prefs, customItems: [...prefs.customItems, custom] }
}

export function removeCustomItem(prefs: MenuPrefs, id: string): MenuPrefs {
  return { ...prefs, customItems: prefs.customItems.filter((item) => item.id !== id) }
}

// ── tabs ───────────────────────────────────────────────────

export function moveTab(prefs: MenuPrefs, tab: MenuTab, toIndex: number): MenuPrefs {
  const order = prefs.tabOrder.filter((entry) => entry !== tab)
  const index = Math.max(0, Math.min(order.length, toIndex))
  order.splice(index, 0, tab)
  return { ...prefs, tabOrder: order }
}

export function toggleTabHidden(prefs: MenuPrefs, tab: MenuTab): MenuPrefs {
  const hidden = prefs.hiddenTabs.includes(tab)
    ? prefs.hiddenTabs.filter((entry) => entry !== tab)
    : [...prefs.hiddenTabs, tab]
  return { ...prefs, hiddenTabs: hidden }
}

export function moveItem(prefs: MenuPrefs, category: MenuTab, name: string, toIndex: number, currentNames: string[]): MenuPrefs {
  const order = currentNames.filter((entry) => entry !== name)
  const index = Math.max(0, Math.min(order.length, toIndex))
  order.splice(index, 0, name)
  return { ...prefs, itemOrder: { ...prefs.itemOrder, [category]: order } }
}

export function toggleItemHidden(prefs: MenuPrefs, category: MenuTab, name: string): MenuPrefs {
  const key = itemKey(category, name)
  const hiddenItems = prefs.hiddenItems.includes(key)
    ? prefs.hiddenItems.filter((entry) => entry !== key)
    : [...prefs.hiddenItems, key]
  return { ...prefs, hiddenItems }
}

export function resetMenuLayout(prefs: MenuPrefs): MenuPrefs {
  return { ...prefs, tabOrder: [...ALL_TABS], hiddenTabs: [], itemOrder: {}, hiddenItems: [] }
}

// ── (de)normalization ──────────────────────────────────────

function normalizeTabList(value: unknown): MenuTab[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is MenuTab => typeof entry === 'string' && TAB_SET.has(entry))
}

function normalizePresetLine(value: unknown): PresetLine | null {
  if (!value || typeof value !== 'object') return null
  const line = value as Record<string, unknown>
  if (
    typeof line.category !== 'string'
    || !CATEGORY_SET.has(line.category)
    || typeof line.name !== 'string'
    || !line.name.trim()
    || !Number.isFinite(line.unitPrice)
    || Number(line.unitPrice) <= 0
    || !Number.isFinite(line.qty)
    || Number(line.qty) <= 0
    || Number(line.qty) > 99
  ) return null
  if (line.size != null && (typeof line.size !== 'string' || !SIZE_SET.has(line.size))) return null
  return {
    category: line.category as Category,
    name: line.name.slice(0, 200),
    size: line.size as SizeKey | undefined,
    unitPrice: Number(line.unitPrice),
    qty: Math.floor(Number(line.qty)),
    note: typeof line.note === 'string' && line.note.trim() ? line.note.slice(0, 200) : undefined,
  }
}

function normalizePreset(value: unknown): Preset | null {
  if (!value || typeof value !== 'object') return null
  const preset = value as Record<string, unknown>
  if (typeof preset.id !== 'string' || !preset.id) return null
  if (typeof preset.name !== 'string' || !preset.name.trim()) return null
  if (!Array.isArray(preset.lines)) return null
  const lines = preset.lines.map(normalizePresetLine).filter((line): line is PresetLine => line != null)
  if (lines.length === 0) return null
  return { id: preset.id, name: preset.name.slice(0, 60), lines }
}

function normalizeCustomItem(value: unknown): CustomItem | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Record<string, unknown>
  if (
    typeof item.id !== 'string' || !item.id
    || typeof item.name !== 'string' || !item.name.trim()
    || !Number.isFinite(item.price) || Number(item.price) <= 0
  ) return null
  return {
    id: item.id,
    category: 'custom',
    name: item.name.slice(0, 200),
    price: Number(item.price),
    subcategory: typeof item.subcategory === 'string' && item.subcategory.trim() ? item.subcategory.slice(0, 60) : undefined,
    note: typeof item.note === 'string' && item.note.trim() ? item.note.slice(0, 200) : undefined,
  }
}

export function normalizeMenuPrefs(raw: string | null): MenuPrefs {
  const base = defaultMenuPrefs()
  if (!raw) return base
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return base
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return base
  const record = parsed as Record<string, unknown>
  if (record.version !== MENU_PREFS_VERSION) return base

  const ordered = normalizeTabList(record.tabOrder)
  const tabOrder = [...ordered]
  for (const tab of ALL_TABS) {
    if (!tabOrder.includes(tab)) tabOrder.push(tab)
  }
  const hiddenTabs = normalizeTabList(record.hiddenTabs).filter((tab) => tabOrder.includes(tab))
  const rawItemOrder = record.itemOrder && typeof record.itemOrder === 'object' && !Array.isArray(record.itemOrder)
    ? record.itemOrder as Record<string, unknown>
    : {}
  const itemOrder: Partial<Record<MenuTab, string[]>> = {}
  for (const tab of ALL_TABS) {
    const order = rawItemOrder[tab]
    if (Array.isArray(order)) itemOrder[tab] = order.filter((entry): entry is string => typeof entry === 'string' && entry.length <= 200)
  }
  const hiddenItems = Array.isArray(record.hiddenItems)
    ? record.hiddenItems.filter((entry): entry is string => typeof entry === 'string' && entry.length <= 260).slice(0, 500)
    : []
  const favorites = Array.isArray(record.favorites)
    ? record.favorites.filter((entry): entry is string => typeof entry === 'string' && entry.length <= 260).slice(0, 200)
    : []
  const presets = Array.isArray(record.presets)
    ? record.presets.map(normalizePreset).filter((preset): preset is Preset => preset != null).slice(0, 50)
    : []
  const customItems = Array.isArray(record.customItems)
    ? record.customItems.map(normalizeCustomItem).filter((item): item is CustomItem => item != null).slice(0, 200)
    : []
  return { version: MENU_PREFS_VERSION, tabOrder, hiddenTabs, itemOrder, hiddenItems, favorites, presets, customItems }
}

type Storage = { getItem(key: string): string | null; setItem(key: string, value: string): void }

export function loadMenuPrefs(storage: Storage = localStorage): MenuPrefs {
  try {
    return normalizeMenuPrefs(storage.getItem(MENU_PREFS_KEY))
  } catch {
    return defaultMenuPrefs()
  }
}

export function saveMenuPrefs(prefs: MenuPrefs, storage: Storage = localStorage): boolean {
  try {
    storage.setItem(MENU_PREFS_KEY, JSON.stringify(prefs))
    return true
  } catch {
    return false
  }
}
