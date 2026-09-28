/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@vyasa/ui/branding': fileURLToPath(new URL('../../../../packages/ui/src/branding', import.meta.url)),
      '@vyasa/ui': fileURLToPath(new URL('../../../../packages/ui/src', import.meta.url)),
      '@assets': fileURLToPath(new URL('../../../../assets', import.meta.url)),
    },
  },
  server: {
    port: 5174,
    host: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});
