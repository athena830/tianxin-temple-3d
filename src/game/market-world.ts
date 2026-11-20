import * as THREE from 'three'
import type { Physics } from '../engine/physics'

/** Original, low-resolution palette for the market's classic isometric MMORPG presentation. */
const PALETTE = {
  sky: '#9bd8e8', grass: '#79aa62', grassDark: '#669550', path: '#cbb990', pathLight: '#e2d2aa', wood: '#73503b', woodDark: '#4a342b', roof: '#9d694f', ink: '#3b3028', cream: '#fff2cb', gold: '#e9bd5b', portal: '#83d5c7', cloud: '#fff7df',
}

export type MarketVenueId = 'birth-chart-hall' | 'card-house' | 'moon-meditation' | 'chess-guide' | 'service-desk'
export type MarketPointId = 'return-temple' | MarketVenueId
export type MarketPoint = { id: MarketPointId; title: string; subtitle: string; position: THREE.Vector3; radius: number }
type Venue = { id: MarketVenueId; title: string; subtitle: string; x: number; z: number; accent: string }

function spriteFromCanvas(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  draw(ctx)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, alphaTest: 0.08, depthWrite: true })
  return new THREE.Sprite(material)
}

function textSprite(text: string, foreground = PALETTE.cream, background = PALETTE.woodDark): THREE.Sprite {
  return spriteFromCanvas(512, 112, ctx => {
    ctx.fillStyle = PALETTE.ink; ctx.fillRect(8, 8, 496, 96)
    ctx.fillStyle = background; ctx.fillRect(16, 16, 480, 80)
    ctx.strokeStyle = PALETTE.gold; ctx.lineWidth = 7; ctx.strokeRect(18, 18, 476, 76)
    ctx.fillStyle = foreground
    ctx.font = '700 54px "Microsoft JhengHei", sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(text, 256, 58)
  })
}

function adventurerSprite(): THREE.Sprite {
  return spriteFromCanvas(48, 64, ctx => {
    ctx.fillStyle = '#4b382f'; ctx.fillRect(15, 6, 18, 14)
    ctx.fillStyle = '#f1c39d'; ctx.fillRect(18, 15, 12, 12)
    ctx.fillStyle = '#fff0b6'; ctx.fillRect(13, 9, 22, 5)
    ctx.fillStyle = '#4b7f9a'; ctx.fillRect(13, 27, 22, 20)
    ctx.fillStyle = PALETTE.gold; ctx.fillRect(13, 29, 22, 4)
    ctx.fillStyle = '#6d4938'; ctx.fillRect(14, 47, 8, 12); ctx.fillRect(26, 47, 8, 12)
    ctx.fillStyle = '#ffffff'; ctx.fillRect(20, 19, 2, 2); ctx.fillRect(27, 19, 2, 2)
  })
}

function npcSprite(accent: string): THREE.Sprite {
  return spriteFromCanvas(32, 48, ctx => {
    ctx.fillStyle = '#4d382e'; ctx.fillRect(9, 4, 14, 11)
    ctx.fillStyle = '#f0c39f'; ctx.fillRect(11, 13, 10, 9)
    ctx.fillStyle = accent; ctx.fillRect(7, 22, 18, 16)
    ctx.fillStyle = '#5d4437'; ctx.fillRect(9, 38, 6, 8); ctx.fillRect(18, 38, 6, 8)
    ctx.fillStyle = '#fff'; ctx.fillRect(13, 16, 2, 2); ctx.fillRect(18, 16, 2, 2)
  })
}

function stallSprite(accent: string): THREE.Sprite {
  return spriteFromCanvas(112, 124, ctx => {
    ctx.fillStyle = PALETTE.ink; ctx.fillRect(12, 42, 88, 70)
    ctx.fillStyle = PALETTE.wood; ctx.fillRect(17, 47, 78, 60)
    ctx.fillStyle = PALETTE.woodDark; ctx.fillRect(17, 66, 78, 7)
    ctx.fillStyle = '#e8d4ad'; ctx.fillRect(24, 77, 64, 25)
    ctx.fillStyle = accent; ctx.fillRect(16, 39, 80, 18)
    ctx.fillStyle = PALETTE.ink; ctx.fillRect(8, 29, 96, 12)
    ctx.fillStyle = PALETTE.roof; ctx.fillRect(13, 24, 86, 8)
    ctx.fillStyle = PALETTE.cream; ctx.fillRect(26, 80, 18, 11); ctx.fillRect(66, 80, 18, 11)
    ctx.fillStyle = PALETTE.woodDark; ctx.fillRect(19, 101, 9, 16); ctx.fillRect(84, 101, 9, 16)
    ctx.fillStyle = PALETTE.gold; ctx.fillRect(21, 44, 6, 14); ctx.fillRect(85, 44, 6, 14)
  })
}

