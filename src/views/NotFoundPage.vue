<script setup lang="ts">
import { useNotFoundPage } from '@/composables/useNotFoundPage'
import { useI18n } from '@/locales'

const { goHome } = useNotFoundPage()
const { t } = useI18n()
</script>

<template>
  <section class="simple-page">
    <div class="simple-page-card">
      <h2 class="simple-page-title">{{ t('notFound.title') }}</h2>
      <p class="simple-page-text">{{ t('notFound.text') }}</p>
      <div class="simple-page-actions">
        <button class="simple-page-btn primary" @click="goHome">{{ t('notFound.goHome') }}</button>
      </div>
    </div>
  </section>
</template>
<style scoped src="@styles/views/NotFoundPage.css"></style>
