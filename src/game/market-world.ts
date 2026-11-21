import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { Physics } from '../engine/physics'

/** 台灣雨夜霓虹 × Low-Poly 市集配色（純市集版本） */
const PALETTE = {
  nightSky: '#1f1c2c',
  asphalt: '#1c1a27',
  sidewalk: '#2e2b3d',
  curb: '#443f57',
  wood: '#6b4735',
  woodDark: '#3f2920',
  woodLight: '#8c6048',
  metalRoof: '#3b4154',
  metalRoofRust: '#4a3d49',
  poleConcrete: '#48455a',
  buildingDark: '#161422',
  buildingMid: '#1e1b2e',
  windowWarm: '#ffda7b',
  lanternRed: '#ff4838',
  neonPink: '#f26ee8',
  neonGold: '#ffd36e',
  neonReiki: '#72f2c8',
  neonViolet: '#a77dff',
  neonAmber: '#ffcf5c',
  coneOrange: '#f06428',
  stoolRed: '#c93a3a',
  stoolBlue: '#356bb3',
}

export type MarketVenueId = 'birth-chart-hall' | 'card-house' | 'moon-meditation' | 'chess-guide' | 'service-desk'
export type MarketPointId = 'return-temple' | MarketVenueId
export type MarketPoint = { id: MarketPointId; title: string; subtitle: string; position: THREE.Vector3; radius: number }

export type WeatherCondition = 'clear' | 'cloudy' | 'rainy'
export interface TaichungWeatherInfo {
  condition: WeatherCondition
  description: string
  isDay: boolean
  temperature: number
  rainMm: number
}

/** 查詢台中即時現實氣象（Open-Meteo 台中測站，無須金鑰、免費即時） */
export async function fetchTaichungWeather(): Promise<TaichungWeatherInfo> {
  try {
    const res = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=24.1477&longitude=120.6736&current=is_day,precipitation,rain,weather_code,cloud_cover,temperature_2m',
      { signal: AbortSignal.timeout(4500) },
    )
    if (!res.ok) throw new Error('status ' + res.status)
    const json = await res.json()
    const cur = json.current
    const rain = cur.rain ?? cur.precipitation ?? 0
    const code = cur.weather_code ?? 0
    // WMO 天氣代碼：51~67, 80~82 為降雨；95~99 為雷陣雨
    const isRainy = rain > 0.05 || (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95
    const isCloudy = !isRainy && ((cur.cloud_cover ?? 0) > 40 || code === 2 || code === 3)
    const isDay = cur.is_day === 1
    const cond: WeatherCondition = isRainy ? 'rainy' : isCloudy ? 'cloudy' : 'clear'
    const desc = isRainy ? '雨天' : isCloudy ? '多雲' : isDay ? '晴天' : '晴夜'
    return {
      condition: cond,
      description: desc,
      isDay,
      temperature: Math.round(cur.temperature_2m ?? 20),
      rainMm: +rain.toFixed(1),
    }
  } catch {
    const h = new Date().getHours()
    const isDay = h >= 6 && h < 18
    return {
      condition: 'clear',
      description: isDay ? '晴天' : '晴夜',
      isDay,
      temperature: 20,
      rainMm: 0,
    }
  }
}

type StallStyle = 'ziwei' | 'reiki' | 'tarot' | 'consultation' | 'info'

type StallSpec = {
  id: MarketVenueId
  title: string
  subtitle: string
  signZh: string
  signEn: string
  x: number
  z: number
  interactX: number
  interactZ: number
  rotY: number
  accentHex: string
  secondaryHex: string
  style: StallStyle
}

type StallVisualRef = {
  id: MarketPointId
  signMaterial?: THREE.MeshStandardMaterial
  baseEmissiveIntensity: number
  ring: THREE.Mesh
  ringMaterial: THREE.MeshBasicMaterial
  glowHalo?: THREE.Sprite
  baseHaloOpacity: number
  pointLight?: THREE.PointLight
  baseLightIntensity: number
}

type SwayingLantern = {
  group: THREE.Group
  phase: number
  amp: number
}

type RainRipple = {
  mesh: THREE.Mesh
  mat: THREE.MeshBasicMaterial
  phase: number
  speed: number
}

function makeCanvasTexture(
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
  draw(ctx)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  if (repeatX > 1 || repeatY > 1) {
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(repeatX, repeatY)
  }
  return texture
}

/** 繪製發光霓虹／燈箱招牌貼圖（繁體中文 + 英文） */
function makeNeonSignTexture(
  zh: string,
  en: string,
  style: StallStyle | 'return',
): THREE.CanvasTexture {
  return makeCanvasTexture(512, 160, ctx => {
    if (style === 'ziwei') {
      // 粉紫與暖金霓虹招牌
      ctx.fillStyle = '#1b0f26'
      ctx.fillRect(0, 0, 512, 160)
      ctx.strokeStyle = '#f26ee8'
      ctx.lineWidth = 10
      ctx.strokeRect(10, 10, 492, 140)
      ctx.strokeStyle = '#ffd36e'
      ctx.lineWidth = 3
      ctx.strokeRect(22, 22, 468, 116)

      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.shadowColor = '#f26ee8'
      ctx.shadowBlur = 18
      ctx.fillStyle = '#fff0c8'
      ctx.font = '700 58px "Microsoft JhengHei", "Noto Sans TC", sans-serif'
      ctx.fillText(zh, 256, 68)

      ctx.shadowColor = '#ffd36e'
      ctx.shadowBlur = 12
      ctx.fillStyle = '#ff9ef6'
      ctx.font = '700 28px "Segoe UI", sans-serif'
      ctx.fillText(en, 256, 120)
    } else if (style === 'reiki') {
      // 紫綠色柔和霓虹招牌
      ctx.fillStyle = '#101f26'
      ctx.fillRect(0, 0, 512, 160)
      ctx.strokeStyle = '#72f2c8'
      ctx.lineWidth = 9
      ctx.strokeRect(10, 10, 492, 140)
      ctx.strokeStyle = '#b488ff'
      ctx.lineWidth = 3
      ctx.strokeRect(22, 22, 468, 116)

      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.shadowColor = '#72f2c8'
      ctx.shadowBlur = 18
      ctx.fillStyle = '#dcfff4'
      ctx.font = '700 56px "Microsoft JhengHei", "Noto Sans TC", sans-serif'
      ctx.fillText(zh, 256, 68)

      ctx.shadowColor = '#b488ff'
      ctx.shadowBlur = 12
      ctx.fillStyle = '#d3b8ff'
      ctx.font = '700 28px "Segoe UI", sans-serif'
      ctx.fillText(en, 256, 120)
    } else if (style === 'tarot') {
      // 深紫底配暖金招牌
      ctx.fillStyle = '#1c112b'
      ctx.fillRect(0, 0, 512, 160)
      ctx.strokeStyle = '#ffd36e'
      ctx.lineWidth = 9
      ctx.strokeRect(10, 10, 492, 140)
      ctx.strokeStyle = '#9c73ff'
      ctx.lineWidth = 3
      ctx.strokeRect(22, 22, 468, 116)

      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.shadowColor = '#ffd36e'
      ctx.shadowBlur = 18
      ctx.fillStyle = '#ffeab0'
      ctx.font = '700 56px "Microsoft JhengHei", "Noto Sans TC", sans-serif'
      ctx.fillText(zh, 256, 68)

      ctx.shadowColor = '#b694ff'
      ctx.shadowBlur = 12
      ctx.fillStyle = '#ffd36e'
      ctx.font = '700 28px "Segoe UI", sans-serif'
      ctx.fillText(en, 256, 120)
    } else if (style === 'consultation') {
      // 傳統暖黃發光燈箱
      ctx.fillStyle = '#ffdf85'
      ctx.fillRect(0, 0, 512, 160)
      ctx.strokeStyle = '#9e2a22'
      ctx.lineWidth = 10
      ctx.strokeRect(10, 10, 492, 140)
      ctx.strokeStyle = '#5c2416'
      ctx.lineWidth = 3
      ctx.strokeRect(22, 22, 468, 116)

      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#7a1914'
      ctx.font = '700 48px "Microsoft JhengHei", "Noto Sans TC", sans-serif'
      ctx.fillText(zh, 256, 68)

      ctx.fillStyle = '#472518'
      ctx.font = '700 24px "Segoe UI", sans-serif'
      ctx.fillText(en, 256, 120)
    } else if (style === 'info') {
      // 市集服務台燈箱
      ctx.fillStyle = '#182436'
      ctx.fillRect(0, 0, 512, 160)
      ctx.strokeStyle = '#79c6ff'
      ctx.lineWidth = 9
      ctx.strokeRect(10, 10, 492, 140)

      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.shadowColor = '#79c6ff'
      ctx.shadowBlur = 14
      ctx.fillStyle = '#e8f6ff'
      ctx.font = '700 52px "Microsoft JhengHei", "Noto Sans TC", sans-serif'
      ctx.fillText(zh, 256, 68)

      ctx.fillStyle = '#9fd8ff'
      ctx.font = '700 25px "Segoe UI", sans-serif'
      ctx.fillText(en, 256, 120)
    } else {
      // 返回天心宮牌樓招牌
      ctx.fillStyle = '#2b1218'
      ctx.fillRect(0, 0, 512, 160)
      ctx.strokeStyle = '#ffcf66'
      ctx.lineWidth = 10
      ctx.strokeRect(10, 10, 492, 140)

      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.shadowColor = '#ff8c52'
      ctx.shadowBlur = 16
      ctx.fillStyle = '#ffe9a8'
      ctx.font = '700 54px "Microsoft JhengHei", "Noto Sans TC", sans-serif'
      ctx.fillText(zh, 256, 68)

      ctx.fillStyle = '#ffbe78'
      ctx.font = '700 26px "Segoe UI", sans-serif'
      ctx.fillText(en, 256, 120)
    }
  })
}

