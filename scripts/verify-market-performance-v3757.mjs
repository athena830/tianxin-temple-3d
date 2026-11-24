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

function calculateStats(numbers) {
  if (!numbers || !numbers.length) return { median: 0, min: 0, max: 0, avg: 0 }
  const sorted = [...numbers].sort((a, b) => a - b)
  const min = +sorted[0].toFixed(1)
  const max = +sorted[sorted.length - 1].toFixed(1)
  const avg = +(sorted.reduce((acc, v) => acc + v, 0) / sorted.length).toFixed(1)
  const mid = Math.floor(sorted.length / 2)
  const median = +(sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]).toFixed(1)
  return { median, min, max, avg }
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

// -------------------------------------------------------------
// Hard Assertions Venue Verification (6 Venues)
// -------------------------------------------------------------
async function runVenueRegression(page, label = 'Regression') {
  console.log(`\n=== [${label}] Running Strict 6-Venue Regression Acceptance ===`)

  await page.waitForFunction(() => {
    const sm = window.__game?.sceneManager
    return sm?.world === 'market' && sm?.state === 'idle'
  }, { timeout: 30000 })

  // 1. 命盤探索館
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('market:interact', { detail: 'birth-chart-hall' }))
  })
  await page.waitForFunction(() => !document.querySelector('.market-panel-wrap').hidden, { timeout: 5000 })

  const hdTab = await page.$('button[data-tab="human-design"]')
  if (!hdTab) throw new Error('[Regression] birth-chart-hall: data-tab="human-design" not found')
  await hdTab.click()
  await pause(300)

  const hdSubmit = await page.$('.hd-form button[type="submit"]')
  if (!hdSubmit) throw new Error('[Regression] birth-chart-hall: .hd-form submit button not found')
  await hdSubmit.click()
  await page.waitForSelector('.ro-hd-cards-grid', { timeout: 5000 })

  const closeBtn1 = await page.$('button[data-act="market-panel-close"]')
  if (!closeBtn1) throw new Error('[Regression] birth-chart-hall: close button not found')
  await closeBtn1.click()
  await page.waitForFunction(() => document.querySelector('.market-panel-wrap').hidden, { timeout: 3000 })

  // 2. 牌卡靈感屋
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('market:interact', { detail: 'card-house' }))
  })
  const topicBtn = await page.waitForSelector('button[data-card-topic="work"]', { timeout: 5000 })
  if (!topicBtn) throw new Error('[Regression] card-house: topic button not found')
  await topicBtn.click()
  await page.waitForSelector('.spread-grid', { timeout: 5000 })

  const closeBtn2 = await page.$('button[data-act="market-panel-close"]')
  await closeBtn2.click()
  await page.waitForFunction(() => document.querySelector('.market-panel-wrap').hidden, { timeout: 3000 })

  // 3. 月光靜心所
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('market:interact', { detail: 'moon-meditation' }))
  })
  const startMedBtn = await page.waitForSelector('button[data-act="meditation-start"]', { timeout: 5000 })
  if (!startMedBtn) throw new Error('[Regression] moon-meditation: start button not found')
  await startMedBtn.click()
  await pause(1200)

  const orbText = await page.evaluate(() => document.querySelector('.breathing-orb span')?.textContent?.trim())
  const sec = parseInt(orbText, 10)
  if (isNaN(sec) || sec >= 60) throw new Error(`[Regression] moon-meditation: timer did not decrement: ${orbText}`)

  const closeBtn3 = await page.$('button[data-act="market-panel-close"]')
  await closeBtn3.click()
  await page.waitForFunction(() => document.querySelector('.market-panel-wrap').hidden, { timeout: 3000 })

  // 4. 東方問事指引亭
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('market:interact', { detail: 'chess-guide' }))
  })
  const flipBtn = await page.waitForSelector('button[data-act="market-chess-flip-all"]', { timeout: 5000 })
  if (!flipBtn) throw new Error('[Regression] chess-guide: flip all button not found')
  await flipBtn.click()
  await page.waitForSelector('.result-pattern-name', { timeout: 5000 })

  const closeBtn4 = await page.$('button[data-act="market-panel-close"]')
  await closeBtn4.click()
  await page.waitForFunction(() => document.querySelector('.market-panel-wrap').hidden, { timeout: 3000 })

  // 5. 市集服務台
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('market:interact', { detail: 'service-desk' }))
  })
  const memoInput = await page.waitForSelector('.ro-memo-input', { timeout: 5000 })
  if (!memoInput) throw new Error('[Regression] service-desk: .ro-memo-input not found')
  await memoInput.fill('VER 3.75.7 嚴格回歸驗收。')

  const saveMemoBtn = await page.$('button[data-act="service-memo-save"]')
  await saveMemoBtn.click()
  await pause(200)

  // Verify 5 quick routes
  const quicks = [
    { target: 'birth-chart-hall', titleSub: '命盤' },
    { target: 'card-house', titleSub: '牌卡' },
    { target: 'moon-meditation', titleSub: '月光靜心' },
    { target: 'chess-guide', titleSub: '問事' },
    { target: 'life-numerology', titleSub: '生命靈數' },
  ]
  for (const q of quicks) {
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('market:interact', { detail: 'service-desk' }))
    })
    await page.waitForSelector('.market-service-actions', { timeout: 5000 })
    const btn = await page.$(`button[data-act="market-open-venue"][data-market-target="${q.target}"]`)
    if (!btn) throw new Error(`[Regression] service-desk: quick button ${q.target} not found`)
    await btn.click()
    await pause(300)
    const title = await page.evaluate(() => document.querySelector('[data-market-dialog-title]')?.textContent || '')
    if (!title.includes(q.titleSub)) throw new Error(`[Regression] quick button ${q.target} unexpected title: ${title}`)
  }

  // Reopen service desk to close via X
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('market:interact', { detail: 'service-desk' }))
  })
  const closeX = await page.waitForSelector('.panel-x[data-act="market-panel-close"]', { timeout: 5000 })
  await closeX.click()
  await page.waitForFunction(() => document.querySelector('.market-panel-wrap').hidden, { timeout: 3000 })

  // 6. 生命靈數館 (.num-calc-form & .num-result-box)
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('market:interact', { detail: 'life-numerology' }))
  })
  const numForm = await page.waitForSelector('.num-calc-form', { timeout: 5000 })
  if (!numForm) throw new Error('[Regression] life-numerology: .num-calc-form not found!')

  // Fill explicit date to eliminate timing/prefill ambiguity
  await page.fill('.num-calc-form input[name="birthdate"]', '1996-08-22')

  const numSubmit = await page.$('.num-calc-form button[type="submit"]') || await page.$('.num-submit-btn')
  if (!numSubmit) throw new Error('[Regression] life-numerology: submit button in .num-calc-form not found')
  await numSubmit.click()

  // Explicitly wait for .num-result-box to appear in DOM
  await page.waitForSelector('.num-result-box', { state: 'visible', timeout: 5000 })

  // Verify main number, analysis text and badge are truly rendered
  const resultVerified = await page.waitForFunction(() => {
    const box = document.querySelector('.num-result-box')
    if (!box) return false
    const heroTitle = box.querySelector('.num-hero-title')?.textContent?.trim()
    const badge = box.querySelector('.num-badge-circle')?.textContent?.trim()
    const formula = box.querySelector('.num-formula-tag')?.textContent?.trim()
    return !!(heroTitle && badge && formula)
  }, { timeout: 5000 }).catch(() => null)

  if (!resultVerified) {
    throw new Error('[Regression] life-numerology: .num-result-box contents failed to render within timeout!')
  }

  const closeBtn6 = await page.$('button[data-act="market-panel-close"]')
  await closeBtn6.click()
  await page.waitForFunction(() => document.querySelector('.market-panel-wrap').hidden, { timeout: 3000 })

  const finalMode = await page.evaluate(() => window.__game?.sceneManager?.current?.mode)
  if (!['explore', 'browse'].includes(finalMode)) throw new Error(`[Regression] Final market mode is ${finalMode}`)

  console.log(`=== [${label}] All 6 Venues Passed Strict Acceptance! ===`)
  return true
}

