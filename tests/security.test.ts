import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import { calculateNumerology } from '../src/game/numerology-engine'
import { listCardNotes, saveCardNote } from '../src/game/card-storage'
import { listZiweiCharts } from '../src/game/ziwei-storage'
import { listHumanDesignCharts } from '../src/game/human-design-storage'
import type { ThreeCardSpread } from '../src/game/card-engine'

function createMemoryStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map<string, string>(Object.entries(initial))
  return {
    get length() { return map.size },
    clear() { map.clear() },
    getItem(key: string) { return map.has(key) ? map.get(key)! : null },
    key(index: number) { return Array.from(map.keys())[index] ?? null },
    removeItem(key: string) { map.delete(key) },
    setItem(key: string, value: string) { map.set(key, String(value)) },
  }
}

const originalStorage = globalThis.localStorage

afterEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: originalStorage, configurable: true, writable: true })
})

describe('安全性健檢回歸測試', () => {
  it('index.html 與 404.html 皆配置安全標頭 meta（CSP 與 Referrer-Policy）', () => {
    const html = readFileSync('index.html', 'utf8')
    expect(html).toContain('name="referrer" content="strict-origin-when-cross-origin"')
    expect(html).toContain('http-equiv="Content-Security-Policy"')
    expect(html).toContain("object-src 'none'")
    expect(html).toContain("base-uri 'self'")

    const redirect404 = readFileSync('public/404.html', 'utf8')
    expect(redirect404).toContain('name="referrer" content="strict-origin-when-cross-origin"')
  })

  it('temple-ui.ts 生命靈數輸入值已進行 HTML 跳脫，且 main.ts 致命錯誤不使用 innerHTML', () => {
    const uiSrc = readFileSync('src/ui/temple-ui.ts', 'utf8')
    expect(uiSrc).toContain('value="${esc(dateVal)}"')
    expect(uiSrc).not.toContain('value="${dateVal}"')

    const mainSrc = readFileSync('src/main.ts', 'utf8')
    expect(mainSrc).not.toMatch(/innerHTML\s*=\s*`<div class="fatal"/)
  })

  it('calculateNumerology 拒絕無效日期、超長字串與 XSS payload，正常日期不受影響', () => {
    const ok = calculateNumerology('1996-08-22')
    expect(ok.birthDate).toBe('1996-08-22')
    expect(ok.lifePathNumber).toBe(1)

    expect(() => calculateNumerology('"><img src=x onerror=alert(1)>')).toThrow()
    expect(() => calculateNumerology('9999-99-99')).toThrow()
    expect(() => calculateNumerology('2024-02-30')).toThrow()
    expect(() => calculateNumerology('1'.repeat(100))).toThrow()
  })

  it('本機儲存模組會過濾損毀或格式錯誤的 JSON 項目並限制筆記長度', () => {
    const mockStorage = createMemoryStorage({
      'tianxin.card-notes.v1': JSON.stringify([
        { id: 'ok-1', createdAt: 1700000000000, topic: 'work', cards: ['星辰'], note: 'a'.repeat(800) },
        { id: 123, createdAt: 'bad', topic: 'evil', cards: 'not-array', note: 'bad' },
        null,
        'string-entry',
      ]),
      'tianxin.ziwei.local.v1': JSON.stringify([
        { bad: true },
        { id: 'z1', createdAt: 1700000000000, label: 'x'.repeat(100), input: {}, chart: {} },
      ]),
      'tianxin.human-design.local.v1': JSON.stringify([
        null,
        { id: 'h1', createdAt: 1700000000000, label: 'y'.repeat(100), input: {}, chart: {} },
      ]),
    })
    Object.defineProperty(globalThis, 'localStorage', { value: mockStorage, configurable: true, writable: true })

    const notes = listCardNotes()
    expect(notes).toHaveLength(1)
    expect(notes[0].note.length).toBe(500)

    const fakeSpread = { topic: 'work', cards: [{ name: '星辰' }] } as unknown as ThreeCardSpread
    const saved = saveCardNote(fakeSpread, 'b'.repeat(700))
    expect(saved[0].note.length).toBe(500)

    const ziwei = listZiweiCharts()
    expect(ziwei).toHaveLength(1)
    expect(ziwei[0].label.length).toBe(40)

    const hd = listHumanDesignCharts()
    expect(hd).toHaveLength(1)
    expect(hd[0].label.length).toBe(40)
  })
})
