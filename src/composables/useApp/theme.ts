/**
 * 主题管理器：主题切换、持久化与系统主题跟随
 */
import { computed, ref } from 'vue'
import type { DocsTheme } from '@/docsIndex'

export function createThemeManager() {
  function readStoredTheme(): DocsTheme {
    if (typeof window === 'undefined') return 'auto'
    const saved = localStorage.getItem('theme')
    if (saved === 'dark' || saved === 'light' || saved === 'auto') return saved
    return 'auto'
  }

  const theme = ref<DocsTheme>(readStoredTheme())
  const themeTouched = ref(false)
  let systemThemeQuery: MediaQueryList | null = null

  function resolveThemeValue(value: DocsTheme) {
    if (value !== 'auto') return value
    if (!systemThemeQuery) return 'light'
    return systemThemeQuery.matches ? 'dark' : 'light'
  }

  function applyTheme(value: DocsTheme) {
    const resolved = resolveThemeValue(value)
    document.documentElement.setAttribute('data-theme', resolved)
    window.dispatchEvent(new Event('theme-changed'))
  }

  function onSystemThemeChange() {
    if (theme.value !== 'auto') return
    applyTheme('auto')
  }

  function initTheme(defaultTheme: DocsTheme) {
    systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)')
    systemThemeQuery.addEventListener('change', onSystemThemeChange)

    const saved = localStorage.getItem('theme')
    const nextTheme = saved === 'dark' || saved === 'light' || saved === 'auto' ? saved : defaultTheme
    if (!themeTouched.value) {
      theme.value = nextTheme
      applyTheme(nextTheme)
    } else {
      applyTheme(theme.value)
    }
  }

  function cleanupTheme() {
    systemThemeQuery?.removeEventListener('change', onSystemThemeChange)
    systemThemeQuery = null
  }

  function toggleTheme() {
    const next = theme.value === 'light' ? 'dark' : theme.value === 'dark' ? 'auto' : 'light'
    themeTouched.value = true
    theme.value = next
    localStorage.setItem('theme', next)
    applyTheme(next)
  }

  const themeIcon = computed(() => {
    if (theme.value === 'dark') return 'material-symbols:moon-stars-outline'
    if (theme.value === 'light') return 'material-symbols:sunny-outline'
    return 'material-symbols:brightness-auto-outline'
  })

  return { theme, themeTouched, themeIcon, initTheme, cleanupTheme, toggleTheme }
}

