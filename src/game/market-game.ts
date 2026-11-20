import * as THREE from 'three'
import type { Audio } from '../engine/audio'
import type { Input } from '../engine/input'
import { Physics, RAPIER } from '../engine/physics'
import type { Renderer } from '../engine/renderer'
import { CONFIG } from './config'
import { MarketWorld, type MarketPoint } from './market-world'
import { disposeWorldScene } from './world-dispose'

export type MarketMode = 'browse' | 'explore' | 'panel'
const HALF_HEIGHT = 0.55
const RADIUS = 0.36
const FOOT_OFFSET = HALF_HEIGHT + RADIUS
const ISOMETRIC_DIRECTION = new THREE.Vector3(0.72, 0.94, 0.72).normalize()
const ISOMETRIC_AZIMUTH = Math.PI / 4

/** Gameplay shell for the market. Its physics, scene and update loop are independent from TempleGame. */
export class MarketGame {
  mode: MarketMode = 'explore'
  readonly physics = new Physics(-24)
  readonly world = new MarketWorld(this.physics)
  /** A fixed orthographic camera gives the market its readable 2.5D isometric silhouette. */
  readonly camera = new THREE.OrthographicCamera(-8, 8, 8, -8, 0.05, 120)
  readonly body: RAPIER.RigidBody
  private readonly collider: RAPIER.Collider
  private readonly controller: RAPIER.KinematicCharacterController
  private zoom = 11.5
  private cameraTarget = new THREE.Vector3()
  private cameraReady = false
  private verticalVelocity = 0
  active: MarketPoint | null = null
  onNear: (point: MarketPoint | null) => void = () => undefined

  constructor(private readonly renderer: Renderer, private readonly input: Input, private readonly audio: Audio) {
    const spawn = this.world.spawn
    this.body = this.physics.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y, spawn.z))
    this.collider = this.physics.world.createCollider(RAPIER.ColliderDesc.capsule(HALF_HEIGHT, RADIUS).setFriction(0), this.body)
    this.controller = this.physics.world.createCharacterController(0.02)
    this.controller.enableAutostep(0.65, 0.15, false)
    this.controller.enableSnapToGround(0.65)
    this.controller.enableSnapToGround(0.35)
    this.physics.world.step()
  }

  enter(): void {
    const spawn = this.world.spawn
    this.body.setTranslation({ x: spawn.x, y: spawn.y, z: spawn.z }, true)
    this.body.setNextKinematicTranslation({ x: spawn.x, y: spawn.y, z: spawn.z })
    this.mode = 'explore'
    this.zoom = window.innerHeight > window.innerWidth ? 14.8 : 11.5
    this.cameraReady = false
    this.audio.play('chime')
  }

  startExplore(): void { this.mode = 'explore' }
  stopExplore(): void { this.mode = 'browse'; this.input.clearHeld() }
  openPanel(): void { this.mode = 'panel'; this.input.clearHeld() }
  closePanel(): void { this.mode = 'explore'; this.input.clearHeld() }
  get feet(): THREE.Vector3 { const p = this.body.translation(); return new THREE.Vector3(p.x, p.y - FOOT_OFFSET, p.z) }
  get worshipping(): boolean { return false }

  step(dt: number): void {
    this.input.takeLook()
    const zoom = this.input.takeZoom()
    if (this.mode === 'explore') {
      this.zoom = THREE.MathUtils.clamp(this.zoom * Math.exp(zoom * 0.0012), 9.5, 17)
    }
    const forward = new THREE.Vector3(-Math.sin(ISOMETRIC_AZIMUTH), 0, -Math.cos(ISOMETRIC_AZIMUTH))
    const right = new THREE.Vector3(Math.cos(ISOMETRIC_AZIMUTH), 0, -Math.sin(ISOMETRIC_AZIMUTH))
    const wish = new THREE.Vector3()
    if (this.mode === 'explore') wish.addScaledVector(right, this.input.move.x).addScaledVector(forward, this.input.move.y)
    if (wish.lengthSq() > 1) wish.normalize()
    const grounded = this.controller.computedGrounded()
    this.verticalVelocity = grounded ? -1 : Math.max(-30, this.verticalVelocity - 24 * dt)
    const t = this.body.translation()
    const speed = this.input.held('sprint') ? CONFIG.player.sprintSpeed : CONFIG.player.walkSpeed
    this.controller.computeColliderMovement(this.collider, { x: wish.x * speed * dt, y: this.verticalVelocity * dt, z: wish.z * speed * dt })
    const move = this.controller.computedMovement()
    const next = { x: t.x + move.x, y: Math.max(FOOT_OFFSET, t.y + move.y), z: t.z + move.z }
    this.body.setNextKinematicTranslation(next)
    this.physics.step(dt)
    const point = this.world.nearestPoint(new THREE.Vector3(next.x, 0, next.z))
    if (point?.id !== this.active?.id) { this.active = point; this.onNear(point) }
    if (this.mode === 'explore' && this.input.consume('interact') && this.active) window.dispatchEvent(new CustomEvent('market:interact', { detail: this.active.id }))
    else this.input.consume('interact')
    this.input.takeClicks()
  }

  render(_alpha: number, frameSeconds: number): void {
    const feet = this.feet
    this.world.avatar.position.copy(feet)
    const target = new THREE.Vector3(feet.x, feet.y + 1.25, feet.z)
    if (!this.cameraReady) { this.cameraTarget.copy(target); this.cameraReady = true }
    else this.cameraTarget.lerp(target, 1 - Math.exp(-12 * Math.min(frameSeconds, 0.1)))
    const aspect = Math.max(0.5, window.innerWidth / Math.max(1, window.innerHeight))
    this.camera.top = this.zoom
    this.camera.bottom = -this.zoom
    this.camera.right = this.zoom * aspect
    this.camera.left = -this.zoom * aspect
    this.camera.updateProjectionMatrix()
    this.camera.position.copy(this.cameraTarget).addScaledVector(ISOMETRIC_DIRECTION, 26)
    this.camera.lookAt(this.cameraTarget)
    this.world.update(frameSeconds)
    this.renderer.render(this.world.scene, this.camera)
  }

  dispose(): void {
    this.input.clearHeld()
    this.controller.free()
    this.physics.removeBody(this.body)
    disposeWorldScene(this.world.scene)
    this.physics.dispose()
  }
}
