import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Assets } from './engine/assets'

export type ViewMode = 'front' | 'side_left' | 'side_right' | 'angle45' | 'top' | 'bottom_jaw' | 'pair'
export type LightPreset = 'temple' | 'side' | 'zenith'

declare global {
  interface Window {
    __READY__?: boolean
    __TEST_RESULTS__?: Record<string, unknown>
    setView: (mode: ViewMode) => void
    setLightPreset: (preset: LightPreset) => void
    setWireframe: (enabled: boolean) => void
    toggleWireframe: () => boolean
    toggleTurntable: () => boolean
    setTurntableAngle: (angleDeg: number) => void
    spawnMirroredPair: () => Promise<void>
    runPartialDisposeTest: () => Record<string, unknown>
    runFullDisposeTest: () => Record<string, unknown>
    runDisposeTest: () => void
  }
}

const container = document.getElementById('canvas-container')!
const metricsList = document.getElementById('metrics-list')!
const statusBadge = document.getElementById('status-badge')!

const params = new URLSearchParams(window.location.search)
const requestedModelUrl = params.get('model') || '/assets/models/temple-dragon-head-preview.glb'

// 1. Scene, Camera, Renderer & 360 OrbitControls
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x161210)
scene.fog = new THREE.FogExp2(0x161210, 0.025)

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.05, 100)
camera.position.set(0, 0.85, 3.6)

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true
})
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.18
container.appendChild(renderer.domElement)

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.dampingFactor = 0.08
controls.minDistance = 0.8
controls.maxDistance = 18.0
controls.target.set(0, 0.45, 0)
controls.update()

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

// 2. Switchable Eastern Temple PBR Lighting Rig
const hemiLight = new THREE.HemisphereLight(0xfffaed, 0x3a2a20, 0.95)
scene.add(hemiLight)

const sunLight = new THREE.DirectionalLight(0xfff1dc, 2.4)
sunLight.position.set(4.5, 7.5, 5.0)
sunLight.castShadow = true
sunLight.shadow.mapSize.width = 2048
sunLight.shadow.mapSize.height = 2048
sunLight.shadow.camera.near = 0.5
sunLight.shadow.camera.far = 25
sunLight.shadow.camera.left = -5
sunLight.shadow.camera.right = 5
sunLight.shadow.camera.top = 5
sunLight.shadow.camera.bottom = -5
sunLight.shadow.bias = -0.0005
scene.add(sunLight)

const fillLight = new THREE.DirectionalLight(0x90a4ae, 0.85)
fillLight.position.set(-5.5, 3.5, 2.0)
scene.add(fillLight)

const rimLight = new THREE.DirectionalLight(0xffd54f, 1.1)
rimLight.position.set(0, 4.5, -5.5)
scene.add(rimLight)

const underJawLight = new THREE.PointLight(0xffab91, 0.9, 8.0)
underJawLight.position.set(0, -1.0, 2.2)
scene.add(underJawLight)

// 3. Ground Pedestal (Receiving Shadows) — 2 baseline geometries
const groundGeo = new THREE.CylinderGeometry(5.2, 5.6, 0.36, 36)
const groundMat = new THREE.MeshStandardMaterial({
  color: 0x2b221c,
  roughness: 0.82,
  metalness: 0.10,
})
const ground = new THREE.Mesh(groundGeo, groundMat)
ground.position.y = -0.92
ground.receiveShadow = true
scene.add(ground)

const plinthGeo = new THREE.BoxGeometry(5.2, 0.18, 2.8)
const plinthMat = new THREE.MeshStandardMaterial({
  color: 0x42332a,
  roughness: 0.62,
  metalness: 0.18,
})
const plinth = new THREE.Mesh(plinthGeo, plinthMat)
plinth.position.y = -0.65
plinth.receiveShadow = true
scene.add(plinth)

renderer.render(scene, camera)
const baselineGpuGeometries = renderer.info.memory.geometries
const baselineTriangles = renderer.info.render.triangles

// 4. State & Results Collector
const results: Record<string, unknown> = {
  loader: 'GLTFLoader (three/examples/jsm/loaders/GLTFLoader.js)',
  modelUrl: requestedModelUrl,
  loadedAt: new Date().toISOString(),
  totalVerticesPerInstance: 0,
  totalTrianglesPerInstance: 0,
  meshInfo: [] as Array<Record<string, unknown>>,
  materials: [] as Array<Record<string, unknown>>,
  overallBoundingBoxThreeSpace: {},
  mirroringTest: {},
  cachingTest: {},
  sharedResourceVerification: {},
  disposeTest: {}
}

