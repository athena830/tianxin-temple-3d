import * as THREE from 'three'
import type { Quality } from '../engine/save'
import type { TemplePbrLibrary } from './temple-pbr-materials'

/**
 * 玉皇宮主殿 3D 半寫實電影級屋頂與屋簷樣板（Stylized Realism 3D Temple Roof & Eave System）
 *
 * 專為 Phase 2 設計的標竿建築樣板：
 * 1. 舉折反宇歇山大屋頂曲面（Curved Roof Slope with Realistic Eave Sweep & Flared Cornices）
 * 2. 實體 3D 琉璃筒瓦隴（Instanced Fluted Tiles）、圓形瓦當（Wadang）與如意滴水牙子（Drip Tiles）
 * 3. 台灣傳統宮廟官廟象徵：立體正脊雙燕尾（Sculpted Swallowtail Ridge）與鏤空西施脊
 * 4. 正脊中央「雙龍拜塔」立體剪黏雕塑群（Twin Gilded Dragons Facing Multi-tiered Pagoda & Flaming Pearl）
 * 5. 屋簷下方大木作排樓斗拱系統（Multi-tiered Dougong Brackets: 坐斗、橫栱、象鼻昂、散斗、耍頭）
 * 6. 鰲魚雀替雕花托木、懸空垂花蓮花吊筒與多層次彩繪壽樑
 * 7. Low / Medium / High 畫質動態分級與全套幾何／材質快取與安全釋放
 */

export interface Roof3DOptions {
  width: number
  depth: number
  eaveY: number
  peakY: number
  pbr: TemplePbrLibrary
}

export class TempleRoof3D {
  public readonly root = new THREE.Group()

  // Materials managed by PBR library or local caches
  private tilePbrMat: THREE.MeshStandardMaterial
  private fasciaPbrMat: THREE.MeshStandardMaterial
  private timberPbrMat: THREE.MeshStandardMaterial
  private vermilionPbrMat: THREE.MeshStandardMaterial
  private goldPbrMat: THREE.MeshStandardMaterial
  private ridgeGoldPbrMat: THREE.MeshStandardMaterial
  private cutoutMat: THREE.MeshStandardMaterial

  // Instanced Meshes for massive geometric tile detail at near-zero draw calls
  private tileTubeInstanced?: THREE.InstancedMesh
  private tileWadangInstanced?: THREE.InstancedMesh
  private tileDripInstanced?: THREE.InstancedMesh
  private dougongBlockInstanced?: THREE.InstancedMesh
  private dougongArmInstanced?: THREE.InstancedMesh
  private dougongBeakInstanced?: THREE.InstancedMesh

  // Groups and objects for quality toggling
  private highDetailGroup = new THREE.Group()
  private mediumDetailGroup = new THREE.Group()
  private lowDetailGroup = new THREE.Group()
  private twinDragonsGroup = new THREE.Group()
  private pagodaGroup = new THREE.Group()

  // Track allocated geometries to safely dispose
  private allocatedGeometries: THREE.BufferGeometry[] = []
  private allocatedMaterials: THREE.Material[] = []

  public currentQuality: Quality = 'high'

  constructor(options: Roof3DOptions) {
    const { width, depth, eaveY, peakY, pbr } = options

    // 1. Acquire PBR materials with proper UV repeat
    this.tilePbrMat = pbr.get('glazedRoofTile', Math.max(2, Math.round(depth / 1.6)), Math.max(2, Math.round(width / 3.0)))
    this.fasciaPbrMat = pbr.get('darkTimber', Math.max(2, Math.round(depth / 2)), 1)
    this.timberPbrMat = pbr.get('darkTimber', 4, 1)
    this.vermilionPbrMat = pbr.get('vermilionWood', 4, 1)
    this.goldPbrMat = pbr.get('gildedGold', 2, 1)
    this.ridgeGoldPbrMat = pbr.get('gildedGold', 1, 1)

    // Semi-gloss lacquer cutout material for Xishi cutout ridge
    this.cutoutMat = new THREE.MeshStandardMaterial({
      color: '#421a14',
      roughness: 0.38,
      metalness: 0.22,
    })
    this.allocatedMaterials.push(this.cutoutMat)

    // Build the architectural model
    this.buildSweptRoofSurfaces(width, depth, eaveY, peakY)
    this.buildInstancedRoofTiles(width, depth, eaveY, peakY)
    this.buildSwallowtailMainRidge(width, peakY)
    this.buildTwinDragonsPagodaCrest(peakY)
    this.buildHipRidgesAndCornerBeasts(width, depth, eaveY, peakY)
    this.buildFrontEaveDougongBrackets(width, depth, eaveY)
    this.buildCarvedTimberworkAndSuspendedLotus(width, depth, eaveY)

    this.root.add(this.highDetailGroup)
    this.root.add(this.mediumDetailGroup)
    this.root.add(this.lowDetailGroup)

    this.applyQuality('high')
  }

