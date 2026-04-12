import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
    allowedHosts: ['poker.vgsoft.site'],
    proxy: {
      '/api': 'http://localhost:8001',
      '/docs': 'http://localhost:8001',
      '/openapi.json': 'http://localhost:8001',
      '/static': 'http://localhost:8001',
      '/ws': {
        target: 'http://localhost:8001',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
