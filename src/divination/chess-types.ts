export type ChessColor = 'red' | 'black'
export type ChessPos = 'center' | 'top' | 'bottom' | 'left' | 'right'

export interface ChessPiece {
  id: number           // 0 ~ 31 實體編號
  name: string         // 紅: 帥仕相俥傌炮兵 / 黑: 將士象車馬包卒
  color: ChessColor
  rank: number         // 棋子等級/位階 (帥將=7, 俥車=6, 傌馬=5, 炮包=4, 相象=3, 仕士=2, 兵卒=1)
}

export interface PosMeta {
  pos: ChessPos
  label: string
  sublabel: string
  aspect: string
  desc: string
}

export const POS_META: Record<ChessPos, PosMeta> = {
  center: {
    pos: 'center',
    label: '中宮・主位',
    sublabel: '太極核心',
    aspect: '自身現狀',
    desc: '所求之事的核心本質與當前處境',
  },
  top: {
    pos: 'top',
    label: '上方・天時',
    sublabel: '外部環境',
    aspect: '機運天時',
    desc: '外在趨勢、大環境機緣、長輩上司影響',
  },
  bottom: {
    pos: 'bottom',
    label: '下方・地利',
    sublabel: '基石底氣',
    aspect: '落實執行',
    desc: '內在心態、實力累積與基石穩固度',
  },
  left: {
    pos: 'left',
    label: '左方・客方',
    sublabel: '外部人際',
    aspect: '助緣貴人',
    desc: '外來協力、夥伴貴人或外部動態',
  },
  right: {
    pos: 'right',
    label: '右方・主方',
    sublabel: '前行考驗',
    aspect: '挑戰阻力',
    desc: '行動阻礙、潛在考驗或需防範之處',
  },
}

export interface CrossSlot {
  pos: ChessPos
  piece: ChessPiece
  revealed: boolean
}

export type GuaLevel = '大吉' | '吉' | '平' | '守中' | '需慎'

export interface CrossGuaResult {
  slots: Record<ChessPos, CrossSlot>
  revealedCount: number
  allRevealed: boolean
  patternName: string
  level: GuaLevel
  summary: string
  advice: string
  posInterpretations: Record<ChessPos, string>
}
