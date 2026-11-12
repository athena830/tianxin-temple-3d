export const TEMPLE_STORAGE_KEY = 'yuhuang.temple.v1'

export type CharacterId = 'jade' | 'vermillion' | 'moon'
export type LampId = 'peace' | 'wealth' | 'study'
export type OfferingId = 'flower' | 'fruit' | 'tea'

export const CHARACTERS: { id: CharacterId; name: string; title: string; color: string }[] = [
  { id: 'jade', name: '清蓮', title: '素心行者', color: '#bca77a' },
  { id: 'vermillion', name: '朱霞', title: '丹心行者', color: '#9d3f31' },
  { id: 'moon', name: '月白', title: '月照行者', color: '#84998b' },
]

export const LOTS = [
  { number: 1, title: '上上籤・雲開見月', text: '雲開月出照前程，靜待花開自有時。心存善念，步步皆安。', advice: '宜：沉心整理，從容前行。' },
  { number: 2, title: '上籤・清風入懷', text: '清風徐來拂塵埃，一念安然百事開。所求之事，先從眼前小處用心。', advice: '宜：把握眼前，珍惜相伴。' },
  { number: 3, title: '中上籤・春水初生', text: '春水初生柳色新，耐心耕耘見生機。遇事多聽一言，心寬路自寬。', advice: '宜：聆聽與溝通，循序漸進。' },
  { number: 4, title: '中籤・山行有伴', text: '山路迢迢莫自憂，同行相助可分愁。把步伐放慢，答案會在路上浮現。', advice: '宜：尋求支持，照顧身心。' },
  { number: 5, title: '平安籤・心燈常明', text: '一盞心燈照夜行，平安二字最為珍。凡事量力而為，守好日常即是福。', advice: '宜：安住當下，平安作伴。' },
  { number: 6, title: '中上籤・稻穗低垂', text: '稻穗低垂知禮讓，收成自有勤耕人。越是順利越要心懷感謝，與人分享。', advice: '宜：感恩分享，謙和待人。' },
  { number: 7, title: '上籤・遠山含翠', text: '遠山含翠待晴光，心願循時漸有望。先把根基扎穩，好消息便有來處。', advice: '宜：穩紮穩打，保持信心。' },
  { number: 8, title: '平安籤・明窗淨几', text: '明窗淨几一室清，紛亂思緒漸分明。將掛心之事逐一整理，便能看見方向。', advice: '宜：整理思緒，留白休息。' },
]

export type Wish = { id: string; text: string; at: number }
export type TempleRecord = { id: string; action: string; detail: string; at: number }
export type DrawnLot = { day: string; number: number; title: string; text: string; advice: string }
export type TempleData = {
  version: 1
  character: CharacterId
  wishes: Wish[]
  records: TempleRecord[]
  lamps: Record<LampId, boolean>
  offerings: Record<OfferingId, number>
  dailyLot: DrawnLot | null
  coins: number
}

const DEFAULT_DATA: TempleData = {
  version: 1,
  character: 'jade',
  wishes: [],
  records: [],
  lamps: { peace: false, wealth: false, study: false },
  offerings: { flower: 0, fruit: 0, tea: 0 },
  dailyLot: null,
  coins: 0,
}

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const safeText = (value: unknown, max = 120): string => typeof value === 'string' ? value.trim().slice(0, max) : ''

function decode(raw: string | null): TempleData {
  if (!raw) return structuredClone(DEFAULT_DATA)
  try {
    const value: unknown = JSON.parse(raw)
    if (!isRecord(value) || value.version !== 1) return structuredClone(DEFAULT_DATA)
    const knownCharacter = CHARACTERS.some(character => character.id === value.character)
    const wishes = Array.isArray(value.wishes) ? value.wishes.flatMap((wish): Wish[] => {
      if (!isRecord(wish)) return []
      const text = safeText(wish.text)
      if (!text || typeof wish.at !== 'number' || !Number.isFinite(wish.at)) return []
      return [{ id: safeText(wish.id, 80) || `wish-${wish.at}`, text, at: wish.at }]
    }).slice(0, 40) : []
    const records = Array.isArray(value.records) ? value.records.flatMap((record): TempleRecord[] => {
      if (!isRecord(record) || typeof record.at !== 'number' || !Number.isFinite(record.at)) return []
      const action = safeText(record.action, 40)
      if (!action) return []
      return [{ id: safeText(record.id, 80) || `record-${record.at}`, action, detail: safeText(record.detail), at: record.at }]
    }).slice(0, 100) : []
    const lamps = isRecord(value.lamps) ? value.lamps : {}
    const offerings = isRecord(value.offerings) ? value.offerings : {}
    const lot = isRecord(value.dailyLot) && typeof value.dailyLot.day === 'string'
      && typeof value.dailyLot.number === 'number' && typeof value.dailyLot.title === 'string'
      && typeof value.dailyLot.text === 'string' && typeof value.dailyLot.advice === 'string'
      ? { day: safeText(value.dailyLot.day, 10), number: Math.max(1, Math.floor(value.dailyLot.number)), title: safeText(value.dailyLot.title, 80), text: safeText(value.dailyLot.text), advice: safeText(value.dailyLot.advice, 100) }
      : null
    return {
      version: 1,
      character: knownCharacter ? value.character as CharacterId : DEFAULT_DATA.character,
      wishes,
      records,
      lamps: { peace: lamps.peace === true, wealth: lamps.wealth === true, study: lamps.study === true },
      offerings: {
        flower: Math.max(0, Math.min(99, Number.isFinite(offerings.flower) ? Math.floor(offerings.flower as number) : 0)),
        fruit: Math.max(0, Math.min(99, Number.isFinite(offerings.fruit) ? Math.floor(offerings.fruit as number) : 0)),
        tea: Math.max(0, Math.min(99, Number.isFinite(offerings.tea) ? Math.floor(offerings.tea as number) : 0)),
      },
      dailyLot: lot,
      coins: Math.max(0, Math.min(9999, Number.isFinite(value.coins) ? Math.floor(value.coins as number) : 0)),
    }
  } catch {
    return structuredClone(DEFAULT_DATA)
  }
}