function treeSprite(tint = '#47834d'): THREE.Sprite {
  return spriteFromCanvas(88, 128, ctx => {
    ctx.fillStyle = PALETTE.ink; ctx.fillRect(38, 74, 13, 48)
    ctx.fillStyle = '#79503a'; ctx.fillRect(42, 74, 7, 48)
    for (const [x, y, size] of [[18, 42, 38], [42, 25, 44], [50, 54, 34], [12, 66, 33]] as const) {
      ctx.fillStyle = PALETTE.ink; ctx.fillRect(x - 3, y - 3, size + 6, size + 6)
      ctx.fillStyle = tint; ctx.fillRect(x, y, size, size)
      ctx.fillStyle = '#76b568'; ctx.fillRect(x + 5, y + 4, Math.max(8, size - 13), 8)
    }
  })
}

function portalSprite(): THREE.Sprite {
  return spriteFromCanvas(92, 128, ctx => {
    ctx.fillStyle = PALETTE.ink; ctx.fillRect(14, 25, 64, 84)
    ctx.fillStyle = '#9d9b83'; ctx.fillRect(20, 31, 52, 72)
    ctx.fillStyle = PALETTE.portal; ctx.fillRect(27, 38, 38, 58)
    ctx.fillStyle = '#d9ffef'; ctx.fillRect(35, 44, 22, 46)
    ctx.fillStyle = PALETTE.gold; ctx.fillRect(43, 13, 8, 18)
    ctx.fillStyle = '#596c61'; ctx.fillRect(11, 103, 70, 10)
  })
}

/** Independent, fully billboarded 2.5D market world. No third-party game art is used. */
export class MarketWorld {
  readonly scene = new THREE.Scene()
  readonly spawn = new THREE.Vector3(0, 0.92, 3.4)
  readonly returnPoint: MarketPoint = { id: 'return-temple', title: '返回天心宮', subtitle: '踏入時空門，回到主殿', position: new THREE.Vector3(0, 0, 8.6), radius: 2.8 }
  readonly venuePoints: MarketPoint[] = [
    { id: 'birth-chart-hall', title: '命盤探索館', subtitle: '人類圖・紫微斗數介紹', position: new THREE.Vector3(-10, 0, 0.6), radius: 3.15 },
    { id: 'card-house', title: '牌卡靈感屋', subtitle: '每日一張牌・三張牌問事預告', position: new THREE.Vector3(-7.6, 0, -8.2), radius: 3.15 },
    { id: 'moon-meditation', title: '月光靜心所', subtitle: '呼吸・靜心・自我關照', position: new THREE.Vector3(7.6, 0, -8.2), radius: 3.15 },
    { id: 'chess-guide', title: '東方問事指引亭', subtitle: '連結天心仙姑象棋卜卦', position: new THREE.Vector3(10, 0, 0.6), radius: 3.15 },
    { id: 'service-desk', title: '市集服務台', subtitle: '服務資訊與 LINE 預約入口', position: new THREE.Vector3(0, 0, -2.6), radius: 2.9 },
  ]
  readonly points: MarketPoint[] = [...this.venuePoints, this.returnPoint]
  readonly avatar = new THREE.Group()
  private readonly portalGlows: THREE.Sprite[] = []
  private time = 0

  constructor(private readonly physics: Physics) {
    this.scene.background = new THREE.Color(PALETTE.sky)
    this.scene.fog = new THREE.Fog(PALETTE.sky, 30, 62)
    this.scene.add(new THREE.HemisphereLight('#fff9d5', '#6e8953', 1.65))
    const sun = new THREE.DirectionalLight('#fff2bc', 1.7)
    sun.position.set(-16, 24, 16)
    this.scene.add(sun)
    this.addTileMap()
    this.addBackdrop()
    this.addStalls()
    this.addServiceDesk()
    this.addArrivalGate()
    this.addReturnPortal()
    this.addAvatar()
  }

