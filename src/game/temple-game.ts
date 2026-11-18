import * as THREE from 'three'
import type { Audio } from '../engine/audio'
import type { Input } from '../engine/input'
import { Assets } from '../engine/assets'
import { Physics, RAPIER } from '../engine/physics'
import type { Renderer } from '../engine/renderer'
import type { Quality } from '../engine/save'
import { CONFIG } from './config'
import { TEMPLE_MODEL_URLS } from './temple-assets'
import { LOTUS_POND, WISH_POOL } from './temple-courtyard'
import { POINT_TARGETS, TempleWorld, type ShrinePoint, type ShrinePointId } from './temple-world'

/**
 * - `browse`: in the temple, mouse is free for the page; the visitor stands still (default after entering).
 * - `explore`: WASD / arrows / stick move the visitor. The mouse is still never captured.
 * - `panel`: a ritual panel is open; movement stops and resumes into the previous mode on close.
 */
export type TempleMode = 'loading' | 'select' | 'browse' | 'explore' | 'panel'

const HALF_HEIGHT = 0.55
const RADIUS = 0.36
const FOOT_OFFSET = HALF_HEIGHT + RADIUS
const LOOK_HEIGHT = 1.25
const ZOOM_MIN = 2.4
const ZOOM_MAX = 8
const PITCH_MIN = -0.2
const PITCH_MAX = 1.15
/** Extra reach beyond a station's prompt radius at which a click still opens it. */
const CLICK_REACH = 1.4

export type ClickResult = { kind: 'open'; id: ShrinePointId } | { kind: 'far'; point: ShrinePoint } | null

