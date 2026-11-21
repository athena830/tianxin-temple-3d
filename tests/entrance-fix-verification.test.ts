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
import RAPIER from '@dimforge/rapier3d-compat'

describe('entrance fix verification test', () => {
  beforeAll(async () => {
    await initPhysics()
  })

  it('tests walking up the entrance at scale 1.35 across all gates', () => {
    const physics = new Physics()
    const world = new TempleWorld(physics)
    world.setMainHallScale(1.35)

    const HALF_HEIGHT = 0.55
    const RADIUS = 0.36
    const FOOT_OFFSET = HALF_HEIGHT + RADIUS

    const body = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, FOOT_OFFSET, 10.0)
    )
    const collider = physics.world.createCollider(
      RAPIER.ColliderDesc.capsule(HALF_HEIGHT, RADIUS).setFriction(0),
      body
    )
    const controller = physics.world.createCharacterController(0.02)
    controller.enableAutostep(0.65, 0.15, false)
    controller.enableSnapToGround(0.65)

    physics.world.step()

    // Test across central gate opening from x = -2.2 to +2.2
    for (const testX of [-2.0, -1.5, -1.0, -0.5, 0.5, 1.0, 1.5, 2.0]) {
      body.setTranslation({ x: testX, y: FOOT_OFFSET, z: 10.0 }, true)
      let curPos = { x: testX, y: FOOT_OFFSET, z: 10.0 }
      const dt = 1 / 60
      const speed = 4.0

      for (let step = 0; step < 300; step++) {
        const desired = { x: 0, y: -1 * dt, z: -speed * dt }
        controller.computeColliderMovement(collider, desired)
        const m = controller.computedMovement()
        curPos = { x: curPos.x + m.x, y: curPos.y + m.y, z: curPos.z + m.z }
        if (curPos.y < FOOT_OFFSET - 0.02) curPos.y = FOOT_OFFSET
        body.setNextKinematicTranslation(curPos)
        physics.step(dt)
      }

      console.log(`x=${testX}: end z=${curPos.z.toFixed(3)}, y=${curPos.y.toFixed(3)}`)
      // Should successfully reach inside the main hall (z < 0)
      expect(curPos.z).toBeLessThan(0)
    }
  })

  it('allows walking straight from Main Hall through left and right passageways into Rear Hall (Lingxiao Palace)', () => {
    const physics = new Physics()
    const world = new TempleWorld(physics)
    world.setMainHallScale(1.35)

    const HALF_HEIGHT = 0.55
    const RADIUS = 0.36
    const FOOT_OFFSET = HALF_HEIGHT + RADIUS

    const body = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(6.8, FOOT_OFFSET + 0.4, -11.5)
    )
    const collider = physics.world.createCollider(
      RAPIER.ColliderDesc.capsule(HALF_HEIGHT, RADIUS).setFriction(0),
      body
    )
    const controller = physics.world.createCharacterController(0.02)
    controller.enableAutostep(0.65, 0.15, false)
    controller.enableSnapToGround(0.65)

    physics.world.step()

    // Test walking straight North from Main Hall back aisle into Rear Hall across left & right portals
    for (const testX of [-8.8, -7.8, -6.8, -5.85, 5.85, 6.8, 7.8, 8.8]) {
      body.setTranslation({ x: testX, y: FOOT_OFFSET + 0.4, z: -11.5 }, true)
      let curPos = { x: testX, y: FOOT_OFFSET + 0.4, z: -11.5 }
      const dt = 1 / 60
      const speed = 4.5

      for (let step = 0; step < 240; step++) {
        const desired = { x: 0, y: -1 * dt, z: -speed * dt }
        controller.computeColliderMovement(collider, desired)
        const m = controller.computedMovement()
        curPos = { x: curPos.x + m.x, y: curPos.y + m.y, z: curPos.z + m.z }
        if (curPos.y < FOOT_OFFSET - 0.02) curPos.y = FOOT_OFFSET
        body.setNextKinematicTranslation(curPos)
        physics.step(dt)
      }

      console.log(`rear passage x=${testX}: end z=${curPos.z.toFixed(3)}, y=${curPos.y.toFixed(3)}`)
      // Should walk completely unobstructed through the passageway deep into the Rear Hall (z < -23.0)
      expect(curPos.z).toBeLessThan(-23.0)
    }
  })
})
