import * as THREE from 'three'
import type { Physics } from '../engine/physics'

/** Warm, vibrant Prontera-inspired sunlit palette for the 2.5D RO-style Aura Market. */
const PALETTE = {
  sky: '#9ad6eb',
  grass: '#74ab57',
  grassLight: '#89be66',
  grassDark: '#5b8e45',
  stone: '#d9cbb0',
  stoneLight: '#ede1c8',
  stoneDark: '#b2a082',
  stoneBorder: '#8d7d65',
  wood: '#7d5438',
  woodLight: '#a6744e',
  woodDark: '#4a3123',
  roof: '#a65d47',
  ink: '#2d221c',
  cream: '#fff6de',
  gold: '#f0c45d',
  portal: '#6ee5d8',
  portalLight: '#dcfff9',
  water: '#5cc4dc',
  waterLight: '#b9f3ff',
  cloud: '#fffaf0',
}

export type MarketVenueId = 'birth-chart-hall' | 'card-house' | 'moon-meditation' | 'chess-guide' | 'service-desk'
export type MarketPointId = 'return-temple' | MarketVenueId
export type MarketPoint = { id: MarketPointId; title: string; subtitle: string; position: THREE.Vector3; radius: number }

type VenueSpec = {
  id: MarketVenueId
  title: string
  subtitle: string
  chatTag: string
  x: number
  z: number
  rotY: number
  accent: string
  npcStyle: 'sage' | 'oracle' | 'priestess' | 'taoist' | 'kafra'
}

type AnimatedNpc = {
  sprite: THREE.Sprite
  baseY: number
  phase: number
  emote?: THREE.Sprite
  emoteBaseY?: number
  emoteTimer: number
}

type AuraSlime = {
  group: THREE.Group
  sprite: THREE.Sprite
  shadow: THREE.Mesh
  homeX: number
  homeZ: number
  radius: number
  speed: number
  phase: number
  hopPhase: number
}

type Stroller = {
  group: THREE.Group
  sprite: THREE.Sprite
  orbitRadius: number
  angle: number
  speed: number
  bobPhase: number
}

function makePixelTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
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
  if (repeatX > 1 || repeatY > 1) {
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(repeatX, repeatY)
  }
  return texture
}

function spriteFromCanvas(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.Sprite {
  const texture = makePixelTexture(width, height, draw)
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, alphaTest: 0.08, depthWrite: true })
  return new THREE.Sprite(material)
}

/** Classic RO floating chatroom / shop signboard bubble. */
function roChatSignSprite(title: string, subtitle: string, accent: string): THREE.Sprite {
  return spriteFromCanvas(512, 128, ctx => {
    // Outer pixel border
    ctx.fillStyle = '#24303c'
    ctx.fillRect(10, 8, 492, 98)
    // Inner parchment / pale blue RO window fill
    ctx.fillStyle = '#f6f9ff'
    ctx.fillRect(16, 14, 480, 86)
    // Classic RO top accent bar
    ctx.fillStyle = accent
    ctx.fillRect(16, 14, 480, 26)
    // Highlight line
    ctx.fillStyle = 'rgba(255,255,255,0.45)'
    ctx.fillRect(16, 14, 480, 5)
    // Pointer triangle at bottom
    ctx.fillStyle = '#24303c'
    ctx.beginPath()
    ctx.moveTo(240, 106)
    ctx.lineTo(272, 106)
    ctx.lineTo(256, 124)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#f6f9ff'
    ctx.beginPath()
    ctx.moveTo(246, 100)
    ctx.lineTo(266, 100)
    ctx.lineTo(256, 115)
    ctx.closePath()
    ctx.fill()
    // Subtitle in header bar
    ctx.fillStyle = '#ffffff'
    ctx.font = '700 20px "Microsoft JhengHei", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(subtitle, 256, 28)
    // Main venue title
    ctx.fillStyle = '#223142'
    ctx.font = '700 42px "Microsoft JhengHei", sans-serif'
    ctx.fillText(title, 256, 70)
  })
}

/** Classic RO small overhead name tag. */
function roNameTagSprite(text: string, color = '#fff7d6'): THREE.Sprite {
  return spriteFromCanvas(256, 56, ctx => {
    ctx.font = '700 30px "Microsoft JhengHei", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineWidth = 7
    ctx.strokeStyle = 'rgba(24, 32, 42, 0.88)'
    ctx.strokeText(text, 128, 28)
    ctx.fillStyle = color
    ctx.fillText(text, 128, 28)
  })
}

/** Classic RO emote bubble (/lv, /!, /music). */
function roEmoteSprite(kind: 'heart' | 'sparkle' | 'music'): THREE.Sprite {
  return spriteFromCanvas(64, 64, ctx => {
    // White rounded speech bubble
    ctx.fillStyle = '#263445'
    ctx.fillRect(10, 8, 44, 38)
    ctx.fillRect(6, 12, 52, 30)
    ctx.fillRect(26, 46, 10, 8)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(12, 10, 40, 34)
    ctx.fillRect(8, 14, 48, 26)
    ctx.fillRect(28, 44, 6, 7)

    if (kind === 'heart') {
      ctx.fillStyle = '#ee5a74'
      ctx.fillRect(18, 18, 10, 10)
      ctx.fillRect(36, 18, 10, 10)
      ctx.fillRect(16, 22, 32, 10)
      ctx.fillRect(22, 32, 20, 6)
      ctx.fillRect(28, 38, 8, 4)
    } else if (kind === 'sparkle') {
      ctx.fillStyle = '#f2b830'
      ctx.fillRect(30, 14, 4, 24)
      ctx.fillRect(20, 24, 24, 4)
      ctx.fillRect(26, 20, 12, 12)
      ctx.fillStyle = '#fff5c2'
      ctx.fillRect(29, 23, 6, 6)
    } else {
      ctx.fillStyle = '#4c8cd8'
      ctx.fillRect(24, 16, 4, 20)
      ctx.fillRect(40, 14, 4, 20)
      ctx.fillRect(24, 16, 20, 5)
      ctx.fillRect(18, 32, 10, 8)
      ctx.fillRect(34, 30, 10, 8)
    }
  })
}

