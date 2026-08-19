import { describe, expect, it } from 'vitest'
import { createBackup, restoreBackup } from './backup.ts'
import { defaultPlanDraft, type PlanDraft } from './plan.ts'
import { defaultState } from './storage.ts'

const NOW = new Date('2026-08-20T12:00:00+08:00')

function samplePlan(): PlanDraft {
  return {
    ...defaultPlanDraft(NOW),
    eatenToday: { lunch: true, dinner: false },
    lines: [{ category: 'drink', name: '拿鐵咖啡', size: 'iced_m', qty: 2 }],
  }
}

describe('complete backup', () => {
  it('round-trips app state and planning draft together', () => {
    const state = {
      ...defaultState(NOW),
      balance: 1234,
      entries: [{ id: 'entry-1', at: NOW.toISOString(), type: 'spend' as const, amount: 60, note: 'backup test' }],
    }
    const raw = createBackup(state, samplePlan(), NOW)
    const restored = restoreBackup(raw, NOW)

    expect(restored.ok).toBe(true)
    if (!restored.ok) return
    expect(restored.state.balance).toBe(1234)
    expect(restored.state.monthKey).toBe('2026-08')
    expect(restored.state.entries).toHaveLength(1)
    expect(restored.state.habit.days.mon).toEqual({ lunch: true, dinner: true })
    expect(restored.plan.lines).toEqual(samplePlan().lines)
    expect(restored.plan.eatenToday).toEqual({ lunch: true, dinner: false })
    expect(restored.summary.balance).toBe(1234)
    expect(restored.summary.planLineCount).toBe(1)
  })

  it('rejects an unrelated JSON file', () => {
    const result = restoreBackup(JSON.stringify({ balance: 100 }), NOW)
    expect(result).toEqual({ ok: false, error: '這不是餐卡備份檔。' })
  })

  it('rejects an oversized backup before parsing', () => {
    const result = restoreBackup('x'.repeat(2_000_001), NOW)
    expect(result).toEqual({ ok: false, error: '備份檔太大，沒有套用。' })
  })

  it('rejects a backup with a malformed app object instead of filling defaults', () => {
    const envelope = JSON.parse(createBackup(defaultState(NOW), samplePlan(), NOW)) as Record<string, unknown>
    envelope.app = {}
    const result = restoreBackup(JSON.stringify(envelope), NOW)
    expect(result).toEqual({ ok: false, error: '備份檔結構不完整或資料已損壞。' })
  })

  it('rejects a backup from another month instead of silently rolling it over', () => {
    const result = restoreBackup(createBackup(defaultState(NOW), samplePlan(), NOW), new Date('2026-09-01T12:00:00+08:00'))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('備份月份不是目前的 2026-09')
  })

  it('rejects impossible plan dates and dates outside the plan month', () => {
    const impossible = JSON.parse(createBackup(defaultState(NOW), samplePlan(), NOW)) as Record<string, unknown>
    const impossiblePlan = impossible.plan as Record<string, unknown>
    impossiblePlan.dateKey = '2026-08-00'
    expect(restoreBackup(JSON.stringify(impossible), NOW).ok).toBe(false)

    const mismatched = JSON.parse(createBackup(defaultState(NOW), samplePlan(), NOW)) as Record<string, unknown>
    const mismatchedPlan = mismatched.plan as Record<string, unknown>
    mismatchedPlan.dateKey = '2026-09-01'
    expect(restoreBackup(JSON.stringify(mismatched), NOW).ok).toBe(false)
  })
})
