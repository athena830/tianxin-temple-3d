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

/** Gameplay shell for the market. Its physics, scene and update loop are independent from TempleGame. */
export class MarketGame {
  mode: MarketMode = 'explore'
  readonly physics = new Physics(-24)
  readonly world = new MarketWorld(this.physics)
  readonly camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, 1, 0.05, 120)
  readonly body: RAPIER.RigidBody
  private readonly collider: RAPIER.Collider
  private readonly controller: RAPIER.KinematicCharacterController
  private yaw = 0
  private pitch = 0.3
  private zoom = 5.1
  private cameraTarget = new THREE.Vector3()
  private cameraReady = false
  private heading = 0
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
    this.yaw = 0
    this.heading = 0
    this.zoom = window.innerHeight > window.innerWidth ? 10.5 : 5.5
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
    const look = this.input.takeLook()
    const zoom = this.input.takeZoom()
    if (this.mode === 'explore') {
      this.yaw -= look.x
      this.pitch = THREE.MathUtils.clamp(this.pitch + look.y, -0.15, 1.05)
      this.zoom = THREE.MathUtils.clamp(this.zoom * Math.exp(zoom * 0.0012), 2.8, 12)
    }
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw))
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw))
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
    if (wish.lengthSq() > 0.001) this.heading = Math.atan2(wish.x, wish.z)
    const point = this.world.nearestPoint(new THREE.Vector3(next.x, 0, next.z))
    if (point?.id !== this.active?.id) { this.active = point; this.onNear(point) }
    if (this.mode === 'explore' && this.input.consume('interact') && this.active) window.dispatchEvent(new CustomEvent('market:interact', { detail: this.active.id }))
    else this.input.consume('interact')
    this.input.takeClicks()
  }

  render(_alpha: number, frameSeconds: number): void {
    const feet = this.feet
    this.world.avatar.position.copy(feet)
    this.world.avatar.rotation.y = this.heading
    const target = new THREE.Vector3(feet.x, feet.y + 1.25, feet.z)
    if (!this.cameraReady) { this.cameraTarget.copy(target); this.cameraReady = true }
    else this.cameraTarget.lerp(target, 1 - Math.exp(-12 * Math.min(frameSeconds, 0.1)))
    const dir = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch))
    this.camera.position.copy(this.cameraTarget).addScaledVector(dir, this.zoom)
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
