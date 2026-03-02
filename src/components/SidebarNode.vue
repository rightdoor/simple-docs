<script setup lang="ts">
import type { DocsTreeNode } from '@/docsIndex'
import { useSidebarNode } from '@/composables/useSidebarNode'

defineOptions({ name: 'SidebarNode' })

const props = defineProps<{
  node: DocsTreeNode
  prefix: string
  expanded: Record<string, boolean>
  activePath: string
  activeDirs: Set<string>
}>()

const emit = defineEmits<{
  (e: 'open-file', path: string): void
}>()

const { dirPath, fileDisplayTitle, dirDisplayTitle, dirNames, files, hasChildren, toggleDir, openReadme, isDirActive } =
  useSidebarNode(props, emit)
</script>

<template>
  <template v-for="dirName in dirNames" :key="`${prefix}/${dirName}`">
    <li
      v-if="node.dirs && node.dirs[dirName]"
      class="nav-dir"
      :class="{
        expanded: expanded[dirPath(prefix, dirName)] !== false,
        active: isDirActive(dirPath(prefix, dirName)),
      }"
    >
      <div class="nav-dir-header" @click="toggleDir(dirPath(prefix, dirName))">
        <span class="nav-dir-toggle">
          <Icon class="icon icon-16" icon="material-symbols:arrow-menu-open" />
        </span>
        <span
          class="nav-dir-name"
          :class="{ 'has-readme': !!node.dirs[dirName].readme }"
          @click.stop="
            expanded[dirPath(prefix, dirName)] === false
              ? toggleDir(dirPath(prefix, dirName))
              : node.dirs[dirName].readme
                ? openReadme(node.dirs[dirName].readme!.path)
                : toggleDir(dirPath(prefix, dirName))
          "
          >{{ dirDisplayTitle(dirName) }}</span
        >
      </div>

      <ul class="nav-dir-children" v-show="expanded[dirPath(prefix, dirName)] !== false">
        <template v-if="!hasChildren(node.dirs[dirName]) && node.dirs[dirName].readme">
          <li
            class="nav-item-file"
            :class="{ active: activePath === node.dirs[dirName].readme!.path }"
            @click="openReadme(node.dirs[dirName].readme!.path)"
          >
            <Icon class="nav-file-icon icon icon-16" icon="material-symbols:markdown" />
            <span class="nav-item-title">{{ node.dirs[dirName].readme!.title || dirName }}</span>
          </li>
        </template>

        <SidebarNode
          v-if="hasChildren(node.dirs[dirName])"
          :node="node.dirs[dirName]"
          :prefix="dirPath(prefix, dirName)"
          :expanded="expanded"
          :active-path="activePath"
          :active-dirs="activeDirs"
          @open-file="(p) => emit('open-file', p)"
        />
      </ul>
    </li>
  </template>

  <template v-for="file in files" :key="file.path">
    <li class="nav-item-file" :class="{ active: activePath === file.path }" @click="emit('open-file', file.path)">
      <Icon class="nav-file-icon icon icon-16" icon="material-symbols:markdown" />
      <span class="nav-item-title">{{ fileDisplayTitle(file) }}</span>
    </li>
  </template>
</template>
