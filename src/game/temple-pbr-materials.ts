import * as THREE from 'three'
import type { Quality } from '../engine/save'

export type TemplePbrKind =
  | 'courtyardStone'
  | 'imperialRoad'
  | 'plinthStone'
  | 'vermilionWood'
  | 'darkTimber'
  | 'glazedRoofTile'
  | 'agedBronze'
  | 'gildedGold'

type TextureBundle = {
  map: THREE.CanvasTexture
  normalMap: THREE.CanvasTexture
  roughnessMap: THREE.CanvasTexture
}

type ManagedMaterial = {
  material: THREE.MeshStandardMaterial
  bundle: TextureBundle
  baseNormalScale: number
  baseEnvIntensity: number
}

function makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D | null } {
  if (typeof document === 'undefined') {
    return { canvas: {} as HTMLCanvasElement, ctx: null }
  }
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  return { canvas, ctx }
}

/** Deterministic PRNG so procedural stone/wood grain is reproducible across runs and tests. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Convert a greyscale height canvas into a tangent-space normal map via Sobel filter. */
function buildNormalMap(heightCanvas: HTMLCanvasElement, strength = 2.0): THREE.CanvasTexture {
  const w = heightCanvas.width || 64
  const h = heightCanvas.height || 64
  const { canvas: outCanvas, ctx: outCtx } = makeCanvas(w, h)
  const srcCtx = typeof heightCanvas.getContext === 'function' ? heightCanvas.getContext('2d') : null

  const imgData = outCtx && srcCtx && typeof srcCtx.getImageData === 'function' ? srcCtx.getImageData(0, 0, w, h) : null
  const dstImg = outCtx && typeof outCtx.createImageData === 'function' ? outCtx.createImageData(w, h) : null

  if (!outCtx || !imgData?.data || !dstImg?.data) {
    if (outCtx && typeof outCtx.fillRect === 'function') {
      outCtx.fillStyle = '#8080ff'
      outCtx.fillRect(0, 0, w, h)
    }
    const tex = new THREE.CanvasTexture(outCanvas)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    return tex
  }

  const src = imgData.data
  const dst = dstImg.data
  const sample = (x: number, y: number): number => {
    const cx = ((x % w) + w) % w
    const cy = ((y % h) + h) % h
    return src[(cy * w + cx) * 4] / 255
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = sample(x - 1, y - 1)
      const t = sample(x, y - 1)
      const tr = sample(x + 1, y - 1)
      const l = sample(x - 1, y)
      const r = sample(x + 1, y)
      const bl = sample(x - 1, y + 1)
      const b = sample(x, y + 1)
      const br = sample(x + 1, y + 1)

      const dx = (tr + 2 * r + br - (tl + 2 * l + bl)) * strength
      const dy = (bl + 2 * b + br - (tl + 2 * t + tr)) * strength
      const dz = 1.0
      const invLen = 1 / Math.hypot(dx, dy, dz)

      const idx = (y * w + x) * 4
      dst[idx] = Math.round((-dx * invLen * 0.5 + 0.5) * 255)
      dst[idx + 1] = Math.round((-dy * invLen * 0.5 + 0.5) * 255)
      dst[idx + 2] = Math.round((dz * invLen * 0.5 + 0.5) * 255)
      dst[idx + 3] = 255
    }
  }
  outCtx.putImageData(dstImg, 0, 0)
  const tex = new THREE.CanvasTexture(outCanvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

function finalizeBundle(
  diffCanvas: HTMLCanvasElement,
  heightCanvas: HTMLCanvasElement,
  roughCanvas: HTMLCanvasElement,
  normalStrength: number,
): TextureBundle {
  const map = new THREE.CanvasTexture(diffCanvas)
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.anisotropy = 4

  const normalMap = buildNormalMap(heightCanvas, normalStrength)
  normalMap.anisotropy = 4

  const roughnessMap = new THREE.CanvasTexture(roughCanvas)
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping
  roughnessMap.anisotropy = 4

  return { map, normalMap, roughnessMap }
}

/** 1. 花崗岩石板地坪 PBR 貼圖（工字砌石板、石英斑點、倒角磚縫與微粗糙度變化） */
function createGraniteBundle(
  baseHex: string,
  altHex: string,
  groutHex: string,
  seed: number,
  cols = 4,
  rows = 4,
): TextureBundle {
  const s = 512
  const { canvas: dc, ctx: d } = makeCanvas(s, s)
  const { canvas: hc, ctx: h } = makeCanvas(s, s)
  const { canvas: rc, ctx: r } = makeCanvas(s, s)
  const rand = mulberry32(seed)

  if (d && h && r) {
    d.fillStyle = groutHex
    d.fillRect(0, 0, s, s)
    h.fillStyle = '#383838'
    h.fillRect(0, 0, s, s)
    r.fillStyle = '#e0e0e0'
    r.fillRect(0, 0, s, s)

    const cellW = s / cols
    const cellH = s / rows
    const gap = 5
    const baseCol = new THREE.Color(baseHex)
    const altCol = new THREE.Color(altHex)
    const tmp = new THREE.Color()

    for (let row = 0; row < rows; row++) {
      const stagger = (row % 2) * (cellW * 0.5)
      for (let col = -1; col <= cols; col++) {
        const x = col * cellW + stagger
        const y = row * cellH
        const mix = rand()
        tmp.copy(baseCol).lerp(altCol, mix)
        const lumJitter = (rand() - 0.5) * 0.06
        tmp.offsetHSL(0, 0, lumJitter)
        d.fillStyle = `#${tmp.getHexString()}`
        d.fillRect(x + gap, y + gap, cellW - gap * 2, cellH - gap * 2)

        // Beveled raised stone face in heightmap
        h.fillStyle = '#b4b4b4'
        h.fillRect(x + gap + 2, y + gap + 2, cellW - gap * 2 - 4, cellH - gap * 2 - 4)
        h.strokeStyle = '#787878'
        h.lineWidth = 3
        h.strokeRect(x + gap + 1, y + gap + 1, cellW - gap * 2 - 2, cellH - gap * 2 - 2)

        // Polished center, slightly rougher near edges
        const rv = Math.round(168 + rand() * 44)
        r.fillStyle = `rgb(${rv},${rv},${rv})`
        r.fillRect(x + gap, y + gap, cellW - gap * 2, cellH - gap * 2)
      }
    }

    // Granite mineral speckles (quartz, feldspar, mica)
    for (let i = 0; i < 4200; i++) {
      const px = rand() * s
      const py = rand() * s
      const sz = 1 + rand() * 2.2
      const bright = rand() > 0.48
      d.fillStyle = bright ? 'rgba(255,250,240,0.14)' : 'rgba(28,24,20,0.16)'
      d.fillRect(px, py, sz, sz)
      const hv = bright ? 195 : 135
      h.fillStyle = `rgba(${hv},${hv},${hv},0.22)`
      h.fillRect(px, py, sz, sz)
    }
  }

  return finalizeBundle(dc, hc, rc, 2.2)
}

/** 2. 朱紅漆木柱／深色木構 PBR 貼圖（細膩縱向木紋、溫潤生漆緞面光澤） */
function createLacqueredWoodBundle(baseHex: string, grainHex: string, seed: number): TextureBundle {
  const s = 512
  const { canvas: dc, ctx: d } = makeCanvas(s, s)
  const { canvas: hc, ctx: h } = makeCanvas(s, s)
  const { canvas: rc, ctx: r } = makeCanvas(s, s)
  const rand = mulberry32(seed)

  if (d && h && r) {
    d.fillStyle = baseHex
    d.fillRect(0, 0, s, s)
    h.fillStyle = '#808080'
    h.fillRect(0, 0, s, s)
    r.fillStyle = '#626262'
    r.fillRect(0, 0, s, s)

    // Vertical wood fiber streaks
    for (let x = 0; x < s; x += 2) {
      const alpha = 0.04 + rand() * 0.12
      d.fillStyle = grainHex
      d.globalAlpha = alpha
      d.fillRect(x, 0, 1 + rand() * 2.5, s)

      const hv = Math.round(115 + rand() * 26)
      h.fillStyle = `rgb(${hv},${hv},${hv})`
      h.fillRect(x, 0, 2, s)

      const rv = Math.round(78 + rand() * 34)
      r.fillStyle = `rgb(${rv},${rv},${rv})`
      r.fillRect(x, 0, 2, s)
    }
    d.globalAlpha = 1

    // Subtle lacquer horizontal banding & hand-rubbed sheen variation
    for (let i = 0; i < 18; i++) {
      const y = rand() * s
      const bandH = 12 + rand() * 32
      d.fillStyle = rand() > 0.5 ? 'rgba(255,210,180,0.035)' : 'rgba(20,6,4,0.05)'
      d.fillRect(0, y, s, bandH)
      r.fillStyle = rand() > 0.5 ? 'rgba(60,60,60,0.22)' : 'rgba(130,130,130,0.22)'
      r.fillRect(0, y, s, bandH)
    }
  }

  return finalizeBundle(dc, hc, rc, 1.35)
}

/** 3. 琉璃筒瓦／板瓦屋面 PBR 貼圖（立體圓筒瓦隴、橫向疊瓦陰影與釉面高光） */
function createGlazedRoofTileBundle(seed = 303): TextureBundle {
  const s = 512
  const { canvas: dc, ctx: d } = makeCanvas(s, s)
  const { canvas: hc, ctx: h } = makeCanvas(s, s)
  const { canvas: rc, ctx: r } = makeCanvas(s, s)
  const rand = mulberry32(seed)

  if (d && h && r) {
    const fluteCount = 16
    const fluteW = s / fluteCount
    const courseCount = 8
    const courseH = s / courseCount

    for (let c = 0; c < fluteCount; c++) {
      const x0 = c * fluteW
      // Cylindrical barrel-tile shading across each flute (琉璃筒瓦圓弧明暗)
      const dg = d.createLinearGradient(x0, 0, x0 + fluteW, 0)
      dg.addColorStop(0.0, '#1e2c27')
      dg.addColorStop(0.22, '#344c43')
      dg.addColorStop(0.5, '#48685c')
      dg.addColorStop(0.78, '#324840')
      dg.addColorStop(1.0, '#1b2723')
      d.fillStyle = dg
      d.fillRect(x0, 0, fluteW + 0.5, s)

      const hg = h.createLinearGradient(x0, 0, x0 + fluteW, 0)
      hg.addColorStop(0.0, '#303030')
      hg.addColorStop(0.25, '#a8a8a8')
      hg.addColorStop(0.5, '#f2f2f2')
      hg.addColorStop(0.75, '#a8a8a8')
      hg.addColorStop(1.0, '#303030')
      h.fillStyle = hg
      h.fillRect(x0, 0, fluteW + 0.5, s)

      // Glaze is glossier on tile crests, slightly dustier in valleys
      const rg = r.createLinearGradient(x0, 0, x0 + fluteW, 0)
      rg.addColorStop(0.0, '#b8b8b8')
      rg.addColorStop(0.5, '#3c3c3c')
      rg.addColorStop(1.0, '#b8b8b8')
      r.fillStyle = rg
      r.fillRect(x0, 0, fluteW + 0.5, s)
    }

    // Horizontal overlapping tile courses (疊瓦橫縫)
    for (let row = 0; row < courseCount; row++) {
      const y = row * courseH
      const shadowGrad = d.createLinearGradient(0, y, 0, y + 10)
      shadowGrad.addColorStop(0, 'rgba(8,14,12,0.58)')
      shadowGrad.addColorStop(1, 'rgba(8,14,12,0)')
      d.fillStyle = shadowGrad
      d.fillRect(0, y, s, 10)

      h.fillStyle = '#282828'
      h.fillRect(0, y, s, 4)

      // Subtle warm glaze highlight just above overlap
      d.fillStyle = 'rgba(180, 224, 200, 0.12)'
      d.fillRect(0, y + courseH - 5, s, 3)

      // Per-tile slight glaze hue variation
      for (let c = 0; c < fluteCount; c++) {
        if (rand() > 0.55) {
          d.fillStyle = rand() > 0.5 ? 'rgba(95,140,120,0.08)' : 'rgba(15,24,20,0.09)'
          d.fillRect(c * fluteW, y, fluteW, courseH)
        }
      }
    }
  }

  return finalizeBundle(dc, hc, rc, 3.0)
}

/** 4. 古銅與鎏金金屬 PBR 貼圖（鍛打錘紋、歲月包漿與金屬拉絲光澤） */
function createMetallicBundle(
  baseHex: string,
  patinaHex: string,
  seed: number,
  isGold: boolean,
): TextureBundle {
  const s = 512
  const { canvas: dc, ctx: d } = makeCanvas(s, s)
  const { canvas: hc, ctx: h } = makeCanvas(s, s)
  const { canvas: rc, ctx: r } = makeCanvas(s, s)
  const rand = mulberry32(seed)

  if (d && h && r) {
    d.fillStyle = baseHex
    d.fillRect(0, 0, s, s)
    h.fillStyle = '#808080'
    h.fillRect(0, 0, s, s)
    r.fillStyle = isGold ? '#484848' : '#686868'
    r.fillRect(0, 0, s, s)

    // Hammered / cast metallic micro-facets
    const count = isGold ? 900 : 1600
    for (let i = 0; i < count; i++) {
      const px = rand() * s
      const py = rand() * s
      const rad = (isGold ? 3 : 4) + rand() * 10
      d.fillStyle = rand() > 0.45 ? patinaHex : 'rgba(255,235,180,0.09)'
      d.globalAlpha = isGold ? 0.08 : 0.14
      d.beginPath()
      d.arc(px, py, rad, 0, Math.PI * 2)
      d.fill()

      const hv = Math.round(112 + rand() * 34)
      h.fillStyle = `rgba(${hv},${hv},${hv},0.35)`
      h.beginPath()
      h.arc(px, py, rad, 0, Math.PI * 2)
      h.fill()

      const rv = Math.round((isGold ? 54 : 84) + rand() * 56)
      r.fillStyle = `rgba(${rv},${rv},${rv},0.32)`
      r.beginPath()
      r.arc(px, py, rad, 0, Math.PI * 2)
      r.fill()
    }
    d.globalAlpha = 1

    // Subtle embossed decorative band lines for bronze/gold temple craft
    if (!isGold) {
      d.strokeStyle = 'rgba(210, 175, 110, 0.16)'
      d.lineWidth = 2
      for (let y = 32; y < s; y += 64) {
        d.beginPath()
        d.moveTo(0, y)
        d.lineTo(s, y)
        d.stroke()
      }
    }
  }

  return finalizeBundle(dc, hc, rc, isGold ? 1.2 : 2.0)
}

/**
 * 程序化東方宮廟天空 IBL 環境貼圖（透過 PMREMGenerator 產生真實金屬與漆面反射）。
 * 無需外部 HDR 檔案，支援即時切換晨／晝／昏／夜且透過 scene.environmentIntensity 控制強度避免過曝。
 */
export function createTempleIblTexture(renderer?: THREE.WebGLRenderer): THREE.Texture | null {
  const w = 512
  const h = 256
  const { canvas, ctx } = makeCanvas(w, h)
  if (!ctx) return null

  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0.0, '#4c769a')
  sky.addColorStop(0.32, '#8cb4cf')
  sky.addColorStop(0.48, '#f0dfc4')
  sky.addColorStop(0.52, '#c9ab82')
  sky.addColorStop(0.72, '#5e4e3e')
  sky.addColorStop(1.0, '#2a221c')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)

  // Soft warm solar highlight lobe for crisp specular glints on glazed tiles & bronze
  const sunGlow = ctx.createRadialGradient(w * 0.28, h * 0.3, 6, w * 0.28, h * 0.3, 72)
  sunGlow.addColorStop(0, 'rgba(255, 248, 224, 0.92)')
  sunGlow.addColorStop(0.4, 'rgba(255, 226, 170, 0.38)')
  sunGlow.addColorStop(1, 'rgba(255, 220, 160, 0)')
  ctx.fillStyle = sunGlow
  ctx.fillRect(0, 0, w, h)

  // Warm temple lantern ambient bounce along horizon
  const bounce = ctx.createRadialGradient(w * 0.72, h * 0.52, 8, w * 0.72, h * 0.52, 90)
  bounce.addColorStop(0, 'rgba(255, 198, 128, 0.42)')
  bounce.addColorStop(1, 'rgba(255, 180, 110, 0)')
  ctx.fillStyle = bounce
  ctx.fillRect(0, 0, w, h)

  const equirect = new THREE.CanvasTexture(canvas)
  equirect.mapping = THREE.EquirectangularReflectionMapping
  equirect.colorSpace = THREE.SRGBColorSpace

  if (renderer && typeof THREE.PMREMGenerator === 'function') {
    try {
      const pmrem = new THREE.PMREMGenerator(renderer)
      pmrem.compileEquirectangularShader()
      const envRT = pmrem.fromEquirectangular(equirect)
      equirect.dispose()
      pmrem.dispose()
      return envRT.texture
    } catch {
      return equirect
    }
  }
  return equirect
}

