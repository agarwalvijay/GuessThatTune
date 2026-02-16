import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/join/', // Deploy participant app at /join/ path
  resolve: {
    alias: {
      '@song-quiz/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
})