export class TempleGame {
  mode: TempleMode = 'loading'
  /** Mode to return to when a panel closes. */
  private resumeMode: 'browse' | 'explore' = 'browse'
  reducedMotion = false
  readonly physics = new Physics(-24)
  readonly world: TempleWorld
  readonly camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, 1, 0.05, 220)
  private readonly body: RAPIER.RigidBody
  private readonly collider: RAPIER.Collider
  private readonly controller: RAPIER.KinematicCharacterController
  private readonly raycaster = new THREE.Raycaster()
  private yaw = 0
  private pitch = 0.32
  private zoom = 4.6
  private camDistance = 4.6
  private readonly camTarget = new THREE.Vector3()
  private camReady = false
  private heading = Math.PI
  private speedNow = 0
  private vy = 0
  private time = 0
  private selectOrbit = 0
  /** Seconds left in a worship pose (face the target, palms together, bow); movement is held meanwhile. */
  private ritualLeft = 0
  private ritualLength = 1
  private ritualHeading = 0
  private ritualDone: (() => void) | null = null
  /** Decorations temporarily hidden because they sit between the lens and the visitor. */
  private readonly occluders: THREE.Object3D[] = []
  active: ShrinePoint | null = null
  /** Station the guide arrow currently points to. */
  guide: ShrinePoint | null = null
  private targetDestination: THREE.Vector3 | null = null
  private pendingStationId: ShrinePointId | null = null
  private readonly clickMarker: THREE.Mesh
  onNear: (point: ShrinePoint | null) => void = () => undefined
  onGuide: (point: ShrinePoint | null, distance: number) => void = () => undefined
  onClickResult: (result: ClickResult) => void = () => undefined

  constructor(private readonly renderer: Renderer, private readonly input: Input, private readonly audio: Audio) {
    this.world = new TempleWorld(this.physics)
    const markerGeo = new THREE.RingGeometry(0.18, 0.44, 24)
    markerGeo.rotateX(-Math.PI / 2)
    this.clickMarker = new THREE.Mesh(
      markerGeo,
      new THREE.MeshBasicMaterial({ color: '#f5d688', transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false })
    )
    this.clickMarker.visible = false
    this.clickMarker.renderOrder = 4
    this.world.scene.add(this.clickMarker)
    const s = this.world.spawn
    this.body = this.physics.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(s.x, s.y, s.z))
    this.collider = this.physics.world.createCollider(RAPIER.ColliderDesc.capsule(HALF_HEIGHT, RADIUS).setFriction(0), this.body)
    this.controller = this.physics.world.createCharacterController(0.02)
    this.controller.enableAutostep(0.35, 0.2, false)
    this.controller.enableSnapToGround(0.35)
    this.renderer.gl.shadowMap.enabled = true
    this.physics.world.step()
  }

  async loadModels(_assets: Assets): Promise<void> {
    // Main hall Guanyin, Cai Shen, and Yue Lao are sculpted directly as 3D matte-clay chibi statues.
    void TEMPLE_MODEL_URLS
  }

  get position(): THREE.Vector3 {
    const t = this.body.translation()
    return new THREE.Vector3(t.x, t.y, t.z)
  }

  get feet(): THREE.Vector3 {
    const t = this.body.translation()
    return new THREE.Vector3(t.x, t.y - FOOT_OFFSET, t.z)
  }

  showSelect(): void {
    this.mode = 'select'
    this.world.placeAvatarAtStand()
  }

  /** Walk through the gate: the visitor appears inside, in browse mode (mouse free, standing still). */
  enter(): void {
    const s = this.world.spawn
    this.body.setTranslation({ x: s.x, y: s.y, z: s.z }, true)
    this.body.setNextKinematicTranslation({ x: s.x, y: s.y, z: s.z })
    this.yaw = 0
    this.pitch = 0.32
    this.heading = Math.PI
    this.camReady = false
    this.mode = 'browse'
    this.resumeMode = 'browse'
    this.audio.play('bell')
  }

  startExplore(): void {
    if (this.mode === 'browse' || this.mode === 'panel') { this.mode = 'explore'; this.resumeMode = 'explore' }
  }

  stopExplore(): void {
    if (this.mode === 'explore') { this.mode = 'browse'; this.resumeMode = 'browse' }
    this.input.clearHeld()
  }

  openPanel(): void {
    if (this.mode === 'browse' || this.mode === 'explore') { this.resumeMode = this.mode; this.mode = 'panel' }
    this.input.clearHeld()
  }

  closePanel(): void {
    if (this.mode === 'panel') this.mode = this.resumeMode
    this.input.clearHeld()
    this.input.takeClicks()
  }

  /** Turn the visitor toward a point and play the palms-together bow, then call `done`. */
  worship(target: { x: number; z: number }, seconds: number, done: () => void): void {
    const t = this.body.translation()
    this.ritualHeading = Math.atan2(target.x - t.x, target.z - t.z)
    this.ritualLeft = this.ritualLength = seconds
    this.ritualDone = done
    this.input.clearHeld()
  }

  /** Position visitor and frame cinematic camera towards the Lotus Wishing Pool (defaults to the magnificent East Lotus Pond). */
  frameWishingPool(): void {
    const p = this.body.translation()
    const distEast = Math.hypot(p.x - LOTUS_POND.x, p.z - LOTUS_POND.z)
    const distWest = Math.hypot(p.x - WISH_POOL.x, p.z - WISH_POOL.z)
    const isWest = distWest < distEast && distWest < 8.0
    const targetPool = isWest ? WISH_POOL : LOTUS_POND

    const poolX = targetPool.x
    const poolZ = targetPool.z
    const dist = Math.hypot(p.x - poolX, p.z - poolZ)

    // Ensure character Y is never below ground level (safety floor guard)
    const safeBodyY = FOOT_OFFSET + 0.05

    // If visitor is farther than viewing station, position them neatly at the stone viewing platform
    if (dist > (isWest ? 5.2 : 7.2)) {
      const approachX = isWest ? poolX + 3.8 : poolX - 5.8
      const approachZ = poolZ
      this.body.setTranslation({ x: approachX, y: safeBodyY, z: approachZ }, true)
      this.body.setNextKinematicTranslation({ x: approachX, y: safeBodyY, z: approachZ })
      this.camTarget.set(approachX, LOOK_HEIGHT, approachZ)
    } else if (p.y < FOOT_OFFSET) {
      // Fix any sunken position immediately
      this.body.setTranslation({ x: p.x, y: safeBodyY, z: p.z }, true)
      this.body.setNextKinematicTranslation({ x: p.x, y: safeBodyY, z: p.z })
    }

    // Orient visitor to face the center of the lotus pool
    const curP = this.body.translation()
    this.heading = Math.atan2(poolX - curP.x, poolZ - curP.z)

    // Frame camera over visitor's shoulder looking directly at the lotus pool
    this.yaw = this.heading + Math.PI - 0.22
    this.pitch = 0.26
    this.zoom = 4.2
    this.camDistance = 4.2
  }

  get worshipping(): boolean { return this.ritualLeft > 0 }
  get inTemple(): boolean { return this.mode === 'browse' || this.mode === 'explore' || this.mode === 'panel' }

  setQuality(quality: Quality): void { this.renderer.applyQuality(quality) }

  step(dt: number): void {
    this.time += dt
    if (this.mode === 'loading' || this.mode === 'select') { this.input.consume('interact'); this.input.takeLook(); this.input.takeZoom(); this.input.takeClicks(); return }
    const free = this.mode === 'browse' || this.mode === 'explore'
    const look = this.input.takeLook()
    const zoom = this.input.takeZoom()
    if (free) {
      this.yaw -= look.x
      this.pitch = THREE.MathUtils.clamp(this.pitch + look.y, PITCH_MIN, PITCH_MAX)
      this.zoom = THREE.MathUtils.clamp(this.zoom * Math.exp(zoom * 0.0012), ZOOM_MIN, ZOOM_MAX)
    }
    if (this.ritualLeft > 0) {
      this.ritualLeft -= dt
      let diff = this.ritualHeading - this.heading
      diff = Math.atan2(Math.sin(diff), Math.cos(diff))
      this.heading += diff * Math.min(1, dt * 8)
      if (this.ritualLeft <= 0) { this.ritualLeft = 0; const done = this.ritualDone; this.ritualDone = null; done?.() }
    }
    const moving = (this.mode === 'explore' || this.mode === 'browse') && this.ritualLeft <= 0
    const hasKeyMove = Math.hypot(this.input.move.x, this.input.move.y) > 0.05
    if (hasKeyMove) {
      this.targetDestination = null
      this.pendingStationId = null
      this.clickMarker.visible = false
    }

    if (this.clickMarker.visible) {
      const pulse = 1.0 + Math.sin(this.time * 6) * 0.12
      this.clickMarker.scale.set(pulse, pulse, pulse)
      this.clickMarker.rotation.z += dt * 1.6
    }

    const t = this.body.translation()
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw))
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw))
    const wish = new THREE.Vector3()

    if (moving) {
      if (hasKeyMove) {
        wish.addScaledVector(right, this.input.move.x).addScaledVector(forward, this.input.move.y)
      } else if (this.targetDestination) {
        const toTarget = new THREE.Vector3(
          this.targetDestination.x - t.x,
          0,
          this.targetDestination.z - t.z
        )
        const dist = toTarget.length()
        if (dist < 0.45) {
          this.targetDestination = null
          this.clickMarker.visible = false
          if (this.pendingStationId) {
            window.dispatchEvent(new CustomEvent('temple:interact', { detail: this.pendingStationId }))
            this.pendingStationId = null
          }
        } else {
          wish.copy(toTarget.normalize())
        }
      }
    }
    const amount = Math.min(1, wish.length())
    if (amount > 0.01) wish.normalize()
    const speed = moving ? (this.input.held('sprint') ? CONFIG.player.sprintSpeed : CONFIG.player.walkSpeed) * amount : 0
    const grounded = this.controller.computedGrounded()
    this.vy = grounded ? -1 : Math.max(-30, this.vy - 24 * dt)
    const desired = { x: wish.x * speed * dt, y: this.vy * dt, z: wish.z * speed * dt }
    this.controller.computeColliderMovement(this.collider, desired)
    const m = this.controller.computedMovement()
    const next = { x: t.x + m.x, y: t.y + m.y, z: t.z + m.z }
    if (next.y < FOOT_OFFSET - 0.02) { next.y = FOOT_OFFSET; this.vy = 0 }
    if (next.y < -5) { const s = this.world.spawn; next.x = s.x; next.y = s.y; next.z = s.z }
    this.body.setNextKinematicTranslation(next)
    this.physics.step(dt)
    this.speedNow = Math.hypot(m.x, m.z) / Math.max(dt, 1e-4)
    if (amount > 0.01) {
      const targetHeading = Math.atan2(wish.x, wish.z)
      let diff = targetHeading - this.heading
      diff = Math.atan2(Math.sin(diff), Math.cos(diff))
      this.heading += diff * Math.min(1, dt * 12)
    }

    const here = new THREE.Vector3(next.x, 0, next.z)
    const near = this.mode === 'panel' ? this.active : this.world.nearestPoint(here)
    if (near?.id !== this.active?.id) { this.active = near; this.onNear(near) }
    if (this.guide) {
      const d = Math.hypot(this.guide.position.x - next.x, this.guide.position.z - next.z)
      if (near?.id === this.guide.id) this.setGuide(null)
      else this.onGuide(this.guide, d)
    }
    if (free && this.ritualLeft <= 0 && this.input.consume('interact') && this.active) window.dispatchEvent(new CustomEvent('temple:interact', { detail: this.active.id }))
    else this.input.consume('interact')
    const clicks = this.input.takeClicks()
    if (free && this.ritualLeft <= 0 && clicks.length) this.onClickResult(this.pick(clicks[clicks.length - 1]))
  }

  /** Resolve a canvas click to a station; open it when close enough or walk to clicked point. */
  pick(client: { x: number; y: number }): ClickResult {
    const rect = this.renderer.gl.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(((client.x - rect.left) / rect.width) * 2 - 1, -((client.y - rect.top) / rect.height) * 2 + 1)
    this.raycaster.setFromCamera(ndc, this.camera)
    const ignore = new Set([...this.world.pickIgnore, this.clickMarker])
    const visible = (o: THREE.Object3D | null): boolean => {
      for (let n = o; n; n = n.parent) { if (!n.visible || ignore.has(n)) return false }
      return true
    }
    const hit = this.raycaster.intersectObjects(this.world.scene.children, true).find(h => h.object instanceof THREE.Mesh && visible(h.object))
    if (!hit) return null

    // 1. Check if clicked on or near a shrine interactive station
    let best: ShrinePoint | null = null
    let bestD = 2.4
    let targetApproach: [number, number] | null = null
    this.world.points.forEach((point, i) => {
      const [tx, tz] = POINT_TARGETS[i]
      const d = Math.min(Math.hypot(hit.point.x - point.position.x, hit.point.z - point.position.z), Math.hypot(hit.point.x - tx, hit.point.z - tz))
      if (d < bestD) { bestD = d; best = point; targetApproach = [tx, tz] }
    })
    const point = best as ShrinePoint | null
    const p = this.body.translation()

    if (point) {
      const reach = Math.hypot(point.position.x - p.x, point.position.z - p.z)
      if (reach <= point.radius + CLICK_REACH) {
        this.targetDestination = null
        this.clickMarker.visible = false
        return { kind: 'open', id: point.id }
      }
      // Clicked a station farther away: auto-walk to it with click marker!
      const destX = targetApproach ? targetApproach[0] : point.position.x
      const destZ = targetApproach ? targetApproach[1] : point.position.z
      this.targetDestination = new THREE.Vector3(destX, hit.point.y, destZ)
      this.pendingStationId = point.id
      this.clickMarker.position.set(destX, hit.point.y + 0.04, destZ)
      this.clickMarker.visible = true
      return { kind: 'far', point }
    }

    // 2. Clicked on ground / road / courtyard / steps: walk to clicked position!
    if (hit.point.y < 2.5 && (!hit.face || hit.face.normal.y > 0.4)) {
      this.targetDestination = new THREE.Vector3(hit.point.x, hit.point.y, hit.point.z)
      this.pendingStationId = null
      this.clickMarker.position.set(hit.point.x, hit.point.y + 0.04, hit.point.z)
      this.clickMarker.visible = true
    }
    return null
  }

  /**
   * Lanterns, beams and other collider-less decorations can still block the view; hide any mesh crossing the
   * lens-to-visitor segment for this frame. Walls never reach here because the physics ray already pulled the lens in.
   */
  private hideOccluders(): void {
    for (const o of this.occluders) o.visible = true
    this.occluders.length = 0
    const toTarget = this.camTarget.clone().sub(this.camera.position)
    const dist = toTarget.length()
    if (dist < 0.2) return
    toTarget.divideScalar(dist)
    // Start a little behind the lens so meshes that enclose the camera are caught too.
    const origin = this.camera.position.clone().addScaledVector(toTarget, -0.6)
    this.raycaster.camera = this.camera
    this.raycaster.set(origin, toTarget)
    this.raycaster.near = 0
    this.raycaster.far = dist + 0.6 - 0.45
    const ignore = new Set(this.world.pickIgnore)
    try {
      for (const hit of this.raycaster.intersectObjects(this.world.scene.children, true)) {
        let skip = false
        for (let n: THREE.Object3D | null = hit.object; n; n = n.parent) { if (ignore.has(n) || !n.visible) { skip = true; break } }
        if (skip || !(hit.object instanceof THREE.Mesh)) continue
        hit.object.visible = false
        this.occluders.push(hit.object)
      }
    } catch {
      // Gracefully prevent any raycast error on non-mesh objects from interrupting render
    }
    this.raycaster.far = Infinity
  }

  /** Show a guide arrow toward a station instead of teleporting. */
  setGuide(id: ShrinePointId | null): void {
    this.guide = id ? this.world.points.find(p => p.id === id) ?? null : null
    const p = this.body.translation()
    this.onGuide(this.guide, this.guide ? Math.hypot(this.guide.position.x - p.x, this.guide.position.z - p.z) : 0)
  }

  render(_alpha: number, frameSeconds: number): void {
    if (this.camera.fov !== CONFIG.camera.fov) { this.camera.fov = CONFIG.camera.fov; this.camera.updateProjectionMatrix() }
    const p = this.position
    const dt = Math.min(frameSeconds, 0.1)
    if (this.mode === 'select' || this.mode === 'loading') {
      this.selectOrbit += frameSeconds * (this.reducedMotion ? 0 : 0.12)
      const a = Math.sin(this.selectOrbit) * 0.35
      const st = this.world.spawn
      this.camera.position.set(st.x + Math.sin(a) * 3.2, 1.35, st.z + Math.cos(a) * 3.2)
      this.camera.lookAt(st.x, 0.85, st.z)
      this.world.animateAvatar(dt, this.time, 0, this.reducedMotion)
      this.world.setGuide(null, null, this.time)
    } else {
      const feet = this.feet
      this.world.placeAvatar(feet, this.heading)
      const bow = this.ritualLeft > 0 ? 1 - this.ritualLeft / this.ritualLength : 0
      this.world.animateAvatar(dt, this.time, this.speedNow, this.reducedMotion, bow)
      const target = new THREE.Vector3(feet.x, feet.y + LOOK_HEIGHT, feet.z)
      if (!this.camReady) { this.camTarget.copy(target); this.camDistance = this.zoom; this.camReady = true }
      else this.camTarget.lerp(target, 1 - Math.exp(-14 * dt))
      const dir = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch))
      // Pull the camera in front of walls/pillars between the visitor and the lens.
      let allowed = this.zoom
      const ray = new RAPIER.Ray({ x: this.camTarget.x, y: this.camTarget.y, z: this.camTarget.z }, { x: dir.x, y: dir.y, z: dir.z })
      const hit = this.physics.world.castRay(ray, this.zoom + 0.3, true, undefined, undefined, undefined, this.body)
      if (hit) allowed = Math.max(0.5, Math.min(allowed, hit.timeOfImpact - 0.3))
      // Snap closer immediately when blocked; ease back out when clear.
      this.camDistance = allowed < this.camDistance ? allowed : THREE.MathUtils.damp(this.camDistance, allowed, 6, dt)
      this.camera.position.copy(this.camTarget).addScaledVector(dir, this.camDistance)
      this.camera.lookAt(this.camTarget)
      this.hideOccluders()
      this.world.setGuide(this.guide ? feet : null, this.guide ? this.guide.position : null, this.time)
    }
    this.world.update(frameSeconds, this.time, p, this.inTemple ? this.active?.id ?? null : null, this.camera)
    this.renderer.render(this.world.scene, this.camera)
  }
}
