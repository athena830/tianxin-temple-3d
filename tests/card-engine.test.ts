import { describe, expect, it } from 'vitest'
import { drawThreeCards, getDailyCard } from '../src/game/card-engine'

describe('card reflection engine', () => {
  it('keeps the daily card fixed for the same local date', () => {
    expect(getDailyCard('2026-11-20')).toEqual(getDailyCard('2026-11-20'))
  })

  it('draws three distinct reflection cards in fixed positions', () => {
    const spread = drawThreeCards('work', () => 0.2)
    expect(spread.topic).toBe('work')
    expect(spread.cards).toHaveLength(3)
    expect(new Set(spread.cards.map(card => card.id)).size).toBe(3)
  })
})
