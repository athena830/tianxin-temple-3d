import * as THREE from 'three'

/**
 * Q 版手繪 3D 低面數 (Hand-painted Low-poly) 啞光黏土風格角色
 * - 正統 2 頭身黃金萌系比例（大頭短萌身體、圓潤手辦手捏質感）
 * - 全面採用 MeshLambertMaterial，無刺眼高光與金屬反光，呈現消光溫潤手繪手作黏土質感
 * - 正面朝向本地 +Z 軸，總高度約 1.35 公尺，站立於地面 y = 0
 * - 內建自訂 3D 模型 (.glb / .gltf) 一鍵切換與載入接口
 */
export type ChibiPalette = { robe: string; sash: string; hair: string }

export const CHIBI_PALETTES: Record<string, ChibiPalette> = {
  // 素心行者：溫潤素白袍 + 青竹綠腰帶 + 經典藍色手繪黏土髮
  jade: { robe: '#fbf7ee', sash: '#6e9882', hair: '#3a6692' },
  // 丹心行者：朱紅錦袍 + 暖金流蘇腰帶 + 暖深黑褐黏土髮
  vermillion: { robe: '#b64332', sash: '#f2cb73', hair: '#2a1d18' },
  // 月照行者：月白冰藍袍 + 天藍腰帶 + 晶瑩天青藍手繪黏土髮
  moon: { robe: '#ffffff', sash: '#4b88ba', hair: '#3678b4' },
  scholar: { robe: '#4e7284', sash: '#d9c89e', hair: '#1e1a17' },
  monk: { robe: '#b58334', sash: '#4a2f18', hair: '#2a1e16' },
  peach: { robe: '#cf7569', sash: '#f4e0d4', hair: '#221714' },
  lavender: { robe: '#85739a', sash: '#e6ded3', hair: '#221926' },
  amber: { robe: '#a67b41', sash: '#59381e', hair: '#271c15' },
  pine: { robe: '#3a5f45', sash: '#d4ad64', hair: '#201b17' },
  rose: { robe: '#b85468', sash: '#faede8', hair: '#2a1c1a' },
  indigo: { robe: '#304768', sash: '#d8caa6', hair: '#1a1816' },
  gold: { robe: '#c69532', sash: '#702d20', hair: '#281c14' },
  terracotta: { robe: '#92523e', sash: '#decab0', hair: '#271d18' },
  azure: { robe: '#4f859d', sash: '#ece6d8', hair: '#1c1b20' },
  crimson: { robe: '#8e2724', sash: '#e4c472', hair: '#221513' },
  silver: { robe: '#8e989d', sash: '#353a3e', hair: '#2a2826' },
  plum: { robe: '#5c3d56', sash: '#ded0c4', hair: '#241a22' },
  ochre: { robe: '#a6722d', sash: '#4b321c', hair: '#271c15' },
  teal: { robe: '#366e66', sash: '#e8dcbe', hair: '#1b221e' },
  charcoal: { robe: '#3a3a42', sash: '#b09972', hair: '#1c1c1e' },
}

/** 建立手繪啞光黏土材質（消光柔和、無強烈金屬反光） */
const clay = (color: string) => new THREE.MeshLambertMaterial({ color })

export class Chibi {
  readonly root = new THREE.Group()

  // 幾何體階層容器
  private readonly proceduralGroup = new THREE.Group()
  private readonly body = new THREE.Group()
  private readonly head = new THREE.Group()
  private readonly legL = new THREE.Group()
  private readonly legR = new THREE.Group()
  private readonly armL = new THREE.Group()
  private readonly armR = new THREE.Group()

  // 外部自訂 3D 模型 (.glb / .gltf) 容器
  private customModelGroup: THREE.Object3D | null = null

  // 啞光手繪黏土材質
  private readonly robeMat = clay('#fbf7ee')
  private readonly sleeveMat = clay('#fbf7ee')
  private readonly sashMat = clay('#6e9882')
  private readonly hairMat = clay('#3a6692')
  private readonly skinMat = clay('#fbe4ce')
  private readonly darkMat = clay('#221815')
  private readonly shoeMat = clay('#352822')
  private readonly goldMat = clay('#f2cb73')

  private phase = 0
  private walk = 0
  private bowBlend = 0

