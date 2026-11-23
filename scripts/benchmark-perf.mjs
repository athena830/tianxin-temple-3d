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

      // Read single-frame calls & triangles from the engine's real render pass
      await new Promise((r) => requestAnimationFrame(r))
      const calls = gl.info.render.calls
      const triangles = gl.info.render.triangles

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

  // Screenshot 1: 玉皇宮正面 (perf_temple_front.png)
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

  // Screenshot 2: 天心仙姑亭正面 (perf_fairy_pavilion.png)
  await page.evaluate(() => {
    window.__showChibi = false
    window.__customCam = { pos: [-3.6, 2.7, 30.0], target: [-12.0, 2.7, 30.0] }
  })
  await page.waitForTimeout(1000)
  const path2 = path.join(artifactDir, 'perf_fairy_pavilion.png')
  await page.screenshot({ path: path2 })
  console.log('Captured:', path2)

  // Screenshot 3: 主殿近景 (perf_main_hall_closeup.png)
  await page.evaluate(() => {
    window.__showChibi = false
    window.__customCam = { pos: [0, 2.2, 5.0], target: [0, 2.6, -2.5] }
  })
  await page.waitForTimeout(1000)
  const path3 = path.join(artifactDir, 'perf_main_hall_closeup.png')
  await page.screenshot({ path: path3 })
  console.log('Captured:', path3)

  // Screenshot 4: 移動鏡頭 (perf_moving_camera.png)
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

  await browser.close()
  server.kill('SIGTERM')
}

run().catch((err) => {
  console.error(err)
  try { server.kill('SIGTERM') } catch {}
  process.exit(1)
})
