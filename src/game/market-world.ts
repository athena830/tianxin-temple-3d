import * as THREE from 'three'
import type { Physics } from '../engine/physics'

const PALETTE = {
  sky: '#161B3B', purple: '#544B8A', jade: '#7FB7AD', gold: '#F3C57A', pink: '#F5A7C0', ivory: '#F2E9D8', wood: '#3d2d3e', stone: '#403b61',
}

export type MarketPoint = { id: 'return-temple'; title: string; subtitle: string; position: THREE.Vector3; radius: number }

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
    const stalls = [
      ['命盤探索館', -10, -2, PALETTE.jade],
      ['牌卡靈感屋', -7.6, -10.2, PALETTE.pink],
      ['月光靜心所', 7.6, -10.2, '#b7c7ee'],
      ['東方問事指引亭', 10, -2, PALETTE.gold],
    ] as const
    for (const [title, x, z, accent] of stalls) {
      const group = new THREE.Group()
      group.position.set(x, 0, z)
      const base = new THREE.Mesh(new THREE.BoxGeometry(4.7, 2.8, 3.4), material(PALETTE.wood))
      base.position.y = 1.4
      const roof = new THREE.Mesh(new THREE.ConeGeometry(3.25, 1.5, 4), material('#2a2445', accent, 0.12))
      roof.rotation.y = Math.PI / 4
      roof.position.y = 3.5
      const awning = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 0.7), label(title, PALETTE.ivory, '#453861'))
      awning.position.set(0, 2.25, 1.73)
      const coming = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.44), label('即將開放', PALETTE.gold, '#312743'))
      coming.position.set(0, 1.42, 1.75)
      group.add(base, roof, awning, coming)
      this.scene.add(group)
      this.physics.addStaticBox(new THREE.Vector3(x, 1.4, z), new THREE.Vector3(4.7, 2.8, 3.4))
    }
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
    return Math.hypot(position.x - this.returnPoint.position.x, position.z - this.returnPoint.position.z) <= this.returnPoint.radius ? this.returnPoint : null
  }

  update(dt: number): void {
    this.time += dt
    this.swirl.rotation.y += dt * 0.55
    this.stars.rotation.y = Math.sin(this.time * 0.03) * 0.08
    const pointsMaterial = this.stars.material as THREE.PointsMaterial
    pointsMaterial.opacity = 0.62 + Math.sin(this.time * 1.4) * 0.2
  }
}
