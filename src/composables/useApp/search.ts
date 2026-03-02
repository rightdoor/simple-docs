/**
 * 搜索管理器：索引加载、查询状态与结果选择逻辑
 */
import { nextTick, ref, watch } from 'vue'
import type { Router } from 'vue-router'

type SearchResult = {
  id: string
  title: string
  path: string
  titleHtml: string
  snippetHtml: string
}

type RssPost = {
  id: string
  title: string
  text: string
}

export function createSearchManager(opts: {
  router: Router
  t: (key: string, vars?: Record<string, string | number>) => string
}) {
  const { router, t } = opts

  const searchOpen = ref(false)
  const searchQuery = ref('')
  const searchInputRef = ref<HTMLInputElement | null>(null)
  const isSearching = ref(false)
  const searchResults = ref<SearchResult[]>([])

  const rssPosts = ref<RssPost[]>([])
  let rssLoaded = false
  let searchSeq = 0
  let searchAbort: AbortController | null = null
  let rssPreloadAbort: AbortController | null = null
  let searchTimer: number | null = null

  function openSearch() {
    searchOpen.value = true
    searchQuery.value = ''
    searchResults.value = []
    isSearching.value = false
    nextTick(() => searchInputRef.value?.focus())
  }

  function closeSearch() {
    searchAbort?.abort()
    searchOpen.value = false
    isSearching.value = false
  }

  function selectSearchResult(result: SearchResult) {
    router.push(`/post/${result.id}`)
    closeSearch()
  }

  function openRss() {
    try {
      window.open('/rss.xml', '_blank')
    } catch {}
  }

  function htmlToText(fragment: string) {
    const withoutScripts = fragment.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    return withoutScripts
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim()
  }

  function escapeHtml(s: string) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  function highlightText(text: string, q: string) {
    const query = q.trim()
    if (!query) return escapeHtml(text)
    const lower = text.toLowerCase()
    const qLower = query.toLowerCase()
    let idx = 0
    let out = ''
    while (true) {
      const hit = lower.indexOf(qLower, idx)
      if (hit === -1) {
        out += escapeHtml(text.slice(idx))
        break
      }
      out += escapeHtml(text.slice(idx, hit))
      out += `<mark>${escapeHtml(text.slice(hit, hit + query.length))}</mark>`
      idx = hit + query.length
    }
    return out
  }

  function parseRssXml(xmlText: string) {
    const doc = new DOMParser().parseFromString(xmlText, 'application/xml')
    const parserError = doc.querySelector('parsererror')
    if (parserError) return [] as RssPost[]
    const items = Array.from(doc.getElementsByTagName('item'))
    const posts: RssPost[] = []
    for (const item of items) {
      const id = item.getElementsByTagName('guid')[0]?.textContent?.trim() || ''
      const title = item.getElementsByTagName('title')[0]?.textContent?.trim() || ''
      const content =
        item.getElementsByTagName('content:encoded')[0]?.textContent || item.getElementsByTagName('description')[0]?.textContent || ''
      if (!id) continue
      posts.push({ id, title: title || id, text: htmlToText(content) })
    }
    return posts
  }

  async function ensureRssLoaded(signal: AbortSignal) {
    if (rssLoaded) return
    const res = await fetch('/rss.xml', { cache: 'no-store', signal })
    if (!res.ok) throw new Error(t('error.loadRssFailed', { status: res.status }))
    const xml = await res.text()
    rssPosts.value = parseRssXml(xml)
    rssLoaded = true
  }

  async function preloadRss() {
    rssPreloadAbort?.abort()
    const aborter = new AbortController()
    rssPreloadAbort = aborter
    try {
      await ensureRssLoaded(aborter.signal)
    } catch {}
    if (rssPreloadAbort === aborter) rssPreloadAbort = null
  }

  async function runSearch(q: string) {
    const query = q.trim()
    const mySeq = ++searchSeq
    searchAbort?.abort()
    const aborter = new AbortController()
    searchAbort = aborter

    if (!query) {
      searchResults.value = []
      if (mySeq === searchSeq) isSearching.value = false
      return
    }

    isSearching.value = true
    try {
      await ensureRssLoaded(aborter.signal)
    } catch {}
    if (aborter.signal.aborted || mySeq !== searchSeq) return

    const results: SearchResult[] = []
    const qLower = query.toLowerCase()
    for (const p of rssPosts.value) {
      const title = p.title || p.id
      const text = p.text || ''
      const titleHit = title.toLowerCase().includes(qLower)
      const contentHitIndex = text.toLowerCase().indexOf(qLower)
      const contentHit = contentHitIndex >= 0
      if (!titleHit && !contentHit) continue

      let snippet = ''
      if (contentHit) snippet = text.slice(contentHitIndex, contentHitIndex + 220).trim()
      else snippet = text.slice(0, 220).trim()

      results.push({
        id: p.id,
        title,
        path: p.id,
        titleHtml: highlightText(title, query),
        snippetHtml: highlightText(snippet, query),
      })
    }

    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
    results.sort((a, b) => collator.compare(a.title, b.title))
    if (aborter.signal.aborted || mySeq !== searchSeq) return
    searchResults.value = results.slice(0, 50)
    isSearching.value = false
  }

  watch(
    () => searchQuery.value,
    (q) => {
      if (!searchOpen.value) return
      isSearching.value = !!q.trim()
      if (searchTimer != null) window.clearTimeout(searchTimer)
      searchTimer = window.setTimeout(() => runSearch(q), 120)
    }
  )

  function cleanupSearch() {
    if (searchTimer != null) window.clearTimeout(searchTimer)
    searchTimer = null
    searchAbort?.abort()
    rssPreloadAbort?.abort()
    rssPreloadAbort = null
  }

  return {
    searchOpen,
    searchQuery,
    searchInputRef,
    isSearching,
    searchResults,
    openSearch,
    closeSearch,
    selectSearchResult,
    openRss,
    preloadRss,
    cleanupSearch,
  }
}
