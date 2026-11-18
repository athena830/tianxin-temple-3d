import { describe, expect, it } from 'vitest'
import {
  createFullDeck,
  drawCrossSlots,
  evaluateCrossGua,
  CROSS_POSITIONS,
} from '../src/divination'

describe('Chinese Chess Divination (象棋神卦)', () => {
  it('creates a full standard 32-piece deck', () => {
    const deck = createFullDeck()
    expect(deck.length).toBe(32)

    const reds = deck.filter(p => p.color === 'red')
    const blacks = deck.filter(p => p.color === 'black')
    expect(reds.length).toBe(16)
    expect(blacks.length).toBe(16)

    // Check unique ids
    const idSet = new Set(deck.map(p => p.id))
    expect(idSet.size).toBe(32)
  })

  it('draws 5 unique pieces in cross positions', () => {
    const slots = drawCrossSlots()
    expect(Object.keys(slots).length).toBe(5)

    for (const pos of CROSS_POSITIONS) {
      expect(slots[pos]).toBeDefined()
      expect(slots[pos].pos).toBe(pos)
      expect(slots[pos].revealed).toBe(false)
      expect(slots[pos].piece).toBeDefined()
    }

    const drawnIds = CROSS_POSITIONS.map(p => slots[p].piece.id)
    const uniqueIds = new Set(drawnIds)
    expect(uniqueIds.size).toBe(5)
  })

  it('evaluates gua correctly when partially or fully revealed', () => {
    const slots = drawCrossSlots()
    const resultInitial = evaluateCrossGua(slots)
    expect(resultInitial.allRevealed).toBe(false)
    expect(resultInitial.revealedCount).toBe(0)
    expect(resultInitial.patternName).toBeTruthy()
    expect(resultInitial.summary).toBeTruthy()
    expect(resultInitial.posInterpretations.center).toBeTruthy()

    // Flip 3 pieces
    slots.center.revealed = true
    slots.top.revealed = true
    slots.bottom.revealed = true
    const resultPartial = evaluateCrossGua(slots)
    expect(resultPartial.revealedCount).toBe(3)
    expect(resultPartial.allRevealed).toBe(false)

    // Flip remaining 2 pieces
    slots.left.revealed = true
    slots.right.revealed = true
    const resultFull = evaluateCrossGua(slots)
    expect(resultFull.revealedCount).toBe(5)
    expect(resultFull.allRevealed).toBe(true)
    expect(resultFull.level).toBeTruthy()
  })

  it('identifies Jiang and Shuai pattern correctly', () => {
    const deck = createFullDeck()
    const shuai = deck.find(p => p.name === '帥')!
    const jiang = deck.find(p => p.name === '將')!
    const bing1 = deck.find(p => p.name === '兵')!
    const zu1 = deck.find(p => p.name === '卒')!
    const shi = deck.find(p => p.name === '仕')!

    const slots = {
      center: { pos: 'center' as const, piece: shuai, revealed: true },
      top: { pos: 'top' as const, piece: jiang, revealed: true },
      bottom: { pos: 'bottom' as const, piece: bing1, revealed: true },
      left: { pos: 'left' as const, piece: zu1, revealed: true },
      right: { pos: 'right' as const, piece: shi, revealed: true },
    }

    const evalResult = evaluateCrossGua(slots)
    expect(evalResult.patternName).toContain('將帥')
    expect(evalResult.level).toBe('大吉')
    expect(evalResult.allRevealed).toBe(true)
  })
})
