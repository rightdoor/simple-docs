/**
 * 站点元信息：根据配置生成标题/描述/图标等展示数据
 */
import { ref } from 'vue'
import type { DocsConfig } from '@/docsIndex'

export function createSiteMeta() {
  const siteLogo = ref('')
  const siteTitle = ref('')
  const siteDescription = ref('')

  function normalizeFaviconPath(input: string) {
    const trimmed = input.trim()
    if (!trimmed) return ''
    let next = trimmed.replace(/\\/g, '/')
    if (next.startsWith('public/')) next = next.slice('public'.length)
    if (!next.startsWith('/')) next = `/${next}`
    return next
  }

  function applyFavicon(path: string) {
    const href = normalizeFaviconPath(path)
    siteLogo.value = href
    if (!href) return
    const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null
    if (link) {
      link.href = href
      return
    }
    const next = document.createElement('link')
    next.rel = 'icon'
    next.href = href
    document.head.appendChild(next)
  }

  function applyMeta(title: string, description: string) {
    document.title = title
    const existing = document.querySelector("meta[name='description']") as HTMLMetaElement | null
    if (existing) {
      existing.content = description
      return
    }
    const meta = document.createElement('meta')
    meta.name = 'description'
    meta.content = description
    document.head.appendChild(meta)
  }

  function applyDocsConfig(config: DocsConfig) {
    applyFavicon(config.favicon)
    siteTitle.value = config.title
    siteDescription.value = config.description
    applyMeta(config.meta.title || config.title, config.meta.description || config.description)
  }

  return {
    siteLogo,
    siteTitle,
    siteDescription,
    applyDocsConfig,
  }
}

