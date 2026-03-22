/**
 * Markdown 编译器：基于 markdown-it 渲染 HTML 片段，增强代码高亮/目录/图表/数学公式，并重写内部链接与资源路径
 */
import path from 'node:path'
import { createRequire } from 'node:module'
import MarkdownIt from 'markdown-it'
import Prism from 'prismjs'
import { ensureFrontmatterId, parseFrontmatter } from './frontmatter'
import { tConfig } from './locale'
import { encodePathSegments, markdownPathToHtmlPath, normalizeAssetBase, resolvePath, splitPathSuffix } from './paths'

import 'prismjs/components/prism-markup'
import 'prismjs/components/prism-clike'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-css'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-yaml'
import 'prismjs/components/prism-markdown'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-java'
import 'prismjs/components/prism-c'
import 'prismjs/components/prism-cpp'
import 'prismjs/components/prism-go'
import 'prismjs/components/prism-rust'
import 'prismjs/components/prism-sql'
import 'prismjs/components/prism-diff'
import 'prismjs/components/prism-ini'
import 'prismjs/components/prism-toml'

type MarkdownItPlugin = (md: MarkdownIt, ...params: any[]) => void

const require = createRequire(import.meta.url)
const markdownItAbbrModule = require('markdown-it-abbr') as unknown
const markdownItContainerModule = require('markdown-it-container') as unknown
const markdownItDeflistModule = require('markdown-it-deflist') as unknown
const markdownItEmojiModule = require('markdown-it-emoji') as unknown
const markdownItFootnoteModule = require('markdown-it-footnote') as unknown
const markdownItAnchorModule = require('markdown-it-anchor') as unknown
const markdownItChartModule = require('markdown-it-chart') as unknown
const markdownItTableOfContentsModule = require('markdown-it-table-of-contents') as unknown
const markdownItTaskListsModule = require('markdown-it-task-lists') as unknown
const markdownItSubModule = require('markdown-it-sub') as unknown
const markdownItSupModule = require('markdown-it-sup') as unknown

