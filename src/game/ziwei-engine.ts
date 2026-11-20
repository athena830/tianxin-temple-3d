import { astro, version as iztroVersion } from 'iztro'

export type ZiweiGender = 'female' | 'male'

export type ZiweiInput = {
  alias?: string
  date: string
  time?: string
  timeUnknown: boolean
  country: string
  city: string
  gender: ZiweiGender
}

export type ZiweiPalace = {
  name: string
  earthlyBranch: string
  isBodyPalace: boolean
  majorStars: string[]
  minorStars: string[]
}

export type ZiweiChart = {
  engine: { name: 'iztro'; version: string }
  solarDate: string
  lunarDate: string
  timeLabel: string
  timeRange: string
  timeUncertain: boolean
  precisionNotice?: string
  soul: string
  body: string
  fiveElementsClass: string
  palaces: ZiweiPalace[]
  transformations: { star: string; kind: string; palace: string }[]
  reflection: string
}

const sensitiveAlias = /(?:\d[\s-]?){8,}|身分證|身份證|住址|地址/i

function timeIndex(time?: string): number {
  if (!time) return 0
  const hour = Number(time.split(':')[0])
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new Error('請輸入有效的出生時間。')
  if (hour === 0) return 0
  if (hour === 23) return 12
  return Math.ceil(hour / 2)
}

export function validateZiweiInput(input: ZiweiInput): void {
  const alias = input.alias?.trim() ?? ''
  if (alias.length > 20) throw new Error('識別名稱最多 20 字，可留白或使用暱稱、代號。')
  if (sensitiveAlias.test(alias)) throw new Error('識別名稱不可填電話、身分證號、地址等敏感資料。')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error('請輸入出生日期。')
  if (!input.timeUnknown && !input.time) throw new Error('請輸入出生時間，或勾選「出生時間不確定」。')
  if (!input.country.trim() || !input.city.trim()) throw new Error('請填寫出生地的國家／地區與城市。')
}

/**
 * Pure local charting adapter. It exposes only the data needed by the UI and
 * keeps iztro's specific classes out of forms, storage, and view rendering.
 */
export function createZiweiChart(input: ZiweiInput): ZiweiChart {
  validateZiweiInput(input)
  const index = input.timeUnknown ? 0 : timeIndex(input.time)
  const astrolabe = astro.bySolar(input.date, index, input.gender === 'female' ? '女' : '男', true, 'zh-TW')
  const palaces = astrolabe.palaces.map(palace => ({
    name: palace.name,
    earthlyBranch: palace.earthlyBranch,
    isBodyPalace: palace.isBodyPalace,
    majorStars: palace.majorStars.map(star => star.name),
    minorStars: palace.minorStars.map(star => star.name),
  }))
  const transformations = astrolabe.palaces.flatMap(palace =>
    [...palace.majorStars, ...palace.minorStars]
      .filter(star => Boolean(star.mutagen))
      .map(star => ({ star: star.name, kind: star.mutagen || '', palace: palace.name }))
  )
  const lifePalace = palaces.find(palace => palace.name === '命宮')
  const lifeStars = lifePalace?.majorStars.join('、') || '未列主星'

  return {
    engine: { name: 'iztro', version: iztroVersion },
    solarDate: astrolabe.solarDate,
    lunarDate: astrolabe.lunarDate,
    timeLabel: astrolabe.time,
    timeRange: astrolabe.timeRange,
    timeUncertain: input.timeUnknown,
    precisionNotice: input.timeUnknown
      ? '你標示出生時間不確定：本盤暫以早子時作為技術參考，命宮、身宮與星曜位置可能不同，請勿作精準判讀。'
      : undefined,
    soul: astrolabe.soul,
    body: astrolabe.body,
    fiveElementsClass: astrolabe.fiveElementsClass,
    palaces,
    transformations,
    reflection: `命宮主星為「${lifeStars}」。這是自我觀察的起點，不是對性格、事件或結果的保證。`,
  }
}
