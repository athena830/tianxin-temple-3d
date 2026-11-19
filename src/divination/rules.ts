/**
 * 天心仙姑 十字吃子捕捉規則與配對邏輯
 * 依據 PDF 第 05 章「捕捉規則與分數算法」與第 06 章「同類異色配對與桃花配對」
 */

import type { ChessPiece, PieceFamily } from './types'

/**
 * 檢查兩顆棋子是否為「好朋友配對」（同類異色配對）：
 * 帥↔將、仕↔士、相↔象、俥↔車、傌↔馬、炮↔包、兵↔卒，且顏色相反
 */
export function isGoodFriendPair(p1: ChessPiece, p2: ChessPiece): boolean {
  if (p1.isRed === p2.isRed) return false
  return p1.family === p2.family
}

/**
 * 檢查兩顆棋子是否為「桃花配對」：
 * 限定：黑包＋紅炮、黑包＋紅帥、紅炮＋黑將；順序可互換
 */
export function isPeachBlossomPair(p1: ChessPiece, p2: ChessPiece): boolean {
  if (p1.isRed === p2.isRed) return false

  const red = p1.isRed ? p1 : p2
  const black = p1.isRed ? p2 : p1

  // 1. 黑包 + 紅炮
  if (black.character === '包' && red.character === '炮') return true
  // 2. 黑包 + 紅帥
  if (black.character === '包' && red.character === '帥') return true
  // 3. 紅炮 + 黑將
  if (red.character === '炮' && black.character === '將') return true

  return false
}

/**
 * 判斷位置 fromPos 上的 attacker 是否能捕捉 toPos 上的 target
 *
 * 位置索引：
 * 0: 中
 * 1: 左
 * 2: 右
 * 3: 上
 * 4: 下
 *
 * 捕捉規則（PDF 第 05 章）：
 * - 炮／包：左 ↔ 右 (1 ↔ 2)；上 ↔ 下 (3 ↔ 4)；中央炮不能吃任何位置。無字種限制。
 * - 傌／馬：左 ↔ 上 (1 ↔ 3)、右 ↔ 上 (2 ↔ 3)、右 ↔ 下 (2 ↔ 4)、左 ↔ 下 (1 ↔ 4)。中央馬不能吃。無字種限制。
 * - 兵／卒：中 → 左、右、上 (0 → 1, 2, 3)；左 → 中 (1 → 0)；右 → 中 (2 → 0)；下 → 中 (4 → 0)；上不能吃。無字種限制；紅黑同向。
 * - 俥／車、帥／將：中 ↔ 左、右、上、下 (0 ↔ 1, 2, 3, 4)。無字種限制。
 * - 仕／士：中 ↔ 左、右、上、下 (0 ↔ 1, 2, 3, 4)。不能吃帥／將。
 * - 相／象：中 ↔ 左、右、上、下 (0 ↔ 1, 2, 3, 4)。不能吃帥／將、仕／士。
 */
export function canCapture(
  attacker: ChessPiece,
  fromPos: number,
  target: ChessPiece,
  toPos: number
): boolean {
  // 同位置不可自吃
  if (fromPos === toPos) return false

  // 同色不可互吃
  if (attacker.isRed === target.isRed) return false

  const family: PieceFamily = attacker.family

  switch (family) {
    case 'cannon': {
      // 炮／包：左 ↔ 右 (1 ↔ 2)；上 ↔ 下 (3 ↔ 4)；中央炮不能吃任何位置
      if (fromPos === 0) return false
      const isLeftRight = (fromPos === 1 && toPos === 2) || (fromPos === 2 && toPos === 1)
      const isUpDown = (fromPos === 3 && toPos === 4) || (fromPos === 4 && toPos === 3)
      return isLeftRight || isUpDown
    }

    case 'horse': {
      // 傌／馬：左 ↔ 上、右 ↔ 上、右 ↔ 下、左 ↔ 下。中央馬不能吃
      if (fromPos === 0) return false
      const validPairs = [
        [1, 3], [3, 1], // 左 ↔ 上
        [2, 3], [3, 2], // 右 ↔ 上
        [2, 4], [4, 2], // 右 ↔ 下
        [1, 4], [4, 1], // 左 ↔ 下
      ]
      return validPairs.some(([f, t]) => f === fromPos && t === toPos)
    }

    case 'soldier': {
      // 兵／卒：中 → 左、右、上；左 → 中；右 → 中；下 → 中；上不能吃
      if (fromPos === 0) {
        // 中 → 左 (1)、右 (2)、上 (3)
        return toPos === 1 || toPos === 2 || toPos === 3
      }
      if (fromPos === 1 && toPos === 0) return true // 左 → 中
      if (fromPos === 2 && toPos === 0) return true // 右 → 中
      if (fromPos === 4 && toPos === 0) return true // 下 → 中
      // 上 (3) 不能吃任何位置
      return false
    }

    case 'chariot':
    case 'general': {
      // 俥／車、帥／將：中 ↔ 左、右、上、下。無字種限制
      const isCenterToOuter = fromPos === 0 && (toPos >= 1 && toPos <= 4)
      const isOuterToCenter = (fromPos >= 1 && fromPos <= 4) && toPos === 0
      return isCenterToOuter || isOuterToCenter
    }

    case 'advisor': {
      // 仕／士：中 ↔ 左、右、上、下。不能吃帥／將
      if (target.family === 'general') return false
      const isCenterToOuter = fromPos === 0 && (toPos >= 1 && toPos <= 4)
      const isOuterToCenter = (fromPos >= 1 && fromPos <= 4) && toPos === 0
      return isCenterToOuter || isOuterToCenter
    }

    case 'elephant': {
      // 相／象：中 ↔ 左、右、上、下。不能吃帥／將、仕／士
      if (target.family === 'general' || target.family === 'advisor') return false
      const isCenterToOuter = fromPos === 0 && (toPos >= 1 && toPos <= 4)
      const isOuterToCenter = (fromPos >= 1 && fromPos <= 4) && toPos === 0
      return isCenterToOuter || isOuterToCenter
    }

    default:
      return false
  }
}
