import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TYPESAFE_API_BASE } from './constants';
import viteConfig from './vite.config';

interface VercelConfig {
  rewrites?: Array<{ source?: string; destination?: string }>;
}

describe('TypeSafe same-origin pass-through', () => {
  it('vercel.json rewrites /typesafe-api to api.typesafe.ai', () => {
    const config = JSON.parse(readFileSync('vercel.json', 'utf8')) as VercelConfig;
    expect(config.rewrites).toContainEqual({
      source: '/typesafe-api/:path*',
      destination: 'https://api.typesafe.ai/:path*',
    });
  });

  it('the vite dev/preview server proxies the same path', async () => {
    if (typeof viteConfig !== 'function') {
      throw new Error('vite.config.ts must default-export a config function');
    }
    const config = await viteConfig({ command: 'serve', mode: 'test' });
    const entry = config.server?.proxy?.[TYPESAFE_API_BASE];
    if (typeof entry !== 'object' || entry === null) {
      throw new Error('missing proxy entry for the TypeSafe API base path');
    }
    expect(entry.target).toBe('https://api.typesafe.ai');
    expect(entry.changeOrigin).toBe(true);
    expect(entry.rewrite?.('/typesafe-api/v1/systemone')).toBe('/v1/systemone');
  });
});