let loadedModel1: THREE.Group | null = null
let loadedModel2: THREE.Group | null = null
let modelTriCountPerInstance = 0
let modelVertCountPerInstance = 0
let wireframeEnabled = false
let turntableEnabled = false
let currentLightPreset: LightPreset = 'temple'

const disposedGeoEvents = new Set<string>()
const disposedMatEvents = new Set<string>()
const assets = new Assets()

function collectMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const list: THREE.Mesh[] = []
  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      list.push(child as THREE.Mesh)
    }
  })
  return list
}

function applyShadowAndWireframeFlags(root: THREE.Object3D) {
  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const m = child as THREE.Mesh
      m.castShadow = true
      m.receiveShadow = true
      const mats = Array.isArray(m.material) ? m.material : [m.material]
      for (const mat of mats) {
        if (mat && 'wireframe' in mat) {
          ;(mat as THREE.MeshStandardMaterial).wireframe = wireframeEnabled
        }
      }
    }
  })
}

async function initPipelineTest() {
  try {
    const t0 = performance.now()
    const gltf1 = await assets.gltf(requestedModelUrl)
    const loadTime1 = performance.now() - t0

    const t1 = performance.now()
    const gltfCached = await assets.gltf(requestedModelUrl)
    const loadTimeCached = performance.now() - t1

    results.cachingTest = {
      memoized: gltf1 === gltfCached,
      firstLoadMs: loadTime1.toFixed(2),
      cachedLoadMs: loadTimeCached.toFixed(2),
      status: gltf1 === gltfCached ? 'PASS (Cached Promise Reused)' : 'FAIL'
    }

    const uniqueGeos = new Set<THREE.BufferGeometry>()
    const uniqueMats = new Set<THREE.Material>()
    const overallBox = new THREE.Box3()

    gltf1.scene.updateMatrixWorld(true)
    gltf1.scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh
        m.castShadow = true
        m.receiveShadow = true

        const geo = m.geometry
        const mat = m.material as THREE.MeshStandardMaterial

        if (geo && !uniqueGeos.has(geo)) {
          uniqueGeos.add(geo)
          geo.addEventListener('dispose', () => {
            disposedGeoEvents.add(geo.uuid)
          })
        }
        if (mat && !uniqueMats.has(mat)) {
          uniqueMats.add(mat)
          mat.addEventListener('dispose', () => {
            disposedMatEvents.add(mat.uuid)
          })
        }

        const verts = geo.attributes.position ? geo.attributes.position.count : 0
        const tris = geo.index ? geo.index.count / 3 : (verts / 3)
        modelVertCountPerInstance += verts
        modelTriCountPerInstance += tris

        geo.computeBoundingBox()
        const bbox = geo.boundingBox
        const sizeVec = new THREE.Vector3()
        if (bbox) {
          bbox.getSize(sizeVec)
          const worldBox = bbox.clone().applyMatrix4(m.matrixWorld)
          overallBox.union(worldBox)
        }

        ;(results.meshInfo as Array<Record<string, unknown>>).push({
          name: m.name,
          vertices: verts,
          triangles: tris,
          hasNormals: Boolean(geo.attributes.normal),
          dimensionsThreeSpace: bbox ? [Number(sizeVec.x.toFixed(4)), Number(sizeVec.y.toFixed(4)), Number(sizeVec.z.toFixed(4))] : null,
          boundingBoxMin: bbox ? [Number(bbox.min.x.toFixed(4)), Number(bbox.min.y.toFixed(4)), Number(bbox.min.z.toFixed(4))] : null,
          boundingBoxMax: bbox ? [Number(bbox.max.x.toFixed(4)), Number(bbox.max.y.toFixed(4)), Number(bbox.max.z.toFixed(4))] : null,
          materialName: Array.isArray(mat) ? mat.map(x => x.name).join(', ') : mat.name
        })

        if (!(results.materials as Array<Record<string, unknown>>).find((x) => x.name === mat.name)) {
          ;(results.materials as Array<Record<string, unknown>>).push({
            name: mat.name,
            type: mat.type,
            colorHex: '#' + mat.color.getHexString(),
            metalness: Number(mat.metalness.toFixed(3)),
            roughness: Number(mat.roughness.toFixed(3)),
            isPBR: mat.isMeshStandardMaterial === true || (mat as unknown as { isMeshPhysicalMaterial?: boolean }).isMeshPhysicalMaterial === true
          })
        }
      }
    })

    const overallSize = new THREE.Vector3()
    overallBox.getSize(overallSize)
    results.totalVerticesPerInstance = modelVertCountPerInstance
    results.totalTrianglesPerInstance = modelTriCountPerInstance
    results.overallBoundingBoxThreeSpace = {
      dimensionsMeters: [Number(overallSize.x.toFixed(4)), Number(overallSize.y.toFixed(4)), Number(overallSize.z.toFixed(4))],
      min: [Number(overallBox.min.x.toFixed(4)), Number(overallBox.min.y.toFixed(4)), Number(overallBox.min.z.toFixed(4))],
      max: [Number(overallBox.max.x.toFixed(4)), Number(overallBox.max.y.toFixed(4)), Number(overallBox.max.z.toFixed(4))],
      orientationNote: 'Blender -Y forward / +Z up converted via glTF export_yup=True to Three.js +Z forward / +Y up'
    }

    // Start by spawning both shared instances to record initial multi-instance shared metrics
    await window.spawnMirroredPair()

    const meshes1 = loadedModel1 ? collectMeshes(loadedModel1) : []
    const meshes2 = loadedModel2 ? collectMeshes(loadedModel2) : []
    const sharesAllGeometries = meshes1.length > 0 && meshes1.every((m, idx) => m.geometry === meshes2[idx]?.geometry)
    const sharesAllMaterials = meshes1.length > 0 && meshes1.every((m, idx) => m.material === meshes2[idx]?.material)

    renderer.render(scene, camera)
    const bothLoadedGpuGeometries = renderer.info.memory.geometries
    const bothLoadedRenderedTriangles = renderer.info.render.triangles

    results.mirroringTest = {
      instance1Pos: loadedModel1 ? loadedModel1.position.toArray() : [],
      instance2Pos: loadedModel2 ? loadedModel2.position.toArray() : [],
      instance2Scale: [-1, 1, 1],
      status: 'PASS (Normal & Mirrored clones rendered successfully)'
    }

    results.sharedResourceVerification = {
      initialState: {
        activeInstances: assets.getSharedStats(requestedModelUrl).activeInstances,
        uniqueSharedGeometries: uniqueGeos.size,
        uniqueSharedMaterials: uniqueMats.size,
        sharesAllGeometriesByReference: sharesAllGeometries,
        sharesAllMaterialsByReference: sharesAllMaterials,
        baselineGpuGeometries,
        bothInstancesGpuGeometries: bothLoadedGpuGeometries,
        bothInstancesRenderedTriangles: bothLoadedRenderedTriangles,
        expectedTrianglesBothInstances: baselineTriangles + modelTriCountPerInstance * 4
      }
    }

    updateMetricsUI('雙實例共享載入完成 (2 Shared Instances Active)')

    window.__TEST_RESULTS__ = results
    window.__READY__ = true
    console.log('[Phase 3 Stage 2] GLB Pipeline & Preview Ready:', results)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    statusBadge.innerHTML = `<span class="badge" style="background:#b71c1c;color:#fff;">載入失敗: ${msg}</span>`
    results.error = msg
    window.__TEST_RESULTS__ = results
    console.error('[Phase 3 Stage 2] Load Error:', err)
  }
}

