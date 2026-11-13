import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { worklet } from './vite.worklet'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), worklet()],
  base: './',
  server: { watch: { ignored: ['**/release/**'] } },
})
