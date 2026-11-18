import { drawCrossSlots, evaluateCrossGua, type CrossGuaResult, type ChessPos } from '../divination'

export const TEMPLE_STORAGE_KEY = 'yuhuang.temple.v1'

export type CharacterId = 'jade' | 'vermillion' | 'moon'
export type LampId = 'peace' | 'wealth' | 'study'
export type OfferingId = 'flower' | 'fruit' | 'tea'

export const CHARACTERS: { id: CharacterId; name: string; title: string; color: string }[] = [
  { id: 'jade', name: '清蓮', title: '素心・藍髮白袍', color: '#3a6692' },
  { id: 'vermillion', name: '朱霞', title: '丹心・朱錦金帶', color: '#b64332' },
  { id: 'moon', name: '月白', title: '月照・天青白錦', color: '#3678b4' },
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

export type WishCategory = 'peace' | 'career' | 'love' | 'wealth' | 'study'

export type WishBlessing = {
  category: WishCategory
  categoryName: string
  title: string
  prophecy: string
}

export const WISH_BLESSINGS: Record<WishCategory, { name: string; items: { title: string; prophecy: string }[] }> = {
  peace: {
    name: '平安健康',
    items: [
      { title: '紫氣迎門・身心自在', prophecy: '觀音慈航，百病不侵，內外清和，福壽康寧。' },
      { title: '祥雲常罩・家宅康安', prophecy: '隨順安心，長幼安泰，無災無礙，日日清吉。' },
      { title: '心燈常明・歲月靜好', prophecy: '神明庇佑，諸事順遂，所行皆平坦，所見皆祥和。' },
    ],
  },
  career: {
    name: '事業亨通',
    items: [
      { title: '鵬程萬里・吉星高照', prophecy: '貴人提攜，機緣大開，志存高遠，所向披靡。' },
      { title: '雲程發軔・時運開泰', prophecy: '積微致著，宏圖大展，得道多助，步步生蓮。' },
      { title: '龍騰雲海・功業千秋', prophecy: '厚積薄發，勇立潮頭，商通四海，名揚四方。' },
    ],
  },
  love: {
    name: '廣結良緣',
    items: [
      { title: '春風和煦・情誼深長', prophecy: '心懷善念，良友相隨，琴瑟和鳴，良緣天成。' },
      { title: '花好月圓・相知相惜', prophecy: '彼此溫柔相待，人緣廣開，處處逢貴人，佳偶美滿。' },
      { title: '靈犀相通・緣定三生', prophecy: '莫急莫憂，佳期在望，真心相映，天賜良配。' },
    ],
  },
  wealth: {
    name: '財運興旺',
    items: [
      { title: '金玉滿堂・源遠流長', prophecy: '善財廣積，生生不息，行善積德，福祿雙全。' },
      { title: '寶庫豐盈・五路納吉', prophecy: '正偏財旺，事業有成，家道隆昌，富足安康。' },
      { title: '財星拱照・利祿豐亨', prophecy: '聚寶盆中金錢滿，勤懇篤行納百祥，豐衣足食。' },
    ],
  },
  study: {
    name: '金榜題名',
    items: [
      { title: '魁星點斗・獨占鰲頭', prophecy: '文昌高照，心沉如鏡，才思泉湧，名列前茅。' },
      { title: '智慧開朗・金榜標名', prophecy: '勤勉篤學，觸類旁通，考運亨通，前程似錦。' },
      { title: '筆走游龍・蟾宮折桂', prophecy: '十年磨劍今朝試，文曲護持破浪行，大放異彩。' },
    ],
  },
}
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

  currentCrossGua?: CrossGuaResult

  startCrossGua(): CrossGuaResult {
    const slots = drawCrossSlots()
    this.currentCrossGua = evaluateCrossGua(slots)
    return this.currentCrossGua!
  }

  revealCrossPiece(pos: ChessPos): CrossGuaResult {
    if (!this.currentCrossGua) {
      this.startCrossGua()
    }
    const current = this.currentCrossGua!
    if (current.slots[pos] && !current.slots[pos].revealed) {
      current.slots[pos].revealed = true
      this.currentCrossGua = evaluateCrossGua(current.slots)
      if (this.currentCrossGua.allRevealed) {
        const c = this.currentCrossGua
        const summaryRecord = `【${c.patternName}】${c.level}｜中[${c.slots.center.piece.name}] 上[${c.slots.top.piece.name}] 下[${c.slots.bottom.piece.name}] 左[${c.slots.left.piece.name}] 右[${c.slots.right.piece.name}]`
        this.addRecord('象棋神卦', summaryRecord)
      }
    }
    return this.currentCrossGua!
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

  tossCoin(category: WishCategory = 'peace', customWish = ''): { count: number; blessing: WishBlessing } {
    this.data.coins = Math.min(9999, this.data.coins + 1)
    const catData = WISH_BLESSINGS[category] ?? WISH_BLESSINGS.peace
    const index = Math.floor(Math.random() * catData.items.length)
    const item = catData.items[index]
    const blessing: WishBlessing = {
      category,
      categoryName: catData.name,
      title: item.title,
      prophecy: item.prophecy,
    }
    const note = customWish ? `（心願：${safeText(customWish, 40)}）` : ''
    this.addRecord('許願池投幣', `【${catData.name}】${blessing.title}${note}・累計 ${this.data.coins} 枚`)
    if (customWish) {
      this.submitWish(customWish)
    }
    this.persist()
    return { count: this.data.coins, blessing }
  }

  ringBell(): void { this.addRecord('鳴鐘', '願心安定，祝福相隨。') }
  strikeDrum(): void { this.addRecord('暮鼓鳴志', '鼓聲深沉悠遠，收攝心念，宏願堅定。') }
  tapWoodfish(): void { this.addRecord('敲木魚', '靜心一念。') }
  offerIncense(): void { this.addRecord('上香祈福', '於觀世音菩薩主殿敬香。') }
  worshipTiangong(): void { this.addRecord('參拜天公爐', '於前庭天公爐向玉皇上帝合掌敬拜。') }
  worshipYuhuang(): void { this.addRecord('凌霄朝拜', '於後殿凌霄寶殿至誠禮拜玉皇上帝，蒙沐聖眷，萬事禎祥。') }
  worshipDragonGuanyin(): void { this.addRecord('參拜昇龍觀音', '於聖境大平台仰望參拜五層樓高 Q 版白衣昇龍觀音，金角祥龍盤繞護持、佛光普照，祈願吉祥如意、百福駢臻。') }
  burnGold(type: string): void { this.addRecord('八角金爐化金', `虔化「${type}」入八角金亭，化吉納祥，福澤延綿。`) }
  divineBobei(resultText: string, detail: string): void { this.addRecord('擲筊請示', `${resultText}：${detail}`) }
}

export function formatRecordDate(at: number): string {
  return new Intl.DateTimeFormat('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(at)
}
