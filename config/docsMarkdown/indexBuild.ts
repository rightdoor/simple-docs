/**
 * Docs 索引构建：扫描 docsDirectory 生成文件索引，并聚合 Git 状态/提交/贡献者等元信息
 */
import path from 'node:path'
import { promises as fs } from 'node:fs'
import simpleGit, { type SimpleGit } from 'simple-git'
import { createShortHash, ensureFrontmatterId, parseFrontmatter } from './frontmatter'
import { markdownPathToHtmlPath, toPosix } from './paths'
import type { DocsGitCommit, DocsGitContributor, DocsGitInfo, DocsGitStatus, DocsIndexFile, DocsIndexPayload } from './types'

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

export async function buildDocsIndex(docsRoot: string, opts?: { includeGit?: boolean }) {
  const out: DocsIndexFile[] = []
  const includeGit = opts?.includeGit !== false
  const git = includeGit ? await initGit(docsRoot) : null
  let statusMap = new Map<string, DocsGitStatus>()
  let gitInfoMap = new Map<string, GitAggregateEntry>()
  if (git) {
    try {
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
  out.sort((a, b) => a.path.localeCompare(b.path))
  const payload: DocsIndexPayload = { generatedAt: new Date().toISOString(), files: out }
  return payload
}

export function buildIdMap(payload: DocsIndexPayload) {
  const map = new Map<string, string>()
  for (const f of payload.files) map.set(f.path, f.id)
  return map
}
