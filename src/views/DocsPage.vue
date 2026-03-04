<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useDocsPage } from '@/composables/useDocsPage'
import { useI18n } from '@/locales'

const {
  html,
  title,
  description,
  fileName,
  createdAt,
  modifiedAt,
  fileSize,
  wordCount,
  gitItems,
  gitContributors,
  editUrl,
  showGitInfo,
  showEdit,
  mdContainer,
  prevDoc,
  nextDoc,
  goPrevDoc,
  goNextDoc,
} = useDocsPage()

void mdContainer

const route = useRoute()
const baseInfoOpen = ref(false)
const { t } = useI18n()
const showEditLink = computed(() => showEdit.value && !!editUrl.value)
const showGitBlock = computed(() => showGitInfo.value && (gitItems.value.length > 0 || gitContributors.value.length > 0))

watch(
  () => route.fullPath,
  () => {
    baseInfoOpen.value = false
  }
)

function syncDetailsOpen(ev: Event) {
  const el = ev.currentTarget as HTMLDetailsElement | null
  if (!el) return
  baseInfoOpen.value = el.open
}
</script>

<template>
  <article>
    <header class="post-header post-header-compact">
      <details class="post-meta" :open="baseInfoOpen" @toggle="syncDetailsOpen">
        <summary class="post-meta-summary">
          <span class="post-meta-summary-inner">
            <Icon
              class="post-meta-toggle-icon"
              :class="{ open: baseInfoOpen }"
              icon="material-symbols:left-panel-close-outline-sharp"
              width="14"
              height="14"
            />
            <Icon class="icon icon-14" icon="material-symbols:info-outline" />
            {{ t('docs.baseInfo') }}
          </span>
        </summary>
        <div class="post-meta-body">
          <div class="post-meta-line post-meta-section">
            <span class="post-meta-line-inner">
              <Icon class="icon icon-14" icon="material-symbols:description-outline" />
              {{ t('docs.fileInfo') }}
            </span>
          </div>
          <div class="post-meta-line">
            <span class="post-meta-line-inner">
              <Icon class="icon icon-14" icon="material-symbols:description-outline" />
              {{ t('docs.fileName') }}{{ fileName || '-' }}
            </span>
          </div>
          <div class="post-meta-line">
            <span class="post-meta-line-inner">
              <Icon class="icon icon-14" icon="material-symbols:hard-drive-outline" />
              {{ t('docs.size') }}{{ fileSize || '-' }}
            </span>
          </div>
          <div class="post-meta-line">
            <span class="post-meta-line-inner">
              <Icon class="icon icon-14" icon="material-symbols:text-fields" />
              {{ t('docs.wordCount') }}{{ wordCount || '-' }}
            </span>
          </div>
          <template v-if="showGitBlock">
            <div class="post-meta-line post-meta-section">
              <span class="post-meta-line-inner">
                <Icon class="icon icon-14" icon="material-symbols:account-tree-outline" />
                {{ t('docs.gitInfo') }}
              </span>
            </div>
            <div class="post-meta-line" v-for="item in gitItems" :key="item.key">
              <span class="post-meta-line-inner wrap">
                <Icon class="icon icon-14" :icon="item.icon" />
                <span class="post-meta-line-text">
                  <template v-if="item.href">
                    {{ item.label
                    }}<a
                      :href="item.href"
                      :target="item.href.startsWith('http') ? '_blank' : undefined"
                      :rel="item.href.startsWith('http') ? 'noopener noreferrer' : undefined"
                      >{{ item.value }}</a
                    >
                  </template>
                  <template v-else> {{ item.label }}{{ item.value }} </template>
                </span>
              </span>
            </div>

            <div class="post-meta-line" v-if="gitContributors.length">
              <span class="post-meta-line-inner">
                <Icon class="icon icon-14" icon="material-symbols:leaderboard" />
                {{ t('git.contributorsRank') }}
              </span>
            </div>
            <div class="post-meta-line git-subline" v-for="(line, index) in gitContributors" :key="`c-${index}`">
              {{ line }}
            </div>
          </template>
        </div>
      </details>
      <div class="post-meta-divider"></div>
      <h1 class="post-title">{{ title }}</h1>
      <p class="post-description" v-if="description">{{ description }}</p>
      <div class="post-desc-meta" v-if="createdAt || wordCount">
        <span v-if="createdAt">
          <span class="post-desc-meta-item">
            <Icon class="icon icon-14" icon="material-symbols:calendar-month-outline" />
            {{ t('docs.createdAt') }}{{ createdAt }}
          </span>
        </span>
        <span v-if="wordCount">
          <span class="post-desc-meta-item">
            <Icon class="icon icon-14" icon="material-symbols:text-fields" />
            {{ t('docs.wordCount') }}{{ wordCount }}
          </span>
        </span>
      </div>
    </header>
    <div ref="mdContainer" class="markdown-body" v-viewer.rebuild v-html="html"></div>
    <div class="post-updated-time" :class="{ 'with-bottom': !showEditLink }" v-if="modifiedAt">
      <span class="post-desc-meta-item">
        <Icon class="icon icon-14" icon="material-symbols:update" />
        {{ t('docs.modifiedAt') }}{{ modifiedAt }}
      </span>
    </div>
    <div class="post-edit-link" v-if="showEditLink">
      <a :href="editUrl" target="_blank" rel="noopener noreferrer">
        <span class="post-desc-meta-item">
          <Icon class="icon icon-14" icon="material-symbols:edit-square-outline" />
          {{ t('docs.editThis') }}
        </span>
      </a>
    </div>
    <!-- 上/下一篇 -->
    <div class="post-pager" v-if="prevDoc || nextDoc">
      <button class="post-pager-btn prev" :disabled="!prevDoc" @click="goPrevDoc">
        <Icon class="icon icon-16" icon="material-symbols:chevron-left" />
        <span class="post-pager-text">{{ prevDoc?.title || '-' }}</span>
      </button>
      <button class="post-pager-btn next" :disabled="!nextDoc" @click="goNextDoc">
        <span class="post-pager-text">{{ nextDoc?.title || '-' }}</span>
        <Icon class="icon icon-16" icon="material-symbols:chevron-right" />
      </button>
    </div>
  </article>
</template>
<style scoped src="@styles/views/DocsPage.css"></style>
