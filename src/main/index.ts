/**
 * 应用入口：初始化 MathJax/Viewer 行为并挂载 Vue 应用
 */
import { createApp } from 'vue'
import { Icon } from '@iconify/vue'
import 'viewerjs/dist/viewer.css'
import VueViewer from 'v-viewer'
import '@styles/base/index.css'
import App from '@/App.vue'
import { i18nKey } from '@/injectionKeys'
import { createI18n, DEFAULT_LOCALE } from '@/locales'
import { getDocsConfig } from '@/docsIndex'

const w = window as Window & { MathJax?: Record<string, unknown> }
w.MathJax = {
  loader: {
    paths: {
      mathjax: '/mathjax',
      // 字体文件路径
      fonts: '/mathjax-fonts',
    },
    load: ['input/tex', 'output/svg', '[tex]/noerrors'],
    require: (src: string) => import(/* @vite-ignore */ src),
  },
  startup: {
    typeset: false,
  },
  tex: {
    inlineMath: [
      ['$', '$'],
      ['\\(', '\\)'],
    ],
    displayMath: [
      ['$$', '$$'],
      ['\\[', '\\]'],
    ],
    processEscapes: true,
    packages: { '[+]': ['ams', 'noerrors', 'noundefined'] },
  },
  svg: {
    scale: 1.2,
    fontCache: 'global',
    displayAlign: 'center',
    displayIndent: '0',
  },
  options: {
    renderActions: {},
  },
  // 设置输出字体
  output: {
    font: 'mathjax-tex',
  },
}
const mathjaxReady = (async () => {
  const startupUrl = '/mathjax/startup.js'
  await import(/* @vite-ignore */ startupUrl)
  const mj = (window as Window & { MathJax?: { startup?: { promise?: Promise<unknown> } } }).MathJax
  await mj?.startup?.promise
})()

function stripPostHashOnBoot() {
  if (!location.hash) return
  if (!location.pathname.startsWith('/docs/')) return
  history.replaceState(history.state, '', location.pathname + location.search)
}

stripPostHashOnBoot()
window.addEventListener('pageshow', (ev) => {
  if ((ev as PageTransitionEvent).persisted) stripPostHashOnBoot()
})

function blurActiveElementIfViewerFocused() {
  const active = document.activeElement as HTMLElement | null
  if (!active) return
  if (active.closest('.viewer-container')) active.blur()
}

function resetBodyPaddingRightIfViewerOpen() {
  const openViewer = document.querySelector('.viewer-container:not(.viewer-hide)') as HTMLElement | null
  if (!openViewer) return
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
  if (scrollbarWidth <= 0) {
    if (document.body.style.paddingRight) document.body.style.paddingRight = ''
    if (document.documentElement.style.paddingRight) document.documentElement.style.paddingRight = ''
  }
}

const viewerAriaObserver = new MutationObserver((mutations) => {
  for (const m of mutations) {
    if (m.type !== 'attributes') continue
    const el = m.target as HTMLElement
    if (!el.classList.contains('viewer-container')) continue
    if (el.getAttribute('aria-hidden') !== 'true') continue
    blurActiveElementIfViewerFocused()
  }
})

if (document.body) {
  viewerAriaObserver.observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-hidden'],
  })
}

document.addEventListener(
  'click',
  (ev) => {
    const target = ev.target as HTMLElement | null
    if (!target) return
    if (target.closest('.viewer-close') || target.closest('.viewer-button.viewer-close')) {
      blurActiveElementIfViewerFocused()
    }
  },
  true
)

document.addEventListener(
  'keydown',
  (ev) => {
    if (ev.key !== 'Escape') return
    blurActiveElementIfViewerFocused()
  },
  true
)

const viewerBodyStyleObserver = new MutationObserver(() => {
  resetBodyPaddingRightIfViewerOpen()
})

if (document.body) {
  viewerBodyStyleObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ['style'],
  })
}

const app = createApp(App).component('Icon', Icon).use(VueViewer)

void (async () => {
  await mathjaxReady
  const { default: router } = await import('@/router')
  app.use(router)

  let language: string = DEFAULT_LOCALE
  try {
    const cfg = await getDocsConfig()
    language = cfg.language
  } catch {
    language = DEFAULT_LOCALE
  }
  const i18n = createI18n(language)
  document.documentElement.lang = i18n.locale.value
  app.provide(i18nKey, i18n)
  app.mount('#app')
})()
