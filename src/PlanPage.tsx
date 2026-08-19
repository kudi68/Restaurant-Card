import { useEffect, useMemo, useState } from 'react'
import { formatMoney } from './lib/format.ts'
import {
  availableSizes,
  compiledMenu,
  drinkPrice,
  isDrink,
  SIZE_LABEL,
  visibleItems,
  type DrinkItem,
  type SizeKey,
} from './lib/menu.ts'
import { countAffordable, leftoverOf, mealsOnDate, remainingDateList } from './lib/leftover.ts'
import {
  addPlanLine,
  cartTotal,
  necessaryTotalForPlan,
  projectedAfterCart,
  resolvePlanUnitPrice,
  setPlanLineQuantity,
  type PlanCartLine,
  type PlanDraft,
} from './lib/plan.ts'
import type { AppState } from './lib/storage.ts'

export function PlanPage({ state, now, draft, onDraftChange }: {
  state: AppState
  now: Date
  draft: PlanDraft
  onDraftChange: (draft: PlanDraft) => void
}) {
  const dates = remainingDateList({ now, mode: 'calendar', customDays: 31 })
  const necessary = necessaryTotalForPlan(state.habit, dates, {
    dateKey: draft.dateKey,
    ...draft.eatenToday,
  })
  const leftover = state.balance == null ? null : leftoverOf(state.balance, necessary)
  const drinks = visibleItems(compiledMenu.items, 'drink').filter(isDrink)
  const groceries = visibleItems(compiledMenu.items, 'grocery')
  const [selectedName, setSelectedName] = useState(drinks[0]?.name ?? '')
  const selectedDrink = useMemo(
    () => drinks.find((drink) => drink.name === selectedName) ?? drinks[0],
    [drinks, selectedName],
  )
  const preferredSize = selectedDrink && drinkPrice(selectedDrink, state.defaultDrinkSize) != null
    ? state.defaultDrinkSize
    : selectedDrink ? availableSizes(selectedDrink)[0] : undefined
  const [selectedSize, setSelectedSize] = useState<SizeKey | undefined>(preferredSize)
  const [cartMessage, setCartMessage] = useState('')
  const [undoLines, setUndoLines] = useState<PlanCartLine[] | null>(null)
  const selectDrink = (name: string) => {
    setSelectedName(name)
    const drink = drinks.find((candidate) => candidate.name === name)
    const nextSize = drink && drinkPrice(drink, state.defaultDrinkSize) != null
      ? state.defaultDrinkSize
      : drink ? availableSizes(drink)[0] : undefined
    setSelectedSize(nextSize)
  }

  const total = cartTotal(draft.lines, compiledMenu.items)
  const projected = leftover == null ? null : projectedAfterCart(leftover, draft.lines, compiledMenu.items)
  const selectedPrice = selectedDrink && selectedSize ? drinkPrice(selectedDrink, selectedSize) : null
  const linesAfterAdd = selectedDrink && selectedSize && selectedPrice != null
    ? addPlanLine(draft.lines, { category: 'drink', name: selectedDrink.name, size: selectedSize, qty: 1 })
    : draft.lines
  const projectedAfterAdd = leftover == null ? null : projectedAfterCart(leftover, linesAfterAdd, compiledMenu.items)
  const todayMeals = mealsOnDate(state.habit, now)
  const patchDraft = (partial: Partial<PlanDraft>) => onDraftChange({ ...draft, ...partial })
  useEffect(() => {
    if (!undoLines) return
    const timer = window.setTimeout(() => setUndoLines(null), 5000)
    return () => window.clearTimeout(timer)
  }, [undoLines])
  const addSelected = () => {
    if (!selectedDrink || !selectedSize || selectedPrice == null) return
    setUndoLines(draft.lines)
    patchDraft({ lines: linesAfterAdd })
    setCartMessage(`${selectedDrink.name} ${SIZE_LABEL[selectedSize]} 已加入`)
  }
  const changeQuantity = (line: PlanCartLine, qty: number) => {
    setUndoLines(null)
    patchDraft({ lines: setPlanLineQuantity(draft.lines, line, qty) })
  }
  const clearCart = () => {
    setUndoLines(null)
    patchDraft({ lines: [] })
  }
  const changeEaten = (meal: 'lunch' | 'dinner', checked: boolean) => {
    setUndoLines(null)
    patchDraft({ eatenToday: { ...draft.eatenToday, [meal]: checked } })
  }

  return (
    <div className="px-4 pb-24 pt-6">
      <h1 className="text-[32px] font-semibold leading-[1.1]">規劃剩餘</h1>
      <p className="mt-2 text-sm text-muted">先扣月底前必要餐費，再用購物車模擬飲料。目前生活食品／小物尚待價目；這裡不會扣餘額，真的買了才回餐卡記帳。</p>

      {state.balance == null ? <p className="mt-6 text-muted">先回餐卡登記餘額。</p> : (
        <>
          <section className="mt-5 rounded-[16px] bg-[var(--surface)] p-4">
            <p className="text-xs text-muted">必要餐費（今天到月底，共 {dates.length} 天）</p>
            <p className="text-[28px] font-semibold tabular-nums">${formatMoney(necessary)}</p>
            <p className="mt-3 text-xs text-muted">扣完後可規劃</p>
            <p className={`text-[44px] font-semibold tabular-nums ${leftover != null && leftover < 0 ? 'text-[var(--accent)]' : ''}`}>${formatMoney(leftover)}</p>
          </section>

          <section className="mt-4 rounded-[16px] bg-[var(--surface)] p-4">
            <h2 className="text-[18px] font-semibold">今天已吃過</h2>
            <p className="mt-1 text-sm text-muted">只排除今天，隔日會自動清空。</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <label className={`flex gap-2 ${todayMeals.lunch ? '' : 'opacity-40'}`}><input type="checkbox" disabled={!todayMeals.lunch} checked={draft.eatenToday.lunch} onChange={(event) => changeEaten('lunch', event.target.checked)} />今天午餐已吃</label>
              <label className={`flex gap-2 ${todayMeals.dinner ? '' : 'opacity-40'}`}><input type="checkbox" disabled={!todayMeals.dinner} checked={draft.eatenToday.dinner} onChange={(event) => changeEaten('dinner', event.target.checked)} />今天晚餐已吃</label>
            </div>
          </section>

          <section className="mt-6">
            <h2 className="text-[21px] font-semibold">試算購物車</h2>
            <p className="text-sm text-muted">同品項同尺寸會合併；價格永遠用目前菜單最新價格。</p>
            <div className="mt-3 grid gap-2 rounded-[16px] bg-[var(--surface)] p-3 sm:grid-cols-[1fr_110px_auto]">
              <select className="h-11 rounded-[10px] border border-[var(--line)] bg-paper px-2" value={selectedDrink?.name ?? ''} onChange={(event) => selectDrink(event.target.value)}>{drinks.map((drink) => <option key={drink.name} value={drink.name}>{drink.name}</option>)}</select>
              <select className="h-11 rounded-[10px] border border-[var(--line)] bg-paper px-2" value={selectedSize ?? ''} onChange={(event) => setSelectedSize(event.target.value as SizeKey)}>{selectedDrink && availableSizes(selectedDrink).map((size) => <option key={size} value={size}>{SIZE_LABEL[size]} ${drinkPrice(selectedDrink, size)}</option>)}</select>
              <button type="button" className={`h-11 rounded-[980px] px-4 text-white ${projectedAfterAdd != null && projectedAfterAdd < 0 ? 'bg-red-600' : 'bg-[var(--accent)]'}`} onClick={addSelected}>
                {projectedAfterAdd != null && projectedAfterAdd < 0 ? `仍要加入 · 超出 $${formatMoney(Math.abs(projectedAfterAdd))}` : `加入試算 · 買後剩 $${formatMoney(projectedAfterAdd)}`}
              </button>
            </div>
            {cartMessage && <div className="mt-2 flex items-center justify-between rounded-[10px] bg-[var(--surface)] px-3 py-2 text-sm"><span>✓ {cartMessage}</span>{undoLines && <button type="button" className="underline" onClick={() => { patchDraft({ lines: undoLines }); setUndoLines(null); setCartMessage('已復原') }}>復原</button>}</div>}

            {draft.lines.length === 0 ? <p className="mt-3 text-sm text-muted">購物車還是空的。</p> : (
              <ul className="mt-3 divide-y divide-[var(--line)] rounded-[16px] bg-[var(--surface)] px-3">
                {draft.lines.map((line) => <CartLine key={`${line.category}:${line.name}:${line.size ?? ''}`} line={line} onQuantity={(qty) => changeQuantity(line, qty)} />)}
              </ul>
            )}
            <div className={`mt-3 rounded-[16px] p-4 ${projected != null && projected < 0 ? 'bg-[color-mix(in_srgb,var(--accent)_12%,var(--surface))] text-[var(--accent)]' : 'bg-[var(--surface)]'}`}>
              <div className="flex justify-between text-sm"><span>購物車合計</span><strong>${formatMoney(total)}</strong></div>
              <p className="mt-2 text-xs">若照購物車買，月底還剩</p>
              <p className="text-[36px] font-semibold tabular-nums">${formatMoney(projected)}</p>
              {projected != null && projected < 0 && <p className="text-sm font-medium">⚠ 超出可規劃金額 ${formatMoney(Math.abs(projected))}，仍可繼續試算。</p>}
              {draft.lines.length > 0 && <button type="button" className="mt-3 text-sm underline" onClick={clearCart}>清空購物車</button>}
            </div>
          </section>

          <section className="mt-6">
            <h2 className="text-[21px] font-semibold">如果全換成飲料</h2>
            <p className="text-sm text-muted">仍是獨立估算，不會加入購物車，也不會扣餘額。</p>
            <ul className="mt-2">{drinks.slice(0, 8).map((item) => <DrinkGuess key={item.name} item={item} spendable={Math.max(0, leftover ?? 0)} preferred={state.defaultDrinkSize} />)}</ul>
          </section>

          <section className="mt-6">
            <h2 className="text-[21px] font-semibold">生活食品／小物</h2>
            {groceries.length === 0 ? <p className="mt-2 text-sm text-muted">價目尚未提供，目前購物車先使用 27 項飲料；之後補 xlsx「生活食品」分頁即可接入。</p> : <p className="mt-2 text-sm text-muted">已讀到 {groceries.length} 項生活食品，下一版可加入同一購物車。</p>}
          </section>
        </>
      )}
    </div>
  )
}

