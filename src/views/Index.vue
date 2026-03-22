<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { getDocsConfig, resolveHomeRoute } from '@/docsIndex'

const router = useRouter()
const loading = ref(false)

async function openDocs() {
  if (loading.value) return
  loading.value = true
  try {
    const config = await getDocsConfig()
    const homePath = await resolveHomeRoute(config)
    await router.push(homePath)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="index">
    <div class="index-card">
      <h2 class="index-title">SimpleDocs</h2>
      <p class="index-desc">简单的静态文档（Markdown -> HTML）网站生成器，基于 Vue 3 + Vite 构建。</p>
      <ul class="index-features">
        <li>侧边栏树导航、目录、搜索（基于 rss.xml）</li>
        <li>Mermaid / Chart.js / MathJax 支持</li>
        <li>自动获取 Git 仓库文档并渲染</li>
        <li>支持界面主要内容的国际化（i18n）切换</li>
      </ul>
      <div class="index-actions">
        <button class="index-btn" :disabled="loading" @click="openDocs">查看文档</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.index {
  min-height: calc(100vh - var(--header-height) - var(--footer-height));
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 0;
}

.index-card {
  width: 100%;
  max-width: 640px;
  display: flex;
  flex-direction: column;
  padding: 28px;
  background: var(--bg-container);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  box-shadow: var(--shadow-sm);
}

.index-title {
  margin: 0;
  font-size: 26px;
  color: var(--text-title);
}

.index-desc {
  margin: 12px 0 0;
  color: var(--text-body);
  line-height: 1.7;
}

.index-features {
  margin: 16px 0 0;
  padding-left: 18px;
  color: var(--text-body);
  line-height: 1.8;
}

.index-actions {
  margin-top: 18px;
  display: flex;
  justify-content: flex-start;
}

.index-btn {
  height: 40px;
  padding: 0 18px;
  border-radius: 10px;
  border: 1px solid var(--primary);
  background: var(--primary);
  color: #fff;
  cursor: pointer;
  transition: filter 0.2s ease;
}

.index-btn:disabled {
  cursor: not-allowed;
  filter: saturate(0.3) opacity(0.75);
}

.index-btn:not(:disabled):hover {
  filter: brightness(1.05);
}
</style>
