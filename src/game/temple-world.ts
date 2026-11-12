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

  constructor(private readonly physics: Physics) {
    this.scene.background = new THREE.Color('#b9ad98')
    this.scene.fog = new THREE.Fog('#b9ad98', 70, 150)
    this.scene.add(new THREE.HemisphereLight('#f2e9d6', '#5c5145', 1.15))
    const sun = new THREE.DirectionalLight('#ffe5b1', 1.35)
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

    this.courtyard = new FrontCourtyard({
      scene: this.scene, physics: this.physics, mat: makeMat,
      roof: (w, d, e, pk) => this.createRoof(w, d, e, pk),
      text: (t, fg, bg) => this.textMaterial(t, fg, bg),
    })
    this.addMainHall()
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
    const wood = makeMat(C.wood)
    const gold = makeMat(C.gold, 0.48, 0.2)

    const back = new THREE.Mesh(new THREE.BoxGeometry(17.2, 4.3, 0.5), makeMat('#60473a'))
    back.position.set(0, 2.2, -6.1)
    back.castShadow = true
    back.receiveShadow = true
    hall.add(back)
    this.physics.addStaticBox(new THREE.Vector3(0, 2.2, -13.1), new THREE.Vector3(17.2, 4.3, 0.5))

    for (const z of [-5.8, -0.2, 5.2]) {
      for (const x of [-8.1, -5.4, 5.4, 8.1]) {
        const column = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 5.05, 12), red)
        column.position.set(x, 2.52, z)
        column.castShadow = true
        hall.add(column)
        this.physics.addStaticCylinder(new THREE.Vector3(x, 2.5, z - 7), 0.36, 5.0)
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.49, 0.49, 0.15, 12), gold)
        ring.position.set(x, 4.65, z)
        hall.add(ring)
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(18, 0.42, 0.42), wood)
      beam.position.set(0, 5.12, z)
      hall.add(beam)
    }

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

    const centerPlinth = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.6, 2.5), makeMat('#6c5543'))
    centerPlinth.position.set(0, 0.8, -5.7)
    hall.add(centerPlinth)
    const topPlinth = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.22, 2.7), gold)
    topPlinth.position.set(0, 1.71, -5.7)
    hall.add(topPlinth)

    const sign = new THREE.Mesh(new THREE.BoxGeometry(5.8, 1.4, 0.25), makeMat('#35251c'))
    sign.position.set(0, 5.05, -0.08)
    hall.add(sign)
    const signText = new THREE.Mesh(new THREE.PlaneGeometry(5.45, 1.08), this.textMaterial('觀 音 佛 祖', '#ecd08b', '#35251c'))
    signText.position.set(0, 5.05, 0.065)
    hall.add(signText)

    const roof = this.createRoof(20, 15.5, 5.1, 8.0)
    roof.position.set(0, 4.9, -7)
    this.roof.add(roof)
    this.roof.position.y = 0
    this.scene.add(this.roof)
    this.addRoofFinial(hall, 0, 0)

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

  private addSideArchitecture(): void {
    const sideMat = makeMat('#6c5140')
    for (const x of [-13.4, 13.4]) {
      const base = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.22, 16), makeMat('#9d8a70'))
      base.position.set(x, 0.12, -2.7)
      base.receiveShadow = true
      this.scene.add(base)
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
      const roof = this.createRoof(5.3, 17, 3.15, 4.9)
      roof.position.set(x, 2.7, -3.7)
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
    bellRoof.position.set(15.2, 3.85, -8)
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

  setStatue(source: THREE.Object3D): void {
    const root = new THREE.Group()
    const model = source.clone(true)
    const box = new THREE.Box3().setFromObject(model)
    const size = box.getSize(new THREE.Vector3())
    const scale = size.y > 0.01 ? 3.1 / size.y : 1.4
    model.scale.setScalar(scale)
    const scaledBox = new THREE.Box3().setFromObject(model)
    model.position.y -= scaledBox.min.y
    root.add(model)
    root.position.set(0, 1.82, -12.6)
    root.rotation.y = -Math.PI / 2
    root.traverse(obj => { if (obj instanceof THREE.Mesh) { obj.castShadow = true; obj.receiveShadow = true } })
    this.scene.add(root)
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
    this.incenseGlow.intensity = THREE.MathUtils.damp(this.incenseGlow.intensity, 0.22, 1.4, dt)
    this.courtyard.update(time)
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
