/**
 * 构建期 Docs Markdown 模块出口：统一导出索引类型、路径工具、Markdown 编译与 Vite 插件入口
 */
export type { DocsGitCommit, DocsGitContributor, DocsGitInfo, DocsGitStatus, DocsIndexFile, DocsIndexPayload } from './docsMarkdown/types'

export { parseFrontmatter, createShortHash, ensureFrontmatterId } from './docsMarkdown/frontmatter'
export { markdownPathToHtmlPath, encodeRoutePath, toPosix } from './docsMarkdown/paths'
export { buildIdMap, buildDocsIndex } from './docsMarkdown/indexBuild'
export { compileMarkdownToHtmlFragment } from './docsMarkdown/markdown'
export { docsFsPlugin } from './docsMarkdown/plugin'