/**
 * 東方宮廟共用 PBR 材質庫：
 * - 以單例快取共享基礎貼圖，依 UV repeat 需求建立輕量 clone，避免貼圖過度拉伸與記憶體重複。
 * - 支援 low / medium / high 三階畫質動態降級（low 關閉法線與粗糙度貼圖以兼顧手機效能）。
 */
export class TemplePbrLibrary {
  private readonly bundles = new Map<TemplePbrKind, TextureBundle>()
  private readonly materials = new Map<string, ManagedMaterial>()
  private quality: Quality = 'high'

  private getBundle(kind: TemplePbrKind): TextureBundle {
    let b = this.bundles.get(kind)
    if (b) return b
    switch (kind) {
      case 'courtyardStone':
        b = createGraniteBundle('#938879', '#7f7567', '#564e44', 101, 4, 4)
        break
      case 'imperialRoad':
        b = createGraniteBundle('#7e5b49', '#6e4e3e', '#4c352a', 102, 2, 4)
        break
      case 'plinthStone':
        b = createGraniteBundle('#b4aa9a', '#9f9484', '#6f665a', 103, 4, 4)
        break
      case 'vermilionWood':
        b = createLacqueredWoodBundle('#9c3b2d', '#5c1d15', 201)
        break
      case 'darkTimber':
        b = createLacqueredWoodBundle('#3d291f', '#1f130d', 202)
        break
      case 'glazedRoofTile':
        b = createGlazedRoofTileBundle(303)
        break
      case 'agedBronze':
        b = createMetallicBundle('#6e5335', '#3d4a3c', 401, false)
        break
      case 'gildedGold':
        b = createMetallicBundle('#d2a447', '#9c6e20', 402, true)
        break
    }
    this.bundles.set(kind, b)
    return b
  }

