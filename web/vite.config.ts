import tailwindcss from "@tailwindcss/vite"
import { devtools } from "@tanstack/devtools-vite"
import { TanStackRouterVite } from "@tanstack/router-plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const GO_API_TARGET = process.env.GO_API_TARGET ?? "http://localhost:3000"

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  optimizeDeps: {
    exclude: ["monaco-editor", "monaco-yaml"],
  },
  plugins: [devtools(), TanStackRouterVite(), tailwindcss(), viteReact()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: GO_API_TARGET,
        changeOrigin: true,
        ws: true,
      },
    },
  },
})

export default config
