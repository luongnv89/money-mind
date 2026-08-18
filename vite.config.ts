import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // This allows process.env to be used in some libraries that expect it
    'process.env': {},
  },
  server: {
    port: 3000,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    // jsdom gives tests localStorage, File and Date-formatting APIs
    environment: 'jsdom',
    // Pin the zone: Intl formatting is locale/zone sensitive, so an unpinned
    // runner turns date assertions into machine-dependent flakes.
    env: { TZ: 'UTC' },
    // jsdom refuses localStorage on opaque origins, so give it a real URL
    environmentOptions: { jsdom: { url: 'http://localhost:3000' } },
    setupFiles: ['./tests/setup.ts'],
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**', 'dist/**'],
  },
});
