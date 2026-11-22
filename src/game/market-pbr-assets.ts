import * as THREE from 'three'
import { Reflector } from 'three/examples/jsm/objects/Reflector.js'

/**
 * 台灣雨夜霓虹 × 電影級寫實（Cinematic PBR）市集資產與著色器庫
 * 提供高解析度濕潤柏油路、石板路 PBR 貼圖、生鏽浪板鐵皮、做舊木質、
 * 立體 3D 霓虹燈管招牌、台式機車、變壓器電線桿、台式公寓街景與地面動態倒影探針。
 */

/* ========================================================
   1. PBR 程序化紋理生成器 (Procedural PBR Texture Generators)
   ======================================================== */

function makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  return { canvas, ctx }
}

/** 依灰階高度圖計算生成切線空間法線貼圖 (Bump to Normal Map) */
function generateNormalMapFromCanvas(
  heightCanvas: HTMLCanvasElement,
  strength = 2.2,
): THREE.CanvasTexture {
  const w = heightCanvas.width
  const h = heightCanvas.height
  const srcCtx = heightCanvas.getContext('2d')
  const { canvas: normCanvas, ctx: normCtx } = makeCanvas(w, h)

  if (!srcCtx || typeof srcCtx.getImageData !== 'function') {
    // 測試或 headless 無 getImageData 環境下提供平滑法線貼圖
    normCtx.fillStyle = '#8080ff'
    normCtx.fillRect(0, 0, w, h)
    const tex = new THREE.CanvasTexture(normCanvas)
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    return tex
  }

  try {
    const srcData = srcCtx.getImageData(0, 0, w, h).data
    const outImg = normCtx.createImageData(w, h)
    const outData = outImg.data

    const getH = (x: number, y: number): number => {
      const px = ((x + w) % w)
      const py = ((y + h) % h)
      const idx = (py * w + px) * 4
      return (srcData[idx] * 0.299 + srcData[idx + 1] * 0.587 + srcData[idx + 2] * 0.114) / 255
    }

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const left = getH(x - 1, y)
        const right = getH(x + 1, y)
        const top = getH(x, y - 1)
        const bottom = getH(x, y + 1)

        const dx = (left - right) * strength
        const dy = (top - bottom) * strength
        const dz = 1.0

        const len = Math.sqrt(dx * dx + dy * dy + dz * dz)
        const nx = (dx / len) * 0.5 + 0.5
        const ny = (dy / len) * 0.5 + 0.5
        const nz = (dz / len) * 0.5 + 0.5

        const outIdx = (y * w + x) * 4
        outData[outIdx] = Math.floor(nx * 255)
        outData[outIdx + 1] = Math.floor(ny * 255)
        outData[outIdx + 2] = Math.floor(nz * 255)
        outData[outIdx + 3] = 255
      }
    }
    normCtx.putImageData(outImg, 0, 0)
  } catch {
    normCtx.fillStyle = '#8080ff'
    normCtx.fillRect(0, 0, w, h)
  }

  const texture = new THREE.CanvasTexture(normCanvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  return texture
}

export interface PBRTextureSet {
  map: THREE.CanvasTexture
  normalMap: THREE.CanvasTexture
  roughnessMap: THREE.CanvasTexture
  metalnessMap?: THREE.CanvasTexture
}

/** 建立高解析度濕潤反光柏油路 PBR 貼圖套件（含碎石顆粒、水窪、磨損斑馬線與黃線） */
export function createAsphaltPBRTextures(): PBRTextureSet {
  const w = 1024
  const h = 512
  const { canvas: diffCanvas, ctx: diffCtx } = makeCanvas(w, h)
  const { canvas: heightCanvas, ctx: heightCtx } = makeCanvas(w, h)
  const { canvas: roughCanvas, ctx: roughCtx } = makeCanvas(w, h)

  // 1. 底色：深黑色微濕柏油基底
  diffCtx.fillStyle = '#14131d'
  diffCtx.fillRect(0, 0, w, h)

  heightCtx.fillStyle = '#808080'
  heightCtx.fillRect(0, 0, w, h)

  roughCtx.fillStyle = '#a0a0a0' // 乾瀝青粗糙度約 0.65~0.75
  roughCtx.fillRect(0, 0, w, h)

  // 2. 隨機柏油碎石顆粒雜訊
  for (let i = 0; i < 6000; i++) {
    const x = (i * 277) % w
    const y = (i * 419) % h
    const bright = (i % 5 === 0)
    diffCtx.fillStyle = bright ? 'rgba(180,180,210,0.06)' : 'rgba(5,4,10,0.22)'
    diffCtx.fillRect(x, y, 2, 2)

    heightCtx.fillStyle = bright ? '#a8a8a8' : '#585858'
    heightCtx.fillRect(x, y, 2, 2)
  }

  // 3. 濕潤水窪（Puddles）：表面平整、粗糙度極低（鏡面光滑）、法線平整
  const puddles = [
    { x: 220, y: 170, rx: 130, ry: 48 },
    { x: 440, y: 310, rx: 150, ry: 55 },
    { x: 710, y: 190, rx: 140, ry: 50 },
    { x: 880, y: 330, rx: 115, ry: 42 },
    { x: 310, y: 390, rx: 105, ry: 38 },
    { x: 580, y: 120, rx: 95, ry: 35 },
  ]

  for (const p of puddles) {
    // Diffuse：水窪處顏色更深、映帶微弱霓虹紫青色水膜
    const gDiff = diffCtx.createRadialGradient(p.x, p.y, 10, p.x, p.y, p.rx)
    gDiff.addColorStop(0, '#0c0a13')
    gDiff.addColorStop(0.7, '#110f18')
    gDiff.addColorStop(1, 'rgba(20,19,29,0)')
    diffCtx.fillStyle = gDiff
    diffCtx.beginPath()
    diffCtx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2)
    diffCtx.fill()

    // Height：水窪中心稍低平滑，邊緣有水痕微浮雕
    const gH = heightCtx.createRadialGradient(p.x, p.y, p.rx * 0.7, p.x, p.y, p.rx)
    gH.addColorStop(0, '#787878')
    gH.addColorStop(0.85, '#929292')
    gH.addColorStop(1, '#808080')
    heightCtx.fillStyle = gH
    heightCtx.beginPath()
    heightCtx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2)
    heightCtx.fill()

    // Roughness：水窪中心鏡面反光（粗糙度 ~0.08），周圍漸層
    const gR = roughCtx.createRadialGradient(p.x, p.y, p.rx * 0.5, p.x, p.y, p.rx)
    gR.addColorStop(0, '#121212')
    gR.addColorStop(0.75, '#282828')
    gR.addColorStop(1, '#a0a0a0')
    roughCtx.fillStyle = gR
    roughCtx.beginPath()
    roughCtx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2)
    roughCtx.fill()
  }

  // 4. 車道雙黃虛線（具斑駁磨損與胎痕）
  diffCtx.fillStyle = 'rgba(235, 195, 75, 0.65)'
  for (let x = 16; x < w; x += 96) {
    diffCtx.fillRect(x, 248, 56, 8)
    heightCtx.fillStyle = '#9c9c9c'
    heightCtx.fillRect(x, 248, 56, 8)
  }

  // 5. 台灣經典斑馬線（前後兩組，邊緣微磨損）
  diffCtx.fillStyle = 'rgba(235, 232, 245, 0.78)'
  for (const bx of [190, 745]) {
    for (let y = 42; y < 470; y += 52) {
      diffCtx.fillRect(bx, y, 92, 28)
      heightCtx.fillStyle = '#b0b0b0'
      heightCtx.fillRect(bx, y, 92, 28)
    }
  }

  const map = new THREE.CanvasTexture(diffCanvas)
  map.colorSpace = THREE.SRGBColorSpace
  const normalMap = generateNormalMapFromCanvas(heightCanvas, 2.8)
  const roughnessMap = new THREE.CanvasTexture(roughCanvas)

  return { map, normalMap, roughnessMap }
}

