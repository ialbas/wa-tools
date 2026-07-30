import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  esbuild: { jsx: 'automatic', jsxImportSource: 'react' },
  test: {
    // Ambiente 'node' por padrão; testes de DOM/React declaram
    // "// @vitest-environment jsdom" na 1ª linha.
    environment: 'node',
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    coverage: { provider: 'v8', include: ['src/**'] },
  },
});
