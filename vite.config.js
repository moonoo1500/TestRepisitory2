import { defineConfig } from 'vite';

// Превью Arena раздаётся по адресу https://{port}-{sandboxId}.e2b.app,
// поэтому разрешаем любые хосты и биндимся на 0.0.0.0.
export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    hmr: { clientPort: 443, protocol: 'wss' },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
  },
});