/** 建立人行道花崗岩石板地磚 PBR 貼圖套件（含倒角磚縫、深沉水痕與水溝蓋） */
export function createSidewalkPBRTextures(): PBRTextureSet {
  const s = 512
  const { canvas: diffCanvas, ctx: diffCtx } = makeCanvas(s, s)
  const { canvas: heightCanvas, ctx: heightCtx } = makeCanvas(s, s)
  const { canvas: roughCanvas, ctx: roughCtx } = makeCanvas(s, s)

  diffCtx.fillStyle = '#262433'
  diffCtx.fillRect(0, 0, s, s)

  heightCtx.fillStyle = '#808080'
  heightCtx.fillRect(0, 0, s, s)

  roughCtx.fillStyle = '#7a7a7a'
  roughCtx.fillRect(0, 0, s, s)

  const tileSize = 64
  const gap = 4

  for (let y = 0; y < s; y += tileSize) {
    for (let x = 0; x < s; x += tileSize) {
      const isAlt = ((x / tileSize) + (y / tileSize)) % 2 === 0
      diffCtx.fillStyle = isAlt ? '#2d2a3c' : '#282537'
      diffCtx.fillRect(x + gap, y + gap, tileSize - gap * 2, tileSize - gap * 2)

      // 石磚微凸起倒角
      heightCtx.fillStyle = '#a0a0a0'
      heightCtx.fillRect(x + gap, y + gap, tileSize - gap * 2, tileSize - gap * 2)

      // 磚縫凹陷
      heightCtx.strokeStyle = '#3a3a3a'
      heightCtx.lineWidth = gap
      heightCtx.strokeRect(x + gap / 2, y + gap / 2, tileSize - gap, tileSize - gap)

      roughCtx.fillStyle = isAlt ? '#6e6e6e' : '#787878'
      roughCtx.fillRect(x + gap, y + gap, tileSize - gap * 2, tileSize - gap * 2)
    }
  }

  const map = new THREE.CanvasTexture(diffCanvas)
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = THREE.RepeatWrapping
  map.wrapT = THREE.RepeatWrapping
  map.repeat.set(6, 2)

  const normalMap = generateNormalMapFromCanvas(heightCanvas, 3.2)
  normalMap.repeat.set(6, 2)

  const roughnessMap = new THREE.CanvasTexture(roughCanvas)
  roughnessMap.wrapS = THREE.RepeatWrapping
  roughnessMap.wrapT = THREE.RepeatWrapping
  roughnessMap.repeat.set(6, 2)

  return { map, normalMap, roughnessMap }
}

/** 建立台灣經典生鏽鐵皮浪板 PBR 材質 */
export function createCorrugatedRustMaterial(): THREE.MeshStandardMaterial {
  const { canvas, ctx } = makeCanvas(256, 256)
  const { canvas: normCanvas, ctx: normCtx } = makeCanvas(256, 256)

  // 鐵灰色與深鏽斑
  ctx.fillStyle = '#3a414e'
  ctx.fillRect(0, 0, 256, 256)

  normCtx.fillStyle = '#808080'
  normCtx.fillRect(0, 0, 256, 256)

  // 浪板波紋陰影與高光
  for (let x = 0; x < 256; x += 16) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.fillRect(x, 0, 6, 256)
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    ctx.fillRect(x + 7, 0, 5, 256)

    normCtx.fillStyle = '#505050'
    normCtx.fillRect(x, 0, 6, 256)
    normCtx.fillStyle = '#b0b0b0'
    normCtx.fillRect(x + 7, 0, 5, 256)
  }

  // 氧化鐵鏽紋理
  for (let i = 0; i < 1400; i++) {
    const rx = (i * 97) % 256
    const ry = (i * 139) % 256
    const isRust = (i % 3 === 0)
    ctx.fillStyle = isRust ? 'rgba(138, 62, 27, 0.45)' : 'rgba(82, 40, 20, 0.35)'
    ctx.fillRect(rx, ry, (i % 4) + 1, (i % 7) + 2)
  }

  const map = new THREE.CanvasTexture(canvas)
  map.wrapS = THREE.RepeatWrapping
  map.wrapT = THREE.RepeatWrapping
  const normalMap = generateNormalMapFromCanvas(normCanvas, 3.5)

  return new THREE.MeshStandardMaterial({
    map,
    normalMap,
    roughness: 0.68,
    metalness: 0.42,
    color: '#d0d5dd',
  })
}

/** 建立深沉做舊木質 PBR 材質 */
export function createWeatheredWoodMaterial(darker = false): THREE.MeshStandardMaterial {
  const { canvas, ctx } = makeCanvas(256, 256)
  const { canvas: normCanvas, ctx: normCtx } = makeCanvas(256, 256)

  ctx.fillStyle = darker ? '#2b1c15' : '#4d3326'
  ctx.fillRect(0, 0, 256, 256)
  normCtx.fillStyle = '#808080'
  normCtx.fillRect(0, 0, 256, 256)

  // 木紋肌理與年輪紋路
  for (let y = 0; y < 256; y += 4) {
    const alpha = ((y % 8 === 0) ? 0.22 : 0.08)
    ctx.fillStyle = `rgba(15, 8, 4, ${alpha})`
    ctx.fillRect(0, y, 256, 2)
    normCtx.fillStyle = alpha > 0.15 ? '#606060' : '#909090'
    normCtx.fillRect(0, y, 256, 2)
  }

  const map = new THREE.CanvasTexture(canvas)
  map.wrapS = THREE.RepeatWrapping
  map.wrapT = THREE.RepeatWrapping
  const normalMap = generateNormalMapFromCanvas(normCanvas, 2.2)

  return new THREE.MeshStandardMaterial({
    map,
    normalMap,
    roughness: 0.76,
    metalness: 0.08,
  })
}

/** 建立紅磚牆基座 PBR 材質 */
export function createRedBrickMaterial(): THREE.MeshStandardMaterial {
  const { canvas, ctx } = makeCanvas(256, 256)
  const { canvas: normCanvas, ctx: normCtx } = makeCanvas(256, 256)

  ctx.fillStyle = '#4a4846' // 水泥縫底色
  ctx.fillRect(0, 0, 256, 256)
  normCtx.fillStyle = '#404040'
  normCtx.fillRect(0, 0, 256, 256)

  const brickH = 24
  const brickW = 60
  const gap = 3

  for (let row = 0; row < 11; row++) {
    const y = row * brickH
    const xOffset = (row % 2 === 0) ? 0 : -brickW / 2
    for (let x = xOffset; x < 280; x += brickW) {
      const hueVar = (row * 7 + x) % 15
      ctx.fillStyle = `rgb(${155 + hueVar}, ${65 + hueVar * 0.5}, ${48 + hueVar * 0.3})`
      ctx.fillRect(x + gap, y + gap, brickW - gap * 2, brickH - gap * 2)

      normCtx.fillStyle = '#b8b8b8'
      normCtx.fillRect(x + gap, y + gap, brickW - gap * 2, brickH - gap * 2)
    }
  }

  const map = new THREE.CanvasTexture(canvas)
  map.wrapS = THREE.RepeatWrapping
  map.wrapT = THREE.RepeatWrapping
  const normalMap = generateNormalMapFromCanvas(normCanvas, 3.0)

  return new THREE.MeshStandardMaterial({
    map,
    normalMap,
    roughness: 0.82,
    metalness: 0.04,
  })
}

/* ========================================================
   2. 立體 3D 霓虹招牌模型 (Sculpted 3D Neon Signboxes)
   ======================================================== */

export interface NeonSignResult {
  group: THREE.Group
  faceMaterial: THREE.MeshStandardMaterial
  neonTubeMaterials: THREE.MeshStandardMaterial[]
  pointLight?: THREE.PointLight
}

