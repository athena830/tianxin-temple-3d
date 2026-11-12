import * as THREE from 'three'
import type { Physics } from '../engine/physics'

/**
 * Stage 2A: entrance arch, front courtyard, Tiangong urn and the Tianxin Xiangu consultation pavilion.
 * Facing the main hall from the entrance, left is -X and right is +X; the entrance is at +Z.
 * The central stone road (|x| < ROAD_HALF) stays completely clear from the arch to the main hall.
 */
export const ROAD_HALF = 2
export const SITE = { halfX: 30, back: -27, front: 48 } as const
export const GATE_Z = 48
export const STAND = new THREE.Vector3(0, 0, 51.6)
export const TIANGONG = new THREE.Vector3(9, 0, 28)
export const PAVILION = new THREE.Vector3(-12, 0, 30)
export const WISH_POOL = new THREE.Vector3(-9.5, 0, 40)
export const LOTUS_POND = new THREE.Vector3(11, 0, 39.5)

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
  /** Smoke emitter above the Tiangong urn. */
  readonly tiangongSmoke = new THREE.Vector3(TIANGONG.x, 2.45, TIANGONG.z)
  readonly tiangongGlow: THREE.PointLight
  private readonly lanternMats: THREE.MeshStandardMaterial[] = []

  constructor(private readonly c: BuildContext) {
    this.addGround()
    this.addWalls()
    this.addRoad()
    this.addGateArch()
    this.tiangongGlow = this.addTiangongUrn()
    this.addPavilion()
    this.addWishingPool()
    this.addLotusPond()
    this.addPlanting()
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
    for (const side of [-1, 1]) {
      const x = side * (halfX - 0.4)
      this.box(0.65, 4.2, len, wall, x, 2.1, (front + back) / 2, true)
      this.box(1.0, 0.3, len + 0.4, cap, x, 4.3, (front + back) / 2)
      // Front wall segments either side of the arch.
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
    // Stone lions guarding the plaza side of the arch.
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
      this.add(lion)
      this.c.physics.addStaticBox(new THREE.Vector3(side * 7.7, 1, z + 1.6), new THREE.Vector3(1.2, 2, 1.2))
    }
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

  /** Large bronze Tiangong urn on a stone base, with a small roofed crown and continuous incense smoke. */
  private addTiangongUrn(): THREE.PointLight {
    const { x, z } = TIANGONG
    const bronze = this.c.mat(PAL.bronze, 0.38, 0.55)
    const gold = this.c.mat(PAL.gold, 0.42, 0.36)
    const stone = this.c.mat('#a49a87', 0.92)
    const g = new THREE.Group()
    g.position.set(x, 0, z)
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.95, 0.5, 8), stone)
    base.position.y = 0.25
    const tier = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.45, 0.3, 8), stone)
    tier.position.y = 0.65
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 0.82, 1.0, 20), bronze)
    bowl.position.y = 1.3
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.1, 8, 28), gold)
    rim.rotation.x = Math.PI / 2
    rim.position.y = 1.8
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.97, 0.06, 6, 28), gold)
    band.rotation.x = Math.PI / 2
    band.position.y = 1.15
    g.add(base, tier, bowl, rim, band)
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.07, 8, 14), bronze)
      ear.position.set(0, 1.85, side * 1.15)
      g.add(ear)
    }
    for (let i = 0; i < 4; i += 1) {
      const a = Math.PI / 4 + (i * Math.PI) / 2
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.75, 6), bronze)
      post.position.set(Math.cos(a) * 0.72, 2.18, Math.sin(a) * 0.72)
      g.add(post)
    }
    const crown = new THREE.Mesh(new THREE.ConeGeometry(1.05, 0.62, 8), bronze)
    crown.position.y = 2.85
    const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), gold)
    pearl.position.y = 3.3
    g.add(crown, pearl)
    for (let i = 0; i < 9; i += 1) {
      const a = (i / 9) * Math.PI * 2
      const r = i === 0 ? 0 : 0.32
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.62, 5), this.c.mat('#c89154'))
      stick.position.set(Math.cos(a) * r, 2.05, Math.sin(a) * r)
      const ember = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), new THREE.MeshBasicMaterial({ color: '#ffb45f' }))
      ember.position.set(stick.position.x, 2.37, stick.position.z)
      g.add(stick, ember)
    }
    this.add(g)
    // Name label on the base, facing the road (-X).
    const label = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.34), this.c.text('天 公 爐', '#f2d690', '#4b3022'))
    label.position.set(x - 1.86, 0.27, z)
    label.rotation.y = -Math.PI / 2
    this.c.scene.add(label)
    // Worship mat where visitors stand.
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.1), this.c.mat('#8e2f24', 0.95))
    mat.rotation.x = -Math.PI / 2
    mat.position.set(x - 3.0, 0.03, z)
    mat.receiveShadow = true
    this.c.scene.add(mat)
    this.c.physics.addStaticCylinder(new THREE.Vector3(x, 1.5, z), 1.9, 3)
    const glow = new THREE.PointLight('#f1a754', 0.5, 9, 2)
    glow.position.set(x, 2.3, z)
    this.c.scene.add(glow)
    return glow
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
    // Lanterns at the two open-side outer corners (high under the eave), and lotus pots by the entry.
    for (const a of [30, 90, 330]) { const p = corner(a * deg, r + 0.9); this.lantern(p.x, postH - 0.25, p.z, 0.24) }
    for (const dz of [-2.6, 2.6]) this.lotusPot(cx + r + 1.45, cz + dz)
    // Signboard near the road so the pavilion is identifiable on entry.
    const sign = new THREE.Group()
    sign.position.set(-4.0, 0, 35.5)
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.9, 0.14), wood)
    post.position.y = 0.95
    const boardMesh = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.6, 0.1), this.c.mat('#36241a'))
    boardMesh.position.y = 1.85
    const signFace = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.5), this.c.text('天心仙姑問事亭', '#e9c97f', '#36241a'))
    signFace.position.set(0, 1.85, 0.06)
    sign.add(post, boardMesh, signFace)
    sign.rotation.y = -0.35
    this.add(sign)
    this.c.physics.addStaticBox(new THREE.Vector3(-4.0, 1, 35.5), new THREE.Vector3(0.3, 2, 0.3))
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

  private lotusFlower(x: number, y: number, z: number, s: number): THREE.Group {
    const f = new THREE.Group()
    f.position.set(x, y, z)
    const petalMat = this.c.mat(PAL.lotus, 0.6)
    for (let i = 0; i < 6; i += 1) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(s, 8, 6), petalMat)
      const a = (i / 6) * Math.PI * 2
      p.scale.set(0.45, 0.9, 0.3)
      p.position.set(Math.cos(a) * s * 0.55, s * 0.6, Math.sin(a) * s * 0.55)
      p.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5)
      f.add(p)
    }
    const heart = new THREE.Mesh(new THREE.SphereGeometry(s * 0.35, 8, 6), this.c.mat('#e8c35c', 0.5))
    heart.position.y = s * 0.5
    f.add(heart)
    return f
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
    this.addLotusPads(x, z, 1.7, 5, 2)
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

  /** Decorative lotus pond, right of the road, mirroring the wishing pool. */
  private addLotusPond(): void {
    const { x, z } = LOTUS_POND
    const sx = 1.4
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.45, 0.62, 32), this.c.mat('#b4a07d'))
    basin.scale.x = sx
    basin.position.set(x, -0.08, z)
    this.add(basin)
    const water = new THREE.Mesh(new THREE.CircleGeometry(2.3, 36), new THREE.MeshStandardMaterial({ color: PAL.water, roughness: 0.25, metalness: 0.15 }))
    water.rotation.x = -Math.PI / 2
    water.scale.x = sx
    water.position.set(x, 0.25, z)
    this.c.scene.add(water)
    this.addLotusPads(x, z, 1.8, 9, 4, sx)
    this.c.physics.addStaticBox(new THREE.Vector3(x, 0.15, z), new THREE.Vector3(2.6 * sx * 1.85, 0.9, 4.6))
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

  update(time: number): void {
    this.tiangongGlow.intensity = 0.5 + Math.sin(time * 2.2) * 0.06
    for (const m of this.lanternMats) m.emissiveIntensity = 0.5 + Math.sin(time * 1.7) * 0.05
  }
}
