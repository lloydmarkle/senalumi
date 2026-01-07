import { defineConfig, Plugin } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svelte()],
  server: {
    cors: true,
    host: '0.0.0.0',
    proxy: {
      '/server': {
        target: 'http://localhost:2567',
        ws: true,
      },
    },
  },
})