/** 建立具備實體厚度金屬燈箱、壓克力面板與實體 3D 凸起霓虹燈管的立體招牌模型 */
export function create3DNeonSign(
  _zh: string,
  _en: string,
  width: number,
  height: number,
  accentColor: string,
  secondaryColor: string,
  faceTexture: THREE.Texture,
  faceEmissiveIntensity = 0.44,
): NeonSignResult {
  const group = new THREE.Group()
  const depth = 0.28

  // 1. 金屬深烤漆外框（帶真實厚度與斜切導角邊框）
  const frameMat = new THREE.MeshStandardMaterial({
    color: '#1a1924',
    roughness: 0.32,
    metalness: 0.85,
  })
  const frameBox = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), frameMat)
  frameBox.castShadow = true
  group.add(frameBox)

  // 2. 壓克力漫射發光面板（正面微凹鑲嵌，適度自發光確保文字清晰不曝色）
  const faceMat = new THREE.MeshStandardMaterial({
    map: faceTexture,
    emissiveMap: faceTexture,
    emissive: new THREE.Color('#ffffff'),
    emissiveIntensity: faceEmissiveIntensity,
    roughness: 0.25,
    metalness: 0.05,
  })
  const faceMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width - 0.12, height - 0.12),
    faceMat,
  )
  faceMesh.position.set(0, 0, depth / 2 + 0.005)
  group.add(faceMesh)

  // 3. 實體 3D 凸出立體霓虹燈管 (Physical 3D Neon Glass Tubing) - 降低至自然發光強度避免泛白過曝
  const tubeMatAccent = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: new THREE.Color(accentColor),
    emissiveIntensity: 1.15,
    roughness: 0.18,
    metalness: 0.1,
  })
  const tubeMatSecondary = new THREE.MeshStandardMaterial({
    color: secondaryColor,
    emissive: new THREE.Color(secondaryColor),
    emissiveIntensity: 0.95,
    roughness: 0.18,
    metalness: 0.1,
  })

  const tubeZ = depth / 2 + 0.04
  const tubeRadius = 0.024
  const tubeMats: THREE.MeshStandardMaterial[] = [tubeMatAccent, tubeMatSecondary]

  // 外圍雙環實體霓虹外邊框（突出於招牌面板前方）
  const borderW = width - 0.28
  const borderH = height - 0.28
  const halfW = borderW / 2
  const halfH = borderH / 2

  const borderPath = new THREE.CurvePath<THREE.Vector3>()
  borderPath.add(new THREE.LineCurve3(new THREE.Vector3(-halfW, -halfH, tubeZ), new THREE.Vector3(halfW, -halfH, tubeZ)))
  borderPath.add(new THREE.LineCurve3(new THREE.Vector3(halfW, -halfH, tubeZ), new THREE.Vector3(halfW, halfH, tubeZ)))
  borderPath.add(new THREE.LineCurve3(new THREE.Vector3(halfW, halfH, tubeZ), new THREE.Vector3(-halfW, halfH, tubeZ)))
  borderPath.add(new THREE.LineCurve3(new THREE.Vector3(-halfW, halfH, tubeZ), new THREE.Vector3(-halfW, -halfH, tubeZ)))

  const borderGeo = new THREE.TubeGeometry(borderPath, 32, tubeRadius, 8, false)
  const borderMesh = new THREE.Mesh(borderGeo, tubeMatAccent)
  group.add(borderMesh)

  // 內圈點綴裝飾燈管（暖金/紫藍雙色立體線條）
  const inW = borderW - 0.18
  const inH = borderH - 0.18
  const inHalfW = inW / 2
  const inHalfH = inH / 2
  const inPath = new THREE.CurvePath<THREE.Vector3>()
  inPath.add(new THREE.LineCurve3(new THREE.Vector3(-inHalfW, -inHalfH, tubeZ + 0.01), new THREE.Vector3(inHalfW, -inHalfH, tubeZ + 0.01)))
  inPath.add(new THREE.LineCurve3(new THREE.Vector3(inHalfW, inHalfH, tubeZ + 0.01), new THREE.Vector3(-inHalfW, inHalfH, tubeZ + 0.01)))
  const inMesh = new THREE.Mesh(new THREE.TubeGeometry(inPath, 24, tubeRadius * 0.75, 6, false), tubeMatSecondary)
  group.add(inMesh)

  // 黑色電極接頭與固定金屬扣環（增加真實工藝質感）
  const bracketGeo = new THREE.BoxGeometry(0.04, 0.04, 0.04)
  const bracketMat = new THREE.MeshStandardMaterial({ color: '#09080c', roughness: 0.9 })
  for (const bx of [-halfW, halfW, 0]) {
    for (const by of [-halfH, halfH]) {
      const br = new THREE.Mesh(bracketGeo, bracketMat)
      br.position.set(bx, by, depth / 2 + 0.015)
      group.add(br)
    }
  }

  // 專屬局部微光點光源（提供招牌邊框自然微弱霓虹漫射，避免正面強光沖刷發光面板）
  const signLight = new THREE.PointLight(accentColor, 0.45, 3.8, 2.0)
  signLight.position.set(0, 0, depth / 2 + 0.5)
  group.add(signLight)
  group.add(signLight)

  return {
    group,
    faceMaterial: faceMat,
    neonTubeMaterials: tubeMats,
    pointLight: signLight,
  }
}

/* ========================================================
   3. 台灣街頭寫實 PBR 載具與雜物 (Taiwanese Street Props)
   ======================================================== */

/** 建立寫實台式 125cc 機車模型（含烤漆車殼、橡膠輪胎、後照鏡與金屬排氣管） */
export function createTaiwaneseScooter(colorHex = '#a72338'): THREE.Group {
  const scooter = new THREE.Group()

  const paintMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.22,
    metalness: 0.65,
  })
  const innerPlasticMat = new THREE.MeshStandardMaterial({
    color: '#1a1920',
    roughness: 0.78,
    metalness: 0.05,
  })
  const rubberMat = new THREE.MeshStandardMaterial({
    color: '#121115',
    roughness: 0.88,
    metalness: 0.02,
  })
  const chromeMat = new THREE.MeshStandardMaterial({
    color: '#e8edf2',
    roughness: 0.12,
    metalness: 0.95,
  })

  // 1. 車身主龍骨與腳踏板
  const footboard = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.08, 0.72), innerPlasticMat)
  footboard.position.set(0, 0.26, 0)
  footboard.castShadow = true
  scooter.add(footboard)

  // 2. 前斜板與車頭
  const frontShield = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.65, 0.35), paintMat)
  frontShield.position.set(0, 0.58, -0.42)
  frontShield.rotation.x = -0.22
  frontShield.castShadow = true
  scooter.add(frontShield)

  // 大燈（亮光發光材質）
  const headlight = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.14, 0.06),
    new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff6d4', emissiveIntensity: 2.2 }),
  )
  headlight.position.set(0, 0.68, -0.6)
  headlight.rotation.x = -0.22
  scooter.add(headlight)

  // 龍頭龍骨與握把
  const handlebar = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.64, 8), innerPlasticMat)
  handlebar.rotation.z = Math.PI / 2
  handlebar.position.set(0, 0.96, -0.4)
  scooter.add(handlebar)

  // 雙圓後照鏡
  for (const mx of [-0.28, 0.28]) {
    const mirrorStem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.18, 5), chromeMat)
    mirrorStem.position.set(mx, 1.05, -0.38)
    mirrorStem.rotation.z = mx > 0 ? -0.28 : 0.28
    const mirrorHead = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.02, 12), chromeMat)
    mirrorHead.rotation.x = Math.PI / 2
    mirrorHead.position.set(mx + (mx > 0 ? 0.04 : -0.04), 1.14, -0.36)
    scooter.add(mirrorStem, mirrorHead)
  }

  // 3. 坐墊與後車身
  const seat = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.12, 0.72),
    new THREE.MeshStandardMaterial({ color: '#16151a', roughness: 0.62 }),
  )
  seat.position.set(0, 0.68, 0.22)
  seat.castShadow = true
  scooter.add(seat)

  const rearBody = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.38, 0.68), paintMat)
  rearBody.position.set(0, 0.44, 0.24)
  rearBody.castShadow = true
  scooter.add(rearBody)

  // 尾燈與車牌
  const tailLight = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.08, 0.04),
    new THREE.MeshStandardMaterial({ color: '#ff2222', emissive: '#ff1111', emissiveIntensity: 1.8 }),
  )
  tailLight.position.set(0, 0.52, 0.6)
  const licensePlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.1, 0.02),
    new THREE.MeshStandardMaterial({ color: '#f5f7fa', roughness: 0.35 }),
  )
  licensePlate.position.set(0, 0.4, 0.62)
  scooter.add(tailLight, licensePlate)

  // 4. 前後輪胎與金屬輪圈
  for (const [wz, isFront] of [[-0.58, true], [0.52, false]] as const) {
    const wheelGroup = new THREE.Group()
    wheelGroup.position.set(0, 0.2, wz)

    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.055, 10, 20), rubberMat)
    tire.rotation.y = Math.PI / 2
    tire.castShadow = true

    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.08, 12), chromeMat)
    rim.rotation.z = Math.PI / 2

    wheelGroup.add(tire, rim)
    scooter.add(wheelGroup)

    if (isFront) {
      const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.45, 6), chromeMat)
      fork.position.set(0, 0.42, wz)
      scooter.add(fork)
    }
  }

  // 5. 排氣管與防燙蓋
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.54, 8), innerPlasticMat)
  exhaust.rotation.x = Math.PI / 2
  exhaust.position.set(0.24, 0.2, 0.45)
  const heatShield = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.42), chromeMat)
  heatShield.position.set(0.27, 0.22, 0.45)
  scooter.add(exhaust, heatShield)

  // 6. 側腳架（微傾斜停靠）
  const kickstand = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.26, 6), innerPlasticMat)
  kickstand.position.set(-0.2, 0.12, 0.05)
  kickstand.rotation.z = 0.35
  scooter.add(kickstand)

  scooter.rotation.z = -0.06 // 停車自然側傾

  return scooter
}