function stripLeadingH1(markdownBody: string, title?: string) {
  if (!title) return markdownBody
  const lines = markdownBody.replace(/\r\n/g, '\n').split('\n')
  const firstIdx = lines.findIndex((l) => l.trim() !== '')
  if (firstIdx < 0) return markdownBody
  const m = lines[firstIdx]?.match(/^#\s+(.+)\s*$/)
  if (!m) return markdownBody
  const h1 = (m[1] ?? '').trim()
  if (!h1 || h1 !== title) return markdownBody
  lines.splice(firstIdx, 1)
  if ((lines[firstIdx] ?? '').trim() === '') lines.splice(firstIdx, 1)
  return lines.join('\n')
}

function resolveDocLinkHref(href: string, mdPath: string, idByPath: Map<string, string>) {
  function safeDecodeURIComponent(input: string) {
    try {
      return decodeURIComponent(input)
    } catch {
      return input
    }
  }

  const trimmed = href.trim()
  if (!trimmed) return href
  if (/^(https?:)?\/\//i.test(trimmed) || /^data:/i.test(trimmed)) return href
  if (/^(mailto|tel):/i.test(trimmed)) return href
  if (trimmed.startsWith('#')) return href

  const hashIndex = trimmed.indexOf('#')
  const queryIndex = trimmed.indexOf('?')
  let cut = -1
  if (hashIndex >= 0 && queryIndex >= 0) cut = Math.min(hashIndex, queryIndex)
  else if (hashIndex >= 0) cut = hashIndex
  else if (queryIndex >= 0) cut = queryIndex
  const base = cut >= 0 ? trimmed.slice(0, cut) : trimmed
  const suffix = cut >= 0 ? trimmed.slice(cut) : ''
  const decodedBase = safeDecodeURIComponent(base)
  if (!/\.(md|markdown|html)$/i.test(decodedBase)) return href

  const lastSlash = mdPath.lastIndexOf('/')
  const mdDir = lastSlash >= 0 ? mdPath.slice(0, lastSlash) : ''
  const resolved = resolvePath(mdDir, decodedBase)
  const htmlPath = /\.html$/i.test(resolved) ? resolved : markdownPathToHtmlPath(resolved)
  const id = idByPath.get(htmlPath)
  if (id) return `/docs/${id}${suffix}`
  return href
}

function resolveMarkdownItPlugin(moduleValue: unknown, preferredExport?: string): MarkdownItPlugin {
  if (typeof moduleValue === 'function') return moduleValue as MarkdownItPlugin
  if (moduleValue && typeof moduleValue === 'object') {
    if (preferredExport) {
      const preferred = (moduleValue as Record<string, unknown>)[preferredExport]
      if (typeof preferred === 'function') return preferred as MarkdownItPlugin
    }
    const defaultExport = (moduleValue as { default?: unknown }).default
    if (typeof defaultExport === 'function') return defaultExport as MarkdownItPlugin
    for (const value of Object.values(moduleValue)) {
      if (typeof value === 'function') return value as MarkdownItPlugin
    }
  }
  throw new Error('Invalid markdown-it plugin')
}

function createContainerRenderer(type: string) {
  return (tokens: Array<{ info: string; nesting: number }>, idx: number) => {
    const token = tokens[idx]
    if (!token) return ''
    if (token.nesting === 1) {
      const info = token.info.trim().slice(type.length).trim()
      return `<div class="md-container md-container-${type}"><p class="md-container-title">${info || type}</p>`
    }
    return '</div>'
  }
}

function escapeAttr(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function rewriteMarkdownLinksInHtmlBlocks(markdown: string, mdPath: string, idByPath: Map<string, string>) {
  const normalized = markdown.replace(/\r\n/g, '\n')
  const lines = normalized.split('\n')
  let divDepth = 0

  const openDivRe = /^\s*<div\b[^>]*>\s*$/i
  const closeDivRe = /^\s*<\/div>\s*$/i
  const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    const isOpen = openDivRe.test(line)
    const isClose = closeDivRe.test(line)

    if (divDepth > 0 && !isOpen && !isClose) {
      lines[i] = line.replace(linkRe, (_m, rawText, rawInner) => {
        const text = String(rawText ?? '')
        const inner = String(rawInner ?? '').trim()
        if (!inner) return _m
        const titleMatch = inner.match(/^(.*?)(\s+["'][^"']*["'])$/)
        const hrefPart = (titleMatch?.[1] ?? inner).trim()
        const titleRaw = (titleMatch?.[2] ?? '').trim()
        const titleValue =
          titleRaw.length >= 2 && (titleRaw.startsWith('"') || titleRaw.startsWith("'"))
            ? titleRaw.slice(1, -1)
            : ''

        const nextHref = resolveDocLinkHref(hrefPart, mdPath, idByPath)
        const titleAttr = titleValue ? ` title="${escapeAttr(titleValue)}"` : ''
        return `<a href="${escapeAttr(nextHref)}"${titleAttr}>${escapeHtml(text)}</a>`
      })
    }

    if (isOpen) divDepth++
    if (isClose) divDepth = Math.max(0, divDepth - 1)
  }

  return lines.join('\n')
}

function mathBlockPlugin(md: MarkdownIt) {
  md.block.ruler.before('fence', 'math_block', (state, startLine, endLine, silent) => {
    const start = state.bMarks[startLine] + state.tShift[startLine]
    const max = state.eMarks[startLine]
    const marker = state.src.slice(start, max).trim()
    if (marker !== '$$') return false

    let nextLine = startLine + 1
    let found = false
    const lines: string[] = []
    while (nextLine < endLine) {
      const lineStart = state.bMarks[nextLine] + state.tShift[nextLine]
      const lineMax = state.eMarks[nextLine]
      const line = state.src.slice(lineStart, lineMax)
      if (line.trim() === '$$') {
        found = true
        break
      }
      lines.push(line)
      nextLine++
    }
    if (!found) return false
    if (silent) return true

    state.line = nextLine + 1
    const token = state.push('math_block', 'div', 0)
    token.block = true
    token.map = [startLine, state.line]
    token.content = lines.join('\n')
    token.attrs = [['class', 'math-block']]
    return true
  })

  md.renderer.rules.math_block = (tokens, idx) => {
    const content = escapeHtml(tokens[idx]?.content ?? '')
    return `<div class="math-block">\\[\n${content}\n\\]</div>\n`
  }
}

function normalizeLanguage(raw?: string) {
  if (!raw) return ''
  const cleaned = raw.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '')
  if (!cleaned) return ''
  return Prism.languages[cleaned] ? cleaned : ''
}

function buildLineNumbers(code: string) {
  const trimmed = code.replace(/\n$/, '')
  const lines = trimmed.split('\n')
  return lines.map((_, i) => `<span>${i + 1}</span>`).join('')
}

function slugifyHeading(input: string) {
  const normalized = String(input).trim().toLowerCase()
  const withoutPunctuation = normalized
    .replace(/[!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~]/g, '')
    .replace(/[，。！？、；：【】（）《》“”‘’]/g, '')
  const dashed = withoutPunctuation.replace(/\s+/g, '-').replace(/-+/g, '-')
  const slug = dashed || 'section'
  return `section-${slug}`
}

function rewriteRelativeImageLinks(markdown: string, mdPath: string, assetBase: string, assetMap?: Map<string, string>) {
  const lastSlash = mdPath.lastIndexOf('/')
  const mdDir = lastSlash >= 0 ? mdPath.slice(0, lastSlash) : ''
  const base = normalizeAssetBase(assetBase)

  return markdown.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (m, alt, inner) => {
    const trimmed = String(inner).trim()
    const titleMatch = trimmed.match(/^(.*?)(\s+["'][^"']*["'])$/)
    const rawSrc = (titleMatch?.[1] ?? trimmed).trim()
    const title = titleMatch ? titleMatch[2] : ''
    if (!rawSrc) return m

    const { base: src, suffix } = splitPathSuffix(rawSrc)

    if (/^(https?:)?\/\//i.test(src) || /^data:/i.test(src)) return m
    if (src.startsWith('/')) {
      if (!assetMap) return m
      let normalized = src.replace(/^\/+/, '')
      if (normalized.startsWith('docs/')) normalized = normalized.slice(5)
      else return m
      const mapped = assetMap.get(normalized)
      if (mapped) return `![${alt}](${base}${encodePathSegments(mapped)}${suffix}${title})`
      return `![${alt}](${base}${encodePathSegments(normalized)}${suffix}${title})`
    }

    const resolved = resolvePath(mdDir, src)
    const mapped = assetMap?.get(resolved)
    if (mapped) return `![${alt}](${base}${encodePathSegments(mapped)}${suffix}${title})`
    return `![${alt}](${base}${encodePathSegments(resolved)}${suffix}${title})`
  })
}

export function collectLocalImagePaths(markdown: string, mdPath: string) {
  const lastSlash = mdPath.lastIndexOf('/')
  const mdDir = lastSlash >= 0 ? mdPath.slice(0, lastSlash) : ''
  const items: string[] = []
  markdown.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, _alt, inner) => {
    const trimmed = String(inner).trim()
    const titleMatch = trimmed.match(/^(.*?)(\s+["'][^"']*["'])$/)
    const rawSrc = (titleMatch?.[1] ?? trimmed).trim()
    const src = splitPathSuffix(rawSrc).base
    if (!src) return ''
    if (/^(https?:)?\/\//i.test(src) || /^data:/i.test(src)) return ''
    if (src.startsWith('/')) {
      let normalized = src.replace(/^\/+/, '')
      if (normalized.startsWith('docs/')) normalized = normalized.slice(5)
      else return ''
      items.push(normalized)
      return ''
    }
    const resolved = resolvePath(mdDir, src)
    if (resolved) items.push(resolved)
    return ''
  })
  return items
}

