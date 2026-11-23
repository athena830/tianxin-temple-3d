import { describe, it, expect, beforeAll } from 'vitest'
import * as THREE from 'three'
import { initPhysics, Physics } from '../src/engine/physics'
import { TempleWorld, DRAGON_GUANYIN_POS } from '../src/game/temple-world'
import { TemplePbrLibrary } from '../src/game/temple-pbr-materials'

describe('Phase 1 PBR upgrade & Guanyin protection regression', () => {
  beforeAll(async () => {
    const fakeCtx = new Proxy({}, {
      get: (_t, prop) => {
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
          return () => ({ addColorStop: () => undefined })
        }
        return () => undefined
      },
    })
    ;(globalThis as unknown as { document: unknown }).document = {
      createElement: () => ({ width: 64, height: 64, getContext: () => fakeCtx }),
      createElementNS: () => ({ addEventListener: () => undefined, removeEventListener: () => undefined, setAttribute: () => undefined }),
    }
    await initPhysics()
  })

  it('caches PBR materials and scales quality across low / medium / high tiers', () => {
    const lib = new TemplePbrLibrary()
    const stoneA = lib.get('courtyardStone', 15, 22)
    const stoneB = lib.get('courtyardStone', 15, 22)
    expect(stoneA).toBe(stoneB)
    expect(stoneA.map).not.toBeNull()
    expect(stoneA.normalMap).not.toBeNull()
    expect(stoneA.roughnessMap).not.toBeNull()

    lib.applyQuality('low')
    expect(stoneA.normalMap).toBeNull()
    expect(stoneA.roughnessMap).toBeNull()

    lib.applyQuality('medium')
    expect(stoneA.normalMap).not.toBeNull()
    expect(stoneA.roughnessMap).not.toBeNull()

    lib.applyQuality('high')
    expect(stoneA.normalMap).not.toBeNull()
    lib.dispose()
  })

  it('preserves regular Guanyin coordinates/rotation/scale and Dragon Guanyin untouched', () => {
    const physics = new Physics(-24)
    const world = new TempleWorld(physics)
    const w = world as unknown as {
      guanyinRoot: THREE.Group | null
      dragonGuanyinBillboard?: THREE.Group
      rearHallLights: THREE.PointLight[]
      sun: THREE.DirectionalLight
    }

    // 1. Regular Guanyin protection assertions
    expect(w.guanyinRoot).not.toBeNull()
    expect(w.guanyinRoot!.position.x).toBeCloseTo(0, 4)
    expect(w.guanyinRoot!.position.y).toBeCloseTo(1.82, 4)
    expect(w.guanyinRoot!.position.z).toBeCloseTo(-5.68, 4)
    expect(w.guanyinRoot!.rotation.x).toBe(0)
    expect(w.guanyinRoot!.rotation.y).toBe(0)
    expect(w.guanyinRoot!.rotation.z).toBe(0)
    expect(w.guanyinRoot!.scale.x).toBeCloseTo(1, 4)
    expect(w.guanyinRoot!.scale.y).toBeCloseTo(1, 4)
    expect(w.guanyinRoot!.scale.z).toBeCloseTo(1, 4)

    // 2. Dragon Guanyin sanctuary untouched
    expect(w.dragonGuanyinBillboard).toBeDefined()
    expect(DRAGON_GUANYIN_POS.x).toBeCloseTo(-68.0, 4)
    expect(DRAGON_GUANYIN_POS.y).toBeCloseTo(0.545, 4)
    expect(DRAGON_GUANYIN_POS.z).toBeCloseTo(31.0, 4)

    // 3. Stabilized shadow camera & zone-aware rear hall light culling
    expect(w.sun.shadow.camera.left).toBe(-34)
    expect(w.sun.shadow.camera.right).toBe(34)
    world.applyQuality('medium')
    world.update(0.016, 1.0, new THREE.Vector3(0, 0, 32), null)
    expect(w.rearHallLights.length).toBeGreaterThan(0)
    expect(w.rearHallLights.every(l => !l.visible)).toBe(true)

    world.update(0.016, 2.0, new THREE.Vector3(0, 0, -20), null)
    expect(w.rearHallLights.every(l => l.visible)).toBe(true)

    physics.dispose()
  })
})
