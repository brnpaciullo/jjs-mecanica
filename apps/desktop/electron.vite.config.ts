import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import rendererConfig from './vite.renderer.config.js';

export default defineConfig({
  main: {
    // better-sqlite3 e um .node: precisa ficar como require externo, nunca
    // entrar no bundle.
    plugins: [externalizeDepsPlugin({ exclude: ['@jjs/core', '@jjs/db', '@jjs/pdf'] })],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.ts') },
        external: ['better-sqlite3'],
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: ['@jjs/core'] })],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/preload/index.ts') },
      },
    },
  },
  // A tela e a mesma nos dois modos; ver vite.renderer.config.ts.
  renderer: rendererConfig,
});
