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

  // Switch to night time and look up into the sky to confirm no stars
  console.log('Setting time to night and tilting camera up to sky dome...')
  await page.evaluate(() => {
    const g = (window).__game?.game
    if (g) {
      g.world.setTimeOfDay('night', true)
      g.pitch = 0.55 // Look up towards the sky dome
      g.camReady = false
    }
  })
  await page.waitForTimeout(2500)

  const skyShot = join(artifactDir, 'night_sky_clean_no_stars_live.png')
  await page.screenshot({ path: skyShot })
  console.log('Saved clean sky screenshot to:', skyShot)

  await browser.close()
  console.log('Verification done!')
}

run().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
