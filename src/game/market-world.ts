import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { Physics, RAPIER } from '../engine/physics'
import {
  MARKET_BUILDING_SCALE_DEFAULT,
  MARKET_BUILDING_SCALE_MAX,
  MARKET_BUILDING_SCALE_MIN,
  MARKET_STALL_TARGET_HEIGHT,
  PLAYER_TARGET_HEIGHT,
  normalizeScaleToHeight,
} from './sceneConfig'

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
      x: -7.8,
      z: -3.4,
      interactX: -7.8,
      interactZ: -1.1,
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
      x: -2.6,
      z: -3.4,
      interactX: -2.6,
      interactZ: -1.1,
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
      x: 2.6,
      z: -3.4,
      interactX: 2.6,
      interactZ: -1.1,
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
      x: 7.8,
      z: -3.4,
      interactX: 7.8,
      interactZ: -1.1,
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
      x: 10.6,
      z: 5.6,
      interactX: 9.6,
      interactZ: 4.0,
      rotY: Math.PI,
      accentHex: '#79c6ff',
      secondaryHex: '#d8f0ff',
      style: 'info',
    },
  ]

  private readonly visualRefs = new Map<MarketPointId, StallVisualRef>()
  private readonly swayingLanterns: SwayingLantern[] = []
  private readonly rainRipples: RainRipple[] = []
  private readonly floatingIslets: { group: THREE.Group; baseY: number; amp: number; speed: number; phase: number }[] = []
  private readonly driftingClouds: { group: THREE.Group; speed: number; minX: number; maxX: number }[] = []
  private readonly skyCloudMats: THREE.MeshLambertMaterial[] = []
  private readonly waterfallMats: THREE.MeshBasicMaterial[] = []
  private readonly windmillBlades: THREE.Group[] = []
  private skyCrystalCore?: THREE.Mesh
  private skyRuneRing?: THREE.Mesh
  private skyUnderLight?: THREE.PointLight
  private skyStars?: THREE.Points
  private skyMotes?: THREE.Points
  private skyMotesPositions?: Float32Array
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

  /** 可受 `marketBuildingScale` 除錯拉桿即時等比例調整之市集建築與物件清單 */
  private marketBuildingScale = MARKET_BUILDING_SCALE_DEFAULT
  private readonly scalableBuildings: {
    group: THREE.Object3D
    baseTargetHeight: number
    groundY: number
    hotspot?: THREE.Mesh
    hotspotBaseSize?: THREE.Vector3
    collider?: RAPIER.Collider
    colliderPos?: { x: number; z: number }
    colliderBaseSize?: THREE.Vector3
  }[] = []

  // Q 版低面數角色與 GLTFLoader 佔位節點
  private avatarVisualRoot = new THREE.Group()
  private avatarBodyGroup?: THREE.Group
  private avatarBaseY = 0
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
      position: new THREE.Vector3(-10.4, 0, 4.6),
      radius: 2.4,
    }
    this.points = [...this.venuePoints, this.returnPoint]

    this.setupAtmosphere()
    this.buildStreetGround()
    // 周圍打造天空之城（浮空島岩盤、雲海、遠景天空城遺跡與飄浮白雲），主市集完全不更動
    this.buildSkyCitySurroundings()
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
   * 除錯輔助：動態調整市集整體建築與街景物件比例（0.7 ~ 1.5，預設 1.0）。
   * 僅改變各建築群組的 scale 與貼地位置，不更動人物身高（維持 PLAYER_TARGET_HEIGHT）與任何美術材質。
   */
  setMarketBuildingScale(scale: number): void {
    const s = THREE.MathUtils.clamp(scale, MARKET_BUILDING_SCALE_MIN, MARKET_BUILDING_SCALE_MAX)
    this.marketBuildingScale = s

    for (const entry of this.scalableBuildings) {
      normalizeScaleToHeight(entry.group, entry.baseTargetHeight * s, entry.groundY)

      if (entry.hotspot && entry.hotspotBaseSize) {
        entry.hotspot.scale.setScalar(s)
        entry.hotspot.position.y = entry.groundY + (entry.hotspotBaseSize.y * s) / 2
      }

      if (entry.collider && entry.colliderPos && entry.colliderBaseSize) {
        this.physics.removeCollider(entry.collider)
        const sx = entry.colliderBaseSize.x * s
        const sy = entry.colliderBaseSize.y * s
        const sz = entry.colliderBaseSize.z * s
        entry.collider = this.physics.addStaticBox(
          new THREE.Vector3(entry.colliderPos.x, entry.groundY + sy / 2, entry.colliderPos.z),
          new THREE.Vector3(sx, sy, sz),
        )
      }
    }
  }

  getMarketBuildingScale(): number {
    return this.marketBuildingScale
  }

  /**
   * 預留 GLTFLoader 替換真實 3D 角色模型的介面。
   * 載入完成後會自動替換低面數 Q 版佔位幾何體，並維持既有移動與陰影設定。
   */
  async loadCharacterModel(url: string, targetHeight = PLAYER_TARGET_HEIGHT): Promise<THREE.Object3D> {
    const loader = new GLTFLoader()
    const gltf = await loader.loadAsync(url)
    const model = gltf.scene

    model.traverse(node => {
      if (node instanceof THREE.Mesh) {
        node.castShadow = true
        node.receiveShadow = true
      }
    })

    // 使用共用 normalizeScaleToHeight 自動校正模型高度與腳底貼地
    normalizeScaleToHeight(model, targetHeight, 0)

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
        // 台中白日晴天：清爽蔚藍天幕與溫暖日光（適度淡霧讓遠景天空之城清晰可辨）
        this.scene.background = new THREE.Color('#78b7e6')
        this.scene.fog = new THREE.FogExp2('#8cc4ec', 0.0036)
        this.hemiLight.color.set('#e8f6ff')
        this.hemiLight.groundColor.set('#7a7060')
        this.hemiLight.intensity = 1.5
        this.mainLight.color.set('#fff6df')
        this.mainLight.intensity = 1.48
      }
    } else {
      // 台中夜間天氣
      if (isRain) {
        this.scene.background = new THREE.Color('#1f1c2c')
        this.scene.fog = new THREE.FogExp2('#1f1c2c', 0.011)
        this.hemiLight.color.set('#8e84b8')
        this.hemiLight.groundColor.set('#242033')
        this.hemiLight.intensity = 1.2
        this.mainLight.color.set('#c2c6ff')
        this.mainLight.intensity = 0.85
      } else if (info.condition === 'cloudy') {
        this.scene.background = new THREE.Color('#1d1a29')
        this.scene.fog = new THREE.FogExp2('#1d1a29', 0.007)
        this.hemiLight.color.set('#968bb8')
        this.hemiLight.groundColor.set('#282238')
        this.hemiLight.intensity = 1.25
        this.mainLight.color.set('#d0d4ff')
        this.mainLight.intensity = 0.95
      } else {
        // 台中晴夜：清澈深紫夜色，微風無雨，攤位霓虹長明
        this.scene.background = new THREE.Color('#151222')
        this.scene.fog = new THREE.FogExp2('#151222', 0.004)
        this.hemiLight.color.set('#9e91cc')
        this.hemiLight.groundColor.set('#2b243d')
        this.hemiLight.intensity = 1.35
        this.mainLight.color.set('#dbe0ff')
        this.mainLight.intensity = 1.05
      }
    }

    // 同步雲海與飄浮白雲色調以符合當下日夜與天氣
    const cloudColor = info.isDay
      ? isRain
        ? '#8a95a6'
        : info.condition === 'cloudy'
          ? '#d6e0ec'
          : '#ffffff'
      : isRain
        ? '#3f3c5c'
        : '#6c6a96'
    const cloudEmissive = info.isDay
      ? isRain
        ? '#313945'
        : '#5a738c'
      : '#343259'
    for (const mat of this.skyCloudMats) {
      mat.color.set(cloudColor)
      mat.emissive.set(cloudEmissive)
      mat.emissiveIntensity = info.isDay ? (isRain ? 0.16 : 0.28) : 0.42
    }
    if (this.skyStars) {
      this.skyStars.visible = !info.isDay && !isRain
    }
    if (this.skyUnderLight) {
      this.skyUnderLight.intensity = info.isDay ? 5.5 : 10.5
    }
  }

  /**
   * 打造「天空之城（Laputa）」周圍浮空環境（主市集街道、攤位與互動完全維持不變）：
   * 1. 主市集下方：古石城垣拱門底座、苔蘚草沿、倒錐浮空岩盤、懸浮飛行石結晶與垂掛雲瀑
   * 2. 周圍遠景：浮空小島群（風車塔島、古石拱水道島、遠方天空城聖殿圓頂與大樹）
   * 3. 雲海與飄雲：島嶼下方蓬鬆雲海與天際緩緩飄動的低面數白雲，加上微光天空塵埃
   */
  private buildSkyCitySurroundings(): void {
    const stoneLightMat = new THREE.MeshLambertMaterial({ color: '#d8d2c3', flatShading: true })
    const stoneMidMat = new THREE.MeshLambertMaterial({ color: '#b5ae9e', flatShading: true })
    const stoneDarkMat = new THREE.MeshLambertMaterial({ color: '#7d7870', flatShading: true })
    const rockUpperMat = new THREE.MeshLambertMaterial({ color: '#6b635a', flatShading: true })
    const rockDeepMat = new THREE.MeshLambertMaterial({ color: '#4d4744', flatShading: true })
    const grassMat = new THREE.MeshLambertMaterial({ color: '#67a85c', flatShading: true })
    const mossMat = new THREE.MeshLambertMaterial({ color: '#4f8a4b', flatShading: true })
    const foliageMat = new THREE.MeshLambertMaterial({ color: '#478246', flatShading: true })
    const foliageLightMat = new THREE.MeshLambertMaterial({ color: '#6fb35b', flatShading: true })
    const woodMat = new THREE.MeshLambertMaterial({ color: '#8a5d3b', flatShading: true })
    const sailMat = new THREE.MeshLambertMaterial({ color: '#f3ecd9', side: THREE.DoubleSide })

    // ─── 1. 主市集下方：天空之城浮空島石砌底座與倒錐岩盤（中心 x=0, z=2.2，嚴格位於 y <= -0.02） ───
    const mainIsland = new THREE.Group()
    mainIsland.position.set(0, 0, 2.2)

    // 外圈苔蘚石垣框（微微包覆主市集四周邊緣，高於 -0.05 不會蓋過柏油路與人行道）
    const rimPlate = new THREE.Mesh(new THREE.BoxGeometry(37.4, 0.55, 21.0), stoneMidMat)
    rimPlate.position.set(0, -0.32, 0)
    rimPlate.receiveShadow = true
    mainIsland.add(rimPlate)

    // 苔蘚草地沿邊（在主市集外框周圍點綴生機綠意，位於市集範圍外緣）
    const rimTrimN = new THREE.Mesh(new THREE.BoxGeometry(37.6, 0.14, 0.72), grassMat)
    rimTrimN.position.set(0, -0.05, -10.3)
    mainIsland.add(rimTrimN)
    const rimTrimS = new THREE.Mesh(new THREE.BoxGeometry(37.6, 0.14, 0.72), grassMat)
    rimTrimS.position.set(0, -0.05, 10.3)
    mainIsland.add(rimTrimS)
    const rimTrimW = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.14, 21.2), grassMat)
    rimTrimW.position.set(-18.4, -0.05, 0)
    mainIsland.add(rimTrimW)
    const rimTrimE = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.14, 21.2), grassMat)
    rimTrimE.position.set(18.4, -0.05, 0)
    mainIsland.add(rimTrimE)

    // 古石城垣牆體與拉普達風格拱門扶壁（正面與背面皆有立體石砌細節，平視視角清晰可見）
    const terraceWall = new THREE.Mesh(new THREE.BoxGeometry(36.2, 1.35, 19.8), stoneLightMat)
    terraceWall.position.set(0, -1.25, 0)
    mainIsland.add(terraceWall)

    const archSpan = 3.2
    const archGemMat = new THREE.MeshBasicMaterial({ color: '#7ff3ff' })
    for (let x = -16; x <= 16; x += archSpan) {
      // 南面（平視正前方底部）石柱與拱門凹槽
      const pillarS = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.45, 0.65), stoneMidMat)
      pillarS.position.set(x, -1.25, 10.05)
      mainIsland.add(pillarS)
      if (x < 16) {
        const archRecessS = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.92, 0.25), stoneDarkMat)
        archRecessS.position.set(x + archSpan / 2, -1.36, 9.95)
        mainIsland.add(archRecessS)
        // 拉普達風格微光飛行石鑲嵌晶點
        const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), archGemMat)
        gem.position.set(x + archSpan / 2, -1.12, 10.12)
        mainIsland.add(gem)
      }
      // 北面石柱
      const pillarN = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.45, 0.65), stoneMidMat)
      pillarN.position.set(x, -1.25, -10.05)
      mainIsland.add(pillarN)
    }

    // 底部倒錐浮空岩盤（多層 Low-Poly 切削岩塊向下收束）
    const rockTier1 = new THREE.Mesh(new THREE.CylinderGeometry(18.5, 13.8, 2.3, 10), rockUpperMat)
    rockTier1.scale.set(1.1, 1, 0.62)
    rockTier1.position.set(0, -3.0, 0)
    mainIsland.add(rockTier1)

    const rockTier2 = new THREE.Mesh(new THREE.CylinderGeometry(13.2, 6.2, 2.8, 9), rockDeepMat)
    rockTier2.scale.set(1.12, 1, 0.62)
    rockTier2.position.set(0, -5.3, 0)
    mainIsland.add(rockTier2)

    const rockSpire = new THREE.Mesh(new THREE.ConeGeometry(5.8, 3.6, 7), rockDeepMat)
    rockSpire.rotation.x = Math.PI
    rockSpire.position.set(0, -8.2, 0)
    mainIsland.add(rockSpire)

    // 岩盤周邊不規則附屬浮岩簇與垂掛苔蘚藤蔓
    const subRocks: [number, number, number, number, number][] = [
      [-14.5, -2.9, 5.2, 3.4, 3.8],
      [-11.2, -4.1, -4.8, 3.0, 4.2],
      [14.2, -3.0, 4.6, 3.6, 4.0],
      [11.8, -4.2, -4.5, 2.8, 3.6],
      [-5.8, -4.4, 6.6, 2.9, 3.5],
      [6.4, -4.3, 6.4, 3.1, 3.8],
      [0.2, -4.5, 6.8, 2.5, 3.0],
    ]
    for (const [rx, ry, rz, rad, h] of subRocks) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(rad, h, 6), rx % 2 === 0 ? rockUpperMat : rockDeepMat)
      cone.rotation.x = Math.PI
      cone.rotation.y = rx * 0.5
      cone.position.set(rx, ry, rz)
      mainIsland.add(cone)
    }

    // 垂掛綠色藤蔓（有機多段低面數葉簇，點綴於城垣邊緣）
    const vineXs = [-16.2, -12.4, -7.8, -3.1, 2.6, 8.2, 13.0, 16.4]
    for (let i = 0; i < vineXs.length; i += 1) {
      const vx = vineXs[i]
      const segs = 3 + (i % 3)
      for (let s = 0; s < segs; s += 1) {
        const leaf = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.24 - s * 0.03, 0),
          (i + s) % 2 === 0 ? mossMat : grassMat,
        )
        leaf.position.set(vx + Math.sin(s * 1.3 + i) * 0.14, -0.35 - s * 0.42, 10.38)
        mainIsland.add(leaf)
      }
    }

    // 懸浮於主島前下方的「飛行石結晶核心」、發光古代符文環與底部補光（照亮岩盤與雲海）
    const crystalMat = new THREE.MeshStandardMaterial({
      color: '#8cf6ff',
      emissive: '#38d9ff',
      emissiveIntensity: 1.85,
      roughness: 0.12,
      metalness: 0.2,
      flatShading: true,
    })
    this.skyCrystalCore = new THREE.Mesh(new THREE.OctahedronGeometry(1.15, 0), crystalMat)
    this.skyCrystalCore.scale.set(0.9, 1.55, 0.9)
    this.skyCrystalCore.position.set(0, -4.55, 8.4)
    mainIsland.add(this.skyCrystalCore)

    const runeRingMat = new THREE.MeshBasicMaterial({
      color: '#9ef7ff',
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide,
    })
    this.skyRuneRing = new THREE.Mesh(new THREE.RingGeometry(1.7, 2.05, 24), runeRingMat)
    this.skyRuneRing.rotation.x = Math.PI / 2
    this.skyRuneRing.position.set(0, -4.55, 8.4)
    mainIsland.add(this.skyRuneRing)

    this.skyUnderLight = new THREE.PointLight('#6ceeff', 9.0, 26, 1.4)
    this.skyUnderLight.position.set(0, -4.6, 10.6)
    mainIsland.add(this.skyUnderLight)

    // 兩道從浮空島側緣傾瀉入雲海的天空瀑布
    const addWaterfall = (wx: number, wz: number, width: number, height: number) => {
      const wfMat = new THREE.MeshBasicMaterial({
        color: '#b8eeff',
        transparent: true,
        opacity: 0.62,
        side: THREE.DoubleSide,
      })
      this.waterfallMats.push(wfMat)
      const stream = new THREE.Mesh(new THREE.PlaneGeometry(width, height), wfMat)
      stream.position.set(wx, -0.35 - height / 2, wz)
      mainIsland.add(stream)

      const foam = new THREE.Mesh(
        new THREE.DodecahedronGeometry(width * 0.85, 0),
        new THREE.MeshLambertMaterial({ color: '#eefaff', transparent: true, opacity: 0.78 }),
      )
      foam.scale.set(1.4, 0.55, 1.2)
      foam.position.set(wx, -0.35 - height, wz)
      mainIsland.add(foam)
    }
    addWaterfall(-17.8, 9.6, 1.35, 6.2)
    addWaterfall(17.8, 9.4, 1.15, 5.8)

    this.scene.add(mainIsland)

    // ─── 2. 周圍天空之城浮空小島群（嚴格置於主市集外圍與遠景天際，絕不遮擋主市集） ───
    const makeTree = (scale = 1): THREE.Group => {
      const t = new THREE.Group()
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * scale, 0.2 * scale, 1.0 * scale, 6), woodMat)
      trunk.position.y = 0.5 * scale
      t.add(trunk)
      const crown1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.75 * scale, 0), foliageMat)
      crown1.position.y = 1.35 * scale
      t.add(crown1)
      const crown2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55 * scale, 0), foliageLightMat)
      crown2.position.set(0.32 * scale, 1.72 * scale, 0.12 * scale)
      t.add(crown2)
      return t
    }

    const createFloatingIslet = (
      x: number,
      y: number,
      z: number,
      radius: number,
      depth: number,
      bobAmp: number,
      bobSpeed: number,
      phase: number,
    ): THREE.Group => {
      const g = new THREE.Group()
      g.position.set(x, y, z)
      const rock = new THREE.Mesh(new THREE.ConeGeometry(radius, depth, 7), rockUpperMat)
      rock.rotation.x = Math.PI
      rock.position.y = -depth / 2
      g.add(rock)

      const cap = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.04, radius * 0.96, 0.55, 8), grassMat)
      cap.position.y = 0.25
      g.add(cap)

      // 小島底部的微型飛行石光點
      const miniCore = new THREE.Mesh(
        new THREE.OctahedronGeometry(radius * 0.16, 0),
        new THREE.MeshBasicMaterial({ color: '#8ef5ff' }),
      )
      miniCore.position.y = -depth - 0.35
      g.add(miniCore)

      this.scene.add(g)
      this.floatingIslets.push({ group: g, baseY: y, amp: bobAmp, speed: bobSpeed, phase })
      return g
    }

    // (A) 左後方：風車白石塔浮空島（平視與俯視皆可望見）
    const windmillIslet = createFloatingIslet(-11.2, 5.2, -28, 3.2, 4.6, 0.34, 0.75, 0.3)
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.1, 3.1, 8), stoneLightMat)
    tower.position.set(-0.2, 1.95, 0)
    windmillIslet.add(tower)
    const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(1.15, 1.3, 8), new THREE.MeshLambertMaterial({ color: '#5c7c99', flatShading: true }))
    towerRoof.position.set(-0.2, 4.1, 0)
    windmillIslet.add(towerRoof)
    const towerWin = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.58, 0.18),
      new THREE.MeshBasicMaterial({ color: '#ffe59c' }),
    )
    towerWin.position.set(-0.2, 2.05, 1.0)
    windmillIslet.add(towerWin)
    // 風車轉動葉片組
    const blades = new THREE.Group()
    blades.position.set(-0.2, 3.0, 1.08)
    for (let i = 0; i < 4; i += 1) {
      const arm = new THREE.Group()
      arm.rotation.z = (i * Math.PI) / 2
      const spar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.75, 0.08), woodMat)
      spar.position.y = 0.85
      arm.add(spar)
      const sail = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 1.25), sailMat)
      sail.position.set(0.26, 1.0, 0.02)
      arm.add(sail)
      blades.add(arm)
    }
    windmillIslet.add(blades)
    this.windmillBlades.push(blades)
    const wt1 = makeTree(0.85)
    wt1.position.set(1.6, 0.45, 0.6)
    windmillIslet.add(wt1)
    const wt2 = makeTree(0.68)
    wt2.position.set(-1.8, 0.45, -0.7)
    windmillIslet.add(wt2)

    // (B) 右後方：古代白石拱門水道遺跡島
    const archIslet = createFloatingIslet(11.6, 5.4, -30, 3.4, 4.8, 0.32, 0.68, 1.8)
    for (let i = -1; i <= 1; i += 1) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.55, 2.25, 0.55), stoneLightMat)
      col.position.set(i * 1.55, 1.55, 0)
      archIslet.add(col)
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.48, 0.72), stoneMidMat)
    lintel.position.set(0, 2.85, 0)
    archIslet.add(lintel)
    const ruinTop = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.75, 0.62), stoneLightMat)
    ruinTop.position.set(-0.9, 3.35, 0)
    archIslet.add(ruinTop)
    const archBeacon = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.32, 0),
      new THREE.MeshBasicMaterial({ color: '#9cf7ff' }),
    )
    archBeacon.position.set(0, 1.65, 0.1)
    archIslet.add(archBeacon)
    const at1 = makeTree(0.9)
    at1.position.set(1.9, 0.45, 0.8)
    archIslet.add(at1)
    const at2 = makeTree(0.72)
    at2.position.set(-2.0, 0.45, 0.7)
    archIslet.add(at2)

    // (C) 正後方遠天際：天空之城主聖殿浮空大島（層疊白石城牆、暖光窗格、中央巨樹與半球遺跡）
    const citadel = createFloatingIslet(0.2, 6.2, -46, 5.4, 6.2, 0.24, 0.55, 3.1)
    citadel.scale.setScalar(0.38)
    const cWall1 = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 5.0, 1.55, 12), stoneLightMat)
    cWall1.position.y = 1.15
    citadel.add(cWall1)
    const cWall2 = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.5, 1.6, 12), stoneMidMat)
    cWall2.position.y = 2.6
    citadel.add(cWall2)
    // 聖殿暖黃微光窗格環（夜間遠望清晰如夢幻天空城）
    const castleWinMat = new THREE.MeshBasicMaterial({ color: '#ffe59c' })
    for (let i = 0; i < 6; i += 1) {
      const ang = (i / 6) * Math.PI - Math.PI * 0.08
      const wMesh = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.52, 0.18), castleWinMat)
      wMesh.position.set(Math.cos(ang) * 4.75, 1.2, Math.sin(ang) * 4.75)
      citadel.add(wMesh)
    }
    const cDome = new THREE.Mesh(new THREE.SphereGeometry(2.1, 10, 7, 0, Math.PI * 2, 0, Math.PI / 2), stoneLightMat)
    cDome.position.y = 3.35
    citadel.add(cDome)
    // 天空之城標誌性巨樹樹冠
    const greatTreeCrown = new THREE.Mesh(new THREE.DodecahedronGeometry(2.55, 1), foliageLightMat)
    greatTreeCrown.scale.set(1.25, 0.82, 1.1)
    greatTreeCrown.position.set(0, 5.7, 0)
    citadel.add(greatTreeCrown)
    const greatTreeSub = new THREE.Mesh(new THREE.DodecahedronGeometry(1.75, 0), foliageMat)
    greatTreeSub.position.set(-1.5, 4.95, 0.9)
    citadel.add(greatTreeSub)
    // 環繞主城的小尖塔
    for (let i = 0; i < 4; i += 1) {
      const ang = (i * Math.PI) / 2 + 0.45
      const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.5, 1.9, 6), stoneLightMat)
      spire.position.set(Math.cos(ang) * 3.85, 2.35, Math.sin(ang) * 3.85)
      citadel.add(spire)
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.56, 0.92, 6), new THREE.MeshLambertMaterial({ color: '#6b8ba8', flatShading: true }))
      cap.position.set(Math.cos(ang) * 3.85, 3.7, Math.sin(ang) * 3.85)
      citadel.add(cap)
    }

    // (D) 左右兩側陪襯浮空小島（360° 轉動視角時完整呈現浮空群島感）
    const leftSideIslet = createFloatingIslet(-26.5, -0.6, 3.8, 3.4, 4.8, 0.35, 0.82, 0.9)
    const lTree = makeTree(1.0)
    lTree.position.set(0.2, 0.45, -0.2)
    leftSideIslet.add(lTree)
    const lStone = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.8, 0.6), stoneLightMat)
    lStone.position.set(-1.3, 1.3, 0.6)
    leftSideIslet.add(lStone)

    const rightSideIslet = createFloatingIslet(26.8, 0.1, 1.8, 3.6, 5.2, 0.36, 0.78, 2.5)
    const rTree = makeTree(1.1)
    rTree.position.set(-0.4, 0.45, 0.4)
    rightSideIslet.add(rTree)
    const rPillar1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.9, 0.5), stoneLightMat)
    rPillar1.position.set(1.1, 1.35, -0.5)
    rightSideIslet.add(rPillar1)

    // (E) 漂浮在主島周圍底部的零星小浮石（增加懸浮空間層次）
    const pebbleSpecs: [number, number, number, number][] = [
      [-15.5, -4.6, 12.2, 0.95],
      [-7.2, -5.8, 13.0, 0.75],
      [9.4, -5.2, 12.6, 0.85],
      [16.2, -4.2, 11.8, 1.0],
      [-21.2, 1.6, -12.0, 1.15],
      [21.6, 2.2, -13.5, 1.1],
    ]
    pebbleSpecs.forEach(([px, py, pz, r], idx) => {
      const g = new THREE.Group()
      g.position.set(px, py, pz)
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), idx % 2 === 0 ? rockUpperMat : stoneMidMat)
      rock.scale.set(1.1, 0.85, 1.0)
      g.add(rock)
      this.scene.add(g)
      this.floatingIslets.push({ group: g, baseY: py, amp: 0.32, speed: 0.95 + idx * 0.08, phase: idx * 1.1 })
    })

    // ─── 3. 蓬鬆立體雲海與高空飄雲（主島下方雲海 + 背景高空飄雲） ───
    const createCloudCluster = (
      x: number,
      y: number,
      z: number,
      scale: number,
      speed: number,
      opacity = 0.92,
    ): void => {
      const g = new THREE.Group()
      g.position.set(x, y, z)
      const mat = new THREE.MeshLambertMaterial({
        color: '#ffffff',
        emissive: '#4e6378',
        emissiveIntensity: 0.24,
        transparent: true,
        opacity,
        flatShading: true,
      })
      this.skyCloudMats.push(mat)

      const puffs: [number, number, number, number][] = [
        [0, 0.25, 0, 1.65],
        [-1.45, -0.08, 0.2, 1.25],
        [1.55, -0.1, -0.15, 1.3],
        [-0.65, 0.55, -0.35, 1.15],
        [0.75, 0.45, 0.35, 1.1],
      ]
      for (const [cx, cy, cz, cr] of puffs) {
        const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(cr * scale, 1), mat)
        puff.scale.set(1.25, 0.72, 0.95)
        puff.position.set(cx * scale, cy * scale, cz * scale)
        g.add(puff)
      }
      this.scene.add(g)
      this.driftingClouds.push({ group: g, speed, minX: -52, maxX: 52 })
    }

    // 主島下方雲海（位於 y = -9.2 至 -11.8 深處，讓主市集高懸於厚實雲海之上，絕不上浮遮擋地面與攤位）
    const seaClouds: [number, number, number, number, number][] = [
      [-26, -9.5, 12, 2.5, 0.42],
      [-10, -10.2, 15, 2.9, 0.36],
      [8, -9.8, 14, 2.7, 0.40],
      [25, -9.5, 11, 2.4, 0.45],
      [-20, -10.8, -8, 3.1, 0.32],
      [0, -11.5, -14, 3.4, 0.28],
      [21, -10.5, -10, 3.0, 0.35],
    ]
    for (const [cx, cy, cz, sc, sp] of seaClouds) {
      createCloudCluster(cx, cy, cz, sc, sp, 0.9)
    }

    // 背景高空飄雲（位於 z = -34 至 -52, y = 12.2 至 15.5 遠景天幕，高懸於天空城堡與風車塔之上，絕不穿透至地面攤位、人物或鏡頭視角前方）
    const skyClouds: [number, number, number, number, number][] = [
      [-26, 12.2, -36, 1.55, 0.55],
      [-16, 13.6, -42, 1.75, 0.46],
      [16, 13.8, -42, 1.7, 0.50],
      [27, 12.4, -36, 1.6, 0.58],
      [-30, 11.8, -34, 1.5, 0.62],
      [30, 11.8, -34, 1.55, 0.60],
      [-6, 14.8, -48, 1.8, 0.36],
    ]
    for (const [cx, cy, cz, sc, sp] of skyClouds) {
      createCloudCluster(cx, cy, cz, sc, sp, 0.82)
    }

    // ─── 4. 晴夜繁星點點（夜間無雨時自動顯示於高空天幕） ───
    const starCount = 140
    const starPos = new Float32Array(starCount * 3)
    for (let i = 0; i < starCount; i += 1) {
      starPos[i * 3] = (Math.random() - 0.5) * 90
      starPos[i * 3 + 1] = 2.8 + Math.random() * 14
      starPos[i * 3 + 2] = -36 - Math.random() * 24
    }
    const starGeo = new THREE.BufferGeometry()
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
    this.skyStars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: '#eef4ff', size: 0.22, transparent: true, opacity: 0.85, depthWrite: false }),
    )
    this.skyStars.visible = !this.currentWeather.isDay && this.currentWeather.condition !== 'rainy'
    this.scene.add(this.skyStars)

    // ─── 4. 環繞天空島的漂浮光塵粒子（微弱柔和，營造奇幻空島光澤） ───
    const moteCount = 64
    this.skyMotesPositions = new Float32Array(moteCount * 3)
    for (let i = 0; i < moteCount; i += 1) {
      const ang = (i / moteCount) * Math.PI * 2 + Math.random() * 0.4
      const rad = 16 + Math.random() * 14
      this.skyMotesPositions[i * 3] = Math.cos(ang) * rad
      this.skyMotesPositions[i * 3 + 1] = -4.5 + Math.random() * 12.5
      this.skyMotesPositions[i * 3 + 2] = Math.sin(ang) * rad * 0.65 - 2
    }
    const moteGeo = new THREE.BufferGeometry()
    moteGeo.setAttribute('position', new THREE.BufferAttribute(this.skyMotesPositions, 3))
    const moteMat = new THREE.PointsMaterial({
      color: '#d8f8ff',
      size: 0.24,
      transparent: true,
      opacity: 0.68,
      depthWrite: false,
    })
    this.skyMotes = new THREE.Points(moteGeo, moteMat)
    this.scene.add(this.skyMotes)
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

    // 7b. 以人物身高（PLAYER_TARGET_HEIGHT）之 2.3 倍為基準等比例縮放攤位並精準貼地，完全不改動內部材質與結構
    const groundY = 0.09
    const targetStallHeight = isInfo ? MARKET_STALL_TARGET_HEIGHT * 0.88 : MARKET_STALL_TARGET_HEIGHT
    const { scaleFactor } = normalizeScaleToHeight(group, targetStallHeight, groundY)

    // 8. 物理碰撞體（依實際等比例縮放後尺寸建立，防止角色穿過攤位）
    const colW = (width + 0.16) * scaleFactor
    const colH = targetStallHeight
    const colD = (depth + 0.16) * scaleFactor
    const collider = this.physics.addStaticBox(
      new THREE.Vector3(spec.x, groundY + colH / 2, spec.z),
      new THREE.Vector3(colW, colH, colD),
    )

    // 9. 點擊熱區（Hotspot）與地面互動高亮環
    const hotW = (width + 0.4) * scaleFactor
    const hotH = targetStallHeight + 0.35
    const hotD = (depth + 0.8) * scaleFactor
    const hotspot = new THREE.Mesh(
      new THREE.BoxGeometry(hotW, hotH, hotD),
      new THREE.MeshBasicMaterial({ visible: false }),
    )
    hotspot.position.set(spec.x, groundY + hotH / 2, spec.z)
    hotspot.userData.marketPointId = spec.id
    this.scene.add(hotspot)
    this.hotspotMeshes.push(hotspot)

    this.scalableBuildings.push({
      group,
      baseTargetHeight: targetStallHeight,
      groundY,
      hotspot,
      hotspotBaseSize: new THREE.Vector3(hotW, hotH, hotD),
      collider,
      colliderPos: { x: spec.x, z: spec.z },
      colliderBaseSize: new THREE.Vector3(colW, colH, colD),
    })

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

    // 等比例縮放返回天心宮牌樓並精準貼齊地面
    const archGroundY = 0.02
    const archTargetHeight = MARKET_STALL_TARGET_HEIGHT * 1.04
    const { scaleFactor: archScale } = normalizeScaleToHeight(group, archTargetHeight, archGroundY)

    // 點擊熱區與地面互動環
    const hotW = 3.4 * archScale
    const hotH = archTargetHeight + 0.2
    const hotD = 1.6 * archScale
    const hotspot = new THREE.Mesh(
      new THREE.BoxGeometry(hotW, hotH, hotD),
      new THREE.MeshBasicMaterial({ visible: false }),
    )
    hotspot.position.set(pos.x, archGroundY + hotH / 2, pos.z)
    hotspot.rotation.y = Math.PI / 5
    hotspot.userData.marketPointId = 'return-temple'
    this.scene.add(hotspot)
    this.hotspotMeshes.push(hotspot)

    this.scalableBuildings.push({
      group,
      baseTargetHeight: archTargetHeight,
      groundY: archGroundY,
      hotspot,
      hotspotBaseSize: new THREE.Vector3(hotW, hotH, hotD),
    })

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
      const poleTargetHeight = PLAYER_TARGET_HEIGHT * 3.6
      normalizeScaleToHeight(poleGroup, poleTargetHeight, 0)
      this.scalableBuildings.push({
        group: poleGroup,
        baseTargetHeight: poleTargetHeight,
        groundY: 0,
      })
      poleTops.push(new THREE.Vector3(px, poleTargetHeight * 0.91, pz))
      this.physics.addStaticCylinder(new THREE.Vector3(px, 1.4, pz), 0.24, 2.8)
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

    // 路邊橘白反光三角錐（Traffic Cones，依人物比例等比縮放並貼齊地面）
    const conePositions: [number, number][] = [
      [-11.8, -0.75],
      [-5.2, -0.85],
      [5.2, -0.85],
      [11.8, -0.75],
      [-4.2, 7.25],
      [8.2, 7.25],
    ]
    const coneTargetHeight = PLAYER_TARGET_HEIGHT * 0.32
    for (const [cx, cz] of conePositions) {
      const cone = this.createTrafficCone(cx, cz)
      this.scene.add(cone)
      normalizeScaleToHeight(cone, coneTargetHeight, 0.01)
      this.scalableBuildings.push({
        group: cone,
        baseTargetHeight: coneTargetHeight,
        groundY: 0.01,
      })
    }

    // 街角散落的台式塑膠小板凳（依人物比例等比縮放並貼齊人行道地面）
    const stoolTargetHeight = PLAYER_TARGET_HEIGHT * 0.22
    for (const [sx, sz, col] of [
      [-5.8, 8.6, PALETTE.stoolRed],
      [-5.1, 8.9, PALETTE.stoolBlue],
      [5.4, 8.7, PALETTE.stoolRed],
    ] as const) {
      const stool = this.createStool(sx, 0, sz, col)
      this.scene.add(stool)
      normalizeScaleToHeight(stool, stoolTargetHeight, 0.09)
      this.scalableBuildings.push({
        group: stool,
        baseTargetHeight: stoolTargetHeight,
        groundY: 0.09,
      })
    }
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

    // 套用共用 PLAYER_TARGET_HEIGHT，確保市集人物與玉皇宮角色身高 100% 一致並腳底精準貼地 y = 0
    normalizeScaleToHeight(bodyGroup, PLAYER_TARGET_HEIGHT, 0)
    this.avatarBaseY = bodyGroup.position.y

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
        this.avatarBodyGroup.position.y = this.avatarBaseY + Math.abs(Math.sin(this.walkCycle)) * 0.06
      } else {
        if (this.avatarLeftLeg) this.avatarLeftLeg.rotation.x *= 0.82
        if (this.avatarRightLeg) this.avatarRightLeg.rotation.x *= 0.82
        if (this.avatarLeftArm) this.avatarLeftArm.rotation.x *= 0.82
        if (this.avatarRightArm) this.avatarRightArm.rotation.x *= 0.82
        this.avatarBodyGroup.position.y = this.avatarBaseY + Math.sin(this.time * 2.5) * 0.02
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

    // 5b. 天空之城動態（浮空小島緩慢上下漂浮、雲海飄移、風車轉動、飛行石核心旋轉與光塵緩升）
    for (const islet of this.floatingIslets) {
      islet.group.position.y = islet.baseY + Math.sin(this.time * islet.speed + islet.phase) * islet.amp
    }
    for (const cloud of this.driftingClouds) {
      cloud.group.position.x += cloud.speed * dt
      if (cloud.group.position.x > cloud.maxX) {
        cloud.group.position.x = cloud.minX
      }
    }
    for (const blades of this.windmillBlades) {
      blades.rotation.z -= dt * 0.65
    }
    if (this.skyCrystalCore) {
      this.skyCrystalCore.rotation.y += dt * 0.85
      const s = 1 + Math.sin(this.time * 2.4) * 0.06
      this.skyCrystalCore.scale.set(0.9 * s, 1.55 * s, 0.9 * s)
    }
    if (this.skyRuneRing) {
      this.skyRuneRing.rotation.z -= dt * 0.45
    }
    for (let i = 0; i < this.waterfallMats.length; i += 1) {
      this.waterfallMats[i].opacity = 0.56 + Math.sin(this.time * 4.2 + i * 1.4) * 0.1
    }
    if (this.skyMotes && this.skyMotesPositions) {
      const count = this.skyMotesPositions.length / 3
      for (let i = 0; i < count; i += 1) {
        const yIdx = i * 3 + 1
        this.skyMotesPositions[yIdx] += dt * 0.35
        if (this.skyMotesPositions[yIdx] > 8.5) {
          this.skyMotesPositions[yIdx] = -4.5
        }
      }
      const attr = this.skyMotes.geometry.getAttribute('position') as THREE.BufferAttribute
      attr.needsUpdate = true
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
