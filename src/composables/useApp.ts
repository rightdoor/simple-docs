/**
 * 应用全局状态：侧边栏/目录/搜索/沉浸模式等交互逻辑
 */
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { tocKey, type TocItem } from '@/injectionKeys'
import { useI18n } from '@/locales'
import { getDocsConfig, getDocsIndex, resolveDocsPathFromRoute, type DocsConfig } from '@/docsIndex'
import { createSearchManager } from './useApp/search'
import { createSiteMeta } from './useApp/site'
import { createThemeManager } from './useApp/theme'

export function useApp() {
  const router = useRouter()
  const route = useRoute()
  const { t } = useI18n()

  function readStoredBool(key: string, fallback: boolean) {
    if (typeof window === 'undefined') return fallback
    const saved = localStorage.getItem(key)
    if (saved === 'true') return true
    if (saved === 'false') return false
    return fallback
  }

  function getHeaderHeightPx() {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--header-height').trim()
    const n = Number.parseFloat(raw)
    if (Number.isFinite(n) && n > 0) return n
    return 52
  }

  function scrollToId(id: string) {
    const el = document.getElementById(id)
    if (!el) return
    const top = el.getBoundingClientRect().top + window.pageYOffset - (getHeaderHeightPx() + 16)
    window.scrollTo({ top, behavior: 'smooth' })
    activeTocId.value = id
    tocDrawerOpen.value = false
  }

  const tocItems = ref<TocItem[]>([])
  const activeTocId = ref('')
  const tocCollapsed = ref(readStoredBool('tocCollapsed', false))
  const sidebarCollapsed = ref(readStoredBool('sidebarCollapsed', false))
  const backToTopVisible = ref(false)
  const barsVisible = ref(true)
  const isWideLayout = ref(false)
  const tocNavRef = ref<HTMLElement | null>(null)
  const tocDrawerOpen = ref(false)
  let immersiveLastTapAt = 0
  const immersiveHintVisible = ref(false)
  const immersiveHintKey = ref(0)
  let immersiveHintTimer: number | null = null

  provide(tocKey, {
    items: tocItems,
    activeId: activeTocId,
    setItems: (items) => (tocItems.value = items),
    setActiveId: (id) => (activeTocId.value = id),
    scrollToId,
  })

  const themeManager = createThemeManager()
  const siteMeta = createSiteMeta()
  const searchManager = createSearchManager({ router, t })

  const themeIcon = themeManager.themeIcon
  const toggleTheme = themeManager.toggleTheme

  const siteLogo = siteMeta.siteLogo
  const siteTitle = siteMeta.siteTitle
  const siteDescription = siteMeta.siteDescription

  const searchOpen = searchManager.searchOpen
  const searchQuery = searchManager.searchQuery
  const searchInputRef = searchManager.searchInputRef
  const isSearching = searchManager.isSearching
  const searchResults = searchManager.searchResults
  const openSearch = searchManager.openSearch
  const openRss = searchManager.openRss
  const closeSearch = searchManager.closeSearch
  const selectSearchResult = searchManager.selectSearchResult
  const sidebarOpen = ref(false)
  const isSimplePage = computed(() => route.name === 'warning' || route.name === 'not-found')
  const immersiveMode = ref(false)
  const savedSidebarCollapsed = ref(false)
  const savedTocCollapsed = ref(false)
  const savedSidebarOpen = ref(false)
  const savedTocDrawerOpen = ref(false)
  const savedHasValue = ref(false)

  async function initDocsConfig() {
    const config: DocsConfig = await getDocsConfig()
    themeManager.initTheme(config.defaultTheme)
    siteMeta.applyDocsConfig(config)
  }

  async function checkDocsRoot() {
    try {
      const index = await getDocsIndex()
      if (index.missingRoot && route.name !== 'warning') {
        router.replace('/warning')
      }
    } catch {}
  }

  function refreshFromScroll() {
    const run = () => {
      if (immersiveMode.value) return
      onScrollPage()
    }
    requestAnimationFrame(run)
    window.setTimeout(run, 0)
    window.setTimeout(run, 50)
    window.setTimeout(run, 150)
    window.setTimeout(run, 400)
  }

  onMounted(() => {
    void initDocsConfig()
    void checkDocsRoot()
    void searchManager.preloadRss()

    isWideLayout.value = window.innerWidth > 1380
    window.addEventListener('resize', onResize, { passive: true })
    window.addEventListener('scroll', onScrollPage, { passive: true })
    window.addEventListener('pointerdown', onScreenTap)
    onScrollPage()
    window.addEventListener('pageshow', refreshFromScroll)
    window.addEventListener('content-rendered', refreshFromScroll as EventListener)
    refreshFromScroll()
  })

  const showToc = computed(() => tocItems.value.length > 0)
  const showBackToTop = computed(() => !immersiveMode.value && backToTopVisible.value)
  const backToTopWithToc = computed(() => showToc.value && isWideLayout.value && !tocCollapsed.value)

  type EdgeNavDoc = { id: string; title: string }
  const prevDoc = ref<EdgeNavDoc | null>(null)
  const nextDoc = ref<EdgeNavDoc | null>(null)

  function getRouteRawPathMatch() {
    const pm = route.params.pathMatch
    return (Array.isArray(pm) ? pm.join('/') : (pm as string | undefined)) || 'README.html'
  }

  async function updatePrevNextDocs() {
    if (isSimplePage.value) {
      prevDoc.value = null
      nextDoc.value = null
      return
    }
    let index: Awaited<ReturnType<typeof getDocsIndex>> | null = null
    try {
      index = await getDocsIndex()
    } catch {
      prevDoc.value = null
      nextDoc.value = null
      return
    }
    const raw = getRouteRawPathMatch()
    const resolvedPath = await resolveDocsPathFromRoute(raw)
    const files = index.files || []
    const currentIndex = files.findIndex((f) => f.path === resolvedPath || f.id === resolvedPath)
    if (currentIndex < 0) {
      prevDoc.value = null
      nextDoc.value = null
      return
    }
    const prev = currentIndex > 0 ? files[currentIndex - 1] : null
    const next = currentIndex >= 0 && currentIndex < files.length - 1 ? files[currentIndex + 1] : null
    prevDoc.value = prev ? { id: prev.id, title: (prev.title || prev.name || prev.path).trim() } : null
    nextDoc.value = next ? { id: next.id, title: (next.title || next.name || next.path).trim() } : null
  }

  function goPrevDoc() {
    const p = prevDoc.value
    if (!p) return
    router.push(`/post/${encodeURIComponent(p.id)}`)
  }

  function goNextDoc() {
    const n = nextDoc.value
    if (!n) return
    router.push(`/post/${encodeURIComponent(n.id)}`)
  }

  function scrollActiveTocIntoView() {
    const nav = tocNavRef.value
    if (!nav) return
    const active = nav.querySelector('a.active') as HTMLElement | null
    if (!active) return
    active.scrollIntoView({ block: 'nearest' })
  }

  watch(
    () => activeTocId.value,
    async () => {
      await nextTick()
      scrollActiveTocIntoView()
    }
  )

  watch(
    () => tocItems.value.length,
    async () => {
      await nextTick()
      scrollActiveTocIntoView()
    }
  )

  watch(
    () => route.fullPath,
    () => {
      sidebarOpen.value = false
      tocDrawerOpen.value = false
      searchOpen.value = false
      void updatePrevNextDocs()
    }
  )

  onMounted(() => {
    void updatePrevNextDocs()
  })

  watch(
    () => [sidebarOpen.value, tocDrawerOpen.value, searchOpen.value] as const,
    ([sidebarIsOpen, tocIsOpen, searchIsOpen]) => {
      document.body.style.overflow = sidebarIsOpen || tocIsOpen || searchIsOpen ? 'hidden' : ''
    }
  )

  watch(
    () => sidebarCollapsed.value,
    (v) => {
      localStorage.setItem('sidebarCollapsed', String(v))
    }
  )

  watch(
    () => tocCollapsed.value,
    (v) => {
      localStorage.setItem('tocCollapsed', String(v))
    }
  )

  function updateBackToTopVisible() {
    const y = window.scrollY || 0
    backToTopVisible.value = y >= 200
  }

  function revealBars() {
    if (immersiveMode.value) return
    barsVisible.value = true
  }

  function enterImmersiveMode() {
    if (immersiveMode.value) return
    immersiveLastTapAt = 0
    savedSidebarCollapsed.value = sidebarCollapsed.value
    savedTocCollapsed.value = tocCollapsed.value
    savedSidebarOpen.value = sidebarOpen.value
    savedTocDrawerOpen.value = tocDrawerOpen.value
    savedHasValue.value = true

    immersiveMode.value = true
    barsVisible.value = false
    backToTopVisible.value = false
    sidebarOpen.value = false
    tocDrawerOpen.value = false
    sidebarCollapsed.value = true
    tocCollapsed.value = true
    immersiveHintKey.value += 1
    immersiveHintVisible.value = true
    if (immersiveHintTimer != null) window.clearTimeout(immersiveHintTimer)
    immersiveHintTimer = window.setTimeout(() => {
      immersiveHintVisible.value = false
      immersiveHintTimer = null
    }, 3000)
  }

  function closeImmersiveHint() {
    immersiveHintVisible.value = false
    if (immersiveHintTimer != null) window.clearTimeout(immersiveHintTimer)
    immersiveHintTimer = null
  }

  function exitImmersiveMode() {
    if (!immersiveMode.value) return
    immersiveMode.value = false
    barsVisible.value = true
    if (savedHasValue.value) {
      sidebarCollapsed.value = savedSidebarCollapsed.value
      tocCollapsed.value = savedTocCollapsed.value
      sidebarOpen.value = savedSidebarOpen.value
      tocDrawerOpen.value = savedTocDrawerOpen.value
    }
    updateBackToTopVisible()
  }

  function toggleImmersiveMode() {
    enterImmersiveMode()
  }

  function onSidebarEnter() {
    revealBars()
  }

  function onSidebarLeave() {
    revealBars()
  }

  function onTocEnter() {
    revealBars()
  }

  function onTocLeave() {
    revealBars()
  }

  function onSidebarPointerUp(event: PointerEvent) {
    if (event.pointerType === 'mouse') return
    onSidebarLeave()
  }

  function onTocPointerUp(event: PointerEvent) {
    if (event.pointerType === 'mouse') return
    onTocLeave()
  }

  function openSidebarDrawer() {
    if (immersiveMode.value) {
      exitImmersiveMode()
      return
    }
    sidebarOpen.value = true
    revealBars()
  }

  function openTocDrawer() {
    if (immersiveMode.value) {
      exitImmersiveMode()
      return
    }
    tocDrawerOpen.value = true
    revealBars()
  }

  function expandSidebar() {
    if (immersiveMode.value) return
    sidebarCollapsed.value = false
    revealBars()
  }

  function expandToc() {
    if (immersiveMode.value) return
    tocCollapsed.value = false
    revealBars()
  }

  function onScrollPage() {
    if (immersiveMode.value) return
    barsVisible.value = true
    updateBackToTopVisible()
  }

  // 点击屏幕切换沉浸模式
  function onScreenTap() {
    if (isSimplePage.value) return
    if (immersiveMode.value) {
      const now = Date.now()
      if (now - immersiveLastTapAt <= 1000) {
        immersiveLastTapAt = 0
        exitImmersiveMode()
        return
      }
      immersiveLastTapAt = now
      return
    }
  }

  function onResize() {
    isWideLayout.value = window.innerWidth > 1380
  }

  function backToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const showTocButton = computed(() => showToc.value && !isWideLayout.value)

  onBeforeUnmount(() => {
    document.body.style.overflow = ''
    document.documentElement.style.overflow = ''
    window.removeEventListener('resize', onResize)
    window.removeEventListener('scroll', onScrollPage)
    window.removeEventListener('pointerdown', onScreenTap)
    window.removeEventListener('pageshow', refreshFromScroll)
    window.removeEventListener('content-rendered', refreshFromScroll as EventListener)
    themeManager.cleanupTheme()
    searchManager.cleanupSearch()
  })

  return {
    router,
    tocItems,
    activeTocId,
    tocCollapsed,
    sidebarCollapsed,
    isSimplePage,
    sidebarOpen,
    barsVisible,
    revealBars,
    siteLogo,
    siteTitle,
    siteDescription,
    openSearch,
    openRss,
    toggleTheme,
    toggleImmersiveMode,
    themeIcon,
    onSidebarEnter,
    onSidebarLeave,
    onSidebarPointerUp,
    isWideLayout,
    showToc,
    tocDrawerOpen,
    onTocEnter,
    onTocLeave,
    onTocPointerUp,
    tocNavRef,
    scrollToId,
    showBackToTop,
    backToTopWithToc,
    expandToc,
    expandSidebar,
    immersiveHintVisible,
    immersiveHintKey,
    closeImmersiveHint,
    showTocButton,
    openTocDrawer,
    openSidebarDrawer,
    backToTop,
    immersiveMode,
    prevDoc,
    nextDoc,
    goPrevDoc,
    goNextDoc,
    searchOpen,
    closeSearch,
    searchInputRef,
    searchQuery,
    isSearching,
    searchResults,
    selectSearchResult,
  }
}
