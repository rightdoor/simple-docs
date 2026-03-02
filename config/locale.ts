/**
 * 构建期语言解析：从 src/locales/index.ts 提取默认语言与可用语言列表，供配置与构建日志使用
 */
import path from 'node:path'
import { readFileSync } from 'node:fs'

type LocaleConfig = {
  defaultLocale: string
  locales: string[]
}

let cached: LocaleConfig | null = null

function readSrcLocalesIndex() {
  const root = process.cwd()
  const filePath = path.resolve(root, 'src', 'locales', 'index.ts')
  return readFileSync(filePath, 'utf8')
}

function parseLocaleConfig(text: string): LocaleConfig {
  const locales = Array.from(text.matchAll(/locale:\s*['"]([^'"]+)['"]/g)).map((m) => String(m[1] || '').trim())
  const defaultMatch = text.match(/const\s+defaultLocale\s*:\s*LocaleKey\s*=\s*['"]([^'"]+)['"]/)
  const defaultLocale = String(defaultMatch?.[1] || '').trim() || (locales[0] || '')
  return { defaultLocale, locales: locales.filter(Boolean) }
}

function getLocaleConfig(): LocaleConfig {
  if (cached) return cached
  const text = readSrcLocalesIndex()
  cached = parseLocaleConfig(text)
  return cached
}

export function getDefaultLocaleFromSrc() {
  return getLocaleConfig().defaultLocale
}

export function getSupportedLocalesFromSrc() {
  return getLocaleConfig().locales.slice()
}

