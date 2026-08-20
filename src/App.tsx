import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { PlanPage } from './PlanPage.tsx'
import { MenuPicker } from './MenuPicker.tsx'
import { SettingsPage } from './SettingsPage.tsx'
import { TurnstileWidget } from './TurnstileWidget.tsx'
import { createBackup, MAX_BACKUP_BYTES, restoreBackup, type ValidBackup } from './lib/backup.ts'
import { formatMoney } from './lib/format.ts'
import { SIZE_LABEL, type TicketLine } from './lib/menu.ts'
import {
  applyAdjust,
  applySpend,
  dailyAverage,
  todayAdvice,
  type Mode,
} from './lib/money.ts'
import {
  isTaipeiWeekday,
  millisecondsUntilNextTaipeiMidnight,
  monthKey,
  planningDays,
  taipeiParts,
} from './lib/month.ts'
import {
  leftoverOf,
  remainingDateList,
} from './lib/leftover.ts'
import { balanceReminderFor } from './lib/reminder.ts'
import {
  loadPlanDraft,
  necessaryTotalForPlan,
  parsePlanDraft,
  savePlanDraft,
} from './lib/plan.ts'
import {
  loadState,
  rolloverIfNeeded,
  saveState,
  spentOnTaipeiDay,
  type AppState,
  type LedgerEntry,
} from './lib/storage.ts'

