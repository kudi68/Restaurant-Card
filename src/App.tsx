import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { MenuPicker } from './MenuPicker.tsx'
import { SettingsPage } from './SettingsPage.tsx'
import { LiquidGlass } from './ui/LiquidGlass.tsx'
import { formatDays, formatMoney } from './lib/format.ts'
import { SIZE_LABEL, type TicketLine } from './lib/menu.ts'
import {
  applyAdjust,
  applySpend,
  conversions,
  dailyAverage,
  todayAdvice,
  type Mode,
} from './lib/money.ts'
import {
  isTaipeiWeekday,
  monthKey,
  planningDays,
  taipeiParts,
} from './lib/month.ts'
import {
  loadState,
  rolloverIfNeeded,
  saveState,
  spentOnTaipeiDay,
  type AppState,
  type LedgerEntry,
} from './lib/storage.ts'

const ISSUE_NEW = 'https://github.com/kudi68/Restaurant-Card/issues/new'

function newId(): string {
  return crypto.randomUUID()
}

function monthLabel(key: string): string {
  const [year, month] = key.split('-')
  return `${year} 年 ${Number(month)} 月`
}

export default function App() {
  const [now, setNow] = useState(() => new Date())
  const [state, setState] = useState<AppState>(() => loadState(new Date()))
  const [spendAmount, setSpendAmount] = useState('')
  const [spendNote, setSpendNote] = useState('')
  const [adjustAmount, setAdjustAmount] = useState('')
  const [feedback, setFeedback] = useState('')
  const [screen, setScreen] = useState<'home' | 'settings'>('home')

  useEffect(() => {
    saveState(state)
  }, [state])

  useEffect(() => {
    const sync = () => {
      const next = new Date()
      setNow(next)
      setState((prev) => rolloverIfNeeded(prev, next))
    }
    window.addEventListener('focus', sync)
    return () => window.removeEventListener('focus', sync)
  }, [])

  const daysLeft = planningDays({
    mode: state.dayCountMode,
    customDays: state.customRemainingDays,
    now,
  })
  const weekendPaused = state.dayCountMode === 'weekdays' && !isTaipeiWeekday(now)
  const daily = state.balance == null ? null : dailyAverage(state.balance, daysLeft)
  const spentToday = useMemo(
    () => spentOnTaipeiDay(state.entries, now),
    [state.entries, now],
  )
  const advice =
    daily == null ? null : todayAdvice(state.mode, daily, spentToday)
  const conv =
    state.balance == null || daily == null
      ? null
      : conversions(state.balance, daily, state.mealUnitPrice, state.drinkUnitPrice)

  function patch(partial: Partial<AppState>) {
    setState((prev) => ({ ...prev, ...partial }))
  }

  function addEntry(entry: LedgerEntry) {
    setState((prev) => ({ ...prev, entries: [entry, ...prev.entries] }))
  }

  function onSpend(event: FormEvent) {
    event.preventDefault()
    if (state.balance == null) return
    const amount = Number(spendAmount)
    if (!Number.isFinite(amount) || amount <= 0) return
    const next = applySpend(state.balance, amount)
    patch({ balance: next })
    addEntry({
      id: newId(),
      at: new Date().toISOString(),
      type: 'spend',
      amount,
      note: spendNote.trim() || undefined,
    })
    setSpendAmount('')
    setSpendNote('')
    setNow(new Date())
  }

  function onAdjust(event: FormEvent) {
    event.preventDefault()
    const amount = Number(adjustAmount)
    if (!Number.isFinite(amount)) return
    patch({ balance: applyAdjust(amount) })
    addEntry({
      id: newId(),
      at: new Date().toISOString(),
      type: 'adjust',
      amount,
      note: '手動設定餘額',
    })
    setAdjustAmount('')
    setNow(new Date())
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `restaurant-card-${state.monthKey}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function openFeedbackIssue() {
    const title = feedback.trim().slice(0, 60) || '餐卡建議'
    const body = [
      feedback.trim() || '（未填內容）',
      '',
      `月份：${state.monthKey}`,
      `模式：${state.mode}`,
      `送出時間：${new Date().toISOString()}`,
    ].join('\n')
    const url = `${ISSUE_NEW}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const parts = taipeiParts(now)
  const dayHint =
    state.dayCountMode === 'weekdays'
      ? `只算平日 · 還有 ${daysLeft} 天`
      : state.dayCountMode === 'custom'
        ? `自訂 ${daysLeft} 天`
        : `還有 ${daysLeft} 天`

  if (screen === 'settings') {
    return (
      <SettingsPage
        state={state}
        now={now}
        onChange={patch}
        onBack={() => setScreen('home')}
      />
    )
  }

  return (
    <div className="pb-10">
      <header className="sticky top-0 z-20 flex h-12 items-center justify-between px-4 text-xs text-white [background:rgba(0,0,0,0.78)] [backdrop-filter:saturate(180%)_blur(20px)]">
        <span>餐卡</span>
        <span>
          {monthLabel(state.monthKey)} · {parts.month}/{parts.day}
        </span>
        <button type="button" onClick={() => setScreen('settings')}>
          設定
        </button>
      </header>

      <section className="bg-[#000] px-4 pb-8 pt-8 text-white">
        <p className="text-[17px] text-white/70">{dayHint}</p>
        <h1 className="mt-1 text-[40px] font-semibold leading-[1.1] tracking-[-0.4px]">餘額</h1>
        <div className="mt-5">
          <LiquidGlass radius={28}>
            <div className="px-5 py-5 text-[#1d1d1f] shadow-[inset_0_1px_0_rgb(255_255_255_/_0.55)]">
              {state.balance == null ? (
                <p className="text-[28px] font-semibold">這個月還沒登記</p>
              ) : (
                <p className="text-[56px] font-semibold leading-[1.07] tracking-[-0.5px] tabular-nums">
                  ${formatMoney(state.balance)}
                </p>
              )}
              {state.balance != null && state.balance < 0 && (
                <p className="mt-2 text-sm text-[#0071e3]">餘額是負的，可能記錯或超支了。</p>
              )}
              <form className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]" onSubmit={onAdjust}>
                <input
                  className="h-11 rounded-[11px] border-[3px] border-black/5 bg-[#fafafc] px-3 text-[#1d1d1f]"
                  inputMode="decimal"
                  type="number"
                  step="1"
                  placeholder="輸入或直接改餘額"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  aria-label="設定餘額"
                />
                <button className="h-11 rounded-[8px] bg-[#0071e3] px-4 text-white" type="submit">
                  {state.balance == null ? '登記餘額' : '改餘額'}
                </button>
              </form>
            </div>
          </LiquidGlass>
        </div>
        <div className="mt-4">
          <ModeSwitch mode={state.mode} onChange={(mode) => patch({ mode })} />
        </div>
      </section>

      {advice && (
        <section className="grid gap-3 px-4 pt-5 sm:grid-cols-2">
          <AdviceCard
            title={state.mode === 'scarcity' ? '今天最多再花' : '今天至少還該花'}
            value={
              state.mode === 'scarcity'
                ? advice.remainingAllowance
                : advice.stillNeed
            }
            hint={
              weekendPaused
                ? '今天是週末，不列入平日分母；這是平日每日額度。'
                : state.mode === 'scarcity'
                  ? advice.overspent
                    ? '已經超過今日配額'
                    : `日均 ${formatMoney(advice.daily)}，今天已花 ${formatMoney(spentToday)}`
                  : advice.stillNeed === 0
                    ? '今日花不完目標已達標'
                    : `日均 ${formatMoney(advice.daily)}，今天已花 ${formatMoney(spentToday)}`
            }
            warn={state.mode === 'scarcity' && advice.overspent}
          />
          <AdviceCard
            title="平均每天"
            value={advice.daily}
            hint={`把餘額平攤到 ${daysLeft} 天${state.dayCountMode === 'weekdays' ? '平日' : ''}`}
          />
        </section>
      )}

      {conv && (
        <section className="mt-4 grid grid-cols-2 gap-3 px-4">
          <Ticket label="餘額還能吃" value={`${formatDays(conv.mealsLeft)} 餐`} />
          <Ticket label="餘額還能喝" value={`${formatDays(conv.drinksLeft)} 杯`} />
          <Ticket label="幾天湊一餐" value={`${formatDays(conv.daysPerMeal)} 天`} />
          <Ticket label="幾天湊一杯" value={`${formatDays(conv.daysPerDrink)} 天`} />
        </section>
      )}

      <section className="mt-6 px-4 pt-5">
        <h2 className="text-[28px] font-normal tracking-[0.2px]">菜單點餐</h2>
        <p className="mt-1 text-sm text-muted">
          已匯入目前填好的品項。餐食還很少，飲料比較齊；之後可再補 xlsx。
        </p>
        <div className="mt-3">
          <MenuPicker
            disabled={state.balance == null}
            defaultDrinkSize={state.defaultDrinkSize}
            onConfirm={(lines: TicketLine[], total: number) => {
              if (state.balance == null) return
              patch({ balance: applySpend(state.balance, total) })
              addEntry({
                id: newId(),
                at: new Date().toISOString(),
                type: 'spend',
                amount: total,
                note: lines.map((line) =>
                  line.size ? `${line.name} ${SIZE_LABEL[line.size]}` : line.name,
                ).join('、'),
                lines,
              })
              setNow(new Date())
            }}
          />
        </div>
      </section>

      <section className="mt-6 px-4 pt-5">
        <h2 className="text-[28px] font-normal tracking-[0.2px]">記一筆開銷</h2>
        <p className="mt-1 text-sm text-muted">
          菜單沒有的，或只想快速記金額。
        </p>
        <form className="mt-3 grid gap-2" onSubmit={onSpend}>
          <input
            className="h-11 rounded-[11px] border-[3px] border-black/5 bg-white px-3"
            inputMode="decimal"
            type="number"
            step="1"
            min="1"
            required
            placeholder="金額"
            value={spendAmount}
            onChange={(e) => setSpendAmount(e.target.value)}
            disabled={state.balance == null}
          />
          <input
            className="h-11 rounded-[11px] border-[3px] border-black/5 bg-white px-3"
            type="text"
            placeholder="備註（選填，例如午餐）"
            value={spendNote}
            onChange={(e) => setSpendNote(e.target.value)}
            disabled={state.balance == null}
          />
          <button
            className="h-11 rounded-[8px] bg-[#0071e3] text-white disabled:opacity-40"
            type="submit"
            disabled={state.balance == null}
          >
            扣掉這筆
          </button>
        </form>
      </section>

      <section className="mt-6 px-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[28px] font-normal tracking-[0.2px]">本月紀錄</h2>
          <button className="text-sm text-[#0066cc]" type="button" onClick={exportJson}>
            匯出 JSON
          </button>
        </div>
        {state.entries.length === 0 ? (
          <p className="mt-2 text-sm text-muted">還沒有紀錄。</p>
        ) : (
          <ul className="mt-3 divide-y divide-ink/10">
            {state.entries.map((entry) => (
              <li key={entry.id} className="flex items-baseline justify-between gap-3 py-2">
                <div>
                  <p className="text-sm">
                    {entry.type === 'spend' ? '開銷' : '調餘額'}
                    {entry.note ? ` · ${entry.note}` : ''}
                  </p>
                  <p className="text-xs text-muted">
                    {new Date(entry.at).toLocaleString('zh-TW', {
                      timeZone: 'Asia/Taipei',
                    })}
                  </p>
                </div>
                <p className="tabular-nums">
                  {entry.type === 'spend' ? '−' : '='}
                  {formatMoney(entry.amount)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8 px-4 pt-5">
        <h2 className="text-[28px] font-normal tracking-[0.2px]">建議回饋</h2>
        <p className="mt-1 text-sm text-muted">
          現在會開 GitHub Issue。獨立 Telegram bot 等你建好再接自動推播。
        </p>
        <textarea
          className="mt-3 min-h-24 w-full rounded-[12px] border border-black/10 bg-white p-3"
          placeholder="想改什麼、哪裡算錯、菜單漏了什麼…"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
        />
        <button
          className="mt-2 h-11 rounded-[980px] border border-[#0066cc] px-4 text-[#0066cc]"
          type="button"
          onClick={openFeedbackIssue}
        >
          開 GitHub Issue
        </button>
      </section>

      <p className="mt-8 text-center text-xs text-muted">
        資料只存在這個瀏覽器 · {monthKey(now)}
      </p>
    </div>
  )
}

function ModeSwitch({
  mode,
  onChange,
}: {
  mode: Mode
  onChange: (mode: Mode) => void
}) {
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-[980px] bg-white/15">
      <button
        type="button"
        className={`px-3 py-2 text-[13px] ${mode === 'scarcity' ? 'bg-white text-[#1d1d1f]' : 'text-white/80'}`}
        onClick={() => onChange('scarcity')}
      >
        怕花完
      </button>
      <button
        type="button"
        className={`px-3 py-2 text-[13px] ${mode === 'surplus' ? 'bg-white text-[#1d1d1f]' : 'text-white/80'}`}
        onClick={() => onChange('surplus')}
      >
        花不完
      </button>
    </div>
  )
}

function AdviceCard({
  title,
  value,
  hint,
  warn = false,
}: {
  title: string
  value: number
  hint: string
  warn?: boolean
}) {
  return (
    <div className={`rounded-[12px] bg-white p-4 ${warn ? 'outline outline-[#0071e3]' : ''}`}>
      <p className="text-xs text-muted">{title}</p>
      <p className={`mt-1 text-[28px] font-semibold tabular-nums ${warn ? 'text-[#0071e3]' : ''}`}>
        ${formatMoney(value)}
      </p>
      <p className="mt-2 text-xs text-muted">{hint}</p>
    </div>
  )
}

function Ticket({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] bg-white px-3 py-3">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="mt-1 text-[21px] font-semibold">{value}</p>
    </div>
  )
}