  constructor() {
    this.root.add(this.proceduralGroup)
    this.proceduralGroup.add(this.body)

    // ==========================================
    // 1. 腿部與萌系圓靴（短萌比例）
    // ==========================================
    for (const [leg, x] of [[this.legL, -0.11], [this.legR, 0.11]] as const) {
      leg.position.set(x, 0.32, 0)
      // 圓柱短小腿
      const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.085, 0.22, 14), this.robeMat)
      shin.position.y = -0.11
      // 萌萌圓潤手捏黏土包子鞋
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.105, 16, 12), this.shoeMat)
      foot.scale.set(1, 0.62, 1.4)
      foot.position.set(0, -0.22, 0.04)
      leg.add(shin, foot)
      this.body.add(leg)
    }

    // ==========================================
    // 2. 軀幹與古典短袍（二頭身圓柱黏土造型）
    // ==========================================
    // 圓錐圓台低面數袍服主體
    const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.35, 0.46, 20), this.robeMat)
    robe.position.y = 0.52
    // 寬版黏土手捏腰帶
    const sash = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.09, 20), this.sashMat)
    sash.position.y = 0.62
    // 圓潤立體衣領飾圈
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.035, 8, 20), this.sashMat)
    collar.rotation.x = Math.PI / 2
    collar.position.y = 0.74
    this.body.add(robe, sash, collar)

    // ==========================================
    // 3. 雙臂與圓潤小手（手辦黏土袖筒）
    // ==========================================
    for (const [arm, side] of [[this.armL, -1], [this.armR, 1]] as const) {
      arm.position.set(side * 0.25, 0.72, 0)
      // 圓潤黏土短袖
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.11, 0.26, 14), this.sleeveMat)
      sleeve.position.y = -0.12
      sleeve.rotation.z = side * 0.18
      // 圓嘟嘟膚色小手
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 12), this.skinMat)
      hand.position.set(side * 0.02, -0.26, 0)
      arm.add(sleeve, hand)
      this.body.add(arm)
    }

    // ==========================================
    // 4. 大頭部（二頭身萌系大眼手辦黏土頭）
    // ==========================================
    this.head.position.y = 0.98

    // 圓潤大頭部臉型
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.33, 28, 22), this.skinMat)
    face.position.set(0, 0, 0)

    // 蓬鬆黏土髮罩（覆蓋後腦與頂部）
    const hairCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.346, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.58),
      this.hairMat
    )
    hairCap.rotation.x = -0.26
    hairCap.position.set(0, 0.02, -0.02)

    // 前額手捏立體黏土瀏海（左中右三瓣蓬鬆髮片）
    const bangCenter = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), this.hairMat)
    bangCenter.scale.set(1.1, 0.65, 0.8)
    bangCenter.position.set(0, 0.18, 0.27)
    bangCenter.rotation.x = 0.35

    const bangLeft = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), this.hairMat)
    bangLeft.scale.set(1, 0.65, 0.8)
    bangLeft.position.set(-0.16, 0.16, 0.25)
    bangLeft.rotation.set(0.3, -0.25, -0.2)

    const bangRight = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), this.hairMat)
    bangRight.scale.set(1, 0.65, 0.8)
    bangRight.position.set(0.16, 0.16, 0.25)
    bangRight.rotation.set(0.3, 0.25, 0.2)

    // 頂部萌系手作黏土丸子髮包 (Cute Hair Bun)
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.135, 18, 14), this.hairMat)
    bun.position.set(0, 0.34, -0.05)

    // 髮包金飾簪 (Gilded Hairpin / Ornament)
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.36, 10), this.goldMat)
    pin.rotation.z = Math.PI / 2
    pin.position.copy(bun.position)

    const pinBallL = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), this.goldMat)
    pinBallL.position.set(-0.19, 0.34, -0.05)
    const pinBallR = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), this.goldMat)
    pinBallR.position.set(0.19, 0.34, -0.05)

    this.head.add(face, hairCap, bangCenter, bangLeft, bangRight, bun, pin, pinBallL, pinBallR)

    // 大眼萌系手繪五官
    for (const side of [-1, 1]) {
      const eyeGroup = new THREE.Group()
      eyeGroup.position.set(side * 0.11, 0.01, 0.295)

      // 黑色手繪水滴大眼
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), this.darkMat)
      eye.scale.set(1, 1.35, 0.45)

      // 眼睛靈動高光小白點 (Anime Eye Sparkle)
      const highlight = new THREE.Mesh(
        new THREE.SphereGeometry(0.016, 10, 8),
        new THREE.MeshBasicMaterial({ color: '#ffffff' })
      )
      highlight.position.set(side * 0.012, 0.024, 0.035)

      eyeGroup.add(eye, highlight)
      this.head.add(eyeGroup)

      // 圓潤粉嫩蜜桃腮紅 (Blush)
      const blush = new THREE.Mesh(
        new THREE.CircleGeometry(0.055, 18),
        new THREE.MeshBasicMaterial({ color: '#fcaaa0', transparent: true, opacity: 0.82 })
      )
      blush.position.set(side * 0.19, -0.08, 0.28)
      blush.rotation.y = side * 0.52
      this.head.add(blush)
    }

    // 治癒小微笑 (Gentle Smile)
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.007, 6, 14, Math.PI), this.darkMat)
    mouth.rotation.z = Math.PI
    mouth.position.set(0, -0.09, 0.32)
    this.head.add(mouth)

    this.body.add(this.head)

    // 開啟陰影投射與接收
    this.root.traverse(obj => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true
        obj.receiveShadow = true
      }
    })
  }

  /**
   * 切換預設色盤或外觀風格
   */
  setPalette(id: string): void {
    const p = CHIBI_PALETTES[id] ?? CHIBI_PALETTES.jade
    this.robeMat.color.set(p.robe)
    this.sleeveMat.color.set(p.robe)
    this.sashMat.color.set(p.sash)
    this.hairMat.color.set(p.hair)
  }

  /**
   * 【模型載入準備接口】
   * 方便未來使用 GLTFLoader 載入外部自訂 .glb / .gltf 模型並替換幾何體
   *
   * 範例用法：
   * ```ts
   * import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
   * const loader = new GLTFLoader()
   * loader.load('./models/my_character.glb', (gltf) => {
   *   chibi.setCustomModel(gltf.scene)
   * })
   * ```
   */
  setCustomModel(model: THREE.Object3D): void {
    if (this.customModelGroup) {
      this.root.remove(this.customModelGroup)
      this.customModelGroup = null
    }
    // 隱藏程式化幾何體
    this.proceduralGroup.visible = false

    // 設定外部模型
    model.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true
        child.receiveShadow = true
        // 若想將外部模型材質轉為消光黏土手繪質感，可在這裡替換為 MeshLambertMaterial
      }
    })
    this.customModelGroup = model
    this.root.add(model)
  }

  /**
   * 恢復為 Q 版手繪黏土幾何體風格
   */
  restoreProceduralModel(): void {
    if (this.customModelGroup) {
      this.root.remove(this.customModelGroup)
      this.customModelGroup = null
    }
    this.proceduralGroup.visible = true
  }

  /**
   * 角色每幀動作與動畫
   * @param speed 移動速度（米/秒），驅動黏土小偶輕盈彈跳步行與擺手
   * @param bow 0..1 合十鞠躬參拜混合係數
   */
  animate(dt: number, time: number, speed: number, reducedMotion: boolean, bow = 0): void {
    const target = THREE.MathUtils.clamp(speed / 3.0, 0, 1)
    this.walk = THREE.MathUtils.damp(this.walk, target, 11, dt)
    this.phase += dt * (4.2 + speed * 2.8)
    const motion = reducedMotion ? 0.35 : 1

    // 黏土雙腿小碎步擺動
    const swing = Math.sin(this.phase) * 0.75 * this.walk * motion
    this.legL.rotation.x = swing
    this.legR.rotation.x = -swing

    // 黏土雙臂自然前後擺動
    this.armL.rotation.x = -swing * 0.8
    this.armR.rotation.x = swing * 0.8

    // 呼吸微動與 Q 萌彈跳 (Chibi Hop & Bobbing)
    const breathe = Math.sin(time * 2.2) * 0.015 * (1 - this.walk) * motion
    const hop = Math.abs(Math.sin(this.phase)) * 0.05 * this.walk * motion

    this.body.position.y = hop
    this.head.position.y = 0.98 + breathe
    this.head.rotation.z = Math.sin(this.phase * 0.5) * 0.06 * this.walk * motion
    this.body.scale.set(1, 1 + breathe, 1)

    // 合十朝拜 / 鞠躬 (Palms-together Bow)
    this.bowBlend = THREE.MathUtils.damp(this.bowBlend, bow > 0 ? 1 : 0, 8, dt)
    const k = this.bowBlend
    if (k > 0.001) {
      // 雙手捧起合十於胸前
      this.armL.rotation.x = THREE.MathUtils.lerp(this.armL.rotation.x, -1.25, k)
      this.armR.rotation.x = THREE.MathUtils.lerp(this.armR.rotation.x, -1.25, k)
      this.armL.rotation.z = -0.55 * k
      this.armR.rotation.z = 0.55 * k
      const dip = bow > 0 ? Math.max(0, Math.sin(bow * Math.PI * 4 - Math.PI / 2) * 0.5 + 0.5) : 0
      const amount = (reducedMotion ? 0.2 : 0.42) * dip * k
      this.body.rotation.x = amount * 0.35
      this.head.rotation.x = amount
    } else {
      this.armL.rotation.z = this.armR.rotation.z = 0
      this.body.rotation.x = 0
      this.head.rotation.x = 0
    }
  }
}

