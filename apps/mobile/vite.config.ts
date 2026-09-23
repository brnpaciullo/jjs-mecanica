import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * App do mecânico: build estática servida pelo Fastify do processo main.
 * Base relativa porque ele é servido da raiz do servidor da LAN.
 */
export default defineConfig({
  root: __dirname,
  base: '/',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: { input: resolve(__dirname, 'index.html') },
  },
  server: {
    host: true,
    // Em dev o app roda no Vite e fala com o Electron na 4570.
    proxy: {
      '/api': 'http://localhost:4570',
      '/midias': 'http://localhost:4570',
    },
  },
});