  /**
   * 1. 舉折反宇歇山曲面大屋面（Curved Roof Slope with Realistic Eave Sweep）
   * 建立前坡、後坡與兩側山面歇山曲面，兩端微揚、簷口反宇向陽
   */
  private buildSweptRoofSurfaces(width: number, depth: number, eaveY: number, peakY: number): void {
    const halfW = width / 2
    const halfD = depth / 2

    // 正坡與後坡曲面板（以微弧階梯式幾何組合，確保陰影穿透與精確碰撞層次）
    // 前坡 z: 0 -> halfD, 後坡 z: 0 -> -halfD
    for (const slopeDir of [1, -1]) {
      const isFront = slopeDir === 1
      const slopeSegments = 16

      // 建立前/後主坡複合曲面幾何體
      const geom = new THREE.BufferGeometry()
      const vertices: number[] = []
      const normals: number[] = []
      const uvs: number[] = []
      const indices: number[] = []

      const xCols = 24
      const xStep = width / xCols

      for (let j = 0; j <= slopeSegments; j++) {
        const t = j / slopeSegments // 0 at ridge (peak), 1 at eave
        // 宮廟舉折公式：中間微凹、簷端微揚 (Gentle sag curve + upturned eave flare)
        const yNorm = 1 - t
        const curveSag = Math.sin(t * Math.PI) * 0.28
        const flare = Math.pow(t, 3.5) * 0.22
        const y = eaveY + (peakY - eaveY) * yNorm - curveSag + flare

        const z = slopeDir * (t * halfD)

        for (let i = 0; i <= xCols; i++) {
          const u = i / xCols
          const x = -halfW + i * xStep
          // 四角起翹 (Corner flare upward at outer ends)
          const cornerDist = Math.abs(x) / halfW
          const cornerLift = Math.pow(cornerDist, 3) * t * 0.65

          vertices.push(x, y + cornerLift, z)
          normals.push(0, 1, 0) // Will be computed by computeVertexNormals
          uvs.push(u * (width / 2.5), t * (halfD / 2.0))
        }
      }

      const stride = xCols + 1
      for (let j = 0; j < slopeSegments; j++) {
        for (let i = 0; i < xCols; i++) {
          const a = j * stride + i
          const b = j * stride + i + 1
          const c = (j + 1) * stride + i
          const d = (j + 1) * stride + i + 1

          if (isFront) {
            indices.push(a, c, b)
            indices.push(b, c, d)
          } else {
            indices.push(a, b, c)
            indices.push(b, d, c)
          }
        }
      }

      geom.setIndex(indices)
      geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
      geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
      geom.computeVertexNormals()
      this.allocatedGeometries.push(geom)

      const slopeMesh = new THREE.Mesh(geom, this.tilePbrMat)
      slopeMesh.castShadow = true
      slopeMesh.receiveShadow = true
      this.root.add(slopeMesh)

      // 下層厚實深木椽木層（Fascia & Underside Rafter Board）
      const rafterThickness = 0.26
      const rafterGeom = geom.clone()
      rafterGeom.translate(0, -rafterThickness, 0)
      this.allocatedGeometries.push(rafterGeom)
      const rafterMesh = new THREE.Mesh(rafterGeom, this.fasciaPbrMat)
      rafterMesh.receiveShadow = true
      this.root.add(rafterMesh)
    }

    // 左右兩側山牆博風板與山面封板（Gable Fascia & Bargeboards）
    for (const side of [-1, 1]) {
      const bargeX = side * (halfW - 0.05)
      const bargeGeom = new THREE.BoxGeometry(0.38, 0.42, depth * 0.96)
      this.allocatedGeometries.push(bargeGeom)
      const barge = new THREE.Mesh(bargeGeom, this.fasciaPbrMat)
      barge.position.set(bargeX, (peakY + eaveY) / 2 - 0.12, 0)
      barge.castShadow = true
      this.root.add(barge)

      // 兩側山牆懸魚惹草金屬飾件（Hanging Fish & Cloud Ornament）
      const fishGeom = new THREE.ConeGeometry(0.32, 0.95, 6)
      this.allocatedGeometries.push(fishGeom)
      const fish = new THREE.Mesh(fishGeom, this.goldPbrMat)
      fish.position.set(side * halfW, peakY - 0.85, 0)
      fish.rotation.z = side > 0 ? -Math.PI / 2 : Math.PI / 2
      this.mediumDetailGroup.add(fish)
    }
  }

