/**
 * 路由配置与导航守卫：处理首页重定向、缺失目录告警页面切换，并在切换文章时重置滚动位置
 */
import { createRouter, createWebHistory } from 'vue-router'
import DocsPage from '@views/DocsPage.vue'
import WarningPage from '@views/WarningPage.vue'
import NotFoundPage from '@views/NotFoundPage.vue'
import { getDocsConfig, getDocsIndex, resolveHomeRoute } from '@/docsIndex'

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior(to, _from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.hash) {
      const raw = to.hash.startsWith('#') ? to.hash.slice(1) : to.hash
      const escaped = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(raw) : raw
      const selector = `#${escaped}`
      const findEl = () => document.querySelector(selector)
      if (findEl()) return { el: selector }
      return new Promise((resolve) => {
        const tryResolve = () => {
          if (findEl()) return resolve({ el: selector })
          return false
        }
        if (tryResolve()) return

        const onRendered = () => {
          if (tryResolve()) cleanup()
        }
        const cleanup = () => {
          window.removeEventListener('content-rendered', onRendered as EventListener)
          window.clearInterval(timer)
        }
        window.addEventListener('content-rendered', onRendered as EventListener)
        const startedAt = Date.now()
        const timer = window.setInterval(() => {
          if (tryResolve()) {
            cleanup()
            return
          }
          if (Date.now() - startedAt > 2000) {
            cleanup()
            resolve({ top: 0 })
          }
        }, 50)
      })
    }
    return { top: 0 }
  },
  routes: [
    { path: '/warning', name: 'warning', component: WarningPage },
    { path: '/404', name: 'not-found', component: NotFoundPage },
    { path: '/', name: 'home', component: DocsPage },
    { path: '/post/:pathMatch(.*)*', name: 'post', component: DocsPage },
    { path: '/:pathMatch(.*)*', redirect: '/404' },
  ],
})

router.beforeEach(async (to) => {
  if (to.name === 'warning') {
    try {
      const index = await getDocsIndex()
      if (!index.missingRoot) return { path: '/', replace: true }
    } catch {}
    return true
  }
  if (to.path !== '/') return true
  const config = await getDocsConfig()
  const homePath = await resolveHomeRoute(config)
  return { path: homePath, replace: true }
})

export default router
