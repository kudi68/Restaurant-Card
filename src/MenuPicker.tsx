import { useState } from 'react'
import { formatMoney } from './lib/format.ts'
import {
  CATEGORY_LABEL,
  SIZE_LABEL,
  availableSizes,
  compiledMenu,
  drinkPrice,
  isDrink,
  resolveDrinkSize,
  ticketTotal,
  visibleItems,
  type Category,
  type MenuItem,
  type SizeKey,
  type TicketLine,
} from './lib/menu.ts'

const TABS: Array<Exclude<Category, 'custom'>> = [
  'buffet',
  'nabeyaki',
  'noodles',
  'drink',
  'dessert',
]

export function MenuPicker({
  disabled,
  defaultDrinkSize,
  onConfirm,
}: {
  disabled: boolean
  defaultDrinkSize: SizeKey
  onConfirm: (lines: TicketLine[], total: number) => void
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('drink')
  const [lines, setLines] = useState<TicketLine[]>([])
  const [pendingDrink, setPendingDrink] = useState<Extract<MenuItem, { category: 'drink' }> | null>(
    null,
  )

  const items = visibleItems(compiledMenu.items, tab)
  const total = ticketTotal(lines)

  function addSimple(item: Extract<MenuItem, { price: number }>) {
    setLines((prev) => [
      ...prev,
      {
        category: item.category,
        name: item.name,
        unitPrice: item.price,
        qty: 1,
      },
    ])
  }

  function addDrink(item: Extract<MenuItem, { category: 'drink' }>, size: SizeKey) {
    const unitPrice = drinkPrice(item, size)
    if (unitPrice == null) return
    setLines((prev) => [
      ...prev,
      {
        category: 'drink',
        name: item.name,
        size,
        unitPrice,
        qty: 1,
      },
    ])
    setPendingDrink(null)
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index))
  }

  function confirm() {
    if (lines.length === 0 || total <= 0) return
    onConfirm(lines, total)
    setLines([])
    setPendingDrink(null)
  }

  return (
    <div className={disabled ? 'pointer-events-none opacity-40' : ''}>
      <div className="flex flex-wrap gap-1">
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            className={`px-2 py-1 text-xs ring-1 ring-ink/15 ${tab === key ? 'bg-ink text-paper' : 'bg-ticket'}`}
            onClick={() => {
              setTab(key)
              setPendingDrink(null)
            }}
          >
            {CATEGORY_LABEL[key]}
          </button>
        ))}
      </div>

      <ul className="mt-3 max-h-56 space-y-1 overflow-auto">
        {items.length === 0 && (
          <li className="text-sm text-muted">這個區還沒有品項，填 xlsx 後再匯入。</li>
        )}
        {items.map((item) => (
          <li key={`${item.category}-${item.name}`}>
            {isDrink(item) ? (
              <div className="flex items-stretch gap-1">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-baseline justify-between bg-[var(--surface)] px-3 py-2 text-left ring-1 ring-[var(--line)]"
                  onClick={() => {
                    const size = resolveDrinkSize(item, defaultDrinkSize)
                    if (size) addDrink(item, size)
                    else setPendingDrink(item)
                  }}
                >
                  <span>{item.name}</span>
                  <span className="text-xs text-muted">
                    {resolveDrinkSize(item, defaultDrinkSize)
                      ? `${SIZE_LABEL[defaultDrinkSize]} $${formatMoney(drinkPrice(item, defaultDrinkSize))}`
                      : '選尺寸'}
                  </span>
                </button>
                <button
                  type="button"
                  className="shrink-0 px-2 text-xs text-[var(--accent-2)] ring-1 ring-[var(--line)]"
                  onClick={() => setPendingDrink(item)}
                >
                  其他尺寸
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="flex w-full items-baseline justify-between bg-ticket px-3 py-2 text-left ring-1 ring-ink/10"
                onClick={() => addSimple(item)}
              >
                <span>{item.name}</span>
                <span className="tabular-nums">${formatMoney(item.price)}</span>
              </button>
            )}
          </li>
        ))}
      </ul>

      {pendingDrink && (
        <div className="mt-3 bg-[var(--surface-2)] p-3 ring-1 ring-[var(--line)]">
          <p className="text-sm">
            {pendingDrink.name} · 選冷熱／大小
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {availableSizes(pendingDrink).map((size) => (
              <button
                key={size}
                type="button"
                className={`px-3 py-2 text-sm ${size === defaultDrinkSize ? 'bg-[var(--accent)] text-white' : 'bg-[var(--surface)] ring-1 ring-[var(--line)]'}`}
                onClick={() => addDrink(pendingDrink, size)}
              >
                {SIZE_LABEL[size]} ${formatMoney(drinkPrice(pendingDrink, size))}
                {size === defaultDrinkSize ? ' · 預設' : ''}
              </button>
            ))}
            <button type="button" className="px-3 py-2 text-sm underline" onClick={() => setPendingDrink(null)}>
              取消
            </button>
          </div>
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
                </span>
                <span className="flex items-center gap-2 tabular-nums">
                  ${formatMoney(line.unitPrice)}
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
        </div>
      )}
    </div>
  )
}
