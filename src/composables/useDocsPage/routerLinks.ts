import type { Router } from 'vue-router'

export function createRouterLinkBinder(router: Router) {
  let containerEl: HTMLElement | null = null
  let handler: ((ev: MouseEvent) => void) | null = null

  function isPlainLeftClick(ev: MouseEvent) {
    if (ev.defaultPrevented) return false
    if (ev.button !== 0) return false
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return false
    return true
  }

  function bind(container: HTMLElement) {
    if (containerEl === container && handler) return
    if (containerEl && handler) containerEl.removeEventListener('click', handler)
    containerEl = container
    handler = (ev) => {
      if (!isPlainLeftClick(ev)) return
      const target = ev.target as HTMLElement | null
      const link = target?.closest('a') as HTMLAnchorElement | null
      if (!link) return

      const rawHref = link.getAttribute('href') || ''
      if (!rawHref) return
      if (rawHref.startsWith('#')) return

      const targetAttr = (link.getAttribute('target') || '').trim().toLowerCase()
      if (targetAttr && targetAttr !== '_self') return

      let url: URL
      try {
        url = new URL(rawHref, window.location.href)
      } catch {
        return
      }
      if (url.origin !== window.location.origin) return
      if (!url.pathname.startsWith('/docs')) return

      ev.preventDefault()
      void router.push(url.pathname + url.search + url.hash)
    }
    container.addEventListener('click', handler)
  }

  function cleanup() {
    if (containerEl && handler) containerEl.removeEventListener('click', handler)
    containerEl = null
    handler = null
  }

  return { bind, cleanup }
}
