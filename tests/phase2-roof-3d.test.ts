import { describe, it, expect, beforeAll } from 'vitest'
import * as THREE from 'three'
import { initPhysics, Physics } from '../src/engine/physics'
import { TempleWorld, DRAGON_GUANYIN_POS } from '../src/game/temple-world'
import { TemplePbrLibrary } from '../src/game/temple-pbr-materials'
import { TempleRoof3D } from '../src/game/temple-roof-3d'

describe('Phase 2 Main Hall Stylized Realism 3D Roof & Eave Benchmark', () => {
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

  it('builds full 3D architectural hierarchy with instanced tiles, dougong, and swallowtail crest', () => {
    const pbr = new TemplePbrLibrary()
    const roof3D = new TempleRoof3D({
      width: 20.6,
      depth: 16.2,
      eaveY: 5.35,
      peakY: 9.8,
      pbr,
    })

    expect(roof3D.root).toBeInstanceOf(THREE.Group)
    expect(roof3D.root.children.length).toBeGreaterThan(5)

    // Check presence of instanced meshes
    let instancedCount = 0
    let totalMeshCount = 0
    roof3D.root.traverse((obj) => {
      if ((obj as THREE.InstancedMesh).isInstancedMesh) {
        instancedCount++
      } else if ((obj as THREE.Mesh).isMesh) {
        totalMeshCount++
      }
    })

    // At least 6 InstancedMesh objects (tubes, wadang, drips, dougong blocks, arms, beaks)
    expect(instancedCount).toBeGreaterThanOrEqual(6)
    expect(totalMeshCount).toBeGreaterThan(15)

    // Check quality switching
    roof3D.applyQuality('low')
    expect(roof3D.currentQuality).toBe('low')
    // In low quality, mediumDetailGroup (containing tiles) is hidden
    expect(roof3D['mediumDetailGroup'].visible).toBe(false)

    roof3D.applyQuality('medium')
    expect(roof3D.currentQuality).toBe('medium')
    // In medium quality, mediumDetailGroup (containing tiles) is visible
    expect(roof3D['mediumDetailGroup'].visible).toBe(true)

    roof3D.applyQuality('high')
    expect(roof3D.currentQuality).toBe('high')
    // In high quality, mediumDetailGroup (containing tiles) is visible
    expect(roof3D['mediumDetailGroup'].visible).toBe(true)

    // Safe disposal test
    roof3D.dispose()
    pbr.dispose()
  })

  it('preserves all Guanyin coordinates and gameplay interactions with new 3D roof integrated', () => {
    const physics = new Physics(-24)
    const world = new TempleWorld(physics)
    const w = world as unknown as {
      guanyinRoot: THREE.Group | null
      dragonGuanyinBillboard?: THREE.Group
      roof: THREE.Group
      mainHallRoof3D?: TempleRoof3D
    }

    // 1. Regular Guanyin coordinates/rotation/scale MUST be exactly preserved
    expect(w.guanyinRoot).not.toBeNull()
    expect(w.guanyinRoot!.position.x).toBeCloseTo(0, 4)
    expect(w.guanyinRoot!.position.y).toBeCloseTo(1.82, 4)
    expect(w.guanyinRoot!.position.z).toBeCloseTo(-5.68, 4)
    expect(w.guanyinRoot!.rotation.x).toBe(0)
    expect(w.guanyinRoot!.rotation.y).toBe(0)
    expect(w.guanyinRoot!.rotation.z).toBe(0)

    // 2. Dragon Guanyin coordinates verified against DRAGON_GUANYIN_POS (-68.0, 0.545, 31.0)
    expect(w.dragonGuanyinBillboard).toBeDefined()
    expect(DRAGON_GUANYIN_POS.x).toBeCloseTo(-68.0, 4)
    expect(DRAGON_GUANYIN_POS.y).toBeCloseTo(0.545, 4)
    expect(DRAGON_GUANYIN_POS.z).toBeCloseTo(31.0, 4)

    // 3. Main Hall 3D roof is mounted inside w.roof
    expect(w.mainHallRoof3D).toBeDefined()
    expect(w.roof.children.length).toBeGreaterThan(0)

    // 4. Quality preset forwards correctly
    world.applyQuality('low')
    expect(w.mainHallRoof3D!.currentQuality).toBe('low')
    world.applyQuality('high')
    expect(w.mainHallRoof3D!.currentQuality).toBe('high')

    physics.dispose()
  })
})
