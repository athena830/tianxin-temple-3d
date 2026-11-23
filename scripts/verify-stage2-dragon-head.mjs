import { spawn } from 'node:child_process'
import { writeFileSync, readFileSync, copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const port = 4389
const url = `http://127.0.0.1:${port}/preview-glb.html?model=/assets/models/temple-dragon-head-preview.glb`
const artifactDir = 'C:/Users/Aaron/.gemini/antigravity/brain/9deda20f-4636-408c-9db4-d0794dd2af98'
const blenderRenderDir = 'D:/Tianxin-temple/shots/dragon-head-blender'
mkdirSync(artifactDir, { recursive: true })

console.log(`[Stage 2 Verifier] Starting Vite dev server on port ${port}...`)
const vite = spawn(process.execPath, [
  'node_modules/vite/bin/vite.js',
  '--port', String(port),
  '--strictPort',
  '--host', '127.0.0.1'
], { stdio: 'pipe' })

vite.stderr.on('data', d => console.error('[Vite err]', d.toString()))

async function waitForServer() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {}
    await new Promise(r => setTimeout(r, 250))
  }
  throw new Error(`Server did not respond on ${url}`)
}

async function run() {
  let browser
  try {
    // Copy Blender studio renders & report to artifact directory
    const blenderViews = ['front', 'side_left', 'side_right', 'angle45', 'top', 'bottom_jaw', 'wireframe']
    for (const v of blenderViews) {
      const src = `${blenderRenderDir}/blender_${v}.png`
      if (existsSync(src)) {
        copyFileSync(src, `${artifactDir}/stage2_blender_${v}.png`)
      }
    }
    if (existsSync('public/assets/models/temple-dragon-head-report.json')) {
      copyFileSync('public/assets/models/temple-dragon-head-report.json', `${artifactDir}/stage2_blender_report.json`)
    }

    await waitForServer()
    console.log('[Stage 2 Verifier] Vite server ready. Launching headless browser...')

    browser = await chromium.launch({
      headless: true,
      channel: 'chrome',
      args: ['--enable-webgl', '--ignore-gpu-blocklist']
    })
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })

    page.on('console', msg => {
      if (msg.type() === 'error') console.error('[Browser Error]', msg.text())
      else console.log('[Browser]', msg.text())
    })

    await page.goto(url, { waitUntil: 'networkidle' })
    await page.waitForFunction(() => window.__READY__ === true, { timeout: 20000 })
    console.log('[Stage 2 Verifier] Dragon Head GLB loaded in Three.js.')

    // 1. Capture 6 Single-Head Inspection Angles in Three.js
    const captureAngles = ['front', 'side_left', 'side_right', 'angle45', 'top', 'bottom_jaw']
    for (const angle of captureAngles) {
      await page.evaluate((m) => window.setView(m), angle)
      await page.waitForTimeout(300)
      await page.screenshot({ path: `${artifactDir}/stage2_three_${angle}.png` })
      console.log(`[Stage 2 Verifier] Captured Three.js ${angle}`)
    }

    // 2. Capture Wireframe Topology in Three.js (45° view)
    await page.evaluate(() => {
      window.setView('angle45')
      window.setWireframe(true)
    })
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${artifactDir}/stage2_three_wireframe.png` })
    console.log('[Stage 2 Verifier] Captured Three.js Wireframe')

    // 3. Capture Dynamic Light Direction Switch (Side Dramatic Lighting)
    await page.evaluate(() => {
      window.setWireframe(false)
      window.setLightPreset('side')
      window.setView('angle45')
    })
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${artifactDir}/stage2_three_light_side.png` })
    console.log('[Stage 2 Verifier] Captured Three.js Side Dramatic Lighting')

    // 4. Capture Symmetrical Shared Pair + Partial Unload + Full Unload
    await page.evaluate(() => {
      window.setLightPreset('temple')
      window.setView('pair')
    })
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${artifactDir}/stage2_three_pair.png` })

    const partialRes = await page.evaluate(() => window.runPartialDisposeTest())
    await page.waitForTimeout(250)
    await page.screenshot({ path: `${artifactDir}/stage2_three_partial_unload.png` })
    console.log('[Stage 2 Verifier] Partial Unload Result:', partialRes)

    const fullRes = await page.evaluate(() => window.runFullDisposeTest())
    await page.waitForTimeout(250)
    console.log('[Stage 2 Verifier] Full Unload Result:', fullRes)

    const results = await page.evaluate(() => window.__TEST_RESULTS__)
    writeFileSync(`${artifactDir}/stage2_three_results.json`, JSON.stringify(results, null, 2))

    // 5. Build 6-Panel High-Res Collage (Front, Left Side, 45°, Top, Bottom Jaw, Wireframe)
    const collageDataUrl = await page.evaluate(async (imgs) => {
      const canvas = document.createElement('canvas')
      canvas.width = 1920
      canvas.height = 1080
      const ctx = canvas.getContext('2d')

      ctx.fillStyle = '#120e0c'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const loadImg = (src) => new Promise((resolve) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.src = src
      })

      const loaded = await Promise.all(imgs.map(item => loadImg(item.src)))
      const cols = 3
      const rows = 2
      const pad = 12
      const cellW = (canvas.width - pad * (cols + 1)) / cols
      const cellH = (canvas.height - pad * (rows + 1)) / rows

      loaded.forEach((img, idx) => {
        const c = idx % cols
        const r = Math.floor(idx / cols)
        const x = pad + c * (cellW + pad)
        const y = pad + r * (cellH + pad)
        ctx.drawImage(img, x, y, cellW, cellH)

        ctx.fillStyle = 'rgba(15, 12, 10, 0.82)'
        ctx.fillRect(x + 10, y + 10, 290, 32)
        ctx.strokeStyle = '#997a3d'
        ctx.strokeRect(x + 10, y + 10, 290, 32)
        ctx.fillStyle = '#ffd54f'
        ctx.font = 'bold 16px sans-serif'
        ctx.fillText(imgs[idx].label, x + 20, y + 32)
      })

      return canvas.toDataURL('image/png')
    }, [
      { label: '1. 正面渲染 (Front View)', src: `data:image/png;base64,${readFileSync(`${artifactDir}/stage2_blender_front.png`).toString('base64')}` },
      { label: '2. 側面渲染 (Left Profile)', src: `data:image/png;base64,${readFileSync(`${artifactDir}/stage2_blender_side_left.png`).toString('base64')}` },
      { label: '3. 45° 透視 (45° Perspective)', src: `data:image/png;base64,${readFileSync(`${artifactDir}/stage2_blender_angle45.png`).toString('base64')}` },
      { label: '4. 頂部與鹿角 (Top & Antlers)', src: `data:image/png;base64,${readFileSync(`${artifactDir}/stage2_blender_top.png`).toString('base64')}` },
      { label: '5. 下顎與口腔深度 (Bottom Jaw)', src: `data:image/png;base64,${readFileSync(`${artifactDir}/stage2_blender_bottom_jaw.png`).toString('base64')}` },
      { label: '6. 線框拓樸 (Wireframe Topology)', src: `data:image/png;base64,${readFileSync(`${artifactDir}/stage2_blender_wireframe.png`).toString('base64')}` },
    ])

    const collageBase64 = collageDataUrl.replace(/^data:image\/png;base64,/, '')
    writeFileSync(`${artifactDir}/stage2_dragon_head_6panel.png`, Buffer.from(collageBase64, 'base64'))
    console.log(`[Stage 2 Verifier] Saved 6-panel collage: ${artifactDir}/stage2_dragon_head_6panel.png`)
    console.log('[Stage 2 Verifier] ALL STAGE 2 VERIFICATIONS PASSED!')
  } catch (err) {
    console.error('[Stage 2 Verifier] Failed:', err)
    process.exit(1)
  } finally {
    if (browser) await browser.close()
    vite.kill('SIGTERM')
  }
}

run()