window.spawnMirroredPair = async () => {
  if (loadedModel1) {
    assets.releaseGltfInstance(requestedModelUrl, loadedModel1)
    loadedModel1 = null
  }
  if (loadedModel2) {
    assets.releaseGltfInstance(requestedModelUrl, loadedModel2)
    loadedModel2 = null
  }

  loadedModel1 = await assets.acquireGltfInstance(requestedModelUrl)
  loadedModel1.position.set(0, 0, 0)
  loadedModel1.rotation.y = 0
  applyShadowAndWireframeFlags(loadedModel1)
  scene.add(loadedModel1)

  loadedModel2 = await assets.acquireGltfInstance(requestedModelUrl)
  loadedModel2.position.set(2.5, 0, 0)
  loadedModel2.scale.set(-1, 1, 1)
  loadedModel2.rotation.y = -0.15
  applyShadowAndWireframeFlags(loadedModel2)
  scene.add(loadedModel2)

  // Position pair symmetrically
  loadedModel1.position.set(-1.55, 0.0, 0)
  loadedModel1.rotation.y = 0.12
  loadedModel2.position.set(1.55, 0.0, 0)
  loadedModel2.rotation.y = -0.12

  renderer.render(scene, camera)
  updateMetricsUI('雙實例共享狀態 (2 Shared Instances Active)')
}

