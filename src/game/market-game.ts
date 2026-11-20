import * as THREE from 'three'
import type { Audio } from '../engine/audio'
import type { Input } from '../engine/input'
import { Physics, RAPIER } from '../engine/physics'
import type { Renderer } from '../engine/renderer'
import { CONFIG } from './config'
import { MarketWorld, type MarketPoint, type MarketPointId } from './market-world'
import { disposeWorldScene } from './world-dispose'

export type MarketMode = 'browse' | 'explore' | 'panel'
const HALF_HEIGHT = 0.55
const RADIUS = 0.36
const FOOT_OFFSET = HALF_HEIGHT + RADIUS
const DEFAULT_AZIMUTH = Math.PI / 4
const CAMERA_ELEVATION = 0.74 // Classic RO ~42° isometric tilt
const CAMERA_DISTANCE = 28
const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

/** Gameplay shell for the RO-style market. Its physics, scene and update loop are independent from TempleGame. */
export class MarketGame {
  mode: MarketMode = 'explore'
  readonly physics = new Physics(-24)
  readonly world = new MarketWorld(this.physics)
  /** Fixed-tilt orthographic camera with RO-style 360° azimuth orbit & zoom. */
  readonly camera = new THREE.OrthographicCamera(-8, 8, 8, -8, 0.05, 130)
  readonly body: RAPIER.RigidBody
  private readonly collider: RAPIER.Collider
  private readonly controller: RAPIER.KinematicCharacterController
  private readonly raycaster = new THREE.Raycaster()
  private zoom = 11.2
  private azimuth = DEFAULT_AZIMUTH
  private cameraTarget = new THREE.Vector3()
  private cameraReady = false
  private verticalVelocity = 0
  private moveTarget: THREE.Vector3 | null = null
  private pendingInteractId: MarketPointId | null = null
  private lastMoveSpeed = 0
  private lastFacingDirX = 0
  active: MarketPoint | null = null
  onNear: (point: MarketPoint | null) => void = () => undefined

