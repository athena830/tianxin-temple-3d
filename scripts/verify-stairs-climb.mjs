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

  // 1. Teleport in front of the Main Hall stairs at x = 0, z = 5.0 (just behind the Tiangong Urn)
  console.log('Teleporting in front of the main hall approach steps...')
  await page.evaluate(() => {
    const g = (window).__game?.game
    if (g && typeof g.teleportTo === 'function') {
      g.teleportTo(0, 5.0)
      g.yaw = 0 // Look North towards Main Hall
      g.pitch = 0.05
      g.zoom = 3.6
      g.camReady = false
    }
  })
  await page.waitForTimeout(1000)

  // 2. Walk forward into the Main Hall across the stairs
  console.log('Walking forward across the stairs into the Main Hall...')
  // Press 'KeyW' for 1.8 seconds to walk across stairs onto podium
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(1800)
  await page.keyboard.up('KeyW')
  await page.waitForTimeout(800)

  // 3. Inspect final player coordinates
  const finalPos = await page.evaluate(() => {
    const g = (window).__game?.game
    if (g) {
      return {
        pos: g.position,
        feet: g.feet,
        mainHallScale: g.world.getMainHallScale(),
      }
    }
    return null
  })
  console.log('Player position after walking up stairs:', finalPos)

  await page.evaluate(() => {
    // If an NPC speech bubble was triggered by walking, dismiss or hide it so it doesn't cover the deities
    document.querySelectorAll('.npc-bubble, .speech-bubble, [class*="bubble"]').forEach(el => {
      el.style.display = 'none'
    })
  })
  await page.waitForTimeout(300)

  const shotPath = join(artifactDir, 'main_hall_stairs_climbed_live.png')
  await page.screenshot({ path: shotPath })
  console.log('Saved screenshot to:', shotPath)

  await browser.close()
}

run().catch(console.error)
