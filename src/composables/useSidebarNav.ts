/**
 * 侧边栏导航逻辑：由索引构建树、维护展开态并驱动路由跳转
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { buildDocsTreeFromIndex, getDocsIndex, onDocsUpdate, type DocsTreeNode } from '@/docsIndex'

export function useSidebarNav() {
  const router = useRouter()
  const route = useRoute()

  const tree = ref<DocsTreeNode | null>(null)
  const expanded = reactive<Record<string, boolean>>({})
  let stopDocsListener: (() => void) | null = null
  let refreshing = false
  let refreshQueued = false
  const expandedStorageKey = 'sidebarExpanded'
  const pathToId = new Map<string, string>()
  const idToPath = new Map<string, string>()

  function encodePath(p: string) {
    return p
      .split('/')
      .map((seg) => encodeURIComponent(seg))
      .join('/')
  }

  function navigateTo(path: string) {
    const id = pathToId.get(path)
    router.push(`/post/${id ?? encodePath(path)}`)
  }

  const activePath = ref('README.html')

  async function updateActivePath() {
    const pm = route.params.pathMatch
    const raw = (Array.isArray(pm) ? pm.join('/') : (pm as string | undefined)) || 'README.html'
    let decoded = raw
    try {
      decoded = decodeURIComponent(raw)
    } catch {
      decoded = raw
    }
    const mapped = idToPath.get(decoded)
    activePath.value = mapped || decoded || 'README.html'
  }

  const activeDirSet = computed(() => {
    const root = tree.value
    if (!root) return new Set<string>()

    const target = activePath.value
    const chain: string[] = []

    function contains(node: DocsTreeNode, prefix: string): boolean {
      if (node.readme?.path === target) return true
      if (node.files?.some((f) => f.path === target)) return true
      for (const [dirName, dirNode] of Object.entries(node.dirs ?? {})) {
        const full = prefix ? `${prefix}/${dirName}` : dirName
        if (contains(dirNode, full)) {
          chain.unshift(full)
          return true
        }
      }
      return false
    }

    contains(root, '')
    return new Set(chain)
  })

  function ensureExpandedToActive() {
    for (const full of activeDirSet.value) {
      if (expanded[full] === undefined) expanded[full] = true
    }
  }

  function loadExpandedState() {
    if (typeof window === 'undefined') return
    const raw = localStorage.getItem(expandedStorageKey)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as Record<string, boolean>
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'boolean') expanded[key] = value
      }
    } catch {
      localStorage.removeItem(expandedStorageKey)
    }
  }

  function saveExpandedState() {
    if (typeof window === 'undefined') return
    const snapshot: Record<string, boolean> = {}
    for (const [key, value] of Object.entries(expanded)) {
      if (typeof value === 'boolean') snapshot[key] = value
    }
    localStorage.setItem(expandedStorageKey, JSON.stringify(snapshot))
  }

  watch(
    () => activePath.value,
    () => ensureExpandedToActive(),
    { immediate: true }
  )

  watch(
    () => route.params.pathMatch,
    () => {
      updateActivePath()
    },
    { immediate: true }
  )

  watch(
    expanded,
    () => {
      saveExpandedState()
    },
    { deep: true }
  )

  async function refreshTree() {
    if (refreshing) {
      refreshQueued = true
      return
    }
    refreshing = true
    try {
      const index = await getDocsIndex()
      pathToId.clear()
      idToPath.clear()
      for (const f of index.files) {
        pathToId.set(f.path, f.id)
        idToPath.set(f.id, f.path)
      }
      tree.value = buildDocsTreeFromIndex(index)
      await updateActivePath()
      ensureExpandedToActive()
    } finally {
      refreshing = false
      if (refreshQueued) {
        refreshQueued = false
        refreshTree()
      }
    }
  }

  onMounted(async () => {
    loadExpandedState()
    await refreshTree()
    stopDocsListener = onDocsUpdate(() => refreshTree())
  })

  onBeforeUnmount(() => {
    stopDocsListener?.()
    stopDocsListener = null
  })

  return { tree, expanded, activePath, activeDirSet, navigateTo }
}
