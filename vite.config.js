import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5173 },
  root: 'public',
  build: { outDir: '../dist', emptyOutDir: true }
});