/** 建立多層橫擔、變壓器與繁複電線的寫實電線桿 */
export function createRealisticUtilityPole(): THREE.Group {
  const poleGroup = new THREE.Group()

  const concreteMat = new THREE.MeshStandardMaterial({
    color: '#423f4f',
    roughness: 0.88,
    metalness: 0.05,
  })
  const metalMat = new THREE.MeshStandardMaterial({
    color: '#282534',
    roughness: 0.45,
    metalness: 0.82,
  })
  const insulatorMat = new THREE.MeshStandardMaterial({
    color: '#edeae1',
    roughness: 0.15,
    metalness: 0.1,
  })

  // 主水泥桿（微錐形高聳桿身）
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 7.2, 12), concreteMat)
  pole.position.y = 3.6
  pole.castShadow = true
  poleGroup.add(pole)

  // 腳踏釘（防滑踩釘）
  const pegGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.22, 6)
  pegGeo.rotateZ(Math.PI / 2)
  for (let y = 1.2; y < 6.2; y += 0.48) {
    const peg = new THREE.Mesh(pegGeo, metalMat)
    const angle = (y * 5) % Math.PI
    peg.position.set(Math.cos(angle) * 0.14, y, Math.sin(angle) * 0.14)
    poleGroup.add(peg)
  }

  // 雙層橫擔（高壓與低壓角鐵）
  for (const [hy, w, insCount] of [[6.4, 1.45, 4], [5.5, 1.15, 3]] as const) {
    const crossBar = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, 0.08), metalMat)
    crossBar.position.set(0, hy, 0)
    poleGroup.add(crossBar)

    // 陶瓷絕緣礙子
    for (let i = 0; i < insCount; i++) {
      const ix = -w / 2 + 0.15 + (i / (insCount - 1)) * (w - 0.3)
      const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.14, 8), insulatorMat)
      ins.position.set(ix, hy + 0.1, 0)
      poleGroup.add(ins)
    }
  }

  // 桿上重型圓筒變壓器（Transformer Can）
  const trans = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.72, 14), metalMat)
  trans.position.set(0.28, 5.0, 0)
  trans.castShadow = true
  poleGroup.add(trans)

  return poleGroup
}

/** 建立重型橡膠加重底座與高反光條的寫實三角錐 */
export function createRealisticTrafficCone(): THREE.Group {
  const g = new THREE.Group()

  const rubberMat = new THREE.MeshStandardMaterial({
    color: '#0d0c12',
    roughness: 0.9,
    metalness: 0.02,
  })
  const coneMat = new THREE.MeshStandardMaterial({
    color: '#ff5000',
    roughness: 0.32,
    metalness: 0.05,
  })
  const reflectiveMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    emissive: '#fffae8',
    emissiveIntensity: 0.55,
    roughness: 0.12,
    metalness: 0.2,
  })

  // 重型八角／方型橡膠配重底座
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.06, 0.44), rubberMat)
  base.position.y = 0.03
  base.castShadow = true
  g.add(base)

  // 錐體
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.68, 14), coneMat)
  cone.position.y = 0.38
  cone.castShadow = true
  g.add(cone)

  // 雙道高反光警示白條
  for (const cy of [0.34, 0.48]) {
    const rAtY = 0.18 * (1 - (cy - 0.04) / 0.68)
    const band = new THREE.Mesh(new THREE.CylinderGeometry(rAtY * 0.92, rAtY * 1.05, 0.07, 14), reflectiveMat)
    band.position.y = cy
    g.add(band)
  }

  return g
}

/** 建立台灣街頭鋼製雙桶垃圾箱（資源回收 / 一般垃圾） */
export function createRealisticTrashBin(): THREE.Group {
  const g = new THREE.Group()

  const steelMat = new THREE.MeshStandardMaterial({
    color: '#2d333e',
    roughness: 0.48,
    metalness: 0.75,
  })
  const blueMat = new THREE.MeshStandardMaterial({ color: '#1565c0', roughness: 0.5 })
  const redMat = new THREE.MeshStandardMaterial({ color: '#c62828', roughness: 0.5 })

  // 外框鋼板架
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.95, 0.48), steelMat)
  frame.position.y = 0.48
  frame.castShadow = true
  g.add(frame)

  // 藍色與紅色分類投遞口
  const flapBlue = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.05), blueMat)
  flapBlue.position.set(-0.2, 0.62, 0.24)
  const flapRed = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.05), redMat)
  flapRed.position.set(0.2, 0.62, 0.24)
  g.add(flapBlue, flapRed)

  return g
}

/** 建立台灣經典塑膠飲料箱（台啤／黑松疊箱） */
export function createDrinkCratesStack(count = 3): THREE.Group {
  const g = new THREE.Group()
  const crateMat = new THREE.MeshStandardMaterial({
    color: '#d32f2f', // 經典台啤紅
    roughness: 0.42,
    metalness: 0.05,
  })

  for (let i = 0; i < count; i++) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.32, 0.38), crateMat)
    crate.position.set(
      (Math.random() - 0.5) * 0.04,
      i * 0.32 + 0.16,
      (Math.random() - 0.5) * 0.04,
    )
    crate.rotation.y = (Math.random() - 0.5) * 0.1
    crate.castShadow = true
    g.add(crate)
  }

  return g
}

/** 建立多層二丁掛外牆、防盜鐵窗花、分離式冷氣機與暖黃窗光的寫實台灣公寓街景大樓 */
export function createRealisticApartmentBlock(
  width = 11.5,
  height = 14.0,
  depth = 5.2,
): THREE.Group {
  const building = new THREE.Group()

  const wallMat = new THREE.MeshStandardMaterial({
    color: '#282535',
    roughness: 0.85,
    metalness: 0.08,
  })
  const ironMat = new THREE.MeshStandardMaterial({
    color: '#15141d',
    roughness: 0.38,
    metalness: 0.88,
  })
  const acMat = new THREE.MeshStandardMaterial({
    color: '#cfd8dc',
    roughness: 0.52,
    metalness: 0.4,
  })
  const windowGlowMat = new THREE.MeshStandardMaterial({
    color: '#ffebb0',
    emissive: '#ffb944',
    emissiveIntensity: 1.6,
    roughness: 0.18,
  })
  const windowDarkMat = new THREE.MeshStandardMaterial({
    color: '#121620',
    roughness: 0.12,
    metalness: 0.8,
  })

  // 主建築量體
  const mainMass = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), wallMat)
  mainMass.position.y = height / 2
  mainMass.castShadow = true
  mainMass.receiveShadow = true
  building.add(mainMass)

  // 樓層外凸雨遮與窗戶陣列
  const floors = 4
  const floorH = height / floors
  for (let f = 1; f < floors; f++) {
    const fy = f * floorH

    // 陽台 / 窗台下緣外推凸緣
    const ledge = new THREE.Mesh(new THREE.BoxGeometry(width + 0.3, 0.14, depth + 0.3), wallMat)
    ledge.position.y = fy
    building.add(ledge)

    // 左右兩大扇窗戶
    for (const wx of [-width * 0.28, width * 0.28]) {
      const isLit = (f + (wx > 0 ? 1 : 0)) % 2 === 0
      const win = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.25, 0.08), isLit ? windowGlowMat : windowDarkMat)
      win.position.set(wx, fy + 0.85, depth / 2 + 0.02)
      building.add(win)

      // 經典台灣不鏽鋼 / 鍛鐵防盜鐵窗花 (Open Burglar Bars，透出溫暖室內窗光)
      const cageGroup = new THREE.Group()
      cageGroup.position.set(wx, fy + 0.85, depth / 2 + 0.14)
      const topBar = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.06, 0.24), ironMat)
      topBar.position.y = 0.66
      const botBar = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.06, 0.24), ironMat)
      botBar.position.y = -0.66
      const midBar = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.04, 0.04), ironMat)
      midBar.position.z = 0.1
      cageGroup.add(topBar, botBar, midBar)
      for (let b = -3; b <= 3; b++) {
        const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.035, 1.32, 0.035), ironMat)
        vBar.position.set(b * 0.26, 0, 0.1)
        cageGroup.add(vBar)
      }
      building.add(cageGroup)

      // 冷氣室外機（掛於窗台邊緣）
      if (isLit) {
        const ac = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.52, 0.36), acMat)
        ac.position.set(wx + 1.2, fy + 0.55, depth / 2 + 0.22)
        building.add(ac)
      }
    }
  }

  // 頂樓不鏽鋼白鐵水塔（Stainless Steel Water Tank）
  const tank = new THREE.Mesh(
    new THREE.CylinderGeometry(0.75, 0.75, 1.45, 14),
    new THREE.MeshStandardMaterial({ color: '#eef2f5', roughness: 0.15, metalness: 0.92 }),
  )
  tank.position.set(width * 0.25, height + 0.95, 0)
  building.add(tank)

  return building
}

