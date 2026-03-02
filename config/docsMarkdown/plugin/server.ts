/**
 * Dev Server 中间件：提供 /docs/* 资源读取与 .md/.markdown 即时编译，并发布 HMR 变更事件
 */
import path from 'node:path'
import { createReadStream, promises as fs } from 'node:fs'
import type { ViteDevServer } from 'vite'
import { compileMarkdownToHtmlFragment } from '../markdown'
import { markdownPathToHtmlPath, toPosix } from '../paths'
import { buildIdMap } from '../indexBuild'
import type { DocsConfig } from '../../docsConfig'
import type { DocsIndexPayload } from '../types'
import { contentTypeByExt } from './utils'

export function attachDocsServer(server: ViteDevServer, opts: {
  docsRoot: string
  docsConfig: DocsConfig
  ensureIndex: () => Promise<DocsIndexPayload>
  ensureRssXml: () => Promise<string>
  markIndexDirty: () => void
  markRssDirty: () => void
  getConfigPayload: () => DocsConfig
}) {
  const { docsRoot, docsConfig, ensureIndex, ensureRssXml, markIndexDirty, markRssDirty, getConfigPayload } = opts

  void fs
    .stat(docsRoot)
    .then((st) => {
      if (st.isDirectory()) server.watcher.add(docsRoot)
    })
    .catch(() => {})

  server.watcher.on('all', (event, file) => {
    if (!file) return
    const rel = toPosix(path.relative(docsRoot, file))
    if (rel.startsWith('..')) return
    markIndexDirty()
    markRssDirty()
    if (event !== 'add' && event !== 'change' && event !== 'unlink') return
    server.ws.send({ type: 'custom', event: 'docs:changed', data: { event, path: markdownPathToHtmlPath(rel) } })
  })

  server.middlewares.use(async (req, res, next) => {
    if (!req.url) return next()
    const u = new URL(req.url, 'http://localhost')
    if (u.pathname === '/docs.config.json') {
      const payload = getConfigPayload()
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      res.end(JSON.stringify(payload, null, 2))
      return
    }
    if (u.pathname === '/docs-index.json') {
      const payload = await ensureIndex()
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      res.end(JSON.stringify(payload, null, 2))
      return
    }
    if (u.pathname === '/rss.xml') {
      const rss = await ensureRssXml()
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      res.end(rss)
      return
    }

    if (!u.pathname.startsWith('/docs/')) return next()

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.statusCode = 405
      res.end('Method Not Allowed')
      return
    }

    let relPath = u.pathname.slice('/docs/'.length)
    try {
      relPath = decodeURIComponent(relPath)
    } catch {
      res.statusCode = 400
      res.end('Bad Request')
      return
    }

    const docsAbs = docsRoot
    const requested = path.resolve(docsAbs, relPath.split('/').join(path.sep))
    if (requested !== docsAbs && !requested.startsWith(docsAbs + path.sep)) {
      res.statusCode = 403
      res.end('Forbidden')
      return
    }

    if (relPath.toLowerCase().endsWith('.html')) {
      const mdRel = relPath.replace(/\.html$/i, '.md')
      const markdownRel = relPath.replace(/\.html$/i, '.markdown')
      const mdTarget = path.resolve(docsAbs, mdRel.split('/').join(path.sep))
      const markdownTarget = path.resolve(docsAbs, markdownRel.split('/').join(path.sep))

      let sourcePath: string | null = null
      try {
        const st = await fs.stat(mdTarget)
        if (st.isFile()) sourcePath = mdTarget
      } catch {}
      if (!sourcePath) {
        try {
          const st = await fs.stat(markdownTarget)
          if (st.isFile()) sourcePath = markdownTarget
        } catch {}
      }

      if (!sourcePath) {
        res.statusCode = 404
        res.end('Not Found')
        return
      }

      res.statusCode = 200
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      if (req.method === 'HEAD') {
        res.end()
        return
      }

      try {
        const text = await fs.readFile(sourcePath, 'utf8')
        const mdPathForRewrite = toPosix(path.relative(docsAbs, sourcePath))
        const index = await ensureIndex()
        const idByPath = buildIdMap(index)
        const html = await compileMarkdownToHtmlFragment(text, mdPathForRewrite, idByPath, '/docs/', docsConfig.language)
        res.end(html)
      } catch {
        res.statusCode = 500
        res.end('Internal Server Error')
      }
      return
    }

    let st: Awaited<ReturnType<typeof fs.stat>>
    try {
      st = await fs.stat(requested)
    } catch {
      res.statusCode = 404
      res.end('Not Found')
      return
    }

    if (!st.isFile()) {
      res.statusCode = 404
      res.end('Not Found')
      return
    }

    res.statusCode = 200
    res.setHeader('Content-Type', contentTypeByExt(requested))
    res.setHeader('Cache-Control', 'no-store')
    if (req.method === 'HEAD') {
      res.end()
      return
    }

    const stream = createReadStream(requested)
    stream.on('error', () => {
      res.statusCode = 500
      res.end('Internal Server Error')
    })
    stream.pipe(res)
  })
}
