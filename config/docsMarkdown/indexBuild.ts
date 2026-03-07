/**
 * Docs 索引构建：扫描 docsDirectory 生成文件索引，并聚合 Git 状态/提交/贡献者等元信息
 */
import path from 'node:path'
import { promises as fs } from 'node:fs'
import simpleGit, { type SimpleGit } from 'simple-git'
import { createShortHash, ensureFrontmatterId, parseFrontmatter } from './frontmatter'
import { markdownPathToHtmlPath, toPosix } from './paths'
import type {
  DocsGitCommit,
  DocsGitContributor,
  DocsGitInfo,
  DocsGitStatus,
  DocsIndexFile,
  DocsIndexPayload,
  DocsSidebarTreeChild,
  DocsSidebarTreeFile,
  DocsSidebarTreeNode,
} from './types'

async function initGit(docsRoot: string) {
  try {
    const gitDir = path.join(docsRoot, '.git')
    const st = await fs.stat(gitDir)
    if (!st) return null
  } catch {
    return null
  }
  return simpleGit({ baseDir: docsRoot })
}

function buildGitStatusMap(status: Awaited<ReturnType<SimpleGit['status']>>) {
  const map = new Map<string, DocsGitStatus>()
  const notAdded = new Set(status.not_added.map((p) => toPosix(p)))
  status.files.forEach((file) => {
    const p = toPosix(file.path)
    const untracked = file.working_dir === '?' || file.index === '?' || notAdded.has(p)
    if (untracked) {
      map.set(p, { modified: false, staged: false, untracked: true })
      return
    }
    const staged = file.index !== ' '
    const modified = file.working_dir !== ' '
    map.set(p, { modified, staged, untracked: false })
  })
  notAdded.forEach((p) => {
    if (!map.has(p)) map.set(p, { modified: false, staged: false, untracked: true })
  })
  return map
}

type GitAggregateEntry = {
  lastCommit?: DocsGitCommit
  commitCount: number
  contributors: Map<string, DocsGitContributor>
}

function buildGitInfoMap(gitLog: string) {
  const map = new Map<string, GitAggregateEntry>()
  const lines = gitLog.split('\n')
  let current: DocsGitCommit | null = null
  let currentEmail = ''
  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    if (!line) {
      current = null
      currentEmail = ''
      continue
    }
    if (line.includes('\x1f')) {
      const parts = line.split('\x1f')
      if (parts.length >= 5) {
        current = {
          hash: parts[0] ?? '',
          author: parts[1] ?? '',
          date: parts[3] ?? '',
          message: parts.slice(4).join('\x1f'),
        }
        currentEmail = parts[2] ?? ''
      } else {
        current = null
        currentEmail = ''
      }
      continue
    }
    if (!current) continue
    const filePath = toPosix(line.trim())
    if (!filePath) continue
    let entry = map.get(filePath)
    if (!entry) {
      entry = { commitCount: 0, contributors: new Map() }
      map.set(filePath, entry)
    }
    entry.commitCount += 1
    if (!entry.lastCommit) entry.lastCommit = current
    const key = `${current.author}\u0000${currentEmail}`
    const existing = entry.contributors.get(key)
    if (existing) {
      existing.commits += 1
    } else {
      entry.contributors.set(key, { name: current.author, email: currentEmail, commits: 1 })
    }
  }
  return map
}

function toGitInfo(entry: GitAggregateEntry | undefined, statusMap: Map<string, DocsGitStatus>, relPath: string) {
  const status = statusMap.get(relPath) ?? { modified: false, staged: false, untracked: false }
  if (!entry) return { status, commitCount: 0, contributors: [] } as DocsGitInfo
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
  const contributors = Array.from(entry.contributors.values()).sort((a, b) => {
    if (b.commits !== a.commits) return b.commits - a.commits
    return collator.compare(a.name, b.name)
  })
  return { lastCommit: entry.lastCommit, status, commitCount: entry.commitCount, contributors } as DocsGitInfo
}

type TreeNode = {
  dirs: Map<string, TreeNode>
  files: Array<{ file: DocsIndexFile; name: string }>
}

function createTreeNode(): TreeNode {
  return { dirs: new Map(), files: [] }
}

