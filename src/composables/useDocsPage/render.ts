/**
 * 渲染器：MathJax/Mermaid/Chart.js 在页面中的渲染触发
 */
import mermaid from 'mermaid'
import { Chart } from 'chart.js/auto'

export function createContentRenderers() {
  const chartInstances = new WeakMap<HTMLCanvasElement, Chart<any, any, any>>()
  let isMermaidRendering = false
  let pendingMermaidRender = false

  function typesetMath(container: HTMLElement) {
    const mathjax = (window as Window & {
      MathJax?: { typesetPromise?: (elements?: Element[]) => Promise<unknown>; typesetClear?: (elements?: Element[]) => void }
    }).MathJax
    if (!mathjax?.typesetPromise) return
    mathjax.typesetClear?.([container])
    void mathjax.typesetPromise([container])
  }

  async function renderMermaid(container: HTMLElement) {
    const nodes = Array.from(container.querySelectorAll('.mermaid')) as HTMLElement[]
    if (!nodes.length) return

    if (isMermaidRendering) {
      pendingMermaidRender = true
      return
    }
    isMermaidRendering = true
    pendingMermaidRender = false

    const theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'base'
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      theme,
    })

    const api = mermaid as unknown as {
      render?: (id: string, text: string, container?: Element) => Promise<{ svg: string }>
      run?: (opts: { nodes: Element[] }) => Promise<void>
    }

    const warn = console.warn
    console.warn = (...args: unknown[]) => {
      const first = args[0]
      if (
        typeof first === 'string' &&
        first.startsWith('Do not assign mappings to elements without corresponding data')
      ) {
        return
      }
      warn(...args)
    }

    try {
      if (api.render) {
        for (const node of nodes) {
          const code = node.getAttribute('data-code') || node.textContent || ''
          const raw = code.replace(/<br\s*\/?>/gi, '\n') // render expects normal line breaks
          const id = `mermaid-render-${Math.random().toString(36).substring(2, 9)}`

          // 保持容器高度，减少抖动
          const rect = node.getBoundingClientRect()
          if (rect.height > 0) {
            node.style.minHeight = `${rect.height}px`
          }
          node.classList.add('is-rendering')

          try {
            const { svg } = await api.render(id, raw, node)
            node.innerHTML = svg
          } catch (e) {
            console.error('Mermaid render error:', e)
          } finally {
            node.classList.remove('is-rendering')
            node.style.minHeight = ''
          }
        }
      } else if (api.run) {
        nodes.forEach((node) => {
          const code = node.getAttribute('data-code') || node.textContent || ''
          const raw = code.replace(/<br\s*\/?>/gi, '<br/>')
          if (node.textContent !== raw || node.querySelector('svg')) {
            node.innerHTML = raw
          }
        })
        await api.run({ nodes })
      }
    } catch (e) {
      console.error('Mermaid rendering failed:', e)
    } finally {
      console.warn = warn
      isMermaidRendering = false
      if (pendingMermaidRender) {
        void renderMermaid(container)
      }
    }
  }

  function renderCharts(container: HTMLElement) {
    const nodes = Array.from(container.querySelectorAll('canvas.chartjs')) as HTMLCanvasElement[]
    nodes.forEach((canvas) => {
      const raw = canvas.textContent?.trim()
      if (!raw) return
      let config: unknown
      try {
        config = JSON.parse(raw)
      } catch {
        return
      }
      const existing = chartInstances.get(canvas)
      if (existing) {
        existing.destroy()
        chartInstances.delete(canvas)
      }
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      canvas.textContent = ''
      try {
        const instance = new Chart(ctx, config as ConstructorParameters<typeof Chart>[1])
        chartInstances.set(canvas, instance as Chart<any, any, any>)
      } catch {
        return
      }
    })
  }

  return { typesetMath, renderMermaid, renderCharts }
}

