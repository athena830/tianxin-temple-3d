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
  await memoInput.fill('VER 3.75.6 嚴格回歸驗收。')

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

  const closeBtn6 = await page.$('button[data-act="market-panel-close"]')
  await closeBtn6.click()
  await page.waitForFunction(() => document.querySelector('.market-panel-wrap').hidden, { timeout: 3000 })

  const finalMode = await page.evaluate(() => window.__game?.sceneManager?.current?.mode)
  if (!['explore', 'browse'].includes(finalMode)) throw new Error(`[Regression] Final market mode is ${finalMode}`)

  console.log(`=== [${label}] All 6 Venues Passed Strict Acceptance! ===`)
  return true
}

// -------------------------------------------------------------
// Measure In-Page Transition Helper
// -------------------------------------------------------------
async function triggerAndMeasureTransition(page, group, isWarmReentry = false) {
  // Inject in-page instrumentation right before clicking portal
  await page.evaluate((grp) => {
    const sm = window.__game.sceneManager

    window.__runMetrics = {
      marketConstructionMs: 0,
      compileMs: 0,
      compileType: 'none',
      firstRenderMs: 0,
      frameDeltas: [],
      rendererInfo: null,
    }

    // Instrument rAF frame deltas
    let lastTime = performance.now()
    let rafActive = true
    function frameStep(now) {
      if (!rafActive) return
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

      // Apply Group Overrides in test environment only
      if (grp === 'B') {
        if (marketGame.world?.mainLight?.shadow?.mapSize) {
          marketGame.world.mainLight.shadow.mapSize.set(1024, 1024)
        }
      } else if (grp === 'C') {
        if (marketGame.world?.mainLight) {
          marketGame.world.mainLight.castShadow = false
        }
        if (marketGame.renderer?.gl?.shadowMap) {
          marketGame.renderer.gl.shadowMap.enabled = false
        }
      } else if (grp === 'D') {
        // Group D: Shader warmup
        const gl = marketGame.renderer?.gl
        if (gl) {
          const tWStart = performance.now()
          if (typeof gl.compileAsync === 'function') {
            window.__runMetrics.compileType = 'compileAsync'
            await gl.compileAsync(marketGame.world.scene, marketGame.camera)
          } else if (typeof gl.compile === 'function') {
            window.__runMetrics.compileType = 'sync compile'
            gl.compile(marketGame.world.scene, marketGame.camera)
          }
          window.__runMetrics.compileMs = +(performance.now() - tWStart).toFixed(2)
        }
      }

      // Hook first frame render: MarketGame.render(_alpha, frameSeconds)
      const origRender = marketGame.render.bind(marketGame)
      let firstFrameDone = false
      marketGame.render = function(alpha, frameSeconds) {
        if (!firstFrameDone) {
          const tRStart = performance.now()
          origRender(alpha, frameSeconds)
          window.__runMetrics.firstRenderMs = +(performance.now() - tRStart).toFixed(2)
          firstFrameDone = true

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

  const inPage = await page.evaluate(() => window.__runMetrics)
  const deltas = inPage.frameDeltas || []
  deltas.sort((a, b) => a - b)

  const longFrameCount = deltas.filter(d => d > 50).length
  const over100msFrameCount = deltas.filter(d => d > 100).length
  const maxFrameMs = deltas.length ? deltas[deltas.length - 1] : 0

  return {
    marketConstructionMs: inPage.marketConstructionMs,
    compileMs: inPage.compileMs,
    compileType: inPage.compileType,
    firstRenderMs: inPage.firstRenderMs,
    timeToMarketInteractiveMs,
    maxFrameMs,
    longFrameCount,
    over100msFrameCount,
    rendererInfo: inPage.rendererInfo,
  }
}

// -------------------------------------------------------------
// Measure 1 Cold Entry Run
// -------------------------------------------------------------
async function measureColdEntryRun({ channel, group, runIndex }) {
  const browser = await chromium.launch({ channel, headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const consoleErrors = []
  page.on('pageerror', err => consoleErrors.push(err.message))

  const tHome = Date.now()
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 })
  const homeLoadMs = Date.now() - tHome

  const beginBtn = await page.$('button[data-act="begin"]')
  if (beginBtn) { await beginBtn.click(); await pause(300) }
  const enterBtn = await page.$('button[data-act="enter"]')
  if (enterBtn) { await enterBtn.click(); await pause(800) }

  const metrics = await triggerAndMeasureTransition(page, group, false)

  await context.close()
  await browser.close()

  const record = {
    testType: 'Cold Entry',
    runIndex,
    browser: channel === 'msedge' ? 'edge' : 'chromium',
    group,
    version: 'VER 3.75.6',
    homeLoadMs,
    marketConstructionMs: metrics.marketConstructionMs,
    compileMs: metrics.compileMs,
    compileType: metrics.compileType,
    firstRenderMs: metrics.firstRenderMs,
    timeToMarketInteractiveMs: metrics.timeToMarketInteractiveMs,
    maxFrameMs: metrics.maxFrameMs,
    longFrameCount: metrics.longFrameCount,
    over100msFrameCount: metrics.over100msFrameCount,
    rendererInfo: metrics.rendererInfo,
    consoleErrors,
  }

  console.log(`[Cold Entry][${record.browser}][Grp ${group}][#${runIndex}] firstRender: ${record.firstRenderMs}ms | compile: ${record.compileMs}ms | maxFrame: ${record.maxFrameMs}ms | totalInteractive: ${record.timeToMarketInteractiveMs}ms`)
  return record
}

// -------------------------------------------------------------
// Measure Genuine Warm Re-entry (5 consecutive re-entries in same page)
// -------------------------------------------------------------
async function measureGenuineWarmReentries({ channel, group, count = 5 }) {
  console.log(`\n>>> Starting Genuine Warm Re-entry [${channel === 'msedge' ? 'edge' : 'chromium'}][Grp ${group}] (${count} consecutive in SAME page) <<<`)
  const browser = await chromium.launch({ channel, headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const consoleErrors = []
  page.on('pageerror', err => consoleErrors.push(err.message))

  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 })
  const beginBtn = await page.$('button[data-act="begin"]')
  if (beginBtn) { await beginBtn.click(); await pause(300) }
  const enterBtn = await page.$('button[data-act="enter"]')
  if (enterBtn) { await enterBtn.click(); await pause(800) }

  // Initial Entry into market (Cold entry for this page session)
  console.log(`[Warm Session] Performing initial entry into market...`)
  await triggerAndMeasureTransition(page, group, false)

  const warmRecords = []
  for (let i = 1; i <= count; i++) {
    // 1. Exit market back to temple
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('market:interact', { detail: 'return-temple' }))
    })
    // Wait until temple is restored and idle
    await page.waitForFunction(() => {
      const sm = window.__game?.sceneManager
      return sm?.world === 'temple' && sm?.state === 'idle'
    }, { timeout: 30000 })
    await pause(500)

    // 2. Genuine Re-entry into market in the exact same page/context
    const metrics = await triggerAndMeasureTransition(page, group, true)

    const record = {
      testType: 'Genuine Warm Re-entry',
      runIndex: i,
      browser: channel === 'msedge' ? 'edge' : 'chromium',
      group,
      version: 'VER 3.75.6',
      marketConstructionMs: metrics.marketConstructionMs,
      compileMs: metrics.compileMs,
      compileType: metrics.compileType,
      firstRenderMs: metrics.firstRenderMs,
      timeToMarketInteractiveMs: metrics.timeToMarketInteractiveMs,
      maxFrameMs: metrics.maxFrameMs,
      longFrameCount: metrics.longFrameCount,
      over100msFrameCount: metrics.over100msFrameCount,
      rendererInfo: metrics.rendererInfo,
      consoleErrors,
    }
    warmRecords.push(record)
    console.log(`[Genuine Warm Re-entry][${record.browser}][Grp ${group}][#${i}] firstRender: ${record.firstRenderMs}ms | compile: ${record.compileMs}ms | maxFrame: ${record.maxFrameMs}ms | totalInteractive: ${record.timeToMarketInteractiveMs}ms`)
  }

  await context.close()
  await browser.close()
  return warmRecords
}

// -------------------------------------------------------------
// Main Benchmark Orchestrator
// -------------------------------------------------------------
async function main() {
  console.log('===============================================================')
  console.log('  天心靈光市集：效能量測校正與可信基準建立 (VER 3.75.6)')
  console.log('===============================================================')

  const fullReport = {
    version: 'VER 3.75.6',
    date: new Date().toISOString(),
    preRegressionPassed: false,
    postRegressionPassed: false,
    group_A_baseline: {},
    group_B_shadow1024: {},
    group_C_noshadow: {},
    group_D_shaderwarmup: {},
    summaryComparison: {},
  }

  // 1. Pre-measurement regression on Edge (1440x900)
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
    await runVenueRegression(page, 'PRE-REGRESSION-DESKTOP')
    fullReport.preRegressionPassed = true
    await browser.close()
  } finally {
    server.kill()
    await pause(1000)
  }

  // 2. Group A Baseline (5 Cold + 5 Warm Re-entries)
  console.log('\n========================================')
  console.log('  GROUP A: Current Baseline (Medium, 2048 Shadow)')
  console.log('========================================')
  const groupA = { coldRuns: [], warmReentries: [] }
  for (let i = 1; i <= 5; i++) {
    server = startPreviewServer()
    try {
      await waitForServer(BASE_URL)
      const res = await measureColdEntryRun({ channel: 'chrome', group: 'A', runIndex: i })
      groupA.coldRuns.push(res)
    } finally {
      server.kill()
      await pause(800)
    }
  }
  server = startPreviewServer()
  try {
    await waitForServer(BASE_URL)
    groupA.warmReentries = await measureGenuineWarmReentries({ channel: 'chrome', group: 'A', count: 5 })
  } finally {
    server.kill()
    await pause(800)
  }
  groupA.coldStats = {
    firstRenderMs: calculateStats(groupA.coldRuns.map(r => r.firstRenderMs)),
    totalInteractiveMs: calculateStats(groupA.coldRuns.map(r => r.timeToMarketInteractiveMs)),
    maxFrameMs: calculateStats(groupA.coldRuns.map(r => r.maxFrameMs)),
    marketConstructionMs: calculateStats(groupA.coldRuns.map(r => r.marketConstructionMs)),
  }
  groupA.warmStats = {
    firstRenderMs: calculateStats(groupA.warmReentries.map(r => r.firstRenderMs)),
    totalInteractiveMs: calculateStats(groupA.warmReentries.map(r => r.timeToMarketInteractiveMs)),
    maxFrameMs: calculateStats(groupA.warmReentries.map(r => r.maxFrameMs)),
    marketConstructionMs: calculateStats(groupA.warmReentries.map(r => r.marketConstructionMs)),
  }
  fullReport.group_A_baseline = groupA
  writeFileSync(join(artifactDir, 'perf_group_a_baseline_v3756.json'), JSON.stringify(groupA, null, 2))

  // 3. Group B Shadow 1024 (5 Cold Entries)
  console.log('\n========================================')
  console.log('  GROUP B: Shadow Map 1024')
  console.log('========================================')
  const groupB = { coldRuns: [] }
  for (let i = 1; i <= 5; i++) {
    server = startPreviewServer()
    try {
      await waitForServer(BASE_URL)
      const res = await measureColdEntryRun({ channel: 'chrome', group: 'B', runIndex: i })
      groupB.coldRuns.push(res)
    } finally {
      server.kill()
      await pause(800)
    }
  }
  groupB.coldStats = {
    firstRenderMs: calculateStats(groupB.coldRuns.map(r => r.firstRenderMs)),
    totalInteractiveMs: calculateStats(groupB.coldRuns.map(r => r.timeToMarketInteractiveMs)),
    maxFrameMs: calculateStats(groupB.coldRuns.map(r => r.maxFrameMs)),
    marketConstructionMs: calculateStats(groupB.coldRuns.map(r => r.marketConstructionMs)),
  }
  fullReport.group_B_shadow1024 = groupB
  writeFileSync(join(artifactDir, 'perf_group_b_shadow1024_v3756.json'), JSON.stringify(groupB, null, 2))

  // 4. Group C No Shadows (5 Cold Entries)
  console.log('\n========================================')
  console.log('  GROUP C: Disabled Shadows')
  console.log('========================================')
  const groupC = { coldRuns: [] }
  for (let i = 1; i <= 5; i++) {
    server = startPreviewServer()
    try {
      await waitForServer(BASE_URL)
      const res = await measureColdEntryRun({ channel: 'chrome', group: 'C', runIndex: i })
      groupC.coldRuns.push(res)
    } finally {
      server.kill()
      await pause(800)
    }
  }
  groupC.coldStats = {
    firstRenderMs: calculateStats(groupC.coldRuns.map(r => r.firstRenderMs)),
    totalInteractiveMs: calculateStats(groupC.coldRuns.map(r => r.timeToMarketInteractiveMs)),
    maxFrameMs: calculateStats(groupC.coldRuns.map(r => r.maxFrameMs)),
    marketConstructionMs: calculateStats(groupC.coldRuns.map(r => r.marketConstructionMs)),
  }
  fullReport.group_C_noshadow = groupC
  writeFileSync(join(artifactDir, 'perf_group_c_noshadow_v3756.json'), JSON.stringify(groupC, null, 2))

  // 5. Group D Shader Warmup (5 Cold + 5 Warm Re-entries)
  console.log('\n========================================')
  console.log('  GROUP D: Shader Warmup API')
  console.log('========================================')
  const groupD = { coldRuns: [], warmReentries: [] }
  for (let i = 1; i <= 5; i++) {
    server = startPreviewServer()
    try {
      await waitForServer(BASE_URL)
      const res = await measureColdEntryRun({ channel: 'chrome', group: 'D', runIndex: i })
      groupD.coldRuns.push(res)
    } finally {
      server.kill()
      await pause(800)
    }
  }
  server = startPreviewServer()
  try {
    await waitForServer(BASE_URL)
    groupD.warmReentries = await measureGenuineWarmReentries({ channel: 'chrome', group: 'D', count: 5 })
  } finally {
    server.kill()
    await pause(800)
  }
  groupD.coldStats = {
    firstRenderMs: calculateStats(groupD.coldRuns.map(r => r.firstRenderMs)),
    compileMs: calculateStats(groupD.coldRuns.map(r => r.compileMs)),
    totalInteractiveMs: calculateStats(groupD.coldRuns.map(r => r.timeToMarketInteractiveMs)),
    maxFrameMs: calculateStats(groupD.coldRuns.map(r => r.maxFrameMs)),
    marketConstructionMs: calculateStats(groupD.coldRuns.map(r => r.marketConstructionMs)),
  }
  groupD.warmStats = {
    firstRenderMs: calculateStats(groupD.warmReentries.map(r => r.firstRenderMs)),
    compileMs: calculateStats(groupD.warmReentries.map(r => r.compileMs)),
    totalInteractiveMs: calculateStats(groupD.warmReentries.map(r => r.timeToMarketInteractiveMs)),
    maxFrameMs: calculateStats(groupD.warmReentries.map(r => r.maxFrameMs)),
    marketConstructionMs: calculateStats(groupD.warmReentries.map(r => r.marketConstructionMs)),
  }
  fullReport.group_D_shaderwarmup = groupD
  writeFileSync(join(artifactDir, 'perf_group_d_shaderwarmup_v3756.json'), JSON.stringify(groupD, null, 2))

  // 6. Post-measurement regression on Mobile 390x844
  server = startPreviewServer()
  try {
    await waitForServer(BASE_URL)
    const browser = await chromium.launch({ channel: 'msedge', headless: true })
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await page.goto(BASE_URL, { waitUntil: 'networkidle' })
    const beginBtn = await page.$('button[data-act="begin"]')
    if (beginBtn) { await beginBtn.click(); await pause(300) }
    const enterBtn = await page.$('button[data-act="enter"]')
    if (enterBtn) { await enterBtn.click(); await pause(800) }
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('temple:interact', { detail: 'market-portal' }))
    })
    await runVenueRegression(page, 'POST-REGRESSION-MOBILE')
    fullReport.postRegressionPassed = true
    await browser.close()
  } finally {
    server.kill()
    await pause(800)
  }

  // Summary Comparison Table
  fullReport.summaryComparison = {
    coldEntryMedians: {
      A_baseline: {
        firstRenderMs: groupA.coldStats.firstRenderMs.median,
        totalInteractiveMs: groupA.coldStats.totalInteractiveMs.median,
        maxFrameMs: groupA.coldStats.maxFrameMs.median,
      },
      B_shadow1024: {
        firstRenderMs: groupB.coldStats.firstRenderMs.median,
        totalInteractiveMs: groupB.coldStats.totalInteractiveMs.median,
        maxFrameMs: groupB.coldStats.maxFrameMs.median,
      },
      C_noshadow: {
        firstRenderMs: groupC.coldStats.firstRenderMs.median,
        totalInteractiveMs: groupC.coldStats.totalInteractiveMs.median,
        maxFrameMs: groupC.coldStats.maxFrameMs.median,
      },
      D_shaderwarmup: {
        firstRenderMs: groupD.coldStats.firstRenderMs.median,
        compileMs: groupD.coldStats.compileMs?.median || 0,
        totalInteractiveMs: groupD.coldStats.totalInteractiveMs.median,
        maxFrameMs: groupD.coldStats.maxFrameMs.median,
      },
    },
    warmReentryMedians: {
      A_baseline: {
        firstRenderMs: groupA.warmStats.firstRenderMs.median,
        totalInteractiveMs: groupA.warmStats.totalInteractiveMs.median,
        maxFrameMs: groupA.warmStats.maxFrameMs.median,
      },
      D_shaderwarmup: {
        firstRenderMs: groupD.warmStats.firstRenderMs.median,
        compileMs: groupD.warmStats.compileMs?.median || 0,
        totalInteractiveMs: groupD.warmStats.totalInteractiveMs.median,
        maxFrameMs: groupD.warmStats.maxFrameMs.median,
      },
    },
  }

  const masterPath = join(artifactDir, 'perf_market_v3756_master.json')
  writeFileSync(masterPath, JSON.stringify(fullReport, null, 2))
  console.log(`\n>>> Master benchmark report saved to ${masterPath} <<<`)
}

main().catch(err => {
  console.error('FATAL BENCHMARK ERROR:', err)
  process.exit(1)
})
