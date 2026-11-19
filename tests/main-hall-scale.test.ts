import { beforeAll, describe, expect, it } from 'vitest'

if (typeof (globalThis as any).document === 'undefined') {
  const dummyCtx: any = new Proxy({
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    measureText: () => ({ width: 10 }),
  }, {
    get: (target, prop) => {
      if (prop in target) return (target as any)[prop]
      return () => {}
    },
    set: () => true,
  })
  const dummyCanvas: any = {
    width: 64,
    height: 256,
    getContext: () => dummyCtx,
  }
  ;(globalThis as any).document = {
    createElement: (tag: string) => {
      if (tag === 'canvas') return { ...dummyCanvas }
      return { addEventListener: () => {}, removeEventListener: () => {}, style: {} }
    },
    createElementNS: () => ({ addEventListener: () => {}, removeEventListener: () => {}, style: {} }),
  }
}

import { initPhysics, Physics } from '../src/engine/physics'
import { TempleWorld } from '../src/game/temple-world'

describe('main hall scale & collision avoidance', () => {
  beforeAll(async () => {
    await initPhysics()
  })

  it('initializes with default scale 1.35 and base grounded at y = 0', () => {
    const physics = new Physics()
    const world = new TempleWorld(physics)

    expect(world.getMainHallScale()).toBe(1.35)

    const statuePos = world.getGuanyinStatueWorldPos()
    expect(statuePos.x).toBe(0)
    // At scale 1.35, mainHallZ is -7.28, statue is at -7.28 - 5.68 * 1.35 ≈ -14.948
    expect(statuePos.z).toBeCloseTo(-14.948, 2)
  })

  it('clamps scale between 1.0 and 2.0', () => {
    const physics = new Physics()
    const world = new TempleWorld(physics)

    world.setMainHallScale(0.5)
    expect(world.getMainHallScale()).toBe(1.0)

    world.setMainHallScale(2.5)
    expect(world.getMainHallScale()).toBe(2.0)

    world.setMainHallScale(1.42)
    expect(world.getMainHallScale()).toBe(1.42)
  })

  it('dynamically updates cushion world coordinates when scale changes', () => {
    const physics = new Physics()
    const world = new TempleWorld(physics)

    world.setMainHallScale(1.0)
    const slotAt1 = world.cushionSlots[0]
    expect(slotAt1.worldX).toBeCloseTo(slotAt1.x * 1.0, 3)
    expect(slotAt1.worldZ).toBeCloseTo(-7.0 + slotAt1.z * 1.0, 3)

    world.setMainHallScale(1.35)
    const slotAt135 = world.cushionSlots[0]
    expect(slotAt135.worldX).toBeCloseTo(slotAt135.x * 1.35, 3)
    const expectedZ135 = -7.0 - (1.35 - 1.0) * 0.8 + slotAt1.z * 1.35
    expect(slotAt135.worldZ).toBeCloseTo(expectedZ135, 3)
  })

  it('places outdoor Tiangong urn safely in front of the front steps without clipping', () => {
    const physics = new Physics()
    const world = new TempleWorld(physics)

    world.setMainHallScale(1.35)
    const incensePoint = world.points.find(p => p.id === 'incense')
    expect(incensePoint).toBeDefined()
    // Steps front edge at 1.35 is approximately -7.28 + 7.9 * 1.35 = 3.385
    // Incense point should be in front of the steps (Z > 4.0)
    expect(incensePoint!.position.z).toBeGreaterThan(4.0)
  })
})
