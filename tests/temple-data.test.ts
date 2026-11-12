import { describe, expect, it } from 'vitest'
import { TempleStore } from '../src/game/temple-data'

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) } }

describe('temple data', () => {
  it('allows one daily lot per local day', () => {
    const s = new TempleStore(mem())
    const a = s.drawDailyLot(new Date(2026, 10, 12, 9))
    const b = s.drawDailyLot(new Date(2026, 10, 12, 22))
    expect(a.fresh).toBe(true)
    expect(b.fresh).toBe(false)
    expect(b.lot.number).toBe(a.lot.number)
    expect(s.drawDailyLot(new Date(2026, 10, 13, 8)).fresh).toBe(true)
  })
  it('persists wishes, lamps, offerings and records', () => {
    const storage = mem()
    const s = new TempleStore(storage)
    expect(s.submitWish('  ')).toBeNull()
    s.submitWish('願家人平安')
    expect(s.lightLamp('peace')).toBe(true)
    expect(s.lightLamp('peace')).toBe(false)
    s.offer('tea'); s.tossCoin(); s.ringBell(); s.tapWoodfish(); s.offerIncense()
    const r = new TempleStore(storage)
    expect(r.data.wishes[0].text).toBe('願家人平安')
    expect(r.data.lamps.peace).toBe(true)
    expect(r.data.offerings.tea).toBe(1)
    expect(r.data.coins).toBe(1)
    expect(r.data.records.length).toBe(7)
  })
  it('recovers from corrupt storage', () => {
    const storage = mem(); storage.setItem('yuhuang.temple.v1', '{bad')
    expect(new TempleStore(storage).data.wishes).toEqual([])
  })
})
