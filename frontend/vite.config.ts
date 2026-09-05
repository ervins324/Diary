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
});
