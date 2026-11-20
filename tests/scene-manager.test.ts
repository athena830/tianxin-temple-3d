import { describe, expect, it } from 'vitest'
import { canBeginPortalTransition, type PortalTransitionState } from '../src/game/scene-manager'

describe('portal transition state guard', () => {
  it('only accepts a portal activation from idle', () => {
    const states: PortalTransitionState[] = ['idle', 'entering-portal', 'loading-target-world', 'fading-in']
    expect(states.map(canBeginPortalTransition)).toEqual([true, false, false, false])
  })
})
