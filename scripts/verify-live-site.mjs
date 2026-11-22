import { join } from 'node:path'
import { chromium } from 'playwright'

const artifactDir = 'C:/Users/Aaron/.gemini/antigravity/brain/9deda20f-4636-408c-9db4-d0794dd2af98'
const url = 'https://athena830.github.io/tianxin-temple-3d/'

async function run() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  const logs = []
  page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`))
  page.on('pageerror', err => logs.push(`[PAGEERROR] ${err.message}`))

  console.log('Navigating to live URL:', url)
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 })
  await page.waitForTimeout(2000)

  const version = await page.evaluate(() => document.getElementById('app-version')?.textContent)
  console.log('Live Version on page:', version)

  const titlePath = join(artifactDir, 'live_site_v3717_verified.png')
  await page.screenshot({ path: titlePath })
  console.log('Saved live title screenshot:', titlePath)

  const beginBtn = await page.$('button[data-act="begin"]')
  if (beginBtn) { await beginBtn.click(); await page.waitForTimeout(400) }
  const enterBtn = await page.$('button[data-act="enter"]')
  if (enterBtn) { await enterBtn.click(); await page.waitForTimeout(1000) }

  // Enter market
  await page.evaluate(() => window.__game?.sceneManager?.enterMarket())
  await page.waitForTimeout(2500)

  const marketPath = join(artifactDir, 'live_market_v3717_verified.png')
  await page.screenshot({ path: marketPath })
  console.log('Saved live market screenshot:', marketPath)

  console.log('Logs captured:', logs)
  await browser.close()
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
