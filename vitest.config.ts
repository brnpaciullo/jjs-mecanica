import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// O plugin fica no nível de cima: desde o Vitest 5 os projetos herdam os
// plugins deste arquivo, e repeti-los dispara aviso de duplicação.
export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        // Regras puras: rápido, roda em Node.
        test: {
          name: 'core',
          include: ['packages/*/test/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        // Tela e lógica do processo main.
        test: {
          name: 'tela',
          include: ['apps/desktop/test/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
        },
      },
    ],
  },
});