/** Draw a 4-frame RO Novice/Adventurer pixel-art character texture. */
function makeAdventurerFrameTexture(frame: number): THREE.CanvasTexture {
  // frame 0: idle, 1: left step, 2: neutral stride, 3: right step
  const bob = frame === 1 || frame === 3 ? -2 : 0
  const leftLegY = frame === 1 ? 47 : frame === 3 ? 50 : 49
  const rightLegY = frame === 3 ? 47 : frame === 1 ? 50 : 49
  const capeShift = frame === 1 ? -2 : frame === 3 ? 2 : 0

  return makePixelTexture(48, 64, ctx => {
    // Flowing adventurer cloak behind body
    ctx.fillStyle = PALETTE.ink
    ctx.fillRect(10 + capeShift, 28 + bob, 28, 22)
    ctx.fillStyle = '#3f6f8f'
    ctx.fillRect(12 + capeShift, 30 + bob, 24, 18)
    ctx.fillStyle = '#5c94b8'
    ctx.fillRect(14 + capeShift, 31 + bob, 8, 14)

    // Hair & cute RO chibi head outline
    ctx.fillStyle = PALETTE.ink
    ctx.fillRect(12, 5 + bob, 24, 23)
    ctx.fillRect(10, 9 + bob, 28, 16)
    // Chestnut hair
    ctx.fillStyle = '#593d2e'
    ctx.fillRect(14, 7 + bob, 20, 12)
    ctx.fillRect(12, 11 + bob, 24, 8)
    // Hair highlight
    ctx.fillStyle = '#805943'
    ctx.fillRect(16, 8 + bob, 14, 3)
    // Headband (classic RO novice ribbon)
    ctx.fillStyle = '#f2c85b'
    ctx.fillRect(12, 12 + bob, 24, 3)
    ctx.fillStyle = '#e25959'
    ctx.fillRect(21, 11 + bob, 6, 4)

    // Face
    ctx.fillStyle = '#fad2b0'
    ctx.fillRect(15, 16 + bob, 18, 11)
    // Rosy cheeks
    ctx.fillStyle = '#f59fa0'
    ctx.fillRect(16, 22 + bob, 3, 2)
    ctx.fillRect(29, 22 + bob, 3, 2)
    // Crisp RO eyes
    ctx.fillStyle = '#241b17'
    ctx.fillRect(18, 19 + bob, 3, 4)
    ctx.fillRect(27, 19 + bob, 3, 4)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(19, 19 + bob, 1, 2)
    ctx.fillRect(28, 19 + bob, 1, 2)

    // Tunic & scarf
    ctx.fillStyle = PALETTE.ink
    ctx.fillRect(13, 27 + bob, 22, 22)
    ctx.fillStyle = '#fff5dc'
    ctx.fillRect(15, 29 + bob, 18, 18)
    // Blue novice vest + gold trim
    ctx.fillStyle = '#4d87aa'
    ctx.fillRect(16, 31 + bob, 16, 13)
    ctx.fillStyle = PALETTE.gold
    ctx.fillRect(15, 42 + bob, 18, 3)
    // Red neck scarf
    ctx.fillStyle = '#df5b57'
    ctx.fillRect(15, 28 + bob, 18, 4)

    // Arms swinging
    ctx.fillStyle = PALETTE.ink
    ctx.fillRect(9, 31 + bob + (frame === 1 ? -2 : 0), 5, 12)
    ctx.fillRect(34, 31 + bob + (frame === 3 ? -2 : 0), 5, 12)
    ctx.fillStyle = '#fad2b0'
    ctx.fillRect(10, 39 + bob + (frame === 1 ? -2 : 0), 3, 3)
    ctx.fillRect(35, 39 + bob + (frame === 3 ? -2 : 0), 3, 3)

    // Boots
    ctx.fillStyle = PALETTE.ink
    ctx.fillRect(14, leftLegY, 8, 12)
    ctx.fillRect(26, rightLegY, 8, 12)
    ctx.fillStyle = '#734a34'
    ctx.fillRect(15, leftLegY + 2, 6, 8)
    ctx.fillRect(27, rightLegY + 2, 6, 8)
    ctx.fillStyle = '#a6744e'
    ctx.fillRect(16, leftLegY + 3, 4, 2)
    ctx.fillRect(28, rightLegY + 3, 4, 2)
  })
}

/** Job-inspired RO pixel-art NPCs for each venue. */
function makeNpcSprite(style: VenueSpec['npcStyle'], accent: string): THREE.Sprite {
  return spriteFromCanvas(48, 64, ctx => {
    // Outline
    ctx.fillStyle = PALETTE.ink
    ctx.fillRect(13, 8, 22, 20)
    ctx.fillRect(11, 28, 26, 22)
    ctx.fillRect(14, 50, 8, 10)
    ctx.fillRect(26, 50, 8, 10)

    // Hair color by job
    const hair = style === 'kafra' ? '#3f5a99' : style === 'priestess' ? '#6c5a99' : style === 'oracle' ? '#8c3d4f' : style === 'taoist' ? '#3a3430' : '#5e4332'
    ctx.fillStyle = hair
    ctx.fillRect(15, 10, 18, 11)
    ctx.fillRect(13, 14, 22, 10)

    // Job headgear
    if (style === 'kafra') {
      // Classic Kafra white frilly maid headband
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(12, 8, 24, 5)
      ctx.fillRect(16, 5, 16, 4)
      ctx.fillStyle = '#76b5e8'
      ctx.fillRect(18, 9, 12, 2)
    } else if (style === 'sage') {
      // Scholar beret with gold tassel
      ctx.fillStyle = '#3c7a5e'
      ctx.fillRect(11, 5, 26, 7)
      ctx.fillStyle = PALETTE.gold
      ctx.fillRect(32, 9, 4, 8)
    } else if (style === 'oracle') {
      // Starry headband with ruby gem
      ctx.fillStyle = PALETTE.gold
      ctx.fillRect(13, 11, 22, 3)
      ctx.fillStyle = '#f25c78'
      ctx.fillRect(22, 9, 4, 5)
    } else if (style === 'priestess') {
      // Crescent moon circlet
      ctx.fillStyle = '#e9f0ff'
      ctx.fillRect(19, 4, 10, 4)
      ctx.fillRect(21, 8, 6, 3)
    } else if (style === 'taoist') {
      // Traditional gold hair crown
      ctx.fillStyle = PALETTE.gold
      ctx.fillRect(18, 4, 12, 7)
      ctx.fillStyle = '#d44c3c'
      ctx.fillRect(22, 6, 4, 3)
    }

    // Face
    ctx.fillStyle = '#fbe0c4'
    ctx.fillRect(16, 17, 16, 10)
    ctx.fillStyle = '#241b17'
    ctx.fillRect(19, 20, 2, 3)
    ctx.fillRect(27, 20, 2, 3)
    ctx.fillStyle = '#f5a6a6'
    ctx.fillRect(17, 23, 2, 2)
    ctx.fillRect(29, 23, 2, 2)

    // Outfit
    ctx.fillStyle = accent
    ctx.fillRect(13, 30, 22, 18)
    // Apron / robe front trim
    ctx.fillStyle = style === 'kafra' ? '#ffffff' : PALETTE.cream
    ctx.fillRect(18, 31, 12, 17)
    ctx.fillStyle = PALETTE.gold
    ctx.fillRect(14, 36, 20, 3)

    // Shoes
    ctx.fillStyle = '#5c3c2c'
    ctx.fillRect(15, 51, 6, 7)
    ctx.fillRect(27, 51, 6, 7)
  })
}

/** Cute RO Poring-inspired translucent Aura Slime pixel sprite. */
function makeAuraSlimeSprite(bodyColor: string, lightColor: string, darkColor: string): THREE.Sprite {
  return spriteFromCanvas(48, 40, ctx => {
    // Pixel outline
    ctx.fillStyle = darkColor
    ctx.fillRect(12, 8, 24, 28)
    ctx.fillRect(8, 14, 32, 20)
    ctx.fillRect(6, 20, 36, 12)
    // Top cute drop tip
    ctx.fillRect(20, 3, 8, 7)
    // Main jelly body
    ctx.fillStyle = bodyColor
    ctx.fillRect(14, 10, 20, 24)
    ctx.fillRect(10, 16, 28, 16)
    ctx.fillRect(8, 21, 32, 10)
    ctx.fillRect(22, 5, 4, 6)
    // Glossy specular highlight
    ctx.fillStyle = lightColor
    ctx.fillRect(14, 13, 8, 4)
    ctx.fillRect(12, 17, 4, 4)
    // Cute dot eyes & smile
    ctx.fillStyle = '#2d1c22'
    ctx.fillRect(16, 21, 3, 4)
    ctx.fillRect(29, 21, 3, 4)
    ctx.fillRect(22, 25, 4, 2)
    // Blush cheeks
    ctx.fillStyle = '#ff8ba0'
    ctx.fillRect(12, 24, 3, 2)
    ctx.fillRect(33, 24, 3, 2)
  })
}

/** Lush RO-style 2.5D layered pixel tree. */
function treeSprite(tint = '#478b4d', highlight = '#7cc26b'): THREE.Sprite {
  return spriteFromCanvas(96, 136, ctx => {
    // Trunk
    ctx.fillStyle = PALETTE.ink
    ctx.fillRect(40, 78, 16, 52)
    ctx.fillStyle = '#7c5036'
    ctx.fillRect(43, 80, 10, 48)
    ctx.fillStyle = '#a16b4a'
    ctx.fillRect(44, 82, 4, 44)
    // Layered foliage puffs
    for (const [x, y, w, h] of [
      [14, 54, 42, 34],
      [42, 52, 40, 36],
      [20, 26, 56, 40],
      [30, 12, 36, 26],
    ] as const) {
      ctx.fillStyle = PALETTE.ink
      ctx.fillRect(x - 3, y - 3, w + 6, h + 6)
      ctx.fillStyle = tint
      ctx.fillRect(x, y, w, h)
      ctx.fillStyle = highlight
      ctx.fillRect(x + 5, y + 4, Math.max(10, w - 16), 9)
    }
    // Tiny sunlit blossoms
    ctx.fillStyle = '#fff0a8'
    ctx.fillRect(28, 38, 4, 4)
    ctx.fillRect(58, 34, 4, 4)
    ctx.fillRect(44, 60, 4, 4)
  })
}

