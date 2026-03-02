/**
 * 文章页逻辑：加载渲染 HTML、元信息与目录/代码增强
 */
import { inject, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { tocKey } from '@/injectionKeys'
import { useI18n } from '@/locales'
import { getDocsConfig, getDocsIndex, loadDocsHtml, onDocsUpdate, resolveDocsPathFromRoute } from '@/docsIndex'
import { buildContributorLines, buildEditUrl, buildGitItems, parseRepoName, type GitMetaItem } from './useDocsPage/git'
import { createCodeCopyBinder } from './useDocsPage/codeCopy'
import { createAnchorBinder } from './useDocsPage/anchors'
import { createContentRenderers } from './useDocsPage/render'
import { createActiveTocTracker } from './useDocsPage/tocActive'
import {
  buildTocItems,
  countWordsFromHtmlFragment,
  decorateImages,
  extractFirstHeadingFromHtml,
  formatBytes,
  formatDateTime,
  stripExt,
} from './useDocsPage/dom'

export function useDocsPage() {
  const route = useRoute()
  const router = useRouter()
  const toc = inject(tocKey)
  const { t } = useI18n()

  const html = ref('')
  const title = ref('')
  const description = ref('')
  const fileName = ref('')
  const createdAt = ref('')
  const modifiedAt = ref('')
  const fileSize = ref('')
  const wordCount = ref('')
  const gitItems = ref<GitMetaItem[]>([])
  const gitContributors = ref<string[]>([])
  const remoteRepoName = ref('')
  const remoteRepoUrl = ref('')
  const remoteRepoBranch = ref('')
  const editUrl = ref('')
  const showGitInfo = ref(true)
  const showEdit = ref(true)
  const mdContainer = ref<HTMLElement | null>(null)
  const currentDocsPath = ref('')

  type RenderCacheEntry = {
    html: string
    title: string
    description: string
    fileName: string
    createdAt: string
    modifiedAt: string
    fileSize: string
    wordCount: string
    gitItems: GitMetaItem[]
    gitContributors: string[]
    remoteRepoName: string
    remoteRepoUrl: string
    remoteRepoBranch: string
    editUrl: string
    showGitInfo: boolean
    showEdit: boolean
  }

  const renderCache = new Map<string, RenderCacheEntry>()
  let loadSeq = 0
  let currentAbort: AbortController | null = null
  let stopDocsListener: (() => void) | null = null
  const codeCopyBinder = createCodeCopyBinder(t)
  const anchorBinder = createAnchorBinder({ scrollToTocId: toc?.scrollToId })
  const renderers = createContentRenderers()
  const tocTracker = createActiveTocTracker({ getContainer: () => mdContainer.value, setActiveId: toc?.setActiveId })

  function renderContent(container: HTMLElement, dispatchRendered: boolean) {
    decorateImages(container)
    toc?.setItems(buildTocItems(container))
    codeCopyBinder.bind(container)
    anchorBinder.bind(container)
    renderers.typesetMath(container)
    renderers.renderMermaid(container)
    renderers.renderCharts(container)
    tocTracker.updateActiveOnScroll()
    if (dispatchRendered) window.dispatchEvent(new Event('content-rendered'))
  }

  async function loadHtml() {
    const mySeq = ++loadSeq
    currentAbort?.abort()
    const aborter = new AbortController()
    currentAbort = aborter

    const pm = route.params.pathMatch
    const rawPath = Array.isArray(pm) ? pm.join('/') : (pm as string | undefined) || 'README.html'
    const resolvedPath = await resolveDocsPathFromRoute(rawPath)
    currentDocsPath.value = resolvedPath
    const cached = renderCache.get(resolvedPath)
    if (cached) {
      html.value = cached.html
      title.value = cached.title
      description.value = cached.description
      fileName.value = cached.fileName
      createdAt.value = cached.createdAt
      modifiedAt.value = cached.modifiedAt
      fileSize.value = cached.fileSize
      wordCount.value = cached.wordCount
      gitItems.value = cached.gitItems
      gitContributors.value = cached.gitContributors
      remoteRepoName.value = cached.remoteRepoName
      remoteRepoUrl.value = cached.remoteRepoUrl
      remoteRepoBranch.value = cached.remoteRepoBranch
      editUrl.value = cached.editUrl
      showGitInfo.value = cached.showGitInfo
      showEdit.value = cached.showEdit
      requestAnimationFrame(() => {
        if (mySeq !== loadSeq) return
        if (mdContainer.value) {
          renderContent(mdContainer.value, false)
        }
      })
      return
    }

    let index: Awaited<ReturnType<typeof getDocsIndex>> | null = null
    try {
      index = await getDocsIndex()
      if (index.missingRoot) {
        if (route.name !== 'warning') {
          router.replace('/warning')
        }
        return
      }

      const exists = index.files.some((f) => f.path === resolvedPath || f.id === resolvedPath)
      if (!exists) {
        if (route.name !== 'not-found') {
          router.replace('/404')
        }
        return
      }
    } catch {}

    let text = ''
    try {
      text = await loadDocsHtml(resolvedPath, { signal: aborter.signal })
    } catch {
      if (aborter.signal.aborted) return
      if (mySeq !== loadSeq) return
      if (route.name !== 'not-found') {
        router.replace('/404')
      }
      return
    }

    if (mySeq !== loadSeq) return

    try {
      const currentIndex = index ?? (await getDocsIndex())
      const meta = currentIndex.files.find((f) => f.path === resolvedPath)
      fileName.value = meta?.name ?? resolvedPath.split('/').pop() ?? resolvedPath
      const createdRaw = (meta?.frontmatterCreated || '').trim()
      const updatedRaw = (meta?.frontmatterUpdated || '').trim()
      const createdFormatted = createdRaw ? formatDateTime(createdRaw) : ''
      const updatedFormatted = updatedRaw ? formatDateTime(updatedRaw) : ''
      createdAt.value = createdRaw ? createdFormatted || createdRaw : ''
      modifiedAt.value = updatedRaw ? updatedFormatted || updatedRaw : ''
      fileSize.value = meta?.size != null ? formatBytes(meta.size) : ''
      title.value = meta?.title || stripExt(fileName.value) || resolvedPath
      description.value = meta?.description || ''
      gitContributors.value = buildContributorLines(meta?.git)
    } catch {
      fileName.value = resolvedPath.split('/').pop() ?? resolvedPath
      createdAt.value = ''
      modifiedAt.value = ''
      fileSize.value = ''
      gitItems.value = []
      gitContributors.value = []
      title.value = stripExt(fileName.value) || resolvedPath
      description.value = ''
    }

    try {
      const cfg = await getDocsConfig()
      const currentIndex = index ?? (await getDocsIndex())
      const isRepo = currentIndex.isGitRepo === true
      showGitInfo.value = cfg.git?.showInfo !== false && isRepo
      showEdit.value = cfg.git?.edit !== false && isRepo
      const repo = cfg.git?.repository?.trim() || ''
      const branch = cfg.git?.branch?.trim() || ''
      remoteRepoUrl.value = repo
      remoteRepoBranch.value = branch
      remoteRepoName.value = repo ? parseRepoName(repo) : ''
      const mdPath = resolvedPath.replace(/\.html$/i, '.md')
      editUrl.value = showEdit.value && repo && branch ? buildEditUrl(repo, branch, mdPath) : ''

      if (!showGitInfo.value) {
        gitItems.value = []
        gitContributors.value = []
      } else {
        const meta = index?.files.find((f) => f.path === resolvedPath)
        gitItems.value = buildGitItems({ git: meta?.git, repository: repo, branch, formatDateTime, t })
      }
    } catch {
      remoteRepoName.value = ''
      remoteRepoUrl.value = ''
      remoteRepoBranch.value = ''
      editUrl.value = ''
      showGitInfo.value = true
      showEdit.value = true
      gitItems.value = []
      gitContributors.value = []
    }

    if (mySeq !== loadSeq) return

    html.value = text
    const wc = countWordsFromHtmlFragment(text)
    wordCount.value = wc > 0 ? String(wc) : ''
    if (!title.value || title.value === resolvedPath) {
      const h1 = extractFirstHeadingFromHtml(text)
      if (h1) title.value = h1
    }
    requestAnimationFrame(() => {
      if (mySeq !== loadSeq) return
      if (mdContainer.value) {
        renderContent(mdContainer.value, true)
      }
    })

    renderCache.set(resolvedPath, {
      html: html.value,
      title: title.value,
      description: description.value,
      fileName: fileName.value,
      createdAt: createdAt.value,
      modifiedAt: modifiedAt.value,
      fileSize: fileSize.value,
      wordCount: wordCount.value,
      gitItems: gitItems.value,
      gitContributors: gitContributors.value,
      remoteRepoName: remoteRepoName.value,
      remoteRepoUrl: remoteRepoUrl.value,
      remoteRepoBranch: remoteRepoBranch.value,
      editUrl: editUrl.value,
      showGitInfo: showGitInfo.value,
      showEdit: showEdit.value,
    })
  }

  function onScroll() {
    tocTracker.updateActiveOnScroll()
  }

  onMounted(() => {
    loadHtml()
    window.addEventListener('scroll', onScroll, { passive: true })
    stopDocsListener = onDocsUpdate((ev) => {
      renderCache.delete(ev.path)
      if (ev.path === currentDocsPath.value) {
        loadHtml()
      }
    })
  })

  watch(
    () => route.fullPath,
    () => {
      loadHtml()
    }
  )

  onBeforeUnmount(() => {
    currentAbort?.abort()
    window.removeEventListener('scroll', onScroll)
    toc?.setItems([])
    stopDocsListener?.()
    stopDocsListener = null
    codeCopyBinder.cleanup()
    anchorBinder.cleanup()
  })

  return {
    html,
    title,
    description,
    fileName,
    createdAt,
    modifiedAt,
    fileSize,
    wordCount,
    gitItems,
    gitContributors,
    remoteRepoName,
    remoteRepoUrl,
    remoteRepoBranch,
    editUrl,
    showGitInfo,
    showEdit,
    mdContainer,
  }
}
