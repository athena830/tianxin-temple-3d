import * as THREE from 'three'
import { Chibi } from './chibi'
import type { Physics } from '../engine/physics'
import type { LampId, OfferingId } from './temple-data'
import { FrontCourtyard, PAVILION, STAND, TIANGONG, WISH_POOL } from './temple-courtyard'

export type ShrinePointId =
  | 'incense' | 'prayer' | 'offerings' | 'daily-lot' | 'chess'
  | 'lamps' | 'woodfish' | 'bell' | 'wishing-pool' | 'prayer-wall' | 'records' | 'tiangong'

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
]
const pointPositions: [number, number][] = [
  [0, 0.4], [3.2, -3.4], [-4.4, -2.2], [-9.2, 1.2], [PAVILION.x + 1.6, PAVILION.z],
  [12.5, 2.2], [8.5, -6.2], [12.4, -5.6], [WISH_POOL.x + 3.9, WISH_POOL.z], [14.6, 4.3], [15, 0.2],
  [TIANGONG.x - 3.0, TIANGONG.z],
]

/** Object each station faces, used to orient visitors who use the quick guide. */
export const POINT_TARGETS: [number, number][] = [
  [0, -2.55], [0, -12.2], [-4.4, -4.2], [-12, 1.2], [PAVILION.x, PAVILION.z],
  [12.5, -1.6], [8.5, -8.5], [15.2, -8], [WISH_POOL.x, WISH_POOL.z], [17.5, 4.3], [17.2, 0.2],
  [TIANGONG.x, TIANGONG.z],
]

const makeMat = (color: string, roughness = 0.82, metalness = 0): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness })

export class TempleWorld {
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
  private readonly woodfish = new THREE.Group()
  private readonly avatarStand = new THREE.Group()
  private readonly chibi = new Chibi()
  private readonly guideArrow: THREE.Mesh
  private readonly guideBeacon: THREE.Mesh
  private readonly incenseGlow: THREE.PointLight
  private readonly courtyard: FrontCourtyard
  private puffTimer = 0
  private bellImpulse = 0
  private woodfishImpulse = 0
  private readonly lamps: { id: LampId; position: THREE.Vector3 }[] = [
    { id: 'peace', position: new THREE.Vector3(10, 0, -1.6) },
    { id: 'wealth', position: new THREE.Vector3(12.5, 0, -1.6) },
    { id: 'study', position: new THREE.Vector3(15, 0, -1.6) },
  ]
  private readonly clouds: { mesh: THREE.Group; speed: number; x: number; z: number; y: number }[] = []

  constructor(private readonly physics: Physics) {
    // Elegant warm celestial sky & gentle horizon fog (澄澈淡碧與暖金宮闕天空色調)
    this.scene.background = new THREE.Color('#98b8cb')
    this.scene.fog = new THREE.Fog('#bfd4df', 65, 175)
    this.scene.add(new THREE.HemisphereLight('#fbf4e8', '#636b69', 1.1))
    const sun = new THREE.DirectionalLight('#fff0d0', 1.35)
    sun.position.set(-18, 34, 30)
    sun.target.position.set(0, 0, 12)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.left = -40
    sun.shadow.camera.right = 40
    sun.shadow.camera.top = 52
    sun.shadow.camera.bottom = -36
    sun.shadow.camera.near = 1
    sun.shadow.camera.far = 110
    sun.shadow.normalBias = 0.035
    this.scene.add(sun, sun.target)

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

    // 2. Solid Back Wall with Passageway Doors to Rear Hall (神龕背牆與通往後殿之左右穿堂過水門)
    // Central Shrine Back Wall (中央主殿神龕實體背牆)
    const backCenter = new THREE.Mesh(new THREE.BoxGeometry(11.2, 5.1, 0.6), makeMat('#543b2f'))
    backCenter.position.set(0, 2.55, -6.4)
    backCenter.castShadow = true
    backCenter.receiveShadow = true
    hall.add(backCenter)
    this.physics.addStaticBox(new THREE.Vector3(0, 2.55, -13.4), new THREE.Vector3(11.2, 5.1, 0.6))

    // Left & Right Outer Back Walls (左右外側背牆與連通拱門)
    for (const side of [-1, 1]) {
      const outerWall = new THREE.Mesh(new THREE.BoxGeometry(3.1, 5.1, 0.6), makeMat('#543b2f'))
      outerWall.position.set(side * 8.05, 2.55, -6.4)
      outerWall.castShadow = true
      outerWall.receiveShadow = true
      hall.add(outerWall)
      this.physics.addStaticBox(new THREE.Vector3(side * 8.05, 2.55, -13.4), new THREE.Vector3(3.1, 5.1, 0.6))

      // Arch door lintel above open passageway to rear courtyard
      const doorLintel = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.4, 0.6), redDark)
      doorLintel.position.set(side * 5.65, 4.4, -6.4)
      hall.add(doorLintel)
      const doorSign = new THREE.Mesh(
        new THREE.PlaneGeometry(1.4, 0.38),
        this.textMaterial(side === 1 ? '達 地' : '通 天', '#dfc17c', '#362117')
      )
      doorSign.position.set(side * 5.65, 4.25, -6.08)
      hall.add(doorSign)
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

