import * as THREE from 'three'
import type { Physics } from '../engine/physics'

/**
 * A bright, original anime-fantasy palette for the market.
 * It intentionally uses broad adventure-game cues instead of borrowing any
 * character, place, logo, or asset from another game.
 */
const PALETTE = {
  sky: '#78c9f3', haze: '#d9f1ff', teal: '#4e9e91', jade: '#71b879', gold: '#f3c76d', coral: '#ec9a82', ivory: '#fff8e7', wood: '#7a4c36', stone: '#c6c4ad', roof: '#487a9c', grass: '#5eae68', path: '#ddd2b8', crystal: '#7fd7df',
}

export type MarketVenueId = 'birth-chart-hall' | 'card-house' | 'moon-meditation' | 'chess-guide' | 'service-desk'
export type MarketPointId = 'return-temple' | MarketVenueId
export type MarketPoint = { id: MarketPointId; title: string; subtitle: string; position: THREE.Vector3; radius: number }

type Venue = {
  id: MarketVenueId
  title: string
  subtitle: string
  x: number
  z: number
  accent: string
}

function material(color: string, emissive?: string, intensity = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.08, emissive: emissive ?? '#000000', emissiveIntensity: intensity })
}

function label(text: string, foreground = PALETTE.ivory, background = PALETTE.teal): THREE.MeshBasicMaterial {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = background
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = PALETTE.gold
  ctx.lineWidth = 18
  ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24)
  ctx.fillStyle = foreground
  ctx.font = '700 96px "Noto Serif TC", "Microsoft JhengHei", serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 4)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide })
}

/** A hand-drawn, low-resolution adventurer sprite keeps the player legible in an orthographic view. */
function pixelAdventurer(): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 48
  canvas.height = 64
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.fillStyle = '#513b35'; ctx.fillRect(16, 7, 16, 12)
  ctx.fillStyle = '#f4c8a8'; ctx.fillRect(18, 14, 12, 11)
  ctx.fillStyle = '#f6e4be'; ctx.fillRect(14, 9, 20, 5)
  ctx.fillStyle = '#4b7f9a'; ctx.fillRect(14, 25, 20, 21)
  ctx.fillStyle = '#e6c56e'; ctx.fillRect(14, 27, 20, 4)
  ctx.fillStyle = '#6f4937'; ctx.fillRect(15, 46, 7, 12); ctx.fillRect(26, 46, 7, 12)
  ctx.fillStyle = '#ffffff'; ctx.fillRect(20, 18, 2, 2); ctx.fillRect(27, 18, 2, 2)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }))
  sprite.scale.set(1.25, 1.7, 1)
  sprite.position.y = 0.9
  return sprite
}

/** A lightweight world with its own scene and Rapier colliders. It never shares temple objects. */
export class MarketWorld {
  readonly scene = new THREE.Scene()
  /** Arrival is in the central court, facing the four venues rather than the return portal. */
  readonly spawn = new THREE.Vector3(0, 0.92, 3.4)
  readonly returnPoint: MarketPoint = {
    id: 'return-temple', title: '返回天心宮', subtitle: '踏入時空門，回到主殿', position: new THREE.Vector3(0, 0, 8.6), radius: 2.8,
  }
  readonly venuePoints: MarketPoint[] = [
    { id: 'birth-chart-hall', title: '命盤探索館', subtitle: '人類圖・紫微斗數介紹', position: new THREE.Vector3(-10, 0, 0.6), radius: 3.15 },
    { id: 'card-house', title: '牌卡靈感屋', subtitle: '每日一張牌・三張牌問事預告', position: new THREE.Vector3(-7.6, 0, -8.2), radius: 3.15 },
    { id: 'moon-meditation', title: '月光靜心所', subtitle: '呼吸引導・靜心服務介紹', position: new THREE.Vector3(7.6, 0, -8.2), radius: 3.15 },
    { id: 'chess-guide', title: '東方問事指引亭', subtitle: '前往既有天心仙姑象棋卜卦', position: new THREE.Vector3(10, 0, 0.6), radius: 3.15 },
    { id: 'service-desk', title: '市集服務台', subtitle: '服務資訊與 LINE 預約入口', position: new THREE.Vector3(0, 0, -2.6), radius: 2.9 },
  ]
  readonly points: MarketPoint[] = [...this.venuePoints, this.returnPoint]
  readonly avatar = new THREE.Group()
  private readonly swirl = new THREE.Group()
  private skyMotes!: THREE.Points
  private time = 0