const ISSUE_NEW = 'https://github.com/kudi68/Restaurant-Card/issues/new'
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() ?? ''

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
  const [planDraft, setPlanDraft] = useState(() => loadPlanDraft(new Date()))
  const [spendAmount, setSpendAmount] = useState('')
  const [spendNote, setSpendNote] = useState('')
  const [adjustAmount, setAdjustAmount] = useState('')
  const [feedback, setFeedback] = useState('')
  const [feedbackStatus, setFeedbackStatus] = useState('')
  const [feedbackKind, setFeedbackKind] = useState('一般建議')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileResetVersion, setTurnstileResetVersion] = useState(0)
  const [turnstileRetryVersion, setTurnstileRetryVersion] = useState(0)
  const [turnstileStatus, setTurnstileStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [storageWarning, setStorageWarning] = useState(false)
  const [backupPreview, setBackupPreview] = useState<ValidBackup | null>(null)
  const [backupStatus, setBackupStatus] = useState('')
  const backupReadVersion = useRef(0)
  const [screen, setScreen] = useState<'home' | 'plan' | 'settings'>('home')

  useEffect(() => {
    if (!saveState(state)) queueMicrotask(() => setStorageWarning(true))
  }, [state])

  useEffect(() => {
    if (!savePlanDraft(planDraft)) queueMicrotask(() => setStorageWarning(true))
  }, [planDraft])

  useEffect(() => {
    document.documentElement.dataset.theme = state.appearance
  }, [state.appearance])

  useEffect(() => {
    let midnightTimer = 0
    const sync = () => {
      const next = new Date()
      setNow(next)
      setState((prev) => rolloverIfNeeded(prev, next))
      setPlanDraft((prev) => parsePlanDraft(JSON.stringify(prev), next))
    }
    const scheduleMidnight = () => {
      window.clearTimeout(midnightTimer)
      midnightTimer = window.setTimeout(() => {
        sync()
        scheduleMidnight()
      }, millisecondsUntilNextTaipeiMidnight(new Date()))
    }
    const syncWhenVisible = () => {
      if (document.visibilityState === 'visible') sync()
    }
    window.addEventListener('focus', sync)
    document.addEventListener('visibilitychange', syncWhenVisible)
    scheduleMidnight()
    return () => {
      window.clearTimeout(midnightTimer)
      window.removeEventListener('focus', sync)
      document.removeEventListener('visibilitychange', syncWhenVisible)
    }
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
  const balanceReminder = useMemo(
    () => balanceReminderFor(state.entries, now),
    [state.entries, now],
  )
  const leftover = useMemo(() => {
    if (state.balance == null) return null
    const dates = remainingDateList({
      now,
      mode: 'calendar',
      customDays: 31,
    })
    return leftoverOf(state.balance, necessaryTotalForPlan(state.habit, dates, {
      dateKey: planDraft.dateKey,
      ...planDraft.eatenToday,
    }))
  }, [state.balance, state.habit, planDraft.dateKey, planDraft.eatenToday, now])

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

  function downloadText(content: string, filename: string) {
    const blob = new Blob([content], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportBackup() {
    downloadText(createBackup(state, planDraft, new Date()), `restaurant-card-backup-${state.monthKey}.json`)
    setBackupStatus('已匯出完整備份（包含餐卡與規劃購物車）')
  }

  async function previewBackup(file: File | undefined) {
    if (!file) return
    const readVersion = backupReadVersion.current + 1
    backupReadVersion.current = readVersion
    if (file.size > MAX_BACKUP_BYTES) {
      setBackupPreview(null)
      setBackupStatus('備份檔太大，沒有套用。')
      return
    }
    let raw: string
    try {
      raw = await file.text()
    } catch {
      if (readVersion === backupReadVersion.current) {
        setBackupPreview(null)
        setBackupStatus('讀取備份檔失敗，沒有修改目前資料。')
      }
      return
    }
    if (readVersion !== backupReadVersion.current) return
    const result = restoreBackup(raw, new Date())
    if (!result.ok) {
      setBackupPreview(null)
      setBackupStatus(result.error)
      return
    }
    setBackupPreview(result)
    setBackupStatus('已讀取備份，請確認內容後再覆蓋目前資料')
  }

  function confirmBackupRestore() {
    if (!backupPreview) return
    const currentMonth = monthKey(new Date())
    if (backupPreview.state.monthKey !== currentMonth || backupPreview.plan.monthKey !== currentMonth) {
      setBackupPreview(null)
      setBackupStatus(`備份月份不是目前的 ${currentMonth}，為避免靜默清除資料，沒有套用。`)
      return
    }
    downloadText(createBackup(state, planDraft, new Date()), `restaurant-card-before-restore-${state.monthKey}.json`)
    setState(backupPreview.state)
    setPlanDraft(backupPreview.plan)
    setBackupPreview(null)
    setBackupStatus('已還原備份；覆蓋前的原資料也已先下載')
  }

  async function sendTelegramFeedback() {
    const message = feedback.trim()
    if (!message) {
      setFeedbackStatus('先寫一點內容')
      return
    }
    if (!turnstileToken) {
      setFeedbackStatus('請先完成防機器人驗證')
      return
    }
    setFeedbackStatus('送出中…')
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: `【${feedbackKind}】\n${message}\n月份：${state.monthKey}\n模式：${state.mode}`,
          turnstileToken,
          requestId: crypto.randomUUID(),
        }),
      })
      const data = (await response.json()) as { ok?: boolean; error?: string }
      if (!response.ok || !data.ok) {
        setFeedbackStatus(
          data.error === 'verification_failed'
            ? '驗證已過期，請重新完成防機器人驗證'
            : data.error === 'telegram_delivery_unknown'
              ? 'Telegram 送達狀態未知；請先查看 Telegram，若要重送請重新完成驗證'
            : data.error === 'telegram_failed'
              ? 'Telegram 暫時無法接收，請稍後再試或改開 GitHub Issue'
            : '現在送不到 Telegram，請改開 GitHub Issue',
        )
        return
      }
      setFeedback('')
      setFeedbackStatus('已送到 Telegram')
    } catch {
      setFeedbackStatus('送達狀態未知；請先查看 Telegram，若要重送請重新完成驗證')
    } finally {
      setTurnstileToken('')
      setTurnstileResetVersion((version) => version + 1)
    }
  }

  const onTurnstileToken = useCallback((token: string) => {
    setTurnstileToken(token)
    if (token) setFeedbackStatus('')
  }, [])

  const onTurnstileStatus = useCallback((status: 'loading' | 'ready' | 'error') => {
    setTurnstileStatus(status)
  }, [])

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
      <>
        <SettingsPage
          state={state}
          now={now}
          onChange={patch}
          onBack={() => setScreen('home')}
          onExportBackup={exportBackup}
          onPreviewBackup={previewBackup}
          backupPreview={backupPreview}
          backupStatus={backupStatus}
          onConfirmBackupRestore={confirmBackupRestore}
          onCancelBackupRestore={() => setBackupPreview(null)}
        />
        <AppNav screen={screen} onChange={setScreen} />
      </>
    )
  }

  if (screen === 'plan') {
    return (
      <>
        <PlanPage state={state} now={now} draft={planDraft} onDraftChange={setPlanDraft} />
        <AppNav screen={screen} onChange={setScreen} />
      </>
    )
  }

  return (
    <div className="pb-24">
      <header className="sticky top-0 z-20 flex h-12 items-center justify-between px-4 text-xs text-[var(--nav-fg)] [background:var(--nav-bg)] [backdrop-filter:saturate(180%)_blur(20px)]">
        <span>餐卡</span>
        <span>
          {monthLabel(state.monthKey)} · {parts.month}/{parts.day}
        </span>
        <span />
      </header>

      {state.balance != null && balanceReminder && (
        <section className="mx-4 mt-3 flex items-center justify-between gap-3 rounded-[12px] bg-[var(--surface)] p-3 text-sm ring-1 ring-[var(--accent)]">
          <p>⏰ 上次記錄餘額已是 <strong>{balanceReminder.days} 天前</strong>，現在餘額可能需要更新。</p>
          <button type="button" className="shrink-0 text-[var(--accent-2)] underline" onClick={() => document.getElementById('balance-input')?.focus()}>重新登記</button>
        </section>
      )}

      <section className="px-4 pb-6 pt-10 text-center">
        <p className="text-[17px] text-[var(--muted)]">{dayHint}</p>
        <h1 className="mt-1 text-[40px] font-semibold leading-[1.1] tracking-[-0.4px]">餘額</h1>
        {state.balance == null ? (
          <p className="mt-3 text-[28px] font-semibold">這個月還沒登記</p>
        ) : (
          <p className="mt-2 text-[56px] font-semibold leading-[1.07] tracking-[-0.5px] tabular-nums">
            ${formatMoney(state.balance)}
          </p>
        )}
        {state.balance != null && state.balance < 0 && (
          <p className="mt-2 text-sm text-[var(--accent)]">餘額是負的，可能記錯或超支了。</p>
        )}
        <form className="mx-auto mt-5 grid max-w-md gap-2 sm:grid-cols-[1fr_auto]" onSubmit={onAdjust}>
          <input
            id="balance-input"
            className="h-11 rounded-[11px] border-[3px] border-[var(--line)] bg-[var(--surface)] px-3 text-left text-[var(--fg)]"
            inputMode="decimal"
            type="number"
            step="1"
            placeholder="輸入或直接改餘額"
            value={adjustAmount}
            onChange={(e) => setAdjustAmount(e.target.value)}
            aria-label="設定餘額"
          />
          <button className="h-11 rounded-[980px] bg-[var(--accent)] px-4 text-white" type="submit">
            {state.balance == null ? '登記餘額' : '改餘額'}
          </button>
        </form>
        <div className="mx-auto mt-4 max-w-xs">
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

      {leftover != null && (
        <section className="mt-4 px-4">
          <button
            type="button"
            className="w-full rounded-[16px] bg-[var(--surface)] p-4 text-left"
            onClick={() => setScreen('plan')}
          >
            <p className="text-xs text-muted">扣掉必要餐費後剩下</p>
            <p className="text-[36px] font-semibold tabular-nums">${formatMoney(leftover)}</p>
            <p className="mt-1 text-sm text-[var(--accent-2)]">去規劃怎麼用 →</p>
          </button>
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
            className="h-11 rounded-[11px] border-[3px] border-[var(--line)] bg-[var(--surface)] px-3"
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
            className="h-11 rounded-[11px] border-[3px] border-[var(--line)] bg-[var(--surface)] px-3"
            type="text"
            placeholder="備註（選填，例如午餐）"
            value={spendNote}
            onChange={(e) => setSpendNote(e.target.value)}
            disabled={state.balance == null}
          />
          <button
            className="h-11 rounded-[980px] bg-[var(--accent)] text-white disabled:opacity-40"
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
          <button className="text-sm text-[var(--accent-2)]" type="button" onClick={exportBackup}>
            匯出完整備份
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
          建議會送到 Telegram。選類別可以讓我比較快處理。
        </p>
        <select
          className="mt-3 h-11 w-full rounded-[11px] border-[3px] border-[var(--line)] bg-[var(--surface)] px-3"
          value={feedbackKind}
          onChange={(event) => setFeedbackKind(event.target.value)}
        >
          <option>一般建議</option>
          <option>新增菜單</option>
          <option>變更價格</option>
          <option>品項賣完</option>
        </select>
        <textarea
          className="mt-3 min-h-24 w-full rounded-[12px] border border-[var(--line)] bg-[var(--surface)] p-3"
          placeholder="想改什麼、哪裡算錯、菜單漏了什麼…"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
        />
        {TURNSTILE_SITE_KEY ? (
          <TurnstileWidget
            siteKey={TURNSTILE_SITE_KEY}
            theme={state.appearance}
            resetVersion={turnstileResetVersion}
            retryVersion={turnstileRetryVersion}
            onToken={onTurnstileToken}
            onStatus={onTurnstileStatus}
          />
        ) : (
          <p className="mt-2 text-sm text-muted">此備用站不提供 Telegram 回饋，請改用 GitHub Issue。</p>
        )}
        {TURNSTILE_SITE_KEY && turnstileStatus === 'error' && (
          <button type="button" className="mt-2 text-sm text-[var(--accent-2)] underline" onClick={() => { setTurnstileToken(''); setTurnstileRetryVersion((version) => version + 1) }}>
            重新載入防機器人驗證
          </button>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          {TURNSTILE_SITE_KEY && (
            <button
              className="h-11 rounded-[980px] bg-[var(--accent)] px-4 text-white disabled:opacity-40"
              type="button"
              disabled={!turnstileToken}
              onClick={() => void sendTelegramFeedback()}
            >
              送到 Telegram
            </button>
          )}
          <button
            className="h-11 rounded-[980px] border border-[var(--accent-2)] px-4 text-[var(--accent-2)]"
            type="button"
            onClick={openFeedbackIssue}
          >
            開 GitHub Issue
          </button>
        </div>
        {feedbackStatus && <p className="mt-2 text-sm text-muted">{feedbackStatus}</p>}
      </section>

      <p className="mt-8 text-center text-xs text-muted">
        資料只存在這個瀏覽器 · {monthKey(now)}
      </p>
      {storageWarning && <p className="mx-4 mt-2 text-center text-sm text-[var(--accent)]">瀏覽器目前無法儲存資料；重新整理前請先不要關閉頁面。</p>}
      <AppNav screen={screen} onChange={setScreen} />
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
    <div className="grid grid-cols-2 overflow-hidden rounded-[980px] bg-[var(--mode-track)]">
      <button
        type="button"
        className={`px-3 py-2 text-[13px] ${mode === 'scarcity' ? 'bg-[var(--mode-on-bg)] text-[var(--mode-on-fg)]' : 'text-[var(--mode-off)]'}`}
        onClick={() => onChange('scarcity')}
      >
        怕花完
      </button>
      <button
        type="button"
        className={`px-3 py-2 text-[13px] ${mode === 'surplus' ? 'bg-[var(--mode-on-bg)] text-[var(--mode-on-fg)]' : 'text-[var(--mode-off)]'}`}
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
    <div className={`rounded-[12px] bg-[var(--surface)] p-4 ${warn ? 'outline outline-[var(--accent)]' : ''}`}>
      <p className="text-xs text-muted">{title}</p>
      <p className={`mt-1 text-[28px] font-semibold tabular-nums ${warn ? 'text-[var(--accent)]' : ''}`}>
        ${formatMoney(value)}
      </p>
      <p className="mt-2 text-xs text-muted">{hint}</p>
    </div>
  )
}

function AppNav({
  screen,
  onChange,
}: {
  screen: 'home' | 'plan' | 'settings'
  onChange: (screen: 'home' | 'plan' | 'settings') => void
}) {
  const items = [
    { id: 'home' as const, label: '餐卡' },
    { id: 'plan' as const, label: '規劃' },
    { id: 'settings' as const, label: '設定' },
  ]
  return (
    <nav className="fixed bottom-0 left-1/2 z-30 w-full max-w-[44rem] -translate-x-1/2 border-t border-[var(--line)] bg-[var(--nav-bg)] [backdrop-filter:saturate(180%)_blur(20px)]">
      <div className="grid grid-cols-3">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`h-14 text-sm ${screen === item.id ? 'font-semibold text-[var(--accent)]' : 'text-[var(--muted)]'}`}
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  )
}

