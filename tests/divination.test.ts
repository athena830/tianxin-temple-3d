import { describe, expect, it } from 'vitest'
import {
  createFullDeck,
  getPieceById,
  drawCrossSlots,
  drawRandomCrossPieces,
  CROSS_POSITIONS,
  canCapture,
  evaluateFormations,
  analyzeDivination,
  evaluateCrossGua,
  FAIRY_DICTIONARY,
  type ChessPiece,
} from '../src/divination'

describe('天心仙姑 象棋卜卦標準演算法 (PDF 規格驗證)', () => {
  describe('02｜32 顆實體棋定義與資料模型', () => {
    it('完整棋組共 32 顆：紅方 16 顆、黑方 16 顆，且索引 0~31 不重複', () => {
      const deck = createFullDeck()
      expect(deck.length).toBe(32)

      const redPieces = deck.filter(p => p.isRed)
      const blackPieces = deck.filter(p => !p.isRed)
      expect(redPieces.length).toBe(16)
      expect(blackPieces.length).toBe(16)

      const idSet = new Set(deck.map(p => p.id))
      expect(idSet.size).toBe(32)
      for (let i = 0; i < 32; i++) {
        expect(idSet.has(i)).toBe(true)
      }
    })

    it('驗證固定實體索引與被吃分數配置', () => {
      // 0 帥(80)
      expect(getPieceById(0)).toMatchObject({ character: '帥', isRed: true, value: 80, family: 'general' })
      // 1–2 仕(60)
      expect(getPieceById(1)).toMatchObject({ character: '仕', isRed: true, value: 60, family: 'advisor' })
      expect(getPieceById(2)).toMatchObject({ character: '仕', isRed: true, value: 60, family: 'advisor' })
      // 3–4 相(40)
      expect(getPieceById(3)).toMatchObject({ character: '相', isRed: true, value: 40, family: 'elephant' })
      expect(getPieceById(4)).toMatchObject({ character: '相', isRed: true, value: 40, family: 'elephant' })
      // 5–6 俥(30)
      expect(getPieceById(5)).toMatchObject({ character: '俥', isRed: true, value: 30, family: 'chariot' })
      expect(getPieceById(6)).toMatchObject({ character: '俥', isRed: true, value: 30, family: 'chariot' })
      // 7–8 傌(20)
      expect(getPieceById(7)).toMatchObject({ character: '傌', isRed: true, value: 20, family: 'horse' })
      expect(getPieceById(8)).toMatchObject({ character: '傌', isRed: true, value: 20, family: 'horse' })
      // 9–10 炮(15)
      expect(getPieceById(9)).toMatchObject({ character: '炮', isRed: true, value: 15, family: 'cannon' })
      expect(getPieceById(10)).toMatchObject({ character: '炮', isRed: true, value: 15, family: 'cannon' })
      // 11–15 兵(10)
      for (let i = 11; i <= 15; i++) {
        expect(getPieceById(i)).toMatchObject({ character: '兵', isRed: true, value: 10, family: 'soldier' })
      }
      // 16 將(80)
      expect(getPieceById(16)).toMatchObject({ character: '將', isRed: false, value: 80, family: 'general' })
      // 17–18 士(60)
      expect(getPieceById(17)).toMatchObject({ character: '士', isRed: false, value: 60, family: 'advisor' })
      expect(getPieceById(18)).toMatchObject({ character: '士', isRed: false, value: 60, family: 'advisor' })
      // 19–20 象(40)
      expect(getPieceById(19)).toMatchObject({ character: '象', isRed: false, value: 40, family: 'elephant' })
      expect(getPieceById(20)).toMatchObject({ character: '象', isRed: false, value: 40, family: 'elephant' })
      // 21–22 車(30)
      expect(getPieceById(21)).toMatchObject({ character: '車', isRed: false, value: 30, family: 'chariot' })
      expect(getPieceById(22)).toMatchObject({ character: '車', isRed: false, value: 30, family: 'chariot' })
      // 23–24 馬(20)
      expect(getPieceById(23)).toMatchObject({ character: '馬', isRed: false, value: 20, family: 'horse' })
      expect(getPieceById(24)).toMatchObject({ character: '馬', isRed: false, value: 20, family: 'horse' })
      // 25–26 包(15)
      expect(getPieceById(25)).toMatchObject({ character: '包', isRed: false, value: 15, family: 'cannon' })
      expect(getPieceById(26)).toMatchObject({ character: '包', isRed: false, value: 15, family: 'cannon' })
      // 27–31 卒(10)
      for (let i = 27; i <= 31; i++) {
        expect(getPieceById(i)).toMatchObject({ character: '卒', isRed: false, value: 10, family: 'soldier' })
      }
    })

    it('不重複抽取 5 顆棋子，支援跨輪已使用集合', () => {
      const usedIds = new Set<number>()
      const round1 = drawRandomCrossPieces(usedIds)
      expect(round1.length).toBe(5)
      expect(usedIds.size).toBe(5)

      const round2 = drawRandomCrossPieces(usedIds)
      expect(round2.length).toBe(5)
      expect(usedIds.size).toBe(10)

      const round3 = drawRandomCrossPieces(usedIds)
      expect(round3.length).toBe(5)
      expect(usedIds.size).toBe(15)

      // 三輪 15 顆完全不重複
      expect(new Set(usedIds).size).toBe(15)
    })
  })

  describe('05｜十字捕捉規則細項測試', () => {
    const redShuai = getPieceById(0)   // 帥 (red, 0)
    const redChe = getPieceById(5)     // 俥 (red, 5)
    const redMa = getPieceById(7)      // 傌 (red, 7)
    const redPao = getPieceById(9)     // 炮 (red, 9)
    const redBing = getPieceById(11)   // 兵 (red, 11)
    const redShi = getPieceById(1)     // 仕 (red, 1)
    const redXiang = getPieceById(3)   // 相 (red, 3)

    const blackJiang = getPieceById(16) // 將 (black, 16)
    const blackChe = getPieceById(21)   // 車 (black, 21)
    const blackMa = getPieceById(23)    // 馬 (black, 23)
    const blackBao = getPieceById(25)   // 包 (black, 25)
    const blackZu = getPieceById(27)    // 卒 (black, 27)
    const blackShi = getPieceById(17)   // 士 (black, 17)
    const blackXiang = getPieceById(19) // 象 (black, 19)

    it('同色不能互吃，同位置不能自吃', () => {
      expect(canCapture(redShuai, 0, redChe, 1)).toBe(false)
      expect(canCapture(blackJiang, 0, blackChe, 1)).toBe(false)
      expect(canCapture(redShuai, 0, blackJiang, 0)).toBe(false)
    })

    it('炮／包：左 ↔ 右 (1 ↔ 2)、上 ↔ 下 (3 ↔ 4)；中央不能吃', () => {
      // 中央炮不能吃任何位置
      expect(canCapture(redPao, 0, blackJiang, 1)).toBe(false)
      expect(canCapture(redPao, 0, blackJiang, 3)).toBe(false)

      // 左 ↔ 右 (1 ↔ 2)
      expect(canCapture(redPao, 1, blackChe, 2)).toBe(true)
      expect(canCapture(blackBao, 2, redChe, 1)).toBe(true)

      // 上 ↔ 下 (3 ↔ 4)
      expect(canCapture(redPao, 3, blackChe, 4)).toBe(true)
      expect(canCapture(blackBao, 4, redChe, 3)).toBe(true)

      // 其他方向不可吃
      expect(canCapture(redPao, 1, blackChe, 3)).toBe(false)
      expect(canCapture(redPao, 2, blackChe, 4)).toBe(false)
    })

    it('傌／馬：斜角對吃 (1,3), (2,3), (2,4), (1,4)；中央不能吃', () => {
      // 中央馬不能吃
      expect(canCapture(redMa, 0, blackChe, 1)).toBe(false)
      expect(canCapture(blackMa, 0, redChe, 3)).toBe(false)

      // 左 ↔ 上 (1 ↔ 3)
      expect(canCapture(redMa, 1, blackChe, 3)).toBe(true)
      expect(canCapture(blackMa, 3, redChe, 1)).toBe(true)

      // 右 ↔ 上 (2 ↔ 3)
      expect(canCapture(redMa, 2, blackChe, 3)).toBe(true)
      expect(canCapture(blackMa, 3, redChe, 2)).toBe(true)

      // 右 ↔ 下 (2 ↔ 4)
      expect(canCapture(redMa, 2, blackChe, 4)).toBe(true)
      expect(canCapture(blackMa, 4, redChe, 2)).toBe(true)

      // 左 ↔ 下 (1 ↔ 4)
      expect(canCapture(redMa, 1, blackChe, 4)).toBe(true)
      expect(canCapture(blackMa, 4, redChe, 1)).toBe(true)

      // 左 ↔ 右 或 上 ↔ 下 不能吃
      expect(canCapture(redMa, 1, blackChe, 2)).toBe(false)
      expect(canCapture(redMa, 3, blackChe, 4)).toBe(false)
    })

    it('兵／卒：中 → 左/右/上；左/右/下 → 中；上不能吃', () => {
      // 中 (0) → 左 (1)、右 (2)、上 (3)
      expect(canCapture(redBing, 0, blackChe, 1)).toBe(true)
      expect(canCapture(redBing, 0, blackChe, 2)).toBe(true)
      expect(canCapture(redBing, 0, blackChe, 3)).toBe(true)
      // 中不能向下吃
      expect(canCapture(redBing, 0, blackChe, 4)).toBe(false)

      // 左 (1) → 中 (0)
      expect(canCapture(blackZu, 1, redShuai, 0)).toBe(true)
      // 右 (2) → 中 (0)
      expect(canCapture(blackZu, 2, redShuai, 0)).toBe(true)
      // 下 (4) → 中 (0)
      expect(canCapture(blackZu, 4, redShuai, 0)).toBe(true)

      // 上 (3) 不能吃任何位置
      expect(canCapture(redBing, 3, blackChe, 0)).toBe(false)
      expect(canCapture(blackZu, 3, redShuai, 0)).toBe(false)
      expect(canCapture(blackZu, 3, redChe, 1)).toBe(false)
    })

    it('俥／車、帥／將：中 ↔ 外四方無字種限制', () => {
      for (let pos = 1; pos <= 4; pos++) {
        expect(canCapture(redShuai, 0, blackJiang, pos)).toBe(true)
        expect(canCapture(blackChe, pos, redShuai, 0)).toBe(true)
      }
    })

    it('仕／士：不能吃帥／將；相／象：不能吃帥／將、仕／士', () => {
      // 仕／士不能吃帥／將
      expect(canCapture(redShi, 0, blackJiang, 1)).toBe(false)
      expect(canCapture(redShi, 0, blackChe, 1)).toBe(true)
      expect(canCapture(blackShi, 2, redShuai, 0)).toBe(false)
      expect(canCapture(blackShi, 2, redChe, 0)).toBe(true)

      // 相／象不能吃帥／將、仕／士
      expect(canCapture(redXiang, 0, blackJiang, 1)).toBe(false)
      expect(canCapture(redXiang, 0, blackShi, 1)).toBe(false)
      expect(canCapture(redXiang, 0, blackChe, 1)).toBe(true)
      expect(canCapture(blackXiang, 3, redShuai, 0)).toBe(false)
      expect(canCapture(blackXiang, 3, redShi, 0)).toBe(false)
      expect(canCapture(blackXiang, 3, redChe, 0)).toBe(true)
    })
  })

  describe('10｜PDF 官方三個標準核對案例 (Golden Test Cases)', () => {
    it('案例 A：中央紅帥的保護與普通分數', () => {
      // 依中、左、右、上、下：紅帥、黑車、黑馬、黑包、黑士
      const pieces: ChessPiece[] = [
        getPieceById(0),  // 0: 紅帥
        getPieceById(21), // 1: 黑車
        getPieceById(23), // 2: 黑馬
        getPieceById(25), // 3: 黑包
        getPieceById(17), // 4: 黑士
      ]

      const analysis = analyzeDivination(pieces)

      // 格局（按輸出順序）：事業格、勝利格（外在）、桃花格（偏桃花）、眾星拱月格
      const formationNames = analysis.formations.map(f => f.name)
      expect(formationNames).toEqual([
        '事業格',
        '勝利格（外在）',
        '桃花格（偏桃花）',
        '眾星拱月格',
      ])

      // 收獲 = 125；付出 = 0
      // 中位帥 → 左位車：30 分，列入收獲
      // 中位帥 → 右位馬：20 分，列入收獲
      // 中位帥 → 上位包：15 分，列入收獲
      // 中位帥 → 下位士：60 分，列入收獲
      expect(analysis.gains).toBe(125)
      expect(analysis.losses).toBe(0)
      expect(analysis.compareSymbol).toBe('>')
      expect(analysis.protectedColor).toBe(true) // 眾星拱月保護紅色
      expect(analysis.hasGoodFriends).toBe(false)
    })

    it('案例 B：好朋友格逐筆減半', () => {
      // 依中、左、右、上、下：紅帥、黑將、黑士、黑車、黑包
      const pieces: ChessPiece[] = [
        getPieceById(0),  // 0: 紅帥
        getPieceById(16), // 1: 黑將
        getPieceById(17), // 2: 黑士
        getPieceById(21), // 3: 黑車
        getPieceById(25), // 4: 黑包
      ]

      const analysis = analyzeDivination(pieces)

      // 格局（按輸出順序）：好朋友格、勝利格（內在）、桃花格（偏桃花）、眾星拱月格
      const formationNames = analysis.formations.map(f => f.name)
      expect(formationNames).toEqual([
        '好朋友格',
        '勝利格（內在）',
        '桃花格（偏桃花）',
        '眾星拱月格',
      ])

      // 收獲 = 92；付出 = 0
      // 中位帥 → 左位將：40 分，列入收獲 (80 / 2 = 40)
      // 中位帥 → 右位士：30 分，列入收獲 (60 / 2 = 30)
      // 中位帥 → 上位車：15 分，列入收獲 (30 / 2 = 15)
      // 中位帥 → 下位包：7 分，列入收獲 (floor(15 / 2) = 7)
      expect(analysis.gains).toBe(92)
      expect(analysis.losses).toBe(0)
      expect(analysis.compareSymbol).toBe('>')
      expect(analysis.hasGoodFriends).toBe(true)
    })

    it('案例 C：一枝獨秀免被吃，但仍可攻擊', () => {
      // 依中、左、右、上、下：紅俥、黑車、紅仕、紅相、紅兵
      const pieces: ChessPiece[] = [
        getPieceById(5),  // 0: 紅俥
        getPieceById(21), // 1: 黑車
        getPieceById(1),  // 2: 紅仕
        getPieceById(3),  // 3: 紅相
        getPieceById(11), // 4: 紅兵
      ]

      const analysis = analyzeDivination(pieces)

      // 格局（按輸出順序）：好朋友格、一枝獨秀格、互相欣賞格
      const formationNames = analysis.formations.map(f => f.name)
      expect(formationNames).toEqual([
        '好朋友格',
        '一枝獨秀格',
        '互相欣賞格',
      ])

      // 收獲 = 0；付出 = 15
      // 左位車 → 中位俥：15 分，列入付出 (30 / 2 = 15)
      // 黑車受保護免被吃，故紅方收獲為 0
      expect(analysis.gains).toBe(0)
      expect(analysis.losses).toBe(15)
      expect(analysis.compareSymbol).toBe('<')
      expect(analysis.protectedColor).toBe(false) // 一枝獨秀保護唯一黑棋
      expect(analysis.hasGoodFriends).toBe(true)
    })
  })

  describe('06｜17 大格局家族個別完整驗證', () => {
    it('01. 雨傘格：黑傘與紅傘判定與原文', () => {
      // 黑傘：1、2、3 黑色；0、4 紅色
      const blackUmbrella: ChessPiece[] = [
        getPieceById(0),  // 0: 紅帥
        getPieceById(21), // 1: 黑車
        getPieceById(23), // 2: 黑馬
        getPieceById(25), // 3: 黑包
        getPieceById(11), // 4: 紅兵
      ]
      const f1 = evaluateFormations(blackUmbrella)
      const uBlack = f1.find(f => f.name === '雨傘格局（黑傘）')
      expect(uBlack).toBeDefined()
      expect(uBlack?.description).toBe(FAIRY_DICTIONARY.umbrellaBlack.description)

      // 紅傘：1、2、3 紅色；0、4 黑色
      const redUmbrella: ChessPiece[] = [
        getPieceById(16), // 0: 黑將
        getPieceById(5),  // 1: 紅俥
        getPieceById(7),  // 2: 紅傌
        getPieceById(9),  // 3: 紅炮
        getPieceById(27), // 4: 黑卒
      ]
      const f2 = evaluateFormations(redUmbrella)
      const uRed = f2.find(f => f.name === '雨傘格局（紅傘）')
      expect(uRed).toBeDefined()
      expect(uRed?.description).toBe(FAIRY_DICTIONARY.umbrellaRed.description)
    })

    it('02. 十字天助格：兩種十字配置判定', () => {
      // 配置 1：0, 3, 4 同色；1, 2 另一色
      const cross1: ChessPiece[] = [
        getPieceById(0),  // 0: 紅
        getPieceById(21), // 1: 黑
        getPieceById(22), // 2: 黑
        getPieceById(5),  // 3: 紅
        getPieceById(6),  // 4: 紅
      ]
      expect(evaluateFormations(cross1).some(f => f.name === '十字天助格')).toBe(true)

      // 配置 2：0, 1, 2 同色；3, 4 另一色
      const cross2: ChessPiece[] = [
        getPieceById(16), // 0: 黑
        getPieceById(21), // 1: 黑
        getPieceById(22), // 2: 黑
        getPieceById(5),  // 3: 紅
        getPieceById(6),  // 4: 紅
      ]
      expect(evaluateFormations(cross2).some(f => f.name === '十字天助格')).toBe(true)
    })

    it('03. 好朋友格：一般型、馬外圍對、炮外圍對', () => {
      // 一般型：中央紅帥 與 左邊黑將
      const pGeneral: ChessPiece[] = [
        getPieceById(0),  // 0: 紅帥
        getPieceById(16), // 1: 黑將
        getPieceById(1),  // 2: 紅仕
        getPieceById(3),  // 3: 紅相
        getPieceById(11), // 4: 紅兵
      ]
      expect(evaluateFormations(pGeneral).some(f => f.name === '好朋友格')).toBe(true)

      // 馬外圍對 (1,3)：1左 紅傌，3上 黑馬
      const pHorse: ChessPiece[] = [
        getPieceById(0),  // 0: 紅帥
        getPieceById(7),  // 1: 紅傌
        getPieceById(1),  // 2: 紅仕
        getPieceById(23), // 3: 黑馬
        getPieceById(11), // 4: 紅兵
      ]
      expect(evaluateFormations(pHorse).some(f => f.name === '好朋友格')).toBe(true)

      // 炮外圍對 (1,2)：1左 紅炮，2右 黑包
      const pCannon: ChessPiece[] = [
        getPieceById(0),  // 0: 紅帥
        getPieceById(9),  // 1: 紅炮
        getPieceById(25), // 2: 黑包
        getPieceById(3),  // 3: 紅相
        getPieceById(11), // 4: 紅兵
      ]
      expect(evaluateFormations(pCannon).some(f => f.name === '好朋友格')).toBe(true)

      // 中央馬與外圍馬配對不算好朋友格
      const centerHorse: ChessPiece[] = [
        getPieceById(7),  // 0: 紅傌
        getPieceById(23), // 1: 黑馬
        getPieceById(1),  // 2: 紅仕
        getPieceById(3),  // 3: 紅相
        getPieceById(11), // 4: 紅兵
      ]
      expect(evaluateFormations(centerHorse).some(f => f.name === '好朋友格')).toBe(false)
    })

    it('04. 好人緣格：外圍兩兩配對', () => {
      // 1左 紅俥 與 4下 黑車
      const pieces: ChessPiece[] = [
        getPieceById(0),  // 0: 紅帥
        getPieceById(5),  // 1: 紅俥
        getPieceById(1),  // 2: 紅仕
        getPieceById(3),  // 3: 紅相
        getPieceById(21), // 4: 黑車
      ]
      expect(evaluateFormations(pieces).some(f => f.name === '好人緣格')).toBe(true)
    })

    it('05. 事業格：車、馬、炮齊全', () => {
      const pieces: ChessPiece[] = [
        getPieceById(0),  // 0: 紅帥
        getPieceById(5),  // 1: 俥
        getPieceById(23), // 2: 馬
        getPieceById(9),  // 3: 炮
        getPieceById(11), // 4: 兵
      ]
      expect(evaluateFormations(pieces).some(f => f.name === '事業格')).toBe(true)
    })

    it('06. 富貴格：將、士、象齊全', () => {
      const pieces: ChessPiece[] = [
        getPieceById(0),  // 0: 帥 (將類)
        getPieceById(17), // 1: 士 (士類)
        getPieceById(3),  // 2: 相 (象類)
        getPieceById(5),  // 3: 俥
        getPieceById(11), // 4: 兵
      ]
      expect(evaluateFormations(pieces).some(f => f.name === '富貴格')).toBe(true)
    })

    it('07. 勝利格：內在與外在判斷', () => {
      // 1, 2, 4 黑色，0 紅色
      // 內在：0 紅帥 與 1 黑將 配對
      const vInner: ChessPiece[] = [
        getPieceById(0),  // 0: 紅帥
        getPieceById(16), // 1: 黑將
        getPieceById(21), // 2: 黑車
        getPieceById(5),  // 3: 紅俥
        getPieceById(23), // 4: 黑馬
      ]
      expect(evaluateFormations(vInner).some(f => f.name === '勝利格（內在）')).toBe(true)

      // 外在：0 紅帥 與 1, 2, 4 無配對
      const vOuter: ChessPiece[] = [
        getPieceById(0),  // 0: 紅帥
        getPieceById(21), // 1: 黑車
        getPieceById(23), // 2: 黑馬
        getPieceById(5),  // 3: 紅俥
        getPieceById(27), // 4: 黑卒
      ]
      expect(evaluateFormations(vOuter).some(f => f.name === '勝利格（外在）')).toBe(true)
    })

    it('08. 桃花格：正桃花與偏桃花', () => {
      // 正桃花：(1,2) 為 黑包 + 紅炮
      const truePeach: ChessPiece[] = [
        getPieceById(0),  // 0: 紅帥
        getPieceById(25), // 1: 黑包
        getPieceById(9),  // 2: 紅炮
        getPieceById(1),  // 3: 紅仕
        getPieceById(3),  // 4: 紅相
      ]
      expect(evaluateFormations(truePeach).some(f => f.name === '桃花格（正桃花）')).toBe(true)

      // 偏桃花：中央0 紅帥 與 上方3 黑包
      const partialPeach: ChessPiece[] = [
        getPieceById(0),  // 0: 紅帥
        getPieceById(1),  // 1: 紅仕
        getPieceById(2),  // 2: 紅仕
        getPieceById(25), // 3: 黑包
        getPieceById(3),  // 4: 紅相
      ]
      expect(evaluateFormations(partialPeach).some(f => f.name === '桃花格（偏桃花）')).toBe(true)
    })

    it('09. 分離格：(1,2) 或 (3,4) 好朋友，但排除炮包', () => {
      // 1左 紅俥 與 2右 黑車
      const sepChe: ChessPiece[] = [
        getPieceById(0),  // 0: 紅帥
        getPieceById(5),  // 1: 紅俥
        getPieceById(21), // 2: 黑車
        getPieceById(1),  // 3: 紅仕
        getPieceById(3),  // 4: 紅相
      ]
      expect(evaluateFormations(sepChe).some(f => f.name === '分離格')).toBe(true)

      // (1,2) 若為 炮/包 則排除分離格
      const sepPao: ChessPiece[] = [
        getPieceById(0),  // 0: 紅帥
        getPieceById(9),  // 1: 紅炮
        getPieceById(25), // 2: 黑包
        getPieceById(1),  // 3: 紅仕
        getPieceById(3),  // 4: 紅相
      ]
      expect(evaluateFormations(sepPao).some(f => f.name === '分離格')).toBe(false)
    })

    it('10. 一枝獨秀格：外圍 3:1 且中央與多數同色', () => {
      const pieces: ChessPiece[] = [
        getPieceById(0),  // 0: 紅
        getPieceById(21), // 1: 黑 (唯一異色)
        getPieceById(1),  // 2: 紅
        getPieceById(3),  // 3: 紅
        getPieceById(5),  // 4: 紅
      ]
      expect(evaluateFormations(pieces).some(f => f.name === '一枝獨秀格')).toBe(true)
    })

    it('11. 鬱卒格 與 12. 眾星拱月格', () => {
      // 鬱卒格：中央黑，外圍全紅
      const depressed: ChessPiece[] = [
        getPieceById(16), // 0: 黑
        getPieceById(1),  // 1: 紅
        getPieceById(3),  // 2: 紅
        getPieceById(5),  // 3: 紅
        getPieceById(7),  // 4: 紅
      ]
      expect(evaluateFormations(depressed).some(f => f.name === '鬱卒格')).toBe(true)

      // 眾星拱月格：中央紅，外圍全黑
      const stars: ChessPiece[] = [
        getPieceById(0),  // 0: 紅
        getPieceById(17), // 1: 黑
        getPieceById(19), // 2: 黑
        getPieceById(21), // 3: 黑
        getPieceById(23), // 4: 黑
      ]
      expect(evaluateFormations(stars).some(f => f.name === '眾星拱月格')).toBe(true)
    })

    it('13. 困擾格：至少兩對不共享棋子的好朋友', () => {
      // 0與1好朋友 (帥-將)，2與3好朋友 (仕-士)
      const pieces: ChessPiece[] = [
        getPieceById(0),  // 0: 紅帥
        getPieceById(16), // 1: 黑將
        getPieceById(1),  // 2: 紅仕
        getPieceById(17), // 3: 黑士
        getPieceById(5),  // 4: 紅俥
      ]
      expect(evaluateFormations(pieces).some(f => f.name === '困擾格')).toBe(true)
    })

    it('14. 三人同心格：兵/卒滿 3 顆之內在與外在', () => {
      // 卒 3 顆，中央也是卒 -> 內在
      const zuCenter: ChessPiece[] = [
        getPieceById(27), // 0: 卒 (中)
        getPieceById(28), // 1: 卒
        getPieceById(29), // 2: 卒
        getPieceById(0),  // 3: 帥
        getPieceById(1),  // 4: 仕
      ]
      const fZuCenter = evaluateFormations(zuCenter).filter(f => f.name === '三人同心格')
      expect(fZuCenter.length).toBe(1)
      expect(fZuCenter[0].description).toBe(FAIRY_DICTIONARY.threeTogetherZuCenter.description)

      // 兵 3 顆，中央非兵 -> 外在
      const bingOuter: ChessPiece[] = [
        getPieceById(0),  // 0: 帥 (中)
        getPieceById(11), // 1: 兵
        getPieceById(12), // 2: 兵
        getPieceById(13), // 3: 兵
        getPieceById(1),  // 4: 仕
      ]
      const fBingOuter = evaluateFormations(bingOuter).filter(f => f.name === '三人同心格')
      expect(fBingOuter.length).toBe(1)
      expect(fBingOuter[0].description).toBe(FAIRY_DICTIONARY.threeTogetherBingOuter.description)
    })

    it('15. 破壞格：同類至少 3 顆且 1:多 配置', () => {
      // 兵類 3 顆：2 紅兵、1 黑卒。中央為紅帥 (多數紅兵與中央同色 -> 內在)
      const destInner: ChessPiece[] = [
        getPieceById(0),  // 0: 紅帥
        getPieceById(11), // 1: 紅兵
        getPieceById(12), // 2: 紅兵
        getPieceById(27), // 3: 黑卒
        getPieceById(5),  // 4: 紅俥
      ]
      const fDestInner = evaluateFormations(destInner).filter(f => f.name === '破壞格')
      expect(fDestInner.length).toBe(1)
      expect(fDestInner[0].description).toBe(FAIRY_DICTIONARY.destructionInner.description)

      // 兵類 3 顆：2 紅兵、1 黑卒。中央為黑將 (多數紅兵與中央不同色 -> 外在)
      const destOuter: ChessPiece[] = [
        getPieceById(16), // 0: 黑將
        getPieceById(11), // 1: 紅兵
        getPieceById(12), // 2: 紅兵
        getPieceById(27), // 3: 黑卒
        getPieceById(5),  // 4: 紅俥
      ]
      const fDestOuter = evaluateFormations(destOuter).filter(f => f.name === '破壞格')
      expect(fDestOuter.length).toBe(1)
      expect(fDestOuter[0].description).toBe(FAIRY_DICTIONARY.destructionOuter.description)
    })

    it('16. 互相欣賞格：(黑士+紅俥) 或 (紅仕+黑車)', () => {
      // 黑士 + 紅俥
      const pieces1: ChessPiece[] = [
        getPieceById(0),  // 0: 紅帥
        getPieceById(17), // 1: 黑士
        getPieceById(5),  // 2: 紅俥
        getPieceById(3),  // 3: 紅相
        getPieceById(11), // 4: 紅兵
      ]
      expect(evaluateFormations(pieces1).some(f => f.name === '互相欣賞格')).toBe(true)

      // 紅仕 + 黑車
      const pieces2: ChessPiece[] = [
        getPieceById(0),  // 0: 紅帥
        getPieceById(1),  // 1: 紅仕
        getPieceById(21), // 2: 黑車
        getPieceById(3),  // 3: 紅相
        getPieceById(11), // 4: 紅兵
      ]
      expect(evaluateFormations(pieces2).some(f => f.name === '互相欣賞格')).toBe(true)
    })

    it('17. 消耗格：每對同字同色生成一筆，保留重複不被覆蓋', () => {
      // 3 顆同色同字的紅兵：應產生 3 對消耗格
      const pieces: ChessPiece[] = [
        getPieceById(11), // 0: 紅兵
        getPieceById(12), // 1: 紅兵
        getPieceById(13), // 2: 紅兵
        getPieceById(5),  // 3: 紅俥
        getPieceById(7),  // 4: 紅傌
      ]
      const fList = evaluateFormations(pieces).filter(f => f.name === '消耗格')
      expect(fList.length).toBe(3)
      for (const f of fList) {
        expect(f.description).toContain('兩隻同色同字的兵')
        expect(f.description).toContain('屬於自己消耗')
        expect(f.description).toContain('紅色較不明顯')
      }
    })
  })

  describe('3D 問事亭 CrossGuaResult 介面整合相容性', () => {
    it('支援 3D 槽位逐步翻牌與全部翻開', () => {
      const slots = drawCrossSlots()
      const initial = evaluateCrossGua(slots)
      expect(initial.revealedCount).toBe(0)
      expect(initial.allRevealed).toBe(false)
      expect(initial.patternName).toBeTruthy()
      expect(initial.summary).toBeTruthy()
      expect(initial.advice).toBeTruthy()

      // 翻開全部 5 顆
      for (const pos of CROSS_POSITIONS) {
        slots[pos].revealed = true
      }
      const full = evaluateCrossGua(slots)
      expect(full.revealedCount).toBe(5)
      expect(full.allRevealed).toBe(true)
      expect(full.analysis.pieces.length).toBe(5)
      expect(full.level).toBeTruthy()
      expect(full.posInterpretations.center).toContain('中宮・主位')
    })
  })
})
