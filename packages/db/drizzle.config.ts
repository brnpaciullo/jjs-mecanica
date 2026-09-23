import { defineConfig } from 'drizzle-kit';

// So gera SQL; quem aplica e o migrar.ts, no boot do app, depois do backup.
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/schema.ts',
  out: './src/migrations',
  strict: true,
  verbose: true,
});
