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

  // Hide all UI overlays
  await page.evaluate(() => {
    const selectors = [
      '#ui',
      '#hud',
      '#guide-panel',
      '#prompt',
      '.market-top-bar',
      '#app-version',
      '.dialogue-bubble',
      '.speech-bubble',
      '.bubble',
      '.toast',
      '#dialogue',
    ]
    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach((el) => {
        el.style.display = 'none'
      })
    }
  })

  // Hook game loop and install custom camera controller
  await page.evaluate(() => {
    const g = (window).__game?.game
    if (!g) return

    // Despawn all NPCs and disable NPC spawner
    if (g.world?.npcs) {
      g.world.npcs.npcs.forEach((n) => {
        n.despawn()
        n.root.visible = false
        n.root.position.set(0, -999, 0)
        if (n.bubble?.mesh) n.bubble.mesh.visible = false
      })
      g.world.npcs.update = () => {}
    }

    // Hide player chibi avatar
    if (g.world?.chibi) {
      g.world.chibi.root.visible = false
      g.world.chibi.root.position.set(0, -999, 0)
    }

    // Hide guide markers
    if (g.clickMarker) g.clickMarker.visible = false
    if (typeof g.world?.setGuide === 'function') g.world.setGuide(null, null, 0)

    // Override g.render to drive dedicated external architectural camera
    ;(window).__customCam = {
      pos: [-3.6, 2.7, 30.0],
      target: [-12.0, 2.7, 30.0],
    }

    g.render = function () {
      if (this.camera && (window).__customCam) {
        // Enforce avatar and NPC invisibility every frame
        if (this.world?.chibi) {
          this.world.chibi.root.visible = false
          this.world.chibi.root.position.set(0, -999, 0)
        }
        if (this.world?.npcs) {
          this.world.npcs.npcs.forEach((n) => {
            n.despawn()
            n.root.visible = false
            if (n.bubble?.mesh) n.bubble.mesh.visible = false
          })
        }
        if (this.clickMarker) this.clickMarker.visible = false

        this.camera.position.set(
          (window).__customCam.pos[0],
          (window).__customCam.pos[1],
          (window).__customCam.pos[2]
        )
        this.camera.lookAt(
          (window).__customCam.target[0],
          (window).__customCam.target[1],
          (window).__customCam.target[2]
        )
        this.renderer.render(this.world.scene, this.camera)
      }
    }
  })

  const views = [
    {
      id: 'fairy_pavilion_front',
      name: '1. Front View (正面步道中央視角)',
      cam: {
        pos: [-3.6, 2.7, 30.0],
        target: [-12.0, 2.7, 30.0],
      },
    },
    {
      id: 'fairy_pavilion_angle45',
      name: '2. 45-Degree Front-Left View (左前 45 度視角)',
      cam: {
        pos: [-5.8, 2.8, 36.2],
        target: [-12.0, 2.7, 30.0],
      },
    },
    {
      id: 'fairy_pavilion_rear',
      name: '3. Rear View (亭後背面視角)',
      cam: {
        pos: [-20.4, 2.7, 30.0],
        target: [-12.0, 2.7, 30.0],
      },
    },
    {
      id: 'fairy_pavilion_altar_closeup',
      name: '4. Altar Close-Up (神壇與仙姑特寫視角)',
      cam: {
        pos: [-9.8, 1.48, 30.0],
        target: [-12.4, 1.36, 30.0],
      },
    },
  ]

  for (const v of views) {
    console.log(`Setting up camera for ${v.name}...`)
    await page.evaluate((cam) => {
      ;(window).__customCam = cam
    }, v.cam)

    await page.waitForTimeout(1200)

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
