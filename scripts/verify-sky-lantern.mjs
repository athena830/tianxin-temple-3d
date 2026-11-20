import { chromium } from 'playwright'
import { join } from 'node:path'

const artifactDir = 'C:/Users/Aaron/.gemini/antigravity/brain/9deda20f-4636-408c-9db4-d0794dd2af98'

async function run() {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
  })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  })
  const page = await context.newPage()

  console.log('Navigating to live GitHub Pages...')
  await page.goto('https://athena830.github.io/tianxin-temple-3d/', {
    waitUntil: 'networkidle',
    timeout: 30000,
  })

  await page.waitForTimeout(1500)

  // Start exploration
  const beginBtn = await page.$('button[data-act="begin"]')
  if (beginBtn) {
    await beginBtn.click()
    await page.waitForTimeout(800)
  }

  const enterBtn = await page.$('button[data-act="enter"]')
  if (enterBtn) {
    await enterBtn.click()
    await page.waitForTimeout(2500)
  }

  // 1. Teleport right in front of the new Sky Lantern Platform beside the pavilion (-12.5, 23.5)
  console.log('Teleporting near relocated sky lantern stand beside pavilion...')
  await page.evaluate(() => {
    const g = (window).__game?.game
    if (g && typeof g.teleportTo === 'function') {
      g.teleportTo(-12.5, 26.8)
      g.camTarget.set(-12.5, 1.8, 23.5)
      g.yaw = 0 // Look North towards the lantern stand
      g.pitch = 0.08
      g.zoom = 4.2
      g.camReady = false
    }
  })
  await page.waitForTimeout(2500)

  const lanternShot = join(artifactDir, 'sky_lantern_beside_pavilion_live.png')
  await page.screenshot({ path: lanternShot })
  console.log('Saved sky lantern screenshot to:', lanternShot)

  // 2. Teleport to the pavilion entrance path facing the pavilion door to show it is 100% cleared
  console.log('Teleporting to pavilion entrance...')
  await page.evaluate(() => {
    const g = (window).__game?.game
    if (g && typeof g.teleportTo === 'function') {
      g.teleportTo(-4.5, 30.0)
      g.camTarget.set(-12.0, 1.6, 30.0)
      g.yaw = Math.PI / 2 // Look West directly into pavilion entrance
      g.pitch = 0.05
      g.zoom = 4.0
      g.camReady = false
    }
  })
  await page.waitForTimeout(2500)

  const entranceShot = join(artifactDir, 'pavilion_entrance_cleared_live.png')
  await page.screenshot({ path: entranceShot })
  console.log('Saved cleared entrance screenshot to:', entranceShot)

  await browser.close()
  console.log('Done successfully!')
}

run().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
