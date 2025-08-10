// vite.config.js
import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  root: 'public',
  server: { port: 5173 },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      // WICHTIG: alle HTML-Einstiegspunkte angeben
      input: {
        main: path.resolve(__dirname, 'public/index.html'),
        host: path.resolve(__dirname, 'public/host.html'),
        player: path.resolve(__dirname, 'public/player.html'),
      },
    },
  },
});