/** 建立柔和發光光暈貼圖（搭配 Bloom 強化霓虹泛光感） */
function makeGlowHaloTexture(colorHex: string): THREE.CanvasTexture {
  return makeCanvasTexture(128, 128, ctx => {
    const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62)
    grad.addColorStop(0, colorHex)
    grad.addColorStop(0.38, `${colorHex}99`)
    grad.addColorStop(1, `${colorHex}00`)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 128, 128)
  })
}

/** 繪製雨後微濕柏油路貼圖（含斑馬線與微弱水窪細節） */
function makeWetAsphaltTexture(): THREE.CanvasTexture {
  return makeCanvasTexture(1024, 512, ctx => {
    ctx.fillStyle = '#1d1b28'
    ctx.fillRect(0, 0, 1024, 512)

    // 細緻柏油顆粒
    for (let i = 0; i < 4200; i += 1) {
      const x = (i * 197) % 1024
      const y = (i * 313) % 512
      ctx.fillStyle = i % 3 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(10,8,16,0.14)'
      ctx.fillRect(x, y, 2, 2)
    }

    // 微濕反光水漬區塊
    const puddles = [
      [180, 160, 110, 42],
      [420, 290, 130, 48],
      [670, 180, 125, 45],
      [850, 320, 105, 38],
      [290, 380, 95, 34],
    ]
    for (const [px, py, rx, ry] of puddles) {
      const g = ctx.createRadialGradient(px, py, 8, px, py, rx)
      g.addColorStop(0, 'rgba(110, 104, 155, 0.16)')
      g.addColorStop(1, 'rgba(30, 27, 42, 0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2)
      ctx.fill()
    }

    // 中央雙黃／淡黃虛線
    ctx.fillStyle = 'rgba(225, 190, 95, 0.45)'
    for (let x = 20; x < 1024; x += 92) {
      ctx.fillRect(x, 250, 52, 8)
    }

    // 斑馬線（左右兩組，具台灣街道感）
    ctx.fillStyle = 'rgba(228, 224, 240, 0.62)'
    for (const baseX of [190, 745]) {
      for (let y = 48; y < 464; y += 54) {
        ctx.fillRect(baseX, y, 92, 28)
      }
    }

    // 路緣排水線
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)'
    ctx.fillRect(0, 18, 1024, 4)
    ctx.fillRect(0, 490, 1024, 4)
  })
}

/** 繪製人行道石板地磚貼圖 */
function makeSidewalkTexture(): THREE.CanvasTexture {
  return makeCanvasTexture(256, 256, ctx => {
    ctx.fillStyle = '#302d40'
    ctx.fillRect(0, 0, 256, 256)
    ctx.strokeStyle = '#201d2c'
    ctx.lineWidth = 4
    for (let x = 0; x <= 256; x += 64) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke()
    }
    for (let y = 0; y <= 256; y += 64) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke()
    }
    for (let r = 0; r < 4; r += 1) {
      for (let c = 0; c < 4; c += 1) {
        ctx.fillStyle = (r + c) % 2 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.06)'
        ctx.fillRect(c * 64 + 3, r * 64 + 3, 58, 58)
      }
    }
  }, 12, 3)
}

/**
 * 台灣雨夜霓虹 × Low-Poly 2.5D「靈光市集」世界模組（純市集版本）。
 * 包含獨立台式攤位、霓虹燈箱、雨夜濕潤反光柏油路、細雨粒子、街景細節、
 * 低面數 Q 版角色（預留 GLTFLoader 替換介面）與攤位點擊熱區高亮。
 */
export class MarketWorld {
  readonly scene = new THREE.Scene()
  readonly spawn = new THREE.Vector3(0, 0.91, 4.4)
  readonly avatar = new THREE.Group()
  readonly venuePoints: MarketPoint[]
  readonly returnPoint: MarketPoint
  readonly points: MarketPoint[]
  /** 攤位與入口點擊熱區網格清單（供 MarketGame Raycaster 偵測懸停與點擊） */
  readonly hotspotMeshes: THREE.Mesh[] = []

  private readonly stallSpecs: StallSpec[] = [
    {
      id: 'birth-chart-hall',
      title: '紫微斗數 Ziwei',
      subtitle: '紫微排盤與命理探索',
      signZh: '紫微斗數',
      signEn: 'Ziwei',
      x: -9.6,
      z: -4.1,
      interactX: -9.6,
      interactZ: -0.9,
      rotY: 0,
      accentHex: PALETTE.neonPink,
      secondaryHex: PALETTE.neonGold,
      style: 'ziwei',
    },
    {
      id: 'moon-meditation',
      title: '靈氣療癒 Reiki',
      subtitle: '能量調頻與靜心療癒',
      signZh: '靈氣療癒',
      signEn: 'Reiki',
      x: -3.2,
      z: -4.1,
      interactX: -3.2,
      interactZ: -0.9,
      rotY: 0,
      accentHex: PALETTE.neonReiki,
      secondaryHex: PALETTE.neonViolet,
      style: 'reiki',
    },
    {
      id: 'card-house',
      title: '塔羅占卜 Tarot',
      subtitle: '水晶球指引與牌卡占卜',
      signZh: '塔羅占卜',
      signEn: 'Tarot',
      x: 3.2,
      z: -4.1,
      interactX: 3.2,
      interactZ: -0.9,
      rotY: 0,
      accentHex: PALETTE.neonGold,
      secondaryHex: PALETTE.neonViolet,
      style: 'tarot',
    },
    {
      id: 'chess-guide',
      title: '問事／心靈諮詢',
      subtitle: '傳統問事與心靈對話',
      signZh: '問事／心靈諮詢',
      signEn: 'Consultation',
      x: 9.6,
      z: -4.1,
      interactX: 9.6,
      interactZ: -0.9,
      rotY: 0,
      accentHex: PALETTE.neonAmber,
      secondaryHex: PALETTE.lanternRed,
      style: 'consultation',
    },
    {
      id: 'service-desk',
      title: '市集服務台 Info',
      subtitle: '導覽資訊與預約備忘',
      signZh: '市集服務台',
      signEn: 'Info Desk',
      x: 12.6,
      z: 6.4,
      interactX: 11.4,
      interactZ: 4.4,
      rotY: Math.PI,
      accentHex: '#79c6ff',
      secondaryHex: '#d8f0ff',
      style: 'info',
    },
  ]

