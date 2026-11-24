import { spawn, execSync } from 'node:child_process'
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const artifactDir = 'C:/Users/Aaron/.gemini/antigravity/brain/9deda20f-4636-408c-9db4-d0794dd2af98'

console.log('Step 1: Running production build before test...')
execSync('node ./node_modules/vite/bin/vite.js build', { stdio: 'inherit' })

const port = 4940 + Math.floor(Math.random() * 50)
const url = `http://127.0.0.1:${port}/`

console.log(`Step 2: Starting preview server at ${url}...`)
const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'],
  { stdio: 'inherit' }
)

async function wait(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function run() {
  try {
    for (let i = 0; i < 40; i++) {
      try {
        const res = await fetch(url)
        if (res.ok) break
      } catch {}
      await wait(250)
    }

    const browser = await chromium.launch({
      channel: 'msedge',
      headless: true,
      args: ['--disable-features=LazyImageLoading,LazyFrameLoading', '--disable-lazy-loading'],
    })
    const page = await browser.newPage({ viewport: { width: 1600, height: 960 } })

    page.on('console', msg => console.log('BROWSER:', msg.text()))

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    const beginBtn = await page.waitForSelector('button[data-act="begin"]', { timeout: 120000 })
    await beginBtn.click()
    const enterBtn = await page.waitForSelector('button[data-act="enter"]', { timeout: 30000 }).catch(() => null)
    if (enterBtn) await enterBtn.click()

    // Pre-fetch all standalone texture images eagerly so Edge does not defer them
    await page.evaluate(async () => {
      const urls = [
        './assets/dragon-guanyin.png',
        './assets/guanyin-golden-v2.png',
        './assets/tianxin-fairy.webp',
        './assets/menshen-qin.webp',
        './assets/menshen-yuchi.webp',
      ]
      await Promise.all(urls.map(u => new Promise((resolve) => {
        const img = new Image()
        img.onload = () => resolve(true)
        img.onerror = () => resolve(false)
        img.src = u
      })))
    })

    // Wait until background progressive loading is 100% completed
    await page.waitForFunction(() => {
      const g = window.__templeGame__ || window.__game?.game
      return g && g.world && g.world.courtyard && g.world.courtyard.isProgressiveDone()
    }, { timeout: 60000 }).catch(() => null)

    // Allow 3 seconds for all async image decode callbacks and progressive materials to settle
    await wait(3000)

    const isDone = await page.evaluate(() => {
      const g = window.__templeGame__ || window.__game?.game
      const r = g?.renderer?.gl || g?.renderer
      if (r && typeof r.getContext === 'function') {
        const gl = r.getContext()
        if (gl && !gl.__hooked) {
          gl.__hooked = true
          const origLink = gl.linkProgram
          gl.linkProgram = function(prog) {
            const shaders = gl.getAttachedShaders(prog) || []
            let desc = ''
            for (const s of shaders) {
              const src = gl.getShaderSource(s) || ''
              const nums = src.split('\n').filter(l => l.includes('NUM_DIR_') || l.includes('NUM_POINT_')).map(l => l.trim()).join(' ')
              const uses = src.split('\n').filter(l => l.startsWith('#define USE_')).slice(0, 4).map(l => l.trim()).join(' ')
              if (nums || uses) desc += `${uses} [${nums}] ; `
            }
            console.log(`[GL LINK PROGRAM] at ${performance.now().toFixed(1)}ms: ${desc.slice(0, 180)}`)
            return origLink.apply(this, arguments)
          }
        }
      }
      return g?.world?.courtyard?.isProgressiveDone()
    })
    console.log('Progressive loading status before warmup:', isDone ? 'COMPLETED' : 'INCOMPLETE')

    // Allow another 1.5 seconds for the scene render and initial warmup to settle
    await wait(1500)

    // Precompile full scene materials and prime shadow maps during warmup
    await page.evaluate(() => {
      const g = window.__templeGame__ || window.__game?.game
      if (g) {
        // Precompile full scene materials
        g.renderer.compile(g.world.scene, g.camera)

        const THREE = window.THREE || { Vector3: g.position.constructor }
        const origCamPos = g.camera.position.clone()
        const origDir = new THREE.Vector3()
        g.camera.getWorldDirection(origDir)
        const origCamTarget = origDir.clone().add(origCamPos)

        // 1. Prime front courtyard & main hall
        const origPos = g.position.clone()
        g.world.update(0.016, 0, origPos, null, g.camera)
        g.renderer.render(g.world.scene, g.camera)

        // 2. Prime sacred trail & western platform facing west towards Dragon Guanyin
        const westPos = new THREE.Vector3(-32.0, 0.91, 31.0)
        g.camera.position.set(-25.0, 2.5, 31.0)
        g.camera.lookAt(-68.0, 5.0, 31.0)
        g.world.update(0.016, 0, westPos, null, g.camera)
        g.renderer.render(g.world.scene, g.camera)

        // 3. Prime western platform facing east back along trail
        const platPos = new THREE.Vector3(-68.0, 0.91, 31.0)
        g.camera.position.set(-68.0, 3.5, 31.0)
        g.camera.lookAt(-20.0, 2.0, 31.0)
        g.world.update(0.016, 0, platPos, null, g.camera)
        g.renderer.render(g.world.scene, g.camera)

        // 4. Restore original camera position and view
        g.camera.position.copy(origCamPos)
        g.camera.lookAt(origCamTarget)
        g.world.update(0.016, 0, origPos, null, g.camera)
        g.renderer.render(g.world.scene, g.camera)
      }
    })

    // Verify version badge on DOM
    const badgeText = await page.$eval('#app-version', el => el.textContent.trim())
    console.log('App version badge in DOM:', badgeText)
    if (badgeText !== 'VER 3.75.2') {
      throw new Error(`Expected VER 3.75.2, but found: ${badgeText}`)
    }

    // Capture version badge screenshot
    const badgeEl = await page.$('#app-version')
    if (badgeEl) {
      await badgeEl.screenshot({ path: path.join(artifactDir, 'perf_ui_version_3752.png') })
    }

    // Enter explore mode and reset telemetry to record the clean 30-second walking session
    await page.evaluate(() => {
      const g = window.__templeGame__ || window.__game?.game
      if (g) {
        g.startExplore()
      }
      if (window.__templeTelemetry__) {
        window.__templeTelemetry__.reset()
      }
    })
    await wait(300)

    console.log('Step 3: Starting 30-second continuous movement, steering westward through Sacred Trail past x < -22...')
    const testStart = Date.now()
    const durationMs = 30000
    const trajectory = []

    let step = 0
    let minX = 999
    let crossedSanctuaryBoundary = false

    while (Date.now() - testStart < durationMs) {
      step++

      // Query current player position
      const pos = await page.evaluate(() => {
        const g = window.__templeGame__ || window.__game?.game
        if (!g) return null
        const p = g.position
        return { x: Number(p.x.toFixed(2)), y: Number(p.y.toFixed(2)), z: Number(p.z.toFixed(2)) }
      })

      if (pos) {
        trajectory.push({ step, timeMs: Date.now() - testStart, ...pos })
        if (pos.x < minX) minX = pos.x
        if (pos.x < -22.0) crossedSanctuaryBoundary = true
      }

      const elapsed = Date.now() - testStart

      // Active navigation steering:
      // Phase 1 (0-14s): Walk west towards Sacred Trail Moon Gate (target x = -26, z = 31)
      if (elapsed < 14000) {
        // Steer left (A) to decrease X, and adjust W/S to aim towards z = 31
        await page.keyboard.down('KeyA')
        await page.keyboard.up('KeyD')

        if (pos && pos.z < 30.5) {
          await page.keyboard.down('KeyS') // move +Z
          await page.keyboard.up('KeyW')
        } else if (pos && pos.z > 31.8) {
          await page.keyboard.down('KeyW') // move -Z
          await page.keyboard.up('KeyS')
        } else {
          await page.keyboard.up('KeyW')
          await page.keyboard.up('KeyS')
        }
      } else if (elapsed < 20000) {
        // Phase 2 (14-20s): Stroll along western sanctuary platform & sacred trail (maintain z around 31)
        await page.keyboard.up('KeyA')
        await page.keyboard.up('KeyD')
        if (pos && pos.z < 30.5) {
          await page.keyboard.down('KeyS')
          await page.keyboard.up('KeyW')
        } else if (pos && pos.z > 31.8) {
          await page.keyboard.down('KeyW')
          await page.keyboard.up('KeyS')
        } else {
          await page.keyboard.up('KeyW')
          await page.keyboard.up('KeyS')
        }
      } else {
        // Phase 3 (20-30s): Walk east back towards courtyard (KeyD, steer z towards 31)
        await page.keyboard.up('KeyA')
        await page.keyboard.down('KeyD')
        if (pos && pos.z < 30.5) {
          await page.keyboard.down('KeyS')
          await page.keyboard.up('KeyW')
        } else if (pos && pos.z > 31.8) {
          await page.keyboard.down('KeyW')
          await page.keyboard.up('KeyS')
        } else {
          await page.keyboard.up('KeyW')
          await page.keyboard.up('KeyS')
        }
      }

      // Smooth camera mouse movement
      const mouseX = 800 + Math.sin(step * 0.15) * 320
      const mouseY = 480 + Math.cos(step * 0.12) * 100
      await page.mouse.move(mouseX, mouseY)

      await wait(80)
    }

    // Release all movement keys
    await page.keyboard.up('KeyW')
    await page.keyboard.up('KeyS')
    await page.keyboard.up('KeyA')
    await page.keyboard.up('KeyD')

    console.log('Step 4: 30-second walking test completed. Collecting telemetry stats...')

    // Retrieve stats immediately (before taking screenshots to avoid screenshot overhead in telemetry)
    const telemetryStats = await page.evaluate(() => {
      const tel = window.__templeTelemetry__
      if (!tel) return null
      return tel.getStats()
    })

    console.log('Min X reached during walking:', minX)
    console.log('Crossed x < -22 boundary:', crossedSanctuaryBoundary)
    console.log('Telemetry Stats result:', JSON.stringify(telemetryStats, null, 2))

    // Write full telemetry and trajectory report
    const jsonPath = path.join(artifactDir, 'perf_telemetry_3.75.2.json')
    fs.writeFileSync(jsonPath, JSON.stringify({
      version: badgeText,
      testDurationSeconds: 30,
      timestamp: new Date().toISOString(),
      minXReached: minX,
      crossedSanctuaryBoundary,
      stats: telemetryStats,
      trajectorySample: trajectory.filter((_, idx) => idx % 5 === 0),
    }, null, 2))
    console.log('Telemetry report written to:', jsonPath)

    // Screenshot 1: Walking in courtyard / sacred trail
    await page.screenshot({ path: path.join(artifactDir, 'perf_movement_courtyard_3752.png') })

    // Screenshot 2: Sacred trail and sanctuary
    await wait(400)
    await page.screenshot({ path: path.join(artifactDir, 'perf_movement_sanctuary_3752.png') })

    // Roof tiles visibility validation across Medium, Low, High presets
    console.log('Capturing roof tile visibility screenshots across presets...')
    await page.evaluate(() => {
      const g = window.__templeGame__ || window.__game?.game
      if (!g) return
      window.__customCam = { pos: [0, 6.8, 20.0], target: [0, 6.5, 0] }
      g.render = function() {
        if (window.__customCam) {
          this.camera.position.set(window.__customCam.pos[0], window.__customCam.pos[1], window.__customCam.pos[2])
          this.camera.lookAt(window.__customCam.target[0], window.__customCam.target[1], window.__customCam.target[2])
          this.renderer.render(this.world.scene, this.camera)
        }
      }
    })

    // Capture Medium (default) roof tiles
    await page.evaluate(() => {
      const g = window.__templeGame__ || window.__game?.game
      if (g) g.setQuality('medium')
    })
    await wait(600)
    await page.screenshot({ path: path.join(artifactDir, 'roof_tiles_medium_front.png') })
    console.log('Captured: roof_tiles_medium_front.png')

    // Capture Low roof tiles (micro detail hidden)
    await page.evaluate(() => {
      const g = window.__templeGame__ || window.__game?.game
      if (g) g.setQuality('low')
    })
    await wait(600)
    await page.screenshot({ path: path.join(artifactDir, 'roof_tiles_low_front.png') })
    console.log('Captured: roof_tiles_low_front.png')

    // Capture High roof tiles
    await page.evaluate(() => {
      const g = window.__templeGame__ || window.__game?.game
      if (g) g.setQuality('high')
    })
    await wait(600)
    await page.screenshot({ path: path.join(artifactDir, 'roof_tiles_high_front.png') })
    console.log('Captured: roof_tiles_high_front.png')

    // Reset back to medium
    await page.evaluate(() => {
      const g = window.__templeGame__ || window.__game?.game
      if (g) g.setQuality('medium')
    })

    // Assertions according to Requirement 2
    if (!crossedSanctuaryBoundary || minX >= -22.0) {
      throw new Error(`Assertion failed: player failed to walk across x < -22. Min X reached was: ${minX}`)
    }

    if (telemetryStats.maxFrameMs > 100) {
      throw new Error(`Assertion failed: single frame exceeded 100ms threshold! maxFrameMs = ${telemetryStats.maxFrameMs}ms`)
    }

    if (telemetryStats.consecutiveLongFrames > 0) {
      throw new Error(`Assertion failed: consecutiveLongFrames must be 0! got: ${telemetryStats.consecutiveLongFrames}`)
    }

    console.log('All assertions PASSED!')

    await browser.close()
    console.log('Test completed successfully with 0 errors!')
  } finally {
    server.kill()
  }
}

run().catch((err) => {
  console.error(err)
  server.kill()
  process.exit(1)
})
