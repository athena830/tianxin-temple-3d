import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { writeFileSync, mkdirSync } from 'node:fs'

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

// -------------------------------------------------------------
// Hard Assertions Venue Verification (Section 1 & 2)
// -------------------------------------------------------------
async function runVenueRegression(page, label = 'Regression') {
  console.log(`\n=== [${label}] Running Strict 6-Venue Regression Acceptance ===`)

  // Ensure market is ready
  await page.waitForFunction(() => {
    const sm = window.__game?.sceneManager
    return sm?.world === 'market' && sm?.state === 'idle'
  }, { timeout: 30000 })

  // 1. 命盤探索館
  console.log(`[${label}] Testing Venue 1: birth-chart-hall...`)
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('market:interact', { detail: 'birth-chart-hall' }))
  })
  await page.waitForFunction(() => {
    const wrap = document.querySelector('.market-panel-wrap')
    return wrap && !wrap.hidden
  }, { timeout: 5000 })

  const hdTab = await page.$('button[data-tab="human-design"]')
  if (!hdTab) throw new Error('[Regression] birth-chart-hall: data-tab="human-design" not found')
  await hdTab.click()
  await pause(300)

  const hdSubmit = await page.$('.hd-form button[type="submit"]')
  if (!hdSubmit) throw new Error('[Regression] birth-chart-hall: .hd-form button[type="submit"] not found')
  await hdSubmit.click()
  await page.waitForSelector('.ro-hd-cards-grid', { timeout: 5000 })
  console.log(`[${label}] birth-chart-hall: Human Design calculated & cards rendered PASS`)

  const closeBtn1 = await page.$('button[data-act="market-panel-close"]')
  if (!closeBtn1) throw new Error('[Regression] birth-chart-hall: close button not found')
  await closeBtn1.click()
  await page.waitForFunction(() => document.querySelector('.market-panel-wrap').hidden, { timeout: 3000 })
  const mode1 = await page.evaluate(() => window.__game?.sceneManager?.current?.mode)
  if (!['explore', 'browse'].includes(mode1)) throw new Error(`[Regression] Venue 1 closed but mode is ${mode1}`)

  // 2. 牌卡靈感屋
  console.log(`[${label}] Testing Venue 2: card-house...`)
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('market:interact', { detail: 'card-house' }))
  })
  await page.waitForFunction(() => !document.querySelector('.market-panel-wrap').hidden, { timeout: 5000 })

  const topicBtn = await page.$('button[data-card-topic="work"]')
  if (!topicBtn) throw new Error('[Regression] card-house: topic button not found')
  await topicBtn.click()
  await page.waitForSelector('.spread-grid', { timeout: 5000 })
  console.log(`[${label}] card-house: 3-card spread rendered PASS`)

  const closeBtn2 = await page.$('button[data-act="market-panel-close"]')
  if (!closeBtn2) throw new Error('[Regression] card-house: close button not found')
  await closeBtn2.click()
  await page.waitForFunction(() => document.querySelector('.market-panel-wrap').hidden, { timeout: 3000 })

  // 3. 月光靜心所
  console.log(`[${label}] Testing Venue 3: moon-meditation...`)
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('market:interact', { detail: 'moon-meditation' }))
  })
  await page.waitForFunction(() => !document.querySelector('.market-panel-wrap').hidden, { timeout: 5000 })

  const startMedBtn = await page.$('button[data-act="meditation-start"]')
  if (!startMedBtn) throw new Error('[Regression] moon-meditation: start button not found')
  await startMedBtn.click()
  await pause(1200)

  const orbText = await page.evaluate(() => document.querySelector('.breathing-orb span')?.textContent?.trim())
  const sec = parseInt(orbText, 10)
  if (isNaN(sec) || sec >= 60) throw new Error(`[Regression] moon-meditation: timer did not decrement, current: ${orbText}`)
  console.log(`[${label}] moon-meditation: countdown ticked to ${sec}s PASS`)

  const closeBtn3 = await page.$('button[data-act="market-panel-close"]')
  if (!closeBtn3) throw new Error('[Regression] moon-meditation: close button not found')
  await closeBtn3.click()
  await page.waitForFunction(() => document.querySelector('.market-panel-wrap').hidden, { timeout: 3000 })

  // 4. 東方問事指引亭
  console.log(`[${label}] Testing Venue 4: chess-guide...`)
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('market:interact', { detail: 'chess-guide' }))
  })
  await page.waitForFunction(() => !document.querySelector('.market-panel-wrap').hidden, { timeout: 5000 })

  const flipBtn = await page.$('button[data-act="market-chess-flip-all"]')
  if (!flipBtn) throw new Error('[Regression] chess-guide: flip all button not found')
  await flipBtn.click()
  await page.waitForSelector('.result-pattern-name', { timeout: 5000 })
  console.log(`[${label}] chess-guide: pieces flipped & pattern name rendered PASS`)

  const closeBtn4 = await page.$('button[data-act="market-panel-close"]')
  if (!closeBtn4) throw new Error('[Regression] chess-guide: close button not found')
  await closeBtn4.click()
  await page.waitForFunction(() => document.querySelector('.market-panel-wrap').hidden, { timeout: 3000 })

  // 5. 市集服務台
  console.log(`[${label}] Testing Venue 5: service-desk...`)
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('market:interact', { detail: 'service-desk' }))
  })
  await page.waitForFunction(() => !document.querySelector('.market-panel-wrap').hidden, { timeout: 5000 })

  const memoInput = await page.$('.ro-memo-input')
  if (!memoInput) throw new Error('[Regression] service-desk: .ro-memo-input not found')
  await memoInput.fill('VER 3.75.5 嚴格回歸驗證備忘錄。')

  const saveMemoBtn = await page.$('button[data-act="service-memo-save"]')
  if (!saveMemoBtn) throw new Error('[Regression] service-desk: memo save button not found')
  await saveMemoBtn.click()
  await pause(300)

  // Verify all 5 quick buttons exist and click-route
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
    await pause(300)
    const btn = await page.$(`button[data-act="market-open-venue"][data-market-target="${q.target}"]`)
    if (!btn) throw new Error(`[Regression] service-desk: quick button ${q.target} not found`)
    await btn.click()
    await pause(300)
    const title = await page.evaluate(() => document.querySelector('[data-market-dialog-title]')?.textContent || '')
    if (!title.includes(q.titleSub)) throw new Error(`[Regression] quick button ${q.target} routed to unexpected title: ${title}`)
  }
  console.log(`[${label}] service-desk: memo saved & 5 quick routes verified PASS`)

  const closeX = await page.$('.panel-x[data-act="market-panel-close"]')
  if (!closeX) throw new Error('[Regression] service-desk: panel-x close button not found')
  await closeX.click()
  await page.waitForFunction(() => document.querySelector('.market-panel-wrap').hidden, { timeout: 3000 })

  // 6. 生命靈數館 (Hard Assertions on .num-calc-form & .num-result-box)
  console.log(`[${label}] Testing Venue 6: life-numerology...`)
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('market:interact', { detail: 'life-numerology' }))
  })
  await page.waitForFunction(() => !document.querySelector('.market-panel-wrap').hidden, { timeout: 5000 })

  const numForm = await page.$('.num-calc-form')
  if (!numForm) throw new Error('[Regression] life-numerology: .num-calc-form not found!')

  const numSubmit = await page.$('.num-calc-form button[type="submit"]') || await page.$('.num-submit-btn')
  if (!numSubmit) throw new Error('[Regression] life-numerology: submit button in .num-calc-form not found')
  await numSubmit.click()

  await page.waitForSelector('.num-result-box', { timeout: 5000 })
  const resultBoxExists = await page.evaluate(() => {
    const box = document.querySelector('.num-result-box')
    const heroTitle = document.querySelector('.num-hero-title')
    const badge = document.querySelector('.num-badge-circle')
    return !!(box && heroTitle && badge)
  })
  if (!resultBoxExists) throw new Error('[Regression] life-numerology: .num-result-box or inner title/badge not found!')
  console.log(`[${label}] life-numerology: .num-calc-form submit and .num-result-box confirmed PASS`)

  const closeBtn6 = await page.$('button[data-act="market-panel-close"]')
  if (!closeBtn6) throw new Error('[Regression] life-numerology: close button not found')
  await closeBtn6.click()
  await page.waitForFunction(() => document.querySelector('.market-panel-wrap').hidden, { timeout: 3000 })

  const finalMode = await page.evaluate(() => window.__game?.sceneManager?.current?.mode)
  if (!['explore', 'browse'].includes(finalMode)) throw new Error(`[Regression] Final market mode is ${finalMode}`)

  console.log(`=== [${label}] All 6 Venues Passed Strict Acceptance! ===\n`)
  return true
}

