/**
 * Docs 路径工具：用于 Markdown/资源路径规范化、路由编码、后缀拆分与跨平台路径处理
 */
import path from 'node:path'

export function resolvePath(fromDir: string, rel: string) {
  const input = rel.replace(/\\/g, '/')
  if (input.startsWith('/')) return input.slice(1)

  const stack = fromDir ? fromDir.split('/').filter(Boolean) : []
  const parts = input.split('/').filter(Boolean)
  for (const p of parts) {
    if (p === '.') continue
    if (p === '..') stack.pop()
    else stack.push(p)
  }
  return stack.join('/')
}

export function markdownPathToHtmlPath(mdPath: string) {
  return mdPath.replace(/\.(md|markdown)$/i, '.html')
}

export function encodeRoutePath(raw: string) {
  return raw
    .split('/')
    .filter((p) => p.length > 0)
    .map((p) => encodeURIComponent(p))
    .join('/')
}

export function toPosix(p: string) {
  return p.split(path.sep).join('/')
}

export function normalizeAssetBase(input: string) {
  let base = input.trim()
  if (!base) return '/'
  if (!base.startsWith('/')) base = `/${base}`
  if (!base.endsWith('/')) base = `${base}/`
  return base
}

export function encodePathSegments(input: string) {
  return input
    .split('/')
    .filter((p) => p.length > 0)
    .map((p) => encodeURIComponent(p))
    .join('/')
}

export function splitPathSuffix(input: string) {
  const hashIndex = input.indexOf('#')
  const queryIndex = input.indexOf('?')
  let cut = -1
  if (hashIndex >= 0 && queryIndex >= 0) cut = Math.min(hashIndex, queryIndex)
  else if (hashIndex >= 0) cut = hashIndex
  else if (queryIndex >= 0) cut = queryIndex
  const base = cut >= 0 ? input.slice(0, cut) : input
  const suffix = cut >= 0 ? input.slice(cut) : ''
  return { base, suffix }
}

