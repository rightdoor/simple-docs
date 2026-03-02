/**
 * RSS 生成工具：从 Markdown 内容提取纯文本与元信息，生成 rss.xml 订阅源
 */
import { parseFrontmatter } from './frontmatter'

function escapeXmlText(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function wrapCdata(text: string) {
  const safe = text.replace(/]]>/g, ']]]]><![CDATA[>')
  return `<![CDATA[${safe}]]>`
}

export function stripMarkdownToText(markdown: string) {
  const body = parseFrontmatter(markdown).body
  let s = body
  s = s.replace(/```[\s\S]*?```/g, ' ')
  s = s.replace(/~~~[\s\S]*?~~~/g, ' ')
  s = s.replace(/`[^`]*`/g, ' ')
  s = s.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  s = s.replace(/<[^>]+>/g, ' ')
  s = s.replace(/^[ \t]*#{1,6}[ \t]+/gm, '')
  s = s.replace(/^[ \t]*>[ \t]?/gm, '')
  s = s.replace(/^[ \t]*[-*+][ \t]+/gm, '')
  s = s.replace(/^[ \t]*\d+\.[ \t]+/gm, '')
  s = s.replace(/[*_~]/g, ' ')
  s = s.replace(/\r\n/g, '\n').replace(/\n+/g, '\n')
  s = s.replace(/\s+/g, ' ').trim()
  return s
}

export function buildRssXml(payload: {
  channelTitle: string
  channelDescription: string
  channelLink: string
  items: Array<{
    id: string
    title: string
    link: string
    description: string
    content: string
    pubDate: string
    updatedIso: string
  }>
}) {
  const items = payload.items
    .slice()
    .sort((a, b) => b.updatedIso.localeCompare(a.updatedIso))
    .map((it) => {
      const title = escapeXmlText(it.title)
      const link = escapeXmlText(it.link)
      const guid = escapeXmlText(it.id)
      const pubDate = escapeXmlText(it.pubDate)
      const desc = wrapCdata(it.description)
      const content = wrapCdata(it.content)
      return [
        '    <item>',
        `      <title>${title}</title>`,
        `      <link>${link}</link>`,
        `      <guid isPermaLink="false">${guid}</guid>`,
        `      <pubDate>${pubDate}</pubDate>`,
        `      <description>${desc}</description>`,
        `      <content:encoded>${content}</content:encoded>`,
        '    </item>',
      ].join('\n')
    })
    .join('\n')

  const channelTitle = escapeXmlText(payload.channelTitle)
  const channelDescription = escapeXmlText(payload.channelDescription)
  const rawChannelLink = String(payload.channelLink || '').trim()
  const channelLink = rawChannelLink ? escapeXmlText(rawChannelLink) : ''

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">',
    '  <channel>',
    `    <title>${channelTitle}</title>`,
    ...(channelLink ? [`    <link>${channelLink}</link>`] : []),
    `    <description>${channelDescription}</description>`,
    items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n')
}

