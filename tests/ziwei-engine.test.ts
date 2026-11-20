import { describe, expect, it } from 'vitest'
import { createZiweiChart, validateZiweiInput } from '../src/game/ziwei-engine'

const fixture = {
  alias: '測試代號',
  date: '2000-08-16',
  time: '04:30',
  timeUnknown: false,
  country: '台灣',
  city: '台北市',
  gender: 'female' as const,
}

describe('ZiweiEngine', () => {
  it('creates a stable twelve-palace chart from a fixed solar input', () => {
    const chart = createZiweiChart(fixture)
    expect(chart.engine).toEqual({ name: 'iztro', version: '2.6.5' })
    expect(chart.solarDate).toBe('2000-08-16')
    expect(chart.palaces).toHaveLength(12)
    expect(chart.palaces.find(palace => palace.name === '命宮')?.majorStars).toEqual(['紫微'])
    expect(chart.transformations.map(item => `${item.star}${item.kind}`)).toEqual(expect.arrayContaining(['太陽祿', '武曲權', '太陰科', '天同忌']))
  })

  it('marks charts made without a known birth time as low precision', () => {
    const chart = createZiweiChart({ ...fixture, time: undefined, timeUnknown: true })
    expect(chart.timeUncertain).toBe(true)
    expect(chart.precisionNotice).toContain('暫以早子時')
  })

  it('does not accept sensitive identifiers or incomplete birth places', () => {
    expect(() => validateZiweiInput({ ...fixture, alias: '0912-345-678' })).toThrow('敏感資料')
    expect(() => validateZiweiInput({ ...fixture, city: '' })).toThrow('出生地')
  })
})
