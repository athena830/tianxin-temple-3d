import { beforeEach, describe, expect, it } from 'vitest'

if (typeof (globalThis as any).localStorage === 'undefined') {
  const store = new Map<string, string>()
  ;(globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => store.set(key, String(val)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  }
}

import { clearHumanDesignCharts, listHumanDesignCharts, saveHumanDesignChart } from '../src/game/human-design-storage'
import type { HumanDesignChart, HumanDesignInput } from '../src/game/human-design-engine'

describe('human-design-storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('saves, lists, and clears provisional human design charts locally', () => {
    expect(listHumanDesignCharts()).toEqual([])

    const input: HumanDesignInput = {
      alias: '測試探索者',
      date: '1995-06-15',
      time: '12:00',
      timeUnknown: false,
      country: '台灣',
      city: '台北市',
      timeZone: 'Asia/Taipei',
    }

    const mockChart: HumanDesignChart = {
      engine: {
        name: 'local-human-design-engine',
        astronomyEngineVersion: '2.1.19',
        validation: 'pending-authorized-reference-checks',
      },
      birthInstant: '1995-06-15T04:00:00.000Z',
      designInstant: '1995-03-19T04:00:00.000Z',
      timeZone: 'Asia/Taipei',
      timeUncertain: false,
      timeZoneAmbiguous: false,
      type: '生產者',
      strategy: '等待回應',
      authority: '薦骨權威',
      profile: '1/3',
      centers: [{ name: '薦骨', defined: true }, { name: '頭頂', defined: false }],
      channels: [],
      gates: [34, 20],
      personality: [],
      design: [],
    }

    const saved = saveHumanDesignChart(input, mockChart)
    expect(saved).toHaveLength(1)
    expect(saved[0].label).toBe('測試探索者')
    expect(saved[0].chart.type).toBe('生產者')

    const listed = listHumanDesignCharts()
    expect(listed).toHaveLength(1)
    expect(listed[0].input.city).toBe('台北市')

    clearHumanDesignCharts()
    expect(listHumanDesignCharts()).toHaveLength(0)
  })
})