/* ========================================================
   4. 現代化雨夜反射探針與即時地面鏡面系統 (Ground Reflector)
   ======================================================== */

/** 建立雨夜柏油路即時螢幕反射探針平面 (Planar Reflector，支援 uOpacity 透明混合透出底層 PBR 濕潤柏油與斑馬線) */
export function createWetRoadReflector(
  width = 36,
  height = 9.2,
  options?: { opacity?: number; color?: number },
): Reflector {
  const geo = new THREE.PlaneGeometry(width, height)
  const initialOpacity = options?.opacity ?? 0.38
  const customShader = {
    name: 'WetRoadReflectorShader',
    uniforms: {
      color: { value: null },
      tDiffuse: { value: null },
      textureMatrix: { value: null },
      uOpacity: { value: initialOpacity },
    },
    vertexShader: /* glsl */`
      uniform mat4 textureMatrix;
      varying vec4 vUv;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main() {
        vUv = textureMatrix * vec4( position, 1.0 );
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        #include <logdepthbuf_vertex>
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 color;
      uniform sampler2D tDiffuse;
      uniform float uOpacity;
      varying vec4 vUv;

      #include <logdepthbuf_pars_fragment>

      float blendOverlay( float base, float blend ) {
        return( base < 0.5 ? ( 2.0 * base * blend ) : ( 1.0 - 2.0 * ( 1.0 - base ) * ( 1.0 - blend ) ) );
      }

      vec3 blendOverlay( vec3 base, vec3 blend ) {
        return vec3( blendOverlay( base.r, blend.r ), blendOverlay( base.g, blend.g ), blendOverlay( base.b, blend.b ) );
      }

      void main() {
        #include <logdepthbuf_fragment>
        vec4 base = texture2DProj( tDiffuse, vUv );
        gl_FragColor = vec4( blendOverlay( base.rgb, color ), uOpacity );
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  }

  const reflector = new Reflector(geo, {
    clipBias: 0.003,
    textureWidth: 1024,
    textureHeight: 512,
    color: options?.color ?? 0x62708a,
    shader: customShader,
  })
  reflector.rotation.x = -Math.PI / 2
  reflector.position.set(0, 0.009, 3.2) // 略高於柏油路面產生濕潤反光層

  const mat = reflector.material as THREE.ShaderMaterial
  if (mat) {
    mat.transparent = true
    mat.depthWrite = false
  }

  return reflector
}

/* ========================================================
   5. 電影級細雨粒子系統 (Cinematic Rain System)
   ======================================================== */

export interface CinematicRain {
  lines: THREE.LineSegments
  update: (dt: number) => void
  setVisible: (v: boolean) => void
}

/** 建立長雨絲、傾斜風偏與動態循環更新的電影級細雨系統 */
export function createCinematicRainSystem(count = 720, rangeX = 38, rangeZ = 24): CinematicRain {
  const positions = new Float32Array(count * 6) // 每滴雨 2 個頂點 (x,y,z * 2)
  const velocities = new Float32Array(count)
  const lengths = new Float32Array(count)

  const topY = 16.0
  const botY = 0.02
  const windX = -0.45
  const windZ = 0.15

  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * rangeX
    const y = Math.random() * topY
    const z = (Math.random() - 0.5) * rangeZ
    const len = 0.55 + Math.random() * 0.45
    const vel = 22.0 + Math.random() * 12.0

    lengths[i] = len
    velocities[i] = vel

    const idx = i * 6
    positions[idx] = x
    positions[idx + 1] = y
    positions[idx + 2] = z

    positions[idx + 3] = x + windX * (len * 0.25)
    positions[idx + 4] = y - len
    positions[idx + 5] = z + windZ * (len * 0.25)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))

  const mat = new THREE.LineBasicMaterial({
    color: '#c2d4ea',
    transparent: true,
    opacity: 0.38,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })

  const lines = new THREE.LineSegments(geo, mat)

  const update = (dt: number): void => {
    const pos = geo.attributes.position.array as Float32Array
    for (let i = 0; i < count; i++) {
      const idx = i * 6
      const vel = velocities[i]
      const len = lengths[i]

      pos[idx + 1] -= vel * dt
      pos[idx + 4] = pos[idx + 1] - len

      pos[idx] += windX * vel * dt * 0.1
      pos[idx + 3] = pos[idx] + windX * (len * 0.25)

      pos[idx + 2] += windZ * vel * dt * 0.1
      pos[idx + 5] = pos[idx + 2] + windZ * (len * 0.25)

      if (pos[idx + 1] < botY) {
        pos[idx + 1] = topY + Math.random() * 2.0
        pos[idx + 4] = pos[idx + 1] - len
        pos[idx] = (Math.random() - 0.5) * rangeX
        pos[idx + 3] = pos[idx] + windX * (len * 0.25)
        pos[idx + 2] = (Math.random() - 0.5) * rangeZ
        pos[idx + 5] = pos[idx + 2] + windZ * (len * 0.25)
      }
    }
    geo.attributes.position.needsUpdate = true
  }

  const setVisible = (v: boolean): void => {
    lines.visible = v
  }

  return { lines, update, setVisible }
}

/* ========================================================
   6. 賽博龐克夜雨 HDRI / IBL 環境貼圖生成器
   ======================================================== */

/** 建立 360° 等距柱狀投影（Equirectangular）夜市霓虹 HDRI 環境反射貼圖 */
export function createHDREnvironmentTexture(): THREE.CanvasTexture {
  const w = 1024
  const h = 512
  const { canvas, ctx } = makeCanvas(w, h)

  // 1. 天頂至地平線夜空漸層（深藍紫到地平線微光）
  const skyGrad = ctx.createLinearGradient(0, 0, 0, h)
  skyGrad.addColorStop(0, '#090812')
  skyGrad.addColorStop(0.35, '#121020')
  skyGrad.addColorStop(0.48, '#241b34')
  skyGrad.addColorStop(0.50, '#362444') // 地平線光暈
  skyGrad.addColorStop(0.55, '#161424')
  skyGrad.addColorStop(1.0, '#0a0910') // 地面微光
  ctx.fillStyle = skyGrad
  ctx.fillRect(0, 0, w, h)

  // 2. 地平線周圍的城市霓虹泛光光斑（品紅、青藍、暖金）
  const neonGradients = [
    { x: 120, y: 250, r: 160, col: 'rgba(242, 110, 232, 0.42)' },
    { x: 380, y: 245, r: 180, col: 'rgba(114, 242, 200, 0.38)' },
    { x: 620, y: 252, r: 170, col: 'rgba(255, 211, 110, 0.45)' },
    { x: 860, y: 248, r: 190, col: 'rgba(121, 198, 255, 0.40)' },
  ]
  for (const n of neonGradients) {
    const g = ctx.createRadialGradient(n.x, n.y, 10, n.x, n.y, n.r)
    g.addColorStop(0, n.col)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
    ctx.fill()
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.mapping = THREE.EquirectangularReflectionMapping
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/* ========================================================
   7. 方案三：玄學羅盤與漂浮塔羅 (Occult Compass & Floating Tarot Abyss)
   ======================================================== */

/**
 * 建立立體環形「方案三：玄學羅盤」外框、階梯環壁與內凹深淵底座。
 * 以 CylinderGeometry / TorusGeometry 組合出厚實的立體黑曜石與暖銅金羅盤外框，
 * 側壁與盤面皆具備暖金月相、星象、刻度與神聖幾何刻紋及微弱自發光，
 * 讓平視、斜視與俯視角度皆呈現飽滿立體體積感。
 */
export function createOccultCompassPlinth(radius = 20.4): THREE.Group {
  const group = new THREE.Group()

  // 1. 暖銅金金屬外環與黑曜石材質
  const obsidianMat = new THREE.MeshStandardMaterial({
    color: '#110e1d',
    roughness: 0.38,
    metalness: 0.62,
  })
  const bronzeGoldMat = new THREE.MeshStandardMaterial({
    color: '#c99746',
    emissive: new THREE.Color('#6b4714'),
    emissiveIntensity: 0.32,
    roughness: 0.3,
    metalness: 0.78,
  })
  const darkBronzeMat = new THREE.MeshStandardMaterial({
    color: '#4c3824',
    emissive: new THREE.Color('#2a1c0c'),
    emissiveIntensity: 0.22,
    roughness: 0.42,
    metalness: 0.7,
  })

  // 2. 羅盤立體側壁 360° 暖金刻紋環帶貼圖（平視視角最直接可見的立體環壁，粗線高對比避免暗處死黑）
  const bw = 1024
  const bh = 256
  const { canvas: bandCanvas, ctx: bCtx } = makeCanvas(bw, bh)
  const bGrad = bCtx.createLinearGradient(0, 0, 0, bh)
  bGrad.addColorStop(0, '#241a2e')
  bGrad.addColorStop(0.2, '#130e20')
  bGrad.addColorStop(0.8, '#0f0b1a')
  bGrad.addColorStop(1, '#261b30')
  bCtx.fillStyle = bGrad
  bCtx.fillRect(0, 0, bw, bh)

  // 上下暖金雙線刻紋
  bCtx.strokeStyle = '#ffd984'
  bCtx.lineWidth = 8
  bCtx.beginPath()
  bCtx.moveTo(0, 22)
  bCtx.lineTo(bw, 22)
  bCtx.moveTo(0, bh - 22)
  bCtx.lineTo(bw, bh - 22)
  bCtx.stroke()

  bCtx.strokeStyle = '#d4a359'
  bCtx.lineWidth = 3.5
  bCtx.beginPath()
  bCtx.moveTo(0, 42)
  bCtx.lineTo(bw, 42)
  bCtx.moveTo(0, bh - 42)
  bCtx.lineTo(bw, bh - 42)
  bCtx.stroke()

  // 細密羅盤刻度與星象月相浮雕（每段皆含菱形幾何框、羅盤齒刻度與星象／月相符號）
  const bandZodiacs = ['♈', '♉', '♊', '♋', '♌', '♍']
  bCtx.textAlign = 'center'
  bCtx.textBaseline = 'middle'
  const segCount = 6
  const segW = bw / segCount
  for (let i = 0; i < segCount; i++) {
    const cx = (i + 0.5) * segW
    // 上下羅盤刻度齒
    bCtx.strokeStyle = '#f2c76e'
    bCtx.lineWidth = 3.5
    for (let k = -3; k <= 3; k++) {
      const tx = cx + k * (segW / 8)
      const hTick = k === 0 ? 28 : 16
      bCtx.beginPath()
      bCtx.moveTo(tx, 42)
      bCtx.lineTo(tx, 42 + hTick)
      bCtx.moveTo(tx, bh - 42)
      bCtx.lineTo(tx, bh - 42 - hTick)
      bCtx.stroke()
    }
    // 菱形神聖幾何框
    bCtx.strokeStyle = '#ffd984'
    bCtx.lineWidth = 4
    bCtx.beginPath()
    bCtx.moveTo(cx, 54)
    bCtx.lineTo(cx + 46, bh / 2)
    bCtx.lineTo(cx, bh - 54)
    bCtx.lineTo(cx - 46, bh / 2)
    bCtx.closePath()
    bCtx.stroke()

    if (i % 2 === 0) {
      // 黃道星象符號
      bCtx.fillStyle = '#fff0b8'
      bCtx.font = '700 62px "Segoe UI Symbol", "Apple Symbols", sans-serif'
      bCtx.fillText(bandZodiacs[i % bandZodiacs.length], cx, bh / 2 + 4)
    } else {
      // 古典月相符號
      const mr = 30
      bCtx.strokeStyle = '#fff0b8'
      bCtx.fillStyle = '#fff0b8'
      bCtx.lineWidth = 4.5
      bCtx.beginPath()
      bCtx.arc(cx, bh / 2, mr, 0, Math.PI * 2)
      bCtx.stroke()
      const phaseIdx = Math.floor(i / 2) % 3
      if (phaseIdx === 0) {
        bCtx.beginPath()
        bCtx.arc(cx, bh / 2, mr, -Math.PI / 2, Math.PI / 2, false)
        bCtx.fill()
      } else if (phaseIdx === 1) {
        bCtx.beginPath()
        bCtx.arc(cx, bh / 2, mr - 2, 0, Math.PI * 2)
        bCtx.fill()
      } else {
        bCtx.beginPath()
        bCtx.arc(cx, bh / 2, mr, Math.PI / 2, -Math.PI / 2, false)
        bCtx.fill()
      }
    }
  }

  const bandTex = new THREE.CanvasTexture(bandCanvas)
  bandTex.colorSpace = THREE.SRGBColorSpace
  bandTex.wrapS = THREE.RepeatWrapping
  bandTex.repeat.set(8, 1)
  bandTex.needsUpdate = true

  // 使用高可讀自發光材質，確保暗處側壁的暖金月相、星象與羅盤刻度清晰呈現而不變死黑
  const sideBandMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: bandTex,
    emissiveMap: bandTex,
    emissive: new THREE.Color('#ffe4a0'),
    emissiveIntensity: 0.95,
    roughness: 0.45,
    metalness: 0.12,
    side: THREE.DoubleSide,
  })

  // 上層立體羅盤外環壁（緊貼街道底緣 y = -0.07 至 -0.47，清楚呈現月相星象浮雕）
  const upperCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius + 0.25, 0.4, 64, 1, true),
    sideBandMat,
  )
  upperCollar.position.y = -0.27
  group.add(upperCollar)

  // 沿上層羅盤環壁外緣鑲嵌 32 枚立體暖金星象菱形浮雕飾片與刻度釘，強化平視立體感
  const studCount = 32
  for (let i = 0; i < studCount; i++) {
    const angle = (i / studCount) * Math.PI * 2
    const sx = Math.cos(angle) * (radius + 0.18)
    const sz = Math.sin(angle) * (radius + 0.18)
    const medallion = new THREE.Mesh(
      i % 2 === 0 ? new THREE.OctahedronGeometry(0.11, 0) : new THREE.CylinderGeometry(0.08, 0.08, 0.05, 8),
      bronzeGoldMat,
    )
    medallion.position.set(sx, -0.27, sz)
    if (i % 2 !== 0) {
      medallion.rotation.z = Math.PI / 2
      medallion.rotation.y = -angle
    } else {
      medallion.scale.set(0.6, 1.15, 0.6)
      medallion.rotation.y = -angle
    }
    group.add(medallion)
  }

  // 上中下三道立體金屬圓環（TorusGeometry 營造星盤厚重立體層次）
  const topTorus = new THREE.Mesh(new THREE.TorusGeometry(radius + 0.02, 0.08, 12, 72), bronzeGoldMat)
  topTorus.rotation.x = Math.PI / 2
  topTorus.position.y = -0.07
  group.add(topTorus)

  const midTorus = new THREE.Mesh(new THREE.TorusGeometry(radius + 0.28, 0.11, 12, 72), bronzeGoldMat)
  midTorus.rotation.x = Math.PI / 2
  midTorus.position.y = -0.48
  group.add(midTorus)

  const lowerRimTorus = new THREE.Mesh(new THREE.TorusGeometry(radius + 0.14, 0.16, 12, 72), bronzeGoldMat)
  lowerRimTorus.rotation.x = Math.PI / 2
  lowerRimTorus.position.y = -1.72
  group.add(lowerRimTorus)

  // 3. 環繞深淵的 16 根立體黑曜石與暖銅星盤肋柱（連接上環與下底，營造內凹深淵立體感）
  const ribCount = 16
  for (let i = 0; i < ribCount; i++) {
    const angle = (i / ribCount) * Math.PI * 2
    const rx = Math.cos(angle) * (radius + 0.18)
    const rz = Math.sin(angle) * (radius + 0.18)

    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.24, 0.42), darkBronzeMat)
    rib.position.set(rx, -1.1, rz)
    rib.rotation.y = -angle + Math.PI / 2
    group.add(rib)

    // 肋柱外側暖金鑲條
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 0.46), bronzeGoldMat)
    trim.position.set(rx, -1.1, rz)
    trim.rotation.y = -angle + Math.PI / 2
    group.add(trim)
  }

  // 4. 內凹深淵核心壁與厚實黑曜石基座（y = -1.72 至 -2.25）
  const innerAbyssWall = new THREE.Mesh(
    new THREE.CylinderGeometry(radius - 2.6, radius - 3.2, 1.28, 48, 1, true),
    new THREE.MeshStandardMaterial({
      color: '#0b0818',
      emissive: new THREE.Color('#2a1656'),
      emissiveIntensity: 0.42,
      roughness: 0.6,
      metalness: 0.3,
      side: THREE.DoubleSide,
    }),
  )
  innerAbyssWall.position.y = -1.12
  group.add(innerAbyssWall)

  const lowerPlinth = new THREE.Mesh(
    new THREE.CylinderGeometry(radius + 0.12, radius - 1.4, 0.52, 64),
    obsidianMat,
  )
  lowerPlinth.position.y = -1.98
  lowerPlinth.receiveShadow = true
  group.add(lowerPlinth)

  // 5. 羅盤水平盤面古典刻紋 Canvas 貼圖（斜視與俯視清楚可見）
  const s = 1024
  const { canvas, ctx } = makeCanvas(s, s)
  const center = s / 2

  const bgGrad = ctx.createRadialGradient(center, center, 40, center, center, center)
  bgGrad.addColorStop(0, '#1a1233')
  bgGrad.addColorStop(0.55, '#100c20')
  bgGrad.addColorStop(1.0, '#070610')
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, s, s)

  ctx.strokeStyle = '#e5b869'
  ctx.fillStyle = '#e5b869'
  ctx.lineWidth = 5
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const rings = [485, 445, 395, 320, 240, 150]
  for (const r of rings) {
    ctx.beginPath()
    ctx.arc(center, center, r, 0, Math.PI * 2)
    ctx.stroke()
  }

  for (let deg = 0; deg < 360; deg += 5) {
    const rad = (deg * Math.PI) / 180
    const isMajor = deg % 15 === 0
    const rIn = isMajor ? 445 : 465
    const rOut = 485
    ctx.lineWidth = isMajor ? 3.5 : 1.5
    ctx.beginPath()
    ctx.moveTo(center + Math.cos(rad) * rIn, center + Math.sin(rad) * rIn)
    ctx.lineTo(center + Math.cos(rad) * rOut, center + Math.sin(rad) * rOut)
    ctx.stroke()
  }

  const zodiacSymbols = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓']
  ctx.font = '700 28px "Segoe UI Symbol", "Apple Symbols", sans-serif'
  for (let i = 0; i < 12; i++) {
    const rad = (i * 30 * Math.PI) / 180 - Math.PI / 2
    const x = center + Math.cos(rad) * 420
    const y = center + Math.sin(rad) * 420
    ctx.fillText(zodiacSymbols[i], x, y)
  }

  for (let i = 0; i < 8; i++) {
    const rad = (i * 45 * Math.PI) / 180
    const mx = center + Math.cos(rad) * 358
    const my = center + Math.sin(rad) * 358
    const mr = 18
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(mx, my, mr, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    if (i === 4) {
      ctx.arc(mx, my, mr, 0, Math.PI * 2)
      ctx.fill()
    } else if (i !== 0) {
      ctx.arc(mx, my, mr, -Math.PI / 2, Math.PI / 2, false)
      ctx.fill()
    }
  }

  for (let k = 0; k < 2; k++) {
    const offset = (k * Math.PI) / 4
    ctx.lineWidth = 3
    ctx.beginPath()
    for (let p = 0; p < 4; p++) {
      const a = (p * Math.PI) / 2 + offset
      const px = center + Math.cos(a) * 240
      const py = center + Math.sin(a) * 240
      if (p === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.stroke()
  }

  for (let p = 0; p < 8; p++) {
    const a = (p * Math.PI) / 4 - Math.PI / 2
    const isCardinal = p % 2 === 0
    const len = isCardinal ? 140 : 92
    const w = isCardinal ? 16 : 10
    const perp = a + Math.PI / 2
    ctx.fillStyle = isCardinal ? '#f7d58b' : '#d4a359'
    ctx.beginPath()
    ctx.moveTo(center, center)
    ctx.lineTo(center + Math.cos(perp) * w, center + Math.sin(perp) * w)
    ctx.lineTo(center + Math.cos(a) * len, center + Math.sin(a) * len)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = isCardinal ? '#996e2b' : '#694819'
    ctx.beginPath()
    ctx.moveTo(center, center)
    ctx.lineTo(center - Math.cos(perp) * w, center - Math.sin(perp) * w)
    ctx.lineTo(center + Math.cos(a) * len, center + Math.sin(a) * len)
    ctx.closePath()
    ctx.fill()
  }

  const compassTex = new THREE.CanvasTexture(canvas)
  compassTex.colorSpace = THREE.SRGBColorSpace

  const faceMat = new THREE.MeshStandardMaterial({
    map: compassTex,
    emissiveMap: compassTex,
    emissive: new THREE.Color('#c48c32'),
    emissiveIntensity: 0.44,
    roughness: 0.35,
    metalness: 0.55,
  })
  const face = new THREE.Mesh(new THREE.CircleGeometry(radius - 0.04, 64), faceMat)
  face.rotation.x = -Math.PI / 2
  face.position.y = -1.81
  face.receiveShadow = true
  group.add(face)

  // 6. 深淵內部紫藍與暖金層次星雲光暈
  const makeNebulaGlow = (hex: string, alpha: number) => {
    const { canvas: gc, ctx: gx } = makeCanvas(256, 256)
    const gr = gx.createRadialGradient(128, 128, 12, 128, 128, 124)
    gr.addColorStop(0, hex)
    gr.addColorStop(0.5, `${hex}66`)
    gr.addColorStop(1, `${hex}00`)
    gx.fillStyle = gr
    gx.fillRect(0, 0, 256, 256)
    const gt = new THREE.CanvasTexture(gc)
    return new THREE.MeshBasicMaterial({
      map: gt,
      transparent: true,
      opacity: alpha,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  }

  const nebulaPurple = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 1.65, radius * 1.65),
    makeNebulaGlow('#6d28d9', 0.24),
  )
  nebulaPurple.rotation.x = -Math.PI / 2
  nebulaPurple.position.y = -1.78
  group.add(nebulaPurple)

  const nebulaGold = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 1.1, radius * 1.1),
    makeNebulaGlow('#d97706', 0.16),
  )
  nebulaGold.rotation.x = -Math.PI / 2
  nebulaGold.position.y = -1.76
  group.add(nebulaGold)

  return group
}

export type TarotCardInfo = {
  mesh: THREE.Mesh
  baseY: number
  baseRotX: number
  baseRotY: number
  baseRotZ: number
  speed: number
  phase: number
  amp: number
}

/** 建立放大版漂浮發光塔羅牌物件（Canvas 繪製精緻古典金色邊框、神秘學象徵符號與牌名） */
export function createFloatingTarotCard(
  titleZh: string,
  titleEn: string,
  romanNum: string,
  symbolType: 'star' | 'moon' | 'sun' | 'magician' | 'fortune',
): THREE.Mesh {
  const w = 256
  const h = 420
  const { canvas, ctx } = makeCanvas(w, h)

  // 牌面底色（深邃午夜星夜深藍紫）
  const grad = ctx.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, '#0e112b')
  grad.addColorStop(0.5, '#1c163a')
  grad.addColorStop(1, '#0b091c')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)

  // 雙重暖金法式雕花邊框
  ctx.strokeStyle = '#f2c76e'
  ctx.lineWidth = 6
  ctx.strokeRect(10, 10, w - 20, h - 20)
  ctx.strokeStyle = '#d4a359'
  ctx.lineWidth = 2
  ctx.strokeRect(18, 18, w - 36, h - 36)

  // 四角金色菱星裝飾
  ctx.fillStyle = '#ffd875'
  for (const [cx0, cy0] of [
    [28, 28],
    [w - 28, 28],
    [28, h - 28],
    [w - 28, h - 28],
  ]) {
    ctx.beginPath()
    ctx.arc(cx0, cy0, 4, 0, Math.PI * 2)
    ctx.fill()
  }

  // 羅馬數字
  ctx.fillStyle = '#fae09e'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '700 24px "Times New Roman", serif'
  ctx.fillText(romanNum, w / 2, 42)

  // 中央神祕象徵插畫
  const cx = w / 2
  const cy = h / 2 - 10
  ctx.strokeStyle = '#ffe082'
  ctx.fillStyle = '#ffe082'

  if (symbolType === 'star') {
    ctx.lineWidth = 3.5
    ctx.beginPath()
    for (let p = 0; p < 8; p++) {
      const a = (p * Math.PI) / 4 - Math.PI / 2
      const rOut = p % 2 === 0 ? 58 : 26
      const x = cx + Math.cos(a) * rOut
      const y = cy + Math.sin(a) * rOut
      if (p === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.stroke()
    ctx.fill()
  } else if (symbolType === 'moon') {
    ctx.beginPath()
    ctx.arc(cx - 8, cy, 48, -Math.PI * 0.42, Math.PI * 0.42, false)
    ctx.arc(cx + 8, cy, 38, Math.PI * 0.42, -Math.PI * 0.42, true)
    ctx.closePath()
    ctx.fill()
  } else if (symbolType === 'sun') {
    ctx.beginPath()
    ctx.arc(cx, cy, 30, 0, Math.PI * 2)
    ctx.fill()
    ctx.lineWidth = 3
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(a) * 37, cy + Math.sin(a) * 37)
      ctx.lineTo(cx + Math.cos(a) * 56, cy + Math.sin(a) * 56)
      ctx.stroke()
    }
  } else if (symbolType === 'magician') {
    ctx.font = '700 72px "Times New Roman", serif'
    ctx.fillText('∞', cx, cy - 8)
    ctx.fillRect(cx - 2.5, cy + 24, 5, 44)
  } else {
    ctx.lineWidth = 3.5
    ctx.beginPath()
    ctx.arc(cx, cy, 46, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(cx, cy, 22, 0, Math.PI * 2)
    ctx.stroke()
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(a) * 22, cy + Math.sin(a) * 22)
      ctx.lineTo(cx + Math.cos(a) * 46, cy + Math.sin(a) * 46)
      ctx.stroke()
    }
  }

  // 底部卡牌名稱
  ctx.font = '700 22px "Microsoft JhengHei", "Noto Sans TC", sans-serif'
  ctx.fillStyle = '#fff3d4'
  ctx.fillText(titleZh, cx, h - 56)
  ctx.font = '600 14px "Segoe UI", sans-serif'
  ctx.fillStyle = '#e5b869'
  ctx.fillText(titleEn, cx, h - 32)

  const map = new THREE.CanvasTexture(canvas)
  map.colorSpace = THREE.SRGBColorSpace

  const mat = new THREE.MeshStandardMaterial({
    map,
    emissiveMap: map,
    emissive: new THREE.Color('#ffda7a'),
    emissiveIntensity: 0.36,
    roughness: 0.28,
    metalness: 0.35,
    transparent: true,
    opacity: 0.94,
    side: THREE.DoubleSide,
  })

  // 完美契合深淵展廳高度（0.82m × 1.26m × 0.025m），讓整張牌面、金框與羅馬數字在平視與斜視皆完整清晰
  const card = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.26, 0.025), mat)
  return card
}

/** 建立放大版低面數紫水晶簇（含黑曜岩基座與 7 根晶瑩剔透六棱尖錐群） */
export function createAmethystCrystalCluster(): THREE.Group {
  const group = new THREE.Group()

  const baseRockMat = new THREE.MeshStandardMaterial({
    color: '#1b1528',
    roughness: 0.8,
    metalness: 0.15,
    flatShading: true,
  })
  const baseRock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 0), baseRockMat)
  baseRock.scale.set(1.25, 0.42, 1.15)
  baseRock.position.y = 0.12
  group.add(baseRock)

  const crystalMat = new THREE.MeshStandardMaterial({
    color: '#a364f0',
    emissive: '#6e28cc',
    emissiveIntensity: 0.55,
    roughness: 0.16,
    metalness: 0.22,
    transparent: true,
    opacity: 0.9,
    flatShading: true,
  })

  // 叢聚 7 根加大比例的六棱晶柱尖錐（主峰高約 1.18m）
  const configs = [
    { r: 0.23, h: 1.18, x: 0, z: 0, rx: 0.04, rz: -0.05 },
    { r: 0.18, h: 0.96, x: -0.26, z: 0.18, rx: -0.22, rz: -0.22 },
    { r: 0.19, h: 0.88, x: 0.28, z: -0.14, rx: 0.18, rz: 0.26 },
    { r: 0.15, h: 0.72, x: 0.22, z: 0.28, rx: -0.18, rz: 0.3 },
    { r: 0.14, h: 0.64, x: -0.28, z: -0.22, rx: 0.28, rz: -0.24 },
    { r: 0.12, h: 0.54, x: 0.04, z: 0.34, rx: -0.32, rz: 0.08 },
    { r: 0.11, h: 0.48, x: -0.34, z: 0.02, rx: 0.08, rz: -0.36 },
  ]

  for (const c of configs) {
    const geo = new THREE.CylinderGeometry(0, c.r, c.h, 6)
    const m = new THREE.Mesh(geo, crystalMat)
    m.position.set(c.x, c.h / 2 + 0.08, c.z)
    m.rotation.set(c.rx, Math.random() * Math.PI, c.rz)
    group.add(m)
  }

  // 紫晶柔和輝光點光源
  const light = new THREE.PointLight('#a855f7', 1.15, 5.2, 1.8)
  light.position.set(0, 0.75, 0)
  group.add(light)

  return group
}

export type OccultCandleInfo = {
  group: THREE.Group
  light: THREE.PointLight
  phase: number
}

/** 建立放大版暖黃發光儀式蠟燭組（高低錯落三支蠟燭 + 柔和燭光光暈） */
export function createOccultCandle(): OccultCandleInfo {
  const group = new THREE.Group()

  const waxMat = new THREE.MeshStandardMaterial({
    color: '#f8f0dc',
    emissive: new THREE.Color('#7a511e'),
    emissiveIntensity: 0.22,
    roughness: 0.6,
    metalness: 0.05,
  })
  const wickMat = new THREE.MeshBasicMaterial({ color: '#2a1a0f' })
  const flameMat = new THREE.MeshBasicMaterial({ color: '#ffcf5c' })

  // 柔和燭光光暈貼圖
  const { canvas: hc, ctx: hx } = makeCanvas(64, 64)
  const hg = hx.createRadialGradient(32, 32, 2, 32, 32, 30)
  hg.addColorStop(0, 'rgba(255, 224, 130, 0.95)')
  hg.addColorStop(0.4, 'rgba(255, 168, 52, 0.42)')
  hg.addColorStop(1, 'rgba(255, 140, 20, 0)')
  hx.fillStyle = hg
  hx.fillRect(0, 0, 64, 64)
  const haloTex = new THREE.CanvasTexture(hc)
  const haloMat = new THREE.SpriteMaterial({
    map: haloTex,
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })

  // 三支高低錯落的儀式柱狀蠟燭
  const pillars = [
    { x: 0, z: 0, r: 0.12, h: 0.58 },
    { x: -0.22, z: 0.14, r: 0.1, h: 0.42 },
    { x: 0.2, z: 0.12, r: 0.095, h: 0.34 },
  ]

  for (const p of pillars) {
    const wax = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r * 1.08, p.h, 8), waxMat)
    wax.position.set(p.x, p.h / 2, p.z)
    group.add(wax)

    const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.07, 4), wickMat)
    wick.position.set(p.x, p.h + 0.03, p.z)
    group.add(wick)

    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.048, 0.14, 6), flameMat)
    flame.position.set(p.x, p.h + 0.11, p.z)
    group.add(flame)

    const halo = new THREE.Sprite(haloMat)
    halo.position.set(p.x, p.h + 0.12, p.z)
    halo.scale.set(0.45, 0.45, 1)
    group.add(halo)
  }

  // 暖黃儀式燭光點光源
  const light = new THREE.PointLight('#ffaa38', 0.95, 4.2, 1.8)
  light.position.set(0, 0.72, 0.08)
  group.add(light)

  return {
    group,
    light,
    phase: Math.random() * Math.PI * 2,
  }
}

/** 建立深淵微弱發光星點粒子（紫藍與暖金交織，分佈於 y = -0.65 至 -7.0 空間） */
export function createAbyssStarfield(count = 520): THREE.Points {
  const geo = new THREE.BufferGeometry()
  const pos = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const cBlue = new THREE.Color('#9db8ff')
  const cPurple = new THREE.Color('#c49eff')
  const cGold = new THREE.Color('#ffd88a')

  for (let i = 0; i < count; i++) {
    pos[i * 3 + 0] = (Math.random() - 0.5) * 44
    pos[i * 3 + 1] = -0.65 - Math.random() * 6.35 // y: -0.65 ~ -7.0
    pos[i * 3 + 2] = (Math.random() - 0.5) * 34 + 2.0

    const pick = Math.random()
    const col = pick < 0.45 ? cBlue : pick < 0.78 ? cPurple : cGold
    colors[i * 3 + 0] = col.r
    colors[i * 3 + 1] = col.g
    colors[i * 3 + 2] = col.b
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))

  const { canvas, ctx } = makeCanvas(32, 32)
  const g = ctx.createRadialGradient(16, 16, 1, 16, 16, 15)
  g.addColorStop(0, '#ffffff')
  g.addColorStop(0.38, '#d4e0ff')
  g.addColorStop(1, 'rgba(120, 140, 220, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 32, 32)
  const tex = new THREE.CanvasTexture(canvas)

  const mat = new THREE.PointsMaterial({
    map: tex,
    size: 0.26,
    vertexColors: true,
    transparent: true,
    opacity: 0.78,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })

  const points = new THREE.Points(geo, mat)
  return points
}
