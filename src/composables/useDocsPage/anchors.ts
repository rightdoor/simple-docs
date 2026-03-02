/**
 * 文内锚点：拦截 hash 跳转并按顶栏高度平滑滚动
 */
export function createAnchorBinder(opts: { scrollToTocId?: (id: string) => void }) {
  const { scrollToTocId } = opts
  let anchorContainer: HTMLElement | null = null
  let anchorHandler: ((ev: MouseEvent) => void) | null = null

  function safeDecodeURIComponent(input: string) {
    try {
      return decodeURIComponent(input)
    } catch {
      return input
    }
  }

  function getHeaderHeightPx() {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--header-height').trim()
    const n = Number.parseFloat(raw)
    if (Number.isFinite(n) && n > 0) return n
    return 52
  }

  function findAnchorTarget(id: string) {
    let el = document.getElementById(id)
    if (el) return el
    const decoded = safeDecodeURIComponent(id)
    if (decoded !== id) {
      el = document.getElementById(decoded)
      if (el) return el
    }
    if (!id.startsWith('section-')) {
      el = document.getElementById(`section-${id}`)
      if (el) return el
      if (decoded !== id) {
        el = document.getElementById(`section-${decoded}`)
        if (el) return el
      }
    }
    const encoded = encodeURIComponent(id)
    if (encoded !== id) {
      el = document.getElementById(encoded)
      if (el) return el
    }
    return null
  }

  function scrollToAnchor(el: HTMLElement) {
    if (scrollToTocId) {
      scrollToTocId(el.id)
      return
    }
    const top = el.getBoundingClientRect().top + window.pageYOffset - (getHeaderHeightPx() + 16)
    window.scrollTo({ top, behavior: 'smooth' })
  }

  function bind(container: HTMLElement) {
    if (anchorContainer === container && anchorHandler) return
    if (anchorContainer && anchorHandler) {
      anchorContainer.removeEventListener('click', anchorHandler)
    }
    anchorContainer = container
    anchorHandler = (ev) => {
      const target = ev.target as HTMLElement | null
      const link = target?.closest('a') as HTMLAnchorElement | null
      if (!link) return
      const href = link.getAttribute('href') || ''
      if (!href.startsWith('#')) return
      const raw = href.slice(1)
      if (!raw) return
      const el = findAnchorTarget(raw)
      if (!el) return
      ev.preventDefault()
      scrollToAnchor(el)
      history.replaceState(history.state, '', `#${el.id}`)
    }
    container.addEventListener('click', anchorHandler)
  }

  function cleanup() {
    if (anchorContainer && anchorHandler) {
      anchorContainer.removeEventListener('click', anchorHandler)
    }
    anchorContainer = null
    anchorHandler = null
  }

  return { bind, cleanup }
}