    // A. 中門（中央神明出入聖道：朱紅九路八十一金釘厚實雙開大門，凡人勿行）
    const centerDoorFrame = new THREE.Mesh(new THREE.BoxGeometry(4.4, 4.6, 0.32), redDark)
    centerDoorFrame.position.set(0, 2.3, 5.2)
    hall.add(centerDoorFrame)

    // Double closed vermilion doors with gold studs (兩扇朱紅九路金釘閉合大門)
    for (const dSide of [-1, 1]) {
      const doorLeaf = new THREE.Mesh(new THREE.BoxGeometry(1.95, 4.0, 0.14), makeMat('#702219', 0.8))
      doorLeaf.position.set(dSide * 1.0, 2.15, 5.26)
      hall.add(doorLeaf)
      // 9 rows of golden bosses/studs (金銅門釘)
      for (let row = 0; row < 5; row += 1) {
        for (let col = 0; col < 3; col += 1) {
          const stud = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), gold)
          stud.position.set(dSide * (0.35 + col * 0.6), 0.8 + row * 0.7, 5.34)
          hall.add(stud)
        }
      }
      // Gilded door pull ring (金銅鋪首銜環)
      const ringTorus = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 8, 16), gold)
      ringTorus.position.set(dSide * 0.75, 2.1, 5.35)
      hall.add(ringTorus)
    }

    // High Door Threshold (高木門檻)
    const threshold = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.35, 0.28), darkWood)
    threshold.position.set(0, 0.45, 5.28)
    hall.add(threshold)

    // Center Door Lintel & Main Plaque (中門主門額：「中門・神明聖道」)
    const centerLintel = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.75, 0.38), darkWood)
    centerLintel.position.set(0, 4.5, 5.24)
    hall.add(centerLintel)
    const centerPlaque = new THREE.Mesh(
      new THREE.PlaneGeometry(3.9, 0.65),
      this.textMaterial('中 門 ・ 神 明 聖 道', '#f5d688', '#2d180f')
    )
    centerPlaque.position.set(0, 4.5, 5.45)
    hall.add(centerPlaque)

    // Sacred Warning Plaque across the lower center door (「神明聖道・凡人勿行」)
    const sacredSign = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 0.42),
      this.textMaterial('神 明 出 入 聖 道 ・ 凡 人 勿 行', '#e5c07b', '#3b2014')
    )
    sacredSign.position.set(0, 1.25, 5.38)
    hall.add(sacredSign)

    // Physics Barrier for Middle Door (中門實體阻隔，守護神聖禮制)
    this.physics.addStaticBox(new THREE.Vector3(0, 2.4, -1.8), new THREE.Vector3(4.4, 4.8, 0.35))

    // B. 右邊龍門（入口，面向大殿右邊 +X 側，敞開通行進入大殿參拜）
    // Portal archway framing between column x=5.4 and x=8.1 (centered at x = 6.75)
    const dragonPortalLintel = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.9, 0.36), redDark)
    dragonPortalLintel.position.set(6.75, 4.35, 5.2)
    hall.add(dragonPortalLintel)

    const dragonDoorPlaque = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 0.52),
      this.textMaterial('龍 門', '#f6d88c', '#2c170f')
    )
    dragonDoorPlaque.position.set(6.75, 4.5, 5.4)
    hall.add(dragonDoorPlaque)

    const dragonDoorSub = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 0.36),
      this.textMaterial('入 龍 門 ( 參 拜 入 口 )', '#e6c37c', '#331c12')
    )
    dragonDoorSub.position.set(6.75, 3.92, 5.4)
    hall.add(dragonDoorSub)

    // Directional ground marker for entering Dragon Gate
    const enterMarker = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 0.45),
      this.textMaterial('➡ 入 龍 門 ( 參 拜 入 口 )', '#f6d88c', '#4b2a1a')
    )
    enterMarker.rotation.x = -Math.PI / 2
    enterMarker.position.set(6.75, 0.29, 6.2)
    hall.add(enterMarker)

    // C. 左邊虎門（出口，面向大殿左邊 -X 側，敞開通行離開大殿）
    // Portal archway framing between column x=-8.1 and x=-5.4 (centered at x = -6.75)
    const tigerPortalLintel = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.9, 0.36), redDark)
    tigerPortalLintel.position.set(-6.75, 4.35, 5.2)
    hall.add(tigerPortalLintel)

    const tigerDoorPlaque = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 0.52),
      this.textMaterial('虎 門', '#f6d88c', '#2c170f')
    )
    tigerDoorPlaque.position.set(-6.75, 4.5, 5.4)
    hall.add(tigerDoorPlaque)

    const tigerDoorSub = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 0.36),
      this.textMaterial('出 虎 門 ( 離 殿 出 口 )', '#e6c37c', '#331c12')
    )
    tigerDoorSub.position.set(-6.75, 3.92, 5.4)
    hall.add(tigerDoorSub)

    // Directional ground marker for exiting Tiger Gate
    const exitMarker = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 0.45),
      this.textMaterial('⬅ 出 虎 門 ( 離 殿 出 口 )', '#f6d88c', '#4b2a1a')
    )
    exitMarker.rotation.x = -Math.PI / 2
    exitMarker.position.set(-6.75, 0.29, 6.2)
    hall.add(exitMarker)

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
    for (const x of [-6.3, -3.2, 0, 3.2, 6.3]) {
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
   * 位於正殿正後方，全廟第二進神聖殿閣，供奉淵源更深之玉皇上帝。
   * 設有台基石階、四大金柱、雕花隔扇、凌霄寶殿主匾、玉皇神龕金光道輪與重簷歇山殿頂。
   */
  private addRearHall(): void {
    const rear = new THREE.Group()
    rear.position.set(0, 0, -20.5)
    this.scene.add(rear)

    const red = makeMat(C.vermilion)
    const wood = makeMat(C.wood)
    const darkWood = makeMat(C.darkWood, 0.88)
    const gold = makeMat(C.gold, 0.48, 0.2)
    const stonePlinth = makeMat('#9e9382', 0.94)
    const jade = makeMat(C.jade, 0.4, 0.25)

    // 1. Raised Terrace & Grand Approach Steps (後殿高聳基座與踏步)
    const podium = new THREE.Mesh(new THREE.BoxGeometry(18.4, 0.42, 9.6), stonePlinth)
    podium.position.set(0, 0.21, 0)
    podium.receiveShadow = true
    rear.add(podium)
    this.physics.addStaticBox(new THREE.Vector3(0, 0.21, -20.5), new THREE.Vector3(18.4, 0.42, 9.6))

    // Front stone steps (三級登殿石階)
    const steps = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.21, 1.2), stonePlinth)
    steps.position.set(0, 0.105, 5.2)
    steps.receiveShadow = true
    rear.add(steps)

    // 2. Solid Rear Boundary Wall (後殿厚實背牆)
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(17.6, 5.8, 0.6), makeMat('#543b2f'))
    backWall.position.set(0, 2.9, -4.5)
    backWall.castShadow = true
    rear.add(backWall)
    this.physics.addStaticBox(new THREE.Vector3(0, 2.9, -25.0), new THREE.Vector3(17.6, 5.8, 0.6))

    // 3. Side Walls with Lattice Screens (後殿左右山牆與穿堂過水廊)
    for (const side of [-1, 1]) {
      const sx = side * 8.6
      const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.55, 5.8, 9.2), darkWood)
      sideWall.position.set(sx, 2.9, 0)
      rear.add(sideWall)
      this.physics.addStaticBox(new THREE.Vector3(sx, 2.9, -20.5), new THREE.Vector3(0.55, 5.8, 9.2))

      // Side connecting corridors (左右天井連通迴廊)
      const corridor = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.2, 5.8), stonePlinth)
      corridor.position.set(side * 8.0, 0.1, 4.8)
      rear.add(corridor)
      const corridorRoof = this.createRoof(4.2, 6.2, 3.8, 4.8)
      corridorRoof.position.set(side * 8.0, 0, -15.7)
      this.scene.add(corridorRoof)
    }

    // 4. Grand Front Columns (後殿四大金柱與橫樑)
    for (const x of [-6.4, -2.8, 2.8, 6.4]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.44, 5.6, 12), red)
      col.position.set(x, 2.8, 4.3)
      col.castShadow = true
      rear.add(col)
      this.physics.addStaticCylinder(new THREE.Vector3(x, 2.8, -16.2), 0.38, 5.6)
      const colCap = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.18, 12), gold)
      colCap.position.set(x, 5.2, 4.3)
      rear.add(colCap)
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(17.6, 0.5, 0.5), wood)
    beam.position.set(0, 5.6, 4.3)
    rear.add(beam)

    // 5. Plaque of the Rear Hall: 「凌 霄 寶 殿」 (後殿主匾額)
    const plaqueFrame = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.4, 0.16), darkWood)
    plaqueFrame.position.set(0, 5.0, 4.58)
    rear.add(plaqueFrame)
    const plaqueText = new THREE.Mesh(
      new THREE.PlaneGeometry(4.5, 1.15),
      this.textMaterial('凌 霄 寶 殿', '#f4d588', '#2a170f')
    )
    plaqueText.position.set(0, 5.0, 4.67)
    rear.add(plaqueText)

    // 6. Sacred Altar of the Supreme Celestial Sovereign (玉皇神龕金座)
    const jadeAltar = new THREE.Mesh(new THREE.BoxGeometry(6.2, 1.1, 2.2), jade)
    jadeAltar.position.set(0, 0.95, -2.8)
    rear.add(jadeAltar)

    // Golden Halo and Divine Throne (後殿金光道輪與神聖座席)
    const throneBack = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.4, 0.25), darkWood)
    throneBack.position.set(0, 3.1, -4.0)
    rear.add(throneBack)
    const halo = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.12, 12, 28), gold)
    halo.position.set(0, 3.4, -3.8)
    rear.add(halo)
    const haloGlow = new THREE.Mesh(new THREE.CircleGeometry(1.5, 24), this.textMaterial('玄 穹 高 上', '#e5c07b', '#4a3319'))
    haloGlow.position.set(0, 3.4, -3.85)
    rear.add(haloGlow)

    const rearLight = new THREE.PointLight('#ffe6a8', 0.9, 14, 2)
    rearLight.position.set(0, 3.8, -2.5)
    rear.add(rearLight)

    // 7. Double-Eave Sweeping Roof (後殿重簷歇山頂)
    const lowerRoof = this.createRoof(18.8, 10.8, 5.4, 7.3)
    lowerRoof.position.set(0, 0, -20.5)
    const upperRoof = this.createRoof(14.6, 7.8, 7.1, 9.2)
    upperRoof.position.set(0, 0, -20.5)
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
    const drumGroup = new THREE.Group()
    drumGroup.position.set(dx, 2.8, dz)

    // Trestle stand (鼓架)
    const standLeg1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.6, 1.4), darkWood)
    standLeg1.position.set(-0.55, -0.6, 0)
    const standLeg2 = standLeg1.clone()
    standLeg2.position.set(0.55, -0.6, 0)
    drumGroup.add(standLeg1, standLeg2)

    // Drum Barrel (朱漆桶狀鼓身，旋轉90度橫臥)
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, 0.95, 20), makeMat('#8b261b', 0.68))
    barrel.rotation.z = Math.PI / 2
    drumGroup.add(barrel)

    // Gold Bronze Drum Rivets (兩側金色鼓釘環)
    for (const side of [-0.46, 0.46]) {
      const rivetRing = new THREE.Mesh(new THREE.TorusGeometry(0.69, 0.035, 8, 20), gold)
      rivetRing.rotation.y = Math.PI / 2
      rivetRing.position.x = side
      drumGroup.add(rivetRing)
    }

    // Drumheads (兩端牛皮鼓面與八卦太極彩繪意象)
    for (const side of [-0.48, 0.48]) {
      const skin = new THREE.Mesh(new THREE.CylinderGeometry(0.67, 0.67, 0.04, 20), makeMat('#e2d5bd', 0.9))
      skin.rotation.z = Math.PI / 2
      skin.position.x = side
      drumGroup.add(skin)
      const taiji = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.045, 12), gold)
      taiji.rotation.z = Math.PI / 2
      taiji.position.x = side
      drumGroup.add(taiji)
    }

    // Drumsticks (鼓架旁雙置鼓槌)
    const stick1 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.75, 8), makeMat('#b9996b'))
    stick1.position.set(0.65, 0.1, 0.35)
    stick1.rotation.z = -0.4
    const stick2 = stick1.clone()
    stick2.position.set(0.65, 0.1, -0.35)
    stick2.rotation.z = 0.4
    drumGroup.add(stick1, stick2)

    this.scene.add(drumGroup)

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
      lamps: '#edba61', woodfish: '#d68c63', bell: '#e8c77d', 'wishing-pool': '#a8d2c6', 'prayer-wall': '#e8c77d', records: '#e8c77d', tiangong: '#f0c070',
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

  setStatue(_source: THREE.Object3D): void {
    // Retained for compatibility with optional external asset loader
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

    // 2. High-Resolution Golden Guanyin Statue Board (觀世音菩薩法相金身尊像)
    // Aspect ratio: 376 / 537 = 0.700, Height: 3.2m, Width: 2.24m
    const aspect = 376 / 537
    const statueH = 3.2
    const statueW = statueH * aspect

    const loader = new THREE.TextureLoader()
    loader.load('./assets/guanyin-golden.png', tex => {
      tex.colorSpace = THREE.SRGBColorSpace
      // Use MeshBasicMaterial to completely eliminate directional light and point light specular shine/glare on the chest
      const statueMat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        alphaTest: 0.05,
        side: THREE.DoubleSide,
      })
      const statueMesh = new THREE.Mesh(new THREE.PlaneGeometry(statueW, statueH), statueMat)
      statueMesh.position.set(0, 0.32 + statueH / 2, 0)
      statueMesh.castShadow = false
      statueMesh.receiveShadow = false
      root.add(statueMesh)
    })

    // 3. Radiant Holy Backlight Halo (圓滿大放神光背光金輪)
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.75, 36), haloMat)
    halo.position.set(0, 2.15, -0.15)
    root.add(halo)

    const haloInner = new THREE.Mesh(new THREE.CircleGeometry(0.82, 36), new THREE.MeshBasicMaterial({ color: '#ffebb3', transparent: true, opacity: 0.3 }))
    haloInner.position.set(0, 2.15, -0.14)
    root.add(haloInner)

    // Warm Divine Aura Light (微弱聖光，照亮四周神龕但不直接在畫像上反光)
    const statueGlow = new THREE.PointLight('#ffe6a3', 0.6, 7, 2)
    statueGlow.position.set(0, 2.2, 0.7)
    root.add(statueGlow)

    return root
  }

  private addSkyDome(): void {
    // Atmospheric gradient dome canvas texture: zenith pale-azure to horizon warm-cream
    const cv = document.createElement('canvas')
    cv.width = 64
    cv.height = 256
    const ctx = cv.getContext('2d')!
    const grad = ctx.createLinearGradient(0, 0, 0, 256)
    grad.addColorStop(0, '#5a8fa8')    // Sky zenith deep clear azure
    grad.addColorStop(0.35, '#86adbe') // Soft daytime blue
    grad.addColorStop(0.72, '#c1d4dc') // Haze layer
    grad.addColorStop(1, '#ebe4d3')    // Warm temple horizon
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 64, 256)
    const tex = new THREE.CanvasTexture(cv)
    tex.colorSpace = THREE.SRGBColorSpace

    const domeGeo = new THREE.SphereGeometry(180, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.52)
    const domeMat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false, fog: false })
    const dome = new THREE.Mesh(domeGeo, domeMat)
    dome.position.set(0, -6, 10)
    this.scene.add(dome)
  }

  private addClouds(): void {
    const cloudMat = new THREE.MeshBasicMaterial({ color: '#fefcf8', transparent: true, opacity: 0.82, depthWrite: false })
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
        const puff = new THREE.Mesh(new THREE.SphereGeometry(pr, 10, 8), cloudMat)
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
  get pickIgnore(): THREE.Object3D[] { return [this.avatarStand, this.guideArrow, this.guideBeacon] }
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
    if (action === 'coin') this.dropCoin()
    if (action === 'lottery') this.spawnSmoke(new THREE.Vector3(-11.8, 1.8, 1.2))
    if (action === 'chess') this.spawnSmoke(new THREE.Vector3(PAVILION.x, 1.2, PAVILION.z))
    if (action === 'tiangong') { this.spawnSmoke(this.courtyard.tiangongSmoke.clone()); this.courtyard.tiangongGlow.intensity = 1.4 }
  }

  update(dt: number, time: number, playerPosition: THREE.Vector3, activePoint: ShrinePointId | null): void {
    const insideHall = playerPosition.z < 0 && playerPosition.z > -13.5 && Math.abs(playerPosition.x) < 9
    this.roof.visible = !insideHall
    const insideRear = playerPosition.z < -16.5 && playerPosition.z > -25.5 && Math.abs(playerPosition.x) < 8.5
    this.rearRoof.visible = !insideRear
    this.incenseGlow.intensity = THREE.MathUtils.damp(this.incenseGlow.intensity, 0.22, 1.4, dt)
    this.courtyard.update(time)

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
    this.woodfish.rotation.x = Math.sin(this.woodfishImpulse * 7) * this.woodfishImpulse
    this.bell.rotation.z = Math.sin(this.bellImpulse * 10) * this.bellImpulse

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
