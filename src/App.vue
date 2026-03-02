<script setup lang="ts">
import SidebarNav from '@components/SidebarNav.vue'
import { useApp } from '@/composables/useApp'
import { useI18n } from '@/locales'

const {
  router,
  sidebarCollapsed,
  isSimplePage,
  sidebarOpen,
  barsVisible,
  revealBars,
  siteLogo,
  siteTitle,
  siteDescription,
  openSearch,
  // openRss,
  toggleTheme,
  toggleImmersiveMode,
  themeIcon,
  onSidebarEnter,
  onSidebarLeave,
  onSidebarPointerUp,
  isWideLayout,
  showToc,
  tocCollapsed,
  tocDrawerOpen,
  onTocEnter,
  onTocLeave,
  onTocPointerUp,
  tocNavRef,
  tocItems,
  activeTocId,
  scrollToId,
  showBackToTop,
  expandToc,
  expandSidebar,
  showTocButton,
  openTocDrawer,
  openSidebarDrawer,
  backToTop,
  immersiveMode,
  immersiveHintVisible,
  immersiveHintKey,
  closeImmersiveHint,
  searchOpen,
  closeSearch,
  searchInputRef,
  searchQuery,
  isSearching,
  searchResults,
  selectSearchResult,
} = useApp()

void tocNavRef
void searchInputRef

const { t } = useI18n()
</script>

