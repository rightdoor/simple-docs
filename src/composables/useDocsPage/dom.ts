/**
 * DOM 工具：图片包装、TOC 生成、字数统计与格式化
 */
import type { TocItem } from '@/injectionKeys'

export function decorateImages(container: HTMLElement) {
  const imgs = Array.from(container.querySelectorAll('img')) as HTMLImageElement[]
  imgs.forEach((img) => {
    img.classList.add('image')
    const parent = img.parentElement
    if (!parent) return
    if (parent.classList.contains('image-wrapper')) return

    if (parent.tagName === 'A' && parent.childElementCount === 1) {
      parent.classList.add('image-wrapper')
      return
    }

    const wrapper = document.createElement('span')
    wrapper.className = 'image-wrapper'
    parent.insertBefore(wrapper, img)
    wrapper.appendChild(img)
  })
}

export function stripExt(name: string) {
  return name.replace(/\.(md|markdown|html)$/i, '')
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return ''
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = bytes / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  const fixed = v >= 10 ? v.toFixed(0) : v.toFixed(1)
  return `${fixed} ${units[i]}`
}

export function formatDateTime(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function extractFirstHeadingFromHtml(html: string) {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  if (!m) return ''
  const text = (m[1] ?? '').replace(/<[^>]+>/g, '').trim()
  return text
}

export function countWordsFromHtmlFragment(fragment: string) {
  const withoutScripts = fragment.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
  const text = withoutScripts
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return 0

  const cjk = text.match(/[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/g)?.length ?? 0
  const latinWords = text.match(/[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*/g)?.length ?? 0
  return cjk + latinWords
}

export function buildTocItems(container: HTMLElement): TocItem[] {
  const headings = Array.from(container.querySelectorAll('h1,h2,h3,h4,h5,h6')) as HTMLHeadingElement[]
  const items: TocItem[] = []
  headings.forEach((h, i) => {
    const id = h.id || `heading-${i}`
    if (!h.id) h.id = id
    const level = Number(h.tagName.substring(1))
    items.push({ id, text: h.textContent?.trim() || '', level })
  })
  return items
}

