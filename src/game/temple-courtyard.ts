import * as THREE from 'three'
import type { Physics } from '../engine/physics'

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
}

const PAL = {
  stone: '#897f70', paving: '#a39481', road: '#765444', roadLine: '#a88d6b', wall: '#39291f', wallCap: '#34433c',
  red: '#9c3b2d', redLight: '#b64b37', gold: '#b7924a', bronze: '#80623c', wood: '#5b3426', jade: '#678276',
  leaf: '#465b50', water: '#4e7771', lotusPad: '#5f8a55', lotus: '#e6a7a6', lantern: '#c2412f', ground: '#8f8670',
}

const yAxis = new THREE.Vector3(0, 1, 0)
const rotY = (a: number) => new THREE.Quaternion().setFromAxisAngle(yAxis, a)

export class FrontCourtyard {
  private readonly lanternMats: THREE.MeshStandardMaterial[] = []
  private fairyMesh?: THREE.Mesh

  constructor(private readonly c: BuildContext) {
    this.addGround()
    this.addWalls()
    this.addRoad()
    this.addGateArch()
    this.addScreenWall()
    this.addPavilion()
    this.addWishingPool()
    this.addLotusPond()
    this.addGoldFurnace()
    this.addPlanting()
    this.addSacredTrailAndPlatform()
  }

  private add(mesh: THREE.Object3D, shadow = true): THREE.Object3D {
    mesh.traverse(o => { if (o instanceof THREE.Mesh) { o.castShadow = shadow; o.receiveShadow = true } })
    this.c.scene.add(mesh)
    return mesh
  }

