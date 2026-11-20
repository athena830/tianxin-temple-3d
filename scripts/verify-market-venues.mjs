import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { join } from 'node:path'

const artifactDir = 'C:/Users/Aaron/.gemini/antigravity/brain/9deda20f-4636-408c-9db4-d0794dd2af98'

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {}
    await new Promise(r => setTimeout(r, 300))
  }
  throw new Error('Preview server timed out')
}

async function run() {
  const server = spawn('node', ['./node_modules/vite/bin/vite.js', 'preview', '--port', '4178', '--strictPort'], {
    stdio: 'ignore',
    windowsHide: true,
  })
  try {
    const url = 'http://127.0.0.1:4178/'
    await waitForServer(url)
    const browser = await chromium.launch({ channel: 'msedge', headless: true })
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

    const errors = []
    page.on('pageerror', err => errors.push(err.message))

    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(800)

    const beginBtn = await page.$('button[data-act="begin"]')
    if (beginBtn) { await beginBtn.click(); await page.waitForTimeout(400) }
    const enterBtn = await page.$('button[data-act="enter"]')
    if (enterBtn) { await enterBtn.click(); await page.waitForTimeout(1200) }

    // Enter the RO-style Aura Market
    const enterMarketChip = await page.$('button[data-act="enter-market"]')
    if (enterMarketChip) {
      await enterMarketChip.click()
    } else {
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('temple:interact', { detail: 'market-portal' }))
      })
    }
    await page.waitForTimeout(2500)

    // 1. Test Birth Chart Hall & Human Design
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('market:interact', { detail: 'birth-chart-hall' }))
    })
    await page.waitForTimeout(800)
    // Switch to Human Design tab
    const hdTab = await page.$('button[data-tab="human-design"]')
    if (hdTab) {
      await hdTab.click()
      await page.waitForTimeout(500)
      // Submit Human Design calculation
      const submitBtn = await page.$('.hd-form button[type="submit"]')
      if (submitBtn) {
        await submitBtn.click()
        await page.waitForTimeout(1200)
      }
    }
    const hdPath = join(artifactDir, 'market_venue_human_design_live.png')
    await page.screenshot({ path: hdPath })
    console.log('Saved HD screenshot:', hdPath)

    // 2. Test Xiangqi Chess Pavilion on-site
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('market:interact', { detail: 'chess-guide' }))
    })
    await page.waitForTimeout(800)
    const flipAllBtn = await page.$('button[data-act="market-chess-flip-all"]')
    if (flipAllBtn) {
      await flipAllBtn.click()
      await page.waitForTimeout(800)
    }
    const chessPath = join(artifactDir, 'market_venue_chess_live.png')
    await page.screenshot({ path: chessPath })
    console.log('Saved Chess screenshot:', chessPath)

    // 3. Test Service Desk & Memo
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('market:interact', { detail: 'service-desk' }))
    })
    await page.waitForTimeout(800)
    const memoInput = await page.$('.ro-memo-input')
    if (memoInput) {
      await memoInput.fill('測試提問：我想請問今年下半年的轉職事業時機，以及感情貴人指引。')
      const saveMemoBtn = await page.$('button[data-act="service-memo-save"]')
      if (saveMemoBtn) {
        await saveMemoBtn.click()
        await page.waitForTimeout(500)
      }
    }
    const deskPath = join(artifactDir, 'market_venue_service_desk_live.png')
    await page.screenshot({ path: deskPath })
    console.log('Saved Service Desk screenshot:', deskPath)

    // 4. Test Card Sanctuary
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('market:interact', { detail: 'card-house' }))
    })
    await page.waitForTimeout(800)
    const cardTopicBtn = await page.$('button[data-card-topic="work"]')
    if (cardTopicBtn) {
      await cardTopicBtn.click()
      await page.waitForTimeout(800)
    }
    const cardPath = join(artifactDir, 'market_venue_cards_live.png')
    await page.screenshot({ path: cardPath })
    console.log('Saved Cards screenshot:', cardPath)

    // 5. Test Meditation Sanctuary
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('market:interact', { detail: 'moon-meditation' }))
    })
    await page.waitForTimeout(800)
    const medStartBtn = await page.$('button[data-act="meditation-start"]')
    if (medStartBtn) {
      await medStartBtn.click()
      await page.waitForTimeout(1200)
    }
    const medPath = join(artifactDir, 'market_venue_meditation_live.png')
    await page.screenshot({ path: medPath })
    console.log('Saved Meditation screenshot:', medPath)

    console.log('Page errors count:', errors.length, errors)
    await browser.close()
  } finally {
    server.kill()
  }
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
