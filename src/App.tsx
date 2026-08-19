import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { MenuPicker } from './MenuPicker.tsx'
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
import { monthKey, remainingDays, taipeiParts } from './lib/month.ts'
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

  const daysLeft = remainingDays(now)
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

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-6 flex items-end justify-between gap-3 border-b-2 border-dashed border-ink/20 pb-4">
        <div>
          <p className="text-xs tracking-[0.35em] text-stamp">MEAL TICKET</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
            餐卡
          </h1>
          <p className="mt-1 text-sm text-muted">
            {monthLabel(state.monthKey)} · 今天 {parts.month}/{parts.day} · 還有{' '}
            {daysLeft} 天
          </p>
        </div>
        <ModeSwitch
          mode={state.mode}
          onChange={(mode) => patch({ mode })}
        />
      </header>

      <section className="rounded-sm bg-ticket p-5 shadow-[6px_6px_0_0_rgb(27_20_12_/_0.12)] ring-1 ring-ink/15">
        <p className="text-xs tracking-widest text-muted">目前餘額</p>
        {state.balance == null ? (
          <p className="mt-2 font-display text-2xl">這個月還沒登記</p>
        ) : (
          <p className="mt-1 font-display text-5xl leading-none tabular-nums">
            ${formatMoney(state.balance)}
          </p>
        )}
        {state.balance != null && state.balance < 0 && (
          <p className="mt-2 text-sm text-stamp">餘額是負的，可能記錯或超支了。</p>
        )}

        <form className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]" onSubmit={onAdjust}>
          <input
            className="h-11 rounded-sm border border-ink/20 bg-paper px-3"
            inputMode="decimal"
            type="number"
            step="1"
            placeholder="輸入或直接改餘額"
            value={adjustAmount}
            onChange={(e) => setAdjustAmount(e.target.value)}
            aria-label="設定餘額"
          />
          <button
            className="h-11 bg-ink px-4 text-paper"
            type="submit"
          >
            {state.balance == null ? '登記餘額' : '改餘額'}
          </button>
        </form>
      </section>

      {advice && (
        <section className="mt-4 grid gap-3 sm:grid-cols-2">
          <AdviceCard
            title={state.mode === 'scarcity' ? '今天最多再花' : '今天至少還該花'}
            value={
              state.mode === 'scarcity'
                ? advice.remainingAllowance
                : advice.stillNeed
            }
            hint={
              state.mode === 'scarcity'
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
            hint={`把餘額平攤到含今天的 ${daysLeft} 天`}
          />
        </section>
      )}

      {conv && (
        <section className="mt-4 grid grid-cols-2 gap-3">
          <Ticket label="餘額還能吃" value={`${formatDays(conv.mealsLeft)} 餐`} />
          <Ticket label="餘額還能喝" value={`${formatDays(conv.drinksLeft)} 杯`} />
          <Ticket label="幾天湊一餐" value={`${formatDays(conv.daysPerMeal)} 天`} />
          <Ticket label="幾天湊一杯" value={`${formatDays(conv.daysPerDrink)} 天`} />
        </section>
      )}

      <section className="mt-6 border-t border-ink/15 pt-5">
        <h2 className="font-display text-xl">菜單點餐</h2>
        <p className="mt-1 text-sm text-muted">
          已匯入目前填好的品項。餐食還很少，飲料比較齊；之後可再補 xlsx。
        </p>
        <div className="mt-3">
          <MenuPicker
            disabled={state.balance == null}
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

      <section className="mt-6 border-t border-ink/15 pt-5">
        <h2 className="font-display text-xl">記一筆開銷</h2>
        <p className="mt-1 text-sm text-muted">
          菜單沒有的，或只想快速記金額。
        </p>
        <form className="mt-3 grid gap-2" onSubmit={onSpend}>
          <input
            className="h-11 rounded-sm border border-ink/20 bg-ticket px-3"
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
            className="h-11 rounded-sm border border-ink/20 bg-ticket px-3"
            type="text"
            placeholder="備註（選填，例如午餐）"
            value={spendNote}
            onChange={(e) => setSpendNote(e.target.value)}
            disabled={state.balance == null}
          />
          <button
            className="h-11 bg-stamp text-paper disabled:opacity-40"
            type="submit"
            disabled={state.balance == null}
          >
            扣掉這筆
          </button>
        </form>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          一餐怎麼算
          <input
            className="mt-1 h-11 w-full rounded-sm border border-ink/20 bg-ticket px-3"
            type="number"
            min="1"
            value={state.mealUnitPrice}
            onChange={(e) =>
              patch({ mealUnitPrice: Number(e.target.value) || 0 })
            }
          />
        </label>
        <label className="block text-sm">
          一杯怎麼算
          <input
            className="mt-1 h-11 w-full rounded-sm border border-ink/20 bg-ticket px-3"
            type="number"
            min="1"
            value={state.drinkUnitPrice}
            onChange={(e) =>
              patch({ drinkUnitPrice: Number(e.target.value) || 0 })
            }
          />
        </label>
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl">本月紀錄</h2>
          <button className="text-sm underline" type="button" onClick={exportJson}>
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

      <section className="mt-8 border-t border-ink/15 pt-5">
        <h2 className="font-display text-xl">建議回饋</h2>
        <p className="mt-1 text-sm text-muted">
          現在會開 GitHub Issue。獨立 Telegram bot 等你建好再接自動推播。
        </p>
        <textarea
          className="mt-3 min-h-24 w-full rounded-sm border border-ink/20 bg-ticket p-3"
          placeholder="想改什麼、哪裡算錯、菜單漏了什麼…"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
        />
        <button
          className="mt-2 h-11 bg-olive px-4 text-paper"
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
    <div className="grid grid-cols-2 overflow-hidden rounded-sm ring-1 ring-ink/20">
      <button
        type="button"
        className={`px-3 py-2 text-xs ${mode === 'scarcity' ? 'bg-stamp text-paper' : 'bg-ticket'}`}
        onClick={() => onChange('scarcity')}
      >
        怕花完
      </button>
      <button
        type="button"
        className={`px-3 py-2 text-xs ${mode === 'surplus' ? 'bg-olive text-paper' : 'bg-ticket'}`}
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
    <div className={`bg-ticket p-4 ring-1 ${warn ? 'ring-stamp' : 'ring-ink/15'}`}>
      <p className="text-xs text-muted">{title}</p>
      <p className={`mt-1 font-display text-3xl tabular-nums ${warn ? 'text-stamp' : ''}`}>
        ${formatMoney(value)}
      </p>
      <p className="mt-2 text-xs text-muted">{hint}</p>
    </div>
  )
}

function Ticket({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-dashed border-ink/30 bg-ticket px-3 py-3">
      <p className="text-[11px] tracking-wider text-muted">{label}</p>
      <p className="mt-1 font-display text-xl">{value}</p>
    </div>
  )
}
