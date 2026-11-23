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

function isValidSavedHumanDesign(item: unknown): item is SavedHumanDesignChart {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false
  const rec = item as Record<string, unknown>
  return (
    typeof rec.id === 'string' &&
    rec.id.length > 0 &&
    rec.id.length <= 80 &&
    typeof rec.createdAt === 'number' &&
    Number.isFinite(rec.createdAt) &&
    typeof rec.label === 'string' &&
    !!rec.input && typeof rec.input === 'object' && !Array.isArray(rec.input) &&
    !!rec.chart && typeof rec.chart === 'object' && !Array.isArray(rec.chart)
  )
}

export function listHumanDesignCharts(): SavedHumanDesignChart[] {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    const records: unknown = value ? JSON.parse(value) : []
    if (!Array.isArray(records)) return []
    return records
      .filter(isValidSavedHumanDesign)
      .slice(0, MAX_RECORDS)
      .map(r => ({ ...r, label: r.label.slice(0, 40) }))
  } catch { return [] }
}

/** Only invoked from the user's explicit "save on this device" action. */
export function saveHumanDesignChart(input: HumanDesignInput, chart: HumanDesignChart): SavedHumanDesignChart[] {
  const safeAlias = input.alias?.trim().slice(0, 20) || undefined
  const record: SavedHumanDesignChart = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    label: safeAlias || '未命名人類圖',
    input: {
      ...input,
      alias: safeAlias,
      country: String(input.country ?? '').trim().slice(0, 40),
      city: String(input.city ?? '').trim().slice(0, 40),
      timeZone: String(input.timeZone ?? '').trim().slice(0, 60),
    },
    chart,
  }
  const next = [record, ...listHumanDesignCharts()].slice(0, MAX_RECORDS)
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* local storage may be disabled */ }
  return next
}

export function clearHumanDesignCharts(): void {
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* local storage may be disabled */ }
}
