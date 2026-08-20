import { useEffect, useMemo, useState } from 'react'
import { formatMoney } from './lib/format.ts'
import {
  CATEGORY_LABEL,
  categoryEmoji,
  SIZE_LABEL,
  availableSizes,
  compiledMenu,
  dealBestPrice,
  drinkPrice,
  groupBySubcategory,
  isDrink,
  resolveDrinkSize,
  rulesFor,
  subcategoryEmoji,
  ticketTotal,
  visibleItems,
  type Category,
  type MenuItem,
  type MenuRule,
  type SizeKey,
  type SimpleItem,
  type TicketLine,
} from './lib/menu.ts'
import {
  addCustomItem,
  addFavorite,
  addPreset,
  itemKey,
  isPresetNameTaken,
  loadMenuPrefs,
  moveItem,
  moveTab,
  removeFavorite,
  removePreset,
  resetMenuLayout,
  saveMenuPrefs,
  toggleTabHidden,
  toggleItemHidden,
  type MenuPrefs,
  type MenuTab,
} from './lib/menuPrefs.ts'

type PendingTarget =
  | { kind: 'drink'; item: Extract<MenuItem, { category: 'drink' }> }
  | { kind: 'simple'; item: SimpleItem }

export function MenuPicker({
  disabled,
  defaultDrinkSize,
  onConfirm,
}: {
  disabled: boolean
  defaultDrinkSize: SizeKey
  onConfirm: (lines: TicketLine[], total: number) => void
}) {
  const [prefs, setPrefs] = useState<MenuPrefs>(() => loadMenuPrefs())
  const [tab, setTab] = useState<MenuTab | 'favorites'>('drink')
  const [editing, setEditing] = useState(false)
  const [customFormOpen, setCustomFormOpen] = useState(false)
  const [lines, setLines] = useState<TicketLine[]>([])
  const [pending, setPending] = useState<PendingTarget | null>(null)
  const [presetName, setPresetName] = useState('')
  const [presetStatus, setPresetStatus] = useState('')
  const [newItemName, setNewItemName] = useState('')
  const [newItemPrice, setNewItemPrice] = useState('')

  useEffect(() => {
      if (!saveMenuPrefs(prefs)) queueMicrotask(() => setPresetStatus('無法儲存選單設定（瀏覽器儲存空間不足）'))
    }, [prefs])

  const visibleTabs = prefs.tabOrder.filter((key) => !prefs.hiddenTabs.includes(key))
  const allItems = useMemo(() => {
    const customs: MenuItem[] = prefs.customItems.map((item) => {
      if (item.category === 'drink') {
        return {
          category: 'drink' as const,
          name: item.name,
          prices: { [defaultDrinkSize]: item.price } as Partial<Record<SizeKey, number>>,
          enabled: true,
          subcategory: item.subcategory,
          note: item.note,
        }
      }
      return {
        category: item.category,
        name: item.name,
        price: item.price,
        enabled: true,
        subcategory: item.subcategory,
        note: item.note,
      }
    })
    return [...compiledMenu.items, ...customs]
  }, [prefs.customItems, defaultDrinkSize])

  const rawItems = tab === 'favorites'
    ? allItems.filter((item) => prefs.favorites.includes(itemKey(item.category, item.name)))
    : visibleItems(allItems, tab)
  const orderedItems = [...rawItems].sort((a, b) => {
    if (tab === 'favorites') return 0
    const order = prefs.itemOrder[tab] ?? []
    const ai = order.indexOf(a.name)
    const bi = order.indexOf(b.name)
    return (ai < 0 ? order.length : ai) - (bi < 0 ? order.length : bi)
  })
  const items = editing || tab === 'favorites'
    ? orderedItems
    : orderedItems.filter((item) => !prefs.hiddenItems.includes(itemKey(item.category, item.name)))
  const groups = groupBySubcategory(items)
  const total = ticketTotal(lines)
  const hasFavorites = prefs.favorites.length > 0

  function addLine(line: TicketLine) {
    setLines((prev) => [...prev, line])
  }

  function addSimple(item: SimpleItem, qty = 1) {
    addLine({ category: item.category, name: item.name, unitPrice: item.price, qty })
  }

  function addDrink(item: Extract<MenuItem, { category: 'drink' }>, size: SizeKey) {
    const unitPrice = drinkPrice(item, size)
    if (unitPrice == null) return
    addLine({ category: 'drink', name: item.name, size, unitPrice, qty: 1 })
    setPending(null)
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index))
  }

  function confirm() {
    if (lines.length === 0 || total <= 0) return
    onConfirm(lines, total)
    setLines([])
    setPending(null)
  }

  function savePreset() {
    if (lines.length === 0) {
      setPresetStatus('先加品項再存套餐')
      return
    }
    if (!presetName.trim()) {
      setPresetStatus('請先輸入套餐名稱')
      return
    }
    if (isPresetNameTaken(prefs, presetName)) {
      setPresetStatus('這個名稱已經用過了')
      return
    }
    setPrefs((prev) => addPreset(prev, presetName, lines))
    setPresetName('')
    setPresetStatus('已儲存套餐')
  }

  function addCustom() {
    const price = Number(newItemPrice)
    if (!newItemName.trim() || !Number.isFinite(price) || price <= 0) {
      setPresetStatus('請填品項名稱與價格')
      return
    }
    try {
      setPrefs((prev) => addCustomItem(prev, {
        name: newItemName,
        price,
        subcategory: '自訂',
      }))
      setNewItemName('')
      setNewItemPrice('')
      setPresetStatus('已新增自訂品項')
      setTab('custom')
    } catch (error) {
      setPresetStatus(error instanceof Error ? error.message : '新增失敗')
    }
  }

  return (
    <div className={disabled ? 'pointer-events-none opacity-40' : ''}>
      <div className="flex flex-wrap items-center gap-1">
        {hasFavorites && (
          <button
            type="button"
            className={`px-2 py-1 text-xs ring-1 ring-ink/15 ${tab === 'favorites' ? 'bg-ink text-paper' : 'bg-ticket'}`}
            onClick={() => { setTab('favorites'); setPending(null) }}
          >
            ★ 常用
          </button>
        )}
        {(editing ? prefs.tabOrder : visibleTabs).map((key) => (
          <button
            key={key}
            type="button"
            className={`px-2 py-1 text-xs ring-1 ring-ink/15 ${tab === key ? 'bg-ink text-paper' : 'bg-ticket'}`}
            onClick={() => { setTab(key); setPending(null) }}
          >
            {categoryEmoji(key)} {CATEGORY_LABEL[key]}
          </button>
        ))}
        <button
          type="button"
          aria-label="編輯菜單"
          className={`ml-auto px-2 py-1 text-xs ring-1 ring-ink/15 ${editing ? 'bg-ink text-paper' : 'bg-ticket'}`}
          onClick={() => { setEditing((value) => !value); setCustomFormOpen(false); setPending(null) }}
        >
          {editing ? '完成編輯' : '✎ 編輯'}
        </button>
      </div>

      {editing && (
        <div className="mt-2 rounded-[12px] bg-[var(--surface)] p-3 text-sm ring-1 ring-[var(--line)]">
          <p className="font-medium">編輯分頁</p>
          <ul className="mt-2 space-y-1">
            {prefs.tabOrder.map((key, index) => (
              <li key={key} className="flex items-center justify-between gap-2">
                <span className={prefs.hiddenTabs.includes(key) ? 'text-muted line-through' : ''}>{categoryEmoji(key)} {CATEGORY_LABEL[key]}</span>
                <span className="flex items-center gap-1">
                  <button type="button" className="h-8 w-8 rounded-full border border-[var(--line)]" disabled={index === 0} onClick={() => setPrefs((prev) => moveTab(prev, key, index - 1))}>↑</button>
                  <button type="button" className="h-8 w-8 rounded-full border border-[var(--line)]" disabled={index === prefs.tabOrder.length - 1} onClick={() => setPrefs((prev) => moveTab(prev, key, index + 1))}>↓</button>
                  <button type="button" className="px-2 text-xs underline" onClick={() => setPrefs((prev) => toggleTabHidden(prev, key))}>{prefs.hiddenTabs.includes(key) ? '顯示' : '隱藏'}</button>
                </span>
              </li>
            ))}
          </ul>
          <button type="button" className="mt-3 text-xs underline" onClick={() => setPrefs((prev) => resetMenuLayout(prev))}>恢復分頁／品項預設</button>
        </div>
      )}

      {prefs.presets.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <span className="text-xs text-muted">套餐：</span>
          {prefs.presets.map((preset) => (
            <span key={preset.id} className="flex items-center gap-1 bg-ticket px-2 py-1 text-xs ring-1 ring-ink/10">
              <button
                type="button"
                title={preset.lines.map((line) => line.name).join('、')}
                onClick={() => setLines((prev) => [...prev, ...preset.lines.map((line) => ({ ...line }))])}
              >
                {preset.name} ${formatMoney(preset.lines.reduce((sum, line) => sum + line.unitPrice * line.qty, 0))}
              </button>
              <button type="button" className="text-muted underline" onClick={() => setPrefs((prev) => removePreset(prev, preset.id))}>刪</button>
            </span>
          ))}
        </div>
      )}

      <ul className="mt-3 max-h-72 space-y-1 overflow-auto">
        {items.length === 0 && (
          <li className="text-sm text-muted">
            {tab === 'favorites' ? '還沒有常用品項；在品項上長按或點「★」加入。' : '這個區還沒有品項，填 xlsx 後再匯入。'}
          </li>
        )}
        {groups.map((group) => (
          <li key={group.name}>
            <p className="mt-2 px-1 text-xs font-medium text-muted">{subcategoryEmoji(group.name)} {group.name}</p>
            <ul className="mt-1 space-y-1">
              {group.items.map((item) => (
                <li key={`${item.category}-${item.name}`}>
                  <ItemRow
                    item={item}
                    editing={editing}
                    isItemHidden={prefs.hiddenItems.includes(itemKey(item.category, item.name))}
                    itemIndex={orderedItems.findIndex((candidate) => candidate.category === item.category && candidate.name === item.name)}
                    currentNames={orderedItems.filter((candidate) => candidate.category === item.category).map((candidate) => candidate.name)}
                    isFavorite={prefs.favorites.includes(itemKey(item.category, item.name))}
                    defaultDrinkSize={defaultDrinkSize}
                    onToggleFavorite={() => setPrefs((prev) => {
                      const key = itemKey(item.category, item.name)
                      return prev.favorites.includes(key)
                        ? removeFavorite(prev, item.category, item.name)
                        : addFavorite(prev, item.category, item.name)
                    })}
                    onPending={() => setPending(isDrink(item) ? { kind: 'drink', item } : { kind: 'simple', item })}
                    onAddSimple={addSimple}
                    onAddLine={addLine}
                    onMoveItem={(toIndex) => setPrefs((prev) => moveItem(prev, item.category, item.name, toIndex, orderedItems.filter((candidate) => candidate.category === item.category).map((candidate) => candidate.name)))}
                    onToggleHidden={() => setPrefs((prev) => toggleItemHidden(prev, item.category, item.name))}
                  />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      {pending && (
        <div className="mt-3 bg-[var(--surface-2)] p-3 ring-1 ring-[var(--line)]">
          {pending.kind === 'drink' ? (
            <>
              <p className="text-sm">{pending.item.name} · 選冷熱／大小</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {availableSizes(pending.item).map((size) => (
                  <button
                    key={size}
                    type="button"
                    className={`px-3 py-2 text-sm ${size === defaultDrinkSize ? 'bg-[var(--accent)] text-white' : 'bg-[var(--surface)] ring-1 ring-[var(--line)]'}`}
                    onClick={() => addDrink(pending.item, size)}
                  >
                    {SIZE_LABEL[size]} ${formatMoney(drinkPrice(pending.item, size))}
                    {size === defaultDrinkSize ? ' · 預設' : ''}
                  </button>
                ))}
                <button type="button" className="px-3 py-2 text-sm underline" onClick={() => setPending(null)}>
                  取消
                </button>
              </div>
            </>
          ) : (
            <SimpleItemPanel
              item={pending.item}
              rules={compiledMenu.rules ?? []}
              onDone={() => setPending(null)}
              onAddLine={(line) => {
                addLine(line)
                setPending(null)
              }}
            />
          )}
        </div>
      )}

      {lines.length > 0 && (
        <div className="mt-4 border-t border-dashed border-ink/20 pt-3">
          <ul className="space-y-1 text-sm">
            {lines.map((line, index) => (
              <li key={`${line.name}-${index}`} className="flex justify-between gap-2">
                <span>
                  {line.name}
                  {line.size ? ` ${SIZE_LABEL[line.size]}` : ''}
                  {line.note ? <span className="text-xs text-muted">（{line.note}）</span> : ''}
                </span>
                <span className="flex items-center gap-2 tabular-nums">
                  ${formatMoney(line.unitPrice * line.qty)}
                  <button type="button" className="text-xs underline" onClick={() => removeLine(index)}>
                    刪
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between">
            <p className="font-display text-xl">合計 ${formatMoney(total)}</p>
            <button type="button" className="h-10 rounded-[980px] bg-[var(--accent)] px-4 text-white" onClick={confirm}>
              確認扣款
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              className="h-9 flex-1 rounded-[8px] border border-[var(--line)] bg-[var(--surface)] px-2 text-sm"
              placeholder="存成套餐，例如：我的午餐"
              value={presetName}
              onChange={(event) => setPresetName(event.target.value)}
            />
            <button type="button" className="h-9 rounded-[980px] border border-[var(--accent-2)] px-3 text-sm text-[var(--accent-2)]" onClick={savePreset}>
              存成套餐
            </button>
          </div>
        </div>
      )}

      {editing && (
        <div className="mt-4 rounded-[12px] bg-[var(--surface)] p-3 ring-1 ring-[var(--line)]">
          <button type="button" className="h-10 rounded-[980px] bg-[var(--accent)] px-4 text-sm text-white" onClick={() => setCustomFormOpen((value) => !value)}>
            {customFormOpen ? '取消新增自訂品項' : '＋新增自訂品項'}
          </button>
          {customFormOpen && (
            <div className="mt-2 flex flex-wrap gap-2">
              <input className="h-9 flex-1 rounded-[8px] border border-[var(--line)] bg-[var(--surface)] px-2 text-sm" placeholder="品項名稱" value={newItemName} onChange={(event) => setNewItemName(event.target.value)} />
              <input className="h-9 w-24 rounded-[8px] border border-[var(--line)] bg-[var(--surface)] px-2 text-sm" placeholder="價格" inputMode="numeric" value={newItemPrice} onChange={(event) => setNewItemPrice(event.target.value)} />
              <button type="button" className="h-9 rounded-[980px] bg-[var(--accent)] px-3 text-sm text-white" onClick={addCustom}>新增</button>
            </div>
          )}
          {prefs.customItems.length > 0 && <p className="mt-2 text-xs text-muted">自訂分類目前有 {prefs.customItems.length} 項；完成編輯後可在「自訂」分頁正常點餐。</p>}
        </div>
      )}

      {presetStatus && <p className="mt-2 text-sm text-muted">{presetStatus}</p>}

    </div>
  )
}

function ItemRow({
  item,
  editing,
  isItemHidden,
  itemIndex,
  currentNames,
  isFavorite,
  defaultDrinkSize,
  onToggleFavorite,
  onPending,
  onAddSimple,
  onAddLine,
  onMoveItem,
  onToggleHidden,
}: {
  item: MenuItem
  editing: boolean
  isItemHidden: boolean
  itemIndex: number
  currentNames: string[]
  isFavorite: boolean
  defaultDrinkSize: SizeKey
  onToggleFavorite: () => void
  onPending: () => void
  onAddSimple: (item: SimpleItem, qty?: number) => void
  onAddLine: (line: TicketLine) => void
  onMoveItem: (toIndex: number) => void
  onToggleHidden: () => void
}) {
  const controls = editing ? (
    <span className="flex shrink-0 items-center gap-1 text-xs">
      <button type="button" className="h-8 w-8 rounded-full border border-[var(--line)]" disabled={itemIndex <= 0} onClick={() => onMoveItem(itemIndex - 1)}>↑</button>
      <button type="button" className="h-8 w-8 rounded-full border border-[var(--line)]" disabled={itemIndex >= currentNames.length - 1} onClick={() => onMoveItem(itemIndex + 1)}>↓</button>
      <button type="button" className="px-1 underline" onClick={onToggleHidden}>{isItemHidden ? '顯示' : '隱藏'}</button>
    </span>
  ) : null

  if (isDrink(item)) {
    return (
      <div className="flex items-stretch gap-1">
        <button type="button" className="w-8 shrink-0 text-sm" onClick={onToggleFavorite} title={isFavorite ? '移除常用' : '加入常用'}>{isFavorite ? '★' : '☆'}</button>
        <button type="button" className="flex min-w-0 flex-1 items-baseline justify-between bg-[var(--surface)] px-3 py-2 text-left ring-1 ring-[var(--line)]" onClick={() => {
          const size = resolveDrinkSize(item, defaultDrinkSize)
          if (size) {
            const unitPrice = drinkPrice(item, size)
            if (unitPrice != null) { onAddLine({ category: 'drink', name: item.name, size, unitPrice, qty: 1 }); return }
          }
          onPending()
        }}>
          <span>{item.name}</span>
          <span className="text-xs text-muted">{resolveDrinkSize(item, defaultDrinkSize) ? `${SIZE_LABEL[defaultDrinkSize]} $${formatMoney(drinkPrice(item, defaultDrinkSize))}` : '選尺寸'}</span>
        </button>
        <button type="button" className="shrink-0 px-2 text-xs text-[var(--accent-2)] ring-1 ring-[var(--line)]" onClick={onPending}>其他尺寸</button>
        {controls}
      </div>
    )
  }

  const hasDeal = item.deal != null
  const hasBox = item.boxPrice != null
  const needsPanel = hasDeal || hasBox || hasAddonRules(item)
  return (
    <div className="flex items-stretch gap-1">
      <button type="button" className="w-8 shrink-0 text-sm" onClick={onToggleFavorite} title={isFavorite ? '移除常用' : '加入常用'}>{isFavorite ? '★' : '☆'}</button>
      <button type="button" className={`flex min-w-0 flex-1 items-baseline justify-between px-3 py-2 text-left ring-1 ${needsPanel ? 'bg-[var(--surface)] ring-[var(--line)]' : 'bg-ticket ring-ink/10'}`} onClick={() => (needsPanel ? onPending() : onAddSimple(item))}>
        <span>{item.name}{hasDeal && <span className="ml-1 text-xs text-[var(--accent-2)]">優惠 {item.deal!.qty}件${formatMoney(item.deal!.price)}</span>}</span>
        <span className="tabular-nums">{hasDeal ? <><span className="mr-1 text-xs text-muted line-through">${formatMoney(item.price)}</span>${formatMoney(dealBestPrice(item))}起</> : <>${formatMoney(item.price)}</>}</span>
      </button>
      {controls}
    </div>
  )
}

function hasAddonRules(item: SimpleItem): boolean {
  const rules = compiledMenu.rules ?? []
  return rulesFor(rules, `${categoryKeyLabel(item.category)}:${item.subcategory ?? ''}`, 'addon').length > 0
    || rulesFor(rules, `${categoryKeyLabel(item.category)}:${item.subcategory ?? ''}`, 'upgrade').length > 0
}

function categoryKeyLabel(category: string): string {
  return CATEGORY_LABEL[category as Category] ?? category
}

function SimpleItemPanel({
  item,
  rules,
  onAddLine,
  onDone,
}: {
  item: SimpleItem
  rules: MenuRule[]
  onAddLine: (line: TicketLine) => void
  onDone: () => void
}) {
  const [qty, setQty] = useState(1)
  const appliesTo = `${categoryKeyLabel(item.category)}:${item.subcategory ?? ''}`
  const upgrades = rulesFor(rules, appliesTo, 'upgrade')
  const addons = rulesFor(rules, appliesTo, 'addon')
  const options = rulesFor(rules, appliesTo, 'option')
  const infos = rulesFor(rules, appliesTo, 'info')

  const [selectedUpgrade, setSelectedUpgrade] = useState<string | null>(null)
  const [selectedAddons, setSelectedAddons] = useState<Record<string, number>>({})
  const [noodleChoice, setNoodleChoice] = useState<string | null>(null)
  const [buyBox, setBuyBox] = useState(false)

  const deal = item.deal
  const unitLines: TicketLine[] = []
  let subtotal = 0
  if (buyBox && item.boxPrice != null) {
    unitLines.push({ category: item.category, name: `${item.name}（一箱）`, unitPrice: item.boxPrice, qty: 1 })
    subtotal += item.boxPrice
  } else if (deal) {
    const dealCount = Math.floor(qty / deal.qty)
    const remainder = qty % deal.qty
    if (dealCount > 0) {
      unitLines.push({ category: item.category, name: `${item.name} ${deal.qty}件組`, unitPrice: deal.price, qty: dealCount })
      subtotal += deal.price * dealCount
    }
    if (remainder > 0) {
      unitLines.push({ category: item.category, name: item.name, unitPrice: item.price, qty: remainder })
      subtotal += item.price * remainder
    }
  } else {
    unitLines.push({ category: item.category, name: item.name, unitPrice: item.price, qty })
    subtotal += item.price * qty
  }

  const addonLines: TicketLine[] = []
  for (const rule of addons) {
    const count = selectedAddons[rule.name] ?? 0
    if (count > 0 && rule.price != null) {
      addonLines.push({
        category: item.category,
        name: `加購：${rule.name}`,
        unitPrice: rule.price,
        qty: count,
        note: rule.content,
      })
      subtotal += rule.price * count
    }
  }
  const upgrade = upgrades.find((rule) => rule.name === selectedUpgrade)
  if (upgrade && upgrade.price != null) {
    addonLines.push({
      category: item.category,
      name: `升級：${upgrade.name}`,
      unitPrice: upgrade.price,
      qty: 1,
      note: upgrade.content,
    })
    subtotal += upgrade.price
  }

  function commit() {
    const notes: string[] = []
    if (noodleChoice) notes.push(noodleChoice)
    for (const line of [...unitLines, ...addonLines]) {
      onAddLine({ ...line, note: line.note ?? (notes.length > 0 ? notes.join('、') : undefined) })
    }
    onDone()
  }

  return (
    <div>
      <p className="text-sm font-medium">{item.name}</p>
      {deal && !buyBox && (
        <p className="mt-1 text-xs text-[var(--accent-2)]">
          {deal.qty} 件 ${formatMoney(deal.price)}
        </p>
      )}
      {item.note && <p className="mt-1 text-xs text-muted">{item.note}</p>}
      {infos.map((info) => (
        <p key={info.name} className="mt-1 text-xs text-muted">{info.name}：{info.content}</p>
      ))}

      {item.boxPrice != null && (
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={buyBox}
            onChange={(event) => setBuyBox(event.target.checked)}
          />
          買一箱 ${formatMoney(item.boxPrice)}
        </label>
      )}

      {!buyBox && (
        <div className="mt-2 flex items-center gap-2 text-sm">
          <span>數量</span>
          <button type="button" className="h-9 w-9 rounded-full border border-[var(--line)]" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
          <span className="w-6 text-center tabular-nums">{qty}</span>
          <button type="button" className="h-9 w-9 rounded-full border border-[var(--line)]" onClick={() => setQty((q) => Math.min(99, q + 1))}>＋</button>
          <span className="ml-2 tabular-nums">
            ${formatMoney(subtotal)}
          </span>
        </div>
      )}

      {upgrades.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-muted">升級套餐（+${formatMoney(upgrades[0]?.price ?? 0)}）</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {upgrades.map((rule) => (
              <button
                key={rule.name}
                type="button"
                className={`px-3 py-2 text-sm ${selectedUpgrade === rule.name ? 'bg-[var(--accent)] text-white' : 'bg-[var(--surface)] ring-1 ring-[var(--line)]'}`}
                onClick={() => setSelectedUpgrade(selectedUpgrade === rule.name ? null : rule.name)}
                title={rule.content}
              >
                {rule.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {addons.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-muted">加料</p>
          <ul className="mt-1 space-y-1">
            {addons.map((rule) => {
              const count = selectedAddons[rule.name] ?? 0
              return (
                <li key={rule.name} className="flex items-center justify-between text-sm">
                  <span>
                    {rule.name}
                    <span className="ml-1 text-xs text-muted">+${formatMoney(rule.price ?? 0)}｜{rule.content}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <button type="button" className="h-8 w-8 rounded-full border border-[var(--line)]" onClick={() => setSelectedAddons((prev) => ({ ...prev, [rule.name]: Math.max(0, count - 1) }))}>−</button>
                    <span className="w-5 text-center tabular-nums">{count}</span>
                    <button type="button" className="h-8 w-8 rounded-full border border-[var(--line)]" onClick={() => setSelectedAddons((prev) => ({ ...prev, [rule.name]: Math.min(9, count + 1) }))}>＋</button>
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {options.map((option) => (
        <div key={option.name} className="mt-3">
          <p className="text-xs text-muted">{option.name}（{option.note}）</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {(option.content ?? '').split('/').map((choice) => (
              <button
                key={choice}
                type="button"
                className={`px-3 py-2 text-sm ${noodleChoice === choice ? 'bg-[var(--accent)] text-white' : 'bg-[var(--surface)] ring-1 ring-[var(--line)]'}`}
                onClick={() => setNoodleChoice(noodleChoice === choice ? null : choice)}
              >
                {choice}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="mt-4 flex items-center justify-between">
        <p className="font-medium tabular-nums">小計 ${formatMoney(subtotal)}</p>
        <div className="flex gap-2">
          <button type="button" className="px-3 py-2 text-sm underline" onClick={onDone}>取消</button>
          <button type="button" className="h-10 rounded-[980px] bg-[var(--accent)] px-4 text-white" onClick={commit}>加入</button>
        </div>
      </div>
    </div>
  )
}
