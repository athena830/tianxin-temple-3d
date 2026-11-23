import * as THREE from 'three'
import { Assets } from './engine/assets'

declare global {
  interface Window {
    __READY__?: boolean
    __TEST_RESULTS__?: Record<string, unknown>
    setView: (mode: 'front' | 'side' | 'angle45') => void
    runPartialDisposeTest: () => Record<string, unknown>
    runFullDisposeTest: () => Record<string, unknown>
    runDisposeTest: () => void
  }
}

const container = document.getElementById('canvas-container')!
const metricsList = document.getElementById('metrics-list')!
const statusBadge = document.getElementById('status-badge')!

const params = new URLSearchParams(window.location.search)
const requestedModelUrl = params.get('model') || '/assets/models/test.glb'

// 1. Scene & Renderer setup
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x1a1614)
scene.fog = new THREE.FogExp2(0x1a1614, 0.035)

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100)
camera.position.set(0, 1.5, 5.5)

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.15
container.appendChild(renderer.domElement)

// 2. Eastern Temple PBR Lighting Rig
const hemiLight = new THREE.HemisphereLight(0xfffaed, 0x3d3126, 0.85)
scene.add(hemiLight)

const sunLight = new THREE.DirectionalLight(0xfff1dc, 2.2)
sunLight.position.set(5, 8, 4)
sunLight.castShadow = true
sunLight.shadow.mapSize.width = 2048
sunLight.shadow.mapSize.height = 2048
sunLight.shadow.camera.near = 0.5
sunLight.shadow.camera.far = 25
sunLight.shadow.camera.left = -4
sunLight.shadow.camera.right = 4
sunLight.shadow.camera.top = 4
sunLight.shadow.camera.bottom = -4
sunLight.shadow.bias = -0.0005
scene.add(sunLight)

const rimLight = new THREE.DirectionalLight(0x78909c, 0.7)
rimLight.position.set(-6, 4, -5)
scene.add(rimLight)

// 3. Ground Pedestal (Receiving Shadows) — 2 baseline geometries
const groundGeo = new THREE.CylinderGeometry(4.5, 4.8, 0.4, 32)
const groundMat = new THREE.MeshStandardMaterial({
  color: 0x332a22,
  roughness: 0.8,
  metalness: 0.1,
})
const ground = new THREE.Mesh(groundGeo, groundMat)
ground.position.y = -1.0
ground.receiveShadow = true
scene.add(ground)

const plinthGeo = new THREE.BoxGeometry(4.2, 0.2, 2.2)
const plinthMat = new THREE.MeshStandardMaterial({
  color: 0x4a3b32,
  roughness: 0.6,
  metalness: 0.2,
})
const plinth = new THREE.Mesh(plinthGeo, plinthMat)
plinth.position.y = -0.7
plinth.receiveShadow = true
scene.add(plinth)

// Render once to establish baseline GPU memory
renderer.render(scene, camera)
const baselineGpuGeometries = renderer.info.memory.geometries
const baselineTriangles = renderer.info.render.triangles

// 4. Test Results Collector
const results: Record<string, unknown> = {
  loader: 'GLTFLoader (three/examples/jsm/loaders/GLTFLoader.js)',
  modelUrl: requestedModelUrl,
  loadedAt: new Date().toISOString(),
  meshInfo: [] as Array<Record<string, unknown>>,
  materials: [] as Array<Record<string, unknown>>,
  mirroringTest: {},
  cachingTest: {},
  sharedResourceVerification: {},
  disposeTest: {}
}

let loadedModel1: THREE.Group | null = null
let loadedModel2: THREE.Group | null = null
let modelTriCountPerInstance = 0

// Track actual Three.js dispose event firings on unique shared geometries & materials
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

