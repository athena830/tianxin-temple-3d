import { execSync } from 'node:child_process'
import { join } from 'node:path'
import { rmSync, copyFileSync, writeFileSync } from 'node:fs'

const distDir = join(process.cwd(), 'dist')
console.log('[deploy] Building project with Vite...')
execSync('node ./node_modules/vite/bin/vite.js build', { stdio: 'inherit' })

console.log('[deploy] Preparing .nojekyll and 404.html...')
writeFileSync(join(distDir, '.nojekyll'), '')
copyFileSync(join(distDir, 'index.html'), join(distDir, '404.html'))

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