/** Procedural pixel-art sunlit grass tile with clover & wildflowers. */
function makeGrassTexture(): THREE.CanvasTexture {
  return makePixelTexture(
    64,
    64,
    ctx => {
      ctx.fillStyle = PALETTE.grass
      ctx.fillRect(0, 0, 64, 64)
      // Subtle pixel turf dithering
      ctx.fillStyle = PALETTE.grassLight
      for (const [x, y] of [[6, 8], [22, 14], [44, 6], [54, 28], [14, 38], [34, 48], [50, 56], [8, 54]] as const) {
        ctx.fillRect(x, y, 4, 2)
        ctx.fillRect(x + 2, y - 2, 2, 2)
      }
      ctx.fillStyle = PALETTE.grassDark
      for (const [x, y] of [[16, 22], [38, 18], [28, 34], [56, 44], [20, 58]] as const) {
        ctx.fillRect(x, y, 4, 2)
      }
      // Tiny RO wildflowers
      ctx.fillStyle = '#fff6b8'
      ctx.fillRect(10, 26, 2, 2)
      ctx.fillRect(48, 16, 2, 2)
      ctx.fillStyle = '#ffbdd0'
      ctx.fillRect(36, 42, 2, 2)
    },
    18,
    18,
  )
}

/** Procedural Prontera-style warm cobblestone plaza tile texture. */
function makeCobbleTexture(repeatX = 6, repeatY = 6): THREE.CanvasTexture {
  return makePixelTexture(
    64,
    64,
    ctx => {
      ctx.fillStyle = PALETTE.stoneDark
      ctx.fillRect(0, 0, 64, 64)
      const bricks = [
        [2, 2, 28, 13], [32, 2, 30, 13],
        [2, 17, 14, 13], [18, 17, 28, 13], [48, 17, 14, 13],
        [2, 32, 30, 13], [34, 32, 28, 13],
        [2, 47, 18, 15], [22, 47, 26, 15], [50, 47, 12, 15],
      ] as const
      for (let i = 0; i < bricks.length; i += 1) {
        const [x, y, w, h] = bricks[i]
        ctx.fillStyle = i % 3 === 0 ? PALETTE.stoneLight : PALETTE.stone
        ctx.fillRect(x, y, w, h)
        ctx.fillStyle = 'rgba(255,255,255,0.32)'
        ctx.fillRect(x, y, w, 2)
      }
    },
    repeatX,
    repeatY,
  )
}

/** Procedural striped canvas awning texture for RO market stalls. */
function makeAwningTexture(accent: string): THREE.CanvasTexture {
  return makePixelTexture(64, 32, ctx => {
    for (let i = 0; i < 8; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? accent : PALETTE.cream
      ctx.fillRect(i * 8, 0, 8, 28)
      ctx.fillStyle = i % 2 === 0 ? PALETTE.ink : '#d9ccb0'
      ctx.fillRect(i * 8, 28, 8, 4)
    }
  })
}

