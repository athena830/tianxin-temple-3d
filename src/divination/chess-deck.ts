import type { ChessColor, ChessPiece, ChessPos, CrossSlot } from './chess-types'

export const PIECE_DEFINITIONS: { name: string; color: ChessColor; rank: number; count: number }[] = [
  // 紅方 (16 顆)
  { name: '帥', color: 'red', rank: 7, count: 1 },
  { name: '仕', color: 'red', rank: 2, count: 2 },
  { name: '相', color: 'red', rank: 3, count: 2 },
  { name: '俥', color: 'red', rank: 6, count: 2 },
  { name: '傌', color: 'red', rank: 5, count: 2 },
  { name: '炮', color: 'red', rank: 4, count: 2 },
  { name: '兵', color: 'red', rank: 1, count: 5 },
  // 黑方 (16 顆)
  { name: '將', color: 'black', rank: 7, count: 1 },
  { name: '士', color: 'black', rank: 2, count: 2 },
  { name: '象', color: 'black', rank: 3, count: 2 },
  { name: '車', color: 'black', rank: 6, count: 2 },
  { name: '馬', color: 'black', rank: 5, count: 2 },
  { name: '包', color: 'black', rank: 4, count: 2 },
  { name: '卒', color: 'black', rank: 1, count: 5 },
]

export function createFullDeck(): ChessPiece[] {
  const deck: ChessPiece[] = []
  let id = 0
  for (const def of PIECE_DEFINITIONS) {
    for (let i = 0; i < def.count; i++) {
      deck.push({
        id: id++,
        name: def.name,
        color: def.color,
        rank: def.rank,
      })
    }
  }
  return deck
}

export const CROSS_POSITIONS: ChessPos[] = ['center', 'top', 'bottom', 'left', 'right']

export function shuffleDeck<T>(array: T[]): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function drawCrossSlots(seedDeck?: ChessPiece[]): Record<ChessPos, CrossSlot> {
  const deck = seedDeck ? [...seedDeck] : shuffleDeck(createFullDeck())
  const slots: Partial<Record<ChessPos, CrossSlot>> = {}

  for (let i = 0; i < CROSS_POSITIONS.length; i++) {
    const pos = CROSS_POSITIONS[i]
    slots[pos] = {
      pos,
      piece: deck[i],
      revealed: false,
    }
  }

  return slots as Record<ChessPos, CrossSlot>
}
