import * as THREE from 'three'
import { Chibi } from './chibi'
import { RAPIER, type Physics } from '../engine/physics'
import type { LampId, OfferingId } from './temple-data'
import { FrontCourtyard, GOLD_FURNACE, LOTUS_POND, PAVILION, STAND, WISH_POOL } from './temple-courtyard'
import { NpcManager } from './npc-system'

export const DRAGON_GUANYIN_POS = new THREE.Vector3(-68.0, 0.545, 31.0)

export type ShrinePointId =
  | 'incense' | 'prayer' | 'offerings' | 'daily-lot' | 'chess'
  | 'lamps' | 'woodfish' | 'bell' | 'wishing-pool' | 'prayer-wall' | 'records' | 'tiangong'
  | 'drum' | 'yuhuang' | 'gold-furnace' | 'guanyin-dragon' | 'cushion' | 'sky-lantern' | 'market-portal'
  | 'unicorn-portal'

export interface CushionWorshipper {
  group: THREE.Group
  torso: THREE.Group
  head: THREE.Group
  hands: THREE.Group
  phase: number
  hasIncense: boolean
  smokeSpot?: THREE.Vector3
  materials: THREE.Material[]
}

export interface CushionSlot {
  index: number
  x: number // hall local x
  z: number // hall local z
  worldX: number // world x
  worldZ: number // world z (z - 7)
  heading: number
  cushionGroup: THREE.Group
  glowRing: THREE.Mesh
  state: 'empty' | 'praying' | 'leaving' | 'player'
  timer: number // countdown seconds for current state
  leaveDuration: number
  worshipper?: CushionWorshipper
}

export type TimeOfDay = 'day' | 'dawn' | 'dusk' | 'night'
export type TimeSetting = 'auto' | TimeOfDay

export interface TimeConfig {
  bgColor: string
  fogColor: string
  fogNear: number
  fogFar: number
  sunColor: string
  sunIntensity: number
  sunPosition: [number, number, number]
  hemiColor: string
  hemiGroundColor: string
  hemiIntensity: number
  cloudColor: string
  cloudOpacity: number
  skyStops: [string, string, string, string]
  // Celestial objects visual properties
  sunVisualPos: [number, number, number]
  sunVisualOpacity: number
  moonPos: [number, number, number]
  moonOpacity: number
  starsOpacity: number
  milkyWayOpacity: number
}

export interface LunarPhaseInfo {
  phase: number // 0..1 (0: New Moon, 0.25: First Quarter, 0.5: Full Moon, 0.75: Last Quarter)
  cycleDay: number // 0..29.53
  illumination: number // 0..1
  name: string // 朔月, 娥眉月, 上弦月, 滿月, etc.
  description: string
  isMidAutumnFullMoon: boolean
  lunarMonth: number
  lunarDay: number
}

export function getLunarPhaseInfo(date = new Date()): LunarPhaseInfo {
  // Astronomical synodic month calculation (~29.530588 days)
  // Reference known new moon: 2000-01-06 18:14 UTC (timestamp: 947182440000)
  const diffDays = (date.getTime() - 947182440000) / 86400000
  const cycleDay = ((diffDays % 29.530588) + 29.530588) % 29.530588
  const phase = cycleDay / 29.530588
  const illumination = (1 - Math.cos(phase * 2 * Math.PI)) / 2

  let lunarMonth = 0
  let lunarDay = 0
  try {
    const parts = new Intl.DateTimeFormat('zh-u-ca-chinese', { month: 'numeric', day: 'numeric' }).formatToParts(date)
    for (const p of parts) {
      if (p.type === 'month') lunarMonth = parseInt(p.value, 10) || 0
      if (p.type === 'day') lunarDay = parseInt(p.value, 10) || 0
    }
  } catch {
    // Graceful fallback if Intl unsupported
  }

  const isMidAutumn = (lunarMonth === 8 && (lunarDay === 15 || lunarDay === 16))

  let name = ''
  let description = ''

  if (isMidAutumn) {
    name = '中秋滿月'
    description = '農曆八月十五中秋佳節・皎潔金桂皓月，銀輝遍照深山'
  } else if (cycleDay < 1.0 || cycleDay >= 28.5) {
    name = '新月（朔月）'
    description = '月華初隱，深山萬籟俱寂，繁星銀河極致璀璨'
  } else if (cycleDay < 6.8) {
    name = '娥眉月'
    description = '新月如鉤，清冷澄澈，如古琴初泛'
  } else if (cycleDay < 8.5) {
    name = '上弦月'
    description = '半輪明月，清輝照夜，山林含霜'
  } else if (cycleDay < 13.8) {
    name = '盈凸月'
    description = '月漸盈滿，清光大盛，古剎清幽'
  } else if (cycleDay < 16.0) {
    name = '滿月（望月）'
    description = '明月高懸，皎潔銀輝灑落古寺古山'
  } else if (cycleDay < 21.8) {
    name = '虧凸月'
    description = '月華漸斂，夜色清寧，山嵐如霧'
  } else if (cycleDay < 23.5) {
    name = '下弦月'
    description = '下弦半月，清輝照古殿，晨星微芒'
  } else {
    name = '殘月'
    description = '殘月伴曉星，群山靜謐，天將明矣'
  }

  return {
    phase,
    cycleDay,
    illumination,
    name,
    description,
    isMidAutumnFullMoon: isMidAutumn,
    lunarMonth,
    lunarDay,
  }
}

export const TIME_CONFIGS: Record<TimeOfDay, TimeConfig> = {
  dawn: {
    bgColor: '#ba6a55',
    fogColor: '#c77a63',
    fogNear: 55,
    fogFar: 180,
    sunColor: '#ffcca0',
    sunIntensity: 1.15,
    sunPosition: [-35, 20, 22],
    hemiColor: '#ffd8b8',
    hemiGroundColor: '#4a3832',
    hemiIntensity: 0.95,
    cloudColor: '#fedbc7',
    cloudOpacity: 0.85,
    skyStops: ['#2c3b59', '#8c4840', '#d47752', '#fad794'],
    sunVisualPos: [-125, 42, 60],
    sunVisualOpacity: 0.92,
    moonPos: [95, 35, -80],
    moonOpacity: 0.15,
    starsOpacity: 0.0,
    milkyWayOpacity: 0.0,
  },
  day: {
    bgColor: '#98b8cb',
    fogColor: '#bfd4df',
    fogNear: 55,
    fogFar: 180,
    sunColor: '#fff0d0',
    sunIntensity: 1.35,
    sunPosition: [-18, 36, 25],
    hemiColor: '#fbf4e8',
    hemiGroundColor: '#636b69',
    hemiIntensity: 1.1,
    cloudColor: '#fefcf8',
    cloudOpacity: 0.82,
    skyStops: ['#5a8fa8', '#86adbe', '#c1d4dc', '#ebe4d3'],
    sunVisualPos: [-65, 115, 75],
    sunVisualOpacity: 1.0,
    moonPos: [95, 20, -80],
    moonOpacity: 0.0,
    starsOpacity: 0.0,
    milkyWayOpacity: 0.0,
  },
  dusk: {
    bgColor: '#6a2838',
    fogColor: '#7d3242',
    fogNear: 55,
    fogFar: 180,
    sunColor: '#ff7733',
    sunIntensity: 1.1,
    sunPosition: [35, 18, 20],
    hemiColor: '#ff9966',
    hemiGroundColor: '#3a2b30',
    hemiIntensity: 0.95,
    cloudColor: '#fca57c',
    cloudOpacity: 0.88,
    skyStops: ['#1c1c38', '#5e2348', '#a63e3d', '#e67e22'],
    sunVisualPos: [125, 38, 55],
    sunVisualOpacity: 0.95,
    moonPos: [75, 60, -90],
    moonOpacity: 0.45,
    starsOpacity: 0.0,
    milkyWayOpacity: 0.0,
  },
  night: {
    bgColor: '#0f1b2d',
    fogColor: '#142236',
    fogNear: 70,
    fogFar: 190,
    sunColor: '#a8c6f2',
    sunIntensity: 0.98,
    sunPosition: [-15, 30, -25],
    hemiColor: '#5275a2',
    hemiGroundColor: '#3c4d62',
    hemiIntensity: 1.18,
    cloudColor: '#526585',
    cloudOpacity: 0.55,
    skyStops: ['#0a1426', '#13223a', '#1e3354', '#2c476e'],
    sunVisualPos: [0, -70, 0],
    sunVisualOpacity: 0.0,
    moonPos: [62, 92, -95],
    moonOpacity: 1.0,
    starsOpacity: 0.0,
    milkyWayOpacity: 0.0,
  },
}

export function getRealWorldTimeOfDay(date = new Date()): { mode: TimeOfDay; hourFraction: number } {
  const h = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600
  let mode: TimeOfDay = 'night'
  if (h >= 5.0 && h < 7.0) {
    mode = 'dawn'
  } else if (h >= 7.0 && h < 17.0) {
    mode = 'day'
  } else if (h >= 17.0 && h < 19.0) {
    mode = 'dusk'
  } else {
    mode = 'night'
  }
  return { mode, hourFraction: h }
}

export type ShrinePoint = {
  id: ShrinePointId
  title: string
  subtitle: string
  position: THREE.Vector3
  radius: number
}

const C = {
  stone: '#897f70', stoneLight: '#b9aa91', darkWood: '#39291f', wood: '#5b3426',
  vermilion: '#9c3b2d', vermilionLight: '#b64b37', gold: '#b7924a', goldLight: '#dfc17c',
  roof: '#34433c', roofLight: '#465b50', jade: '#678276', ivory: '#e5dcc8', water: '#4e7771',
}

export const COURTYARD_PRAYER_WALL_POS = new THREE.Vector3(8.8, 0, 8.2)

const pointSpecs: Omit<ShrinePoint, 'position'>[] = [
  { id: 'incense', title: '上香祈福', subtitle: '於香爐前敬香祈願', radius: 1.8 },
  { id: 'prayer', title: '大殿外廣場・祈願牆', subtitle: '書寫心願，祈求平安吉祥', radius: 3.4 },
  { id: 'offerings', title: '虛擬供奉', subtitle: '供花、供果、供茶', radius: 3.0 },
  { id: 'daily-lot', title: '每日抽籤', subtitle: '靜心抽取今日籤詩', radius: 3.0 },
  { id: 'chess', title: '天心仙姑問事亭', subtitle: '象棋卜卦・問事服務', radius: 2.6 },
  { id: 'lamps', title: '祈福燈區', subtitle: '點平安燈、財神燈、文昌燈', radius: 3.2 },
  { id: 'woodfish', title: '木魚', subtitle: '敲擊木魚，收攝心念', radius: 2.5 },
  { id: 'bell', title: '祈福鐘', subtitle: '鳴鐘祈願，祝福相隨', radius: 2.8 },
  { id: 'wishing-pool', title: '前庭東側・蓮花許願池', subtitle: '投入一枚祈福銅錢', radius: 4.8 },
  { id: 'prayer-wall', title: '大殿外廣場・祈願牆', subtitle: '閱讀祝願，寫下心願', radius: 3.4 },
  { id: 'records', title: '祈福紀錄', subtitle: '回看本機保存的參拜足跡', radius: 3.0 },
  { id: 'drum', title: '鼓樓擊鼓', subtitle: '擊鼓鳴志，收攝心念', radius: 2.8 },
  { id: 'yuhuang', title: '後殿凌霄寶殿', subtitle: '朝拜玉皇上帝，蒙沐浩恩', radius: 3.2 },
  { id: 'gold-furnace', title: '八角金亭', subtitle: '化金祈福，添香油聚善緣', radius: 3.0 },
  { id: 'guanyin-dragon', title: '參拜昇龍觀音', subtitle: '仰望五層樓高乘龍觀音金身', radius: 4.8 },
  { id: 'sky-lantern', title: '天燈祈福', subtitle: '於天心仙姑旁點燃祈福天燈', radius: 2.4 },
  { id: 'market-portal', title: '踏入靈光時空門', subtitle: '前往天心靈光市集', radius: 2.8 },
  { id: 'unicorn-portal', title: '踏入獨角獸時空門', subtitle: '前往月光森林・獨角獸心安宮', radius: 2.8 },
]
const pointPositions: [number, number][] = [
  [0, 6.39], [COURTYARD_PRAYER_WALL_POS.x, COURTYARD_PRAYER_WALL_POS.z + 1.4], [-2.25, -2.2], [-9.2, 1.2], [PAVILION.x + 1.6, PAVILION.z],
  [12.5, 2.2], [8.5, -6.2], [12.4, -5.6], [LOTUS_POND.x - 5.8, LOTUS_POND.z], [COURTYARD_PRAYER_WALL_POS.x, COURTYARD_PRAYER_WALL_POS.z + 1.4], [15, 0.2],
  [-12.4, -5.6], [0, -23.5], [GOLD_FURNACE.x + 3.2, GOLD_FURNACE.z],
  [DRAGON_GUANYIN_POS.x + 4.8, DRAGON_GUANYIN_POS.z],
  [-12.5, 23.5],
  [23.8, 14.2],
  [-23.8, 14.2],
]

/** Object each station faces, used to orient visitors who use the quick guide. */
export const POINT_TARGETS: [number, number][] = [
  [0, 6.39], [COURTYARD_PRAYER_WALL_POS.x, COURTYARD_PRAYER_WALL_POS.z], [-2.25, -4.55], [-12, 1.2], [PAVILION.x, PAVILION.z],
  [12.5, -1.6], [8.5, -8.5], [15.2, -8], [LOTUS_POND.x, LOTUS_POND.z], [COURTYARD_PRAYER_WALL_POS.x, COURTYARD_PRAYER_WALL_POS.z], [17.2, 0.2],
  [-15.2, -8.0], [0, -30.2], [GOLD_FURNACE.x, GOLD_FURNACE.z],
  [DRAGON_GUANYIN_POS.x, DRAGON_GUANYIN_POS.z],
  [-12.5, 23.5],
  [21.8, 14.2],
  [-21.8, 14.2],
]

const makeMat = (color: string, roughness = 0.82, metalness = 0): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness })

/** Height of the 3D Guanyin figure above the lotus throne, in metres. */
const GUANYIN_HEIGHT = 2.6

/** The 1.35x hall is the approved deity-size reference. Larger halls add headroom, not larger deities. */
const MAIN_HALL_DEITY_REFERENCE_SCALE = 1.35

interface FlyingCoin {
  mesh: THREE.Group
  start: THREE.Vector3
  target: THREE.Vector3
  progress: number
  duration: number
  peak: number
  rotSpeed: THREE.Vector3
  onSplash?: () => void
}

interface SinkingCoin {
  mesh: THREE.Group
  y: number
  targetY: number
  wobblePhase: number
  wobbleSpeed: number
  age: number
}

interface WaterRipple {
  mesh: THREE.Mesh
  baseScale: number
  maxScale: number
  age: number
  life: number
}

interface SplashDroplet {
  mesh: THREE.Mesh
  velocity: THREE.Vector3
  age: number
  life: number
}

interface WishSparkle {
  mesh: THREE.Mesh
  baseX: number
  baseZ: number
  vy: number
  swaySpeed: number
  swayAmp: number
  age: number
  life: number
}

export class TempleWorld {
  private guanyinRoot: THREE.Group | null = null
  private caiShenRoot: THREE.Group | null = null
  private yueLaoRoot: THREE.Group | null = null
  private guanyinModelPlaced = false
  readonly scene = new THREE.Scene()
  readonly spawn = new THREE.Vector3(STAND.x, 1.2, STAND.z)
  readonly points: ShrinePoint[] = pointSpecs.map((point, i) => ({
    ...point,
    position: new THREE.Vector3(
      pointPositions[i][0],
      point.id === 'guanyin-dragon' ? DRAGON_GUANYIN_POS.y : 0,
      pointPositions[i][1]
    ),
  }))

  private readonly markers = new Map<ShrinePointId, THREE.Mesh>()
  private readonly markerMats = new Map<ShrinePointId, THREE.MeshBasicMaterial>()
  private readonly lampMats = new Map<LampId, THREE.MeshStandardMaterial>()
  private readonly lampLights = new Map<LampId, THREE.PointLight>()
  private readonly offeringDisplay = new THREE.Group()
  private readonly smoke: { mesh: THREE.Mesh; age: number; life: number }[] = []
  private readonly flyingCoins: FlyingCoin[] = []
  private readonly sinkingCoins: SinkingCoin[] = []
  private readonly restingCoins: THREE.Group[] = []
  private readonly ripples: WaterRipple[] = []
  private readonly droplets: SplashDroplet[] = []
  private readonly sparkles: WishSparkle[] = []

  private readonly coinGoldMat = makeMat('#f8cb3c', 0.22, 0.92)
  private readonly coinDarkMat = makeMat('#6b4b1a', 0.5, 0.6)
  private readonly dropletMat = new THREE.MeshStandardMaterial({ color: '#bcece5', roughness: 0.12, metalness: 0.15, transparent: true, opacity: 0.85 })
  private readonly sparkleMat = new THREE.MeshBasicMaterial({ color: '#ffe785', transparent: true, opacity: 0.95, depthWrite: false })
  private readonly roof = new THREE.Group()
  private readonly rearRoof = new THREE.Group()
  private mainHallGroup!: THREE.Group
  private rearHallGroup!: THREE.Group
  private readonly rearHallColliders: { collider: RAPIER.Collider; x: number; y: number; origZ: number }[] = []
  private mainHallScale = 1.35
  private mainHallZ = -7.28
  private mainHallColliders: RAPIER.Collider[] = []
  private readonly leftSideGroup = new THREE.Group()
  private readonly rightSideGroup = new THREE.Group()
  private readonly sideColliders: { collider: RAPIER.Collider; origX: number; y: number; z: number; isLeft: boolean }[] = []
  private outdoorUrn!: THREE.Group
  private outdoorUrnCollider: RAPIER.Collider | null = null
  private readonly bell = new THREE.Group()
  private readonly drum = new THREE.Group()
  private readonly woodfish = new THREE.Group()
  private readonly avatarStand = new THREE.Group()
  private readonly chibi = new Chibi()
  private readonly guideArrow: THREE.Mesh
  private readonly guideBeacon: THREE.Mesh
  private readonly incenseGlow: THREE.PointLight
  private readonly courtyard: FrontCourtyard
  private readonly sun: THREE.DirectionalLight
  private readonly hemiLight: THREE.HemisphereLight
  private skyCv!: HTMLCanvasElement
  private skyTex!: THREE.CanvasTexture
  private cloudMat!: THREE.MeshBasicMaterial
  private timeSetting: TimeSetting = 'auto'
  private timeOfDay: TimeOfDay = 'day'
  private readonly targetBgColor = new THREE.Color('#98b8cb')
  private readonly targetFogColor = new THREE.Color('#bfd4df')
  private targetFogNear = 55
  private targetFogFar = 180
  private readonly targetSunColor = new THREE.Color('#fff0d0')
  private targetSunIntensity = 1.35
  private readonly targetSunPos = new THREE.Vector3(-18, 36, 25)
  private readonly targetHemiColor = new THREE.Color('#fbf4e8')
  private readonly targetHemiGroundColor = new THREE.Color('#636b69')
  private targetHemiIntensity = 1.1
  private readonly targetCloudColor = new THREE.Color('#fefcf8')
  private targetCloudOpacity = 0.82
  private readonly currentSkyStops: [THREE.Color, THREE.Color, THREE.Color, THREE.Color] = [
    new THREE.Color('#5a8fa8'),
    new THREE.Color('#86adbe'),
    new THREE.Color('#c1d4dc'),
    new THREE.Color('#ebe4d3'),
  ]
  private readonly targetSkyStops: [THREE.Color, THREE.Color, THREE.Color, THREE.Color] = [
    new THREE.Color('#5a8fa8'),
    new THREE.Color('#86adbe'),
    new THREE.Color('#c1d4dc'),
    new THREE.Color('#ebe4d3'),
  ]
  private realTimeCheckTimer = 0
  private isSkyTransitioning = false
  private bellImpulse = 0
  private drumImpulse = 0
  private woodfishImpulse = 0
  private readonly lamps: { id: LampId; position: THREE.Vector3 }[] = [
    { id: 'peace', position: new THREE.Vector3(10, 0, -1.6) },
    { id: 'wealth', position: new THREE.Vector3(12.5, 0, -1.6) },
    { id: 'study', position: new THREE.Vector3(15, 0, -1.6) },
  ]
  private readonly clouds: { mesh: THREE.Group; speed: number; x: number; z: number; y: number }[] = []
  /**
   * The ascending-dragon image and its contact shadow share this ground-anchor
   * group. Keeping both under one group makes their scale and horizontal
   * facing stay in sync without moving the lotus base away from the platform.
   */
  private dragonGuanyinBillboard?: THREE.Group
  private auraParticles?: THREE.Points
  private auraParticleData?: { radius: number; angle: number; speed: number; rotSpeed: number }[]
  private dragonGuanyinUrnPos?: THREE.Vector3
  private dragonPuffTimer = 1.2
  private marketPortalSwirl?: THREE.Group
  private unicornPortalSwirl?: THREE.Group
  readonly cushionSlots: CushionSlot[] = []
  private readonly mainHallSmokeSpots: THREE.Vector3[] = []
  private mainHallSmokeTimer = 0.75
  readonly npcs: NpcManager
  onNpcDialogue?: (speaker: string, text: string) => void
  onTimeOfDayChange?: (mode: TimeOfDay) => void

  // Celestial objects (Sun, Moon, Starfield, Milky Way)
  private sunSprite?: THREE.Sprite
  private moonSprite?: THREE.Sprite
  private moonCanvas?: HTMLCanvasElement
  private moonTexture?: THREE.CanvasTexture
  private celestialGroup?: THREE.Group

  private currentSunVisualOpacity = 1.0
  private targetSunVisualOpacity = 1.0
  private readonly currentSunVisualPos = new THREE.Vector3(-65, 115, 75)
  private readonly targetSunVisualPos = new THREE.Vector3(-65, 115, 75)

  private currentMoonOpacity = 0.0
  private targetMoonOpacity = 0.0
  private readonly currentMoonPos = new THREE.Vector3(62, 92, -95)
  private readonly targetMoonPos = new THREE.Vector3(62, 92, -95)

  private currentStarsOpacity = 0.0
  private targetStarsOpacity = 0.0
  private currentMilkyWayOpacity = 0.0
  private targetMilkyWayOpacity = 0.0

  private lunarPhaseInfo: LunarPhaseInfo = getLunarPhaseInfo()
  private lunarCheckTimer = 0

