import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { execSync } from 'child_process'

// Get git commit hash at build time
const gitHash = execSync('git rev-parse --short HEAD').toString().trim()

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the built site works both at a domain root and under a
  // GitHub Pages project path (/<repo>/)
  base: './',
  plugins: [vue()],
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  define: {
    '__GIT_HASH__': JSON.stringify(gitHash)
  }
})
