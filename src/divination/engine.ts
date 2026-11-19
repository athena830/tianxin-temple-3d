/**
 * 天心仙姑 卜卦核心運算引擎 (Divination Engine)
 * 獨立 TypeScript 卜卦邏輯引擎，嚴格遵循 PDF 規範：
 * 1. 固定 5 顆十字布局靜態分析 [0:中, 1:左, 2:右, 3:上, 4:下]
 * 2. 中央棋子顏色定義「自己」 (mySide)
 * 3. 17 大格局家族依序判定
 * 4. 保護規則 (一枝獨秀格、鬱卒格、眾星拱月格)
 * 5. 好朋友格全卦逐筆減半 (向下取整)
 * 6. 捕捉計分累加至 gains / losses
 */

import type {
  ChessPiece,
  ChessPos,
  CrossSlot,
  DivinationAnalysis,
  CrossGuaResult,
  GuaLevel,
} from './types'
import { POS_META } from './types'
import { evaluateFormations } from './formations'
import { canCapture } from './rules'

/**
 * 分析一輪 5 顆棋子的靜態卦象（依據 PDF 第 05、10 章標準算法）
 * pieces 陣列索引順序：[0:中, 1:左, 2:右, 3:上, 4:下]
 */
export function analyzeDivination(pieces: ChessPiece[]): DivinationAnalysis {
  // 1. 不足五顆：格局清單為空；收獲與付出都為 0，吃子紀錄空
  if (pieces.length < 5) {
    return {
      pieces: [...pieces],
      mySide: pieces[0]?.isRed ?? true,
      formations: [],
      gains: 0,
      losses: 0,
      compareSymbol: '=',
      records: [],
      protectedColor: null,
      hasGoodFriends: false,
    }
  }

  // 2. 先用原始五顆棋判定全部格局
  const formations = evaluateFormations(pieces)

  // 3. mySide = pieces[0].isRed（中央棋的顏色定義「自己」）
  const mySide = pieces[0].isRed

  // 4. 依格局判斷保護顏色
  // - 一枝獨秀格：保護外圍唯一異色棋的顏色
  // - 鬱卒格：保護黑色，即中央黑棋
  // - 眾星拱月格：保護紅色，即中央紅棋
  let protectedColor: boolean | null = null

  const hasUniqueFlower = formations.some(f => f.name === '一枝獨秀格')
  const hasDepressed = formations.some(f => f.name === '鬱卒格')
  const hasStarsMoon = formations.some(f => f.name === '眾星拱月格')

  if (hasUniqueFlower) {
    // 找出外圍 4 顆中唯一的異色棋
    const outerPieces = [pieces[1], pieces[2], pieces[3], pieces[4]]
    const redCount = outerPieces.filter(p => p.isRed).length
    // 若外圍有 1 紅 3 黑，唯一異色是紅 (true)；若有 3 紅 1 黑，唯一異色是黑 (false)
    protectedColor = redCount === 1
  } else if (hasDepressed) {
    protectedColor = false // 保護黑色
  } else if (hasStarsMoon) {
    protectedColor = true // 保護紅色
  }

  // 判斷是否存在「好朋友格」
  const hasGoodFriends = formations.some(f => f.name === '好朋友格')

  // 5. 遍歷 i = 0..4，再遍歷 j = 0..4 計算捕捉
  let gains = 0
  let losses = 0
  const records = []

  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 5; j++) {
      // 排除自己
      if (i === j) continue

      const attacker = pieces[i]
      const target = pieces[j]

      // 排除同色
      if (attacker.isRed === target.isRed) continue

      // 排除受保護的目標顏色
      if (protectedColor !== null && target.isRed === protectedColor) continue

      // 判斷是否允許捕捉
      if (canCapture(attacker, i, target, j)) {
        let score = target.value
        // 若有好朋友格，全卦每筆有效捕捉逐筆減半向下取整
        if (hasGoodFriends) {
          score = Math.floor(score / 2)
        }

        const isGain = attacker.isRed === mySide
        if (isGain) {
          gains += score
        } else {
          losses += score
        }

        records.push({
          attacker,
          target,
          attackerPos: i,
          targetPos: j,
          score,
          isGain,
        })
      }
    }
  }

  // 比較符號
  const compareSymbol: '>' | '<' | '=' =
    gains > losses ? '>' : gains < losses ? '<' : '='

  return {
    pieces: [...pieces],
    mySide,
    formations,
    gains,
    losses,
    compareSymbol,
    records,
    protectedColor,
    hasGoodFriends,
  }
}