/** Procedural spinning magic warp circle texture (RO blue/cyan portal rune). */
function makeWarpRuneTexture(): THREE.CanvasTexture {
  return makePixelTexture(128, 128, ctx => {
    const cx = 64
    const cy = 64
    // Soft cyan glow
    const grad = ctx.createRadialGradient(cx, cy, 8, cx, cy, 60)
    grad.addColorStop(0, 'rgba(220, 255, 250, 0.95)')
    grad.addColorStop(0.55, 'rgba(110, 229, 216, 0.55)')
    grad.addColorStop(1, 'rgba(110, 229, 216, 0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 128, 128)

    // Outer rune ring
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(cx, cy, 52, 0, Math.PI * 2)
    ctx.stroke()

    ctx.strokeStyle = '#f2d06b'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(cx, cy, 42, 0, Math.PI * 2)
    ctx.stroke()

    // 6-point magic star
    ctx.strokeStyle = '#d8fff8'
    ctx.lineWidth = 2.5
    for (let t = 0; t < 2; t += 1) {
      ctx.beginPath()
      for (let i = 0; i <= 3; i += 1) {
        const ang = (i * 2 * Math.PI) / 3 + (t * Math.PI) / 3
        const px = cx + Math.cos(ang) * 40
        const py = cy + Math.sin(ang) * 40
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.stroke()
    }
  })
}

/** Classic RO emerald/cyan ground tile click cursor texture. */
function makeGroundCursorTexture(): THREE.CanvasTexture {
  return makePixelTexture(64, 64, ctx => {
    ctx.strokeStyle = '#34ff9a'
    ctx.lineWidth = 6
    ctx.strokeRect(5, 5, 54, 54)
    ctx.fillStyle = 'rgba(84, 255, 180, 0.24)'
    ctx.fillRect(8, 8, 48, 48)
    ctx.fillStyle = '#eafff5'
    ctx.fillRect(28, 28, 8, 8)
  })
}

/** Independent, authentic 2.5D RO-style market world (3D painted architecture + animated 2D pixel sprites). */
export class MarketWorld {
  readonly scene = new THREE.Scene()
  readonly spawn = new THREE.Vector3(0, 0.92, 4.9)
  readonly returnPoint: MarketPoint = {
    id: 'return-temple',
    title: '返回天心宮',
    subtitle: '踏入藍色傳送陣，回到主殿',
    position: new THREE.Vector3(0, 0, 9.6),
    radius: 2.6,
  }
  readonly venuePoints: MarketPoint[] = [
    { id: 'birth-chart-hall', title: '命盤探索館', subtitle: '人類圖・紫微斗數介紹', position: new THREE.Vector3(-9.2, 0, 0.6), radius: 3.3 },
    { id: 'card-house', title: '牌卡靈感屋', subtitle: '每日一張牌・三張牌問事預告', position: new THREE.Vector3(-7.4, 0, -7.8), radius: 3.3 },
    { id: 'moon-meditation', title: '月光靜心所', subtitle: '呼吸・靜心・自我關照', position: new THREE.Vector3(7.4, 0, -7.8), radius: 3.3 },
    { id: 'chess-guide', title: '東方問事指引亭', subtitle: '連結天心仙姑象棋卜卦', position: new THREE.Vector3(9.2, 0, 0.6), radius: 3.3 },
    { id: 'service-desk', title: '市集服務台', subtitle: '服務資訊與 LINE 預約入口', position: new THREE.Vector3(0, 0, -3.1), radius: 3.0 },
  ]
  readonly points: MarketPoint[] = [...this.venuePoints, this.returnPoint]
  readonly avatar = new THREE.Group()

  private avatarSprite!: THREE.Sprite
  private readonly avatarFrames: THREE.CanvasTexture[] = []
  private avatarAnimTimer = 0
  private avatarFrameIndex = 0

  private groundCursor!: THREE.Mesh
  private groundCursorActive = false

  private readonly warpCircles: THREE.Mesh[] = []
  private readonly warpPillars: THREE.Mesh[] = []
  private readonly floatingProps: { obj: THREE.Object3D; baseY: number; spin: number; phase: number }[] = []
  private readonly fountainRipples: THREE.Mesh[] = []
  private readonly animatedNpcs: AnimatedNpc[] = []
  private readonly auraSlimes: AuraSlime[] = []
  private readonly strollers: Stroller[] = []
  private readonly clouds: { sprite: THREE.Sprite; speed: number; minX: number; maxX: number }[] = []
  private time = 0

  constructor(private readonly physics: Physics) {
    this.scene.background = new THREE.Color(PALETTE.sky)
    this.scene.fog = new THREE.Fog(PALETTE.sky, 34, 72)

    // Warm Prontera daylight lighting
    this.scene.add(new THREE.HemisphereLight('#fffbe3', '#6b8e53', 1.45))
    const sun = new THREE.DirectionalLight('#fff2c4', 1.55)
    sun.position.set(-14, 26, 16)
    this.scene.add(sun)
    const rim = new THREE.DirectionalLight('#b4e2ff', 0.45)
    rim.position.set(16, 12, -16)
    this.scene.add(rim)

    this.addTileMap()
    this.addCentralFountain()
    this.addPlazaFurniture()
    this.addStalls()
    this.addServiceDesk()
    this.addArrivalGate()
    this.addReturnPortal()
    this.addPerimeterAndTrees()
    this.addBuntingGarlands()
    this.addAuraSlimes()
    this.addStrollingVisitors()
    this.addGroundCursor()
    this.addAvatar()
  }

  private addTileMap(): void {
    const grassMat = new THREE.MeshLambertMaterial({ map: makeGrassTexture() })
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(54, 54), grassMat)
    ground.rotation.x = -Math.PI / 2
    this.scene.add(ground)

    const cobblePlazaMat = new THREE.MeshLambertMaterial({ map: makeCobbleTexture(8, 8) })
    const cobblePathMat = new THREE.MeshLambertMaterial({ map: makeCobbleTexture(2, 10) })
    const curbMat = new THREE.MeshLambertMaterial({ color: PALETTE.stoneBorder })

    // Outer stone curb ring for the central plaza
    const plazaCurb = new THREE.Mesh(new THREE.CylinderGeometry(8.15, 8.28, 0.08, 32), curbMat)
    plazaCurb.position.set(0, 0.02, 0.6)
    this.scene.add(plazaCurb)

    // Main sunlit cobblestone plaza
    const plaza = new THREE.Mesh(new THREE.CylinderGeometry(7.85, 7.85, 0.09, 32), cobblePlazaMat)
    plaza.position.set(0, 0.03, 0.6)
    this.scene.add(plaza)

    // Radiating stone avenues (North-South & East-West + diagonals to upper stalls)
    const paths: [number, number, number, number, number][] = [
      [0, 0.5, 3.0, 23.0, 0],          // Main N-S road
      [0, 0.6, 20.5, 2.8, 0],          // E-W avenue
      [-4.2, -4.4, 2.2, 11.5, 0.58],   // NW path to Card House
      [4.2, -4.4, 2.2, 11.5, -0.58],   // NE path to Moon Meditation
    ]
    for (const [px, pz, w, d, rotY] of paths) {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(w + 0.34, 0.05, d + 0.34), curbMat)
      curb.position.set(px, 0.02, pz)
      curb.rotation.y = rotY
      const road = new THREE.Mesh(new THREE.BoxGeometry(w, 0.07, d), cobblePathMat)
      road.position.set(px, 0.032, pz)
      road.rotation.y = rotY
      this.scene.add(curb, road)
    }

    // Solid ground floor collider + invisible outer boundary walls
    this.physics.addStaticBox(new THREE.Vector3(0, -0.2, 0), new THREE.Vector3(54, 0.4, 54))
    this.physics.addStaticBox(new THREE.Vector3(0, 1.5, -17.5), new THREE.Vector3(38, 3, 1))
    this.physics.addStaticBox(new THREE.Vector3(0, 1.5, 14.5), new THREE.Vector3(38, 3, 1))
    this.physics.addStaticBox(new THREE.Vector3(-17.5, 1.5, 0), new THREE.Vector3(1, 3, 34))
    this.physics.addStaticBox(new THREE.Vector3(17.5, 1.5, 0), new THREE.Vector3(1, 3, 34))
  }

  /** Prontera-style Central Stone Fountain with animated sparkling ripples. */
  private addCentralFountain(): void {
    const group = new THREE.Group()
    group.position.set(0, 0, 1.1)

    const stoneMat = new THREE.MeshLambertMaterial({ color: '#ece3d0' })
    const trimMat = new THREE.MeshLambertMaterial({ color: '#b7a88e' })
    const goldMat = new THREE.MeshLambertMaterial({ color: PALETTE.gold })
    const waterMat = new THREE.MeshBasicMaterial({ color: PALETTE.water, transparent: true, opacity: 0.88 })

    // Stepped octagonal base
    const baseStep = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.2, 0.22, 8), trimMat)
    baseStep.position.y = 0.11
    const basinOuter = new THREE.Mesh(new THREE.CylinderGeometry(1.78, 1.88, 0.56, 8), stoneMat)
    basinOuter.position.y = 0.46
    const basinRim = new THREE.Mesh(new THREE.TorusGeometry(1.74, 0.11, 8, 8), stoneMat)
    basinRim.rotation.x = Math.PI / 2
    basinRim.rotation.z = Math.PI / 8
    basinRim.position.y = 0.74
    const waterDisc = new THREE.Mesh(new THREE.CylinderGeometry(1.64, 1.64, 0.08, 16), waterMat)
    waterDisc.position.y = 0.64

    // Center pillar & upper bowl
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 1.45, 10), stoneMat)
    pillar.position.y = 1.15
    const upperBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.84, 0.36, 0.28, 12), stoneMat)
    upperBowl.position.y = 1.72
    const upperWater = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.76, 0.06, 12), waterMat)
    upperWater.position.y = 1.84
    const finial = new THREE.Mesh(new THREE.OctahedronGeometry(0.26, 0), goldMat)
    finial.position.y = 2.26
    this.floatingProps.push({ obj: finial, baseY: 2.26, spin: 1.4, phase: 0 })

    // Translucent water stream arcs
    const jetMat = new THREE.MeshBasicMaterial({ color: PALETTE.waterLight, transparent: true, opacity: 0.72 })
    for (let i = 0; i < 4; i += 1) {
      const ang = (i * Math.PI) / 2 + Math.PI / 4
      const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 1.18, 6), jetMat)
      jet.position.set(Math.cos(ang) * 0.72, 1.24, Math.sin(ang) * 0.72)
      jet.rotation.z = -Math.cos(ang) * 0.28
      jet.rotation.x = Math.sin(ang) * 0.28
      group.add(jet)
    }

    // Animated expanding ripple rings
    for (let i = 0; i < 2; i += 1) {
      const ripple = new THREE.Mesh(
        new THREE.RingGeometry(0.5, 0.64, 24),
        new THREE.MeshBasicMaterial({ color: '#e6fdff', transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
      )
      ripple.rotation.x = -Math.PI / 2
      ripple.position.y = 0.7
      group.add(ripple)
      this.fountainRipples.push(ripple)
    }

    group.add(baseStep, basinOuter, basinRim, waterDisc, pillar, upperBowl, upperWater, finial)
    this.scene.add(group)
    this.physics.addStaticCylinder(new THREE.Vector3(0, 1.0, 1.1), 1.92, 2.0)
  }

  /** Wooden benches, flower planters, and cast-iron RO streetlamps around the plaza. */
  private addPlazaFurniture(): void {
    const woodMat = new THREE.MeshLambertMaterial({ color: PALETTE.woodLight })
    const darkWoodMat = new THREE.MeshLambertMaterial({ color: PALETTE.woodDark })
    const ironMat = new THREE.MeshLambertMaterial({ color: '#39464f' })
    const lampGlowMat = new THREE.MeshBasicMaterial({ color: '#fff3b8' })

    // 4 street lamps flanking the plaza corners
    for (const [lx, lz] of [[-5.6, 5.2], [5.6, 5.2], [-5.8, -3.8], [5.8, -3.8]] as const) {
      const lamp = new THREE.Group()
      lamp.position.set(lx, 0, lz)
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 0.45, 8), ironMat)
      base.position.y = 0.22
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 3.2, 8), ironMat)
      pole.position.y = 1.85
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.07, 0.07), ironMat)
      arm.position.set(lx < 0 ? 0.26 : -0.26, 3.35, 0)
      const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.34, 6), lampGlowMat)
      lantern.position.set(lx < 0 ? 0.48 : -0.48, 3.12, 0)
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.18, 6), ironMat)
      cap.position.set(lx < 0 ? 0.48 : -0.48, 3.36, 0)
      lamp.add(base, pole, arm, lantern, cap)
      this.scene.add(lamp)
      this.physics.addStaticCylinder(new THREE.Vector3(lx, 1.6, lz), 0.22, 3.2)
    }

    // 4 wooden benches around the fountain ring
    const benchSpecs: [number, number, number][] = [
      [-4.2, 3.6, 0.72],
      [4.2, 3.6, -0.72],
      [-4.5, -1.3, 2.35],
      [4.5, -1.3, -2.35],
    ]
    for (const [bx, bz, rotY] of benchSpecs) {
      const bench = new THREE.Group()
      bench.position.set(bx, 0, bz)
      bench.rotation.y = rotY
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 0.52), woodMat)
      seat.position.y = 0.44
      const back = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.36, 0.08), woodMat)
      back.position.set(0, 0.72, -0.22)
      for (const sx of [-0.68, 0.68]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.44, 0.46), darkWoodMat)
        leg.position.set(sx, 0.22, 0)
        bench.add(leg)
      }
      bench.add(seat, back)
      this.scene.add(bench)
    }

    // Flower beds beside the main road
    const bushMat = new THREE.MeshLambertMaterial({ color: '#4d924d' })
    const flowerColors = ['#ff8ca8', '#ffe47a', '#a5d8ff', '#ffd08a']
    for (const [fx, fz] of [[-2.4, 7.2], [2.4, 7.2], [-2.4, -7.2], [2.4, -7.2]] as const) {
      const planter = new THREE.Group()
      planter.position.set(fx, 0, fz)
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.36, 0.8), darkWoodMat)
      box.position.y = 0.18
      const soil = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.38, 0.66), bushMat)
      soil.position.y = 0.24
      planter.add(box, soil)
      for (let i = 0; i < 4; i += 1) {
        const bloom = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.12, 0),
          new THREE.MeshLambertMaterial({ color: flowerColors[i % flowerColors.length] }),
        )
        bloom.position.set(-0.45 + i * 0.3, 0.48 + (i % 2) * 0.06, (i % 2 ? 0.1 : -0.1))
        planter.add(bloom)
      }
      this.scene.add(planter)
    }
  }

  private addStalls(): void {
    const venues: VenueSpec[] = [
      {
        id: 'birth-chart-hall',
        title: '命盤探索館',
        subtitle: '紫微斗數・命盤解析',
        chatTag: '命盤探索館',
        x: -10.2,
        z: -1.6,
        rotY: Math.PI / 6,
        accent: '#4e9a78',
        npcStyle: 'sage',
      },
      {
        id: 'card-house',
        title: '牌卡靈感屋',
        subtitle: '每日一張・三張牌反思',
        chatTag: '牌卡靈感屋',
        x: -7.8,
        z: -10.0,
        rotY: Math.PI / 8,
        accent: '#c85a64',
        npcStyle: 'oracle',
      },
      {
        id: 'moon-meditation',
        title: '月光靜心所',
        subtitle: '60 秒呼吸・靜心關照',
        chatTag: '月光靜心所',
        x: 7.8,
        z: -10.0,
        rotY: -Math.PI / 8,
        accent: '#6a72b8',
        npcStyle: 'priestess',
      },
      {
        id: 'chess-guide',
        title: '東方問事指引亭',
        subtitle: '天心仙姑・象棋卜卦',
        chatTag: '東方問事指引亭',
        x: 10.2,
        z: -1.6,
        rotY: -Math.PI / 6,
        accent: '#d89c38',
        npcStyle: 'taoist',
      },
    ]
    for (const venue of venues) this.addRoStall(venue, 1.0)
  }

  private addServiceDesk(): void {
    this.addRoStall(
      {
        id: 'service-desk',
        title: '市集服務台',
        subtitle: '卡普拉導覽・LINE 預約',
        chatTag: '市集服務台',
        x: 0,
        z: -5.2,
        rotY: 0,
        accent: '#4a8eb2',
        npcStyle: 'kafra',
      },
      0.84,
    )
  }

  /** Builds a 3D half-timbered RO-style market pavilion + striped awning + themed counter prop + 2D pixel NPC. */
  private addRoStall(venue: VenueSpec, scale: number): void {
    const group = new THREE.Group()
    group.position.set(venue.x, 0, venue.z)
    group.rotation.y = venue.rotY

    const stoneMat = new THREE.MeshLambertMaterial({ color: '#d5c7ab' })
    const woodMat = new THREE.MeshLambertMaterial({ color: PALETTE.wood })
    const woodLightMat = new THREE.MeshLambertMaterial({ color: PALETTE.woodLight })
    const woodDarkMat = new THREE.MeshLambertMaterial({ color: PALETTE.woodDark })
    const creamWallMat = new THREE.MeshLambertMaterial({ color: '#f7edd4' })
    const accentMat = new THREE.MeshLambertMaterial({ color: venue.accent })
    const awningMat = new THREE.MeshLambertMaterial({ map: makeAwningTexture(venue.accent) })
    const goldMat = new THREE.MeshLambertMaterial({ color: PALETTE.gold })

    const w = 4.6 * scale
    const d = 3.0 * scale
    const h = 3.1 * scale

    // 1. Raised stone foundation
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 0.35, 0.24, d + 0.35), stoneMat)
    plinth.position.y = 0.12
    group.add(plinth)

    // 2. Back half-timbered wall (cream plaster + timber frame)
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(w - 0.12, h * 0.85, 0.22), creamWallMat)
    backWall.position.set(0, 0.24 + h * 0.425, -d / 2 + 0.15)
    group.add(backWall)

    // Decorative back wall timber crossbeams
    const midBeam = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, 0.28), woodDarkMat)
    midBeam.position.set(0, 0.24 + h * 0.45, -d / 2 + 0.16)
    group.add(midBeam)

    // 4 Corner timber pillars
    for (const sx of [-w / 2 + 0.16, w / 2 - 0.16]) {
      for (const sz of [-d / 2 + 0.16, d / 2 - 0.16]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.22 * scale, h, 0.22 * scale), woodDarkMat)
        post.position.set(sx, 0.24 + h / 2, sz)
        group.add(post)
      }
    }

    // 3. Front service counter with colored cloth runner
    const counter = new THREE.Mesh(new THREE.BoxGeometry(w - 0.3, 0.92 * scale, 0.78 * scale), woodMat)
    counter.position.set(0, 0.24 + 0.46 * scale, d / 2 - 0.45 * scale)
    const counterTop = new THREE.Mesh(new THREE.BoxGeometry(w - 0.18, 0.12 * scale, 0.92 * scale), woodLightMat)
    counterTop.position.set(0, 0.24 + 0.95 * scale, d / 2 - 0.45 * scale)
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(w * 0.42, 0.76 * scale, 0.06), accentMat)
    cloth.position.set(0, 0.24 + 0.48 * scale, d / 2 - 0.04 * scale)
    group.add(counter, counterTop, cloth)

    // 4. Slanted striped canvas awning roof
    const awning = new THREE.Mesh(new THREE.BoxGeometry(w + 0.65, 0.18 * scale, d + 0.95), awningMat)
    awning.position.set(0, 0.24 + h + 0.08 * scale, 0.16 * scale)
    awning.rotation.x = 0.24
    group.add(awning)

    // Roof ridge beam + gold finials
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(w + 0.72, 0.16 * scale, 0.18 * scale), woodDarkMat)
    ridge.position.set(0, 0.24 + h + 0.36 * scale, -d / 2 + 0.15)
    group.add(ridge)

    // Warm hanging corner lantern on front-right eave
    const lanternCord = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.45 * scale, 5), woodDarkMat)
    lanternCord.position.set(w / 2 - 0.05, 0.24 + h - 0.35 * scale, d / 2 + 0.28 * scale)
    const lanternGlobe = new THREE.Mesh(
      new THREE.SphereGeometry(0.18 * scale, 10, 8),
      new THREE.MeshBasicMaterial({ color: '#ffea9c' }),
    )
    lanternGlobe.position.set(w / 2 - 0.05, 0.24 + h - 0.62 * scale, d / 2 + 0.28 * scale)
    group.add(lanternCord, lanternGlobe)

    // 5. Unique 3D themed counter prop
    const propY = 0.24 + 1.04 * scale
    const propZ = d / 2 - 0.45 * scale
    if (venue.id === 'birth-chart-hall') {
      // Rotating golden armillary sphere
      const astro = new THREE.Group()
      astro.position.set(-0.75 * scale, propY + 0.42 * scale, propZ)
      const r1 = new THREE.Mesh(new THREE.TorusGeometry(0.32 * scale, 0.035, 8, 20), goldMat)
      const r2 = new THREE.Mesh(new THREE.TorusGeometry(0.26 * scale, 0.03, 8, 20), goldMat)
      r2.rotation.y = Math.PI / 2
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.1 * scale, 10, 8), new THREE.MeshBasicMaterial({ color: '#9cf5d8' }))
      astro.add(r1, r2, core)
      group.add(astro)
      this.floatingProps.push({ obj: astro, baseY: astro.position.y, spin: 1.1, phase: 0.4 })
    } else if (venue.id === 'card-house') {
      // Floating fan of glowing oracle cards
      const fan = new THREE.Group()
      fan.position.set(-0.7 * scale, propY + 0.42 * scale, propZ)
      for (const i of [-1, 0, 1]) {
        const card = new THREE.Mesh(
          new THREE.BoxGeometry(0.24 * scale, 0.36 * scale, 0.03),
          new THREE.MeshBasicMaterial({ color: i === 0 ? '#ffe79e' : '#ffd1dc' }),
        )
        card.position.set(i * 0.22 * scale, Math.abs(i) * -0.05, i * 0.02)
        card.rotation.z = -i * 0.28
        fan.add(card)
      }
      group.add(fan)
      this.floatingProps.push({ obj: fan, baseY: fan.position.y, spin: 0.7, phase: 1.2 })
    } else if (venue.id === 'moon-meditation') {
      // Glowing lavender moon crystal
      const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.28 * scale, 0),
        new THREE.MeshBasicMaterial({ color: '#d4dcff' }),
      )
      crystal.scale.set(0.75, 1.35, 0.75)
      crystal.position.set(-0.7 * scale, propY + 0.44 * scale, propZ)
      group.add(crystal)
      this.floatingProps.push({ obj: crystal, baseY: crystal.position.y, spin: 1.3, phase: 2.1 })
    } else if (venue.id === 'chess-guide') {
      // Mini Xiangqi board with red/black pieces
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.85 * scale, 0.07, 0.65 * scale), woodLightMat)
      board.position.set(-0.65 * scale, propY + 0.04, propZ)
      group.add(board)
      for (const [cx, cz, col] of [[-0.2, 0.1, '#d6453a'], [0, 0, '#d6453a'], [0.22, -0.1, '#2d2d2d'], [-0.1, -0.14, '#2d2d2d']] as const) {
        const piece = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * scale, 0.08 * scale, 0.05, 10), new THREE.MeshLambertMaterial({ color: col }))
        piece.position.set(-0.65 * scale + cx * scale, propY + 0.1, propZ + cz * scale)
        group.add(piece)
      }
    } else {
      // Service desk golden bell & open guestbook
      const bell = new THREE.Mesh(new THREE.SphereGeometry(0.14 * scale, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), goldMat)
      bell.position.set(-0.6 * scale, propY + 0.02, propZ)
      const book = new THREE.Mesh(new THREE.BoxGeometry(0.55 * scale, 0.06, 0.38 * scale), creamWallMat)
      book.position.set(0.15 * scale, propY + 0.03, propZ)
      group.add(bell, book)
    }

    // 6. Crisp 2D RO pixel NPC standing beside/in front of counter + occasional emote bubble
    const npc = makeNpcSprite(venue.npcStyle, venue.accent)
    const npcBaseY = 1.02
    npc.position.set(0.75 * scale, npcBaseY, d / 2 + 0.55 * scale)
    npc.scale.set(1.32, 1.76, 1)
    group.add(npc)

    const emoteKind = venue.npcStyle === 'kafra' ? 'heart' : venue.npcStyle === 'priestess' ? 'music' : 'sparkle'
    const emote = roEmoteSprite(emoteKind)
    emote.position.set(0.75 * scale, npcBaseY + 1.15, d / 2 + 0.55 * scale)
    emote.scale.set(0.72, 0.72, 1)
    emote.visible = false
    group.add(emote)

    this.animatedNpcs.push({
      sprite: npc,
      baseY: npcBaseY,
      phase: venue.x * 0.5 + venue.z * 0.3,
      emote,
      emoteBaseY: npcBaseY + 1.15,
      emoteTimer: 2 + Math.abs(venue.x * 0.3),
    })

    // 7. Classic RO floating chatroom / shop signboard
    const sign = roChatSignSprite(venue.chatTag, venue.subtitle, venue.accent)
    sign.position.set(0, 0.24 + h + 1.25 * scale, 0.1)
    sign.scale.set(4.1 * Math.max(0.9, scale), 1.02 * Math.max(0.9, scale), 1)
    group.add(sign)

    this.scene.add(group)
    this.physics.addStaticBox(new THREE.Vector3(venue.x, 1.4, venue.z), new THREE.Vector3(w + 0.2, 2.8, d + 0.2))
  }

  /** North town archway framing the entrance of Tianxin Aura Market. */
  private addArrivalGate(): void {
    const group = new THREE.Group()
    group.position.set(0, 0, -13.6)

    const stoneMat = new THREE.MeshLambertMaterial({ color: '#ddd1b8' })
    const darkWoodMat = new THREE.MeshLambertMaterial({ color: PALETTE.woodDark })
    const roofMat = new THREE.MeshLambertMaterial({ color: '#456f63' })
    const goldMat = new THREE.MeshLambertMaterial({ color: PALETTE.gold })

    for (const sx of [-2.4, 2.4]) {
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.1, 0.95), stoneMat)
      base.position.set(sx, 0.55, 0)
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 4.2, 10), darkWoodMat)
      pillar.position.set(sx, 2.6, 0)
      const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffe89c' }))
      lantern.position.set(sx * 0.82, 3.6, 0.45)
      group.add(base, pillar, lantern)
    }

    const lintel = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.55, 0.65), darkWoodMat)
    lintel.position.set(0, 4.55, 0)
    const roofLeft = new THREE.Mesh(new THREE.BoxGeometry(6.9, 0.24, 1.6), roofMat)
    roofLeft.position.set(0, 5.15, -0.45)
    roofLeft.rotation.x = -0.32
    const roofRight = new THREE.Mesh(new THREE.BoxGeometry(6.9, 0.24, 1.6), roofMat)
    roofRight.position.set(0, 5.15, 0.45)
    roofRight.rotation.x = 0.32
    const crest = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), goldMat)
    crest.position.set(0, 5.75, 0)

    const sign = roChatSignSprite('天心靈光市集', 'RO 風格・奇幻靈感廣場', '#3f7b6d')
    sign.position.set(0, 6.45, 0.2)
    sign.scale.set(4.8, 1.2, 1)

    group.add(lintel, roofLeft, roofRight, crest, sign)
    this.scene.add(group)
    this.physics.addStaticBox(new THREE.Vector3(-2.4, 2, -13.6), new THREE.Vector3(1.0, 4, 1.0))
    this.physics.addStaticBox(new THREE.Vector3(2.4, 2, -13.6), new THREE.Vector3(1.0, 4, 1.0))
  }

  /** Classic RO Warp Portal: spinning blue-cyan rune circle + rising translucent light pillar. */
  private addReturnPortal(): void {
    const group = new THREE.Group()
    group.position.copy(this.returnPoint.position)

    // Spinning ground rune circle
    const rune = new THREE.Mesh(
      new THREE.PlaneGeometry(3.5, 3.5),
      new THREE.MeshBasicMaterial({
        map: makeWarpRuneTexture(),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )
    rune.rotation.x = -Math.PI / 2
    rune.position.y = 0.09
    group.add(rune)
    this.warpCircles.push(rune)

    // Rising translucent cyan light column (classic RO warp beam)
    const outerPillar = new THREE.Mesh(
      new THREE.CylinderGeometry(1.18, 1.35, 4.4, 20, 1, true),
      new THREE.MeshBasicMaterial({
        color: PALETTE.portal,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )
    outerPillar.position.y = 2.25
    const innerPillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.78, 4.8, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: PALETTE.portalLight,
        transparent: true,
        opacity: 0.36,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )
    innerPillar.position.y = 2.45
    group.add(outerPillar, innerPillar)
    this.warpPillars.push(outerPillar, innerPillar)

    // 4 low stone rune markers around the warp
    const stoneMat = new THREE.MeshLambertMaterial({ color: '#cfc4ad' })
    for (let i = 0; i < 4; i += 1) {
      const ang = (i * Math.PI) / 2 + Math.PI / 4
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.72, 0.32), stoneMat)
      post.position.set(Math.cos(ang) * 1.75, 0.36, Math.sin(ang) * 1.75)
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), new THREE.MeshBasicMaterial({ color: '#9cfcf0' }))
      gem.position.set(Math.cos(ang) * 1.75, 0.88, Math.sin(ang) * 1.75)
      group.add(post, gem)
    }

    const sign = roChatSignSprite('返回天心宮', '傳送陣・Warp Portal', '#3c8f88')
    sign.position.set(0, 4.65, 0)
    sign.scale.set(3.8, 0.95, 1)
    group.add(sign)

    this.scene.add(group)
  }

  /** Surrounding rustic wooden fences, lush RO pixel trees, and drifting clouds. */
  private addPerimeterAndTrees(): void {
    const woodMat = new THREE.MeshLambertMaterial({ color: PALETTE.woodLight })
    const darkWoodMat = new THREE.MeshLambertMaterial({ color: PALETTE.wood })

    const addFenceRun = (x1: number, z1: number, x2: number, z2: number) => {
      const len = Math.hypot(x2 - x1, z2 - z1)
      const count = Math.max(2, Math.round(len / 2.2))
      const ang = Math.atan2(x2 - x1, z2 - z1)
      for (let i = 0; i <= count; i += 1) {
        const t = i / count
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.92, 0.16), darkWoodMat)
        post.position.set(THREE.MathUtils.lerp(x1, x2, t), 0.46, THREE.MathUtils.lerp(z1, z2, t))
        this.scene.add(post)
      }
      for (const ry of [0.34, 0.7]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, len), woodMat)
        rail.position.set((x1 + x2) / 2, ry, (z1 + z2) / 2)
        rail.rotation.y = ang
        this.scene.add(rail)
      }
    }

    // Perimeter wooden fences framing the market green
    addFenceRun(-15.5, -14.5, -4.0, -14.5)
    addFenceRun(4.0, -14.5, 15.5, -14.5)
    addFenceRun(-15.5, 12.2, -3.5, 12.2)
    addFenceRun(3.5, 12.2, 15.5, 12.2)
    addFenceRun(-15.5, -14.5, -15.5, 12.2)
    addFenceRun(15.5, -14.5, 15.5, 12.2)

    // Lush RO 2.5D trees around the border
    const trees = [
      [-17.2, -13.5, 5.4], [-14.2, -15.8, 4.9], [-17.6, -5.2, 5.1],
      [-16.8, 5.2, 4.8], [-14.2, 13.4, 5.5], [-7.5, 13.8, 4.5],
      [17.2, -13.2, 5.6], [14.2, -15.8, 4.8], [17.8, -4.8, 5.0],
      [16.8, 5.6, 5.2], [14.4, 13.4, 5.4], [7.8, 13.8, 4.6],
      [-5.6, -15.8, 4.6], [5.6, -15.8, 4.8],
    ] as const
    for (const [x, z, height] of trees) {
      const alt = Math.abs(Math.round(x + z)) % 2 === 0
      const tree = treeSprite(alt ? '#46874c' : '#53944e', alt ? '#7ec46c' : '#94cf73')
      tree.position.set(x, height / 2, z)
      tree.scale.set(height * 0.74, height, 1)
      this.scene.add(tree)
    }

    // Drifting pixel clouds
    for (const [x, y, z, scale, speed] of [
      [-18, 13, -18, 4.2, 0.35],
      [6, 14.5, -20, 4.8, 0.26],
      [18, 12.5, -14, 3.6, 0.3],
    ] as const) {
      const cloud = spriteFromCanvas(128, 52, ctx => {
        ctx.fillStyle = PALETTE.cloud
        ctx.fillRect(14, 24, 100, 16)
        ctx.fillRect(28, 14, 36, 20)
        ctx.fillRect(60, 8, 38, 26)
      })
      cloud.position.set(x, y, z)
      cloud.scale.set(scale, scale * 0.42, 1)
      this.scene.add(cloud)
      this.clouds.push({ sprite: cloud, speed, minX: -26, maxX: 26 })
    }
  }

  /** Festive RO town triangular bunting flags strung between plaza lamp posts. */
  private addBuntingGarlands(): void {
    const flagColors = ['#ee6c6c', '#f5cb5c', '#69b89c', '#6da8dc', '#c38be0']
    const spans: [[number, number], [number, number]][] = [
      [[-5.6, 5.2], [5.6, 5.2]],
      [[-5.8, -3.8], [5.8, -3.8]],
      [[-5.6, 5.2], [-5.8, -3.8]],
      [[5.6, 5.2], [5.8, -3.8]],
    ]
    for (const [[x1, z1], [x2, z2]] of spans) {
      const count = 9
      for (let i = 1; i < count; i += 1) {
        const t = i / count
        const sag = Math.sin(t * Math.PI) * 0.55
        const flag = new THREE.Mesh(
          new THREE.ConeGeometry(0.18, 0.34, 3),
          new THREE.MeshLambertMaterial({ color: flagColors[i % flagColors.length] }),
        )
        flag.rotation.x = Math.PI
        flag.position.set(
          THREE.MathUtils.lerp(x1, x2, t),
          3.35 - sag,
          THREE.MathUtils.lerp(z1, z2, t),
        )
        this.scene.add(flag)
      }
    }
  }

  /** Cute pastel Poring-inspired Aura Slimes hopping around the grassy outskirts. */
  private addAuraSlimes(): void {
    const specs: [number, number, string, string, string][] = [
      [-11.8, 7.2, '#ffa3b8', '#ffdce5', '#a64d63'],  // Rose Aura Slime
      [11.4, 6.8, '#8ad8ff', '#d9f4ff', '#3c7da6'],    // Sky Aura Slime
      [-12.6, -6.5, '#9ce8b6', '#dcffea', '#43855d'],  // Mint Aura Slime
      [12.4, -6.2, '#ffe082', '#fff7cc', '#a68232'],   // Gold Aura Slime
    ]
    for (let i = 0; i < specs.length; i += 1) {
      const [hx, hz, body, light, dark] = specs[i]
      const group = new THREE.Group()
      group.position.set(hx, 0, hz)
      const shadow = new THREE.Mesh(
        new THREE.CircleGeometry(0.42, 14),
        new THREE.MeshBasicMaterial({ color: '#2b4228', transparent: true, opacity: 0.34, depthWrite: false }),
      )
      shadow.rotation.x = -Math.PI / 2
      shadow.position.y = 0.04
      const sprite = makeAuraSlimeSprite(body, light, dark)
      sprite.position.y = 0.45
      sprite.scale.set(0.95, 0.8, 1)
      group.add(shadow, sprite)
      this.scene.add(group)
      this.auraSlimes.push({
        group,
        sprite,
        shadow,
        homeX: hx,
        homeZ: hz,
        radius: 1.5,
        speed: 0.55 + i * 0.1,
        phase: i * 1.7,
        hopPhase: i * 1.1,
      })
    }
  }

  /** Leisurely pixel-art market visitors strolling around the central fountain plaza. */
  private addStrollingVisitors(): void {
    const accents = ['#e08264', '#6d9ec8', '#89b36b']
    for (let i = 0; i < accents.length; i += 1) {
      const group = new THREE.Group()
      const shadow = new THREE.Mesh(
        new THREE.CircleGeometry(0.38, 12),
        new THREE.MeshBasicMaterial({ color: '#383024', transparent: true, opacity: 0.3, depthWrite: false }),
      )
      shadow.rotation.x = -Math.PI / 2
      shadow.position.y = 0.09
      const sprite = makeNpcSprite(i === 0 ? 'sage' : i === 1 ? 'oracle' : 'priestess', accents[i])
      sprite.position.y = 0.88
      sprite.scale.set(1.12, 1.5, 1)
      group.add(shadow, sprite)
      this.scene.add(group)
      this.strollers.push({
        group,
        sprite,
        orbitRadius: 4.9 + i * 0.85,
        angle: (i * Math.PI * 2) / accents.length,
        speed: (i % 2 === 0 ? 1 : -1) * (0.2 + i * 0.04),
        bobPhase: i * 2.1,
      })
    }
  }

  /** Classic RO glowing green tile cursor for click-to-move destination. */
  private addGroundCursor(): void {
    const mat = new THREE.MeshBasicMaterial({
      map: makeGroundCursorTexture(),
      transparent: true,
      depthWrite: false,
    })
    this.groundCursor = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 1.05), mat)
    this.groundCursor.rotation.x = -Math.PI / 2
    this.groundCursor.position.y = 0.11
    this.groundCursor.visible = false
    this.scene.add(this.groundCursor)
  }

  setGroundCursor(x: number, z: number, visible: boolean): void {
    this.groundCursorActive = visible
    this.groundCursor.visible = visible
    if (visible) {
      this.groundCursor.position.set(x, 0.11, z)
    }
  }

  private addAvatar(): void {
    for (let f = 0; f < 4; f += 1) {
      this.avatarFrames.push(makeAdventurerFrameTexture(f))
    }
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.48, 16),
      new THREE.MeshBasicMaterial({ color: '#263626', transparent: true, opacity: 0.38, depthWrite: false }),
    )
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = 0.09
    const mat = new THREE.SpriteMaterial({
      map: this.avatarFrames[0],
      transparent: true,
      alphaTest: 0.08,
      depthWrite: true,
    })
    this.avatarSprite = new THREE.Sprite(mat)
    this.avatarSprite.position.y = 0.96
    this.avatarSprite.scale.set(1.36, 1.82, 1)

    const nameTag = roNameTagSprite('靈光旅人')
    nameTag.position.y = 2.08
    nameTag.scale.set(1.9, 0.42, 1)

    this.avatar.add(shadow, this.avatarSprite, nameTag)
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

  update(dt: number, moveSpeed = 0, facingDirX = 0): void {
    this.time += dt

    // 1. Player sprite 4-frame RO walk cycle & left/right flip
    const isMoving = moveSpeed > 0.25
    if (isMoving) {
      this.avatarAnimTimer += dt * Math.min(11, 5.5 + moveSpeed * 0.9)
      const nextFrame = Math.floor(this.avatarAnimTimer) % 4
      if (nextFrame !== this.avatarFrameIndex) {
        this.avatarFrameIndex = nextFrame
        ;(this.avatarSprite.material as THREE.SpriteMaterial).map = this.avatarFrames[nextFrame]
      }
      this.avatarSprite.position.y = 0.96 + Math.abs(Math.sin(this.avatarAnimTimer * Math.PI * 0.5)) * 0.07
    } else {
      if (this.avatarFrameIndex !== 0) {
        this.avatarFrameIndex = 0
        ;(this.avatarSprite.material as THREE.SpriteMaterial).map = this.avatarFrames[0]
      }
      this.avatarSprite.position.y = 0.96 + Math.sin(this.time * 2.8) * 0.025
    }
    if (Math.abs(facingDirX) > 0.15) {
      const sign = facingDirX < 0 ? -1 : 1
      this.avatarSprite.scale.x = 1.36 * sign
    }

    // 2. RO ground click cursor pulse
    if (this.groundCursorActive) {
      const s = 0.95 + Math.sin(this.time * 8) * 0.08
      this.groundCursor.scale.set(s, s, 1)
    }

    // 3. RO Warp Portal spinning runes & glowing light column
    for (const rune of this.warpCircles) {
      rune.rotation.z = this.time * 1.15
    }
    const pulse = 1 + Math.sin(this.time * 3.2) * 0.08
    for (const pillar of this.warpPillars) {
      pillar.scale.set(pulse, 1, pulse)
    }

    // 4. Fountain expanding ripples
    for (let i = 0; i < this.fountainRipples.length; i += 1) {
      const prog = (this.time * 0.65 + i * 0.5) % 1
      const scale = 0.55 + prog * 1.75
      this.fountainRipples[i].scale.set(scale, scale, 1)
      ;(this.fountainRipples[i].material as THREE.MeshBasicMaterial).opacity = (1 - prog) * 0.65
    }

    // 5. Floating themed stall props
    for (const prop of this.floatingProps) {
      prop.obj.rotation.y += dt * prop.spin
      prop.obj.position.y = prop.baseY + Math.sin(this.time * 2.4 + prop.phase) * 0.08
    }

    // 6. Venue NPCs idle breathing & periodic RO emote bubbles
    for (const npc of this.animatedNpcs) {
      npc.sprite.position.y = npc.baseY + Math.sin(this.time * 2.6 + npc.phase) * 0.03
      if (npc.emote && npc.emoteBaseY !== undefined) {
        npc.emoteTimer -= dt
        if (npc.emoteTimer <= -2.4) {
          npc.emoteTimer = 5.5 + (Math.abs(Math.sin(this.time + npc.phase)) * 4)
        }
        const show = npc.emoteTimer <= 0
        npc.emote.visible = show
        if (show) {
          npc.emote.position.y = npc.emoteBaseY + Math.sin(this.time * 6) * 0.06
        }
      }
    }

    // 7. Cute bouncing Aura Slimes (squash & stretch!)
    for (const slime of this.auraSlimes) {
      const ang = this.time * slime.speed + slime.phase
      slime.group.position.x = slime.homeX + Math.cos(ang) * slime.radius
      slime.group.position.z = slime.homeZ + Math.sin(ang) * slime.radius
      const hop = Math.abs(Math.sin(this.time * 4.2 + slime.hopPhase))
      slime.sprite.position.y = 0.42 + hop * 0.52
      // Squish when landing, stretch when jumping
      const stretchY = 0.72 + hop * 0.24
      const squishX = 1.06 - hop * 0.16
      slime.sprite.scale.set(squishX, stretchY, 1)
      const shadowScale = 1 - hop * 0.35
      slime.shadow.scale.set(shadowScale, shadowScale, 1)
    }

    // 8. Strolling plaza visitors
    for (const stroller of this.strollers) {
      stroller.angle += dt * stroller.speed
      stroller.group.position.x = Math.cos(stroller.angle) * stroller.orbitRadius
      stroller.group.position.z = 1.1 + Math.sin(stroller.angle) * stroller.orbitRadius
      stroller.sprite.position.y = 0.88 + Math.abs(Math.sin(this.time * 5.2 + stroller.bobPhase)) * 0.07
    }

    // 9. Drifting clouds
    for (const cloud of this.clouds) {
      cloud.sprite.position.x += dt * cloud.speed
      if (cloud.sprite.position.x > cloud.maxX) cloud.sprite.position.x = cloud.minX
    }
  }
}
