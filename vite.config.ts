import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { worklet } from './vite.worklet'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), worklet()],
  base: './',
  server: { watch: { ignored: ['**/release/**'] } },
  build: {
    // The app runs in Electron's Chromium and nowhere else, so the CSS is built
    // for that (36 is Chromium 136) and no vendor prefixes are wanted.
    // Never write `-webkit-backdrop-filter` beside `backdrop-filter`: the
    // minifier folds the pair into the prefixed one alone, which Chromium
    // ignores, so the built app loses the blur while the dev server (no
    // minifier) keeps it. Found 2026-11-21; scripts/check-build-css.cjs guards it.
    cssTarget: 'chrome130',
  },
})
