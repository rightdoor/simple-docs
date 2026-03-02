/**
 * 客户端索引与配置读取：提供 docs 配置/索引加载、路径解析、首页解析以及热更新变更通知能力
 */
import { tGlobal } from '@/locales'

export type DocsFile = {
  id: string
  name: string
  title?: string
  description?: string
  path: string
  type: 'html'
  created?: string
  modified?: string
  size?: number
  git?: DocsGitInfo
}

export type DocsTreeNode = {
  dirs?: Record<string, DocsTreeNode>
  files?: DocsFile[]
  readme?: DocsFile
}

export type DocsIndex = {
  generatedAt: string
  files: Array<{
    id: string
    path: string
    name: string
    title?: string
    description?: string
    created: string
    modified: string
    frontmatterCreated?: string
    frontmatterUpdated?: string
    size: number
    git?: DocsGitInfo
  }>
   isGitRepo?: boolean
  missingRoot?: boolean
  root?: string
  docsDirectory?: string
}

export type DocsGitCommit = {
  author: string
  date: string
  hash: string
  message: string
}

export type DocsGitStatus = {
  modified: boolean
  staged: boolean
  untracked: boolean
}

export type DocsGitContributor = {
  name: string
  email: string
  commits: number
}

export type DocsGitInfo = {
  lastCommit?: DocsGitCommit
  status: DocsGitStatus
  commitCount: number
  contributors: DocsGitContributor[]
}

export type DocsTheme = 'light' | 'dark' | 'auto'

export type DocsMeta = {
  title?: string
  description?: string
}

export type DocsGitConfig = {
  autoClone: boolean
  repository: string
  branch: string
  timeOut: number
  showInfo: boolean
  edit: boolean
}

export type DocsConfig = {
  title: string
  language: string
  url: string
  description: string
  docsDirectory: string
  git: DocsGitConfig
  homepage: string
  favicon: string
  defaultTheme: DocsTheme
  meta: DocsMeta
}

type DocsBootstrapPayload = {
  config?: Partial<DocsConfig>
  index?: DocsIndex
}

declare const __DOCS_CONFIG__: DocsConfig

const defaultDocsConfig: DocsConfig = __DOCS_CONFIG__

let indexPromise: Promise<DocsIndex> | null = null
let configPromise: Promise<DocsConfig> | null = null
let embeddedPayload: DocsBootstrapPayload | null | undefined

export type DocsUpdateEvent = {
  event: 'add' | 'change' | 'unlink'
  path: string
}

const docsUpdateListeners = new Set<(ev: DocsUpdateEvent) => void>()

export function onDocsUpdate(cb: (ev: DocsUpdateEvent) => void) {
  docsUpdateListeners.add(cb)
  return () => docsUpdateListeners.delete(cb)
}

export function invalidateDocsIndex() {
  indexPromise = null
}

export function invalidateDocsConfig() {
  configPromise = null
}

function readEmbeddedPayload(): DocsBootstrapPayload | null {
  if (typeof document === 'undefined') return null
  const el = document.getElementById('docs-bootstrap')
  if (!el) return null
  const text = el.textContent?.trim()
  if (!text) return null
  try {
    return JSON.parse(text) as DocsBootstrapPayload
  } catch {
    return null
  }
}

function getEmbeddedPayload() {
  if (embeddedPayload !== undefined) return embeddedPayload
  embeddedPayload = readEmbeddedPayload()
  return embeddedPayload
}

function normalizeSlashPath(input: string) {
  return input.replace(/\\/g, '/')
}

