/**
 * Git 信息处理：解析仓库信息、构建编辑链接与展示条目
 */
import type { DocsGitInfo } from '@/docsIndex'

export type GitMetaItem = {
  key:
    | 'commitHash'
    | 'branch'
    | 'message'
    | 'author'
    | 'date'
    | 'commitCount'
    | 'status'
    | 'repoName'
    | 'remoteName'
    | 'remoteUrl'
  label: string
  value: string
  icon: string
  href?: string
}

export function parseRepoName(url: string) {
  const trimmed = url.trim()
  if (!trimmed) return ''
  const withoutGit = trimmed.replace(/\.git$/i, '').replace(/\/+$/, '')
  const lastSeg = withoutGit.split('/').filter(Boolean).pop() || ''
  return lastSeg
}

export function encodePathForUrl(p: string) {
  return p
    .split('/')
    .filter((seg) => seg.length > 0)
    .map((seg) => encodeURIComponent(seg))
    .join('/')
}

export function buildEditUrl(repository: string, branch: string, mdPath: string) {
  const repo = repository.trim().replace(/\.git$/i, '').replace(/\/+$/, '')
  const b = branch.trim()
  if (!repo || !b || !mdPath) return ''
  const encodedPath = encodePathForUrl(mdPath)
  const lower = repo.toLowerCase()
  if (lower.includes('github.com')) return `${repo}/edit/${encodeURIComponent(b)}/${encodedPath}`
  if (lower.includes('gitlab')) return `${repo}/-/edit/${encodeURIComponent(b)}/${encodedPath}`
  return `${repo}/_edit/${encodeURIComponent(b)}/${encodedPath}`
}

export function buildCommitUrl(repository: string, commitHash: string) {
  const repo = repository.trim().replace(/\.git$/i, '').replace(/\/+$/, '')
  const hash = commitHash.trim()
  if (!repo || !hash) return ''
  return `${repo}/commit/${encodeURIComponent(hash)}`
}

export function buildContributorLines(git: DocsGitInfo | undefined) {
  if (!git?.contributors?.length) return []
  return git.contributors.map((c, i) => {
    const email = c.email ? ` <${c.email}>` : ''
    return `${i + 1}. ${c.name}${email}(${c.commits})`
  })
}

export function buildGitItems(opts: {
  git: DocsGitInfo | undefined
  repository: string
  branch: string
  formatDateTime: (iso: string) => string
  t: (key: string, vars?: Record<string, string | number>) => string
}) {
  const { git, repository, branch, formatDateTime, t } = opts
  if (!git && !repository && !branch) return []

  const items: GitMetaItem[] = []
  const commitHash = git?.lastCommit?.hash || ''
  const author = git?.lastCommit?.author || ''
  const rawDate = git?.lastCommit?.date || ''
  const dateText = rawDate ? formatDateTime(rawDate) : ''
  const message = git?.lastCommit?.message || ''
  const commitCount = String(git?.commitCount ?? 0)

  const statusLabels: string[] = []
  if (git?.status.modified) statusLabels.push(t('git.modified'))
  if (git?.status.staged) statusLabels.push(t('git.staged'))
  if (git?.status.untracked) statusLabels.push(t('git.untracked'))
  const statusText = statusLabels.length ? statusLabels.join(' / ') : t('git.synced')

  items.push({
    key: 'commitHash',
    label: t('git.commitHash'),
    value: commitHash || '-',
    icon: 'material-symbols:commit',
    href: commitHash && repository ? buildCommitUrl(repository, commitHash) : undefined,
  })

  items.push({
    key: 'branch',
    label: t('git.remoteBranch'),
    value: branch || '-',
    icon: 'material-symbols:account-tree-outline',
  })

  items.push({
    key: 'message',
    label: t('git.message'),
    value: message || '-',
    icon: 'material-symbols:chat-outline',
  })

  items.push({
    key: 'author',
    label: t('git.author'),
    value: author || '-',
    icon: 'material-symbols:person-outline',
  })

  items.push({
    key: 'date',
    label: t('git.date'),
    value: dateText || rawDate || '-',
    icon: 'material-symbols:calendar-month-outline',
  })

  items.push({
    key: 'commitCount',
    label: t('git.commitCount'),
    value: commitCount,
    icon: 'material-symbols:format-list-numbered',
  })

  items.push({
    key: 'status',
    label: t('git.status'),
    value: statusText,
    icon: 'material-symbols:sync',
  })

  const repoName = repository ? parseRepoName(repository) : ''
  items.push({
    key: 'repoName',
    label: t('git.remoteName'),
    value: repoName || '-',
    icon: 'material-symbols:folder-managed-outline',
  })

  items.push({
    key: 'remoteName',
    label: t('git.remoteRepo'),
    value: 'origin',
    icon: 'material-symbols:cloud-outline',
  })

  items.push({
    key: 'remoteUrl',
    label: t('git.remoteUrl'),
    value: repository || '-',
    icon: 'material-symbols:link',
    href: repository || undefined,
  })

  return items
}

