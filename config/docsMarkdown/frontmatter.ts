/**
 * Frontmatter 解析与 ID 生成：解析 YAML 风格 frontmatter，并为文章生成稳定短 ID
 */
import { createHash } from 'node:crypto'

export function parseFrontmatter(markdown: string) {
  const normalized = markdown.replace(/\r\n/g, '\n')
  const match = normalized.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/)
  if (!match) return { data: {} as Record<string, string>, body: markdown }

  const frontmatterText = match[1] ?? ''
  const body = match[2] ?? ''
  const data: Record<string, string> = {}
  for (const line of frontmatterText.split('\n')) {
    const idx = line.indexOf(':')
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim()
    let value = line.slice(idx + 1).trim()
    value = value.replace(/^["'](.*)["']$/, '$1').trim()
    if (!key) continue
    data[key] = value
  }
  return { data, body }
}

function detectEol(text: string) {
  return text.includes('\r\n') ? '\r\n' : '\n'
}

export function createShortHash(input: string) {
  return createHash('md5').update(input).digest('hex').slice(0, 8)
}

export function ensureFrontmatterId(markdown: string, relPath: string) {
  const normalized = markdown.replace(/\r\n/g, '\n')
  const eol = detectEol(markdown)
  const match = normalized.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/)
  const parsed = parseFrontmatter(normalized)
  const existingId = typeof parsed.data.id === 'string' && parsed.data.id.trim() ? parsed.data.id.trim() : ''
  if (existingId) return { id: existingId, text: markdown, changed: false }

  const id = createShortHash(relPath)
  if (!match) {
    const next = `---${eol}id: ${id}${eol}---${eol}${eol}${markdown}`
    return { id, text: next, changed: true }
  }

  const front = match[1] ?? ''
  const body = match[2] ?? ''
  const lines = front ? front.split('\n') : []
  lines.push(`id: ${id}`)
  const next = `---${eol}${lines.join(eol)}${eol}---${eol}${body.replace(/\n/g, eol)}`
  return { id, text: next, changed: true }
}

