import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
  server: { port: 5364, strictPort: false },
  environments: {
    // The deployment manifest uploads a single Worker module, so dynamic
    // imports (the PDF reader) must be inlined rather than split into chunks.
    ai_study_buddy: {
      build: {
        rollupOptions: {
          output: { inlineDynamicImports: true },
        },
      },
    },
  },
})
