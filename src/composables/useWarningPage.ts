/**
 * 告警页逻辑：当 docsDirectory 缺失/不存在时展示提示信息
 */
import { computed, onMounted, ref } from 'vue'
import { useI18n } from '@/locales'
import { getDocsConfig } from '@/docsIndex'

export function useWarningPage() {
  const { t } = useI18n()
  const docsDirectory = ref('')

  const hint = computed(() => {
    if (!docsDirectory.value) return t('warning.noDocsDirectory')
    return t('warning.missingDir', { dir: docsDirectory.value })
  })

  onMounted(async () => {
    const config = await getDocsConfig()
    docsDirectory.value = config.docsDirectory
  })

  return { hint }
}
