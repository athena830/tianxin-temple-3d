import * as THREE from 'three'
import type { Physics } from '../engine/physics'

const PALETTE = {
  sky: '#161B3B', purple: '#544B8A', jade: '#7FB7AD', gold: '#F3C57A', pink: '#F5A7C0', ivory: '#F2E9D8', wood: '#3d2d3e', stone: '#403b61',
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

function label(text: string, foreground = PALETTE.ivory, background = PALETTE.purple): THREE.MeshBasicMaterial {
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

/** A lightweight world with its own scene and Rapier colliders. It never shares temple objects. */
export class MarketWorld {
  readonly scene = new THREE.Scene()
  /** Arrival is in the central court, facing the four future venues rather than the return portal. */
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
  private stars!: THREE.Points
  private time = 0

  constructor(private readonly physics: Physics) {
    this.scene.background = new THREE.Color(PALETTE.sky)
    this.scene.fog = new THREE.Fog(PALETTE.sky, 24, 62)
    this.scene.add(new THREE.HemisphereLight('#8aaec1', '#211c39', 1.15))
    const moonLight = new THREE.DirectionalLight('#c9ebe1', 1.25)
    moonLight.position.set(-18, 28, 12)
    this.scene.add(moonLight)

    this.addGround()
    this.addStars()
    this.addArrivalGate()
    this.addStalls()
    this.addMarketGuide()
    this.addReturnPortal()
    this.addAvatar()
  }

  private addGround(): void {
    const ground = new THREE.Mesh(new THREE.CircleGeometry(23, 64), material('#26274a'))
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    this.scene.add(ground)
    this.physics.addStaticBox(new THREE.Vector3(0, -0.2, 0), new THREE.Vector3(46, 0.4, 46))

    const ring = new THREE.Mesh(new THREE.RingGeometry(6.9, 7.25, 64), new THREE.MeshBasicMaterial({ color: PALETTE.jade, transparent: true, opacity: 0.36, side: THREE.DoubleSide }))
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.012
    this.scene.add(ring)
  }

  private addStars(): void {
    const positions: number[] = []
    for (let i = 0; i < 220; i += 1) {
      const radius = 18 + Math.random() * 42
      const theta = Math.random() * Math.PI * 2
      positions.push(Math.cos(theta) * radius, 8 + Math.random() * 26, Math.sin(theta) * radius - 8)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    this.stars = new THREE.Points(geometry, new THREE.PointsMaterial({ color: '#f8e7a5', size: 0.13, transparent: true, opacity: 0.82, depthWrite: false }))
    this.scene.add(this.stars)
  }

  private addMoonGate(parent = this.scene, position = new THREE.Vector3(), scale = 1): THREE.Group {
    const gate = new THREE.Group()
    gate.position.copy(position)
    gate.scale.setScalar(scale)
    const stone = material('#77709d', PALETTE.purple, 0.08)
    const arch = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.22, 10, 32, Math.PI), stone)
    arch.rotation.z = Math.PI / 2
    arch.position.y = 2.2
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.44, 2.25, 0.42), stone)
    left.position.set(-2.15, 1.12, 0)
    const right = left.clone()
    right.position.x = 2.15
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 0.62), label('天心靈光市集', PALETTE.gold, '#302343'))
    plaque.position.set(0, 3.62, 0.24)
    gate.add(arch, left, right, plaque)
    parent.add(gate)
    return gate
  }

  private addArrivalGate(): void {
    this.addMoonGate(this.scene, new THREE.Vector3(0, 0, -9.8), 1.18)
    const heading = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 1.1), label('天心靈光市集', PALETTE.ivory, '#3a315e'))
    heading.position.set(0, 5.7, -9.55)
    this.scene.add(heading)

    const court = new THREE.Mesh(new THREE.CylinderGeometry(4.3, 4.7, 0.18, 40), material('#3d3b65', PALETTE.jade, 0.12))
    court.position.y = 0.05
    this.scene.add(court)
  }

  private addStalls(): void {
    const venues: Venue[] = [
      { id: 'birth-chart-hall', title: '命盤探索館', subtitle: '人類圖・紫微斗數', x: -10, z: -2, accent: PALETTE.jade },
      { id: 'card-house', title: '牌卡靈感屋', subtitle: '每日一張・三張問事', x: -7.6, z: -10.2, accent: PALETTE.pink },
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
    const trim = material(venue.accent, venue.accent, 0.16)
    const foundation = new THREE.Mesh(new THREE.BoxGeometry(5.25, 0.32, 3.95), material('#575273', PALETTE.purple, 0.08))
    foundation.position.y = 0.16
    const hall = new THREE.Mesh(new THREE.BoxGeometry(4.65, 2.5, 3.28), wood)
    hall.position.y = 1.55
    const roofLower = new THREE.Mesh(new THREE.ConeGeometry(3.38, 1.14, 4), material('#292342', venue.accent, 0.16))
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

    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.92, 0.66), label(venue.title, PALETTE.ivory, '#453861'))
    sign.position.set(0, 2.48, 1.675)
    const subtitle = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 0.42), label(venue.subtitle, PALETTE.gold, '#312743'))
    subtitle.position.set(0, 1.65, 1.69)
    const entrance = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 1.22), material('#211c39', venue.accent, 0.08))
    entrance.position.set(0, 0.98, 1.655)
    group.add(sign, subtitle, entrance)
    this.scene.add(group)
    this.physics.addStaticBox(new THREE.Vector3(venue.x, 1.35, venue.z), new THREE.Vector3(4.65, 2.7, 3.28))
  }

  /** Neutral service placeholder: it intentionally contains no invented staff, rates, or event details. */
  private addServiceDesk(): void {
    const group = new THREE.Group()
    group.position.set(0, 0, -4.7)
    const desk = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.22, 1.45), material('#473451', PALETTE.gold, 0.1))
    desk.position.y = 0.61
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.18, 2.25), material('#2a2445', PALETTE.gold, 0.08))
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
    const gold = new THREE.MeshBasicMaterial({ color: PALETTE.gold, transparent: true, opacity: 0.75 })
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.45, 1.62, 40), gold)
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.025
    guide.add(ring)
    for (const target of this.venuePoints) {
      const direction = new THREE.Vector3(target.position.x, 0, target.position.z).normalize()
      const length = Math.min(Math.hypot(target.position.x, target.position.z) - 2.2, 8.2)
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.025, length), gold)
      line.position.set(direction.x * (length / 2 + 1.7), 0.028, direction.z * (length / 2 + 1.7))
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
    const core = new THREE.Mesh(new THREE.CircleGeometry(1.36, 36), new THREE.MeshBasicMaterial({ color: PALETTE.jade, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false }))
    core.position.set(0, 1.72, 0.03)
    portal.add(core)
    const rings = new THREE.Group()
    for (let i = 0; i < 2; i += 1) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.05 + i * 0.22, 0.035, 6, 30), new THREE.MeshBasicMaterial({ color: i ? PALETTE.gold : PALETTE.pink, transparent: true, opacity: 0.8 }))
      ring.position.set(0, 1.72, 0.08 + i * 0.02)
      rings.add(ring)
    }
    this.swirl.add(rings)
    this.swirl.position.set(0, 0, 8.6)
    this.scene.add(this.swirl)
  }

  private addAvatar(): void {
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.62, 4, 10), material('#f0d9c6', PALETTE.pink, 0.05))
    body.position.y = 0.72
    const aura = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.52, 24), new THREE.MeshBasicMaterial({ color: PALETTE.gold, transparent: true, opacity: 0.65, side: THREE.DoubleSide }))
    aura.rotation.x = -Math.PI / 2
    aura.position.y = 0.02
    this.avatar.add(body, aura)
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
    this.stars.rotation.y = Math.sin(this.time * 0.03) * 0.08
    const pointsMaterial = this.stars.material as THREE.PointsMaterial
    pointsMaterial.opacity = 0.62 + Math.sin(this.time * 1.4) * 0.2
  }
}
