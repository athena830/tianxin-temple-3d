import type { ZiweiChart, ZiweiInput } from './ziwei-engine'

const STORAGE_KEY = 'tianxin.ziwei.local.v1'
const MAX_RECORDS = 12

export type SavedZiweiChart = {
  id: string
  createdAt: number
  label: string
  input: ZiweiInput
  chart: ZiweiChart
}

export function listZiweiCharts(): SavedZiweiChart[] {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    const records = value ? JSON.parse(value) : []
    return Array.isArray(records) ? records : []
  } catch { return [] }
}

/** Only invoked from the user's explicit "save on this device" action. */
export function saveZiweiChart(input: ZiweiInput, chart: ZiweiChart): SavedZiweiChart[] {
  const record: SavedZiweiChart = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    label: input.alias?.trim() || '未命名命盤',
    input: { ...input, alias: input.alias?.trim() || undefined },
    chart,
  }
  const next = [record, ...listZiweiCharts()].slice(0, MAX_RECORDS)
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* local storage may be disabled */ }
  return next
}

export function clearZiweiCharts(): void {
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* local storage may be disabled */ }
}