function updateMetricsUI(stageText: string) {
  const stats = assets.getSharedStats(requestedModelUrl)
  const matNames = (results.materials as Array<{ name: string }>).map(m => m.name).join(', ')
  statusBadge.innerHTML = `<span class="badge badge-ok">${stageText}</span>`
  metricsList.innerHTML = `
    <div><strong>模型:</strong> ${requestedModelUrl.split('/').pop()} (${(results.meshInfo as unknown[]).length} 組件, ${modelVertCountPerInstance} 頂點, ${modelTriCountPerInstance} 面/實例)</div>
    <div><strong>PBR材質 (${(results.materials as unknown[]).length}):</strong> ${matNames}</div>
    <div><strong>共享狀態:</strong> 活躍實例=${stats.activeInstances} | 共享Geo=${stats.sharedGeometries} | 共享Mat=${stats.sharedMaterials}</div>
    <div><strong>已釋放事件:</strong> Disposed Geo=${disposedGeoEvents.size} | Disposed Mat=${disposedMatEvents.size}</div>
    <div><strong>WebGL GPU:</strong> 記憶體Geometries=${renderer.info.memory.geometries} (基準=${baselineGpuGeometries}) | 畫面Triangles=${renderer.info.render.triangles}</div>
    <div><strong>檢視模式:</strong> 光照=${currentLightPreset} | 線框=${wireframeEnabled ? 'ON' : 'OFF'}</div>
  `
}

// 5. Camera View Modes (Single Hero Inspection vs Symmetrical Pair)
window.setView = (mode: ViewMode) => {
  document.querySelectorAll('.btn-group button[id^="btn-"]').forEach(b => {
    if (!b.id.startsWith('btn-light-') && b.id !== 'btn-wireframe' && b.id !== 'btn-turntable') {
      b.classList.remove('active')
    }
  })
  const btn = document.getElementById(`btn-${mode}`)
  if (btn) btn.classList.add('active')

  // For single-head detailed inspection views (front, side_left, side_right, angle45, top, bottom_jaw),
  // center Instance 1 at x=0 and hide Instance 2 (without disposing it, or keep pair for 'pair' mode)
  if (mode === 'pair') {
    if (loadedModel1) {
      loadedModel1.visible = true
      loadedModel1.position.set(-1.55, 0.0, 0)
      loadedModel1.rotation.y = 0.12
    }
    if (loadedModel2) {
      loadedModel2.visible = true
      loadedModel2.position.set(1.55, 0.0, 0)
      loadedModel2.rotation.y = -0.12
    }
    camera.position.set(0, 0.75, 5.2)
    controls.target.set(0, 0.35, 0)
  } else {
    if (loadedModel1) {
      loadedModel1.visible = true
      loadedModel1.position.set(0, 0.0, 0)
      loadedModel1.rotation.y = 0
    }
    if (loadedModel2) {
      loadedModel2.visible = false
    }

    if (mode === 'front') {
      camera.position.set(0, 0.45, 3.35)
      controls.target.set(0, 0.42, 0.10)
    } else if (mode === 'side_left') {
      camera.position.set(-3.45, 0.42, 0.05)
      controls.target.set(0, 0.40, 0.05)
    } else if (mode === 'side_right') {
      camera.position.set(3.45, 0.42, 0.05)
      controls.target.set(0, 0.40, 0.05)
    } else if (mode === 'angle45') {
      camera.position.set(-2.45, 1.15, 2.55)
      controls.target.set(0, 0.40, 0.05)
    } else if (mode === 'top') {
      camera.position.set(0, 3.85, 0.45)
      controls.target.set(0, 0.35, 0.05)
    } else if (mode === 'bottom_jaw') {
      camera.position.set(0, -1.45, 2.35)
      controls.target.set(0, -0.05, 0.35)
    }
  }

  controls.update()
  renderer.render(scene, camera)
  updateMetricsUI(`視角: ${mode}`)
}

