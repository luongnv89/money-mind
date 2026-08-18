import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ci = readFileSync('.github/workflows/ci.yml', 'utf8');

describe('ci.yml quality gate (Task 0.6)', () => {
  it('quality job runs npm test, so behaviour is gated, not just formatting', () => {
    expect(ci).toMatch(/Run Tests/);
    expect(ci).toMatch(/npm test/);
  });

  it('trivy-action is pinned to a release tag, not @master', () => {
    expect(ci).not.toMatch(/trivy-action@master/);
    expect(ci).toMatch(/trivy-action@v\d+\.\d+\.\d+/);
  });

  it('gitleaks has no continue-on-error, so a leak can fail the build', () => {
    const gitleaksBlock = ci.slice(ci.indexOf('Gitleaks Secret Scan'));
    const untilNextStep = gitleaksBlock.slice(
      0,
      gitleaksBlock.indexOf('\n\n      - name:') < 0
        ? gitleaksBlock.length
        : gitleaksBlock.indexOf('\n\n      - name:')
    );
    expect(untilNextStep).not.toContain('continue-on-error');
  });

  it('npm audit runs as a hard gate (no continue-on-error)', () => {
    expect(ci).toMatch(/npm audit --package-lock-only --audit-level=high/);
    const auditBlock = ci.slice(ci.indexOf('NPM Audit'));
    const untilNextStep = auditBlock.slice(
      0,
      auditBlock.indexOf('\n\n      - name:') < 0
        ? auditBlock.length
        : auditBlock.indexOf('\n\n      - name:')
    );
    expect(untilNextStep).not.toContain('continue-on-error');
  });
});