function normalizeRelPath(p: string) {
  return toPosix(p).replace(/^\.\//, '').replace(/^\/+/, '')
}

function buildDefaultOrderedFiles(files: DocsIndexFile[]) {
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
  const root = createTreeNode()

  for (const f of files) {
    const parts = normalizeRelPath(f.path).split('/').filter(Boolean)
    if (!parts.length) continue
    const fileName = parts[parts.length - 1] || ''
    const dirParts = parts.slice(0, -1)
    let cur = root
    for (const part of dirParts) {
      let next = cur.dirs.get(part)
      if (!next) {
        next = createTreeNode()
        cur.dirs.set(part, next)
      }
      cur = next
    }
    cur.files.push({ file: f, name: fileName })
  }

  function sortNode(node: TreeNode) {
    for (const child of node.dirs.values()) sortNode(child)
    node.files.sort((a, b) => collator.compare(a.name, b.name))
    const sortedDirs = Array.from(node.dirs.entries()).sort((a, b) => collator.compare(a[0], b[0]))
    node.dirs = new Map(sortedDirs)
  }

  sortNode(root)

  const ordered: DocsIndexFile[] = []

  function walk(node: TreeNode, prefix: string) {
    for (const [dirName, child] of node.dirs.entries()) {
      const nextPrefix = prefix ? `${prefix}/${dirName}` : dirName
      walk(child, nextPrefix)
    }
    for (const { file } of node.files) {
      ordered.push(file)
    }
  }

  walk(root, '')
  return ordered
}

async function readIndexJson(docsRoot: string) {
  const filePath = path.join(docsRoot, 'index.json')
  let st: Awaited<ReturnType<typeof fs.stat>> | null = null
  try {
    st = await fs.stat(filePath)
  } catch {
    st = null
  }
  if (!st || !st.isFile()) return null
  const raw = await fs.readFile(filePath, 'utf8')
  return JSON.parse(raw) as unknown
}

function toSidebarFile(f: DocsIndexFile): DocsSidebarTreeFile {
  return {
    id: f.id,
    name: f.name,
    title: f.title,
    description: f.description,
    path: f.path,
    type: 'html',
    created: f.created,
    modified: f.modified,
    size: f.size,
  }
}

function applyIndexJsonOrder(files: DocsIndexFile[], rawIndexJson: unknown) {
  if (!Array.isArray(rawIndexJson)) throw new Error('index.json root is not array')
  const byHtmlPath = new Map(files.map((f) => [normalizeRelPath(f.path), f] as const))

  const used = new Set<string>()
  const ordered: DocsIndexFile[] = []
  const sidebarTree: DocsSidebarTreeNode = {}

  let groupSeq = 0

  function toHtmlPathFromIndexRef(rel: string) {
    const normalized = normalizeRelPath(rel)
    return markdownPathToHtmlPath(normalized)
  }

  function ensureNodeDirs(node: DocsSidebarTreeNode) {
    node.dirs ??= {}
    return node.dirs
  }

  function ensureNodeFiles(node: DocsSidebarTreeNode) {
    node.files ??= []
    return node.files
  }

  function ensureNodeChildren(node: DocsSidebarTreeNode) {
    node.children ??= []
    return node.children
  }

  function visit(entry: unknown, node: DocsSidebarTreeNode) {
    if (typeof entry === 'string') {
      const htmlPath = toHtmlPathFromIndexRef(entry)
      const normalized = normalizeRelPath(htmlPath)
      if (used.has(normalized)) throw new Error(`duplicate file: ${normalized}`)
      const f = byHtmlPath.get(normalized)
      if (!f) throw new Error(`unknown file: ${normalized}`)
      used.add(normalized)
      ordered.push(f)

      const file = toSidebarFile(f)
      const filesArr = ensureNodeFiles(node)
      filesArr.push(file)
      const childrenArr = ensureNodeChildren(node)
      childrenArr.push({ type: 'file', file } satisfies DocsSidebarTreeChild)
      return
    }

    if (!entry || typeof entry !== 'object') throw new Error('invalid entry')
    const obj = entry as Record<string, unknown>
    const title = typeof obj.title === 'string' ? obj.title.trim() : ''
    const docs = obj.docs
    if (!title || !Array.isArray(docs)) throw new Error('invalid group entry')

    const dirKey = `__g${groupSeq++}`
    const dirs = ensureNodeDirs(node)
    if (dirs[dirKey]) throw new Error(`duplicate group key: ${dirKey}`)
    const dirNode: DocsSidebarTreeNode = { title }
    dirs[dirKey] = dirNode
    const childrenArr = ensureNodeChildren(node)
    childrenArr.push({ type: 'dir', name: dirKey } satisfies DocsSidebarTreeChild)

    for (const child of docs) visit(child, dirNode)
  }

  for (const entry of rawIndexJson) visit(entry, sidebarTree)
  return { ordered, sidebarTree }
}

export async function buildDocsIndex(docsRoot: string, opts?: { includeGit?: boolean }) {
  const out: DocsIndexFile[] = []
  const includeGit = opts?.includeGit !== false
  const git = includeGit ? await initGit(docsRoot) : null
  let repoUrl = ''
  let repoBranch = ''
  let statusMap = new Map<string, DocsGitStatus>()
  let gitInfoMap = new Map<string, GitAggregateEntry>()
  if (git) {
    try {
      try {
        const remotes = await git.getRemotes(true)
        const origin = remotes.find((r) => r.name === 'origin') ?? remotes[0]
        const refs = origin?.refs
        repoUrl = String(refs?.fetch || refs?.push || '').trim()
      } catch {
        repoUrl = ''
      }

      try {
        const br = await git.branchLocal()
        repoBranch = String(br.current || '').trim()
      } catch {
        repoBranch = ''
      }

      const status = await git.status()
      statusMap = buildGitStatusMap(status)
      const log = await git.raw([
        '-c',
        'core.quotepath=false',
        'log',
        '--name-only',
        '--date=iso-strict',
        '--pretty=format:%H%x1f%an%x1f%ae%x1f%ad%x1f%s',
      ])
      gitInfoMap = buildGitInfoMap(log)
    } catch {
      statusMap = new Map()
      gitInfoMap = new Map()
    }
  }

  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
        continue
      }

      const lower = entry.name.toLowerCase()
      if (!lower.endsWith('.md') && !lower.endsWith('.markdown')) continue

      const st = await fs.stat(full)
      const rel = toPosix(path.relative(docsRoot, full))
      let title: string | undefined
      let description: string | undefined
      let id: string
      let gitInfo: DocsGitInfo | undefined
      let frontmatterCreated: string | undefined
      let frontmatterUpdated: string | undefined
      try {
        const text = await fs.readFile(full, 'utf8')
        const ensured = ensureFrontmatterId(text, rel)
        if (ensured.changed) {
          await fs.writeFile(full, ensured.text, 'utf8')
        }
        id = ensured.id
        const fm = parseFrontmatter(ensured.text).data
        title = fm.title || undefined
        description = fm.description || undefined
        const createdRaw = (fm.created || fm.date || '').trim()
        const updatedRaw = (fm.updated || '').trim()
        frontmatterCreated = createdRaw || undefined
        frontmatterUpdated = updatedRaw || undefined
      } catch {
        title = undefined
        description = undefined
        id = createShortHash(rel)
        frontmatterCreated = undefined
        frontmatterUpdated = undefined
      }

      if (git) {
        gitInfo = toGitInfo(gitInfoMap.get(rel), statusMap, rel)
      }

      out.push({
        id,
        path: markdownPathToHtmlPath(rel),
        name: entry.name,
        title,
        description,
        created: st.birthtime.toISOString(),
        modified: st.mtime.toISOString(),
        frontmatterCreated,
        frontmatterUpdated,
        size: st.size,
        git: gitInfo,
      })
    }
  }

  await walk(docsRoot)
  let orderedFiles = buildDefaultOrderedFiles(out)
  const payload: DocsIndexPayload = { generatedAt: new Date().toISOString(), files: orderedFiles }
  if (repoUrl) payload.gitRepoUrl = repoUrl
  if (repoBranch) payload.gitBranch = repoBranch

  try {
    const rawIndex = await readIndexJson(docsRoot)
    if (rawIndex) {
      const applied = applyIndexJsonOrder(orderedFiles, rawIndex)
      orderedFiles = applied.ordered
      payload.files = orderedFiles
      payload.orderSource = 'index.json'
      payload.sidebarTree = applied.sidebarTree
    }
  } catch {
    payload.files = buildDefaultOrderedFiles(out)
  }
  return payload
}

export function buildIdMap(payload: DocsIndexPayload) {
  const map = new Map<string, string>()
  for (const f of payload.files) map.set(f.path, f.id)
  return map
}