  private readonly visualRefs = new Map<MarketPointId, StallVisualRef>()
  private readonly swayingLanterns: SwayingLantern[] = []
  private readonly rainRipples: RainRipple[] = []
  private crystalBall?: THREE.Mesh
  private crystalHalo?: THREE.Sprite
  private rainLines!: THREE.LineSegments
  private rainPositions!: Float32Array
  private readonly rainCount = 340

  currentWeather: TaichungWeatherInfo = {
    condition: 'clear',
    description: '晴天',
    isDay: true,
    temperature: 20,
    rainMm: 0,
  }
  private hemiLight!: THREE.HemisphereLight
  private mainLight!: THREE.DirectionalLight
  private fillLight!: THREE.DirectionalLight
  private asphaltMat!: THREE.MeshStandardMaterial

  private groundCursor!: THREE.Group
  private groundCursorRing!: THREE.Mesh
  private groundCursorActive = false
  private hoveredId: MarketPointId | null = null

  // Q 版低面數角色與 GLTFLoader 佔位節點
  private avatarVisualRoot = new THREE.Group()
  private avatarBodyGroup?: THREE.Group
  private avatarLeftLeg?: THREE.Mesh
  private avatarRightLeg?: THREE.Mesh
  private avatarLeftArm?: THREE.Mesh
  private avatarRightArm?: THREE.Mesh
  private avatarHasCustomModel = false
  private avatarYaw = 0
  private walkCycle = 0
  private time = 0

  constructor(private readonly physics: Physics) {
    this.venuePoints = this.stallSpecs.map(spec => ({
      id: spec.id,
      title: spec.title,
      subtitle: spec.subtitle,
      position: new THREE.Vector3(spec.interactX, 0, spec.interactZ),
      radius: 2.35,
    }))
    this.returnPoint = {
      id: 'return-temple',
      title: '返回天心宮',
      subtitle: '沿街口牌樓回到天心玉皇宮',
      position: new THREE.Vector3(-12.2, 0, 5.2),
      radius: 2.4,
    }
    this.points = [...this.venuePoints, this.returnPoint]

    this.setupAtmosphere()
    this.buildStreetGround()
    // 前後二側大樓完全刪除，僅保留純粹靈光市集與自然天空
    for (const spec of this.stallSpecs) {
      this.buildStall(spec)
    }
    this.buildReturnArch()
    this.buildStreetDetails()
    this.buildRainSystem()
    this.buildGroundCursor()
    this.buildChibiAvatar()
    this.applyWeather(this.currentWeather)
  }

  /** 設定滑鼠懸停高亮回饋（由 MarketGame Raycaster 呼叫） */
  setHoveredPoint(id: MarketPointId | null): void {
    if (this.hoveredId === id) return
    this.hoveredId = id
    for (const [key, ref] of this.visualRefs.entries()) {
      const active = key === id
      if (ref.signMaterial) {
        ref.signMaterial.emissiveIntensity = active ? ref.baseEmissiveIntensity * 1.48 : ref.baseEmissiveIntensity
      }
      if (ref.glowHalo) {
        ref.glowHalo.material.opacity = active ? Math.min(0.95, ref.baseHaloOpacity * 1.65) : ref.baseHaloOpacity
      }
      if (ref.pointLight) {
        ref.pointLight.intensity = active ? ref.baseLightIntensity * 1.45 : ref.baseLightIntensity
      }
      ref.ringMaterial.opacity = active ? 0.92 : 0.34
      ref.ring.scale.setScalar(active ? 1.12 : 1.0)
    }
  }

  /** 控制點擊地面後的目標波紋光環 */
  setGroundCursor(x: number, z: number, visible: boolean): void {
    this.groundCursorActive = visible
    this.groundCursor.visible = visible
    if (visible) {
      this.groundCursor.position.set(x, 0.03, z)
    }
  }

  /**
   * 預留 GLTFLoader 替換真實 3D 角色模型的介面。
   * 載入完成後會自動替換低面數 Q 版佔位幾何體，並維持既有移動與陰影設定。
   */
  async loadCharacterModel(url: string, targetHeight = 1.65): Promise<THREE.Object3D> {
    const loader = new GLTFLoader()
    const gltf = await loader.loadAsync(url)
    const model = gltf.scene

    model.traverse(node => {
      if (node instanceof THREE.Mesh) {
        node.castShadow = true
        node.receiveShadow = true
      }
    })

    // 自動校正模型高度與腳底貼地
    const box = new THREE.Box3().setFromObject(model)
    const size = new THREE.Vector3()
    box.getSize(size)
    if (size.y > 0.001) {
      const scale = targetHeight / size.y
      model.scale.setScalar(scale)
      const scaledBox = new THREE.Box3().setFromObject(model)
      model.position.y -= scaledBox.min.y
    }

    this.avatarVisualRoot.clear()
    this.avatarVisualRoot.add(model)
    this.avatarBodyGroup = undefined
    this.avatarLeftLeg = undefined
    this.avatarRightLeg = undefined
    this.avatarLeftArm = undefined
    this.avatarRightArm = undefined
    this.avatarHasCustomModel = true
    return model
  }

  private setupAtmosphere(): void {
    this.scene.background = new THREE.Color(PALETTE.nightSky)
    this.scene.fog = new THREE.FogExp2(PALETTE.nightSky, 0.007)

    // 柔和環境光（隨台中即時天氣切換日光/夜色）
    this.hemiLight = new THREE.HemisphereLight('#9489c4', '#332d47', 1.38)
    this.scene.add(this.hemiLight)

    // 斜向主光源（白晝太陽光／夜間月光）
    this.mainLight = new THREE.DirectionalLight('#d2d6ff', 1.05)
    this.mainLight.position.set(12, 24, 15)
    this.mainLight.castShadow = true
    this.mainLight.shadow.mapSize.set(1024, 1024)
    this.mainLight.shadow.camera.left = -22
    this.mainLight.shadow.camera.right = 22
    this.mainLight.shadow.camera.top = 18
    this.mainLight.shadow.camera.bottom = -18
    this.mainLight.shadow.camera.near = 2
    this.mainLight.shadow.camera.far = 55
    this.mainLight.shadow.bias = -0.0005
    this.scene.add(this.mainLight)

    // 街口暖色補光
    this.fillLight = new THREE.DirectionalLight('#ffcaa0', 0.45)
    this.fillLight.position.set(-14, 12, 14)
    this.scene.add(this.fillLight)
  }

