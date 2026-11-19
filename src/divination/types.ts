/**
 * 天心仙姑 象棋卜卦型別定義
 * 依據《天心仙姑 象棋卜卦網站完整知識文件 AI 匯入版》標準規格
 */

export type ChessColor = 'red' | 'black'

export type PieceCharacter =
  | '帥' | '仕' | '相' | '俥' | '傌' | '炮' | '兵'
  | '將' | '士' | '象' | '車' | '馬' | '包' | '卒'

export type PieceFamily =
  | 'general'   // 帥 / 將 (80 分)
  | 'advisor'   // 仕 / 士 (60 分)
  | 'elephant'  // 相 / 象 (40 分)
  | 'chariot'   // 俥 / 車 (30 分)
  | 'horse'     // 傌 / 馬 (20 分)
  | 'cannon'    // 炮 / 包 (15 分)
  | 'soldier'   // 兵 / 卒 (10 分)

/**
 * 32 顆實體棋定義
 * 每一顆實體棋有獨立的 0 ~ 31 索引
 */
export interface ChessPiece {
  id: number              // 0 ~ 31 固定實體索引
  character: PieceCharacter // 顯示字元（黑包、紅俥、紅傌）
  name: string            // 相容性字元欄位（同 character）
  isRed: boolean          // 是否為紅方
  color: ChessColor       // 'red' | 'black'
  value: number           // 被吃分數 (80, 60, 40, 30, 20, 15, 10)
  rank: number            // 位階 (帥將=7, 俥車=6, 傌馬=5, 炮包=4, 相象=3, 仕士=2, 兵卒=1)
  family: PieceFamily     // 棋種大類
}

/**
 * 十字位置定義
 * 0: 中 (Center) - 定義「自己」
 * 1: 左 (Left)
 * 2: 右 (Right)
 * 3: 上 (Top)
 * 4: 下 (Bottom)
 */
export type ChessPos = 'center' | 'left' | 'right' | 'top' | 'bottom'

export interface PosMeta {
  pos: ChessPos
  index: number
  label: string
  sublabel: string
  aspect: string
  desc: string
}

export const POS_META: Record<ChessPos, PosMeta> = {
  center: {
    pos: 'center',
    index: 0,
    label: '中宮・主位',
    sublabel: '太極核心（自己）',
    aspect: '自身現狀',
    desc: '所求之事的核心本質與當前處境，其顏色定義為「自己」',
  },
  left: {
    pos: 'left',
    index: 1,
    label: '左方・客方',
    sublabel: '外部人際',
    aspect: '助緣貴人',
    desc: '外來協力、夥伴貴人或外部動態',
  },
  right: {
    pos: 'right',
    index: 2,
    label: '右方・主方',
    sublabel: '前行考驗',
    aspect: '挑戰阻力',
    desc: '行動阻礙、潛在考驗或需防範之處',
  },
  top: {
    pos: 'top',
    index: 3,
    label: '上方・天時',
    sublabel: '外部環境',
    aspect: '機運天時',
    desc: '外在趨勢、大環境機緣、長輩上司影響',
  },
  bottom: {
    pos: 'bottom',
    index: 4,
    label: '下方・地利',
    sublabel: '基石底氣',
    aspect: '落實執行',
    desc: '內在心態、實力累積與基石穩固度',
  },
}

/** 十字槽位狀態（供 3D 場景及互動介面使用） */
export interface CrossSlot {
  pos: ChessPos
  index: number
  piece: ChessPiece
  revealed: boolean
}

/** 格局判定輸出物件 */
export interface Formation {
  name: string
  description: string
}

/** 單筆吃子捕獲紀錄 */
export interface CaptureRecord {
  attacker: ChessPiece
  target: ChessPiece
  attackerPos: number
  targetPos: number
  score: number
  isGain: boolean
}

/** 卜卦靜態分析結果 */
export interface DivinationAnalysis {
  pieces: ChessPiece[]           // 固定 5 顆 [中, 左, 右, 上, 下]
  mySide: boolean                // 自身陣營（紅: true, 黑: false）
  formations: Formation[]        // 17 大格局家族判定結果清單
  gains: number                  // 收獲總分
  losses: number                 // 付出總分
  compareSymbol: '>' | '<' | '=' // 比較符號
  records: CaptureRecord[]       // 吃子明細
  protectedColor: boolean | null // 受保護免被吃的顏色（null 表示無保護）
  hasGoodFriends: boolean        // 是否具備好朋友格（觸發全卦逐筆減半）
}

export type GuaLevel = '大吉' | '吉' | '平' | '守中' | '需慎'

/** 整合 3D 問事亭的卦象展示結果 */
export interface CrossGuaResult {
  slots: Record<ChessPos, CrossSlot>
  revealedCount: number
  allRevealed: boolean
  analysis: DivinationAnalysis
  patternName: string
  level: GuaLevel
  summary: string
  advice: string
  posInterpretations: Record<ChessPos, string>
}