<template>
  <div class="app-container" :class="{ 'sidebar-collapsed': sidebarCollapsed, 'simple-page': isSimplePage }">
    <div v-if="!isSimplePage" class="sidebar-overlay" :class="{ active: sidebarOpen }" @click="sidebarOpen = false"></div>

    <header class="site-header" :class="{ 'is-hidden': !barsVisible }" @mouseenter="revealBars">
      <div class="header-content">
        <div class="header-left">
          <img class="site-logo" :src="siteLogo" alt="logo" />
          <h1 class="site-title" @click="router.push('/')">{{ siteTitle }}</h1>
          <span class="header-divider"></span>
          <p class="site-description">{{ siteDescription }}</p>
        </div>
        <nav class="header-nav">
          <button v-if="!isSimplePage" class="theme-toggle-btn" :title="t('app.search')" @click="openSearch">
            <Icon class="icon icon-14" icon="material-symbols:search" />
          </button>
          <button
            v-if="!isSimplePage"
            class="theme-toggle-btn"
            :title="t('app.immersive')"
            @click="toggleImmersiveMode"
          >
            <Icon class="icon icon-14" icon="material-symbols:fullscreen" />
          </button>
          <!-- <button class="theme-toggle-btn" :title="t('app.rss')" @click="openRss">
            <Icon class="icon icon-14" icon="material-symbols:rss-feed" />
          </button> -->
          <button class="theme-toggle-btn" :title="t('app.toggleTheme')" @click="toggleTheme">
            <Icon class="icon icon-14" :icon="themeIcon" />
          </button>
        </nav>
      </div>
    </header>

    <aside
      v-if="!isSimplePage"
      class="sidebar"
      :class="{ open: sidebarOpen, collapsed: sidebarCollapsed }"
      @mouseenter="onSidebarEnter"
      @mouseleave="onSidebarLeave"
      @pointerdown="onSidebarEnter"
      @pointerup="onSidebarPointerUp"
    >
      <div class="sidebar-header">
        <div class="file-header">
          <Icon class="icon icon-16" icon="material-symbols:folder-open-outline" />
          <span class="file-header-title">{{ t('app.folder') }}</span>
          <button class="sidebar-toggle-btn" :title="t('app.collapseSidebar')" @click="sidebarCollapsed = true">
            <Icon class="icon icon-16" icon="material-symbols:chevron-right" />
          </button>
        </div>
      </div>
      <SidebarNav />
    </aside>

    <main class="main-content">
      <div class="view">
        <RouterView />
      </div>
    </main>

    <aside
      v-if="!isSimplePage"
      class="toc-sidebar"
      v-show="showToc"
      :class="{ collapsed: tocCollapsed, 'mobile-open': tocDrawerOpen }"
      @mouseenter="onTocEnter"
      @mouseleave="onTocLeave"
      @pointerdown="onTocEnter"
      @pointerup="onTocPointerUp"
    >
      <div class="toc-header">
        <button class="toc-toggle-btn" :title="t('app.collapseToc')" @click="isWideLayout ? (tocCollapsed = true) : (tocDrawerOpen = false)">
          <Icon class="icon icon-16" icon="material-symbols:chevron-left" />
        </button>
        <span class="toc-title">{{ t('app.toc') }}</span>
        <Icon class="icon icon-16" icon="material-symbols:toc" />
      </div>
      <nav class="toc-nav" ref="tocNavRef">
        <ul>
          <li v-for="item in tocItems" :key="item.id" :class="`toc-h${item.level}`">
            <a href="#" :class="{ active: activeTocId === item.id }" @click.prevent="scrollToId(item.id)">{{
              item.text
            }}</a>
          </li>
        </ul>
      </nav>
    </aside>

    <div v-if="!isSimplePage" class="toc-overlay" :class="{ active: tocDrawerOpen }" @click="tocDrawerOpen = false"></div>

    <button
      v-if="!isSimplePage"
      class="toc-expand-btn"
      :class="{ show: tocCollapsed && showToc && !immersiveMode }"
      :title="t('app.toc')"
      @click="expandToc"
    >
      <Icon class="icon icon-16" icon="material-symbols:toc" />
    </button>

    <button
      v-if="!isSimplePage"
      class="sidebar-expand-btn"
      :class="{ show: sidebarCollapsed && !immersiveMode }"
      :title="t('app.folder')"
      @click="expandSidebar"
    >
      <Icon class="icon icon-16" icon="material-symbols:chevron-left" />
    </button>

    <button
      v-if="!isSimplePage"
      class="back-to-top-btn"
      :class="{ show: showBackToTop }"
      :title="t('app.backToTop')"
      @click="backToTop"
    >
      <Icon class="icon icon-16" icon="material-symbols:keyboard-arrow-up" />
    </button>

    <button
      v-if="!isSimplePage"
      class="toc-fab-btn"
      :class="{ show: showTocButton && !immersiveMode }"
      :title="t('app.toc')"
      @click="openTocDrawer"
    >
      <Icon class="icon icon-16" icon="material-symbols:toc" />
    </button>

    <button
      v-if="!isSimplePage"
      class="menu-fab-btn"
      :class="{ show: !isWideLayout && !immersiveMode }"
      :title="t('app.menu')"
      @click="openSidebarDrawer"
    >
      <Icon class="icon icon-16" icon="material-symbols:menu" />
    </button>

    <div v-if="immersiveHintVisible" :key="immersiveHintKey" class="immersive-hint">
      <div class="immersive-hint-card">
        <button class="immersive-hint-close" :title="t('app.close')" @click="closeImmersiveHint">
          <Icon class="icon icon-14" icon="material-symbols:close" />
        </button>
        <div class="immersive-hint-text">{{ t('app.immersiveHint') }}</div>
        <div class="immersive-hint-progress">
          <div class="immersive-hint-bar"></div>
        </div>
      </div>
    </div>

    <footer class="site-footer" :class="{ 'is-hidden': !barsVisible }" @mouseenter="revealBars">
      <div class="footer-content">
        <div class="footer-left">
          <span>Copyright © 2026 SimpleDocs</span>
        </div>
        <div class="footer-right">
          <span>Powered by <a href="https://github.com/rightdoor/simple-docs" target="_blank">SimpleDocs</a></span>
        </div>
      </div>
    </footer>

    <Teleport to="body">
      <div v-if="searchOpen" class="search-mask" @click.self="closeSearch">
        <div class="search-modal">
          <div class="search-header">
            <input
              ref="searchInputRef"
              id="search-input"
              class="search-input"
              v-model="searchQuery"
              :placeholder="t('app.searchPlaceholder')"
              autocomplete="off"
              name="search"
            />
            <button class="search-close-btn" :title="t('app.close')" @click="closeSearch">
              <Icon class="icon icon-16" icon="material-symbols:close" />
            </button>
          </div>

          <div v-if="searchQuery.trim()" class="search-results">
            <div v-if="!isSearching && searchResults.length === 0" class="search-item search-item-empty">
              <div class="search-empty">{{ t('app.noResults') }}</div>
            </div>
            <div
              v-for="r in searchResults"
              :key="r.path"
              class="search-item"
              @click="selectSearchResult(r)"
            >
              <div class="search-title" v-html="r.titleHtml"></div>
              <div class="search-snippet" v-html="r.snippetHtml"></div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
