/**
 * 构建产物生成：预渲染 posts HTML、拷贝引用图片等资源并生成 rss.xml
 */
import path from 'node:path'
import { promises as fs } from 'node:fs'
import type { ResolvedConfig } from 'vite'
import type { DocsConfig } from '../../docsConfig'
import { defaultDocsConfig } from '../../docsConfig'
import { buildDocsIndex } from '../indexBuild'
import type { DocsIndexFile } from '../types'
import { compileMarkdownToHtmlFragment, collectLocalImagePaths, isImageFile } from '../markdown'
import { createShortHash, parseFrontmatter } from '../frontmatter'
import { buildRssXml, stripMarkdownToText } from '../rss'
import { toPosix } from '../paths'
import { buildIdMap } from '../indexBuild'
import { runWithLimit } from './utils'

export async function buildDocsBundle(opts: {
  config: ResolvedConfig
  docsConfig: DocsConfig
  docsRoot: string
}) {
  const { config, docsConfig, docsRoot } = opts
  const baseUrl = (docsConfig.url || '').trim().replace(/\/+$/, '')
  const outDir = path.resolve(config.root, config.build.outDir)
  const outDocsRoot = path.join(outDir, '_docs')
  const outAssetsRoot = path.join(outDir, 'assets')
  const outRssPath = path.join(outDir, 'rss.xml')
  await fs.mkdir(outDocsRoot, { recursive: true })
  await fs.mkdir(outAssetsRoot, { recursive: true })
  const legacyDocsAssetsRoot = path.join(outAssetsRoot, 'docs')
  await fs.rm(legacyDocsAssetsRoot, { recursive: true, force: true })
  const docsConfigPath = path.join(outDir, 'docs.config.json')
  const docsIndexPath = path.join(outDir, 'docs-index.json')
  await Promise.all([fs.rm(docsConfigPath, { force: true }).catch(() => {}), fs.rm(docsIndexPath, { force: true }).catch(() => {})])

  let rootStat: Awaited<ReturnType<typeof fs.stat>> | null = null
  try {
    rootStat = await fs.stat(docsRoot)
  } catch {
    rootStat = null
  }

  async function ensureFavicon() {
    const raw = (docsConfig.favicon || defaultDocsConfig.favicon || '').trim()
    if (!raw) return
    let href = raw.replace(/\\/g, '/')
    if (href.startsWith('public/')) href = href.slice('public'.length)
    if (!href.startsWith('/')) href = `/${href}`
    const target = path.join(outDir, href.replace(/^\//, '').split('/').join(path.sep))
    const targetDir = path.dirname(target)
    await fs.mkdir(targetDir, { recursive: true }).catch(() => {})
    try {
      const st = await fs.stat(target)
      if (st.isFile()) return
    } catch {}
    const base = path.basename(target)
    const legacySource = path.join(outDir, base)
    try {
      const st = await fs.stat(legacySource)
      if (st.isFile()) {
        await fs.copyFile(legacySource, target)
      }
    } catch {}
  }

  if (!rootStat || !rootStat.isDirectory()) {
    await ensureFavicon()
    try {
      const emptyRss = buildRssXml({
        channelTitle: docsConfig.title,
        channelDescription: docsConfig.description,
        channelLink: baseUrl,
        items: [],
      })
      await fs.writeFile(outRssPath, emptyRss, 'utf8')
    } catch {}
    return
  }

  const payload = await buildDocsIndex(docsRoot, { includeGit: docsConfig.git?.showInfo !== false })
  const idByPath = buildIdMap(payload)
  await ensureFavicon()

  const pages: Array<{ file: DocsIndexFile; text: string; mdPath: string }> = []
  for (const f of payload.files) {
    const htmlRel = f.path
    const mdRel = htmlRel.replace(/\.html$/i, '.md')
    const markdownRel = htmlRel.replace(/\.html$/i, '.markdown')
    const mdFull = path.resolve(docsRoot, mdRel.split('/').join(path.sep))
    const markdownFull = path.resolve(docsRoot, markdownRel.split('/').join(path.sep))

    let sourcePath: string | null = null
    try {
      const st = await fs.stat(mdFull)
      if (st.isFile()) sourcePath = mdFull
    } catch {}
    if (!sourcePath) {
      try {
        const st = await fs.stat(markdownFull)
        if (st.isFile()) sourcePath = markdownFull
      } catch {}
    }
    if (!sourcePath) return

    const text = await fs.readFile(sourcePath, 'utf8')
    const mdPath = toPosix(path.relative(docsRoot, sourcePath))
    pages.push({ file: f, text, mdPath })
  }

  try {
    const items = pages.map((p) => {
      const fm = parseFrontmatter(p.text).data
      const title = (p.file.title || fm.title || p.file.name || p.file.path).trim()
      const contentText = stripMarkdownToText(p.text)
      const descFromMeta = (p.file.description || fm.description || '').trim()
      const description = descFromMeta || contentText.slice(0, 240).trim()
      const pubIso = p.file.modified || p.file.created || new Date().toISOString()
      const pubDate = new Date(pubIso).toUTCString()
      return {
        id: p.file.id,
        title,
        link: baseUrl ? `${baseUrl}/docs/${encodeURIComponent(p.file.id)}` : `/docs/${encodeURIComponent(p.file.id)}`,
        description,
        content: contentText,
        pubDate,
        updatedIso: pubIso,
      }
    })
    const rss = buildRssXml({
      channelTitle: docsConfig.title,
      channelDescription: docsConfig.description,
      channelLink: baseUrl,
      items,
    })
    await fs.writeFile(outRssPath, rss, 'utf8')
  } catch {}

  const assetMap = new Map<string, string>()
  for (const page of pages) {
    const imageRefs = collectLocalImagePaths(page.text, page.mdPath)
    for (const rel of imageRefs) {
      if (assetMap.has(rel)) continue
      const full = path.resolve(docsRoot, rel.split('/').join(path.sep))
      let st: Awaited<ReturnType<typeof fs.stat>>
      try {
        st = await fs.stat(full)
      } catch {
        continue
      }
      if (!st.isFile() || !isImageFile(full)) continue
      const ext = path.extname(full).toLowerCase()
      const fileName = `${createShortHash(rel)}${ext}`
      const outFile = path.join(outAssetsRoot, fileName)
      await fs.mkdir(path.dirname(outFile), { recursive: true })
      await fs.copyFile(full, outFile)
      assetMap.set(rel, fileName)
    }
  }

  const tasks = pages.map((page) => async () => {
    const html = await compileMarkdownToHtmlFragment(page.text, page.mdPath, idByPath, '/assets/', docsConfig.language, assetMap)
    const outFile = path.resolve(outDocsRoot, page.file.id, 'index.html')
    await fs.mkdir(path.dirname(outFile), { recursive: true })
    await fs.writeFile(outFile, html, 'utf8')
  })

  await runWithLimit(tasks, 8)
}

