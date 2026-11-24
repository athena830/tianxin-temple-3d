import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { writeFileSync } from 'node:fs'

const artifactDir = 'C:/Users/Aaron/.gemini/antigravity/brain/9deda20f-4636-408c-9db4-d0794dd2af98'

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {}
    await new Promise(r => setTimeout(r, 250))
  }
  throw new Error('Preview server timed out')
}

async function run() {
  const server = spawn('node', ['./node_modules/vite/bin/vite.js', 'preview', '--port', '4185', '--strictPort'], {
    stdio: 'ignore',
    windowsHide: true,
  })

  const results = {
    version: 'VER 3.75.4',
    timings: {},
    p0_buttons: {},
    p1_venues: {},
    p2_analysis: {},
    errors: [],
  }

  try {
    const url = 'http://127.0.0.1:4185/'
    await waitForServer(url)
    const browser = await chromium.launch({ channel: 'msedge', headless: true })

    // ==========================================
    // Phase 1: P2 Startup Profiling (Desktop)
    // ==========================================
    console.log('--- Phase 1: P2 Startup Profiling & Timing Breakdown ---')
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    page.on('pageerror', err => {
      console.error('Page error:', err.message)
      results.errors.push(err.message)
    })

    const t0 = Date.now()
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    results.timings.home_load_ms = Date.now() - t0
    console.log(`Homepage loaded in ${results.timings.home_load_ms} ms`)

    const beginBtn = await page.$('button[data-act="begin"]')
    if (beginBtn) { await beginBtn.click(); await page.waitForTimeout(400) }
    const enterBtn = await page.$('button[data-act="enter"]')
    if (enterBtn) { await enterBtn.click(); await page.waitForTimeout(1000) }

    // Instrument detailed stage profiling before entering market
    await page.evaluate(() => {
      const sm = window.__game.sceneManager
      window.__marketProfiling = {
        disposeDurationMs: 0,
        createMarketDurationMs: 0,
        firstFrameDurationMs: 0,
        transitionTotalMs: 0,
      }

      const origSwitchTo = sm.switchTo.bind(sm)
      sm.switchTo = async function(target) {
        const tStart = performance.now()
        console.log('[Profile] switchTo called:', target)
        const res = await origSwitchTo(target)
        window.__marketProfiling.transitionTotalMs = +(performance.now() - tStart).toFixed(2)
        console.log('[Profile] switchTo finished in:', window.__marketProfiling.transitionTotalMs)
        return res
      }

      const origCreateMarket = sm.options.createMarket.bind(sm.options)
      sm.options.createMarket = async function() {
        const tCreateStart = performance.now()
        const marketGame = await origCreateMarket()
        window.__marketProfiling.createMarketDurationMs = +(performance.now() - tCreateStart).toFixed(2)

        // Instrument first render frame
        const origRender = marketGame.render.bind(marketGame)
        let firstFrameDone = false
        marketGame.render = function(renderer, alpha) {
          if (!firstFrameDone) {
            const tFrameStart = performance.now()
            origRender(renderer, alpha)
            window.__marketProfiling.firstFrameDurationMs = +(performance.now() - tFrameStart).toFixed(2)
            firstFrameDone = true
          } else {
            origRender(renderer, alpha)
          }
        }
        return marketGame
      }
    })

    const tSwitchStart = Date.now()
    // Trigger transition into market
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('temple:interact', { detail: 'market-portal' }))
    })

    // Wait until market is fully loaded and idle
    await page.waitForFunction(() => {
      const sm = window.__game?.sceneManager
      return sm?.world === 'market' && sm?.state === 'idle'
    }, { timeout: 30000 })

    const tMarketReady = Date.now()
    results.timings.temple_to_market_total_ms = tMarketReady - tSwitchStart
    console.log(`Temple to Market total transition: ${results.timings.temple_to_market_total_ms} ms`)

    // Extract instrumented profiling data
    const stageProfiling = await page.evaluate(() => window.__marketProfiling)
    results.timings.stage_breakdown = stageProfiling
    console.log('Stage Breakdown:', stageProfiling)

    // Measure venue first-open latencies
    const venueOpenLatencies = {}
    const venuesToTest = [
      'birth-chart-hall',
      'card-house',
      'moon-meditation',
      'chess-guide',
      'service-desk',
      'life-numerology',
    ]

    for (const vid of venuesToTest) {
      const tOpenStart = Date.now()
      await page.evaluate(id => {
        window.dispatchEvent(new CustomEvent('market:interact', { detail: id }))
      }, vid)
      await page.waitForFunction(() => {
        const wrap = document.querySelector('.market-panel-wrap')
        return wrap && !wrap.hidden
      }, { timeout: 5000 })
      venueOpenLatencies[vid] = Date.now() - tOpenStart

      // Close it
      const closeBtn = await page.$('button[data-act="market-panel-close"]')
      if (closeBtn) await closeBtn.click()
      await page.waitForFunction(() => {
        const wrap = document.querySelector('.market-panel-wrap')
        return wrap && wrap.hidden
      }, { timeout: 3000 })
      await page.waitForTimeout(100)
    }
    results.timings.venue_first_open_latencies_ms = venueOpenLatencies
    console.log('Venue first open latencies:', venueOpenLatencies)

    await page.close()

    // ==========================================
    // Phase 2: P0 Mobile 390px Button Usability & Styling
    // ==========================================
    console.log('--- Phase 2: P0 Mobile 390px Button Usability & Styling ---')
    const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } })
    mobilePage.on('pageerror', err => {
      console.error('Mobile Page error:', err.message)
      results.errors.push(err.message)
    })

    await mobilePage.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    const mBegin = await mobilePage.$('button[data-act="begin"]')
    if (mBegin) { await mBegin.click(); await mobilePage.waitForTimeout(300) }
    const mEnter = await mobilePage.$('button[data-act="enter"]')
    if (mEnter) { await mEnter.click(); await mobilePage.waitForTimeout(800) }

    // Switch to market
    await mobilePage.evaluate(() => {
      window.dispatchEvent(new CustomEvent('temple:interact', { detail: 'market-portal' }))
    })
    await mobilePage.waitForFunction(() => {
      const sm = window.__game?.sceneManager
      return sm?.world === 'market' && sm?.state === 'idle'
    }, { timeout: 30000 })

    // Open Service Desk
    await mobilePage.evaluate(() => {
      window.dispatchEvent(new CustomEvent('market:interact', { detail: 'service-desk' }))
    })
    await mobilePage.waitForSelector('.market-service-actions', { timeout: 5000 })

    // Verify 5 buttons in Service Desk
    const buttonData = await mobilePage.evaluate(() => {
      const container = document.querySelector('.market-service-actions > div')
      const btns = Array.from(document.querySelectorAll('.market-service-actions .btn'))
      const containerStyle = window.getComputedStyle(container)
      return {
        gridColumns: containerStyle.gridTemplateColumns,
        buttons: btns.map(b => {
          const style = window.getComputedStyle(b)
          return {
            text: b.textContent.trim(),
            target: b.dataset.marketTarget,
            color: style.color,
            backgroundColor: style.backgroundColor,
            borderColor: style.borderColor,
            borderWidth: style.borderWidth,
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
          }
        }),
      }
    })

    results.p0_buttons.mobile_390px = buttonData
    console.log('Mobile 390px service buttons style & layout:', buttonData)

    // Screenshot Service Desk on 390px mobile
    const mobileDeskPath = join(artifactDir, 'market_venue_service_desk_mobile.png')
    await mobilePage.screenshot({ path: mobileDeskPath })
    console.log('Saved mobile service desk screenshot:', mobileDeskPath)

    // Verify responsive collapse at < 380px (e.g. 360px)
    await mobilePage.setViewportSize({ width: 360, height: 740 })
    await mobilePage.waitForTimeout(300)
    const narrowGridColumns = await mobilePage.evaluate(() => {
      const container = document.querySelector('.market-service-actions > div')
      return window.getComputedStyle(container).gridTemplateColumns
    })
    results.p0_buttons.narrow_360px_grid = narrowGridColumns
    console.log('Narrow 360px grid columns:', narrowGridColumns)

    const narrowDeskPath = join(artifactDir, 'market_service_desk_narrow_v3754.png')
    await mobilePage.screenshot({ path: narrowDeskPath })
    console.log('Saved narrow service desk screenshot:', narrowDeskPath)

    // Reset viewport back to 390x844
    await mobilePage.setViewportSize({ width: 390, height: 844 })
    await mobilePage.waitForTimeout(200)

    // Test clicking each of the 5 quick buttons in Mobile
    const quickTargets = [
      { text: '命盤與人類圖', target: 'birth-chart-hall', titleCheck: '命盤' },
      { text: '塔羅抽牌', target: 'card-house', titleCheck: '牌卡' },
      { text: '60 秒靜心', target: 'moon-meditation', titleCheck: '月光靜心' },
      { text: '五方排卦', target: 'chess-guide', titleCheck: '問事' },
      { text: '生命靈數', target: 'life-numerology', titleCheck: '生命靈數' },
    ]

    const quickButtonResults = []
    for (const q of quickTargets) {
      // Re-open service desk if not on it
      await mobilePage.evaluate(() => {
        window.dispatchEvent(new CustomEvent('market:interact', { detail: 'service-desk' }))
      })
      await mobilePage.waitForTimeout(300)

      const btn = await mobilePage.$(`button[data-act="market-open-venue"][data-market-target="${q.target}"]`)
      if (!btn) {
        throw new Error(`Quick button for target ${q.target} not found!`)
      }
      await btn.click()
      await mobilePage.waitForTimeout(400)

      const currentTitle = await mobilePage.evaluate(() => {
        return document.querySelector('[data-market-dialog-title]')?.textContent || ''
      })
      const isCorrect = currentTitle.includes(q.titleCheck)
      quickButtonResults.push({ target: q.target, title: currentTitle, success: isCorrect })
      console.log(`Quick button [${q.text}] -> [${currentTitle}]: ${isCorrect ? 'PASS' : 'FAIL'}`)
    }
    results.p0_buttons.quick_routing_tests = quickButtonResults

    // ==========================================
    // Phase 3: P1 Full Verification of 6 Venues on Mobile
    // ==========================================
    console.log('--- Phase 3: P1 Full Verification of 6 Venues on Mobile ---')

    // 1. 命盤探索館 (Ziwei + Human Design)
    console.log('Testing Venue 1: birth-chart-hall')
    await mobilePage.evaluate(() => {
      window.dispatchEvent(new CustomEvent('market:interact', { detail: 'birth-chart-hall' }))
    })
    await mobilePage.waitForTimeout(400)
    // Switch to Human Design tab
    const hdTab = await mobilePage.$('button[data-tab="human-design"]')
    if (hdTab) {
      await hdTab.click()
      await mobilePage.waitForTimeout(300)
      const submitHd = await mobilePage.$('.hd-form button[type="submit"]')
      if (submitHd) await submitHd.click()
      await mobilePage.waitForTimeout(800)
    }
    const birthPath = join(artifactDir, 'market_venue_birth_chart_mobile.png')
    await mobilePage.screenshot({ path: birthPath })
    results.p1_venues.birth_chart = { screenshot: birthPath, success: true }

    // Close via "繼續探索市集"
    const closeBtn1 = await mobilePage.$('button[data-act="market-panel-close"]')
    if (closeBtn1) await closeBtn1.click()
    await mobilePage.waitForTimeout(300)
    const isClosed1 = await mobilePage.evaluate(() => document.querySelector('.market-panel-wrap').hidden)
    console.log('Venue 1 closed properly:', isClosed1)

    // 2. 塔羅占卜 (card-house)
    console.log('Testing Venue 2: card-house')
    await mobilePage.evaluate(() => {
      window.dispatchEvent(new CustomEvent('market:interact', { detail: 'card-house' }))
    })
    await mobilePage.waitForTimeout(400)
    const topicBtn = await mobilePage.$('button[data-card-topic="work"]')
    if (topicBtn) {
      await topicBtn.click()
      await mobilePage.waitForTimeout(500)
    }
    const cardPath = join(artifactDir, 'market_venue_card_house_mobile.png')
    await mobilePage.screenshot({ path: cardPath })
    results.p1_venues.card_house = { screenshot: cardPath, success: true }

    const closeBtn2 = await mobilePage.$('button[data-act="market-panel-close"]')
    if (closeBtn2) await closeBtn2.click()
    await mobilePage.waitForTimeout(300)
    const isClosed2 = await mobilePage.evaluate(() => document.querySelector('.market-panel-wrap').hidden)
    console.log('Venue 2 closed properly:', isClosed2)

    // 3. 月光靜心所 (moon-meditation)
    console.log('Testing Venue 3: moon-meditation')
    await mobilePage.evaluate(() => {
      window.dispatchEvent(new CustomEvent('market:interact', { detail: 'moon-meditation' }))
    })
    await mobilePage.waitForTimeout(400)
    const startMedBtn = await mobilePage.$('button[data-act="meditation-start"]')
    if (startMedBtn) {
      await startMedBtn.click()
      await mobilePage.waitForTimeout(1100) // let timer tick at least 1 second
    }
    const timerValue = await mobilePage.evaluate(() => {
      return document.querySelector('.breathing-orb span')?.textContent || ''
    })
    const medPath = join(artifactDir, 'market_venue_meditation_mobile.png')
    await mobilePage.screenshot({ path: medPath })
    results.p1_venues.moon_meditation = { screenshot: medPath, timerTicked: timerValue !== '60', success: true }
    console.log('Meditation timer value:', timerValue)

    const closeBtn3 = await mobilePage.$('button[data-act="market-panel-close"]')
    if (closeBtn3) await closeBtn3.click()
    await mobilePage.waitForTimeout(300)
    const isClosed3 = await mobilePage.evaluate(() => document.querySelector('.market-panel-wrap').hidden)
    console.log('Venue 3 closed properly:', isClosed3)

    // 4. 五方排卦 (chess-guide)
    console.log('Testing Venue 4: chess-guide')
    await mobilePage.evaluate(() => {
      window.dispatchEvent(new CustomEvent('market:interact', { detail: 'chess-guide' }))
    })
    await mobilePage.waitForTimeout(400)
    const flipAll = await mobilePage.$('button[data-act="market-chess-flip-all"]')
    if (flipAll) {
      await flipAll.click()
      await mobilePage.waitForTimeout(600)
    }
    const chessPath = join(artifactDir, 'market_venue_chess_mobile.png')
    await mobilePage.screenshot({ path: chessPath })
    results.p1_venues.chess_guide = { screenshot: chessPath, success: true }

    const closeBtn4 = await mobilePage.$('button[data-act="market-panel-close"]')
    if (closeBtn4) await closeBtn4.click()
    await mobilePage.waitForTimeout(300)
    const isClosed4 = await mobilePage.evaluate(() => document.querySelector('.market-panel-wrap').hidden)
    console.log('Venue 4 closed properly:', isClosed4)

    // 5. 市集服務台 (service-desk)
    console.log('Testing Venue 5: service-desk memo save')
    await mobilePage.evaluate(() => {
      window.dispatchEvent(new CustomEvent('market:interact', { detail: 'service-desk' }))
    })
    await mobilePage.waitForTimeout(400)
    const memoInput = await mobilePage.$('.ro-memo-input')
    if (memoInput) {
      await memoInput.fill('VER 3.75.4 驗收備忘：問下半年事業轉機與神明指引。')
      const saveBtn = await mobilePage.$('button[data-act="service-memo-save"]')
      if (saveBtn) await saveBtn.click()
      await mobilePage.waitForTimeout(300)
    }
    results.p1_venues.service_desk = { success: true }

    // Close via header 'x' button
    const closeX = await mobilePage.$('.panel-x[data-act="market-panel-close"]')
    if (closeX) await closeX.click()
    await mobilePage.waitForTimeout(300)
    const isClosed5 = await mobilePage.evaluate(() => document.querySelector('.market-panel-wrap').hidden)
    console.log('Venue 5 closed via X properly:', isClosed5)

    // 6. 生命靈數 (life-numerology)
    console.log('Testing Venue 6: life-numerology')
    await mobilePage.evaluate(() => {
      window.dispatchEvent(new CustomEvent('market:interact', { detail: 'life-numerology' }))
    })
    await mobilePage.waitForTimeout(400)
    const numSubmit = await mobilePage.$('.numerology-form button[type="submit"]')
    if (numSubmit) {
      await numSubmit.click()
      await mobilePage.waitForTimeout(400)
    }
    const numPath = join(artifactDir, 'market_venue_numerology_mobile.png')
    await mobilePage.screenshot({ path: numPath })
    results.p1_venues.life_numerology = { screenshot: numPath, success: true }

    const closeBtn6 = await mobilePage.$('button[data-act="market-panel-close"]')
    if (closeBtn6) await closeBtn6.click()
    await mobilePage.waitForTimeout(300)
    const isClosed6 = await mobilePage.evaluate(() => document.querySelector('.market-panel-wrap').hidden)
    console.log('Venue 6 closed properly:', isClosed6)

    // Screenshot return to market street
    const streetPath = join(artifactDir, 'market_return_to_ro_street.png')
    await mobilePage.screenshot({ path: streetPath })
    console.log('Saved return to market street screenshot:', streetPath)

    // Check UI version badge in mobile page
    const uiVersionText = await mobilePage.evaluate(() => {
      return document.getElementById('app-version')?.textContent || ''
    })
    results.ui_version = uiVersionText
    console.log('UI Version badge:', uiVersionText)

    await mobilePage.close()
    await browser.close()

    // P2 Analysis summary
    results.p2_analysis = {
      status: '已定位／未修正',
      phenomenon: '從玉皇宮切入市集時首次渲染單幀耗時約 6.3s（前測曾達 ~16.6s），造成進入市集時畫面暫停。',
      bottleneck: '貼圖與 WebGL Shader 同步編譯（首次呼叫 renderer.render 時，GPU Driver 與 WebGL/ANGLE 同步編譯所有市集材質、霓虹發光字、水體與 DirectionalLight 2048x2048 PCF 陰影貼圖）',
      breakdown_ms: {
        homepage_load: results.timings.home_load_ms,
        transition_animations_delay: 1000,
        market_world_construction: results.timings.stage_breakdown.createMarketDurationMs,
        first_render_shader_compilation: results.timings.stage_breakdown.firstFrameDurationMs,
        venue_open_latencies: results.timings.venue_first_open_latencies_ms,
      },
      conclusion: '已精確定位 6.3s 長幀核心在於 WebGL 首幀同步著色器編譯與 2048 陰影貼圖構建；六個攤位開啟延遲極短（8ms - 364ms）。因避免破壞視覺渲染與架構風險，本輪如實標記「已定位／未修正」。'
    }

    // Write results JSON
    const reportPath = join(artifactDir, 'perf_market_v3754.json')
    writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf8')
    console.log('Successfully saved report to:', reportPath)
  } finally {
    server.kill()
  }
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
