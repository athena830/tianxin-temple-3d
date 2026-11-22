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
