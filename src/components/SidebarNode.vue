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

const { dirPath, fileDisplayTitle, dirDisplayTitle, children, hasChildren, toggleDir, openReadme, isDirActive } = useSidebarNode(
  props,
  emit
)
</script>

<template>
  <template v-for="child in children" :key="child.type === 'dir' ? `${prefix}/${child.name}` : child.file.path">
    <li
      v-if="child.type === 'dir'"
      class="nav-dir"
      :class="{
        expanded: expanded[dirPath(prefix, child.name)] !== false,
        active: isDirActive(dirPath(prefix, child.name)),
      }"
    >
      <div class="nav-dir-header" @click="toggleDir(dirPath(prefix, child.name))">
        <span class="nav-dir-toggle">
          <Icon class="icon icon-16" icon="material-symbols:arrow-menu-open" />
        </span>
        <span
          class="nav-dir-name"
          :class="{ 'has-readme': !!child.node.readme }"
          @click.stop="
            expanded[dirPath(prefix, child.name)] === false
              ? toggleDir(dirPath(prefix, child.name))
              : child.node.readme
                ? openReadme(child.node.readme!.path)
                : toggleDir(dirPath(prefix, child.name))
          "
          >{{ dirDisplayTitle(child.name) }}</span
        >
      </div>

      <ul class="nav-dir-children" v-show="expanded[dirPath(prefix, child.name)] !== false">
        <template v-if="!hasChildren(child.node) && child.node.readme">
          <li
            class="nav-item-file"
            :class="{ active: activePath === child.node.readme!.path }"
            @click="openReadme(child.node.readme!.path)"
          >
            <Icon class="nav-file-icon icon icon-16" icon="material-symbols:markdown" />
            <span class="nav-item-title">{{ child.node.readme!.title || child.name }}</span>
          </li>
        </template>

        <SidebarNode
          v-if="hasChildren(child.node)"
          :node="child.node"
          :prefix="dirPath(prefix, child.name)"
          :expanded="expanded"
          :active-path="activePath"
          :active-dirs="activeDirs"
          @open-file="(p) => emit('open-file', p)"
        />
      </ul>
    </li>

    <li
      v-else-if="child.type === 'file'"
      class="nav-item-file"
      :class="{ active: activePath === child.file.path }"
      @click="emit('open-file', child.file.path)"
    >
      <Icon class="nav-file-icon icon icon-16" icon="material-symbols:markdown" />
      <span class="nav-item-title">{{ fileDisplayTitle(child.file) }}</span>
    </li>
  </template>
</template>
