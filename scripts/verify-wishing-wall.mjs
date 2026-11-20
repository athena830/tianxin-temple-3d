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

  page.on('console', msg => console.log('[Browser]', msg.text()))
  page.on('pageerror', err => console.error('[Browser Error]', err))

  console.log('Navigating to live GitHub Pages...')
  await page.goto('https://athena830.github.io/tianxin-temple-3d/', {
    waitUntil: 'networkidle',
    timeout: 30000,
  })

  await page.waitForTimeout(1500)

  // Start exploration
  const beginBtn = await page.$('button[data-act="begin"]')
  if (beginBtn) {
    console.log('Clicking begin button...')
    await beginBtn.click()
    await page.waitForTimeout(800)
  }

  const enterBtn = await page.$('button[data-act="enter"]')
  if (enterBtn) {
    console.log('Clicking enter button...')
    await enterBtn.click()
    await page.waitForTimeout(2500)
  }

  // Check version badge
  const versionText = await page.$eval('#app-version', el => el.textContent)
  console.log('Version badge:', versionText)

  // Teleport in front of courtyard prayer-wall (facing North towards [8.8, 8.2])
  console.log('Teleporting in front of courtyard prayer-wall...')
  await page.evaluate(() => {
    const g = (window).__game?.game
    if (g && typeof g.teleportTo === 'function') {
      g.teleportTo(8.8, 12.0)
      g.camTarget.set(8.8, 1.6, 8.2)
      g.yaw = 0 // Look towards -Z (North)
      g.pitch = 0.08
      g.zoom = 4.2
      g.camReady = false
    }
  })
  await page.waitForTimeout(2000)

  const courtyardShot = join(artifactDir, 'courtyard_prayer_wall_live.png')
  await page.screenshot({ path: courtyardShot })
  console.log('Saved courtyard prayer wall screenshot to:', courtyardShot)

  // Teleport into Main Hall interior (right aisle, facing altar and cushions)
  console.log('Teleporting into Main Hall interior...')
  await page.evaluate(() => {
    const g = (window).__game?.game
    if (g && typeof g.teleportTo === 'function') {
      g.teleportTo(2.8, -3.8)
      g.camTarget.set(0, 1.5, -12.0)
      g.yaw = -0.3
      g.pitch = 0.05
      g.zoom = 3.8
      g.camReady = false
    }
  })
  await page.waitForTimeout(2000)

  const mainHallShot = join(artifactDir, 'main_hall_interior_cleared_live.png')
  await page.screenshot({ path: mainHallShot })
  console.log('Saved cleared main hall screenshot to:', mainHallShot)

  await browser.close()
  console.log('Verification done successfully!')
}

run().catch(err => {
  console.error('Error during verification:', err)
  process.exit(1)
})
