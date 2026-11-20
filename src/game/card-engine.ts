export type CardTopic = 'work' | 'relationship' | 'inner-state' | 'next-step'

export type ReflectionCard = {
  id: string
  name: string
  symbol: string
  color: string
  keywords: string[]
  reflection: string
  question: string
}

export type ThreeCardSpread = {
  topic: CardTopic
  cards: [ReflectionCard, ReflectionCard, ReflectionCard]
}

export const TOPIC_LABELS: Record<CardTopic, string> = {
  work: '工作', relationship: '關係', 'inner-state': '內在狀態', 'next-step': '下一步',
}

export const REFLECTION_CARDS: ReflectionCard[] = [
  { id: 'dawn', name: '晨光', symbol: '☀', color: '#e6a94d', keywords: ['開始', '看見', '清晰'], reflection: '把注意力放回眼前可掌握的一小步。', question: '今天有什麼已經足夠清楚，值得先做？' },
  { id: 'moon', name: '月潭', symbol: '☾', color: '#9aa9db', keywords: ['感受', '停留', '傾聽'], reflection: '允許尚未定論的感受暫時存在。', question: '如果不急著回答，我真正感受到什麼？' },
  { id: 'bridge', name: '橋', symbol: '⌁', color: '#7fb7ad', keywords: ['連結', '溝通', '理解'], reflection: '先確認彼此正在談的是不是同一件事。', question: '我願意多聽見哪一種不同的觀點？' },
  { id: 'seed', name: '種子', symbol: '✦', color: '#c5a46b', keywords: ['醞釀', '耐心', '根基'], reflection: '還沒開花不代表沒有前進。', question: '我能為想做的事留下哪一點穩定空間？' },
  { id: 'river', name: '河流', symbol: '≈', color: '#66a9c8', keywords: ['流動', '調整', '放鬆'], reflection: '改變方向也可以是照顧自己的選擇。', question: '哪個地方需要更有彈性，而不是更用力？' },
  { id: 'mountain', name: '山', symbol: '▲', color: '#7d846e', keywords: ['界線', '穩定', '遠望'], reflection: '把界線說清楚，能讓關係與工作更穩定。', question: '我需要保留什麼，才能站得更穩？' },
  { id: 'lantern', name: '燈', symbol: '◇', color: '#e67865', keywords: ['照亮', '陪伴', '溫柔'], reflection: '不必一次照亮整條路，先照亮下一步即可。', question: '什麼小小的支持能讓今天更好走？' },
  { id: 'garden', name: '庭園', symbol: '❀', color: '#9fbc7d', keywords: ['滋養', '節奏', '照料'], reflection: '真正重要的事，往往需要規律而不急躁的照料。', question: '我想怎麼安排一段可持續的節奏？' },
]

function daySeed(day: string): number {
  return [...day].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 17)
}

function indexFor(seed: number, offset = 0): number {
  return Math.abs((seed + offset * 1103515245) >>> 0) % REFLECTION_CARDS.length
}

/** The daily card is deterministic for a local calendar date: same day, same card, no redraw. */
export function getDailyCard(day = new Date().toLocaleDateString('sv-SE')): ReflectionCard {
  return REFLECTION_CARDS[indexFor(daySeed(day))]
}

export function drawThreeCards(topic: CardTopic, random = Math.random): ThreeCardSpread {
  const available = [...REFLECTION_CARDS]
  const pick = (): ReflectionCard => available.splice(Math.floor(random() * available.length), 1)[0]
  return { topic, cards: [pick(), pick(), pick()] }
}
