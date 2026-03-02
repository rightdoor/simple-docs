/**
 * 注入 Key 与类型集中声明：用于目录（TOC）上下文的跨组件共享与类型推断，避免散落定义
 */
import type { InjectionKey, Ref } from 'vue'

export type TocItem = {
  id: string
  text: string
  level: number
}

export type TocContext = {
  items: Ref<TocItem[]>
  activeId: Ref<string>
  setItems: (items: TocItem[]) => void
  setActiveId: (id: string) => void
  scrollToId: (id: string) => void
}

export const tocKey: InjectionKey<TocContext> = Symbol('toc')

export type I18nContext = {
  locale: Ref<string>
  t: (key: string, vars?: Record<string, string | number>) => string
  setLocale: (locale: string) => void
}

export const i18nKey: InjectionKey<I18nContext> = Symbol('i18n')