// -------------------------------------------------------------
// Measure In-Page Transition Helper (v3757: No fixed 8s truncation)
// -------------------------------------------------------------
async function measureMarketTransition(page, runIndex, testType, homeLoadMs = 0, consoleErrors = []) {
  // Setup in-page telemetry hooks before triggering portal
  await page.evaluate(() => {
    const sm = window.__game?.sceneManager
    if (!sm) return

    window.__runMetrics = {
      marketConstructionMs: 0,
      compileMs: 0,
      compileType: 'none',
      firstRenderMs: 0,
      frameDeltas: [],
      rendererInfo: null,
      collectionStart: performance.now(),
      collectionEnd: 0,
      collectionDurationMs: 0,
      totalFrames: 0,
    }

    // Instrument rAF frame deltas continuously
    let lastTime = performance.now()
    window.__rafActive = true
    function frameStep(now) {
      if (!window.__rafActive) return
      const delta = now - lastTime
      lastTime = now
      window.__runMetrics.frameDeltas.push(+delta.toFixed(2))
      requestAnimationFrame(frameStep)
    }
    requestAnimationFrame(frameStep)

    const origCreateMarket = sm.options.createMarket.bind(sm.options)
    sm.options.createMarket = async function() {
      const tConstStart = performance.now()
      const marketGame = await origCreateMarket()
      window.__runMetrics.marketConstructionMs = +(performance.now() - tConstStart).toFixed(2)

      // Hook first frame render: MarketGame.render(_alpha, frameSeconds)
      const origRender = marketGame.render.bind(marketGame)
      let firstFrameDone = false
      marketGame.render = function(alpha, frameSeconds) {
        if (!firstFrameDone) {
          const tRStart = performance.now()
          origRender(alpha, frameSeconds)
          window.__runMetrics.firstRenderMs = +(performance.now() - tRStart).toFixed(2)
          firstFrameDone = true

          // Read compileMs and compileType from SceneManager / Renderer
          window.__runMetrics.compileMs = sm.lastMarketCompileMs || 0
          window.__runMetrics.compileType = typeof marketGame.renderer?.gl?.compileAsync === 'function' ? 'compileAsync' : 'unsupported'

          // Read renderer.gl.info directly from marketGame.renderer
          try {
            const gl = marketGame.renderer?.gl
            if (gl && gl.info) {
              const calls = typeof gl.info.render?.calls === 'number' ? gl.info.render.calls : '未確認／不適用'
              const triangles = typeof gl.info.render?.triangles === 'number' ? gl.info.render.triangles : '未確認／不適用'
              let programs = '未確認／不適用'
              if (gl.info.programs && Array.isArray(gl.info.programs)) {
                programs = gl.info.programs.length
              }
              window.__runMetrics.rendererInfo = {
                calls,
                triangles,
                programs,
                dataSource: 'marketGame.renderer.gl.info',
                readAt: Date.now(),
              }
            }
          } catch (e) {
            window.__runMetrics.rendererInfo = {
              calls: '未確認／不適用',
              triangles: '未確認／不適用',
              programs: '未確認／不適用',
              error: e.message,
            }
          }
        } else {
          origRender(alpha, frameSeconds)
        }
      }

      return marketGame
    }
  })

  const tClickPortal = Date.now()
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('temple:interact', { detail: 'market-portal' }))
  })

  // Wait until market is operable and idle
  await page.waitForFunction(() => {
    const sm = window.__game?.sceneManager
    return sm?.world === 'market' && sm?.state === 'idle'
  }, { timeout: 30000 })
  const timeToMarketInteractiveMs = Date.now() - tClickPortal

  // Continue measuring until market has remained continuously in idle for at least 1.0s (no state change)
  const idleStart = Date.now()
  while (Date.now() - idleStart < 1000) {
    const isStillIdle = await page.evaluate(() => {
      const sm = window.__game?.sceneManager
      return sm?.world === 'market' && sm?.state === 'idle'
    })
    if (!isStillIdle) {
      throw new Error('SceneManager state transitioned unexpectedly during post-entry idle check!')
    }
    await pause(100)
  }

  // Stop rAF collection and read all metrics
  const inPage = await page.evaluate(() => {
    window.__rafActive = false
    window.__runMetrics.collectionEnd = performance.now()
    window.__runMetrics.collectionDurationMs = +(window.__runMetrics.collectionEnd - window.__runMetrics.collectionStart).toFixed(2)
    window.__runMetrics.totalFrames = window.__runMetrics.frameDeltas.length
    return window.__runMetrics
  })

  const deltas = inPage.frameDeltas || []
  const sortedDeltas = [...deltas].sort((a, b) => a - b)
  const longFrameCount = deltas.filter(d => d > 50).length
  const over100msFrameCount = deltas.filter(d => d > 100).length
  const maxFrameMs = sortedDeltas.length ? sortedDeltas[sortedDeltas.length - 1] : 0

  return {
    testType,
    runIndex,
    browser: 'chromium',
    version: 'VER 3.75.7',
    homeLoadMs,
    marketConstructionMs: inPage.marketConstructionMs,
    compileMs: inPage.compileMs,
    compileType: inPage.compileType,
    firstRenderMs: inPage.firstRenderMs,
    timeToMarketInteractiveMs,
    maxFrameMs,
    longFrameCount,
    over100msFrameCount,
    collectionDurationMs: inPage.collectionDurationMs,
    totalFrames: inPage.totalFrames,
    rendererInfo: inPage.rendererInfo,
    consoleErrors,
  }
}

