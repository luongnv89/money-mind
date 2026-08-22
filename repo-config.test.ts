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

describe('documentation alignment', () => {
  const readme = readFileSync('README.md', 'utf8');

  it('states a license backed by a LICENSE file', () => {
    expect(readFileSync('LICENSE', 'utf8')).toContain('MIT License');
    expect(readme).toContain('[LICENSE](LICENSE)');
  });

  it('backs the contributing section with a CONTRIBUTING.md', () => {
    const contributing = readFileSync('CONTRIBUTING.md', 'utf8');
    expect(contributing).toContain('pre-commit install');
    expect(readme).toContain('[CONTRIBUTING.md](CONTRIBUTING.md)');
  });

  it('documents only AI backends that exist in the dependency tree', () => {
    // WebLLM is absent from package.json and the lockfile (F-DOCS-004);
    // the documented local backend is Ollama only.
    expect(readme).not.toMatch(/webllm/i);
    expect(readme).toContain('Ollama');
  });
});
