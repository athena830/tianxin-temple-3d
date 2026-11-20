import { Body, EclipticLongitude, NextMoonNode, SearchMoonNode, SearchSunLongitude, SunPosition } from 'astronomy-engine'

export type HumanDesignInput = {
  alias?: string
  date: string
  time?: string
  timeUnknown: boolean
  country: string
  city: string
  /** IANA time zone selected for the reported birth place, for example Asia/Taipei. */
  timeZone: string
}

export type HumanDesignCenter = '頭頂' | '邏輯' | '喉嚨' | 'G 中心' | '意志力' | '情緒' | '薦骨' | '脾臟' | '根部'
export type HumanDesignActivation = { body: string; gate: number; line: number; longitude: number }
export type HumanDesignChannel = { gates: [number, number]; centers: [HumanDesignCenter, HumanDesignCenter] }

export type HumanDesignChart = {
  engine: {
    name: 'local-human-design-engine'
    astronomyEngineVersion: '2.1.19'
    validation: 'pending-authorized-reference-checks'
  }
  birthInstant: string
  designInstant: string
  timeZone: string
  timeUncertain: boolean
  timeZoneAmbiguous: boolean
  precisionNotice?: string
  type: string
  strategy: string
  authority: string
  profile: string
  centers: { name: HumanDesignCenter; defined: boolean }[]
  channels: HumanDesignChannel[]
  gates: number[]
  personality: HumanDesignActivation[]
  design: HumanDesignActivation[]
}

const SENSITIVE_ALIAS = /(?:\d[\s-]?){8,}|身分證|身份證|地址|電話|手機/i
const GATE_ORDER = [41, 19, 13, 49, 30, 55, 37, 63, 22, 36, 25, 17, 21, 51, 42, 3, 27, 24, 2, 23, 8, 20, 16, 35, 45, 12, 15, 52, 39, 53, 62, 56, 31, 33, 7, 4, 29, 59, 40, 64, 47, 6, 46, 18, 48, 57, 32, 50, 28, 44, 1, 43, 14, 34, 9, 5, 26, 11, 10, 58, 38, 54, 61, 60] as const
const CENTERS: HumanDesignCenter[] = ['頭頂', '邏輯', '喉嚨', 'G 中心', '意志力', '情緒', '薦骨', '脾臟', '根部']

const CHANNELS: HumanDesignChannel[] = [
  { gates: [64, 47], centers: ['頭頂', '邏輯'] }, { gates: [61, 24], centers: ['頭頂', '邏輯'] }, { gates: [63, 4], centers: ['頭頂', '邏輯'] },
  { gates: [43, 23], centers: ['邏輯', '喉嚨'] }, { gates: [11, 56], centers: ['邏輯', '喉嚨'] }, { gates: [17, 62], centers: ['邏輯', '喉嚨'] },
  { gates: [16, 48], centers: ['喉嚨', '脾臟'] }, { gates: [20, 57], centers: ['喉嚨', '脾臟'] }, { gates: [20, 10], centers: ['喉嚨', 'G 中心'] },
  { gates: [20, 34], centers: ['喉嚨', '薦骨'] }, { gates: [12, 22], centers: ['喉嚨', '情緒'] }, { gates: [35, 36], centers: ['喉嚨', '情緒'] },
  { gates: [21, 45], centers: ['意志力', '喉嚨'] }, { gates: [7, 31], centers: ['G 中心', '喉嚨'] }, { gates: [1, 8], centers: ['G 中心', '喉嚨'] },
  { gates: [13, 33], centers: ['G 中心', '喉嚨'] }, { gates: [25, 51], centers: ['G 中心', '意志力'] }, { gates: [2, 14], centers: ['G 中心', '薦骨'] },
  { gates: [5, 15], centers: ['G 中心', '薦骨'] }, { gates: [29, 46], centers: ['薦骨', 'G 中心'] }, { gates: [27, 50], centers: ['薦骨', '脾臟'] },
  { gates: [34, 57], centers: ['薦骨', '脾臟'] }, { gates: [10, 57], centers: ['G 中心', '脾臟'] }, { gates: [26, 44], centers: ['意志力', '脾臟'] },
  { gates: [32, 54], centers: ['脾臟', '根部'] }, { gates: [28, 38], centers: ['脾臟', '根部'] }, { gates: [18, 58], centers: ['脾臟', '根部'] },
  { gates: [59, 6], centers: ['薦骨', '情緒'] }, { gates: [3, 60], centers: ['薦骨', '根部'] }, { gates: [9, 52], centers: ['薦骨', '根部'] },
  { gates: [42, 53], centers: ['薦骨', '根部'] }, { gates: [37, 40], centers: ['情緒', '意志力'] }, { gates: [30, 41], centers: ['情緒', '根部'] },
  { gates: [39, 55], centers: ['根部', '情緒'] }, { gates: [19, 49], centers: ['根部', '情緒'] }, { gates: [34, 10], centers: ['薦骨', 'G 中心'] },
]

