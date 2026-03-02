/**
 * i18n 入口：语言列表、默认语言与运行时翻译函数实现
 */
import { inject, ref } from 'vue'
import { i18nKey, type I18nContext } from '@/injectionKeys'

type MessageDict = Record<string, string>

import zhCN from './zh-CN.json'
import enUS from './en-US.json'
import jaJP from './ja-JP.json'

const localeEntries = [
  { locale: 'zh-CN', messages: zhCN as MessageDict },
  { locale: 'en-US', messages: enUS as MessageDict },
  { locale: 'ja-JP', messages: jaJP as MessageDict },
] as const

type LocaleKey = (typeof localeEntries)[number]['locale']

const defaultLocale: LocaleKey = 'zh-CN'

const messages = Object.fromEntries(localeEntries.map((e) => [e.locale, e.messages])) as Record<LocaleKey, MessageDict>
const supportedLocales = new Set<LocaleKey>(localeEntries.map((e) => e.locale))

export const DEFAULT_LOCALE: LocaleKey = defaultLocale

function defaultLocaleKey(): LocaleKey {
  return defaultLocale
}

function normalizeLocale(input: string | undefined | null): LocaleKey {
  const raw = String(input || '').trim()
  const fallback = defaultLocaleKey()
  if (!raw) return fallback
  if (supportedLocales.has(raw as LocaleKey)) return raw as LocaleKey
  return fallback
}

function format(template: string, vars?: Record<string, string | number>) {
  if (!vars) return template
  let out = template
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(String(v))
  }
  return out
}

export function tGlobal(key: string, vars?: Record<string, string | number>) {
  const fallbackKey: LocaleKey = defaultLocaleKey()
  const docLang = typeof document === 'undefined' ? fallbackKey : document.documentElement.lang
  const fallback = messages[fallbackKey] ?? {}
  const dict = messages[normalizeLocale(docLang)] ?? fallback
  const tpl = dict[key] ?? fallback[key] ?? key
  return format(tpl, vars)
}

export function createI18n(initialLocale: string | undefined | null): I18nContext {
  const locale = ref<string>(normalizeLocale(initialLocale))
  const ctx: I18nContext = {
    locale,
    setLocale(next) {
      locale.value = normalizeLocale(next)
      document.documentElement.lang = locale.value
    },
    t(key, vars) {
      const fallbackKey: LocaleKey = defaultLocaleKey()
      const fallback = messages[fallbackKey] ?? {}
      const dict = messages[normalizeLocale(locale.value)] ?? fallback
      const tpl = dict[key] ?? fallback[key] ?? key
      return format(tpl, vars)
    },
  }
  return ctx
}

export function useI18n(): I18nContext {
  const ctx = inject(i18nKey, null)
  if (!ctx) {
    const locale = ref(defaultLocaleKey())
    return {
      locale,
      setLocale(next) {
        locale.value = normalizeLocale(next)
        document.documentElement.lang = locale.value
      },
      t: (k, vars) => tGlobal(k, vars),
    }
  }
  return ctx
}