function localDay(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

export class TempleStore {
  data: TempleData
  private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | undefined

  constructor(storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = globalThis.localStorage) {
    this.storage = storage
    let raw: string | null = null
    try { raw = storage?.getItem(TEMPLE_STORAGE_KEY) ?? null } catch { raw = null }
    this.data = decode(raw)
  }

  private persist(): void {
    try { this.storage?.setItem(TEMPLE_STORAGE_KEY, JSON.stringify(this.data)) } catch { /* Keep using in-memory state when browser storage is unavailable. */ }
  }

  setCharacter(character: CharacterId): void {
    if (!CHARACTERS.some(item => item.id === character)) return
    this.data.character = character
    this.persist()
  }

  addRecord(action: string, detail = '', at = Date.now()): TempleRecord {
    const record = { id: `${at}-${Math.random().toString(36).slice(2, 8)}`, action: safeText(action, 40), detail: safeText(detail), at }
    this.data.records = [record, ...this.data.records].slice(0, 100)
    this.persist()
    return record
  }

  submitWish(text: string): Wish | null {
    const cleaned = safeText(text, 120)
    if (!cleaned) return null
    const at = Date.now()
    const wish = { id: `wish-${at}-${Math.random().toString(36).slice(2, 7)}`, text: cleaned, at }
    this.data.wishes = [wish, ...this.data.wishes].slice(0, 40)
    this.addRecord('祈願', cleaned, at)
    this.persist()
    return wish
  }

  lightLamp(id: LampId): boolean {
    if (this.data.lamps[id]) return false
    this.data.lamps[id] = true
    const name = ({ peace: '平安燈', wealth: '財神燈', study: '文昌燈' } as const)[id]
    this.addRecord('點燈祈福', name)
    return true
  }

  offer(id: OfferingId): number {
    this.data.offerings[id] = Math.min(99, this.data.offerings[id] + 1)
    const name = ({ flower: '供花', fruit: '供果', tea: '供茶' } as const)[id]
    this.addRecord('虛擬供奉', name)
    return this.data.offerings[id]
  }

  drawDailyLot(now = new Date()): { lot: DrawnLot; fresh: boolean } {
    const day = localDay(now)
    if (this.data.dailyLot?.day === day) return { lot: this.data.dailyLot, fresh: false }
    const selected = LOTS[hash(`yuhuang:${day}`) % LOTS.length]
    const lot: DrawnLot = { day, ...selected }
    this.data.dailyLot = lot
    this.addRecord('每日抽籤', `${lot.title}（第 ${lot.number} 籤）`, now.getTime())
    return { lot, fresh: true }
  }

  divineChess(piece: string, direction: string): string {
    const choices = [
      '棋開得勢，先穩住手上的一步，再看下一著。',
      '馬行日字，轉個角度也許就能找到新路。',
      '守中有進，暫緩片刻並非退縮，而是在等好時機。',
      '車行直道，目標清楚時就一步一步踏實向前。',
      '卒行雖慢，日日累積也能走出自己的天地。',
    ]
    const result = choices[hash(`${Date.now()}:${piece}:${direction}`) % choices.length]
    this.addRecord('象棋卜卦', `${piece}・${direction}：${result}`)
    return result
  }

  tossCoin(): number {
    this.data.coins = Math.min(9999, this.data.coins + 1)
    this.addRecord('許願池投幣', `已投入 ${this.data.coins} 枚祈福銅錢`)
    return this.data.coins
  }

  ringBell(): void { this.addRecord('鳴鐘', '願心安定，祝福相隨。') }
  tapWoodfish(): void { this.addRecord('敲木魚', '靜心一念。') }
  offerIncense(): void { this.addRecord('上香祈福', '於觀音佛祖主殿敬香。') }
}

export function formatRecordDate(at: number): string {
  return new Intl.DateTimeFormat('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(at)
}
