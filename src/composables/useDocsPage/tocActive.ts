/**
 * 目录高亮：根据滚动位置更新当前激活目录项
 */
export function createActiveTocTracker(opts: {
  getContainer: () => HTMLElement | null
  setActiveId?: (id: string) => void
}) {
  const { getContainer, setActiveId } = opts

  function updateActiveOnScroll() {
    const container = getContainer()
    if (!container) return
    const headings = container.querySelectorAll('h1,h2,h3,h4,h5,h6')
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--header-height').trim()
    const headerHeight = Number.isFinite(Number.parseFloat(raw)) ? Number.parseFloat(raw) : 52
    const threshold = headerHeight + 16
    let currentByPassed: string | null = null
    let snapId: string | null = null
    let snapDist = Number.POSITIVE_INFINITY
    const snapRange = 80

    headings.forEach((h: Element) => {
      const el = h as HTMLElement
      const rect = el.getBoundingClientRect()
      const top = rect.top

      if (top <= threshold) {
        currentByPassed = el.id
      }

      if (top >= threshold && top <= threshold + snapRange) {
        const dist = top - threshold
        if (dist < snapDist) {
          snapDist = dist
          snapId = el.id
        }
      }
    })

    const chosen = snapId || currentByPassed || ((headings[0] as HTMLElement | undefined)?.id ?? null)
    if (chosen && setActiveId) setActiveId(chosen)
  }

  return { updateActiveOnScroll }
}