  /**
   * 2. 實體 3D 琉璃筒瓦隴（Instanced Fluted Tiles）、圓形瓦當（Wadang）與如意滴水牙子
   * 使用 THREE.InstancedMesh 達到電影級幾何細節，且 Draw Calls 僅增 3 個！
   */
  private buildInstancedRoofTiles(width: number, depth: number, eaveY: number, peakY: number): void {
    const halfW = width / 2
    const halfD = depth / 2

    // 沿正面面寬排布立體瓦隴
    const ridgeCount = 34 // 34 道瓦壟
    const stepX = (width - 1.2) / (ridgeCount - 1)
    const coursesPerRidge = 14 // 每道瓦壟由 14 節立體筒瓦疊合

    const totalTubes = ridgeCount * coursesPerRidge
    const totalEnds = ridgeCount

    // 幾何體單元
    const tubeGeom = new THREE.CylinderGeometry(0.095, 0.11, 0.62, 8, 1, false, 0, Math.PI)
    tubeGeom.rotateZ(Math.PI / 2) // Orient along ridge
    this.allocatedGeometries.push(tubeGeom)

    const wadangGeom = new THREE.CylinderGeometry(0.125, 0.125, 0.06, 12)
    wadangGeom.rotateX(Math.PI / 2)
    this.allocatedGeometries.push(wadangGeom)

    const dripGeom = new THREE.ConeGeometry(0.11, 0.22, 5)
    dripGeom.rotateZ(Math.PI) // Point downwards
    this.allocatedGeometries.push(dripGeom)

    this.tileTubeInstanced = new THREE.InstancedMesh(tubeGeom, this.tilePbrMat, totalTubes)
    this.tileTubeInstanced.castShadow = true
    this.tileTubeInstanced.receiveShadow = true

    this.tileWadangInstanced = new THREE.InstancedMesh(wadangGeom, this.ridgeGoldPbrMat, totalEnds)
    this.tileWadangInstanced.castShadow = true
    this.tileWadangInstanced.receiveShadow = true

    this.tileDripInstanced = new THREE.InstancedMesh(dripGeom, this.tilePbrMat, totalEnds - 1)
    this.tileDripInstanced.castShadow = true
    this.tileDripInstanced.receiveShadow = true

    const dummy = new THREE.Object3D()
    let tubeIdx = 0

    // 正面坡屋頂鋪設
    for (let r = 0; r < ridgeCount; r++) {
      const rx = -halfW + 0.6 + r * stepX
      const cornerDist = Math.abs(rx) / halfW

      for (let c = 0; c < coursesPerRidge; c++) {
        const t = (c + 0.5) / coursesPerRidge // 0 near ridge, 1 near eave
        const rz = t * (halfD - 0.15)
        const yNorm = 1 - t
        const curveSag = Math.sin(t * Math.PI) * 0.28
        const flare = Math.pow(t, 3.5) * 0.22
        const cornerLift = Math.pow(cornerDist, 3) * t * 0.65
        const ry = eaveY + (peakY - eaveY) * yNorm - curveSag + flare + cornerLift + 0.08

        // Tangent angle along slope
        const slopeAngle = Math.atan2(peakY - eaveY + (curveSag - flare), halfD)

        dummy.position.set(rx, ry, rz)
        dummy.rotation.set(-slopeAngle, 0, 0)
        dummy.scale.set(1, 1, 1)
        dummy.updateMatrix()
        this.tileTubeInstanced.setMatrixAt(tubeIdx++, dummy.matrix)
      }

      // 簷口瓦當（Wadang round end tile at eave mouth）
      const eaveCornerLift = Math.pow(cornerDist, 3) * 0.65
      const eaveZ = halfD + 0.08
      const eaveYPos = eaveY + 0.16 + eaveCornerLift

      dummy.position.set(rx, eaveYPos, eaveZ)
      dummy.rotation.set(-0.25, 0, 0)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      this.tileWadangInstanced.setMatrixAt(r, dummy.matrix)

      // 瓦溝下緣滴水牙子（Drip tile between valleys）
      if (r < ridgeCount - 1) {
        const dripX = rx + stepX / 2
        const midCornerLift = Math.pow(Math.abs(dripX) / halfW, 3) * 0.65
        dummy.position.set(dripX, eaveYPos - 0.14 + midCornerLift, eaveZ - 0.02)
        dummy.rotation.set(-0.15, 0, 0)
        dummy.scale.set(1, 1, 1)
        dummy.updateMatrix()
        this.tileDripInstanced.setMatrixAt(r, dummy.matrix)
      }
    }

    this.tileTubeInstanced.instanceMatrix.needsUpdate = true
    this.tileWadangInstanced.instanceMatrix.needsUpdate = true
    this.tileDripInstanced.instanceMatrix.needsUpdate = true

    this.highDetailGroup.add(this.tileTubeInstanced)
    this.highDetailGroup.add(this.tileWadangInstanced)
    this.highDetailGroup.add(this.tileDripInstanced)
  }

