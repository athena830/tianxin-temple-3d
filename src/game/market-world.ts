import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { Reflector } from 'three/examples/jsm/objects/Reflector.js'
import type { Physics, RAPIER } from '../engine/physics'
import {
  MARKET_BUILDING_SCALE_DEFAULT,
  MARKET_BUILDING_SCALE_MAX,
  MARKET_BUILDING_SCALE_MIN,
  MARKET_STALL_TARGET_HEIGHT,
  PLAYER_TARGET_HEIGHT,
  normalizeScaleToHeight,
} from './sceneConfig'
import { Chibi, createCharacter } from './createCharacter'
import {
  type CinematicRain,
  create3DNeonSign,
  createAsphaltPBRTextures,
  createCinematicRainSystem,
  createCorrugatedRustMaterial,
  createDrinkCratesStack,
  createHDREnvironmentTexture,
  createRealisticApartmentBlock,
  createRealisticTrafficCone,
  createRealisticTrashBin,
  createRealisticUtilityPole,
  createRedBrickMaterial,
  createSidewalkPBRTextures,
  createTaiwaneseScooter,
  createWeatheredWoodMaterial,
  createWetRoadReflector,
  createOccultCompassPlinth,
  createFloatingTarotCard,
  createAmethystCrystalCluster,
  createOccultCandle,
  createAbyssStarfield,
  type TarotCardInfo,
  type OccultCandleInfo,
} from './market-pbr-assets'

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

export type MarketVenueId = 'birth-chart-hall' | 'card-house' | 'moon-meditation' | 'chess-guide' | 'service-desk' | 'life-numerology'
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

