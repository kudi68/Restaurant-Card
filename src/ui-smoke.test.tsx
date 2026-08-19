// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'
import { monthKey } from './lib/month.ts'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement | null = null

function button(label: string): HTMLButtonElement {
  const found = Array.from(container?.querySelectorAll('button') ?? [])
    .find((element) => element.textContent?.trim() === label)
  if (!found) throw new Error(`button not found: ${label}`)
  return found
}

afterEach(() => {
  vi.useRealTimers()
  container?.remove()
  container = null
  localStorage.clear()
})

describe('App navigation smoke test', () => {
  it('opens the seven-day settings and the simulation cart', async () => {
    localStorage.setItem('restaurant-card:v1', JSON.stringify({
      version: 1,
      balance: 1000,
      monthKey: monthKey(new Date()),
      entries: [],
      history: {},
    }))
    container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => root.render(<App />))

    await act(async () => button('設定').click())
    expect(container.textContent).toContain('每週打算吃哪些餐')
    expect(container.textContent).toContain('資料備份')
    expect(container.textContent).toContain('匯出完整備份')
    expect(container.querySelector('[aria-label="星期一午餐"]')).not.toBeNull()
    expect(container.querySelector('[aria-label="星期日晚餐"]')).not.toBeNull()

    await act(async () => button('規劃').click())
    expect(container.textContent).toContain('試算購物車')
    expect(container.textContent).toContain('若照購物車買，月底還剩')

    const before = JSON.parse(localStorage.getItem('restaurant-card:v1') ?? '{}') as { balance?: number; entries?: unknown[] }
    await act(async () => {
      const addButton = Array.from(container?.querySelectorAll('button') ?? [])
        .find((element) => {
          const label = element.textContent?.trim() ?? ''
          return label.startsWith('加入試算') || label.startsWith('仍要加入')
        })
      if (!addButton) throw new Error('add cart button not found')
      addButton.click()
    })
    const after = JSON.parse(localStorage.getItem('restaurant-card:v1') ?? '{}') as { balance?: number; entries?: unknown[] }
    expect(after.balance).toBe(before.balance)
    expect(after.entries).toEqual(before.entries)
    await act(async () => button('復原').click())
    const restoredPlan = JSON.parse(localStorage.getItem('restaurant-card:plan:v1') ?? '{}') as { lines?: unknown[] }
    expect(restoredPlan.lines).toEqual([])

    await act(async () => {
      const addButton = Array.from(container?.querySelectorAll('button') ?? [])
        .find((element) => (element.textContent?.trim() ?? '').startsWith('加入試算') || (element.textContent?.trim() ?? '').startsWith('仍要加入'))
      if (!addButton) throw new Error('second add cart button not found')
      addButton.click()
    })
    const eatenCheckbox = container?.querySelector('input[type="checkbox"]') as HTMLInputElement | null
    if (!eatenCheckbox || eatenCheckbox.disabled) throw new Error('eaten checkbox not available')
    await act(async () => eatenCheckbox.click())
    expect(Array.from(container?.querySelectorAll('button') ?? []).some((element) => element.textContent?.trim() === '復原')).toBe(false)

    await act(async () => root.unmount())
  })

  it('rolls app and plan state at Taipei midnight without a focus event', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-31T23:59:59+08:00'))
    localStorage.setItem('restaurant-card:v1', JSON.stringify({
      version: 1,
      balance: 500,
      monthKey: '2026-08',
      entries: [],
      history: {},
    }))
    localStorage.setItem('restaurant-card:plan:v1', JSON.stringify({
      version: 1,
      monthKey: '2026-08',
      dateKey: '2026-08-31',
      eatenToday: { lunch: true, dinner: true },
      lines: [{ category: 'drink', name: '拿鐵咖啡', size: 'iced_m', qty: 2 }],
    }))
    container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => root.render(<App />))

    await act(async () => {
      vi.advanceTimersByTime(1000)
      await Promise.resolve()
    })

    const app = JSON.parse(localStorage.getItem('restaurant-card:v1') ?? '{}') as Record<string, unknown>
    const plan = JSON.parse(localStorage.getItem('restaurant-card:plan:v1') ?? '{}') as Record<string, unknown>
    expect(app.monthKey).toBe('2026-09')
    expect(app.balance).toBeNull()
    expect(plan.monthKey).toBe('2026-09')
    expect(plan.lines).toEqual([])
    expect(plan.eatenToday).toEqual({ lunch: false, dinner: false })

    await act(async () => root.unmount())
  })
})
