import * as THREE from 'three'
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Physics } from '../engine/physics'
import type { TemplePbrLibrary } from './temple-pbr-materials'

/**
 * Stage 2A: entrance arch, front courtyard, Tiangong urn and the Tianxin Xiangu consultation pavilion.
 * Facing the main hall from the entrance, left is -X and right is +X; the entrance is at +Z.
 * The central stone road (|x| < ROAD_HALF) stays completely clear from the arch to the main hall.
 */
export const ROAD_HALF = 2
export const SITE = { halfX: 30, back: -40, front: 48 } as const
export const GATE_Z = 48
export const STAND = new THREE.Vector3(0, 0, 51.6)
export const PAVILION = new THREE.Vector3(-12, 0, 30)
export const WISH_POOL = new THREE.Vector3(-9.5, 0, 40)
export const LOTUS_POND = new THREE.Vector3(12.0, 0, 38.0)
export const GOLD_FURNACE = new THREE.Vector3(-19.5, 0, 38.0)

export type BuildContext = {
  scene: THREE.Scene
  physics: Physics
  mat: (color: string, roughness?: number, metalness?: number) => THREE.MeshStandardMaterial
  roof: (width: number, depth: number, eaveY: number, peakY: number) => THREE.Group
  text: (text: string, fg: string, bg: string) => THREE.MeshBasicMaterial
  pbr?: TemplePbrLibrary
  registerOccluder?: (obj: THREE.Object3D) => void
}

const PAL = {
  stone: '#897f70', paving: '#a39481', road: '#765444', roadLine: '#a88d6b', wall: '#39291f', wallCap: '#34433c',
  red: '#9c3b2d', redLight: '#b64b37', gold: '#b7924a', bronze: '#80623c', wood: '#5b3426', jade: '#678276',
  leaf: '#465b50', water: '#4e7771', lotusPad: '#5f8a55', lotus: '#e6a7a6', lantern: '#c2412f', ground: '#8f8670',
}

const yAxis = new THREE.Vector3(0, 1, 0)
const rotY = (a: number) => new THREE.Quaternion().setFromAxisAngle(yAxis, a)

/** Sky lanterns are intentionally a prominent three-times-scale focal point. */
const SKY_LANTERN_SCALE = 3
const SKY_LANTERN_LOWEST_LOCAL_Y = -0.37
const skyLanternMountedY = (baselineY: number): number =>
  baselineY - SKY_LANTERN_LOWEST_LOCAL_Y * (SKY_LANTERN_SCALE - 1)

export interface CourtyardChibiActor {
  group: THREE.Group
  torso: THREE.Group
  head: THREE.Group
  arms: THREE.Group
  hands: THREE.Group
}

export interface CourtyardSkyLanternGroup {
  id: string
  originPos: THREE.Vector3
  lanternGroup: THREE.Group
  lanternMesh: THREE.Mesh
  paperMat: THREE.MeshStandardMaterial
  flameMesh: THREE.Mesh
  pointLight: THREE.PointLight
  groundGlow: THREE.Mesh
  groundGlowMat: THREE.MeshBasicMaterial
  actors: CourtyardChibiActor[]
  state: 'holding' | 'igniting' | 'ascending' | 'cooldown'
  timer: number
  lanternY: number
  lanternOriginY: number
  targetY: number
  drift: { x: number; z: number }
  isPlayerStand?: boolean
}

export class FrontCourtyard {
  private readonly lanternMats: THREE.MeshStandardMaterial[] = []
  private fairyMesh?: THREE.Mesh
  private fairyBaseY = 0.72
  private readonly skyLanternGroups: CourtyardSkyLanternGroup[] = []
  private readonly playerLanternStandPos = new THREE.Vector3(-12.5, 0, 23.5)
  private playerLanternGroup?: CourtyardSkyLanternGroup
  readonly sacredPlatformLights: THREE.PointLight[] = []
  readonly trailLanternLights: THREE.PointLight[] = []
  private platGroup?: THREE.Group
  private readonly progressiveTasks: (() => void)[] = [
    () => this.addLotusPondStructure(),
    () => this.addLotusPondFlora(),
    () => this.addPlantingShrubs(),
    () => this.addPlantingCourtyard(),
    () => this.addSacredTrailEssential(),
    () => this.addSacredTrailDecor(),
    () => this.addSacredPlatformDecor(),
    () => this.addSkyLanterns(),
  ]
  private progressiveTaskIndex = 0

  setSanctuaryLightsVisible(visible: boolean): void {
    for (const l of this.sacredPlatformLights) l.visible = visible
    for (const l of this.trailLanternLights) l.visible = visible
  }

  isProgressiveDone(): boolean {
    return this.progressiveTaskIndex >= this.progressiveTasks.length
  }

  stepProgressive(budgetMs = 3.5): boolean {
    const t0 = performance.now()
    while (this.progressiveTaskIndex < this.progressiveTasks.length) {
      const task = this.progressiveTasks[this.progressiveTaskIndex++]
      task()
      if (performance.now() - t0 >= budgetMs) {
        break
      }
    }
    return this.isProgressiveDone()
  }

  ensureSacredTrailEssential(): void {
    while (this.progressiveTaskIndex <= 4 && this.progressiveTaskIndex < this.progressiveTasks.length) {
      this.progressiveTasks[this.progressiveTaskIndex++]()
    }
  }

  flushAll(): void {
    while (this.progressiveTaskIndex < this.progressiveTasks.length) {
      this.progressiveTasks[this.progressiveTaskIndex++]()
    }
  }

  loadStage2(): void {
    while (this.progressiveTaskIndex < 4 && this.progressiveTaskIndex < this.progressiveTasks.length) {
      this.progressiveTasks[this.progressiveTaskIndex++]()
    }
  }

  loadStage3(): void {
    this.flushAll()
  }

  constructor(private readonly c: BuildContext, immediate = false) {
    this.addGround()
    this.addWalls()
    this.addRoad()
    this.addGateArch()
    this.addScreenWall()
    this.addPavilion()
    this.addGoldFurnace()

    if (immediate) {
      this.flushAll()
    }
  }

  private add(mesh: THREE.Object3D, shadow = false): THREE.Object3D {
    mesh.traverse(o => { if (o instanceof THREE.Mesh) { o.castShadow = shadow; o.receiveShadow = true } })
    this.c.scene.add(mesh)
    return mesh
  }

