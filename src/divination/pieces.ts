/**
 * 天心仙姑 32 顆實體棋定義與牌組操作
 * 依據 PDF 標準的 32 顆實體索引 (0 起算)
 */

import type { ChessPiece, ChessPos, CrossSlot } from './types'

/**
 * 完整棋組共 32 顆：紅方 16 顆、黑方 16 顆。每一顆實體棋有獨立索引。
 *
 * 實體索引配置：
 * 0: 帥 (80)
 * 1–2: 仕 (60)
 * 3–4: 相 (40)
 * 5–6: 俥 (30)
 * 7–8: 傌 (20)
 * 9–10: 炮 (15)
 * 11–15: 兵 (10)
 * 16: 將 (80)
 * 17–18: 士 (60)
 * 19–20: 象 (40)
 * 21–22: 車 (30)
 * 23–24: 馬 (20)
 * 25–26: 包 (15)
 * 27–31: 卒 (10)
 */
export const ALL_PIECES: readonly ChessPiece[] = Object.freeze([
  // 紅方 (0 ~ 15)
  { id: 0, character: '帥', name: '帥', isRed: true, color: 'red', value: 80, rank: 7, family: 'general' },
  { id: 1, character: '仕', name: '仕', isRed: true, color: 'red', value: 60, rank: 2, family: 'advisor' },
  { id: 2, character: '仕', name: '仕', isRed: true, color: 'red', value: 60, rank: 2, family: 'advisor' },
  { id: 3, character: '相', name: '相', isRed: true, color: 'red', value: 40, rank: 3, family: 'elephant' },
  { id: 4, character: '相', name: '相', isRed: true, color: 'red', value: 40, rank: 3, family: 'elephant' },
  { id: 5, character: '俥', name: '俥', isRed: true, color: 'red', value: 30, rank: 6, family: 'chariot' },
  { id: 6, character: '俥', name: '俥', isRed: true, color: 'red', value: 30, rank: 6, family: 'chariot' },
  { id: 7, character: '傌', name: '傌', isRed: true, color: 'red', value: 20, rank: 5, family: 'horse' },
  { id: 8, character: '傌', name: '傌', isRed: true, color: 'red', value: 20, rank: 5, family: 'horse' },
  { id: 9, character: '炮', name: '炮', isRed: true, color: 'red', value: 15, rank: 4, family: 'cannon' },
  { id: 10, character: '炮', name: '炮', isRed: true, color: 'red', value: 15, rank: 4, family: 'cannon' },
  { id: 11, character: '兵', name: '兵', isRed: true, color: 'red', value: 10, rank: 1, family: 'soldier' },
  { id: 12, character: '兵', name: '兵', isRed: true, color: 'red', value: 10, rank: 1, family: 'soldier' },
  { id: 13, character: '兵', name: '兵', isRed: true, color: 'red', value: 10, rank: 1, family: 'soldier' },
  { id: 14, character: '兵', name: '兵', isRed: true, color: 'red', value: 10, rank: 1, family: 'soldier' },
  { id: 15, character: '兵', name: '兵', isRed: true, color: 'red', value: 10, rank: 1, family: 'soldier' },

  // 黑方 (16 ~ 31)
  { id: 16, character: '將', name: '將', isRed: false, color: 'black', value: 80, rank: 7, family: 'general' },
  { id: 17, character: '士', name: '士', isRed: false, color: 'black', value: 60, rank: 2, family: 'advisor' },
  { id: 18, character: '士', name: '士', isRed: false, color: 'black', value: 60, rank: 2, family: 'advisor' },
  { id: 19, character: '象', name: '象', isRed: false, color: 'black', value: 40, rank: 3, family: 'elephant' },
  { id: 20, character: '象', name: '象', isRed: false, color: 'black', value: 40, rank: 3, family: 'elephant' },
  { id: 21, character: '車', name: '車', isRed: false, color: 'black', value: 30, rank: 6, family: 'chariot' },
  { id: 22, character: '車', name: '車', isRed: false, color: 'black', value: 30, rank: 6, family: 'chariot' },
  { id: 23, character: '馬', name: '馬', isRed: false, color: 'black', value: 20, rank: 5, family: 'horse' },
  { id: 24, character: '馬', name: '馬', isRed: false, color: 'black', value: 20, rank: 5, family: 'horse' },
  { id: 25, character: '包', name: '包', isRed: false, color: 'black', value: 15, rank: 4, family: 'cannon' },
  { id: 26, character: '包', name: '包', isRed: false, color: 'black', value: 15, rank: 4, family: 'cannon' },
  { id: 27, character: '卒', name: '卒', isRed: false, color: 'black', value: 10, rank: 1, family: 'soldier' },
  { id: 28, character: '卒', name: '卒', isRed: false, color: 'black', value: 10, rank: 1, family: 'soldier' },
  { id: 29, character: '卒', name: '卒', isRed: false, color: 'black', value: 10, rank: 1, family: 'soldier' },
  { id: 30, character: '卒', name: '卒', isRed: false, color: 'black', value: 10, rank: 1, family: 'soldier' },
  { id: 31, character: '卒', name: '卒', isRed: false, color: 'black', value: 10, rank: 1, family: 'soldier' },
])

/**
 * 依據實體編號 0 ~ 31 獲取棋子
 */
export function getPieceById(id: number): ChessPiece {
  const piece = ALL_PIECES[id]
  if (!piece) {
    throw new Error(`Invalid piece id: ${id}. Must be between 0 and 31.`)
  }
  return { ...piece }
}

/**
 * 建立完整 32 顆新牌組副本
 */
export function createFullDeck(): ChessPiece[] {
  return ALL_PIECES.map(p => ({ ...p }))
}

/**
 * 依抽取次序對應的五個位置：
 * 0: 中 (第 1 顆)
 * 1: 左 (第 2 顆)
 * 2: 右 (第 3 顆)
 * 3: 上 (第 4 顆)
 * 4: 下 (第 5 顆)
 */
export const CROSS_POSITIONS: ChessPos[] = ['center', 'left', 'right', 'top', 'bottom']

/**
 * 隨機抽取 5 顆不重複實體棋子（依 PDF 第 03 章規格）
 * available.sort(() => Math.random() - 0.5)，取前 5 顆
 */
export function drawRandomCrossPieces(usedIds?: Set<number>): ChessPiece[] {
  const available = ALL_PIECES.filter(p => !usedIds || !usedIds.has(p.id))
  if (available.length < 5) {
    throw new Error(`牌組剩餘棋子不足 5 顆（剩餘 ${available.length} 顆）`)
  }

  // 依 PDF 規範：available.sort(() => Math.random() - 0.5)
  const shuffled = [...available].sort(() => Math.random() - 0.5)
  const drawn = shuffled.slice(0, 5)

  if (usedIds) {
    drawn.forEach(p => usedIds.add(p.id))
  }

  return drawn
}

/**
 * 產生 3D 介面或槽位使用的十字五星結構
 */
export function drawCrossSlots(seedPieces?: ChessPiece[], usedIds?: Set<number>): Record<ChessPos, CrossSlot> {
  const pieces = seedPieces ?? drawRandomCrossPieces(usedIds)
  const slots: Partial<Record<ChessPos, CrossSlot>> = {}

  for (let i = 0; i < CROSS_POSITIONS.length; i++) {
    const pos = CROSS_POSITIONS[i]
    slots[pos] = {
      pos,
      index: i,
      piece: pieces[i],
      revealed: false,
    }
  }

  return slots as Record<ChessPos, CrossSlot>
}
