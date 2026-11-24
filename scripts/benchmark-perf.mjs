import { spawn } from 'node:child_process'
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const artifactDir = 'C:/Users/Aaron/.gemini/antigravity/brain/9deda20f-4636-408c-9db4-d0794dd2af98'
const port = 4920 + Math.floor(Math.random() * 50)
const url = `http://127.0.0.1:${port}/`

const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'],
  { stdio: 'inherit' }
)

async function wait(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function run() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(url)
      if (res.ok) break
    } catch {}
    await wait(250)
  }

  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 1600, height: 960 } })

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
  const beginBtn = await page.waitForSelector('button[data-act="begin"]', { timeout: 120000 })
  await beginBtn.click()
  const enterBtn = await page.waitForSelector('button[data-act="enter"]', { timeout: 30000 }).catch(() => null)
  if (enterBtn) await enterBtn.click()
  await wait(4000)

  // Measure across Low, Medium, High
  const results = await page.evaluate(async () => {
    const g = window.__game?.game
    if (!g) return null
    const renderer = g.renderer
    const gl = renderer.gl
    const scene = g.world.scene

    // Helper to count meshes, shadow casters, geometries, materials
    function inspectScene() {
      let meshCount = 0
      let shadowCasters = 0
      let receiveShadows = 0
      const geomSet = new Set()
      const matSet = new Set()

      scene.traverse((obj) => {
        if (obj.isMesh) {
          meshCount++
          if (obj.castShadow) shadowCasters++
          if (obj.receiveShadow) receiveShadows++
          if (obj.geometry) geomSet.add(obj.geometry.id)
          if (obj.material) {
            if (Array.isArray(obj.material)) obj.material.forEach((m) => matSet.add(m.id))
            else matSet.add(obj.material.id)
          }
        }
      })
      return {
        meshes: meshCount,
        shadowCasters,
        receiveShadows,
        geometries: geomSet.size,
        materials: matSet.size,
        textures: gl.info.memory.textures,
      }
    }

    // Benchmark 60 frames for a quality
    async function benchmarkQuality(quality) {
      g.setQuality(quality)
      // allow 20 frames to settle
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => requestAnimationFrame(r))
      }

      // Read single-frame calls & triangles from the engine's real scene render pass
      let sceneCalls = 0
      let sceneTriangles = 0
      const origGlRender = gl.render.bind(gl)
      gl.render = function (s, c) {
        origGlRender(s, c)
        if (s === scene) {
          sceneCalls = gl.info.render.calls
          sceneTriangles = gl.info.render.triangles
        }
      }
      await new Promise((r) => requestAnimationFrame(r))
      await new Promise((r) => requestAnimationFrame(r))
      gl.render = origGlRender

      const calls = sceneCalls || gl.info.render.calls
      const triangles = sceneTriangles || gl.info.render.triangles

      // Time 60 consecutive frames via rAF
      const frameTimes = []
      let lastTime = performance.now()
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => requestAnimationFrame(r))
        const now = performance.now()
        frameTimes.push(now - lastTime)
        lastTime = now
      }

      frameTimes.sort((a, b) => a - b)
      const avgMs = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length
      const p95Ms = frameTimes[Math.floor(frameTimes.length * 0.95)]
      const fps = Math.round(1000 / avgMs)

      return {
        quality,
        calls,
        triangles,
        avgMs: Number(avgMs.toFixed(2)),
        p95Ms: Number(p95Ms.toFixed(2)),
        fps,
      }
    }

    const sceneStats = inspectScene()
    const medium = await benchmarkQuality('medium')
    const high = await benchmarkQuality('high')
    const low = await benchmarkQuality('low')

    // Reset back to medium
    g.setQuality('medium')

    return {
      sceneStats,
      presets: { low, medium, high }
    }
  })

  console.log('BENCHMARK_RESULTS:', JSON.stringify(results, null, 2))

  // Screenshot 1: UI Version Badge verification showing VER 3.75.0
  const pathBadge = path.join(artifactDir, 'perf_version_badge.png')
  const badgeEl = await page.$('#app-version')
  if (badgeEl) {
    await badgeEl.screenshot({ path: pathBadge })
  } else {
    await page.screenshot({ path: pathBadge, clip: { x: 0, y: 0, width: 300, height: 100 } })
  }
  console.log('Captured:', pathBadge)

  const pathUiVersion = path.join(artifactDir, 'perf_ui_version.png')
  await page.screenshot({ path: pathUiVersion })
  console.log('Captured:', pathUiVersion)

  // Setup custom camera override for pristine visual verification screenshots
  await page.evaluate(() => {
    const overlays = document.querySelectorAll('.chat-bubble, .speech-bubble, .npc-bubble, .hud-overlay, .interaction-prompt, .tutorial-overlay, #hud, .station-banner, #touch-controls')
    overlays.forEach(el => (el.style.display = 'none'))

    const g = window.__game?.game
    if (!g) return

    if (g.world?.npcs) {
      g.world.npcs.npcs.forEach((n) => {
        n.root.visible = false
        if (n.bubble?.mesh) n.bubble.mesh.visible = false
      })
      g.world.npcs.update = () => {}
    }

    window.__customCam = { pos: [0, 2.8, 28], target: [0, 3.5, 0] }
    window.__showChibi = true

    g.render = function () {
      if (this.camera && window.__customCam) {
        if (this.world?.chibi) {
          this.world.chibi.root.visible = !!window.__showChibi
          if (!window.__showChibi) {
            this.world.chibi.root.position.set(0, -999, 0)
          }
        }
        this.camera.position.set(
          window.__customCam.pos[0],
          window.__customCam.pos[1],
          window.__customCam.pos[2]
        )
        this.camera.lookAt(
          window.__customCam.target[0],
          window.__customCam.target[1],
          window.__customCam.target[2]
        )
        this.renderer.render(this.world.scene, this.camera)
      }
    }
  })

  // Screenshot 2: 玉皇宮正面全景 (perf_temple_front.png)
  await page.evaluate(() => {
    window.__showChibi = true
    const g = window.__game?.game
    if (g?.world?.chibi) {
      g.world.chibi.root.position.set(0, 0, 22)
      g.world.chibi.root.rotation.y = 0
    }
    window.__customCam = { pos: [0, 2.6, 28], target: [0, 3.2, 0] }
  })
  await page.waitForTimeout(1000)
  const path1 = path.join(artifactDir, 'perf_temple_front.png')
  await page.screenshot({ path: path1 })
  console.log('Captured:', path1)

  // Screenshot 3: 玉皇宮左前 45 度 (perf_temple_angle45_left.png)
  await page.evaluate(() => {
    window.__showChibi = false
    window.__customCam = { pos: [-16, 4.8, 20], target: [0, 3.8, 0] }
  })
  await page.waitForTimeout(1000)
  const pathAngle45 = path.join(artifactDir, 'perf_temple_angle45_left.png')
  await page.screenshot({ path: pathAngle45 })
  console.log('Captured:', pathAngle45)

  // Screenshot 4: 天心仙姑亭正面與神壇近景 (perf_fairy_pavilion.png)
  await page.evaluate(() => {
    window.__showChibi = false
    window.__customCam = { pos: [-8.8, 1.85, 30.0], target: [-13.2, 1.85, 30.0] }
  })
  await page.waitForTimeout(1000)
  const path2 = path.join(artifactDir, 'perf_fairy_pavilion.png')
  await page.screenshot({ path: path2 })
  console.log('Captured:', path2)

  // Screenshot 5: 移動鏡頭 (perf_moving_camera.png)
  await page.evaluate(() => {
    window.__showChibi = true
    const g = window.__game?.game
    if (g?.world?.chibi) {
      g.world.chibi.root.position.set(-6, 0, 32)
      g.world.chibi.root.rotation.y = Math.PI * 0.75
    }
    window.__customCam = { pos: [-14, 4.5, 42], target: [-4, 2.2, 22] }
  })
  await page.waitForTimeout(1000)
  const path4 = path.join(artifactDir, 'perf_moving_camera.png')
  await page.screenshot({ path: path4 })
  console.log('Captured:', path4)

  // Screenshot 6: Medium vs High comparison
  // First capture High
  await page.evaluate(() => {
    const g = window.__game?.game
    if (g) g.setQuality('high')
    window.__showChibi = true
    window.__customCam = { pos: [0, 2.6, 28], target: [0, 3.2, 0] }
  })
  await page.waitForTimeout(1000)
  const pathHigh = path.join(artifactDir, 'perf_quality_high.png')
  await page.screenshot({ path: pathHigh })
  console.log('Captured:', pathHigh)

  // Then reset to Medium
  await page.evaluate(() => {
    const g = window.__game?.game
    if (g) g.setQuality('medium')
  })
  await page.waitForTimeout(1000)
  const pathMedium = path.join(artifactDir, 'perf_quality_medium.png')
  await page.screenshot({ path: pathMedium })
  console.log('Captured:', pathMedium)

  await browser.close()
  server.kill('SIGTERM')
}

run().catch((err) => {
  console.error(err)
  try { server.kill('SIGTERM') } catch {}
  process.exit(1)
})
