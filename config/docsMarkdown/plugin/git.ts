/**
 * Git 自动克隆与仓库校验：根据 docs.config.json 的 git 配置自动 clone，并检测仓库/分支匹配
 */
import path from 'node:path'
import { promises as fs } from 'node:fs'
import simpleGit from 'simple-git'
import type { DocsConfig } from '../../docsConfig'
import { tBuild } from '../locale'

export async function isGitRepo(docsRoot: string) {
  try {
    const st = await fs.stat(path.join(docsRoot, '.git'))
    return st.isDirectory() || st.isFile()
  } catch {
    return false
  }
}

function normalizeRepoUrl(input: string) {
  const raw = String(input || '').trim()
  if (!raw) return ''
  return raw.replace(/\/+$/, '').replace(/\.git$/i, '').toLowerCase()
}

function sanitizeRemoteUrl(input: string) {
  const raw = String(input || '').trim()
  if (!raw) return ''
  try {
    const url = new URL(raw)
    if (url.username || url.password) {
      url.username = ''
      url.password = ''
    }
    return url.toString()
  } catch {
    const match = raw.match(/^([a-z][a-z0-9+.-]*:\/\/)([^@\/\s]+@)(.*)$/i)
    if (match) return `${match[1]}${match[3]}`
    return raw
  }
}

async function getRepoInfo(docsRoot: string) {
  const gitClient = simpleGit({ baseDir: docsRoot })
  let remote = ''
  try {
    const remotes = await gitClient.getRemotes(true)
    const origin = remotes.find((r) => r.name === 'origin') ?? remotes[0]
    const refs = origin?.refs
    remote = sanitizeRemoteUrl(String(refs?.fetch || refs?.push || '').trim())
  } catch {
    remote = ''
  }

  let currentBranch = ''
  try {
    const br = await gitClient.branchLocal()
    currentBranch = String(br.current || '').trim()
  } catch {
    currentBranch = ''
  }

  return { remote, currentBranch }
}

export async function ensureAutoClone(opts: {
  docsConfig: DocsConfig
  docsRoot: string
  mode: 'serve' | 'build'
  logBuild: (key: string, vars?: Record<string, string | number>) => void
}) {
  const { docsConfig, docsRoot, mode, logBuild } = opts
  const git = docsConfig.git
  if (!git?.autoClone) return { performed: false, blocked: false as const, message: '' }

  const docsDirectory = docsConfig.docsDirectory
  const repository = typeof git.repository === 'string' ? git.repository.trim() : ''
  const branch = typeof git.branch === 'string' ? git.branch.trim() : ''
  const timeOut =
    typeof (git as DocsConfig['git'] & { timeOut?: unknown }).timeOut === 'number' &&
    Number.isFinite((git as DocsConfig['git'] & { timeOut?: unknown }).timeOut) &&
    (git as DocsConfig['git'] & { timeOut?: unknown }).timeOut > 0
      ? (git as DocsConfig['git'] & { timeOut?: unknown }).timeOut
      : 60000

  if (!repository) {
    const msg = tBuild(docsConfig.language, 'build.gitRepositoryMissing')
    if (mode === 'serve') {
      console.log(msg)
      return { performed: true, blocked: false as const, message: '' }
    }
    return { performed: true, blocked: true as const, message: `\n${msg}` }
  }

  if (!branch) {
    logBuild('build.gitBranchMissing')
    return { performed: true, blocked: false as const, message: '' }
  }

  let st: Awaited<ReturnType<typeof fs.stat>> | null = null
  try {
    st = await fs.stat(docsRoot)
  } catch {
    st = null
  }

  if (st) {
    if (st.isDirectory()) {
      logBuild('build.skipGitClone', { dir: docsDirectory })

      const isRepo = await isGitRepo(docsRoot)
      if (!isRepo) {
        logBuild('build.autoCloneDocsNotGit', { dir: docsDirectory })
        return { performed: true, blocked: false as const, message: '' }
      }

      const { remote, currentBranch } = await getRepoInfo(docsRoot)
      const expectedRepo = normalizeRepoUrl(repository)
      const actualRepo = normalizeRepoUrl(remote)
      if (expectedRepo && actualRepo && expectedRepo !== actualRepo) {
        logBuild('build.autoCloneRepoMismatch', { dir: docsDirectory, expected: repository, actual: remote || '-' })
        return { performed: true, blocked: false as const, message: '' }
      }

      if (branch && currentBranch && branch !== currentBranch) {
        logBuild('build.autoCloneBranchMismatch', { dir: docsDirectory, expected: branch, actual: currentBranch })
        return { performed: true, blocked: false as const, message: '' }
      }

      try {
        const gitClient = simpleGit({ baseDir: docsRoot }).env({ GIT_TERMINAL_PROMPT: '0' })
        const shallow = (await gitClient.raw(['rev-parse', '--is-shallow-repository']).catch(() => '')).trim()
        if (shallow === 'true') {
          await gitClient.fetch(['--unshallow']).catch(async () => {
            await gitClient.fetch(['--depth', '2147483647']).catch(() => {})
          })
        }
      } catch {}

      logBuild('build.autoCloneRepoMatch', {
        dir: docsDirectory,
        repo: remote || repository,
        branch: currentBranch || branch || '-',
      })
      return { performed: true, blocked: false as const, message: '' }
    }
    const msg = tBuild(docsConfig.language, 'build.docsDirectoryNotFolder', { dir: docsDirectory })
    if (mode === 'serve') {
      console.log(msg)
      return { performed: true, blocked: false as const, message: '' }
    }
    return { performed: true, blocked: true as const, message: `\n${msg}` }
  }

  logBuild('build.cloningRepo', { dir: docsDirectory, repo: repository })
  await fs.mkdir(path.dirname(docsRoot), { recursive: true })
  const args = ['--branch', branch]
  const gitClient = simpleGit().env({ GIT_TERMINAL_PROMPT: '0' })
  const clonePromise = gitClient.clone(repository, docsRoot, args)
  const timeoutPromise = new Promise<void>((_resolve, reject) => {
    setTimeout(() => reject(new Error('clone timeout')), timeOut)
  })
  try {
    await Promise.race([clonePromise, timeoutPromise])
  } catch {
    logBuild('build.cloneFailedOrTimeout')
    return { performed: true, blocked: false as const, message: '' }
  }
  return { performed: true, blocked: false as const, message: '' }
}

