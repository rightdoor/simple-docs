/**
 * 侧边栏节点逻辑：目录展开折叠、激活态与标题展示规则
 */
import { computed } from 'vue'
import type { DocsFile, DocsTreeChild, DocsTreeNode } from '@/docsIndex'

type SidebarNodeProps = {
  node: DocsTreeNode
  prefix: string
  expanded: Record<string, boolean>
  activePath: string
  activeDirs: Set<string>
}

type SidebarNodeEmit = (e: 'open-file', path: string) => void

type SidebarChild =
  | { type: 'dir'; name: string; node: DocsTreeNode }
  | { type: 'file'; file: DocsFile }

export function useSidebarNode(props: SidebarNodeProps, emit: SidebarNodeEmit) {
  function dirPath(prefix: string, dirName: string) {
    return prefix ? `${prefix}/${dirName}` : dirName
  }

  function fileDisplayTitle(file: DocsFile) {
    if (file.title) return file.title
    return file.name.replace(/\.(md|markdown|pdf)$/i, '')
  }

  function dirDisplayTitle(dirName: string) {
    const dirNode = props.node.dirs?.[dirName]
    const readme = dirNode?.readme
    if (dirNode?.title) return dirNode.title
    return readme?.title || dirName
  }

  const children = computed<SidebarChild[]>(() => {
    const rawChildren: DocsTreeChild[] = props.node.children?.length
      ? props.node.children
      : [
          ...Object.keys(props.node.dirs ?? {}).map((name) => ({ type: 'dir', name }) as const),
          ...(props.node.files ?? []).map((file) => ({ type: 'file', file }) as const),
        ]

    const out: SidebarChild[] = []
    for (const ch of rawChildren) {
      if (ch.type === 'dir') {
        const dirNode = props.node.dirs?.[ch.name]
        if (dirNode) out.push({ type: 'dir', name: ch.name, node: dirNode })
        continue
      }
      out.push({ type: 'file', file: ch.file })
    }
    return out
  })

  function hasChildren(dirNode: DocsTreeNode) {
    const hasDirs = !!dirNode.dirs && Object.keys(dirNode.dirs).length > 0
    const hasFiles = !!dirNode.files && dirNode.files.length > 0
    return hasDirs || hasFiles
  }

  function toggleDir(fullPath: string) {
    props.expanded[fullPath] = !(props.expanded[fullPath] !== false)
  }

  function openReadme(readmePath: string) {
    emit('open-file', readmePath)
  }

  function isDirCollapsed(fullPath: string) {
    return props.expanded[fullPath] === false
  }

  function isDirActive(fullPath: string) {
    return props.activeDirs.has(fullPath) && isDirCollapsed(fullPath)
  }

  return {
    dirPath,
    fileDisplayTitle,
    dirDisplayTitle,
    children,
    hasChildren,
    toggleDir,
    openReadme,
    isDirCollapsed,
    isDirActive,
  }
}