type StallStyle = 'ziwei' | 'reiki' | 'tarot' | 'consultation' | 'info' | 'numerology'

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
      ctx.shadowBlur = 8
      ctx.fillStyle = '#fff4fa'
      ctx.font = '700 58px "Microsoft JhengHei", "Noto Sans TC", sans-serif'
      ctx.fillText(zh, 256, 68)

      ctx.shadowColor = '#ffd36e'
      ctx.shadowBlur = 6
      ctx.fillStyle = '#ffbaf9'
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
      ctx.shadowBlur = 8
      ctx.fillStyle = '#d8fff3'
      ctx.font = '700 56px "Microsoft JhengHei", "Noto Sans TC", sans-serif'
      ctx.fillText(zh, 256, 68)

      ctx.shadowColor = '#b488ff'
      ctx.shadowBlur = 6
      ctx.fillStyle = '#dbc4ff'
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
      ctx.shadowBlur = 8
      ctx.fillStyle = '#ffefbe'
      ctx.font = '700 56px "Microsoft JhengHei", "Noto Sans TC", sans-serif'
      ctx.fillText(zh, 256, 68)

      ctx.shadowColor = '#b694ff'
      ctx.shadowBlur = 6
      ctx.fillStyle = '#ffd87a'
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
    } else if (style === 'numerology') {
      // 生命靈數發光招牌：湖水青藍（#00e5ff）大字配暖金（#ffd54f）小字與霓虹邊框
      ctx.fillStyle = '#0b1924'
      ctx.fillRect(0, 0, 512, 160)
      ctx.strokeStyle = '#ffd54f'
      ctx.lineWidth = 9
      ctx.strokeRect(10, 10, 492, 140)
      ctx.strokeStyle = '#00e5ff'
      ctx.lineWidth = 3
      ctx.strokeRect(22, 22, 468, 116)

      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.shadowColor = '#00e5ff'
      ctx.shadowBlur = 8
      ctx.fillStyle = '#00e5ff'
      ctx.font = '700 56px "Microsoft JhengHei", "Noto Sans TC", sans-serif'
      ctx.fillText(zh, 256, 68)

      ctx.shadowColor = '#ffd54f'
      ctx.shadowBlur = 6
      ctx.fillStyle = '#ffd54f'
      ctx.font = '700 28px "Segoe UI", sans-serif'
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
      ctx.shadowBlur = 7
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
      ctx.shadowBlur = 7
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

/**
 * 台灣雨夜霓虹 × 電影級 PBR 寫實 2.5D「靈光市集」世界模組。
 * 包含真實材質台式攤位、立體 3D 霓虹燈箱、雨夜濕潤法線柏油路與即時鏡面倒影、
 * 電影級細雨粒子、街景寫實雜物、台灣公寓背景與攤位點擊熱區高亮。
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
      id: 'life-numerology',
      title: '生命靈數 Numerology',
      subtitle: '數字能量與天賦密碼',
      signZh: '生命靈數',
      signEn: 'Numerology',
      x: 13.0,
      z: -3.4,
      interactX: 13.0,
      interactZ: -1.1,
      rotY: 0,
      accentHex: '#00e5ff',
      secondaryHex: '#ffd54f',
      style: 'numerology',
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
  private cinematicRain?: CinematicRain
  private envMapTexture?: THREE.CanvasTexture
  private roadReflector?: Reflector
  private readonly floatingTarotCards: TarotCardInfo[] = []
  private readonly abyssCandles: OccultCandleInfo[] = []
  private abyssStarfield?: THREE.Points
  private occultCompassGroup?: THREE.Group

  currentWeather: TaichungWeatherInfo = {
    condition: 'rainy',
    description: '雨夜',
    isDay: false,
    temperature: 21,
    rainMm: 1.4,
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

  // Q 版低面數角色與 GLTFLoader 佔位節點（全面採用與玉皇宮一致的共用 createCharacter 模組）
  chibi!: Chibi
  get avatarBodyGroup(): THREE.Group | THREE.Object3D | undefined {
    return this.chibi?.root
  }
  private avatarVisualRoot = new THREE.Group()
  private avatarHasCustomModel = false
  private avatarYaw = 0
  private currentPaletteId = 'jade'
  private time = 0

  // 市集 NPC（各攤位攤主與路人訪客，與玉皇宮採用 100% 一致的人物外觀、頭身比與五官風格）
  private readonly marketNpcs: {
    id: string
    name: string
    chibi: Chibi
    baseX: number
    baseZ: number
    facingYaw: number
    isWalking?: boolean
    walkAmp?: number
    walkSpeed?: number
    phase: number
  }[] = []

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
    // 方案三：玄學羅盤與漂浮塔羅（深淵神秘學視覺裝飾）
    this.buildAbyssOccultCompass()
    // 電影級 PBR 台灣雨夜公寓街景背景（二丁掛外牆、防盜鐵窗花、冷氣室外機與暖黃窗光）
    this.buildTaiwaneseApartmentBackdrop()
    for (const spec of this.stallSpecs) {
      this.buildStall(spec)
    }
    this.buildReturnArch()
    this.buildStreetDetails()
    this.buildRainSystem()
    this.buildGroundCursor()
    this.buildChibiAvatar()
    this.buildMarketNpcs()
    this.applyWeather(this.currentWeather)
  }

  /** 設定滑鼠懸停高亮回饋（由 MarketGame Raycaster 呼叫） */
  setHoveredPoint(id: MarketPointId | null): void {
    if (this.hoveredId === id) return
    this.hoveredId = id
    for (const [key, ref] of this.visualRefs.entries()) {
      const active = key === id
      if (ref.signMaterial) {
        ref.signMaterial.emissiveIntensity = active ? ref.baseEmissiveIntensity * 1.35 : ref.baseEmissiveIntensity
      }
      if (ref.glowHalo) {
        ref.glowHalo.material.opacity = active ? Math.min(0.24, ref.baseHaloOpacity * 1.6) : ref.baseHaloOpacity
      }
      if (ref.pointLight) {
        ref.pointLight.intensity = active ? ref.baseLightIntensity * 1.3 : ref.baseLightIntensity
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
    this.avatarHasCustomModel = true
    return model
  }

  /** 恢復為共用 Q 版手繪黏土幾何體風格 */
  restoreProceduralModel(): void {
    this.avatarVisualRoot.clear()
    this.avatarVisualRoot.add(this.chibi.root)
    this.avatarHasCustomModel = false
  }

  /** 同步設定角色色盤（素心行者 jade / 丹心行者 vermillion / 月照行者 moon） */
  setCharacter(id: string): void {
    this.currentPaletteId = id
    this.chibi?.setPalette(id)
  }

  private setupAtmosphere(): void {
    // 方案三：夜空與深淵底色統一為深邃午夜星夜紫黑（#090814），消除原本淺藍背景造成的視覺斷層
    this.scene.background = new THREE.Color('#090814')
    this.scene.fog = new THREE.FogExp2('#090814', 0.012)

    // HDRI 360° 台灣雨夜環境貼圖 (IBL)，賦予濕潤柏油、金屬招牌與機車烤漆真實菲涅爾反光
    this.envMapTexture = createHDREnvironmentTexture()
    this.scene.environment = this.envMapTexture

    // 柔和雨夜環境光（隨台中即時天氣切換日光/夜色）
    this.hemiLight = new THREE.HemisphereLight('#7a84c2', '#1d192b', 1.15)
    this.scene.add(this.hemiLight)

    // 斜向主光源（高解析度 2048x2048 陰影）
    this.mainLight = new THREE.DirectionalLight('#c4d2ff', 0.95)
    this.mainLight.position.set(12, 24, 15)
    this.mainLight.castShadow = true
    this.mainLight.shadow.mapSize.set(2048, 2048)
    this.mainLight.shadow.camera.left = -22
    this.mainLight.shadow.camera.right = 22
    this.mainLight.shadow.camera.top = 18
    this.mainLight.shadow.camera.bottom = -18
    this.mainLight.shadow.camera.near = 2
    this.mainLight.shadow.camera.far = 55
    this.mainLight.shadow.bias = -0.0005
    this.scene.add(this.mainLight)

    // 街口暖色霓虹補光
    this.fillLight = new THREE.DirectionalLight('#ffb87a', 0.48)
    this.fillLight.position.set(-14, 12, 14)
    this.scene.add(this.fillLight)
  }

  /**
   * 方案三：立體環形玄學羅盤底座與深淵占卜空間（純視覺裝飾）
   * - 緊貼市集街道下方（y = -0.06 ~ -2.35）的立體橢圓環形黑曜石暖銅金羅盤外框與內凹深淵
   * - 放大版漂浮發光塔羅牌（平視與斜視皆清晰可見）
   * - 加大比例之低面數紫水晶簇與三支組暖黃發光儀式蠟燭
   * - 紫藍與暖金交織之深淵星點粒子（y = -0.65 ~ -7.0）
   */
  private buildAbyssOccultCompass(): void {
    // 1. 深淵星點粒子（紫藍與暖金微光星塵）
    this.abyssStarfield = createAbyssStarfield(520)
    this.scene.add(this.abyssStarfield)

    // 2. 立體環形玄學羅盤底座（橢圓貼合街道輪廓，平視可見立體環壁與暖金月相星象浮雕，斜視可見內凹深淵盤面）
    this.occultCompassGroup = createOccultCompassPlinth(20.4)
    this.occultCompassGroup.scale.set(1.0, 1.0, 0.64)
    this.occultCompassGroup.position.set(0, 0, 2.2)
    this.scene.add(this.occultCompassGroup)

    // 3. 放大版漂浮占卜塔羅牌（完整框列於羅盤中下環之間的深淵空間 y = -1.10，絕不超出 y = 0 街道面）
    const tarotConfigs: {
      titleZh: string
      titleEn: string
      num: string
      type: 'star' | 'moon' | 'sun' | 'magician' | 'fortune'
      x: number
      y: number
      z: number
      rotX: number
      rotY: number
      rotZ: number
      speed: number
      amp: number
    }[] = [
      { titleZh: '命運之輪', titleEn: 'WHEEL OF FORTUNE', num: 'X', type: 'fortune', x: -8.8, y: -1.12, z: 13.0, rotX: 0.1, rotY: 0.22, rotZ: -0.07, speed: 1.05, amp: 0.08 },
      { titleZh: '星星', titleEn: 'THE STAR', num: 'XVII', type: 'star', x: -4.2, y: -1.1, z: 14.0, rotX: 0.08, rotY: 0.14, rotZ: -0.06, speed: 1.15, amp: 0.08 },
      { titleZh: '月亮', titleEn: 'THE MOON', num: 'XVIII', type: 'moon', x: -1.3, y: -1.12, z: 14.4, rotX: 0.08, rotY: -0.1, rotZ: 0.05, speed: 0.98, amp: 0.09 },
      { titleZh: '太陽', titleEn: 'THE SUN', num: 'XIX', type: 'sun', x: 1.8, y: -1.1, z: 14.3, rotX: 0.08, rotY: 0.12, rotZ: -0.05, speed: 1.1, amp: 0.08 },
      { titleZh: '魔術師', titleEn: 'THE MAGICIAN', num: 'I', type: 'magician', x: 4.8, y: -1.12, z: 13.9, rotX: 0.08, rotY: -0.16, rotZ: 0.06, speed: 0.95, amp: 0.08 },
      { titleZh: '女祭司', titleEn: 'THE PRIESTESS', num: 'II', type: 'moon', x: 9.2, y: -1.12, z: 12.8, rotX: 0.1, rotY: -0.22, rotZ: 0.07, speed: 1.08, amp: 0.08 },
    ]

    for (const t of tarotConfigs) {
      const card = createFloatingTarotCard(t.titleZh, t.titleEn, t.num, t.type)
      card.position.set(t.x, t.y, t.z)
      card.rotation.set(t.rotX, t.rotY, t.rotZ)
      this.scene.add(card)
      this.floatingTarotCards.push({
        mesh: card,
        baseY: t.y,
        baseRotX: t.rotX,
        baseRotY: t.rotY,
        baseRotZ: t.rotZ,
        speed: t.speed,
        phase: Math.random() * Math.PI * 2,
        amp: t.amp,
      })
    }

    // 4. 加大比例之低面數紫水晶簇（擺放於羅盤下層前緣 y = -1.70，晶峰高至 y ≈ -0.52）
    for (const [cx, cy, cz, rotY] of [
      [-6.5, -1.7, 13.6, 0.35],
      [-2.7, -1.7, 14.3, -0.25],
      [3.3, -1.7, 14.2, 0.55],
      [7.2, -1.7, 13.4, -0.45],
    ] as const) {
      const crystal = createAmethystCrystalCluster()
      crystal.position.set(cx, cy, cz)
      crystal.rotation.y = rotY
      this.scene.add(crystal)
    }

    // 5. 暖黃發光儀式蠟燭組（高低錯落擺放於深淵前緣與羅盤內緣 y = -1.70）
    for (const [kx, ky, kz] of [
      [-5.3, -1.7, 13.9],
      [-0.1, -1.7, 14.5],
      [0.7, -1.7, 14.4],
      [6.0, -1.7, 13.7],
      [10.4, -1.7, 12.4],
    ] as const) {
      const candle = createOccultCandle()
      candle.group.position.set(kx, ky, kz)
      this.scene.add(candle.group)
      this.abyssCandles.push(candle)
    }
  }

  private buildStreetGround(): void {
    // 1. 物理地面與邊界牆
    this.physics.addStaticBox(new THREE.Vector3(0, -0.5, 0), new THREE.Vector3(44, 1, 30))
    // 街道四側透明碰撞邊界，防止角色走出街道
    this.physics.addStaticBox(new THREE.Vector3(-16.5, 1.5, 1.5), new THREE.Vector3(0.8, 3, 18))
    this.physics.addStaticBox(new THREE.Vector3(18.8, 1.5, 1.5), new THREE.Vector3(0.8, 3, 18))
    this.physics.addStaticBox(new THREE.Vector3(0, 1.5, -7.2), new THREE.Vector3(39, 3, 0.8))
    this.physics.addStaticBox(new THREE.Vector3(0, 1.5, 10.2), new THREE.Vector3(39, 3, 0.8))

    // 2. 高解析度 PBR 濕潤柏油路（含法線貼圖 Normal Map、粗糙度貼圖 Roughness Map、積水與斑馬線）
    const asphaltPBR = createAsphaltPBRTextures()
    this.asphaltMat = new THREE.MeshStandardMaterial({
      map: asphaltPBR.map,
      normalMap: asphaltPBR.normalMap,
      normalScale: new THREE.Vector2(1.15, 1.15),
      roughnessMap: asphaltPBR.roughnessMap,
      color: '#ffffff',
      roughness: 0.24,
      metalness: 0.34,
      envMapIntensity: 1.45,
    })
    const road = new THREE.Mesh(new THREE.PlaneGeometry(36, 9.2), this.asphaltMat)
    road.rotation.x = -Math.PI / 2
    road.position.set(0, 0.005, 3.2)
    road.receiveShadow = true
    this.scene.add(road)

    // 2b. 雨夜即時鏡面反射探針（Planar Reflector，倒映霓虹招牌與攤位暖光）
    this.roadReflector = createWetRoadReflector(36, 9.2, { opacity: 0.44, color: 0x5c6a84 })
    this.scene.add(this.roadReflector)

    // 3. 北側與南側 PBR 濕潤花崗岩石板人行道（含法線與粗糙度貼圖）
    const sidewalkPBR = createSidewalkPBRTextures()
    const sidewalkMat = new THREE.MeshStandardMaterial({
      map: sidewalkPBR.map,
      normalMap: sidewalkPBR.normalMap,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughnessMap: sidewalkPBR.roughnessMap,
      roughness: 0.45,
      metalness: 0.14,
      envMapIntensity: 1.2,
    })
    const curbMat = new THREE.MeshStandardMaterial({
      color: '#3a3846',
      roughness: 0.52,
      metalness: 0.12,
    })

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

    // 5. 街道底板（精準對齊市集街道範圍 36 × 19.8，不遮擋下方與外圍的立體玄學羅盤底座與深淵空間）
    const outerGround = new THREE.Mesh(
      new THREE.PlaneGeometry(36.2, 19.9),
      new THREE.MeshStandardMaterial({ color: '#111018', roughness: 0.85, metalness: 0.08 }),
    )
    outerGround.rotation.x = -Math.PI / 2
    outerGround.position.set(0, -0.02, 2.2)
    outerGround.receiveShadow = true
    this.scene.add(outerGround)
  }

  /** 建立寫實台灣雨夜公寓街景背景（二丁掛磁磚、防盜鐵窗花、冷氣室外機、暖黃窗光與頂樓水塔） */
  private buildTaiwaneseApartmentBackdrop(): void {
    const apartmentConfigs: { x: number; z: number; w: number; h: number; d: number }[] = [
      { x: -13.2, z: -9.8, w: 9.8, h: 13.5, d: 4.8 },
      { x: -3.2, z: -10.2, w: 10.2, h: 15.2, d: 5.0 },
      { x: 6.8, z: -9.9, w: 9.8, h: 14.0, d: 4.8 },
      { x: 16.5, z: -10.1, w: 9.6, h: 12.8, d: 4.8 },
    ]
    for (const cfg of apartmentConfigs) {
      const apt = createRealisticApartmentBlock(cfg.w, cfg.h, cfg.d)
      apt.position.set(cfg.x, 0.02, cfg.z)
      this.scene.add(apt)
    }

    // 街道左右遠端低矮商辦剪影，完整包覆台灣巷弄夜色景深
    const leftEdgeApt = createRealisticApartmentBlock(7.5, 11.5, 6.0)
    leftEdgeApt.rotation.y = Math.PI / 2
    leftEdgeApt.position.set(-22.0, 0.02, -1.5)
    this.scene.add(leftEdgeApt)

    const rightEdgeApt = createRealisticApartmentBlock(7.5, 12.2, 6.0)
    rightEdgeApt.rotation.y = -Math.PI / 2
    rightEdgeApt.position.set(22.5, 0.02, -1.5)
    this.scene.add(rightEdgeApt)
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
    if (this.rainLines) this.rainLines.visible = false
    if (this.cinematicRain) this.cinematicRain.setVisible(isRain)
    for (const r of this.rainRipples) {
      r.mesh.visible = isRain
    }
    if (this.asphaltMat) {
      this.asphaltMat.roughness = isRain ? 0.18 : 0.42
      this.asphaltMat.metalness = isRain ? 0.36 : 0.14
    }
    if (this.roadReflector) {
      const refMat = this.roadReflector.material as THREE.ShaderMaterial
      if (refMat?.uniforms?.uOpacity) {
        refMat.uniforms.uOpacity.value = isRain ? 0.48 : 0.24
      }
    }

    // 方案三：夜空與深淵底色統一為深邃午夜星夜紫黑（#090814），消除原本淺藍背景造成的視覺斷層
    this.scene.background = new THREE.Color('#090814')
    this.scene.fog = new THREE.FogExp2('#090814', 0.012)

    if (info.isDay) {
      // 台中日間天氣（光照適度提亮，維持深邃午夜星空背景）
      if (isRain) {
        this.hemiLight.color.set('#9eb0c2')
        this.hemiLight.groundColor.set('#434852')
        this.hemiLight.intensity = 1.15
        this.mainLight.color.set('#c8d5e0')
        this.mainLight.intensity = 0.85
      } else if (info.condition === 'cloudy') {
        this.hemiLight.color.set('#cde2f2')
        this.hemiLight.groundColor.set('#6b747d')
        this.hemiLight.intensity = 1.25
        this.mainLight.color.set('#fdf0db')
        this.mainLight.intensity = 1.15
      } else {
        this.hemiLight.color.set('#e8f6ff')
        this.hemiLight.groundColor.set('#7a7060')
        this.hemiLight.intensity = 1.5
        this.mainLight.color.set('#fff6df')
        this.mainLight.intensity = 1.48
      }
    } else {
      // 台中夜間天氣
      if (isRain) {
        this.hemiLight.color.set('#8e84b8')
        this.hemiLight.groundColor.set('#242033')
        this.hemiLight.intensity = 1.2
        this.mainLight.color.set('#c2c6ff')
        this.mainLight.intensity = 0.85
      } else if (info.condition === 'cloudy') {
        this.hemiLight.color.set('#968bb8')
        this.hemiLight.groundColor.set('#282238')
        this.hemiLight.intensity = 1.25
        this.mainLight.color.set('#d0d4ff')
        this.mainLight.intensity = 0.95
      } else {
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

  /** 建立單一獨立台式電影級 PBR 雨夜市集攤位 */
  private buildStall(spec: StallSpec): void {
    const group = new THREE.Group()
    group.position.set(spec.x, 0.08, spec.z)
    group.rotation.y = spec.rotY

    const isInfo = spec.style === 'info'
    const width = isInfo ? 3.2 : 4.5
    const depth = isInfo ? 2.2 : 2.9
    const height = isInfo ? 2.5 : 2.95

    const woodMat = createWeatheredWoodMaterial(false)
    const woodDarkMat = createWeatheredWoodMaterial(true)
    const metalMat = createCorrugatedRustMaterial()
    const brickMat = createRedBrickMaterial()

    // 1. 攤位紅磚底台與四根做舊實木柱
    const base = new THREE.Mesh(new THREE.BoxGeometry(width + 0.24, 0.16, depth + 0.24), brickMat)
    base.position.y = 0.08
    base.receiveShadow = true
    base.castShadow = true
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
      post.receiveShadow = true
      group.add(post)
    }

    // 2. 後牆與側牆（下方紅磚砌牆 + 上方深色紋理木牆 + 室內暖黃窗光與實木層架）
    const backWallColor =
      spec.style === 'reiki' ? '#1c2b36' : spec.style === 'tarot' ? '#241634' : spec.style === 'ziwei' ? '#2e1a26' : '#2f231e'
    const wallMat = new THREE.MeshStandardMaterial({
      color: backWallColor,
      roughness: 0.78,
      metalness: 0.08,
    })

    // 下段紅磚護壁
    const brickBack = new THREE.Mesh(new THREE.BoxGeometry(width - 0.1, 0.92, 0.18), brickMat)
    brickBack.position.set(0, 0.54, -depth / 2 + 0.1)
    brickBack.castShadow = true
    brickBack.receiveShadow = true
    group.add(brickBack)

    const backWall = new THREE.Mesh(new THREE.BoxGeometry(width - 0.12, height - 0.95, 0.16), wallMat)
    backWall.position.set(0, 0.98 + (height - 0.95) / 2, -depth / 2 + 0.1)
    backWall.castShadow = true
    backWall.receiveShadow = true
    group.add(backWall)

    // 攤位內部暖黃木格窗與微光室內裝潢（呈現真實室內深度與鎢絲燈暖光，柔和微光）
    const winW = width * 0.44
    const winH = 0.85
    const innerWindowMat = new THREE.MeshStandardMaterial({
      color: '#ffebb8',
      emissive: '#ffb84d',
      emissiveIntensity: 0.55,
      roughness: 0.35,
    })
    const innerWindow = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), innerWindowMat)
    innerWindow.position.set(0, height * 0.62, -depth / 2 + 0.2)
    group.add(innerWindow)

    // 窗格木框線條
    for (const wx of [-winW / 2, 0, winW / 2]) {
      const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.045, winH + 0.06, 0.05), woodDarkMat)
      mullion.position.set(wx, height * 0.62, -depth / 2 + 0.22)
      group.add(mullion)
    }
    for (const wy of [-winH / 2, 0, winH / 2]) {
      const transom = new THREE.Mesh(new THREE.BoxGeometry(winW + 0.06, 0.045, 0.05), woodDarkMat)
      transom.position.set(0, height * 0.62 + wy, -depth / 2 + 0.22)
      group.add(transom)
    }

    // 室內暖黃鎢絲燈點光源（自然柔和微光）
    const interiorWarmLight = new THREE.PointLight('#ffca7a', 0.85, 4.2, 2.0)
    interiorWarmLight.position.set(0, height * 0.72, -0.2)
    group.add(interiorWarmLight)

    for (const side of [-1, 1]) {
      const sideBrick = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.92, depth - 0.2), brickMat)
      sideBrick.position.set(side * (width / 2 - 0.08), 0.54, 0)
      sideBrick.castShadow = true
      group.add(sideBrick)

      const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.14, height - 0.95, depth - 0.2), wallMat)
      sideWall.position.set(side * (width / 2 - 0.08), 0.98 + (height - 0.95) / 2, 0)
      sideWall.castShadow = true
      group.add(sideWall)
    }

    // 3. PBR 台式斜坡生鏽波浪鐵皮屋頂（真實金屬與鏽蝕法線貼圖）
    const roofGroup = new THREE.Group()
    roofGroup.position.set(0, height + 0.18, 0.15)
    roofGroup.rotation.x = 0.16
    const roofPlate = new THREE.Mesh(new THREE.BoxGeometry(width + 0.68, 0.1, depth + 0.92), metalMat)
    roofPlate.castShadow = true
    roofPlate.receiveShadow = true
    roofGroup.add(roofPlate)
    // 高密度立體波浪鐵皮凸脊
    const ridgeCount = isInfo ? 9 : 13
    for (let i = 0; i < ridgeCount; i += 1) {
      const rx = -width / 2 - 0.2 + (i / (ridgeCount - 1)) * (width + 0.4)
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.055, depth + 0.9), metalMat)
      ridge.position.set(rx, 0.075, 0)
      roofGroup.add(ridge)
    }
    group.add(roofGroup)

    // 4. 屋頂上方立體 3D 金屬燈箱與實體凸起霓虹燈管招牌（Physical 3D Neon Sign）
    const signTex = makeNeonSignTexture(spec.signZh, spec.signEn, spec.style)
    const baseEmissive = spec.style === 'consultation' ? 0.36 : 0.44
    const neonSign = create3DNeonSign(
      spec.signZh,
      spec.signEn,
      width - 0.28,
      1.05,
      spec.accentHex,
      spec.secondaryHex,
      signTex,
      baseEmissive,
    )
    neonSign.group.position.set(0, height + 0.94, depth / 2 - 0.02)
    group.add(neonSign.group)
    const signMat = neonSign.faceMaterial

    // 招牌霓虹柔光光暈（精緻微弱光暈，避免夜空中過大刺眼光暈）
    const haloTex = makeGlowHaloTexture(spec.accentHex)
    const haloMat = new THREE.SpriteMaterial({
      map: haloTex,
      transparent: true,
      opacity: 0.09,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const halo = new THREE.Sprite(haloMat)
    halo.position.set(0, height + 0.94, depth / 2 - 0.24)
    halo.scale.set(width + 0.6, 1.8, 1)
    group.add(halo)

    // 5. 各攤位專屬台式特色裝潢與道具
    this.decorateStallByStyle(group, spec, width, depth, height, woodMat, woodDarkMat)

    // 6. 攤位專屬暖色／霓虹點光源（照亮雨夜濕潤街道，柔和均勻不刺眼）
    const lightIntensity = spec.style === 'reiki' ? 1.45 : 1.35
    const stallLight = new THREE.PointLight(spec.accentHex, lightIntensity, 7.2, 1.9)
    stallLight.position.set(0, height - 0.2, depth / 2 + 0.85)
    group.add(stallLight)

    // 7. 濕潤柏油路上的霓虹倒影貼花
    const puddleRefMat = new THREE.MeshBasicMaterial({
      map: haloTex,
      transparent: true,
      opacity: 0.16,
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
      baseHaloOpacity: 0.09,
      pointLight: stallLight,
      baseLightIntensity: lightIntensity,
    })
  }

  /** 為每間攤位打造專屬的寫實家具、燈籠、玻璃門面、布簾或水晶球 */
  private decorateStallByStyle(
    group: THREE.Group,
    spec: StallSpec,
    width: number,
    depth: number,
    height: number,
    woodMat: THREE.Material,
    woodDarkMat: THREE.Material,
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
          emissiveIntensity: 0.65,
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
        emissiveIntensity: 0.14,
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
          emissiveIntensity: 0.32,
          transparent: true,
          opacity: 0.35,
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
          emissiveIntensity: 0.85,
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
          opacity: 0.22,
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
          emissiveIntensity: 0.75,
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
          emissiveIntensity: 0.65,
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
    } else if (spec.style === 'numerology') {
      // 生命靈數：青藍發光幾何數字圓盤 + 暖金九宮能量牌卡 + 藍金柔光檯燈 + 攤內微弱藍金點光源 + 攤前小板凳
      const disc = new THREE.Mesh(
        new THREE.CylinderGeometry(0.36, 0.36, 0.05, 24),
        new THREE.MeshStandardMaterial({
          color: '#0d2230',
          emissive: '#00e5ff',
          emissiveIntensity: 0.48,
          roughness: 0.28,
        }),
      )
      disc.position.set(-0.55, 0.94, depth / 2 - 0.5)
      group.add(disc)

      const gridPlate = new THREE.Mesh(
        new THREE.BoxGeometry(0.52, 0.06, 0.38),
        new THREE.MeshLambertMaterial({ color: '#c29b38' }),
      )
      gridPlate.position.set(0.65, 0.94, depth / 2 - 0.5)
      group.add(gridPlate)

      const lamp = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.18, 0.26, 8),
        new THREE.MeshStandardMaterial({
          color: '#ffd54f',
          emissive: '#00e5ff',
          emissiveIntensity: 0.65,
        }),
      )
      lamp.position.set(0, 1.05, depth / 2 - 0.52)
      group.add(lamp)

      // 攤位內微弱的藍金色點光源（呼應心靈探討主題）
      const innerBlueGoldLight = new THREE.PointLight('#00e5ff', 0.75, 4.2, 2.0)
      innerBlueGoldLight.position.set(0, height * 0.65, depth / 2 - 0.5)
      group.add(innerBlueGoldLight)

      // 攤前兩張台式小板凳
      group.add(this.createStool(-0.85, 0.24, depth / 2 + 0.55, PALETTE.stoolRed))
      group.add(this.createStool(0.85, 0.24, depth / 2 + 0.55, PALETTE.stoolBlue))
    } else {
      // 市集服務台：藍白小檯燈
      const deskLamp = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.16, 0.24, 7),
        new THREE.MeshStandardMaterial({
          color: '#d6f0ff',
          emissive: '#6ec4ff',
          emissiveIntensity: 0.62,
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
      emissiveIntensity: 0.42,
      roughness: 0.3,
    })
    const sign = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.85, 0.18), signMat)
    sign.position.set(0, 3.85, 0)
    group.add(sign)

    const archLight = new THREE.PointLight('#ff9a52', 1.25, 6.2, 2.0)
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

  /** 電影級 PBR 台灣街頭細節：高壓變壓器電線桿、糾結垂弧電線、復古紅燈籠串、台式 125cc 機車、加重三角錐、分類垃圾桶與台啤飲料箱 */
  private buildStreetDetails(): void {
    const polePositions: [number, number][] = [
      [-14.5, -1.6],
      [17.5, -1.6],
      [-14.5, 9.6],
      [17.5, 9.6],
    ]

    const poleTops: THREE.Vector3[] = []
    for (const [px, pz] of polePositions) {
      const poleGroup = createRealisticUtilityPole()
      poleGroup.position.set(px, 0, pz)
      // 南側電線桿旋轉 180° 使路燈燈臂朝向馬路中央
      if (pz > 0) poleGroup.rotation.y = Math.PI

      this.scene.add(poleGroup)
      const poleTargetHeight = PLAYER_TARGET_HEIGHT * 4.2
      normalizeScaleToHeight(poleGroup, poleTargetHeight, 0)
      this.scalableBuildings.push({
        group: poleGroup,
        baseTargetHeight: poleTargetHeight,
        groundY: 0,
      })
      poleTops.push(new THREE.Vector3(px, poleTargetHeight * 0.9, pz))
      this.physics.addStaticCylinder(new THREE.Vector3(px, 1.4, pz), 0.24, 2.8)
    }

    // 雙層糾結垂弧黑色電線連接四角電線桿（中央視角完全無阻擋）
    const wireMat = new THREE.LineBasicMaterial({ color: '#0c0b14' })
    const wirePairs: [number, number][] = [
      [0, 1],
      [0, 2],
      [1, 3],
      [2, 3],
    ]
    for (const [a, b] of wirePairs) {
      for (const offset of [-0.25, 0.25]) {
        const start = poleTops[a].clone().add(new THREE.Vector3(0, offset * 0.4, offset))
        const end = poleTops[b].clone().add(new THREE.Vector3(0, offset * 0.4, offset))
        const mid = start.clone().lerp(end, 0.5)
        mid.y -= 0.72 + Math.abs(offset) * 0.35
        const curve = new THREE.QuadraticBezierCurve3(start, mid, end)
        const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(18))
        this.scene.add(new THREE.Line(geo, wireMat))
      }
    }

    // 跨街復古紅燈籠串（懸掛於上方高處 y = 4.6m，美觀且不遮擋攤位招牌與平視視角）
    const lanternSpan = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-14.5, 5.4, -1.6),
      new THREE.Vector3(1.5, 4.55, -1.6),
      new THREE.Vector3(17.5, 5.4, -1.6),
    )
    this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(lanternSpan.getPoints(20)), wireMat))
    for (let i = 1; i <= 9; i += 1) {
      const p = lanternSpan.getPoint(i / 10)
      const lantern = this.createLantern(PALETTE.lanternRed, 0.2, 0.3)
      lantern.position.set(p.x, p.y - 0.18, p.z)
      this.scene.add(lantern)
      this.swayingLanterns.push({ group: lantern, phase: i * 0.75, amp: 0.065 })
    }

    // 路邊停放的經典台式 125cc 機車（PBR 金屬烤漆、反光鏡與排氣管，停放於路緣外側不擋行進動線）
    const scooterConfigs: { x: number; z: number; rotY: number; color: string }[] = [
      { x: -12.6, z: -0.55, rotY: 0.38, color: '#9e1f32' },
      { x: -6.2, z: 7.0, rotY: -2.65, color: '#2b3d52' },
      { x: 15.6, z: 6.95, rotY: 2.55, color: '#1e5c68' },
    ]
    const scooterTargetHeight = PLAYER_TARGET_HEIGHT * 0.92
    for (const sc of scooterConfigs) {
      const scooter = createTaiwaneseScooter(sc.color)
      scooter.position.set(sc.x, 0, sc.z)
      scooter.rotation.y = sc.rotY
      this.scene.add(scooter)
      normalizeScaleToHeight(scooter, scooterTargetHeight, 0.01)
      this.scalableBuildings.push({
        group: scooter,
        baseTargetHeight: scooterTargetHeight,
        groundY: 0.01,
      })
    }

    // 路邊加重橡膠底座反光三角錐（PBR Realistic Traffic Cones）
    const conePositions: [number, number][] = [
      [-11.2, -0.75],
      [-5.2, -0.85],
      [5.2, -0.85],
      [16.8, -0.75],
      [-4.2, 7.25],
      [8.2, 7.25],
    ]
    const coneTargetHeight = PLAYER_TARGET_HEIGHT * 0.36
    for (const [cx, cz] of conePositions) {
      const cone = createRealisticTrafficCone()
      cone.position.set(cx, 0, cz)
      this.scene.add(cone)
      normalizeScaleToHeight(cone, coneTargetHeight, 0.01)
      this.scalableBuildings.push({
        group: cone,
        baseTargetHeight: coneTargetHeight,
        groundY: 0.01,
      })
    }

    // 鋼製資源回收分類垃圾箱（雙桶配置於人行道街角）
    const binTargetHeight = PLAYER_TARGET_HEIGHT * 0.72
    for (const [bx, bz, rotY] of [
      [-11.3, -1.75, 0.1],
      [16.2, 8.35, Math.PI],
    ] as const) {
      const bin = createRealisticTrashBin()
      bin.position.set(bx, 0, bz)
      bin.rotation.y = rotY
      this.scene.add(bin)
      normalizeScaleToHeight(bin, binTargetHeight, 0.09)
      this.scalableBuildings.push({
        group: bin,
        baseTargetHeight: binTargetHeight,
        groundY: 0.09,
      })
    }

    // 經典台灣啤酒／飲料紅色塑膠箱堆疊（點綴於攤位側邊）
    const crateTargetHeight = PLAYER_TARGET_HEIGHT * 0.62
    for (const [cx, cz, count] of [
      [-10.4, -3.5, 3],
      [15.8, -3.4, 2],
    ] as const) {
      const crates = createDrinkCratesStack(count)
      crates.position.set(cx, 0, cz)
      this.scene.add(crates)
      normalizeScaleToHeight(crates, crateTargetHeight, 0.09)
      this.scalableBuildings.push({
        group: crates,
        baseTargetHeight: crateTargetHeight,
        groundY: 0.09,
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

  /** 電影級細雨粒子（長雨絲與風偏飄移）與地面水窪漣漪特效 */
  private buildRainSystem(): void {
    this.cinematicRain = createCinematicRainSystem(720, 38, 24)
    this.cinematicRain.lines.position.z = 1.5
    this.scene.add(this.cinematicRain.lines)
    this.rainLines = this.cinematicRain.lines

    // 柏油路微弱雨滴擴散漣漪
    const rippleGeo = new THREE.RingGeometry(0.04, 0.08, 12)
    for (let i = 0; i < 20; i += 1) {
      const rMat = new THREE.MeshBasicMaterial({
        color: '#b8d0ff',
        transparent: true,
        opacity: 0.26,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
      const rMesh = new THREE.Mesh(rippleGeo, rMat)
      rMesh.visible = true
      rMesh.rotation.x = -Math.PI / 2
      rMesh.position.set((Math.random() - 0.5) * 30, 0.018, (Math.random() - 0.1) * 7.5)
      this.scene.add(rMesh)
      this.rainRipples.push({
        mesh: rMesh,
        mat: rMat,
        phase: Math.random(),
        speed: 0.85 + Math.random() * 0.65,
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

  /** 與玉皇宮 100% 一致之 Q 版啞光黏土風格角色（共用 createCharacter 模組） */
  private buildChibiAvatar(): void {
    // 腳底柔和陰影圓盤
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.42, 16),
      new THREE.MeshBasicMaterial({ color: '#090710', transparent: true, opacity: 0.45, depthWrite: false }),
    )
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = 0.02
    this.avatar.add(shadow)

    // 使用共用模組建立二頭身水滴大眼手辦黏土角色（套用共用 PLAYER_TARGET_HEIGHT，腳底貼地 y = 0）
    this.chibi = createCharacter({
      palette: this.currentPaletteId,
      targetHeight: PLAYER_TARGET_HEIGHT,
      groundY: 0,
    })

    this.avatarVisualRoot.add(this.chibi.root)
    this.avatar.add(this.avatarVisualRoot)
    this.scene.add(this.avatar)
  }

  /**
   * 建立靈光市集各攤位攤主與漫步路人訪客：
   * 全部改用與主場景「玉皇宮」100% 完全一致的 Q 版手繪黏土角色外觀（createCharacter 模組），
   * 包含相同二頭身比、水滴大眼、靈動高光、蜜桃腮紅、微笑表情與消光溫潤 MeshLambertMaterial，
   * 僅微調古典色盤以區分職能（紫微、靈氣、塔羅、問事、服務台與漫步訪客），並延續 PLAYER_TARGET_HEIGHT 高度標準。
   */
  private buildMarketNpcs(): void {
    // 1. 各攤位專業駐店攤主
    const stallKeepers: { id: string; name: string; palette: string; x: number; z: number; yaw: number }[] = [
      { id: 'keeper-ziwei', name: '紫微長老', palette: 'scholar', x: -7.8, z: -3.7, yaw: 0 },
      { id: 'keeper-reiki', name: '靈氣導師', palette: 'teal', x: -2.6, z: -3.7, yaw: 0 },
      { id: 'keeper-tarot', name: '塔羅仙子', palette: 'lavender', x: 2.6, z: -3.7, yaw: 0 },
      { id: 'keeper-chess', name: '問事棋翁', palette: 'monk', x: 7.8, z: -3.7, yaw: 0 },
      { id: 'keeper-numerology', name: '靈數導師', palette: 'pine', x: 13.0, z: -3.7, yaw: 0 },
      { id: 'keeper-info', name: '服務台嚮導', palette: 'azure', x: 10.6, z: 6.0, yaw: Math.PI },
    ]

    for (const k of stallKeepers) {
      const chibi = createCharacter({
        palette: k.palette,
        targetHeight: PLAYER_TARGET_HEIGHT,
        groundY: 0.08, // 攤位木台基高度
      })
      chibi.root.position.set(k.x, chibi.root.position.y, k.z)
      chibi.root.rotation.y = k.yaw
      this.scene.add(chibi.root)

      this.marketNpcs.push({
        id: k.id,
        name: k.name,
        chibi,
        baseX: k.x,
        baseZ: k.z,
        facingYaw: k.yaw,
        phase: Math.random() * Math.PI * 2,
      })
    }

    // 2. 市集漫步路人訪客（熱鬧台式雨夜夜市氛圍）
    const visitors: {
      id: string
      name: string
      palette: string
      x: number
      z: number
      yaw: number
      isWalking?: boolean
      walkAmp?: number
      walkSpeed?: number
    }[] = [
      { id: 'visitor-peach', name: '市集訪客・桃', palette: 'peach', x: 0.3, z: 1.2, yaw: -0.3 },
      { id: 'visitor-rose', name: '市集訪客・丹', palette: 'rose', x: -5.0, z: 0.6, yaw: 0.2, isWalking: true, walkAmp: 0.8, walkSpeed: 0.6 },
      { id: 'visitor-pine', name: '市集訪客・松', palette: 'pine', x: 5.2, z: 1.5, yaw: -0.2, isWalking: true, walkAmp: 0.7, walkSpeed: 0.5 },
    ]

    for (const v of visitors) {
      const chibi = createCharacter({
        palette: v.palette,
        targetHeight: PLAYER_TARGET_HEIGHT,
        groundY: 0,
      })
      chibi.root.position.set(v.x, chibi.root.position.y, v.z)
      chibi.root.rotation.y = v.yaw
      this.scene.add(chibi.root)

      this.marketNpcs.push({
        id: v.id,
        name: v.name,
        chibi,
        baseX: v.x,
        baseZ: v.z,
        facingYaw: v.yaw,
        isWalking: v.isWalking,
        walkAmp: v.walkAmp,
        walkSpeed: v.walkSpeed,
        phase: Math.random() * Math.PI * 2,
      })
    }
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

    // 1. Q 版角色走路循環與面向平滑轉向（與玉皇宮完全一致的 Chibi 彈跳、擺臂、小碎步）
    const isMoving = moveSpeed > 0.2
    if (facingYaw !== undefined && isMoving) {
      const diff = Math.atan2(Math.sin(facingYaw - this.avatarYaw), Math.cos(facingYaw - this.avatarYaw))
      this.avatarYaw += diff * Math.min(1, dt * 12)
      this.avatarVisualRoot.rotation.y = this.avatarYaw
    }

    if (!this.avatarHasCustomModel && this.chibi) {
      this.chibi.animate(dt, this.time, moveSpeed, false, 0)
    }

    // 1b. 市集 NPC（攤主與路人訪客）待機呼吸與散步循環
    for (const npc of this.marketNpcs) {
      if (npc.isWalking && npc.walkAmp && npc.walkSpeed) {
        const t = this.time * npc.walkSpeed + npc.phase
        const step = Math.sin(t) * npc.walkAmp
        npc.chibi.root.position.x = npc.baseX + step
        const movingRight = Math.cos(t) > 0
        npc.chibi.root.rotation.y = movingRight ? Math.PI / 2 : -Math.PI / 2
        npc.chibi.animate(dt, this.time + npc.phase, 1.1, false, 0)
      } else {
        npc.chibi.root.rotation.y = npc.facingYaw
        npc.chibi.animate(dt, this.time + npc.phase, 0, false, 0)
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

    // 5c. 方案三：漂浮塔羅牌緩慢上下漂浮與微幅傾斜
    for (const card of this.floatingTarotCards) {
      const t = this.time * card.speed + card.phase
      card.mesh.position.y = card.baseY + Math.sin(t) * card.amp
      card.mesh.rotation.z = card.baseRotZ + Math.sin(t * 0.8) * 0.06
      card.mesh.rotation.x = card.baseRotX + Math.cos(t * 0.6) * 0.04
    }

    // 5d. 方案三：深淵占卜蠟燭微弱燭光搖曳
    for (const c of this.abyssCandles) {
      c.light.intensity = 0.95 + Math.sin(this.time * 8.5 + c.phase) * 0.14
    }

    // 6. 電影級細雨粒子與水窪漣漪（僅在雨天時運算與渲染）
    if (this.currentWeather.condition === 'rainy') {
      this.cinematicRain?.update(dt)

      // 7. 濕潤柏油路細雨漣漪
      for (const r of this.rainRipples) {
        r.phase = (r.phase + dt * r.speed) % 1
        const s = 0.6 + r.phase * 2.4
        r.mesh.scale.set(s, s, 1)
        r.mat.opacity = (1 - r.phase) * 0.28
      }
    }
  }
}
