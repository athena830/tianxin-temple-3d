import { spawn } from 'node:child_process'
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const artifactDir = 'C:/Users/Aaron/.gemini/antigravity/brain/9deda20f-4636-408c-9db4-d0794dd2af98'
const port = 4930 + Math.floor(Math.random() * 50)
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
  try {
    for (let i = 0; i < 40; i++) {
      try {
        const res = await fetch(url)
        if (res.ok) break
      } catch {}
      await wait(250)
    }

    const browser = await chromium.launch({ channel: 'msedge', headless: true })
    const page = await browser.newPage({ viewport: { width: 1600, height: 960 } })

    page.on('console', msg => console.log('BROWSER:', msg.text()))

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    const beginBtn = await page.waitForSelector('button[data-act="begin"]', { timeout: 120000 })
    await beginBtn.click()
    const enterBtn = await page.waitForSelector('button[data-act="enter"]', { timeout: 30000 }).catch(() => null)
    if (enterBtn) await enterBtn.click()
    await wait(3000)

    // Verify version badge on DOM
    const badgeText = await page.$eval('#app-version', el => el.textContent.trim())
    console.log('App version badge in DOM:', badgeText)

    // Capture version badge element screenshot
    const badgeEl = await page.$('#app-version')
    if (badgeEl) {
      await badgeEl.screenshot({ path: path.join(artifactDir, 'perf_ui_version_3751.png') })
    }

    // Switch to explore mode and reset telemetry for the 30-second gameplay stress test
    await page.evaluate(() => {
      const g = window.__templeGame__ || window.__game?.game
      if (g) {
        g.startExplore()
      }
      const tel = window.__templeTelemetry__ || g?.telemetry
      if (tel && typeof tel.reset === 'function') {
        tel.reset()
      }
    })
    await wait(500)

    console.log('Starting 30-second continuous movement and camera rotation stress test...')
    const testStart = Date.now()
    const durationMs = 30000

    let step = 0
    while (Date.now() - testStart < durationMs) {
      step++
      // Alternate movement directions:
      // Walk forward, diagonally west toward sanctuary, turn camera, walk toward main hall, etc.
      const phase = Math.floor((step % 40) / 10)
      if (phase === 0) {
        await page.keyboard.down('KeyW')
        await page.keyboard.up('KeyS')
        await page.keyboard.up('KeyA')
      } else if (phase === 1) {
        // Walk forward-left towards western sacred path
        await page.keyboard.down('KeyW')
        await page.keyboard.down('KeyA')
      } else if (phase === 2) {
        await page.keyboard.up('KeyW')
        await page.keyboard.down('KeyD')
      } else {
        await page.keyboard.down('KeyS')
        await page.keyboard.up('KeyA')
        await page.keyboard.up('KeyD')
      }

      // Continuous camera rotation via mouse move
      const mouseX = 800 + Math.sin(step * 0.2) * 350
      const mouseY = 480 + Math.cos(step * 0.15) * 120
      await page.mouse.move(mouseX, mouseY)

      await wait(100)
    }

    // Release all keys
    await page.keyboard.up('KeyW')
    await page.keyboard.up('KeyS')
    await page.keyboard.up('KeyA')
    await page.keyboard.up('KeyD')

    console.log('30-second movement completed. Collecting telemetry stats...')

    // Retrieve stats immediately after the 30-second walking test finishes (before screenshots)
    const telemetryStats = await page.evaluate(() => {
      const tel = window.__templeTelemetry__
      if (!tel) return null
      return tel.getStats()
    })

    console.log('Telemetry Stats result:', JSON.stringify(telemetryStats, null, 2))

    // Capture walking in courtyard screenshot
    await page.screenshot({ path: path.join(artifactDir, 'perf_movement_courtyard_3751.png') })

    // Move visitor toward west sacred trail to capture sanctuary screenshot
    await page.evaluate(() => {
      const g = window.__templeGame__ || window.__game?.game
      if (g) {
        g.teleportTo(-30, 28)
      }
    })
    await wait(1200)
    await page.screenshot({ path: path.join(artifactDir, 'perf_movement_sanctuary_3751.png') })

    // Write JSON report
    const jsonPath = path.join(artifactDir, 'perf_telemetry_3.75.1.json')
    fs.writeFileSync(jsonPath, JSON.stringify({
      version: badgeText,
      testDurationSeconds: 30,
      timestamp: new Date().toISOString(),
      stats: telemetryStats,
    }, null, 2))
    console.log('Telemetry report written to:', jsonPath)

    await browser.close()
  } finally {
    server.kill()
  }
}

run().catch((err) => {
  console.error(err)
  server.kill()
  process.exit(1)
})
