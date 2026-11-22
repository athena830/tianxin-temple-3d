import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { chromium } from 'playwright'

const artifactDir = 'C:/Users/Aaron/.gemini/antigravity/brain/9deda20f-4636-408c-9db4-d0794dd2af98'
const port = 4177
const url = `http://127.0.0.1:${port}/`

async function waitForServer(targetUrl, timeoutMs = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(targetUrl)
      if (res.ok) return
    } catch {}
    await new Promise(r => setTimeout(r, 300))
  }
  throw new Error('Preview server timed out')
}

async function run() {
  const server = spawn('node', ['./node_modules/vite/bin/vite.js', 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], {
    stdio: 'ignore',
    windowsHide: true,
  })
  try {
    await waitForServer(url)
    const browser = await chromium.launch({ channel: 'msedge', headless: true })
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

    const errors = []
    page.on('pageerror', err => errors.push(err.message))
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(800)

    const beginBtn = await page.$('button[data-act="begin"]')
    if (beginBtn) { await beginBtn.click(); await page.waitForTimeout(400) }
    const enterBtn = await page.$('button[data-act="enter"]')
    if (enterBtn) { await enterBtn.click(); await page.waitForTimeout(1200) }

    // Enter Market
    await page.evaluate(() => window.__game?.sceneManager?.enterMarket())
    await page.waitForTimeout(2500)

    // Click "平視攤位" button
    const eyeBtn = await page.$('button[data-market-cam="eye-level"]')
    if (eyeBtn) {
      await eyeBtn.click()
      await page.waitForTimeout(1500)
    }

    // Tilt camera slightly up to frame the upper neon signs directly
    await page.evaluate(() => {
      const sm = window.__game?.sceneManager
      if (sm?.current && 'tiltCamera' in sm.current) {
        sm.current.tiltCamera(-0.18)
      }
    })
    await page.waitForTimeout(1500)

    // Capture eye-level screenshot showing stalls and signs face-on
    const eyeLevelPath = join(artifactDir, 'verify_eye_level_signs.png')
    await page.screenshot({ path: eyeLevelPath })
    console.log('Saved eye-level screenshot:', eyeLevelPath)

    // Check life-numerology button
    const numBtn = await page.$('button[data-market-target="life-numerology"]')
    console.log('Numerology button found in menu:', !!numBtn)

    // Open Numerology panel
    await page.evaluate(() => {
      const ui = window.__game?.ui
      if (ui) ui.openMarketPanel('life-numerology')
    })
    await page.waitForTimeout(1000)

    const popupPath = join(artifactDir, 'verify_numerology_popup.png')
    await page.screenshot({ path: popupPath })
    console.log('Saved numerology popup screenshot:', popupPath)

    console.log('Console / page errors count:', errors.length)
    if (errors.length > 0) {
      console.log('Errors:', errors)
    }

    await browser.close()
  } finally {
    server.kill()
  }
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
