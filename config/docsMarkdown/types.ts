/**
 * Docs 索引与 Git 信息类型：定义构建期索引文件结构与 Git 元信息结构，供插件与客户端复用
 */
export type DocsIndexFile = {
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
}

export type DocsIndexPayload = {
  generatedAt: string
  files: DocsIndexFile[]
  isGitRepo?: boolean
  missingRoot?: boolean
  root?: string
  docsDirectory?: string
  orderSource?: 'index.json'
  dirTitles?: Record<string, string>
  sidebarTree?: DocsSidebarTreeNode
}

export type DocsSidebarTreeFile = {
  id: string
  name: string
  title?: string
  description?: string
  path: string
  type: 'html'
  created?: string
  modified?: string
  size?: number
}

export type DocsSidebarTreeChild =
  | { type: 'dir'; name: string }
  | { type: 'file'; file: DocsSidebarTreeFile }

export type DocsSidebarTreeNode = {
  title?: string
  dirs?: Record<string, DocsSidebarTreeNode>
  files?: DocsSidebarTreeFile[]
  readme?: DocsSidebarTreeFile
  children?: DocsSidebarTreeChild[]
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
