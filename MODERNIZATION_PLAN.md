# MODERNIZATION_PLAN.md

Performance and reproducibility baselines for MoneyMind.

## Task 0.1 — Reproducible clean-checkout build

Verified on 2026-08-18 with Node v26.4.0, npm 11.17.0:

```bash
rm -rf node_modules && npm ci && npm run build
```

Exits 0. `tsc` reports no diagnostics: the predicted `process` failure
(F-BUG-016) does not reproduce because `@types/node` is present transitively in
the dependency tree (`vite`, `vitest`, `@google/genai` → `protobufjs`,
`@types/papaparse`) and leaks the `process` global via their type references.
No dependency change was required; `package-lock.json` is unchanged.

## M4 — Performance baseline (bundle budget)

| Metric | Value |
|--------|-------|
| `dist/` total size | 5.6 MB |
| Largest single chunk | `assets/index-DwgV9SQn.js` — 1,059.65 kB (gzip 286.83 kB; map 4,778.75 kB) |

Chunk exceeds Vite's 500 kB warning threshold; code-splitting /
`manualChunks` is future perf work bounded by this baseline.