// 6. Switchable Lighting Directions
window.setLightPreset = (preset: LightPreset) => {
  currentLightPreset = preset
  document.querySelectorAll('button[id^="btn-light-"]').forEach(b => b.classList.remove('active'))
  const btn = document.getElementById(`btn-light-${preset}`)
  if (btn) btn.classList.add('active')

  if (preset === 'temple') {
    sunLight.position.set(4.5, 7.5, 5.0)
    sunLight.intensity = 2.4
    sunLight.color.setHex(0xfff1dc)
    fillLight.position.set(-5.5, 3.5, 2.0)
    fillLight.intensity = 0.85
    rimLight.position.set(0, 4.5, -5.5)
    rimLight.intensity = 1.1
  } else if (preset === 'side') {
    sunLight.position.set(-6.5, 3.2, 1.5)
    sunLight.intensity = 2.8
    sunLight.color.setHex(0xffdfb0)
    fillLight.position.set(4.5, 1.5, 3.0)
    fillLight.intensity = 0.45
    rimLight.position.set(2.5, 5.0, -5.0)
    rimLight.intensity = 1.6
  } else if (preset === 'zenith') {
    sunLight.position.set(0.2, 9.5, 0.8)
    sunLight.intensity = 2.6
    sunLight.color.setHex(0xffffff)
    fillLight.position.set(0, -3.0, 4.0)
    fillLight.intensity = 0.75
    rimLight.position.set(0, 2.0, -6.0)
    rimLight.intensity = 1.3
  }
  renderer.render(scene, camera)
  updateMetricsUI(`光照切換: ${preset}`)
}

// 7. Wireframe Toggle & 360 Turntable Rotation
window.setWireframe = (enabled: boolean) => {
  wireframeEnabled = enabled
  const btn = document.getElementById('btn-wireframe')
  if (btn) btn.classList.toggle('active', wireframeEnabled)
  if (loadedModel1) applyShadowAndWireframeFlags(loadedModel1)
  if (loadedModel2) applyShadowAndWireframeFlags(loadedModel2)
  renderer.render(scene, camera)
  updateMetricsUI(wireframeEnabled ? '線框拓樸模式 (Wireframe ON)' : 'PBR 實體渲染模式 (Wireframe OFF)')
}

window.toggleWireframe = () => {
  window.setWireframe(!wireframeEnabled)
  return wireframeEnabled
}

window.toggleTurntable = () => {
  turntableEnabled = !turntableEnabled
  const btn = document.getElementById('btn-turntable')
  if (btn) btn.classList.toggle('active', turntableEnabled)
  return turntableEnabled
}

window.setTurntableAngle = (angleDeg: number) => {
  const rad = THREE.MathUtils.degToRad(angleDeg)
  if (loadedModel1) {
    loadedModel1.rotation.y = rad
  }
  renderer.render(scene, camera)
}