  private addTileMap(): void {
    const base = new THREE.Mesh(new THREE.PlaneGeometry(44, 44), new THREE.MeshBasicMaterial({ color: PALETTE.grassDark }))
    base.rotation.x = -Math.PI / 2
    this.scene.add(base)
    const size = 40
    const geometry = new THREE.PlaneGeometry(0.97, 0.97)
    geometry.rotateX(-Math.PI / 2)
    const material = new THREE.MeshBasicMaterial({ color: PALETTE.grass })
    const tiles = new THREE.InstancedMesh(geometry, material, size * size)
    const matrix = new THREE.Matrix4()
    let index = 0
    for (let row = 0; row < size; row += 1) for (let col = 0; col < size; col += 1) {
      const x = col - size / 2 + 0.5
      const z = row - size / 2 + 0.5
      matrix.makeTranslation(x, 0.025, z)
      tiles.setMatrixAt(index, matrix)
      index += 1
    }
    tiles.instanceMatrix.needsUpdate = true
    this.scene.add(tiles)
    const pathMaterial = new THREE.MeshBasicMaterial({ color: PALETTE.pathLight })
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(7.35, 48), pathMaterial)
    plaza.rotation.x = -Math.PI / 2
    plaza.position.y = 0.04
    this.scene.add(plaza)
    const northPath = new THREE.Mesh(new THREE.PlaneGeometry(1.14, 21.2), pathMaterial)
    northPath.rotation.x = -Math.PI / 2
    northPath.position.set(0, 0.04, -3)
    this.scene.add(northPath)
    const westPath = new THREE.Mesh(new THREE.PlaneGeometry(17.2, 1.14), pathMaterial)
    westPath.rotation.x = -Math.PI / 2
    westPath.position.set(0, 0.04, -9.8)
    this.scene.add(westPath)
    this.physics.addStaticBox(new THREE.Vector3(0, -0.2, 0), new THREE.Vector3(44, 0.4, 44))
  }

  private addBackdrop(): void {
    const trees = [[-17, -13, 4.8], [-14, 12, 5.2], [-19, 3, 4.2], [18, -12, 5.3], [16, 11, 5.6], [21, 4, 4.4], [-2, -18, 4.5]] as const
    for (const [x, z, height] of trees) {
      const tree = treeSprite((x + z) % 2 ? '#4a8250' : '#568d4d')
      tree.position.set(x, height / 2, z)
      tree.scale.set(height * 0.7, height, 1)
      this.scene.add(tree)
    }
    for (const [x, y, z, scale] of [[-16, 10, -18, 3.2], [16, 12, -20, 3.8]] as const) {
      const cloud = spriteFromCanvas(128, 52, ctx => {
        ctx.fillStyle = PALETTE.cloud
        ctx.fillRect(12, 24, 104, 16); ctx.fillRect(29, 14, 32, 20); ctx.fillRect(62, 7, 38, 28)
      })
      cloud.position.set(x, y, z)
      cloud.scale.set(scale, scale * 0.4, 1)
      this.scene.add(cloud)
    }
  }

  private addStalls(): void {
    const venues: Venue[] = [
      { id: 'birth-chart-hall', title: '命盤探索館', subtitle: '人類圖・紫微斗數介紹', x: -10, z: -2, accent: '#6cae8d' },
      { id: 'card-house', title: '牌卡靈感屋', subtitle: '每日一張牌・三張牌問事預告', x: -7.6, z: -10.2, accent: '#cf7f77' },
      { id: 'moon-meditation', title: '月光靜心所', subtitle: '呼吸・靜心・自我關照', x: 7.6, z: -10.2, accent: '#8c94c8' },
      { id: 'chess-guide', title: '東方問事指引亭', subtitle: '連結天心仙姑象棋卜卦', x: 10, z: -2, accent: PALETTE.gold },
    ]
    for (const venue of venues) this.addVenue(venue)
  }

  private addVenue(venue: Venue): void {
    const group = new THREE.Group()
    group.position.set(venue.x, 0, venue.z)
    const stall = stallSprite(venue.accent)
    stall.position.y = 2.8
    stall.scale.set(5.9, 6.55, 1)
    const sign = textSprite(venue.title, PALETTE.cream, venue.accent)
    sign.position.set(0, 5.7, 0.05)
    sign.scale.set(4.2, 0.92, 1)
    const npc = npcSprite(venue.accent)
    npc.position.set(0.85, 1.08, 1.42)
    npc.scale.set(1.05, 1.58, 1)
    group.add(stall, sign, npc)
    this.scene.add(group)
    this.physics.addStaticBox(new THREE.Vector3(venue.x, 1.1, venue.z), new THREE.Vector3(4.6, 2.2, 3.1))
  }

  private addServiceDesk(): void {
    const group = new THREE.Group()
    group.position.set(0, 0, -4.7)
    const desk = stallSprite('#79a4bb')
    desk.position.y = 2.15
    desk.scale.set(4.25, 4.72, 1)
    const sign = textSprite('市集服務台', PALETTE.cream, '#4f7f88')
    sign.position.set(0, 4.4, 0.05)
    sign.scale.set(3.75, 0.82, 1)
    const npc = npcSprite('#79a4bb')
    npc.position.set(0.55, 0.9, 1.15)
    npc.scale.set(0.88, 1.32, 1)
    group.add(desk, sign, npc)
    this.scene.add(group)
    this.physics.addStaticBox(new THREE.Vector3(0, 0.8, -4.7), new THREE.Vector3(4.2, 1.6, 2.3))
  }

  private addGate(position: THREE.Vector3, scale: number, title: string): THREE.Group {
    const group = new THREE.Group()
    group.position.copy(position)
    const gate = portalSprite()
    gate.position.y = 2.7 * scale
    gate.scale.set(4.4 * scale, 6.12 * scale, 1)
    const sign = textSprite(title, PALETTE.cream, '#4f796a')
    sign.position.y = 5.55 * scale
    sign.scale.set(3.7 * scale, 0.8 * scale, 1)
    group.add(gate, sign)
    this.scene.add(group)
    return group
  }

  private addArrivalGate(): void {
    this.addGate(new THREE.Vector3(0, 0, -9.8), 1.1, '天心靈光市集')
    const sign = textSprite('探索四館', PALETTE.cream, '#5b8b67')
    sign.position.set(0, 1.65, 1.15)
    sign.scale.set(2.9, 0.64, 1)
    this.scene.add(sign)
  }

  private addReturnPortal(): void {
    const portal = this.addGate(new THREE.Vector3(0, 0, 8.6), 0.82, '返回天心宮')
    const glow = spriteFromCanvas(64, 64, ctx => {
      ctx.fillStyle = '#d9ffef'; ctx.fillRect(10, 10, 44, 44)
      ctx.fillStyle = PALETTE.portal; ctx.fillRect(17, 17, 30, 30)
    })
    glow.position.set(0, 2.2, 0.03)
    glow.scale.set(2.25, 2.25, 1)
    ;(glow.material as THREE.SpriteMaterial).depthWrite = false
    portal.add(glow)
    this.portalGlows.push(glow)
  }

  private addAvatar(): void {
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.46, 16), new THREE.MeshBasicMaterial({ color: '#30422f', transparent: true, opacity: 0.36, depthWrite: false }))
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = 0.035
    const sprite = adventurerSprite()
    sprite.position.y = 0.92
    sprite.scale.set(1.3, 1.74, 1)
    this.avatar.add(shadow, sprite)
    this.scene.add(this.avatar)
  }

  nearestPoint(position: THREE.Vector3): MarketPoint | null {
    let nearest: MarketPoint | null = null
    let nearestDistance = Infinity
    for (const point of this.points) {
      const distance = Math.hypot(position.x - point.position.x, position.z - point.position.z)
      if (distance <= point.radius && distance < nearestDistance) { nearest = point; nearestDistance = distance }
    }
    return nearest
  }

  update(dt: number): void {
    this.time += dt
    const pulse = 1 + Math.sin(this.time * 2.6) * 0.08
    for (const glow of this.portalGlows) glow.scale.setScalar(2.25 * pulse)
  }
}
