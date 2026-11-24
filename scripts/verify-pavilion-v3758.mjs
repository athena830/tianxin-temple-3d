import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { writeFileSync } from 'node:fs'

const artifactDir = 'C:/Users/Aaron/.gemini/antigravity/brain/9deda20f-4636-408c-9db4-d0794dd2af98'
const PORT = 4185
const BASE_URL = `http://127.0.0.1:${PORT}/`

function pause(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {}
    await pause(250)
  }
  throw new Error(`Preview server timed out on ${url}`)
}

function startPreviewServer() {
  return spawn('node', ['./node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], {
    stdio: 'ignore',
    windowsHide: true,
  })
}

async function run() {
  console.log('Starting preview server for VER 3.75.8 verification...')
  const preview = startPreviewServer()
  await waitForServer(BASE_URL)
  console.log(`Preview server ready at ${BASE_URL}`)

  const report = {
    version: 'VER 3.75.8',
    date: new Date().toISOString(),
    pavilionObjects: {},
    chessboardInteractionPassed: false,
    screenshots: [],
  }

  try {
    const browser = await chromium.launch({ channel: 'chrome', headless: true })
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await context.newPage()

    await page.goto(BASE_URL)
    await page.waitForFunction(() => !!window.__game?.sceneManager, { timeout: 30000 })
    await pause(1500)

    // Teleport player near pavilion
    await page.evaluate(() => {
      const g = window.__game?.sceneManager?.current
      if (g && typeof g.teleportTo === 'function') {
        g.teleportTo(-8.8, 30.0)
      }
    })
    await pause(500)

    // 1. Inspect Scene Objects in Pavilion
    const sceneCheck = await page.evaluate(() => {
      const g = window.__game?.sceneManager?.current
      if (!g || !g.world || !g.world.scene) return { error: 'Game or scene not found' }
      const scene = g.world.scene

      const board = scene.getObjectByName('chessboard')
      const fairyMesh = g.world.courtyard?.fairyMesh || null

      let stoneTable = false
      let stoneStoolsCount = 0
      let chessPiecesCount = 0
      let altarScreenFound = false
      let censerFound = false
      let bwaBweiFound = false
      let sticksCylinderFound = false

      scene.traverse(obj => {
        if (obj.isMesh && obj.geometry) {
          const m = obj.matrixWorld ? obj.matrixWorld.elements : null
          const wx = m ? m[12] : obj.position.x
          const wz = m ? m[14] : obj.position.z
          const distToPavilion = Math.hypot(wx - (-12), wz - 30)
          if (distToPavilion > 3.2) return

          const type = obj.geometry.type
          const params = obj.geometry.parameters || {}

          // Check stone table: CylinderGeometry(0.75, 0.55, 0.8, 16)
          if (type === 'CylinderGeometry' && Math.abs(params.radiusTop - 0.75) < 0.05 && Math.abs(params.height - 0.8) < 0.05) {
            stoneTable = true
          }
          // Check stone stools: CylinderGeometry(0.24, 0.2, 0.45, 12) at radius ~1.3m
          if (type === 'CylinderGeometry' && Math.abs(params.radiusTop - 0.24) < 0.05 && Math.abs(params.height - 0.45) < 0.05) {
            if (distToPavilion > 1.0 && distToPavilion < 1.6) {
              stoneStoolsCount++
            }
          }
          // Check chess pieces: CylinderGeometry(0.085, 0.09, 0.05, 14)
          if (type === 'CylinderGeometry' && Math.abs(params.radiusTop - 0.085) < 0.02 && Math.abs(params.height - 0.05) < 0.02) {
            chessPiecesCount++
          }
          // Check for altar screen: BoxGeometry(0.12, 2.30, 2.40)
          if (type === 'BoxGeometry' && Math.abs(params.height - 2.30) < 0.1 && Math.abs(params.depth - 2.40) < 0.1) {
            altarScreenFound = true
          }
          // Check for censer: CylinderGeometry(0.11, 0.08, 0.12, 16)
          if (type === 'CylinderGeometry' && Math.abs(params.radiusTop - 0.11) < 0.02 && Math.abs(params.height - 0.12) < 0.02) {
            censerFound = true
          }
        }
      })

      return {
        hasChessboard: !!board,
        boardPos: board ? { x: +board.position.x.toFixed(2), y: +board.position.y.toFixed(2), z: +board.position.z.toFixed(2) } : null,
        hasFairy: !!fairyMesh,
        fairyPos: fairyMesh ? { x: +fairyMesh.position.x.toFixed(2), y: +fairyMesh.position.y.toFixed(2), z: +fairyMesh.position.z.toFixed(2) } : null,
        hasStoneTable: stoneTable,
        stoneStoolsCount,
        chessPiecesCount,
        altarScreenFound,
        censerFound,
      }
    })

    console.log('Pavilion Scene Check Results:', sceneCheck)
    report.pavilionObjects = sceneCheck

    if (!sceneCheck.hasChessboard) throw new Error('chessboard mesh not found in scene!')
    if (!sceneCheck.hasStoneTable) throw new Error('Stone table CylinderGeometry(0.75, 0.55, 0.8) not found!')
    if (sceneCheck.stoneStoolsCount !== 4) throw new Error(`Expected 4 stone stools, found ${sceneCheck.stoneStoolsCount}`)
    if (sceneCheck.chessPiecesCount !== 5) throw new Error(`Expected 5 chess pieces, found ${sceneCheck.chessPiecesCount}`)
    if (!sceneCheck.hasFairy) throw new Error('Fairy standee mesh not found!')
    if (sceneCheck.altarScreenFound) throw new Error('Altar screen still found in scene!')
    if (sceneCheck.censerFound) throw new Error('Incense censer still found in scene!')

    // 2. Capture Three Required Verification Screenshots
    console.log('Capturing three required verification screenshots...')

    // Screenshot 1: 亭內正面視角 (Front view looking into pavilion)
    await page.evaluate(() => {
      const g = window.__game?.sceneManager?.current
      if (g) {
        g.camera.position.set(-9.2, 1.25, 30.0)
        g.camera.lookAt(-12.2, 1.05, 30.0)
        g.camera.updateMatrixWorld()
        g.renderer.render(g.world.scene, g.camera)
      }
    })
    await pause(300)
    const frontPath = join(artifactDir, 'pavilion_front_view_v3758.png')
    await page.screenshot({ path: frontPath })
    report.screenshots.push({ title: '亭內正面視角', path: frontPath })
    console.log(`Saved screenshot 1: ${frontPath}`)

    // Screenshot 2: 左前 45 度視角 (Left-front 45 deg view)
    await page.evaluate(() => {
      const g = window.__game?.sceneManager?.current
      if (g) {
        g.camera.position.set(-9.8, 1.45, 27.6)
        g.camera.lookAt(-12.1, 1.05, 30.0)
        g.camera.updateMatrixWorld()
        g.renderer.render(g.world.scene, g.camera)
      }
    })
    await pause(300)
    const left45Path = join(artifactDir, 'pavilion_left45_view_v3758.png')
    await page.screenshot({ path: left45Path })
    report.screenshots.push({ title: '左前 45 度視角', path: left45Path })
    console.log(`Saved screenshot 2: ${left45Path}`)

    // Screenshot 3: 棋盤桌面近景 (Close-up of chessboard on stone table)
    await page.evaluate(() => {
      const g = window.__game?.sceneManager?.current
      if (g) {
        g.camera.position.set(-10.8, 1.55, 30.0)
        g.camera.lookAt(-12.0, 1.10, 30.0)
        g.camera.updateMatrixWorld()
        g.renderer.render(g.world.scene, g.camera)
      }
    })
    await pause(300)
    const closeupPath = join(artifactDir, 'pavilion_chessboard_closeup_v3758.png')
    await page.screenshot({ path: closeupPath })
    report.screenshots.push({ title: '棋盤桌面近景', path: closeupPath })
    console.log(`Saved screenshot 3: ${closeupPath}`)

    // 3. Test Chessboard Interaction & Divination
    console.log('Testing chessboard interaction & divination modal...')
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('temple:interact', { detail: 'chess' }))
    })
    await page.waitForSelector('.chess-cross-board', { state: 'visible', timeout: 5000 })
    console.log('Chessboard divination panel opened successfully!')

    // Test flipping cards or interaction inside divination
    const slots = await page.$$('.chess-slot-cell')
    if (slots.length < 5) throw new Error(`Expected at least 5 chess slots, got ${slots.length}`)

    // Close divination panel and verify return to scene
    const closeBtn = await page.$('.panel-wrap button.close[data-act="close"]') || await page.$('button[data-act="close"]')
    if (closeBtn) {
      await closeBtn.click()
    } else {
      await page.keyboard.press('Escape')
    }
    await page.waitForFunction(() => {
      const wrap = document.querySelector('.panel-wrap')
      return !wrap || wrap.hidden
    }, { timeout: 5000 })
    console.log('Successfully closed divination dialog and returned to scene!')
    report.chessboardInteractionPassed = true

    const reportPath = join(artifactDir, 'pavilion_v3758_report.json')
    writeFileSync(reportPath, JSON.stringify(report, null, 2))
    console.log(`Saved verification report to ${reportPath}`)
    console.log('=== VER 3.75.8 Pavilion Verification SUCCESS! ===')

    await browser.close()
  } finally {
    preview.kill()
  }
}

run().catch(err => {
  console.error('Fatal Verification Error:', err)
  process.exit(1)
})
