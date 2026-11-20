import { describe, expect, it } from 'vitest'
import { HUMAN_DESIGN_VALIDATION_STATUS, createHumanDesignChart, validateHumanDesignInput, zonedLocalToUtc } from '../src/game/human-design-engine'

const fixture = {
  alias: '測試代號',
  date: '2000-08-16',
  time: '04:30',
  timeUnknown: false,
  country: '台灣',
  city: '台北市',
  timeZone: 'Asia/Taipei',
}

describe('HumanDesignEngine', () => {
  it('converts reported local time through an IANA timezone, not a fixed offset', () => {
    const result = zonedLocalToUtc('2000-08-16', '04:30', 'Asia/Taipei')
    expect(result.instant.toISOString()).toBe('2000-08-15T20:30:00.000Z')
    expect(result.ambiguous).toBe(false)
  })

  it('creates a stable provisional local chart from a fixed input', () => {
    const first = createHumanDesignChart(fixture)
    const second = createHumanDesignChart(fixture)
    expect(first).toEqual(second)
    expect(first.engine.validation).toBe('pending-authorized-reference-checks')
    expect(first.personality).toHaveLength(13)
    expect(first.design).toHaveLength(13)
    expect(first.centers).toHaveLength(9)
    expect(first.gates.every(gate => gate >= 1 && gate <= 64)).toBe(true)
    expect(first.profile).toMatch(/^[1-6]\/[1-6]$/)
  })

  it('does not accept sensitive aliases, missing local time, or invalid time zones', () => {
    expect(() => validateHumanDesignInput({ ...fixture, alias: '0912-345-678' })).toThrow('敏感資料')
    expect(() => validateHumanDesignInput({ ...fixture, time: undefined })).toThrow('出生時間')
    expect(() => validateHumanDesignInput({ ...fixture, timeZone: 'UTC+8' })).toThrow('IANA')
  })

  it('keeps the formal-validation gate closed until authorized reference cases exist', () => {
    expect(HUMAN_DESIGN_VALIDATION_STATUS).toEqual({ requiredAuthorizedReferenceCases: 10, approvedReferenceCases: 0, status: 'pending' })
  })
})
