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
import {
  MARKET_STALL_TARGET_HEIGHT,
  PLAYER_TARGET_HEIGHT,
  SHARED_ORTHO_CAMERA_CONFIG,
  normalizeScaleToHeight,
} from '../src/game/sceneConfig'

describe('RO-style Aura Market world', () => {
  beforeAll(async () => {
    await initPhysics()
  })

  it('builds all 6 market venues, return warp portal, central fountain, and animated RO sprites', () => {
    const physics = new Physics(-24)
    const world = new MarketWorld(physics)

    expect(world.venuePoints).toHaveLength(6)
    expect(world.points).toHaveLength(7)
    expect(world.returnPoint.id).toBe('return-temple')

    // Verify nearestPoint detects each venue and the return warp portal
    for (const point of world.points) {
      const found = world.nearestPoint(new THREE.Vector3(point.position.x, 0, point.position.z))
      expect(found?.id).toBe(point.id)
    }

    // Verify hotspots & hover highlight feedback
    expect(world.hotspotMeshes.length).toBe(7)
    world.setHoveredPoint('birth-chart-hall')
    world.setHoveredPoint('card-house')
    world.setHoveredPoint(null)

    // Verify Market avatar matches PLAYER_TARGET_HEIGHT at rest pose before walking animation
    expect(world.chibi).toBeDefined()
    const avatarBody = ((world as any).avatarBodyGroup ?? world.chibi.root) as THREE.Object3D
    expect(avatarBody).toBeDefined()
    avatarBody.updateMatrixWorld(true)
    const avatarBox = new THREE.Box3().setFromObject(avatarBody)
    expect(avatarBox.max.y - avatarBox.min.y).toBeCloseTo(PLAYER_TARGET_HEIGHT, 2)
    expect(avatarBox.min.y).toBeCloseTo(0, 2)

    // Verify ground cursor, rain particles & Q-chibi walk animation update loop run cleanly
    world.setGroundCursor(2.5, 1.5, true)
    world.update(0.16, 4.2, 0.8)
    world.update(0.16, 0, -0.5)
    world.setGroundCursor(0, 0, false)
    expect(typeof world.loadCharacterModel).toBe('function')

    // Verify shared sceneConfig camera & height normalization parity
    expect(SHARED_ORTHO_CAMERA_CONFIG.frustumSize).toBeGreaterThan(5.0)
    expect(SHARED_ORTHO_CAMERA_CONFIG.frustumSize).toBeLessThan(6.0)

    const testBox = new THREE.Mesh(new THREE.BoxGeometry(1, 4, 1), new THREE.MeshBasicMaterial())
    testBox.position.set(0, 2.5, 0)
    const norm = normalizeScaleToHeight(testBox, PLAYER_TARGET_HEIGHT, 0)
    expect(norm.finalHeight).toBeCloseTo(PLAYER_TARGET_HEIGHT, 3)
    const afterBox = new THREE.Box3().setFromObject(testBox)
    expect(afterBox.min.y).toBeCloseTo(0, 3)
    expect(afterBox.max.y - afterBox.min.y).toBeCloseTo(PLAYER_TARGET_HEIGHT, 3)

    // Verify marketBuildingScale debug slider clamps cleanly [0.7, 1.5] without altering avatar height
    world.setMarketBuildingScale(1.25)
    expect(world.getMarketBuildingScale()).toBeCloseTo(1.25, 3)
    world.setMarketBuildingScale(2.5)
    expect(world.getMarketBuildingScale()).toBeCloseTo(1.5, 3)
    world.setMarketBuildingScale(0.2)
    expect(world.getMarketBuildingScale()).toBeCloseTo(0.7, 3)
    world.setMarketBuildingScale(1.0)
    expect(MARKET_STALL_TARGET_HEIGHT).toBeCloseTo(PLAYER_TARGET_HEIGHT * 2.3, 3)

    // Verify Market NPCs (stall keepers and passersby) exist and use unified createCharacter
    const npcs = (world as any).marketNpcs as any[]
    expect(npcs).toBeDefined()
    expect(npcs.length).toBe(9) // 6 stall keepers + 3 visitors
    for (const npc of npcs) {
      expect(npc.chibi).toBeDefined()
      const box = new THREE.Box3().setFromObject(npc.chibi.root)
      expect(Math.abs(box.max.y - box.min.y - PLAYER_TARGET_HEIGHT)).toBeLessThan(0.1)
    }

    // Verify player character palette switching
    world.setCharacter('vermillion')
    expect((world as any).currentPaletteId).toBe('vermillion')
    world.setCharacter('moon')
    expect((world as any).currentPaletteId).toBe('moon')

    physics.dispose()
  })
})
