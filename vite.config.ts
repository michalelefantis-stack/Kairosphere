import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: './',
      server: {
        port: 3000,
        host: '0.0.0.0',
        // Forward AI calls to the backend so the browser never holds a key.
        // In production, point VITE_API_BASE_URL at the deployed server.
        proxy: {
          '/api': {
            target: env.API_PROXY_TARGET || 'http://localhost:8787',
            changeOrigin: true,
          },
        },
      },
      plugins: [tailwindcss(), react()],
      // No `define` for the Gemini key. It used to be inlined here, which
      // shipped it to every browser that loaded the bundle; it now lives only
      // in the server process. See server/README.md.
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