  private box(w: number, h: number, d: number, color: string | THREE.Material, x: number, y: number, z: number, collide = false, angle = 0): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof color === 'string' ? this.c.mat(color) : color)
    m.position.set(x, y, z)
    m.rotation.y = angle
    this.add(m)
    if (collide) this.c.physics.addStaticBox(new THREE.Vector3(x, y, z), new THREE.Vector3(w, h, d), angle ? rotY(angle) : undefined)
    return m
  }

  private addGround(): void {
    const { halfX, back, front } = SITE
    const depth = front - back
    const floor = this.box(halfX * 2, 0.8, depth, this.c.mat(PAL.stone, 0.96), 0, -0.42, (front + back) / 2, true)
    floor.castShadow = false
    // Entrance plaza outside the arch, where the visitor first appears.
    const plaza = this.box(26, 0.8, 8, this.c.mat(PAL.paving, 0.95), 0, -0.42, front + 4, true)
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
    const p = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r, h, 12), this.c.mat(color, 0.72))
    p.position.set(x, h / 2, z)
    this.add(p)
    if (collide) this.c.physics.addStaticCylinder(new THREE.Vector3(x, h / 2, z), r, h)
  }

  private addRoad(): void {
    const start = -8.5
    const end = GATE_Z + 7.5
    const len = end - start
    const road = new THREE.Mesh(new THREE.BoxGeometry(ROAD_HALF * 2 + 0.1, 0.035, len), this.c.mat(PAL.road, 0.92))
    road.position.set(0, 0.015, (start + end) / 2)
    road.receiveShadow = true
    this.c.scene.add(road)
    const line = this.c.mat(PAL.roadLine, 0.88)
    for (let z = end - 1.5; z > start; z -= 3) {
      const tile = new THREE.Mesh(new THREE.BoxGeometry(ROAD_HALF * 2 - 0.1, 0.025, 0.16), line)
      tile.position.set(0, 0.04, z)
      this.c.scene.add(tile)
    }
    // Low curb stones along both edges, flush enough to step over (purely visual).
    for (const side of [-1, 1]) {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, GATE_Z - 1), this.c.mat('#b9aa91', 0.9))
      curb.position.set(side * (ROAD_HALF + 0.12), 0.04, GATE_Z / 2 - 0.5)
      curb.receiveShadow = true
      this.c.scene.add(curb)
    }
  }

  /** Three-bay entrance arch. All three bays are walkable; lanterns hang only over the side bays, above 4.2 m. */
  private addGateArch(): void {
    const z = GATE_Z
    const gold = this.c.mat(PAL.gold, 0.5, 0.18)
    for (const [x, h, r] of [[-6, 5.6, 0.4], [-2.6, 6.4, 0.46], [2.6, 6.4, 0.46], [6, 5.6, 0.4]] as const) {
      this.pillar(x, z, h, r, true)
      this.box(1.25, 0.4, 1.25, gold, x, 0.2, z)
    }
    this.box(5.9, 0.6, 0.95, PAL.red, 0, 6.15, z)
    for (const side of [-1, 1]) this.box(3.9, 0.5, 0.85, PAL.red, side * 4.3, 5.35, z)
    const plaque = this.box(3.8, 1.05, 0.24, '#30231a', 0, 5.4, z + 0.5)
    plaque.castShadow = false
    for (const dz of [0.63, -0.63]) {
      const face = new THREE.Mesh(new THREE.PlaneGeometry(3.45, 0.82), this.c.text('玉 皇 宮', '#e5c57d', '#38251b'))
      face.position.set(0, 5.4, z + dz)
      if (dz < 0) face.rotation.y = Math.PI
      this.c.scene.add(face)
    }
    const mid = this.c.roof(7.4, 2.4, 6.55, 7.9)
    mid.position.set(0, 0, z)
    this.add(mid)
    for (const side of [-1, 1]) {
      const r = this.c.roof(4.6, 2.0, 5.65, 6.55)
      r.position.set(side * 4.3, 0, z)
      this.add(r)
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

    this.add(screenGroup)
    this.c.physics.addStaticBox(new THREE.Vector3(0, 2.1, z), new THREE.Vector3(wallW + 0.8, 4.6, 1.5))
  }

  private lantern(x: number, y: number, z: number, size: number): void {
    const mat = this.c.mat(PAL.lantern, 0.5)
    mat.emissive.set('#a3301c')
    mat.emissiveIntensity = 0.55
    this.lanternMats.push(mat)
    const g = new THREE.Group()
    g.position.set(x, y, z)
    const body = new THREE.Mesh(new THREE.SphereGeometry(size, 14, 10), mat)
    body.scale.y = 1.2
    const gold = this.c.mat(PAL.gold, 0.45, 0.2)
    const capT = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.45, size * 0.55, size * 0.25, 10), gold)
    capT.position.y = size * 1.2
    const capB = capT.clone()
    capB.position.y = -size * 1.2
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, size * 1.4, 4), gold)
    cord.position.y = size * 2
    const tassel = new THREE.Mesh(new THREE.ConeGeometry(size * 0.25, size * 0.8, 6), mat)
    tassel.position.y = -size * 1.7
    tassel.rotation.x = Math.PI
    g.add(body, capT, capB, cord, tassel)
    this.add(g, false)
  }

  /**
   * Open hexagonal pavilion beside the courtyard, left of the road. Posts sit at 30° + k·60° (0° = +X),
   * so a flat side faces the road (east) and another faces the entrance; both are open, the other four have rails.
   */
  private addPavilion(): void {
    const { x: cx, z: cz } = PAVILION
    const r = 3.4
    const postH = 3.15
    const red = this.c.mat(PAL.red, 0.7)
    const wood = this.c.mat(PAL.wood, 0.8)
    const deg = Math.PI / 180
    const platform = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.7, r + 0.85, 0.2, 6), this.c.mat('#b3a68f', 0.94))
    platform.position.set(cx, 0.08, cz)
    platform.rotation.y = 0
    this.add(platform)
    platform.castShadow = false
    this.c.physics.addStaticCylinder(new THREE.Vector3(cx, 0.08, cz), r + 0.75, 0.2)
    const corner = (a: number, rad = r) => new THREE.Vector3(cx + Math.cos(a) * rad, 0, cz + Math.sin(a) * rad)
    for (let k = 0; k < 6; k += 1) {
      const p = corner((30 + k * 60) * deg)
      this.pillar(p.x, p.z, postH + 0.18, 0.18, true)
      const beamA = (30 + k * 60) * deg, beamB = (90 + k * 60) * deg
      const a = corner(beamA), b = corner(beamB)
      const mid = a.clone().add(b).multiplyScalar(0.5)
      const phi = (60 + k * 60) * deg
      const beam = new THREE.Mesh(new THREE.BoxGeometry(r, 0.26, 0.2), wood)
      beam.position.set(mid.x, postH + 0.05, mid.z)
      beam.rotation.y = -(phi + Math.PI / 2)
      this.add(beam)
    }
    // Rails on four sides; sides centred at 0° (road) and 60° (toward entrance) stay open.
    for (const phiDeg of [120, 180, 240, 300]) {
      const phi = phiDeg * deg
      const d = r * Math.cos(30 * deg)
      const mx = cx + Math.cos(phi) * d, mz = cz + Math.sin(phi) * d
      const angle = -(phi + Math.PI / 2)
      const rail = new THREE.Mesh(new THREE.BoxGeometry(r - 0.4, 0.09, 0.12), red)
      rail.position.set(mx, 0.85, mz)
      rail.rotation.y = angle
      const low = rail.clone()
      low.position.y = 0.38
      this.add(rail); this.add(low)
      for (let i = -2; i <= 2; i += 1) {
        const t = (i / 5) * (r - 0.6)
        const bal = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 0.06), wood)
        bal.position.set(mx - Math.sin(phi) * t, 0.6, mz + Math.cos(phi) * t)
        this.add(bal)
      }
      this.c.physics.addStaticBox(new THREE.Vector3(mx, 0.6, mz), new THREE.Vector3(r - 0.3, 1.2, 0.25), rotY(angle))
    }
    // Hexagonal roof with up-turned eaves and a gold finial.
    const eave = new THREE.Mesh(new THREE.CylinderGeometry(r + 1.25, r + 1.3, 0.18, 6), this.c.mat('#465b50', 0.75))
    eave.position.set(cx, postH + 0.25, cz)
    const roof = new THREE.Mesh(new THREE.ConeGeometry(r + 1.2, 1.9, 6), this.c.mat('#34433c', 0.82))
    roof.position.set(cx, postH + 1.3, cz)
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), this.c.mat(PAL.gold, 0.4, 0.25))
    finial.position.set(cx, postH + 2.4, cz)
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.5, 8), this.c.mat(PAL.gold, 0.4, 0.25))
    spike.position.set(cx, postH + 2.75, cz)
    this.add(eave); this.add(roof); this.add(finial); this.add(spike)
    for (let k = 0; k < 6; k += 1) {
      const a = (30 + k * 60) * deg
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.7, 6), this.c.mat('#465b50', 0.75))
      const p = corner(a, r + 1.3)
      tip.position.set(p.x, postH + 0.55, p.z)
      tip.rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7)
      this.add(tip)
    }
    // Plaque under the eave on the road side, readable from the road and the entrance.
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.62, 2.1), this.c.mat('#30231a'))
    const px = cx + r * Math.cos(30 * deg) + 0.06
    plaque.position.set(px, postH - 0.28, cz)
    this.add(plaque, false)
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.95, 0.5), this.c.text('天 心 仙 姑', '#e9c97f', '#36241a'))
    face.position.set(px + 0.07, postH - 0.28, cz)
    face.rotation.y = Math.PI / 2
    this.c.scene.add(face)
    // Stone table, chessboard and four stools.
    const table = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.55, 0.8, 16), this.c.mat('#aaa08c', 0.9))
    table.position.set(cx, 0.58, cz)
    this.add(table)
    this.c.physics.addStaticCylinder(new THREE.Vector3(cx, 0.6, cz), 0.8, 1.2)
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.04, 1.1), new THREE.MeshStandardMaterial({ map: this.boardTexture(), roughness: 0.75 }))
    board.position.set(cx, 1.0, cz)
    board.name = 'chessboard'
    this.add(board, false)
    const pieces: [number, number, string][] = [[0, 0, PAL.red], [-0.26, 0, '#34302a'], [0.26, 0, PAL.red], [0, -0.3, '#34302a'], [0, 0.3, PAL.red]]
    for (const [dx, dz, color] of pieces) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.09, 0.05, 14), this.c.mat('#e8d7b0', 0.6))
      p.position.set(cx + dx, 1.045, cz + dz)
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 4, 14), this.c.mat(color, 0.5))
      ring.rotation.x = Math.PI / 2
      ring.position.set(cx + dx, 1.075, cz + dz)
      this.add(p, false); this.add(ring, false)
    }
    for (let k = 0; k < 4; k += 1) {
      const a = (45 + k * 90) * deg
      const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.45, 12), this.c.mat('#aaa08c', 0.9))
      stool.position.set(cx + Math.cos(a) * 1.3, 0.4, cz + Math.sin(a) * 1.3)
      this.add(stool)
    }
    const light = new THREE.PointLight('#f5c87b', 0.55, 8, 2)
    light.position.set(cx, postH - 0.3, cz)
    this.c.scene.add(light)
    this.addTianxinFairy(cx, cz)
    // Lanterns at the two open-side outer corners (high under the eave), and lotus pots by the entry.
    for (const a of [30, 90, 330]) { const p = corner(a * deg, r + 0.9); this.lantern(p.x, postH - 0.25, p.z, 0.24) }
    for (const dz of [-2.6, 2.6]) this.lotusPot(cx + r + 1.45, cz + dz)
    // Signboard near the road so the pavilion is identifiable on entry.
    const sign = new THREE.Group()
    sign.position.set(-4.0, 0, 35.5)
    // Upright post cleanly supports the signboard from underneath up to the base of the plaque
    const signPostH = 1.58
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, signPostH, 0.14), wood)
    post.position.set(0, signPostH / 2, 0)
    // Back brace securing the plaque from behind without obstructing the front text
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
  }

  private addTianxinFairy(cx: number, cz: number): void {
    const loader = new THREE.TextureLoader()
    loader.load('./assets/tianxin-fairy.png', tex => {
      tex.colorSpace = THREE.SRGBColorSpace
      // Height 1.45m, preserving aspect ratio of (290 / 511)
      const aspect = 290 / 511
      const fairyH = 1.45
      const fairyW = fairyH * aspect
      const geo = new THREE.PlaneGeometry(fairyW, fairyH)
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        transparent: true,
        alphaTest: 0.05,
        roughness: 0.65,
        metalness: 0.05,
        side: THREE.DoubleSide,
      })
      const mesh = new THREE.Mesh(geo, mat)
      // Placed behind the chessboard facing visitors entering the pavilion from the road (+X / +Z)
      mesh.position.set(cx - 0.95, 0.4 + fairyH / 2, cz)
      mesh.rotation.y = Math.PI / 2
      mesh.castShadow = true
      mesh.receiveShadow = true
      this.fairyMesh = mesh
      this.c.scene.add(mesh)
    })
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
    // Outer petals (6 petals, spreading)
    for (let i = 0; i < 6; i += 1) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(s, 8, 6), petalMat)
      const a = (i / 6) * Math.PI * 2
      p.scale.set(0.48, 0.92, 0.28)
      p.position.set(Math.cos(a) * s * 0.6, s * 0.55, Math.sin(a) * s * 0.6)
      p.rotation.set(Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55)
      f.add(p)
    }
    // Inner petals (5 petals, upright cup)
    for (let i = 0; i < 5; i += 1) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(s * 0.85, 8, 6), petalMat)
      const a = (i / 5) * Math.PI * 2 + 0.35
      p.scale.set(0.42, 0.88, 0.26)
      p.position.set(Math.cos(a) * s * 0.38, s * 0.65, Math.sin(a) * s * 0.38)
      p.rotation.set(Math.sin(a) * 0.32, 0, -Math.cos(a) * 0.32)
      f.add(p)
    }
    const heart = new THREE.Mesh(new THREE.SphereGeometry(s * 0.35, 8, 6), this.c.mat('#e8c35c', 0.5))
    heart.position.y = s * 0.55
    f.add(heart)
    return f
  }

  private lotusBud(x: number, y: number, z: number, s: number, color = '#ea91a3'): THREE.Group {
    const g = new THREE.Group()
    g.position.set(x, y, z)
    const budMat = this.c.mat(color, 0.6)
    const cone = new THREE.Mesh(new THREE.ConeGeometry(s * 0.45, s * 1.3, 8), budMat)
    cone.position.y = s * 0.65
    const base = new THREE.Mesh(new THREE.SphereGeometry(s * 0.42, 8, 6), this.c.mat(PAL.lotusPad, 0.7))
    base.position.y = s * 0.2
    g.add(cone, base)
    return g
  }

  private lotusSeedpod(x: number, y: number, z: number, s: number): THREE.Group {
    const g = new THREE.Group()
    g.position.set(x, y, z)
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.55, s * 0.24, s * 0.7, 8), this.c.mat('#728a42', 0.6))
    pod.position.y = s * 0.4
    const top = new THREE.Mesh(new THREE.CircleGeometry(s * 0.52, 8), this.c.mat('#a4a046', 0.5))
    top.rotation.x = -Math.PI / 2
    top.position.y = s * 0.75
    g.add(pod, top)
    return g
  }

  /** Lotus wishing pool, moved off the central road to the left side of the courtyard. */
  private addWishingPool(): void {
    const { x, z } = WISH_POOL
    const pool = new THREE.Mesh(new THREE.CylinderGeometry(2.55, 2.4, 0.68, 32), this.c.mat('#b4a07d'))
    pool.position.set(x, -0.08, z)
    this.add(pool)
    const water = new THREE.Mesh(new THREE.CircleGeometry(2.2, 36), new THREE.MeshStandardMaterial({ color: PAL.water, roughness: 0.25, metalness: 0.18, transparent: true, opacity: 0.9 }))
    water.rotation.x = -Math.PI / 2
    water.position.set(x, 0.28, z)
    this.c.scene.add(water)
    const rim = new THREE.Mesh(new THREE.TorusGeometry(2.38, 0.16, 10, 40), this.c.mat(PAL.gold, 0.42, 0.36))
    rim.rotation.x = Math.PI / 2
    rim.position.set(x, 0.32, z)
    this.c.scene.add(rim)
    this.addLotusPads(x, z, 1.8, 12, 5)
    this.c.physics.addStaticCylinder(new THREE.Vector3(x, 0.04, z), 2.42, 0.6)
  }

  private addLotusPads(x: number, z: number, spread: number, pads: number, flowers: number, sx = 1): void {
    for (let i = 0; i < pads; i += 1) {
      const a = i * 2.39996 + 0.4
      const rr = spread * (0.45 + 0.55 * ((i * 7) % 5) / 4)
      const pad = new THREE.Mesh(new THREE.CircleGeometry(0.32 + (i % 3) * 0.06, 14, 0.3, Math.PI * 2 - 0.3), this.c.mat(PAL.lotusPad, 0.7))
      pad.rotation.x = -Math.PI / 2
      pad.rotation.z = a
      pad.position.set(x + Math.cos(a) * rr * sx, 0.3, z + Math.sin(a) * rr)
      this.c.scene.add(pad)
      if (i < flowers) this.c.scene.add(this.lotusFlower(pad.position.x, 0.31, pad.position.z, 0.2))
    }
  }

  /**
   * Grand Scenic Lotus Pond (前庭東側・盛景九曲荷花池):
   * 擴建後的壯麗荷花池，尺寸拓展至約 10.4m × 7.4m，採古典漢白玉雕石蓮瓣護欄圍砌。
   * 池內碧波如翠、池底深淺漸層，生長著 54 餘片高低錯落的蓮葉（包含浮水葉與高聳挺水葉），
   * 盛開著 28 朵千姿百態的仙蓮（粉紅盛開荷花、聖潔出水白蓮、胭脂艷紅蓮、亭亭玉立荷苞與如意蓮蓬）。
   * 池畔點綴天然太湖石假山與水榭石燈籠，夜幕降臨散發水面溫潤微光。
   */
  private addLotusPond(): void {
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

    // 2. 16 Carved Stone Baluster Posts (漢白玉望柱與雕花柱頭)
    const postCount = 16
    for (let i = 0; i < postCount; i += 1) {
      const a = (i / postCount) * Math.PI * 2
      const px = Math.cos(a) * (rx + 0.12)
      const pz = Math.sin(a) * (rz + 0.12)
      const post = new THREE.Group()
      post.position.set(px, 0, pz)

      // Post pedestal
      const pBase = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.24), stoneWall)
      pBase.position.y = 0.32
      // Post column
      const pCol = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.38, 0.18), whiteMarble)
      pCol.position.y = 0.58
      // Lotus finial (蓮花苞柱頭)
      const finialBase = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.08, 0.08, 8), this.c.mat(PAL.gold, 0.5, 0.3))
      finialBase.position.y = 0.81
      const finial = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), whiteMarble)
      finial.scale.set(0.9, 1.3, 0.9)
      finial.position.y = 0.92
      post.add(pBase, pCol, finialBase, finial)
      g.add(post)
    }

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
      const panel = new THREE.Mesh(new THREE.BoxGeometry(segLen, 0.28, 0.1), this.c.mat('#cfc6b5', 0.8))
      panel.position.set(mx, 0.44, mz)
      panel.rotation.y = -segAngle
      g.add(panel)
    }

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

    // Traditional Stone Water Lantern atop rock (池畔水榭石燈籠)
    const lanternBase = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.18, 6), stoneWall)
    lanternBase.position.set(rx * 0.72, 1.42, -rz * 0.22)
    const lanternWindow = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.24, 0.28), this.c.mat('#f0c36b', 0.4, 0.2))
    lanternWindow.position.set(rx * 0.72, 1.62, -rz * 0.22)
    const lanternRoof = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.22, 6), stoneWall)
    lanternRoof.position.set(rx * 0.72, 1.84, -rz * 0.22)
    g.add(lanternBase, lanternWindow, lanternRoof)

    const lanternLight = new THREE.PointLight('#ffbe55', 0.8, 6, 2)
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

    // 5. Abundant Lotus Flora (繁茂蓮葉群與千姿仙蓮)
    this.addGrandLotusFlora(x, z, rx - 0.55, rz - 0.5)

    // 6. Physics Collision Barrier (防止玩家墜入深池)
    this.c.physics.addStaticBox(
      new THREE.Vector3(x, 0.45, z),
      new THREE.Vector3((rx + 0.15) * 2, 0.95, (rz + 0.15) * 2)
    )
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

      // Pad mesh
      const padGeom = new THREE.CircleGeometry(padR, 14, 0.25, Math.PI * 2 - 0.25)
      const padMesh = new THREE.Mesh(padGeom, this.c.mat(color, 0.7))
      padMesh.rotation.x = -Math.PI / 2
      padMesh.rotation.z = phi
      if (isElevated) {
        padMesh.rotation.x += ((i % 5) - 2) * 0.06
        padMesh.rotation.y += ((i % 3) - 1) * 0.05
      }
      padMesh.position.set(px, py, pz)
      this.c.scene.add(padMesh)

      // Slender stem down to water if elevated
      if (isElevated) {
        const stem = new THREE.Mesh(
          new THREE.CylinderGeometry(0.016, 0.018, stemH + 0.08, 6),
          this.c.mat('#3b5e32', 0.8)
        )
        stem.position.set(px, 0.25 + stemH / 2, pz)
        this.c.scene.add(stem)
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

    for (let j = 0; j < flowerTypes.length; j += 1) {
      const ft = flowerTypes[j]
      const padIdx = (j * 2 + 1) % padPositions.length
      const p = padPositions[padIdx]
      const fx = p.x + ((j * 3) % 5 - 2) * 0.08
      const fz = p.z + ((j * 4) % 5 - 2) * 0.08
      const stemH = 0.12 + (j % 5) * 0.05
      const fy = 0.29 + stemH

      // Slender stem
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.018, stemH + 0.08, 6),
        this.c.mat('#446b38', 0.8)
      )
      stem.position.set(fx, 0.26 + stemH / 2, fz)
      this.c.scene.add(stem)

      if (ft.type === 'bud') {
        this.c.scene.add(this.lotusBud(fx, fy, fz, ft.size, ft.color))
      } else if (ft.type === 'seedpod') {
        this.c.scene.add(this.lotusSeedpod(fx, fy, fz, ft.size))
      } else {
        this.c.scene.add(this.lotusFlower(fx, fy, fz, ft.size, ft.color))
      }
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

    this.add(g)
    this.c.physics.addStaticCylinder(new THREE.Vector3(x, 1.5, z), 1.8, 3.0)
  }

  private addPlanting(): void {
    // Shrubs and stone lanterns along the road edges (outside |x| < 2), skipping the Tiangong and pavilion approaches.
    for (const side of [-1, 1]) {
      for (const z of [14, 24, 34, 44]) this.shrub(side * 3.6, z)
      for (const z of [19, 39]) this.stoneLantern(side * 3.6, z)
    }
    for (const [x, z] of [[-24, 44], [24, 44], [-24, 18], [24, 22], [-17, 8], [17, 8]] as const) this.tree(x, z)
    for (const [x, z, a] of [[-6.4, 18, 0], [6.4, 18, 0], [-19, 36, Math.PI / 2], [19, 30, Math.PI / 2]] as const) this.bench(x, z, a)
  }

  private shrub(x: number, z: number): void {
    const g = new THREE.Group()
    g.position.set(x, 0, z)
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.34, 0.45, 10), this.c.mat(PAL.red, 0.8))
    pot.position.y = 0.22
    g.add(pot)
    for (let i = 0; i < 3; i += 1) {
      const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42 - i * 0.06, 0), this.c.mat(i === 1 ? PAL.leaf : PAL.jade, 0.85))
      leaf.position.set((i - 1) * 0.16, 0.72 + i * 0.12, (i % 2) * 0.1)
      g.add(leaf)
    }
    this.add(g)
    this.c.physics.addStaticCylinder(new THREE.Vector3(x, 0.5, z), 0.42, 1)
  }

  private stoneLantern(x: number, z: number): void {
    const stone = this.c.mat('#b0a894', 0.92)
    const g = new THREE.Group()
    g.position.set(x, 0, z)
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.45, 0.3, 6), stone)
    base.position.y = 0.15
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.9, 6), stone)
    shaft.position.y = 0.75
    const lightMat = this.c.mat('#f2c472', 0.5)
    lightMat.emissive.set('#e39b3c')
    lightMat.emissiveIntensity = 0.7
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.36, 0.42), lightMat)
    box.position.y = 1.38
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.34, 6), stone)
    roof.position.y = 1.73
    g.add(base, shaft, box, roof)
    this.add(g)
    this.c.physics.addStaticCylinder(new THREE.Vector3(x, 0.9, z), 0.4, 1.8)
  }

  private tree(x: number, z: number): void {
    const tree = new THREE.Group()
    tree.position.set(x, 0, z)
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.4, 0.22, 10), this.c.mat('#c4ad82', 0.95))
    plinth.position.y = 0.11
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.72, 0.8, 8), this.c.mat(PAL.red))
    pot.position.y = 0.6
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.19, 2.3, 7), this.c.mat('#39291f'))
    trunk.position.y = 1.95
    tree.add(plinth, pot, trunk)
    for (let j = 0; j < 3; j += 1) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.82 - j * 0.11, 1.2, 7), this.c.mat(j === 1 ? PAL.leaf : PAL.jade))
      leaf.position.set(j % 2 ? -0.15 : 0.14, 2.8 + j * 0.67, 0)
      leaf.rotation.z = j % 2 ? 0.1 : -0.12
      tree.add(leaf)
    }
    this.add(tree)
    this.c.physics.addStaticCylinder(new THREE.Vector3(x, 1.5, z), 0.95, 3)
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
  private addSacredTrailAndPlatform(): void {
    const gateX = -(SITE.halfX - 0.4) // -29.6
    const gateZ = 31.0
    const gold = this.c.mat(PAL.gold, 0.45, 0.28)
    const vermilion = this.c.mat(PAL.red, 0.76)
    const marble = this.c.mat('#dfd8cc', 0.9)
    const paving = this.c.mat(PAL.paving, 0.94)
    const stone = this.c.mat('#8e8474', 0.92)

    // -------------------------------------------------------------
    // 1. 西側牌坊拱門（【 昇 龍 聖 境 】 月亮門牌坊）
    // -------------------------------------------------------------
    // 左右兩大朱紅金柱（帶碰撞）
    for (const dz of [-2.2, 2.2]) {
      const pz = gateZ + dz
      this.pillar(gateX, pz, 4.8, 0.32, true)
      // 柱腳抱鼓石
      const drumBase = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.4, 0.8), this.c.mat('#9c9180', 0.95))
      drumBase.position.set(gateX, 0.2, pz)
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 16), this.c.mat('#aba08f', 0.9))
      drum.rotation.z = Math.PI / 2
      drum.position.set(gateX, 0.48, pz)
      this.add(drumBase)
      this.add(drum)
    }
    // 牌坊橫楣額樑
    this.box(0.7, 0.55, 4.8, vermilion, gateX, 4.3, gateZ)
    this.box(0.85, 0.2, 4.95, gold, gateX, 4.0, gateZ)

    // 歇山式琉璃飛簷頂
    const archRoof = this.c.roof(2.4, 5.5, 4.55, 5.65)
    archRoof.position.set(gateX, 0, gateZ)
    this.add(archRoof)

    // 牌匾：朝向前庭面（東面）題刻【昇龍聖境】，朝向小徑面（西面）題刻【紫氣東來】
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

    // 牌坊下懸掛一對迎賓吉祥宮燈
    for (const dz of [-1.5, 1.5]) {
      this.lantern(gateX, 3.85, gateZ + dz, 0.32)
    }

    // -------------------------------------------------------------
    // 2. 朝聖石板小徑（從 x = -29.6 延伸至 x = -54.0，長度 24.4m，約走 5 秒）
    // -------------------------------------------------------------
    const trailStartX = gateX // -29.6
    const trailEndX = -54.0
    const trailLen = trailStartX - trailEndX // 24.4
    const trailMidX = (trailStartX + trailEndX) / 2 // -41.8
    const trailW = 4.2

    // 小徑實體地面物理碰撞（厚度 0.8m，頂面 y = -0.02，確保玩家行走 100% 踏實不穿透）
    this.box(trailLen, 0.8, trailW, paving, trailMidX, -0.42, gateZ, true)

    // 小徑中央鋪設青石古道面磚
    const roadSurface = new THREE.Mesh(new THREE.BoxGeometry(trailLen, 0.04, 3.2), this.c.mat(PAL.road, 0.92))
    roadSurface.position.set(trailMidX, 0.02, gateZ)
    roadSurface.receiveShadow = true
    this.c.scene.add(roadSurface)

    // 小徑南北兩側花崗岩路緣石
    for (const side of [-1, 1]) {
      const curbZ = gateZ + side * 1.85
      const curb = new THREE.Mesh(new THREE.BoxGeometry(trailLen, 0.1, 0.26), stone)
      curb.position.set(trailMidX, 0.05, curbZ)
      curb.receiveShadow = true
      this.c.scene.add(curb)
    }

    // 小徑石條節奏紋理
    const lineMat = this.c.mat(PAL.roadLine, 0.88)
    for (let x = trailStartX - 2.0; x > trailEndX + 1.0; x -= 2.6) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.025, 3.1), lineMat)
      strip.position.set(x, 0.045, gateZ)
      this.c.scene.add(strip)
    }

    // -------------------------------------------------------------
    // 3. 小徑兩側 2 排茂密松柏樹與古樸石燈籠
    // -------------------------------------------------------------
    // 北排樹列 (z = 34.6) 與 南排樹列 (z = 27.4)
    for (const x of [-33.5, -38.5, -43.5, -48.5, -53.0]) {
      this.tree(x, gateZ + 3.6) // 北側松樹
      this.tree(x, gateZ - 3.6) // 南側松樹
    }
    // 夾道古樸石燈籠（柔和微光）
    for (const x of [-36.0, -46.0]) {
      this.stoneLantern(x, gateZ + 2.5)
      this.stoneLantern(x, gateZ - 2.5)
    }

    // -------------------------------------------------------------
    // 4. 昇龍觀音漢白玉八角大平台（中心 x = -68.0, z = 31.0，半徑 14m）
    // -------------------------------------------------------------
    const platX = -68.0
    const platZ = 31.0
    const platR = 14.0

    // 平台基礎實體物理碰撞（覆蓋直徑 28m 整個大圓台地面）
    this.c.physics.addStaticBox(new THREE.Vector3(platX, -0.42, platZ), new THREE.Vector3(platR * 2 + 1.0, 0.8, platR * 2 + 1.0))
    // 步道銜接平台緩坡階梯碰撞
    this.box(2.0, 0.4, 4.4, stone, -55.0, 0.1, platZ, true)

    // 平台群組
    const platGroup = new THREE.Group()
    platGroup.position.set(platX, 0, platZ)

    // (A) 底層漢白玉大圓台基座 (Tier 1)
    const baseTier1 = new THREE.Mesh(new THREE.CylinderGeometry(platR, platR + 0.4, 0.35, 32), marble)
    baseTier1.position.y = 0.175
    baseTier1.receiveShadow = true
    platGroup.add(baseTier1)

    // (B) 頂層平整八角廣場地坪 (Tier 2)
    const baseTier2 = new THREE.Mesh(new THREE.CylinderGeometry(platR - 0.4, platR - 0.2, 0.25, 32), this.c.mat('#eee8dc', 0.94))
    baseTier2.position.y = 0.42
    baseTier2.receiveShadow = true
    platGroup.add(baseTier2)

    // (C) 東側朝聖階梯與九龍御路丹陛石（連接小徑與大平台）
    const stepsGroup = new THREE.Group()
    stepsGroup.position.set(platR - 0.3, 0, 0)
    const step1 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.18, 4.6), stone)
    step1.position.set(0.6, 0.09, 0)
    const step2 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.18, 4.6), marble)
    step2.position.set(-0.2, 0.27, 0)
    // 中央金色祥雲丹陛雕石
    const danbi = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 1.8), gold)
    danbi.position.set(0.2, 0.28, 0)
    danbi.rotation.z = -0.1
    stepsGroup.add(step1, step2, danbi)
    platGroup.add(stepsGroup)

    // (D) 外環漢白玉雕花欄杆與蓮花望柱（圍繞半徑 13.5m，東向留出 4.6m 寬敞迎賓階梯）
    const postCount = 28
    for (let i = 0; i < postCount; i++) {
      const a = (i / postCount) * Math.PI * 2
      // 東側 (a ≈ 0) 留出小徑進場大缺口
      if (Math.abs(a) < 0.28 || Math.abs(a - Math.PI * 2) < 0.28) continue
      const px = Math.cos(a) * (platR - 0.6)
      const pz = Math.sin(a) * (platR - 0.6)

      // 漢白玉方柱
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.75, 0.24), marble)
      post.position.set(px, 0.85, pz)
      // 蓮花柱頭
      const lotusBud = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), this.c.mat('#faf6ee', 0.8))
      lotusBud.position.set(px, 1.28, pz)
      // 雕花尋杖欄板
      const panel = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.42, 0.1), marble)
      panel.position.set(px, 0.75, pz)
      panel.rotation.y = a + Math.PI / 2
      platGroup.add(post, lotusBud, panel)
    }

    // (E) 四方通天金頂石燈台（分佈於大平台四隅，晝夜長明神光）
    for (const [dx, dz] of [[-8.8, -8.8], [-8.8, 8.8], [7.5, -8.8], [7.5, 8.8]]) {
      const lampTower = new THREE.Group()
      lampTower.position.set(dx, 0.54, dz)

      const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, 0.4, 8), stone)
      lampBase.position.y = 0.2
      const lampPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.32, 1.8, 8), stone)
      lampPillar.position.y = 1.3
      const lampCoreMat = this.c.mat('#ffe088', 0.3)
      lampCoreMat.emissive.set('#e5a83b')
      lampCoreMat.emissiveIntensity = 0.8
      const lampCore = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.65, 0.65), lampCoreMat)
      lampCore.position.y = 2.45
      const lampRoof = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.5, 8), this.c.mat(PAL.wallCap, 0.8))
      lampRoof.position.y = 3.0
      const lampGourd = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), gold)
      lampGourd.position.y = 3.35

      const lampLight = new THREE.PointLight('#ffda7a', 0.8, 12, 2)
      lampLight.position.set(0, 2.5, 0)

      lampTower.add(lampBase, lampPillar, lampCore, lampRoof, lampGourd, lampLight)
      platGroup.add(lampTower)

      this.c.physics.addStaticCylinder(new THREE.Vector3(platX + dx, 1.5, platZ + dz), 0.7, 3.2)
    }

    this.add(platGroup)
  }

  update(time: number): void {
    for (const m of this.lanternMats) m.emissiveIntensity = 0.5 + Math.sin(time * 1.7) * 0.05
    if (this.fairyMesh) {
      this.fairyMesh.position.y = 0.4 + 1.45 / 2 + Math.sin(time * 1.8) * 0.02
    }
  }
}
