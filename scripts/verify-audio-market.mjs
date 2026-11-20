import http from 'http'
import fs from 'fs'
import path from 'path'
import { chromium } from 'playwright'

const artifactDir = 'C:/Users/Aaron/.gemini/antigravity/brain/9deda20f-4636-408c-9db4-d0794dd2af98'

const server = http.createServer((req, res) => {
  let file = req.url.split('?')[0]
  if (file === '/') file = '/index.html'
  const filePath = path.join(process.cwd(), 'dist', file)
  if (!fs.existsSync(filePath)) {
    res.writeHead(404)
    res.end('Not found: ' + file)
    return
  }
  const ext = path.extname(filePath)
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.wasm': 'application/wasm',
    '.json': 'application/json',
    '.mp3': 'audio/mpeg',
  }
  res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' })
  fs.createReadStream(filePath).pipe(res)
})

server.listen(4933, async () => {
  console.log('Test server running at http://127.0.0.1:4933/')
  const browser = await chromium.launch({ channel: 'chrome' })
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })

  const errors = []
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('[Console Error]:', msg.text())
  })
  page.on('pageerror', err => {
    console.log('[Page Error]:', err.message)
    errors.push(err.message)
  })

  await page.goto('http://127.0.0.1:4933/')
  await page.waitForTimeout(1500)

  // 1. Click Begin -> Choose -> Enter
  console.log('Entering temple...')
  await page.click('button[data-act="begin"]')
  await page.waitForTimeout(800)
  await page.click('button[data-act="enter"]')
  await page.waitForTimeout(2500)

  // Verify temple music button
  const templeMusicBtnText = await page.$eval('button[data-act="music"]', el => el.textContent?.trim())
  console.log('Temple Music Button text:', templeMusicBtnText)

  // 2. Enter market via SceneManager
  console.log('Entering market...')
  await page.evaluate(() => {
    window.__game.sceneManager.enterMarket()
  })

  // Check toast immediately after market transition starts/arrives
  await page.waitForTimeout(1200)
  const toastText = await page.evaluate(() => document.querySelector('.toast')?.textContent?.trim())
  console.log('Toast text on entering market:', toastText)

  await page.waitForTimeout(2000)

  // Verify music button in market: must be visible and indicate paused/muted
  const marketMusicBtn = await page.$('button[data-act="music"]')
  const isMarketMusicBtnVisible = await marketMusicBtn.isVisible()
  const marketMusicBtnText = await marketMusicBtn.textContent()
  console.log('Market Music Button visible:', isMarketMusicBtnVisible, '| text:', marketMusicBtnText?.trim())

  const marketShot = path.join(artifactDir, 'market_music_auto_paused_live.png')
  await page.screenshot({ path: marketShot })
  console.log('Saved market screenshot:', marketShot)

  // 3. Test manual toggle in market
  console.log('Clicking music button inside market to manually resume...')
  await page.click('button[data-act="music"]')
  await page.waitForTimeout(500)
  const manualMusicText = await page.$eval('button[data-act="music"]', el => el.textContent?.trim())
  console.log('Music text after manual click in market:', manualMusicText)

  // 4. Return to temple
  console.log('Returning to temple...')
  await page.evaluate(() => {
    window.__game.sceneManager.returnTemple()
  })
  await page.waitForTimeout(2000)

  const returnTempleMusicText = await page.$eval('button[data-act="music"]', el => el.textContent?.trim())
  console.log('Music button text after returning to temple:', returnTempleMusicText)

  const templeShot = path.join(artifactDir, 'temple_music_resumed_live.png')
  await page.screenshot({ path: templeShot })
  console.log('Saved temple screenshot:', templeShot)

  await browser.close()
  server.close()

  if (errors.length > 0) {
    console.error('Errors found during test:', errors)
    process.exit(1)
  }
  console.log('E2E validation finished successfully!')
})
