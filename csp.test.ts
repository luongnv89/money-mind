import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface VercelConfig {
  headers?: Array<{
    source?: string;
    headers?: Array<{ key?: string; value?: string }>;
  }>;
}

const indexHtml = readFileSync('index.html', 'utf8');

const cspMatch = indexHtml.match(
  /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"/i,
);
const csp = cspMatch?.[1] ?? '';

const directive = (name: string): string[] => {
  const match = csp.match(new RegExp(`${name}[^;]*`));
  return match ? match[0].split(/\s+/).slice(1) : [];
};

const importmapContent = indexHtml.match(
  /<script type="importmap">([\s\S]*?)<\/script>/,
)?.[1];

describe('content security policy', () => {
  it('is present in index.html', () => {
    expect(csp).toBeTruthy();
  });

  it("restricts default-src to 'self'", () => {
    expect(directive('default-src')).toEqual(["'self'"]);
  });

  it('allows scripts only from self, esm.sh, and the importmap hash', () => {
    const sources = directive('script-src');
    expect(sources).toContain("'self'");
    expect(sources).toContain('https://esm.sh');
    expect(sources.some((s) => s.startsWith("'sha256-"))).toBe(true);
    expect(sources).not.toContain("'unsafe-inline'");
  });

  it('pins the script-src hash to the exact importmap bytes', () => {
    expect(importmapContent).toBeTruthy();
    const hash = `'sha256-${createHash('sha256')
      .update(importmapContent ?? '', 'utf8')
      .digest('base64')}'`;
    expect(directive('script-src')).toContain(hash);
  });

  it('limits connect-src to the three AI providers', () => {
    const sources = directive('connect-src');
    expect(sources).toContain('https://generativelanguage.googleapis.com');
    expect(sources).toContain('https://api.groq.com');
    expect(sources).toContain('http://localhost:*');
    expect(sources).toContain('http://127.0.0.1:*');
  });

  it('blocks plugins, framing, and form hijacking', () => {
    expect(directive('object-src')).toEqual(["'none'"]);
    expect(directive('base-uri')).toEqual(["'self'"]);
    expect(directive('form-action')).toEqual(["'self'"]);
  });
});

describe('security headers (vercel.json)', () => {
  const config = JSON.parse(
    readFileSync('vercel.json', 'utf8'),
  ) as VercelConfig;
  const headerMap = new Map(
    (config.headers ?? []).flatMap((rule) =>
      (rule.headers ?? []).map((h) => [h.key ?? '', h.value ?? '']),
    ),
  );

  it('applies headers to every route', () => {
    expect(config.headers?.[0]?.source).toBe('/(.*)');
  });

  it('sends a CSP that adds frame-ancestors on top of the meta policy', () => {
    const value = headerMap.get('Content-Security-Policy') ?? '';
    expect(value).toContain(csp);
    expect(value).toContain("frame-ancestors 'none'");
  });

  it('sends anti-sniffing, framing, referrer, and permissions headers', () => {
    expect(headerMap.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headerMap.get('X-Frame-Options')).toBe('DENY');
    expect(headerMap.get('Referrer-Policy')).toBe(
      'strict-origin-when-cross-origin',
    );
    expect(headerMap.get('Permissions-Policy')).toContain('camera=()');
  });
});
