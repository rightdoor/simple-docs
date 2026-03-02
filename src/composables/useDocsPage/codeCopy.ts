/**
 * 代码块复制：绑定复制按钮交互与状态反馈
 */
export function createCodeCopyBinder(t: (key: string) => string) {
  const copyTimers = new WeakMap<HTMLButtonElement, number>()
  let codeCopyContainer: HTMLElement | null = null
  let codeCopyHandler: ((ev: MouseEvent) => void) | null = null

  function fallbackCopy(text: string) {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    document.body.removeChild(textarea)
    return ok
  }

  function setCopyButtonState(button: HTMLButtonElement, text: string, state: 'success' | 'error' | 'idle') {
    button.textContent = text
    button.classList.toggle('is-success', state === 'success')
    button.classList.toggle('is-error', state === 'error')
  }

  async function copyCode(text: string, button: HTMLButtonElement) {
    const original = button.dataset.label || button.textContent || t('code.copy')
    button.dataset.label = original
    const existing = copyTimers.get(button)
    if (existing) window.clearTimeout(existing)
    let ok = false
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        ok = true
      } else {
        ok = fallbackCopy(text)
      }
    } catch {
      ok = fallbackCopy(text)
    }
    if (ok) {
      setCopyButtonState(button, t('code.copied'), 'success')
    } else {
      setCopyButtonState(button, t('code.copyFailed'), 'error')
    }
    const timer = window.setTimeout(() => {
      setCopyButtonState(button, original, 'idle')
    }, 1400)
    copyTimers.set(button, timer)
  }

  function bind(container: HTMLElement) {
    if (codeCopyContainer === container && codeCopyHandler) return
    if (codeCopyContainer && codeCopyHandler) {
      codeCopyContainer.removeEventListener('click', codeCopyHandler)
    }
    codeCopyContainer = container
    codeCopyHandler = (ev) => {
      const target = ev.target as HTMLElement | null
      const button = target?.closest('.code-copy') as HTMLButtonElement | null
      if (!button) return
      const block = button.closest('.code-block')
      const codeEl = block?.querySelector('code')
      const text = codeEl?.textContent ?? ''
      if (!text) return
      void copyCode(text, button)
    }
    container.addEventListener('click', codeCopyHandler)
  }

  function cleanup() {
    if (codeCopyContainer && codeCopyHandler) {
      codeCopyContainer.removeEventListener('click', codeCopyHandler)
    }
    codeCopyContainer = null
    codeCopyHandler = null
  }

  return { bind, cleanup }
}

