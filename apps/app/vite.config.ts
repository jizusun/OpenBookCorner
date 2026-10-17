import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      routesDirectory: './routes',
      generatedRouteTree: './lib/routeTree.gen.ts',
      autoCodeSplitting: true,
      quoteStyle: 'single',
      semicolons: false,
    }),
    react(),
    tailwindcss(),
  ],
  build: {
    // Split the big vendor bundle into cacheable groups so the critical path is
    // smaller and long-term caching is better (these libs change rarely). Helps
    // first load on slow / high-latency (e.g. China) connections.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          // @zxing is dynamically imported only when scanning without native
          // BarcodeDetector (iOS). Leave it OUT of manual chunks so Rollup keeps
          // it in its own lazy chunk instead of the always-loaded vendor bundle.
          if (id.includes('@zxing')) return
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react'
          if (id.includes('@tanstack')) return 'tanstack'
          if (id.includes('@trpc') || id.includes('better-auth')) return 'api'
          if (id.includes('zod')) return 'zod'
          return 'vendor'
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': new URL('./', import.meta.url).pathname,
    },
  },
  server: {
    port: 5173,
    proxy: {
      // The SPA calls same-origin /api; dev proxies it to the API worker.
      '/api': {
        target: process.env.API_ORIGIN ?? 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
})