  constructor(private readonly physics: Physics) {
    // Elegant warm celestial sky & gentle horizon fog (澄澈淡碧與暖金宮闕天空色調)
    this.scene.background = new THREE.Color('#98b8cb')
    this.scene.fog = new THREE.Fog('#bfd4df', 65, 175)
    this.hemiLight = new THREE.HemisphereLight('#fbf4e8', '#636b69', 1.1)
    this.scene.add(this.hemiLight)
    this.sun = new THREE.DirectionalLight('#fff0d0', 1.35)
    this.sun.position.set(-18, 34, 30)
    this.sun.target.position.set(0, 0, 12)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    this.sun.shadow.camera.left = -88
    this.sun.shadow.camera.right = 40
    this.sun.shadow.camera.top = 56
    this.sun.shadow.camera.bottom = -40
    this.sun.shadow.camera.near = 1
    this.sun.shadow.camera.far = 110
    this.sun.shadow.normalBias = 0.035
    this.scene.add(this.sun, this.sun.target)

    this.addSkyDome()
    this.addCelestialObjects()
    this.addClouds()

    const initialReal = getRealWorldTimeOfDay().mode
    this.timeSetting = 'auto'
    this.timeOfDay = initialReal
    this.applyTimeConfig(TIME_CONFIGS[initialReal], true)

    this.courtyard = new FrontCourtyard({
      scene: this.scene, physics: this.physics, mat: makeMat,
      roof: (w, d, e, pk) => this.createRoof(w, d, e, pk),
      text: (t, fg, bg) => this.textMaterial(t, fg, bg),
    })
    this.addMainHall()
    this.addRearHall()
    this.addDrumTower()
    this.addSideArchitecture()
    this.addRitualProps()
    this.addMarketPortal()
    this.addUnicornPortal()
    this.addCourtyardPrayerWall()
    this.addMarkers()
    this.setMainHallScale(this.mainHallScale)
    this.addGiantDragonGuanyin()
    this.npcs = new NpcManager(this.scene)
    this.npcs.onSpeak = (speaker, text) => this.onNpcDialogue?.(speaker, text)
    this.avatarStand.add(this.chibi.root)
    this.scene.add(this.avatarStand)
    this.placeAvatarAtStand()
    const arrowShape = new THREE.Shape()
    arrowShape.moveTo(0, 0.55); arrowShape.lineTo(0.38, 0); arrowShape.lineTo(0.14, 0); arrowShape.lineTo(0.14, -0.4)
    arrowShape.lineTo(-0.14, -0.4); arrowShape.lineTo(-0.14, 0); arrowShape.lineTo(-0.38, 0); arrowShape.closePath()
    const arrowGeo = new THREE.ShapeGeometry(arrowShape)
    arrowGeo.rotateX(Math.PI / 2)
    this.guideArrow = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color: '#f2c46a', transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }))
    this.guideArrow.renderOrder = 3
    this.guideArrow.scale.setScalar(1.6)
    this.guideBeacon = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 7, 20, 1, true), new THREE.MeshBasicMaterial({ color: '#f2c46a', transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }))
    this.guideBeacon.geometry.translate(0, 3.5, 0)
    this.guideArrow.visible = this.guideBeacon.visible = false
    this.scene.add(this.guideArrow, this.guideBeacon)
    this.incenseGlow = new THREE.PointLight('#f1a754', 0.22, 7, 2)
    this.incenseGlow.position.set(0, 1.8, -2.6)
    this.scene.add(this.incenseGlow)
    this.initRestingCoins()
  }

  private addMainHall(): void {
    const hall = new THREE.Group()
    this.mainHallGroup = hall
    hall.position.set(0, 0, this.mainHallZ)
    hall.scale.set(this.mainHallScale, this.mainHallScale, this.mainHallScale)
    this.scene.add(hall)
    const red = makeMat(C.vermilion)
    const redDark = makeMat('#792a20', 0.85)
    const wood = makeMat(C.wood)
    const darkWood = makeMat(C.darkWood, 0.88)
    const gold = makeMat(C.gold, 0.48, 0.2)
    const stonePlinth = makeMat('#9e9382', 0.94)

    // 1. Raised Hall Podium & Steps (大殿台基月台、漢白玉欄杆與御路龍陛石雕)
    const podium = new THREE.Mesh(new THREE.BoxGeometry(20.4, 0.28, 14.8), stonePlinth)
    podium.position.set(0, 0.14, -0.3)
    podium.receiveShadow = true
    hall.add(podium)

    // Front approach stone steps (龍門入口踏步、中央雲龍陛、虎門出口踏步)
    // 右邊龍門（入口）專屬登殿石階
    const stepRight1 = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.14, 0.8), stonePlinth)
    stepRight1.position.set(6.75, 0.07, 7.5)
    stepRight1.receiveShadow = true
    hall.add(stepRight1)
    const stepRight2 = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.14, 0.5), stonePlinth)
    stepRight2.position.set(6.75, 0.21, 6.9)
    stepRight2.receiveShadow = true
    hall.add(stepRight2)

    // 左邊虎門（出口）專屬離殿石階
    const stepLeft1 = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.14, 0.8), stonePlinth)
    stepLeft1.position.set(-6.75, 0.07, 7.5)
    stepLeft1.receiveShadow = true
    hall.add(stepLeft1)
    const stepLeft2 = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.14, 0.5), stonePlinth)
    stepLeft2.position.set(-6.75, 0.21, 6.9)
    stepLeft2.receiveShadow = true
    hall.add(stepLeft2)

    // 中央中門御路兩側登殿石階（左側與右側御道踏步）
    for (const side of [-1, 1]) {
      const stepCenter1 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.14, 0.8), stonePlinth)
      stepCenter1.position.set(side * 1.6, 0.07, 7.5)
      stepCenter1.receiveShadow = true
      hall.add(stepCenter1)

      const stepCenter2 = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.14, 0.5), stonePlinth)
      stepCenter2.position.set(side * 1.55, 0.21, 6.9)
      stepCenter2.receiveShadow = true
      hall.add(stepCenter2)
    }

    // Imperial Dragon Path Stone Relief (大殿中央中門御路龍陛石雕 / 丹墀雲龍階石)
    const dragonRamp = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 1.25), makeMat('#5f7169', 0.88, 0.15))
    dragonRamp.position.set(0, 0.16, 7.15)
    dragonRamp.rotation.x = -0.19
    dragonRamp.receiveShadow = true
    hall.add(dragonRamp)
    const dragonRelief = new THREE.Mesh(
      new THREE.PlaneGeometry(1.7, 1.1),
      this.textMaterial('丹 墀 雲 龍 陛', '#dfc47b', '#35433d')
    )
    dragonRelief.position.set(0, 0.22, 7.15)
    dragonRelief.rotation.x = -Math.PI / 2 + 0.19
    hall.add(dragonRelief)

    // White Stone Balustrades with Lotus Finials (月台漢白玉望柱與雲紋欄板，護衛於壁堵前方，保留龍門與虎門通暢)
    const balustradeMat = makeMat('#d6cfc2', 0.88)
    for (const side of [-1, 1]) {
      // Railing panels between Center Gate and Side Gates
      const rail = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.52, 0.14), balustradeMat)
      rail.position.set(side * 3.6, 0.44, 7.0)
      hall.add(rail)
      // Lotus Finial Posts (蓮花望柱)
      for (const x of [side * 2.0, side * 3.6, side * 5.2]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.72, 0.2), balustradeMat)
        post.position.set(x, 0.5, 7.0)
        const lotusBud = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), balustradeMat)
        lotusBud.position.set(x, 0.9, 7.0)
        lotusBud.scale.set(0.9, 1.3, 0.9)
        hall.add(post, lotusBud)
      }
      // Outer flanking railings
      const outerRail = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.52, 0.14), balustradeMat)
      outerRail.position.set(side * 8.9, 0.44, 7.0)
      hall.add(outerRail)
      const outerPost = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.72, 0.2), balustradeMat)
      outerPost.position.set(side * 9.6, 0.5, 7.0)
      hall.add(outerPost)
    }

    // 2. Solid Back Wall with Wide Grand Passageway Doors to Rear Hall (神龕背牆與通往後殿之開闊穿堂大門)
    // Central Shrine Back Wall (中央主殿神龕實體背牆，通高 8.0m 直達大殿重檐屋架，徹底隔絕後方殿宇背景，確保神聖莊嚴)
    const backCenter = new THREE.Mesh(new THREE.BoxGeometry(8.2, 8.0, 0.6), makeMat('#543b2f'))
    backCenter.position.set(0, 4.0, -6.4)
    backCenter.castShadow = true
    backCenter.receiveShadow = true
    hall.add(backCenter)

    // Left & Right Outer Back Walls (左右外側背牆與寬闊連通御門，通道寬達 3.3 公尺、通高 4.25 公尺，上方背牆同樣通高 8.0m 封頂)
    for (const side of [-1, 1]) {
      const outerWall = new THREE.Mesh(new THREE.BoxGeometry(2.2, 8.0, 0.6), makeMat('#543b2f'))
      outerWall.position.set(side * 8.5, 4.0, -6.4)
      outerWall.castShadow = true
      outerWall.receiveShadow = true
      hall.add(outerWall)

      // Grand arch door lintel spanning 3.3m wide open passageway
      const doorLintel = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.85, 0.6), redDark)
      doorLintel.position.set(side * 5.75, 4.68, -6.4)
      hall.add(doorLintel)

      // Upper wall above door lintel up to y = 8.0m ceiling
      const doorUpperWall = new THREE.Mesh(new THREE.BoxGeometry(3.3, 2.9, 0.6), makeMat('#543b2f'))
      doorUpperWall.position.set(side * 5.75, 6.55, -6.4)
      doorUpperWall.castShadow = true
      doorUpperWall.receiveShadow = true
      hall.add(doorUpperWall)

      // Front & Rear Door Plaques: 「通 天」 / 「達 地」
      const doorSignFront = new THREE.Mesh(
        new THREE.PlaneGeometry(2.2, 0.48),
        this.textMaterial(side === 1 ? '達 地' : '通 天', '#dfc17c', '#362117')
      )
      doorSignFront.position.set(side * 5.75, 4.58, -6.08)
      const doorSignBack = new THREE.Mesh(
        new THREE.PlaneGeometry(2.2, 0.48),
        this.textMaterial(side === 1 ? '達 地' : '通 天', '#dfc17c', '#362117')
      )
      doorSignBack.rotation.y = Math.PI
      doorSignBack.position.set(side * 5.75, 4.58, -6.72)
      hall.add(doorSignFront, doorSignBack)
    }

    // 3. Solid Side Walls with Traditional Pilasters (左右兩側厚實大殿山牆)
    for (const side of [-1, 1]) {
      const sx = side * 9.2
      const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.55, 5.1, 12.6), darkWood)
      sideWall.position.set(sx, 2.55, -0.4)
      sideWall.castShadow = true
      sideWall.receiveShadow = true
      hall.add(sideWall)
    }

    // 4. Front Facade: Three Distinct Temple Portals (大廟正殿三川殿三門古制格局)
    // 面向大殿（南朝北）：右邊(+X)為龍門(入口)、中央(X=0)為中門(神明出入聖道)、左邊(-X)為虎門(出口)

    // A. 中門（中央開放式敞開大門：通透明亮無遮擋，可直接由廟埕中軸線瞻仰大殿觀世音菩薩神像）
    // 頂部中門橫樑與「玉 皇 宮」金字大匾
    const centerLintel = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.75, 0.38), darkWood)
    centerLintel.position.set(0, 4.5, 5.24)
    hall.add(centerLintel)

    const centerPlaque = new THREE.Mesh(
      new THREE.PlaneGeometry(3.0, 0.72),
      this.textMaterial('玉 皇 宮', '#f6d78c', '#2c170f')
    )
    centerPlaque.position.set(0, 4.5, 5.45)
    hall.add(centerPlaque)

    // 平緩石台基底（完全開放式，視野通透直達大殿觀音聖像）
    const threshold = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.08, 0.28), stonePlinth)
    threshold.position.set(0, 0.18, 5.28)
    hall.add(threshold)

    // 大殿正門雙扇與傳統武門神（秦叔寶、尉遲恭）：扇門向內側微開約 45 度，中央保留 2.34m 寬敞通道，直視觀音聖相
    for (const side of [-1, 1]) {
      const doorLeaf = new THREE.Group()
      doorLeaf.position.set(side * 2.18, 2.38, 5.25)

      // 朱漆大門扇本體
      const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(1.42, 3.86, 0.08), makeMat('#802117', 0.65))
      doorMesh.position.set(side * -0.71, 0, 0)
      doorMesh.castShadow = true
      doorLeaf.add(doorMesh)

      // 傳統門神彩繪板（龍邊 +X：秦叔寶，虎邊 -X：尉遲恭）
      const godMat = this.doorGodMaterial(side === 1 ? 'qin' : 'yuchi')
      const godPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 3.76), godMat)
      godPlane.position.set(side * -0.71, 0, 0.045)
      doorLeaf.add(godPlane)

      // 金鋪首銜環
      const knockerRing = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.026, 8, 16), gold)
      knockerRing.position.set(side * -0.32, 0, 0.065)
      const knockerBase = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 12), gold)
      knockerBase.rotation.x = Math.PI / 2
      knockerBase.position.set(side * -0.32, 0, 0.055)
      doorLeaf.add(knockerRing, knockerBase)

      // 金門釘（分佈於門扇外側邊緣飾帶）
      for (const y of [-1.5, -0.75, 0.75, 1.5]) {
        const stud = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), gold)
        stud.position.set(side * -1.32, y, 0.05)
        doorLeaf.add(stud)
      }

      // 向大殿內側敞開約 45 度（保留中央通道 2.34m，迎賓氣度尊貴非凡）
      doorLeaf.rotation.y = -side * 0.78
      hall.add(doorLeaf)
    }

    // B. 右邊龍門（面向大殿右邊 +X 側，敞開通行）
    const dragonPortalLintel = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.9, 0.36), redDark)
    dragonPortalLintel.position.set(6.75, 4.35, 5.2)
    hall.add(dragonPortalLintel)

    const dragonDoorPlaque = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 0.58),
      this.textMaterial('龍 門', '#f6d88c', '#2c170f')
    )
    dragonDoorPlaque.position.set(6.75, 4.4, 5.4)
    hall.add(dragonDoorPlaque)

    // C. 左邊虎門（面向大殿左邊 -X 側，敞開通行）
    const tigerPortalLintel = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.9, 0.36), redDark)
    tigerPortalLintel.position.set(-6.75, 4.35, 5.2)
    hall.add(tigerPortalLintel)

    const tigerDoorPlaque = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 0.58),
      this.textMaterial('虎 門', '#f6d88c', '#2c170f')
    )
    tigerDoorPlaque.position.set(-6.75, 4.4, 5.4)
    hall.add(tigerDoorPlaque)

    // D. 左右壁堵（Screen Wall Panels between the doors）
    // 右側龍壁堵 (Between 中門 and 龍門, x = 3.8, width 3.2m)
    const rightScreenWall = new THREE.Mesh(new THREE.BoxGeometry(3.2, 4.8, 0.28), redDark)
    rightScreenWall.position.set(3.8, 2.4, 5.2)
    rightScreenWall.castShadow = true
    rightScreenWall.receiveShadow = true
    hall.add(rightScreenWall)

    const rightWindowFrame = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.4, 0.12), makeMat('#2b1c14'))
    rightWindowFrame.position.set(3.8, 2.8, 5.38)
    hall.add(rightWindowFrame)
    const rightLattice = new THREE.Mesh(
      new THREE.PlaneGeometry(2.5, 2.1),
      this.textMaterial('祥 龍 獻 瑞 ・ 迎 祥 納 福', '#e5c07b', '#362117')
    )
    rightLattice.position.set(3.8, 2.8, 5.46)
    hall.add(rightLattice)

    // 左側虎壁堵 (Between 虎門 and 中門, x = -3.8, width 3.2m)
    const leftScreenWall = new THREE.Mesh(new THREE.BoxGeometry(3.2, 4.8, 0.28), redDark)
    leftScreenWall.position.set(-3.8, 2.4, 5.2)
    leftScreenWall.castShadow = true
    leftScreenWall.receiveShadow = true
    hall.add(leftScreenWall)

    const leftWindowFrame = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.4, 0.12), makeMat('#2b1c14'))
    leftWindowFrame.position.set(-3.8, 2.8, 5.38)
    hall.add(leftWindowFrame)
    const leftLattice = new THREE.Mesh(
      new THREE.PlaneGeometry(2.5, 2.1),
      this.textMaterial('猛 虎 辟 邪 ・ 消 災 解 厄', '#e5c07b', '#362117')
    )
    leftLattice.position.set(-3.8, 2.8, 5.46)
    hall.add(leftLattice)

    // 左右外側端牆 (Outer side walls beyond Dragon / Tiger Doors)
    for (const side of [-1, 1]) {
      const outerWall = new THREE.Mesh(new THREE.BoxGeometry(1.5, 4.8, 0.28), redDark)
      outerWall.position.set(side * 8.85, 2.4, 5.2)
      hall.add(outerWall)
    }

    // 5. Main Columns, Carved Dragon Pillars & Crossbeams (大木作柱梁系統：金環立柱、前門雙龍柱與鰲魚雀替)
    const cyanStone = makeMat('#41554c', 0.85, 0.25)
    for (const z of [-5.8, -0.2, 5.2]) {
      for (const x of [-8.1, -5.4, 5.4, 8.1]) {
        const isDragonCol = z === 5.2 && (x === -5.4 || x === 5.4)
        if (isDragonCol) {
          // 青石雙龍盤柱（雕塑青石龍柱柱身、八角蓮花柱礎與盤旋金龍金環）
          const baseStone = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.58, 0.45, 8), stonePlinth)
          baseStone.position.set(x, 0.22, z)
          hall.add(baseStone)

          const column = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.44, 4.7, 16), cyanStone)
          column.position.set(x, 2.65, z)
          column.castShadow = true
          hall.add(column)

          // Spiral dragon body coils winding upward around column (金龍盤身雕花)
          for (let i = 0; i < 5; i += 1) {
            const dragonCoil = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.09, 8, 16), gold)
            dragonCoil.rotation.x = Math.PI / 2 + 0.35
            dragonCoil.position.set(x, 1.0 + i * 0.72, z)
            hall.add(dragonCoil)
          }
          // Dragon head and flaming pearl near the capital (金龍龍首與龍珠)
          const dragonHead = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.55, 6), gold)
          dragonHead.rotation.x = Math.PI / 2
          dragonHead.position.set(x, 4.3, z + 0.38)
          const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), gold)
          pearl.position.set(x, 4.0, z + 0.48)
          hall.add(dragonHead, pearl)

          const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.18, 12), gold)
          ring.position.set(x, 4.85, z)
          hall.add(ring)
        } else {
          // Vermilion temple columns with gilded capital collars (朱紅金柱)
          const column = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 5.05, 12), red)
          column.position.set(x, 2.52, z)
          column.castShadow = true
          hall.add(column)
          const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.49, 0.49, 0.15, 12), gold)
          ring.position.set(x, 4.65, z)
          hall.add(ring)
        }

        // 鰲魚雀替 / 托木 (Carved Aoyu Corbels between column capitals and beams)
        for (const dir of [-1, 1]) {
          const corbel = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.32, 0.18), redDark)
          corbel.position.set(x + dir * 0.38, 4.95, z)
          hall.add(corbel)
        }
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(19.2, 0.44, 0.44), wood)
      beam.position.set(0, 5.12, z)
      beam.castShadow = true
      hall.add(beam)
    }

    // 6. Dou-Gong Bracket System & Entablature Layer (大木作斗栱系統：坐斗、栱、昂層疊挑出)
    // Front and Back entablature walls (額枋基座)
    for (const z of [-6.1, 5.2]) {
      const architrave = new THREE.Mesh(new THREE.BoxGeometry(19.4, 0.65, 0.48), redDark)
      architrave.position.set(0, 5.42, z)
      architrave.castShadow = true
      hall.add(architrave)
    }

    // Front Eave Dou-Gong Clusters (前簷三踩斗栱組，展現中式大木作卡榫工藝)
    for (let x = -8.4; x <= 8.4; x += 1.4) {
      const dougongGroup = new THREE.Group()
      dougongGroup.position.set(x, 5.18, 5.45)
      // 坐斗 (Plinth block)
      const baseBlock = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.34), gold)
      // 橫栱 (Bow bracket arm)
      const bowArm = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.12, 0.22), red)
      bowArm.position.y = 0.12
      // 斜昂 (Cantilever rafter beak)
      const beak = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.58), gold)
      beak.position.set(0, 0.22, 0.16)
      beak.rotation.x = 0.22
      dougongGroup.add(baseBlock, bowArm, beak)
      hall.add(dougongGroup)
    }

    // Left & Right triangular gable walls (兩側山牆三角填補，接合斜屋頂)
    for (const side of [-1, 1]) {
      const gable = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.8, 14.6), redDark)
      gable.position.set(side * 9.2, 5.8, -0.4)
      gable.castShadow = true
      hall.add(gable)
    }

    // 7. Coffered Ceiling & Tiered Octagonal Caisson (殿內平棋天花與中央八角重疊藻井)
    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(18.6, 0.16, 12.8), makeMat('#42281b', 0.85))
    ceiling.position.set(0, 5.15, -0.5)
    ceiling.receiveShadow = true
    hall.add(ceiling)

    // 八角層疊藻井（Octagonal Tiered Caisson）：正殿神龕正上方傘蓋狀層疊內縮天井
    const caisson = new THREE.Group()
    caisson.position.set(0, 5.16, -4.55)

    // Tier 1: Outer Square Caisson Frame (第一層：外方井框枋)
    const cFrame = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.24, 4.6), darkWood)
    caisson.add(cFrame)

    // Tier 2: Transitional Octagon Ring (第二層：八角抹角枋)
    const octRing1 = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.2, 0.28, 8, 1, true), redDark)
    octRing1.position.y = 0.22
    caisson.add(octRing1)

    // Tier 3: Inset Octagon with Gilded Moldings (第三層：內縮八角金漆斗栱層)
    const octRing2 = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.7, 0.32, 8, 1, true), gold)
    octRing2.position.y = 0.48
    caisson.add(octRing2)

    // Tier 4: Celestial Dome & Taiji Boss (第四層：圓井穹頂與金蓮垂花天心)
    const domeTop = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 1.2, 0.28, 16), darkWood)
    domeTop.position.y = 0.72
    caisson.add(domeTop)

    const lotusBoss = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.45, 8), gold)
    lotusBoss.rotation.x = Math.PI // Hanging downward
    lotusBoss.position.y = 0.55
    caisson.add(lotusBoss)

    // Sacred Caisson Amber Halo Light (藻井天心垂照神龕祥和佛光)
    const caissonGlow = new THREE.PointLight('#fff0be', 2.4, 22, 1.4)
    caissonGlow.position.y = 0.35
    caisson.add(caissonGlow)

    hall.add(caisson)

    // Central Grand Hall Ambient Illumination (大殿中央開闊拜殿暖金華燈，全面照亮地面、石柱與壁堵)
    const mainHallCenterLight = new THREE.PointLight('#fff3d6', 2.6, 26, 1.4)
    mainHallCenterLight.position.set(0, 4.4, 0.2)
    hall.add(mainHallCenterLight)

    // Grand Altar Bright Lamp (觀世音菩薩神龕主供桌前明耀壇燈)
    const altarBrightGlow = new THREE.PointLight('#ffe8a8', 2.2, 18, 1.4)
    altarBrightGlow.position.set(0, 3.2, -4.2)
    hall.add(altarBrightGlow)

    // Flanking inner column palace lights (左右兩側走道與側壁暖金宮燈群)
    for (const side of [-1, 1]) {
      const innerAisleGlow = new THREE.PointLight('#ffc87a', 1.8, 16, 1.5)
      innerAisleGlow.position.set(side * 6.2, 3.6, 0.5)
      hall.add(innerAisleGlow)

      const shrineSideGlow = new THREE.PointLight('#ffc070', 1.6, 14, 1.5)
      shrineSideGlow.position.set(side * 5.2, 3.4, -4.8)
      hall.add(shrineSideGlow)
    }

    // Altar Base & Top (三聖同祀啞光黏土暖木神龕供桌：奶油白、蜜桃粉與暖金配色)
    const clayAltarWood = makeMat('#c48f65', 0.9, 0.02)
    const clayAltarTrim = makeMat('#e5b968', 0.85, 0.08)
    const clayCream = makeMat('#f7efe2', 0.94, 0.01)
    const clayPeach = makeMat('#f2b6a6', 0.92, 0.01)

    const altarBase = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.48, 1.9), clayAltarWood)
    altarBase.position.set(0, 0.82, -4.55)
    altarBase.castShadow = true
    altarBase.receiveShadow = true
    hall.add(altarBase)

    // 神桌正面奶油白與暖金雕花裙板
    const altarApron = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.28, 0.06), clayCream)
    altarApron.position.set(0, 1.24, -3.58)
    const altarGoldBand = new THREE.Mesh(new THREE.BoxGeometry(7.35, 0.08, 1.98), clayAltarTrim)
    altarGoldBand.position.set(0, 1.4, -4.55)
    hall.add(altarApron, altarGoldBand)

    for (const x of [-3.3, -1.2, 1.2, 3.3]) for (const z of [-5.2, -3.9]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.25, 0.24), clayAltarWood)
      leg.position.set(x, 0.58, z)
      const footRing = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.28), clayAltarTrim)
      footRing.position.set(x, 0.34, z)
      hall.add(leg, footRing)
    }
    const altarTop = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.24, 2.1), makeMat('#b57d52', 0.88, 0.02))
    altarTop.position.set(0, 1.55, -4.55)
    altarTop.castShadow = true
    altarTop.receiveShadow = true
    hall.add(altarTop)
    this.offeringDisplay.position.set(-2.25, 1.75, -4.55)
    hall.add(this.offeringDisplay)

    // Three-Deity Statue Plinths (三聖同祀神像須彌底座：中央觀世音菩薩、右側龍邊財神爺、左側虎邊月下老人)
    const centerPlinth = new THREE.Mesh(new THREE.BoxGeometry(7.6, 1.56, 2.35), makeMat('#cfa57e', 0.92, 0.02))
    centerPlinth.position.set(0, 0.8, -5.68)
    centerPlinth.castShadow = true
    centerPlinth.receiveShadow = true
    hall.add(centerPlinth)

    const waistPlinth = new THREE.Mesh(new THREE.BoxGeometry(7.72, 0.18, 2.42), clayPeach)
    waistPlinth.position.set(0, 1.22, -5.68)
    hall.add(waistPlinth)

    const topPlinth = new THREE.Mesh(new THREE.BoxGeometry(7.85, 0.22, 2.55), clayAltarTrim)
    topPlinth.position.set(0, 1.71, -5.68)
    hall.add(topPlinth)

    // 1. 中央主祀：溫柔 Q 版啞光黏土觀世音菩薩 (Gentle Chibi Clay Guanyin at Center x = 0)
    const statue = this.createGuanyinStatue()
    this.guanyinRoot = statue
    statue.position.set(0, 1.82, -5.68)
    hall.add(statue)

    // 2. 龍邊陪祀（面對神桌右側）：Q 版啞光黏土財神爺 (Chibi Clay Cai Shen at x = +1.98)
    const caiShenStatue = this.createCaiShenStatue()
    this.caiShenRoot = caiShenStatue
    caiShenStatue.position.set(1.98, 1.82, -5.64)
    hall.add(caiShenStatue)

    // 3. 虎邊陪祀（面對神桌左側）：Q 版啞光黏土月下老人 (Chibi Clay Yue Lao at x = -1.98)
    const yueLaoStatue = this.createYueLaoStatue()
    this.yueLaoRoot = yueLaoStatue
    yueLaoStatue.position.set(-1.98, 1.82, -5.64)
    hall.add(yueLaoStatue)

    // 4. 大殿內部 Q 版啞光黏土微縮場景（奶油白地坪、蜜桃暖金雕花背屏、案上供品、三足香爐、發光圓燈籠、6 座整齊紅拜墊與 1 對 1 跪拜持香信眾）
    this.addMainHallDiorama(hall)

    // Main Hall Signboard (觀世音菩薩匾額)
    const sign = new THREE.Mesh(new THREE.BoxGeometry(6.4, 1.4, 0.25), makeMat('#35251c'))
    sign.position.set(0, 5.05, -0.08)
    hall.add(sign)
    const signText = new THREE.Mesh(new THREE.PlaneGeometry(6.0, 1.08), this.textMaterial('觀 世 音 菩 薩', '#ecd08b', '#35251c'))
    signText.position.set(0, 5.05, 0.065)
    hall.add(signText)

    // Grand Hall Roof (大殿重檐歇山式大屋頂)
    const roof = this.createRoof(20.6, 16.2, 5.35, 8.2)
    roof.position.set(0, 0, -0.3)
    this.roof.add(roof)
    this.roof.position.set(0, 0, this.mainHallZ)
    this.roof.scale.set(this.mainHallScale, this.mainHallScale, this.mainHallScale)
    this.scene.add(this.roof)
    this.addRoofFinial(hall, 0, 8.32)

    // Grand Genshin Liyue Octagonal Palace Lanterns (大殿前階璃月御製八角挑簷長明宮燈)
    // No lantern on the central axis so the statue stays fully visible from the courtyard.
    const lanternRoofWood = makeMat('#2b1916', 0.65, 0.1)
    const silkRed = makeMat('#df3a28', 0.45, 0.1)
    silkRed.emissive.set('#ff7830')
    silkRed.emissiveIntensity = 0.75
    const divineCore = makeMat('#fff5c2', 0.2, 0.1)
    divineCore.emissive.set('#ffa638')
    divineCore.emissiveIntensity = 1.3

    for (const x of [-6.3, -3.2, 3.2, 6.3]) {
      const g = new THREE.Group()
      g.position.set(x, 3.8, -0.4)

      // 1. 懸金吊索與頂部懸環
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.7, 6), gold)
      cord.position.y = 0.85
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.016, 6, 12), gold)
      ring.position.y = 0.52
      ring.rotation.x = Math.PI / 2
      g.add(cord, ring)

      // 2. 雙層金飾挑角飛簷八角頂蓋（Pagoda Roof Cap with Upturned Eaves）
      const roofTop = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.46, 0.18, 8), lanternRoofWood)
      roofTop.position.y = 0.41
      const roofEave = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.38, 0.06, 8), gold)
      roofEave.position.y = 0.3
      g.add(roofTop, roofEave)

      // 3. 八角透光朱紅絹紗燈膽＋金框立柱
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.32, 0.82, 8), silkRed)
      body.position.y = -0.12
      const innerFlame = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.52, 8), divineCore)
      innerFlame.position.y = -0.12
      g.add(body, innerFlame)

      for (let i = 0; i < 8; i++) {
        const ang = (i * Math.PI) / 4
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.84, 4), gold)
        post.position.set(Math.cos(ang) * 0.35, -0.12, Math.sin(ang) * 0.35)
        g.add(post)
      }

      // 4. 八角蓮華雕花托底盤與翡翠圓珠
      const baseTray = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.22, 0.14, 8), gold)
      baseTray.position.y = -0.58
      const bead = new THREE.Mesh(new THREE.DodecahedronGeometry(0.08), makeMat('#3fa878', 0.3, 0.4))
      bead.position.y = -0.68
      g.add(baseTray, bead)

      // 5. 三束飄逸垂墜紅金流蘇
      const tasselMat = makeMat('#d03628', 0.7)
      const centerTassel = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.55, 6), tasselMat)
      centerTassel.position.y = -0.98
      centerTassel.rotation.x = Math.PI
      g.add(centerTassel)
      for (const sideAng of [-0.35, 0.35]) {
        const sideTassel = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.38, 5), tasselMat)
        sideTassel.position.set(Math.sin(sideAng) * 0.14, -0.88, Math.cos(sideAng) * 0.14)
        sideTassel.rotation.x = Math.PI
        sideTassel.rotation.z = sideAng * 0.3
        g.add(sideTassel)
      }

      // 6. 殿前暖金神光
      const glow = new THREE.PointLight('#ffaa48', 1.85, 13, 1.5)
      glow.position.set(0, -0.12, 0)
      g.add(glow)

      hall.add(g)
    }

    // Portal Floor Illumination (大殿中門御門與龍虎二門迎賓暖光)
    for (const x of [-6.75, 0, 6.75]) {
      const portalLight = new THREE.PointLight('#ffc878', 1.6, 11, 1.6)
      portalLight.position.set(x, 3.8, 6.2)
      hall.add(portalLight)
    }
  }

  /**
   * Rear Hall (後殿 / 凌霄寶殿):
   * 全殿最高規格之第二進殿宇，供奉至高無上之玉皇上帝（玄穹高上玉皇大天尊）。
   * 具備 24m 寬 x 16.5m 深之宏偉巨型殿閣台基、丹墀雲龍階、前庭天井過水連廊、
   * 5.6m 寬 x 5.2m 高九龍金釘開闊大宮門、殿內八大通天金龍天柱、九五尊位三級御台、
   * 九龍金椅、九疊金雕龍屏、雙環萬道金光神聖道輪、重簷九龍玉案與雙簷重簷廡殿九脊頂。
   */
  private addRearHall(): void {
    const rear = new THREE.Group()
    this.rearHallGroup = rear
    rear.position.set(0, 0, -25.0)
    this.scene.add(rear)
    const addRearBox = (pos: THREE.Vector3, size: THREE.Vector3) => {
      const collider = this.physics.addStaticBox(pos, size)
      this.rearHallColliders.push({ collider, x: pos.x, y: pos.y, origZ: pos.z })
    }
    const addRearCylinder = (pos: THREE.Vector3, radius: number, height: number) => {
      const collider = this.physics.addStaticCylinder(pos, radius, height)
      this.rearHallColliders.push({ collider, x: pos.x, y: pos.y, origZ: pos.z })
    }

    const red = makeMat(C.vermilion)
    const redDark = makeMat('#792a20', 0.85)
    const wood = makeMat(C.wood)
    const darkWood = makeMat(C.darkWood, 0.88)
    const gold = makeMat(C.gold, 0.48, 0.28)
    const stonePlinth = makeMat('#9e9382', 0.94)
    const balustradeMat = makeMat('#d6cfc2', 0.88)
    const jade = makeMat(C.jade, 0.4, 0.25)

    // 1. Grand Elevated Podium (凌霄寶殿宏偉巨型石台基: 寬 24.0m x 深 16.5m x 高 0.28m，與主殿走廊完全等高平整)
    const podium = new THREE.Mesh(new THREE.BoxGeometry(24.0, 0.28, 16.5), stonePlinth)
    podium.position.set(0, 0.14, 0)
    podium.receiveShadow = true
    rear.add(podium)
    addRearBox(new THREE.Vector3(0, 0.14, -25.0), new THREE.Vector3(24.0, 0.28, 16.5))

    // Courtyard Atrium Stone Paving & Seamless Connecting Covered Walkways (天井與左右連通穿堂迴廊，無障礙平整銜接)
    for (const side of [-1, 1]) {
      // Covered walkway floor connecting Main Hall seamlessly to Rear Hall at y = 0.28m (positioned strictly between halls, no indoor penetration)
      const corridorFloor = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.28, 1.2), stonePlinth)
      corridorFloor.position.set(side * 5.85, 0.14, 8.5)
      corridorFloor.receiveShadow = true
      rear.add(corridorFloor)
      addRearBox(new THREE.Vector3(side * 5.85, 0.14, -16.5), new THREE.Vector3(3.6, 0.28, 1.2))

      // Walkway Pillars placed on outer edges in the courtyard (立柱位於天井通道外側，通道中央寬敞通暢，不侵入大殿)
      const cPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 4.4, 10), red)
      cPillar.position.set(side * 7.6, 2.2, 8.8)
      rear.add(cPillar)
      addRearCylinder(new THREE.Vector3(side * 7.6, 2.2, 8.8 - 25.0), 0.22, 4.4)

      // Notice: Main Hall roof (depth 21.87m, extending back past z = -18.2m) and Rear Hall roof (reaching z = -15.75m)
      // already span and overlap seamlessly by over 2.4m above the walkway, so no intermediate miniature roof is needed
      // (preventing any indoor roof eaves from obstructing deity sightlines).

      // Walkway warm ceiling lantern (穿堂連通迴廊原神璃月六角挑簷長明宮燈)
      const corrLantern = new THREE.Group()
      corrLantern.position.set(side * 5.85, 3.6, 8.5)
      const corrCord = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.45, 4), gold)
      corrCord.position.y = 0.32
      const corrCap = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.32, 0.14, 6), gold)
      corrCap.position.y = 0.12
      const corrBodyMat = makeMat('#e24630', 0.45)
      corrBodyMat.emissive.set('#ff8035')
      corrBodyMat.emissiveIntensity = 0.8
      const corrBody = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 0.48, 6), corrBodyMat)
      corrBody.position.y = -0.16
      const corrBase = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.14, 0.1, 6), gold)
      corrBase.position.y = -0.44
      const corrTassel = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.38, 5), makeMat('#d03628', 0.7))
      corrTassel.position.y = -0.66
      corrTassel.rotation.x = Math.PI
      corrLantern.add(corrCord, corrCap, corrBody, corrBase, corrTassel)
      rear.add(corrLantern)

      const corrLight = new THREE.PointLight('#ffbf66', 1.8, 12, 1.5)
      corrLight.position.set(side * 5.85, 3.4, 8.5)
      rear.add(corrLight)
    }

    // 2. Approach Steps & Imperial Dragon Ramp (登殿大階梯、中央雲龍陛與兩側望柱欄杆)
    // Central Imperial Dragon Ramp (中央丹墀雲龍陛)
    const dragonRamp = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 1.6), makeMat('#5f7169', 0.88, 0.15))
    dragonRamp.position.set(0, 0.18, 8.8)
    dragonRamp.rotation.x = -0.18
    dragonRamp.receiveShadow = true
    rear.add(dragonRamp)
    const dragonRelief = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 1.3),
      this.textMaterial('丹 墀 雲 龍 陛', '#dfc47b', '#35433d')
    )
    dragonRelief.position.set(0, 0.24, 8.8)
    dragonRelief.rotation.x = -Math.PI / 2 + 0.18
    rear.add(dragonRelief)

    // Front 2-Tier Grand Stone Steps (前庭登殿雙級石階，步高僅 0.14m，行者輕鬆邁步登殿)
    const step1 = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.14, 0.8), stonePlinth)
    step1.position.set(0, 0.07, 8.65)
    step1.receiveShadow = true
    rear.add(step1)
    addRearBox(new THREE.Vector3(0, 0.07, -16.35), new THREE.Vector3(9.2, 0.14, 0.8))

    const step2 = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.14, 0.6), stonePlinth)
    step2.position.set(0, 0.21, 8.1)
    step2.receiveShadow = true
    rear.add(step2)
    addRearBox(new THREE.Vector3(0, 0.21, -16.9), new THREE.Vector3(8.6, 0.14, 0.6))

    // White Stone Balustrade (僅配置於外側端緣，通道完全暢通無阻)
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.56, 0.16), balustradeMat)
      rail.position.set(side * 10.0, 0.55, 8.1)
      rear.add(rail)
      for (let x = 8.5; x <= 11.5; x += 1.5) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.82, 0.22), balustradeMat)
        post.position.set(side * x, 0.62, 8.1)
        const lotusBud = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), balustradeMat)
        lotusBud.position.set(side * x, 1.08, 8.1)
        lotusBud.scale.set(0.9, 1.3, 0.9)
        rear.add(post, lotusBud)
      }
    }

    // 3. Grand Front Facade & Majestic Imperial Triple Doors (宏偉三川殿廓、6.4m 極度寬敞大御門暢行無阻)
    const frontZ = 6.2
    // Front eave six grand pillars (前簷六大金柱，中門淨寬達 6.4 公尺)
    for (const x of [-10.5, -6.8, -3.2, 3.2, 6.8, 10.5]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.52, 6.4, 14), red)
      col.position.set(x, 3.2, frontZ)
      col.castShadow = true
      rear.add(col)
      addRearCylinder(new THREE.Vector3(x, 3.2, frontZ - 25.0), 0.44, 6.4)
      const colCap = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.22, 14), gold)
      colCap.position.set(x, 6.3, frontZ)
      rear.add(colCap)
    }

    // Front architrave beam (前簷大通梁)
    const frontBeam = new THREE.Mesh(new THREE.BoxGeometry(23.2, 0.62, 0.55), wood)
    frontBeam.position.set(0, 6.45, frontZ)
    rear.add(frontBeam)

    // Central Grand Open Palace Portal (中央大敞御門，中央 6.4m 通透門洞，人物可自由暢行進出)
    for (const side of [-1, 1]) {
      const wallPanel = new THREE.Mesh(new THREE.BoxGeometry(6.8, 5.2, 0.4), darkWood)
      wallPanel.position.set(side * 7.8, 2.86, frontZ)
      wallPanel.castShadow = true
      rear.add(wallPanel)
      addRearBox(new THREE.Vector3(side * 7.8, 2.86, frontZ - 25.0), new THREE.Vector3(6.8, 5.2, 0.4))

      // Carved Gilded Window Screen (金雕花鳥連雲格扇窗)
      const windowScreen = new THREE.Mesh(
        new THREE.PlaneGeometry(3.6, 2.4),
        this.textMaterial('五 福 臨 門', '#dfc17c', '#3e2417')
      )
      windowScreen.position.set(side * 7.4, 3.1, frontZ + 0.22)
      rear.add(windowScreen)

      // Grand Double Palace Doors (九龍殿大御門與天宮護法門神：王靈官、馬天君)
      const doorLeaf = new THREE.Group()
      doorLeaf.position.set(side * 3.2, 2.66, frontZ)
      const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(2.3, 4.8, 0.12), makeMat('#8c261b', 0.72))
      doorMesh.position.set(side * -1.15, 0, 0)
      doorMesh.castShadow = true
      doorLeaf.add(doorMesh)

      // 天宮護法門神彩繪板（龍邊 +X：都天靈官・王靈官，虎邊 -X：華光天王・馬天君）
      const godMat = this.doorGodMaterial(side === 1 ? 'wang' : 'ma')
      const godPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 4.5), godMat)
      godPlane.position.set(side * -1.15, 0, 0.065)
      doorLeaf.add(godPlane)

      // Golden Door Studs (金釘 - 鑲嵌於大御門外側邊緣飾帶)
      for (let r = -1.8; r <= 1.8; r += 0.9) {
        for (const c of [-2.18, -0.12]) {
          const stud = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), gold)
          stud.position.set(side * c, r, 0.08)
          doorLeaf.add(stud)
        }
      }
      // Golden Ring Handle (金鋪首銜環)
      const knocker = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.035, 8, 16), gold)
      knocker.position.set(side * -0.42, 0, 0.09)
      doorLeaf.add(knocker)

      // 朝向殿內靠兩側敞開約 43 度（保留中央 3.06m 宏偉走道，信眾暢行瞻仰玉皇上帝）
      doorLeaf.rotation.y = -side * 0.76
      rear.add(doorLeaf)
    }

    // Door Portal Top Lintel (中門高聳額枋與斗栱組)
    const portalLintel = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.9, 0.5), redDark)
    portalLintel.position.set(0, 5.5, frontZ)
    rear.add(portalLintel)

    // 4. Grand Palace Plaque: 「凌 霄 寶 殿」 (二層重簷金字主匾，高懸於重簷歇山頂正中央明樓額枋，氣勢恢宏且絕不遮蔽神佛視線)
    const plaqueBacking = new THREE.Mesh(new THREE.BoxGeometry(7.2, 1.9, 0.3), darkWood)
    plaqueBacking.position.set(0, 7.6, frontZ + 0.28)
    rear.add(plaqueBacking)
    const plaqueFrame = new THREE.Mesh(new THREE.BoxGeometry(6.6, 1.6, 0.22), darkWood)
    plaqueFrame.position.set(0, 7.6, frontZ + 0.44)
    rear.add(plaqueFrame)
    const plaqueGoldBorder = new THREE.Mesh(new THREE.BoxGeometry(6.3, 1.35, 0.24), gold)
    plaqueGoldBorder.position.set(0, 7.6, frontZ + 0.46)
    rear.add(plaqueGoldBorder)
    const plaqueText = new THREE.Mesh(
      new THREE.PlaneGeometry(6.0, 1.15),
      this.textMaterial('凌  霄  寶  殿', '#fced9c', '#200f08')
    )
    plaqueText.position.set(0, 7.6, frontZ + 0.58)
    rear.add(plaqueText)

    // Front Dou-Gong Bracket Clusters (前簷斗栱組)
    for (let x = -10.2; x <= 10.2; x += 1.7) {
      const dg = new THREE.Group()
      dg.position.set(x, 6.2, frontZ + 0.28)
      const baseBlock = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.18, 0.38), gold)
      const bowArm = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.14, 0.26), red)
      bowArm.position.y = 0.14
      dg.add(baseBlock, bowArm)
      rear.add(dg)
    }

    // 5. Solid Rear & Side Boundary Walls (後殿厚重殿牆，寬 23.2m x 高 6.8m)
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(23.2, 6.8, 0.65), makeMat('#543b2f'))
    backWall.position.set(0, 3.4, -7.8)
    backWall.castShadow = true
    rear.add(backWall)
    addRearBox(new THREE.Vector3(0, 3.4, -32.8), new THREE.Vector3(23.2, 6.8, 0.65))

    for (const side of [-1, 1]) {
      const sx = side * 11.6
      const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.65, 6.8, 14.5), darkWood)
      sideWall.position.set(sx, 3.4, -0.65)
      sideWall.castShadow = true
      rear.add(sideWall)
      addRearBox(new THREE.Vector3(sx, 3.4, -25.65), new THREE.Vector3(0.65, 6.8, 14.5))
    }

    // 6. Inner Imperial Pillars (殿內四大通天金柱與金龍盤繞)
    for (const x of [-6.2, 6.2]) {
      for (const z of [2.2, -3.2]) {
        const inCol = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.52, 6.4, 14), red)
        inCol.position.set(x, 3.2, z)
        inCol.castShadow = true
        rear.add(inCol)
        addRearCylinder(new THREE.Vector3(x, 3.2, z - 25.0), 0.46, 6.4)
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.2, 14), gold)
        cap.position.set(x, 6.3, z)
        rear.add(cap)

        // Golden Dragon Ring & Cloud Ornament (金龍盤柱意象)
        for (let h = 1.5; h <= 4.8; h += 1.5) {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.06, 8, 16), gold)
          ring.rotation.x = Math.PI / 2
          ring.position.set(x, h, z)
          rear.add(ring)
        }
      }
    }

    // 7. Sacred Imperial Dais & Golden Throne of 玉皇上帝 (九五尊位三級御台與九龍金椅)
    const throneZ = -5.4
    // 3-Tier Imperial Dais (九五至尊御台)
    const dais1 = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.32, 4.8), stonePlinth)
    dais1.position.set(0, 0.42, throneZ)
    const dais2 = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.28, 3.8), darkWood)
    dais2.position.set(0, 0.72, throneZ - 0.2)
    const dais3 = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.24, 2.8), makeMat('#9a2b1f', 0.65))
    dais3.position.set(0, 0.98, throneZ - 0.4)
    rear.add(dais1, dais2, dais3)

    // Nine-Dragon Imperial Screen (九龍金雕九五屏風)
    const screen = new THREE.Mesh(new THREE.BoxGeometry(8.4, 4.8, 0.35), darkWood)
    screen.position.set(0, 3.2, throneZ - 1.8)
    rear.add(screen)
    const screenCenter = new THREE.Mesh(
      new THREE.PlaneGeometry(7.8, 4.2),
      this.textMaterial('玄 穹 高 上 玉 皇 大 天 尊', '#f5d588', '#26140d')
    )
    screenCenter.position.set(0, 3.2, throneZ - 1.6)
    rear.add(screenCenter)

    // Golden Dragon Throne (九龍至尊金椅)
    const throneSeat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.65, 1.4), gold)
    throneSeat.position.set(0, 1.35, throneZ - 0.6)
    const throneBack = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.8, 0.25), gold)
    throneBack.position.set(0, 2.3, throneZ - 1.25)
    for (const side of [-1, 1]) {
      const armrest = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.55, 1.3), gold)
      armrest.position.set(side * 1.05, 1.75, throneZ - 0.6)
      rear.add(armrest)
    }
    rear.add(throneSeat, throneBack)

    // 7.1. Sacred Golden Body of 玉皇上帝 (玄穹高上玉皇大天尊金身聖相)
    const statueGroup = new THREE.Group()
    statueGroup.position.set(0, 1.66, throneZ - 0.52)

    const statueH = 2.68
    const statueW = statueH * (670 / 1079) // 1.664m
    const statueGeo = new THREE.PlaneGeometry(statueW, statueH)
    const statueMat = new THREE.MeshStandardMaterial({
      transparent: true,
      alphaTest: 0.05,
      roughness: 0.65,
      metalness: 0.0,
      side: THREE.DoubleSide,
    })

    const yuhuangLoader = new THREE.TextureLoader()
    const applyYuhuangTex = (tex: THREE.Texture) => {
      tex.colorSpace = THREE.SRGBColorSpace
      statueMat.map = tex
      statueMat.needsUpdate = true
    }
    yuhuangLoader.load('./assets/yuhuang.webp', applyYuhuangTex)

    const yuhuangMesh = new THREE.Mesh(statueGeo, statueMat)
    yuhuangMesh.position.set(0, statueH / 2, 0)
    yuhuangMesh.castShadow = true
    statueGroup.add(yuhuangMesh)

    rear.add(statueGroup)

    // Sacred Golden Mandorla & Divine Halo (金光萬道神聖光輪)
    const haloOuter = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.14, 12, 36), gold)
    haloOuter.position.set(0, 3.8, throneZ - 1.45)
    const haloInner = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.1, 12, 28), gold)
    haloInner.position.set(0, 3.8, throneZ - 1.45)
    const haloRay = new THREE.Mesh(new THREE.CircleGeometry(2.1, 32), this.textMaterial('萬 聖 尊 崇', '#f6dc9c', '#4a2d14'))
    haloRay.position.set(0, 3.8, throneZ - 1.48)
    rear.add(haloOuter, haloInner, haloRay)

    // Divine Radiance Light (玉皇上帝御座神聖金光)
    const rearLight = new THREE.PointLight('#fff3c4', 2.6, 28, 1.4)
    rearLight.position.set(0, 4.6, throneZ + 1.2)
    rear.add(rearLight)

    // Central Lingxiao Palace Grand Illumination (凌霄寶殿中央天心萬聖金光華燈，廣布大殿前堂)
    const rearCenterLight = new THREE.PointLight('#fff4d6', 2.8, 28, 1.4)
    rearCenterLight.position.set(0, 5.2, 1.5)
    rear.add(rearCenterLight)

    // Flanking imperial column lanterns (後殿金柱原神璃月祥雲托架護持宮燈群)
    for (const side of [-1, 1]) {
      for (const z of [1.5, -4.5]) {
        const sconce = new THREE.Group()
        sconce.position.set(side * 7.5, 4.2, z)
        // 祥雲托架金臂
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 0.08), gold)
        arm.position.x = -side * 0.22
        // 托架宮燈本體
        const sconceCap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.22, 0.1, 6), gold)
        sconceCap.position.set(-side * 0.42, 0.18, 0)
        const sconceMat = makeMat('#e2442e', 0.4)
        sconceMat.emissive.set('#ff7830')
        sconceMat.emissiveIntensity = 0.85
        const sconceBody = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 0.36, 6), sconceMat)
        sconceBody.position.set(-side * 0.42, 0, 0)
        const sconceBase = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.1, 0.08, 6), gold)
        sconceBase.position.set(-side * 0.42, -0.21, 0)
        const sconceTassel = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.28, 5), makeMat('#d03628', 0.7))
        sconceTassel.position.set(-side * 0.42, -0.38, 0)
        sconceTassel.rotation.x = Math.PI
        sconce.add(arm, sconceCap, sconceBody, sconceBase, sconceTassel)
        rear.add(sconce)
      }

      const colGlow = new THREE.PointLight('#ffca75', 1.8, 18, 1.5)
      colGlow.position.set(side * 7.5, 4.2, 1.5)
      rear.add(colGlow)

      const throneColGlow = new THREE.PointLight('#ffd280', 1.8, 18, 1.5)
      throneColGlow.position.set(side * 7.5, 4.2, -4.5)
      rear.add(throneColGlow)
    }

    // 8. Jade Imperial Offering Table (重簷九龍玉案供桌)
    const altarZ = -2.2
    const jadeAltar = new THREE.Mesh(new THREE.BoxGeometry(7.8, 1.25, 2.4), jade)
    jadeAltar.position.set(0, 0.88, altarZ)
    jadeAltar.castShadow = true
    jadeAltar.receiveShadow = true
    rear.add(jadeAltar)
    addRearBox(new THREE.Vector3(0, 0.88, altarZ - 25.0), new THREE.Vector3(7.8, 1.25, 2.4))

    // Altar ritual props (大金香爐、雙燭台)
    const goldCenser = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.6, 16), gold)
    goldCenser.position.set(0, 1.78, altarZ)
    rear.add(goldCenser)
    for (const side of [-1.8, 1.8]) {
      const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 0.85, 10), makeMat(C.vermilion))
      candle.position.set(side, 1.88, altarZ)
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), new THREE.MeshBasicMaterial({ color: '#ffb347' }))
      flame.position.set(side, 2.38, altarZ)
      rear.add(candle, flame)
    }

    // 9. Coffered Ceiling & Celestial Caisson (殿內平棋天花與中央八角九天星漢藻井)
    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(22.6, 0.2, 14.8), makeMat('#42281b', 0.85))
    ceiling.position.set(0, 6.45, -0.65)
    ceiling.receiveShadow = true
    rear.add(ceiling)

    // Center Celestial Caisson (中央星漢八角重疊藻井)
    const caisson = new THREE.Group()
    caisson.position.set(0, 6.46, -0.5)
    const caissonOuter = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.32, 5.6), darkWood)
    const caissonRing1 = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 0.35, 8, 1, true), redDark)
    caissonRing1.position.y = 0.25
    const caissonRing2 = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.0, 0.38, 8, 1, true), gold)
    caissonRing2.position.y = 0.55
    const caissonBoss = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.6, 8), gold)
    caissonBoss.rotation.x = Math.PI
    caissonBoss.position.y = 0.65
    const caissonLight = new THREE.PointLight('#ffeaa8', 2.4, 22, 1.4)
    caissonLight.position.y = 0.45
    caisson.add(caissonOuter, caissonRing1, caissonRing2, caissonBoss, caissonLight)
    rear.add(caisson)

    // 10. Double-Eave Sweeping Imperial Roof (後殿重簷廡殿九脊頂: 下簷 26.8m x 16.4m, 上簷 20.8m x 12.8m, 精準居中於殿體 z = -0.65)
    const lowerRoof = this.createRoof(26.8, 16.4, 6.6, 8.8)
    lowerRoof.position.set(0, 0, -25.65)
    const upperRoof = this.createRoof(20.8, 12.8, 8.6, 11.5)
    upperRoof.position.set(0, 0, -25.65)
    this.rearRoof.add(lowerRoof, upperRoof)
    this.scene.add(this.rearRoof)
  }

  /**
   * Drum Tower (鼓樓 / 暮鼓亭):
   * 與右側鐘樓對稱配置於西側（虎方），遵循「左鐘右鼓」古制。
   * 內置傳統大朱漆法鼓（大太鼓）、八卦太極彩繪鼓皮、鼓槌與專屬歇山瓦頂亭閣。
   */
  private addDrumTower(): void {
    const red = makeMat(C.vermilion)
    const wood = makeMat(C.wood)
    const darkWood = makeMat(C.darkWood)
    const gold = makeMat(C.gold, 0.42, 0.36)
    const dx = -15.2
    const dz = -8

    // 1. Drum Pavilion Stone Base & Pillars (鼓樓石基座與立柱)
    const drumBase = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.4, 2.4), makeMat('#a58d69'))
    drumBase.position.set(dx, 0.2, dz)
    this.leftSideGroup.add(drumBase)
    for (const x of [-16.15, -14.25]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.21, 4.1, 9), red)
      pillar.position.set(x, 2.1, dz)
      this.leftSideGroup.add(pillar)
      const col = this.physics.addStaticCylinder(new THREE.Vector3(x, 2.05, dz), 0.18, 4.1)
      this.sideColliders.push({ collider: col, origX: x, y: 2.05, z: dz, isLeft: true })
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.24, 0.25), wood)
    lintel.position.set(dx, 4.1, dz)
    this.leftSideGroup.add(lintel)

    // 2. Ceremonial Great Drum & Stand (大太鼓與雕花鼓架)
    this.drum.position.set(dx, 2.8, dz)

    // Trestle stand (鼓架)
    const standLeg1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.6, 1.4), darkWood)
    standLeg1.position.set(-0.55, -0.6, 0)
    const standLeg2 = standLeg1.clone()
    standLeg2.position.set(0.55, -0.6, 0)
    this.drum.add(standLeg1, standLeg2)

    // Drum Barrel (朱漆桶狀鼓身，旋轉90度橫臥)
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, 0.95, 20), makeMat('#8b261b', 0.68))
    barrel.rotation.z = Math.PI / 2
    this.drum.add(barrel)

    // Gold Bronze Drum Rivets (兩側金色鼓釘環)
    for (const side of [-0.46, 0.46]) {
      const rivetRing = new THREE.Mesh(new THREE.TorusGeometry(0.69, 0.035, 8, 20), gold)
      rivetRing.rotation.y = Math.PI / 2
      rivetRing.position.x = side
      this.drum.add(rivetRing)
    }

    // Drumheads (兩端牛皮鼓面與八卦太極彩繪意象)
    for (const side of [-0.48, 0.48]) {
      const skin = new THREE.Mesh(new THREE.CylinderGeometry(0.67, 0.67, 0.04, 20), makeMat('#e2d5bd', 0.9))
      skin.rotation.z = Math.PI / 2
      skin.position.x = side
      this.drum.add(skin)
      const taiji = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.045, 12), gold)
      taiji.rotation.z = Math.PI / 2
      taiji.position.x = side
      this.drum.add(taiji)
    }

    // Drumsticks (鼓架旁雙置鼓槌)
    const stick1 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.75, 8), makeMat('#b9996b'))
    stick1.position.set(0.65, 0.1, 0.35)
    stick1.rotation.z = -0.4
    const stick2 = stick1.clone()
    stick2.position.set(0.65, 0.1, -0.35)
    stick2.rotation.z = 0.4
    this.drum.add(stick1, stick2)

    this.leftSideGroup.add(this.drum)

    // 3. Pavilion Roof (鼓樓飛簷瓦頂)
    const drumRoof = this.createRoof(4.2, 3.5, 4.1, 5.4)
    drumRoof.position.set(dx, 0, dz)
    this.leftSideGroup.add(drumRoof)
  }

  private addSideArchitecture(): void {
    const sideMat = makeMat('#6c5140')
    const darkWood = makeMat(C.darkWood, 0.88)
    for (const x of [-13.4, 13.4]) {
      const isLeft = x < 0
      const group = isLeft ? this.leftSideGroup : this.rightSideGroup
      const base = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.22, 16.8), makeMat('#9d8a70'))
      base.position.set(x, 0.12, -2.7)
      base.receiveShadow = true
      group.add(base)

      // Solid outer boundary wall for the side corridors (廂房外側厚實封閉牆，不再鏤空漏光)
      const outerX = isLeft ? x - 2.4 : x + 2.4
      const outerWall = new THREE.Mesh(new THREE.BoxGeometry(0.42, 3.8, 16.8), darkWood)
      outerWall.position.set(outerX, 1.9, -2.7)
      outerWall.castShadow = true
      outerWall.receiveShadow = true
      group.add(outerWall)
      const wallCol = this.physics.addStaticBox(new THREE.Vector3(outerX, 1.9, -2.7), new THREE.Vector3(0.42, 3.8, 16.8))
      this.sideColliders.push({ collider: wallCol, origX: outerX, y: 1.9, z: -2.7, isLeft })

      for (const z of [-9.3, -4, 1.2]) {
        const column = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 3.35, 10), makeMat(C.wood))
        column.position.set(x, 1.72, z)
        column.castShadow = true
        group.add(column)
        const col = this.physics.addStaticCylinder(new THREE.Vector3(x, 1.72, z), 0.27, 3.35)
        this.sideColliders.push({ collider: col, origX: x, y: 1.72, z, isLeft })
      }
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(4.9, 0.38, 0.45), sideMat)
      lintel.position.set(x, 3.48, -4)
      group.add(lintel)

      // Corridor Ceiling (廂房實體吊頂)
      const corridorCeiling = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.12, 16.4), makeMat('#3c271d'))
      corridorCeiling.position.set(x, 3.38, -2.7)
      corridorCeiling.receiveShadow = true
      group.add(corridorCeiling)

      const roof = this.createRoof(5.6, 17.2, 3.3, 5.0)
      roof.position.set(x, 0, -3.7)
      group.add(roof)
    }
    this.scene.add(this.leftSideGroup, this.rightSideGroup)
    for (let x = -6; x <= 6; x += 3) {
      const paving = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.04, 1.15), makeMat('#a59479', 0.93))
      paving.position.set(x, 0.035, 9.2)
      this.rearHallGroup.add(paving)
    }
  }

  private addRitualProps(): void {
    const bronze = makeMat('#80623c', 0.38, 0.52)
    const gold = makeMat(C.gold, 0.42, 0.36)
    const red = makeMat(C.vermilion)
    const wood = makeMat(C.darkWood)

    // Main incense urn and three slender sticks.
    const urn = new THREE.Group()
    this.outdoorUrn = urn
    const stepsFrontEdge = this.mainHallZ + 7.9 * this.mainHallScale
    const urnZ = Math.max(0.4, stepsFrontEdge + 3.0)
    urn.position.set(0, 0, urnZ)
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.83, 0.65, 0.72, 12), bronze)
    bowl.position.y = 0.6
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.79, 0.09, 8, 20), gold)
    rim.rotation.x = Math.PI / 2
    rim.position.y = 0.98
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.53, 0.62, 0.25, 12), bronze)
    foot.position.y = 0.12
    urn.add(bowl, rim, foot)
    for (const x of [-0.18, 0, 0.18]) {
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 1.22, 6), makeMat('#c89154'))
      stick.position.set(x, 1.72, 0)
      urn.add(stick)
      const ember = new THREE.Mesh(new THREE.SphereGeometry(0.052, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffb45f' }))
      ember.position.set(x, 2.35, 0)
      urn.add(ember)
    }
    this.scene.add(urn)
    this.outdoorUrnCollider = this.physics.addStaticCylinder(new THREE.Vector3(0, 0.55, urnZ), 0.52, 1.1)

    // 原神璃月風格七星蓮華祈願長明神燈（平安燈、財神燈、文昌燈）
    this.lamps.forEach((lamp, i) => {
      // 1. 雕花八角紅木與金飾神龕基座
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.8, 0.38, 8), wood)
      stand.position.set(lamp.position.x, 0.19, lamp.position.z)
      const standTrim = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.72, 0.08, 8), gold)
      standTrim.position.y = 0.38
      this.scene.add(stand, standTrim)

      // 2. 仰覆蓮華承托金盤（Lotus Petal Pedestal）
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.42, 0.22, 8), gold)
      base.position.set(lamp.position.x, 0.53, lamp.position.z)
      this.scene.add(base)

      // 3. 原神靈氣結晶／絹紗八面長明燈身
      const baseCol = [C.vermilion, '#e59500', '#258880'][i]
      const bodyMat = makeMat(baseCol, 0.4, 0.1)
      bodyMat.emissive.set('#280a06')
      bodyMat.emissiveIntensity = 0.12
      this.lampMats.set(lamp.id, bodyMat)

      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.36, 0.95, 8), bodyMat)
      body.position.set(lamp.position.x, 1.12, lamp.position.z)
      body.castShadow = true
      this.scene.add(body)

      // 八方金雕立柱護框
      for (let k = 0; k < 8; k++) {
        const ang = (k * Math.PI) / 4
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.98, 4), gold)
        post.position.set(lamp.position.x + Math.cos(ang) * 0.41, 1.12, lamp.position.z + Math.sin(ang) * 0.41)
        this.scene.add(post)
      }

      // 4. 飛簷挑角金頂八角寶蓋（Pagoda Roof Cap & Jewel Finial）
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.56, 0.26, 8), gold)
      top.position.set(lamp.position.x, 1.73, lamp.position.z)
      const finial = new THREE.Mesh(new THREE.DodecahedronGeometry(0.12), gold)
      finial.position.set(lamp.position.x, 1.96, lamp.position.z)
      const spire = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 8), gold)
      spire.position.set(lamp.position.x, 2.15, lamp.position.z)
      this.scene.add(top, finial, spire)

      // 5. 垂墜蓮華吊穗
      const tasselMat = makeMat('#d03628', 0.7)
      for (const ang of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
        const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 5), tasselMat)
        tassel.position.set(lamp.position.x + Math.cos(ang) * 0.48, 1.5, lamp.position.z + Math.sin(ang) * 0.48)
        tassel.rotation.x = Math.PI
        this.scene.add(tassel)
      }

      // 6. 神火仙光
      const lampCol = ['#ff9e3b', '#ffd242', '#4ae2d8'][i]
      const light = new THREE.PointLight(lampCol, 0.2, 6.5, 2)
      light.position.set(lamp.position.x, 1.25, lamp.position.z)
      this.scene.add(light)
      this.lampLights.set(lamp.id, light)

      // 7. 金雕名籤牌
      const label = new THREE.Mesh(new THREE.PlaneGeometry(1.18, 0.32), this.textMaterial(['平安燈', '財神燈', '文昌燈'][i], '#f4d88f', '#40271d'))
      label.position.set(lamp.position.x, 0.46, lamp.position.z + 0.76)
      this.scene.add(label)
    })

    // Daily fortune lot box and numbered sticks.
    const lotTable = new THREE.Group()
    lotTable.position.set(-12, 0, 1.2)
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.8, 1.5), red)
    box.position.y = 1.05
    const boxTop = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.2, 1.8), gold)
    boxTop.position.y = 2.0
    lotTable.add(box, boxTop)
    const opening = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.08, 0.16), makeMat('#241c18'))
    opening.position.set(0, 2.12, 0)
    lotTable.add(opening)
    for (let i = -2; i <= 2; i += 1) {
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.1 + Math.abs(i) * 0.06, 5), makeMat('#d0b277'))
      stick.position.set(i * 0.19, 2.45 + Math.abs(i) * 0.03, 0)
      stick.rotation.z = i * 0.04
      lotTable.add(stick)
    }
    this.scene.add(lotTable)
    this.physics.addStaticBox(new THREE.Vector3(-12, 1.05, 1.2), new THREE.Vector3(1.55, 2, 1.55))

    // Wooden fish on a small stand.
    const fishStand = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.42, 1.35), wood)
    fishStand.position.set(8.5, 0.52, -8.5)
    this.scene.add(fishStand)
    const fish = new THREE.Mesh(new THREE.SphereGeometry(0.72, 18, 12), makeMat('#7a3a28', 0.48))
    fish.scale.set(1.35, 0.72, 0.62)
    fish.position.set(8.5, 1.18, -8.5)
    this.woodfish.add(fish)
    const fishEye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), gold)
    fishEye.position.set(7.93, 1.3, -8.92)
    this.woodfish.add(fishEye)
    this.scene.add(this.woodfish)
    const mallet = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.72, 8), makeMat('#b9996b'))
    mallet.position.set(9.2, 1.32, -8.5)
    mallet.rotation.z = -0.6
    this.woodfish.add(mallet)

    // Bell pavilion.
    const bellBase = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.4, 2.4), makeMat('#a58d69'))
    bellBase.position.set(15.2, 0.2, -8)
    this.rightSideGroup.add(bellBase)
    for (const x of [14.25, 16.15]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.21, 4.1, 9), red)
      pillar.position.set(x, 2.1, -8)
      this.rightSideGroup.add(pillar)
      const col = this.physics.addStaticCylinder(new THREE.Vector3(x, 2.05, -8), 0.18, 4.1)
      this.sideColliders.push({ collider: col, origX: x, y: 2.05, z: -8, isLeft: false })
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.24, 0.25), wood)
    lintel.position.set(15.2, 4.1, -8)
    this.rightSideGroup.add(lintel)
    const bellBody = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.58, 1.15, 12, 1, true), bronze)
    bellBody.position.set(15.2, 3.25, -8)
    this.bell.add(bellBody)
    const bellLip = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.07, 8, 18), gold)
    bellLip.rotation.x = Math.PI / 2
    bellLip.position.set(15.2, 2.7, -8)
    this.bell.add(bellLip)
    const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), gold)
    clapper.position.set(15.2, 2.5, -8)
    this.bell.add(clapper)
    this.rightSideGroup.add(this.bell)
    const bellRoof = this.createRoof(4.2, 3.5, 4.1, 5.4)
    bellRoof.position.set(15.2, 0, -8)
    this.rightSideGroup.add(bellRoof)

    // Small memory kiosk for local prayer records.
    const recordStand = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.65, 0.36), makeMat('#684636'))
    recordStand.position.set(17.2, 0.96, 0.2)
    recordStand.rotation.y = -Math.PI / 2
    this.scene.add(recordStand)
    const recordFace = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.1), this.textMaterial('祈 福 紀 錄', '#ead296', '#493024'))
    recordFace.position.set(16.98, 1.03, 0.2)
    recordFace.rotation.y = -Math.PI / 2
    this.scene.add(recordFace)

    this.physics.addStaticBox(new THREE.Vector3(8.5, 0.5, -8.5), new THREE.Vector3(1.8, 1, 1.35))
    const bellBoxCollider = this.physics.addStaticBox(new THREE.Vector3(15.2, 0.6, -8), new THREE.Vector3(2.4, 1.2, 2.2))
    this.sideColliders.push({ collider: bellBoxCollider, origX: 15.2, y: 0.6, z: -8, isLeft: false })
    this.physics.addStaticBox(new THREE.Vector3(17.2, 0.9, 0.2), new THREE.Vector3(0.4, 1.7, 2.2))
    for (const lamp of this.lamps) this.physics.addStaticBox(new THREE.Vector3(lamp.position.x, 1, lamp.position.z), new THREE.Vector3(1.3, 2, 1.3))
  }

  /** Right-side, walkable portal to the separate MarketWorld. It intentionally has no blocking collider through its opening. */
  private addMarketPortal(): void {
    const group = new THREE.Group()
    group.position.set(23.8, 0, 14.2)
    const stone = makeMat('#4d466e', 0.7, 0.08)
    stone.emissive.set('#171936')
    stone.emissiveIntensity = 0.18
    const gold = makeMat('#d2a95c', 0.36, 0.4)
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.42, 3.7, 0.54), stone)
    left.position.set(-2.05, 1.85, 0)
    const right = left.clone()
    right.position.x = 2.05
    const arch = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.21, 10, 32, Math.PI), stone)
    arch.rotation.z = Math.PI / 2
    arch.position.y = 2.05
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 0.62), this.textMaterial('靈 光 時 空 門', '#f3c57a', '#33294e'))
    plaque.position.set(0, 3.58, 0.3)
    const core = new THREE.Mesh(new THREE.CircleGeometry(1.3, 36), new THREE.MeshBasicMaterial({ color: '#7fb7ad', transparent: true, opacity: 0.34, side: THREE.DoubleSide, depthWrite: false }))
    core.position.set(0, 1.62, 0.05)
    const swirl = new THREE.Group()
    for (let i = 0; i < 2; i += 1) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.93 + i * 0.2, 0.035, 6, 30), new THREE.MeshBasicMaterial({ color: i ? '#f3c57a' : '#f5a7c0', transparent: true, opacity: 0.76 }))
      ring.position.set(0, 1.62, 0.11 + i * 0.02)
      swirl.add(ring)
    }
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), gold)
    lantern.position.set(0, 3.12, 0.18)
    group.add(left, right, arch, plaque, core, swirl, lantern)
    this.marketPortalSwirl = swirl
    this.scene.add(group)
  }

  /** Left-side, walkable portal to Moonlit Forest & Unicorn Sanctuary. */
  private addUnicornPortal(): void {
    const group = new THREE.Group()
    group.position.set(-23.8, 0, 14.2)
    const stone = makeMat('#42385c', 0.65, 0.12)
    stone.emissive.set('#1e1635')
    stone.emissiveIntensity = 0.22
    const gold = makeMat('#f5d77f', 0.32, 0.45)
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.42, 3.7, 0.54), stone)
    left.position.set(-2.05, 1.85, 0)
    const right = left.clone()
    right.position.x = 2.05
    const arch = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.21, 10, 32, Math.PI), stone)
    arch.rotation.z = Math.PI / 2
    arch.position.y = 2.05
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 0.62), this.textMaterial('獨 角 獸 聖 域', '#ffe8a3', '#392454'))
    plaque.position.set(0, 3.58, 0.3)
    const core = new THREE.Mesh(new THREE.CircleGeometry(1.3, 36), new THREE.MeshBasicMaterial({ color: '#c084fc', transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false }))
    core.position.set(0, 1.62, 0.05)
    const swirl = new THREE.Group()
    for (let i = 0; i < 2; i += 1) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.93 + i * 0.2, 0.035, 6, 30), new THREE.MeshBasicMaterial({ color: i ? '#88eeff' : '#f472b6', transparent: true, opacity: 0.82 }))
      ring.position.set(0, 1.62, 0.11 + i * 0.02)
      swirl.add(ring)
    }
    // 獨角獸光之星石
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), gold)
    star.position.set(0, 3.12, 0.18)
    group.add(left, right, arch, plaque, core, swirl, star)
    this.unicornPortalSwirl = swirl
    this.scene.add(group)
  }

  /**
   * Courtyard Plaza Prayer Wall Pavilion (大殿外廣場・祈願亭 / 祈願牆):
   * 移至大殿外東側前庭廣場 (x = 8.8, z = 8.2)，徹底釋放大殿內走道空間與視覺動線。
   * 包含青石須彌座、四根朱漆立柱與額枋雀替木構、歇山琉璃瓦亭頂、懸掛式實木繪馬祈願牌架、
   * 燙金匾額「祈 願 牆」、挑簷八角長明宮燈與溫潤暖金光暈。
   */
  private addCourtyardPrayerWall(): void {
    const px = COURTYARD_PRAYER_WALL_POS.x
    const pz = COURTYARD_PRAYER_WALL_POS.z
    const wallGroup = new THREE.Group()

    const stone = makeMat(C.stone, 0.92)
    const stoneTrim = makeMat(C.stoneLight, 0.85)
    const vermilion = makeMat(C.vermilion, 0.72)
    const vermilionLight = makeMat(C.vermilionLight, 0.68)
    const darkWood = makeMat(C.darkWood, 0.88)
    const wood = makeMat(C.wood, 0.82)
    const gold = makeMat(C.gold, 0.42, 0.38)
    const roofMat = makeMat(C.roof, 0.82)
    const ribbonMat = makeMat('#c0352b', 0.6)

    // 1. Carved Stone Plinth Base (須彌座青石臺基)
    const baseWidth = 4.4
    const baseDepth = 1.8
    const base = new THREE.Mesh(new THREE.BoxGeometry(baseWidth, 0.24, baseDepth), stone)
    base.position.set(px, 0.12, pz)
    base.receiveShadow = true
    base.castShadow = true
    wallGroup.add(base)

    const baseCap = new THREE.Mesh(new THREE.BoxGeometry(baseWidth + 0.16, 0.08, baseDepth + 0.16), stoneTrim)
    baseCap.position.set(px, 0.26, pz)
    baseCap.receiveShadow = true
    wallGroup.add(baseCap)

    // 2. Vermilion Pillars & Plinths (四根朱漆立柱與雕花柱礎)
    const pillarPositions: [number, number][] = [
      [px - 1.8, pz + 0.6],
      [px + 1.8, pz + 0.6],
      [px - 1.8, pz - 0.6],
      [px + 1.8, pz - 0.6],
    ]
    const pillarH = 2.5
    const pillarGeo = new THREE.CylinderGeometry(0.1, 0.11, pillarH, 12)
    const plinthGeo = new THREE.CylinderGeometry(0.16, 0.18, 0.16, 12)

    for (const [colX, colZ] of pillarPositions) {
      const plinth = new THREE.Mesh(plinthGeo, stoneTrim)
      plinth.position.set(colX, 0.38, colZ)
      plinth.castShadow = true
      plinth.receiveShadow = true
      wallGroup.add(plinth)

      const col = new THREE.Mesh(pillarGeo, vermilion)
      col.position.set(colX, 0.46 + pillarH / 2, colZ)
      col.castShadow = true
      wallGroup.add(col)

      // Gold collar rings
      const colRing = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.02, 8, 16), gold)
      colRing.rotation.x = Math.PI / 2
      colRing.position.set(colX, 0.52, colZ)
      wallGroup.add(colRing)
    }

    // 3. Beams and Architraves (穿斗額枋與木構)
    const frontBeam = new THREE.Mesh(new THREE.BoxGeometry(baseWidth - 0.5, 0.18, 0.14), vermilionLight)
    frontBeam.position.set(px, 0.46 + pillarH - 0.09, pz + 0.6)
    frontBeam.castShadow = true
    wallGroup.add(frontBeam)

    const backBeam = new THREE.Mesh(new THREE.BoxGeometry(baseWidth - 0.5, 0.18, 0.14), vermilionLight)
    backBeam.position.set(px, 0.46 + pillarH - 0.09, pz - 0.6)
    backBeam.castShadow = true
    wallGroup.add(backBeam)

    for (const sideX of [px - 1.8, px + 1.8]) {
      const sideBeam = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 1.2), vermilionLight)
      sideBeam.position.set(sideX, 0.46 + pillarH - 0.09, pz)
      sideBeam.castShadow = true
      wallGroup.add(sideBeam)
    }

    // 4. Central Wooden Prayer Board (實木祈願主掛板)
    const boardFrame = new THREE.Mesh(new THREE.BoxGeometry(3.3, 2.0, 0.14), darkWood)
    boardFrame.position.set(px, 1.62, pz)
    boardFrame.castShadow = true
    boardFrame.receiveShadow = true
    wallGroup.add(boardFrame)

    const boardFace = new THREE.Mesh(new THREE.BoxGeometry(3.14, 1.84, 0.08), wood)
    boardFace.position.set(px, 1.62, pz + 0.04)
    boardFace.castShadow = true
    boardFace.receiveShadow = true
    wallGroup.add(boardFace)

    // Horizontal rails for hanging prayer plaques
    const railGeo = new THREE.CylinderGeometry(0.02, 0.02, 3.0, 8)
    const railYOffsets = [-0.55, 0.0, 0.55]
    for (const yOff of railYOffsets) {
      const rail = new THREE.Mesh(railGeo, gold)
      rail.rotation.z = Math.PI / 2
      rail.position.set(px, 1.62 + yOff, pz + 0.1)
      wallGroup.add(rail)
    }

    // 5. Hanging Wish Plaques (精雕木質繪馬祈願牌)
    const plaqueGeo = new THREE.BoxGeometry(0.24, 0.16, 0.02)
    const ribbonGeo = new THREE.BoxGeometry(0.015, 0.1, 0.005)
    const tasselGeo = new THREE.CylinderGeometry(0.015, 0.025, 0.08, 6)
    const plaqueMat = makeMat('#8c593b', 0.78)

    const plaqueOffsets: [number, number, number][] = [
      [-1.15, 0.55, -0.05], [-0.7, 0.55, 0.04], [-0.25, 0.55, -0.02], [0.2, 0.55, 0.06], [0.65, 0.55, -0.04], [1.1, 0.55, 0.03],
      [-1.0, 0.0, 0.03], [-0.5, 0.0, -0.06], [0.0, 0.0, 0.04], [0.5, 0.0, -0.03], [1.0, 0.0, 0.05],
      [-1.1, -0.55, -0.03], [-0.65, -0.55, 0.05], [-0.15, -0.55, -0.04], [0.35, -0.55, 0.03], [0.85, -0.55, -0.05],
    ]

    for (const [xOff, yOff, rotZ] of plaqueOffsets) {
      const plaqueGroup = new THREE.Group()
      plaqueGroup.position.set(px + xOff, 1.62 + yOff - 0.06, pz + 0.13)
      plaqueGroup.rotation.z = rotZ

      const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat)
      ribbon.position.set(0, 0.08, 0)
      plaqueGroup.add(ribbon)

      const plaque = new THREE.Mesh(plaqueGeo, plaqueMat)
      plaque.castShadow = true
      plaqueGroup.add(plaque)

      const tassel = new THREE.Mesh(tasselGeo, gold)
      tassel.position.set(0, -0.11, 0)
      plaqueGroup.add(tassel)

      wallGroup.add(plaqueGroup)
    }

    // 6. Signboard Plaque 「祈 願 牆」 (金字朱底雕花額匾)
    const signBoard = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.58, 0.08), vermilion)
    signBoard.position.set(px, 0.46 + pillarH + 0.16, pz + 0.64)
    signBoard.castShadow = true
    wallGroup.add(signBoard)

    const signBoardGoldRim = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.5, 0.09), gold)
    signBoardGoldRim.position.set(px, 0.46 + pillarH + 0.16, pz + 0.64)
    wallGroup.add(signBoardGoldRim)

    const signFace = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.42), this.textMaterial('祈 願 牆', '#ffd700', '#631410'))
    signFace.position.set(px, 0.46 + pillarH + 0.16, pz + 0.69)
    wallGroup.add(signFace)

    // 7. Traditional Roof (歇山青瓦屋頂)
    const roof = this.createRoof(4.8, 2.5, 2.85, 3.85)
    roof.position.set(px, 0, pz)
    wallGroup.add(roof)

    // 8. Hanging Palace Lanterns (挑簷六角長明祈願宮燈)
    const lanternMat = new THREE.MeshStandardMaterial({
      color: '#ffe099',
      emissive: '#ffaa33',
      emissiveIntensity: 0.95,
      roughness: 0.3,
    })

    for (const lx of [px - 1.8, px + 1.8]) {
      const lanternGroup = new THREE.Group()
      lanternGroup.position.set(lx, 2.45, pz + 0.65)

      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.3, 4), gold)
      cord.position.y = 0.2
      lanternGroup.add(cord)

      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.12, 6), roofMat)
      cap.position.y = 0.06
      lanternGroup.add(cap)

      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.15, 0.28, 6), lanternMat)
      body.castShadow = true
      lanternGroup.add(body)

      const baseRing = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.06, 6), gold)
      baseRing.position.y = -0.16
      lanternGroup.add(baseRing)

      const lanternTassel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.025, 0.15, 6), ribbonMat)
      lanternTassel.position.y = -0.26
      lanternGroup.add(lanternTassel)

      wallGroup.add(lanternGroup)
    }

    // 9. Warm Welcoming Point Light (溫潤暖光映照祈願牆)
    const wallLight = new THREE.PointLight('#ffbb66', 0.9, 6.5, 1.8)
    wallLight.position.set(px, 2.3, pz + 0.8)
    wallGroup.add(wallLight)

    this.scene.add(wallGroup)

    // 10. Physical static box collider (防止穿越，保留前庭充足走動空間)
    this.physics.addStaticBox(new THREE.Vector3(px, 1.6, pz), new THREE.Vector3(4.4, 3.2, 1.8))
  }

  private addMarkers(): void {
    const colors: Record<ShrinePointId, string> = {
      incense: '#e8bb71', prayer: '#e8bb71', offerings: '#d8a45e', 'daily-lot': '#d8a45e', chess: '#a9c2a9',
      lamps: '#edba61', woodfish: '#d68c63', bell: '#e8c77d', 'wishing-pool': '#a8d2c6', 'prayer-wall': '#e8c77d',
      records: '#e8c77d', tiangong: '#f0c070', drum: '#d68c63', yuhuang: '#f5d77f', 'gold-furnace': '#e27b4e',
      'guanyin-dragon': '#ffea70', cushion: '#e5b968', 'sky-lantern': '#ff9b3d', 'market-portal': '#7fb7ad',
      'unicorn-portal': '#c084fc',
    }
    for (const point of this.points) {
      if (point.id === 'prayer') continue // Consolidated with prayer-wall at the courtyard plaza
      const mat = new THREE.MeshBasicMaterial({ color: colors[point.id], transparent: true, opacity: 0.42, depthWrite: false })
      const marker = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.038, 6, 30), mat)
      marker.rotation.x = Math.PI / 2
      marker.position.set(point.position.x, point.position.y + 0.09, point.position.z)
      marker.renderOrder = 2
      this.scene.add(marker)
      this.markers.set(point.id, marker)
      this.markerMats.set(point.id, mat)
    }
  }

  private createRoof(width: number, depth: number, eaveY: number, peakY: number): THREE.Group {
    const group = new THREE.Group()
    const half = width / 2
    const slope = Math.atan2(peakY - eaveY, half)
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(half + 0.32, 0.46, depth), makeMat(C.roof, 0.82))
      wing.position.set(side * half / 2, (peakY + eaveY) / 2, 0)
      wing.rotation.z = -side * slope
      wing.castShadow = true
      wing.receiveShadow = true
      group.add(wing)
      const fascia = new THREE.Mesh(new THREE.BoxGeometry(half + 0.42, 0.18, depth + 0.32), makeMat(C.roofLight, 0.72))
      fascia.position.set(side * half / 2, eaveY - 0.11, 0)
      fascia.rotation.z = -side * slope
      group.add(fascia)
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(half + 0.35, 0.12, 0.13), makeMat(C.gold, 0.6, 0.12))
      ridge.position.set(side * half / 2, (peakY + eaveY) / 2 + 0.24, 0)
      ridge.rotation.z = -side * slope
      group.add(ridge)
    }
    const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, depth + 0.6, 10), makeMat(C.gold, 0.5, 0.18))
    spine.rotation.x = Math.PI / 2
    spine.position.set(0, peakY + 0.12, 0)
    group.add(spine)
    for (const x of [-half, half]) for (const z of [-depth / 2, depth / 2]) {
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.23, 0.7, 8), makeMat(C.roofLight))
      tip.position.set(x * 1.04, eaveY + 0.4, z * 1.04)
      tip.rotation.z = x < 0 ? 0.72 : -0.72
      tip.rotation.x = z < 0 ? -0.25 : 0.25
      group.add(tip)
      const ornament = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), makeMat(C.gold, 0.4, 0.18))
      ornament.position.set(x * 1.04, eaveY + 0.78, z * 1.04)
      group.add(ornament)
    }
    return group
  }

  private addRoofFinial(parent: THREE.Object3D, x: number, y: number): void {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 7), makeMat(C.gold, 0.4, 0.2))
    ball.position.set(x, y, -0.3)
    parent.add(ball)
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.55, 8), makeMat(C.gold, 0.4, 0.2))
    tip.position.set(x, y + 0.34, -0.3)
    parent.add(tip)
  }

  private textMaterial(text: string, foreground: string, background: string): THREE.MeshBasicMaterial {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 256
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = background
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = foreground
    ctx.lineWidth = 8
    ctx.strokeRect(16, 16, canvas.width - 32, canvas.height - 32)
    ctx.fillStyle = foreground
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = 'bold 116px "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", serif'
    ctx.fillText(text, canvas.width / 2, canvas.height / 2)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return new THREE.MeshBasicMaterial({ map: texture, toneMapped: false })
  }

  private doorGodMaterial(god: 'qin' | 'yuchi' | 'wang' | 'ma'): THREE.MeshStandardMaterial {
    // 1. 正殿大門門神（秦叔寶、尉遲恭）：採用正統台灣宮廟彩繪大師名作高解析門神圖繪
    if (god === 'qin' || god === 'yuchi') {
      const mat = new THREE.MeshStandardMaterial({
        color: '#ffffff',
        roughness: 0.42,
        metalness: 0.12,
      })
      const primaryUrl = god === 'qin' ? './assets/menshen-qin.webp' : './assets/menshen-yuchi.webp'
      const loader = new THREE.TextureLoader()
      const applyTex = (tex: THREE.Texture) => {
        tex.colorSpace = THREE.SRGBColorSpace
        mat.map = tex
        mat.needsUpdate = true
      }
      loader.load(primaryUrl, applyTex)
      return mat
    }

    return this.createProceduralDoorGodMaterial(god)
  }

  private createProceduralDoorGodMaterial(god: 'wang' | 'ma' | 'qin' | 'yuchi'): THREE.MeshStandardMaterial {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 1024
    const ctx = canvas.getContext('2d')!

    // 1. Base Vermilion Lacquer & Double Gold Border (朱漆底色與金邊回紋)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 1024)
    bgGrad.addColorStop(0, '#58120b')
    bgGrad.addColorStop(0.5, '#781a13')
    bgGrad.addColorStop(1, '#3a0805')
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, 512, 1024)

    // Outer & Inner Gold Filigree Borders (金泥雙線外框)
    ctx.strokeStyle = '#d4af37'
    ctx.lineWidth = 10
    ctx.strokeRect(16, 16, 480, 992)
    ctx.strokeStyle = '#f5df8b'
    ctx.lineWidth = 3
    ctx.strokeRect(26, 26, 460, 972)

    // Four Corner Auspicious Ruyi / Cloud Knots (四角如意祥雲金飾)
    const drawCornerKnot = (x: number, y: number, flipX: number, flipY: number) => {
      ctx.save()
      ctx.translate(x, y)
      ctx.scale(flipX, flipY)
      ctx.strokeStyle = '#dfba54'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(0, 36)
      ctx.bezierCurveTo(24, 36, 36, 24, 36, 0)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(18, 18, 8, 0, Math.PI * 2)
      ctx.fillStyle = '#dfba54'
      ctx.fill()
      ctx.restore()
    }
    drawCornerKnot(30, 30, 1, 1)
    drawCornerKnot(482, 30, -1, 1)
    drawCornerKnot(30, 994, 1, -1)
    drawCornerKnot(482, 994, -1, -1)

    // 2. Top Divine Name Plaque (頂部神號金字名匾)
    ctx.fillStyle = '#220b08'
    ctx.fillRect(80, 42, 352, 68)
    ctx.strokeStyle = '#f1d478'
    ctx.lineWidth = 4
    ctx.strokeRect(80, 42, 352, 68)
    ctx.strokeStyle = '#992117'
    ctx.lineWidth = 2
    ctx.strokeRect(86, 48, 340, 56)

    const titles = {
      qin: '門神・秦叔寶',
      yuchi: '門神・尉遲恭',
      wang: '都天靈官・王元帥',
      ma: '華光天王・馬元帥',
    }
    ctx.fillStyle = '#fcebb6'
    ctx.font = 'bold 34px "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.shadowColor = '#000000'
    ctx.shadowBlur = 6
    ctx.fillText(titles[god], 256, 76)
    ctx.shadowBlur = 0

    // 3. Golden Divine Halo (威武神聖光輪)
    const halo = ctx.createRadialGradient(256, 275, 30, 256, 275, 145)
    halo.addColorStop(0, 'rgba(255, 238, 170, 0.65)')
    halo.addColorStop(0.5, 'rgba(235, 185, 75, 0.35)')
    halo.addColorStop(1, 'rgba(200, 140, 40, 0)')
    ctx.fillStyle = halo
    ctx.beginPath()
    ctx.arc(256, 275, 145, 0, Math.PI * 2)
    ctx.fill()

    // 4. Floating Divine Silk Ribbons (五彩霞帔飛帛)
    ctx.strokeStyle = god === 'qin' || god === 'wang' ? '#c0392b' : '#2980b9'
    ctx.lineWidth = 14
    ctx.lineCap = 'round'
    // Left ribbon
    ctx.beginPath()
    ctx.moveTo(180, 230)
    ctx.bezierCurveTo(70, 290, 60, 450, 110, 590)
    ctx.bezierCurveTo(140, 680, 80, 770, 95, 870)
    ctx.stroke()
    // Right ribbon
    ctx.beginPath()
    ctx.moveTo(332, 230)
    ctx.bezierCurveTo(442, 290, 452, 450, 402, 590)
    ctx.bezierCurveTo(372, 680, 432, 770, 417, 870)
    ctx.stroke()

    // Inner gold ribbon accent
    ctx.strokeStyle = '#f5d469'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(180, 230)
    ctx.bezierCurveTo(70, 290, 60, 450, 110, 590)
    ctx.bezierCurveTo(140, 680, 80, 770, 95, 870)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(332, 230)
    ctx.bezierCurveTo(442, 290, 452, 450, 402, 590)
    ctx.bezierCurveTo(372, 680, 432, 770, 417, 870)
    ctx.stroke()

    // 5. Robe & Battle Apron (戰袍戰裙)
    const robeColor = god === 'qin' ? '#1e5f38' : god === 'yuchi' ? '#1c345b' : god === 'wang' ? '#8a1d12' : '#2d686f'
    ctx.fillStyle = robeColor
    ctx.beginPath()
    ctx.moveTo(160, 390)
    ctx.lineTo(352, 390)
    ctx.lineTo(390, 780)
    ctx.bezierCurveTo(300, 810, 212, 810, 122, 780)
    ctx.closePath()
    ctx.fill()

    // Golden hem border
    ctx.strokeStyle = '#dfba54'
    ctx.lineWidth = 6
    ctx.stroke()

    // 6. Golden Pauldrons & Armor (獸首吞肩與鎖子黃金甲)
    // Shoulders
    ctx.fillStyle = '#c89632'
    ctx.beginPath()
    ctx.arc(148, 360, 38, 0, Math.PI * 2)
    ctx.arc(364, 360, 38, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#ffe28a'
    ctx.lineWidth = 4
    ctx.stroke()

    // Body Armor
    ctx.fillStyle = '#b88628'
    ctx.beginPath()
    ctx.moveTo(170, 340)
    ctx.lineTo(342, 340)
    ctx.lineTo(326, 520)
    ctx.lineTo(186, 520)
    ctx.closePath()
    ctx.fill()

    // Chainmail / Scale texture
    ctx.strokeStyle = '#f6d57b'
    ctx.lineWidth = 2
    for (let row = 360; row < 510; row += 16) {
      for (let col = 190; col < 320; col += 20) {
        ctx.beginPath()
        ctx.arc(col + (row % 32 === 0 ? 0 : 10), row, 8, 0, Math.PI)
        ctx.stroke()
      }
    }

    // Mirror of Protection (護心寶鏡)
    const mirrorGrad = ctx.createRadialGradient(256, 425, 4, 256, 425, 34)
    mirrorGrad.addColorStop(0, '#ffffff')
    mirrorGrad.addColorStop(0.3, '#f5e8b0')
    mirrorGrad.addColorStop(0.7, '#c69528')
    mirrorGrad.addColorStop(1, '#684508')
    ctx.fillStyle = mirrorGrad
    ctx.beginPath()
    ctx.arc(256, 425, 34, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#faeaae'
    ctx.lineWidth = 4
    ctx.stroke()

    // Broad Gold Belt with Jade Buckle (金蠻帶、玉帶)
    ctx.fillStyle = '#c5942e'
    ctx.fillRect(180, 520, 152, 28)
    ctx.strokeStyle = '#fff0ba'
    ctx.lineWidth = 3
    ctx.strokeRect(180, 520, 152, 28)
    ctx.fillStyle = '#3ca06c'
    ctx.fillRect(238, 522, 36, 24)
    ctx.strokeStyle = '#f8df86'
    ctx.strokeRect(238, 522, 36, 24)

    // 7. Head, Face & Headdress (神盔金冠與威嚴法相)
    // Phoenix Wing Golden Helmet (鳳翅紫金盔)
    ctx.fillStyle = '#caa13b'
    ctx.beginPath()
    ctx.moveTo(186, 250)
    ctx.bezierCurveTo(186, 150, 326, 150, 326, 250)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = '#ffea9f'
    ctx.lineWidth = 4
    ctx.stroke()

    // Helmet Peak & Red Plume (盔頂朱纓)
    ctx.fillStyle = '#d63031'
    ctx.beginPath()
    ctx.moveTo(256, 160)
    ctx.bezierCurveTo(240, 120, 272, 120, 256, 95)
    ctx.bezierCurveTo(290, 125, 275, 145, 256, 160)
    ctx.fill()

    // Side Phoenix Wings on Helmet (雙鳳翅)
    ctx.fillStyle = '#e5b84c'
    ctx.beginPath()
    ctx.moveTo(188, 230)
    ctx.quadraticCurveTo(140, 180, 160, 140)
    ctx.quadraticCurveTo(176, 185, 196, 215)
    ctx.fill()
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(324, 230)
    ctx.quadraticCurveTo(372, 180, 352, 140)
    ctx.quadraticCurveTo(336, 185, 316, 215)
    ctx.fill()
    ctx.stroke()

    // Face Contours
    const faceColors = {
      qin: '#fcd3b6',
      yuchi: '#313a48',
      wang: '#bf2c1d',
      ma: '#f7ede3',
    }
    ctx.fillStyle = faceColors[god]
    ctx.beginPath()
    ctx.ellipse(256, 260, 48, 56, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#5a2512'
    ctx.lineWidth = 2
    ctx.stroke()

    // Eyes, Brows & Facial Features
    if (god === 'qin') {
      // 秦瓊：端正鳳目、長眉威儀
      ctx.strokeStyle = '#1b1b1b'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(224, 244); ctx.lineTo(248, 240)
      ctx.moveTo(288, 244); ctx.lineTo(264, 240)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(226, 252); ctx.quadraticCurveTo(238, 248, 248, 252)
      ctx.moveTo(286, 252); ctx.quadraticCurveTo(274, 248, 264, 252)
      ctx.stroke()
      // Long Five-strand flowing black beard (五柳長髯)
      ctx.fillStyle = '#111111'
      ctx.beginPath()
      ctx.moveTo(234, 280)
      ctx.quadraticCurveTo(230, 360, 244, 430)
      ctx.quadraticCurveTo(256, 370, 256, 285)
      ctx.quadraticCurveTo(256, 370, 268, 430)
      ctx.quadraticCurveTo(282, 360, 278, 280)
      ctx.fill()
    } else if (god === 'yuchi') {
      // 尉遲恭：鐵面環眼、虯鬚如戟
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(236, 250, 10, 0, Math.PI * 2)
      ctx.arc(276, 250, 10, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#0a0a0d'
      ctx.beginPath()
      ctx.arc(236, 250, 5, 0, Math.PI * 2)
      ctx.arc(276, 250, 5, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#08080a'
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.moveTo(220, 238); ctx.lineTo(248, 242)
      ctx.moveTo(292, 238); ctx.lineTo(264, 242)
      ctx.stroke()
      // Dense bristling curly beard
      ctx.fillStyle = '#090a0d'
      ctx.beginPath()
      ctx.moveTo(220, 270)
      ctx.bezierCurveTo(190, 320, 210, 420, 256, 435)
      ctx.bezierCurveTo(302, 420, 322, 320, 292, 270)
      ctx.closePath()
      ctx.fill()
    } else if (god === 'wang') {
      // 王靈官：赤面三目、雷火神鬚
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(236, 252, 9, 0, Math.PI * 2)
      ctx.arc(276, 252, 9, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ffd11a'
      ctx.beginPath()
      ctx.arc(236, 252, 5, 0, Math.PI * 2)
      ctx.arc(276, 252, 5, 0, Math.PI * 2)
      ctx.fill()
      // Third Eye on Forehead (天目金瞳)
      ctx.fillStyle = '#ffe033'
      ctx.beginPath()
      ctx.ellipse(256, 232, 6, 11, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#8a160d'
      ctx.lineWidth = 2
      ctx.stroke()
      // Fiery Red Beard (赤鬚如火)
      ctx.fillStyle = '#8a1c12'
      ctx.beginPath()
      ctx.moveTo(226, 275)
      ctx.bezierCurveTo(205, 330, 225, 410, 256, 430)
      ctx.bezierCurveTo(287, 410, 307, 330, 286, 275)
      ctx.closePath()
      ctx.fill()
    } else {
      // 馬天君：白面三目、英氣勃發
      ctx.strokeStyle = '#1b1b1b'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(224, 248); ctx.quadraticCurveTo(236, 244, 248, 248)
      ctx.moveTo(288, 248); ctx.quadraticCurveTo(276, 244, 264, 248)
      ctx.stroke()
      // Third Eye (額開天目)
      ctx.fillStyle = '#00e1d9'
      ctx.beginPath()
      ctx.ellipse(256, 230, 5, 10, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#1a5d5a'
      ctx.lineWidth = 2
      ctx.stroke()
      // Trim black beard
      ctx.fillStyle = '#1a1a1a'
      ctx.beginPath()
      ctx.moveTo(242, 282)
      ctx.quadraticCurveTo(240, 330, 256, 370)
      ctx.quadraticCurveTo(272, 330, 270, 282)
      ctx.fill()
    }

    // 8. Weapons (神兵法器)
    if (god === 'qin') {
      // 秦瓊：熟銅金鐧 (Golden Mace)
      ctx.save()
      ctx.translate(345, 500)
      ctx.rotate(-0.25)
      ctx.fillStyle = '#f3ca4d'
      ctx.fillRect(-10, -220, 20, 330)
      ctx.strokeStyle = '#9c7014'
      ctx.lineWidth = 3
      ctx.strokeRect(-10, -220, 20, 330)
      ctx.beginPath()
      ctx.moveTo(-10, -220)
      ctx.lineTo(0, -250)
      ctx.lineTo(10, -220)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#7a190f'
      ctx.fillRect(-18, 110, 36, 14)
      ctx.fillStyle = '#2c1e19'
      ctx.fillRect(-7, 124, 14, 55)
      ctx.fillStyle = '#f3ca4d'
      ctx.beginPath()
      ctx.arc(0, 185, 14, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    } else if (god === 'yuchi') {
      // 尉遲恭：十三節雌雄鋼鞭 (Steel Bamboo-joint Whip)
      ctx.save()
      ctx.translate(165, 500)
      ctx.rotate(0.25)
      for (let i = 0; i < 11; i++) {
        const yPos = -220 + i * 28
        ctx.fillStyle = '#596573'
        ctx.fillRect(-9, yPos, 18, 24)
        ctx.strokeStyle = '#b8c6d6'
        ctx.lineWidth = 2
        ctx.strokeRect(-9, yPos, 18, 24)
        ctx.fillStyle = '#c79c36'
        ctx.fillRect(-12, yPos + 22, 24, 6)
      }
      ctx.fillStyle = '#788796'
      ctx.beginPath()
      ctx.moveTo(-9, -220)
      ctx.lineTo(0, -248)
      ctx.lineTo(9, -220)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#1c1c1f'
      ctx.fillRect(-7, 95, 14, 60)
      ctx.fillStyle = '#c79c36'
      ctx.beginPath()
      ctx.arc(0, 160, 14, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    } else if (god === 'wang') {
      // 王靈官：降魔雷火金鞭 (Thunder Fire Gold Whip)
      ctx.save()
      ctx.translate(345, 490)
      ctx.rotate(-0.28)
      for (let i = 0; i < 9; i++) {
        const yPos = -210 + i * 32
        ctx.fillStyle = '#ffd13b'
        ctx.fillRect(-11, yPos, 22, 27)
        ctx.strokeStyle = '#d47817'
        ctx.lineWidth = 2
        ctx.strokeRect(-11, yPos, 22, 27)
        ctx.fillStyle = '#ff4d15'
        ctx.fillRect(-14, yPos + 25, 28, 7)
      }
      ctx.fillStyle = '#ffd13b'
      ctx.beginPath()
      ctx.moveTo(-11, -210)
      ctx.lineTo(0, -245)
      ctx.lineTo(11, -210)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#421008'
      ctx.fillRect(-8, 85, 16, 60)
      ctx.fillStyle = '#ffd13b'
      ctx.beginPath()
      ctx.arc(0, 150, 14, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    } else {
      // 馬天君：三尖兩刃神槍 / 金槍 (Divine Spear)
      ctx.save()
      ctx.translate(165, 490)
      ctx.rotate(0.24)
      ctx.fillStyle = '#3a2014'
      ctx.fillRect(-6, -180, 12, 340)
      ctx.fillStyle = '#e8eff7'
      ctx.beginPath()
      ctx.moveTo(0, -260)
      ctx.lineTo(14, -200)
      ctx.lineTo(6, -180)
      ctx.lineTo(-6, -180)
      ctx.lineTo(-14, -200)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = '#ffd700'
      ctx.lineWidth = 3
      ctx.stroke()
      ctx.fillStyle = '#d63031'
      ctx.beginPath()
      ctx.moveTo(-14, -180)
      ctx.lineTo(14, -180)
      ctx.lineTo(20, -145)
      ctx.lineTo(0, -135)
      ctx.lineTo(-20, -145)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }

    // 9. Black Royal Boots (厚底皂靴)
    ctx.fillStyle = '#111317'
    const drawBoot = (bx: number, by: number) => {
      ctx.beginPath()
      ctx.rect(bx, by, 65, 36)
      ctx.fill()
      ctx.fillStyle = '#e8d5a2'
      ctx.fillRect(bx, by + 30, 65, 6)
      ctx.fillStyle = '#111317'
    }
    drawBoot(175, 785)
    drawBoot(272, 785)

    // 10. Swirling Auspicious Clouds at Bottom (五彩祥雲)
    const cloudColors = ['#fcedb8', '#e8c974', '#e2886a', '#a4d4ae']
    const drawCloudPuff = (cx: number, cy: number, r: number, col: string) => {
      ctx.fillStyle = col
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fill()
    }
    drawCloudPuff(130, 845, 38, cloudColors[0])
    drawCloudPuff(175, 835, 46, cloudColors[1])
    drawCloudPuff(230, 848, 42, cloudColors[2])
    drawCloudPuff(286, 835, 48, cloudColors[1])
    drawCloudPuff(342, 846, 44, cloudColors[3])
    drawCloudPuff(385, 845, 36, cloudColors[0])

    // 11. Bottom Auspicious Blessing Plaque (底部吉語紅底金匾)
    ctx.fillStyle = '#220b08'
    ctx.fillRect(96, 905, 320, 60)
    ctx.strokeStyle = '#f1d478'
    ctx.lineWidth = 4
    ctx.strokeRect(96, 905, 320, 60)

    const blessings = {
      qin: '四 季 平 安',
      yuchi: '萬 事 如 意',
      wang: '靈 官 護 道',
      ma: '天 宮 鎮 煞',
    }
    ctx.fillStyle = '#fcebb6'
    ctx.font = 'bold 30px "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(blessings[god], 256, 935)

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.55,
      metalness: 0.15,
      toneMapped: false,
    })
  }

  /** Place the generated 3D Guanyin model on the lotus throne (觀世音菩薩立體法相). */
  setStatue(source: THREE.Object3D): void {
    const root = this.guanyinRoot
    if (!root) return
    const model = source.clone(true)
    const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3())
    model.scale.setScalar(size.y > 0.01 ? GUANYIN_HEIGHT / size.y : 1.4)
    const box = new THREE.Box3().setFromObject(model)
    const center = box.getCenter(new THREE.Vector3())
    // Model's authored front faces +X; turn it to face the worshippers (+Z of the hall).
    const holder = new THREE.Group()
    holder.rotation.y = -Math.PI / 2
    model.position.set(-center.x, 0.35 - box.min.y, -center.z)
    holder.add(model)
    model.traverse(obj => {
      if (!(obj instanceof THREE.Mesh)) return
      obj.castShadow = true
      obj.receiveShadow = true
      // Matte finish: avoid the chest glare that the hall's point lights produced on the old image.
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      for (const m of mats) if (m instanceof THREE.MeshStandardMaterial) { m.metalness = Math.min(m.metalness, 0.25); m.roughness = Math.max(m.roughness, 0.6) }
    })
    root.add(holder)
    this.guanyinModelPlaced = true
  }

  /**
   * Promotes an approved transparent 金身 artwork to the deity's main hall
   * presentation. The procedural sculpture remains in the source as a safe
   * rollback path, but is hidden once the replacement artwork has loaded.
   */
  private replaceDeityWithPortrait(
    root: THREE.Group,
    asset: string,
    width: number,
    height: number,
    centerY: number,
    depthZ = -0.1,
  ): void {
    new THREE.TextureLoader().load(asset, tex => {
      tex.colorSpace = THREE.SRGBColorSpace
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: 1,
        alphaTest: 0.06,
        depthWrite: true,
        side: THREE.DoubleSide,
      })
      const portrait = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat)
      // The altar screen is local z -0.36/-0.40 behind each deity. Keep the
      // transparent portrait just in front of it at depthZ = -0.1, aligned with Guanyin,
      // completely clear of shadows and fully visible from the temple entrance.
      portrait.position.set(0, centerY, depthZ)
      root.traverse(child => {
        if (child !== root && child !== portrait) child.visible = false
      })
      root.add(portrait)
    })
  }

  /** Fallback when the 3D model cannot load: the updated transparent golden image. */
  showStatueImageFallback(): void {
    const root = this.guanyinRoot
    if (!root || this.guanyinModelPlaced) return
    const statueH = 3.2
    const statueW = statueH * (2 / 3)
    new THREE.TextureLoader().load('./assets/guanyin-golden-v2.png', tex => {
      tex.colorSpace = THREE.SRGBColorSpace
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide })
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(statueW, statueH), mat)
      mesh.position.set(0, 0.32 + statueH / 2, 0)
      root.add(mesh)
    })
  }

  /**
   * 【中央主祀】3D 啞光黏土溫柔 Q 版觀世音菩薩坐像（Gentle Chibi Matte-Clay Guanyin Statue）
   * - 採用 Pop Mart 潮玩微縮模型啞光黏土質感（高粗糙度消光、溫潤柔和）
   * - 奶油白（Pastel Cream）、蜜桃粉（Soft Peach）與暖金色（Warm Gold）配色
   */
  private createGuanyinStatue(): THREE.Group {
    const root = new THREE.Group()
    this.guanyinModelPlaced = true

    // Use a restrained gilt-ivory finish: Guanyin remains recognisably white-robed,
    // while the throne and sacred ornaments read as a polished golden statue.
    const clayCream = makeMat('#f7edcf', 0.48, 0.22)
    const clayCreamShade = makeMat('#d6ae53', 0.34, 0.62)
    const clayPeach = makeMat('#f3b3a2', 0.9, 0.02)
    const clayPeachLight = makeMat('#fad6cb', 0.9, 0.02)
    const clayGold = makeMat('#d8a62b', 0.24, 0.82)
    const brightGold = makeMat('#ffe08a', 0.18, 0.9)
    brightGold.emissive.set('#7b4b08')
    brightGold.emissiveIntensity = 0.18
    const claySkin = makeMat('#fde7d6', 0.92, 0.01)
    const clayHair = makeMat('#422e25', 0.92, 0.01)
    const clayJade = makeMat('#8fc2a9', 0.85, 0.05)

    // 1. 雙層蜜桃粉與暖金啞光黏土蓮花寶座 (Pastel Peach & Warm Gold Lotus Throne)
    const goldBase = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.24, 0.24, 24), clayGold)
    goldBase.position.y = 0.12
    goldBase.castShadow = true
    root.add(goldBase)

    const lotusPod = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.86, 0.26, 24), clayCreamShade)
    lotusPod.position.y = 0.34
    root.add(lotusPod)

    // 下層與上層圓潤飽滿蜜桃粉黏土蓮花瓣
    for (let tier = 0; tier < 2; tier++) {
      const count = 14
      const radius = tier === 0 ? 1.02 : 0.9
      const y = tier === 0 ? 0.24 : 0.42
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2 + tier * (Math.PI / count)
        const petal = new THREE.Mesh(
          new THREE.SphereGeometry(0.24, 14, 10),
          tier === 0 ? clayPeach : clayPeachLight
        )
        petal.scale.set(0.95, 1.35, 0.52)
        petal.position.set(Math.cos(ang) * radius, y, Math.sin(ang) * radius)
        petal.rotation.set(0.28 * Math.cos(ang), -ang, -0.28 * Math.sin(ang))
        petal.castShadow = true
        root.add(petal)
      }
    }

    // 2. Q 版盤腿坐姿與奶油白暖金天衣 (Seated Chibi Body & Pastel Cream Robes)
    // 盤腿下擺
    const crossedLegs = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.76, 0.34, 24), clayCream)
    crossedLegs.scale.set(1.18, 1, 0.88)
    crossedLegs.position.set(0, 0.62, 0.04)
    crossedLegs.castShadow = true
    root.add(crossedLegs)

    // 暖金裙襬滾邊
    const skirtTrim = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.042, 10, 28), clayGold)
    skirtTrim.rotation.x = Math.PI / 2
    skirtTrim.scale.set(1.16, 0.88, 1)
    skirtTrim.position.set(0, 0.5, 0.04)
    root.add(skirtTrim)

    // 圓潤上身軀幹
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.52, 0.72, 22), clayCream)
    torso.position.set(0, 1.08, 0)
    torso.castShadow = true
    root.add(torso)

    // 蜜桃粉與暖金交領胸飾＋瓔珞金項圈
    const innerCollar = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.048, 10, 20), clayPeach)
    innerCollar.rotation.x = Math.PI / 2 + 0.25
    innerCollar.position.set(0, 1.36, 0.08)
    const goldNecklace = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.032, 10, 22), clayGold)
    goldNecklace.rotation.x = Math.PI / 2 + 0.3
    goldNecklace.position.set(0, 1.28, 0.12)
    root.add(innerCollar, goldNecklace)

    // Gilt chest pendant and paired cuff rings give the white robe a clear 金身 focal point.
    const pendant = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.028, 16), brightGold)
    pendant.rotation.x = Math.PI / 2
    pendant.position.set(0, 1.16, 0.365)
    root.add(pendant)

    // 雙肩柔和寬袖與腹前結印小手
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), clayCream)
      shoulder.scale.set(0.95, 1.25, 0.95)
      shoulder.position.set(side * 0.42, 1.18, 0.04)
      const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.42, 14), clayCream)
      forearm.position.set(side * 0.26, 0.92, 0.28)
      forearm.rotation.set(0.85, 0, -side * 0.55)
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.105, 14, 12), claySkin)
      hand.position.set(side * 0.11, 0.86, 0.42)
      const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.022, 8, 16), brightGold)
      cuff.rotation.x = Math.PI / 2
      cuff.position.set(side * 0.2, 0.99, 0.27)
      // 蜜桃粉仙家披帛飄帶
      const ribbon = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.045, 10, 20, Math.PI * 1.15), clayPeach)
      ribbon.position.set(side * 0.46, 0.96, 0.14)
      ribbon.rotation.set(0.3, side * 0.4, side * 0.5)
      root.add(shoulder, forearm, hand, cuff, ribbon)
    }

    // 掌中羊脂白玉甘露淨瓶與翠綠楊柳枝
    const vaseBody = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 12), clayCream)
    vaseBody.scale.set(1, 1.3, 1)
    vaseBody.position.set(0, 0.95, 0.45)
    const vaseNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.048, 0.14, 12), clayGold)
    vaseNeck.position.set(0, 1.09, 0.45)
    const willowBranch = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.22, 8), clayJade)
    willowBranch.position.set(0.04, 1.22, 0.46)
    willowBranch.rotation.z = -0.35
    root.add(vaseBody, vaseNeck, willowBranch)

    // 3. 溫柔 Q 版大頭部（二頭身潮玩比例、慈祥閉目笑顏）
    const head = new THREE.Group()
    head.position.set(0, 1.88, 0.04)

    // 圓潤 Q 版臉龐
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.48, 28, 22), claySkin)
    face.scale.set(1.04, 0.98, 0.96)
    face.castShadow = true
    head.add(face)

    // 雙耳與慈悲垂耳瑞相
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), claySkin)
      ear.scale.set(0.55, 1.35, 0.7)
      ear.position.set(side * 0.48, -0.04, 0.02)
      head.add(ear)
    }

    // 溫潤深褐黏土髮罩與前額中分柔順髮髻
    const hairBack = new THREE.Mesh(
      new THREE.SphereGeometry(0.505, 26, 20, 0, Math.PI * 2, 0, Math.PI * 0.56),
      clayHair
    )
    hairBack.rotation.x = 0.36
    hairBack.position.set(0, 0.04, -0.04)
    head.add(hairBack)

    for (const side of [-1, 1]) {
      const templeHair = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), clayHair)
      templeHair.scale.set(1.2, 0.55, 0.78)
      templeHair.position.set(side * 0.25, 0.34, 0.24)
      templeHair.rotation.set(0.18, side * 0.35, -side * 0.35)
      head.add(templeHair)
    }

    // 高聳寶髻與暖金蓮花觀音寶冠
    const topBun = new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 14), clayHair)
    topBun.scale.set(1, 1.25, 1)
    topBun.position.set(0, 0.56, -0.04)
    const crownBase = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.14, 18), clayGold)
    crownBase.position.set(0, 0.43, 0.06)
    const crownFlame = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.32, 12), clayGold)
    crownFlame.scale.set(1.1, 1, 0.45)
    crownFlame.position.set(0, 0.62, 0.22)
    const crownGem = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), clayPeach)
    crownGem.position.set(0, 0.55, 0.29)
    head.add(topBun, crownBase, crownFlame, crownGem)

    for (let i = -2; i <= 2; i++) {
      const crownBead = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), brightGold)
      crownBead.position.set(i * 0.075, 0.485, 0.265)
      head.add(crownBead)
    }

    // 奶油白觀音披紗（自寶冠後方柔順垂落雙肩）
    const veilTop = new THREE.Mesh(
      new THREE.SphereGeometry(0.535, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.52),
      clayCream
    )
    veilTop.rotation.x = 0.48
    veilTop.position.set(0, 0.08, -0.08)
    head.add(veilTop)
    for (const side of [-1, 1]) {
      const veilDrape = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, 0.95, 14), clayCream)
      veilDrape.position.set(side * 0.44, -0.36, -0.06)
      veilDrape.rotation.z = -side * 0.18
      head.add(veilDrape)
    }

    // 慈祥閉目彎彎眼睫、蜜桃粉腮紅、眉心吉祥紅痣與溫柔微笑
    const browDot = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), makeMat('#d94b3d', 0.8))
    browDot.position.set(0, 0.14, 0.472)
    head.add(browDot)

    for (const side of [-1, 1]) {
      // 溫柔閉目弧線
      const closedEye = new THREE.Mesh(
        new THREE.TorusGeometry(0.075, 0.015, 8, 16, Math.PI * 0.85),
        clayHair
      )
      closedEye.rotation.set(0.15, side * 0.22, Math.PI + side * 0.08)
      closedEye.position.set(side * 0.16, 0.02, 0.465)
      // 柔和彎眉
      const eyebrow = new THREE.Mesh(
        new THREE.TorusGeometry(0.08, 0.011, 6, 14, Math.PI * 0.75),
        clayHair
      )
      eyebrow.rotation.set(-0.1, side * 0.22, side * 0.05)
      eyebrow.position.set(side * 0.16, 0.11, 0.46)
      // 粉嫩蜜桃腮紅
      const blush = new THREE.Mesh(
        new THREE.CircleGeometry(0.075, 16),
        new THREE.MeshBasicMaterial({ color: '#f6a69b', transparent: true, opacity: 0.78 })
      )
      blush.position.set(side * 0.25, -0.08, 0.435)
      blush.rotation.y = side * 0.42
      head.add(closedEye, eyebrow, blush)
    }

    const smile = new THREE.Mesh(
      new THREE.TorusGeometry(0.048, 0.011, 8, 14, Math.PI * 0.85),
      makeMat('#c86d61', 0.85)
    )
    smile.rotation.z = Math.PI * 1.07
    smile.position.set(0, -0.11, 0.472)
    head.add(smile)

    root.add(head)

    // 4. 溫暖奶油金圓滿背光輪 (Soft Warm Gold & Pastel Cream Halo)
    const haloMat = new THREE.MeshBasicMaterial({ color: '#ffeab5', transparent: true, opacity: 0.52, side: THREE.DoubleSide })
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.88, 1.55, 36), haloMat)
    halo.position.set(0, 1.75, -0.26)
    const haloInner = new THREE.Mesh(new THREE.CircleGeometry(0.88, 36), new THREE.MeshBasicMaterial({ color: '#fff3cf', transparent: true, opacity: 0.28 }))
    haloInner.position.set(0, 1.75, -0.255)
    root.add(halo, haloInner)

    // Small lotus-like aureole beads remain readable at the main-hall viewing distance.
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), brightGold)
      bead.position.set(Math.cos(angle) * 1.28, 1.75 + Math.sin(angle) * 1.28, -0.275)
      root.add(bead)
    }

    // The centre niche has an additional carved panel, so the primary portrait
    // needs a slightly forward layer to remain visible above that panel.
    this.replaceDeityWithPortrait(root, './assets/guanyin-golden-v2.png', 2.42, 3.62, 1.78, -0.1)

    const statueGlow = new THREE.PointLight('#ffe5a8', 0.85, 8, 1.8)
    statueGlow.position.set(0, 2.0, 0.75)
    root.add(statueGlow)

    return root
  }

  /**
   * 【龍邊陪祀（右側）】3D 啞光黏土 Q 版天官武財神／財神爺（Chibi Matte-Clay Cai Shen - God of Wealth）
   * - 頭戴暖金展翅財神官帽、圓潤喜氣笑顏與翹鬍鬚、喜慶朱紅與暖金錦袍
   * - 雙手捧著發光大金元寶（Glowing Golden Ingot），坐於聚寶金蓮座上
   */
  private createCaiShenStatue(): THREE.Group {
    const root = new THREE.Group()

    const clayRed = makeMat('#b92820', 0.4, 0.18)
    const clayGold = makeMat('#d9a52a', 0.22, 0.86)
    const brightGold = makeMat('#ffe18a', 0.16, 0.92)
    brightGold.emissive.set('#7c4b08')
    brightGold.emissiveIntensity = 0.2
    const clayPeach = makeMat('#f3b2a2', 0.9, 0.02)
    const claySkin = makeMat('#fde4d0', 0.92, 0.01)
    const clayDark = makeMat('#33221b', 0.92, 0.01)

    // 發光大金元寶材質
    const ingotGlowMat = makeMat('#ffd86b', 0.45, 0.28)
    ingotGlowMat.emissive.set('#ffa826')
    ingotGlowMat.emissiveIntensity = 0.65

    // 1. 招財聚寶金蓮台座
    const base1 = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.94, 0.2, 20), clayGold)
    base1.position.y = 0.1
    const base2 = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.78, 0.22, 20), clayRed)
    base2.position.y = 0.28
    const baseRing = new THREE.Mesh(new THREE.TorusGeometry(0.74, 0.04, 10, 24), clayGold)
    baseRing.rotation.x = Math.PI / 2
    baseRing.position.y = 0.39
    root.add(base1, base2, baseRing)

    // 2. Q 版福相盤坐身姿與朱紅織金錦袍
    const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.62, 0.28, 20), clayRed)
    legs.scale.set(1.15, 1, 0.88)
    legs.position.set(0, 0.52, 0.03)
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.46, 0.62, 20), clayRed)
    torso.position.set(0, 0.92, 0)
    // 暖金玉帶
    const jadeBelt = new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.042, 10, 22), clayGold)
    jadeBelt.rotation.x = Math.PI / 2
    jadeBelt.position.set(0, 0.82, 0.02)
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.042, 8, 18), clayGold)
    collar.rotation.x = Math.PI / 2 + 0.2
    collar.position.set(0, 1.18, 0.06)
    root.add(legs, torso, jadeBelt, collar)

    // A raised gilt longevity seal makes the red ceremonial robe feel like a gilded 金身,
    // not a flat clay figure.
    const robeSeal = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.024, 12), brightGold)
    robeSeal.rotation.x = Math.PI / 2
    robeSeal.position.set(0, 1.0, 0.355)
    root.add(robeSeal)
    for (const side of [-1, 1]) {
      const robeCoin = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.014, 8, 12), brightGold)
      robeCoin.position.set(side * 0.22, 0.98, 0.355)
      root.add(robeCoin)
    }

    // 雙臂合捧大金元寶
    for (const side of [-1, 1]) {
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.38, 14), clayRed)
      sleeve.position.set(side * 0.32, 0.9, 0.2)
      sleeve.rotation.set(0.78, 0, -side * 0.48)
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 10), claySkin)
      hand.position.set(side * 0.16, 0.86, 0.36)
      root.add(sleeve, hand)
    }

    // 胸前發光大金元寶 (Glowing Golden Ingot)
    const ingotGroup = new THREE.Group()
    ingotGroup.position.set(0, 0.92, 0.4)
    const ingotBoat = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.14, 0.14, 16), ingotGlowMat)
    ingotBoat.scale.set(1.35, 1, 0.78)
    const ingotBump = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 12), ingotGlowMat)
    ingotBump.scale.set(1.15, 0.85, 0.85)
    ingotBump.position.y = 0.07
    const ingotRim = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.018, 8, 16), brightGold)
    ingotRim.rotation.x = Math.PI / 2
    ingotRim.position.y = 0.035
    ingotGroup.add(ingotBoat, ingotBump, ingotRim)
    root.add(ingotGroup)

    // 3. Q 版喜氣財神大頭與展翅財神官帽
    const head = new THREE.Group()
    head.position.set(0, 1.62, 0.03)

    const face = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 20), claySkin)
    face.scale.set(1.06, 0.96, 0.96)
    head.add(face)

    // 喜氣彎彎笑眼與蜜桃腮紅
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(
        new THREE.TorusGeometry(0.065, 0.015, 8, 14, Math.PI * 0.85),
        clayDark
      )
      eye.rotation.set(-0.1, side * 0.2, 0)
      eye.position.set(side * 0.14, 0.04, 0.415)

      const blush = new THREE.Mesh(
        new THREE.CircleGeometry(0.068, 14),
        new THREE.MeshBasicMaterial({ color: '#f59c8e', transparent: true, opacity: 0.78 })
      )
      blush.position.set(side * 0.23, -0.05, 0.39)
      blush.rotation.y = side * 0.42
      head.add(eye, blush)
    }

    // 可愛翹八字鬍與圓潤福鬚
    for (const side of [-1, 1]) {
      const mustache = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), clayDark)
      mustache.scale.set(1.4, 0.52, 0.6)
      mustache.position.set(side * 0.09, -0.08, 0.42)
      mustache.rotation.z = side * 0.28
      head.add(mustache)
    }
    const chinBeard = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.22, 10), clayDark)
    chinBeard.rotation.x = Math.PI
    chinBeard.scale.set(1, 1, 0.55)
    chinBeard.position.set(0, -0.24, 0.41)
    head.add(chinBeard)

    // 展翅宰相財神官帽 (Winged Cai Shen Official Hat)
    const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.43, 0.14, 20), clayRed)
    hatBrim.position.set(0, 0.28, -0.01)
    const hatGoldBand = new THREE.Mesh(new THREE.CylinderGeometry(0.41, 0.435, 0.05, 20), clayGold)
    hatGoldBand.position.set(0, 0.23, -0.01)
    const hatCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.24, 18), clayRed)
    hatCrown.position.set(0, 0.44, -0.04)
    const hatGem = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), ingotGlowMat)
    hatGem.position.set(0, 0.36, 0.34)
    head.add(hatBrim, hatGoldBand, hatCrown, hatGem)

    for (let i = -2; i <= 2; i++) {
      const hatStud = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), brightGold)
      hatStud.position.set(i * 0.085, 0.24, 0.34)
      head.add(hatStud)
    }

    // 左右水平展翅金葉帽翅
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.04), clayGold)
      wing.position.set(side * 0.54, 0.34, -0.04)
      wing.rotation.z = side * 0.12
      const wingTip = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), clayPeach)
      wingTip.scale.set(1, 1, 0.45)
      wingTip.position.set(side * 0.74, 0.36, -0.04)
      head.add(wing, wingTip)
    }

    root.add(head)

    // 4. 暖金財氣背光輪
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.65, 1.12, 32),
      new THREE.MeshBasicMaterial({ color: '#ffe294', transparent: true, opacity: 0.46, side: THREE.DoubleSide })
    )
    halo.position.set(0, 1.48, -0.29)
    root.add(halo)

    // Coin-like aureole details frame the official cap without hiding the face.
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2
      const coin = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.014, 8, 12), brightGold)
      coin.position.set(Math.cos(angle) * 0.94, 1.48 + Math.sin(angle) * 0.94, -0.305)
      root.add(coin)
    }

    this.replaceDeityWithPortrait(root, './assets/caishen-golden-v2.png', 2.1, 2.57, 1.48, -0.1)

    root.traverse(obj => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true
        obj.receiveShadow = true
      }
    })
    return root
  }

  /**
   * 【虎邊陪祀（左側）】3D 啞光黏土 Q 版月下老人（Chibi Matte-Clay Yue Lao - God of Marriage & Love）
   * - 慈祥白眉白鬚仙翁笑臉、粉嫩蜜桃腮紅、蜜桃粉與奶油白仙袍
   * - 一手捧姻緣簿、雙手牽發光姻緣紅線（Glowing Red Thread of Fate）、身側倚桃花仙杖
   */
  private createYueLaoStatue(): THREE.Group {
    const root = new THREE.Group()

    const clayPeach = makeMat('#dd796d', 0.48, 0.14)
    const clayPeachLight = makeMat('#f3c3aa', 0.52, 0.18)
    const clayCream = makeMat('#f8efd7', 0.5, 0.2)
    const clayGold = makeMat('#d8a62e', 0.24, 0.84)
    const brightGold = makeMat('#ffe6a0', 0.17, 0.92)
    brightGold.emissive.set('#754808')
    brightGold.emissiveIntensity = 0.16
    const claySkin = makeMat('#fde6d5', 0.92, 0.01)
    const clayWhiteHair = makeMat('#fcf9f2', 0.94, 0.01)
    const clayDark = makeMat('#3a2720', 0.92, 0.01)

    // 發光姻緣紅線材質
    const redThreadMat = makeMat('#ff3b52', 0.4, 0.1)
    redThreadMat.emissive.set('#ff2442')
    redThreadMat.emissiveIntensity = 0.85

    // 1. 蜜桃粉與奶油白祥雲瑞蓮座
    const base1 = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.94, 0.2, 20), clayGold)
    base1.position.y = 0.1
    const base2 = new THREE.Mesh(new THREE.CylinderGeometry(0.74, 0.8, 0.22, 20), clayPeachLight)
    base2.position.y = 0.28
    root.add(base1, base2)

    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2
      const cloudPetal = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), clayPeach)
      cloudPetal.scale.set(1.1, 0.95, 0.6)
      cloudPetal.position.set(Math.cos(ang) * 0.78, 0.28, Math.sin(ang) * 0.78)
      root.add(cloudPetal)
    }

    // 2. Q 版仙翁盤坐身姿與蜜桃粉奶油白仙袍
    const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.62, 0.28, 20), clayCream)
    legs.scale.set(1.15, 1, 0.88)
    legs.position.set(0, 0.52, 0.03)
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.46, 0.62, 20), clayPeach)
    torso.position.set(0, 0.92, 0)
    const sash = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.04, 10, 22), clayGold)
    sash.rotation.x = Math.PI / 2
    sash.position.set(0, 0.82, 0.02)
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.042, 8, 18), clayCream)
    collar.rotation.x = Math.PI / 2 + 0.2
    collar.position.set(0, 1.18, 0.06)
    root.add(legs, torso, sash, collar)

    // Gilded cloud medallions distinguish Yue Lao's peach robe while keeping its
    // traditional warm, auspicious palette and red-thread identity.
    for (const x of [-0.18, 0, 0.18]) {
      const cloudMedallion = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 8), brightGold)
      cloudMedallion.scale.set(1.35, 0.72, 0.36)
      cloudMedallion.position.set(x, 1.02, 0.356)
      root.add(cloudMedallion)
    }

    // 雙臂：左手捧「姻緣簿」，雙手間牽發光姻緣紅線
    for (const side of [-1, 1]) {
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.38, 14), clayPeach)
      sleeve.position.set(side * 0.32, 0.9, 0.2)
      sleeve.rotation.set(0.75, 0, -side * 0.42)
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 10), claySkin)
      hand.position.set(side * 0.18, 0.86, 0.36)
      root.add(sleeve, hand)
    }

    // 朱紅金邊「姻緣簿」與發光姻緣紅線 (Book of Destiny & Glowing Red Thread)
    const book = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.06), makeMat('#c93b35', 0.85))
    book.position.set(-0.16, 0.94, 0.4)
    book.rotation.set(-0.35, 0.25, 0.15)
    const bookGoldCover = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.065), clayGold)
    bookGoldCover.position.copy(book.position)
    bookGoldCover.rotation.copy(book.rotation)
    root.add(book, bookGoldCover)

    const bookSeal = new THREE.Mesh(new THREE.CircleGeometry(0.032, 12), brightGold)
    bookSeal.position.copy(book.position)
    bookSeal.position.z += 0.034
    bookSeal.position.x += 0.02
    bookSeal.rotation.copy(book.rotation)
    root.add(bookSeal)

    // 雙手之間垂弧發光姻緣紅線與同心紅結
    const redThreadArc = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.018, 8, 20, Math.PI),
      redThreadMat
    )
    redThreadArc.rotation.z = Math.PI
    redThreadArc.position.set(0, 0.9, 0.42)
    const heartKnot = new THREE.Mesh(new THREE.OctahedronGeometry(0.055, 1), redThreadMat)
    heartKnot.position.set(0, 0.72, 0.43)
    root.add(redThreadArc, heartKnot)

    // 身旁斜倚盛開桃花仙杖 (Peach Blossom Staff)
    const staffPole = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.038, 1.55, 10), makeMat('#8c5d3c', 0.9))
    staffPole.position.set(0.46, 1.12, 0.22)
    staffPole.rotation.set(0.12, 0, -0.16)
    root.add(staffPole)
    for (const [bx, by, bz] of [[0.56, 1.84, 0.3], [0.48, 1.92, 0.26], [0.62, 1.76, 0.24]] as const) {
      const blossom = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), clayPeach)
      blossom.position.set(bx, by, bz)
      root.add(blossom)
    }

    // 3. Q 版慈祥白眉白鬚仙翁大頭與逍遙仙冠
    const head = new THREE.Group()
    head.position.set(0, 1.62, 0.03)

    const face = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 20), claySkin)
    face.scale.set(1.04, 0.97, 0.96)
    head.add(face)

    // 雪白髮罩、道髻與暖金紅玉逍遙冠
    const hairCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.44, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.55),
      clayWhiteHair
    )
    hairCap.rotation.x = 0.35
    hairCap.position.set(0, 0.03, -0.03)
    const topBun = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), clayWhiteHair)
    topBun.position.set(0, 0.46, -0.03)
    const crownRing = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.21, 0.12, 16), clayGold)
    crownRing.position.set(0, 0.42, -0.02)
    const crownRuby = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 8), redThreadMat)
    crownRuby.position.set(0, 0.44, 0.18)
    head.add(hairCap, topBun, crownRing, crownRuby)

    for (let i = -2; i <= 2; i++) {
      const crownStud = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), brightGold)
      crownStud.position.set(i * 0.062, 0.42, 0.19)
      head.add(crownStud)
    }

    // 蓬鬆雪白長眉、溫柔笑眼與粉嫩蜜桃腮紅
    for (const side of [-1, 1]) {
      const whiteBrow = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10), clayWhiteHair)
      whiteBrow.scale.set(1.6, 0.52, 0.65)
      whiteBrow.position.set(side * 0.15, 0.14, 0.415)
      whiteBrow.rotation.z = -side * 0.22

      const eye = new THREE.Mesh(
        new THREE.TorusGeometry(0.062, 0.015, 8, 14, Math.PI * 0.85),
        clayDark
      )
      eye.rotation.set(-0.1, side * 0.2, 0)
      eye.position.set(side * 0.14, 0.03, 0.415)

      const blush = new THREE.Mesh(
        new THREE.CircleGeometry(0.072, 14),
        new THREE.MeshBasicMaterial({ color: '#f69e92', transparent: true, opacity: 0.8 })
      )
      blush.position.set(side * 0.23, -0.05, 0.39)
      blush.rotation.y = side * 0.42
      head.add(whiteBrow, eye, blush)
    }

    // 圓滾滾蓬鬆雪白長仙鬚
    const beardUpper = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), clayWhiteHair)
    beardUpper.scale.set(1.3, 0.85, 0.65)
    beardUpper.position.set(0, -0.18, 0.4)
    const beardLower = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 14), clayWhiteHair)
    beardLower.rotation.x = Math.PI
    beardLower.scale.set(1.1, 1, 0.62)
    beardLower.position.set(0, -0.35, 0.39)
    head.add(beardUpper, beardLower)

    root.add(head)

    // 4. 蜜桃暖金柔和背光輪
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.65, 1.12, 32),
      new THREE.MeshBasicMaterial({ color: '#ffd6c4', transparent: true, opacity: 0.46, side: THREE.DoubleSide })
    )
    halo.position.set(0, 1.48, -0.29)
    root.add(halo)

    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2
      const petal = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 8), brightGold)
      petal.scale.set(1.35, 0.75, 0.4)
      petal.position.set(Math.cos(angle) * 0.94, 1.48 + Math.sin(angle) * 0.94, -0.305)
      petal.rotation.z = angle
      root.add(petal)
    }

    this.replaceDeityWithPortrait(root, './assets/yuelao-golden-v2.png', 1.92, 2.88, 1.56, -0.1)

    root.traverse(obj => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true
        obj.receiveShadow = true
      }
    })
    return root
  }

  /**
   * 大殿內部 Q 版啞光黏土微縮場景（3D Miniature Diorama Main Hall Interior）
   * - 奶油白（Pastel Cream）、蜜桃粉（Soft Peach）與暖金色（Warm Gold）啞光黏土配色
   * - 三聖神龕雕花背屏與匾額（觀音、財神、月老）
   * - 神桌精緻供品（蜜桃粉蓮花瓶、壽桃塔、財神聚寶盆金元寶、月老桃花瓶與同心紅線結）
   * - 內堂中央三足雙耳古銅香爐
   * - 兩側懸掛圓潤發光蜜桃金燈籠與溫暖電影級打光
   * - 整齊排列的 6 座紅金拜墊，每座拜墊精準跪坐 1 位 Pop Mart 風格 Q 版信眾（部分手持發光線香與柔和香煙）
   */
  private addMainHallDiorama(hall: THREE.Group): void {
    const clayCream = makeMat('#f6eee2', 0.94, 0.01)
    const clayCreamTile = makeMat('#f3e8d8', 0.94, 0.01)
    const clayPeach = makeMat('#f2b2a2', 0.9, 0.02)
    const clayPeachSoft = makeMat('#f9d6cb', 0.9, 0.01)
    const clayGold = makeMat('#e5b968', 0.78, 0.14)
    const clayWarmWood = makeMat('#dcbe94', 0.9, 0.02)
    const clayCushionRed = makeMat('#d6493a', 0.9, 0.02)
    const clayBronze = makeMat('#9c7344', 0.65, 0.25)

    // =========================================================================
    // 1. 奶油白啞光黏土大殿地坪、中央暖木參拜御道與案前蜜桃金迎神地毯
    // =========================================================================
    const creamFloor = new THREE.Mesh(new THREE.BoxGeometry(17.6, 0.016, 10.6), clayCreamTile)
    creamFloor.position.set(0, 0.282, -0.4)
    creamFloor.receiveShadow = true
    hall.add(creamFloor)

    // 中央暖木參拜御道（連接殿門至內堂香爐，如微縮場景圖中央木棧道）
    const woodRunner = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.022, 7.2), clayWarmWood)
    woodRunner.position.set(0, 0.286, 0.75)
    woodRunner.receiveShadow = true
    hall.add(woodRunner)

    // 神桌前蜜桃粉與暖金雕花祈福地毯
    const carpetBorder = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.02, 1.55), clayGold)
    carpetBorder.position.set(0, 0.285, -3.28)
    const carpetInner = new THREE.Mesh(new THREE.BoxGeometry(4.56, 0.024, 1.35), clayPeachSoft)
    carpetInner.position.set(0, 0.287, -3.28)
    carpetBorder.receiveShadow = true
    carpetInner.receiveShadow = true
    hall.add(carpetBorder, carpetInner)

    // =========================================================================
    // 2. 三聖神龕奶油白與暖金雕花背屏、內殿額匾與對聯掛軸
    // =========================================================================
    const screenBacking = new THREE.Mesh(new THREE.BoxGeometry(7.9, 5.6, 0.12), clayCream)
    screenBacking.position.set(0, 3.1, -6.04)
    hall.add(screenBacking)

    // 四根暖金雕花神龕界柱（將背屏劃分為：左月老龕、中觀音龕、右財神龕）
    for (const sx of [-3.35, -1.18, 1.18, 3.35]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 4.75, 12), clayGold)
      post.position.set(sx, 2.65, -5.96)
      hall.add(post)
    }

    // 神龕上方三面內殿匾額（奶油底深褐金字／朱紅金字）
    const innerPlaques: { x: number; y: number; w: number; h: number; text: string; fg: string; bg: string }[] = [
      { x: 0, y: 4.58, w: 2.15, h: 0.66, text: '觀 音 殿', fg: '#5a3a22', bg: '#f6ebd8' },
      { x: 2.25, y: 4.45, w: 1.95, h: 0.56, text: '天 官 武 財 神', fg: '#fce29c', bg: '#9e3326' },
      { x: -2.25, y: 4.45, w: 1.95, h: 0.56, text: '月 下 老 人', fg: '#fff0eb', bg: '#c95b58' },
    ]
    for (const p of innerPlaques) {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(p.w + 0.16, p.h + 0.14, 0.1), clayGold)
      frame.position.set(p.x, p.y, -5.92)
      const face = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.h), this.textMaterial(p.text, p.fg, p.bg))
      face.position.set(p.x, p.y, -5.86)
      hall.add(frame, face)
    }

    // =========================================================================
    // 3. 神桌案上三聖專屬啞光黏土供品（觀音蓮花壽桃、財神聚寶盆元寶、月老桃花紅線）
    // =========================================================================
    const altarY = 1.67
    const altarZ = -4.35

    // (A) 中央觀音菩薩案前：小金香爐、雙側蜜桃粉蓮花花瓶、奶油蜜桃壽桃盤、暖光粉蓮燭台
    const miniCenser = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.22, 16), clayGold)
    miniCenser.position.set(0, altarY + 0.11, altarZ + 0.22)
    hall.add(miniCenser)
    for (const dx of [-0.05, 0, 0.05]) {
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.28, 6), clayWarmWood)
      stick.position.set(dx, altarY + 0.28, altarZ + 0.22)
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffb84d' }))
      tip.position.set(dx, altarY + 0.43, altarZ + 0.22)
      hall.add(stick, tip)
    }

    // 雙側奶油白瓷蜜桃蓮花花瓶
    for (const side of [-1, 1]) {
      const vx = side * 1.18
      const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.42, 16), clayCream)
      vase.position.set(vx, altarY + 0.21, altarZ - 0.1)
      hall.add(vase)
      for (const [ox, oy, oz] of [[0, 0.48, 0], [-0.1, 0.44, 0.06], [0.1, 0.45, -0.05]] as const) {
        const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), clayPeach)
        bloom.position.set(vx + ox, altarY + oy, altarZ - 0.1 + oz)
        hall.add(bloom)
      }
      // 暖光蠟燭台
      const candleHolder = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.14, 12), clayGold)
      candleHolder.position.set(side * 0.72, altarY + 0.07, altarZ + 0.18)
      const candleBody = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.048, 0.26, 12), clayPeach)
      candleBody.position.set(side * 0.72, altarY + 0.24, altarZ + 0.18)
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.09, 8), new THREE.MeshBasicMaterial({ color: '#ffcf66' }))
      flame.position.set(side * 0.72, altarY + 0.41, altarZ + 0.18)
      hall.add(candleHolder, candleBody, flame)
    }

    // 奶油蜜桃壽桃供盤
    const peachPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.06, 16), clayGold)
    peachPlate.position.set(0.42, altarY + 0.03, altarZ - 0.05)
    hall.add(peachPlate)
    for (const [px, py, pz] of [[0, 0.11, 0], [-0.09, 0.1, 0.07], [0.09, 0.1, 0.07], [0, 0.2, 0.03]] as const) {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), clayPeachSoft)
      bun.position.set(0.42 + px, altarY + py, altarZ - 0.05 + pz)
      hall.add(bun)
    }

    // (B) 龍邊（右側 x = +2.48）財神爺案前：招財聚寶盆與發光小金元寶堆
    const treasureBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.22, 0.24, 18), clayGold)
    treasureBowl.position.set(2.48, altarY + 0.12, altarZ + 0.1)
    hall.add(treasureBowl)
    const goldIngotMat = makeMat('#ffd768', 0.45, 0.25)
    goldIngotMat.emissive.set('#ffa622')
    goldIngotMat.emissiveIntensity = 0.5
    for (const [ix, iy, iz] of [[0, 0.27, 0], [-0.12, 0.24, 0.08], [0.12, 0.24, 0.08], [0, 0.25, -0.1]] as const) {
      const miniIngot = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), goldIngotMat)
      miniIngot.scale.set(1.3, 0.75, 0.85)
      miniIngot.position.set(2.48 + ix, altarY + iy, altarZ + 0.1 + iz)
      hall.add(miniIngot)
    }

    // (C) 虎邊（左側 x = -2.48）月下老人案前：盛開桃花白玉瓶與發光同心紅線結
    const peachVase = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.38, 16), clayCream)
    peachVase.position.set(-2.78, altarY + 0.19, altarZ + 0.02)
    hall.add(peachVase)
    for (const [bx, by, bz] of [[0, 0.45, 0], [-0.09, 0.41, 0.06], [0.09, 0.42, -0.05]] as const) {
      const pFlower = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 8), clayPeach)
      pFlower.position.set(-2.78 + bx, altarY + by, altarZ + 0.02 + bz)
      hall.add(pFlower)
    }
    const knotMat = makeMat('#ff3b52', 0.5, 0.1)
    knotMat.emissive.set('#ff2442')
    knotMat.emissiveIntensity = 0.65
    const loveKnot = new THREE.Mesh(new THREE.TorusKnotGeometry(0.11, 0.028, 36, 8), knotMat)
    loveKnot.rotation.x = -Math.PI / 4
    loveKnot.position.set(-2.22, altarY + 0.14, altarZ + 0.15)
    hall.add(loveKnot)

    // =========================================================================
    // 4. 內堂中央三足雙耳古銅大香爐（如微縮場景圖正中央，插發光清香與蓮花）
    // =========================================================================
    const hallUrn = new THREE.Group()
    hallUrn.position.set(0, 0.285, -2.95)
    const urnBelly = new THREE.Mesh(new THREE.SphereGeometry(0.46, 20, 16), clayBronze)
    urnBelly.scale.set(1.1, 0.85, 1.1)
    urnBelly.position.y = 0.46
    const urnNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.38, 0.16, 20), clayGold)
    urnNeck.position.y = 0.78
    hallUrn.add(urnBelly, urnNeck)

    // 三足圓腿與雙耳提把
    for (let i = 0; i < 3; i++) {
      const ang = (i / 3) * Math.PI * 2 + Math.PI / 6
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.065, 0.28, 10), clayBronze)
      leg.position.set(Math.cos(ang) * 0.32, 0.14, Math.sin(ang) * 0.32)
      hallUrn.add(leg)
    }
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.036, 8, 16, Math.PI * 1.2), clayGold)
      ear.position.set(side * 0.46, 0.64, 0)
      ear.rotation.z = -side * 0.3
      hallUrn.add(ear)
    }
    // 爐內發光清香與粉白蓮花飾
    for (const dx of [-0.08, 0, 0.08]) {
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 6), clayWarmWood)
      stick.position.set(dx, 1.02, 0)
      const ember = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffb84d' }))
      ember.position.set(dx, 1.24, 0)
      hallUrn.add(stick, ember)
    }
    hall.add(hallUrn)
    // 記錄世界座標香煙發射點 (hall.position.z = -7)
    this.mainHallSmokeSpots.push(new THREE.Vector3(0, 1.55, -2.95 - 7))
    this.mainHallSmokeSpots.push(new THREE.Vector3(0, 2.15, -4.15 - 7))

    // =========================================================================
    // 5. 大殿內部懸掛圓潤發光蜜桃暖金燈籠與電影級柔和暖光 (Glowing Diorama Lanterns)
    // =========================================================================
    const lanternGlowMat = makeMat('#ffbfa0', 0.45, 0.05)
    lanternGlowMat.emissive.set('#ff9248')
    lanternGlowMat.emissiveIntensity = 0.92

    const interiorLanternPositions: [number, number, number][] = [
      [-3.85, 3.85, -2.6],
      [-4.65, 3.85, -0.8],
      [-5.35, 3.85, 1.0],
      [3.85, 3.85, -2.6],
      [4.65, 3.85, -0.8],
      [5.35, 3.85, 1.0],
    ]
    for (const [lx, ly, lz] of interiorLanternPositions) {
      const lg = new THREE.Group()
      lg.position.set(lx, ly, lz)
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.3, 6), clayGold)
      cord.position.y = 0.85
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 14), lanternGlowMat)
      sphere.scale.set(1.08, 0.92, 1.08)
      const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.08, 14), clayGold)
      capTop.position.y = 0.32
      const capBot = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.08, 14), clayGold)
      capBot.position.y = -0.32
      const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.32, 8), clayCushionRed)
      tassel.rotation.x = Math.PI
      tassel.position.y = -0.52
      lg.add(cord, sphere, capTop, capBot, tassel)
      hall.add(lg)
    }

    // =========================================================================
    // 6. 整齊排列的 6 座紅色拜墊 ＋ 動態輪替 Q 版參拜信眾 (6 Cushions & Dynamic Worshippers)
    //    NPC 拜拜約 5~20 秒後隨機禮成離開，拜墊保持空位供使用者隨時跪下拜拜祈福
    // =========================================================================
    const cushionLayouts: {
      x: number
      z: number
      heading: number
    }[] = [
      // 左側 3 座拜墊（朝向觀音與月下老人）
      { x: -1.85, z: -2.4, heading: Math.PI - 0.08 },
      { x: -3.25, z: -2.4, heading: Math.PI + 0.06 },
      { x: -2.55, z: -0.95, heading: Math.PI - 0.05 },
      // 右側 3 座拜墊（朝向觀音與財神爺）
      { x: 1.85, z: -2.4, heading: Math.PI + 0.08 },
      { x: 3.25, z: -2.4, heading: Math.PI - 0.06 },
      { x: 2.55, z: -0.95, heading: Math.PI + 0.05 },
    ]

    cushionLayouts.forEach((spec, idx) => {
      const unit = new THREE.Group()
      unit.position.set(spec.x, 0.285, spec.z)
      unit.rotation.y = spec.heading

      // (1) 圓潤朱紅鑲金邊啞光黏土拜墊 (Neatly Arranged Red Prayer Cushion)
      const cushionCore = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.5, 0.14, 24), clayCushionRed)
      cushionCore.position.y = 0.07
      cushionCore.userData = { cushionIndex: idx }
      const cushionRim = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.065, 12, 24), clayCushionRed)
      cushionRim.rotation.x = Math.PI / 2
      cushionRim.position.y = 0.07
      cushionRim.userData = { cushionIndex: idx }
      const goldStitch = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.015, 8, 24), clayGold)
      goldStitch.rotation.x = Math.PI / 2
      goldStitch.position.y = 0.14
      unit.add(cushionCore, cushionRim, goldStitch)

      // 拜墊四角金色小流蘇結
      for (let c = 0; c < 4; c++) {
        const cAng = (c / 4) * Math.PI * 2 + Math.PI / 4
        const knot = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 8), clayGold)
        knot.position.set(Math.cos(cAng) * 0.49, 0.05, Math.sin(cAng) * 0.49)
        unit.add(knot)
      }

      // 空拜墊周圍柔和金色蓮華光圈（呼吸光暈提示玩家此處為空位可跪拜）
      const glowRingMat = new THREE.MeshBasicMaterial({ color: '#ffcf66', transparent: true, opacity: 0, depthWrite: false })
      const glowRing = new THREE.Mesh(new THREE.RingGeometry(0.48, 0.6, 24), glowRingMat)
      glowRing.rotation.x = -Math.PI / 2
      glowRing.position.y = 0.02
      unit.add(glowRing)

      const worldX = spec.x * this.mainHallScale
      const worldZ = this.mainHallZ + spec.z * this.mainHallScale

      this.cushionSlots.push({
        index: idx,
        x: spec.x,
        z: spec.z,
        worldX,
        worldZ,
        heading: spec.heading,
        cushionGroup: unit,
        glowRing,
        state: 'empty',
        timer: 0,
        leaveDuration: 0,
      })

      unit.traverse(obj => {
        if (obj instanceof THREE.Mesh) {
          obj.castShadow = true
          obj.receiveShadow = true
        }
      })

      hall.add(unit)
      // 拜墊為柔軟坐墊，不阻礙玩家走動與跪拜（中央御道與兩側通道完全通暢無穿牆卡頓）
    })
  }

  private addGiantDragonGuanyin(): void {
    const pos = DRAGON_GUANYIN_POS
    const root = new THREE.Group()
    root.position.copy(pos)

    const goldMat = makeMat('#d4af37', 0.35, 0.45)
    const vermilionMat = makeMat('#962d22', 0.72)

    // 1. 實體物理碰撞（直徑約 5.0m 圓柱，對齊 Q 版潮玩聖像底座範圍，防止玩家穿透聖像）
    const lotusThroneHeight = 2.86
    // The procedural lotus throne is the object's physical footprint. Its top
    // aligns with the 2D figure's feet, so visitors cannot walk through the
    // visible base or make the sprite appear unsupported.
    this.physics.addStaticCylinder(new THREE.Vector3(pos.x, pos.y + lotusThroneHeight / 2, pos.z), 3.1, lotusThroneHeight)

    // 2. 巨型透明材質立牌（全新 Q 版潮玩手辦風・乘龍白衣觀音聖像）
    const W = 10
    // 依據全新乘龍觀音素材預設計算高度（長寬比 877 / 550 ≈ 1.5945），確保初次建立即維持直式比例
    // New source image is 1084 × 1451; it includes the complete lotus base.
    let H = W * (1451 / 1084)

    const planeMat = new THREE.MeshBasicMaterial({
      transparent: true,
      // Suppress the faint low-alpha remnants from background extraction.
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      depthWrite: true,
    })

    // The source image is transparent RGBA and its lotus base reaches the bottom
    // pixel.  Anchor that bottom edge at local y = 0, which is the top surface of
    // the ascending-dragon platform (DRAGON_GUANYIN_POS.y), rather than applying
    // the old visual 25% downward offset.
    const statueSprite = new THREE.Group()
    // Replace the image's rounded painted base with a real 3D lotus throne.
    const lotusBase = new THREE.Group()
    const lotusStone = makeMat('#c69a58', 0.52, 0.16)
    const lotusGold = makeMat('#d9ae61', 0.38, 0.26)
    const lotusPink = makeMat('#e9a994', 0.62, 0.05)
    const addLotusTier = (topRadius: number, bottomRadius: number, height: number, y: number, material: THREE.Material) => {
      const tier = new THREE.Mesh(new THREE.CylinderGeometry(topRadius, bottomRadius, height, 48), material)
      tier.position.y = y
      tier.castShadow = true
      tier.receiveShadow = true
      lotusBase.add(tier)
    }
    addLotusTier(3.18, 3.42, 0.38, 0.19, lotusStone)
    addLotusTier(2.92, 3.18, 0.22, 0.49, lotusGold)
    addLotusTier(2.42, 2.72, 0.52, 0.86, lotusStone)
    // Bridge the petal ring to the top support so the throne is one continuous solid.
    addLotusTier(2.1, 2.32, 0.42, 2.39, lotusGold)
    // Top support surface: 2.73 + 0.13 = the 2.86 m physical/contact height.
    addLotusTier(1.72, 1.96, 0.26, 2.73, lotusStone)
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2
      const petal = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), lotusPink)
      petal.scale.set(0.46, 0.72, 0.22)
      petal.position.set(Math.cos(angle) * 2.2, 1.45, Math.sin(angle) * 2.2)
      petal.rotation.set(0.15 * Math.sin(angle), -angle, 0.26 * Math.cos(angle))
      petal.castShadow = true
      petal.receiveShadow = true
      lotusBase.add(petal)
    }
    // The supplied image carries its own lotus base, so do not render the old
    // procedural base underneath it. The matching physical collider remains.
    const guanyinMesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), planeMat)
    // Pin the bottom of the complete lotus image to the platform surface.
    guanyinMesh.position.set(0, H / 2, 0)
    guanyinMesh.castShadow = true
    statueSprite.add(guanyinMesh)
    this.dragonGuanyinBillboard = statueSprite

    const applyTexture = (tex: THREE.Texture) => {
      tex.colorSpace = THREE.SRGBColorSpace
      tex.needsUpdate = true
      // 動態鎖定圖片正確長寬比（直式）：取得圖片原始尺寸動態計算高度 H = W * (height / width)
      const img = tex.image as HTMLImageElement | undefined
      if (img && img.width && img.height) {
        const cropHeight = img.height
        const bodyCanvas = document.createElement('canvas')
        bodyCanvas.width = img.width
        bodyCanvas.height = cropHeight
        const bodyCtx = bodyCanvas.getContext('2d')
        if (bodyCtx) {
          // Keep the supplied full-height image, including its own lotus base.
          bodyCtx.drawImage(img, 0, 0)
          // Preserve the complete figure above the waist, then taper to the
          // robe and feet. This removes only the painted side petals/base that
          // would otherwise overlap the real 3D lotus throne.
          bodyCtx.beginPath()
          bodyCtx.moveTo(0, 0)
          bodyCtx.lineTo(img.width, 0)
          bodyCtx.lineTo(img.width, 560)
          // Follow the robe into the feet while excluding every outer lotus
          // petal from the source image. The procedural throne owns that
          // silhouette now, so the two bases cannot visually separate.
          bodyCtx.bezierCurveTo(455, 575, 400, 585, 365, 595)
          bodyCtx.bezierCurveTo(350, 615, 340, 635, 335, cropHeight)
          bodyCtx.lineTo(215, cropHeight)
          bodyCtx.bezierCurveTo(210, 635, 200, 615, 185, 595)
          bodyCtx.bezierCurveTo(150, 585, 95, 575, 0, 560)
          bodyCtx.closePath()
          bodyCtx.clip()
          bodyCtx.drawImage(img, 0, 0, img.width, cropHeight, 0, 0, img.width, cropHeight)
        }
        const bodyTexture = new THREE.CanvasTexture(bodyCanvas)
        bodyTexture.colorSpace = THREE.SRGBColorSpace
        planeMat.map = bodyTexture
        planeMat.needsUpdate = true
        const aspect = cropHeight / img.width
        const dynamicH = W * aspect
        guanyinMesh.geometry.dispose()
        guanyinMesh.geometry = new THREE.PlaneGeometry(W, dynamicH)
        // Preserve the bottom-edge anchor when the actual texture ratio arrives.
        guanyinMesh.position.set(0, dynamicH / 2, 0)
      }
    }

    const loader = new THREE.TextureLoader()
    loader.load('./assets/dragon-guanyin.png', applyTexture)

    // Soft oval contact shadow, horizontally aligned to the platform. It lives in
    // the same anchored group as the sprite, so the contact stays correct when
    // the display scale changes.
    const shadowCanvas = document.createElement('canvas')
    shadowCanvas.width = shadowCanvas.height = 128
    const shadowCtx = shadowCanvas.getContext('2d')
    if (shadowCtx) {
      const gradient = shadowCtx.createRadialGradient(64, 64, 0, 64, 64, 64)
      gradient.addColorStop(0, 'rgba(34, 25, 18, 0.48)')
      gradient.addColorStop(0.55, 'rgba(34, 25, 18, 0.36)')
      gradient.addColorStop(0.82, 'rgba(34, 25, 18, 0.20)')
      gradient.addColorStop(1, 'rgba(34, 25, 18, 0)')
      shadowCtx.fillStyle = gradient
      shadowCtx.fillRect(0, 0, 128, 128)
    }
    const shadowTexture = new THREE.CanvasTexture(shadowCanvas)
    shadowTexture.colorSpace = THREE.SRGBColorSpace
    const groundShadow = new THREE.Mesh(
      // Slightly wider than the visible lotus base so a soft contact edge remains
      // visible around it from elevated as well as eye-level camera angles.
      new THREE.PlaneGeometry(8.4, 3.5),
      new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false })
    )
    groundShadow.rotation.x = -Math.PI / 2
    groundShadow.position.set(0, 0.012, 0)
    groundShadow.renderOrder = 1
    statueSprite.add(groundShadow)
    root.add(statueSprite)

    // 3. 底部青銅九龍香爐、參拜蒲團與香火煙霧（朝向東面小徑階梯來向，貼合底座前緣）
    const urn = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.4, 0.62, 12), makeMat('#523e2b', 0.6, 0.4))
    urn.position.set(2.8, 0.31, 0)
    const urnRim = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.055, 8, 16), goldMat)
    urnRim.rotation.x = Math.PI / 2
    urnRim.position.y = 0.62
    urn.add(urnRim)
    const ember = new THREE.Mesh(new THREE.CircleGeometry(0.46, 12), new THREE.MeshBasicMaterial({ color: '#ff5522' }))
    ember.rotation.x = -Math.PI / 2
    ember.position.y = 0.63
    urn.add(ember)

    // 參拜蒲團（金黃織錦拜墊）
    const cushion = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.12, 16), makeMat('#d4a037', 0.8, 0.2))
    cushion.position.set(3.8, 0.06, 0)
    const cushionTop = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.02, 16), vermilionMat)
    cushionTop.position.set(3.8, 0.125, 0)
    root.add(urn, cushion, cushionTop)
    this.dragonGuanyinUrnPos = new THREE.Vector3(pos.x + 2.8, pos.y + 0.68, pos.z)

    // 4. 金光神聖氛圍燈 (Golden Aura PointLight)
    const auraLight = new THREE.PointLight('#ffe082', 1.4, 16, 2)
    auraLight.position.set(0, 4.5, 0)
    root.add(auraLight)

    // 5. 動態氣場：基座周圍緩慢上升的金色粒子特效 (Golden Ascending Aura Particles)
    const particleCount = 200
    const positions = new Float32Array(particleCount * 3)
    this.auraParticleData = []
    for (let i = 0; i < particleCount; i++) {
      const radius = 0.6 + Math.random() * 3.4
      const angle = Math.random() * Math.PI * 2
      const y = 0.2 + Math.random() * 11.5
      positions[i * 3] = Math.cos(angle) * radius
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = Math.sin(angle) * radius
      this.auraParticleData.push({
        radius,
        angle,
        speed: 0.65 + Math.random() * 0.9,
        rotSpeed: (Math.random() - 0.5) * 0.8,
      })
    }
    const particleGeo = new THREE.BufferGeometry()
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const particleMat = new THREE.PointsMaterial({
      color: '#ffe066',
      size: 0.3,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    this.auraParticles = new THREE.Points(particleGeo, particleMat)
    root.add(this.auraParticles)

    this.scene.add(root)
  }

  private addSkyDome(): void {
    // Atmospheric gradient dome canvas texture: zenith pale-azure to horizon warm-cream
    this.skyCv = document.createElement('canvas')
    this.skyCv.width = 64
    this.skyCv.height = 256
    this.renderSkyGradientWithColors(this.currentSkyStops)
    this.skyTex = new THREE.CanvasTexture(this.skyCv)
    this.skyTex.colorSpace = THREE.SRGBColorSpace

    const domeGeo = new THREE.SphereGeometry(180, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.52)
    const domeMat = new THREE.MeshBasicMaterial({ map: this.skyTex, side: THREE.BackSide, depthWrite: false, fog: false })
    const dome = new THREE.Mesh(domeGeo, domeMat)
    dome.position.set(0, -6, 10)
    this.scene.add(dome)
  }

  private addCelestialObjects(): void {
    this.celestialGroup = new THREE.Group()

    // 1. Sun visual sprite (radiant corona + flare rays + white-hot core)
    const sunCanvas = document.createElement('canvas')
    sunCanvas.width = 256
    sunCanvas.height = 256
    const sCtx = sunCanvas.getContext('2d')
    if (sCtx) {
      const cx = 128, cy = 128
      // Outer solar corona
      const gradCorona = sCtx.createRadialGradient(cx, cy, 30, cx, cy, 126)
      gradCorona.addColorStop(0, 'rgba(255, 255, 255, 1.0)')
      gradCorona.addColorStop(0.2, 'rgba(255, 240, 180, 0.95)')
      gradCorona.addColorStop(0.45, 'rgba(255, 180, 70, 0.60)')
      gradCorona.addColorStop(0.75, 'rgba(255, 110, 30, 0.22)')
      gradCorona.addColorStop(1.0, 'rgba(255, 80, 20, 0)')
      sCtx.fillStyle = gradCorona
      sCtx.beginPath()
      sCtx.arc(cx, cy, 126, 0, Math.PI * 2)
      sCtx.fill()

      // Solar flare rays (12-point delicate flare)
      sCtx.save()
      sCtx.translate(cx, cy)
      sCtx.fillStyle = 'rgba(255, 235, 160, 0.16)'
      for (let i = 0; i < 12; i++) {
        sCtx.rotate(Math.PI / 6)
        sCtx.beginPath()
        sCtx.moveTo(-3, 0)
        sCtx.lineTo(0, 124)
        sCtx.lineTo(3, 0)
        sCtx.closePath()
        sCtx.fill()
      }
      sCtx.restore()

      // Core brilliant disc
      const gradCore = sCtx.createRadialGradient(cx, cy, 0, cx, cy, 40)
      gradCore.addColorStop(0, '#ffffff')
      gradCore.addColorStop(0.75, '#fffef2')
      gradCore.addColorStop(1.0, 'rgba(255, 245, 205, 0.9)')
      sCtx.fillStyle = gradCore
      sCtx.beginPath()
      sCtx.arc(cx, cy, 40, 0, Math.PI * 2)
      sCtx.fill()
    }
    const sunTex = new THREE.CanvasTexture(sunCanvas)
    sunTex.colorSpace = THREE.SRGBColorSpace
    const sunMat = new THREE.SpriteMaterial({
      map: sunTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    })
    this.sunSprite = new THREE.Sprite(sunMat)
    this.sunSprite.scale.set(42, 42, 1)
    this.sunSprite.position.copy(this.currentSunVisualPos)
    ;(this.sunSprite.material as THREE.SpriteMaterial).opacity = this.currentSunVisualOpacity
    this.sunSprite.visible = this.currentSunVisualOpacity > 0.005
    this.celestialGroup.add(this.sunSprite)

    // 2. Real-World Moon sprite (with dynamic lunar phase & craters)
    this.moonCanvas = document.createElement('canvas')
    this.moonCanvas.width = 256
    this.moonCanvas.height = 256
    this.renderMoonCanvas(this.moonCanvas, this.lunarPhaseInfo)
    this.moonTexture = new THREE.CanvasTexture(this.moonCanvas)
    this.moonTexture.colorSpace = THREE.SRGBColorSpace
    const moonMat = new THREE.SpriteMaterial({
      map: this.moonTexture,
      transparent: true,
      depthWrite: false,
      fog: false,
    })
    this.moonSprite = new THREE.Sprite(moonMat)
    this.moonSprite.scale.set(28, 28, 1)
    this.moonSprite.position.copy(this.currentMoonPos)
    ;(this.moonSprite.material as THREE.SpriteMaterial).opacity = this.currentMoonOpacity
    this.moonSprite.visible = this.currentMoonOpacity > 0.005
    this.celestialGroup.add(this.moonSprite)

    this.scene.add(this.celestialGroup)
  }

  private renderMoonCanvas(canvas: HTMLCanvasElement, info: LunarPhaseInfo): void {
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, 256, 256)
    const cx = 128
    const cy = 128
    const r = 68

    // 1. Moonlight corona aura
    const aura = ctx.createRadialGradient(cx, cy, r * 0.72, cx, cy, 126)
    if (info.isMidAutumnFullMoon) {
      aura.addColorStop(0, 'rgba(255, 245, 205, 0.65)')
      aura.addColorStop(0.35, 'rgba(254, 215, 120, 0.32)')
      aura.addColorStop(0.75, 'rgba(245, 158, 11, 0.12)')
      aura.addColorStop(1.0, 'rgba(217, 119, 6, 0)')
    } else {
      aura.addColorStop(0, 'rgba(235, 248, 255, 0.58)')
      aura.addColorStop(0.4, 'rgba(190, 225, 255, 0.25)')
      aura.addColorStop(0.78, 'rgba(150, 195, 255, 0.09)')
      aura.addColorStop(1.0, 'rgba(140, 180, 240, 0)')
    }
    ctx.fillStyle = aura
    ctx.beginPath()
    ctx.arc(cx, cy, 126, 0, Math.PI * 2)
    ctx.fill()

    // 2. Base unlit moon disc (earthshine)
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.closePath()
    ctx.clip()

    ctx.fillStyle = 'rgba(25, 36, 52, 0.38)'
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2)

    // 3. Illuminated portion based on astronomical phase
    const cosP = Math.cos(info.phase * 2 * Math.PI)
    ctx.save()
    ctx.beginPath()
    if (info.phase < 0.5) {
      // Waxing moon: right limb lit
      ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, false)
      ctx.ellipse(cx, cy, Math.max(0.5, Math.abs(cosP) * r), r, 0, Math.PI / 2, -Math.PI / 2, cosP < 0)
    } else {
      // Waning moon: left limb lit
      ctx.arc(cx, cy, r, Math.PI / 2, -Math.PI / 2, false)
      ctx.ellipse(cx, cy, Math.max(0.5, Math.abs(cosP) * r), r, 0, -Math.PI / 2, Math.PI / 2, cosP >= 0)
    }
    ctx.closePath()
    ctx.clip()

    // Illuminated surface
    const litGrad = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, 6, cx, cy, r)
    if (info.isMidAutumnFullMoon) {
      litGrad.addColorStop(0, '#fffdfa')
      litGrad.addColorStop(0.4, '#fef3c7')
      litGrad.addColorStop(0.8, '#fde68a')
      litGrad.addColorStop(1.0, '#f59e0b')
    } else {
      litGrad.addColorStop(0, '#ffffff')
      litGrad.addColorStop(0.45, '#f8fafc')
      litGrad.addColorStop(0.8, '#e2e8f0')
      litGrad.addColorStop(1.0, '#94a3b8')
    }
    ctx.fillStyle = litGrad
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2)

    // Lunar maria (craters & basaltic plains)
    const craters: [number, number, number][] = [
      [-18, -16, 17],
      [16, -22, 15],
      [-24, 14, 19],
      [12, 19, 23],
      [32, 2, 13],
      [-6, 6, 16],
      [2, -32, 12],
      [-22, 32, 14],
      [25, 28, 11],
    ]
    ctx.fillStyle = info.isMidAutumnFullMoon ? 'rgba(217, 119, 6, 0.24)' : 'rgba(100, 116, 139, 0.35)'
    for (const [ox, oy, cr] of craters) {
      ctx.beginPath()
      ctx.arc(cx + ox, cy + oy, cr, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.restore() // Unclip illuminated portion
    ctx.restore() // Unclip base disc
  }

  refreshMoonPhase(date = new Date()): void {
    this.lunarPhaseInfo = getLunarPhaseInfo(date)
    if (this.moonCanvas && this.moonTexture) {
      this.renderMoonCanvas(this.moonCanvas, this.lunarPhaseInfo)
      this.moonTexture.needsUpdate = true
    }
  }

  getLunarPhase(): LunarPhaseInfo {
    return this.lunarPhaseInfo
  }

  private renderSkyGradientWithColors(stops: [THREE.Color, THREE.Color, THREE.Color, THREE.Color]): void {
    if (!this.skyCv) return
    const ctx = this.skyCv.getContext('2d')
    if (!ctx) return
    const grad = ctx.createLinearGradient(0, 0, 0, 256)
    grad.addColorStop(0, '#' + stops[0].getHexString())
    grad.addColorStop(0.35, '#' + stops[1].getHexString())
    grad.addColorStop(0.72, '#' + stops[2].getHexString())
    grad.addColorStop(1, '#' + stops[3].getHexString())
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 64, 256)
  }

  renderSkyGradient(mode: TimeOfDay): void {
    const cfg = TIME_CONFIGS[mode]
    for (let i = 0; i < 4; i++) {
      this.currentSkyStops[i].set(cfg.skyStops[i])
      this.targetSkyStops[i].set(cfg.skyStops[i])
    }
    this.renderSkyGradientWithColors(this.currentSkyStops)
  }

  getTimeSetting(): TimeSetting {
    return this.timeSetting
  }

  getTimeOfDay(): TimeOfDay {
    return this.timeOfDay
  }

  setTimeSetting(setting: TimeSetting, immediate = false): void {
    this.timeSetting = setting
    if (setting === 'auto') {
      const mode = getRealWorldTimeOfDay().mode
      this.timeOfDay = mode
      this.applyTimeConfig(TIME_CONFIGS[mode], immediate)
    } else {
      this.timeOfDay = setting
      this.applyTimeConfig(TIME_CONFIGS[setting], immediate)
    }
  }

  setTimeOfDay(mode: TimeOfDay, immediate = false): void {
    this.setTimeSetting(mode, immediate)
  }

  private applyTimeConfig(cfg: TimeConfig, immediate = false): void {
    this.targetBgColor.set(cfg.bgColor)
    this.targetFogColor.set(cfg.fogColor)
    this.targetFogNear = cfg.fogNear
    this.targetFogFar = cfg.fogFar
    this.targetSunColor.set(cfg.sunColor)
    this.targetSunIntensity = cfg.sunIntensity
    this.targetSunPos.set(...cfg.sunPosition)
    this.targetHemiColor.set(cfg.hemiColor)
    this.targetHemiGroundColor.set(cfg.hemiGroundColor)
    this.targetHemiIntensity = cfg.hemiIntensity
    this.targetCloudColor.set(cfg.cloudColor)
    this.targetCloudOpacity = cfg.cloudOpacity
    this.targetSkyStops[0].set(cfg.skyStops[0])
    this.targetSkyStops[1].set(cfg.skyStops[1])
    this.targetSkyStops[2].set(cfg.skyStops[2])
    this.targetSkyStops[3].set(cfg.skyStops[3])
    this.targetSunVisualOpacity = cfg.sunVisualOpacity
    this.targetSunVisualPos.set(...cfg.sunVisualPos)
    this.targetMoonOpacity = cfg.moonOpacity
    this.targetMoonPos.set(...cfg.moonPos)
    this.targetStarsOpacity = cfg.starsOpacity
    this.targetMilkyWayOpacity = cfg.milkyWayOpacity
    this.isSkyTransitioning = true

    if (immediate) {
      if (this.scene.background instanceof THREE.Color) this.scene.background.copy(this.targetBgColor)
      const fog = this.scene.fog as THREE.Fog
      if (fog) {
        fog.color.copy(this.targetFogColor)
        fog.near = this.targetFogNear
        fog.far = this.targetFogFar
      }
      this.sun.color.copy(this.targetSunColor)
      this.sun.intensity = this.targetSunIntensity
      this.sun.position.copy(this.targetSunPos)
      this.hemiLight.color.copy(this.targetHemiColor)
      this.hemiLight.groundColor.copy(this.targetHemiGroundColor)
      this.hemiLight.intensity = this.targetHemiIntensity
      if (this.cloudMat) {
        this.cloudMat.color.copy(this.targetCloudColor)
        this.cloudMat.opacity = this.targetCloudOpacity
      }
      for (let i = 0; i < 4; i++) {
        this.currentSkyStops[i].copy(this.targetSkyStops[i])
      }
      this.renderSkyGradientWithColors(this.currentSkyStops)
      if (this.skyTex) this.skyTex.needsUpdate = true

      this.currentSunVisualOpacity = cfg.sunVisualOpacity
      this.currentSunVisualPos.set(...cfg.sunVisualPos)
      this.currentMoonOpacity = cfg.moonOpacity
      this.currentMoonPos.set(...cfg.moonPos)
      this.currentStarsOpacity = cfg.starsOpacity
      this.currentMilkyWayOpacity = cfg.milkyWayOpacity

      if (this.sunSprite) {
        this.sunSprite.position.copy(this.currentSunVisualPos)
        ;(this.sunSprite.material as THREE.SpriteMaterial).opacity = this.currentSunVisualOpacity
        this.sunSprite.visible = this.currentSunVisualOpacity > 0.005
      }
      if (this.moonSprite) {
        this.moonSprite.position.copy(this.currentMoonPos)
        ;(this.moonSprite.material as THREE.SpriteMaterial).opacity = this.currentMoonOpacity
        this.moonSprite.visible = this.currentMoonOpacity > 0.005
      }

      this.isSkyTransitioning = false
    }
  }

  private addClouds(): void {
    this.cloudMat = new THREE.MeshBasicMaterial({ color: '#fefcf8', transparent: true, opacity: 0.82, depthWrite: false })
    // Seed clusters of stylized oriental cumulus clouds drifting across the sky
    const configs: [number, number, number, number][] = [
      [-45, 32, -35, 1.2],
      [-15, 36, -42, 0.9],
      [35, 30, -30, 1.1],
      [-50, 28, 12, 1.3],
      [48, 34, 16, 1.0],
      [-30, 31, 46, 1.15],
      [25, 35, 48, 1.25],
      [0, 38, 2, 0.85],
      [-65, 33, -10, 1.05],
      [60, 29, -20, 1.1],
    ]

    for (const [x, y, z, scale] of configs) {
      const g = new THREE.Group()
      // Generate multi-sphere fluffy cloud cluster
      const puffs: [number, number, number, number][] = [
        [0, 0, 0, 3.2],
        [-2.4, -0.4, 0.3, 2.3],
        [2.3, -0.3, -0.2, 2.4],
        [-4.2, -0.8, 0, 1.6],
        [4.0, -0.7, 0.1, 1.7],
        [0.8, 0.9, -0.3, 2.1],
        [-1.1, 0.8, 0.2, 1.9],
      ]
      for (const [px, py, pz, pr] of puffs) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(pr, 10, 8), this.cloudMat)
        puff.position.set(px, py, pz)
        puff.scale.y = 0.62 // Flatter bottoms for floating cloud look
        g.add(puff)
      }
      g.scale.setScalar(scale)
      g.position.set(x, y, z)
      this.scene.add(g)
      this.clouds.push({ mesh: g, speed: 0.45 + Math.random() * 0.35, x, y, z })
    }
  }

  /** Show the procedural chibi standing at the select-screen stand. */
  placeAvatarAtStand(): void {
    this.chibi.root.position.set(STAND.x, 0, STAND.z)
    this.chibi.root.rotation.y = 0
  }
  /** Follow the player: `feet` is the ground point under the capsule, heading in radians (0 = +Z). */
  placeAvatar(feet: THREE.Vector3, heading: number): void {
    this.chibi.root.position.copy(feet)
    this.chibi.root.rotation.y = heading
  }
  animateAvatar(dt: number, time: number, speed: number, reducedMotion: boolean, bow = 0): void { this.chibi.animate(dt, time, speed, reducedMotion, bow) }
  setCharacter(id: string): void { this.chibi.setPalette(id) }
  /** Objects excluded from click picking (the visitor and guidance helpers). */
  get pickIgnore(): THREE.Object3D[] {
    const list: THREE.Object3D[] = [this.avatarStand, this.guideArrow, this.guideBeacon]
    if (this.dragonGuanyinBillboard) list.push(this.dragonGuanyinBillboard)
    if (this.auraParticles) list.push(this.auraParticles)
    if (this.celestialGroup) list.push(this.celestialGroup)
    return list
  }
  /** Point a guide arrow from the visitor toward a station; null hides it. */
  setGuide(from: THREE.Vector3 | null, to: THREE.Vector3 | null, time: number): void {
    const show = !!from && !!to
    this.guideArrow.visible = show
    this.guideBeacon.visible = show
    if (!from || !to) return
    const dir = new THREE.Vector3(to.x - from.x, 0, to.z - from.z)
    const len = dir.length()
    if (len < 0.01) return
    dir.divideScalar(len)
    this.guideArrow.position.set(from.x + dir.x * 2.1, from.y + 0.1, from.z + dir.z * 2.1)
    this.guideArrow.rotation.set(0, Math.atan2(dir.x, dir.z), 0)
    this.guideBeacon.position.set(to.x, to.y, to.z)
    const pulse = 0.55 + Math.sin(time * 4) * 0.15
    ;(this.guideBeacon.material as THREE.MeshBasicMaterial).opacity = pulse * 0.5
  }
  setAvatarVisible(visible: boolean): void { this.avatarStand.visible = visible }

  getNearestEmptyCushion(pos: THREE.Vector3, maxDist = 1.6): CushionSlot | null {
    let nearest: CushionSlot | null = null
    let bestDist = maxDist
    for (const slot of this.cushionSlots) {
      if (slot.state !== 'empty') continue
      const d = Math.hypot(slot.worldX - pos.x, slot.worldZ - pos.z)
      if (d < bestDist) {
        bestDist = d
        nearest = slot
      }
    }
    return nearest
  }

  getCushionByIndex(idx: number): CushionSlot | undefined {
    return this.cushionSlots.find(s => s.index === idx)
  }

  setPlayerOnCushion(slotIndex: number, active: boolean): void {
    const slot = this.getCushionByIndex(slotIndex)
    if (!slot) return
    if (active) {
      slot.state = 'player'
      ;(slot.glowRing.material as THREE.MeshBasicMaterial).opacity = 0
    } else {
      slot.state = 'empty'
      slot.timer = 0
    }
  }

  getPlayerLanternStand(): THREE.Vector3 {
    return this.courtyard.getPlayerLanternStand()
  }

  triggerPlayerSkyLantern(): boolean {
    return this.courtyard.triggerPlayerSkyLantern()
  }

  isPlayerLanternReady(): boolean {
    return this.courtyard.isPlayerLanternReady()
  }

  nearestPoint(position: THREE.Vector3): ShrinePoint | null {
    // 優先檢查是否靠近觀音殿前空著的紅色拜墊（跪拜祈福）
    const emptyCushion = this.getNearestEmptyCushion(position, 1.45)
    if (emptyCushion) {
      return {
        id: 'cushion',
        title: '觀音拜墊・跪拜祈福',
        subtitle: '按 E 跪下向觀世音菩薩祈福',
        radius: 1.45,
        position: new THREE.Vector3(emptyCushion.worldX, 0.35, emptyCushion.worldZ),
      }
    }

    // 檢查是否靠近天心仙姑旁的祈福天燈台
    const lanternStand = this.courtyard.getPlayerLanternStand()
    if (lanternStand && Math.hypot(position.x - lanternStand.x, position.z - lanternStand.z) <= 2.2) {
      return {
        id: 'sky-lantern',
        title: '天燈祈福・祈願升空',
        subtitle: this.courtyard.isPlayerLanternReady() ? '按 E 點燃天燈，祈願天心指路' : '祈福天燈冉冉升空中...',
        radius: 2.2,
        position: new THREE.Vector3(lanternStand.x, 0.2, lanternStand.z),
      }
    }

    let nearest: ShrinePoint | null = null
    let best = Infinity
    for (const point of this.points) {
      if (point.id === 'prayer') continue // Consolidated with prayer-wall at the courtyard plaza
      const d = Math.hypot(point.position.x - position.x, point.position.z - position.z)
      if (d <= point.radius && d < best) { nearest = point; best = d }
    }
    // Also support wishing-pool trigger when approaching either the right-side lotus pond (LOTUS_POND) or left-side wish pool (WISH_POOL)
    const wishPoint = this.points.find(p => p.id === 'wishing-pool')
    if (wishPoint) {
      const dLotus = Math.hypot(LOTUS_POND.x - 5.8 - position.x, LOTUS_POND.z - position.z)
      const dWish = Math.hypot(WISH_POOL.x + 3.9 - position.x, WISH_POOL.z - position.z)
      const minD = Math.min(dLotus, dWish)
      if (minD <= 4.8 && minD < best) {
        nearest = wishPoint
        best = minD
      }
    }
    return nearest
  }

  perform(
    action: string,
    offeringCounts?: Partial<Record<OfferingId, number>>,
    options?: { playerPos?: THREE.Vector3; onSplash?: () => void }
  ): void {
    if (action === 'incense' || action === 'wish' || action === 'prayer') {
      this.spawnSmoke(new THREE.Vector3(0, 1.2, -2.6))
      this.incenseGlow.intensity = 0.9
    }
    if (action.startsWith('lamp-')) {
      const id = action.slice(5) as LampId
      const mat = this.lampMats.get(id)
      const light = this.lampLights.get(id)
      const glowCol = id === 'wealth' ? '#ffd700' : id === 'study' ? '#45d8cf' : '#ff9b34'
      const lightCol = id === 'wealth' ? '#ffd84a' : id === 'study' ? '#55e5db' : '#ffaa42'
      if (mat) { mat.emissive.set(glowCol); mat.emissiveIntensity = 0.95 }
      if (light) { light.color.set(lightCol); light.intensity = 1.45 }
    }
    if (action.startsWith('offer-')) {
      const id = action.slice(6) as OfferingId
      this.addOffering(id, offeringCounts?.[id] ?? 1)
    }
    if (action === 'woodfish') this.woodfishImpulse = 0.2
    if (action === 'bell') this.bellImpulse = 0.23
    if (action === 'drum') this.drumImpulse = 0.35
    if (action === 'coin') this.tossWishCoin(options?.playerPos, options?.onSplash)
    if (action === 'lottery') this.spawnSmoke(new THREE.Vector3(-11.8, 1.8, 1.2))
    if (action === 'chess') this.spawnSmoke(new THREE.Vector3(PAVILION.x, 1.2, PAVILION.z))
    if (action === 'yuhuang') { this.spawnSmoke(new THREE.Vector3(0, 2.6, -29.5)) }
    if (action === 'gold-furnace') { this.spawnSmoke(new THREE.Vector3(GOLD_FURNACE.x, 3.2, GOLD_FURNACE.z)) }
    if (action === 'guanyin-dragon') {
      if (this.dragonGuanyinUrnPos) this.spawnSmoke(this.dragonGuanyinUrnPos.clone())
    }
  }

  update(dt: number, time: number, playerPosition: THREE.Vector3, activePoint: ShrinePointId | null, camera?: THREE.Camera): void {
    if (this.marketPortalSwirl) this.marketPortalSwirl.rotation.y += dt * 0.45
    if (this.unicornPortalSwirl) this.unicornPortalSwirl.rotation.y += dt * 0.52
    const frontThresholdZ = this.mainHallZ + 5.28 * this.mainHallScale
    const backWallZ = this.mainHallZ - 6.5 * this.mainHallScale
    const sideWallX = 9.5 * this.mainHallScale
    const insideHall = playerPosition.z < frontThresholdZ && playerPosition.z > backWallZ && Math.abs(playerPosition.x) < sideWallX
    this.roof.visible = !insideHall
    const insideRear = playerPosition.z < -16.5 && playerPosition.z > -33.5 && Math.abs(playerPosition.x) < 12.0
    this.rearRoof.visible = !insideRear
    this.incenseGlow.intensity = THREE.MathUtils.damp(this.incenseGlow.intensity, 0.22, 1.4, dt)
    this.courtyard.update(dt, time)
    this.npcs.update(dt, time, playerPosition, camera)

    // Real-world time auto synchronization check every 5 seconds
    if (this.timeSetting === 'auto') {
      this.realTimeCheckTimer += dt
      if (this.realTimeCheckTimer >= 5) {
        this.realTimeCheckTimer = 0
        const currentReal = getRealWorldTimeOfDay().mode
        if (currentReal !== this.timeOfDay) {
          this.timeOfDay = currentReal
          this.applyTimeConfig(TIME_CONFIGS[currentReal], false)
          this.onTimeOfDayChange?.(currentReal)
        }
      }
    }

    // Smooth environment transition lerping (day, dusk, night, dawn)
    if (this.isSkyTransitioning) {
      const alpha = Math.min(1.0, dt * 2.2)
      if (this.scene.background instanceof THREE.Color) {
        this.scene.background.lerp(this.targetBgColor, alpha)
      }
      const fog = this.scene.fog as THREE.Fog
      if (fog) {
        fog.color.lerp(this.targetFogColor, alpha)
        fog.near = THREE.MathUtils.lerp(fog.near, this.targetFogNear, alpha)
        fog.far = THREE.MathUtils.lerp(fog.far, this.targetFogFar, alpha)
      }
      this.sun.color.lerp(this.targetSunColor, alpha)
      this.sun.intensity = THREE.MathUtils.lerp(this.sun.intensity, this.targetSunIntensity, alpha)
      this.sun.position.lerp(this.targetSunPos, alpha)
      this.hemiLight.color.lerp(this.targetHemiColor, alpha)
      this.hemiLight.groundColor.lerp(this.targetHemiGroundColor, alpha)
      this.hemiLight.intensity = THREE.MathUtils.lerp(this.hemiLight.intensity, this.targetHemiIntensity, alpha)
      if (this.cloudMat) {
        this.cloudMat.color.lerp(this.targetCloudColor, alpha)
        this.cloudMat.opacity = THREE.MathUtils.lerp(this.cloudMat.opacity, this.targetCloudOpacity, alpha)
      }

      let maxDiff = 0
      for (let i = 0; i < 4; i++) {
        const c = this.currentSkyStops[i]
        const t = this.targetSkyStops[i]
        const dr = Math.abs(c.r - t.r)
        const dg = Math.abs(c.g - t.g)
        const db = Math.abs(c.b - t.b)
        if (dr > maxDiff) maxDiff = dr
        if (dg > maxDiff) maxDiff = dg
        if (db > maxDiff) maxDiff = db
        c.lerp(t, alpha)
      }

      this.renderSkyGradientWithColors(this.currentSkyStops)
      if (this.skyTex) this.skyTex.needsUpdate = true

      if (maxDiff < 0.003 && Math.abs(this.sun.intensity - this.targetSunIntensity) < 0.005) {
        this.isSkyTransitioning = false
      }
    }

    // Celestial bodies (Sun, Moon, Starfield, Milky Way) smooth interpolation & twinkling
    const cAlpha = Math.min(1.0, dt * 2.2)
    this.currentSunVisualOpacity = THREE.MathUtils.lerp(this.currentSunVisualOpacity, this.targetSunVisualOpacity, cAlpha)
    this.currentSunVisualPos.lerp(this.targetSunVisualPos, cAlpha)
    this.currentMoonOpacity = THREE.MathUtils.lerp(this.currentMoonOpacity, this.targetMoonOpacity, cAlpha)
    this.currentMoonPos.lerp(this.targetMoonPos, cAlpha)
    this.currentStarsOpacity = THREE.MathUtils.lerp(this.currentStarsOpacity, this.targetStarsOpacity, cAlpha)
    this.currentMilkyWayOpacity = THREE.MathUtils.lerp(this.currentMilkyWayOpacity, this.targetMilkyWayOpacity, cAlpha)

    if (this.sunSprite) {
      this.sunSprite.position.copy(this.currentSunVisualPos)
      ;(this.sunSprite.material as THREE.SpriteMaterial).opacity = this.currentSunVisualOpacity
      this.sunSprite.visible = this.currentSunVisualOpacity > 0.005
    }
    if (this.moonSprite) {
      this.moonSprite.position.copy(this.currentMoonPos)
      ;(this.moonSprite.material as THREE.SpriteMaterial).opacity = this.currentMoonOpacity
      this.moonSprite.visible = this.currentMoonOpacity > 0.005
    }

    // Periodic check for lunar phase date updates (every 60 seconds)
    this.lunarCheckTimer += dt
    if (this.lunarCheckTimer >= 60) {
      this.lunarCheckTimer = 0
      this.refreshMoonPhase()
    }

    // Face the camera only around the world Y axis. Copying the full camera
    // quaternion also copied its pitch, which tilted the otherwise upright 2D
    // image and separated the visible lotus base from its ground anchor.
    if (this.dragonGuanyinBillboard && camera) {
      const camPos = camera.position
      const angle = Math.atan2(camPos.x - DRAGON_GUANYIN_POS.x, camPos.z - DRAGON_GUANYIN_POS.z)
      this.dragonGuanyinBillboard.rotation.set(0, angle, 0)
    }

    // 動態氣場：金色神光粒子向上螺旋升騰
    if (this.auraParticles && this.auraParticleData) {
      const posAttr = this.auraParticles.geometry.attributes.position as THREE.BufferAttribute
      const arr = posAttr.array as Float32Array
      for (let i = 0; i < this.auraParticleData.length; i++) {
        const p = this.auraParticleData[i]
        p.angle += p.rotSpeed * dt
        let y = arr[i * 3 + 1] + p.speed * dt
        if (y > 11.8) {
          y = 0.2
          p.radius = 0.6 + Math.random() * 3.4
        }
        arr[i * 3] = Math.cos(p.angle) * p.radius
        arr[i * 3 + 1] = y
        arr[i * 3 + 2] = Math.sin(p.angle) * p.radius
      }
      posAttr.needsUpdate = true
    }

    // 昇龍觀音青銅香爐裊裊香煙
    this.dragonPuffTimer -= dt
    if (this.dragonPuffTimer <= 0 && !this.reducedSmoke && this.dragonGuanyinUrnPos) {
      this.dragonPuffTimer = 1.3
      this.spawnPuff(this.dragonGuanyinUrnPos)
    }

    // 觀世音菩薩前專屬祈福拜墊（僅供使用者/玩家跪拜祈福，無 NPC 佔用）
    const activeSmokeSpots: THREE.Vector3[] = [...this.mainHallSmokeSpots]

    for (const slot of this.cushionSlots) {
      if (slot.state === 'empty') {
        // 柔和金色光圈呼吸脈衝，提示使用者此拜墊為空位可跪下拜拜
        const ringMat = slot.glowRing.material as THREE.MeshBasicMaterial
        ringMat.opacity = 0.32 + 0.16 * Math.sin(time * 3 + slot.index * 1.2)
      } else if (slot.state === 'player') {
        const ringMat = slot.glowRing.material as THREE.MeshBasicMaterial
        ringMat.opacity = 0
      }
    }

    // 大殿內堂香爐與持香信眾柔和香火煙霧氛圍 (Soft Atmospheric Incense Smoke)
    this.mainHallSmokeTimer -= dt
    if (this.mainHallSmokeTimer <= 0 && !this.reducedSmoke && activeSmokeSpots.length > 0) {
      this.mainHallSmokeTimer = 0.9
      const spot = activeSmokeSpots[Math.floor(Math.random() * activeSmokeSpots.length)]
      this.spawnPuff(spot)
    }

    // Gentle cloud drifting animation across celestial dome
    for (const c of this.clouds) {
      c.x += c.speed * dt
      if (c.x > 90) {
        c.x = -90
      }
      c.mesh.position.x = c.x
      c.mesh.position.y = c.y + Math.sin(time * 0.35 + c.z) * 0.35
    }
    this.woodfishImpulse = THREE.MathUtils.damp(this.woodfishImpulse, 0, 11, dt)
    this.bellImpulse = THREE.MathUtils.damp(this.bellImpulse, 0, 5.5, dt)
    this.drumImpulse = THREE.MathUtils.damp(this.drumImpulse, 0, 7.5, dt)
    this.woodfish.rotation.x = Math.sin(this.woodfishImpulse * 7) * this.woodfishImpulse
    this.bell.rotation.z = Math.sin(this.bellImpulse * 10) * this.bellImpulse
    const drumScale = 1 + Math.sin(this.drumImpulse * 22) * this.drumImpulse * 0.22
    this.drum.scale.set(drumScale, drumScale, 1)

    for (const [id, marker] of this.markers) {
      const mat = this.markerMats.get(id)!
      const active = activePoint === id
      mat.opacity = active ? 0.92 : 0.36 + 0.1 * (0.5 + 0.5 * Math.sin(time * 1.2 + marker.position.x))
      marker.scale.setScalar(active ? 1.24 : 1 + Math.sin(time * 1.1 + marker.position.z) * 0.055)
    }
    for (const [id, light] of this.lampLights) {
      const lit = (this.lampMats.get(id)?.emissiveIntensity ?? 0) > 0.5
      light.intensity = lit ? 1.1 + Math.sin(time * 2.5) * 0.08 : 0.12 + Math.sin(time * 1.3) * 0.035
    }

    for (let i = this.smoke.length - 1; i >= 0; i -= 1) {
      const p = this.smoke[i]
      p.age += dt
      const k = Math.min(1, p.age / p.life)
      p.mesh.position.y += dt * 0.3
      p.mesh.position.x += Math.sin(time * 1.6 + i) * dt * 0.08
      p.mesh.scale.setScalar(0.5 + k * 1.7)
      const m = p.mesh.material as THREE.MeshBasicMaterial
      m.opacity = Math.max(0, (1 - k) * 0.38)
      if (p.age >= p.life) {
        this.scene.remove(p.mesh)
        p.mesh.geometry.dispose()
        ;(p.mesh.material as THREE.Material).dispose()
        this.smoke.splice(i, 1)
      }
    }
    // 1. Flying coins in 3D parabolic trajectory
    for (let i = this.flyingCoins.length - 1; i >= 0; i -= 1) {
      const c = this.flyingCoins[i]
      c.progress += dt / c.duration
      const p = Math.min(1, c.progress)
      c.mesh.position.x = THREE.MathUtils.lerp(c.start.x, c.target.x, p)
      c.mesh.position.z = THREE.MathUtils.lerp(c.start.z, c.target.z, p)
      // Parabolic arc with peak height
      c.mesh.position.y = THREE.MathUtils.lerp(c.start.y, c.target.y, p) + 4 * c.peak * p * (1 - p)
      c.mesh.rotation.x += c.rotSpeed.x * dt
      c.mesh.rotation.y += c.rotSpeed.y * dt
      c.mesh.rotation.z += c.rotSpeed.z * dt

      if (c.progress >= 1) {
        c.mesh.position.copy(c.target)
        c.onSplash?.()
        this.triggerWaterSplash(c.target)
        this.flyingCoins.splice(i, 1)

        // Sinks into the water gently
        this.sinkingCoins.push({
          mesh: c.mesh,
          y: c.target.y,
          targetY: 0.04 + Math.random() * 0.02,
          wobblePhase: Math.random() * Math.PI * 2,
          wobbleSpeed: 6 + Math.random() * 4,
          age: 0,
        })
      }
    }

    // 2. Sinking coins fluttering to the pond floor
    for (let i = this.sinkingCoins.length - 1; i >= 0; i -= 1) {
      const c = this.sinkingCoins[i]
      c.age += dt
      c.y -= dt * 0.28
      c.mesh.position.y = Math.max(c.targetY, c.y)
      c.mesh.rotation.x = Math.sin(time * c.wobbleSpeed + c.wobblePhase) * 0.25
      c.mesh.rotation.z += dt * 1.5

      if (c.y <= c.targetY || c.age >= 1.4) {
        c.mesh.position.y = c.targetY
        c.mesh.rotation.set((Math.random() - 0.5) * 0.3, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.3)
        this.restingCoins.push(c.mesh)
        this.sinkingCoins.splice(i, 1)

        // Keep resting coins at reasonable count
        while (this.restingCoins.length > 64) {
          const old = this.restingCoins.shift()!
          this.scene.remove(old)
          old.traverse(obj => {
            if (obj instanceof THREE.Mesh) obj.geometry?.dispose()
          })
        }
      }
    }

    // 3. Water surface concentric ripples
    for (let i = this.ripples.length - 1; i >= 0; i -= 1) {
      const r = this.ripples[i]
      r.age += dt
      if (r.age < 0) continue // delay before expanding
      const k = Math.min(1, r.age / r.life)
      const scale = THREE.MathUtils.lerp(r.baseScale, r.maxScale, Math.sqrt(k))
      r.mesh.scale.set(scale, scale, scale)
      const mat = r.mesh.material as THREE.MeshBasicMaterial
      mat.opacity = Math.max(0, 0.75 * (1 - k))
      if (r.age >= r.life) {
        this.scene.remove(r.mesh)
        r.mesh.geometry.dispose()
        mat.dispose()
        this.ripples.splice(i, 1)
      }
    }

    // 4. Water splash spray droplets
    for (let i = this.droplets.length - 1; i >= 0; i -= 1) {
      const d = this.droplets[i]
      d.age += dt
      d.velocity.y -= 9.8 * dt
      d.mesh.position.addScaledVector(d.velocity, dt)
      if (d.mesh.position.y <= 0.28 || d.age >= d.life) {
        this.scene.remove(d.mesh)
        d.mesh.geometry.dispose()
        this.droplets.splice(i, 1)
      }
    }

    // 5. Rising golden wish sparkles
    for (let i = this.sparkles.length - 1; i >= 0; i -= 1) {
      const s = this.sparkles[i]
      s.age += dt
      const k = Math.min(1, s.age / s.life)
      s.mesh.position.y += s.vy * dt
      s.mesh.position.x = s.baseX + Math.sin(time * s.swaySpeed + i) * s.swayAmp
      s.mesh.position.z = s.baseZ + Math.cos(time * s.swaySpeed + i) * s.swayAmp
      const scale = Math.max(0.01, 1 - k * 0.7)
      s.mesh.scale.setScalar(scale)
      if (s.age >= s.life) {
        this.scene.remove(s.mesh)
        s.mesh.geometry.dispose()
        this.sparkles.splice(i, 1)
      }
    }
  }

  private addOffering(id: OfferingId, count: number): void {
    if (count > 6) return
    const offset = this.offeringDisplay.children.length * 0.22
    const x = offset % 1.5
    const z = Math.floor(offset / 1.5) * 0.25
    if (id === 'flower') {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.85, 5), makeMat('#637d50'))
      stem.position.set(x, 0.45, z)
      this.offeringDisplay.add(stem)
      const center = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), makeMat(C.gold))
      center.position.set(x, 0.92, z)
      this.offeringDisplay.add(center)
      for (let i = 0; i < 6; i += 1) {
        const petal = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), makeMat(i % 2 ? '#dfbca4' : '#bd5a49'))
        const angle = i * Math.PI / 3
        petal.position.set(x + Math.cos(angle) * 0.18, 0.9, z + Math.sin(angle) * 0.18)
        petal.scale.set(0.8, 0.45, 1.3)
        this.offeringDisplay.add(petal)
      }
    } else if (id === 'fruit') {
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.34, 0.09, 16), makeMat(C.gold, 0.55, 0.12))
      plate.position.set(x, 0.12, z)
      this.offeringDisplay.add(plate)
      for (let i = 0; i < 3; i += 1) {
        const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 9), makeMat(['#c05235', '#dda74c', '#9c6040'][i]))
        fruit.position.set(x + (i - 1) * 0.23, 0.36 + (i === 1 ? 0.16 : 0), z)
        fruit.castShadow = true
        this.offeringDisplay.add(fruit)
      }
    } else {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.14, 0.3, 12), makeMat('#e3d7be', 0.48))
      cup.position.set(x, 0.2, z)
      const tea = new THREE.Mesh(new THREE.CircleGeometry(0.16, 12), makeMat('#986442'))
      tea.rotation.x = -Math.PI / 2
      tea.position.set(x, 0.36, z)
      this.offeringDisplay.add(cup, tea)
    }
  }

  /** Set by the game when reduced motion is preferred; stops the ambient urn smoke. */
  reducedSmoke = false
  private spawnPuff(position: THREE.Vector3): void {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 7, 6), new THREE.MeshBasicMaterial({ color: '#e7d7b8', transparent: true, opacity: 0.3, depthWrite: false }))
    mesh.position.copy(position).add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0, (Math.random() - 0.5) * 0.3))
    this.scene.add(mesh)
    this.smoke.push({ mesh, age: 0, life: 3 })
  }
  private spawnSmoke(position: THREE.Vector3): void {
    for (let i = 0; i < 6; i += 1) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 7, 6), new THREE.MeshBasicMaterial({ color: '#e7d7b8', transparent: true, opacity: 0.36, depthWrite: false }))
      mesh.position.copy(position).add(new THREE.Vector3((Math.random() - 0.5) * 0.45, i * 0.2, (Math.random() - 0.5) * 0.35))
      this.scene.add(mesh)
      this.smoke.push({ mesh, age: i * 0.08, life: 2.2 + Math.random() * 0.7 })
    }
    while (this.smoke.length > 48) {
      const old = this.smoke.shift()!
      this.scene.remove(old.mesh)
      old.mesh.geometry.dispose()
      ;(old.mesh.material as THREE.Material).dispose()
    }
  }

  private createCoinMesh(): THREE.Group {
    const coin = new THREE.Group()
    // Outer disc with larger size & brilliant golden luster
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.038, 24), this.coinGoldMat)
    disc.castShadow = true
    coin.add(disc)
    // Raised golden rim
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.018, 6, 24), this.coinGoldMat)
    rim.rotation.x = Math.PI / 2
    coin.add(rim)
    // Dark square inner hole (ancient Chinese lucky coin)
    const hole = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.042, 0.075), this.coinDarkMat)
    coin.add(hole)
    return coin
  }

  private initRestingCoins(): void {
    // 1. Scatter authentic resting coins in the left wish pool (WISH_POOL)
    for (let i = 0; i < 16; i++) {
      const coin = this.createCoinMesh()
      const ang = Math.random() * Math.PI * 2
      const rad = 0.3 + Math.random() * 1.4
      const x = WISH_POOL.x + Math.cos(ang) * rad
      const z = WISH_POOL.z + Math.sin(ang) * rad
      const y = 0.038 + Math.random() * 0.015
      coin.position.set(x, y, z)
      coin.rotation.set((Math.random() - 0.5) * 0.25, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.25)
      this.scene.add(coin)
      this.restingCoins.push(coin)
    }

    // 2. Scatter authentic resting coins in the grand right-side lotus pond (LOTUS_POND)
    for (let i = 0; i < 28; i++) {
      const coin = this.createCoinMesh()
      const ang = Math.random() * Math.PI * 2
      const rx = 0.6 + Math.random() * 3.6
      const rz = 0.4 + Math.random() * 2.4
      const x = LOTUS_POND.x + Math.cos(ang) * rx
      const z = LOTUS_POND.z + Math.sin(ang) * rz
      const y = 0.038 + Math.random() * 0.015
      coin.position.set(x, y, z)
      coin.rotation.set((Math.random() - 0.5) * 0.25, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.25)
      this.scene.add(coin)
      this.restingCoins.push(coin)
    }
  }

  private tossWishCoin(fromPos?: THREE.Vector3, onSplash?: () => void): void {
    const coin = this.createCoinMesh()

    // Determine target pool (LOTUS_POND vs WISH_POOL)
    let isWest = false
    if (fromPos) {
      const dEast = Math.hypot(fromPos.x - LOTUS_POND.x, fromPos.z - LOTUS_POND.z)
      const dWest = Math.hypot(fromPos.x - WISH_POOL.x, fromPos.z - WISH_POOL.z)
      if (dWest < dEast && dWest < 10) {
        isWest = true
      }
    }
    const pool = isWest ? WISH_POOL : LOTUS_POND

    // Determine landing point in wishing pool
    const inCenterBowl = Math.random() < 0.35
    const target = new THREE.Vector3()
    if (inCenterBowl) {
      target.set(
        pool.x + (Math.random() - 0.5) * 0.25,
        0.35,
        pool.z + (Math.random() - 0.5) * 0.25
      )
    } else {
      const ang = Math.random() * Math.PI * 2
      const rx = isWest ? 0.35 + Math.random() * 1.4 : 0.6 + Math.random() * 3.4
      const rz = isWest ? 0.35 + Math.random() * 1.4 : 0.4 + Math.random() * 2.3
      target.set(
        pool.x + Math.cos(ang) * rx,
        0.28,
        pool.z + Math.sin(ang) * rz
      )
    }

    // Determine launch point: near player or at pool edge
    let start: THREE.Vector3
    if (fromPos && Math.hypot(fromPos.x - pool.x, fromPos.z - pool.z) < 16) {
      start = new THREE.Vector3(fromPos.x, fromPos.y + 1.15, fromPos.z)
    } else {
      const edgeX = isWest ? pool.x + 3.8 : pool.x - 5.8
      const edgeZ = pool.z
      start = new THREE.Vector3(edgeX, 1.25, edgeZ)
    }

    coin.position.copy(start)
    this.scene.add(coin)

    this.flyingCoins.push({
      mesh: coin,
      start,
      target,
      progress: 0,
      duration: 1.15,
      peak: 1.55 + Math.random() * 0.25,
      rotSpeed: new THREE.Vector3(10 + Math.random() * 6, 14 + Math.random() * 8, 7 + Math.random() * 5),
      onSplash,
    })
  }

  private triggerWaterSplash(pos: THREE.Vector3): void {
    // 1. Concentric ripples
    for (let i = 0; i < 4; i++) {
      this.spawnRipple(pos.x, 0.285 + i * 0.002, pos.z, -i * 0.14, 1.6 + i * 0.35)
    }
    // 2. Splash water droplets
    for (let i = 0; i < 16; i++) {
      const ang = Math.random() * Math.PI * 2
      const spd = 0.8 + Math.random() * 1.8
      const vy = 2.4 + Math.random() * 2.2
      this.spawnDroplet(pos, new THREE.Vector3(Math.cos(ang) * spd, vy, Math.sin(ang) * spd))
    }
    // 3. Golden wish sparkles
    for (let i = 0; i < 26; i++) {
      this.spawnSparkle(pos)
    }
  }

  private spawnRipple(x: number, y: number, z: number, startDelay: number, maxScale: number): void {
    const geo = new THREE.TorusGeometry(0.2, 0.024, 6, 28)
    const mat = new THREE.MeshBasicMaterial({ color: '#bcece5', transparent: true, opacity: 0.75, depthWrite: false })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.rotation.x = Math.PI / 2
    mesh.position.set(x, y, z)
    mesh.scale.set(0.1, 0.1, 0.1)
    this.scene.add(mesh)
    this.ripples.push({
      mesh,
      baseScale: 0.2,
      maxScale,
      age: startDelay,
      life: 1.35,
    })
  }

  private spawnDroplet(pos: THREE.Vector3, vel: THREE.Vector3): void {
    const geo = new THREE.SphereGeometry(0.028 + Math.random() * 0.015, 6, 5)
    const mesh = new THREE.Mesh(geo, this.dropletMat)
    mesh.position.set(
      pos.x + (Math.random() - 0.5) * 0.1,
      pos.y + 0.03,
      pos.z + (Math.random() - 0.5) * 0.1
    )
    this.scene.add(mesh)
    this.droplets.push({
      mesh,
      velocity: vel,
      age: 0,
      life: 0.85 + Math.random() * 0.3,
    })
  }

  private spawnSparkle(pos: THREE.Vector3): void {
    const size = 0.03 + Math.random() * 0.03
    const geo = new THREE.SphereGeometry(size, 6, 5)
    const mesh = new THREE.Mesh(geo, this.sparkleMat)
    const ox = pos.x + (Math.random() - 0.5) * 0.35
    const oz = pos.z + (Math.random() - 0.5) * 0.35
    mesh.position.set(ox, pos.y + 0.06 + Math.random() * 0.1, oz)
    this.scene.add(mesh)
    this.sparkles.push({
      mesh,
      baseX: ox,
      baseZ: oz,
      vy: 0.8 + Math.random() * 1.2,
      swaySpeed: 4 + Math.random() * 3,
      swayAmp: 0.08 + Math.random() * 0.06,
      age: 0,
      life: 1.6 + Math.random() * 0.9,
    })
  }

  getMainHallScale(): number {
    return this.mainHallScale
  }

  getGuanyinStatueWorldPos(): { x: number; z: number } {
    return { x: 0, z: this.mainHallZ - 5.68 * this.mainHallScale }
  }

  /**
   * 等比例縮放大殿規模 (範圍 1.0 ~ 2.0，基準 1.35x)。
   * 底座精準對齊地面 y = 0，自動微調 Z 軸前後位置，並向外展開偏殿與鐘鼓樓，
   * 確保大殿與周圍偏殿、香爐、樹木及後殿完全防穿模貼地。
   */
  setMainHallScale(scale: number, customZ?: number): void {
    const s = THREE.MathUtils.clamp(scale, 1.0, 2.0)
    this.mainHallScale = s
    this.mainHallZ = customZ ?? (-7.0 - (s - 1.0) * 0.8)

    // 1. Scale and translate Main Hall group and roof
    if (this.mainHallGroup) {
      this.mainHallGroup.scale.set(s, s, s)
      this.mainHallGroup.position.set(0, 0, this.mainHallZ)
    }

    // The hall shell grows to create a larger sanctuary, while the three
    // consecrated figures keep their approved 1.35x world-space size. Their
    // local anchors remain in the scaled altar, so they rise with the plinth
    // rather than floating, and the higher ceiling no longer masks them.
    const deityLocalScale = MAIN_HALL_DEITY_REFERENCE_SCALE / s
    for (const deity of [this.guanyinRoot, this.caiShenRoot, this.yueLaoRoot]) {
      deity?.scale.setScalar(deityLocalScale)
    }
    if (this.roof) {
      this.roof.scale.set(s, s, s)
      this.roof.position.set(0, 0, this.mainHallZ)
    }

    // 2. Rebuild physics colliders for main hall
    this.rebuildMainHallColliders(s, this.mainHallZ)

    // 3. Update cushion slots world coordinates
    for (const slot of this.cushionSlots) {
      slot.worldX = slot.x * s
      slot.worldZ = this.mainHallZ + slot.z * s
    }

    // 4. Update smoke spots inside the hall
    if (this.mainHallSmokeSpots.length >= 2) {
      this.mainHallSmokeSpots[0].set(0, 1.55 * s, this.mainHallZ - 2.95 * s)
      this.mainHallSmokeSpots[1].set(0, 2.15 * s, this.mainHallZ - 4.15 * s)
    }

    // 5. Update outdoor Tiangong Urn (天公爐) position in front of the grand front steps
    const stepsFrontEdge = this.mainHallZ + 7.9 * s
    const urnZ = Math.max(0.4, stepsFrontEdge + 3.0)
    if (this.outdoorUrn) {
      this.outdoorUrn.position.set(0, 0, urnZ)
      if (this.outdoorUrnCollider) {
        this.physics.removeCollider(this.outdoorUrnCollider)
      }
      this.outdoorUrnCollider = this.physics.addStaticCylinder(new THREE.Vector3(0, 0.55, urnZ), 0.52, 1.1)
      if (this.incenseGlow) {
        this.incenseGlow.position.set(0, 1.8, urnZ - 0.05)
      }
      const incensePoint = this.points.find(p => p.id === 'incense')
      if (incensePoint) {
        incensePoint.position.set(0, 0, urnZ + 0.95)
        const marker = this.markers.get('incense')
        if (marker) marker.position.set(0, 0.09, urnZ + 0.95)
      }
      POINT_TARGETS[0] = [0, urnZ]
    }

    // 6. Update side architecture (偏殿、鐘鼓樓) outward clearance to prevent any overlap
    const sideOffset = (s - 1.0) * 8.5
    if (this.leftSideGroup) this.leftSideGroup.position.x = -sideOffset
    if (this.rightSideGroup) this.rightSideGroup.position.x = sideOffset

    for (const sc of this.sideColliders) {
      const newX = sc.isLeft ? sc.origX - sideOffset : sc.origX + sideOffset
      sc.collider.setTranslation({ x: newX, y: sc.y, z: sc.z })
    }

    // Update shrine points and markers for bell & drum
    const bellPoint = this.points.find(p => p.id === 'bell')
    if (bellPoint) {
      bellPoint.position.set(12.4 + sideOffset, 0, -5.6)
      const marker = this.markers.get('bell')
      if (marker) marker.position.set(12.4 + sideOffset, 0.09, -5.6)
    }
    const drumPoint = this.points.find(p => p.id === 'drum')
    if (drumPoint) {
      drumPoint.position.set(-12.4 - sideOffset, 0, -5.6)
      const marker = this.markers.get('drum')
      if (marker) marker.position.set(-12.4 - sideOffset, 0.09, -5.6)
    }
    POINT_TARGETS[7] = [15.2 + sideOffset, -8]
    POINT_TARGETS[11] = [-15.2 - sideOffset, -8.0]

    // Update offerings point inside the hall
    const offeringsPoint = this.points.find(p => p.id === 'offerings')
    if (offeringsPoint) {
      offeringsPoint.position.set(-2.25 * s, 0, this.mainHallZ - 3.05 * s)
      const marker = this.markers.get('offerings')
      if (marker) marker.position.set(-2.25 * s, 0.09, this.mainHallZ - 3.05 * s)
    }

    // 7. Dynamically shift Rear Hall (後殿凌霄寶殿) backwards when Main Hall scale expands (> 1.35x)
    // so the Rear Hall facade, columns, roof, and plaque never penetrate or overlap the Main Hall sanctuary!
    const rearShiftZ = Math.min(0, (this.mainHallZ - 8.4 * s) - (-18.62))
    if (this.rearHallGroup) {
      this.rearHallGroup.position.set(0, 0, -25.0 + rearShiftZ)
    }
    if (this.rearRoof) {
      this.rearRoof.position.set(0, 0, rearShiftZ)
    }
    for (const rc of this.rearHallColliders) {
      rc.collider.setTranslation({ x: rc.x, y: rc.y, z: rc.origZ + rearShiftZ })
    }
    const yuhuangPoint = this.points.find(p => p.id === 'yuhuang')
    if (yuhuangPoint) {
      yuhuangPoint.position.set(0, 0, -23.5 + rearShiftZ)
      const marker = this.markers.get('yuhuang')
      if (marker) marker.position.set(0, 0.09, -23.5 + rearShiftZ)
    }
    POINT_TARGETS[12] = [0, -30.2 + rearShiftZ]
  }

  private rebuildMainHallColliders(scale: number, hallZ: number): void {
    for (const collider of this.mainHallColliders) {
      this.physics.removeCollider(collider)
    }
    this.mainHallColliders = []

    // 1. Raised podium (main floor ending at upper step edge to allow seamless climbing)
    this.mainHallColliders.push(
      this.physics.addStaticBox(
        new THREE.Vector3(0, 0.14 * scale, hallZ - 0.525 * scale),
        new THREE.Vector3(20.4 * scale, 0.28 * scale, 14.35 * scale)
      )
    )

    // 1b. Seamless approach ramps & stairs across all three temple portals
    // Continuous incline ramp (8.6° slope: ground level to 0.28m podium top over 1.85m run)
    // Starting in front of the steps at z = hallZ + 8.45 * scale (submerged at y = -0.04m to eliminate vertical lip)
    // and rising seamlessly to meet podium at z = hallZ + 6.60 * scale (y = 0.28 * scale)
    const run = 1.85 * scale
    const rise = 0.28 * scale
    const rampTheta = Math.atan2(rise, run)
    const rampLen = Math.hypot(rise, run)
    const rampCenterZ = hallZ + ((8.45 + 6.60) / 2) * scale
    const rampCenterY = (rise / 2) - 0.015
    const rampRot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), rampTheta)

    for (const [x, w] of [[0, 5.4], [6.75, 3.2], [-6.75, 3.2]] as const) {
      this.mainHallColliders.push(
        this.physics.addStaticBox(
          new THREE.Vector3(x * scale, rampCenterY, rampCenterZ),
          new THREE.Vector3(w * scale, 0.08 * scale, rampLen),
          rampRot
        )
      )
    }

    // Supportive step foundations under the ramp (recessed behind ramp surface to prevent snagging)
    for (const [x, w] of [[0, 5.0], [6.75, 2.8], [-6.75, 2.8]] as const) {
      this.mainHallColliders.push(
        this.physics.addStaticBox(
          new THREE.Vector3(x * scale, 0.10 * scale, hallZ + 7.0 * scale),
          new THREE.Vector3(w * scale, 0.20 * scale, 0.8 * scale)
        )
      )
    }

    // 2. Central shrine back wall
    this.mainHallColliders.push(
      this.physics.addStaticBox(
        new THREE.Vector3(0, 2.55 * scale, hallZ - 6.4 * scale),
        new THREE.Vector3(8.2 * scale, 5.1 * scale, 0.6 * scale)
      )
    )

    // 3. Outer back walls
    for (const side of [-1, 1]) {
      this.mainHallColliders.push(
        this.physics.addStaticBox(
          new THREE.Vector3(side * 8.5 * scale, 2.55 * scale, hallZ - 6.4 * scale),
          new THREE.Vector3(2.2 * scale, 5.1 * scale, 0.6 * scale)
        )
      )
    }

    // 4. Solid side walls
    for (const side of [-1, 1]) {
      const sx = side * 9.2 * scale
      this.mainHallColliders.push(
        this.physics.addStaticBox(
          new THREE.Vector3(sx, 2.55 * scale, hallZ - 0.4 * scale),
          new THREE.Vector3(0.55 * scale, 5.1 * scale, 12.6 * scale)
        )
      )
    }

    // 5. Front screen walls (dragon & tiger screens)
    for (const side of [-1, 1]) {
      this.mainHallColliders.push(
        this.physics.addStaticBox(
          new THREE.Vector3(side * 3.8 * scale, 2.4 * scale, hallZ + 5.2 * scale),
          new THREE.Vector3(3.2 * scale, 4.8 * scale, 0.28 * scale)
        )
      )
    }

    // 6. Outer front side walls
    for (const side of [-1, 1]) {
      this.mainHallColliders.push(
        this.physics.addStaticBox(
          new THREE.Vector3(side * 8.85 * scale, 2.4 * scale, hallZ + 5.2 * scale),
          new THREE.Vector3(1.5 * scale, 4.8 * scale, 0.28 * scale)
        )
      )
    }

    // 7. Columns (vermilion & dragon pillars)
    for (const z of [-5.8, -0.2, 5.2]) {
      for (const x of [-8.1, -5.4, 5.4, 8.1]) {
        const isDragonCol = z === 5.2 && (x === -5.4 || x === 5.4)
        const rad = (isDragonCol ? 0.42 : 0.36) * scale
        const h = 5.0 * scale
        this.mainHallColliders.push(
          this.physics.addStaticCylinder(
            new THREE.Vector3(x * scale, h / 2, hallZ + z * scale),
            rad,
            h
          )
        )
      }
    }

    // 8. Altar table & deity statue plinths
    this.mainHallColliders.push(
      this.physics.addStaticBox(
        new THREE.Vector3(0, 0.9 * scale, hallZ - 4.55 * scale),
        new THREE.Vector3(7.5 * scale, 1.8 * scale, 2.1 * scale)
      )
    )
    this.mainHallColliders.push(
      this.physics.addStaticBox(
        new THREE.Vector3(0, 1.0 * scale, hallZ - 5.68 * scale),
        new THREE.Vector3(7.85 * scale, 2.0 * scale, 2.55 * scale)
      )
    )
  }
}
