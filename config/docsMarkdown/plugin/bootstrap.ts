/**
 * HTML 引导注入：向 index.html 注入 docs-bootstrap（配置+索引）并设置 html lang 属性
 */
import { getDefaultLocaleFromSrc } from '../../locale'
import type { DocsConfig } from '../../docsConfig'
import type { DocsIndexPayload } from '../types'

export type DocsBootstrapPayload = {
  config: DocsConfig
  index: DocsIndexPayload
}

export function injectDocsBootstrap(html: string, payload: DocsBootstrapPayload) {
  const content = JSON.stringify(payload)
  const script = `<script id="docs-bootstrap" type="application/json">${content}</script>`
  const existing = /<script[^>]*id=["']docs-bootstrap["'][^>]*>[\s\S]*?<\/script>/i
  if (existing.test(html)) {
    return html.replace(existing, script)
  }
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `  ${script}\n  </head>`)
  }
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `  ${script}\n  </body>`)
  }
  return `${html}\n${script}`
}

export function applyHtmlLang(html: string, lang: string) {
  const safe = String(lang || '').trim() || getDefaultLocaleFromSrc()
  if (/<html\b[^>]*\slang\s*=\s*["'][^"']*["']/i.test(html)) {
    return html.replace(/(<html\b[^>]*\slang\s*=\s*["'])[^"']*(["'][^>]*>)/i, `$1${safe}$2`)
  }
  if (/<html\b[^>]*>/i.test(html)) {
    return html.replace(/<html\b([^>]*)>/i, (m, attrs) => {
      if (/\slang\s*=/i.test(String(attrs))) return m
      return `<html lang="${safe}"${attrs}>`
    })
  }
  return html
}

