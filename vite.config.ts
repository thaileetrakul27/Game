import { renameSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  if (mode === 'single') {
    // npm run build:single: one self-contained game.html that plays from a computer with no server and no internet.
    return {
      base: './',
      plugins: [react(), embedFonts(), viteSingleFile(), nameOutput('game.html')],
      build: { outDir: 'dist-single' },
    }
  }
  return {
    // GitHub Pages serves the game from thaileetrakul27.github.io/Game/.
    base: '/Game/',
    plugins: [react()],
  }
})

/** The fonts the interface uses, Latin characters only, from the @fontsource packages. */
const FONTS = [
  { family: 'Courier Prime', file: '@fontsource/courier-prime/files/courier-prime-latin-400-normal.woff2', weight: 400, style: 'normal' },
  { family: 'Courier Prime', file: '@fontsource/courier-prime/files/courier-prime-latin-400-italic.woff2', weight: 400, style: 'italic' },
  { family: 'Courier Prime', file: '@fontsource/courier-prime/files/courier-prime-latin-700-normal.woff2', weight: 700, style: 'normal' },
  { family: 'Public Sans', file: '@fontsource/public-sans/files/public-sans-latin-400-normal.woff2', weight: 400, style: 'normal' },
  { family: 'Public Sans', file: '@fontsource/public-sans/files/public-sans-latin-400-italic.woff2', weight: 400, style: 'italic' },
  { family: 'Public Sans', file: '@fontsource/public-sans/files/public-sans-latin-600-normal.woff2', weight: 600, style: 'normal' },
  { family: 'Public Sans', file: '@fontsource/public-sans/files/public-sans-latin-700-normal.woff2', weight: 700, style: 'normal' },
]

const GOOGLE_FONTS = /@import url\('https:\/\/fonts\.googleapis\.com\/[^']*'\);/

/**
 * Swap the stylesheet's Google Fonts import for the same fonts from npm, so
 * the single-file build can embed them instead of loading them online.
 */
function embedFonts(): Plugin {
  const require = createRequire(import.meta.url)
  return {
    name: 'faultlines:embed-fonts',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('/src/ui/index.css')) return null
      if (!GOOGLE_FONTS.test(code)) throw new Error('src/ui/index.css no longer imports its fonts from Google Fonts')
      const faces = FONTS.map((font) => {
        const url = relative(dirname(id), require.resolve(font.file)).replaceAll('\\', '/')
        return (
          `@font-face { font-family: '${font.family}'; font-style: ${font.style}; font-weight: ${font.weight}; ` +
          `font-display: swap; src: url('${url}') format('woff2'); }`
        )
      })
      return code.replace(GOOGLE_FONTS, faces.join('\n'))
    },
  }
}

/** Give the built page its own name, once everything has been inlined into it. */
function nameOutput(fileName: string): Plugin {
  let outDir = ''
  return {
    name: 'faultlines:name-output',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      renameSync(join(outDir, 'index.html'), join(outDir, fileName))
    },
  }
}
