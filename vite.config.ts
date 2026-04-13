import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { loadDocsConfigSync } from './config/docsConfig'
import { docsFsPlugin } from './config/docsMarkdown'
import { isMathjaxModuleId, mathjaxAssetsPlugin } from './config/viteMathjax'

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig(() => {
  const configPayload = loadDocsConfigSync(process.cwd())
  const require = createRequire(import.meta.url)
  const texFontRoot = path.dirname(require.resolve('@mathjax/mathjax-tex-font/package.json'))

  return {
    define: {
      __DOCS_CONFIG__: JSON.stringify(configPayload),
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return
            if (isMathjaxModuleId(id)) return 'mathjax'
            if (id.includes('mermaid')) return 'mermaid'
            if (id.includes('chart.js')) return 'chartjs'
            if (id.includes('prismjs')) return 'prismjs'
            return 'vendor'
          },
        },
      },
    },
    plugins: [{
      name: 'mathjax-tex-font-dev-assets',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const rawUrl = typeof req.url === 'string' ? req.url : ''
          const url = decodeURIComponent(rawUrl.split('?')[0] || '')
          const prefix = '/mathjax-fonts/mathjax-tex-font/'
          if (!url.startsWith(prefix)) return next()

          const rel = url.slice(prefix.length)
          if (!rel || rel.includes('..')) {
            res.statusCode = 404
            res.end('Not Found')
            return
          }

          const abs = path.resolve(texFontRoot, rel.split('/').join(path.sep))
          if (!abs.startsWith(texFontRoot + path.sep) && abs !== texFontRoot) {
            res.statusCode = 403
            res.end('Forbidden')
            return
          }

          fs.stat(abs, (err, st) => {
            if (err || !st.isFile()) {
              res.statusCode = 404
              res.end('Not Found')
              return
            }
            const ext = path.extname(abs).toLowerCase()
            if (ext === '.js' || ext === '.mjs') res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
            else if (ext === '.json' || ext === '.map') res.setHeader('Content-Type', 'application/json; charset=utf-8')
            else if (ext === '.css') res.setHeader('Content-Type', 'text/css; charset=utf-8')
            else if (ext === '.svg') res.setHeader('Content-Type', 'image/svg+xml')
            else if (ext === '.woff2') res.setHeader('Content-Type', 'font/woff2')
            else if (ext === '.woff') res.setHeader('Content-Type', 'font/woff')
            else if (ext === '.ttf') res.setHeader('Content-Type', 'font/ttf')
            res.statusCode = 200
            fs.createReadStream(abs).pipe(res)
          })
        })
      },
    }, mathjaxAssetsPlugin(), docsFsPlugin(), vue(), cloudflare()],
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), 'src'),
        '@styles': path.resolve(process.cwd(), 'src/styles'),
        '@components': path.resolve(process.cwd(), 'src/components'),
        '@views': path.resolve(process.cwd(), 'src/views'),
      },
    },
    server: {
      port: 8080,
    },
  };
})