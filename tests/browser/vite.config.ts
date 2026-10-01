import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../../', import.meta.url))
export default defineConfig({
  root: root + 'tests/browser',
  resolve: { alias: { '~': root } },
  plugins: [vue(), {
    name: 'store-test-globals',
    transform(code, id) {
      if (id === root + 'stores/useDataStore.ts') return `import {ref,computed} from 'vue';\nimport {useAuth,$fetch} from '${root}tests/browser/network';\n` + code
    },
  }],
  server: { host: '127.0.0.1', port: 3012, fs: { allow: [root] } },
})
