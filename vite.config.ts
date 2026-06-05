import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'
import { env } from '#/env'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  optimizeDeps: {
    exclude: ['dockerode', 'dockerode-compose'],
  },
  plugins: [
    devtools(),
    nitro({
      serverDir: false,
      features: { websocket: env.NODE_ENV !== 'development' },
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
