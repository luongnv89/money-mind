import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface PackageJson {
  scripts: Record<string, string>;
  devDependencies: Record<string, string>;
  engines?: { node?: string };
}

describe('repository quality configuration', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as PackageJson;

  it('declares every script CI invokes', () => {
    for (const script of ['format:check', 'format', 'lint', 'typecheck', 'build', 'test']) {
      expect(pkg.scripts[script]).toBeTruthy();
    }
  });

  it('declares prettier as a devDependency', () => {
    expect(pkg.devDependencies.prettier).toBeTruthy();
  });

  it('pins Node 24 in .nvmrc and package.json engines', () => {
    expect(readFileSync('.nvmrc', 'utf8').trim()).toBe('24');
    expect(pkg.engines?.node).toBe('>=24');
  });
});
