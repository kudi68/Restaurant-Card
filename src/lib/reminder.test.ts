import { describe, expect, it } from 'vitest'
import { latestBalanceRecord, balanceReminderFor } from './reminder.ts'
import type { LedgerEntry } from './storage.ts'

const adjust = (at: string, amount = 100): LedgerEntry => ({
  id: at,
  at,
  type: 'adjust',
  amount,
  note: '手動設定餘額',
})

describe('balance reminder', () => {
  const now = new Date('2026-08-20T12:00:00+08:00')

  it('finds the latest valid manual balance record', () => {
    const entries = [
      adjust('2026-08-10T04:00:00.000Z'),
      adjust('2026-08-18T04:00:00.000Z'),
      { id: 'bad', at: 'not a date', type: 'adjust' as const, amount: 1 },
    ]
    expect(latestBalanceRecord(entries)?.at).toBe('2026-08-18T04:00:00.000Z')
  })

  it('does not remind before the threshold', () => {
    expect(balanceReminderFor([adjust('2026-08-18T04:00:00.000Z')], now, 3)).toBeNull()
    expect(balanceReminderFor([adjust('2026-08-19T04:00:00.000Z')], now, 3)).toBeNull()
  })

  it('reminds after three Taipei calendar days', () => {
    expect(balanceReminderFor([adjust('2026-08-16T04:00:00.000Z')], now, 3)).toEqual({ days: 4 })
  })

  it('ignores future records and empty entries', () => {
    expect(balanceReminderFor([], now, 3)).toBeNull()
    expect(balanceReminderFor([adjust('2026-08-21T04:00:00.000Z')], now, 3)).toBeNull()
  })
})
