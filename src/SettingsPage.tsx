import { planningDays, remainingDays, remainingWeekdays, type DayCountMode } from './lib/month.ts'
import { SIZE_LABEL } from './lib/menu.ts'
import {
  createMealHabit,
  mealDaysFromLegacy,
  WEEKDAY_KEYS,
  type MealDays,
  type WeekdayKey,
} from './lib/leftover.ts'
import type { AppState, Appearance, DefaultDrinkSize } from './lib/storage.ts'

const DAY_OPTIONS: Array<{ id: DayCountMode; title: string; hint: string }> = [
  { id: 'calendar', title: '算到月底每一天', hint: '只影響首頁日均分母，必要餐費仍照七日習慣。' },
  { id: 'weekdays', title: '首頁日均只算平日', hint: '週末不列入日均分母，但週末餐費仍會照設定保留。' },
  { id: 'custom', title: '自己填日均天數', hint: '只指定首頁想把餘額攤成幾天。' },
]

const DAY_LABEL: Record<WeekdayKey, string> = {
  mon: '星期一', tue: '星期二', wed: '星期三', thu: '星期四',
  fri: '星期五', sat: '星期六', sun: '星期日',
}

export function SettingsPage({ state, now, onChange, onBack }: {
  state: AppState
  now: Date
  onChange: (partial: Partial<AppState>) => void
  onBack: () => void
}) {
  const calendar = remainingDays(now)
  const weekdays = remainingWeekdays(now)
  const used = planningDays({ mode: state.dayCountMode, customDays: state.customRemainingDays, now })

  const setDays = (days: MealDays) => onChange({
    habit: createMealHabit(days, state.habit.lunchPrice, state.habit.dinnerPrice),
  })
  const applyPreset = (preset: 'all' | 'weekdays' | 'weekdayLunch' | 'none') => {
    setDays(mealDaysFromLegacy({
      weekdayLunch: preset !== 'none',
      weekdayDinner: preset === 'all' || preset === 'weekdays',
      weekendLunch: preset === 'all',
      weekendDinner: preset === 'all',
    }))
  }
  const setMeal = (day: WeekdayKey, meal: 'lunch' | 'dinner', checked: boolean) => {
    setDays({ ...state.habit.days, [day]: { ...state.habit.days[day], [meal]: checked } })
  }
  const setPrice = (meal: 'lunchPrice' | 'dinnerPrice', value: number) => onChange({
    habit: createMealHabit(
      state.habit.days,
      meal === 'lunchPrice' ? value : state.habit.lunchPrice,
      meal === 'dinnerPrice' ? value : state.habit.dinnerPrice,
    ),
  })

  return (
    <div className="px-4 py-6 pb-24 sm:px-6 sm:py-10">
      <header className="mb-6 border-b-2 border-dashed border-ink/20 pb-4">
        <button type="button" className="text-sm text-[var(--accent-2)]" onClick={onBack}>← 回餐卡</button>
        <h1 className="mt-3 text-[40px] font-semibold leading-[1.1]">個人化設定</h1>
        <p className="mt-1 text-sm text-muted">這些只存在這個瀏覽器；七日習慣換月會保留。</p>
      </header>

      <section className="bg-ticket p-4">
        <h2 className="text-[21px] font-semibold">外觀</h2>
        <p className="mt-1 text-sm text-muted">淺色是 Apple 全淺，深色是考古豹。</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {([{ id: 'light' as Appearance, label: '淺色' }, { id: 'dark' as Appearance, label: '深色' }]).map((option) => (
            <button key={option.id} type="button" className={`h-11 rounded-[980px] ${state.appearance === option.id ? 'bg-[var(--accent)] text-white' : 'bg-paper ring-1 ring-[var(--line)]'}`} onClick={() => onChange({ appearance: option.id })}>{option.label}</button>
          ))}
        </div>
      </section>

      <section className="mt-4 bg-ticket p-4">
        <h2 className="font-display text-xl">首頁日均怎麼算</h2>
        <p className="mt-1 text-sm text-muted">這裡只控制首頁「平均每天」，不會刪掉任何星期的必要餐費。</p>
        <ul className="mt-3 space-y-2">
          {DAY_OPTIONS.map((option) => (
            <li key={option.id}>
              <label className="flex cursor-pointer gap-3 bg-paper px-3 py-3 ring-1 ring-ink/10">
                <input type="radio" className="mt-1" name="dayCountMode" checked={state.dayCountMode === option.id} onChange={() => onChange({ dayCountMode: option.id })} />
                <span><span className="block font-medium">{option.title}</span><span className="block text-xs text-muted">{option.hint}</span></span>
              </label>
            </li>
          ))}
        </ul>
        {state.dayCountMode === 'custom' && (
          <label className="mt-3 block text-sm">首頁日均要攤幾天
            <input className="mt-1 h-11 w-full border border-ink/20 bg-paper px-3" type="number" min="1" max="31" value={state.customRemainingDays} onChange={(event) => onChange({ customRemainingDays: Number(event.target.value) || 0 })} />
          </label>
        )}
        <p className="mt-4 text-sm">現在首頁用 <strong>{used}</strong> 天平攤。{state.dayCountMode === 'calendar' && `（月底前 ${calendar} 天）`}{state.dayCountMode === 'weekdays' && `（月底前 ${weekdays} 個平日）`}</p>
      </section>

      <section className="mt-4 bg-ticket p-4">
        <h2 className="text-[21px] font-semibold">每週打算吃哪些餐</h2>
        <p className="mt-1 text-sm text-muted">先快速套用，再逐日微調；用來計算月底前必要餐費。</p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <button type="button" className="h-10 rounded-[10px] bg-paper ring-1 ring-[var(--line)]" onClick={() => applyPreset('all')}>全週午晚餐</button>
          <button type="button" className="h-10 rounded-[10px] bg-paper ring-1 ring-[var(--line)]" onClick={() => applyPreset('weekdays')}>平日午晚餐</button>
          <button type="button" className="h-10 rounded-[10px] bg-paper ring-1 ring-[var(--line)]" onClick={() => applyPreset('weekdayLunch')}>只有平日午餐</button>
          <button type="button" className="h-10 rounded-[10px] bg-paper ring-1 ring-[var(--line)]" onClick={() => applyPreset('none')}>全部清除</button>
        </div>
        <div className="mt-4 overflow-hidden rounded-[12px] ring-1 ring-[var(--line)]">
          <div className="grid grid-cols-[1fr_72px_72px] bg-[var(--surface)] px-3 py-2 text-xs text-muted"><span>星期</span><span className="text-center">午餐</span><span className="text-center">晚餐</span></div>
          {WEEKDAY_KEYS.map((day) => (
            <div key={day} className="grid grid-cols-[1fr_72px_72px] items-center border-t border-[var(--line)] bg-paper px-3 py-3 text-sm">
              <span>{DAY_LABEL[day]}</span>
              <label className="text-center"><input aria-label={`${DAY_LABEL[day]}午餐`} type="checkbox" checked={state.habit.days[day].lunch} onChange={(event) => setMeal(day, 'lunch', event.target.checked)} /></label>
              <label className="text-center"><input aria-label={`${DAY_LABEL[day]}晚餐`} type="checkbox" checked={state.habit.days[day].dinner} onChange={(event) => setMeal(day, 'dinner', event.target.checked)} /></label>
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">午餐大概多少<input className="mt-1 h-11 w-full border border-[var(--line)] bg-paper px-3" type="number" min="0" value={state.habit.lunchPrice} onChange={(event) => setPrice('lunchPrice', Number(event.target.value) || 0)} /></label>
          <label className="block text-sm">晚餐大概多少<input className="mt-1 h-11 w-full border border-[var(--line)] bg-paper px-3" type="number" min="0" value={state.habit.dinnerPrice} onChange={(event) => setPrice('dinnerPrice', Number(event.target.value) || 0)} /></label>
        </div>
      </section>

      <section className="mt-4 bg-ticket p-4 ring-1 ring-ink/15">
        <h2 className="font-display text-xl">飲料預設尺寸</h2>
        <p className="mt-1 text-sm text-muted">點飲料時先帶這個尺寸；沒有時仍可選其他尺寸。</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(['iced_m', 'hot_m'] as DefaultDrinkSize[]).map((size) => (
            <button key={size} type="button" className={`h-11 rounded-[980px] ${state.defaultDrinkSize === size ? 'bg-[var(--accent)] text-white' : 'bg-paper ring-1 ring-[var(--line)]'}`} onClick={() => onChange({ defaultDrinkSize: size })}>{SIZE_LABEL[size]}</button>
          ))}
        </div>
      </section>

      <button type="button" className="mt-6 h-11 w-full rounded-[980px] bg-[var(--accent)] text-white" onClick={onBack}>完成，回餐卡</button>
    </div>
  )
}
