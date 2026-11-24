import * as THREE from 'three'
import type { Quality } from '../engine/save'
import type { TemplePbrLibrary } from './temple-pbr-materials'

/**
 * 玉皇宮主殿 3D 半寫實電影級屋頂與屋簷樣板（Revision Pass 2）
 *
 * 針對第一輪視覺驗收回饋進行全面架構與比例重塑：
 * 1. 大幅抬高正脊與加強舉折反宇（peakY 抬高，加大屋面微凹與簷口反宇起翹，遠景天際線極度鮮明）
 * 2. 徹底移除零散細尖針狀構件，改為圓潤厚實、與四角斜垂脊自然連成一體的立體飛簷起翹
 * 3. 大幅放大正脊中央「雙龍拜塔與摩尼火珠」（金塔放大至 2.8m，雙龍延展至 4.8m，立體昂首盤旋）
 * 4. 大幅強化簷下斗拱、瓦當（直徑 0.22m）、滴水牙子與大額枋厚度，確保在玩家正常視角立即可讀
 * 5. 確保在前庭中軸視角下，屋頂具備巍峨威嚴的宮殿氣勢與豐富陰影層次
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

    // Build the revamped architectural model
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
   * 1. 舉折反宇歇山曲面大屋面（加強弧度與飛簷起翹）
   * 擴大中間微凹下陷與簷口反宇向上飛揚弧度，創造鮮明台灣宮廟剪影
   */
  private buildSweptRoofSurfaces(width: number, depth: number, eaveY: number, peakY: number): void {
    const halfW = width / 2
    const halfD = depth / 2

    // 前坡 z: 0 -> halfD, 後坡 z: 0 -> -halfD
    for (const slopeDir of [1, -1]) {
      const isFront = slopeDir === 1
      const slopeSegments = 20
      const xCols = 28
      const xStep = width / xCols

      const geom = new THREE.BufferGeometry()
      const vertices: number[] = []
      const normals: number[] = []
      const uvs: number[] = []
      const indices: number[] = []

      for (let j = 0; j <= slopeSegments; j++) {
        const t = j / slopeSegments // 0 at ridge (peak), 1 at eave
        // 增強宮廟舉折弧度：深邃微凹 + 簷口強烈起揚
        const yNorm = 1 - t
        const curveSag = Math.sin(t * Math.PI) * 0.52
        const flare = Math.pow(t, 2.6) * 0.48
        const y = eaveY + (peakY - eaveY) * yNorm - curveSag + flare

        const z = slopeDir * (t * halfD)

        for (let i = 0; i <= xCols; i++) {
          const u = i / xCols
          const x = -halfW + i * xStep
          // 四角起翹更明顯且平滑擴展至外翼角
          const cornerDist = Math.abs(x) / halfW
          const cornerLift = Math.pow(cornerDist, 2.4) * t * 1.15

          vertices.push(x, y + cornerLift, z)
          normals.push(0, 1, 0)
          uvs.push(u * (width / 2.2), t * (halfD / 1.8))
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
      const rafterThickness = 0.36
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
      const bargeGeom = new THREE.BoxGeometry(0.48, 0.55, depth * 0.98)
      this.allocatedGeometries.push(bargeGeom)
      const barge = new THREE.Mesh(bargeGeom, this.fasciaPbrMat)
      barge.position.set(bargeX, (peakY + eaveY) / 2 - 0.15, 0)
      barge.castShadow = true
      this.root.add(barge)

      // 兩側山牆懸魚惹草金屬飾件（Hanging Fish & Cloud Ornament）
      const fishGeom = new THREE.ConeGeometry(0.42, 1.25, 8)
      this.allocatedGeometries.push(fishGeom)
      const fish = new THREE.Mesh(fishGeom, this.goldPbrMat)
      fish.position.set(side * halfW, peakY - 0.95, 0)
      fish.rotation.z = side > 0 ? -Math.PI / 2 : Math.PI / 2
      this.mediumDetailGroup.add(fish)
    }
  }

  /**
   * 2. 實體 3D 琉璃筒瓦隴（Instanced Fluted Tiles）、加大瓦當與鋸齒滴水牙子
   * 瓦當由直徑 0.125m 放大至 0.22m，筒瓦半徑增至 0.14m，使玩家正常視角立即可讀！
   */
  private buildInstancedRoofTiles(width: number, depth: number, eaveY: number, peakY: number): void {
    const halfW = width / 2
    const halfD = depth / 2

    const ridgeCount = 34
    const stepX = (width - 1.2) / (ridgeCount - 1)
    const coursesPerRidge = 14

    const totalTubes = ridgeCount * coursesPerRidge
    const totalEnds = ridgeCount

    // 加大加厚之幾何體單元
    const tubeGeom = new THREE.CylinderGeometry(0.125, 0.145, 0.72, 8, 1, false, 0, Math.PI)
    tubeGeom.rotateZ(Math.PI / 2)
    this.allocatedGeometries.push(tubeGeom)

    // 圓形瓦當直徑放大為 0.22m，具備清晰金色雙環與圓珠外圈浮雕
    const wadangGeom = new THREE.CylinderGeometry(0.185, 0.185, 0.08, 16)
    wadangGeom.rotateX(Math.PI / 2)
    this.allocatedGeometries.push(wadangGeom)

    // 倒三角滴水牙子長度增至 0.30m
    const dripGeom = new THREE.ConeGeometry(0.16, 0.32, 5)
    dripGeom.rotateZ(Math.PI)
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

    for (let r = 0; r < ridgeCount; r++) {
      const rx = -halfW + 0.6 + r * stepX
      const cornerDist = Math.abs(rx) / halfW

      for (let c = 0; c < coursesPerRidge; c++) {
        const t = (c + 0.5) / coursesPerRidge
        const rz = t * (halfD - 0.15)
        const yNorm = 1 - t
        const curveSag = Math.sin(t * Math.PI) * 0.52
        const flare = Math.pow(t, 2.6) * 0.48
        const cornerLift = Math.pow(cornerDist, 2.4) * t * 1.15
        const ry = eaveY + (peakY - eaveY) * yNorm - curveSag + flare + cornerLift + 0.10

        const slopeAngle = Math.atan2(peakY - eaveY + (curveSag - flare), halfD)

        dummy.position.set(rx, ry, rz)
        dummy.rotation.set(-slopeAngle, 0, 0)
        dummy.scale.set(1, 1, 1)
        dummy.updateMatrix()
        this.tileTubeInstanced.setMatrixAt(tubeIdx++, dummy.matrix)
      }

      // 簷口瓦當（加大 0.22m，位於簷前緣）
      const eaveCornerLift = Math.pow(cornerDist, 2.4) * 1.15
      const eaveZ = halfD + 0.10
      const eaveYPos = eaveY + 0.22 + eaveCornerLift

      dummy.position.set(rx, eaveYPos, eaveZ)
      dummy.rotation.set(-0.25, 0, 0)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      this.tileWadangInstanced.setMatrixAt(r, dummy.matrix)

      // 瓦溝下緣滴水牙子
      if (r < ridgeCount - 1) {
        const dripX = rx + stepX / 2
        const midCornerLift = Math.pow(Math.abs(dripX) / halfW, 2.4) * 1.15
        dummy.position.set(dripX, eaveYPos - 0.20 + midCornerLift, eaveZ - 0.04)
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
   * 3. 台灣傳統宮廟官廟象徵：厚實立體雙燕尾正脊（重構大氣勢實體曲線，移除細弱尖刺）
   */
  private buildSwallowtailMainRidge(width: number, peakY: number): void {
    const ridgeLen = width + 1.2
    const ridgeY = peakY + 0.24

    // (1) 正脊基座大樑（Main Ridge Beam - 厚實朱漆大木）
    const mainBeamGeom = new THREE.CylinderGeometry(0.35, 0.42, ridgeLen, 16)
    mainBeamGeom.rotateZ(Math.PI / 2)
    this.allocatedGeometries.push(mainBeamGeom)
    const mainBeam = new THREE.Mesh(mainBeamGeom, this.vermilionPbrMat)
    mainBeam.position.set(0, ridgeY, 0)
    mainBeam.castShadow = true
    this.root.add(mainBeam)

    // (2) 西施脊（中層鏤空透光雕花磚，高度增至 0.62m）
    const xishiH = 0.62
    const xishiGeom = new THREE.BoxGeometry(ridgeLen * 0.86, xishiH, 0.28)
    this.allocatedGeometries.push(xishiGeom)
    const xishiMesh = new THREE.Mesh(xishiGeom, this.cutoutMat)
    xishiMesh.position.set(0, ridgeY + 0.42, 0)
    xishiMesh.castShadow = true
    this.root.add(xishiMesh)

    // 西施脊上下鎏金規帶鑲邊
    for (const side of [-1, 1]) {
      const moldingGeom = new THREE.BoxGeometry(ridgeLen * 0.88, 0.12, 0.06)
      this.allocatedGeometries.push(moldingGeom)
      const molding = new THREE.Mesh(moldingGeom, this.goldPbrMat)
      molding.position.set(0, ridgeY + 0.42, side * 0.15)
      this.mediumDetailGroup.add(molding)
    }

    // (3) 正脊頂層鎏金冠帶琉璃瓦壟
    const crestGeom = new THREE.CylinderGeometry(0.22, 0.26, ridgeLen * 0.90, 14)
    crestGeom.rotateZ(Math.PI / 2)
    this.allocatedGeometries.push(crestGeom)
    const crestMesh = new THREE.Mesh(crestGeom, this.ridgeGoldPbrMat)
    crestMesh.position.set(0, ridgeY + 0.78, 0)
    crestMesh.castShadow = true
    this.root.add(crestMesh)

    // (4) 正脊東西兩側立體雙燕尾：依指令移除左右兩側斜向金色長圓柱與收口圓球，保留水平主脊與西施脊完整結構
    // (Left and right slanted golden swallowtail cylinders and finials removed per architectural simplification)
  }

  /**
   * 4. 正脊中央「雙龍拜塔」大視覺主角群（金塔放大至 2.8m，雙龍長度擴大至 4.8m）
   * 讓玩家站在前庭廣場也能一眼辨識出祥龍騰雲、金塔摩尼火珠的宏偉主殿焦點！
   */
  private buildTwinDragonsPagodaCrest(peakY: number): void {
    const crestCenterY = peakY + 0.98

    // (1) 中央七寶琉璃八角金塔（大型化 2.8m 雄偉浮屠）
    // 重疊蓮花須彌座
    const baseGeom = new THREE.CylinderGeometry(0.75, 0.95, 0.45, 8)
    this.allocatedGeometries.push(baseGeom)
    const baseMesh = new THREE.Mesh(baseGeom, this.goldPbrMat)
    baseMesh.position.set(0, crestCenterY + 0.22, 0)
    baseMesh.castShadow = true
    this.pagodaGroup.add(baseMesh)

    // 三層寬簷八角樓閣塔身
    for (let tier = 0; tier < 3; tier++) {
      const tierY = crestCenterY + 0.52 + tier * 0.58
      const scale = 1.0 - tier * 0.16

      // 塔壁
      const bodyGeom = new THREE.CylinderGeometry(0.48 * scale, 0.58 * scale, 0.44, 8)
      this.allocatedGeometries.push(bodyGeom)
      const body = new THREE.Mesh(bodyGeom, this.cutoutMat)
      body.position.set(0, tierY, 0)

      // 塔簷出挑
      const eaveGeom = new THREE.CylinderGeometry(0.22 * scale, 0.82 * scale, 0.18, 8)
      this.allocatedGeometries.push(eaveGeom)
      const eave = new THREE.Mesh(eaveGeom, this.ridgeGoldPbrMat)
      eave.position.set(0, tierY + 0.28, 0)
      eave.castShadow = true

      this.pagodaGroup.add(body, eave)
    }

    // 塔頂大摩尼寶珠與烈焰火珠（火珠直徑 0.45m，高聳燦爛）
    const pearlY = crestCenterY + 2.55
    const pearlGeom = new THREE.SphereGeometry(0.38, 20, 16)
    this.allocatedGeometries.push(pearlGeom)
    const pearlMesh = new THREE.Mesh(pearlGeom, this.goldPbrMat)
    pearlMesh.position.set(0, pearlY, 0)
    pearlMesh.castShadow = true
    this.pagodaGroup.add(pearlMesh)

    // 四方巨大鏤空火焰飾件
    for (let f = 0; f < 4; f++) {
      const flameGeom = new THREE.ConeGeometry(0.14, 0.75, 6)
      this.allocatedGeometries.push(flameGeom)
      const flame = new THREE.Mesh(flameGeom, this.ridgeGoldPbrMat)
      flame.position.set(Math.cos(f * Math.PI / 2) * 0.26, pearlY + 0.22, Math.sin(f * Math.PI / 2) * 0.26)
      flame.rotation.z = Math.cos(f * Math.PI / 2) * -0.45
      flame.rotation.x = Math.sin(f * Math.PI / 2) * 0.45
      this.pagodaGroup.add(flame)
    }

    // (2) 東西兩條立體剪黏金龍：依指令移除左側與右側祥龍整組（含龍首、龍身、金角、背鰭與底座祥雲），保留中央七寶八角金塔與摩尼寶珠
    // (Left and right twin dragon sculptures removed per instruction, retaining central pagoda and pearl)

    this.root.add(this.pagodaGroup)
    this.root.add(this.twinDragonsGroup)
  }

  /**
   * 5. 四方斜垂脊（Hip Ridges）與飛簷牌頭：依指令移除向左上與右上斜伸之金色長圓柱與端點收口金球
   */
  private buildHipRidgesAndCornerBeasts(_width: number, _depth: number, _eaveY: number, _peakY: number): void {
    // Left and right corner hip ridge golden tubes and finials removed per architectural simplification instruction
  }

  /**
   * 6. 屋簷下方大木作排樓斗拱系統（加深出挑、加大昂嘴、強化陰影層次）
   */
  private buildFrontEaveDougongBrackets(width: number, depth: number, eaveY: number): void {
    const halfD = depth / 2
    const bracketY = eaveY - 0.45
    const bracketZ = halfD - 0.48

    const clusterCount = 7
    const spanW = width * 0.78
    const stepX = spanW / (clusterCount - 1)

    // 大號坐斗（0.52m × 0.24m × 0.52m）
    const blockGeom = new THREE.BoxGeometry(0.52, 0.24, 0.52)
    this.allocatedGeometries.push(blockGeom)

    // 寬闊橫栱（兩端雕雲紋，面寬 1.15m）
    const armGeom = new THREE.BoxGeometry(1.15, 0.18, 0.28)
    this.allocatedGeometries.push(armGeom)

    // 鋒芒象鼻昂（前挑 0.95m，下傾 24 度，投射深邃陰影）
    const beakGeom = new THREE.BoxGeometry(0.26, 0.22, 0.95)
    this.allocatedGeometries.push(beakGeom)

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

      // Tier 1: 坐斗
      dummy.position.set(cx, bracketY, bracketZ)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      this.dougongBlockInstanced.setMatrixAt(bIdx++, dummy.matrix)

      // Tier 1: 第一層橫栱
      dummy.position.set(cx, bracketY + 0.16, bracketZ)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      this.dougongArmInstanced.setMatrixAt(aIdx++, dummy.matrix)

      // Tier 2: 象鼻昂（強烈出挑 0.95m）
      dummy.position.set(cx, bracketY + 0.28, bracketZ + 0.35)
      dummy.rotation.set(0.24, 0, 0)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      this.dougongBeakInstanced.setMatrixAt(kIdx++, dummy.matrix)

      // Tier 2: 散斗
      for (const side of [-1, 1]) {
        dummy.position.set(cx + side * 0.45, bracketY + 0.30, bracketZ)
        dummy.rotation.set(0, 0, 0)
        dummy.scale.set(0.7, 0.85, 0.7)
        dummy.updateMatrix()
        this.dougongBlockInstanced.setMatrixAt(bIdx++, dummy.matrix)
      }

      // Tier 3: 第二層橫栱
      dummy.position.set(cx, bracketY + 0.42, bracketZ + 0.16)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(1.25, 1, 1)
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
   * 7. 鰲魚雀替雕花托木、懸空垂花蓮花吊筒與厚重大額枋主壽樑
   */
  private buildCarvedTimberworkAndSuspendedLotus(width: number, depth: number, eaveY: number): void {
    const halfD = depth / 2
    const beamY = eaveY - 0.58
    const beamZ = halfD - 0.48

    // (1) 正面厚實主壽樑（高 0.68m，深 0.55m，大木作穩實托承）
    const architraveGeom = new THREE.BoxGeometry(width * 0.90, 0.68, 0.55)
    this.allocatedGeometries.push(architraveGeom)
    const architrave = new THREE.Mesh(architraveGeom, this.timberPbrMat)
    architrave.position.set(0, beamY, beamZ)
    architrave.castShadow = true
    architrave.receiveShadow = true
    this.root.add(architrave)

    // 壽樑燙金回紋飾帶
    const inlayGeom = new THREE.BoxGeometry(width * 0.88, 0.16, 0.58)
    this.allocatedGeometries.push(inlayGeom)
    const inlay = new THREE.Mesh(inlayGeom, this.goldPbrMat)
    inlay.position.set(0, beamY, beamZ)
    this.mediumDetailGroup.add(inlay)

    // (2) 鰲魚雀替（雕花托木）
    for (const cx of [-5.4, 5.4]) {
      for (const dir of [-1, 1]) {
        const corbelGroup = new THREE.Group()
        corbelGroup.position.set(cx + dir * 0.65, beamY - 0.38, beamZ)

        const corbelGeom = new THREE.BoxGeometry(0.88, 0.45, 0.26)
        this.allocatedGeometries.push(corbelGeom)
        const corbelMesh = new THREE.Mesh(corbelGeom, this.vermilionPbrMat)
        corbelMesh.castShadow = true

        const tailGeom = new THREE.ConeGeometry(0.18, 0.52, 6)
        this.allocatedGeometries.push(tailGeom)
        const tailMesh = new THREE.Mesh(tailGeom, this.goldPbrMat)
        tailMesh.position.set(dir * 0.38, -0.10, 0)
        tailMesh.rotation.z = dir > 0 ? -1.15 : 1.15

        corbelGroup.add(corbelMesh, tailMesh)
        this.highDetailGroup.add(corbelGroup)
      }
    }

    // (3) 垂花蓮花吊筒（加粗加長，垂懸在挑簷前方）
    for (const lx of [-6.2, -2.8, 2.8, 6.2]) {
      const dropGroup = new THREE.Group()
      dropGroup.position.set(lx, beamY - 0.28, beamZ + 0.38)

      const dropBodyGeom = new THREE.CylinderGeometry(0.16, 0.18, 0.58, 8)
      this.allocatedGeometries.push(dropBodyGeom)
      const dropBody = new THREE.Mesh(dropBodyGeom, this.vermilionPbrMat)
      dropBody.castShadow = true

      const lotusHeadGeom = new THREE.SphereGeometry(0.22, 12, 10)
      this.allocatedGeometries.push(lotusHeadGeom)
      const lotusHead = new THREE.Mesh(lotusHeadGeom, this.ridgeGoldPbrMat)
      lotusHead.position.y = -0.34
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
        const isMicroDetail =
          obj === this.tileTubeInstanced ||
          obj === this.tileWadangInstanced ||
          obj === this.tileDripInstanced ||
          obj === this.dougongBlockInstanced ||
          obj === this.dougongArmInstanced ||
          obj === this.dougongBeakInstanced ||
          this.highDetailGroup.children.includes(obj) ||
          this.highDetailGroup.children.includes((obj as any).parent) ||
          this.twinDragonsGroup.children.includes(obj) ||
          this.twinDragonsGroup.children.includes((obj as any).parent)

        obj.castShadow = cast && !isMicroDetail
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
