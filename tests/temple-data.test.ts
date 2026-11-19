import { describe, expect, it } from 'vitest'
import {
  MAX_RECORDS,
  TEMPLE_STORAGE_KEY,
  TempleStore,
  exportTempleBackupJson,
  formatCrossGuaShareText,
  formatRecordsAsText,
} from '../src/game/temple-data'
import { drawCrossSlots, evaluateCrossGua, getPieceById } from '../src/divination'

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
    s.addRecord('天燈祈福', '於天心仙姑問事亭前點燃祈福天燈，祈願天心指路、福慧圓滿')
    const r = new TempleStore(storage)
    expect(r.data.wishes[0].text).toBe('願家人平安')
    expect(r.data.lamps.peace).toBe(true)
    expect(r.data.offerings.tea).toBe(1)
    expect(r.data.coins).toBe(1)
    expect(r.data.records.length).toBe(8)
    expect(r.data.records[0].action).toBe('天燈祈福')
  })
  it('recovers from corrupt storage', () => {
    const storage = mem(); storage.setItem('yuhuang.temple.v1', '{bad')
    expect(new TempleStore(storage).data.wishes).toEqual([])
  })
  it('formats cross gua share text for LINE consultation', () => {
    const slots = drawCrossSlots([
      getPieceById(0),  // 中: 紅帥
      getPieceById(21), // 左: 黑車
      getPieceById(23), // 右: 黑馬
      getPieceById(25), // 上: 黑包
      getPieceById(17), // 下: 黑士
    ])
    Object.values(slots).forEach(s => { s.revealed = true })
    const gua = evaluateCrossGua(slots)
    const text = formatCrossGuaShareText(gua)
    expect(text).toContain('【天心仙姑・象棋卜卦結果】')
    expect(text).toContain('上：黑包')
    expect(text).toContain('左：黑車　中：紅帥　右：黑馬')
    expect(text).toContain('下：黑士')
    expect(text).toContain('收獲：125 分 > 付出：0 分')
    expect(text).toContain('事業格')
    expect(text).toContain('眾星拱月格')
  })
  it('exports records as readable text and valid JSON backup', () => {
    const s = new TempleStore(mem())
    s.addRecord('象棋神卦', '【事業格】大吉｜收獲125 > 付出0', Date.UTC(2026, 10, 19, 7, 30))
    const txt = formatRecordsAsText(s.data.records, new Date(Date.UTC(2026, 10, 19, 8, 0)))
    expect(txt).toContain('紀錄筆數：1 筆')
    expect(txt).toContain(`最多保留 ${MAX_RECORDS} 筆`)
    expect(txt).toContain('象棋神卦：【事業格】大吉')

    const json = exportTempleBackupJson(s.data, new Date(Date.UTC(2026, 10, 19, 8, 0)))
    const parsed = JSON.parse(json)
    expect(parsed.storageKey).toBe(TEMPLE_STORAGE_KEY)
    expect(parsed.maxRecords).toBe(MAX_RECORDS)
    expect(parsed.data.records[0].action).toBe('象棋神卦')
  })
  it('preserves full multi-formation divination record detail beyond 120 chars across reload', () => {
    const storage = mem()
    const s = new TempleStore(storage)
    const longDetail = '【好朋友格、勝利格（內在）、桃花格（偏桃花）、眾星拱月格】大吉｜收獲92 > 付出0｜中[紅帥] 上[黑車] 下[黑包] 左[黑將] 右[黑士]｜心法：本卦收獲 92 分 > 付出 0 分。卦中逢好朋友格，得貴人互助協調，力量減半包容。卦現護身之象，紅方受庇佑免於折損。請依循當下心念，穩健應對。'
    expect(longDetail.length).toBeGreaterThan(120)
    s.addRecord('象棋神卦', longDetail)
    const reloaded = new TempleStore(storage)
    expect(reloaded.data.records[0].detail).toBe(longDetail)
  })
})