  private box(w: number, h: number, d: number, color: string | THREE.Material, x: number, y: number, z: number, collide = false, angle = 0, shadow = collide): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof color === 'string' ? this.c.mat(color) : color)
    m.position.set(x, y, z)
    m.rotation.y = angle
    this.add(m, shadow)
    if (collide) this.c.physics.addStaticBox(new THREE.Vector3(x, y, z), new THREE.Vector3(w, h, d), angle ? rotY(angle) : undefined)
    return m
  }

  private addGround(): void {
    const { halfX, back, front } = SITE
    const depth = front - back
    const floorMat = this.c.pbr ? this.c.pbr.get('courtyardStone', 15, 22) : this.c.mat(PAL.stone, 0.96)
    const floor = this.box(halfX * 2, 0.8, depth, floorMat, 0, -0.42, (front + back) / 2, true)
    floor.castShadow = false
    // Entrance plaza outside the arch, where the visitor first appears.
    const plazaMat = this.c.pbr ? this.c.pbr.get('plinthStone', 7, 2) : this.c.mat(PAL.paving, 0.95)
    const plaza = this.box(26, 0.8, 8, plazaMat, 0, -0.42, front + 4, true)
    plaza.castShadow = false
    const outside = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), this.c.mat(PAL.ground, 1))
    outside.rotation.x = -Math.PI / 2
    outside.position.set(0, -0.06, 10)
    outside.receiveShadow = true
    this.c.scene.add(outside)
    // Invisible bounds around the plaza.
    this.c.physics.addStaticBox(new THREE.Vector3(0, 2, front + 8.3), new THREE.Vector3(26, 4, 0.6))
    for (const x of [-13.3, 13.3]) this.c.physics.addStaticBox(new THREE.Vector3(x, 2, front + 4), new THREE.Vector3(0.6, 4, 8))
  }

  private addWalls(): void {
    const { halfX, back, front } = SITE
    const wall = this.c.mat(PAL.wall)
    const cap = this.c.mat(PAL.wallCap, 0.8)
    const len = front - back

    // East wall (side = 1): continuous unbroken wall
    const eastX = halfX - 0.4
    this.box(0.65, 4.2, len, wall, eastX, 2.1, (front + back) / 2, true)
    this.box(1.0, 0.3, len + 0.4, cap, eastX, 4.3, (front + back) / 2)

    // West wall (side = -1): broken at z = 31.0 for the sacred moon gate (opening width: 4.4m, z: 28.8 to 33.2)
    const westX = -(halfX - 0.4)
    const northLen = 28.8 - back
    const northCenter = (back + 28.8) / 2
    this.box(0.65, 4.2, northLen, wall, westX, 2.1, northCenter, true)
    this.box(1.0, 0.3, northLen + 0.2, cap, westX, 4.3, northCenter)

    const southLen = front - 33.2
    const southCenter = (33.2 + front) / 2
    this.box(0.65, 4.2, southLen, wall, westX, 2.1, southCenter, true)
    this.box(1.0, 0.3, southLen + 0.2, cap, westX, 4.3, southCenter)

    // Front wall segments either side of the arch.
    for (const side of [-1, 1]) {
      const inner = 6.45
      const segLen = halfX - 0.4 - inner
      const cx = side * (inner + segLen / 2)
      this.box(segLen, 4.2, 0.65, wall, cx, 2.1, front, true)
      this.box(segLen + 0.3, 0.3, 1.0, cap, cx, 4.3, front)
      for (let i = 1; i < 4; i += 1) this.pillar(side * (inner + (segLen * i) / 4), front + 0.42, 3.6, 0.22)
    }
    this.box(halfX * 2, 4.5, 0.7, wall, 0, 2.1, back + 0.5, true)
  }

  private pillar(x: number, z: number, h: number, r: number, collide = false, color = PAL.red): void {
    const pillarMat = color === PAL.red && this.c.pbr ? this.c.pbr.get('vermilionWood', 1, 2) : this.c.mat(color, 0.72)
    const p = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r, h, 14), pillarMat)
    p.position.set(x, h / 2, z)
    this.add(p)
    if (collide) this.c.physics.addStaticCylinder(new THREE.Vector3(x, h / 2, z), r, h)
  }

  private addRoad(): void {
    const start = -8.5
    const end = GATE_Z + 7.5
    const len = end - start
    const roadMat = this.c.pbr ? this.c.pbr.get('imperialRoad', 1.5, 22) : this.c.mat(PAL.road, 0.92)
    const road = new THREE.Mesh(new THREE.BoxGeometry(ROAD_HALF * 2 + 0.1, 0.035, len), roadMat)
    road.position.set(0, 0.015, (start + end) / 2)
    road.receiveShadow = true
    this.c.scene.add(road)
    const lineMat = this.c.pbr ? this.c.pbr.get('plinthStone', 2, 1) : this.c.mat(PAL.roadLine, 0.88)
    const tileGeo = new THREE.BoxGeometry(ROAD_HALF * 2 - 0.1, 0.025, 0.16)
    const tileGeoms: THREE.BufferGeometry[] = []
    for (let z = end - 1.5; z > start; z -= 3) {
      const g = tileGeo.clone()
      g.translate(0, 0.04, z)
      tileGeoms.push(g)
    }
    tileGeo.dispose()
    if (tileGeoms.length > 0) {
      const mergedTiles = BufferGeometryUtils.mergeGeometries(tileGeoms, false)
      for (const g of tileGeoms) g.dispose()
      const tileMesh = new THREE.Mesh(mergedTiles, lineMat)
      tileMesh.receiveShadow = true
      this.c.scene.add(tileMesh)
    }
    // Low curb stones along both edges, flush enough to step over (purely visual).
    const curbMat = this.c.pbr ? this.c.pbr.get('plinthStone', 1, 16) : this.c.mat('#b9aa91', 0.9)
    const curbGeo = new THREE.BoxGeometry(0.22, 0.08, GATE_Z - 1)
    const curbGeoms: THREE.BufferGeometry[] = []
    for (const side of [-1, 1]) {
      const g = curbGeo.clone()
      g.translate(side * (ROAD_HALF + 0.12), 0.04, GATE_Z / 2 - 0.5)
      curbGeoms.push(g)
    }
    curbGeo.dispose()
    const mergedCurbs = BufferGeometryUtils.mergeGeometries(curbGeoms, false)
    for (const g of curbGeoms) g.dispose()
    const curbMesh = new THREE.Mesh(mergedCurbs, curbMat)
    curbMesh.receiveShadow = true
    this.c.scene.add(curbMesh)
  }

  /** Three-bay entrance arch. All three bays are walkable; lanterns hang only over the side bays, above 4.2 m. */
  private addGateArch(): void {
    const z = GATE_Z
    const gold = this.c.pbr ? this.c.pbr.get('gildedGold', 1, 1) : this.c.mat(PAL.gold, 0.5, 0.18)
    const vermilion = this.c.pbr ? this.c.pbr.get('vermilionWood', 2, 1) : this.c.mat(PAL.red, 0.72)
    const darkTimber = this.c.pbr ? this.c.pbr.get('darkTimber', 2, 1) : this.c.mat('#30231a', 0.85)
    const plinthStone = this.c.pbr ? this.c.pbr.get('plinthStone', 1, 1) : this.c.mat('#a8a08f', 0.95)
    const collarGeo = new THREE.CylinderGeometry(1, 1, 0.18, 16)
    const baseOctGeo = new THREE.CylinderGeometry(0.68, 0.76, 0.32, 8)
    for (const [x, h, r] of [[-6, 5.6, 0.4], [-2.6, 6.4, 0.46], [2.6, 6.4, 0.46], [6, 5.6, 0.4]] as const) {
      this.pillar(x, z, h, r, true)
      this.box(1.25, 0.34, 1.25, plinthStone, x, 0.17, z)
      // 覆盆八角石柱礎與柱頭金箍（純視覺立體細節，不影響碰撞）
      const octBase = new THREE.Mesh(baseOctGeo, gold)
      octBase.position.set(x, 0.42, z)
      this.add(octBase)
      const capCollar = new THREE.Mesh(collarGeo, gold)
      capCollar.scale.set(r * 1.12, 1, r * 1.12)
      capCollar.position.set(x, h - 0.55, z)
      this.add(capCollar)
    }
    this.box(5.9, 0.6, 0.95, vermilion, 0, 6.15, z)
    this.box(6.1, 0.14, 1.06, gold, 0, 5.84, z)
    for (const side of [-1, 1]) {
      this.box(3.9, 0.5, 0.85, vermilion, side * 4.3, 5.35, z)
      this.box(4.05, 0.12, 0.94, gold, side * 4.3, 5.08, z)
    }
    // 山門飛簷斗栱組（共用幾何體實例，強化傳統大木作立體輪廓） - Batched with mergeGeometries
    const dgBaseGeo = new THREE.BoxGeometry(0.32, 0.14, 0.32)
    const dgArmGeo = new THREE.BoxGeometry(0.66, 0.12, 0.2)
    const dgBeakGeo = new THREE.BoxGeometry(0.18, 0.12, 0.64)
    const gateGoldGeoms: THREE.BufferGeometry[] = []
    const gateVermilionGeoms: THREE.BufferGeometry[] = []

    const addGateDougong = (dx: number, dy: number) => {
      for (const faceDir of [-1, 1]) {
        const b = dgBaseGeo.clone()
        b.translate(dx, dy, z + faceDir * 0.52)
        gateGoldGeoms.push(b)

        const arm = dgArmGeo.clone()
        arm.translate(dx, dy + 0.12, z + faceDir * 0.52)
        gateVermilionGeoms.push(arm)

        const beak = dgBeakGeo.clone()
        beak.rotateX(faceDir * 0.18)
        beak.translate(dx, dy + 0.2, z + faceDir * 0.52 + faceDir * 0.12)
        gateGoldGeoms.push(beak)
      }
    }
    for (const dx of [-1.8, -0.6, 0.6, 1.8]) addGateDougong(dx, 6.32)
    for (const dx of [-5.1, -3.5, 3.5, 5.1]) addGateDougong(dx, 5.5)

    dgBaseGeo.dispose()
    dgArmGeo.dispose()
    dgBeakGeo.dispose()

    if (gateGoldGeoms.length > 0) {
      const mergedGold = BufferGeometryUtils.mergeGeometries(gateGoldGeoms, false)
      for (const bg of gateGoldGeoms) bg.dispose()
      this.add(new THREE.Mesh(mergedGold, gold), false)
    }
    if (gateVermilionGeoms.length > 0) {
      const mergedVermilion = BufferGeometryUtils.mergeGeometries(gateVermilionGeoms, false)
      for (const bg of gateVermilionGeoms) bg.dispose()
      this.add(new THREE.Mesh(mergedVermilion, vermilion), false)
    }

    const plaque = this.box(3.8, 1.05, 0.24, darkTimber, 0, 5.4, z + 0.5)
    plaque.castShadow = false
    for (const dz of [0.63, -0.63]) {
      const face = new THREE.Mesh(new THREE.PlaneGeometry(3.45, 0.82), this.c.text('玉 皇 宮', '#e5c57d', '#38251b'))
      face.position.set(0, 5.4, z + dz)
      if (dz < 0) face.rotation.y = Math.PI
      this.c.scene.add(face)
    }
    const mid = this.c.roof(7.4, 2.4, 6.55, 7.9)
    mid.position.set(0, 0, z)
    this.add(mid, true)
    for (const side of [-1, 1]) {
      const r = this.c.roof(4.6, 2.0, 5.65, 6.55)
      r.position.set(side * 4.3, 0, z)
      this.add(r, true)
    }
    // Side-bay lanterns: bottom edge at about 4.4 m, never over the central road.
    for (const side of [-1, 1]) for (const dz of [0.7, -0.7]) this.lantern(side * 4.3, 4.85, z + dz, 0.36)
    // Stone lions guarding the plaza side of the arch (遵循左雄踩繡球、右雌弄幼獅之傳統禮制).
    for (const side of [-1, 1]) {
      const lion = new THREE.Group()
      lion.position.set(side * 7.7, 0, z + 1.6)
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 1.2), this.c.mat('#a8a08f', 0.95))
      base.position.y = 0.4
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), this.c.mat('#b8b09e', 0.9))
      body.scale.set(0.9, 1.1, 1.05)
      body.position.y = 1.25
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 10), this.c.mat('#b8b09e', 0.9))
      head.position.set(0, 1.85, 0.25)
      const mane = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.12, 8, 16), this.c.mat('#9f9786', 0.9))
      mane.position.set(0, 1.85, 0.18)
      lion.add(base, body, head, mane)
      if (side === -1) {
        // Left: 雄獅踏繡球（金銅吉祥球）
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), this.c.mat(PAL.gold, 0.4, 0.3))
        ball.position.set(0.25, 0.95, 0.38)
        lion.add(ball)
      } else {
        // Right: 雌獅護幼獅（活潑嬉戲小獅雕像）
        const cub = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), this.c.mat('#b8b09e', 0.9))
        cub.position.set(-0.25, 0.9, 0.38)
        lion.add(cub)
      }
      this.add(lion)
      this.c.physics.addStaticBox(new THREE.Vector3(side * 7.7, 1, z + 1.6), new THREE.Vector3(1.2, 2, 1.2))
    }

    // 抱鼓石／門枕石（牌樓四大金柱柱腳螺紋抱鼓石）
    for (const [x, , r] of [[-6, 5.6, 0.4], [-2.6, 6.4, 0.46], [2.6, 6.4, 0.46], [6, 5.6, 0.4]] as const) {
      const drumBase = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.36, 0.72), this.c.mat('#9c9180', 0.95))
      drumBase.position.set(x, 0.18, z + r + 0.32)
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.18, 16), this.c.mat('#aba08f', 0.9))
      drum.rotation.x = Math.PI / 2
      drum.position.set(x, 0.45, z + r + 0.32)
      this.add(drumBase)
      this.add(drum)
    }
  }

  /**
   * Traditional Screen Wall (照牆 / 影壁 / 福祿照壁):
   * 正對大門（中軸線）外的獨立牆壁，具有避邪止煞、聚氣與視覺屏蔽的作用。
   * 位於廟前廣場正對牌樓處，雕塑須彌座石基、朱漆壁面、琉璃瓦頂與「紫氣東來・福星高照」金石雕心。
   */
  private addScreenWall(): void {
    const z = 55.6
    const wallW = 15.2
    const stone = this.c.mat('#8a7e6f', 0.92)
    const vermilion = this.c.mat(PAL.red, 0.76)
    const darkWood = this.c.mat('#302219', 0.88)
    const gold = this.c.mat(PAL.gold, 0.45, 0.28)

    const screenGroup = new THREE.Group()
    screenGroup.position.set(0, 0, z)

    // 1. Sumeru Stone Pedestal Base (須彌座雕花石基)
    const baseLow = new THREE.Mesh(new THREE.BoxGeometry(wallW + 0.8, 0.36, 1.4), stone)
    baseLow.position.y = 0.18
    const baseWaist = new THREE.Mesh(new THREE.BoxGeometry(wallW + 0.4, 0.36, 1.1), stone)
    baseWaist.position.y = 0.54
    screenGroup.add(baseLow, baseWaist)

    // 2. Vermilion Wall Core (照牆朱漆磚砌主體)
    const wallBody = new THREE.Mesh(new THREE.BoxGeometry(wallW, 3.2, 0.72), vermilion)
    wallBody.position.y = 2.32
    screenGroup.add(wallBody)

    // 3. Central Auspicious Relief Panel (照壁內嵌漢白玉金邊壁心)
    const frame = new THREE.Mesh(new THREE.BoxGeometry(9.8, 2.35, 0.8), darkWood)
    frame.position.y = 2.35
    screenGroup.add(frame)

    const panelFacingTemple = new THREE.Mesh(
      new THREE.PlaneGeometry(9.4, 2.0),
      this.c.text('紫 氣 東 來 ・ 福 星 高 照', '#f2d288', '#331d14')
    )
    panelFacingTemple.position.set(0, 2.35, -0.41)
    panelFacingTemple.rotation.y = Math.PI // Faces toward the gate and visitor stand
    screenGroup.add(panelFacingTemple)

    // Auspicious Medallion Reliefs on left and right wings (左右兩側嵌如意祥雲浮雕)
    for (const side of [-1, 1]) {
      const emblem = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.12, 16), gold)
      emblem.rotation.x = Math.PI / 2
      emblem.position.set(side * 6.0, 2.35, -0.38)
      screenGroup.add(emblem)
    }

    // 4. Glazed Roof Cap with Flying Eaves (歇山廡殿式琉璃飛簷瓦頂)
    const roof = this.c.roof(wallW + 1.8, 2.4, 4.0, 5.15)
    roof.position.set(0, 0, 0)
    screenGroup.add(roof)

    this.add(screenGroup, true)
    this.c.physics.addStaticBox(new THREE.Vector3(0, 2.1, z), new THREE.Vector3(wallW + 0.8, 4.6, 1.5))
  }

  /**
   * 原神璃月風格六角飛簷宮燈／霄燈（Genshin Impact Liyue Hexagonal Hanging Palace Lantern）
   * 1. 雙層金飾挑角飛簷頂蓋（六角瓦簷＋頂部提梁懸金環）
   * 2. 透光朱紅絹紗燈身＋六方金木邊框立柱＋聚光靈心內膽
   * 3. 六角蓮華雕花托盤＋翡翠圓珠＋三束垂墜絲絛流蘇
   * 4. 溫潤暖金長明神光，具呼吸微光起伏效果
   */
  private lantern(x: number, y: number, z: number, size: number): void {
    const g = new THREE.Group()
    g.position.set(x, y, z)

    const gold = this.c.mat(PAL.gold, 0.4, 0.3)
    const darkWood = this.c.mat('#2c1b18', 0.6)
    const silkMat = this.c.mat('#df4230', 0.5)
    silkMat.emissive.set('#ff7830')
    silkMat.emissiveIntensity = 0.65
    this.lanternMats.push(silkMat)

    const coreMat = this.c.mat('#fff1bd', 0.2)
    coreMat.emissive.set('#ffa536')
    coreMat.emissiveIntensity = 1.2
    this.lanternMats.push(coreMat)

    // Merge all gold parts into one geometry: cord, ring, roofEave, 6 filigree posts, baseTray
    const goldGeoms: THREE.BufferGeometry[] = []
    const cordGeo = new THREE.CylinderGeometry(0.015, 0.015, size * 1.5, 6)
    cordGeo.translate(0, size * 2.0, 0)
    goldGeoms.push(cordGeo)

    const ringGeo = new THREE.TorusGeometry(size * 0.14, size * 0.03, 6, 12)
    ringGeo.rotateX(Math.PI / 2)
    ringGeo.translate(0, size * 1.35, 0)
    goldGeoms.push(ringGeo)

    const eaveGeo = new THREE.CylinderGeometry(size * 0.78, size * 0.62, size * 0.08, 6)
    eaveGeo.translate(0, size * 0.98, 0)
    goldGeoms.push(eaveGeo)

    const postR = size * 0.56
    const basePostGeo = new THREE.CylinderGeometry(size * 0.032, size * 0.032, size * 1.32, 4)
    for (let i = 0; i < 6; i++) {
      const ang = (i * Math.PI) / 3
      const postG = basePostGeo.clone()
      postG.translate(Math.cos(ang) * postR, size * 0.32, Math.sin(ang) * postR)
      goldGeoms.push(postG)
    }
    basePostGeo.dispose()

    const trayGeo = new THREE.CylinderGeometry(size * 0.65, size * 0.35, size * 0.2, 6)
    trayGeo.translate(0, -size * 0.42, 0)
    goldGeoms.push(trayGeo)

    const mergedGold = BufferGeometryUtils.mergeGeometries(goldGeoms, false)
    for (const bg of goldGeoms) bg.dispose()
    g.add(new THREE.Mesh(mergedGold, gold))

    // Roof top
    const roofTop = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.18, size * 0.76, size * 0.28, 6), darkWood)
    roofTop.position.y = size * 1.14
    g.add(roofTop)

    // Body & Inner Core
    const body = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.58, size * 0.52, size * 1.28, 6), silkMat)
    body.position.y = size * 0.32
    const innerCore = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.26, size * 0.26, size * 0.85, 6), coreMat)
    innerCore.position.y = size * 0.32
    g.add(body, innerCore)

    // Bead
    const jadeBeadMat = this.c.mat('#3fa878', 0.3, 0.4)
    const bead = new THREE.Mesh(new THREE.DodecahedronGeometry(size * 0.14), jadeBeadMat)
    bead.position.y = -size * 0.58
    g.add(bead)

    // Merge 3 tassels into one geometry
    const tasselMat = this.c.mat('#d03628', 0.7)
    const tasselGeoms: THREE.BufferGeometry[] = []
    const centerTasselGeo = new THREE.ConeGeometry(size * 0.16, size * 0.95, 6)
    centerTasselGeo.rotateX(Math.PI)
    centerTasselGeo.translate(0, -size * 1.1, 0)
    tasselGeoms.push(centerTasselGeo)

    for (const sideAng of [-0.4, 0.4]) {
      const sideGeo = new THREE.ConeGeometry(size * 0.1, size * 0.65, 5)
      sideGeo.rotateX(Math.PI)
      sideGeo.rotateZ(sideAng * 0.35)
      sideGeo.translate(Math.sin(sideAng) * size * 0.22, -size * 0.92, Math.cos(sideAng) * size * 0.22)
      tasselGeoms.push(sideGeo)
    }
    const mergedTassels = BufferGeometryUtils.mergeGeometries(tasselGeoms, false)
    for (const tg of tasselGeoms) tg.dispose()
    g.add(new THREE.Mesh(mergedTassels, tasselMat))

    // 7. 廣角暖金環境光輝
    if (size >= 0.22) {
      const light = new THREE.PointLight('#ffa645', size >= 0.3 ? 1.3 : 0.85, 9.5, 1.8)
      light.position.y = size * 0.32
      g.add(light)
    }
    this.add(g, false)
  }

  /**
   * 台灣傳統宮廟風格問事／擲筊亭：天心仙姑亭 (Tianxin Fairy Divination Pavilion)
   *
   * 1. 神壇核心：仙姑法相立於木雕蓮花神座之上（全上半身與面容清晰可見），前方配置低矮朱紅雕花供桌。
   *    桌上陳設：朱砂銅香爐（飄起輕柔香煙）、紅木籤筒、一對紅木聖筊、成對小型供燈、傳統象棋卦盤。
   *    神像背後立有厚重大木雕如意雲紋背屏，阻絕背景干擾，形成莊嚴神龕焦點。
   * 2. 四柱與結構：維持小型四柱亭尺度，四柱皆配置青石覆盆石柱礎、朱紅柱身與金色柱頭雀替；
   *    三面配置厚實朱紅木欄杆（含如意雲紋雕花），正面寬敞全開。
   *    亭底設置 28cm 灰白石台基，前側配置兩階精緻踏步與抱鼓石。
   * 3. 屋頂：單層深綠琉璃攢尖亭頂，具備實體 3D 筒瓦隴、金色瓦當與滴水牙子，四角飛簷微翹，中央立三疊鎏金寶頂；
   *    簷下配設大額枋與一斗三升斗拱系統。
   * 4. 匾額與燈光：簷下正中央配置「天心仙姑」金字深框匾額；正面成對懸掛宮燈由金屬鏈牢固吊掛（絕無漂浮）；
   *    全亭採用柔暖橘金光照亮神案與仙姑臉龐，溫潤祥和。
   */
  private addPavilion(): void {
    const { x: cx, z: cz } = PAVILION
    const podW = 5.0
    const podH = 0.28
    const span = 1.85
    const postH = 3.10

    const red = this.c.mat(PAL.red, 0.72)
    const wood = this.c.mat(PAL.wood, 0.82)
    const darkMahogany = this.c.mat('#2c170f', 0.85)
    const gold = this.c.mat(PAL.gold, 0.38, 0.3)
    const stone = this.c.mat('#a59d8f', 0.92)
    const stonePlinth = this.c.mat('#8a8274', 0.94)
    const emeraldGlaze = this.c.mat('#224734', 0.52, 0.28)
    const darkGlaze = this.c.mat('#183526', 0.6)
    const bronze = this.c.mat('#5a4732', 0.45, 0.35)
    const cinnabar = this.c.mat('#b83424', 0.55)

    // 1. 低矮灰白石台基 (Low Stone Podium)
    const podiumGeo = new THREE.BoxGeometry(podW, podH, podW)
    const podium = new THREE.Mesh(podiumGeo, stone)
    podium.position.set(cx, podH / 2, cz)
    podium.receiveShadow = true
    this.add(podium, true)
    this.c.physics.addStaticBox(new THREE.Vector3(cx, podH / 2, cz), new THREE.Vector3(podW, podH, podW))

    // 2. 前側兩階踏步 (Front Stone Steps facing +X towards road)
    const step1 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.10, 2.4), stone)
    step1.position.set(cx + podW / 2 + 0.38, 0.05, cz)
    step1.receiveShadow = true
    this.add(step1)

    const step2 = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.19, 2.4), stone)
    step2.position.set(cx + podW / 2 + 0.15, 0.095, cz)
    step2.receiveShadow = true
    this.add(step2)
    this.c.physics.addStaticBox(new THREE.Vector3(cx + podW / 2 + 0.28, 0.10, cz), new THREE.Vector3(0.7, 0.20, 2.4))

    // 兩側抱鼓石 (Drum Stones flanking steps)
    for (const dz of [-1.28, 1.28]) {
      const drumBase = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.36, 0.24), stonePlinth)
      drumBase.position.set(cx + podW / 2 + 0.28, 0.18, cz + dz)
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.18, 16), stone)
      drum.rotation.z = Math.PI / 2
      drum.position.set(cx + podW / 2 + 0.35, 0.44, cz + dz)
      this.add(drumBase)
      this.add(drum)
    }

    // 亭外石階兩側古樸青石盆栽 (Subdued Bonsai Planters flanking steps)
    this.lotusPot(cx + podW / 2 + 0.45, cz - 1.85)
    this.lotusPot(cx + podW / 2 + 0.45, cz + 1.85)

    // 3. 四角立柱與青石柱礎 (Four Corner Pillars & Stone Plinths)
    const pillarY = podH + 0.22 + postH / 2
    const pillarCoords: [number, number][] = [
      [cx + span, cz - span], // Front-Left
      [cx + span, cz + span], // Front-Right
      [cx - span, cz - span], // Rear-Left
      [cx - span, cz + span], // Rear-Right
    ]

    for (const [px, pz] of pillarCoords) {
      // 青石覆盆石柱礎
      const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.22, 8), stonePlinth)
      plinth.position.set(px, podH + 0.11, pz)
      plinth.receiveShadow = true
      this.add(plinth)

      // 朱紅圓木柱身
      const pillarMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.16, postH, 16), red)
      pillarMesh.position.set(px, pillarY, pz)
      pillarMesh.castShadow = true
      pillarMesh.receiveShadow = true
      this.add(pillarMesh)
      if (this.c.registerOccluder) {
        this.c.registerOccluder(pillarMesh)
      }
      this.c.physics.addStaticCylinder(new THREE.Vector3(px, pillarY, pz), 0.16, postH)

      // 柱頂金箍
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.08, 16), gold)
      collar.position.set(px, podH + 0.22 + postH - 0.04, pz)
      this.add(collar)

      // 柱頂櫨斗 (Gilded Head Block)
      const dou = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.36), red)
      dou.position.set(px, podH + 0.22 + postH + 0.07, pz)
      const douCap = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.03, 0.38), gold)
      douCap.position.set(px, podH + 0.22 + postH + 0.14, pz)
      this.add(dou)
      this.add(douCap)
    }

    // 4. 大額枋、普拍枋與雕花雀替 (Architraves & Corbels)
    const beamY = podH + 0.22 + postH + 0.20
    const beamSpan = span * 2

    // 四面主額枋
    const beams = [
      { pos: [cx + span, beamY, cz], size: [0.18, 0.26, beamSpan + 0.2] }, // Front (+X)
      { pos: [cx - span, beamY, cz], size: [0.18, 0.26, beamSpan + 0.2] }, // Rear (-X)
      { pos: [cx, beamY, cz - span], size: [beamSpan + 0.2, 0.26, 0.18] }, // Left (-Z)
      { pos: [cx, beamY, cz + span], size: [beamSpan + 0.2, 0.26, 0.18] }, // Right (+Z)
    ]
    for (const b of beams) {
      const beamMesh = new THREE.Mesh(new THREE.BoxGeometry(b.size[0], b.size[1], b.size[2]), red)
      beamMesh.position.set(b.pos[0], b.pos[1], b.pos[2])
      beamMesh.castShadow = true
      this.add(beamMesh)

      // 描金回紋飾帶
      const inlay = new THREE.Mesh(
        new THREE.BoxGeometry(
          b.size[0] > 0.3 ? b.size[0] * 0.95 : b.size[0] + 0.02,
          0.08,
          b.size[2] > 0.3 ? b.size[2] * 0.95 : b.size[2] + 0.02
        ),
        gold
      )
      inlay.position.set(b.pos[0], b.pos[1], b.pos[2])
      this.add(inlay)
    }

    // 柱角雕花雀替托木 (Carved Corbels at all column-beam joints)
    for (const [px, pz] of pillarCoords) {
      const corbelDx = px > cx ? -0.32 : 0.32
      const corbelDz = pz > cz ? -0.32 : 0.32

      const corbelX = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.24, 0.14), red)
      corbelX.position.set(px + corbelDx, beamY - 0.16, pz)
      this.add(corbelX)

      const corbelZ = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.24, 0.36), red)
      corbelZ.position.set(px, beamY - 0.16, pz + corbelDz)
      this.add(corbelZ)
    }

    // 簡潔一斗三升斗拱 (Simple Dougong Brackets along the beams)
    for (const [bx, bz, isX] of [
      [cx + span, cz, true],
      [cx - span, cz, true],
      [cx, cz - span, false],
      [cx, cz + span, false],
    ] as const) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(isX ? 0.22 : 0.72, 0.10, isX ? 0.72 : 0.22), red)
      arm.position.set(bx, beamY + 0.18, bz)
      this.add(arm)
    }

    // 5. 單層深綠琉璃攢尖亭頂 (Clean Single-Tier Deep Emerald Glazed Roof)
    const eaveY = beamY + 0.28
    const apexY = eaveY + 1.45
    const roofW = podW + 0.9

    // 厚實深色簷口 (Eave Fascia with Gold Wadang Trim)
    const eaveFascia = new THREE.Mesh(new THREE.BoxGeometry(roofW, 0.14, roofW), darkGlaze)
    eaveFascia.position.set(cx, eaveY, cz)
    eaveFascia.castShadow = true
    this.add(eaveFascia)

    const eaveGoldTrim = new THREE.Mesh(new THREE.BoxGeometry(roofW + 0.04, 0.03, roofW + 0.04), gold)
    eaveGoldTrim.position.set(cx, eaveY - 0.055, cz)
    this.add(eaveGoldTrim)

    // 四角攢尖深綠琉璃屋頂主體 (Pure Emerald Pyramidal Glazed Roof - No black bars, no antennas)
    const roofGeo = new THREE.ConeGeometry((roofW * Math.SQRT2) / 2, 1.45, 4)
    const roofMesh = new THREE.Mesh(roofGeo, emeraldGlaze)
    roofMesh.position.set(cx, eaveY + 0.725, cz)
    roofMesh.rotation.y = Math.PI / 4 // Rotate 45 deg so flat slopes face X and Z
    roofMesh.castShadow = true
    roofMesh.receiveShadow = true
    this.add(roofMesh)

    // 中央三疊鎏金寶頂 (Gilded Triple Gourd Pagoda Finial)
    const finialGroup = new THREE.Group()
    finialGroup.position.set(cx, apexY, cz)

    const lotusBase = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.44, 0.14, 12), gold)
    lotusBase.position.y = 0.07

    const lowerGourd = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), gold)
    lowerGourd.position.y = 0.28
    lowerGourd.scale.set(1, 0.9, 1)

    const gourdWaist = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.024, 6, 16), red)
    gourdWaist.rotation.x = Math.PI / 2
    gourdWaist.position.y = 0.42

    const upperGourd = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), gold)
    upperGourd.position.y = 0.56

    const jewelCap = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.26, 8), gold)
    jewelCap.position.y = 0.76

    finialGroup.add(lotusBase, lowerGourd, gourdWaist, upperGourd, jewelCap)
    this.add(finialGroup)

    // 6. 厚實朱紅木欄杆與木雕背屏 (Balustrades & Altar Back Screen)
    const railH = 0.76
    const railY = podH + railH / 2

    // 左 (-Z) 與 右 (+Z) 厚實雕花欄杆
    for (const rz of [cz - span, cz + span]) {
      const railBox = new THREE.Mesh(new THREE.BoxGeometry(beamSpan - 0.35, 0.10, 0.12), red)
      railBox.position.set(cx, podH + railH, rz)
      const railLow = new THREE.Mesh(new THREE.BoxGeometry(beamSpan - 0.35, 0.08, 0.12), red)
      railLow.position.set(cx, podH + 0.12, rz)
      this.add(railBox)
      this.add(railLow)

      for (let i = -3; i <= 3; i += 1) {
        const bal = new THREE.Mesh(new THREE.BoxGeometry(0.07, railH - 0.18, 0.07), darkMahogany)
        bal.position.set(cx + (i / 4) * (span - 0.35), podH + railH / 2, rz)
        this.add(bal)
      }
      this.c.physics.addStaticBox(new THREE.Vector3(cx, railY, rz), new THREE.Vector3(beamSpan - 0.2, railH, 0.25))
    }

    // 後側 (-X) 欄杆 (位於背屏兩側)
    for (const dz of [-1.35, 1.35]) {
      const rearRail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.10, 0.85), red)
      rearRail.position.set(cx - span, podH + railH, cz + dz)
      const rearLow = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.85), red)
      rearLow.position.set(cx - span, podH + 0.12, cz + dz)
      this.add(rearRail)
      this.add(rearLow)
      for (let i = -1; i <= 1; i += 1) {
        const bal = new THREE.Mesh(new THREE.BoxGeometry(0.07, railH - 0.18, 0.07), darkMahogany)
        bal.position.set(cx - span, podH + railH / 2, cz + dz + (i * 0.24))
        this.add(bal)
      }
      this.c.physics.addStaticBox(new THREE.Vector3(cx - span, railY, cz + dz), new THREE.Vector3(0.25, railH, 0.95))
    }

    // 莊嚴雙面深紅褐色木雕神龕背屏 (Double-Sided Deep Reddish-Brown Wood-Carved Altar Screen)
    const screenFrameMat = new THREE.MeshStandardMaterial({ color: '#542217', roughness: 0.62, side: THREE.DoubleSide })
    const screenPanelMat = new THREE.MeshStandardMaterial({ color: '#6e2b1e', roughness: 0.58, side: THREE.DoubleSide })
    const goldReliefMat = new THREE.MeshStandardMaterial({ color: '#cba358', roughness: 0.45, metalness: 0.28, side: THREE.DoubleSide })

    const screenGroup = new THREE.Group()
    screenGroup.position.set(cx - 1.25, podH, cz)

    // 1. 深紅褐色木雕主外框 (Main Timber Frame)
    const screenFrame = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.30, 2.40), screenFrameMat)
    screenFrame.position.y = 1.15
    screenGroup.add(screenFrame)

    // 頂部木雕如意卷草頂冠 (Carved Ruyi Crest at Top)
    const screenCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 1.8, 12), screenFrameMat)
    screenCrown.rotation.x = Math.PI / 2
    screenCrown.position.set(0, 2.30, 0)
    screenGroup.add(screenCrown)

    // 2. 正面神壇雕花飾板 (+X Face, facing fairy and front altar)
    const frontInner = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.10, 2.20), screenPanelMat)
    frontInner.position.set(0.04, 1.15, 0)
    screenGroup.add(frontInner)

    const frontGoldBorder = new THREE.Mesh(new THREE.BoxGeometry(0.045, 1.95, 2.05), goldReliefMat)
    frontGoldBorder.position.set(0.04, 1.15, 0)
    screenGroup.add(frontGoldBorder)

    const frontField = new THREE.Mesh(new THREE.BoxGeometry(0.048, 1.85, 1.95), screenPanelMat)
    frontField.position.set(0.04, 1.15, 0)
    screenGroup.add(frontField)

    // 正面四角如意雲紋飾徽
    for (const dy of [-0.68, 0.68]) {
      for (const dz of [-0.78, 0.78]) {
        const badge = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.02, 12), goldReliefMat)
        badge.rotation.z = Math.PI / 2
        badge.position.set(0.065, 1.15 + dy, dz)
        screenGroup.add(badge)
      }
    }

    // 3. 背面木雕雕花飾板 (-X Face, facing the back of pavilion)
    const rearInner = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.10, 2.20), screenPanelMat)
    rearInner.position.set(-0.04, 1.15, 0)
    screenGroup.add(rearInner)

    // 背面上中下三道深紅木橫檻 (Horizontal Rails)
    for (const hy of [0.25, 1.15, 2.05]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.11, 2.18), screenFrameMat)
      rail.position.set(-0.045, hy, 0)
      screenGroup.add(rail)
    }

    // 背面三道深紅木豎檻 (Vertical Stile Rails)
    for (const rz of [-0.70, 0, 0.70]) {
      const stile = new THREE.Mesh(new THREE.BoxGeometry(0.045, 2.08, 0.10), screenFrameMat)
      stile.position.set(-0.045, 1.15, rz)
      screenGroup.add(stile)
    }

    // 背面低對比暗金如意雲紋圓飾 (Low-Contrast Antique Gold Medallions facing Rear)
    for (const rz of [-0.70, 0, 0.70]) {
      const rearBadgeUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.02, 16), goldReliefMat)
      rearBadgeUpper.rotation.z = Math.PI / 2
      rearBadgeUpper.position.set(-0.068, 1.60, rz)
      screenGroup.add(rearBadgeUpper)

      const rearBadgeLower = new THREE.Mesh(new THREE.CylinderGeometry(0.070, 0.070, 0.02, 16), goldReliefMat)
      rearBadgeLower.rotation.z = Math.PI / 2
      rearBadgeLower.position.set(-0.068, 0.70, rz)
      screenGroup.add(rearBadgeLower)
    }

    this.add(screenGroup, true)
    if (this.c.registerOccluder) {
      this.c.registerOccluder(screenFrame)
    }
    this.c.physics.addStaticBox(new THREE.Vector3(cx - 1.25, podH + 1.15, cz), new THREE.Vector3(0.3, 2.3, 2.4))

    // 正面神龕溫潤洗牆光 (Front Niche Warm Wash Light)
    const screenWashLight = new THREE.PointLight('#ffcf9e', 0.95, 4.0, 1.8)
    screenWashLight.position.set(cx - 0.95, podH + 1.65, cz)
    this.c.scene.add(screenWashLight)

    // 背面專屬暖光照明 (Dedicated Rear Warm Illumination - guarantees warm reddish brown wood & gold visibility)
    const rearWashLight = new THREE.PointLight('#ffd5a3', 1.5, 6.5, 1.6)
    rearWashLight.position.set(cx - 2.5, podH + 2.0, cz)
    this.c.scene.add(rearWashLight)

    // 7. 神壇核心：仙姑須彌神案與低矮供桌 (Altar Throne & Low Offering Table)
    const throneX = cx - 0.72
    const throneGroup = new THREE.Group()
    throneGroup.position.set(throneX, podH, cz)

    const thronePlinth = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.16, 1.05), darkMahogany)
    thronePlinth.position.y = 0.08

    const throneWaist = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.18, 0.90), red)
    throneWaist.position.y = 0.25

    const throneLotus = new THREE.Mesh(new THREE.CylinderGeometry(0.50, 0.44, 0.12, 16), gold)
    throneLotus.position.y = 0.38
    throneLotus.scale.set(0.65, 1, 1.05)

    throneGroup.add(thronePlinth, throneWaist, throneLotus)
    this.add(throneGroup, true)

    // 低矮朱紅雕花供桌 (Low Offering Table)
    const tableX = cx + 0.18
    const tableH = 0.44
    const tableW = 1.68
    const tableD = 0.72

    const tableTop = new THREE.Mesh(new THREE.BoxGeometry(tableD, 0.06, tableW), cinnabar)
    tableTop.position.set(tableX, podH + tableH - 0.03, cz)
    tableTop.castShadow = true
    tableTop.receiveShadow = true
    this.add(tableTop)

    const apron = new THREE.Mesh(new THREE.BoxGeometry(tableD - 0.06, 0.14, tableW - 0.06), darkMahogany)
    apron.position.set(tableX, podH + tableH - 0.13, cz)
    this.add(apron)

    const apronGold = new THREE.Mesh(new THREE.BoxGeometry(tableD - 0.04, 0.02, tableW - 0.04), gold)
    apronGold.position.set(tableX, podH + tableH - 0.08, cz)
    this.add(apronGold)

    for (const dx of [-tableD / 2 + 0.08, tableD / 2 - 0.08]) {
      for (const dz of [-tableW / 2 + 0.08, tableW / 2 - 0.08]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, tableH - 0.06, 0.08), darkMahogany)
        leg.position.set(tableX + dx, podH + (tableH - 0.06) / 2, cz + dz)
        this.add(leg)
      }
    }
    this.c.physics.addStaticBox(new THREE.Vector3(tableX, podH + tableH / 2, cz), new THREE.Vector3(tableD, tableH, tableW))

    // 供桌陳設 1: 朱砂銅香爐 (Incense Burner)
    const burnerX = tableX + 0.18
    const burnerY = podH + tableH
    const censerGroup = new THREE.Group()
    censerGroup.position.set(burnerX, burnerY, cz)

    const censerBody = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.12, 16), bronze)
    censerBody.position.y = 0.06
    const censerRim = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.015, 6, 16), gold)
    censerRim.rotation.x = Math.PI / 2
    censerRim.position.y = 0.12

    for (let k = 0; k < 3; k += 1) {
      const ang = k * ((Math.PI * 2) / 3)
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.012, 0.04, 8), bronze)
      leg.position.set(Math.cos(ang) * 0.08, 0.02, Math.sin(ang) * 0.08)
      censerGroup.add(leg)
    }

    for (let s = -1; s <= 1; s += 1) {
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.20, 6), this.c.mat('#8a2818', 0.8))
      stick.position.set(s * 0.025, 0.18, 0)
      stick.rotation.z = s * 0.05
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.005, 6, 6), this.c.mat('#ff6622', 0.2, 0.8))
      tip.position.set(s * 0.025, 0.28, 0)
      censerGroup.add(stick, tip)
    }

    censerGroup.add(censerBody, censerRim)
    this.add(censerGroup)

    // 供桌正中央陳設 2: 一對紅木聖筊 (Pair of Divination Moon Blocks - centered right in front of censer)
    const bwaBweiGroup = new THREE.Group()
    bwaBweiGroup.position.set(tableX + 0.22, burnerY, cz)
    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.015, 0.24), darkMahogany)
    tray.position.y = 0.008
    bwaBweiGroup.add(tray)

    for (const [offsetZ, rotX] of [[-0.05, 0], [0.05, Math.PI]] as const) {
      const block = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.018, 6, 8, Math.PI), cinnabar)
      block.rotation.set(rotX, 0, Math.PI / 2)
      block.position.set(0, 0.025, offsetZ)
      bwaBweiGroup.add(block)
    }
    this.add(bwaBweiGroup)

    // 供桌陳設 3: 紅木籤筒與籤詩 (Fortune Stick Cylinder on left side)
    const sticksGroup = new THREE.Group()
    sticksGroup.position.set(tableX + 0.08, burnerY, cz + 0.38)
    const stickCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.06, 0.22, 12), this.c.mat('#7a2618', 0.7))
    stickCyl.position.y = 0.11
    const stickRim = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.008, 6, 12), gold)
    stickRim.rotation.x = Math.PI / 2
    stickRim.position.y = 0.22
    sticksGroup.add(stickCyl, stickRim)

    for (let s = 0; s < 10; s += 1) {
      const sa = (s / 10) * Math.PI * 2
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.26, 4), this.c.mat('#dfc495', 0.6))
      st.position.set(Math.cos(sa) * 0.035, 0.20, Math.sin(sa) * 0.035)
      st.rotation.set(Math.sin(sa) * 0.12, 0, Math.cos(sa) * 0.12)
      sticksGroup.add(st)
    }
    this.add(sticksGroup)

    // 供桌陳設 4: 成對小型祈福供燈 (Pair of Symmetrical Altar Lamps on corners)
    for (const dz of [-0.68, 0.68]) {
      const lampGroup = new THREE.Group()
      lampGroup.position.set(tableX + 0.02, burnerY, cz + dz)
      const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 0.08, 10), bronze)
      lampBase.position.y = 0.04
      const lampGlass = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), this.c.mat('#ffd599', 0.3, 0.1))
      lampGlass.position.y = 0.12
      lampGlass.scale.set(1, 1.3, 1)
      const lampCap = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.05, 8), gold)
      lampCap.position.y = 0.20
      lampGroup.add(lampBase, lampGlass, lampCap)
      this.add(lampGroup)

      const lampLight = new THREE.PointLight('#ffa64d', 0.45, 2.2, 2.0)
      lampLight.position.set(tableX + 0.02, burnerY + 0.14, cz + dz)
      this.c.scene.add(lampLight)
    }

    // 供桌陳設 5: 象棋卦盤 (縮小並嵌入神案右後方，降低視覺優先權，保留 chessboard 名稱與互動)
    const boardX = tableX - 0.15
    const boardZ = cz - 0.46
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.015, 0.38),
      new THREE.MeshStandardMaterial({ map: this.boardTexture(), roughness: 0.75 })
    )
    board.position.set(boardX, burnerY + 0.008, boardZ)
    board.name = 'chessboard'
    this.add(board, false)

    const pieces: [number, number, string][] = [
      [0, 0, PAL.red],
      [-0.08, 0, '#34302a'],
      [0.08, 0, PAL.red],
      [0, -0.10, '#34302a'],
      [0, 0.10, PAL.red],
    ]
    for (const [dx, dz, color] of pieces) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.030, 0.016, 12), this.c.mat('#e8d7b0', 0.6))
      p.position.set(boardX + dx, burnerY + 0.022, boardZ + dz)
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.020, 0.004, 4, 12), this.c.mat(color, 0.5))
      ring.rotation.x = Math.PI / 2
      ring.position.set(boardX + dx, burnerY + 0.031, boardZ + dz)
      this.add(p, false)
      this.add(ring, false)
    }

    // 8. 仙姑法相神案安裝 (Tianxin Fairy)
    this.addTianxinFairy(cx, cz)

    // 9. 匾額與成對懸掛宮燈 (Plaque & Symmetrical Palace Lanterns)
    const plaqueX = cx + span + 0.08
    const plaqueY = beamY + 0.02
    const plaqueFrame = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.48, 1.52), darkMahogany)
    plaqueFrame.position.set(plaqueX, plaqueY, cz)
    this.add(plaqueFrame, false)

    const plaqueGoldBorder = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.44, 1.48), gold)
    plaqueGoldBorder.position.set(plaqueX, plaqueY, cz)
    this.add(plaqueGoldBorder, false)

    const plaqueFace = new THREE.Mesh(new THREE.PlaneGeometry(1.42, 0.38), this.c.text('天 心 仙 姑', '#f5d68d', '#2e1910'))
    plaqueFace.position.set(plaqueX + 0.045, plaqueY, cz)
    plaqueFace.rotation.y = Math.PI / 2
    this.c.scene.add(plaqueFace)

    const plaqueGlow = new THREE.PointLight('#ffe4a8', 1.1, 4.0, 1.8)
    plaqueGlow.position.set(plaqueX + 0.55, plaqueY - 0.05, cz)
    this.c.scene.add(plaqueGlow)

    // 正面成對懸掛宮燈 (縮小至約 48%，改由亭簷短鏈精巧懸掛)
    for (const dz of [-span + 0.35, span - 0.35]) {
      const lx = cx + span + 0.04
      const lz = cz + dz
      const lTopY = beamY + 0.16

      const lanternGroup = new THREE.Group()
      lanternGroup.position.set(lx, lTopY, lz)

      const hook = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.005, 6, 10), bronze)
      hook.rotation.y = Math.PI / 2
      hook.position.y = -0.02
      lanternGroup.add(hook)

      for (let c = 0; c < 2; c += 1) {
        const link = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.004, 4, 8), bronze)
        link.position.y = -0.04 - c * 0.022
        link.rotation.y = c % 2 === 0 ? 0 : Math.PI / 2
        lanternGroup.add(link)
      }

      const chainDrop = 0.08

      const roofCap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.13, 0.045, 8), red)
      roofCap.position.y = -chainDrop - 0.022
      lanternGroup.add(roofCap)

      const silkMat = this.c.mat('#fff0c4', 0.25)
      silkMat.emissive.set('#ff9e3b')
      silkMat.emissiveIntensity = 0.85
      this.lanternMats.push(silkMat)

      const silkBody = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.10, 0.18, 8), silkMat)
      silkBody.position.y = -chainDrop - 0.12
      lanternGroup.add(silkBody)

      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.008, 6, 16), gold)
      rim.rotation.x = Math.PI / 2
      rim.position.y = -chainDrop - 0.035
      lanternGroup.add(rim)

      const botCap = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.11, 6), red)
      botCap.rotation.x = Math.PI
      botCap.position.y = -chainDrop - 0.25
      lanternGroup.add(botCap)

      this.add(lanternGroup)

      const lanternLight = new THREE.PointLight('#ffaa48', 0.55, 3.2, 1.8)
      lanternLight.position.set(lx, lTopY - chainDrop - 0.12, lz)
      this.c.scene.add(lanternLight)
    }

    // 10. 柔暖橘金照明系統 (Warm Amber Altar Illumination)
    const altarLight = new THREE.PointLight('#ffe0a8', 1.35, 6.5, 1.6)
    altarLight.position.set(cx + 0.35, podH + 1.55, cz)
    this.c.scene.add(altarLight)

    const ceilingLight = new THREE.PointLight('#ffc878', 0.85, 4.8, 1.8)
    ceilingLight.position.set(cx, beamY + 0.35, cz)
    this.c.scene.add(ceilingLight)

    // 11. 步道入口立地告示木牌 (Signboard near Road)
    const sign = new THREE.Group()
    sign.position.set(-4.0, 0, 35.5)
    const signPostH = 1.58
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, signPostH, 0.14), wood)
    post.position.set(0, signPostH / 2, 0)
    const backBrace = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.58, 0.08), wood)
    backBrace.position.set(0, 1.85, -0.07)
    const boardMesh = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.6, 0.1), this.c.mat('#36241a'))
    boardMesh.position.y = 1.85
    const signFace = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.5), this.c.text('天心仙姑問事亭', '#e9c97f', '#36241a'))
    signFace.position.set(0, 1.85, 0.055)
    sign.add(post, backBrace, boardMesh, signFace)
    sign.rotation.y = -0.35
    this.add(sign)
    this.c.physics.addStaticBox(new THREE.Vector3(-4.0, 1, 35.5), new THREE.Vector3(0.3, 2, 0.3))

    const signGlow = new THREE.PointLight('#ffea9f', 1.5, 5.5, 2.0)
    signGlow.position.set(-4.0, 2.2, 35.8)
    this.c.scene.add(signGlow)
  }

  private addTianxinFairy(cx: number, cz: number): void {
    const loader = new THREE.TextureLoader()
    const applyFairy = (tex: THREE.Texture) => {
      tex.colorSpace = THREE.SRGBColorSpace
      const aspect = 290 / 511
      const fairyH = 1.45
      const fairyW = fairyH * aspect
      const geo = new THREE.PlaneGeometry(fairyW, fairyH)
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        transparent: true,
        alphaTest: 0.05,
        roughness: 0.85,
        metalness: 0.02,
        side: THREE.DoubleSide,
      })
      mat.emissive.set(0x000000)
      mat.emissiveIntensity = 0.0

      const mesh = new THREE.Mesh(geo, mat)
      // Placed on the Sumeru throne, facing visitors entering the pavilion from the road (+X)
      mesh.position.set(cx - 0.72, this.fairyBaseY + fairyH / 2, cz)
      mesh.rotation.y = Math.PI / 2
      mesh.castShadow = true
      mesh.receiveShadow = true
      this.fairyMesh = mesh
      this.c.scene.add(mesh)
    }
    loader.load('./assets/tianxin-fairy.webp', applyFairy)
  }

  private boardTexture(): THREE.CanvasTexture {
    const cv = document.createElement('canvas')
    cv.width = 256; cv.height = 280
    const g = cv.getContext('2d')!
    g.fillStyle = '#d9c08b'; g.fillRect(0, 0, 256, 280)
    g.strokeStyle = '#6b4a2c'; g.lineWidth = 3
    const x0 = 24, y0 = 22, dx = 26, dy = 26
    for (let i = 0; i < 9; i += 1) { g.beginPath(); g.moveTo(x0 + i * dx, y0); g.lineTo(x0 + i * dx, y0 + 9 * dy); g.stroke() }
    for (let j = 0; j < 10; j += 1) { g.beginPath(); g.moveTo(x0, y0 + j * dy); g.lineTo(x0 + 8 * dx, y0 + j * dy); g.stroke() }
    g.fillStyle = '#d9c08b'; g.fillRect(x0 + 2, y0 + 4 * dy + 2, 8 * dx - 4, dy - 4)
    const t = new THREE.CanvasTexture(cv)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }

  private lotusPot(x: number, z: number): void {
    const g = new THREE.Group()
    g.position.set(x, 0, z)
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.38, 0.6, 14), this.c.mat('#7c5a43', 0.8))
    pot.position.y = 0.3
    const water = new THREE.Mesh(new THREE.CircleGeometry(0.44, 16), this.c.mat(PAL.water, 0.3))
    water.rotation.x = -Math.PI / 2
    water.position.y = 0.58
    g.add(pot, water)
    for (let i = 0; i < 3; i += 1) {
      const pad = new THREE.Mesh(new THREE.CircleGeometry(0.15, 10), this.c.mat(PAL.lotusPad, 0.7))
      pad.rotation.x = -Math.PI / 2
      pad.position.set(Math.cos(i * 2.1) * 0.22, 0.6, Math.sin(i * 2.1) * 0.22)
      g.add(pad)
    }
    g.add(this.lotusFlower(0, 0.62, 0, 0.13))
    this.add(g)
    this.c.physics.addStaticCylinder(new THREE.Vector3(x, 0.4, z), 0.5, 0.8)
  }

  private lotusFlower(x: number, y: number, z: number, s: number, color = PAL.lotus): THREE.Group {
    const f = new THREE.Group()
    f.position.set(x, y, z)
    const petalMat = this.c.mat(color, 0.6)
    const geoms: THREE.BufferGeometry[] = []

    // Outer petals (6 petals, spreading)
    const baseOuter = new THREE.SphereGeometry(s, 8, 6)
    for (let i = 0; i < 6; i += 1) {
      const g = baseOuter.clone()
      const a = (i / 6) * Math.PI * 2
      const m = new THREE.Matrix4()
      const rot = new THREE.Euler(Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55)
      const pos = new THREE.Vector3(Math.cos(a) * s * 0.6, s * 0.55, Math.sin(a) * s * 0.6)
      const scale = new THREE.Vector3(0.48, 0.92, 0.28)
      m.compose(pos, new THREE.Quaternion().setFromEuler(rot), scale)
      g.applyMatrix4(m)
      geoms.push(g)
    }
    baseOuter.dispose()

    // Inner petals (5 petals, upright cup)
    const baseInner = new THREE.SphereGeometry(s * 0.85, 8, 6)
    for (let i = 0; i < 5; i += 1) {
      const g = baseInner.clone()
      const a = (i / 5) * Math.PI * 2 + 0.35
      const m = new THREE.Matrix4()
      const rot = new THREE.Euler(Math.sin(a) * 0.32, 0, -Math.cos(a) * 0.32)
      const pos = new THREE.Vector3(Math.cos(a) * s * 0.38, s * 0.65, Math.sin(a) * s * 0.38)
      const scale = new THREE.Vector3(0.42, 0.88, 0.26)
      m.compose(pos, new THREE.Quaternion().setFromEuler(rot), scale)
      g.applyMatrix4(m)
      geoms.push(g)
    }
    baseInner.dispose()

    const mergedPetals = BufferGeometryUtils.mergeGeometries(geoms, false)
    for (const bg of geoms) bg.dispose()
    f.add(new THREE.Mesh(mergedPetals, petalMat))

    const heart = new THREE.Mesh(new THREE.SphereGeometry(s * 0.35, 8, 6), this.c.mat('#e8c35c', 0.5))
    heart.position.y = s * 0.55
    f.add(heart)
    return f
  }

  /**
   * Grand Scenic Lotus Pond (前庭東側・盛景九曲荷花池):
   * 擴建後的壯麗荷花池，尺寸拓展至約 10.4m × 7.4m，採古典漢白玉雕石蓮瓣護欄圍砌。
   * 池內碧波如翠、池底深淺漸層，生長著 54 餘片高低錯落的蓮葉（包含浮水葉與高聳挺水葉），
   * 盛開著 28 朵千姿百態的仙蓮（粉紅盛開荷花、聖潔出水白蓮、胭脂艷紅蓮、亭亭玉立荷苞與如意蓮蓬）。
   * 池畔點綴天然太湖石假山與水榭石燈籠，夜幕降臨散發水面溫潤微光。
   */
  private addLotusPondStructure(): void {
    const { x, z } = LOTUS_POND
    const rx = 5.2
    const rz = 3.7
    const g = new THREE.Group()
    g.position.set(x, 0, z)

    // 1. Tiered Carved Stone Basin Foundation (基座與外池壁)
    const stonePlinth = this.c.mat('#8c8072', 0.95)
    const stoneWall = this.c.mat('#a89b88', 0.9)
    const whiteMarble = this.c.mat('#dcd3c4', 0.7)
    const darkFloor = this.c.mat('#1b302a', 0.95)

    // Lower plinth
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.22, 48), stonePlinth)
    plinth.scale.set(rx + 0.35, 1, rz + 0.35)
    plinth.position.y = 0.11
    g.add(plinth)

    // Main basin wall
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.46, 48), stoneWall)
    wall.scale.set(rx + 0.15, 1, rz + 0.15)
    wall.position.y = 0.23
    g.add(wall)

    // Deep pond floor
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.35, 48), darkFloor)
    floor.scale.set(rx - 0.2, 1, rz - 0.2)
    floor.position.y = 0.05
    g.add(floor)

    // Carved copestone rim (漢白玉壓頂雕石圈)
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.14, 10, 48), whiteMarble)
    rim.rotation.x = Math.PI / 2
    rim.scale.set(rx + 0.08, rz + 0.08, 1)
    rim.position.y = 0.46
    g.add(rim)

    // 2. 16 Carved Stone Baluster Posts (漢白玉望柱與雕花柱頭) - Batched with mergeGeometries
    const postCount = 16
    const baseGeoms: THREE.BufferGeometry[] = []
    const marbleGeoms: THREE.BufferGeometry[] = []
    const goldGeoms: THREE.BufferGeometry[] = []
    const panelGeoms: THREE.BufferGeometry[] = []

    const boxBaseGeo = new THREE.BoxGeometry(0.24, 0.24, 0.24)
    const boxColGeo = new THREE.BoxGeometry(0.18, 0.38, 0.18)
    const finialBaseGeo = new THREE.CylinderGeometry(0.12, 0.08, 0.08, 8)
    const sphereFinialGeo = new THREE.SphereGeometry(0.1, 8, 6)

    for (let i = 0; i < postCount; i += 1) {
      const a = (i / postCount) * Math.PI * 2
      const px = Math.cos(a) * (rx + 0.12)
      const pz = Math.sin(a) * (rz + 0.12)

      // Post pedestal
      const bG = boxBaseGeo.clone()
      bG.translate(px, 0.32, pz)
      baseGeoms.push(bG)

      // Post column
      const colG = boxColGeo.clone()
      colG.translate(px, 0.58, pz)
      marbleGeoms.push(colG)

      // Lotus finial base
      const fbG = finialBaseGeo.clone()
      fbG.translate(px, 0.81, pz)
      goldGeoms.push(fbG)

      // Lotus finial sphere
      const fG = sphereFinialGeo.clone()
      fG.scale(0.9, 1.3, 0.9)
      fG.translate(px, 0.92, pz)
      marbleGeoms.push(fG)
    }
    boxBaseGeo.dispose()
    boxColGeo.dispose()
    finialBaseGeo.dispose()
    sphereFinialGeo.dispose()

    // Balustrade panels (中間雕石欄板)
    for (let i = 0; i < postCount; i += 1) {
      const a1 = (i / postCount) * Math.PI * 2
      const a2 = ((i + 1) / postCount) * Math.PI * 2
      const p1x = Math.cos(a1) * (rx + 0.08)
      const p1z = Math.sin(a1) * (rz + 0.08)
      const p2x = Math.cos(a2) * (rx + 0.08)
      const p2z = Math.sin(a2) * (rz + 0.08)
      const mx = (p1x + p2x) / 2
      const mz = (p1z + p2z) / 2
      const segLen = Math.hypot(p2x - p1x, p2z - p1z)
      const segAngle = Math.atan2(p2z - p1z, p2x - p1x)
      const pG = new THREE.BoxGeometry(segLen, 0.28, 0.1)
      pG.rotateY(-segAngle)
      pG.translate(mx, 0.44, mz)
      panelGeoms.push(pG)
    }

    const mergedBase = BufferGeometryUtils.mergeGeometries(baseGeoms, false)
    for (const bg of baseGeoms) bg.dispose()
    g.add(new THREE.Mesh(mergedBase, stoneWall))

    const mergedMarble = BufferGeometryUtils.mergeGeometries(marbleGeoms, false)
    for (const mg of marbleGeoms) mg.dispose()
    g.add(new THREE.Mesh(mergedMarble, whiteMarble))

    const mergedGold = BufferGeometryUtils.mergeGeometries(goldGeoms, false)
    for (const gg of goldGeoms) gg.dispose()
    g.add(new THREE.Mesh(mergedGold, this.c.mat(PAL.gold, 0.5, 0.3)))

    const mergedPanels = BufferGeometryUtils.mergeGeometries(panelGeoms, false)
    for (const pg of panelGeoms) pg.dispose()
    g.add(new THREE.Mesh(mergedPanels, this.c.mat('#cfc6b5', 0.8)))

    // 3. Taihu Scholar Stones (太湖石假山景觀) & Waterside Lantern
    const rockMat = this.c.mat('#6e655a', 0.92)
    const mossMat = this.c.mat('#55634e', 0.88)
    const rocks = [
      { geom: new THREE.DodecahedronGeometry(0.9, 1), scale: [1.1, 1.45, 0.95], pos: [rx * 0.72, 0.62, -rz * 0.22], rot: [0.2, 0.7, -0.1], mat: rockMat },
      { geom: new THREE.IcosahedronGeometry(0.7, 0), scale: [1.25, 0.85, 1.1], pos: [rx * 0.68, 0.42, rz * 0.26], rot: [-0.3, 0.4, 0.2], mat: mossMat },
      { geom: new THREE.DodecahedronGeometry(0.52, 1), scale: [0.95, 1.1, 1.05], pos: [rx * 0.52, 0.36, -rz * 0.55], rot: [0.1, -0.6, 0.3], mat: rockMat },
    ]
    for (const r of rocks) {
      const m = new THREE.Mesh(r.geom, r.mat)
      m.scale.set(r.scale[0], r.scale[1], r.scale[2])
      m.position.set(r.pos[0], r.pos[1], r.pos[2])
      m.rotation.set(r.rot[0], r.rot[1], r.rot[2])
      g.add(m)
    }

    // Traditional Genshin Liyue Waterside Stone Lantern atop rock (池畔水榭原神璃月仙風石燈籠)
    const lanternBase = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, 0.16, 6), stoneWall)
    lanternBase.position.set(rx * 0.72, 1.42, -rz * 0.22)
    const waterLampMat = this.c.mat('#ffe896', 0.35)
    waterLampMat.emissive.set('#ff9e30')
    waterLampMat.emissiveIntensity = 0.9
    this.lanternMats.push(waterLampMat)
    const lanternWindow = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.28, 6), waterLampMat)
    lanternWindow.position.set(rx * 0.72, 1.62, -rz * 0.22)
    const lanternRoof = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.42, 0.2, 6), stoneWall)
    lanternRoof.position.set(rx * 0.72, 1.84, -rz * 0.22)
    const lanternFinial = new THREE.Mesh(new THREE.DodecahedronGeometry(0.07), this.c.mat(PAL.gold, 0.4, 0.3))
    lanternFinial.position.set(rx * 0.72, 1.98, -rz * 0.22)
    g.add(lanternBase, lanternWindow, lanternRoof, lanternFinial)

    const lanternLight = new THREE.PointLight('#ffbe55', 1.0, 7.5, 1.8)
    lanternLight.position.set(rx * 0.72, 1.62, -rz * 0.22)
    g.add(lanternLight)

    this.add(g)

    // 4. Tranquil Jade Water Surface (碧波如鏡池水)
    const waterMat = new THREE.MeshStandardMaterial({
      color: '#2a5b51',
      roughness: 0.16,
      metalness: 0.26,
      transparent: true,
      opacity: 0.94,
    })
    const water = new THREE.Mesh(new THREE.CircleGeometry(1, 48), waterMat)
    water.rotation.x = -Math.PI / 2
    water.scale.set(rx - 0.06, rz - 0.06, 1)
    water.position.set(x, 0.28, z)
    this.c.scene.add(water)

    // 5. Physics Collision Barrier (防止玩家墜入深池)
    this.c.physics.addStaticBox(
      new THREE.Vector3(x, 0.45, z),
      new THREE.Vector3((rx + 0.15) * 2, 0.95, (rz + 0.15) * 2)
    )

    // 6. Center Sacred Lotus Pedestal & Treasure Bowl (池心聚寶金蓮台)
    const centerPedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.65, 0.38, 16), this.c.mat('#8f8670', 0.8))
    centerPedestal.position.set(x, 0.15, z)
    this.c.scene.add(centerPedestal)
    const centerBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.32, 0.16, 16), this.c.mat(PAL.gold, 0.35, 0.5))
    centerBowl.position.set(x, 0.35, z)
    this.c.scene.add(centerBowl)
    // Sacred golden lotus flower blooming in the center
    this.c.scene.add(this.lotusFlower(x, 0.42, z, 0.34, '#ffdf78'))
  }

  private addLotusPondFlora(): void {
    const { x, z } = LOTUS_POND
    const rx = 5.2
    const rz = 3.7
    this.addGrandLotusFlora(x, z, rx - 0.55, rz - 0.5)
  }

  private addLotusPond(): void {
    this.addLotusPondStructure()
    this.addLotusPondFlora()
  }

  /**
   * Generates a lush, varied lotus ecosystem across the grand pond:
   * - 54 Lotus Pads: mixed sizes (0.28m to 0.68m), varied greens, natural notched geometry.
   *   18 pads stand upright on slender stems (挺水葉, 0.16m - 0.34m above water).
   *   36 pads float serenely on the water surface (浮水葉).
   * - 28 Lotus Blossoms, Buds & Seedpods:
   *   - 11 Classic Pink Blooming Lotuses (粉紅盛開重瓣大荷花)
   *   - 6 Sacred White Lotuses (白玉出水仙蓮)
   *   - 4 Crimson-Tipped Lotuses (胭脂艷紅蓮)
   *   - 4 Slender Upright Lotus Buds (亭亭玉立含苞待放)
   *   - 3 Ripened Golden-Green Seedpods (綠玉如意蓮蓬)
   */
  private addGrandLotusFlora(cx: number, cz: number, spreadX: number, spreadZ: number): void {
    const padCount = 54
    const padColors = [PAL.lotusPad, '#4d7c43', '#669c57', '#3c6633', '#5a8c50']

    // Seeded pseudo-random using golden ratio distribution
    const padPositions: { x: number; z: number; y: number; r: number; elevated: boolean }[] = []

    const padGeomsByColor = new Map<string, THREE.BufferGeometry[]>()
    for (const c of padColors) padGeomsByColor.set(c, [])
    const stemGeoms: THREE.BufferGeometry[] = []

    for (let i = 0; i < padCount; i += 1) {
      const phi = i * 2.39996 + 0.5
      const radFrac = Math.sqrt((i + 0.8) / padCount) * 0.92
      const px = cx + Math.cos(phi) * spreadX * radFrac
      const pz = cz + Math.sin(phi) * spreadZ * radFrac

      // Avoid rock cluster area around eastern sector
      if (px > cx + spreadX * 0.48 && pz < cz + spreadZ * 0.3 && pz > cz - spreadZ * 0.5) {
        continue
      }

      const padR = 0.28 + ((i * 7) % 5) * 0.08 + (i % 3) * 0.06
      const color = padColors[i % padColors.length]
      const isElevated = i % 3 === 0
      const stemH = isElevated ? 0.16 + (i % 4) * 0.06 : 0
      const py = 0.29 + stemH

      padPositions.push({ x: px, z: pz, y: py, r: padR, elevated: isElevated })

      // Pad geom
      const padGeom = new THREE.CircleGeometry(padR, 14, 0.25, Math.PI * 2 - 0.25)
      padGeom.rotateX(-Math.PI / 2)
      padGeom.rotateY(phi)
      if (isElevated) {
        padGeom.rotateX(((i % 5) - 2) * 0.06)
        padGeom.rotateY(((i % 3) - 1) * 0.05)
      }
      padGeom.translate(px, py, pz)
      padGeomsByColor.get(color)!.push(padGeom)

      // Slender stem down to water if elevated
      if (isElevated) {
        const stemG = new THREE.CylinderGeometry(0.016, 0.018, stemH + 0.08, 6)
        stemG.translate(px, 0.25 + stemH / 2, pz)
        stemGeoms.push(stemG)
      }
    }

    // Merge and add pads by color
    for (const [color, geoms] of padGeomsByColor.entries()) {
      if (geoms.length > 0) {
        const merged = BufferGeometryUtils.mergeGeometries(geoms, false)
        for (const g of geoms) g.dispose()
        const m = new THREE.Mesh(merged, this.c.mat(color, 0.7))
        this.c.scene.add(m)
      }
    }

    // 28 Flowers, Buds and Seedpods distributed across lush pads
    const flowerTypes: { type: 'pink' | 'white' | 'crimson' | 'bud' | 'seedpod'; color?: string; size: number }[] = [
      // 11 Pink blooming lotuses
      { type: 'pink', color: '#ea9fb0', size: 0.24 },
      { type: 'pink', color: '#f2a8b8', size: 0.26 },
      { type: 'pink', color: '#e58e9f', size: 0.23 },
      { type: 'pink', color: '#f0a3b3', size: 0.25 },
      { type: 'pink', color: '#e894a5', size: 0.22 },
      { type: 'pink', color: '#f3b0be', size: 0.27 },
      { type: 'pink', color: '#ea99a8', size: 0.24 },
      { type: 'pink', color: '#eb9cae', size: 0.25 },
      { type: 'pink', color: '#f1abb9', size: 0.23 },
      { type: 'pink', color: '#e792a3', size: 0.26 },
      { type: 'pink', color: '#f5b4c2', size: 0.24 },

      // 6 Sacred White lotuses
      { type: 'white', color: '#fbf8f0', size: 0.24 },
      { type: 'white', color: '#fffdf8', size: 0.26 },
      { type: 'white', color: '#f7f4ea', size: 0.23 },
      { type: 'white', color: '#faf6ee', size: 0.25 },
      { type: 'white', color: '#fffcf5', size: 0.22 },
      { type: 'white', color: '#f8f4ec', size: 0.25 },

      // 4 Crimson-tipped lotuses
      { type: 'crimson', color: '#d85c76', size: 0.24 },
      { type: 'crimson', color: '#ce4f69', size: 0.26 },
      { type: 'crimson', color: '#e06680', size: 0.23 },
      { type: 'crimson', color: '#d35670', size: 0.25 },

      // 4 Slender upright buds
      { type: 'bud', color: '#e2889a', size: 0.18 },
      { type: 'bud', color: '#ea91a3', size: 0.20 },
      { type: 'bud', color: '#dc7a8c', size: 0.19 },
      { type: 'bud', color: '#e58c9e', size: 0.18 },

      // 3 Seedpods
      { type: 'seedpod', size: 0.18 },
      { type: 'seedpod', size: 0.21 },
      { type: 'seedpod', size: 0.19 },
    ]

    const pinkPetalGeoms: THREE.BufferGeometry[] = []
    const whitePetalGeoms: THREE.BufferGeometry[] = []
    const crimsonPetalGeoms: THREE.BufferGeometry[] = []
    const flowerHeartGeoms: THREE.BufferGeometry[] = []
    const budConeGeoms: THREE.BufferGeometry[] = []
    const budBaseGeoms: THREE.BufferGeometry[] = []
    const podBodyGeoms: THREE.BufferGeometry[] = []
    const podTopGeoms: THREE.BufferGeometry[] = []

    const appendFlowerPetals = (fx: number, fy: number, fz: number, s: number, targetList: THREE.BufferGeometry[]) => {
      const baseOuter = new THREE.SphereGeometry(s, 8, 6)
      for (let i = 0; i < 6; i += 1) {
        const g = baseOuter.clone()
        const a = (i / 6) * Math.PI * 2
        const m = new THREE.Matrix4()
        const rot = new THREE.Euler(Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55)
        const pos = new THREE.Vector3(Math.cos(a) * s * 0.6, s * 0.55, Math.sin(a) * s * 0.6)
        const scale = new THREE.Vector3(0.48, 0.92, 0.28)
        m.compose(pos, new THREE.Quaternion().setFromEuler(rot), scale)
        g.applyMatrix4(m)
        g.translate(fx, fy, fz)
        targetList.push(g)
      }
      baseOuter.dispose()

      const baseInner = new THREE.SphereGeometry(s * 0.85, 8, 6)
      for (let i = 0; i < 5; i += 1) {
        const g = baseInner.clone()
        const a = (i / 5) * Math.PI * 2 + 0.35
        const m = new THREE.Matrix4()
        const rot = new THREE.Euler(Math.sin(a) * 0.32, 0, -Math.cos(a) * 0.32)
        const pos = new THREE.Vector3(Math.cos(a) * s * 0.38, s * 0.65, Math.sin(a) * s * 0.38)
        const scale = new THREE.Vector3(0.42, 0.88, 0.26)
        m.compose(pos, new THREE.Quaternion().setFromEuler(rot), scale)
        g.applyMatrix4(m)
        g.translate(fx, fy, fz)
        targetList.push(g)
      }
      baseInner.dispose()

      const heart = new THREE.SphereGeometry(s * 0.35, 8, 6)
      heart.translate(fx, fy + s * 0.55, fz)
      flowerHeartGeoms.push(heart)
    }

    for (let j = 0; j < flowerTypes.length; j += 1) {
      const ft = flowerTypes[j]
      const padIdx = (j * 2 + 1) % padPositions.length
      const p = padPositions[padIdx]
      const fx = p.x + ((j * 3) % 5 - 2) * 0.08
      const fz = p.z + ((j * 4) % 5 - 2) * 0.08
      const stemH = 0.12 + (j % 5) * 0.05
      const fy = 0.29 + stemH

      // Slender stem
      const stemG = new THREE.CylinderGeometry(0.015, 0.018, stemH + 0.08, 6)
      stemG.translate(fx, 0.26 + stemH / 2, fz)
      stemGeoms.push(stemG)

      if (ft.type === 'bud') {
        const cone = new THREE.ConeGeometry(ft.size * 0.45, ft.size * 1.3, 8)
        cone.translate(fx, fy + ft.size * 0.65, fz)
        budConeGeoms.push(cone)
        const base = new THREE.SphereGeometry(ft.size * 0.42, 8, 6)
        base.translate(fx, fy + ft.size * 0.2, fz)
        budBaseGeoms.push(base)
      } else if (ft.type === 'seedpod') {
        const pod = new THREE.CylinderGeometry(ft.size * 0.55, ft.size * 0.24, ft.size * 0.7, 8)
        pod.translate(fx, fy + ft.size * 0.4, fz)
        podBodyGeoms.push(pod)
        const top = new THREE.CircleGeometry(ft.size * 0.52, 8)
        top.rotateX(-Math.PI / 2)
        top.translate(fx, fy + ft.size * 0.75, fz)
        podTopGeoms.push(top)
      } else if (ft.type === 'white') {
        appendFlowerPetals(fx, fy, fz, ft.size, whitePetalGeoms)
      } else if (ft.type === 'crimson') {
        appendFlowerPetals(fx, fy, fz, ft.size, crimsonPetalGeoms)
      } else {
        appendFlowerPetals(fx, fy, fz, ft.size, pinkPetalGeoms)
      }
    }

    const mergeAndAddMesh = (geoms: THREE.BufferGeometry[], mat: THREE.Material) => {
      if (geoms.length > 0) {
        const merged = BufferGeometryUtils.mergeGeometries(geoms, false)
        for (const g of geoms) g.dispose()
        this.c.scene.add(new THREE.Mesh(merged, mat))
      }
    }

    mergeAndAddMesh(pinkPetalGeoms, this.c.mat(PAL.lotus, 0.6))
    mergeAndAddMesh(whitePetalGeoms, this.c.mat('#faf6ee', 0.6))
    mergeAndAddMesh(crimsonPetalGeoms, this.c.mat('#d35670', 0.6))
    mergeAndAddMesh(flowerHeartGeoms, this.c.mat('#e8c35c', 0.5))
    mergeAndAddMesh(budConeGeoms, this.c.mat('#ea91a3', 0.6))
    mergeAndAddMesh(budBaseGeoms, this.c.mat(PAL.lotusPad, 0.7))
    mergeAndAddMesh(podBodyGeoms, this.c.mat('#728a42', 0.6))
    mergeAndAddMesh(podTopGeoms, this.c.mat('#a4a046', 0.5))

    if (stemGeoms.length > 0) {
      const mergedStems = BufferGeometryUtils.mergeGeometries(stemGeoms, false)
      for (const sg of stemGeoms) sg.dispose()
      const stemMesh = new THREE.Mesh(mergedStems, this.c.mat('#446b38', 0.8))
      this.c.scene.add(stemMesh)
    }
  }

  /**
   * Traditional Octagonal Gold Furnace (八角祈福金亭 / 金爐):
   * 位於前庭西側外緣，供信眾焚化祈福金銀紙、添香油錢祈福。
   * 具有八角石基、八角紅磚金亭身、金爐口火焰輝光與八角雙簷金亭頂、寶葫蘆頂珠。
   */
  private addGoldFurnace(): void {
    const { x, z } = GOLD_FURNACE
    const stone = this.c.mat('#8d8070', 0.95)
    const vermilion = this.c.mat('#8c2d22', 0.78)
    const gold = this.c.mat(PAL.gold, 0.45, 0.3)
    const darkBronze = this.c.mat('#433228', 0.6)

    const g = new THREE.Group()
    g.position.set(x, 0, z)

    // 1. Octagonal Stone Base (八角雕花石台基)
    const base1 = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.1, 0.35, 8), stone)
    base1.position.y = 0.175
    const base2 = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.85, 0.3, 8), stone)
    base2.position.y = 0.5
    g.add(base1, base2)

    // 2. Octagonal Furnace Chamber (八角朱漆金亭爐身)
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.55, 2.0, 8), vermilion)
    body.position.y = 1.65
    g.add(body)

    // 3. Arched Furnace Mouth with Fiery Embers (金爐投口與爐內熊熊烈火)
    for (const angle of [0, Math.PI / 2]) {
      const mouthFrame = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.85, 0.18), darkBronze)
      mouthFrame.rotation.y = angle
      mouthFrame.position.set(Math.sin(angle) * 1.42, 1.35, Math.cos(angle) * 1.42)
      g.add(mouthFrame)
    }

    const fireGlowMat = new THREE.MeshBasicMaterial({ color: '#ff6611' })
    const fireMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.65), fireGlowMat)
    fireMesh.position.set(0, 1.35, 1.44)
    g.add(fireMesh)

    // Furnace Plaque: 「八 角 金 亭」
    const furnacePlaque = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 0.36),
      this.c.text('八 角 金 亭', '#f2d288', '#2d180f')
    )
    furnacePlaque.position.set(0, 2.38, 1.42)
    g.add(furnacePlaque)

    // 4. Double-Tier Octagonal Roof (八角重簷歇山瓦頂)
    const lowerRoof = new THREE.Mesh(new THREE.ConeGeometry(2.1, 0.75, 8), this.c.mat(PAL.wallCap, 0.75))
    lowerRoof.position.y = 3.0
    const upperRoof = new THREE.Mesh(new THREE.ConeGeometry(1.45, 0.65, 8), this.c.mat(PAL.wallCap, 0.75))
    upperRoof.position.y = 3.65
    g.add(lowerRoof, upperRoof)

    // Golden Gourd Finial (寶頂金葫蘆)
    const gourd1 = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), gold)
    gourd1.position.y = 4.15
    const gourd2 = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), gold)
    gourd2.position.y = 4.45
    g.add(gourd1, gourd2)

    // Internal Fire Light
    const fireLight = new THREE.PointLight('#ff7722', 0.85, 6, 2)
    fireLight.position.set(0, 1.4, 1.2)
    g.add(fireLight)

    this.add(g, true)
    this.c.physics.addStaticCylinder(new THREE.Vector3(x, 1.5, z), 1.8, 3.0)
  }

  private addPlantingShrubs(): void {
    // 1. 原神風格景觀步道植栽與雕花石燈台（沿主要參道兩側對稱排列）- 靈栽幾何全面合批 (Batched)
    const potGeoms: THREE.BufferGeometry[] = []
    const goldRimGeoms: THREE.BufferGeometry[] = []
    const soilGeoms: THREE.BufferGeometry[] = []
    const trunkGeoms: THREE.BufferGeometry[] = []
    const puff1Geoms: THREE.BufferGeometry[] = []
    const puff2Geoms: THREE.BufferGeometry[] = []
    const puffTopGeoms: THREE.BufferGeometry[] = []
    const flowerGeoms: THREE.BufferGeometry[] = []

    const basePot = new THREE.CylinderGeometry(0.44, 0.32, 0.36, 6)
    const baseRim = new THREE.CylinderGeometry(0.46, 0.44, 0.06, 6)
    const baseSoil = new THREE.CylinderGeometry(0.4, 0.38, 0.05, 6)
    const baseTrunk = new THREE.CylinderGeometry(0.06, 0.09, 0.45, 6)
    const basePuff1 = new THREE.DodecahedronGeometry(0.32, 1)
    const basePuff2 = new THREE.DodecahedronGeometry(0.35, 1)
    const basePuffTop = new THREE.DodecahedronGeometry(0.24, 1)
    const baseFlower = new THREE.DodecahedronGeometry(0.06)

    for (const side of [-1, 1]) {
      for (const z of [14, 24, 34, 44]) {
        const x = side * 3.6
        const pG = basePot.clone(); pG.translate(x, 0.18, z); potGeoms.push(pG)
        const rG = baseRim.clone(); rG.translate(x, 0.35, z); goldRimGeoms.push(rG)
        const sG = baseSoil.clone(); sG.translate(x, 0.36, z); soilGeoms.push(sG)
        const tG = baseTrunk.clone(); tG.rotateZ(-0.18); tG.translate(x + 0.02, 0.54, z); trunkGeoms.push(tG)
        const pf1 = basePuff1.clone(); pf1.scale(1.15, 0.75, 1.1); pf1.translate(x - 0.12, 0.72, z + 0.06); puff1Geoms.push(pf1)
        const pf2 = basePuff2.clone(); pf2.scale(1.2, 0.8, 1.15); pf2.translate(x + 0.1, 0.82, z - 0.05); puff2Geoms.push(pf2)
        const pfT = basePuffTop.clone(); pfT.translate(x + 0.02, 1.02, z + 0.02); puffTopGeoms.push(pfT)
        for (const [fx, fy, fz] of [[-0.22, 0.82, 0.18], [0.22, 0.88, 0.14], [0.05, 1.12, -0.1]]) {
          const flG = baseFlower.clone(); flG.translate(x + fx, fy, z + fz); flowerGeoms.push(flG)
        }
        this.c.physics.addStaticCylinder(new THREE.Vector3(x, 0.5, z), 0.45, 1.0)
      }
      for (const z of [19, 39]) this.stoneLantern(side * 3.6, z)
    }

    basePot.dispose(); baseRim.dispose(); baseSoil.dispose(); baseTrunk.dispose()
    basePuff1.dispose(); basePuff2.dispose(); basePuffTop.dispose(); baseFlower.dispose()

    const mPot = new THREE.Mesh(BufferGeometryUtils.mergeGeometries(potGeoms, false), this.c.mat('#e3ede6', 0.35, 0.15))
    const mRim = new THREE.Mesh(BufferGeometryUtils.mergeGeometries(goldRimGeoms, false), this.c.mat(PAL.gold, 0.4, 0.3))
    const mSoil = new THREE.Mesh(BufferGeometryUtils.mergeGeometries(soilGeoms, false), this.c.mat('#38281a', 0.95))
    const mTrunk = new THREE.Mesh(BufferGeometryUtils.mergeGeometries(trunkGeoms, false), this.c.mat('#4e3422', 0.85))
    const mPuff1 = new THREE.Mesh(BufferGeometryUtils.mergeGeometries(puff1Geoms, false), this.c.mat('#2d7348', 0.6))
    const mPuff2 = new THREE.Mesh(BufferGeometryUtils.mergeGeometries(puff2Geoms, false), this.c.mat('#59b378', 0.55))
    const mPuffTop = new THREE.Mesh(BufferGeometryUtils.mergeGeometries(puffTopGeoms, false), this.c.mat('#8ee0a6', 0.5))

    const flowerMat = this.c.mat('#ffb8cf', 0.4)
    flowerMat.emissive.set('#ff6994')
    flowerMat.emissiveIntensity = 0.5
    const mFlower = new THREE.Mesh(BufferGeometryUtils.mergeGeometries(flowerGeoms, false), flowerMat)

    for (const g of potGeoms) g.dispose()
    for (const g of goldRimGeoms) g.dispose()
    for (const g of soilGeoms) g.dispose()
    for (const g of trunkGeoms) g.dispose()
    for (const g of puff1Geoms) g.dispose()
    for (const g of puff2Geoms) g.dispose()
    for (const g of puffTopGeoms) g.dispose()
    for (const g of flowerGeoms) g.dispose()

    const shrubGroup = new THREE.Group()
    shrubGroup.add(mPot, mRim, mSoil, mTrunk, mPuff1, mPuff2, mPuffTop, mFlower)
    this.add(shrubGroup, false)
  }

  private addPlantingCourtyard(): void {
    // 前庭與外圍景觀神木群（全面升級為原神動漫仙境風格）
    let treeSeed = 10
    for (const [x, z] of [
      [-24, 44], [24, 44],
      [-24, 18], [24, 22],
      [-17, 8], [17, 8],
      [-17, 28], [18, 36],
      [-12, 48], [12, 48]
    ] as const) {
      this.genshinTree(x, z, treeSeed++)
    }

    for (const [x, z, a] of [[-6.4, 18, 0], [6.4, 18, 0], [-19, 36, Math.PI / 2], [19, 30, Math.PI / 2]] as const) this.bench(x, z, a)
  }

  private addPlanting(): void {
    this.addPlantingShrubs()
    this.addPlantingCourtyard()
  }

  /**
   * 原神璃月風格玉京台雕花石燈台（Genshin Impact Liyue Sculpted Stone Garden Lantern）
   * 1. 多階六角蓮華雕刻石基座（青石基座＋仰覆蓮瓣承座）
   * 2. 圓潤束腰雕花中柱
   * 3. 六角鏤空石窗火袋＋透光暖紙窗＋內置金焰靈心
   * 4. 飛簷翹角六角石頂（笠石）＋頂部葫蘆寶珠石雕
   * 5. 灑落步道溫暖金黃神光
   */
  private stoneLantern(x: number, z: number): void {
    const stone = this.c.mat('#a29a88', 0.9)
    const darkStone = this.c.mat('#6b655a', 0.85)
    const goldAcc = this.c.mat(PAL.gold, 0.45, 0.25)
    const g = new THREE.Group()
    g.position.set(x, 0, z)

    // Merge stone parts: base2, shaft1, shaft2, midTray, roof
    const stoneGeoms: THREE.BufferGeometry[] = []
    const b2 = new THREE.CylinderGeometry(0.38, 0.45, 0.22, 6); b2.translate(0, 0.25, 0); stoneGeoms.push(b2)
    const s1 = new THREE.CylinderGeometry(0.16, 0.22, 0.5, 6); s1.translate(0, 0.6, 0); stoneGeoms.push(s1)
    const s2 = new THREE.CylinderGeometry(0.18, 0.22, 0.35, 6); s2.translate(0, 1.12, 0); stoneGeoms.push(s2)
    const tray = new THREE.CylinderGeometry(0.48, 0.32, 0.14, 6); tray.translate(0, 1.34, 0); stoneGeoms.push(tray)
    const roof = new THREE.CylinderGeometry(0.16, 0.62, 0.26, 6); roof.translate(0, 1.92, 0); stoneGeoms.push(roof)
    const mergedStone = BufferGeometryUtils.mergeGeometries(stoneGeoms, false)
    for (const bg of stoneGeoms) bg.dispose()
    g.add(new THREE.Mesh(mergedStone, stone))

    // Merge darkStone parts: base1, shaftRing, 6 window posts
    const darkGeoms: THREE.BufferGeometry[] = []
    const b1 = new THREE.CylinderGeometry(0.48, 0.54, 0.16, 6); b1.translate(0, 0.08, 0); darkGeoms.push(b1)
    const sRing = new THREE.CylinderGeometry(0.24, 0.18, 0.14, 6); sRing.translate(0, 0.9, 0); darkGeoms.push(sRing)
    const basePost = new THREE.CylinderGeometry(0.038, 0.038, 0.4, 4)
    for (let i = 0; i < 6; i++) {
      const ang = (i * Math.PI) / 3
      const postG = basePost.clone()
      postG.translate(Math.cos(ang) * 0.35, 1.6, Math.sin(ang) * 0.35)
      darkGeoms.push(postG)
    }
    basePost.dispose()
    const mergedDark = BufferGeometryUtils.mergeGeometries(darkGeoms, false)
    for (const dg of darkGeoms) dg.dispose()
    g.add(new THREE.Mesh(mergedDark, darkStone))

    // Window core
    const lightMat = this.c.mat('#ffea9f', 0.35)
    lightMat.emissive.set('#ffa338')
    lightMat.emissiveIntensity = 0.85
    this.lanternMats.push(lightMat)
    const windowCore = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.38, 6), lightMat)
    windowCore.position.y = 1.6
    g.add(windowCore)

    // Flame
    const flameMat = this.c.mat('#ffffff', 0.1)
    flameMat.emissive.set('#ff8a00')
    flameMat.emissiveIntensity = 1.6
    const flame = new THREE.Mesh(new THREE.DodecahedronGeometry(0.12), flameMat)
    flame.position.y = 1.6
    g.add(flame)

    // Finial
    const finial = new THREE.Mesh(new THREE.DodecahedronGeometry(0.11), goldAcc)
    finial.position.y = 2.13
    g.add(finial)

    // PointLight
    const groundLight = new THREE.PointLight('#ffc060', 1.45, 10.5, 1.8)
    groundLight.position.y = 1.6
    g.add(groundLight)
    if (x < -25) {
      this.trailLanternLights.push(groundLight)
      groundLight.visible = false
    }

    this.add(g, false)
    this.c.physics.addStaticCylinder(new THREE.Vector3(x, 0.9, z), 0.48, 1.8)
  }

  /**
   * 原神風格唯美仙境神木（Genshin Impact Anime Cel-shaded Stylized Tree）
   * 1. 遒勁自然曲折的動漫風樹幹與自然地景盤根（捨棄生硬幾何花盆與底座）
   * 2. 多層次雲團簇狀蓬鬆樹冠（璃月金秋銀杏／稻妻緋櫻仙木／璃月翡翠仙松）
   * 3. 唯美下垂枝葉飄帶與仙氣微光氛圍
   */
  private genshinTree(x: number, z: number, seed: number): void {
    const tree = new THREE.Group()
    tree.position.set(x, 0, z)

    // 隨機角度與微幅姿態變異
    const rotY = (seed * 1.37) % (Math.PI * 2)
    tree.rotation.y = rotY

    // 微幅體積尺度自然隨機性
    const s = 0.92 + ((seed * 7) % 5) * 0.05
    tree.scale.set(s, s, s)

    // 1. 自然草苔地景盤根（Natural Mossy Root Base）
    const mossMat = this.c.mat('#445b3d', 0.9)
    const rootBase = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.1, 0.16, 8), mossMat)
    rootBase.position.y = 0.08
    tree.add(rootBase)

    // 伴生自然青石（Stylized accent moss stone）
    const stoneMat = this.c.mat('#7d7568', 0.88)
    const stone1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 0), stoneMat)
    stone1.position.set(0.65, 0.15, 0.4)
    stone1.scale.set(1.2, 0.6, 0.9)
    tree.add(stone1)

    // 2. 遒勁自然多段曲折樹幹（Graceful Curved Anime Trunk）- Merged into 1 geometry
    const barkMat = this.c.mat('#553723', 0.85)
    const trunkGeoms: THREE.BufferGeometry[] = []

    const t1 = new THREE.CylinderGeometry(0.26, 0.38, 1.3, 8)
    t1.rotateZ(0.08)
    t1.translate(0, 0.68, 0)
    trunkGeoms.push(t1)

    const t2 = new THREE.CylinderGeometry(0.2, 0.26, 1.2, 8)
    t2.rotateZ(-0.14)
    t2.rotateX(0.06)
    t2.translate(0.08, 1.75, 0.04)
    trunkGeoms.push(t2)

    const bA = new THREE.CylinderGeometry(0.12, 0.18, 1.1, 7)
    bA.rotateZ(0.65)
    bA.rotateX(-0.15)
    bA.translate(-0.35, 2.45, 0.12)
    trunkGeoms.push(bA)

    const bB = new THREE.CylinderGeometry(0.11, 0.17, 1.2, 7)
    bB.rotateZ(-0.5)
    bB.rotateX(0.18)
    bB.translate(0.32, 2.55, -0.1)
    trunkGeoms.push(bB)

    const mergedTrunk = BufferGeometryUtils.mergeGeometries(trunkGeoms, false)
    for (const tg of trunkGeoms) tg.dispose()
    const trunkMesh = new THREE.Mesh(mergedTrunk, barkMat)
    trunkMesh.castShadow = true
    tree.add(trunkMesh)

    // 3. 原神風格雲團簇狀蓬鬆樹冠（Anime Cel-shaded Cloud Foliage Clumps）
    const type = seed % 3
    let colDeep: string, colMid: string, colHigh: string, colBright: string
    let emDeep: string, emMid: string, emHigh: string, emBright: string

    if (type === 0) {
      colDeep = '#b06500'; colMid = '#e59500'; colHigh = '#f7c844'; colBright = '#ffe680'
      emDeep = '#452200'; emMid = '#552f00'; emHigh = '#663c00'; emBright = '#805500'
    } else if (type === 1) {
      colDeep = '#75243e'; colMid = '#ba3d62'; colHigh = '#f27c9e'; colBright = '#fed2df'
      emDeep = '#3d0d1b'; emMid = '#5c192d'; emHigh = '#78263d'; emBright = '#943851'
    } else {
      colDeep = '#18452c'; colMid = '#337b4f'; colHigh = '#5db777'; colBright = '#96e0a9'
      emDeep = '#0a2113'; emMid = '#12331f'; emHigh = '#1a482b'; emBright = '#225d37'
    }

    const matDeep = this.c.mat(colDeep, 0.6)
    matDeep.emissive.set(emDeep)
    matDeep.emissiveIntensity = 0.2

    const matMid = this.c.mat(colMid, 0.55)
    matMid.emissive.set(emMid)
    matMid.emissiveIntensity = 0.22

    const matHigh = this.c.mat(colHigh, 0.5)
    matHigh.emissive.set(emHigh)
    matHigh.emissiveIntensity = 0.25

    const matBright = this.c.mat(colBright, 0.45)
    matBright.emissive.set(emBright)
    matBright.emissiveIntensity = 0.28

    const clusters: { pos: [number, number, number]; scale: [number, number, number]; mat: THREE.Material }[] = [
      { pos: [-0.6, 2.5, 0.2], scale: [0.95, 0.65, 0.95], mat: matDeep },
      { pos: [0.55, 2.6, -0.2], scale: [1.0, 0.68, 1.0], mat: matDeep },
      { pos: [-0.75, 3.1, 0.15], scale: [1.3, 0.82, 1.25], mat: matMid },
      { pos: [0.7, 3.25, -0.1], scale: [1.35, 0.85, 1.3], mat: matMid },
      { pos: [0.0, 3.2, 0.5], scale: [1.1, 0.75, 1.15], mat: matMid },
      { pos: [0.08, 3.8, 0.0], scale: [1.45, 0.95, 1.45], mat: matHigh },
      { pos: [0.12, 4.35, -0.05], scale: [1.0, 0.72, 1.0], mat: matBright },
    ]

    for (const c of clusters) {
      const geo = new THREE.DodecahedronGeometry(1.0, 1)
      const puff = new THREE.Mesh(geo, c.mat)
      puff.position.set(...c.pos)
      puff.scale.set(...c.scale)
      puff.castShadow = false
      puff.receiveShadow = true
      tree.add(puff)
    }

    // 4. 飄逸下垂柔美枝梢葉團（Drooping anime foliage accents）- Merged
    const dropGeoms: THREE.BufferGeometry[] = []
    const baseDrop = new THREE.ConeGeometry(0.26, 0.65, 5)
    baseDrop.rotateX(Math.PI)
    baseDrop.scale(1.0, 1.0, 0.6)

    for (const [dx, dy, dz] of [[-1.2, 2.6, 0.3], [1.1, 2.7, -0.3], [-0.2, 2.8, 0.9], [0.3, 2.7, -0.9]]) {
      const dg = baseDrop.clone()
      dg.translate(dx, dy, dz)
      dropGeoms.push(dg)
    }
    baseDrop.dispose()
    const mergedDrops = BufferGeometryUtils.mergeGeometries(dropGeoms, false)
    for (const dg of dropGeoms) dg.dispose()
    tree.add(new THREE.Mesh(mergedDrops, matMid))

    this.add(tree, false)
    this.c.physics.addStaticCylinder(new THREE.Vector3(x, 1.5, z), 0.45, 3.0)
  }

  private bench(x: number, z: number, angle: number): void {
    const stone = this.c.mat('#a9a08e', 0.93)
    const g = new THREE.Group()
    g.position.set(x, 0, z)
    g.rotation.y = angle
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.14, 0.55), stone)
    seat.position.y = 0.46
    g.add(seat)
    for (const dx of [-0.7, 0.7]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.4, 0.45), stone)
      leg.position.set(dx, 0.2, 0)
      g.add(leg)
    }
    this.add(g)
    this.c.physics.addStaticBox(new THREE.Vector3(x, 0.3, z), new THREE.Vector3(1.9, 0.6, 0.55), angle ? rotY(angle) : undefined)
  }

  /**
   * 朝聖林蔭小徑與昇龍觀音漢白玉八角大平台：
   * 1. 西側月亮門／聖境牌坊（【昇龍聖境】石牌坊，帶琉璃飛簷與朱漆門柱、抱鼓石）
   * 2. 朝聖石板小徑（寬 4.2m、長約 24.4m，以正常移速約步行 5 秒，鋪設青石板與路緣石，配備實體地面碰撞）
   * 3. 小徑兩側雙排鬱鬱青松（10 株茂密松柏樹）與古樸石燈籠（夜間柔和暖光）
   * 4. 昇龍觀音漢白玉八角大平台（半徑 14m，雙層須彌台基、漢白玉雕花欄杆、蓮花望柱、四方天燈塔、御路丹陛石踏步）
   */
  private addSacredTrailEssential(): void {
    const gateX = -(SITE.halfX - 0.4) // -29.6
    const gateZ = 31.0
    const gold = this.c.mat(PAL.gold, 0.45, 0.28)
    const vermilion = this.c.mat(PAL.red, 0.76)
    const marble = this.c.mat('#dfd8cc', 0.9)
    const paving = this.c.mat(PAL.paving, 0.94)

    // 1. 西側月亮門牌坊本體結構與立柱碰撞
    for (const dz of [-2.2, 2.2]) {
      const pz = gateZ + dz
      this.pillar(gateX, pz, 4.8, 0.32, true)
      const drumBase = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.4, 0.8), this.c.mat('#9c9180', 0.95))
      drumBase.position.set(gateX, 0.2, pz)
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 16), this.c.mat('#aba08f', 0.9))
      drum.rotation.z = Math.PI / 2
      drum.position.set(gateX, 0.48, pz)
      this.add(drumBase)
      this.add(drum)
    }
    this.box(0.7, 0.55, 4.8, vermilion, gateX, 4.3, gateZ)
    this.box(0.85, 0.2, 4.95, gold, gateX, 4.0, gateZ)
    const archRoof = this.c.roof(2.4, 5.5, 4.55, 5.65)
    archRoof.position.set(gateX, 0, gateZ)
    this.add(archRoof, true)

    // 2. 朝聖石板小徑實體地面物理碰撞（厚度 0.8m，頂面 y = -0.02）
    const trailStartX = gateX // -29.6
    const trailEndX = -54.0
    const trailLen = trailStartX - trailEndX // 24.4
    const trailMidX = (trailStartX + trailEndX) / 2 // -41.8
    const trailW = 4.2
    this.box(trailLen, 0.8, trailW, paving, trailMidX, -0.42, gateZ, true)

    // 3. 昇龍觀音漢白玉八角大平台主體實體物理碰撞與階梯碰撞
    const platX = -68.0
    const platZ = 31.0
    const platR = 14.0
    const platTop = 0.545
    const floorH = 1.0
    const floorCenterY = platTop - floorH / 2
    this.c.physics.addStaticCylinder(new THREE.Vector3(platX, floorCenterY, platZ), platR, floorH)
    this.c.physics.addStaticBox(new THREE.Vector3(-53.7, 0.18 - floorH / 2, platZ), new THREE.Vector3(1.6, floorH, 4.8))
    this.c.physics.addStaticBox(new THREE.Vector3(-54.7, 0.36 - floorH / 2, platZ), new THREE.Vector3(1.4, floorH, 4.8))

    // 平台主體基座
    this.platGroup = new THREE.Group()
    this.platGroup.position.set(platX, 0, platZ)

    const baseTier1 = new THREE.Mesh(new THREE.CylinderGeometry(platR, platR + 0.4, 0.35, 32), marble)
    baseTier1.position.y = 0.175
    baseTier1.castShadow = true
    baseTier1.receiveShadow = true
    this.platGroup.add(baseTier1)

    const baseTier2 = new THREE.Mesh(new THREE.CylinderGeometry(platR - 0.4, platR - 0.2, 0.25, 32), this.c.mat('#eee8dc', 0.94))
    baseTier2.position.y = 0.42
    baseTier2.castShadow = true
    baseTier2.receiveShadow = true
    this.platGroup.add(baseTier2)

    this.add(this.platGroup)
  }

  private addSacredTrailDecor(): void {
    const gateX = -(SITE.halfX - 0.4) // -29.6
    const gateZ = 31.0
    const stone = this.c.mat('#8e8474', 0.92)

    // 牌匾與宮燈
    const plaqueEast = new THREE.Mesh(
      new THREE.PlaneGeometry(2.8, 0.65),
      this.c.text('昇 龍 聖 境', '#f4d588', '#2e1910')
    )
    plaqueEast.rotation.y = Math.PI / 2
    plaqueEast.position.set(gateX + 0.38, 4.3, gateZ)
    this.c.scene.add(plaqueEast)

    const plaqueWest = new THREE.Mesh(
      new THREE.PlaneGeometry(2.8, 0.65),
      this.c.text('紫 氣 東 來', '#f4d588', '#2e1910')
    )
    plaqueWest.rotation.y = -Math.PI / 2
    plaqueWest.position.set(gateX - 0.38, 4.3, gateZ)
    this.c.scene.add(plaqueWest)

    for (const dz of [-1.5, 1.5]) {
      this.lantern(gateX, 3.85, gateZ + dz, 0.32)
    }

    // 小徑路面與花崗岩路緣石
    const trailStartX = gateX
    const trailEndX = -54.0
    const trailLen = trailStartX - trailEndX
    const trailMidX = (trailStartX + trailEndX) / 2

    const roadSurface = new THREE.Mesh(new THREE.BoxGeometry(trailLen, 0.04, 3.2), this.c.mat(PAL.road, 0.92))
    roadSurface.position.set(trailMidX, 0.02, gateZ)
    roadSurface.receiveShadow = true
    this.c.scene.add(roadSurface)

    for (const side of [-1, 1]) {
      const curbZ = gateZ + side * 1.85
      const curb = new THREE.Mesh(new THREE.BoxGeometry(trailLen, 0.1, 0.26), stone)
      curb.position.set(trailMidX, 0.05, curbZ)
      curb.receiveShadow = true
      this.c.scene.add(curb)
    }

    const lineMat = this.c.mat(PAL.roadLine, 0.88)
    const stripBox = new THREE.BoxGeometry(0.18, 0.025, 3.1)
    const stripGeoms: THREE.BufferGeometry[] = []
    for (let x = trailStartX - 2.0; x > trailEndX + 1.0; x -= 2.6) {
      const g = stripBox.clone()
      g.translate(x, 0.045, gateZ)
      stripGeoms.push(g)
    }
    stripBox.dispose()
    if (stripGeoms.length > 0) {
      const mergedStrips = BufferGeometryUtils.mergeGeometries(stripGeoms, false)
      for (const g of stripGeoms) g.dispose()
      const stripMesh = new THREE.Mesh(mergedStrips, lineMat)
      this.c.scene.add(stripMesh)
    }

    // 小徑兩側神木與石燈籠
    let treeSeed = 1
    for (const x of [-33.5, -38.5, -43.5, -48.5, -53.0]) {
      this.genshinTree(x, gateZ + 3.6, treeSeed++)
      this.genshinTree(x, gateZ - 3.6, treeSeed++)
    }
    for (const x of [-36.0, -46.0]) {
      this.stoneLantern(x, gateZ + 2.5)
      this.stoneLantern(x, gateZ - 2.5)
    }
  }

  private addSacredPlatformDecor(): void {
    if (!this.platGroup) return
    const platX = -68.0
    const platZ = 31.0
    const platR = 14.0
    const gold = this.c.mat(PAL.gold, 0.45, 0.28)
    const marble = this.c.mat('#dfd8cc', 0.9)
    const stone = this.c.mat('#8e8474', 0.92)

    // 朝聖階梯與丹陛雕石
    const stepsGroup = new THREE.Group()
    stepsGroup.position.set(platR - 0.3, 0, 0)
    const step1 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.18, 4.6), stone)
    step1.position.set(0.6, 0.09, 0)
    const step2 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.18, 4.6), marble)
    step2.position.set(-0.2, 0.27, 0)
    const danbi = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 1.8), gold)
    danbi.position.set(0.2, 0.28, 0)
    danbi.rotation.z = -0.1
    stepsGroup.add(step1, step2, danbi)
    this.platGroup.add(stepsGroup)

    // 外環漢白玉雕花欄杆與蓮花望柱
    const postCount = 28
    const marbleRailGeoms: THREE.BufferGeometry[] = []
    const budGeoms: THREE.BufferGeometry[] = []

    const boxPostGeo = new THREE.BoxGeometry(0.24, 0.75, 0.24)
    const sphereBudGeo = new THREE.SphereGeometry(0.12, 10, 8)
    const boxPanelGeo = new THREE.BoxGeometry(2.6, 0.42, 0.1)

    for (let i = 0; i < postCount; i++) {
      const a = (i / postCount) * Math.PI * 2
      if (Math.abs(a) < 0.28 || Math.abs(a - Math.PI * 2) < 0.28) continue
      const px = Math.cos(a) * (platR - 0.6)
      const pz = Math.sin(a) * (platR - 0.6)

      const pG = boxPostGeo.clone()
      pG.translate(px, 0.85, pz)
      marbleRailGeoms.push(pG)

      const bG = sphereBudGeo.clone()
      bG.translate(px, 1.28, pz)
      budGeoms.push(bG)

      const panG = boxPanelGeo.clone()
      panG.rotateY(a + Math.PI / 2)
      panG.translate(px, 0.75, pz)
      marbleRailGeoms.push(panG)

      this.c.physics.addStaticBox(new THREE.Vector3(platX + px, 0.545 + 0.45, platZ + pz), new THREE.Vector3(0.24, 0.9, 2.7), rotY(a + Math.PI / 2))
    }
    boxPostGeo.dispose()
    sphereBudGeo.dispose()
    boxPanelGeo.dispose()

    if (marbleRailGeoms.length > 0) {
      const mergedMarble = BufferGeometryUtils.mergeGeometries(marbleRailGeoms, false)
      for (const mg of marbleRailGeoms) mg.dispose()
      this.platGroup.add(new THREE.Mesh(mergedMarble, marble))
    }
    if (budGeoms.length > 0) {
      const mergedBud = BufferGeometryUtils.mergeGeometries(budGeoms, false)
      for (const bg of budGeoms) bg.dispose()
      this.platGroup.add(new THREE.Mesh(mergedBud, this.c.mat('#faf6ee', 0.8)))
    }

    // 四方通天金頂石燈樓
    for (const [dx, dz] of [[-8.8, -8.8], [-8.8, 8.8], [7.5, -8.8], [7.5, 8.8]]) {
      const lampTower = new THREE.Group()
      lampTower.position.set(dx, 0.54, dz)

      const lampBase1 = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.92, 0.22, 8), stone)
      lampBase1.position.y = 0.11
      const lampBase2 = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.74, 0.26, 8), stone)
      lampBase2.position.y = 0.35
      const lampPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, 1.5, 8), stone)
      lampPillar.position.y = 1.23
      const lampTray = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.42, 0.16, 8), stone)
      lampTray.position.y = 2.06

      const lampCoreMat = this.c.mat('#ffe48a', 0.3)
      lampCoreMat.emissive.set('#ff9e28')
      lampCoreMat.emissiveIntensity = 0.95
      this.lanternMats.push(lampCoreMat)
      const lampCore = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.58, 8), lampCoreMat)
      lampCore.position.y = 2.43

      for (let i = 0; i < 8; i++) {
        const ang = (i * Math.PI) / 4
        const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.62, 4), stone)
        strut.position.set(Math.cos(ang) * 0.48, 2.43, Math.sin(ang) * 0.48)
        lampTower.add(strut)
      }

      const lampRoof = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.88, 0.32, 8), this.c.mat(PAL.wallCap, 0.75))
      lampRoof.position.y = 2.88
      const lampGourd = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), gold)
      lampGourd.position.y = 3.16
      const lampSpire = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.26, 8), gold)
      lampSpire.position.y = 3.36

      const lampLight = new THREE.PointLight('#ffda7a', 1.2, 14, 1.8)
      lampLight.position.set(0, 2.45, 0)
      this.sacredPlatformLights.push(lampLight)
      lampLight.visible = false

      lampTower.add(lampBase1, lampBase2, lampPillar, lampTray, lampCore, lampRoof, lampGourd, lampSpire, lampLight)
      this.platGroup.add(lampTower)

      this.c.physics.addStaticCylinder(new THREE.Vector3(platX + dx, 1.5, platZ + dz), 0.7, 3.2)
    }
  }

  private addSacredTrailAndPlatform(): void {
    this.addSacredTrailEssential()
    this.addSacredTrailDecor()
    this.addSacredPlatformDecor()
  }

  private skyLanternTexture(frontText: string, backText: string): THREE.CanvasTexture {
    const cv = document.createElement('canvas')
    cv.width = 512
    cv.height = 512
    const ctx = cv.getContext('2d')!

    // Auspicious glowing gradient for Chinese sky lantern envelope
    const grad = ctx.createLinearGradient(0, 0, 0, 512)
    grad.addColorStop(0, '#e54326')   // Auspicious cinnabar red at top
    grad.addColorStop(0.3, '#ff7d38')  // Vibrant glowing warm coral
    grad.addColorStop(0.7, '#ffad54')  // Radiant amber
    grad.addColorStop(1, '#ffc778')    // Bright golden rice paper base
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 512, 512)

    // Paper fiber texture / subtle noise
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
    for (let i = 0; i < 300; i++) {
      const rx = Math.random() * 512
      const ry = Math.random() * 512
      ctx.fillRect(rx, ry, Math.random() * 4 + 1, 2)
    }

    // Golden border frames for each of the 4 quadrants
    ctx.strokeStyle = 'rgba(255, 235, 160, 0.65)'
    ctx.lineWidth = 3
    for (let k = 0; k < 4; k++) {
      const x0 = k * 128 + 6
      ctx.strokeRect(x0, 24, 116, 464)
    }

    // Draw 4 vertical calligraphy columns
    const texts = [frontText, '風調雨順', backText, '國泰民安']
    ctx.fillStyle = '#3a1005'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = 'bold 34px "Noto Serif TC", "KaiTi", "Songti TC", "PingFang TC", serif'

    texts.forEach((txt, col) => {
      const cx = col * 128 + 64
      const chars = txt.split('')
      const startY = 256 - (chars.length - 1) * 36
      chars.forEach((char, idx) => {
        ctx.fillText(char, cx, startY + idx * 72)
      })
    })

    const tex = new THREE.CanvasTexture(cv)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.ClampToEdgeWrapping
    return tex
  }

  private radialGlowTexture(): THREE.CanvasTexture {
    const cv = document.createElement('canvas')
    cv.width = 128
    cv.height = 128
    const ctx = cv.getContext('2d')!
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
    grad.addColorStop(0, 'rgba(255, 165, 60, 0.95)')
    grad.addColorStop(0.35, 'rgba(255, 120, 30, 0.6)')
    grad.addColorStop(0.7, 'rgba(220, 70, 15, 0.2)')
    grad.addColorStop(1, 'rgba(200, 50, 10, 0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 128, 128)
    const tex = new THREE.CanvasTexture(cv)
    return tex
  }

  private createSkyLanternModel(frontText: string, backText: string): {
    group: THREE.Group
    paperMesh: THREE.Mesh
    paperMat: THREE.MeshStandardMaterial
    flameMesh: THREE.Mesh
    pointLight: THREE.PointLight
  } {
    const group = new THREE.Group()
    group.scale.setScalar(SKY_LANTERN_SCALE)

    // 1. Eight-sided octagonal envelope
    const geom = new THREE.CylinderGeometry(0.32, 0.22, 0.74, 8, 1, false)
    const tex = this.skyLanternTexture(frontText, backText)
    const paperMat = new THREE.MeshStandardMaterial({
      map: tex,
      emissive: '#ff7324',
      emissiveMap: tex,
      emissiveIntensity: 0.35,
      roughness: 0.88,
      metalness: 0.02,
      side: THREE.DoubleSide,
    })
    const paperMesh = new THREE.Mesh(geom, paperMat)
    paperMesh.castShadow = false
    group.add(paperMesh)

    // 2. Domed roof cap with golden pinnacle bead
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.32, 0.12, 8), this.c.mat('#b83a2a', 0.82))
    cap.position.y = 0.42
    const goldFinial = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), this.c.mat(PAL.gold, 0.4, 0.3))
    goldFinial.position.y = 0.50
    group.add(cap, goldFinial)

    // 3. Bamboo base ring & cross-wire brace
    const bambooMat = this.c.mat('#68472c', 0.8)
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.016, 6, 16), bambooMat)
    rim.rotation.x = Math.PI / 2
    rim.position.y = -0.37
    const wire1 = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.44, 4), bambooMat)
    wire1.rotation.z = Math.PI / 2
    wire1.position.y = -0.37
    const wire2 = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.44, 4), bambooMat)
    wire2.rotation.x = Math.PI / 2
    wire2.position.y = -0.37
    group.add(rim, wire1, wire2)

    // 4. Central fuel cake & glowing flame
    const fuel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.025, 8), this.c.mat('#e2d3be', 0.8))
    fuel.position.y = -0.35
    const flameMat = new THREE.MeshBasicMaterial({ color: '#fffb9e' })
    const flameMesh = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.15, 8), flameMat)
    flameMesh.position.y = -0.28
    group.add(fuel, flameMesh)

    // 5. Dynamic PointLight inside the lantern
    const pointLight = new THREE.PointLight('#ff9436', 0.2, 8.5, 2.0)
    pointLight.position.set(0, -0.15, 0)
    group.add(pointLight)

    return { group, paperMesh, paperMat, flameMesh, pointLight }
  }

  private createCourtyardChibi(spec: {
    x: number
    z: number
    heading: number
    robe: string
    sash: string
    hair: string
    hairStyle: 'bun' | 'braids' | 'topknot'
  }): CourtyardChibiActor {
    const skinMat = this.c.mat('#fde6d4', 0.92, 0.01)
    const robeMat = this.c.mat(spec.robe, 0.92, 0.01)
    const sashMat = this.c.mat(spec.sash, 0.9, 0.01)
    const hairMat = this.c.mat(spec.hair, 0.92, 0.01)
    const shoeMat = this.c.mat('#4b3427', 0.9, 0.01)
    const blushMat = this.c.mat('#fca5a5', 0.95, 0.01)
    const eyeMat = this.c.mat('#241611', 0.8, 0.05)

    const group = new THREE.Group()
    group.position.set(spec.x, 0, spec.z)
    group.rotation.y = spec.heading

    // Standing legs & cute rounded shoes
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.22, 10), sashMat)
      leg.position.set(side * 0.09, 0.11, 0)
      const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.078, 10, 8), shoeMat)
      shoe.scale.set(0.95, 0.8, 1.25)
      shoe.position.set(side * 0.09, 0.06, 0.03)
      group.add(leg, shoe)
    }

    // Torso
    const torso = new THREE.Group()
    torso.position.set(0, 0.22, 0)
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.27, 0.42, 14), robeMat)
    body.position.y = 0.21
    const sashRing = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 6, 16), sashMat)
    sashRing.rotation.x = Math.PI / 2
    sashRing.position.y = 0.18
    torso.add(body, sashRing)

    // Head
    const head = new THREE.Group()
    head.position.set(0, 0.42, 0)
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.20, 14, 12), skinMat)
    face.position.y = 0.16
    head.add(face)

    // Cute blushing cheeks & eyes
    for (const side of [-1, 1]) {
      const blush = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), blushMat)
      blush.position.set(side * 0.11, 0.13, 0.15)
      head.add(blush)

      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), eyeMat)
      eye.scale.set(0.7, 1.1, 0.7)
      eye.position.set(side * 0.065, 0.18, 0.175)
      head.add(eye)
    }

    // Hair & hairstyle
    const hairBase = new THREE.Mesh(new THREE.SphereGeometry(0.212, 14, 12), hairMat)
    hairBase.position.y = 0.17
    head.add(hairBase)

    if (spec.hairStyle === 'bun') {
      for (const side of [-1, 1]) {
        const bun = new THREE.Mesh(new THREE.SphereGeometry(0.082, 10, 8), hairMat)
        bun.position.set(side * 0.14, 0.35, -0.02)
        const ribbon = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.018, 6, 12), sashMat)
        ribbon.rotation.x = Math.PI / 2
        ribbon.position.set(side * 0.14, 0.29, -0.02)
        head.add(bun, ribbon)
      }
    } else if (spec.hairStyle === 'topknot') {
      const topknot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), hairMat)
      topknot.position.set(0, 0.38, -0.02)
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.28, 6), this.c.mat(PAL.gold, 0.4, 0.3))
      pin.rotation.z = Math.PI / 2
      pin.position.set(0, 0.37, -0.02)
      head.add(topknot, pin)
    } else {
      for (const side of [-1, 1]) {
        const braid = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.025, 0.26, 8), hairMat)
        braid.position.set(side * 0.17, 0.10, -0.04)
        braid.rotation.z = side * 0.2
        head.add(braid)
      }
    }
    torso.add(head)

    // Arms and hands
    const arms = new THREE.Group()
    arms.position.set(0, 0.34, 0)
    const hands = new THREE.Group()

    for (const side of [-1, 1]) {
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.095, 0.24, 10), robeMat)
      sleeve.position.set(side * 0.16, 0.02, 0.08)
      sleeve.rotation.set(0.85, 0, -side * 0.45)
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), skinMat)
      hand.position.set(side * 0.08, 0.10, 0.22)
      arms.add(sleeve)
      hands.add(hand)
    }
    arms.add(hands)
    torso.add(arms)
    group.add(torso)

    this.add(group)
    return { group, torso, head, arms, hands }
  }

  private addSkyLanterns(): void {
    const glowTex = this.radialGlowTexture()

    // 1. Group 1: NPC Couple holding lantern at (-15.2, 0, 24.2) beside the pavilion
    {
      const origin = new THREE.Vector3(-15.2, 0, 24.2)
      const model = this.createSkyLanternModel('天心賜福', '所求如願')
      const lanternOriginY = skyLanternMountedY(0.95)
      model.group.position.set(origin.x, lanternOriginY, origin.z)
      this.add(model.group)

      const glowMat = new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0, depthWrite: false })
      const groundGlow = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 5.4), glowMat)
      groundGlow.rotation.x = -Math.PI / 2
      groundGlow.position.set(origin.x, 0.035, origin.z)
      this.c.scene.add(groundGlow)

      const actor1 = this.createCourtyardChibi({
        x: origin.x - 0.42,
        z: origin.z,
        heading: 0.35,
        robe: '#f09d88',
        sash: '#fbf5ec',
        hair: '#3e281e',
        hairStyle: 'bun',
      })
      const actor2 = this.createCourtyardChibi({
        x: origin.x + 0.42,
        z: origin.z,
        heading: -0.35,
        robe: '#7ea894',
        sash: '#486a58',
        hair: '#2a1d17',
        hairStyle: 'topknot',
      })

      this.skyLanternGroups.push({
        id: 'npc-couple',
        originPos: origin,
        lanternGroup: model.group,
        lanternMesh: model.paperMesh,
        paperMat: model.paperMat,
        flameMesh: model.flameMesh,
        pointLight: model.pointLight,
        groundGlow,
        groundGlowMat: glowMat,
        actors: [actor1, actor2],
        state: 'holding',
        timer: 5.0,
        lanternY: lanternOriginY,
        lanternOriginY,
        targetY: 36.0,
        drift: { x: 0.16, z: -0.14 },
      })
    }

    // 2. Group 2: NPC Devotee holding lantern at (-9.8, 0, 23.0) beside the pavilion
    {
      const origin = new THREE.Vector3(-9.8, 0, 23.0)
      const model = this.createSkyLanternModel('萬事如意', '平安喜樂')
      const lanternOriginY = skyLanternMountedY(0.95)
      const lanternY = skyLanternMountedY(6.5)
      model.group.position.set(origin.x, lanternY, origin.z)
      this.add(model.group)

      const glowMat = new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0, depthWrite: false })
      const groundGlow = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 5.2), glowMat)
      groundGlow.rotation.x = -Math.PI / 2
      groundGlow.position.set(origin.x, 0.035, origin.z)
      this.c.scene.add(groundGlow)

      const actor3 = this.createCourtyardChibi({
        x: origin.x,
        z: origin.z - 0.40,
        heading: 0,
        robe: '#f5bf76',
        sash: '#8e3d4d',
        hair: '#2b1b16',
        hairStyle: 'braids',
      })

      this.skyLanternGroups.push({
        id: 'npc-devotee',
        originPos: origin,
        lanternGroup: model.group,
        lanternMesh: model.paperMesh,
        paperMat: model.paperMat,
        flameMesh: model.flameMesh,
        pointLight: model.pointLight,
        groundGlow,
        groundGlowMat: glowMat,
        actors: [actor3],
        state: 'ascending',
        timer: 14.0,
        lanternY,
        lanternOriginY,
        targetY: 36.0,
        drift: { x: 0.12, z: 0.18 },
      })
    }

    // 3. Group 3: Player Interactive Sky Lantern Stand beside pavilion (-12.5, 0, 23.5)
    {
      const origin = this.playerLanternStandPos.clone()

      const standGroup = new THREE.Group()
      standGroup.position.set(origin.x, 0, origin.z)
      standGroup.userData = { skyLantern: true }

      const woodMat = this.c.mat(PAL.wood, 0.8)
      const redMat = this.c.mat(PAL.red, 0.75)
      const goldMat = this.c.mat(PAL.gold, 0.4, 0.3)

      const basePlinth = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.50, 0.16, 8), woodMat)
      basePlinth.position.y = 0.08
      const column = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.22, 0.54, 8), redMat)
      column.position.y = 0.43
      const goldCollar = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.024, 6, 16), goldMat)
      goldCollar.rotation.x = Math.PI / 2
      goldCollar.position.y = 0.43
      const platter = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.42, 0.12, 8), woodMat)
      platter.position.y = 0.74
      const platterRim = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.022, 6, 16), goldMat)
      platterRim.rotation.x = Math.PI / 2
      platterRim.position.y = 0.78
      const cloth = new THREE.Mesh(new THREE.CylinderGeometry(0.40, 0.40, 0.02, 8), redMat)
      cloth.position.y = 0.80

      standGroup.add(basePlinth, column, goldCollar, platter, platterRim, cloth)
      standGroup.traverse(o => { o.userData = { skyLantern: true } })
      this.add(standGroup)
      this.c.physics.addStaticCylinder(new THREE.Vector3(origin.x, 0.4, origin.z), 0.46, 0.82)

      const ringMat = new THREE.MeshBasicMaterial({ color: '#ffb244', transparent: true, opacity: 0.65, depthWrite: false })
      const markerRing = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.035, 6, 28), ringMat)
      markerRing.rotation.x = Math.PI / 2
      markerRing.position.set(origin.x, 0.04, origin.z)
      this.c.scene.add(markerRing)

      const model = this.createSkyLanternModel('天心指路', '福慧雙增')
      const lanternOriginY = skyLanternMountedY(1.22)
      model.group.position.set(origin.x, lanternOriginY, origin.z)
      model.group.userData = { skyLantern: true }
      model.paperMesh.userData = { skyLantern: true }
      this.add(model.group)

      const glowMat = new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0, depthWrite: false })
      const groundGlow = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 5.6), glowMat)
      groundGlow.rotation.x = -Math.PI / 2
      groundGlow.position.set(origin.x, 0.035, origin.z)
      this.c.scene.add(groundGlow)

      const playerGroup: CourtyardSkyLanternGroup = {
        id: 'player-stand',
        originPos: origin,
        lanternGroup: model.group,
        lanternMesh: model.paperMesh,
        paperMat: model.paperMat,
        flameMesh: model.flameMesh,
        pointLight: model.pointLight,
        groundGlow,
        groundGlowMat: glowMat,
        actors: [],
        state: 'holding',
        timer: 0,
        lanternY: lanternOriginY,
        lanternOriginY,
        targetY: 36.0,
        drift: { x: 0.14, z: -0.18 },
        isPlayerStand: true,
      }
      this.skyLanternGroups.push(playerGroup)
      this.playerLanternGroup = playerGroup
    }
  }

  getPlayerLanternStand(): THREE.Vector3 {
    return this.playerLanternStandPos.clone()
  }

  triggerPlayerSkyLantern(): boolean {
    if (!this.playerLanternGroup) return false
    if (this.playerLanternGroup.state !== 'holding') return false
    this.playerLanternGroup.state = 'igniting'
    this.playerLanternGroup.timer = 3.5
    return true
  }

  isPlayerLanternReady(): boolean {
    return this.playerLanternGroup ? this.playerLanternGroup.state === 'holding' : false
  }

  update(dt: number, time: number): void {
    for (const m of this.lanternMats) m.emissiveIntensity = 0.5 + Math.sin(time * 1.7) * 0.05
    if (this.fairyMesh) {
      this.fairyMesh.position.y = this.fairyBaseY + 1.45 / 2 + Math.sin(time * 1.8) * 0.02
    }

    // Sky Lanterns dynamic lifecycle and illumination
    for (const g of this.skyLanternGroups) {
      g.flameMesh.scale.y = 1.0 + Math.sin(time * 24.0 + (g.isPlayerStand ? 1.5 : 0.8)) * 0.22

      if (g.state === 'holding') {
        if (!g.isPlayerStand) {
          g.timer -= dt
          g.pointLight.intensity = THREE.MathUtils.damp(g.pointLight.intensity, 0.2, 3.0, dt)
          g.groundGlowMat.opacity = THREE.MathUtils.damp(g.groundGlowMat.opacity, 0.0, 3.0, dt)
          g.paperMat.emissiveIntensity = THREE.MathUtils.damp(g.paperMat.emissiveIntensity, 0.35, 3.0, dt)
          for (const a of g.actors) {
            a.head.rotation.x = THREE.MathUtils.damp(a.head.rotation.x, 0.06, 2.0, dt)
            a.torso.rotation.z = Math.sin(time * 2.0) * 0.015
          }
          if (g.timer <= 0) {
            g.state = 'igniting'
            g.timer = 3.5
          }
        } else {
          // Player stand waiting for interaction
          g.pointLight.intensity = THREE.MathUtils.damp(g.pointLight.intensity, 0.25, 3.0, dt)
          g.groundGlowMat.opacity = THREE.MathUtils.damp(g.groundGlowMat.opacity, 0.15 + Math.sin(time * 3.0) * 0.06, 3.0, dt)
          g.paperMat.emissiveIntensity = THREE.MathUtils.damp(g.paperMat.emissiveIntensity, 0.5, 3.0, dt)
        }
      } else if (g.state === 'igniting') {
        g.timer -= dt
        const flare = Math.sin(time * 20.0) * 0.25
        g.pointLight.intensity = (g.isPlayerStand ? 2.1 : 1.85) + flare
        g.groundGlowMat.opacity = 0.65 + Math.sin(time * 18.0) * 0.08
        g.paperMat.emissiveIntensity = 1.15 + Math.sin(time * 15.0) * 0.12
        g.lanternGroup.position.y = g.lanternOriginY + Math.sin(time * 7.0) * 0.018

        for (const a of g.actors) {
          a.head.rotation.x = THREE.MathUtils.damp(a.head.rotation.x, -0.08, 3.0, dt)
        }

        if (g.timer <= 0) {
          g.state = 'ascending'
          g.timer = 22.0
          g.lanternY = g.lanternOriginY
        }
      } else if (g.state === 'ascending') {
        g.timer -= dt
        g.lanternY += dt * (1.1 + g.lanternY * 0.028)
        const lift = g.lanternY - g.lanternOriginY

        g.lanternGroup.position.y = g.lanternY
        g.lanternGroup.position.x = g.originPos.x + g.drift.x * lift * 0.25 + Math.sin(time * 0.8 + (g.isPlayerStand ? 2.5 : 0)) * 0.35
        g.lanternGroup.position.z = g.originPos.z + g.drift.z * lift * 0.25 + Math.cos(time * 0.6 + (g.isPlayerStand ? 2.5 : 0)) * 0.25
        g.lanternGroup.rotation.y = time * 0.32
        g.lanternGroup.rotation.z = Math.sin(time * 0.8) * 0.04

        // Actors clasp hands in prayer and gaze up at rising lantern
        for (const a of g.actors) {
          a.arms.rotation.x = THREE.MathUtils.damp(a.arms.rotation.x, -0.45, 3.0, dt)
          const lookUp = Math.min(0.55, lift * 0.08)
          a.head.rotation.x = THREE.MathUtils.damp(a.head.rotation.x, -lookUp, 2.5, dt)
        }

        // Surrounding illumination dynamics
        if (g.lanternY < 5.8) {
          const falloff = Math.max(0, 1.0 - lift / 4.8)
          g.groundGlowMat.opacity = falloff * 0.65
          g.pointLight.intensity = (g.isPlayerStand ? 2.1 : 1.85) * falloff
        } else {
          g.groundGlowMat.opacity = 0
          const skyFalloff = Math.max(0.1, 1.2 * (1.0 - (g.lanternY - 5.8) / 25.0))
          g.pointLight.intensity = skyFalloff
        }

        if (g.lanternY >= g.targetY || g.timer <= 0) {
          g.state = 'cooldown'
          g.timer = g.isPlayerStand ? 10.0 : (8.0 + Math.random() * 8.0)
          g.lanternGroup.visible = false
          g.pointLight.intensity = 0
          g.groundGlowMat.opacity = 0
        }
      } else if (g.state === 'cooldown') {
        g.timer -= dt
        for (const a of g.actors) {
          a.arms.rotation.x = THREE.MathUtils.damp(a.arms.rotation.x, 0, 2.0, dt)
          a.head.rotation.x = THREE.MathUtils.damp(a.head.rotation.x, 0, 2.0, dt)
        }
        if (g.timer <= 0) {
          g.lanternGroup.position.set(g.originPos.x, g.lanternOriginY, g.originPos.z)
          g.lanternGroup.rotation.set(0, 0, 0)
          g.lanternGroup.visible = true
          g.lanternY = g.lanternOriginY
          g.state = 'holding'
          g.timer = g.isPlayerStand ? 0 : (5.0 + Math.random() * 6.0)
        }
      }
    }
  }
}
