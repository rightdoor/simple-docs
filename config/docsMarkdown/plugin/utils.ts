/**
 * 插件工具函数：content-type 推断与并发限制执行器，供 dev/build 复用
 */
import path from 'node:path'

export function contentTypeByExt(filePath: string) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.md' || ext === '.markdown') return 'text/markdown; charset=utf-8'
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.gif') return 'image/gif'
  if (ext === '.svg') return 'image/svg+xml'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.txt') return 'text/plain; charset=utf-8'
  if (ext === '.json') return 'application/json; charset=utf-8'
  return 'application/octet-stream'
}

export async function runWithLimit(tasks: Array<() => Promise<void>>, limit: number) {
  let index = 0
  const running = new Set<Promise<void>>()
  const launch = () => {
    while (index < tasks.length && running.size < limit) {
      const task = tasks[index++]!
      const p = task().finally(() => running.delete(p))
      running.add(p)
    }
  }
  launch()
  while (running.size > 0) {
    await Promise.race(running)
    launch()
  }
}

