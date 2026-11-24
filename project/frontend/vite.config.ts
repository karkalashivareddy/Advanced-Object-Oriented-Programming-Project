import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8080';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
        // The dev server is same-origin from the browser's perspective. Forwarding the
        // browser Origin would make the backend see a new origin on every dev port, so
        // remove it here; direct API requests still go through backend CORS checks.
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => proxyReq.removeHeader('origin'));
        },
      },
      // SockJS negotiates /ws/info over HTTP and then upgrades to a WebSocket.
      // Both must reach the backend for the browser STOMP client; the development
      // port is not in the backend's CORS origin list, so strip Origin as above.
      '/ws': {
        target: apiProxyTarget,
        changeOrigin: true,
        ws: true,
        configure: (proxy) => {
          const stripOrigin = (proxyReq: { removeHeader: (name: string) => void }) =>
            proxyReq.removeHeader('origin');
          proxy.on('proxyReq', stripOrigin);
          // WebSocket upgrades use a separate http-proxy event. Without this,
          // SockJS falls back to XHR streaming instead of upgrading.
          proxy.on('proxyReqWs', stripOrigin);
        },
      },
    },
  },
  preview: {
    port: 5173,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    restoreMocks: true,
    clearMocks: true,
  },
});
