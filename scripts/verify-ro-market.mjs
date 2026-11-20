import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { join } from 'node:path'

const artifactDir = 'C:/Users/Aaron/.gemini/antigravity/brain/9deda20f-4636-408c-9db4-d0794dd2af98'

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {}
    await new Promise(r => setTimeout(r, 300))
  }
  throw new Error('Preview server timed out')
}

async function run() {
  const server = spawn('node', ['./node_modules/vite/bin/vite.js', 'preview', '--port', '4177', '--strictPort'], {
    stdio: 'ignore',
    windowsHide: true,
  })
  try {
    const url = 'http://127.0.0.1:4177/'
    await waitForServer(url)
    const browser = await chromium.launch({ channel: 'msedge', headless: true })
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

    const errors = []
    page.on('pageerror', err => errors.push(err.message))

    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(800)

    const beginBtn = await page.$('button[data-act="begin"]')
    if (beginBtn) { await beginBtn.click(); await page.waitForTimeout(400) }
    const enterBtn = await page.$('button[data-act="enter"]')
    if (enterBtn) { await enterBtn.click(); await page.waitForTimeout(1200) }

    // Enter the RO-style Aura Market
    await page.evaluate(() => window.__game?.sceneManager?.enterMarket())
    await page.waitForTimeout(2200)

    const plazaPath = join(artifactDir, 'market_ro_plaza_live.png')
    await page.screenshot({ path: plazaPath })
    console.log('Saved plaza screenshot:', plazaPath)

    // Test RO Mini-Nav auto-walk to Service Desk & open RO dialog
    const deskBtn = await page.$('button[data-market-target="service-desk"]')
    if (deskBtn) {
      await deskBtn.click()
      await page.waitForTimeout(3000)
    }

    const dialogPath = join(artifactDir, 'market_ro_dialog_live.png')
    await page.screenshot({ path: dialogPath })
    console.log('Saved dialog screenshot:', dialogPath)
    console.log('Page errors:', errors.length, errors)

    await browser.close()
  } finally {
    server.kill()
  }
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
