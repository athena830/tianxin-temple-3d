import * as THREE from 'three'
import { Chibi } from './chibi'
import type { Physics } from '../engine/physics'
import type { LampId, OfferingId } from './temple-data'
import { FrontCourtyard, GOLD_FURNACE, PAVILION, STAND, TIANGONG, WISH_POOL } from './temple-courtyard'

export const DRAGON_GUANYIN_POS = new THREE.Vector3(-68.0, 0, 31.0)

export type ShrinePointId =
  | 'incense' | 'prayer' | 'offerings' | 'daily-lot' | 'chess'
  | 'lamps' | 'woodfish' | 'bell' | 'wishing-pool' | 'prayer-wall' | 'records' | 'tiangong'
  | 'drum' | 'yuhuang' | 'gold-furnace' | 'guanyin-dragon'

export type TimeOfDay = 'day' | 'dawn' | 'dusk' | 'night'

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

const pointSpecs: Omit<ShrinePoint, 'position'>[] = [
  { id: 'incense', title: '上香祈福', subtitle: '於香爐前敬香祈願', radius: 3.2 },
  { id: 'prayer', title: '寫下心願', subtitle: '將一念善願留在祈願牆', radius: 3.2 },
  { id: 'offerings', title: '虛擬供奉', subtitle: '供花、供果、供茶', radius: 3.0 },
  { id: 'daily-lot', title: '每日抽籤', subtitle: '靜心抽取今日籤詩', radius: 3.0 },
  { id: 'chess', title: '天心仙姑問事亭', subtitle: '象棋卜卦・問事服務', radius: 2.6 },
  { id: 'lamps', title: '祈福燈區', subtitle: '點平安燈、財神燈、文昌燈', radius: 3.2 },
  { id: 'woodfish', title: '木魚', subtitle: '敲擊木魚，收攝心念', radius: 2.5 },
  { id: 'bell', title: '祈福鐘', subtitle: '鳴鐘祈願，祝福相隨', radius: 2.8 },
  { id: 'wishing-pool', title: '蓮花許願池', subtitle: '投入一枚祈福銅錢', radius: 2.8 },
  { id: 'prayer-wall', title: '祈願牆', subtitle: '閱讀此裝置上的祝願', radius: 3.0 },
  { id: 'records', title: '祈福紀錄', subtitle: '回看本機保存的參拜足跡', radius: 3.0 },
  { id: 'tiangong', title: '參拜玉皇上帝', subtitle: '於前庭天公爐前合掌敬拜', radius: 2.8 },
  { id: 'drum', title: '鼓樓擊鼓', subtitle: '擊鼓鳴志，收攝心念', radius: 2.8 },
  { id: 'yuhuang', title: '後殿凌霄寶殿', subtitle: '朝拜玉皇上帝，蒙沐浩恩', radius: 3.2 },
  { id: 'gold-furnace', title: '八角金亭', subtitle: '化金祈福，添香油聚善緣', radius: 3.0 },
  { id: 'guanyin-dragon', title: '參拜昇龍觀音', subtitle: '仰望五層樓高乘龍觀音金身', radius: 4.8 },
]
const pointPositions: [number, number][] = [
  [0, 0.4], [3.2, -3.4], [-4.4, -2.2], [-9.2, 1.2], [PAVILION.x + 1.6, PAVILION.z],
  [12.5, 2.2], [8.5, -6.2], [12.4, -5.6], [WISH_POOL.x + 3.9, WISH_POOL.z], [14.6, 4.3], [15, 0.2],
  [TIANGONG.x - 3.0, TIANGONG.z],
  [-12.4, -5.6], [0, -23.5], [GOLD_FURNACE.x + 3.2, GOLD_FURNACE.z],
  [DRAGON_GUANYIN_POS.x + 5.5, DRAGON_GUANYIN_POS.z],
]

/** Object each station faces, used to orient visitors who use the quick guide. */
export const POINT_TARGETS: [number, number][] = [
  [0, -2.55], [0, -12.2], [-4.4, -4.2], [-12, 1.2], [PAVILION.x, PAVILION.z],
  [12.5, -1.6], [8.5, -8.5], [15.2, -8], [WISH_POOL.x, WISH_POOL.z], [17.5, 4.3], [17.2, 0.2],
  [TIANGONG.x, TIANGONG.z],
  [-15.2, -8.0], [0, -30.2], [GOLD_FURNACE.x, GOLD_FURNACE.z],
  [DRAGON_GUANYIN_POS.x, DRAGON_GUANYIN_POS.z],
]

const makeMat = (color: string, roughness = 0.82, metalness = 0): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness })

/** Height of the 3D Guanyin figure above the lotus throne, in metres. */
const GUANYIN_HEIGHT = 2.6

export class TempleWorld {
  private guanyinRoot: THREE.Group | null = null
  private guanyinModelPlaced = false
  readonly scene = new THREE.Scene()
  readonly spawn = new THREE.Vector3(STAND.x, 1.2, STAND.z)
  readonly points: ShrinePoint[] = pointSpecs.map((point, i) => ({
    ...point,
    position: new THREE.Vector3(pointPositions[i][0], 0, pointPositions[i][1]),
  }))