  constructor(private readonly physics: Physics) {
    this.scene.background = new THREE.Color(PALETTE.sky)
    this.scene.fog = new THREE.Fog(PALETTE.haze, 34, 78)
    this.scene.add(new THREE.HemisphereLight('#dcf5ff', '#4f7642', 1.55))
    const sunLight = new THREE.DirectionalLight('#fff1c8', 2.15)
    sunLight.position.set(-18, 28, 12)
    sunLight.castShadow = true
    this.scene.add(sunLight)

    this.addGround()
    this.addSkyMotes()
    this.addScenery()
    this.addArrivalGate()
    this.addStalls()
    this.addMarketGuide()
    this.addReturnPortal()
    this.addAvatar()
  }

  private addGround(): void {
    const ground = new THREE.Mesh(new THREE.CircleGeometry(34, 80), material(PALETTE.grass))
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    this.scene.add(ground)
    this.physics.addStaticBox(new THREE.Vector3(0, -0.2, 0), new THREE.Vector3(68, 0.4, 68))

    const plaza = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 7.65, 0.16, 48), material(PALETTE.path))
    plaza.position.y = 0.02
    this.scene.add(plaza)
    const plazaTiles = new THREE.GridHelper(14.2, 14, '#a79570', '#eee1bf')
    plazaTiles.position.y = 0.115
    this.scene.add(plazaTiles)
    const ring = new THREE.Mesh(new THREE.RingGeometry(6.86, 7.2, 64), new THREE.MeshBasicMaterial({ color: PALETTE.gold, transparent: true, opacity: 0.78, side: THREE.DoubleSide }))
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.11
    this.scene.add(ring)
  }

  private addSkyMotes(): void {
    const positions: number[] = []
    for (let i = 0; i < 130; i += 1) {
      const radius = 7 + Math.random() * 25
      const theta = Math.random() * Math.PI * 2
      positions.push(Math.cos(theta) * radius, 0.5 + Math.random() * 4.2, Math.sin(theta) * radius - 8)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    this.skyMotes = new THREE.Points(geometry, new THREE.PointsMaterial({ color: '#fff4b8', size: 0.11, transparent: true, opacity: 0.64, depthWrite: false }))
    this.scene.add(this.skyMotes)
  }

  /** Soft, distant set dressing makes the compact market read as an explorable outdoor world. */
  private addScenery(): void {
    const cloudMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.72, depthWrite: false })
    for (const [x, y, z, scale] of [[-18, 11, -25, 1.2], [17, 13, -30, 1.55], [2, 15, -38, 1.25]] as const) {
      const cloud = new THREE.Group()
      for (let i = 0; i < 4; i += 1) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(1.1 + (i % 2) * 0.28, 10, 8), cloudMaterial)
        puff.position.set((i - 1.5) * 0.86, Math.sin(i) * 0.18, (i % 2) * 0.18)
        cloud.add(puff)
      }
      cloud.position.set(x, y, z)
      cloud.scale.setScalar(scale)
      this.scene.add(cloud)
    }

    const rockMaterial = material('#7a8a79')
    const leafMaterial = material('#4f9f69', '#3e8f69', 0.05)
    const trunkMaterial = material('#6e4937')
    const locations = [[-19, -13], [20, -12], [-23, 7], [22, 8], [-14, 15], [15, 15]] as const
    for (const [x, z] of locations) {
      const hill = new THREE.Mesh(new THREE.DodecahedronGeometry(3.8 + Math.abs(x % 3), 1), rockMaterial)
      hill.position.set(x, 1.5, z)
      hill.scale.y = 0.72
      this.scene.add(hill)
      const tree = new THREE.Group()
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 2.6, 7), trunkMaterial)
      trunk.position.y = 1.3
      tree.add(trunk)
      for (const [dx, dy, dz, size] of [[0, 3, 0, 1.45], [-0.85, 2.55, 0.15, 1.05], [0.9, 2.45, -0.1, 1.1]] as const) {
        const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(size, 1), leafMaterial)
        crown.position.set(dx, dy, dz)
        tree.add(crown)
      }
      tree.position.set(x + 1.6, 0, z + 0.5)
      this.scene.add(tree)
    }
  }

  private addMoonGate(parent = this.scene, position = new THREE.Vector3(), scale = 1): THREE.Group {
    const gate = new THREE.Group()
    gate.position.copy(position)
    gate.scale.setScalar(scale)
    const stone = material(PALETTE.stone, PALETTE.teal, 0.04)
    const arch = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.22, 10, 32, Math.PI), stone)
    arch.rotation.z = Math.PI / 2
    arch.position.y = 2.2
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.44, 2.25, 0.42), stone)
    left.position.set(-2.15, 1.12, 0)
    const right = left.clone()
    right.position.x = 2.15
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 0.62), label('天心靈光市集', PALETTE.ivory, '#3d765f'))
    plaque.position.set(0, 3.62, 0.24)
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), new THREE.MeshBasicMaterial({ color: PALETTE.crystal, transparent: true, opacity: 0.9 }))
    crystal.position.set(0, 3.75, 0)
    gate.add(arch, left, right, plaque, crystal)
    parent.add(gate)
    return gate
  }

  private addArrivalGate(): void {
    this.addMoonGate(this.scene, new THREE.Vector3(0, 0, -9.8), 1.18)
    const heading = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 1.1), label('天心靈光市集', PALETTE.ivory, '#3d765f'))
    heading.position.set(0, 5.7, -9.55)
    this.scene.add(heading)

    const court = new THREE.Mesh(new THREE.CylinderGeometry(4.3, 4.7, 0.18, 40), material('#f0e3c8', PALETTE.gold, 0.04))
    court.position.y = 0.05
    this.scene.add(court)
  }

  private addStalls(): void {
    const venues: Venue[] = [
      { id: 'birth-chart-hall', title: '命盤探索館', subtitle: '人類圖・紫微斗數', x: -10, z: -2, accent: PALETTE.jade },
      { id: 'card-house', title: '牌卡靈感屋', subtitle: '每日一張・三張問事', x: -7.6, z: -10.2, accent: PALETTE.coral },
      { id: 'moon-meditation', title: '月光靜心所', subtitle: '呼吸・靜心・自我關照', x: 7.6, z: -10.2, accent: '#b7c7ee' },
      { id: 'chess-guide', title: '東方問事指引亭', subtitle: '連結天心仙姑象棋卜卦', x: 10, z: -2, accent: PALETTE.gold },
    ]
    for (const venue of venues) this.addVenue(venue)
    this.addServiceDesk()
  }

  /** Phase 2 venue facade: a completed-looking pavilion while its future tool stays clearly unlaunched. */
  private addVenue(venue: Venue): void {
    const group = new THREE.Group()
    group.position.set(venue.x, 0, venue.z)
    const wood = material(PALETTE.wood)
    const trim = material(venue.accent, venue.accent, 0.12)
    const foundation = new THREE.Mesh(new THREE.BoxGeometry(5.25, 0.32, 3.95), material('#d7ceb8', PALETTE.gold, 0.03))
    foundation.position.y = 0.16
    const hall = new THREE.Mesh(new THREE.BoxGeometry(4.65, 2.5, 3.28), wood)
    hall.position.y = 1.55
    const roofLower = new THREE.Mesh(new THREE.ConeGeometry(3.38, 1.14, 4), material(PALETTE.roof, venue.accent, 0.1))
    roofLower.rotation.y = Math.PI / 4
    roofLower.position.y = 3.38
    const roofCap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 0.42, 8), trim)
    roofCap.position.y = 4.14
    group.add(foundation, hall, roofLower, roofCap)

    for (const side of [-1, 1]) {
      const column = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 2.82, 10), trim)
      column.position.set(side * 2.05, 1.42, 1.48)
      const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshBasicMaterial({ color: venue.accent, transparent: true, opacity: 0.9 }))
      lantern.position.set(side * 1.78, 2.54, 1.62)
      group.add(column, lantern)
    }

    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.92, 0.66), label(venue.title, PALETTE.ivory, '#42766c'))
    sign.position.set(0, 2.48, 1.675)
    const subtitle = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 0.42), label(venue.subtitle, '#fff4cc', '#5b8c81'))
    subtitle.position.set(0, 1.65, 1.69)
    const entrance = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 1.22), material('#33555a', venue.accent, 0.08))
    entrance.position.set(0, 0.98, 1.655)
    const awning = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.11, 0.68), trim)
    awning.position.set(0, 2.05, 1.93)
    group.add(sign, subtitle, entrance, awning)
    for (const side of [-1, 1]) {
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.86), new THREE.MeshBasicMaterial({ color: venue.accent, transparent: true, opacity: 0.92, side: THREE.DoubleSide }))
      flag.position.set(side * 2.62, 3.02, 0.45)
      flag.rotation.y = side * 0.22
      const planter = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.38, 8), material('#b87952'))
      planter.position.set(side * 2.18, 0.2, 1.55)
      const flower = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 0), new THREE.MeshBasicMaterial({ color: venue.accent }))
      flower.position.set(side * 2.18, 0.62, 1.55)
      group.add(flag, planter, flower)
    }
    this.scene.add(group)
    this.physics.addStaticBox(new THREE.Vector3(venue.x, 1.35, venue.z), new THREE.Vector3(4.65, 2.7, 3.28))
  }

  /** Neutral service placeholder: it intentionally contains no invented staff, rates, or event details. */
  private addServiceDesk(): void {
    const group = new THREE.Group()
    group.position.set(0, 0, -4.7)
    const desk = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.22, 1.45), material('#8b5b3e', PALETTE.gold, 0.06))
    desk.position.y = 0.61
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.18, 2.25), material(PALETTE.roof, PALETTE.gold, 0.06))
    canopy.position.y = 2.72
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.25, 0.62), label('市 集 服 務 台', PALETTE.gold, '#34274c'))
    sign.position.set(0, 2.22, 0.75)
    const note = new THREE.Mesh(new THREE.PlaneGeometry(2.85, 0.42), label('服務資訊・LINE 預約', PALETTE.ivory, '#423358'))
    note.position.set(0, 1.62, 0.76)
    group.add(desk, canopy, sign, note)
    this.scene.add(group)
    this.physics.addStaticBox(new THREE.Vector3(0, 0.61, -4.7), new THREE.Vector3(4.4, 1.22, 1.45))
  }

  /** Gold compass lines and a central guide plaque make all five Phase 2 destinations legible on arrival. */
  private addMarketGuide(): void {
    const guide = new THREE.Group()
    const gold = new THREE.MeshBasicMaterial({ color: PALETTE.gold, transparent: true, opacity: 0.84 })
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.45, 1.62, 40), gold)
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.025
    guide.add(ring)
    for (const target of this.venuePoints) {
      const direction = new THREE.Vector3(target.position.x, 0, target.position.z).normalize()
      const length = Math.min(Math.hypot(target.position.x, target.position.z) - 2.2, 8.2)
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.035, length), gold)
      line.position.set(direction.x * (length / 2 + 1.7), 0.125, direction.z * (length / 2 + 1.7))
      line.rotation.y = Math.atan2(direction.x, direction.z)
      guide.add(line)
    }
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(2.55, 0.52), label('市 集 導 覽', PALETTE.gold, '#302343'))
    plaque.position.set(0, 2.18, 1.18)
    guide.add(plaque)
    this.scene.add(guide)
  }

  private addReturnPortal(): void {
    const portal = this.addMoonGate(this.scene, new THREE.Vector3(0, 0, 8.6), 0.8)
    const core = new THREE.Mesh(new THREE.CircleGeometry(1.36, 36), new THREE.MeshBasicMaterial({ color: PALETTE.crystal, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false }))
    core.position.set(0, 1.72, 0.03)
    portal.add(core)
    const rings = new THREE.Group()
    for (let i = 0; i < 2; i += 1) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.05 + i * 0.22, 0.035, 6, 30), new THREE.MeshBasicMaterial({ color: i ? PALETTE.gold : PALETTE.coral, transparent: true, opacity: 0.8 }))
      ring.position.set(0, 1.72, 0.08 + i * 0.02)
      rings.add(ring)
    }
    this.swirl.add(rings)
    this.swirl.position.set(0, 0, 8.6)
    this.scene.add(this.swirl)
  }

  private addAvatar(): void {
    const aura = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.52, 24), new THREE.MeshBasicMaterial({ color: PALETTE.gold, transparent: true, opacity: 0.65, side: THREE.DoubleSide }))
    aura.rotation.x = -Math.PI / 2
    aura.position.y = 0.02
    this.avatar.add(pixelAdventurer(), aura)
    this.scene.add(this.avatar)
  }

  nearestPoint(position: THREE.Vector3): MarketPoint | null {
    let nearest: MarketPoint | null = null
    let nearestDistance = Infinity
    for (const point of this.points) {
      const distance = Math.hypot(position.x - point.position.x, position.z - point.position.z)
      if (distance <= point.radius && distance < nearestDistance) {
        nearest = point
        nearestDistance = distance
      }
    }
    return nearest
  }

  update(dt: number): void {
    this.time += dt
    this.swirl.rotation.y += dt * 0.55
    this.skyMotes.rotation.y = Math.sin(this.time * 0.03) * 0.08
    const pointsMaterial = this.skyMotes.material as THREE.PointsMaterial
    pointsMaterial.opacity = 0.48 + Math.sin(this.time * 1.4) * 0.16
  }
}
