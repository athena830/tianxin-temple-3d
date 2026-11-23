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
    resolve: {
      alias: {
        'lunar-typescript': new URL('./node_modules/lunar-typescript/dist/lib/index.mjs', import.meta.url).pathname,
      },
    },
    plugins: [
      manusGameTuning(),
      {
        name: 'html-entry-transform',
        transformIndexHtml: {
          order: 'pre',
          handler(html) {
            return html.replace(/\.\/assets\/index[^"']*\.js/, '/src/main.ts')
          },
        },
      },
      {
        // iztro statically imports 6 language packs and full i18next, while the app only uses
        // zh-TW/zh-CN flat dictionary lookups. Trimming unused locales and replacing i18next
        // with a lightweight drop-in shim keeps the gzipped JS bundle safely under 2.00 MB.
        name: 'iztro-trim-bundle',
        enforce: 'pre',
        resolveId(id) {
          if (id === 'i18next') return '\0i18next-lite'
        },
        load(id) {
          if (id === '\0i18next-lite') {
            return `
              let currentLng = 'zh-CN';
              let store = {};
              const i18next = {
                get language() { return currentLng; },
                init(opts = {}) {
                  if (opts.lng) currentLng = opts.lng;
                  if (opts.resources) store = opts.resources;
                  return Promise.resolve();
                },
                changeLanguage(lng) {
                  if (lng) currentLng = lng;
                  return Promise.resolve();
                },
                t(key, opts = {}) {
                  const lng = (opts && opts.lng) || currentLng;
                  const dict = (store[lng] && store[lng].translation) || (store['zh-CN'] && store['zh-CN'].translation) || {};
                  let out = Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : String(key ?? '');
                  if (typeof out === 'string' && opts && typeof opts === 'object') {
                    out = out.replace(/\\{\\{\\s*(\\w+)\\s*\\}\\}/g, (_, k) => (opts[k] !== undefined ? String(opts[k]) : ''));
                  }
                  return out;
                },
              };
              export default i18next;
            `
          }
          if (/[\\/]iztro[\\/]lib[\\/]i18n[\\/]locales[\\/](en-US|ja-JP|ko-KR|vi-VN)[\\/]/.test(id)) {
            return 'export default {}'
          }
        },
        transform(code, id) {
          // lunar-typescript ships huge hex-encoded almanac 宜忌 & China holiday tables that iztro never reads.
          if (/[\\/]lunar-typescript[\\/]dist[\\/]lib[\\/]index\.mjs$/.test(id)) {
            const trimmed = code
              .replace(/static DAY_YI_JI = "[^"]*";/, 'static DAY_YI_JI = "";')
              .replace(/static TIME_YI_JI = "[^"]*";/, 'static TIME_YI_JI = "";')
              .replace(/static DATA = "[^"]*";/, 'static DATA = "";')
            return { code: trimmed, map: null }
          }
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
