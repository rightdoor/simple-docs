import path from 'node:path'
import fs from 'node:fs'
import { promises as fsp } from 'node:fs'
import type { Plugin } from 'vite'

export function isMathjaxModuleId(id: string) {
  if (
    id.includes(`${path.sep}mathjax${path.sep}`) ||
    id.includes('/mathjax/')
  ) {
    return true
  }
  return false
}

export function mathjaxAssetsPlugin(): Plugin {
  const srcRoot = path.resolve(process.cwd(), 'node_modules', 'mathjax')
  let outDir = path.resolve(process.cwd(), 'dist')

  const rootFiles = new Set(['core.js', 'loader.js', 'startup.js'])
  const rootDirs = new Set(['input', 'output', 'adaptors'])
  const blockedDirs = new Set(['a11y', 'ui', 'sre'])

  function normalizeUrlPath(rawUrl: string) {
    const q = rawUrl.indexOf('?')
    const p = q >= 0 ? rawUrl.slice(0, q) : rawUrl
    return decodeURIComponent(p)
  }

  function getContentType(filePath: string) {
    const ext = path.extname(filePath).toLowerCase()
    if (ext === '.js' || ext === '.mjs') return 'application/javascript; charset=utf-8'
    if (ext === '.json') return 'application/json; charset=utf-8'
    if (ext === '.css') return 'text/css; charset=utf-8'
    if (ext === '.svg') return 'image/svg+xml'
    if (ext === '.woff2') return 'font/woff2'
    if (ext === '.woff') return 'font/woff'
    if (ext === '.ttf') return 'font/ttf'
    return 'application/octet-stream'
  }

  async function copyDir(src: string, dst: string) {
    await fsp.mkdir(dst, { recursive: true })
    const entries = await fsp.readdir(src, { withFileTypes: true })
    for (const ent of entries) {
      if (ent.name.startsWith('.')) continue
      const srcPath = path.join(src, ent.name)
      const dstPath = path.join(dst, ent.name)
      if (ent.isDirectory()) {
        if (blockedDirs.has(ent.name)) continue
        await copyDir(srcPath, dstPath)
        continue
      }
      if (!ent.isFile()) continue
      await fsp.copyFile(srcPath, dstPath)
    }
  }

  async function ensureBuildAssets() {
    const dstRoot = path.join(outDir, 'mathjax')
    await fsp.rm(dstRoot, { recursive: true, force: true })
    await fsp.mkdir(dstRoot, { recursive: true })

    const entries = await fsp.readdir(srcRoot, { withFileTypes: true })
    for (const ent of entries) {
      if (ent.isDirectory()) {
        if (!rootDirs.has(ent.name)) continue
        await copyDir(path.join(srcRoot, ent.name), path.join(dstRoot, ent.name))
        continue
      }
      if (ent.isFile()) {
        if (!rootFiles.has(ent.name)) continue
        await fsp.copyFile(path.join(srcRoot, ent.name), path.join(dstRoot, ent.name))
      }
    }
  }

  return {
    name: 'mathjax-assets',
    configResolved(cfg) {
      outDir = path.resolve(cfg.root, cfg.build.outDir || 'dist')
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = typeof req.url === 'string' ? normalizeUrlPath(req.url) : ''
        if (!url.startsWith('/mathjax/')) return next()
        const rel = url.slice('/mathjax/'.length)
        if (!rel || rel.includes('..')) {
          res.statusCode = 404
          res.end('Not Found')
          return
        }
        const first = rel.split('/')[0] || ''
        if (blockedDirs.has(first)) {
          res.statusCode = 404
          res.end('Not Found')
          return
        }
        const abs = path.resolve(srcRoot, rel.split('/').join(path.sep))
        if (!abs.startsWith(srcRoot + path.sep) && abs !== srcRoot) {
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
          res.statusCode = 200
          res.setHeader('Content-Type', getContentType(abs))
          fs.createReadStream(abs).pipe(res)
        })
      })
    },
    async closeBundle() {
      await ensureBuildAssets()
    },
  }
}

