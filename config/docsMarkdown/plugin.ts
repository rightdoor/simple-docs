/**
 * Vite Docs 文件系统插件：提供 dev server 读取/编译 docs、生成 docs-index 与 rss，并在 build 输出静态产物
 */
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { type Plugin, type ResolvedConfig } from 'vite'
import { applyHtmlMeta, defaultDocsConfig, loadDocsConfigSync } from '../docsConfig'
import { buildDocsIndex } from './indexBuild'
import { parseFrontmatter } from './frontmatter'
import { tBuild } from './locale'
import { buildRssXml, stripMarkdownToText } from './rss'
import type { DocsIndexPayload } from './types'
import { applyHtmlLang, injectDocsBootstrap } from './plugin/bootstrap'
import { ensureAutoClone, isGitRepo } from './plugin/git'
import { attachDocsServer } from './plugin/server'
import { buildDocsBundle } from './plugin/build'

export function docsFsPlugin(): Plugin {
  let config: ResolvedConfig
  let docsConfig = defaultDocsConfig
  let cachedIndex: DocsIndexPayload | null = null
  let indexDirty = true
  let cachedRss: string | null = null
  let rssDirty = true
  let gitRepoLogged = false
  let indexOrderLogged: 'missing' | 'custom_ok' | 'custom_bad' | null = null
  let viteCommand: 'serve' | 'build' = 'build'

  function getDocsRoot() {
    return path.resolve(config.root, docsConfig.docsDirectory)
  }

  function logBuild(key: string, vars?: Record<string, string | number>) {
    console.log(tBuild(docsConfig.language, key, vars))
  }

  function logGitRepoStatus(docsDirectory: string, yes: boolean) {
    if (gitRepoLogged) return
    gitRepoLogged = true
    const showInfo = docsConfig.git?.showInfo !== false
    if (yes && !showInfo) {
      logBuild('build.gitRepoYesButDisabled', { dir: docsDirectory })
      return
    }
    if (yes) {
      logBuild('build.gitRepoYes', { dir: docsDirectory })
      return
    }
    logBuild('build.gitRepoNo', { dir: docsDirectory })
  }

  async function ensureIndex() {
    if (!indexDirty && cachedIndex) return cachedIndex
    const docsRoot = getDocsRoot()
    let st: Awaited<ReturnType<typeof fs.stat>> | null = null
    try {
      st = await fs.stat(docsRoot)
    } catch {
      st = null
    }
    if (!st || !st.isDirectory()) {
      cachedIndex = {
        generatedAt: new Date().toISOString(),
        files: [],
        isGitRepo: false,
        missingRoot: true,
        root: docsRoot,
        docsDirectory: docsConfig.docsDirectory,
      }
      indexDirty = false
      return cachedIndex
    }
    let indexJsonExists = false
    try {
      const st = await fs.stat(path.join(docsRoot, 'index.json'))
      indexJsonExists = st.isFile()
    } catch {
      indexJsonExists = false
    }
    const payload = await buildDocsIndex(docsRoot, { includeGit: docsConfig.git?.showInfo !== false })
    if (!indexJsonExists) {
      if (indexOrderLogged !== 'missing') {
        logBuild('build.indexJsonMissingDefaultOrder')
        indexOrderLogged = 'missing'
      }
    } else if (payload.orderSource === 'index.json') {
      if (indexOrderLogged !== 'custom_ok') {
        logBuild('build.indexJsonCustomOrderOk')
        indexOrderLogged = 'custom_ok'
      }
    } else {
      if (indexOrderLogged !== 'custom_bad') {
        logBuild('build.indexJsonCustomOrderBad')
        indexOrderLogged = 'custom_bad'
      }
    }
    const yes = await isGitRepo(docsRoot)
    cachedIndex = { ...payload, isGitRepo: yes }
    indexDirty = false
    return cachedIndex
  }

  async function ensureRssXml() {
    if (!rssDirty && cachedRss) return cachedRss
    const baseUrl = (docsConfig.url || '').trim().replace(/\/+$/, '')
    const docsRoot = getDocsRoot()
    let st: Awaited<ReturnType<typeof fs.stat>> | null = null
    try {
      st = await fs.stat(docsRoot)
    } catch {
      st = null
    }

    if (!st || !st.isDirectory()) {
      cachedRss = buildRssXml({
        channelTitle: docsConfig.title,
        channelDescription: docsConfig.description,
        channelLink: baseUrl,
        items: [],
      })
      rssDirty = false
      return cachedRss
    }

    const index = await ensureIndex()
    const items: Array<{
      id: string
      title: string
      link: string
      description: string
      content: string
      pubDate: string
      updatedIso: string
    }> = []

    for (const f of index.files) {
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
      if (!sourcePath) continue

      let markdown = ''
      try {
        markdown = await fs.readFile(sourcePath, 'utf8')
      } catch {
        continue
      }

      const parsed = parseFrontmatter(markdown).data
      const title = (f.title || parsed.title || f.name || f.path).trim()
      const contentText = stripMarkdownToText(markdown)
      const descFromMeta = (f.description || parsed.description || '').trim()
      const description = descFromMeta || contentText.slice(0, 240).trim()
      const pubIso = f.modified || f.created || new Date().toISOString()
      const pubDate = new Date(pubIso).toUTCString()

      items.push({
        id: f.id,
        title,
        link: baseUrl ? `${baseUrl}/docs/${encodeURIComponent(f.id)}` : `/docs/${encodeURIComponent(f.id)}`,
        description,
        content: contentText,
        pubDate,
        updatedIso: pubIso,
      })
    }

    cachedRss = buildRssXml({
      channelTitle: docsConfig.title,
      channelDescription: docsConfig.description,
      channelLink: baseUrl,
      items,
    })
    rssDirty = false
    return cachedRss
  }

  return {
    name: 'docs-fs',
    enforce: 'pre',
    configResolved(resolved) {
      config = resolved
      docsConfig = loadDocsConfigSync(resolved.root)
      viteCommand = resolved.command
    },
    async buildStart() {
      const docsRoot = getDocsRoot()
      const cloneResult = await ensureAutoClone({
        docsConfig,
        docsRoot,
        mode: viteCommand,
        logBuild,
      })
      if (cloneResult.blocked) {
        const err = new Error(cloneResult.message || '')
        err.stack = ''
        this.error(err)
      }

      if (docsConfig.git?.autoClone !== true) {
        let st: Awaited<ReturnType<typeof fs.stat>> | null = null
        try {
          st = await fs.stat(docsRoot)
        } catch {
          st = null
        }
        if (!st) {
          await fs.mkdir(docsRoot, { recursive: true })
          logBuild('build.autoCreateDocsDir', { dir: docsConfig.docsDirectory })
        }
      }

      const yes = await isGitRepo(docsRoot)
      logGitRepoStatus(docsConfig.docsDirectory, yes)
    },
    async transformIndexHtml(html) {
      const configPayload = loadDocsConfigSync(config.root)
      const indexPayload = await ensureIndex()
      const metaApplied = applyHtmlMeta(html, configPayload)
      const langApplied = applyHtmlLang(metaApplied, configPayload.language)
      return injectDocsBootstrap(langApplied, { config: configPayload, index: indexPayload })
    },
    configureServer(server) {
      attachDocsServer(server, {
        docsRoot: getDocsRoot(),
        docsConfig,
        ensureIndex,
        ensureRssXml,
        markIndexDirty: () => (indexDirty = true),
        markRssDirty: () => (rssDirty = true),
        getConfigPayload: () => loadDocsConfigSync(config.root),
      })
    },
    async closeBundle() {
      await buildDocsBundle({ config, docsConfig, docsRoot: getDocsRoot() })
    },
  }
}
