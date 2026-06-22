import { defineConfig } from 'astro/config'
import node from '@astrojs/node'
import tailwindcss from '@tailwindcss/vite'

// Static by default; /regrade, /admin and /api/* opt into SSR with
// `export const prerender = false`. The node adapter serves both.
export default defineConfig({
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  vite: {
    plugins: [tailwindcss()],
  },
})