  private buildStreetGround(): void {
    // 1. 物理地面與邊界牆
    this.physics.addStaticBox(new THREE.Vector3(0, -0.5, 0), new THREE.Vector3(44, 1, 30))
    // 街道四側透明碰撞邊界，防止角色走出街道
    this.physics.addStaticBox(new THREE.Vector3(-16.5, 1.5, 1.5), new THREE.Vector3(0.8, 3, 18))
    this.physics.addStaticBox(new THREE.Vector3(16.5, 1.5, 1.5), new THREE.Vector3(0.8, 3, 18))
    this.physics.addStaticBox(new THREE.Vector3(0, 1.5, -7.2), new THREE.Vector3(34, 3, 0.8))
    this.physics.addStaticBox(new THREE.Vector3(0, 1.5, 10.2), new THREE.Vector3(34, 3, 0.8))

    // 2. 柏油路（晴天為乾淨啞光柏油，雨天則呈現微反光濕潤質感）
    const asphaltTex = makeWetAsphaltTexture()
    this.asphaltMat = new THREE.MeshStandardMaterial({
      map: asphaltTex,
      color: '#ffffff',
      roughness: 0.65,
      metalness: 0.06,
    })
    const road = new THREE.Mesh(new THREE.PlaneGeometry(36, 9.2), this.asphaltMat)
    road.rotation.x = -Math.PI / 2
    road.position.set(0, 0.005, 3.2)
    road.receiveShadow = true
    this.scene.add(road)

    // 3. 北側人行道（石板路，承載 4 間主攤位）
    const sidewalkTex = makeSidewalkTexture()
    const sidewalkMat = new THREE.MeshLambertMaterial({ map: sidewalkTex })
    const curbMat = new THREE.MeshLambertMaterial({ color: PALETTE.curb })

    const northSidewalk = new THREE.Mesh(new THREE.BoxGeometry(36, 0.1, 6.4), sidewalkMat)
    northSidewalk.position.set(0, 0.04, -4.5)
    northSidewalk.receiveShadow = true
    this.scene.add(northSidewalk)

    const northCurb = new THREE.Mesh(new THREE.BoxGeometry(36, 0.12, 0.24), curbMat)
    northCurb.position.set(0, 0.05, -1.3)
    northCurb.receiveShadow = true
    this.scene.add(northCurb)

    // 4. 南側人行道（街角服務台與路燈）
    const southSidewalk = new THREE.Mesh(new THREE.BoxGeometry(36, 0.1, 4.4), sidewalkMat)
    southSidewalk.position.set(0, 0.04, 9.9)
    southSidewalk.receiveShadow = true
    this.scene.add(southSidewalk)

    const southCurb = new THREE.Mesh(new THREE.BoxGeometry(36, 0.12, 0.24), curbMat)
    southCurb.position.set(0, 0.05, 7.7)
    southCurb.receiveShadow = true
    this.scene.add(southCurb)

    // 5. 遠景暗色地基（無任何前後大樓，純粹開闊市集街道與自然天幕）
    const outerBase = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 70),
      new THREE.MeshLambertMaterial({ color: '#171522' }),
    )
    outerBase.rotation.x = -Math.PI / 2
    outerBase.position.y = -0.02
    this.scene.add(outerBase)
  }

  /**
   * 同步台中現實即時天氣（晴天、多雲、雨天、白晝與黑夜）：
   * - 晴天：關閉雨水粒子與水窪漣漪，呈現乾淨開闊天幕與溫暖光照
   * - 雨天：開啟細雨粒子與地面漣漪，啟用濕潤柏油反光倒影
   * - 依據台中現實時間自動切換白晝與黑夜天色
   */
  applyWeather(info: TaichungWeatherInfo): void {
    this.currentWeather = info
    const isRain = info.condition === 'rainy'
    if (this.rainLines) this.rainLines.visible = isRain
    for (const r of this.rainRipples) {
      r.mesh.visible = isRain
    }
    if (this.asphaltMat) {
      this.asphaltMat.roughness = isRain ? 0.20 : 0.65
      this.asphaltMat.metalness = isRain ? 0.30 : 0.06
    }

    if (info.isDay) {
      // 台中日間天氣
      if (isRain) {
        this.scene.background = new THREE.Color('#4c5563')
        this.scene.fog = new THREE.FogExp2('#4c5563', 0.012)
        this.hemiLight.color.set('#9eb0c2')
        this.hemiLight.groundColor.set('#434852')
        this.hemiLight.intensity = 1.15
        this.mainLight.color.set('#c8d5e0')
        this.mainLight.intensity = 0.85
      } else if (info.condition === 'cloudy') {
        this.scene.background = new THREE.Color('#8ea7bd')
        this.scene.fog = new THREE.FogExp2('#8ea7bd', 0.007)
        this.hemiLight.color.set('#cde2f2')
        this.hemiLight.groundColor.set('#6b747d')
        this.hemiLight.intensity = 1.25
        this.mainLight.color.set('#fdf0db')
        this.mainLight.intensity = 1.15
      } else {
        // 台中白日晴天：清爽蔚藍天幕與溫暖日光
        this.scene.background = new THREE.Color('#72b0de')
        this.scene.fog = new THREE.FogExp2('#72b0de', 0.005)
        this.hemiLight.color.set('#e2f4ff')
        this.hemiLight.groundColor.set('#7a6e5b')
        this.hemiLight.intensity = 1.45
        this.mainLight.color.set('#fff6df')
        this.mainLight.intensity = 1.45
      }
    } else {
      // 台中夜間天氣
      if (isRain) {
        this.scene.background = new THREE.Color('#1f1c2c')
        this.scene.fog = new THREE.FogExp2('#1f1c2c', 0.012)
        this.hemiLight.color.set('#8e84b8')
        this.hemiLight.groundColor.set('#242033')
        this.hemiLight.intensity = 1.2
        this.mainLight.color.set('#c2c6ff')
        this.mainLight.intensity = 0.85
      } else if (info.condition === 'cloudy') {
        this.scene.background = new THREE.Color('#1d1a29')
        this.scene.fog = new THREE.FogExp2('#1d1a29', 0.008)
        this.hemiLight.color.set('#968bb8')
        this.hemiLight.groundColor.set('#282238')
        this.hemiLight.intensity = 1.25
        this.mainLight.color.set('#d0d4ff')
        this.mainLight.intensity = 0.95
      } else {
        // 台中晴夜：清澈深紫夜色，微風無雨，攤位霓虹長明
        this.scene.background = new THREE.Color('#151222')
        this.scene.fog = new THREE.FogExp2('#151222', 0.005)
        this.hemiLight.color.set('#9e91cc')
        this.hemiLight.groundColor.set('#2b243d')
        this.hemiLight.intensity = 1.35
        this.mainLight.color.set('#dbe0ff')
        this.mainLight.intensity = 1.05
      }
    }
  }

  /** 建立單一獨立台式雨夜市集攤位 */
  private buildStall(spec: StallSpec): void {
    const group = new THREE.Group()
    group.position.set(spec.x, 0.08, spec.z)
    group.rotation.y = spec.rotY

    const isInfo = spec.style === 'info'
    const width = isInfo ? 3.2 : 4.5
    const depth = isInfo ? 2.2 : 2.9
    const height = isInfo ? 2.5 : 2.95

    const woodMat = new THREE.MeshLambertMaterial({ color: PALETTE.wood })
    const woodDarkMat = new THREE.MeshLambertMaterial({ color: PALETTE.woodDark })
    const metalMat = new THREE.MeshLambertMaterial({
      color: spec.style === 'consultation' ? PALETTE.metalRoofRust : PALETTE.metalRoof,
      flatShading: true,
    })

    // 1. 攤位底台與四根木柱
    const base = new THREE.Mesh(new THREE.BoxGeometry(width + 0.2, 0.14, depth + 0.2), woodDarkMat)
    base.position.y = 0.07
    base.receiveShadow = true
    group.add(base)

    const postGeo = new THREE.BoxGeometry(0.16, height, 0.16)
    for (const [px, pz] of [
      [-width / 2 + 0.12, -depth / 2 + 0.12],
      [width / 2 - 0.12, -depth / 2 + 0.12],
      [-width / 2 + 0.12, depth / 2 - 0.12],
      [width / 2 - 0.12, depth / 2 - 0.12],
    ]) {
      const post = new THREE.Mesh(postGeo, woodDarkMat)
      post.position.set(px, height / 2, pz)
      post.castShadow = true
      group.add(post)
    }

    // 2. 後牆與側牆
    const backWallColor =
      spec.style === 'reiki' ? '#243540' : spec.style === 'tarot' ? '#2b1b3d' : spec.style === 'ziwei' ? '#361f2d' : '#3a2b24'
    const wallMat = new THREE.MeshLambertMaterial({ color: backWallColor })
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(width - 0.12, height - 0.1, 0.16), wallMat)
    backWall.position.set(0, height / 2, -depth / 2 + 0.1)
    backWall.castShadow = true
    backWall.receiveShadow = true
    group.add(backWall)

    for (const side of [-1, 1]) {
      const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.14, height - 0.1, depth - 0.2), wallMat)
      sideWall.position.set(side * (width / 2 - 0.08), height / 2, 0)
      sideWall.castShadow = true
      group.add(sideWall)
    }

    // 3. 台式斜坡浪板鐵皮屋頂（Low-Poly 條紋波浪板）
    const roofGroup = new THREE.Group()
    roofGroup.position.set(0, height + 0.18, 0.15)
    roofGroup.rotation.x = 0.16
    const roofPlate = new THREE.Mesh(new THREE.BoxGeometry(width + 0.65, 0.12, depth + 0.9), metalMat)
    roofPlate.castShadow = true
    roofGroup.add(roofPlate)
    // 鐵皮浪板凸條
    const ridgeCount = isInfo ? 7 : 10
    for (let i = 0; i < ridgeCount; i += 1) {
      const rx = -width / 2 - 0.15 + (i / (ridgeCount - 1)) * (width + 0.3)
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, depth + 0.88), metalMat)
      ridge.position.set(rx, 0.08, 0)
      roofGroup.add(ridge)
    }
    group.add(roofGroup)

    // 4. 屋頂上方發光霓虹／燈箱招牌（CanvasTexture 繁體中文 + 英文）
    const signTex = makeNeonSignTexture(spec.signZh, spec.signEn, spec.style)
    const baseEmissive = spec.style === 'consultation' ? 0.92 : 1.18
    const signMat = new THREE.MeshStandardMaterial({
      map: signTex,
      emissiveMap: signTex,
      emissive: new THREE.Color('#ffffff'),
      emissiveIntensity: baseEmissive,
      roughness: 0.32,
      metalness: 0.08,
    })
    const signFrame = new THREE.Mesh(
      new THREE.BoxGeometry(width - 0.3, 1.05, 0.24),
      new THREE.MeshLambertMaterial({ color: '#1b1924' }),
    )
    signFrame.position.set(0, height + 0.92, depth / 2 - 0.05)
    signFrame.castShadow = true
    group.add(signFrame)

    const signFace = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.44, 0.94), signMat)
    signFace.position.set(0, height + 0.92, depth / 2 + 0.08)
    group.add(signFace)

    // 招牌霓虹柔光光暈（置於招牌後方，維持繁體中英文字體銳利清晰）
    const haloTex = makeGlowHaloTexture(spec.accentHex)
    const haloMat = new THREE.SpriteMaterial({
      map: haloTex,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const halo = new THREE.Sprite(haloMat)
    halo.position.set(0, height + 0.92, depth / 2 - 0.22)
    halo.scale.set(width + 1.6, 2.5, 1)
    group.add(halo)

    // 5. 各攤位專屬台式特色裝潢與道具
    this.decorateStallByStyle(group, spec, width, depth, height, woodMat, woodDarkMat)

    // 6. 攤位專屬暖色／霓虹點光源（照亮雨夜濕潤街道）
    const lightIntensity = spec.style === 'reiki' ? 4.4 : 4.0
    const stallLight = new THREE.PointLight(spec.accentHex, lightIntensity, 9.5, 1.7)
    stallLight.position.set(0, height - 0.2, depth / 2 + 0.85)
    group.add(stallLight)

    // 7. 濕潤柏油路上的霓虹倒影貼花
    const puddleRefMat = new THREE.MeshBasicMaterial({
      map: haloTex,
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const puddleRef = new THREE.Mesh(new THREE.PlaneGeometry(width * 1.15, 3.6), puddleRefMat)
    puddleRef.rotation.x = -Math.PI / 2
    puddleRef.position.set(0, 0.014, depth / 2 + 2.35)
    group.add(puddleRef)

    this.scene.add(group)

    // 8. 物理碰撞體（防止角色穿過攤位）
    this.physics.addStaticBox(
      new THREE.Vector3(spec.x, height / 2, spec.z),
      new THREE.Vector3(width + 0.2, height, depth + 0.2),
    )

    // 9. 點擊熱區（Hotspot）與地面互動高亮環
    const hotspot = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.4, height + 1.6, depth + 0.8),
      new THREE.MeshBasicMaterial({ visible: false }),
    )
    hotspot.position.set(spec.x, (height + 1.6) / 2, spec.z)
    hotspot.userData.marketPointId = spec.id
    this.scene.add(hotspot)
    this.hotspotMeshes.push(hotspot)

    const ringMat = new THREE.MeshBasicMaterial({
      color: spec.accentHex,
      transparent: true,
      opacity: 0.34,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.68, 0.88, 28), ringMat)
    ring.rotation.x = -Math.PI / 2
    ring.position.set(spec.interactX, 0.025, spec.interactZ)
    this.scene.add(ring)

    this.visualRefs.set(spec.id, {
      id: spec.id,
      signMaterial: signMat,
      baseEmissiveIntensity: baseEmissive,
      ring,
      ringMaterial: ringMat,
      glowHalo: halo,
      baseHaloOpacity: 0.42,
      pointLight: stallLight,
      baseLightIntensity: lightIntensity,
    })
  }

  /** 為每間攤位打造專屬的低面數家具、燈籠、玻璃門面、布簾或水晶球 */
  private decorateStallByStyle(
    group: THREE.Group,
    spec: StallSpec,
    width: number,
    depth: number,
    height: number,
    woodMat: THREE.MeshLambertMaterial,
    woodDarkMat: THREE.MeshLambertMaterial,
  ): void {
    // 共用木櫃台／占卜桌
    const counter = new THREE.Mesh(new THREE.BoxGeometry(width - 0.9, 0.86, 0.78), woodMat)
    counter.position.set(0, 0.48, depth / 2 - 0.52)
    counter.castShadow = true
    counter.receiveShadow = true
    group.add(counter)

    if (spec.style === 'ziwei') {
      // 紫微斗數：兩盞垂掛暖紅燈籠 + 捲軸古籍 + 暖黃檯燈
      for (const sx of [-width / 2 + 0.5, width / 2 - 0.5]) {
        const lantern = this.createLantern(PALETTE.lanternRed, 0.26, 0.38)
        lantern.position.set(sx, height - 0.38, depth / 2 + 0.16)
        group.add(lantern)
        this.swayingLanterns.push({ group: lantern, phase: sx * 1.3, amp: 0.05 })
      }
      // 桌上的古籍與暖光小檯燈
      const book = new THREE.Mesh(
        new THREE.BoxGeometry(0.52, 0.09, 0.36),
        new THREE.MeshLambertMaterial({ color: '#9c2d3a' }),
      )
      book.position.set(-0.65, 0.95, depth / 2 - 0.5)
      book.rotation.y = 0.18
      group.add(book)

      const lampShade = new THREE.Mesh(
        new THREE.ConeGeometry(0.22, 0.24, 6),
        new THREE.MeshStandardMaterial({
          color: '#ffe39c',
          emissive: '#ffbe55',
          emissiveIntensity: 1.8,
        }),
      )
      lampShade.position.set(0.85, 1.24, depth / 2 - 0.55)
      group.add(lampShade)

      // 攤前兩張紅色台式小板凳
      group.add(this.createStool(-0.85, 0.24, depth / 2 + 0.55, PALETTE.stoolRed))
      group.add(this.createStool(0.85, 0.24, depth / 2 + 0.55, PALETTE.stoolRed))
    } else if (spec.style === 'reiki') {
      // 靈氣療癒：玻璃門面 + 紫綠色柔和室內光
      const glassMat = new THREE.MeshStandardMaterial({
        color: '#8cf7dc',
        emissive: '#47b89c',
        emissiveIntensity: 0.45,
        transparent: true,
        opacity: 0.36,
        roughness: 0.12,
        metalness: 0.2,
      })
      const glassLeft = new THREE.Mesh(new THREE.BoxGeometry(1.55, height - 0.35, 0.08), glassMat)
      glassLeft.position.set(-width / 2 + 0.92, height / 2, depth / 2 - 0.06)
      group.add(glassLeft)

      const glassRight = new THREE.Mesh(new THREE.BoxGeometry(1.55, height - 0.35, 0.08), glassMat)
      glassRight.position.set(width / 2 - 0.92, height / 2, depth / 2 - 0.06)
      group.add(glassRight)

      // 室內紫綠柔和光壁板
      const innerGlow = new THREE.Mesh(
        new THREE.PlaneGeometry(width - 0.6, height - 0.5),
        new THREE.MeshStandardMaterial({
          color: '#8e74e8',
          emissive: '#6ef2c4',
          emissiveIntensity: 1.15,
          transparent: true,
          opacity: 0.68,
        }),
      )
      innerGlow.position.set(0, height / 2, -depth / 2 + 0.22)
      group.add(innerGlow)

      // 門口盆栽
      for (const sx of [-width / 2 + 0.35, width / 2 - 0.35]) {
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.32, 7), woodDarkMat)
        pot.position.set(sx, 0.22, depth / 2 + 0.35)
        const plant = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.28, 0),
          new THREE.MeshLambertMaterial({ color: '#3b8c6e', flatShading: true }),
        )
        plant.position.set(sx, 0.52, depth / 2 + 0.35)
        group.add(pot, plant)
      }
    } else if (spec.style === 'tarot') {
      // 塔羅占卜：深紫色布簾 + 桌上發光水晶球 + 塔羅牌桌巾
      const curtainMat = new THREE.MeshLambertMaterial({ color: '#3e1e5c', flatShading: true })
      for (const side of [-1, 1]) {
        const curtain = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.44, height - 0.2, 6), curtainMat)
        curtain.position.set(side * (width / 2 - 0.48), height / 2, depth / 2 - 0.14)
        curtain.scale.set(1.1, 1, 0.45)
        group.add(curtain)
      }
      const valance = new THREE.Mesh(new THREE.BoxGeometry(width - 0.3, 0.36, 0.22), curtainMat)
      valance.position.set(0, height - 0.24, depth / 2 - 0.1)
      group.add(valance)

      // 深紫桌巾
      const cloth = new THREE.Mesh(
        new THREE.BoxGeometry(width - 0.8, 0.08, 0.86),
        new THREE.MeshLambertMaterial({ color: '#4c2670' }),
      )
      cloth.position.set(0, 0.92, depth / 2 - 0.52)
      group.add(cloth)

      // 桌上發光水晶球
      const crystalStand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.2, 0.14, 8),
        new THREE.MeshLambertMaterial({ color: PALETTE.neonGold }),
      )
      crystalStand.position.set(0, 1.02, depth / 2 - 0.48)
      group.add(crystalStand)

      const crystal = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.24, 1),
        new THREE.MeshStandardMaterial({
          color: '#e5dcff',
          emissive: '#9f82ff',
          emissiveIntensity: 2.2,
          roughness: 0.15,
        }),
      )
      crystal.position.set(0, 1.32, depth / 2 - 0.48)
      group.add(crystal)
      this.crystalBall = crystal

      const cHalo = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: makeGlowHaloTexture('#b89aff'),
          transparent: true,
          opacity: 0.72,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      )
      cHalo.position.set(0, 1.32, depth / 2 - 0.42)
      cHalo.scale.set(1.15, 1.15, 1)
      group.add(cHalo)
      this.crystalHalo = cHalo

      // 兩張木質小圓凳
      group.add(this.createStool(-0.75, 0.24, depth / 2 + 0.55, PALETTE.woodLight))
      group.add(this.createStool(0.75, 0.24, depth / 2 + 0.55, PALETTE.woodLight))
    } else if (spec.style === 'consultation') {
      // 問事／心靈諮詢：傳統暖黃吊燈 + 茶壺與象棋盤 + 台式小板凳
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 8, 8),
        new THREE.MeshStandardMaterial({
          color: '#fff3c4',
          emissive: '#ffc94d',
          emissiveIntensity: 2.0,
        }),
      )
      bulb.position.set(0, height - 0.48, depth / 2 - 0.3)
      group.add(bulb)

      // 側掛傳統暖黃小直式燈箱
      const sideBox = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.95, 0.42),
        new THREE.MeshStandardMaterial({
          color: '#ffe082',
          emissive: '#ffbf3f',
          emissiveIntensity: 1.5,
        }),
      )
      sideBox.position.set(width / 2 + 0.18, height - 0.4, depth / 2 - 0.2)
      group.add(sideBox)

      // 桌上茶壺與棋盤
      const board = new THREE.Mesh(
        new THREE.BoxGeometry(0.68, 0.06, 0.5),
        new THREE.MeshLambertMaterial({ color: '#c48f56' }),
      )
      board.position.set(-0.3, 0.94, depth / 2 - 0.5)
      const teapot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.14, 0.16, 7),
        new THREE.MeshLambertMaterial({ color: '#8a3928' }),
      )
      teapot.position.set(0.65, 1.0, depth / 2 - 0.52)
      group.add(board, teapot)

      group.add(this.createStool(-0.85, 0.24, depth / 2 + 0.55, PALETTE.stoolBlue))
      group.add(this.createStool(0.85, 0.24, depth / 2 + 0.55, PALETTE.stoolRed))
    } else {
      // 市集服務台：藍白小檯燈
      const deskLamp = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.16, 0.24, 7),
        new THREE.MeshStandardMaterial({
          color: '#d6f0ff',
          emissive: '#6ec4ff',
          emissiveIntensity: 1.6,
        }),
      )
      deskLamp.position.set(0, 1.04, depth / 2 - 0.5)
      group.add(deskLamp)
    }
  }

  /** 街口「返回天心宮」傳統燈籠霓虹牌樓 */
  private buildReturnArch(): void {
    const pos = this.returnPoint.position
    const group = new THREE.Group()
    group.position.set(pos.x, 0.06, pos.z)
    group.rotation.y = Math.PI / 5

    const pillarMat = new THREE.MeshLambertMaterial({ color: '#7a2520' })
    for (const sx of [-1.45, 1.45]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 3.4, 8), pillarMat)
      pillar.position.set(sx, 1.7, 0)
      pillar.castShadow = true
      group.add(pillar)

      const lantern = this.createLantern(PALETTE.lanternRed, 0.24, 0.36)
      lantern.position.set(sx, 2.85, 0.34)
      group.add(lantern)
      this.swayingLanterns.push({ group: lantern, phase: sx * 2.1, amp: 0.06 })
    }

    const beam = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.26, 0.32), pillarMat)
    beam.position.y = 3.35
    group.add(beam)

    const signTex = makeNeonSignTexture('返回天心宮', 'Back to Temple', 'return')
    const signMat = new THREE.MeshStandardMaterial({
      map: signTex,
      emissiveMap: signTex,
      emissive: new THREE.Color('#ffffff'),
      emissiveIntensity: 1.65,
      roughness: 0.3,
    })
    const sign = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.85, 0.18), signMat)
    sign.position.set(0, 3.85, 0)
    group.add(sign)

    const archLight = new THREE.PointLight('#ff9a52', 3.4, 8.5, 1.8)
    archLight.position.set(0, 2.8, 0.5)
    group.add(archLight)

    this.scene.add(group)

    // 點擊熱區與地面互動環
    const hotspot = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 4.4, 1.6),
      new THREE.MeshBasicMaterial({ visible: false }),
    )
    hotspot.position.set(pos.x, 2.2, pos.z)
    hotspot.rotation.y = Math.PI / 5
    hotspot.userData.marketPointId = 'return-temple'
    this.scene.add(hotspot)
    this.hotspotMeshes.push(hotspot)

    const ringMat = new THREE.MeshBasicMaterial({
      color: '#ffcf66',
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.98, 28), ringMat)
    ring.rotation.x = -Math.PI / 2
    ring.position.set(pos.x, 0.025, pos.z)
    this.scene.add(ring)

    this.visualRefs.set('return-temple', {
      id: 'return-temple',
      signMaterial: signMat,
      baseEmissiveIntensity: 1.65,
      ring,
      ringMaterial: ringMat,
      baseHaloOpacity: 0.4,
      pointLight: archLight,
      baseLightIntensity: 3.4,
    })
  }

  /** 街道低面數細節：電線桿、垂弧電線、復古紅燈籠串、三角錐、小板凳 */
  private buildStreetDetails(): void {
    const poleMat = new THREE.MeshLambertMaterial({ color: PALETTE.poleConcrete })
    const bulbMat = new THREE.MeshStandardMaterial({
      color: '#ffebb5',
      emissive: '#ffcb6b',
      emissiveIntensity: 2.1,
    })
    const polePositions: [number, number][] = [
      [-14.5, -1.6],
      [14.5, -1.6],
      [-14.5, 9.6],
      [14.5, 9.6],
    ]

    const poleTops: THREE.Vector3[] = []
    for (const [px, pz] of polePositions) {
      const poleGroup = new THREE.Group()
      poleGroup.position.set(px, 0, pz)

      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 6.8, 7), poleMat)
      pole.position.y = 3.4
      pole.castShadow = true
      poleGroup.add(pole)

      const crossBar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 0.1), poleMat)
      crossBar.position.set(0, 6.2, 0)
      poleGroup.add(crossBar)

      // 路燈燈臂與暖黃路燈
      const armDir = pz < 0 ? 1 : -1
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.15), poleMat)
      arm.position.set(0, 5.4, armDir * 0.55)
      poleGroup.add(arm)

      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.42), bulbMat)
      lamp.position.set(0, 5.32, armDir * 1.05)
      poleGroup.add(lamp)

      const streetLight = new THREE.PointLight('#ffd285', 2.4, 11.5, 1.8)
      streetLight.position.set(0, 5.0, armDir * 1.05)
      poleGroup.add(streetLight)

      this.scene.add(poleGroup)
      poleTops.push(new THREE.Vector3(px, 6.2, pz))
      this.physics.addStaticCylinder(new THREE.Vector3(px, 1.4, pz), 0.28, 2.8)
    }

    // 垂弧黑色電線連接四角電線桿（中央視角完全無阻擋）
    const wireMat = new THREE.LineBasicMaterial({ color: '#110f1a' })
    const wirePairs: [number, number][] = [
      [0, 1],
      [0, 2],
      [1, 3],
      [2, 3],
    ]
    for (const [a, b] of wirePairs) {
      const start = poleTops[a]
      const end = poleTops[b]
      const mid = start.clone().lerp(end, 0.5)
      mid.y -= 0.72
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end)
      const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(16))
      this.scene.add(new THREE.Line(geo, wireMat))
    }

    // 跨街復古紅燈籠串（懸掛於上方高處 y = 4.2m，美觀且不遮擋攤位招牌與平視視角）
    const lanternSpan = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-14.5, 5.2, -1.6),
      new THREE.Vector3(0, 4.35, -1.6),
      new THREE.Vector3(14.5, 5.2, -1.6),
    )
    this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(lanternSpan.getPoints(20)), wireMat))
    for (let i = 1; i <= 9; i += 1) {
      const p = lanternSpan.getPoint(i / 10)
      const lantern = this.createLantern(PALETTE.lanternRed, 0.2, 0.3)
      lantern.position.set(p.x, p.y - 0.18, p.z)
      this.scene.add(lantern)
      this.swayingLanterns.push({ group: lantern, phase: i * 0.75, amp: 0.065 })
    }

    // 路邊橘白反光三角錐（Traffic Cones）
    const conePositions: [number, number][] = [
      [-13.0, -0.75],
      [-6.4, -0.85],
      [6.4, -0.85],
      [13.4, -0.75],
      [-4.2, 7.25],
      [8.2, 7.25],
    ]
    for (const [cx, cz] of conePositions) {
      this.scene.add(this.createTrafficCone(cx, cz))
    }

    // 街角散落的台式塑膠小板凳
    this.scene.add(this.createStool(-5.8, 0.24, 8.6, PALETTE.stoolRed))
    this.scene.add(this.createStool(-5.1, 0.24, 8.9, PALETTE.stoolBlue))
    this.scene.add(this.createStool(5.4, 0.24, 8.7, PALETTE.stoolRed))
  }

  private createLantern(colorHex: string, radius: number, height: number): THREE.Group {
    const g = new THREE.Group()
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.72, radius * 0.72, height, 8),
      new THREE.MeshStandardMaterial({
        color: colorHex,
        emissive: colorHex,
        emissiveIntensity: 1.9,
        roughness: 0.45,
      }),
    )
    const capMat = new THREE.MeshLambertMaterial({ color: '#1b1414' })
    const topCap = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.5, radius * 0.65, 0.06, 8), capMat)
    topCap.position.y = height / 2 + 0.02
    const botCap = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.6, radius * 0.45, 0.06, 8), capMat)
    botCap.position.y = -height / 2 - 0.02
    const tassel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.04, 0.16, 5),
      new THREE.MeshLambertMaterial({ color: PALETTE.neonGold }),
    )
    tassel.position.y = -height / 2 - 0.12
    g.add(body, topCap, botCap, tassel)
    return g
  }

  private createStool(x: number, y: number, z: number, colorHex: string): THREE.Group {
    const g = new THREE.Group()
    g.position.set(x, y, z)
    const mat = new THREE.MeshLambertMaterial({ color: colorHex, flatShading: true })
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.07, 0.38), mat)
    seat.position.y = 0.2
    seat.castShadow = true
    g.add(seat)
    const legGeo = new THREE.BoxGeometry(0.06, 0.4, 0.06)
    for (const [lx, lz] of [[-0.14, -0.14], [0.14, -0.14], [-0.14, 0.14], [0.14, 0.14]]) {
      const leg = new THREE.Mesh(legGeo, mat)
      leg.position.set(lx, 0, lz)
      g.add(leg)
    }
    return g
  }

  private createTrafficCone(x: number, z: number): THREE.Group {
    const g = new THREE.Group()
    g.position.set(x, 0.02, z)
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.05, 0.38),
      new THREE.MeshLambertMaterial({ color: '#1b1924' }),
    )
    base.position.y = 0.025
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.56, 7),
      new THREE.MeshLambertMaterial({ color: PALETTE.coneOrange, flatShading: true }),
    )
    cone.position.y = 0.32
    cone.castShadow = true
    const stripe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.115, 0.12, 7),
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        emissive: '#e8e8ff',
        emissiveIntensity: 0.55,
      }),
    )
    stripe.position.y = 0.34
    g.add(base, cone, stripe)
    return g
  }

  /** 微弱細雨粒子與地面雨滴漣漪特效 */
  private buildRainSystem(): void {
    this.rainPositions = new Float32Array(this.rainCount * 2 * 3)
    for (let i = 0; i < this.rainCount; i += 1) {
      const x = (Math.random() - 0.5) * 38
      const y = Math.random() * 14 + 0.5
      const z = (Math.random() - 0.5) * 24 + 1
      const idx = i * 6
      this.rainPositions[idx] = x
      this.rainPositions[idx + 1] = y
      this.rainPositions[idx + 2] = z
      this.rainPositions[idx + 3] = x - 0.06
      this.rainPositions[idx + 4] = y - 0.52
      this.rainPositions[idx + 5] = z + 0.03
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3))
    const mat = new THREE.LineBasicMaterial({
      color: '#b8c4ff',
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
    })
    this.rainLines = new THREE.LineSegments(geo, mat)
    this.rainLines.visible = false
    this.scene.add(this.rainLines)

    // 柏油路微弱雨滴擴散漣漪
    const rippleGeo = new THREE.RingGeometry(0.04, 0.08, 12)
    for (let i = 0; i < 16; i += 1) {
      const rMat = new THREE.MeshBasicMaterial({
        color: '#a9b8ff',
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
      const rMesh = new THREE.Mesh(rippleGeo, rMat)
      rMesh.visible = false
      rMesh.rotation.x = -Math.PI / 2
      rMesh.position.set((Math.random() - 0.5) * 28, 0.018, (Math.random() - 0.1) * 7.5)
      this.scene.add(rMesh)
      this.rainRipples.push({
        mesh: rMesh,
        mat: rMat,
        phase: Math.random(),
        speed: 0.8 + Math.random() * 0.6,
      })
    }
  }

  /** 點擊地面移動的霓虹目標游標 */
  private buildGroundCursor(): void {
    this.groundCursor = new THREE.Group()
    this.groundCursor.visible = false
    const ringMat = new THREE.MeshBasicMaterial({
      color: PALETTE.neonReiki,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    this.groundCursorRing = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.42, 24), ringMat)
    this.groundCursorRing.rotation.x = -Math.PI / 2
    const dot = new THREE.Mesh(
      new THREE.CircleGeometry(0.11, 16),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false }),
    )
    dot.rotation.x = -Math.PI / 2
    dot.position.y = 0.01
    this.groundCursor.add(this.groundCursorRing, dot)
    this.scene.add(this.groundCursor)
  }

  /** 低面數 Q 版幾何佔位角色（預留 loadCharacterModel 替換 GLTF 模型） */
  private buildChibiAvatar(): void {
    // 腳底柔和陰影圓盤
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.42, 16),
      new THREE.MeshBasicMaterial({ color: '#090710', transparent: true, opacity: 0.45, depthWrite: false }),
    )
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = 0.02
    this.avatar.add(shadow)

    const bodyGroup = new THREE.Group()
    const skinMat = new THREE.MeshLambertMaterial({ color: '#f7d3b5' })
    const hairMat = new THREE.MeshLambertMaterial({ color: '#2b2236', flatShading: true })
    const coatMat = new THREE.MeshLambertMaterial({ color: '#3b6d96', flatShading: true })
    const scarfMat = new THREE.MeshLambertMaterial({ color: '#f2b857' })
    const bootMat = new THREE.MeshLambertMaterial({ color: '#2d242a' })
    const eyeMat = new THREE.MeshBasicMaterial({ color: '#1b1520' })

    // 雙腳
    const legGeo = new THREE.BoxGeometry(0.16, 0.34, 0.16)
    const leftLeg = new THREE.Mesh(legGeo, bootMat)
    leftLeg.position.set(-0.13, 0.17, 0)
    leftLeg.castShadow = true
    const rightLeg = new THREE.Mesh(legGeo, bootMat)
    rightLeg.position.set(0.13, 0.17, 0)
    rightLeg.castShadow = true
    bodyGroup.add(leftLeg, rightLeg)

    // 外套身體
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, 0.58, 7), coatMat)
    torso.position.y = 0.62
    torso.castShadow = true
    bodyGroup.add(torso)

    // 暖黃圍巾
    const scarf = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.27, 0.12, 8), scarfMat)
    scarf.position.y = 0.9
    bodyGroup.add(scarf)

    // 雙手
    const armGeo = new THREE.BoxGeometry(0.12, 0.34, 0.12)
    const leftArm = new THREE.Mesh(armGeo, coatMat)
    leftArm.position.set(-0.33, 0.66, 0)
    leftArm.castShadow = true
    const rightArm = new THREE.Mesh(armGeo, coatMat)
    rightArm.position.set(0.33, 0.66, 0)
    rightArm.castShadow = true
    bodyGroup.add(leftArm, rightArm)

    // Q 版大頭與髮型
    const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.34, 1), skinMat)
    head.position.y = 1.24
    head.castShadow = true
    bodyGroup.add(head)

    const hair = new THREE.Mesh(new THREE.DodecahedronGeometry(0.36, 1), hairMat)
    hair.position.set(0, 1.32, -0.05)
    hair.scale.set(1.02, 0.88, 1.02)
    bodyGroup.add(hair)

    // 眼睛
    const eyeGeo = new THREE.BoxGeometry(0.05, 0.07, 0.04)
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat)
    leftEye.position.set(-0.11, 1.24, 0.31)
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat)
    rightEye.position.set(0.11, 1.24, 0.31)
    bodyGroup.add(leftEye, rightEye)

    this.avatarBodyGroup = bodyGroup
    this.avatarLeftLeg = leftLeg
    this.avatarRightLeg = rightLeg
    this.avatarLeftArm = leftArm
    this.avatarRightArm = rightArm

    this.avatarVisualRoot.add(bodyGroup)
    this.avatar.add(this.avatarVisualRoot)
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

  /** 每幀更新細雨粒子、燈籠微擺、水晶球脈動與角色走路動畫 */
  update(dt: number, moveSpeed = 0, facingYaw?: number): void {
    this.time += dt

    // 1. Q 版角色走路循環與面向平滑轉向
    const isMoving = moveSpeed > 0.2
    if (facingYaw !== undefined && isMoving) {
      const diff = Math.atan2(Math.sin(facingYaw - this.avatarYaw), Math.cos(facingYaw - this.avatarYaw))
      this.avatarYaw += diff * Math.min(1, dt * 12)
      this.avatarVisualRoot.rotation.y = this.avatarYaw
    }

    if (!this.avatarHasCustomModel && this.avatarBodyGroup) {
      if (isMoving) {
        this.walkCycle += dt * Math.min(12, 6 + moveSpeed * 1.1)
        const swing = Math.sin(this.walkCycle) * 0.55
        if (this.avatarLeftLeg) this.avatarLeftLeg.rotation.x = swing
        if (this.avatarRightLeg) this.avatarRightLeg.rotation.x = -swing
        if (this.avatarLeftArm) this.avatarLeftArm.rotation.x = -swing * 0.8
        if (this.avatarRightArm) this.avatarRightArm.rotation.x = swing * 0.8
        this.avatarBodyGroup.position.y = Math.abs(Math.sin(this.walkCycle)) * 0.06
      } else {
        if (this.avatarLeftLeg) this.avatarLeftLeg.rotation.x *= 0.82
        if (this.avatarRightLeg) this.avatarRightLeg.rotation.x *= 0.82
        if (this.avatarLeftArm) this.avatarLeftArm.rotation.x *= 0.82
        if (this.avatarRightArm) this.avatarRightArm.rotation.x *= 0.82
        this.avatarBodyGroup.position.y = Math.sin(this.time * 2.5) * 0.02
      }
    }

    // 2. 點擊地面游標脈動
    if (this.groundCursorActive) {
      const s = 0.92 + Math.sin(this.time * 7.5) * 0.1
      this.groundCursorRing.scale.set(s, s, 1)
    }

    // 3. 懸停攤位高亮環呼吸動畫
    if (this.hoveredId) {
      const ref = this.visualRefs.get(this.hoveredId)
      if (ref) {
        const pulse = 1.1 + Math.sin(this.time * 6.5) * 0.07
        ref.ring.scale.setScalar(pulse)
      }
    }

    // 4. 塔羅發光水晶球緩慢呼吸
    if (this.crystalBall && this.crystalHalo) {
      const pulse = 1 + Math.sin(this.time * 2.8) * 0.08
      this.crystalBall.rotation.y += dt * 0.7
      this.crystalHalo.scale.set(1.15 * pulse, 1.15 * pulse, 1)
    }

    // 5. 復古紅燈籠微風搖曳
    for (const item of this.swayingLanterns) {
      item.group.rotation.z = Math.sin(this.time * 1.9 + item.phase) * item.amp
    }

    // 6. 細雨粒子與水窪漣漪（僅在台中為雨天時運算與渲染）
    if (this.currentWeather.condition === 'rainy' && this.rainLines) {
      const fallSpeed = 12.5 * dt
      const windDrift = -1.4 * dt
      for (let i = 0; i < this.rainCount; i += 1) {
        const idx = i * 6
        let y = this.rainPositions[idx + 1] - fallSpeed
        let x = this.rainPositions[idx] + windDrift
        if (y < 0.1) {
          y = 13.5 + Math.random() * 2.5
          x = (Math.random() - 0.5) * 38
        }
        this.rainPositions[idx] = x
        this.rainPositions[idx + 1] = y
        this.rainPositions[idx + 3] = x - 0.06
        this.rainPositions[idx + 4] = y - 0.52
      }
      const posAttr = this.rainLines.geometry.getAttribute('position') as THREE.BufferAttribute
      posAttr.needsUpdate = true

      // 7. 濕潤柏油路細雨漣漪
      for (const r of this.rainRipples) {
        r.phase = (r.phase + dt * r.speed) % 1
        const s = 0.6 + r.phase * 2.4
        r.mesh.scale.set(s, s, 1)
        r.mat.opacity = (1 - r.phase) * 0.24
      }
    }
  }
}