  constructor(private readonly renderer: Renderer, private readonly input: Input, private readonly audio: Audio) {
    const spawn = this.world.spawn
    this.body = this.physics.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y, spawn.z))
    this.collider = this.physics.world.createCollider(RAPIER.ColliderDesc.capsule(HALF_HEIGHT, RADIUS).setFriction(0), this.body)
    this.controller = this.physics.world.createCharacterController(0.02)
    this.controller.enableAutostep(0.65, 0.15, false)
    this.controller.enableSnapToGround(0.65)
    this.physics.world.step()
  }

  enter(): void {
    const spawn = this.world.spawn
    this.body.setTranslation({ x: spawn.x, y: spawn.y, z: spawn.z }, true)
    this.body.setNextKinematicTranslation({ x: spawn.x, y: spawn.y, z: spawn.z })
    this.mode = 'explore'
    this.azimuth = DEFAULT_AZIMUTH
    this.zoom = window.innerHeight > window.innerWidth ? 14.5 : 11.2
    this.cameraReady = false
    this.clearMoveTarget()
    this.audio.play('chime')
  }

  startExplore(): void { this.mode = 'explore' }
  stopExplore(): void { this.mode = 'browse'; this.input.clearHeld(); this.clearMoveTarget() }
  openPanel(): void { this.mode = 'panel'; this.input.clearHeld(); this.clearMoveTarget() }
  closePanel(): void { this.mode = 'explore'; this.input.clearHeld() }
  get feet(): THREE.Vector3 { const p = this.body.translation(); return new THREE.Vector3(p.x, p.y - FOOT_OFFSET, p.z) }
  get worshipping(): boolean { return false }

  /** Walk smoothly to a named venue or portal (used by RO quick-nav HUD). */
  walkToPoint(id: MarketPointId): void {
    const target = this.world.points.find(p => p.id === id)
    if (!target) return
    if (this.mode === 'panel') this.closePanel()
    else if (this.mode !== 'explore') this.startExplore()
    this.moveTarget = new THREE.Vector3(target.position.x, 0, target.position.z)
    this.pendingInteractId = id
    this.world.setGroundCursor(target.position.x, target.position.z, true)
    this.audio.play('ui')
  }

  private clearMoveTarget(): void {
    this.moveTarget = null
    this.pendingInteractId = null
    this.world.setGroundCursor(0, 0, false)
  }

  private handleGroundClick(clientX: number, clientY: number): void {
    const rect = this.renderer.gl.domElement.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(ndc, this.camera)
    const hit = new THREE.Vector3()
    if (!this.raycaster.ray.intersectPlane(GROUND_PLANE, hit)) return

    // Clamp click destination within market fence boundaries
    hit.x = THREE.MathUtils.clamp(hit.x, -15.0, 15.0)
    hit.z = THREE.MathUtils.clamp(hit.z, -14.0, 11.8)

    // Check if the player clicked directly near a venue stall or return portal
    const clickedPoint = this.world.nearestPoint(hit)
    if (clickedPoint) {
      this.moveTarget = new THREE.Vector3(clickedPoint.position.x, 0, clickedPoint.position.z)
      this.pendingInteractId = clickedPoint.id
      this.world.setGroundCursor(clickedPoint.position.x, clickedPoint.position.z, true)
    } else {
      this.moveTarget = new THREE.Vector3(hit.x, 0, hit.z)
      this.pendingInteractId = null
      this.world.setGroundCursor(hit.x, hit.z, true)
    }
    this.audio.play('ui')
  }

  step(dt: number): void {
    const look = this.input.takeLook()
    const zoom = this.input.takeZoom()
    const clicks = this.input.takeClicks()

    if (this.mode === 'explore') {
      // Classic RO right-click drag rotates camera azimuth smoothly around the adventurer
      if (Math.abs(look.x) > 0.0001) {
        this.azimuth -= look.x * 1.15
      }
      this.zoom = THREE.MathUtils.clamp(this.zoom * Math.exp(zoom * 0.0012), 7.8, 16.5)

      if (clicks.length > 0) {
        const lastClick = clicks[clicks.length - 1]
        this.handleGroundClick(lastClick.x, lastClick.y)
      }
    }

    const forward = new THREE.Vector3(-Math.sin(this.azimuth), 0, -Math.cos(this.azimuth))
    const right = new THREE.Vector3(Math.cos(this.azimuth), 0, -Math.sin(this.azimuth))
    const wish = new THREE.Vector3()

    const manualInput = Math.abs(this.input.move.x) > 0.05 || Math.abs(this.input.move.y) > 0.05
    if (this.mode === 'explore') {
      if (manualInput) {
        this.clearMoveTarget()
        wish.addScaledVector(right, this.input.move.x).addScaledVector(forward, this.input.move.y)
      } else if (this.moveTarget) {
        const cur = this.body.translation()
        const dx = this.moveTarget.x - cur.x
        const dz = this.moveTarget.z - cur.z
        const dist = Math.hypot(dx, dz)
        const stopRadius = this.pendingInteractId ? 1.55 : 0.35
        if (dist <= stopRadius) {
          const triggerId = this.pendingInteractId
          this.clearMoveTarget()
          if (triggerId) {
            window.dispatchEvent(new CustomEvent('market:interact', { detail: triggerId }))
          }
        } else {
          wish.set(dx / dist, 0, dz / dist)
          // Smoothly steer around the Central Fountain at (0, 1.1) when auto-walking across the plaza
          const fx = cur.x - 0
          const fz = cur.z - 1.1
          const fDist = Math.hypot(fx, fz)
          if (fDist < 3.1 && fDist > 0.01) {
            const toFountainDot = (-fx / fDist) * wish.x + (-fz / fDist) * wish.z
            if (toFountainDot > 0.15) {
              const side = cur.x >= 0 ? 1 : -1
              const tangentX = (-fz / fDist) * side
              const tangentZ = (fx / fDist) * side
              const strength = THREE.MathUtils.clamp((3.1 - fDist) / 1.2, 0.35, 1.35)
              wish.x += tangentX * strength + (fx / fDist) * 0.45
              wish.z += tangentZ * strength + (fz / fDist) * 0.45
            }
          }
        }
      }
    }

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

    // Track horizontal speed & camera-space left/right direction for RO sprite animation
    const horizDist = Math.hypot(move.x, move.z)
    this.lastMoveSpeed = dt > 0 ? horizDist / dt : 0
    if (horizDist > 0.002) {
      const moveVec = new THREE.Vector3(move.x, 0, move.z).normalize()
      this.lastFacingDirX = moveVec.dot(right)
    }

    const point = this.world.nearestPoint(new THREE.Vector3(next.x, 0, next.z))
    if (point?.id !== this.active?.id) {
      this.active = point
      this.onNear(point)
    }
    if (this.mode === 'explore' && this.input.consume('interact') && this.active) {
      window.dispatchEvent(new CustomEvent('market:interact', { detail: this.active.id }))
    } else {
      this.input.consume('interact')
    }
  }

  render(_alpha: number, frameSeconds: number): void {
    const feet = this.feet
    this.world.avatar.position.copy(feet)
    const target = new THREE.Vector3(feet.x, feet.y + 1.25, feet.z)
    if (!this.cameraReady) {
      this.cameraTarget.copy(target)
      this.cameraReady = true
    } else {
      this.cameraTarget.lerp(target, 1 - Math.exp(-12 * Math.min(frameSeconds, 0.1)))
    }
    const aspect = Math.max(0.5, window.innerWidth / Math.max(1, window.innerHeight))
    this.camera.top = this.zoom
    this.camera.bottom = -this.zoom
    this.camera.right = this.zoom * aspect
    this.camera.left = -this.zoom * aspect
    this.camera.updateProjectionMatrix()

    const horiz = Math.cos(CAMERA_ELEVATION) * CAMERA_DISTANCE
    const vert = Math.sin(CAMERA_ELEVATION) * CAMERA_DISTANCE
    this.camera.position.set(
      this.cameraTarget.x + Math.sin(this.azimuth) * horiz,
      this.cameraTarget.y + vert,
      this.cameraTarget.z + Math.cos(this.azimuth) * horiz,
    )
    this.camera.lookAt(this.cameraTarget)
    this.world.update(frameSeconds, this.lastMoveSpeed, this.lastFacingDirX)
    this.renderer.render(this.world.scene, this.camera)
  }

  dispose(): void {
    this.input.clearHeld()
    this.clearMoveTarget()
    this.controller.free()
    this.physics.removeBody(this.body)
    disposeWorldScene(this.world.scene)
    this.physics.dispose()
  }
}
