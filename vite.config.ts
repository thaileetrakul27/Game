import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves the game from thaileetrakul27.github.io/Game/.
  base: '/Game/',
  plugins: [react()],
})
