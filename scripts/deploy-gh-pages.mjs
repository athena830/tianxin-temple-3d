import { execSync } from 'node:child_process'
import { join } from 'node:path'
import { rmSync, cpSync, copyFileSync, writeFileSync, readFileSync, readdirSync, mkdirSync } from 'node:fs'

const rootDir = process.cwd()
const distDir = join(rootDir, 'dist')
const rootAssetsDir = join(rootDir, 'assets')

console.log('[deploy] Building project with Vite...')
execSync('node ./node_modules/vite/bin/vite.js build', { stdio: 'inherit' })

console.log('[deploy] Syncing compiled assets to root assets/ for GitHub Pages main branch support...')
mkdirSync(rootAssetsDir, { recursive: true })
const distFiles = new Set(readdirSync(join(distDir, 'assets')))
for (const existing of readdirSync(rootAssetsDir)) {
  if (existing === 'models' || existing === 'share') continue
  if (!distFiles.has(existing)) {
    rmSync(join(rootAssetsDir, existing), { recursive: true, force: true })
  }
}
for (const file of distFiles) {
  cpSync(join(distDir, 'assets', file), join(rootAssetsDir, file), { recursive: true })
}

// Add cache-busting timestamp/version to dist/index.html
const distIndexPath = join(distDir, 'index.html')
const distHtml = readFileSync(distIndexPath, 'utf-8')
const cacheBustedHtml = distHtml
  .replace(/\.\/assets\/index\.js(\?v=[^"']*)?/g, `./assets/index.js?v=${Date.now()}`)
  .replace(/\.\/assets\/index\.css(\?v=[^"']*)?/g, `./assets/index.css?v=${Date.now()}`)
writeFileSync(distIndexPath, cacheBustedHtml, 'utf-8')

console.log('[deploy] Preparing .nojekyll and 404.html...')
writeFileSync(join(distDir, '.nojekyll'), '')
writeFileSync(join(rootDir, '.nojekyll'), '')
copyFileSync(join(rootDir, 'public', '404.html'), join(distDir, '404.html'))
copyFileSync(join(rootDir, 'public', '404.html'), join(rootDir, '404.html'))

console.log('[deploy] Pushing to gh-pages branch...')
const commands = [
  'git init',
  'git checkout -B gh-pages',
  'git add -A',
  'git commit -m "deploy: update GitHub Pages build"',
  'git remote add origin https://github.com/athena830/tianxin-temple-3d.git',
  'git push origin gh-pages --force',
]

for (const cmd of commands) {
  execSync(cmd, { cwd: distDir, stdio: 'inherit' })
}

try {
  rmSync(join(distDir, '.git'), { recursive: true, force: true })
} catch {
  // Ignore git cleanup if locked
}

console.log('[deploy] Successfully deployed to gh-pages branch!')
