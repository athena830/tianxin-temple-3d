import { describe, expect, it } from 'vitest'
import { calculateNumerology, LIFE_PATH_PROFILES } from '../src/game/numerology-engine'

describe('Numerology Engine (生命靈數測算)', () => {
  it('correctly calculates user example 1996-08-22', () => {
    // 1+9+9+6+0+8+2+2 = 37 -> 3+7 = 10 -> 1+0 = 1 (1號人, 天賦數 3, 7)
    const res = calculateNumerology('1996-08-22')
    expect(res.sum1).toBe(37)
    expect(res.sum2).toBe(10)
    expect(res.sum3).toBe(1)
    expect(res.lifePathNumber).toBe(1)
    expect(res.talentNumbers).toContain(3)
    expect(res.talentNumbers).toContain(7)
    expect(res.profile.title).toContain('1 號人')
    expect(res.birthdayCounts[1]).toBe(1)
    expect(res.birthdayCounts[2]).toBe(2)
    expect(res.birthdayCounts[9]).toBe(2)
    expect(res.birthdayCounts[6]).toBe(1)
    expect(res.birthdayCounts[8]).toBe(1)
  })

  it('calculates single-step reduction (e.g. 1985-05-04 -> 32 -> 5)', () => {
    // 1+9+8+5+0+5+0+4 = 32 -> 3+2 = 5 (5號人)
    const res = calculateNumerology('1985-05-04')
    expect(res.sum1).toBe(32)
    expect(res.sum2).toBe(5)
    expect(res.sum3).toBeUndefined()
    expect(res.lifePathNumber).toBe(5)
    expect(res.talentNumbers).toEqual([3, 2])
    expect(res.profile.title).toContain('5 號人')
  })

  it('provides profiles for all numbers 1 to 9', () => {
    for (let i = 1; i <= 9; i++) {
      expect(LIFE_PATH_PROFILES[i]).toBeDefined()
      expect(LIFE_PATH_PROFILES[i].title).toBeDefined()
      expect(LIFE_PATH_PROFILES[i].healingMessage).toBeDefined()
    }
  })

  it('throws helpful error for invalid date', () => {
    expect(() => calculateNumerology('invalid')).toThrow()
    expect(() => calculateNumerology('1990-1-1')).toThrow()
  })
})
