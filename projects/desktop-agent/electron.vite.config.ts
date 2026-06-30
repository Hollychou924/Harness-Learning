import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: { input: { index: resolve('src/main/index.ts') } }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: { entry: resolve('src/preload/index.ts'), formats: ['cjs'] },
      rollupOptions: { external: ['electron'], output: { entryFileNames: 'index.cjs' } }
    }
  },
  renderer: {
    root: 'src/renderer',
    resolve: { alias: { '@': resolve('src/renderer/src') } },
    plugins: [react()],
    build: {
      rollupOptions: { input: resolve('src/renderer/index.html') }
    }
  }
})
