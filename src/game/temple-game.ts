import * as THREE from 'three'
import type { Audio } from '../engine/audio'
import type { Input } from '../engine/input'
import { Assets } from '../engine/assets'
import { Physics, RAPIER } from '../engine/physics'
import type { Renderer } from '../engine/renderer'
import type { Quality } from '../engine/save'
import { CONFIG } from './config'
import { TEMPLE_MODEL_URLS } from './temple-assets'
import { POINT_TARGETS, TempleWorld, type ShrinePoint } from './temple-world'

export type TempleMode = 'loading' | 'select' | 'explore' | 'panel' | 'paused'

const HALF_HEIGHT = 0.55
const RADIUS = 0.36
const EYE = 1.62

export class TempleGame {
  mode: TempleMode = 'loading'
  reducedMotion = false
  readonly physics = new Physics(-24)
  readonly world: TempleWorld
  readonly camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, 1, 0.05, 220)
  private readonly body: RAPIER.RigidBody
  private readonly collider: RAPIER.Collider
  private readonly controller: RAPIER.KinematicCharacterController
  private yaw = 0
  private pitch = -0.04
  private vy = 0
  private time = 0
  private bob = 0
  private selectOrbit = 0
  private enteredAt = 0
  active: ShrinePoint | null = null
  onNear: (point: ShrinePoint | null) => void = () => undefined

  constructor(private readonly renderer: Renderer, private readonly input: Input, private readonly audio: Audio) {
    this.world = new TempleWorld(this.physics)
    const s = this.world.spawn
    this.body = this.physics.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(s.x, s.y, s.z))
    this.collider = this.physics.world.createCollider(RAPIER.ColliderDesc.capsule(HALF_HEIGHT, RADIUS).setFriction(0), this.body)
    this.controller = this.physics.world.createCharacterController(0.02)
    this.controller.enableAutostep(0.35, 0.2, false)
    this.controller.enableSnapToGround(0.35)
    this.renderer.gl.shadowMap.enabled = true
    this.physics.world.step()
  }

  async loadModels(assets: Assets): Promise<void> {
    const [avatar, statue] = await Promise.allSettled([assets.gltf(TEMPLE_MODEL_URLS.avatar), assets.gltf(TEMPLE_MODEL_URLS.guanyin)])
    if (avatar.status === 'fulfilled') this.world.setAvatar(avatar.value.scene)
    else console.warn('avatar model failed', avatar.reason)
    if (statue.status === 'fulfilled') this.world.setStatue(statue.value.scene)
    else console.warn('statue model failed', statue.reason)
  }

  get position(): THREE.Vector3 {
    const t = this.body.translation()
    return new THREE.Vector3(t.x, t.y, t.z)
  }

  showSelect(): void {
    this.mode = 'select'
    this.world.setAvatarVisible(true)
  }

  enter(): void {
    this.mode = 'explore'
    this.enteredAt = this.time
    this.world.setAvatarVisible(false)
    const s = this.world.spawn
    this.body.setTranslation({ x: s.x, y: s.y, z: s.z }, true)
    this.body.setNextKinematicTranslation({ x: s.x, y: s.y, z: s.z })
    this.yaw = 0
    this.pitch = -0.04
    this.audio.play('bell')
  }

  resume(): void {
    this.mode = 'explore'
    this.enteredAt = this.time
  }

  setQuality(quality: Quality): void { this.renderer.applyQuality(quality) }

  step(dt: number): void {
    this.time += dt
    if (this.mode !== 'explore') { this.input.consume('interact'); this.input.takeLook(); return }
    const raw = this.input.takeLook()
    // Pointer-lock acquisition can report one huge movement spike; ignore it and cap per-step turns.
    const settle = this.time - this.enteredAt < 0.25
    const look = settle ? { x: 0, y: 0 } : { x: THREE.MathUtils.clamp(raw.x, -0.25, 0.25), y: THREE.MathUtils.clamp(raw.y, -0.25, 0.25) }
    this.yaw -= look.x
    this.pitch = THREE.MathUtils.clamp(this.pitch - look.y, -1.1, 0.9)
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw))
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw))
    const wish = new THREE.Vector3().addScaledVector(right, this.input.move.x).addScaledVector(forward, this.input.move.y)
    const amount = Math.min(1, wish.length())
    if (amount > 0.01) wish.normalize()
    const speed = (this.input.held('sprint') ? CONFIG.player.sprintSpeed : CONFIG.player.walkSpeed) * amount
    const grounded = this.controller.computedGrounded()
    this.vy = grounded ? -1 : Math.max(-30, this.vy - 24 * dt)
    const desired = { x: wish.x * speed * dt, y: this.vy * dt, z: wish.z * speed * dt }
    this.controller.computeColliderMovement(this.collider, desired)
    const m = this.controller.computedMovement()
    const t = this.body.translation()
    const next = { x: t.x + m.x, y: t.y + m.y, z: t.z + m.z }
    if (next.y < -5) { const s = this.world.spawn; next.x = s.x; next.y = s.y; next.z = s.z }
    this.body.setNextKinematicTranslation(next)
    this.physics.step(dt)
    this.bob += speed * dt * 2.2
    const near = this.world.nearestPoint(new THREE.Vector3(next.x, 0, next.z))
    if (near?.id !== this.active?.id) { this.active = near; this.onNear(near) }
    if (this.input.consume('interact') && this.active) window.dispatchEvent(new CustomEvent('temple:interact', { detail: this.active.id }))
  }

  render(_alpha: number, frameSeconds: number): void {
    if (this.camera.fov !== CONFIG.camera.fov) { this.camera.fov = CONFIG.camera.fov; this.camera.updateProjectionMatrix() }
    const p = this.position
    if (this.mode === 'select' || this.mode === 'loading') {
      this.selectOrbit += frameSeconds * (this.reducedMotion ? 0 : 0.12)
      const a = Math.sin(this.selectOrbit) * 0.35
      this.camera.position.set(Math.sin(a) * 3.4, 1.5, 23.2 + Math.cos(a) * 3.4)
      this.camera.lookAt(0, 1.05, 23.2)
    } else {
      const bob = this.reducedMotion ? 0 : Math.sin(this.bob) * 0.03
      this.camera.position.set(p.x, p.y - HALF_HEIGHT - RADIUS + EYE + bob, p.z)
      this.camera.rotation.order = 'YXZ'
      this.camera.rotation.set(this.pitch, this.yaw, 0)
    }
    this.world.update(frameSeconds, this.time, p, this.mode === 'explore' || this.mode === 'panel' ? this.active?.id ?? null : null)
    this.renderer.render(this.world.scene, this.camera)
  }

  /** Teleport target used by the HUD map so visitors can reach a station quickly. */
  travelTo(id: string): void {
    const index = this.world.points.findIndex(item => item.id === id)
    if (index < 0) return
    const p = this.world.points[index].position
    const [tx, tz] = POINT_TARGETS[index]
    this.yaw = Math.atan2(-(tx - p.x), -(tz - p.z))
    this.pitch = -0.12
    this.body.setTranslation({ x: p.x, y: 1.2, z: p.z }, true)
    this.body.setNextKinematicTranslation({ x: p.x, y: 1.2, z: p.z })
  }
}