const BODIES: Array<[string, Body]> = [
  ['太陽', Body.Sun], ['月亮', Body.Moon], ['水星', Body.Mercury], ['金星', Body.Venus], ['火星', Body.Mars], ['木星', Body.Jupiter], ['土星', Body.Saturn], ['天王星', Body.Uranus], ['海王星', Body.Neptune], ['冥王星', Body.Pluto],
]

type LocalDateTime = { year: number; month: number; day: number; hour: number; minute: number }

function normalize(value: number): number { return ((value % 360) + 360) % 360 }

function localParts(date: Date, timeZone: string): LocalDateTime {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  const fields = Object.fromEntries(formatter.formatToParts(date).filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]))
  return { year: fields.year, month: fields.month, day: fields.day, hour: fields.hour, minute: fields.minute }
}

function sameLocal(left: LocalDateTime, right: LocalDateTime): boolean {
  return left.year === right.year && left.month === right.month && left.day === right.day && left.hour === right.hour && left.minute === right.minute
}

function parseLocal(date: string, time: string): LocalDateTime {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time)
  if (!match || !timeMatch) throw new Error('請輸入有效的出生日期與當地時間。')
  const result = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]), hour: Number(timeMatch[1]), minute: Number(timeMatch[2]) }
  const normalized = new Date(Date.UTC(result.year, result.month - 1, result.day))
  if (normalized.getUTCFullYear() !== result.year || normalized.getUTCMonth() !== result.month - 1 || normalized.getUTCDate() !== result.day || result.hour > 23 || result.minute > 59) throw new Error('請輸入有效的出生日期與當地時間。')
  return result
}

/** Converts a reported civil time using an IANA zone, never a fixed UTC offset. */
export function zonedLocalToUtc(date: string, time: string, timeZone: string): { instant: Date; ambiguous: boolean } {
  const target = parseLocal(date, time)
  try { new Intl.DateTimeFormat('en', { timeZone }).format() } catch { throw new Error('請選擇有效的 IANA 時區，例如 Asia/Taipei。') }
  const naive = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute)
  const candidates: Date[] = []
  for (let minutes = -1_440; minutes <= 1_440; minutes += 15) {
    const candidate = new Date(naive + minutes * 60_000)
    if (sameLocal(localParts(candidate, timeZone), target)) candidates.push(candidate)
  }
  if (!candidates.length) throw new Error('此當地時間在所選時區可能因夏令時間調整而不存在；請確認出生時間與時區。')
  candidates.sort((a, b) => a.getTime() - b.getTime())
  return { instant: candidates[0], ambiguous: candidates.length > 1 }
}

export function validateHumanDesignInput(input: HumanDesignInput): void {
  const alias = input.alias?.trim() ?? ''
  if (alias.length > 20) throw new Error('識別名稱最多 20 字，請改用暱稱、代號或留白。')
  if (SENSITIVE_ALIAS.test(alias)) throw new Error('識別名稱不可填入電話、身分證號或地址等敏感資料。')
  if (!input.country.trim() || !input.city.trim()) throw new Error('請填寫出生國家／地區與城市。')
  if (!input.timeUnknown && !input.time) throw new Error('請填寫出生時間，或勾選出生時間不確定。')
  zonedLocalToUtc(input.date, input.timeUnknown ? '12:00' : input.time!, input.timeZone)
}

function gateAt(longitude: number): { gate: number; line: number } {
  // Gate 41 begins at 2° Aquarius (302° ecliptic longitude). The +58° shift converts from Aries-zero to that boundary.
  const position = normalize(longitude + 58) / 360
  const gate = GATE_ORDER[Math.floor(position * GATE_ORDER.length)]
  const line = Math.floor((position * 384) % 6) + 1
  return { gate, line }
}

function lunarNodeLongitude(date: Date): number {
  let node = SearchMoonNode(new Date(date.getTime() - 15 * 86_400_000))
  let previous = node
  while (node.time.date.getTime() <= date.getTime()) {
    previous = node
    node = NextMoonNode(node)
  }
  const before = EclipticLongitude(Body.Moon, previous.time)
  const after = EclipticLongitude(Body.Moon, node.time)
  const ratio = (date.getTime() - previous.time.date.getTime()) / (node.time.date.getTime() - previous.time.date.getTime())
  const delta = ((after - before + 540) % 360) - 180
  return normalize(before + delta * ratio)
}

function activationsAt(date: Date): HumanDesignActivation[] {
  const activations = BODIES.map(([body, planet]) => {
    const longitude = planet === Body.Sun ? SunPosition(date).elon : EclipticLongitude(planet, date)
    const substructure = gateAt(longitude)
    return { body, longitude, ...substructure }
  })
  const sun = activations.find(item => item.body === '太陽')!
  const northLongitude = lunarNodeLongitude(date)
  const north = gateAt(northLongitude)
  const south = gateAt(normalize(northLongitude + 180))
  return [
    sun,
    { body: '地球', longitude: normalize(sun.longitude + 180), ...gateAt(normalize(sun.longitude + 180)) },
    ...activations.filter(item => item.body !== '太陽'),
    { body: '北交點', longitude: northLongitude, ...north },
    { body: '南交點', longitude: normalize(northLongitude + 180), ...south },
  ]
}