export function isImageFile(filePath: string) {
  const ext = path.extname(filePath).toLowerCase()
  return ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].includes(ext)
}

export async function compileMarkdownToHtmlFragment(
  markdown: string,
  mdPath: string,
  idByPath: Map<string, string>,
  assetBase: string,
  language: string,
  assetMap?: Map<string, string>
) {
  const md = new MarkdownIt({
    breaks: true,
    linkify: true,
    html: true,
    highlight(code: string, lang?: string) {
      const rawLang = typeof lang === 'string' ? lang.trim() : ''
      const normalized = normalizeLanguage(lang)
      const grammar =
        (normalized && Prism.languages[normalized]) ||
        Prism.languages.plain ||
        Prism.languages.text ||
        Prism.languages.markup ||
        undefined
      const highlighted = normalized && grammar ? Prism.highlight(code, grammar, normalized) : Prism.util.encode(code)
      const langLabel = rawLang || tConfig(language, 'code.noFormat')
      const langClass = normalized ? `language-${normalized}` : 'language-text'
      const lineNumbers = buildLineNumbers(code)
      const copyText = tConfig(language, 'code.copy')
      const copyAria = tConfig(language, 'code.copyAria')
      return `<div class="code-block" data-lang="${escapeAttr(langLabel)}"><button class="code-lang">${escapeAttr(langLabel)}</button><button class="code-copy" type="button" aria-label="${escapeAttr(copyAria)}">${escapeAttr(copyText)}</button><div class="code-body"><div class="code-gutter">${lineNumbers}</div><pre class="code-pre"><code class="${langClass}">${highlighted}</code></pre></div></div>`
    },
  })
    .use(mathBlockPlugin)
    .use(resolveMarkdownItPlugin(markdownItSubModule))
    .use(resolveMarkdownItPlugin(markdownItSupModule))
    .use(resolveMarkdownItPlugin(markdownItFootnoteModule))
    .use(resolveMarkdownItPlugin(markdownItDeflistModule))
    .use(resolveMarkdownItPlugin(markdownItAbbrModule))
    .use(resolveMarkdownItPlugin(markdownItEmojiModule, 'full'))
    .use(resolveMarkdownItPlugin(markdownItChartModule))
    .use(resolveMarkdownItPlugin(markdownItTaskListsModule))
    .use(resolveMarkdownItPlugin(markdownItAnchorModule), {
      permalink: false,
      level: [1, 2, 3, 4, 5, 6],
      slugify: slugifyHeading,
    })
    .use(resolveMarkdownItPlugin(markdownItTableOfContentsModule), {
      includeLevel: [1, 2, 3, 4, 5, 6],
      containerClass: 'md-toc',
      listType: 'ul',
      markerPattern: /^\[(?:toc|TOC)\]|\[\[toc\]\]/im,
      slugify: slugifyHeading,
    })

  const defaultFence =
    md.renderer.rules.fence ||
    ((tokens, idx, options, env, self) => {
      void env
      return self.renderToken(tokens, idx, options)
    })
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    void env
    const token = tokens[idx]
    const info = String(token?.info || '').trim().toLowerCase()
    if (info === 'mermaid') {
      const code = String(token?.content || '')
      return `<div class="mermaid">${escapeHtml(code)}</div>`
    }
    return defaultFence(tokens, idx, options, env, self)
  }

  const defaultLinkOpen =
    md.renderer.rules.link_open ||
    ((tokens, idx, options, env, self) => {
      void env
      return self.renderToken(tokens, idx, options)
    })
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    void env
    const token = tokens[idx]
    if (!token) return defaultLinkOpen(tokens, idx, options, env, self)
    const hrefIndex = token.attrIndex('href')
    if (hrefIndex >= 0 && token.attrs) {
      const entry = token.attrs[hrefIndex]
      const href = entry?.[1] ?? ''
      if (entry) entry[1] = resolveDocLinkHref(String(href), mdPath, idByPath)
    }
    return defaultLinkOpen(tokens, idx, options, env, self)
  }

  const containers = ['info', 'tip', 'warning', 'danger', 'details']
  containers.forEach((type) => {
    md.use(resolveMarkdownItPlugin(markdownItContainerModule), type, { render: createContainerRenderer(type) })
  })

  const parsed = parseFrontmatter(markdown)
  const title = parsed.data.title || undefined
  const body = stripLeadingH1(parsed.body, title)
  const withHtmlBlockLinks = rewriteMarkdownLinksInHtmlBlocks(body, mdPath, idByPath)
  const processed = rewriteRelativeImageLinks(withHtmlBlockLinks, mdPath, assetBase, assetMap)
  return md.render(processed)
}

export function ensureMarkdownId(markdown: string, relPath: string) {
  return ensureFrontmatterId(markdown, relPath)
}