  /**
   * 3. 台灣傳統宮廟官廟象徵：立體正脊雙燕尾（Sculpted Swallowtail Ridge）與鏤空西施脊
   * 正脊沿 X 軸橫貫殿宇頂部（面寬方向），兩端（東西兩側）為優美揚起之雙燕尾
   */
  private buildSwallowtailMainRidge(width: number, peakY: number): void {
    const ridgeLen = width + 0.8
    const ridgeY = peakY + 0.18

    // (1) 正脊基座大樑（Main Ridge Beam - 橫跨面寬 X 軸）
    const mainBeamGeom = new THREE.CylinderGeometry(0.24, 0.28, ridgeLen, 16)
    mainBeamGeom.rotateZ(Math.PI / 2)
    this.allocatedGeometries.push(mainBeamGeom)
    const mainBeam = new THREE.Mesh(mainBeamGeom, this.vermilionPbrMat)
    mainBeam.position.set(0, ridgeY, 0)
    mainBeam.castShadow = true
    this.root.add(mainBeam)

    // (2) 西施脊（鏤空剪黏透光雕花磚層，Xishi Ridge Cutout Tier）
    const xishiH = 0.46
    const xishiGeom = new THREE.BoxGeometry(ridgeLen * 0.88, xishiH, 0.22)
    this.allocatedGeometries.push(xishiGeom)
    const xishiMesh = new THREE.Mesh(xishiGeom, this.cutoutMat)
    xishiMesh.position.set(0, ridgeY + 0.32, 0)
    xishiMesh.castShadow = true
    this.root.add(xishiMesh)

    // 西施脊金屬回紋飾條與規帶鑲邊
    for (const side of [-1, 1]) {
      const moldingGeom = new THREE.BoxGeometry(ridgeLen * 0.90, 0.08, 0.04)
      this.allocatedGeometries.push(moldingGeom)
      const molding = new THREE.Mesh(moldingGeom, this.goldPbrMat)
      molding.position.set(0, ridgeY + 0.32, side * 0.12)
      this.mediumDetailGroup.add(molding)
    }

    // (3) 正脊頂層冠帶琉璃瓦壟（Top Glazed Ridge Crest）
    const crestGeom = new THREE.CylinderGeometry(0.16, 0.20, ridgeLen * 0.92, 12)
    crestGeom.rotateZ(Math.PI / 2)
    this.allocatedGeometries.push(crestGeom)
    const crestMesh = new THREE.Mesh(crestGeom, this.ridgeGoldPbrMat)
    crestMesh.position.set(0, ridgeY + 0.58, 0)
    crestMesh.castShadow = true
    this.root.add(crestMesh)

    // (4) 正脊東西兩側立體雙燕尾（Swallowtail Sweeping Fork Ends at Outer Left/Right）
    // 傳統閩南式正脊燕尾：左右兩端向上挑起約 1.25m，向外分叉展開
    for (const tx of [-ridgeLen / 2 + 0.1, ridgeLen / 2 - 0.1]) {
      const isEast = tx > 0
      const tailGroup = new THREE.Group()
      tailGroup.position.set(tx, ridgeY + 0.52, 0)

      // 弧形燕尾主臂（Extruded sweeping swallowtail blade curving upward and outward along X）
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(isEast ? 0.45 : -0.45, 0.65, 0),
        new THREE.Vector3(isEast ? 1.15 : -1.15, 1.35, 0)
      )
      const tailTubeGeom = new THREE.TubeGeometry(curve, 16, 0.10, 8, false)
      this.allocatedGeometries.push(tailTubeGeom)
      const tailMesh = new THREE.Mesh(tailTubeGeom, this.ridgeGoldPbrMat)
      tailMesh.castShadow = true
      tailGroup.add(tailMesh)

      // 燕尾尖端開叉雙刃（Forked Tail Tips flaring outward and slightly fore/aft）
      for (const side of [-1, 1]) {
        const tipGeom = new THREE.ConeGeometry(0.065, 0.52, 6)
        this.allocatedGeometries.push(tipGeom)
        const tip = new THREE.Mesh(tipGeom, this.goldPbrMat)
        tip.position.set(isEast ? 1.22 : -1.22, 1.45, side * 0.15)
        tip.rotation.set(side * 0.35, 0, isEast ? -0.45 : 0.45)
        tailGroup.add(tip)
      }

      this.root.add(tailGroup)
    }
  }

  /**
   * 4. 正脊中央「雙龍拜塔」立體剪黏雕塑群（Twin Gilded Dragons Facing Multi-tiered Pagoda）
   * 正脊中央置七寶琉璃金塔與火珠，東西兩側各有立體祥龍昂首朝中盤旋
   */
  private buildTwinDragonsPagodaCrest(peakY: number): void {
    const crestCenterY = peakY + 0.78

    // (1) 中央七寶琉璃八角金塔（Pagoda at Center x = 0, z = 0）
    // 八角基座
    const baseGeom = new THREE.CylinderGeometry(0.42, 0.54, 0.28, 8)
    this.allocatedGeometries.push(baseGeom)
    const baseMesh = new THREE.Mesh(baseGeom, this.goldPbrMat)
    baseMesh.position.set(0, crestCenterY + 0.14, 0)
    this.pagodaGroup.add(baseMesh)

    // 三層八角出簷浮屠塔身
    for (let tier = 0; tier < 3; tier++) {
      const tierY = crestCenterY + 0.32 + tier * 0.38
      const scale = 1.0 - tier * 0.18

      // 塔壁
      const bodyGeom = new THREE.CylinderGeometry(0.28 * scale, 0.34 * scale, 0.28, 8)
      this.allocatedGeometries.push(bodyGeom)
      const body = new THREE.Mesh(bodyGeom, this.cutoutMat)
      body.position.set(0, tierY, 0)

      // 塔簷
      const eaveGeom = new THREE.CylinderGeometry(0.12 * scale, 0.46 * scale, 0.12, 8)
      this.allocatedGeometries.push(eaveGeom)
      const eave = new THREE.Mesh(eaveGeom, this.ridgeGoldPbrMat)
      eave.position.set(0, tierY + 0.18, 0)
      eave.castShadow = true

      this.pagodaGroup.add(body, eave)
    }

    // 塔頂摩尼寶珠與四方飛揚烈焰火珠（Flaming Pearl）
    const pearlY = crestCenterY + 1.62
    const pearlGeom = new THREE.SphereGeometry(0.22, 16, 12)
    this.allocatedGeometries.push(pearlGeom)
    const pearlMesh = new THREE.Mesh(pearlGeom, this.goldPbrMat)
    pearlMesh.position.set(0, pearlY, 0)
    pearlMesh.castShadow = true
    this.pagodaGroup.add(pearlMesh)

    // 四方鏤空火焰雲紋
    for (let f = 0; f < 4; f++) {
      const flameGeom = new THREE.ConeGeometry(0.08, 0.48, 5)
      this.allocatedGeometries.push(flameGeom)
      const flame = new THREE.Mesh(flameGeom, this.ridgeGoldPbrMat)
      flame.position.set(Math.cos(f * Math.PI / 2) * 0.18, pearlY + 0.12, Math.sin(f * Math.PI / 2) * 0.18)
      flame.rotation.z = Math.cos(f * Math.PI / 2) * -0.4
      flame.rotation.x = Math.sin(f * Math.PI / 2) * 0.4
      this.pagodaGroup.add(flame)
    }

    // (2) 東西兩條朝覲立體剪黏金龍（Twin Gilded Dragons Facing Center Pagoda Along X）
    // 左龍 (x < 0) 龍首向右朝中；右龍 (x > 0) 龍首向左朝中
    for (const dir of [-1, 1]) {
      const isEast = dir > 0
      const dragon = new THREE.Group()
      dragon.position.set(dir * 2.2, crestCenterY + 0.22, 0)

      // 龍首（張口、金角、龍鬚，面朝中央 x = 0）
      const headGroup = new THREE.Group()
      headGroup.position.set(dir * -0.65, 0.52, 0)

      const skullGeom = new THREE.BoxGeometry(0.38, 0.22, 0.24)
      this.allocatedGeometries.push(skullGeom)
      const skull = new THREE.Mesh(skullGeom, this.goldPbrMat)
      skull.castShadow = true

      const jawGeom = new THREE.BoxGeometry(0.32, 0.12, 0.18)
      this.allocatedGeometries.push(jawGeom)
      const jaw = new THREE.Mesh(jawGeom, this.goldPbrMat)
      jaw.position.set(dir * -0.06, -0.12, 0)

      // 金角
      for (const side of [-1, 1]) {
        const hornGeom = new THREE.ConeGeometry(0.045, 0.42, 6)
        this.allocatedGeometries.push(hornGeom)
        const horn = new THREE.Mesh(hornGeom, this.ridgeGoldPbrMat)
        horn.position.set(dir * 0.08, 0.24, side * 0.11)
        horn.rotation.z = isEast ? 0.45 : -0.45
        horn.rotation.x = side * 0.35
        headGroup.add(horn)
      }

      headGroup.add(skull, jaw)
      dragon.add(headGroup)

      // 龍身（立體多段蜿蜒起伏脊梁與背鰭，向外側延伸）
      const bodySegments = 6
      for (let s = 0; s < bodySegments; s++) {
        const u = s / (bodySegments - 1)
        const wave = Math.sin(u * Math.PI * 2) * 0.26
        const segX = dir * (s * 0.55)
        const segY = 0.28 + wave

        const segGeom = new THREE.CylinderGeometry(0.12, 0.14, 0.48, 8)
        segGeom.rotateZ(Math.PI / 2)
        this.allocatedGeometries.push(segGeom)
        const seg = new THREE.Mesh(segGeom, this.vermilionPbrMat)
        seg.position.set(segX, segY, 0)
        seg.castShadow = true

        // 背鰭（Dorsal Spines）
        const finGeom = new THREE.ConeGeometry(0.065, 0.24, 4)
        this.allocatedGeometries.push(finGeom)
        const fin = new THREE.Mesh(finGeom, this.goldPbrMat)
        fin.position.set(segX, segY + 0.18, 0)
        fin.castShadow = true

        dragon.add(seg, fin)
      }

      // 祥雲基座（Cloud Crest Base）
      for (let c = 0; c < 3; c++) {
        const cloudGeom = new THREE.SphereGeometry(0.16, 8, 8)
        this.allocatedGeometries.push(cloudGeom)
        const cloud = new THREE.Mesh(cloudGeom, this.cutoutMat)
        cloud.position.set(dir * (0.4 + c * 0.9), 0.08, 0)
        cloud.scale.set(1.4, 0.7, 1.2)
        dragon.add(cloud)
      }

      this.twinDragonsGroup.add(dragon)
    }

    this.root.add(this.pagodaGroup)
    this.root.add(this.twinDragonsGroup)
  }

  /**
   * 5. 四方斜垂脊（Hip Ridges）與牌頭仙人走獸（Ridge Beast Statuettes）
   */
  private buildHipRidgesAndCornerBeasts(width: number, depth: number, eaveY: number, peakY: number): void {
    const halfW = width / 2
    const halfD = depth / 2

    // 歇山頂四角斜垂脊：由正脊兩端下方向四角斜向垂下
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const hipGroup = new THREE.Group()

        const startPt = new THREE.Vector3(sx * (halfW * 0.72), peakY + 0.32, 0)
        const endPt = new THREE.Vector3(sx * (halfW + 0.15), eaveY + 0.36, sz * (halfD + 0.18))
        const midPt = new THREE.Vector3(
          (startPt.x + endPt.x) / 2,
          (startPt.y + endPt.y) / 2 - 0.12,
          (startPt.z + endPt.z) / 2
        )

        const curve = new THREE.QuadraticBezierCurve3(startPt, midPt, endPt)
        const ridgeGeom = new THREE.TubeGeometry(curve, 12, 0.11, 8, false)
        this.allocatedGeometries.push(ridgeGeom)
        const ridgeMesh = new THREE.Mesh(ridgeGeom, this.ridgeGoldPbrMat)
        ridgeMesh.castShadow = true
        hipGroup.add(ridgeMesh)

        // 垂脊上的仙人走獸立體雕飾（Ridge Beast Statuettes）
        for (let b = 1; b <= 4; b++) {
          const t = 0.35 + b * 0.14
          const pt = curve.getPoint(t)

          const beastGeom = new THREE.ConeGeometry(0.09, 0.28, 6)
          this.allocatedGeometries.push(beastGeom)
          const beast = new THREE.Mesh(beastGeom, this.goldPbrMat)
          beast.position.copy(pt)
          beast.position.y += 0.14
          beast.castShadow = true
          hipGroup.add(beast)
        }

        // 簷角牌頭捲草與翹角（Corner Upturned Eave Tip）
        const tipGeom = new THREE.ConeGeometry(0.18, 0.75, 8)
        this.allocatedGeometries.push(tipGeom)
        const tip = new THREE.Mesh(tipGeom, this.ridgeGoldPbrMat)
        tip.position.copy(endPt)
        tip.position.y += 0.22
        tip.rotation.z = sx > 0 ? -0.72 : 0.72
        tip.rotation.x = sz > 0 ? 0.32 : -0.32
        tip.castShadow = true
        hipGroup.add(tip)

        this.root.add(hipGroup)
      }
    }
  }

  /**
   * 6. 屋簷下方大木作排樓斗拱系統（Dougong Brackets: 坐斗、橫栱、象鼻昂、散斗、耍頭）
   * 沿主殿正面面寬均勻分佈 7 組精雕細琢的五踩排樓斗拱，使用 InstancedMesh 最佳化！
   */
  private buildFrontEaveDougongBrackets(width: number, depth: number, eaveY: number): void {
    const halfD = depth / 2
    const bracketY = eaveY - 0.42
    const bracketZ = halfD - 0.48

    const clusterCount = 7
    const spanW = width * 0.76
    const stepX = spanW / (clusterCount - 1)

    // 幾何體單元
    const blockGeom = new THREE.BoxGeometry(0.38, 0.18, 0.38)
    this.allocatedGeometries.push(blockGeom)

    const armGeom = new THREE.BoxGeometry(0.85, 0.14, 0.24)
    this.allocatedGeometries.push(armGeom)

    const beakGeom = new THREE.BoxGeometry(0.22, 0.16, 0.72)
    this.allocatedGeometries.push(beakGeom)

    // 每個 cluster 有 3 個斗、2 層橫栱、1 個象鼻昂
    const totalBlocks = clusterCount * 3
    const totalArms = clusterCount * 2
    const totalBeaks = clusterCount

    this.dougongBlockInstanced = new THREE.InstancedMesh(blockGeom, this.goldPbrMat, totalBlocks)
    this.dougongBlockInstanced.castShadow = true
    this.dougongBlockInstanced.receiveShadow = true

    this.dougongArmInstanced = new THREE.InstancedMesh(armGeom, this.vermilionPbrMat, totalArms)
    this.dougongArmInstanced.castShadow = true
    this.dougongArmInstanced.receiveShadow = true

    this.dougongBeakInstanced = new THREE.InstancedMesh(beakGeom, this.ridgeGoldPbrMat, totalBeaks)
    this.dougongBeakInstanced.castShadow = true
    this.dougongBeakInstanced.receiveShadow = true

    const dummy = new THREE.Object3D()
    let bIdx = 0
    let aIdx = 0
    let kIdx = 0

    for (let i = 0; i < clusterCount; i++) {
      const cx = -spanW / 2 + i * stepX

      // Tier 1: 坐斗（大斗 / Base Bucket Block）
      dummy.position.set(cx, bracketY, bracketZ)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      this.dougongBlockInstanced.setMatrixAt(bIdx++, dummy.matrix)

      // Tier 1: 第一層橫栱（Primary Bow Bracket Arm）
      dummy.position.set(cx, bracketY + 0.14, bracketZ)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      this.dougongArmInstanced.setMatrixAt(aIdx++, dummy.matrix)

      // Tier 2: 象鼻昂（Cantilever Beak poking outwards）
      dummy.position.set(cx, bracketY + 0.24, bracketZ + 0.22)
      dummy.rotation.set(0.24, 0, 0) // Tilting downward outward
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      this.dougongBeakInstanced.setMatrixAt(kIdx++, dummy.matrix)

      // Tier 2: 左右散斗（Small Buckets on outer ends of arm）
      for (const side of [-1, 1]) {
        dummy.position.set(cx + side * 0.34, bracketY + 0.26, bracketZ)
        dummy.rotation.set(0, 0, 0)
        dummy.scale.set(0.65, 0.8, 0.65)
        dummy.updateMatrix()
        this.dougongBlockInstanced.setMatrixAt(bIdx++, dummy.matrix)
      }

      // Tier 3: 第二層橫栱（Secondary Upper Bow Bracket Arm）
      dummy.position.set(cx, bracketY + 0.36, bracketZ + 0.12)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(1.18, 1, 1)
      dummy.updateMatrix()
      this.dougongArmInstanced.setMatrixAt(aIdx++, dummy.matrix)
    }

    this.dougongBlockInstanced.instanceMatrix.needsUpdate = true
    this.dougongArmInstanced.instanceMatrix.needsUpdate = true
    this.dougongBeakInstanced.instanceMatrix.needsUpdate = true

    this.mediumDetailGroup.add(this.dougongBlockInstanced)
    this.mediumDetailGroup.add(this.dougongArmInstanced)
    this.mediumDetailGroup.add(this.dougongBeakInstanced)
  }

  /**
   * 7. 鰲魚雀替雕花托木、懸空垂花蓮花吊筒與多層次彩繪壽樑
   */
  private buildCarvedTimberworkAndSuspendedLotus(width: number, depth: number, eaveY: number): void {
    const halfD = depth / 2
    const beamY = eaveY - 0.52
    const beamZ = halfD - 0.48

    // (1) 正面主壽樑（大額枋 / Main Architrave Beam）
    const architraveGeom = new THREE.BoxGeometry(width * 0.88, 0.52, 0.48)
    this.allocatedGeometries.push(architraveGeom)
    const architrave = new THREE.Mesh(architraveGeom, this.timberPbrMat)
    architrave.position.set(0, beamY, beamZ)
    architrave.castShadow = true
    architrave.receiveShadow = true
    this.root.add(architrave)

    // 壽樑燙金祥雲飾帶（Gold Leaf Cloud Inlay Band）
    const inlayGeom = new THREE.BoxGeometry(width * 0.86, 0.12, 0.51)
    this.allocatedGeometries.push(inlayGeom)
    const inlay = new THREE.Mesh(inlayGeom, this.goldPbrMat)
    inlay.position.set(0, beamY, beamZ)
    this.mediumDetailGroup.add(inlay)

    // (2) 鰲魚雀替（Dragon-Carp Corbels / 插角托木）
    // 位於梁柱交角處，展現繁複大木作工藝
    for (const cx of [-5.4, 5.4]) {
      for (const dir of [-1, 1]) {
        const corbelGroup = new THREE.Group()
        corbelGroup.position.set(cx + dir * 0.55, beamY - 0.32, beamZ)

        // 雕花魚身托木
        const corbelGeom = new THREE.BoxGeometry(0.72, 0.38, 0.22)
        this.allocatedGeometries.push(corbelGeom)
        const corbelMesh = new THREE.Mesh(corbelGeom, this.vermilionPbrMat)
        corbelMesh.castShadow = true

        // 鎏金卷雲魚尾
        const tailGeom = new THREE.ConeGeometry(0.14, 0.42, 6)
        this.allocatedGeometries.push(tailGeom)
        const tailMesh = new THREE.Mesh(tailGeom, this.goldPbrMat)
        tailMesh.position.set(dir * 0.32, -0.08, 0)
        tailMesh.rotation.z = dir > 0 ? -1.15 : 1.15

        corbelGroup.add(corbelMesh, tailMesh)
        this.highDetailGroup.add(corbelGroup)
      }
    }

    // (3) 垂花吊筒（Suspended Lotus Cylinders / 雕花花籃吊筒）
    // 懸垂在斗拱出挑前端，垂掛優雅蓮花苞
    for (const lx of [-6.2, -2.8, 2.8, 6.2]) {
      const dropGroup = new THREE.Group()
      dropGroup.position.set(lx, beamY - 0.22, beamZ + 0.32)

      // 吊筒身
      const dropBodyGeom = new THREE.CylinderGeometry(0.12, 0.14, 0.45, 8)
      this.allocatedGeometries.push(dropBodyGeom)
      const dropBody = new THREE.Mesh(dropBodyGeom, this.vermilionPbrMat)
      dropBody.castShadow = true

      // 蓮花苞瓣頭
      const lotusHeadGeom = new THREE.SphereGeometry(0.16, 10, 8)
      this.allocatedGeometries.push(lotusHeadGeom)
      const lotusHead = new THREE.Mesh(lotusHeadGeom, this.ridgeGoldPbrMat)
      lotusHead.position.y = -0.26
      lotusHead.scale.set(1, 1.35, 1)
      lotusHead.castShadow = true

      dropGroup.add(dropBody, lotusHead)
      this.highDetailGroup.add(dropGroup)
    }
  }

  /**
   * 畫質動態分級（Apply Quality Preset）
   */
  public applyQuality(quality: Quality): void {
    this.currentQuality = quality

    if (quality === 'high') {
      this.highDetailGroup.visible = true
      this.mediumDetailGroup.visible = true
      this.lowDetailGroup.visible = false
      this.twinDragonsGroup.visible = true
      this.pagodaGroup.visible = true
      this.setShadows(true, true)
    } else if (quality === 'medium') {
      this.highDetailGroup.visible = false
      this.mediumDetailGroup.visible = true
      this.lowDetailGroup.visible = true
      this.twinDragonsGroup.visible = true
      this.pagodaGroup.visible = true
      this.setShadows(true, false)
    } else {
      // low
      this.highDetailGroup.visible = false
      this.mediumDetailGroup.visible = false
      this.lowDetailGroup.visible = true
      this.twinDragonsGroup.visible = false
      this.pagodaGroup.visible = true
      this.setShadows(false, false)
    }
  }

  private setShadows(cast: boolean, receive: boolean): void {
    this.root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        obj.castShadow = cast
        obj.receiveShadow = receive
      }
    })
  }

  /**
   * 安全資源釋放（Safe Disposal）
   */
  public dispose(): void {
    for (const geom of this.allocatedGeometries) {
      geom.dispose()
    }
    this.allocatedGeometries.length = 0

    for (const mat of this.allocatedMaterials) {
      mat.dispose()
    }
    this.allocatedMaterials.length = 0

    if (this.tileTubeInstanced) this.tileTubeInstanced.dispose()
    if (this.tileWadangInstanced) this.tileWadangInstanced.dispose()
    if (this.tileDripInstanced) this.tileDripInstanced.dispose()
    if (this.dougongBlockInstanced) this.dougongBlockInstanced.dispose()
    if (this.dougongArmInstanced) this.dougongArmInstanced.dispose()
    if (this.dougongBeakInstanced) this.dougongBeakInstanced.dispose()
  }
}
