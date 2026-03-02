<script setup lang="ts">
import SidebarNode from './SidebarNode.vue'
import { useSidebarNav } from '@/composables/useSidebarNav'

const { tree, expanded, activePath, activeDirSet, navigateTo } = useSidebarNav()
</script>

<template>
  <nav class="nav-menu">
    <ul class="nav-list">
      <SidebarNode
        v-if="tree"
        :node="tree"
        prefix=""
        :expanded="expanded"
        :active-path="activePath"
        :active-dirs="activeDirSet"
        @open-file="navigateTo"
      />
    </ul>
  </nav>
</template>
