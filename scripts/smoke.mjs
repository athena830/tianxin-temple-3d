// End-to-end validation for the current temple and independent MarketWorld flow.
// Build first (`npm run build`); screenshots are written to ./shots/ by default.
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const port = 4300 + Math.floor(Math.random() * 500)
const url = `http://127.0.0.1:${port}/`
const out = process.env.SHOTS_DIR ?? 'shots'
mkdirSync(out, { recursive: true })

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' })
let browser
const guard = setTimeout(() => fail('timed out'), 120_000)

function cleanup() { clearTimeout(guard); try { server.kill('SIGTERM') } catch {} }
async function fail(message) {
  console.error(`smoke: FAIL — ${message}`)
  await browser?.close().catch(() => {})
  cleanup()
  process.exit(1)
}
async function waitForServer() {
  for (let i = 0; i < 60; i += 1) {
    try { if ((await fetch(url)).ok) return } catch {}
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error('preview server did not start')
}
async function openTemple(context, errors) {
  const page = await context.newPage()
  page.on('console', message => message.type() === 'error' && errors.push(message.text()))
  page.on('pageerror', error => errors.push(String(error)))
  page.on('response', response => response.status() >= 400 && errors.push(`HTTP ${response.status()} ${response.url()}`))
  await page.goto(url)
  try {
    await page.waitForSelector('[data-screen="title"].on', { timeout: 30_000 })
  } catch (error) {
    const uiState = await page.evaluate(() => ({
      boot: document.querySelector('[data-screen="boot"]')?.className,
      title: document.querySelector('[data-screen="title"]')?.className,
      text: document.getElementById('ui')?.textContent?.slice(0, 300),
    }))
    throw new Error(`title did not open; runtime errors: ${errors.join(' | ') || 'none'}; ui: ${JSON.stringify(uiState)}; ${error.message}`)
  }
  await page.click('[data-act="begin"]')
  await page.waitForSelector('[data-screen="select"].on')
  await page.click('[data-char]')
  await page.click('[data-act="enter"]')
  await page.waitForSelector('[data-screen="hud"].on')
  return page
}
async function enterMarket(page) {
  await page.evaluate(() => {
    const game = window.__game.game
    game.teleportTo(23.8, 14.2)
  })
  await page.waitForTimeout(120)
  await page.keyboard.press('KeyE')
  await page.waitForFunction(() => window.__game.sceneManager.world === 'market', null, { timeout: 10_000 })
  await page.waitForSelector('.world-transition[hidden]', { state: 'attached' })
}
async function returnTemple(page) {
  await page.evaluate(() => {
    const game = window.__game.game
    game.body.setTranslation({ x: 0, y: 0.92, z: 8.6 }, true)
    game.body.setNextKinematicTranslation({ x: 0, y: 0.92, z: 8.6 })
  })
  await page.waitForTimeout(120)
  await page.keyboard.press('KeyE')
  await page.waitForFunction(() => window.__game.sceneManager.world === 'temple', null, { timeout: 10_000 })
  await page.waitForSelector('.world-transition[hidden]', { state: 'attached' })
}

try {
  await waitForServer()
  browser = await chromium.launch({ args: ['--ignore-gpu-blocklist'] }).catch(() => chromium.launch({ args: ['--ignore-gpu-blocklist'], channel: 'chrome' }))
  const errors = []
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'zh-TW' })
  const page = await openTemple(desktop, errors)
  await page.screenshot({ path: `${out}/01-temple-desktop.png` })
  await enterMarket(page)
  await page.waitForSelector('.market-status:not([hidden])')
  await page.screenshot({ path: `${out}/02-market-desktop.png` })
  await returnTemple(page)
  await page.screenshot({ path: `${out}/03-returned-temple-desktop.png` })
  await desktop.close()

  for (const [name, viewport] of [
    ['phone-portrait', { width: 390, height: 844 }],
    ['phone-landscape', { width: 844, height: 390 }],
  ]) {
    const phone = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'zh-TW' })
    const phonePage = await openTemple(phone, errors)
    await enterMarket(phonePage)
    await phonePage.screenshot({ path: `${out}/04-market-${name}.png` })
    await returnTemple(phonePage)
    await phone.close()
  }
  if (errors.length) throw new Error(`console errors:\n  ${errors.join('\n  ')}`)
  await browser.close()
  cleanup()
  console.log(`smoke: OK — temple ⇄ market on desktop and both phone orientations; screenshots in ${out}/`)
} catch (error) {
  await fail(error?.message ?? String(error))
}
