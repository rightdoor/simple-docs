/**
 * 404 页面逻辑：提供回首页等基础交互
 */
import { useRouter } from 'vue-router'

export function useNotFoundPage() {
  const router = useRouter()

  function goHome() {
    router.replace('/')
  }

  return { goHome }
}

