import fs from 'node:fs'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// Stamps every build into dist/service-worker.js, so the browser sees a changed file after each deploy
// and can offer the "Update app" button. Render sets RENDER_GIT_COMMIT; the timestamp is a fallback.
function stampServiceWorker() {
  let outDir = 'dist'
  let root = process.cwd()
  return {
    name: 'stamp-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
      root = config.root
    },
    closeBundle() {
      const file = path.resolve(root, outDir, 'service-worker.js')
      if (!fs.existsSync(file)) return
      const id = process.env.RENDER_GIT_COMMIT || String(Date.now())
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('__BUILD_ID__', id))
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    stampServiceWorker(),
  ],
})
