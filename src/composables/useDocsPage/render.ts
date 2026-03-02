/**
 * 渲染器：MathJax/Mermaid/Chart.js 在页面中的渲染触发
 */
import mermaid from 'mermaid'
import { Chart } from 'chart.js/auto'

export function createContentRenderers() {
  let mermaidReady = false
  const chartInstances = new WeakMap<HTMLCanvasElement, Chart<any, any, any>>()

  function typesetMath(container: HTMLElement) {
    const mathjax = (window as Window & {
      MathJax?: { typesetPromise?: (elements?: Element[]) => Promise<unknown>; typesetClear?: (elements?: Element[]) => void }
    }).MathJax
    if (!mathjax?.typesetPromise) return
    mathjax.typesetClear?.([container])
    void mathjax.typesetPromise([container])
  }

  function renderMermaid(container: HTMLElement) {
    const nodes = Array.from(container.querySelectorAll('.mermaid')) as HTMLElement[]
    if (!nodes.length) return
    nodes.forEach((node) => {
      const raw = (node.textContent ?? '').replace(/<br\s*\/?>/gi, '<br/>')
      if (raw !== (node.textContent ?? '')) node.textContent = raw
    })
    if (!mermaidReady) {
      mermaid.initialize({ startOnLoad: false })
      mermaidReady = true
    }
    const api = mermaid as unknown as {
      run?: (opts: { nodes: Element[] }) => Promise<void>
      init?: (config: unknown, nodes: Element[]) => Promise<void>
    }
    if (api.run) {
      void api.run({ nodes })
      return
    }
    if (api.init) {
      void api.init(undefined, nodes)
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