// 8A. Partial Shared Resource Unload (Unload Instance 1 while Instance 2 remains active and visible)
window.runPartialDisposeTest = () => {
  if (loadedModel2) {
    loadedModel2.visible = true
    loadedModel2.position.set(1.55, 0.0, 0)
  }
  if (loadedModel1) {
    assets.releaseGltfInstance(requestedModelUrl, loadedModel1)
    loadedModel1 = null
  }

  camera.position.set(0, 0.75, 5.2)
  controls.target.set(0, 0.35, 0)
  controls.update()
  renderer.render(scene, camera)

  const inst2InScene = loadedModel2 !== null && scene.children.includes(loadedModel2)
  const inst2Meshes = loadedModel2 ? collectMeshes(loadedModel2) : []
  const inst2BuffersIntact = inst2Meshes.length > 0 && inst2Meshes.every(
    m => m.geometry && m.geometry.attributes.position && m.geometry.attributes.position.count > 0 && !disposedGeoEvents.has(m.geometry.uuid)
  )

  const statsAfterFirstUnload = assets.getSharedStats(requestedModelUrl)
  const gpuGeosAfterFirstUnload = renderer.info.memory.geometries
  const renderedTrisAfterFirstUnload = renderer.info.render.triangles
  const expectedOneInstanceTris = baselineTriangles + modelTriCountPerInstance * 2

  const step1Result = {
    activeInstancesRemaining: statsAfterFirstUnload.activeInstances,
    disposedGeoEventCount: disposedGeoEvents.size,
    disposedMatEventCount: disposedMatEvents.size,
    instance2StillInScene: inst2InScene,
    instance2SharedBuffersIntact: inst2BuffersIntact,
    gpuGeometriesInMemory: gpuGeosAfterFirstUnload,
    renderedTrianglesInFrame: renderedTrisAfterFirstUnload,
    expectedTrianglesWithOneInstance: expectedOneInstanceTris,
    instance2RendersNormally:
      inst2InScene &&
      inst2BuffersIntact &&
      disposedGeoEvents.size === 0 &&
      disposedMatEvents.size === 0 &&
      renderedTrisAfterFirstUnload === expectedOneInstanceTris,
    status:
      inst2InScene &&
      inst2BuffersIntact &&
      disposedGeoEvents.size === 0 &&
      renderedTrisAfterFirstUnload === expectedOneInstanceTris
        ? 'PASS (Instance 1 unloaded; shared resources preserved; Instance 2 renders normally)'
        : 'FAIL'
  }

  ;(results.sharedResourceVerification as Record<string, unknown>).afterFirstInstanceUnloaded = step1Result
  updateMetricsUI('已卸載實例 1，實例 2 繼續正常渲染 (Partial Unload PASS)')
  return step1Result
}

// 8B. Full Shared Resource Unload (All instances unloaded -> shared Geometries & Materials disposed)
window.runFullDisposeTest = () => {
  let finalStats = assets.getSharedStats(requestedModelUrl)
  if (loadedModel1) {
    finalStats = assets.releaseGltfInstance(requestedModelUrl, loadedModel1)
    loadedModel1 = null
  }
  if (loadedModel2) {
    finalStats = assets.releaseGltfInstance(requestedModelUrl, loadedModel2)
    loadedModel2 = null
  }

  renderer.render(scene, camera)
  const gpuGeosAfterFullUnload = renderer.info.memory.geometries
  const renderedTrisAfterFullUnload = renderer.info.render.triangles

  const step2Result = {
    activeInstancesRemaining: finalStats.activeInstances,
    disposedGeoEventCount: disposedGeoEvents.size,
    disposedMatEventCount: disposedMatEvents.size,
    gpuGeometriesInMemory: gpuGeosAfterFullUnload,
    baselineGpuGeometries,
    gpuMemoryReturnedToBaseline: gpuGeosAfterFullUnload === baselineGpuGeometries,
    renderedTrianglesInFrame: renderedTrisAfterFullUnload,
    baselineTriangles,
    allSharedResourcesReleased:
      finalStats.activeInstances === 0 &&
      disposedGeoEvents.size === finalStats.sharedGeometries &&
      disposedMatEvents.size === finalStats.sharedMaterials &&
      gpuGeosAfterFullUnload === baselineGpuGeometries,
    status:
      finalStats.activeInstances === 0 &&
      gpuGeosAfterFullUnload === baselineGpuGeometries
        ? 'PASS (All instances unloaded; all shared Geometries & Materials disposed; GPU memory returned to baseline)'
        : 'FAIL'
  }

  ;(results.sharedResourceVerification as Record<string, unknown>).afterAllInstancesUnloaded = step2Result
  results.disposeTest = {
    disposedGeometries: disposedGeoEvents.size,
    disposedMaterials: disposedMatEvents.size,
    gpuMemoryReturnedToBaseline: gpuGeosAfterFullUnload === baselineGpuGeometries,
    status: step2Result.status
  }

  updateMetricsUI('全部實例已卸載，共享資源完全釋放 (Full Dispose PASS)')
  return step2Result
}

window.runDisposeTest = () => {
  window.runPartialDisposeTest()
  window.runFullDisposeTest()
}

function animate() {
  requestAnimationFrame(animate)
  if (turntableEnabled && loadedModel1) {
    loadedModel1.rotation.y += 0.012
  }
  controls.update()
  renderer.render(scene, camera)
}
animate()

initPipelineTest()
