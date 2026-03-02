/**
 * Docs 配置读取与规范化：负责加载 docs.config.json、合并默认值并提供元信息注入所需结构
 */
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { getDefaultLocaleFromSrc } from './locale'

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

export const defaultDocsConfig: DocsConfig = {
  title: 'SimpleDocs',
  language: 'zh-CN',
  url: '',
  description: '简单文档',
  docsDirectory: 'docs',
  git: {
    autoClone: false,
    repository: '',
    branch: 'main',
    timeOut: 60000,
    showInfo: true,
    edit: true,
  },
  homepage: 'docs/README.md',
  favicon: 'public/favicon/logo.webp',
  defaultTheme: 'auto',
  meta: {},
}

export function normalizeDocsConfig(input: Partial<DocsConfig> | null | undefined): DocsConfig {
  const title = typeof input?.title === 'string' && input.title.trim() ? input.title.trim() : defaultDocsConfig.title
  const language =
    typeof input?.language === 'string' && input.language.trim()
      ? input.language.trim()
      : defaultDocsConfig.language || getDefaultLocaleFromSrc()
  const url = typeof input?.url === 'string' ? input.url.trim() : defaultDocsConfig.url
  const description =
    typeof input?.description === 'string' && input.description.trim()
      ? input.description.trim()
      : defaultDocsConfig.description
  const docsDirectory =
    typeof input?.docsDirectory === 'string' && input.docsDirectory.trim()
      ? input.docsDirectory.trim()
      : typeof (input as Partial<DocsConfig> & { docsDirectory?: unknown })?.docsDirectory === 'string' &&
          String((input as Partial<DocsConfig> & { docsDirectory?: unknown }).docsDirectory).trim()
        ? String((input as Partial<DocsConfig> & { docsDirectory?: unknown }).docsDirectory).trim()
        : defaultDocsConfig.docsDirectory
  const safeDocsDirectory = docsDirectory.replace(/\\/g, '/').replace(/^\/+/, '').replace(/^\.\//, '')
  const gitAutoClone =
    typeof input?.git?.autoClone === 'boolean'
      ? input.git.autoClone
      : typeof (input as Partial<DocsConfig> & { git?: { enabled?: boolean } })?.git?.enabled === 'boolean'
        ? Boolean((input as Partial<DocsConfig> & { git?: { enabled?: boolean } }).git?.enabled)
        : defaultDocsConfig.git.autoClone
  const gitRepository =
    typeof input?.git?.repository === 'string' && input.git.repository.trim()
      ? input.git.repository.trim()
      : defaultDocsConfig.git.repository
  const gitBranch =
    typeof input?.git?.branch === 'string' && input.git.branch.trim()
      ? input.git.branch.trim()
      : defaultDocsConfig.git.branch
  const gitTimeOut =
    typeof (input?.git as Partial<DocsGitConfig> | undefined)?.timeOut === 'number' &&
    Number.isFinite((input?.git as Partial<DocsGitConfig> | undefined)?.timeOut as number) &&
    ((input?.git as Partial<DocsGitConfig> | undefined)?.timeOut as number) > 0
      ? ((input?.git as Partial<DocsGitConfig> | undefined)?.timeOut as number)
      : defaultDocsConfig.git.timeOut
  const gitShowInfo = typeof input?.git?.showInfo === 'boolean' ? input.git.showInfo : defaultDocsConfig.git.showInfo
  const gitEdit = typeof input?.git?.edit === 'boolean' ? input.git.edit : defaultDocsConfig.git.edit
  const homepage =
    typeof input?.homepage === 'string' && input.homepage.trim() ? input.homepage.trim() : defaultDocsConfig.homepage
  const favicon =
    typeof input?.favicon === 'string' && input.favicon.trim() ? input.favicon.trim() : defaultDocsConfig.favicon
  const defaultTheme =
    input?.defaultTheme === 'light' || input?.defaultTheme === 'dark' || input?.defaultTheme === 'auto'
      ? input.defaultTheme
      : defaultDocsConfig.defaultTheme
  const metaTitle =
    typeof input?.meta?.title === 'string' && input.meta.title.trim()
      ? input.meta.title.trim()
      : title
  const metaDescription =
    typeof input?.meta?.description === 'string' && input.meta.description.trim()
      ? input.meta.description.trim()
      : description

  return {
    title,
    language,
    url,
    description,
    docsDirectory: safeDocsDirectory,
    git: {
      autoClone: gitAutoClone,
      repository: gitRepository,
      branch: gitBranch,
      timeOut: gitTimeOut,
      showInfo: gitShowInfo,
      edit: gitEdit,
    },
    homepage,
    favicon,
    defaultTheme,
    meta: {
      title: metaTitle,
      description: metaDescription,
    },
  }
}

export function loadDocsConfigSync(root: string) {
  const configPath = path.resolve(root, 'docs.config.json')
  try {
    const text = readFileSync(configPath, 'utf8')
    const parsed = JSON.parse(text) as Partial<DocsConfig>
    return normalizeDocsConfig(parsed)
  } catch {
    return defaultDocsConfig
  }
}

function escapeHtml(input: string) {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function applyHtmlMeta(html: string, config: DocsConfig) {
  const title = escapeHtml(config.meta.title || config.title)
  const description = escapeHtml(config.meta.description || config.description)
  let next = html
  if (/<title>.*<\/title>/i.test(next)) {
    next = next.replace(/<title>.*<\/title>/i, `<title>${title}</title>`)
  } else {
    next = next.replace(/<\/head>/i, `  <title>${title}</title>\n  </head>`)
  }
  if (/<meta\s+name=["']description["']\s+content=.*?>/i.test(next)) {
    next = next.replace(
      /<meta\s+name=["']description["']\s+content=.*?>/i,
      `<meta name="description" content="${description}" />`
    )
  } else {
    next = next.replace(/<\/head>/i, `  <meta name="description" content="${description}" />\n  </head>`)
  }
  return next
}
