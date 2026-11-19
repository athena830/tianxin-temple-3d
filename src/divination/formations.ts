/**
 * 天心仙姑 17 大格局家族判定邏輯
 * 依據 PDF 第 06 章「全部格局條件與完整原文」
 * 嚴格按照 01 到 17 順序逐項判定，互不排斥，依序加入清單
 */

import type { ChessPiece, Formation } from './types'
import {
  FAIRY_DICTIONARY,
  buildConsumptionDescription,
} from './dictionary'
import { isGoodFriendPair, isPeachBlossomPair } from './rules'

/**
 * 判定 5 顆棋子的全部格局
 * pieces 陣列固定為：[0:中, 1:左, 2:右, 3:上, 4:下]
 */
export function evaluateFormations(pieces: ChessPiece[]): Formation[] {
  if (pieces.length < 5) return []

  const formations: Formation[] = []

  const p0 = pieces[0] // 中 (定義自己)
  const p1 = pieces[1] // 左
  const p2 = pieces[2] // 右
  const p3 = pieces[3] // 上
  const p4 = pieces[4] // 下

  // -------------------------------------------------------------
  // 01. 雨傘格
  // 規則：1、2、3 同色；0、4 同色且與 1、2、3 相反。1 是黑色輸出黑傘，否則紅傘。
  // -------------------------------------------------------------
  const umbrellaOuterSame = p1.isRed === p2.isRed && p2.isRed === p3.isRed
  const umbrellaCenterSame = p0.isRed === p4.isRed
  if (umbrellaOuterSame && umbrellaCenterSame && p1.isRed !== p0.isRed) {
    if (!p1.isRed) {
      formations.push({ ...FAIRY_DICTIONARY.umbrellaBlack })
    } else {
      formations.push({ ...FAIRY_DICTIONARY.umbrellaRed })
    }
  }

  // -------------------------------------------------------------
  // 02. 十字天助格
  // 規則：符合任一：
  // (1) 0、3、4 同色，1、2 為另一色
  // (2) 0、1、2 同色，3、4 為另一色
  // -------------------------------------------------------------
  const cross1 =
    p0.isRed === p3.isRed &&
    p0.isRed === p4.isRed &&
    p1.isRed === p2.isRed &&
    p1.isRed !== p0.isRed

  const cross2 =
    p0.isRed === p1.isRed &&
    p0.isRed === p2.isRed &&
    p3.isRed === p4.isRed &&
    p3.isRed !== p0.isRed

  if (cross1 || cross2) {
    formations.push({ ...FAIRY_DICTIONARY.crossHeaven })
  }

  // -------------------------------------------------------------
  // 03. 好朋友格
  // 規則：
  // 一般類型（帥將、仕士、相象、俥車、兵卒）：中央與任一外圍為好朋友配對即成立。
  // 馬類只看外圍對 (1,3)、(2,3)、(2,4)、(4,1)。
  // 炮類只看 (1,2)、(3,4)。
  // 中央馬或炮與外圍配對不算好朋友格。成立後全卦有效捕捉逐筆減半。
  // -------------------------------------------------------------
  let hasGoodFriendFormation = false

  // 檢查一般類型（中央與外圍 1..4）
  const outerIndices = [1, 2, 3, 4]
  for (const k of outerIndices) {
    const pk = pieces[k]
    if (isGoodFriendPair(p0, pk)) {
      if (p0.family !== 'horse' && p0.family !== 'cannon') {
        hasGoodFriendFormation = true
        break
      }
    }
  }

  // 檢查馬類外圍對 (1,3)、(2,3)、(2,4)、(4,1)
  if (!hasGoodFriendFormation) {
    const horsePairs = [[1, 3], [2, 3], [2, 4], [4, 1]]
    for (const [i, j] of horsePairs) {
      if (pieces[i].family === 'horse' && isGoodFriendPair(pieces[i], pieces[j])) {
        hasGoodFriendFormation = true
        break
      }
    }
  }

  // 檢查炮類外圍對 (1,2)、(3,4)
  if (!hasGoodFriendFormation) {
    const cannonPairs = [[1, 2], [3, 4]]
    for (const [i, j] of cannonPairs) {
      if (pieces[i].family === 'cannon' && isGoodFriendPair(pieces[i], pieces[j])) {
        hasGoodFriendFormation = true
        break
      }
    }
  }

  if (hasGoodFriendFormation) {
    formations.push({ ...FAIRY_DICTIONARY.goodFriends })
  }

  // -------------------------------------------------------------
  // 04. 好人緣格
  // 規則：外圍好朋友配對位於全部六種外圍兩兩配對之一；不限字種，不含中央。不改分數。
  // -------------------------------------------------------------
  let hasGoodRelationsFormation = false
  for (let i = 1; i <= 4; i++) {
    for (let j = i + 1; j <= 4; j++) {
      if (isGoodFriendPair(pieces[i], pieces[j])) {
        hasGoodRelationsFormation = true
        break
      }
    }
    if (hasGoodRelationsFormation) break
  }
  if (hasGoodRelationsFormation) {
    formations.push({ ...FAIRY_DICTIONARY.goodRelations })
  }

  // -------------------------------------------------------------
  // 05. 事業格
  // 規則：五顆中至少一個車類、馬類、炮類；不限制位置、同色或異色。
  // -------------------------------------------------------------
  const hasChariot = pieces.some(p => p.family === 'chariot')
  const hasHorse = pieces.some(p => p.family === 'horse')
  const hasCannon = pieces.some(p => p.family === 'cannon')
  if (hasChariot && hasHorse && hasCannon) {
    formations.push({ ...FAIRY_DICTIONARY.careerFormation })
  }

  // -------------------------------------------------------------
  // 06. 富貴格
  // 規則：五顆中至少一個將類、士類、象類；不限制位置、同色或異色。
  // -------------------------------------------------------------
  const hasGeneral = pieces.some(p => p.family === 'general')
  const hasAdvisor = pieces.some(p => p.family === 'advisor')
  const hasElephant = pieces.some(p => p.family === 'elephant')
  if (hasGeneral && hasAdvisor && hasElephant) {
    formations.push({ ...FAIRY_DICTIONARY.wealthFormation })
  }

  // -------------------------------------------------------------
  // 07. 勝利格
  // 規則：1、2、4 同色且與 0 相反；3 不限制。
  // 中央與 1、2、4 之中任一棋為好朋友配對，輸出內在，否則外在。
  // -------------------------------------------------------------
  const isVColorSame = p1.isRed === p2.isRed && p2.isRed === p4.isRed
  if (isVColorSame && p1.isRed !== p0.isRed) {
    const centerPairsWithV =
      isGoodFriendPair(p0, p1) ||
      isGoodFriendPair(p0, p2) ||
      isGoodFriendPair(p0, p4)

    if (centerPairsWithV) {
      formations.push({ ...FAIRY_DICTIONARY.victoryInner })
    } else {
      formations.push({ ...FAIRY_DICTIONARY.victoryOuter })
    }
  }

  // -------------------------------------------------------------
  // 08. 桃花格
  // 規則：
  // 正桃花：桃花配對在 (1,2) 或 (3,4)。
  // 偏桃花：桃花配對在 (2,3)、(4,1)，或中央與任一外圍 (0,1),(0,2),(0,3),(0,4)。
  // 純 (1,3) 或 (2,4) 不算偏桃花。正與偏可同時出現，各加入一次。
  // -------------------------------------------------------------
  const hasTruePeach =
    isPeachBlossomPair(p1, p2) ||
    isPeachBlossomPair(p3, p4)

  const hasPartialPeach =
    isPeachBlossomPair(p2, p3) ||
    isPeachBlossomPair(p4, p1) ||
    isPeachBlossomPair(p0, p1) ||
    isPeachBlossomPair(p0, p2) ||
    isPeachBlossomPair(p0, p3) ||
    isPeachBlossomPair(p0, p4)

  if (hasTruePeach) {
    formations.push({ ...FAIRY_DICTIONARY.peachBlossomTrue })
  }
  if (hasPartialPeach) {
    formations.push({ ...FAIRY_DICTIONARY.peachBlossomPartial })
  }

  // -------------------------------------------------------------
  // 09. 分離格
  // 規則：好朋友配對在 (1,2) 或 (3,4)，但排除炮／包。找到任一對即加入一次。
  // -------------------------------------------------------------
  const sep12 = isGoodFriendPair(p1, p2) && p1.family !== 'cannon'
  const sep34 = isGoodFriendPair(p3, p4) && p3.family !== 'cannon'
  if (sep12 || sep34) {
    formations.push({ ...FAIRY_DICTIONARY.separation })
  }

  // -------------------------------------------------------------
  // 10. 一枝獨秀格
  // 規則：外圍四色有 3:1，中央與多數同色，整體形成 4:1；唯一異色棋在外圍。
  // -------------------------------------------------------------
  const outerReds = [p1, p2, p3, p4].filter(p => p.isRed).length
  const outerBlacks = 4 - outerReds
  if (
    (outerReds === 3 && outerBlacks === 1 && p0.isRed) ||
    (outerBlacks === 3 && outerReds === 1 && !p0.isRed)
  ) {
    formations.push({ ...FAIRY_DICTIONARY.uniqueFlower })
  }

  // -------------------------------------------------------------
  // 11. 鬱卒格
  // 規則：中央黑色、四顆外圍全紅。
  // -------------------------------------------------------------
  if (!p0.isRed && p1.isRed && p2.isRed && p3.isRed && p4.isRed) {
    formations.push({ ...FAIRY_DICTIONARY.depressed })
  }

  // -------------------------------------------------------------
  // 12. 眾星拱月格
  // 規則：中央紅色、四顆外圍全黑。
  // -------------------------------------------------------------
  if (p0.isRed && !p1.isRed && !p2.isRed && !p3.isRed && !p4.isRed) {
    formations.push({ ...FAIRY_DICTIONARY.starsMoon })
  }

  // -------------------------------------------------------------
  // 13. 困擾格
  // 規則：依索引 0 到 4，對每個尚未使用位置 i，往後尋找第一個未使用位置 j 的好朋友配對；
  // 找到就占用 i、j 並加 1。至少兩對不共享棋子即成立。
  // -------------------------------------------------------------
  const troubleUsed = new Set<number>()
  let troublePairCount = 0
  for (let i = 0; i < 5; i++) {
    if (troubleUsed.has(i)) continue
    for (let j = i + 1; j < 5; j++) {
      if (troubleUsed.has(j)) continue
      if (isGoodFriendPair(pieces[i], pieces[j])) {
        troubleUsed.add(i)
        troubleUsed.add(j)
        troublePairCount++
        break
      }
    }
  }
  if (troublePairCount >= 2) {
    formations.push({ ...FAIRY_DICTIONARY.trouble })
  }

  // -------------------------------------------------------------
  // 14. 三人同心格
  // 規則：至少 3 顆「卒」或至少 3 顆「兵」，同字同色分開計數。
  // 中央也是該字則為內在，否則外在。
  // -------------------------------------------------------------
  const zuCount = pieces.filter(p => p.character === '卒').length
  const bingCount = pieces.filter(p => p.character === '兵').length

  if (zuCount >= 3) {
    if (p0.character === '卒') {
      formations.push({ ...FAIRY_DICTIONARY.threeTogetherZuCenter })
    } else {
      formations.push({ ...FAIRY_DICTIONARY.threeTogetherZuOuter })
    }
  } else if (bingCount >= 3) {
    if (p0.character === '兵') {
      formations.push({ ...FAIRY_DICTIONARY.threeTogetherBingCenter })
    } else {
      formations.push({ ...FAIRY_DICTIONARY.threeTogetherBingOuter })
    }
  }

  // -------------------------------------------------------------
  // 15. 破壞格
  // 規則：依兵、士、象、車、馬、炮的類型順序查找；同類至少 3 顆且一色恰為 1 顆、另一色至少 2 顆。
  // 多色等於中央色為內在，否則外在；找到第一個類型後停止。將帥不列入；2:2 不成立。
  // -------------------------------------------------------------
  const destructionOrder: Array<ChessPiece['family']> = [
    'soldier',
    'advisor',
    'elephant',
    'chariot',
    'horse',
    'cannon',
  ]

  for (const fam of destructionOrder) {
    const famPieces = pieces.filter(p => p.family === fam)
    if (famPieces.length >= 3) {
      const redCount = famPieces.filter(p => p.isRed).length
      const blackCount = famPieces.length - redCount
      const isOneToMany =
        (redCount === 1 && blackCount >= 2) ||
        (blackCount === 1 && redCount >= 2)

      if (isOneToMany) {
        const majorityIsRed = redCount > blackCount
        const isInner = majorityIsRed === p0.isRed
        if (isInner) {
          formations.push({ ...FAIRY_DICTIONARY.destructionInner })
        } else {
          formations.push({ ...FAIRY_DICTIONARY.destructionOuter })
        }
        break // 找到第一個類型後停止
      }
    }
  }

  // -------------------------------------------------------------
  // 16. 互相欣賞格
  // 規則：任意位置有黑士和紅俥，或紅仕和黑車。只需要存在，不檢查接近或吃子。
  // -------------------------------------------------------------
  const hasBlackShi = pieces.some(p => p.character === '士')
  const hasRedChe = pieces.some(p => p.character === '俥')
  const hasRedShi = pieces.some(p => p.character === '仕')
  const hasBlackChe = pieces.some(p => p.character === '車')

  if ((hasBlackShi && hasRedChe) || (hasRedShi && hasBlackChe)) {
    formations.push({ ...FAIRY_DICTIONARY.appreciation })
  }

  // -------------------------------------------------------------
  // 17. 消耗格
  // 規則：遍歷所有 i<j，同字且同色即每對加一筆「消耗格」。
  // 顏色同中央為自己消耗，否則外在消耗；紅色較不明顯、黑色較明顯。
  // 同字 3 顆輸出 3 對、4 顆輸出 6 對、5 顆輸出 10 對；不改計分。
  // -------------------------------------------------------------
  for (let i = 0; i < 5; i++) {
    for (let j = i + 1; j < 5; j++) {
      if (
        pieces[i].character === pieces[j].character &&
        pieces[i].isRed === pieces[j].isRed
      ) {
        const char = pieces[i].character
        const isSameAsCenter = pieces[i].isRed === p0.isRed
        const isRed = pieces[i].isRed
        const desc = buildConsumptionDescription(char, isSameAsCenter, isRed)
        formations.push({
          name: '消耗格',
          description: desc,
        })
      }
    }
  }

  return formations
}
