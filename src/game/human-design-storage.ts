import type { HumanDesignChart, HumanDesignInput } from './human-design-engine'

const STORAGE_KEY = 'tianxin.human-design.local.v1'
const MAX_RECORDS = 12

export type SavedHumanDesignChart = {
  id: string
  createdAt: number
  label: string
  input: HumanDesignInput
  chart: HumanDesignChart
}

export function listHumanDesignCharts(): SavedHumanDesignChart[] {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    const records = value ? JSON.parse(value) : []
    return Array.isArray(records) ? records : []
  } catch { return [] }
}

/** Only invoked from the user's explicit "save on this device" action. */
export function saveHumanDesignChart(input: HumanDesignInput, chart: HumanDesignChart): SavedHumanDesignChart[] {
  const record: SavedHumanDesignChart = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    label: input.alias?.trim() || '未命名人類圖',
    input: { ...input, alias: input.alias?.trim() || undefined },
    chart,
  }
  const next = [record, ...listHumanDesignCharts()].slice(0, MAX_RECORDS)
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* local storage may be disabled */ }
  return next
}

export function clearHumanDesignCharts(): void {
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* local storage may be disabled */ }
}