// -------------------------------------------------------------
// Measurement Routine for a Single Run
// -------------------------------------------------------------
async function measureSingleRun({ browserType, channel, runType, group, viewport }) {
  const browser = await chromium.launch({
    channel: channel || 'chrome',
    headless: true,
  })

  // Isolated incognito context
  const context = await browser.newContext({
    viewport: viewport || { width: 1440, height: 900 },
  })
  const page = await context.newPage()
  const consoleErrors = []
  page.on('pageerror', err => consoleErrors.push(err.message))

  const tHomeStart = Date.now()
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 })
  const homeLoadMs = Date.now() - tHomeStart

  // Enter temple
  const beginBtn = await page.$('button[data-act="begin"]')
  if (beginBtn) { await beginBtn.click(); await pause(300) }
  const enterBtn = await page.$('button[data-act="enter"]')
  if (enterBtn) { await enterBtn.click(); await pause(800) }

  // Instrument transition hooks, rAF frame timing, and Group A/B/C/D overrides
  await page.evaluate((grp) => {
    const sm = window.__game.sceneManager

    window.__perf = {
      marketConstructionMs: 0,
      marketFirstRenderMs: 0,
      templeToMarketTotalMs: 0,
      frameDeltas: [],
      rendererInfo: { calls: 0, triangles: 0, programs: 0 },
      venueFirstOpenMs: {},
    }

    // Instrument rAF frame deltas
    let lastTime = performance.now()
    let rafActive = true
    function frameStep(now) {
      if (!rafActive) return
      const delta = now - lastTime
      lastTime = now
      window.__perf.frameDeltas.push(+delta.toFixed(2))
      requestAnimationFrame(frameStep)
    }
    requestAnimationFrame(frameStep)

    const origCreateMarket = sm.options.createMarket.bind(sm.options)
    sm.options.createMarket = async function() {
      const tConstStart = performance.now()
      const marketGame = await origCreateMarket()
      window.__perf.marketConstructionMs = +(performance.now() - tConstStart).toFixed(2)

      // Apply Controlled Diagnosis Group Hooks
      if (grp === 'B') {
        // Group B: Shadow map 1024
        if (marketGame.world?.mainLight?.shadow?.mapSize) {
          marketGame.world.mainLight.shadow.mapSize.set(1024, 1024)
        }
      } else if (grp === 'C') {
        // Group C: Disable shadows
        if (marketGame.world?.mainLight) {
          marketGame.world.mainLight.castShadow = false
        }
        if (marketGame.renderer?.gl?.shadowMap) {
          marketGame.renderer.gl.shadowMap.enabled = false
        }
      } else if (grp === 'D') {
        // Group D: Legitimate Shader Warmup API
        const gl = marketGame.renderer?.gl
        if (gl && typeof gl.compile === 'function') {
          const tWStart = performance.now()
          gl.compile(marketGame.world.scene, marketGame.camera)
          console.log('[Group D] Shader warmup compile duration:', performance.now() - tWStart)
        }
      }

      // Hook first frame render
      const origRender = marketGame.render.bind(marketGame)
      let firstFrameDone = false
      marketGame.render = function(renderer, alpha) {
        if (!firstFrameDone) {
          const tRStart = performance.now()
          origRender(renderer, alpha)
          window.__perf.marketFirstRenderMs = +(performance.now() - tRStart).toFixed(2)
          firstFrameDone = true

          // Capture renderer info after first frame
          const gl = renderer?.gl
          if (gl?.info) {
            window.__perf.rendererInfo = {
              calls: gl.info.render.calls,
              triangles: gl.info.render.triangles,
              programs: gl.info.programs ? gl.info.programs.length : 0,
            }
          }
        } else {
          origRender(renderer, alpha)
        }
      }
      return marketGame
    }

    // Stop rAF tracking after 8 seconds
    setTimeout(() => { rafActive = false }, 8000)
  }, group)

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

  // Measure venue first open latencies
  const venues = [
    'birth-chart-hall',
    'card-house',
    'moon-meditation',
    'chess-guide',
    'service-desk',
    'life-numerology',
  ]
  const venueFirstOpenMs = {}
  for (const v of venues) {
    const tOpenStart = Date.now()
    await page.evaluate(id => {
      window.dispatchEvent(new CustomEvent('market:interact', { detail: id }))
    }, v)
    await page.waitForFunction(() => {
      const wrap = document.querySelector('.market-panel-wrap')
      return wrap && !wrap.hidden
    }, { timeout: 5000 })
    venueFirstOpenMs[v] = Date.now() - tOpenStart

    const closeBtn = await page.$('button[data-act="market-panel-close"]')
    if (closeBtn) await closeBtn.click()
    await page.waitForFunction(() => document.querySelector('.market-panel-wrap').hidden, { timeout: 3000 })
    await pause(100)
  }

  // Retrieve in-page metrics
  const inPageMetrics = await page.evaluate(() => window.__perf)
  const deltas = inPageMetrics.frameDeltas || []
  deltas.sort((a, b) => a - b)

  const longFramesOver50Ms = deltas.filter(d => d > 50).length
  const longFramesOver100Ms = deltas.filter(d => d > 100).length
  const maxFrameMs = deltas.length ? deltas[deltas.length - 1] : 0
  const p95Idx = Math.floor(deltas.length * 0.95)
  const p95FrameMs = deltas.length ? deltas[p95Idx] : 0

  await context.close()
  await browser.close()

  const runResult = {
    browser: channel === 'msedge' ? 'edge' : 'chromium',
    runType,
    group,
    version: 'VER 3.75.5',
    homeLoadMs,
    templeToMarketTotalMs: timeToMarketInteractiveMs,
    marketConstructionMs: inPageMetrics.marketConstructionMs,
    marketFirstRenderMs: inPageMetrics.marketFirstRenderMs,
    timeToMarketInteractiveMs,
    longFramesOver50Ms,
    longFramesOver100Ms,
    maxFrameMs,
    p95FrameMs,
    rendererInfo: inPageMetrics.rendererInfo,
    venueFirstOpenMs,
    consoleErrors,
  }

  console.log(`[${runResult.browser}][${group}][${runType}] FirstRender: ${runResult.marketFirstRenderMs}ms | MaxFrame: ${runResult.maxFrameMs}ms | TotalTransition: ${runResult.timeToMarketInteractiveMs}ms`)
  return runResult
}

