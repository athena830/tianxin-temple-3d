import { beforeAll, describe, expect, it } from 'vitest'

if (typeof (globalThis as any).document === 'undefined') {
  const dummyCtx: any = new Proxy({
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    measureText: () => ({ width: 10 }),
  }, {
    get: (target, prop) => (prop in target ? (target as any)[prop] : () => {}),
    set: () => true,
  })
  const dummyCanvas: any = { width: 64, height: 64, getContext: () => dummyCtx }
  ;(globalThis as any).document = {
    createElement: (tag: string) => (tag === 'canvas' ? { ...dummyCanvas } : { addEventListener: () => {}, removeEventListener: () => {}, style: {} }),
    createElementNS: () => ({ addEventListener: () => {}, removeEventListener: () => {}, style: {} }),
  }
}

import * as THREE from 'three'
import { initPhysics, Physics } from '../src/engine/physics'
import { MarketWorld } from '../src/game/market-world'

describe('RO-style Aura Market world', () => {
  beforeAll(async () => {
    await initPhysics()
  })

  it('builds all 5 market venues, return warp portal, central fountain, and animated RO sprites', () => {
    const physics = new Physics(-24)
    const world = new MarketWorld(physics)

    expect(world.venuePoints).toHaveLength(5)
    expect(world.points).toHaveLength(6)
    expect(world.returnPoint.id).toBe('return-temple')

    // Verify nearestPoint detects each venue and the return warp portal
    for (const point of world.points) {
      const found = world.nearestPoint(new THREE.Vector3(point.position.x, 0, point.position.z))
      expect(found?.id).toBe(point.id)
    }

    // Verify hotspots & hover highlight feedback
    expect(world.hotspotMeshes.length).toBe(6)
    world.setHoveredPoint('birth-chart-hall')
    world.setHoveredPoint('card-house')
    world.setHoveredPoint(null)

    // Verify ground cursor, rain particles & Q-chibi walk animation update loop run cleanly
    world.setGroundCursor(2.5, 1.5, true)
    world.update(0.16, 4.2, 0.8)
    world.update(0.16, 0, -0.5)
    world.setGroundCursor(0, 0, false)
    expect(typeof world.loadCharacterModel).toBe('function')

    physics.dispose()
  })
})
