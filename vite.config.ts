import path from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { loadDocsConfigSync } from './config/docsConfig'
import { docsFsPlugin } from './config/docsMarkdown'

export default defineConfig(() => {
  const configPayload = loadDocsConfigSync(process.cwd())
  return {
    define: {
      __DOCS_CONFIG__: JSON.stringify(configPayload),
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return
            if (
              id.includes(`${path.sep}mathjax-full${path.sep}`) ||
              id.includes('/mathjax-full/') ||
              id.includes(`${path.sep}mathjax${path.sep}`) ||
              id.includes('/mathjax/')
            ) {
              return 'mathjax'
            }
            if (id.includes('mermaid')) return 'mermaid'
            if (id.includes('chart.js')) return 'chartjs'
            if (id.includes('prismjs')) return 'prismjs'
            return 'vendor'
          },
        },
      },
    },
    plugins: [docsFsPlugin(), vue()],
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), 'src'),
        '@styles': path.resolve(process.cwd(), 'src/styles'),
        '@components': path.resolve(process.cwd(), 'src/components'),
        '@views': path.resolve(process.cwd(), 'src/views'),
      },
    },
    server: {
      port: 8080,
    },
  }
})
