import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'
import { join } from 'node:path'

const port = 4600 + Math.floor(Math.random() * 200)
const url = `http://127.0.0.1:${port}/`
const shotsDir = 'shots/fairy-pavilion'
const artifactDir = 'C:/Users/Aaron/.gemini/antigravity/brain/9deda20f-4636-408c-9db4-d0794dd2af98'

mkdirSync(shotsDir, { recursive: true })
mkdirSync(artifactDir, { recursive: true })

console.log(`Starting Vite preview server on ${url}...`)
const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'],
  { stdio: 'inherit' }
)

let browser
const guard = setTimeout(() => fail('Script timed out after 200s'), 200_000)

function cleanup() {
  clearTimeout(guard)
  try { server.kill('SIGTERM') } catch {}
}

async function fail(msg) {
  console.error(`[FAIL] ${msg}`)
  await browser?.close().catch(() => {})
  cleanup()
  process.exit(1)
}

async function waitForServer() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {}
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error('Server did not start in 10s')
}

async function run() {
  await waitForServer()
  console.log('Preview server ready! Launching msedge...')

  browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
  })

  const context = await browser.newContext({
    viewport: { width: 1600, height: 960 },
  })
  const page = await context.newPage()

  page.on('console', (msg) => console.log(`[Browser console] ${msg.type()}: ${msg.text()}`))
  page.on('pageerror', (err) => console.error(`[Browser error]`, err))

  console.log(`Navigating to ${url}...`)
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
  console.log('DOM content loaded.')

  // Wait for begin button
  console.log('Waiting for begin button (shader precompile may take up to 40s in headless WebGL)...')
  const beginBtn = await page.waitForSelector('button[data-act="begin"]', { timeout: 120000 })
  if (beginBtn) {
    console.log('Found begin button, clicking...')
    await beginBtn.click()
    await page.waitForTimeout(1000)
  }

  // Look for enter button
  console.log('Looking for enter button...')
  const enterBtn = await page.waitForSelector('button[data-act="enter"]', { timeout: 30000 }).catch(() => null)
  if (enterBtn) {
    console.log('Found enter button, clicking...')
    await enterBtn.click()
    await page.waitForTimeout(3000)
  }

  console.log('Waiting for game world to initialize...')
  await page.waitForTimeout(2500)

  // Verify game instance
  const isGameReady = await page.evaluate(() => {
    return !!(window).__game?.game
  })
  console.log('Is __game available:', isGameReady)

  // Hide UI overlays
  await page.evaluate(() => {
    const hud = document.getElementById('hud')
    if (hud) hud.style.display = 'none'
    const guide = document.getElementById('guide-panel')
    if (guide) guide.style.display = 'none'
    const topBar = document.querySelector('.market-top-bar')
    if (topBar) topBar.style.display = 'none'
    const versionBadge = document.getElementById('app-version')
    if (versionBadge) versionBadge.style.display = 'none'
  })

  const views = [
    {
      id: 'fairy_pavilion_front',
      name: '1. Front View (前方玩家站立視角)',
      cam: {
        playerPos: [-7.8, 30],
        target: [-12, 1.45, 30],
        yaw: -Math.PI / 2, // Facing West toward (-12, 30)
        pitch: 0.04,
        zoom: 4.8,
      },
    },
    {
      id: 'fairy_pavilion_angle45',
      name: '2. 45-Degree Front-Left View (45 度左前方視角)',
      cam: {
        playerPos: [-8.2, 34.5],
        target: [-12, 1.45, 30],
        yaw: -2.35, // ~135 degrees toward (-12, 30)
        pitch: 0.08,
        zoom: 5.6,
      },
    },
    {
      id: 'fairy_pavilion_side',
      name: '3. Side View (側面視角)',
      cam: {
        playerPos: [-12, 35.8],
        target: [-12, 1.45, 30],
        yaw: Math.PI, // Facing North toward 30
        pitch: 0.04,
        zoom: 5.4,
      },
    },
    {
      id: 'fairy_pavilion_altar_closeup',
      name: '4. Altar & Fairy Close-Up (神案與仙姑特寫視角)',
      cam: {
        playerPos: [-9.8, 30],
        target: [-12, 1.45, 30],
        yaw: -Math.PI / 2,
        pitch: 0.02,
        zoom: 2.8,
      },
    },
  ]

  for (const v of views) {
    console.log(`Setting up camera for ${v.name}...`)
    await page.evaluate((cam) => {
      const g = (window).__game?.game
      if (g) {
        if (typeof g.teleportTo === 'function') {
          g.teleportTo(cam.playerPos[0], cam.playerPos[1])
        }
        if (g.camTarget) {
          g.camTarget.set(cam.target[0], cam.target[1], cam.target[2])
        }
        g.yaw = cam.yaw
        g.pitch = cam.pitch
        g.zoom = cam.zoom
        g.camReady = false
      }
    }, v.cam)

    await page.waitForTimeout(1000)

    const shotPath = join(shotsDir, `${v.id}.png`)
    const artifactPath = join(artifactDir, `${v.id}.png`)

    await page.screenshot({ path: shotPath })
    await page.screenshot({ path: artifactPath })
    console.log(`[Captured] ${shotPath}`)
  }

  console.log('All 4 Fairy Pavilion screenshots captured successfully!')
  await browser.close()
  cleanup()
  process.exit(0)
}

run().catch(fail)
