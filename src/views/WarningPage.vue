<script setup lang="ts">
import { useWarningPage } from '@/composables/useWarningPage'
import { useI18n } from '@/locales'

const { hint } = useWarningPage()
const { t } = useI18n()
</script>

<template>
  <section class="simple-page">
    <div class="simple-page-card">
      <h2 class="simple-page-title">{{ t('warning.title') }}</h2>
      <p class="simple-page-text">{{ hint }}</p>
      <p class="simple-page-text">{{ t('warning.checkConfig') }}</p>
    </div>
  </section>
</template>
<style scoped src="@styles/views/WarningPage.css"></style>
