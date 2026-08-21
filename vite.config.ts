import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const DEV_CSP = [
  "default-src 'self'",
  "script-src 'self' https://esm.sh 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self' https://generativelanguage.googleapis.com https://api.groq.com http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const relaxCspForDev = {
  name: 'relax-csp-for-dev',
  apply: 'serve' as const,
  transformIndexHtml(html: string): string {
    return html.replace(
      /(<meta\s+http-equiv="Content-Security-Policy"\s+content=")[^"]*(")/i,
      `$1${DEV_CSP}$2`
    );
  },
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), relaxCspForDev],
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
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['lib/**', 'services/**'],
      exclude: ['**/*.test.{ts,tsx}'],
      // M3 coverage gate (issue #38 / Task 5.7): the bound is
      // max(60%, Task 0.7 baseline + 20pp). The Task 0.7 baseline was 28.61%
      // lines (PR #45), so the binding floor is 60%.
      thresholds: { lines: 60 },
    },
  },
});
