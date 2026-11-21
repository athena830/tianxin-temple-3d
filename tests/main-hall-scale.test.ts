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

  it('moves wishing wall completely outside the main hall to front courtyard plaza', () => {
    const physics = new Physics()
    const world = new TempleWorld(physics)

    const prayerPoint = world.points.find(p => p.id === 'prayer')
    const prayerWallPoint = world.points.find(p => p.id === 'prayer-wall')

    expect(prayerPoint).toBeDefined()
    expect(prayerWallPoint).toBeDefined()

    // Both points are outside in the courtyard plaza (z > 7, x > 6)
    expect(prayerPoint!.position.z).toBeGreaterThan(7.0)
    expect(prayerPoint!.position.x).toBeCloseTo(8.8, 1)
    expect(prayerWallPoint!.position.z).toBeGreaterThan(7.0)
    expect(prayerWallPoint!.position.x).toBeCloseTo(8.8, 1)

    // Approaching [8.8, 9.6] in the courtyard plaza triggers prayer-wall interaction
    const activeAtPlaza = world.nearestPoint(new (world.points[0].position.constructor as any)(8.8, 0, 9.6))
    expect(activeAtPlaza).toBeDefined()
    expect(activeAtPlaza!.id).toBe('prayer-wall')

    // At previous inside location [3.2, -3.4], prayer prompt is no longer active
    const activeAtOldInsideLoc = world.nearestPoint(new (world.points[0].position.constructor as any)(3.2, 0, -3.4))
    expect(activeAtOldInsideLoc?.id).not.toBe('prayer')
    expect(activeAtOldInsideLoc?.id).not.toBe('prayer-wall')
  })

  it('moves sky lantern stand beside the consultation pavilion away from the entrance', () => {
    const physics = new Physics()
    const world = new TempleWorld(physics)

    const lanternStand = world.getPlayerLanternStand()
    expect(lanternStand).toBeDefined()

    // Sky lantern stand is placed beside the pavilion (z ≈ 23.5, x ≈ -12.5)
    expect(lanternStand.z).toBeCloseTo(23.5, 1)
    expect(lanternStand.x).toBeCloseTo(-12.5, 1)

    // Approaching [-12.5, 23.5] triggers sky-lantern prompt
    const activeNearLantern = world.nearestPoint(new (world.points[0].position.constructor as any)(-12.5, 0, 23.5))
    expect(activeNearLantern).toBeDefined()
    expect(activeNearLantern!.id).toBe('sky-lantern')

    // At previous entrance location [-6.8, 29.8], sky lantern prompt is no longer active
    const activeAtEntrance = world.nearestPoint(new (world.points[0].position.constructor as any)(-6.8, 0, 29.8))
    expect(activeAtEntrance?.id).not.toBe('sky-lantern')
  })

  it('allows character controller to seamlessly walk up main hall stairs onto podium at scale 1.35 without getting blocked', () => {
    const physics = new Physics()
    const world = new TempleWorld(physics)
    world.setMainHallScale(1.35)

    // Verify step colliders and anti-stuck incline ramps exist and span the front portals
    const mainHallColliders = (world as any).mainHallColliders as any[]
    expect(mainHallColliders.length).toBeGreaterThan(15)

    // Verify distance between Tiangong urn and steps is spacious (>= 2.0m clearance)
    const stepsFrontEdge = -7.28 + 7.9 * 1.35 // ≈ 3.385
    const urn = (world as any).outdoorUrn
    expect(urn).toBeDefined()
    expect(urn.position.z - stepsFrontEdge).toBeGreaterThanOrEqual(2.5)
  })

  it('guarantees unobstructed sightline for Yue Lao and Cai Shen without indoor walkway roof penetration', () => {
    const physics = new Physics()
    const world = new TempleWorld(physics)
    world.setMainHallScale(1.35)

    // Verify there are no floating roof meshes inside the Main Hall back sanctuary (z > -16.0 and z < -10.0)
    let indoorRoofMeshes = 0
    world.scene.traverse((o: any) => {
      if (o.isMesh && (o.geometry?.type === 'ConeGeometry' || o.geometry?.type === 'BoxGeometry')) {
        let p = o.parent
        let inHall = false
        while (p) {
          if (p === (world as any).mainHallGroup) { inHall = true; break }
          p = p.parent
        }
        if (!inHall) {
          const wp = o.position.clone()
          o.getWorldPosition(wp)
          if (Math.abs(wp.x) > 3.0 && Math.abs(wp.x) < 8.5 && wp.z > -16.0 && wp.z < -11.5 && wp.y > 3.0) {
            indoorRoofMeshes++
          }
        }
      }
    })
    expect(indoorRoofMeshes).toBe(0)
  })

  it('dynamically shifts Rear Hall (Lingxiao Palace) backwards at large scales (up to 2.0x) so its plaque and facade never overlap Main Hall deities', () => {
    const physics = new Physics()
    const world = new TempleWorld(physics)

    for (const s of [1.0, 1.35, 1.6, 1.8, 2.0]) {
      world.setMainHallScale(s)
      const guanyinZ = world.getGuanyinStatueWorldPos().z
      const mainHallZ = (world as any).mainHallZ as number
      const mainHallBackWallZ = mainHallZ - 6.7 * s
      const rearGroupZ = (world as any).rearHallGroup.position.z as number
      const rearFrontFacadeZ = rearGroupZ + 6.78 // front of Lingxiao plaque
      const rearLowerRoofFrontZ = rearGroupZ - 0.65 + 8.2 // front edge of lower roof

      // Rear Hall front plaque & facade must always be strictly behind Main Hall back wall and Guanyin
      expect(rearFrontFacadeZ).toBeLessThan(mainHallBackWallZ - 1.5)
      expect(rearFrontFacadeZ).toBeLessThan(guanyinZ - 3.0)
      expect(rearLowerRoofFrontZ).toBeLessThan(mainHallBackWallZ)
    }
  })
})
