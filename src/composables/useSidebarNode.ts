/**
 * 侧边栏节点逻辑：目录展开折叠、激活态与标题展示规则
 */
import { computed } from 'vue'
import type { DocsFile, DocsTreeNode } from '@/docsIndex'

type SidebarNodeProps = {
  node: DocsTreeNode
  prefix: string
  expanded: Record<string, boolean>
  activePath: string
  activeDirs: Set<string>
}

type SidebarNodeEmit = (e: 'open-file', path: string) => void

export function useSidebarNode(props: SidebarNodeProps, emit: SidebarNodeEmit) {
  function dirPath(prefix: string, dirName: string) {
    return prefix ? `${prefix}/${dirName}` : dirName
  }

  function fileDisplayTitle(file: DocsFile) {
    if (file.title) return file.title
    return file.name.replace(/\.(md|markdown|pdf)$/i, '')
  }

  function dirDisplayTitle(dirName: string) {
    const readme = props.node.dirs?.[dirName]?.readme
    return readme?.title || dirName
  }

  const dirNames = computed(() => Object.keys(props.node.dirs ?? {}))
  const files = computed(() => props.node.files ?? [])

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
    dirNames,
    files,
    hasChildren,
    toggleDir,
    openReadme,
    isDirCollapsed,
    isDirActive,
  }
}