function CartLine({ line, onQuantity }: { line: PlanCartLine; onQuantity: (qty: number) => void }) {
  const price = resolvePlanUnitPrice(line, compiledMenu.items)
  return <li className="flex items-center justify-between gap-3 py-3 text-sm"><div><p>{line.name}{line.size ? ` · ${SIZE_LABEL[line.size]}` : ''}</p><p className="text-xs text-muted">{price == null ? '品項已下架' : `$${price} × ${line.qty}`}</p></div><div className="flex items-center gap-2"><button type="button" className="h-8 w-8 rounded-full border border-[var(--line)]" onClick={() => onQuantity(line.qty - 1)}>−</button><span className="w-5 text-center tabular-nums">{line.qty}</span><button type="button" className="h-8 w-8 rounded-full border border-[var(--line)]" onClick={() => onQuantity(line.qty + 1)}>＋</button></div></li>
}

function DrinkGuess({ item, spendable, preferred }: { item: DrinkItem; spendable: number; preferred: 'hot_m' | 'iced_m' }) {
  const fallback = availableSizes(item)[0]
  const price = drinkPrice(item, preferred) ?? (fallback ? drinkPrice(item, fallback) : null)
  if (price == null) return null
  return <li className="flex justify-between border-b border-[var(--line)] py-2 text-sm"><span>{item.name}</span><span className="text-muted">約 {countAffordable(spendable, price)} 杯</span></li>
}