// -------------------------------------------------------------
// Main Orchestration
// -------------------------------------------------------------
async function main() {
  console.log('===============================================================')
  console.log('  天心靈光市集：P2 效能量測與長幀根因驗證 (VER 3.75.5)')
  console.log('===============================================================')

  const masterReport = {
    version: 'VER 3.75.5',
    timestamp: new Date().toISOString(),
    preRegression: false,
    postRegression: false,
    groups: {},
    conclusion: {},
  }

  // --- Step 1: Pre-Measurement Regression on Edge ---
  let server = startPreviewServer()
  try {
    await waitForServer(BASE_URL)
    const browser = await chromium.launch({ channel: 'msedge', headless: true })
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await page.goto(BASE_URL, { waitUntil: 'networkidle' })
    const beginBtn = await page.$('button[data-act="begin"]')
    if (beginBtn) { await beginBtn.click(); await pause(300) }
    const enterBtn = await page.$('button[data-act="enter"]')
    if (enterBtn) { await enterBtn.click(); await pause(800) }
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('temple:interact', { detail: 'market-portal' }))
    })
    await runVenueRegression(page, 'PRE-REGRESSION')
    masterReport.preRegression = true
    await browser.close()
  } finally {
    server.kill()
    await pause(1000)
  }

  // --- Step 2: Measure Group A (Baseline: Medium, 2048 shadow) ---
  console.log('\n>>> Starting Group A (Baseline: Medium, 2048 shadow) <<<')
  const groupAResults = { cold: [], warm: [] }

  // Chromium: 1 cold + 3 warm
  server = startPreviewServer()
  try {
    await waitForServer(BASE_URL)
    const coldChromium = await measureSingleRun({ browserType: 'chromium', channel: null, runType: 'cold', group: 'A' })
    groupAResults.cold.push(coldChromium)
    for (let i = 1; i <= 3; i++) {
      const warmChromium = await measureSingleRun({ browserType: 'chromium', channel: null, runType: `warm_${i}`, group: 'A' })
      groupAResults.warm.push(warmChromium)
    }
  } finally {
    server.kill()
    await pause(1000)
  }

  // Edge: 1 cold + 3 warm
  server = startPreviewServer()
  try {
    await waitForServer(BASE_URL)
    const coldEdge = await measureSingleRun({ browserType: 'chromium', channel: 'msedge', runType: 'cold', group: 'A' })
    groupAResults.cold.push(coldEdge)
    for (let i = 1; i <= 3; i++) {
      const warmEdge = await measureSingleRun({ browserType: 'chromium', channel: 'msedge', runType: `warm_${i}`, group: 'A' })
      groupAResults.warm.push(warmEdge)
    }
  } finally {
    server.kill()
    await pause(1000)
  }
  masterReport.groups.group_A = groupAResults
  writeFileSync(join(artifactDir, 'perf_group_a_baseline.json'), JSON.stringify(groupAResults, null, 2))

  // --- Step 3: Measure Group B (Shadow map 1024) ---
  console.log('\n>>> Starting Group B (Shadow Map 1024) <<<')
  const groupBResults = { cold: [], warm: [] }
  server = startPreviewServer()
  try {
    await waitForServer(BASE_URL)
    const coldB = await measureSingleRun({ browserType: 'chromium', channel: null, runType: 'cold', group: 'B' })
    groupBResults.cold.push(coldB)
    for (let i = 1; i <= 3; i++) {
      const warmB = await measureSingleRun({ browserType: 'chromium', channel: null, runType: `warm_${i}`, group: 'B' })
      groupBResults.warm.push(warmB)
    }
  } finally {
    server.kill()
    await pause(1000)
  }
  masterReport.groups.group_B = groupBResults
  writeFileSync(join(artifactDir, 'perf_group_b_shadow1024.json'), JSON.stringify(groupBResults, null, 2))

  // --- Step 4: Measure Group C (No Shadows) ---
  console.log('\n>>> Starting Group C (No Shadows) <<<')
  const groupCResults = { cold: [], warm: [] }
  server = startPreviewServer()
  try {
    await waitForServer(BASE_URL)
    const coldC = await measureSingleRun({ browserType: 'chromium', channel: null, runType: 'cold', group: 'C' })
    groupCResults.cold.push(coldC)
    for (let i = 1; i <= 3; i++) {
      const warmC = await measureSingleRun({ browserType: 'chromium', channel: null, runType: `warm_${i}`, group: 'C' })
      groupCResults.warm.push(warmC)
    }
  } finally {
    server.kill()
    await pause(1000)
  }
  masterReport.groups.group_C = groupCResults
  writeFileSync(join(artifactDir, 'perf_group_c_noshadow.json'), JSON.stringify(groupCResults, null, 2))

  // --- Step 5: Measure Group D (Shader Warmup API) ---
  console.log('\n>>> Starting Group D (Shader Warmup API) <<<')
  const groupDResults = { cold: [], warm: [] }
  server = startPreviewServer()
  try {
    await waitForServer(BASE_URL)
    const coldD = await measureSingleRun({ browserType: 'chromium', channel: null, runType: 'cold', group: 'D' })
    groupDResults.cold.push(coldD)
    for (let i = 1; i <= 3; i++) {
      const warmD = await measureSingleRun({ browserType: 'chromium', channel: null, runType: `warm_${i}`, group: 'D' })
      groupDResults.warm.push(warmD)
    }
  } finally {
    server.kill()
    await pause(1000)
  }
  masterReport.groups.group_D = groupDResults
  writeFileSync(join(artifactDir, 'perf_group_d_shaderwarmup.json'), JSON.stringify(groupDResults, null, 2))

  // --- Step 6: Post-Measurement Regression Acceptance ---
  server = startPreviewServer()
  try {
    await waitForServer(BASE_URL)
    const browser = await chromium.launch({ channel: 'msedge', headless: true })
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } }) // Mobile viewport
    await page.goto(BASE_URL, { waitUntil: 'networkidle' })
    const beginBtn = await page.$('button[data-act="begin"]')
    if (beginBtn) { await beginBtn.click(); await pause(300) }
    const enterBtn = await page.$('button[data-act="enter"]')
    if (enterBtn) { await enterBtn.click(); await pause(800) }
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('temple:interact', { detail: 'market-portal' }))
    })
    await runVenueRegression(page, 'POST-REGRESSION-MOBILE')
    masterReport.postRegression = true
    await browser.close()
  } finally {
    server.kill()
    await pause(1000)
  }

  // Write master report
  writeFileSync(join(artifactDir, 'perf_market_v3755_master.json'), JSON.stringify(masterReport, null, 2))
  console.log('\n>>> All testing and measurements completed successfully! Master report saved. <<<')
}

main().catch(err => {
  console.error('FATAL ERROR in verify-market-performance-v3755:', err)
  process.exit(1)
})