function normalizePathForCompare(input: string) {
  return normalizeSlashPath(input).replace(/^\.\//, '').replace(/^\/+/, '').replace(/\/+$/, '')
}

function normalizeFilePath(input: string) {
  return normalizeSlashPath(input).replace(/^\.\//, '').replace(/^\/+/, '')
}

function htmlPathFromSource(path: string) {
  if (/\.html$/i.test(path)) return path
  if (/\.(md|markdown)$/i.test(path)) return path.replace(/\.(md|markdown)$/i, '.html')
  return `${path}.html`
}

export async function getDocsConfig(opts?: { force?: boolean }) {
  if (opts?.force) invalidateDocsConfig()
  if (!configPromise) {
    const embedded = getEmbeddedPayload()
    if (embedded?.config) {
      configPromise = Promise.resolve(embedded.config as DocsConfig)
    } else {
      configPromise = fetch('/docs.config.json', { cache: 'no-store' })
        .then(async (res) => {
          if (!res.ok) return defaultDocsConfig
          return (await res.json()) as DocsConfig
        })
        .catch(() => defaultDocsConfig)
    }
  }
  return await configPromise
}

export function encodeDocsPathForRoute(path: string) {
  return path
    .split('/')
    .filter((p) => p.length > 0)
    .map((p) => encodeURIComponent(p))
    .join('/')
}

export async function resolveHomeRoute(config: DocsConfig) {
  const docsDir = normalizePathForCompare(config.docsDirectory)
  const homepage = normalizeFilePath(config.homepage)
  let rel = homepage
  if (docsDir && homepage.startsWith(`${docsDir}/`)) {
    rel = homepage.slice(docsDir.length + 1)
  } else if (homepage === docsDir) {
    rel = ''
  }
  if (!rel) rel = 'README.md'
  const htmlPath = htmlPathFromSource(rel)
  if (htmlPath.toLowerCase() === 'readme.html') return '/post'
  return `/post/${encodeDocsPathForRoute(htmlPath)}`
}

export async function getDocsIndex(opts?: { force?: boolean }) {
  if (opts?.force) invalidateDocsIndex()
  if (!indexPromise) {
    const embedded = getEmbeddedPayload()
    if (embedded?.index) {
      indexPromise = Promise.resolve(embedded.index)
    } else {
      indexPromise = fetch('/docs-index.json', { cache: 'no-store' }).then(async (res) => {
        if (!res.ok) throw new Error(tGlobal('error.loadDocsIndexFailed', { status: res.status }))
        return (await res.json()) as DocsIndex
      })
    }
  }
  return await indexPromise
}

if (import.meta.hot) {
  import.meta.hot.on('docs:changed', (data) => {
    invalidateDocsIndex()
    const ev = data as DocsUpdateEvent
    for (const cb of docsUpdateListeners) cb(ev)
  })
}

export async function loadDocsHtml(docsHtmlPath: string, opts?: { signal?: AbortSignal }) {
  const signal = opts?.signal
  if (import.meta.env.DEV) {
    const res = await fetch(`/docs/${docsHtmlPath}`, { cache: 'no-store', signal })
    if (!res.ok) throw new Error(tGlobal('error.docNotFound', { path: docsHtmlPath }))
    return await res.text()
  }

  let id: string | undefined
  try {
    const index = await getDocsIndex()
    const found = index.files.find((f) => f.path === docsHtmlPath || f.id === docsHtmlPath)
    id = found?.id
  } catch {}

  const url = id ? `/posts/${id}/index.html` : `/docs/${docsHtmlPath}`
  const res = await fetch(url, { cache: 'no-store', signal })
  if (!res.ok) throw new Error(tGlobal('error.docNotFound', { path: docsHtmlPath }))
  return await res.text()
}

export async function resolveDocsPathFromRoute(raw: string) {
  let decoded = raw
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    decoded = raw
  }

  const looksLikePath = decoded.includes('/') || decoded.includes('.') || decoded.toLowerCase().endsWith('.html')
  if (looksLikePath) return htmlPathFromSource(decoded)

  try {
    const index = await getDocsIndex()
    const found = index.files.find((f) => f.id === decoded)
    if (found) return found.path
  } catch {}

  return decoded
}

export function buildDocsTreeFromIndex(index: DocsIndex): DocsTreeNode {
  const root: DocsTreeNode = {}

  for (const f of index.files) {
    const p = f.path
    const parts = p.split('/').filter(Boolean)
    let cur = root
    for (const [i, part] of parts.entries()) {
      const isFile = i === parts.length - 1

      if (!isFile) {
        cur.dirs ??= {}
        cur.dirs[part] ??= {}
        cur = cur.dirs[part]!
        continue
      }

      const file: DocsFile = {
        id: f.id,
        name: f.name,
        title: f.title,
        description: f.description,
        path: p,
        type: 'html',
        created: f.created,
        modified: f.modified,
        size: f.size,
      }
      const isReadme = /^readme\.html$/i.test(part)
      if (isReadme && parts.length > 1) {
        cur.readme = file
      } else {
        cur.files ??= []
        cur.files.push(file)
      }
    }
  }

  return root
}
