import { manusGameTuning } from './scripts/manus-tuning/vite.mjs'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

// Relative base keeps production output portable; the Session owns preview HOST/PORT.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', ['HOST', 'PORT'])
  const port = Number(env.PORT ?? 3000)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT')
  return {
    base: './',
    plugins: [
      manusGameTuning(),
      {
        name: 'html-entry-transform',
        transformIndexHtml(html) {
          return html.replace('./assets/index.js', '/src/main.ts')
        },
      },
    ],
    server: {
      host: env.HOST ?? '127.0.0.1', port, strictPort: true,
      allowedHosts: ['.manuspre.computer', '.manus.computer', '.manus-asia.computer', '.manuscomputer.ai', '.manusvm.computer', 'localhost', '127.0.0.1'],
    },
    build: {
      target: 'es2022',
      assetsInlineLimit: 0,
      chunkSizeWarningLimit: 4600,
      sourcemap: false,
      rollupOptions: {
        output: {
          entryFileNames: 'assets/index-[hash].js',
          manualChunks(id) {
            if (id.includes('node_modules/three')) return 'three.core'
            if (id.includes('node_modules/@dimforge/rapier3d-compat')) return 'rapier.core'
          },
          assetFileNames: assetInfo => {
            if (assetInfo.name && assetInfo.name.endsWith('.css')) return 'assets/index.css'
            return 'assets/[name]-[hash][extname]'
          },
        },
      },
    },
    test: { environment: 'node', include: ['tests/**/*.test.{ts,mjs}'] },
  }
})
