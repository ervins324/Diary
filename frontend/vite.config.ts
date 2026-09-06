import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  // React plugin and Tailwind CSS v4 Vite plugin
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Path alias mapping '@' to './src' directory
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // Reverse proxy to backend API for local development
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Split heavy dependencies into separate cached vendor chunks
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react';
            }
            if (id.includes('@tanstack/react-query')) {
              return 'vendor-query';
            }
            if (id.includes('recharts')) {
              return 'vendor-charts';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('date-fns')) {
              return 'vendor-dates';
            }
          }
        },
      },
    },
  },
});