/**
 * 依據收獲/付出分數與格局綜合判定吉凶等第
 */
export function determineGuaLevel(analysis: DivinationAnalysis): GuaLevel {
  const { gains, losses, formations } = analysis

  if (gains >= 100 && gains > losses * 1.5) {
    return '大吉'
  }
  if (formations.some(f => f.name.includes('紅傘') || f.name === '十字天助格' || f.name.includes('正桃花'))) {
    if (gains >= losses) return '大吉'
  }
  if (gains > losses) {
    return '吉'
  }
  if (gains === losses) {
    return '平'
  }
  if (analysis.hasGoodFriends || analysis.protectedColor !== null) {
    return '守中'
  }
  return '需慎'
}

/**
 * 產生各星位解讀短語
 */
function getPosAspectDescription(piece: ChessPiece, pos: ChessPos): string {
  const meta = POS_META[pos]
  const colorText = piece.isRed ? '紅' : '黑'
  return `【${meta.label}・${meta.aspect}】得${colorText}方【${piece.character}】（${piece.value}分），${meta.desc}。`
}

/**
 * 整合 3D 問事亭的卦象展示結果
 * 接受 3D 介面中的 slots 物件，計算並回傳完整的卦象資訊
 */
export function evaluateCrossGua(slots: Record<ChessPos, CrossSlot>): CrossGuaResult {
  // 將 slots 依順序轉換為 5 顆棋子陣列：[0:中, 1:左, 2:右, 3:上, 4:下]
  const pieces: ChessPiece[] = [
    slots.center.piece,
    slots.left.piece,
    slots.right.piece,
    slots.top.piece,
    slots.bottom.piece,
  ]

  const analysis = analyzeDivination(pieces)
  const revealedCount = Object.values(slots).filter(s => s.revealed).length
  const allRevealed = revealedCount === 5

  // 格局名稱與仙姑評語
  let patternName = '順應自然・常態平順'
  if (analysis.formations.length > 0) {
    // 依序呈現格局名稱
    patternName = analysis.formations.map(f => f.name).join(' · ')
  }

  const level = determineGuaLevel(analysis)

  let summary = ''
  let advice = ''

  if (analysis.formations.length > 0) {
    // 仙姑總評直接採用主格局原文描述
    summary = analysis.formations[0].description
    advice = `本卦收獲 ${analysis.gains} 分 ${analysis.compareSymbol} 付出 ${analysis.losses} 分。${
      analysis.hasGoodFriends ? '卦中逢好朋友格，得貴人互助協調，力量減半包容。' : ''
    }${
      analysis.protectedColor !== null
        ? `卦現護身之象，${analysis.protectedColor ? '紅方' : '黑方'}受庇佑免於折損。`
        : ''
    }請依循當下心念，穩健應對。`
  } else {
    summary = `局勢平順穩當，收獲 ${analysis.gains} 分與付出 ${analysis.losses} 分相映，內外平衡，無明顯極端消耗或衝突。`
    advice = `收獲 ${analysis.gains} 分 ${analysis.compareSymbol} 付出 ${analysis.losses} 分。凡事順勢而為，步步為營，持之以恆即可得吉。`
  }

  return {
    slots,
    revealedCount,
    allRevealed,
    analysis,
    patternName,
    level,
    summary,
    advice,
    posInterpretations: {
      center: getPosAspectDescription(slots.center.piece, 'center'),
      left: getPosAspectDescription(slots.left.piece, 'left'),
      right: getPosAspectDescription(slots.right.piece, 'right'),
      top: getPosAspectDescription(slots.top.piece, 'top'),
      bottom: getPosAspectDescription(slots.bottom.piece, 'bottom'),
    },
  }
}
