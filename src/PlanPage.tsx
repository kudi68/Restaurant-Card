import { formatMoney } from './lib/format.ts'
import {
  compiledMenu,
  drinkPrice,
  isDrink,
  visibleItems,
  type DrinkItem,
} from './lib/menu.ts'
import {
  leftoverOf,
  necessaryTotal,
  remainingDateList,
  spendableOf,
  countAffordable,
} from './lib/leftover.ts'
import type { AppState } from './lib/storage.ts'

export function PlanPage({
  state,
  now,
  onChange,
}: {
  state: AppState
  now: Date
  onChange: (partial: Partial<AppState>) => void
}) {
  const dates = remainingDateList({
    now,
    mode: state.dayCountMode,
    customDays: state.customRemainingDays,
  })
  const necessary = necessaryTotal(state.habit, dates)
  const leftover = state.balance == null ? null : leftoverOf(state.balance, necessary)
  const spendable = leftover == null ? null : spendableOf(leftover, state.monthEndReserve)
  const drinks = visibleItems(compiledMenu.items, 'drink').filter(isDrink)
  const groceries = visibleItems(compiledMenu.items, 'grocery')

  return (
    <div className="px-4 pb-24 pt-6">
      <h1 className="text-[32px] font-semibold leading-[1.1]">規劃剩餘</h1>
      <p className="mt-2 text-sm text-muted">
        先扣掉這個月還打算吃的午餐／晚餐，剩下的錢才拿來規劃飲料或生活食品。規劃不會扣餘額，真的買了請回餐卡記一筆。
      </p>

      {state.balance == null ? (
        <p className="mt-6 text-muted">先回餐卡登記餘額。</p>
      ) : (
        <>
          <section className="mt-5 rounded-[16px] bg-[var(--surface)] p-4">
            <p className="text-xs text-muted">必要餐費（{dates.length} 天）</p>
            <p className="text-[28px] font-semibold tabular-nums">${formatMoney(necessary)}</p>
            <p className="mt-3 text-xs text-muted">扣完後剩下</p>
            <p className={`text-[44px] font-semibold tabular-nums ${leftover != null && leftover < 0 ? 'text-[var(--accent)]' : ''}`}>
              ${formatMoney(leftover)}
            </p>
            {leftover != null && leftover < 0 && (
              <p className="mt-1 text-sm text-[var(--accent)]">必要餐費已超過餘額，先調習慣或少記幾餐。</p>
            )}
          </section>

          <label className="mt-4 block text-sm">
            月底想預留
            <input
              className="mt-1 h-11 w-full rounded-[11px] border-[3px] border-[var(--line)] bg-[var(--surface)] px-3"
              type="number"
              min="0"
              value={state.monthEndReserve}
              onChange={(event) => onChange({ monthEndReserve: Number(event.target.value) || 0 })}
            />
          </label>
          <p className="mt-2 text-sm text-muted">
            預留後還能花 <strong>${formatMoney(spendable)}</strong>
          </p>

          <section className="mt-6">
            <h2 className="text-[21px] font-semibold">可以換成飲料</h2>
            <p className="text-sm text-muted">用設定裡的預設尺寸估算，不是下單。</p>
            <ul className="mt-2">
              {drinks.slice(0, 8).map((item) => (
                <DrinkGuess key={item.name} item={item} spendable={spendable ?? 0} preferred={state.defaultDrinkSize} />
              ))}
            </ul>
          </section>

          <section className="mt-6">
            <h2 className="text-[21px] font-semibold">可以換成生活食品</h2>
            {groceries.length === 0 ? (
              <p className="mt-2 text-sm text-muted">菜單還沒有生活食品。把水果、牛奶、罐裝飲料補進 xlsx「生活食品」分頁後跟我說一聲。</p>
            ) : (
              <ul className="mt-2">
                {groceries.map((item) => (
                  <li key={item.name} className="flex justify-between border-b border-[var(--line)] py-2 text-sm">
                    <span>{item.name}</span>
                    <span className="text-muted">
                      {'price' in item
                        ? `約 ${countAffordable(spendable ?? 0, item.price)} 份`
                        : '—'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function DrinkGuess({
  item,
  spendable,
  preferred,
}: {
  item: DrinkItem
  spendable: number
  preferred: 'hot_m' | 'iced_m'
}) {
  const price = drinkPrice(item, preferred) ?? drinkPrice(item, 'iced_m') ?? drinkPrice(item, 'hot_m')
  if (price == null) return null
  return (
    <li className="flex justify-between border-b border-[var(--line)] py-2 text-sm">
      <span>{item.name}</span>
      <span className="text-muted">約 {countAffordable(spendable, price)} 杯</span>
    </li>
  )
}
