import { describe, expect, it } from 'vitest'
import { defaultState, parseState, rolloverIfNeeded, spentOnTaipeiDay } from './storage.ts'

const AUG = new Date('2026-08-19T12:00:00+08:00')
const SEP = new Date('2026-09-01T00:00:00+08:00')

describe('parseState', () => {
  it('returns a fresh August state when storage is empty', () => {
    const state = parseState(null, AUG)
    expect(state.version).toBe(2)
    expect(state.monthKey).toBe('2026-08')
    expect(state.balance).toBeNull()
    expect(state.mode).toBe('scarcity')
    expect(state.entries).toEqual([])
  })

  it('fills new settings defaults without wiping an old saved balance', () => {
    const raw = JSON.stringify({
      version: 1,
      mode: 'surplus',
      balance: 1300,
      monthKey: '2026-08',
      mealUnitPrice: 120,
      drinkUnitPrice: 55,
      entries: [],
      history: {},
    })
    const state = parseState(raw, AUG)
    expect(state.balance).toBe(1300)
    expect(state.mode).toBe('surplus')
    expect(state.dayCountMode).toBe('calendar')
    expect(state.customRemainingDays).toBe(13)
    expect(state.defaultDrinkSize).toBe('iced_m')
    expect(state.appearance).toBe('light')
  })

  it('migrates the v1 weekday and weekend meal flags into a seven-day schedule', () => {
    const raw = JSON.stringify({
      version: 1,
      balance: 1300,
      monthKey: '2026-08',
      habit: {
        weekdayLunch: true,
        weekdayDinner: false,
        weekendLunch: false,
        weekendDinner: true,
        lunchPrice: 70,
        dinnerPrice: 90,
      },
      entries: [],
      history: {},
    })

    const state = parseState(raw, AUG)

    expect(state.version).toBe(2)
    expect(state.balance).toBe(1300)
    expect(state.habit.days.mon).toEqual({ lunch: true, dinner: false })
    expect(state.habit.days.sat).toEqual({ lunch: false, dinner: true })
    expect(state.habit.lunchPrice).toBe(70)
    expect(state.habit.dinnerPrice).toBe(90)
  })

  it('returns a fresh state when JSON is corrupt', () => {
    const state = parseState('{not json', AUG)
    expect(state.monthKey).toBe('2026-08')
    expect(state.balance).toBeNull()
  })

  it('keeps valid balance and entries when a damaged month key is normalized', () => {
    const state = parseState(JSON.stringify({
      version: 1,
      balance: 500,
      monthKey: 'broken',
      entries: [{ id: 'a', at: '2026-08-19T03:00:00.000Z', type: 'spend', amount: 60 }],
      history: {},
    }), AUG)
    expect(state.monthKey).toBe('2026-08')
    expect(state.balance).toBe(500)
    expect(state.entries).toHaveLength(1)
  })
})

describe('rolloverIfNeeded', () => {
  it('archives August entries and clears balance on September 1', () => {
    const before = {
      ...defaultState(AUG),
      balance: 200,
      entries: [
        {
          id: 'a',
          at: '2026-08-19T03:00:00.000Z',
          type: 'spend' as const,
          amount: 80,
        },
      ],
    }
    const next = rolloverIfNeeded(before, SEP)
    expect(next.monthKey).toBe('2026-09')
    expect(next.balance).toBeNull()
    expect(next.entries).toEqual([])
    expect(next.history['2026-08']).toHaveLength(1)
  })

  it('does not rollover within the same month', () => {
    const state = { ...defaultState(AUG), balance: 500 }
    expect(rolloverIfNeeded(state, AUG)).toBe(state)
  })
})

describe('spentOnTaipeiDay', () => {
  it('sums spend entries on that Taipei calendar day', () => {
    const entries = [
      { id: '1', at: '2026-08-19T01:00:00+08:00', type: 'spend' as const, amount: 40 },
      { id: '2', at: '2026-08-19T22:00:00+08:00', type: 'spend' as const, amount: 30 },
      { id: '3', at: '2026-08-18T23:00:00+08:00', type: 'spend' as const, amount: 99 },
      { id: '4', at: '2026-08-19T12:00:00+08:00', type: 'adjust' as const, amount: 1000 },
    ]
    expect(spentOnTaipeiDay(entries, AUG)).toBe(70)
  })
})
