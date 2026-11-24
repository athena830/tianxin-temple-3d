import * as THREE from 'three'
import type { Audio } from '../engine/audio'
import type { Input } from '../engine/input'
import { Physics, RAPIER } from '../engine/physics'
import type { Renderer } from '../engine/renderer'
import { CONFIG } from './config'
import {
  MarketWorld,
  fetchTaichungWeather,
  type MarketPoint,
  type MarketPointId,
  type TaichungWeatherInfo,
} from './market-world'
import { PLAYER_TARGET_HEIGHT, SHARED_ORTHO_CAMERA_CONFIG } from './sceneConfig'
import { disposeWorldScene } from './world-dispose'

export type MarketMode = 'browse' | 'explore' | 'panel'
const HALF_HEIGHT = 0.55
const RADIUS = 0.36
const FOOT_OFFSET = HALF_HEIGHT + RADIUS
const DEFAULT_AZIMUTH = SHARED_ORTHO_CAMERA_CONFIG.defaultAzimuth
const DEFAULT_ELEVATION = SHARED_ORTHO_CAMERA_CONFIG.defaultElevation
const EYE_LEVEL_ELEVATION = SHARED_ORTHO_CAMERA_CONFIG.eyeLevelElevation
const MIN_ELEVATION = SHARED_ORTHO_CAMERA_CONFIG.minElevation
const MAX_ELEVATION = SHARED_ORTHO_CAMERA_CONFIG.maxElevation
const CAMERA_DISTANCE = SHARED_ORTHO_CAMERA_CONFIG.distance
const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

/**
 * 台灣雨夜霓虹 × Low-Poly 2.5D「靈光市集」互動遊戲控制層。
 * 強制共用 `sceneConfig.ts` 中與玉皇宮一致的 OrthographicCamera 視覺比例，
 * 具備 360° 全方位旋轉正交視角、Raycaster + Lerp 點擊地面移動、
 * 攤位點擊熱區（Hotspots）與滑鼠移入高亮回饋，以及 GLTFLoader 角色模型替換介面。
 */
export class MarketGame {
  mode: MarketMode = 'explore'
  readonly physics = new Physics(-24)
  readonly world = new MarketWorld(this.physics)
  /** 正交 2.5D 俯視角鏡頭，強制共用玉皇宮視覺比例參數，支援 360° 自由旋轉、仰角微調與滾輪縮放 */
  readonly camera = new THREE.OrthographicCamera(
    -SHARED_ORTHO_CAMERA_CONFIG.frustumSize / 2,
    SHARED_ORTHO_CAMERA_CONFIG.frustumSize / 2,
    SHARED_ORTHO_CAMERA_CONFIG.frustumSize / 2,
    -SHARED_ORTHO_CAMERA_CONFIG.frustumSize / 2,
    SHARED_ORTHO_CAMERA_CONFIG.near,
    SHARED_ORTHO_CAMERA_CONFIG.far,
  )
  readonly body: RAPIER.RigidBody
  private readonly collider: RAPIER.Collider
  private readonly controller: RAPIER.KinematicCharacterController
  private readonly raycaster = new THREE.Raycaster()
  private readonly onPointerMoveBound: (e: PointerEvent) => void
  private cameraZoom: number = SHARED_ORTHO_CAMERA_CONFIG.zoom
  private azimuth: number = DEFAULT_AZIMUTH
  private targetAzimuth: number = DEFAULT_AZIMUTH
  private elevation: number = DEFAULT_ELEVATION
  private targetElevation: number = DEFAULT_ELEVATION
  private cameraTarget = new THREE.Vector3()
  private cameraReady = false
  private verticalVelocity = 0
  private moveTarget: THREE.Vector3 | null = null
  private pendingInteractId: MarketPointId | null = null
  private lastMoveSpeed = 0
  private lastFacingYaw = 0
  private weatherSyncTimer = 0
  active: MarketPoint | null = null
  onNear: (point: MarketPoint | null) => void = () => undefined