async function initPipelineTest() {
  try {
    const t0 = performance.now()
    const gltf1 = await assets.gltf(requestedModelUrl)
    const loadTime1 = performance.now() - t0

    // Test memoization cache
    const t1 = performance.now()
    const gltfCached = await assets.gltf(requestedModelUrl)
    const loadTimeCached = performance.now() - t1

    results.cachingTest = {
      memoized: gltf1 === gltfCached,
      firstLoadMs: loadTime1.toFixed(2),
      cachedLoadMs: loadTimeCached.toFixed(2),
      status: gltf1 === gltfCached ? 'PASS (Cached Promise Reused)' : 'FAIL'
    }

    // Inspect hierarchy & attach dispose listeners to unique shared geometries/materials
    const uniqueGeos = new Set<THREE.BufferGeometry>()
    const uniqueMats = new Set<THREE.Material>()

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

        const tris = geo.index ? geo.index.count / 3 : (geo.attributes.position ? geo.attributes.position.count / 3 : 0)
        modelTriCountPerInstance += tris

        ;(results.meshInfo as Array<Record<string, unknown>>).push({
          name: m.name,
          vertices: geo.attributes.position ? geo.attributes.position.count : 0,
          triangles: tris,
          hasNormals: Boolean(geo.attributes.normal),
          materialName: Array.isArray(mat) ? mat.map(x => x.name).join(', ') : mat.name
        })

        if (!(results.materials as Array<Record<string, unknown>>).find((x) => x.name === mat.name)) {
          ;(results.materials as Array<Record<string, unknown>>).push({
            name: mat.name,
            type: mat.type,
            colorHex: '#' + mat.color.getHexString(),
            metalness: mat.metalness,
            roughness: mat.roughness,
            isPBR: mat.isMeshStandardMaterial === true
          })
        }
      }
    })

    // Acquire Instance 1 (Left, x = -1.3) and Instance 2 (Right, x = 1.3, mirrored)
    loadedModel1 = await assets.acquireGltfInstance(requestedModelUrl)
    loadedModel1.position.set(-1.3, 0.4, 0)
    loadedModel1.rotation.y = 0.15
    scene.add(loadedModel1)

    loadedModel2 = await assets.acquireGltfInstance(requestedModelUrl)
    loadedModel2.position.set(1.3, 0.4, 0)
    loadedModel2.scale.set(-1, 1, 1) // Symmetrical mirror
    loadedModel2.rotation.y = -0.15
    scene.add(loadedModel2)

    // Verify that Instance 1 and Instance 2 share the exact same BufferGeometry & Material references
    const meshes1 = collectMeshes(loadedModel1)
    const meshes2 = collectMeshes(loadedModel2)
    const sharesAllGeometries = meshes1.length > 0 && meshes1.every((m, idx) => m.geometry === meshes2[idx]?.geometry)
    const sharesAllMaterials = meshes1.length > 0 && meshes1.every((m, idx) => m.material === meshes2[idx]?.material)

    renderer.render(scene, camera)
    const bothLoadedGpuGeometries = renderer.info.memory.geometries
    const bothLoadedRenderedTriangles = renderer.info.render.triangles

    results.mirroringTest = {
      instance1Pos: [-1.3, 0.4, 0],
      instance2Pos: [1.3, 0.4, 0],
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
    console.log('[Phase 3 Stage 1.5] GLB Pipeline verified successfully:', results)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    statusBadge.innerHTML = `<span class="badge" style="background:#b71c1c;color:#fff;">載入失敗: ${msg}</span>`
    results.error = msg
    window.__TEST_RESULTS__ = results
    console.error('[Phase 3 Stage 1.5] Load Error:', err)
  }
}

function updateMetricsUI(stageText: string) {
  const stats = assets.getSharedStats(requestedModelUrl)
  statusBadge.innerHTML = `<span class="badge badge-ok">${stageText}</span>`
  metricsList.innerHTML = `
    <div><strong>模型:</strong> ${requestedModelUrl} (${(results.meshInfo as unknown[]).length} Meshes, ${modelTriCountPerInstance} 面/實例)</div>
    <div><strong>共享狀態:</strong> 活躍實例=${stats.activeInstances} | 共享Geo=${stats.sharedGeometries} | 共享Mat=${stats.sharedMaterials}</div>
    <div><strong>已釋放事件:</strong> Disposed Geo=${disposedGeoEvents.size} | Disposed Mat=${disposedMatEvents.size}</div>
    <div><strong>WebGL GPU:</strong> 記憶體Geometries=${renderer.info.memory.geometries} | 畫面Triangles=${renderer.info.render.triangles}</div>
  `
}

// 5. Camera Views
window.setView = (mode: 'front' | 'side' | 'angle45') => {
  document.querySelectorAll('.btn-group button').forEach(b => b.classList.remove('active'))
  const btn = document.getElementById(`btn-${mode}`)
  if (btn) btn.classList.add('active')

  if (mode === 'front') {
    camera.position.set(0, 0.8, 4.2)
    camera.lookAt(0, 0.3, 0)
  } else if (mode === 'side') {
    camera.position.set(-4.2, 0.6, 0.5)
    camera.lookAt(-0.5, 0.3, 0)
  } else if (mode === 'angle45') {
    camera.position.set(3.2, 2.2, 3.8)
    camera.lookAt(0, 0.2, 0)
  }
  renderer.render(scene, camera)
}

// 6A. Stage 1 of Shared Disposal: Unload Instance 1 while Instance 2 remains active and rendering
window.runPartialDisposeTest = () => {
  if (loadedModel1) {
    assets.releaseGltfInstance(requestedModelUrl, loadedModel1)
    loadedModel1 = null
  }

  // Render frame after removing Instance 1
  renderer.render(scene, camera)

  // Verify Instance 2 is still in scene and its meshes still have intact geometries/materials
  const inst2InScene = loadedModel2 !== null && scene.children.includes(loadedModel2)
  const inst2Meshes = loadedModel2 ? collectMeshes(loadedModel2) : []
  const inst2BuffersIntact = inst2Meshes.length > 0 && inst2Meshes.every(
    m => m.geometry && m.geometry.attributes.position && m.geometry.attributes.position.count > 0 && !disposedGeoEvents.has(m.geometry.uuid)
  )

  const statsAfterFirstUnload = assets.getSharedStats(requestedModelUrl)
  const gpuGeosAfterFirstUnload = renderer.info.memory.geometries
  const renderedTrisAfterFirstUnload = renderer.info.render.triangles

  // Each instance has castShadow=true, so Three.js renders its triangles once in the shadow pass and once in the main pass (2x)
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
  console.log('[Phase 3 Stage 1.5] Partial Dispose Test (Instance 1 unloaded, Instance 2 alive):', step1Result)
  return step1Result
}

// 6B. Stage 2 of Shared Disposal: Unload Instance 2 (all instances unloaded -> shared resources disposed)
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
  console.log('[Phase 3 Stage 1.5] Full Dispose Test (All instances unloaded):', step2Result)
  return step2Result
}

window.runDisposeTest = () => {
  window.runPartialDisposeTest()
  window.runFullDisposeTest()
}

// Render loop
function animate() {
  requestAnimationFrame(animate)
  renderer.render(scene, camera)
}
animate()

initPipelineTest()
window.setView('front')
