/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

function spaFallbackPlugin() {
  return {
    name: 'spa-fallback-generator',
    closeBundle() {
      const distDir = fileURLToPath(new URL('./dist', import.meta.url));
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        const routes = ['phd-admission', 'vyasa-assistant', 'assistant', 'phd', 'applicant/login', 'dashboard'];
        for (const route of routes) {
          const targetDir = path.join(distDir, route);
          fs.mkdirSync(targetDir, { recursive: true });
          fs.copyFileSync(indexPath, path.join(targetDir, 'index.html'));
        }
        // Also create 404.html as a fallback
        fs.copyFileSync(indexPath, path.join(distDir, '404.html'));
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), spaFallbackPlugin()],
  resolve: {
    alias: {
      '@vyasa/ui/branding': fileURLToPath(new URL('../packages/ui/src/branding', import.meta.url)),
      '@vyasa/ui': fileURLToPath(new URL('../packages/ui/src', import.meta.url)),
      '@assets': fileURLToPath(new URL('../assets', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});