  constructor(private readonly renderer: Renderer, private readonly input: Input, private readonly audio: Audio) {
    const spawn = this.world.spawn
    this.body = this.physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y, spawn.z),
    )
    this.collider = this.physics.world.createCollider(
      RAPIER.ColliderDesc.capsule(HALF_HEIGHT, RADIUS).setFriction(0),
      this.body,
    )
    this.controller = this.physics.world.createCharacterController(0.02)
    this.controller.enableAutostep(0.65, 0.15, false)
    this.controller.enableSnapToGround(0.65)
    this.physics.world.step()

    this.onPointerMoveBound = (e: PointerEvent) => this.handlePointerMove(e)
    this.renderer.gl.domElement.addEventListener('pointermove', this.onPointerMoveBound)
    void this.syncLiveWeather()
  }

  /** 同步設定角色色盤（素心行者 / 丹心行者 / 月照行者） */
  setCharacter(id: string): void {
    this.world.setCharacter(id)
  }

  /** 預留介面：透過 GLTFLoader 替換真實 3D 角色模型 */
  loadCharacterModel(url: string, targetHeight = PLAYER_TARGET_HEIGHT): Promise<THREE.Object3D> {
    return this.world.loadCharacterModel(url, targetHeight)
  }

  /** 除錯輔助：即時微調市集整體建築比例（0.7 ~ 1.5，預設 1.0） */
  setMarketBuildingScale(scale: number): void {
    this.world.setMarketBuildingScale(scale)
  }

  getMarketBuildingScale(): number {
    return this.world.getMarketBuildingScale()
  }

  /** 同步台中即時氣象至市集場景（晴天／雨天／多雲／日夜） */
  async syncLiveWeather(): Promise<TaichungWeatherInfo> {
    const info = await fetchTaichungWeather()
    this.world.applyWeather(info)
    window.dispatchEvent(new CustomEvent('market:weather', { detail: info }))
    return info
  }

  enter(): void {
    const spawn = this.world.spawn
    this.body.setTranslation({ x: spawn.x, y: spawn.y, z: spawn.z }, true)
    this.body.setNextKinematicTranslation({ x: spawn.x, y: spawn.y, z: spawn.z })
    this.mode = 'explore'
    this.azimuth = DEFAULT_AZIMUTH
    this.targetAzimuth = DEFAULT_AZIMUTH
    this.elevation = DEFAULT_ELEVATION
    this.targetElevation = DEFAULT_ELEVATION
    this.cameraZoom = window.innerHeight > window.innerWidth ? SHARED_ORTHO_CAMERA_CONFIG.zoom * 0.78 : SHARED_ORTHO_CAMERA_CONFIG.zoom
    this.cameraReady = false
    this.clearMoveTarget()
    this.world.setHoveredPoint(null)
    this.audio.play('chime')
    void this.syncLiveWeather()
  }

  /** 切換為正面平視攤位角度（水平直視門面、招牌與道具） */
  setEyeLevelView(): void {
    this.targetAzimuth = this.active?.id === 'service-desk' ? Math.PI : 0.0
    this.targetElevation = EYE_LEVEL_ELEVATION
    this.cameraZoom = SHARED_ORTHO_CAMERA_CONFIG.zoom
  }

  /** 切換為 2.5D 俯視全景角度 */
  setOverview(): void {
    this.targetAzimuth = DEFAULT_AZIMUTH
    this.targetElevation = SHARED_ORTHO_CAMERA_CONFIG.overviewElevation
    this.cameraZoom = SHARED_ORTHO_CAMERA_CONFIG.overviewZoom
  }

  /** 向上或向下微調俯仰角（radians，負值更平視，正值更俯視） */
  tiltCamera(deltaRadians: number): void {
    this.targetElevation = THREE.MathUtils.clamp(
      this.targetElevation + deltaRadians,
      MIN_ELEVATION,
      MAX_ELEVATION,
    )
  }

  /** 360° 平滑旋轉市集視角（正值逆時針、負值順時針） */
  rotateCamera(deltaRadians: number): void {
    this.targetAzimuth += deltaRadians
  }

  /** 重設市集視角至與玉皇宮一致的預設視覺比例角度 */
  resetCamera(): void {
    this.targetAzimuth = DEFAULT_AZIMUTH
    this.targetElevation = DEFAULT_ELEVATION
    this.cameraZoom = SHARED_ORTHO_CAMERA_CONFIG.zoom
  }

  startExplore(): void { this.mode = 'explore' }
  stopExplore(): void { this.mode = 'browse'; this.input.clearHeld(); this.clearMoveTarget(); this.clearHover() }
  openPanel(): void { this.mode = 'panel'; this.input.clearHeld(); this.clearMoveTarget(); this.clearHover() }
  closePanel(): void { this.mode = 'explore'; this.input.clearHeld() }
  get feet(): THREE.Vector3 { const p = this.body.translation(); return new THREE.Vector3(p.x, p.y - FOOT_OFFSET, p.z) }
  get worshipping(): boolean { return false }

  /** 平滑走往指定攤位或返回天心宮牌樓（供市集導覽按鈕呼叫） */
  walkToPoint(id: MarketPointId): void {
    const target = this.world.points.find(p => p.id === id)
    if (!target) return
    if (this.mode === 'panel') this.closePanel()
    else if (this.mode !== 'explore') this.startExplore()
    this.beginWalkTo(target)
    this.audio.play('ui')
  }

  /** 啟動攤位自動導引，並回報 UI，避免玩家誤認點擊沒有反應。 */
  private beginWalkTo(target: MarketPoint): void {
    this.moveTarget = new THREE.Vector3(target.position.x, 0, target.position.z)
    this.pendingInteractId = target.id
    this.world.setGroundCursor(target.position.x, target.position.z, true)
    window.dispatchEvent(new CustomEvent('market:walk-start', { detail: target }))
  }

  private clearMoveTarget(): void {
    this.moveTarget = null
    this.pendingInteractId = null
    this.world.setGroundCursor(0, 0, false)
  }

  private clearHover(): void {
    this.world.setHoveredPoint(null)
    this.renderer.gl.domElement.style.cursor = ''
  }

  private raycastHotspot(clientX: number, clientY: number): MarketPointId | null {
    const rect = this.renderer.gl.domElement.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return null
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(ndc, this.camera)
    const hits = this.raycaster.intersectObjects(this.world.hotspotMeshes, false)
    if (hits.length > 0) {
      const id = hits[0].object.userData.marketPointId as MarketPointId | undefined
      if (id) return id
    }
    return null
  }

  /** 滑鼠移入攤位熱區時觸發高亮與指標回饋 */
  private handlePointerMove(e: PointerEvent): void {
    if (this.input.dragging) {
      this.world.setHoveredPoint(null)
      this.renderer.gl.domElement.style.cursor = 'grabbing'
      return
    }
    if (this.mode !== 'explore') {
      this.clearHover()
      return
    }
    const hoveredId = this.raycastHotspot(e.clientX, e.clientY)
    this.world.setHoveredPoint(hoveredId)
    this.renderer.gl.domElement.style.cursor = hoveredId ? 'pointer' : ''
  }

  /** 點擊攤位熱區直接互動／走近開啟彈窗；點擊柏油路地面則透過 Raycaster + Lerp 平滑移動 */
  private handleGroundClick(clientX: number, clientY: number): void {
    const rect = this.renderer.gl.domElement.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return

    // 1. 優先偵測是否點擊到任一攤位熱區（Hotspot）
    const hotspotId = this.raycastHotspot(clientX, clientY)
    if (hotspotId) {
      const target = this.world.points.find(p => p.id === hotspotId)
      if (target) {
        const cur = this.body.translation()
        const dist = Math.hypot(target.position.x - cur.x, target.position.z - cur.z)
        this.audio.play('ui')
        if (dist <= target.radius + 1.1) {
          this.clearMoveTarget()
          window.dispatchEvent(new CustomEvent('market:interact', { detail: target.id }))
        } else {
          this.beginWalkTo(target)
        }
        return
      }
    }

    // 2. 否則進行地面 Raycaster 拾取並設定平滑移動目標
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(ndc, this.camera)
    const hit = new THREE.Vector3()
    if (!this.raycaster.ray.intersectPlane(GROUND_PLANE, hit)) return

    // 限制於雨夜市集街道行走範圍內
    hit.x = THREE.MathUtils.clamp(hit.x, -15.4, 15.4)
    hit.z = THREE.MathUtils.clamp(hit.z, -1.35, 9.2)

    const clickedPoint = this.world.nearestPoint(hit)
    if (clickedPoint) {
      this.beginWalkTo(clickedPoint)
    } else {
      this.moveTarget = new THREE.Vector3(hit.x, 0, hit.z)
      this.pendingInteractId = null
      this.world.setGroundCursor(hit.x, hit.z, true)
    }
    this.audio.play('ui')
  }

  step(dt: number): void {
    this.weatherSyncTimer += dt
    if (this.weatherSyncTimer >= 180) {
      this.weatherSyncTimer = 0
      void this.syncLiveWeather()
    }

    const look = this.input.takeLook()
    const zoom = this.input.takeZoom()
    const clicks = this.input.takeClicks()

    if (this.mode === 'explore' || this.mode === 'browse') {
      // 360° 全方位旋轉視角（左／右鍵拖曳、觸控拖曳皆可無限制 360° 旋轉，垂直拖曳可微調俯仰角）
      if (Math.abs(look.x) > 0.0001) {
        this.targetAzimuth -= look.x * 1.45
      }
      if (Math.abs(look.y) > 0.0001) {
        this.targetElevation = THREE.MathUtils.clamp(
          this.targetElevation + look.y * 0.75,
          MIN_ELEVATION,
          MAX_ELEVATION,
        )
      }
      this.cameraZoom = THREE.MathUtils.clamp(
        this.cameraZoom * Math.exp(-zoom * 0.0012),
        SHARED_ORTHO_CAMERA_CONFIG.minZoom,
        SHARED_ORTHO_CAMERA_CONFIG.maxZoom,
      )
    }
    if (this.mode === 'explore' && clicks.length > 0) {
      const lastClick = clicks[clicks.length - 1]
      this.handleGroundClick(lastClick.x, lastClick.y)
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
        const stopRadius = this.pendingInteractId ? 1.55 : 0.28
        if (dist <= stopRadius) {
          const triggerId = this.pendingInteractId
          this.clearMoveTarget()
          if (triggerId) {
            window.dispatchEvent(new CustomEvent('market:interact', { detail: triggerId }))
          }
        } else {
          // 平滑減速靠近目標（Lerp 感緩停）
          const easeFactor = THREE.MathUtils.clamp(dist / 1.1, 0.35, 1)
          wish.set((dx / dist) * easeFactor, 0, (dz / dist) * easeFactor)
        }
      }
    }

    if (wish.lengthSq() > 1) wish.normalize()
    const grounded = this.controller.computedGrounded()
    this.verticalVelocity = grounded ? -1 : Math.max(-30, this.verticalVelocity - 24 * dt)
    const t = this.body.translation()
    const speed = this.input.held('sprint') ? CONFIG.player.sprintSpeed : CONFIG.player.walkSpeed
    this.controller.computeColliderMovement(this.collider, {
      x: wish.x * speed * dt,
      y: this.verticalVelocity * dt,
      z: wish.z * speed * dt,
    })
    const move = this.controller.computedMovement()
    const next = { x: t.x + move.x, y: Math.max(FOOT_OFFSET, t.y + move.y), z: t.z + move.z }
    this.body.setNextKinematicTranslation(next)
    this.physics.step(dt)

    const horizDist = Math.hypot(move.x, move.z)
    this.lastMoveSpeed = dt > 0 ? horizDist / dt : 0
    if (horizDist > 0.002) {
      this.lastFacingYaw = Math.atan2(move.x, move.z)
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
    const dtClamp = Math.min(frameSeconds, 0.1)
    const smooth = 1 - Math.exp(-12 * dtClamp)
    this.azimuth += (this.targetAzimuth - this.azimuth) * smooth
    this.elevation += (this.targetElevation - this.elevation) * smooth

    const targetY = THREE.MathUtils.lerp(
      feet.y + SHARED_ORTHO_CAMERA_CONFIG.lookHeight,
      feet.y + 0.95,
      Math.min(1, this.elevation / SHARED_ORTHO_CAMERA_CONFIG.overviewElevation),
    )
    const target = new THREE.Vector3(feet.x, targetY, feet.z)
    if (!this.cameraReady) {
      this.cameraTarget.copy(target)
      this.cameraReady = true
    } else {
      this.cameraTarget.lerp(target, 1 - Math.exp(-10 * dtClamp))
    }
    const aspect = Math.max(0.5, window.innerWidth / Math.max(1, window.innerHeight))
    const halfH = SHARED_ORTHO_CAMERA_CONFIG.frustumSize / 2
    this.camera.top = halfH
    this.camera.bottom = -halfH
    this.camera.right = halfH * aspect
    this.camera.left = -halfH * aspect
    this.camera.zoom = this.cameraZoom
    this.camera.updateProjectionMatrix()

    const horiz = Math.cos(this.elevation) * CAMERA_DISTANCE
    const vert = Math.sin(this.elevation) * CAMERA_DISTANCE
    this.camera.position.set(
      this.cameraTarget.x + Math.sin(this.azimuth) * horiz,
      this.cameraTarget.y + vert,
      this.cameraTarget.z + Math.cos(this.azimuth) * horiz,
    )
    this.camera.lookAt(this.cameraTarget)
    this.world.update(frameSeconds, this.lastMoveSpeed, this.lastFacingYaw)
    this.renderer.render(this.world.scene, this.camera)
  }

  dispose(): void {
    this.renderer.gl.domElement.removeEventListener('pointermove', this.onPointerMoveBound)
    this.clearHover()
    this.input.clearHeld()
    this.clearMoveTarget()
    this.controller.free()
    this.physics.removeBody(this.body)
    disposeWorldScene(this.world.scene)
    this.physics.dispose()
  }
}
