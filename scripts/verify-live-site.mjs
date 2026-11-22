import { join } from 'node:path'
import { chromium } from 'playwright'

const artifactDir = 'C:/Users/Aaron/.gemini/antigravity/brain/9deda20f-4636-408c-9db4-d0794dd2af98'
const url = 'https://athena830.github.io/tianxin-temple-3d/'

async function run() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  const errors = []
  page.on('pageerror', err => errors.push(err.message))
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  console.log('Navigating to live URL:', url)
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 })
  await page.waitForTimeout(1500)

  const titlePath = join(artifactDir, 'live_site_verified_screen.png')
  await page.screenshot({ path: titlePath })
  console.log('Saved live title screenshot:', titlePath)
  console.log('Errors:', errors)

  await browser.close()
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