  /**
   * 取得快取的 PBR 材質（支援依幾何尺寸指定 UV repeatX / repeatY 以維持正確真實比例）。
   */
  get(kind: TemplePbrKind, repeatX = 1, repeatY = 1): THREE.MeshStandardMaterial {
    const rx = Math.max(1, Math.round(repeatX * 10) / 10)
    const ry = Math.max(1, Math.round(repeatY * 10) / 10)
    const key = `${kind}:${rx}x${ry}`
    const existing = this.materials.get(key)
    if (existing) return existing.material

    const base = this.getBundle(kind)
    const cloneWithRepeat = (src: THREE.CanvasTexture): THREE.CanvasTexture => {
      if (rx === 1 && ry === 1) return src
      const t = src.clone()
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.repeat.set(rx, ry)
      t.needsUpdate = true
      return t
    }

    const bundle: TextureBundle = {
      map: cloneWithRepeat(base.map),
      normalMap: cloneWithRepeat(base.normalMap),
      roughnessMap: cloneWithRepeat(base.roughnessMap),
    }

    const presets: Record<TemplePbrKind, { roughness: number; metalness: number; normalScale: number; env: number }> = {
      courtyardStone: { roughness: 0.84, metalness: 0.04, normalScale: 0.85, env: 0.65 },
      imperialRoad: { roughness: 0.78, metalness: 0.06, normalScale: 0.9, env: 0.7 },
      plinthStone: { roughness: 0.72, metalness: 0.05, normalScale: 0.75, env: 0.75 },
      vermilionWood: { roughness: 0.38, metalness: 0.08, normalScale: 0.6, env: 0.95 },
      darkTimber: { roughness: 0.52, metalness: 0.06, normalScale: 0.65, env: 0.8 },
      glazedRoofTile: { roughness: 0.28, metalness: 0.16, normalScale: 1.15, env: 1.2 },
      agedBronze: { roughness: 0.36, metalness: 0.76, normalScale: 0.85, env: 1.15 },
      gildedGold: { roughness: 0.26, metalness: 0.84, normalScale: 0.55, env: 1.2 },
    }
    const p = presets[kind]

    const material = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      map: bundle.map,
      normalMap: bundle.normalMap,
      normalScale: new THREE.Vector2(p.normalScale, p.normalScale),
      roughnessMap: bundle.roughnessMap,
      roughness: p.roughness,
      metalness: p.metalness,
      envMapIntensity: p.env,
    })

    const entry: ManagedMaterial = {
      material,
      bundle,
      baseNormalScale: p.normalScale,
      baseEnvIntensity: p.env,
    }
    this.materials.set(key, entry)
    this.applyQualityToEntry(entry, this.quality)
    return material
  }

  /** 依裝置畫質檔位（low / medium / high）調整法線貼圖、粗糙度貼圖與環境反射強度 */
  applyQuality(quality: Quality): void {
    this.quality = quality
    for (const entry of this.materials.values()) {
      this.applyQualityToEntry(entry, quality)
    }
  }

  private applyQualityToEntry(entry: ManagedMaterial, quality: Quality): void {
    const m = entry.material
    if (quality === 'low') {
      m.normalMap = null
      m.roughnessMap = null
      m.envMapIntensity = entry.baseEnvIntensity * 0.3
    } else if (quality === 'medium') {
      m.normalMap = entry.bundle.normalMap
      m.normalScale.setScalar(entry.baseNormalScale * 0.65)
      m.roughnessMap = entry.bundle.roughnessMap
      m.envMapIntensity = entry.baseEnvIntensity * 0.75
    } else {
      m.normalMap = entry.bundle.normalMap
      m.normalScale.setScalar(entry.baseNormalScale)
      m.roughnessMap = entry.bundle.roughnessMap
      m.envMapIntensity = entry.baseEnvIntensity
    }
    m.needsUpdate = true
  }

  dispose(): void {
    for (const entry of this.materials.values()) {
      entry.material.dispose()
      entry.bundle.map.dispose()
      entry.bundle.normalMap.dispose()
      entry.bundle.roughnessMap.dispose()
    }
    for (const b of this.bundles.values()) {
      b.map.dispose()
      b.normalMap.dispose()
      b.roughnessMap.dispose()
    }
    this.materials.clear()
    this.bundles.clear()
  }
}