function linkedCenters(channels: HumanDesignChannel[]): Map<HumanDesignCenter, Set<HumanDesignCenter>> {
  const map = new Map(CENTERS.map(center => [center, new Set<HumanDesignCenter>()]))
  for (const channel of channels) {
    map.get(channel.centers[0])!.add(channel.centers[1])
    map.get(channel.centers[1])!.add(channel.centers[0])
  }
  return map
}

function hasPath(graph: Map<HumanDesignCenter, Set<HumanDesignCenter>>, start: HumanDesignCenter, end: HumanDesignCenter): boolean {
  const queue = [start]
  const visited = new Set<HumanDesignCenter>()
  while (queue.length) {
    const current = queue.shift()!
    if (current === end) return true
    if (visited.has(current)) continue
    visited.add(current)
    for (const next of graph.get(current) ?? []) queue.push(next)
  }
  return false
}

function classify(defined: Set<HumanDesignCenter>, channels: HumanDesignChannel[], personality: HumanDesignActivation[], design: HumanDesignActivation[]): Pick<HumanDesignChart, 'type' | 'strategy' | 'authority' | 'profile'> {
  const graph = linkedCenters(channels)
  const sacral = defined.has('薦骨')
  const motorCenters: HumanDesignCenter[] = ['薦骨', '意志力', '情緒', '根部']
  const motorToThroat = motorCenters.some(center => defined.has(center) && hasPath(graph, center, '喉嚨'))
  const type = sacral ? (motorToThroat ? '顯示生產者' : '生產者') : motorToThroat ? '顯示者' : defined.size === 0 ? '反映者' : '投射者'
  const strategy = type === '生產者' || type === '顯示生產者' ? '等待回應' : type === '顯示者' ? '行動前告知' : type === '投射者' ? '等待邀請' : '等待月亮週期'
  const authority = defined.has('情緒') ? '情緒權威' : defined.has('薦骨') ? '薦骨權威' : defined.has('脾臟') ? '脾臟權威' : defined.has('意志力') ? '意志力權威' : defined.has('G 中心') ? '自我投射權威' : defined.size === 0 ? '月亮權威' : '環境／外在權威'
  const personalitySun = personality.find(item => item.body === '太陽')!
  const designSun = design.find(item => item.body === '太陽')!
  return { type, strategy, authority, profile: `${personalitySun.line}/${designSun.line}` }
}

/**
 * Local-only, provisional calculator. It deliberately labels every output as
 * awaiting authorized-reference validation; it is not a claim of official or
 * professionally certified Human Design accuracy.
 */
export function createHumanDesignChart(input: HumanDesignInput): HumanDesignChart {
  validateHumanDesignInput(input)
  const converted = zonedLocalToUtc(input.date, input.timeUnknown ? '12:00' : input.time!, input.timeZone)
  const birthInstant = converted.instant
  const birthSun = SunPosition(birthInstant).elon
  const designTime = SearchSunLongitude(normalize(birthSun - 88), new Date(birthInstant.getTime() - 120 * 86_400_000), 120)
  if (!designTime) throw new Error('無法建立設計時間，請確認出生資料後再試。')
  const personality = activationsAt(birthInstant)
  const design = activationsAt(designTime.date)
  const gates = [...new Set([...personality, ...design].map(item => item.gate))].sort((a, b) => a - b)
  const channels = CHANNELS.filter(channel => gates.includes(channel.gates[0]) && gates.includes(channel.gates[1]))
  const defined = new Set(channels.flatMap(channel => channel.centers))
  const summary = classify(defined, channels, personality, design)
  const timeUncertain = input.timeUnknown || converted.ambiguous
  return {
    engine: { name: 'local-human-design-engine', astronomyEngineVersion: '2.1.19', validation: 'pending-authorized-reference-checks' },
    birthInstant: birthInstant.toISOString(),
    designInstant: designTime.date.toISOString(),
    timeZone: input.timeZone,
    timeUncertain,
    timeZoneAmbiguous: converted.ambiguous,
    precisionNotice: timeUncertain ? (input.timeUnknown ? '出生時間不確定：此圖以出生地當日 12:00 作技術參考，僅供測試與自我探索，不能視為精準結果。' : '此出生時間落在夏令時間重複時段；系統暫以較早的對應瞬間計算，請確認原始出生紀錄。') : undefined,
    ...summary,
    centers: CENTERS.map(name => ({ name, defined: defined.has(name) })),
    channels,
    gates,
    personality,
    design,
  }
}

export const HUMAN_DESIGN_VALIDATION_STATUS = {
  requiredAuthorizedReferenceCases: 10,
  approvedReferenceCases: 0,
  status: 'pending' as const,
}