// -------------------------------------------------------------
// Main Test Runner
// -------------------------------------------------------------
async function run() {
  console.log('Starting preview server...')
  const preview = startPreviewServer()
  await waitForServer(BASE_URL)
  console.log(`Preview server ready at ${BASE_URL}`)

  const masterReport = {
    version: 'VER 3.75.7',
    date: new Date().toISOString(),
    preRegressionPassed: false,
    postRegressionPassed: false,
    coldRuns: [],
    warmReentries: [],
    coldStats: {},
    warmStats: {},
  }

  try {
    // -------------------------------------------------------------
    // Phase 1: Pre-Measurement Acceptance (Desktop 1440x900)
    // -------------------------------------------------------------
    console.log('\n--- Phase 1: Pre-Measurement Acceptance (Desktop) ---')
    {
      const browser = await chromium.launch({ channel: 'chrome', headless: true })
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      const page = await context.newPage()
      await page.goto(BASE_URL)
      await page.waitForFunction(() => !!window.__game?.sceneManager, { timeout: 30000 })
      await pause(1000)

      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('temple:interact', { detail: 'market-portal' }))
      })
      await page.waitForFunction(() => {
        const sm = window.__game?.sceneManager
        return sm?.world === 'market' && sm?.state === 'idle'
      }, { timeout: 30000 })
      await pause(1000)

      await runVenueRegression(page, 'Desktop Pre-Measurement')
      masterReport.preRegressionPassed = true
      await browser.close()
    }

    // -------------------------------------------------------------
    // Phase 2: Cold Entry (5 runs in fresh processes/contexts)
    // -------------------------------------------------------------
    console.log('\n--- Phase 2: Cold Entry Benchmark (5 runs, fresh context) ---')
    for (let i = 1; i <= 5; i++) {
      console.log(`\n[Cold Entry] Run ${i} / 5...`)
      const browser = await chromium.launch({ channel: 'chrome', headless: true })
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      const page = await context.newPage()
      const consoleErrors = []
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text())
      })

      const tStart = Date.now()
      await page.goto(BASE_URL)
      await page.waitForFunction(() => !!window.__game?.sceneManager, { timeout: 30000 })
      const homeLoadMs = Date.now() - tStart

      const metrics = await measureMarketTransition(page, i, 'Cold Entry (新瀏覽器程序下冷頁面進入)', homeLoadMs, consoleErrors)
      masterReport.coldRuns.push(metrics)
      console.log(`Run ${i} Cold Metrics:`, {
        compileMs: metrics.compileMs,
        firstRenderMs: metrics.firstRenderMs,
        timeToMarketInteractiveMs: metrics.timeToMarketInteractiveMs,
        maxFrameMs: metrics.maxFrameMs,
        longFrameCount: metrics.longFrameCount,
        over100msFrameCount: metrics.over100msFrameCount,
        collectionDurationMs: metrics.collectionDurationMs,
        totalFrames: metrics.totalFrames,
        calls: metrics.rendererInfo?.calls,
        triangles: metrics.rendererInfo?.triangles,
        programs: metrics.rendererInfo?.programs,
      })

      await browser.close()
    }

    // -------------------------------------------------------------
    // Phase 3: Genuine Warm Re-entry (5 consecutive re-entries, same context)
    // -------------------------------------------------------------
    console.log('\n--- Phase 3: Genuine Warm Re-entry Benchmark (5 consecutive runs, same context) ---')
    {
      const browser = await chromium.launch({ channel: 'chrome', headless: true })
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      const page = await context.newPage()
      const consoleErrors = []
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text())
      })

      // Initial entry into market
      console.log('Seeding initial market entry to warm WebGL context & shaders...')
      await page.goto(BASE_URL)
      await page.waitForFunction(() => !!window.__game?.sceneManager, { timeout: 30000 })
      await pause(500)
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('temple:interact', { detail: 'market-portal' }))
      })
      await page.waitForFunction(() => {
        const sm = window.__game?.sceneManager
        return sm?.world === 'market' && sm?.state === 'idle'
      }, { timeout: 30000 })
      await pause(1000)

      for (let w = 1; w <= 5; w++) {
        console.log(`\n[Genuine Warm Re-entry] Re-entry ${w} / 5...`)
        // Return to temple
        await page.evaluate(() => {
          window.dispatchEvent(new CustomEvent('market:interact', { detail: 'return-temple' }))
        })
        await page.waitForFunction(() => {
          const sm = window.__game?.sceneManager
          return sm?.world === 'temple' && sm?.state === 'idle'
        }, { timeout: 30000 })
        await pause(600)

        // Measure re-entry into market
        const warmMetrics = await measureMarketTransition(page, w, 'Genuine Warm Re-entry (同一頁面連續重入)', 0, consoleErrors)
        masterReport.warmReentries.push(warmMetrics)
        console.log(`Re-entry ${w} Warm Metrics:`, {
          compileMs: warmMetrics.compileMs,
          firstRenderMs: warmMetrics.firstRenderMs,
          timeToMarketInteractiveMs: warmMetrics.timeToMarketInteractiveMs,
          maxFrameMs: warmMetrics.maxFrameMs,
          longFrameCount: warmMetrics.longFrameCount,
          over100msFrameCount: warmMetrics.over100msFrameCount,
          collectionDurationMs: warmMetrics.collectionDurationMs,
          totalFrames: warmMetrics.totalFrames,
          programs: warmMetrics.rendererInfo?.programs,
        })
      }

      await browser.close()
    }

    // Compute statistics
    masterReport.coldStats = {
      firstRenderMs: calculateStats(masterReport.coldRuns.map(r => r.firstRenderMs)),
      compileMs: calculateStats(masterReport.coldRuns.map(r => r.compileMs)),
      totalInteractiveMs: calculateStats(masterReport.coldRuns.map(r => r.timeToMarketInteractiveMs)),
      maxFrameMs: calculateStats(masterReport.coldRuns.map(r => r.maxFrameMs)),
      marketConstructionMs: calculateStats(masterReport.coldRuns.map(r => r.marketConstructionMs)),
      longFrameCount: calculateStats(masterReport.coldRuns.map(r => r.longFrameCount)),
      over100msFrameCount: calculateStats(masterReport.coldRuns.map(r => r.over100msFrameCount)),
      collectionDurationMs: calculateStats(masterReport.coldRuns.map(r => r.collectionDurationMs)),
    }

    masterReport.warmStats = {
      firstRenderMs: calculateStats(masterReport.warmReentries.map(r => r.firstRenderMs)),
      compileMs: calculateStats(masterReport.warmReentries.map(r => r.compileMs)),
      totalInteractiveMs: calculateStats(masterReport.warmReentries.map(r => r.timeToMarketInteractiveMs)),
      maxFrameMs: calculateStats(masterReport.warmReentries.map(r => r.maxFrameMs)),
      marketConstructionMs: calculateStats(masterReport.warmReentries.map(r => r.marketConstructionMs)),
      longFrameCount: calculateStats(masterReport.warmReentries.map(r => r.longFrameCount)),
      over100msFrameCount: calculateStats(masterReport.warmReentries.map(r => r.over100msFrameCount)),
      collectionDurationMs: calculateStats(masterReport.warmReentries.map(r => r.collectionDurationMs)),
    }

    // -------------------------------------------------------------
    // Phase 4: Post-Measurement Acceptance (Mobile 390x844)
    // -------------------------------------------------------------
    console.log('\n--- Phase 4: Post-Measurement Acceptance (Mobile 390x844) ---')
    {
      const browser = await chromium.launch({ channel: 'msedge', headless: true })
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
        hasTouch: true,
        isMobile: true,
      })
      const page = await context.newPage()
      await page.goto(BASE_URL)
      await page.waitForFunction(() => !!window.__game?.sceneManager, { timeout: 30000 })
      await pause(1000)

      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('temple:interact', { detail: 'market-portal' }))
      })
      await page.waitForFunction(() => {
        const sm = window.__game?.sceneManager
        return sm?.world === 'market' && sm?.state === 'idle'
      }, { timeout: 30000 })
      await pause(1000)

      await runVenueRegression(page, 'Mobile Post-Measurement')
      masterReport.postRegressionPassed = true
      await browser.close()
    }

    // Save output artifacts
    const masterPath = join(artifactDir, 'perf_market_v3757_master.json')
    writeFileSync(masterPath, JSON.stringify(masterReport, null, 2))
    console.log(`\nSuccessfully saved master report to ${masterPath}`)

    const coldPath = join(artifactDir, 'perf_v3757_cold_runs.json')
    writeFileSync(coldPath, JSON.stringify(masterReport.coldRuns, null, 2))

    const warmPath = join(artifactDir, 'perf_v3757_warm_runs.json')
    writeFileSync(warmPath, JSON.stringify(masterReport.warmReentries, null, 2))

    console.log('=== VER 3.75.7 Verification Complete! ===')
  } finally {
    preview.kill()
  }
}

run().catch(err => {
  console.error('Fatal Verification Error:', err)
  process.exit(1)
})
