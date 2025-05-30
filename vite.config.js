import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  base:
    process.env.NODE_ENV === 'production'
      ? '/math-plotter/' // Replace 'your-repo-name' with your actual GitHub repository name
      : '/',
})
