import { planningDays, remainingDays, remainingWeekdays, type DayCountMode } from './lib/month.ts'
import { SIZE_LABEL } from './lib/menu.ts'
import type { AppState, DefaultDrinkSize } from './lib/storage.ts'

const DAY_OPTIONS: Array<{ id: DayCountMode; title: string; hint: string }> = [
  { id: 'calendar', title: '算到月底每一天', hint: '含週末，從今天數到這個月最後一天。' },
  { id: 'weekdays', title: '只算平日', hint: '只攤星期一到五。週末不列入分母。' },
  { id: 'custom', title: '自己填剩餘天數', hint: '本月你還想把錢攤成幾天，直接指定。' },
]

export function SettingsPage({
  state,
  now,
  onChange,
  onBack,
}: {
  state: AppState
  now: Date
  onChange: (partial: Partial<AppState>) => void
  onBack: () => void
}) {
  const calendar = remainingDays(now)
  const weekdays = remainingWeekdays(now)
  const used = planningDays({
    mode: state.dayCountMode,
    customDays: state.customRemainingDays,
    now,
  })

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-6 border-b-2 border-dashed border-ink/20 pb-4">
        <button type="button" className="text-sm text-[#0066cc]" onClick={onBack}>
          ← 回餐卡
        </button>
        <h1 className="mt-3 text-[40px] font-semibold leading-[1.1]">個人化設定</h1>
        <p className="mt-1 text-sm text-muted">這些只存在這個瀏覽器，換月餘額仍會歸零。</p>
      </header>

      <section className="bg-ticket p-4 ring-1 ring-ink/15">
        <h2 className="font-display text-xl">天數怎麼算</h2>
        <p className="mt-1 text-sm text-muted">日均 = 餘額 ÷ 這裡算出來的天數。</p>
        <ul className="mt-3 space-y-2">
          {DAY_OPTIONS.map((option) => (
            <li key={option.id}>
              <label className="flex cursor-pointer gap-3 bg-paper px-3 py-3 ring-1 ring-ink/10">
                <input
                  type="radio"
                  className="mt-1"
                  name="dayCountMode"
                  checked={state.dayCountMode === option.id}
                  onChange={() => onChange({ dayCountMode: option.id })}
                />
                <span>
                  <span className="block font-medium">{option.title}</span>
                  <span className="block text-xs text-muted">{option.hint}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        {state.dayCountMode === 'custom' && (
          <label className="mt-3 block text-sm">
            本月剩餘幾天
            <input
              className="mt-1 h-11 w-full border border-ink/20 bg-paper px-3"
              type="number"
              min="1"
              max="31"
              value={state.customRemainingDays}
              onChange={(event) =>
                onChange({ customRemainingDays: Number(event.target.value) || 0 })
              }
            />
          </label>
        )}
        <p className="mt-4 text-sm">
          現在會用 <strong>{used}</strong> 天來平攤。
          {state.dayCountMode === 'calendar' && `（月底前還有 ${calendar} 天）`}
          {state.dayCountMode === 'weekdays' && `（月底前還有 ${weekdays} 個平日）`}
        </p>
      </section>

      <section className="mt-4 bg-ticket p-4 ring-1 ring-ink/15">
        <h2 className="font-display text-xl">換算單價</h2>
        <p className="mt-1 text-sm text-muted">只影響「還能吃幾餐／幾杯」，不會改菜單售價。</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            一餐怎麼算
            <input
              className="mt-1 h-11 w-full border border-ink/20 bg-paper px-3"
              type="number"
              min="1"
              value={state.mealUnitPrice}
              onChange={(event) => onChange({ mealUnitPrice: Number(event.target.value) || 0 })}
            />
          </label>
          <label className="block text-sm">
            一杯怎麼算
            <input
              className="mt-1 h-11 w-full border border-ink/20 bg-paper px-3"
              type="number"
              min="1"
              value={state.drinkUnitPrice}
              onChange={(event) => onChange({ drinkUnitPrice: Number(event.target.value) || 0 })}
            />
          </label>
        </div>
      </section>

      <section className="mt-4 bg-ticket p-4 ring-1 ring-ink/15">
        <h2 className="font-display text-xl">飲料預設尺寸</h2>
        <p className="mt-1 text-sm text-muted">
          點飲料時先帶這個尺寸；那杯沒有這個尺寸才會再請你選。
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(['iced_m', 'hot_m'] as DefaultDrinkSize[]).map((size) => (
            <button
              key={size}
              type="button"
              className={`h-11 ${state.defaultDrinkSize === size ? 'bg-ink text-paper' : 'bg-paper ring-1 ring-ink/15'}`}
              onClick={() => onChange({ defaultDrinkSize: size })}
            >
              {SIZE_LABEL[size]}
            </button>
          ))}
        </div>
      </section>

      <button type="button" className="mt-6 h-11 w-full bg-ink text-paper" onClick={onBack}>
        完成，回餐卡
      </button>
    </div>
  )
}
