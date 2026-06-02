import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  optimizeDeps: {
    exclude: ['dockerode', 'dockerode-compose'],
  },
  plugins: [
    devtools(),
    nitro({
      rollupConfig: {
        external: [
          /^@sentry\//,
          /^monaco-editor/,
          /^monaco-yaml/,
          /^@monaco-editor\//,
        ],
      },
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