  private readonly markers = new Map<ShrinePointId, THREE.Mesh>()
  private readonly markerMats = new Map<ShrinePointId, THREE.MeshBasicMaterial>()
  private readonly lampMats = new Map<LampId, THREE.MeshStandardMaterial>()
  private readonly lampLights = new Map<LampId, THREE.PointLight>()
  private readonly offeringDisplay = new THREE.Group()
  private readonly smoke: { mesh: THREE.Mesh; age: number; life: number }[] = []
  private readonly coins: { mesh: THREE.Mesh; age: number; ripple: THREE.Mesh }[] = []
  private readonly roof = new THREE.Group()
  private readonly rearRoof = new THREE.Group()
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
  private timeOfDay: TimeOfDay = 'day'
  private puffTimer = 0
  private bellImpulse = 0
  private drumImpulse = 0
  private woodfishImpulse = 0
  private readonly lamps: { id: LampId; position: THREE.Vector3 }[] = [
    { id: 'peace', position: new THREE.Vector3(10, 0, -1.6) },
    { id: 'wealth', position: new THREE.Vector3(12.5, 0, -1.6) },
    { id: 'study', position: new THREE.Vector3(15, 0, -1.6) },
  ]
  private readonly clouds: { mesh: THREE.Group; speed: number; x: number; z: number; y: number }[] = []
  private dragonGuanyinBillboard?: THREE.Mesh
  private auraParticles?: THREE.Points
  private auraParticleData?: { radius: number; angle: number; speed: number; rotSpeed: number }[]
  private dragonGuanyinUrnPos?: THREE.Vector3
  private dragonPuffTimer = 1.2

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
    this.addClouds()

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
    this.addMarkers()
    this.addGiantDragonGuanyin()
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
  }

  private addMainHall(): void {
    const hall = new THREE.Group()
    hall.position.set(0, 0, -7)
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
    this.physics.addStaticBox(new THREE.Vector3(0, 0.14, -7.3), new THREE.Vector3(20.4, 0.28, 14.8))

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
    // Central Shrine Back Wall (中央主殿神龕實體背牆)
    const backCenter = new THREE.Mesh(new THREE.BoxGeometry(8.2, 5.1, 0.6), makeMat('#543b2f'))
    backCenter.position.set(0, 2.55, -6.4)
    backCenter.castShadow = true
    backCenter.receiveShadow = true
    hall.add(backCenter)
    this.physics.addStaticBox(new THREE.Vector3(0, 2.55, -13.4), new THREE.Vector3(8.2, 5.1, 0.6))

    // Left & Right Outer Back Walls (左右外側背牆與寬闊連通御門，通道寬達 3.3 公尺、通高 4.25 公尺)
    for (const side of [-1, 1]) {
      const outerWall = new THREE.Mesh(new THREE.BoxGeometry(2.2, 5.1, 0.6), makeMat('#543b2f'))
      outerWall.position.set(side * 8.5, 2.55, -6.4)
      outerWall.castShadow = true
      outerWall.receiveShadow = true
      hall.add(outerWall)
      this.physics.addStaticBox(new THREE.Vector3(side * 8.5, 2.55, -13.4), new THREE.Vector3(2.2, 5.1, 0.6))

      // Grand arch door lintel spanning 3.3m wide open passageway
      const doorLintel = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.85, 0.6), redDark)
      doorLintel.position.set(side * 5.75, 4.68, -6.4)
      hall.add(doorLintel)

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
      this.physics.addStaticBox(new THREE.Vector3(sx, 2.55, -7.4), new THREE.Vector3(0.55, 5.1, 12.6))
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
    this.physics.addStaticBox(new THREE.Vector3(3.8, 2.4, -1.8), new THREE.Vector3(3.2, 4.8, 0.28))

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
    this.physics.addStaticBox(new THREE.Vector3(-3.8, 2.4, -1.8), new THREE.Vector3(3.2, 4.8, 0.28))

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
      this.physics.addStaticBox(new THREE.Vector3(side * 8.85, 2.4, -1.8), new THREE.Vector3(1.5, 4.8, 0.28))
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
          this.physics.addStaticCylinder(new THREE.Vector3(x, 2.5, z - 7), 0.42, 5.0)

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
          this.physics.addStaticCylinder(new THREE.Vector3(x, 2.5, z - 7), 0.36, 5.0)
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
    const caissonGlow = new THREE.PointLight('#ffe8a3', 0.85, 9, 2)
    caissonGlow.position.y = 0.35
    caisson.add(caissonGlow)

    hall.add(caisson)

    // Altar Base & Top (神龕供桌)
    const altarBase = new THREE.Mesh(new THREE.BoxGeometry(6.3, 0.48, 1.9), makeMat('#4a3025'))
    altarBase.position.set(0, 0.82, -4.55)
    altarBase.castShadow = true
    altarBase.receiveShadow = true
    hall.add(altarBase)
    for (const x of [-2.6, 2.6]) for (const z of [-5.2, -3.9]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.23, 1.2, 0.23), red)
      leg.position.set(x, 0.55, z)
      hall.add(leg)
    }
    const altarTop = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.25, 2.1), makeMat('#74452e', 0.56))
    altarTop.position.set(0, 1.55, -4.55)
    altarTop.castShadow = true
    altarTop.receiveShadow = true
    hall.add(altarTop)
    this.offeringDisplay.position.set(-2.25, 1.75, -4.55)
    hall.add(this.offeringDisplay)

    // Center Statue Plinths (神像底座)
    const centerPlinth = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.6, 2.5), makeMat('#6c5543'))
    centerPlinth.position.set(0, 0.8, -5.7)
    hall.add(centerPlinth)
    const topPlinth = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.22, 2.7), gold)
    topPlinth.position.set(0, 1.71, -5.7)
    hall.add(topPlinth)

    // Golden Bodhisattva Statue in Main Hall (大殿觀世音菩薩法相金身)
    const statue = this.createGuanyinStatue()
    this.guanyinRoot = statue
    statue.position.set(0, 1.82, -5.7)
    hall.add(statue)

    // Main Hall Signboard (觀世音菩薩匾額)
    const sign = new THREE.Mesh(new THREE.BoxGeometry(6.4, 1.4, 0.25), makeMat('#35251c'))
    sign.position.set(0, 5.05, -0.08)
    hall.add(sign)
    const signText = new THREE.Mesh(new THREE.PlaneGeometry(6.0, 1.08), this.textMaterial('觀 世 音 菩 薩', '#ecd08b', '#35251c'))
    signText.position.set(0, 5.05, 0.065)
    hall.add(signText)

    // Grand Hall Roof (大殿重檐歇山式大屋頂)
    const roof = this.createRoof(20.6, 16.2, 5.35, 8.2)
    roof.position.set(0, 0, -7)
    this.roof.add(roof)
    this.roof.position.y = 0
    this.scene.add(this.roof)
    this.addRoofFinial(hall, 0, 0)

    // Red Palace Lanterns (殿前紅色宮燈)
    // No lantern on the central axis so the statue stays fully visible from the courtyard.
    for (const x of [-6.3, -3.2, 3.2, 6.3]) {
      const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.34, 0.8, 10), makeMat(C.vermilionLight))
      lantern.position.set(x, 3.9, -0.4)
      hall.add(lantern)
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.22, 8), gold)
      cap.position.set(x, 4.39, -0.4)
      hall.add(cap)
      const glow = new THREE.PointLight('#f1b969', 0.22, 5, 2)
      glow.position.set(x, 3.7, -0.4)
      hall.add(glow)
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
    rear.position.set(0, 0, -25.0)
    this.scene.add(rear)

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
    this.physics.addStaticBox(new THREE.Vector3(0, 0.14, -25.0), new THREE.Vector3(24.0, 0.28, 16.5))

    // Courtyard Atrium Stone Paving & Seamless Connecting Covered Walkways (天井與左右連通穿堂迴廊，無障礙平整銜接)
    for (const side of [-1, 1]) {
      // Covered walkway floor connecting Main Hall seamlessly to Rear Hall at y = 0.28m
      const corridorFloor = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.28, 4.4), stonePlinth)
      corridorFloor.position.set(side * 5.85, 0.14, 10.45)
      corridorFloor.receiveShadow = true
      rear.add(corridorFloor)
      this.physics.addStaticBox(new THREE.Vector3(side * 5.85, 0.14, -14.55), new THREE.Vector3(3.6, 0.28, 4.4))

      // Walkway Pillars placed on outer edges (側邊立柱，通道中央保留 2.6m 寬敞通暢走道)
      for (const cz of [8.8, 11.8]) {
        const cPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 4.4, 10), red)
        cPillar.position.set(side * 7.6, 2.2, cz)
        rear.add(cPillar)
        this.physics.addStaticCylinder(new THREE.Vector3(side * 7.6, 2.2, cz - 25.0), 0.22, 4.4)
      }

      // Walkway Roof
      const corrRoof = this.createRoof(4.2, 4.8, 4.4, 5.5)
      corrRoof.position.set(side * 5.85, 0, -14.65)
      this.scene.add(corrRoof)
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
    this.physics.addStaticBox(new THREE.Vector3(0, 0.07, -16.35), new THREE.Vector3(9.2, 0.14, 0.8))

    const step2 = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.14, 0.6), stonePlinth)
    step2.position.set(0, 0.21, 8.1)
    step2.receiveShadow = true
    rear.add(step2)
    this.physics.addStaticBox(new THREE.Vector3(0, 0.21, -16.9), new THREE.Vector3(8.6, 0.14, 0.6))

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
      this.physics.addStaticCylinder(new THREE.Vector3(x, 3.2, frontZ - 25.0), 0.44, 6.4)
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
      this.physics.addStaticBox(new THREE.Vector3(side * 7.8, 2.86, frontZ - 25.0), new THREE.Vector3(6.8, 5.2, 0.4))

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

    // 4. Grand Palace Plaque: 「凌 霄 寶 殿」 (殿前六尺金字主匾)
    const plaqueFrame = new THREE.Mesh(new THREE.BoxGeometry(6.6, 1.6, 0.22), darkWood)
    plaqueFrame.position.set(0, 5.8, frontZ + 0.38)
    rear.add(plaqueFrame)
    const plaqueGoldBorder = new THREE.Mesh(new THREE.BoxGeometry(6.3, 1.35, 0.24), gold)
    plaqueGoldBorder.position.set(0, 5.8, frontZ + 0.38)
    rear.add(plaqueGoldBorder)
    const plaqueText = new THREE.Mesh(
      new THREE.PlaneGeometry(6.0, 1.15),
      this.textMaterial('凌  霄  寶  殿', '#fced9c', '#200f08')
    )
    plaqueText.position.set(0, 5.8, frontZ + 0.52)
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
    this.physics.addStaticBox(new THREE.Vector3(0, 3.4, -32.8), new THREE.Vector3(23.2, 6.8, 0.65))

    for (const side of [-1, 1]) {
      const sx = side * 11.6
      const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.65, 6.8, 14.5), darkWood)
      sideWall.position.set(sx, 3.4, -0.65)
      sideWall.castShadow = true
      rear.add(sideWall)
      this.physics.addStaticBox(new THREE.Vector3(sx, 3.4, -25.65), new THREE.Vector3(0.65, 6.8, 14.5))
    }

    // 6. Inner Imperial Pillars (殿內四大通天金柱與金龍盤繞)
    for (const x of [-6.2, 6.2]) {
      for (const z of [2.2, -3.2]) {
        const inCol = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.52, 6.4, 14), red)
        inCol.position.set(x, 3.2, z)
        inCol.castShadow = true
        rear.add(inCol)
        this.physics.addStaticCylinder(new THREE.Vector3(x, 3.2, z - 25.0), 0.46, 6.4)
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

    // Sacred Golden Mandorla & Divine Halo (金光萬道神聖光輪)
    const haloOuter = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.14, 12, 36), gold)
    haloOuter.position.set(0, 3.8, throneZ - 1.45)
    const haloInner = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.1, 12, 28), gold)
    haloInner.position.set(0, 3.8, throneZ - 1.45)
    const haloRay = new THREE.Mesh(new THREE.CircleGeometry(2.1, 32), this.textMaterial('萬 聖 尊 崇', '#f6dc9c', '#4a2d14'))
    haloRay.position.set(0, 3.8, throneZ - 1.48)
    rear.add(haloOuter, haloInner, haloRay)

    // Divine Radiance Light
    const rearLight = new THREE.PointLight('#ffe6a8', 1.5, 24, 2)
    rearLight.position.set(0, 4.4, throneZ + 1.2)
    rear.add(rearLight)

    // 8. Jade Imperial Offering Table (重簷九龍玉案供桌)
    const altarZ = -2.2
    const jadeAltar = new THREE.Mesh(new THREE.BoxGeometry(7.8, 1.25, 2.4), jade)
    jadeAltar.position.set(0, 0.88, altarZ)
    jadeAltar.castShadow = true
    jadeAltar.receiveShadow = true
    rear.add(jadeAltar)
    this.physics.addStaticBox(new THREE.Vector3(0, 0.88, altarZ - 25.0), new THREE.Vector3(7.8, 1.25, 2.4))

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
    const caissonLight = new THREE.PointLight('#ffe496', 1.1, 14, 2)
    caissonLight.position.y = 0.45
    caisson.add(caissonOuter, caissonRing1, caissonRing2, caissonBoss, caissonLight)
    rear.add(caisson)

    // 10. Double-Eave Sweeping Imperial Roof (後殿重簷廡殿九脊頂: 下簷 26.8m x 18.5m, 上簷 20.8m x 13.5m, 高達 11.5m)
    const lowerRoof = this.createRoof(26.8, 18.5, 6.6, 8.8)
    lowerRoof.position.set(0, 0, -25.0)
    const upperRoof = this.createRoof(20.8, 13.5, 8.6, 11.5)
    upperRoof.position.set(0, 0, -25.0)
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
    this.scene.add(drumBase)
    for (const x of [-16.15, -14.25]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.21, 4.1, 9), red)
      pillar.position.set(x, 2.1, dz)
      this.scene.add(pillar)
      this.physics.addStaticCylinder(new THREE.Vector3(x, 2.05, dz), 0.18, 4.1)
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.24, 0.25), wood)
    lintel.position.set(dx, 4.1, dz)
    this.scene.add(lintel)

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

    this.scene.add(this.drum)

    // 3. Pavilion Roof (鼓樓飛簷瓦頂)
    const drumRoof = this.createRoof(4.2, 3.5, 4.1, 5.4)
    drumRoof.position.set(dx, 0, dz)
    this.scene.add(drumRoof)
  }

  private addSideArchitecture(): void {
    const sideMat = makeMat('#6c5140')
    const darkWood = makeMat(C.darkWood, 0.88)
    for (const x of [-13.4, 13.4]) {
      const isLeft = x < 0
      const base = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.22, 16.8), makeMat('#9d8a70'))
      base.position.set(x, 0.12, -2.7)
      base.receiveShadow = true
      this.scene.add(base)

      // Solid outer boundary wall for the side corridors (廂房外側厚實封閉牆，不再鏤空漏光)
      const outerX = isLeft ? x - 2.4 : x + 2.4
      const outerWall = new THREE.Mesh(new THREE.BoxGeometry(0.42, 3.8, 16.8), darkWood)
      outerWall.position.set(outerX, 1.9, -2.7)
      outerWall.castShadow = true
      outerWall.receiveShadow = true
      this.scene.add(outerWall)
      this.physics.addStaticBox(new THREE.Vector3(outerX, 1.9, -2.7), new THREE.Vector3(0.42, 3.8, 16.8))

      for (const z of [-9.3, -4, 1.2]) {
        const column = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 3.35, 10), makeMat(C.wood))
        column.position.set(x, 1.72, z)
        column.castShadow = true
        this.scene.add(column)
        this.physics.addStaticCylinder(new THREE.Vector3(x, 1.72, z), 0.27, 3.35)
      }
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(4.9, 0.38, 0.45), sideMat)
      lintel.position.set(x, 3.48, -4)
      this.scene.add(lintel)

      // Corridor Ceiling (廂房實體吊頂)
      const corridorCeiling = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.12, 16.4), makeMat('#3c271d'))
      corridorCeiling.position.set(x, 3.38, -2.7)
      corridorCeiling.receiveShadow = true
      this.scene.add(corridorCeiling)

      const roof = this.createRoof(5.6, 17.2, 3.3, 5.0)
      roof.position.set(x, 0, -3.7)
      this.scene.add(roof)
    }
    for (let x = -6; x <= 6; x += 3) {
      const paving = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.04, 1.15), makeMat('#a59479', 0.93))
      paving.position.set(x, 0.035, -15.8)
      this.scene.add(paving)
    }
  }

  private addRitualProps(): void {
    const bronze = makeMat('#80623c', 0.38, 0.52)
    const gold = makeMat(C.gold, 0.42, 0.36)
    const red = makeMat(C.vermilion)
    const wood = makeMat(C.darkWood)

    // Main incense urn and three slender sticks.
    const urn = new THREE.Group()
    urn.position.set(0, 0, -2.55)
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
    this.physics.addStaticCylinder(new THREE.Vector3(0, 0.55, -2.55), 0.86, 1.1)

    // Offerings table outside the altar, plus offerings appear on the altar after use.
    this.addTable(new THREE.Vector3(-4.4, 0, -4.2), 2.8, 1.45)
    const flowerVase = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.4, 0.7, 10), makeMat('#987448'))
    flowerVase.position.set(-4.8, 1.8, -4.15)
    this.scene.add(flowerVase)
    for (let i = 0; i < 5; i += 1) {
      const petal = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), makeMat(i % 2 ? '#ead2b5' : '#c55d4e'))
      const a = i * Math.PI * 2 / 5
      petal.position.set(-4.8 + Math.cos(a) * 0.29, 2.35, -4.15 + Math.sin(a) * 0.29)
      petal.scale.set(1, 0.65, 1.45)
      this.scene.add(petal)
    }

    // Lamp stand: three separate lights; progress is reflected on the 3D objects.
    this.lamps.forEach((lamp, i) => {
      const stand = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.44, 1.3), wood)
      stand.position.set(lamp.position.x, 0.28, lamp.position.z)
      this.scene.add(stand)
      const bodyMat = makeMat(C.vermilion, 0.42, 0.04)
      bodyMat.emissive.set('#280a06')
      bodyMat.emissiveIntensity = 0.08
      this.lampMats.set(lamp.id, bodyMat)
      const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 1), bodyMat)
      body.scale.y = 1.35
      body.position.set(lamp.position.x, 1.18, lamp.position.z)
      body.castShadow = true
      this.scene.add(body)
      const top = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.28, 8), gold)
      top.position.set(lamp.position.x, 2.05, lamp.position.z)
      this.scene.add(top)
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.52, 0.18, 8), gold)
      base.position.set(lamp.position.x, 0.68, lamp.position.z)
      this.scene.add(base)
      const light = new THREE.PointLight('#f5a84c', 0.16, 6, 2)
      light.position.set(lamp.position.x, 1.55, lamp.position.z)
      this.scene.add(light)
      this.lampLights.set(lamp.id, light)
      const label = new THREE.Mesh(new THREE.PlaneGeometry(1.18, 0.32), this.textMaterial(['平安', '財神', '文昌'][i], '#f4d88f', '#40271d'))
      label.position.set(lamp.position.x, 0.56, lamp.position.z + 0.67)
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
    this.scene.add(bellBase)
    for (const x of [14.25, 16.15]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.21, 4.1, 9), red)
      pillar.position.set(x, 2.1, -8)
      this.scene.add(pillar)
      this.physics.addStaticCylinder(new THREE.Vector3(x, 2.05, -8), 0.18, 4.1)
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.24, 0.25), wood)
    lintel.position.set(15.2, 4.1, -8)
    this.scene.add(lintel)
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
    this.scene.add(this.bell)
    const bellRoof = this.createRoof(4.2, 3.5, 4.1, 5.4)
    bellRoof.position.set(15.2, 0, -8)
    this.scene.add(bellRoof)

    // Prayer wall panel.
    const panel = new THREE.Mesh(new THREE.BoxGeometry(5.1, 3.6, 0.42), makeMat(C.darkWood))
    panel.position.set(17.5, 2.3, 4.3)
    panel.rotation.y = -Math.PI / 2
    panel.castShadow = true
    this.scene.add(panel)
    const panelFace = new THREE.Mesh(new THREE.PlaneGeometry(4.45, 2.9), this.textMaterial('祈 願 牆', '#e4c17a', '#3b251b'))
    panelFace.position.set(17.25, 2.4, 4.3)
    panelFace.rotation.y = -Math.PI / 2
    this.scene.add(panelFace)
    this.physics.addStaticBox(new THREE.Vector3(17.5, 2.2, 4.3), new THREE.Vector3(0.45, 3.7, 5.2))

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
    this.physics.addStaticBox(new THREE.Vector3(15.2, 0.6, -8), new THREE.Vector3(2.4, 1.2, 2.2))
    this.physics.addStaticBox(new THREE.Vector3(17.2, 0.9, 0.2), new THREE.Vector3(0.4, 1.7, 2.2))
    for (const lamp of this.lamps) this.physics.addStaticBox(new THREE.Vector3(lamp.position.x, 1, lamp.position.z), new THREE.Vector3(1.3, 2, 1.3))
    this.physics.addStaticBox(new THREE.Vector3(0, 0.9, -11.55), new THREE.Vector3(6.8, 1.8, 2.1))
    this.physics.addStaticBox(new THREE.Vector3(0, 1, -12.7), new THREE.Vector3(3.5, 2, 2.7))
  }

  private addTable(position: THREE.Vector3, width: number, height: number): void {
    const group = new THREE.Group()
    group.position.copy(position)
    const wood = makeMat(C.wood)
    const top = new THREE.Mesh(new THREE.BoxGeometry(width, 0.22, 1.35), makeMat('#754733'))
    top.position.y = height
    top.castShadow = true
    top.receiveShadow = true
    group.add(top)
    for (const x of [-width * 0.42, width * 0.42]) for (const z of [-0.48, 0.48]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, height, 0.18), wood)
      leg.position.set(x, height / 2, z)
      group.add(leg)
    }
    this.scene.add(group)
    this.physics.addStaticBox(new THREE.Vector3(position.x, height / 2, position.z), new THREE.Vector3(width * 0.8, height, 1.05))
  }

  private addMarkers(): void {
    const colors: Record<ShrinePointId, string> = {
      incense: '#e8bb71', prayer: '#e8bb71', offerings: '#d8a45e', 'daily-lot': '#d8a45e', chess: '#a9c2a9',
      lamps: '#edba61', woodfish: '#d68c63', bell: '#e8c77d', 'wishing-pool': '#a8d2c6', 'prayer-wall': '#e8c77d',
      records: '#e8c77d', tiangong: '#f0c070', drum: '#d68c63', yuhuang: '#f5d77f', 'gold-furnace': '#e27b4e',
      'guanyin-dragon': '#ffea70',
    }
    for (const point of this.points) {
      const mat = new THREE.MeshBasicMaterial({ color: colors[point.id], transparent: true, opacity: 0.42, depthWrite: false })
      const marker = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.038, 6, 30), mat)
      marker.rotation.x = Math.PI / 2
      marker.position.set(point.position.x, 0.09, point.position.z)
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
    ball.position.set(x, y, -7)
    parent.add(ball)
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.55, 8), makeMat(C.gold, 0.4, 0.2))
    tip.position.set(x, y + 0.34, -7)
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

  /** Fallback when the 3D model cannot load: the flat golden image used before. */
  showStatueImageFallback(): void {
    const root = this.guanyinRoot
    if (!root || this.guanyinModelPlaced) return
    const statueH = 3.2
    const statueW = statueH * (376 / 537)
    new THREE.TextureLoader().load('./assets/guanyin-golden.png', tex => {
      tex.colorSpace = THREE.SRGBColorSpace
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide })
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(statueW, statueH), mat)
      mesh.position.set(0, 0.32 + statueH / 2, 0)
      root.add(mesh)
    })
  }

  private createGuanyinStatue(): THREE.Group {
    const root = new THREE.Group()
    const goldMat = new THREE.MeshStandardMaterial({ color: '#dca44b', roughness: 0.35, metalness: 0.6 })
    const haloMat = new THREE.MeshBasicMaterial({ color: '#ffeaad', transparent: true, opacity: 0.55, side: THREE.DoubleSide })

    // 1. Multi-tier Lotus Throne (金雕蓮花寶台基座)
    const lotusBase = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 0.35, 24), goldMat)
    lotusBase.position.y = 0.18
    lotusBase.castShadow = true
    root.add(lotusBase)

    // 2. The 3D statue itself is added by setStatue() once the GLB model loads.

    // 3. Radiant Holy Backlight Halo (圓滿大放神光背光金輪)
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.75, 36), haloMat)
    halo.position.set(0, 2.1, -0.75)
    root.add(halo)

    const haloInner = new THREE.Mesh(new THREE.CircleGeometry(0.82, 36), new THREE.MeshBasicMaterial({ color: '#ffebb3', transparent: true, opacity: 0.3 }))
    haloInner.position.set(0, 2.1, -0.74)
    root.add(haloInner)

    // Warm Divine Aura Light (微弱聖光，照亮四周神龕但不直接在畫像上反光)
    const statueGlow = new THREE.PointLight('#ffe6a3', 0.6, 7, 2)
    statueGlow.position.set(0, 2.2, 0.7)
    root.add(statueGlow)

    return root
  }

  private addGiantDragonGuanyin(): void {
    const pos = DRAGON_GUANYIN_POS
    const root = new THREE.Group()
    root.position.copy(pos)

    const stoneMat = makeMat('#887d70', 0.9, 0.05)
    const waistMat = makeMat('#36281e', 0.85, 0.1)
    const goldMat = makeMat('#d4af37', 0.35, 0.45)
    const vermilionMat = makeMat('#962d22', 0.72)
    const balustradeMat = makeMat('#d8d1c5', 0.85)

    // 1. 3D 實體九品蓮台基座（以 Three.js 實體石造須彌座與金雕蓮花座承接，徹底去除重複底座）
    // 底層石造八角大台基 (Tier 1)
    const tier1 = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.5, 0.55, 16), stoneMat)
    tier1.position.y = 0.275
    tier1.castShadow = true
    tier1.receiveShadow = true
    root.add(tier1)

    // 底層外緣踏步
    const tier1Step = new THREE.Mesh(new THREE.CylinderGeometry(4.55, 4.75, 0.2, 16), stoneMat)
    tier1Step.position.y = 0.1
    tier1Step.receiveShadow = true
    root.add(tier1Step)

    // 中層束腰雕花基座 (Tier 2)
    const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.7, 0.65, 16), waistMat)
    tier2.position.y = 0.85
    tier2.castShadow = true
    tier2.receiveShadow = true
    root.add(tier2)

    // 頂層金雕九品蓮花座 (Tier 3)
    const tier3 = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.3, 0.75, 24), goldMat)
    tier3.position.y = 1.55
    tier3.castShadow = true
    root.add(tier3)

    // 雙層圓潤金蓮飾環 (Smooth Lotus Petal Torus Rings)
    const lotusRing1 = new THREE.Mesh(new THREE.TorusGeometry(3.15, 0.16, 12, 32), goldMat)
    lotusRing1.rotation.x = Math.PI / 2
    lotusRing1.position.y = 1.85
    root.add(lotusRing1)

    const lotusRing2 = new THREE.Mesh(new THREE.TorusGeometry(2.8, 0.14, 12, 32), goldMat)
    lotusRing2.rotation.x = Math.PI / 2
    lotusRing2.position.y = 1.95
    root.add(lotusRing2)

    // 朱紅雕花欄杆與漢白玉望柱（圍繞底層台基，東向朝向小徑來向保留大步道）
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2
      if (Math.abs(a) < 0.35 || Math.abs(a - Math.PI * 2) < 0.35) continue // 東面朝向小徑來向留出參拜步道
      const px = Math.cos(a) * 4.35
      const pz = Math.sin(a) * 4.35
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.55, 0.16), balustradeMat)
      post.position.set(px, 0.65, pz)
      const bud = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), goldMat)
      bud.position.set(px, 0.98, pz)
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.32, 0.08), vermilionMat)
      rail.position.set(px, 0.55, pz)
      rail.rotation.y = a + Math.PI / 2
      root.add(post, bud, rail)
    }

    // 加上實體碰撞 (Collision) 防止玩家穿透基座
    this.physics.addStaticCylinder(pos, 4.3, 2.0)

    // 2. 巨型透明材質立牌（已去除圖片底部的重複繪製底座，僅保留觀音菩薩、乘雲金龍與雪白翻騰波濤，自然融入 3D 蓮花座）
    const loader = new THREE.TextureLoader()
    const guanyinTex = loader.load('./guanyin.png', undefined, undefined, () => {
      loader.load('/guanyin.png', t2 => {
        t2.colorSpace = THREE.SRGBColorSpace
        planeMat.map = t2
        planeMat.needsUpdate = true
      })
    })
    guanyinTex.colorSpace = THREE.SRGBColorSpace

    const planeMat = new THREE.MeshBasicMaterial({
      map: guanyinTex,
      transparent: true,
      alphaTest: 0.25,
      side: THREE.DoubleSide,
      depthWrite: true,
    })

    // 比例 571 / 675 = 0.846，高 11.2 單位、寬 9.48 單位
    const billH = 11.2
    const billW = billH * (571 / 675)
    const billboard = new THREE.Mesh(new THREE.PlaneGeometry(billW, billH), planeMat)
    // 底座頂端位於 y = 1.95，立牌底部精確密接蓮花座，中心點置於 y = 1.95 + billH / 2 = 7.55，通高達 13.2 單位
    billboard.position.set(0, 1.95 + billH / 2, 0)
    billboard.castShadow = true
    root.add(billboard)
    this.dragonGuanyinBillboard = billboard

    // 3. 底部青銅九龍香爐與香火煙霧（朝向東面迎接從小徑前來的參拜善信）
    const urn = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.42, 0.65, 12), makeMat('#523e2b', 0.6, 0.4))
    urn.position.set(4.6, 0.35, 0)
    const urnRim = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.06, 8, 16), goldMat)
    urnRim.rotation.x = Math.PI / 2
    urnRim.position.set(4.6, 0.68, 0)
    const ember = new THREE.Mesh(new THREE.CircleGeometry(0.48, 12), new THREE.MeshBasicMaterial({ color: '#ff5522' }))
    ember.rotation.x = -Math.PI / 2
    ember.position.set(4.6, 0.69, 0)
    root.add(urn, urnRim, ember)
    this.dragonGuanyinUrnPos = new THREE.Vector3(pos.x + 4.6, 0.75, pos.z)

    // 4. 金光神聖氛圍燈 (Golden Aura PointLight)
    const auraLight = new THREE.PointLight('#ffdb70', 1.25, 14, 2)
    auraLight.position.set(0, 3.2, 0)
    root.add(auraLight)

    // 5. 動態氣場：基座周圍緩慢上升的金色粒子特效 (Golden Ascending Aura Particles)
    const particleCount = 200
    const positions = new Float32Array(particleCount * 3)
    this.auraParticleData = []
    for (let i = 0; i < particleCount; i++) {
      const radius = 0.6 + Math.random() * 3.4
      const angle = Math.random() * Math.PI * 2
      const y = 2.0 + Math.random() * 11.5
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
    this.renderSkyGradient('day')
    this.skyTex = new THREE.CanvasTexture(this.skyCv)
    this.skyTex.colorSpace = THREE.SRGBColorSpace

    const domeGeo = new THREE.SphereGeometry(180, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.52)
    const domeMat = new THREE.MeshBasicMaterial({ map: this.skyTex, side: THREE.BackSide, depthWrite: false, fog: false })
    const dome = new THREE.Mesh(domeGeo, domeMat)
    dome.position.set(0, -6, 10)
    this.scene.add(dome)
  }

  private renderSkyGradient(mode: TimeOfDay): void {
    const ctx = this.skyCv.getContext('2d')!
    const grad = ctx.createLinearGradient(0, 0, 0, 256)
    if (mode === 'dawn') {
      grad.addColorStop(0, '#2c3b59')
      grad.addColorStop(0.35, '#8c4840')
      grad.addColorStop(0.72, '#d47752')
      grad.addColorStop(1, '#fad794')
    } else if (mode === 'dusk') {
      grad.addColorStop(0, '#1c1c38')
      grad.addColorStop(0.35, '#5e2348')
      grad.addColorStop(0.72, '#a63e3d')
      grad.addColorStop(1, '#e67e22')
    } else if (mode === 'night') {
      grad.addColorStop(0, '#050811')
      grad.addColorStop(0.35, '#0b1424')
      grad.addColorStop(0.72, '#121e33')
      grad.addColorStop(1, '#1b2a45')
    } else {
      // day
      grad.addColorStop(0, '#5a8fa8')
      grad.addColorStop(0.35, '#86adbe')
      grad.addColorStop(0.72, '#c1d4dc')
      grad.addColorStop(1, '#ebe4d3')
    }
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 64, 256)
  }

  getTimeOfDay(): TimeOfDay { return this.timeOfDay }

  setTimeOfDay(mode: TimeOfDay): void {
    this.timeOfDay = mode
    this.renderSkyGradient(mode)
    if (this.skyTex) this.skyTex.needsUpdate = true

    if (mode === 'dawn') {
      this.scene.background = new THREE.Color('#ba6a55')
      ;(this.scene.fog as THREE.Fog).color.set('#c77a63')
      this.sun.color.set('#ffcca0')
      this.sun.intensity = 1.15
      this.hemiLight.color.set('#ffd8b8')
      this.hemiLight.groundColor.set('#4a3832')
      this.hemiLight.intensity = 0.95
      if (this.cloudMat) { this.cloudMat.color.set('#fedbc7'); this.cloudMat.opacity = 0.85 }
    } else if (mode === 'dusk') {
      this.scene.background = new THREE.Color('#6a2838')
      ;(this.scene.fog as THREE.Fog).color.set('#7d3242')
      this.sun.color.set('#ff7733')
      this.sun.intensity = 0.95
      this.hemiLight.color.set('#ff9966')
      this.hemiLight.groundColor.set('#2d1e24')
      this.hemiLight.intensity = 0.8
      if (this.cloudMat) { this.cloudMat.color.set('#fca57c'); this.cloudMat.opacity = 0.88 }
    } else if (mode === 'night') {
      this.scene.background = new THREE.Color('#0b101c')
      ;(this.scene.fog as THREE.Fog).color.set('#0f1626')
      this.sun.color.set('#486088')
      this.sun.intensity = 0.32
      this.hemiLight.color.set('#24334d')
      this.hemiLight.groundColor.set('#0d1117')
      this.hemiLight.intensity = 0.45
      if (this.cloudMat) { this.cloudMat.color.set('#45526c'); this.cloudMat.opacity = 0.4 }
    } else {
      // day
      this.scene.background = new THREE.Color('#98b8cb')
      ;(this.scene.fog as THREE.Fog).color.set('#bfd4df')
      this.sun.color.set('#fff0d0')
      this.sun.intensity = 1.35
      this.hemiLight.color.set('#fbf4e8')
      this.hemiLight.groundColor.set('#636b69')
      this.hemiLight.intensity = 1.1
      if (this.cloudMat) { this.cloudMat.color.set('#fefcf8'); this.cloudMat.opacity = 0.82 }
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
    this.guideBeacon.position.set(to.x, 0, to.z)
    const pulse = 0.55 + Math.sin(time * 4) * 0.15
    ;(this.guideBeacon.material as THREE.MeshBasicMaterial).opacity = pulse * 0.5
  }
  setAvatarVisible(visible: boolean): void { this.avatarStand.visible = visible }

  nearestPoint(position: THREE.Vector3): ShrinePoint | null {
    let nearest: ShrinePoint | null = null
    let best = Infinity
    for (const point of this.points) {
      const d = Math.hypot(point.position.x - position.x, point.position.z - position.z)
      if (d <= point.radius && d < best) { nearest = point; best = d }
    }
    return nearest
  }

  perform(action: string, offeringCounts?: Partial<Record<OfferingId, number>>): void {
    if (action === 'incense' || action === 'wish' || action === 'prayer') {
      this.spawnSmoke(new THREE.Vector3(0, 1.2, -2.6))
      this.incenseGlow.intensity = 0.9
    }
    if (action.startsWith('lamp-')) {
      const id = action.slice(5) as LampId
      const mat = this.lampMats.get(id)
      const light = this.lampLights.get(id)
      if (mat) { mat.emissive.set('#e6973b'); mat.emissiveIntensity = 0.9 }
      if (light) light.intensity = 1.35
    }
    if (action.startsWith('offer-')) {
      const id = action.slice(6) as OfferingId
      this.addOffering(id, offeringCounts?.[id] ?? 1)
    }
    if (action === 'woodfish') this.woodfishImpulse = 0.2
    if (action === 'bell') this.bellImpulse = 0.23
    if (action === 'drum') this.drumImpulse = 0.35
    if (action === 'coin') this.dropCoin()
    if (action === 'lottery') this.spawnSmoke(new THREE.Vector3(-11.8, 1.8, 1.2))
    if (action === 'chess') this.spawnSmoke(new THREE.Vector3(PAVILION.x, 1.2, PAVILION.z))
    if (action === 'tiangong') { this.spawnSmoke(this.courtyard.tiangongSmoke.clone()); this.courtyard.tiangongGlow.intensity = 1.4 }
    if (action === 'yuhuang') { this.spawnSmoke(new THREE.Vector3(0, 2.6, -29.5)) }
    if (action === 'gold-furnace') { this.spawnSmoke(new THREE.Vector3(GOLD_FURNACE.x, 3.2, GOLD_FURNACE.z)) }
    if (action === 'guanyin-dragon') {
      if (this.dragonGuanyinUrnPos) this.spawnSmoke(this.dragonGuanyinUrnPos.clone())
    }
  }

  update(dt: number, time: number, playerPosition: THREE.Vector3, activePoint: ShrinePointId | null, camera?: THREE.Camera): void {
    const insideHall = playerPosition.z < 0 && playerPosition.z > -13.5 && Math.abs(playerPosition.x) < 9
    this.roof.visible = !insideHall
    const insideRear = playerPosition.z < -16.5 && playerPosition.z > -33.5 && Math.abs(playerPosition.x) < 12.0
    this.rearRoof.visible = !insideRear
    this.incenseGlow.intensity = THREE.MathUtils.damp(this.incenseGlow.intensity, 0.22, 1.4, dt)
    this.courtyard.update(time)

    // Y 軸鎖定面向攝影機（Y-axis Billboard）：水平旋轉永遠面向鏡頭，固定俯仰角（Pitch），產生壯闊立體壓迫感
    if (this.dragonGuanyinBillboard && camera) {
      const camPos = camera.position
      const angle = Math.atan2(camPos.x - DRAGON_GUANYIN_POS.x, camPos.z - DRAGON_GUANYIN_POS.z)
      this.dragonGuanyinBillboard.rotation.y = angle
      this.dragonGuanyinBillboard.rotation.x = 0
      this.dragonGuanyinBillboard.rotation.z = 0
    }

    // 動態氣場：金色神光粒子向上螺旋升騰
    if (this.auraParticles && this.auraParticleData) {
      const posAttr = this.auraParticles.geometry.attributes.position as THREE.BufferAttribute
      const arr = posAttr.array as Float32Array
      for (let i = 0; i < this.auraParticleData.length; i++) {
        const p = this.auraParticleData[i]
        p.angle += p.rotSpeed * dt
        let y = arr[i * 3 + 1] + p.speed * dt
        if (y > 13.8) {
          y = 2.0
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

    // Gentle cloud drifting animation across celestial dome
    for (const c of this.clouds) {
      c.x += c.speed * dt
      if (c.x > 90) {
        c.x = -90
      }
      c.mesh.position.x = c.x
      c.mesh.position.y = c.y + Math.sin(time * 0.35 + c.z) * 0.35
    }
    // A thin, continuous thread of smoke above the Tiangong urn.
    this.puffTimer -= dt
    if (this.puffTimer <= 0 && !this.reducedSmoke) { this.puffTimer = 0.8; this.spawnPuff(this.courtyard.tiangongSmoke) }
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
    for (let i = this.coins.length - 1; i >= 0; i -= 1) {
      const c = this.coins[i]
      c.age += dt
      c.mesh.position.y = Math.max(0.33, 1.5 - c.age * 1.8)
      c.mesh.rotation.z += dt * 4
      c.ripple.scale.setScalar(0.2 + c.age * 0.7)
      ;(c.ripple.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.5 - c.age * 0.35)
      if (c.age > 1.5) {
        this.scene.remove(c.mesh, c.ripple)
        c.mesh.geometry.dispose()
        ;(c.mesh.material as THREE.Material).dispose()
        c.ripple.geometry.dispose()
        ;(c.ripple.material as THREE.Material).dispose()
        this.coins.splice(i, 1)
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

  private dropCoin(): void {
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.045, 20), makeMat(C.gold, 0.28, 0.6))
    coin.position.set(WISH_POOL.x + (Math.random() - 0.5) * 0.8, 1.5, WISH_POOL.z + (Math.random() - 0.5) * 0.8)
    coin.castShadow = true
    this.scene.add(coin)
    const rippleMat = new THREE.MeshBasicMaterial({ color: '#cae2cf', transparent: true, opacity: 0.5, depthWrite: false })
    const ripple = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 6, 28), rippleMat)
    ripple.rotation.x = Math.PI / 2
    ripple.position.set(coin.position.x, 0.31, coin.position.z)
    this.scene.add(ripple)
    this.coins.push({ mesh: coin, age: 0, ripple })
  }
}
