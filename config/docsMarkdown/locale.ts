/**
 * 构建期多语言读取：从 src/locales/*.json 加载构建日志与配置提示文案，并提供格式化插值
 */
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { getDefaultLocaleFromSrc, getSupportedLocalesFromSrc } from '../locale'

type MessageDict = Record<string, string>

const cache = new Map<string, MessageDict>()

function format(template: string, vars?: Record<string, string | number>) {
  if (!vars) return template
  let out = template
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(String(v))
  }
  return out
}

function readJson(filePath: string) {
  try {
    const text = readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(text) as unknown
    if (parsed && typeof parsed === 'object') return parsed as MessageDict
  } catch {}
  return null
}

function resolveLocale(locale: string) {
  const raw = String(locale || '').trim()
  const supported = getSupportedLocalesFromSrc()
  const fallback = getDefaultLocaleFromSrc()
  if (raw && supported.includes(raw)) return raw
  return fallback
}

function loadMessages(locale: string) {
  const resolved = resolveLocale(locale)
  const cached = cache.get(resolved)
  if (cached) return cached

  const root = process.cwd()
  const dir = path.resolve(root, 'src', 'locales')
  const filePath = path.join(dir, `${resolved}.json`)
  const data = readJson(filePath) ?? {}
  cache.set(resolved, data)
  return data
}

export function tBuild(locale: string, key: string, vars?: Record<string, string | number>) {
  const resolved = resolveLocale(locale)
  const dict = loadMessages(resolved)
  const fallback = resolved === getDefaultLocaleFromSrc() ? dict : loadMessages(getDefaultLocaleFromSrc())
  const tpl = dict[key] ?? fallback[key] ?? key
  return format(tpl, vars)
}

export function tConfig(locale: string, key: string, vars?: Record<string, string | number>) {
  return tBuild(locale, key, vars)
}
