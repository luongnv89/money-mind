# Modernization Report — money-mind

**Audited:** 2026-08-17 · **Commit:** `9b8d7f8` · **Branch:** `main`
**Stack:** TypeScript / React 19 / Vite 6 / Zustand — client-only SPA · **Size:** 31 source files, ~6.0 kLOC
**Baseline:** RED — no test suite exists, and the build cannot be probed (dependencies not installed)

## Summary

| Severity | Count |
|---|---|
| Critical | 11 |
| High | 24 |
| Medium | 35 |
| Low | 13 |
| **Total** | **83** |

This is not a stale codebase — the dependency tree is close to current (React 19.2, Vite 6.4, TS 5.9)
and every commit landed within the last nine months. It is an **unverified** codebase. The CI quality
job has failed on every run since it was added, at step 5 of 8, because `npm run format:check` is not
a script that exists; lint, typecheck and build are all marked `skipped` and have therefore **never
executed successfully on this repository**. There is no test suite, so nothing else verifies it either.
Behind that gap sit three defect families: analytics that silently assume ISO-8601 dates while the CSV
parser stores raw bank strings (so scores, alerts and charts compute on empty sets for most real
statements); an `/api` proxy the client depends on that the build never produces; and user-facing
claims that API keys are "encrypted" when the implementation is `btoa`. One critical RCE advisory
(`protobufjs`) and an end-of-life CI runtime (Node 20, EOL 2026-04-30) round out the P0/P1 surface.

**Top 5 by impact:**
- `F-CI-001` — CI has never run lint, typecheck or build; every quality claim is unverified.
- `F-TEST-001` — zero test files, no runner; no change in this plan is verifiable without it.
- `F-DEP-010` — CI pins Node 20, end-of-life since 2026-04-30; blocks every toolchain upgrade.
- `F-BUG-001` — ISO-date assumption silently zeroes the score card, alerts, charts and AI context.
- `F-UX-003` — "your API keys are encrypted" is false; the implementation is base64.

## Baseline

| Row | Value | Evidence |
|---|---|---|
| Build | **Not Assessed — dependencies not installed** | `node_modules/` absent; skill contract forbids installing. `npm run build` = `tsc && vite build` (`package.json:7`) |
| Tests runnable | **no — no test suite exists** | `git ls-files \| grep -Ei '(test\|spec\|__tests__)'` → 0 matches; no test script in `package.json:5-10` |
| Test pass rate | **n/a — no suite** | as above |
| Coverage | **Not Assessed — no coverage tool configured** | no `vitest`/`jest`/`c8` in `package.json:23-39` |
| Lint / typecheck | **Not Assessed — dependencies not installed** | `lint` script exists (`package.json:9`); `typecheck` script referenced by CI and README **does not exist** |
| CI | **1 workflow, 2 jobs — last 2 runs FAILED** | `gh run list` → `completed  failure` ×2 (runs 23653491870, 23652572125). Failing step: `Check Formatting (Prettier)`; steps 6–8 `skipped` |
| Runtime declared vs installed | **declared: nowhere** (no `engines`, no `.nvmrc`); CI pins `20` (EOL 2026-04-30); local `v26.4.0` | `.github/workflows/ci.yml:21`, `node -v`, nodejs/Release `schedule.json` |
| Lockfile | **present and consistent** — resolves 327 packages | `npm ci --dry-run` → `added 327 packages`, exit 0 |
| Repo activity | last commit 2026-03-27; 10 commits total, all within 12 months (first: 2025-12-12) | `git log -1`, `git rev-list --count HEAD` |

**Verdict:** **RED** — no test suite (RED on its own) *and* the build could not be probed.
**Test command of record:** none at audit time. Per the plan's stated substitution, tasks scheduled
before Task 0.4 assert **`npm ci && npm run build` exits 0**; every task after it asserts
`npm test` at the rate Task 0.4 establishes.

## Dimension coverage

| Dim | Disposition | Path | Findings |
|---|---|---|---|
| DEP | Audited | own probes (1 of 1 ecosystem: npm) | 11 |
| BUG | Audited | delegated → `code-review` mode `review` | 16 |
| PERF | Audited | delegated → `code-review` mode `perf` | 11 |
| CLEAN | Audited | inline | 7 |
| DEAD | Audited | inline | 7 |
| UX | Audited (static-only — app not runnable) | delegated → `dont-make-me-think`, review mode | 13 |
| TEST | Audited | inline | 3 |
| CI | Audited | inline | 6 |
| SEC | Audited | inline | 2 |
| DOCS | Audited | inline | 7 |

## Dependency currency

Ecosystem: **npm** (single). `Installed` is the version resolved in `package-lock.json`; `Latest` from
`npm view <pkg> version` on 2026-08-17. Blast radius = files importing the package.

| ID | Package | Installed | Latest | Gap | Risk | Blast | Wave | Severity | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| F-DEP-001 | protobufjs | 7.5.4 | ≥7.6.5 | patch | **vuln-critical** | transitive (`@google/genai`) | W1 | Critical | `package.json:12` → GHSA-xq3m-2v4x-88gg (arbitrary code execution), +11 more |
| F-DEP-010 | **node (runtime)** | CI pins `20` | 24 LTS / 26 current | major×2 | **eol** | whole build | W3 | Critical | `.github/workflows/ci.yml:21`; EOL 2026-04-30 per nodejs/Release `schedule.json` |
| F-DEP-002 | vite | 6.4.1 | 8.2.1 | major×2 | vuln-high | build tool | W1 → W7 | High | `package.json:38` → GHSA-p9ff-h696-f583, GHSA-4w7w-66w2-5vf9 |
| F-DEP-003 | postcss | 8.5.8 | 8.5.26 | patch | vuln-high | build tool | W1 | High | `package.json:35` → GHSA-qx2v-qp2m-jg93 (XSS), +3 more |
| F-DEP-004 | brace-expansion | ≤5.0.8 | fixed | patch | vuln-high | transitive | W1 | High | GHSA-rgw5-rvv9-x895, +6 more |
| F-DEP-005 | js-yaml | 4.0.0–4.3.0 | fixed | patch | vuln-high | transitive | W1 | High | GHSA-h67p-54hq-rp68, +2 more |
| F-DEP-006 | nanoid | ≤3.3.17 | fixed | patch | vuln-high | transitive | W1 | High | GHSA-28wg-ghj8-5hjv, GHSA-2v37-7h3g-55p8 |
| F-DEP-007 | ws | 8.0.0–8.20.1 | fixed | patch | vuln-high | transitive | W1 | High | GHSA-58qx-3vcg-4xpx, GHSA-96hv-2xvq-fx4p |
| F-DEP-009 | eslint | 8.57.1 | 10.8.1 | major×2 | eol (v8 unsupported) | lint only | W4 | High | `package.json:33`; v9.0.0 released, v10.8.1 current; legacy `.eslintrc.json` with no `eslint.config.*` |
| F-DEP-008 | uuid | 13.0.0 | 14.0.1 | major | vuln-moderate | 3 files | W1 → W9 | Medium | `package.json:20` → GHSA-w5hq-g745-h8pq |
| F-DEP-011 | 7 packages ≥1 major behind | — | — | major | none | varies | W4–W10 | Medium | see table below |

**Majors behind (F-DEP-011 detail)**

| Package | Installed | Latest | Gap | Wave | Coupled with |
|---|---|---|---|---|---|
| typescript | 5.9.3 | 7.0.2 | major×2 | W8 | — |
| tailwindcss | 3.4.19 | 4.3.3 | major | W5 | removing the CDN (`F-PERF-004`) |
| @vitejs/plugin-react | 4.7.0 | 6.0.5 | major×2 | W7 | vite 6→8 |
| @google/genai | 1.46.0 | 2.17.1 | major | W6 | clears `F-DEP-001` transitive pin |
| lucide-react | 0.560.0 | 1.31.0 | major | W10 | — |
| eslint-plugin-react-hooks | 4.6.2 | 7.1.1 | major×3 | W4 | eslint 8→10 (v4 cannot run on eslint 9+) |
| @types/uuid | 10.0.0 | 11.0.0 | major | W9 | redundant — `uuid` ≥13 ships its own types |

**Runtime and toolchain**

| Component | Declared | Installed | Current stable | Status | Severity |
|---|---|---|---|---|---|
| Node runtime | none (`engines` absent, no `.nvmrc`) | v26.4.0 local / 20 in CI | 24 LTS | **EOL in CI**, undeclared in repo | Critical |
| TypeScript | `^5.7.3` | 5.9.3 | 7.0.2 | 2 majors behind | Medium |
| Vite | `^6.2.0` | 6.4.1 | 8.2.1 | 2 majors behind + vulnerable | High |
| ESLint | `^8.57.0` | 8.57.1 | 10.8.1 | past end of life; legacy config format | High |
| Prettier | **not a dependency** | — | — | CI invokes it; `.prettierrc` is a 0-byte file | Medium |

**Upgrade waves**

| Wave | Contents | Lands in |
|---|---|---|
| W0 | add missing npm scripts + prettier dep + `engines`/`.nvmrc`; make build reproducible | P0 |
| W1 | security patches — `npm audit fix` clears 1 critical + 6 high + 2 moderate | P1 |
| W2 | patch/minor batch — 12 packages (react 19.2.4→19.2.8, recharts, zustand, @typescript-eslint, …) | P1 |
| W3 | runtime upgrade — Node 20 (EOL) → 24 LTS | P2 |
| W4 | eslint 8→10 + flat config + eslint-plugin-react-hooks 4→7 (single coupled task) | P2 |
| W5 | tailwindcss 3→4 + remove Play CDN + add local build | P2 |
| W6 | @google/genai 1→2 | P2 |
| W7 | vite 6→8 + @vitejs/plugin-react 4→6 (coupled) | P2 |
| W8 | typescript 5→7 | P2 |
| W9 | uuid 13→14, drop `@types/uuid` | P2 |
| W10 | lucide-react 0→1 | P2 |

## Findings

### BUG

| ID | Severity | Evidence | Problem | Fix direction | Effort |
|---|---|---|---|---|---|
| F-BUG-001 | Critical | `services/scoreService.ts:39` (also `:37`, `components/MonkeySmileChat.tsx:68`, `services/alertService.ts:73`, `components/InsightsDashboard.tsx:220`) | Every analytics surface derives a month key by fixed-offset string slicing and matches with `startsWith`, but `lib/csvParser.ts:228` stores the raw bank date verbatim. For `03/27/2026` the match never succeeds, so score, alerts, charts and AI context all compute on empty sets. `lib/demoData.ts:22` emits ISO, masking it | Normalize to `YYYY-MM-DD` at the parser boundary; add a day-first/month-first control on the mapping screen; surface unparseable-row counts | M |
| F-BUG-002 | Critical | `constants.ts:31` | Citi is advertised as supported with `amountCol: ''` and `debitCreditCols: true`, but no code ever combines split debit/credit columns. `parseAmount(row[''])` → `NaN` → `0` (`lib/csvParser.ts:230`), then `lib/csvParser.ts:237` filters `amount !== 0` — every row is silently deleted | Implement the split-column path in `parseCSVWithMapping`, or remove Citi from `SUPPORTED_BANKS` | M |
| F-BUG-003 | Critical | `services/aiService.ts:146` (also `:26`) | Client fetches `/api/chat` when no key is set, but `npm run build` emits a static SPA only — no `vercel.json`, no `@vercel/node`, no serverless adapter. The advertised keyless demo path always fails | Add a deployment target for `api/`, or delete the directory and both fallback branches and require a user key | M |
| F-BUG-004 | High | `components/CSVUploader.tsx:152` | Cleanup effect is commented "on mount or unmount" but lists `state` as a dependency, so it runs on **every** transition, closing over the previous state. `mapping → processing` fires `reset()` and clears `file`/`headers`/`mapping` mid-flow | Use an empty dependency array with a ref for unmount-only behaviour | S |
| F-BUG-005 | High | `pages/Dashboard.tsx:166` | Same callback reads fresh state at `:152` but the stale render closure at `:166`. `categorizeWithAI` invokes it once per 25-row batch, so from batch 2 on every update is rebuilt from the pre-analysis snapshot, discarding earlier results | Read from `useTransactionStore.getState()` at `:166` as well | S |
| F-BUG-006 | High | `lib/csvParser.ts:138` | In `complete`, when `meta.fields` is absent, `data` is empty and `errors` is empty, neither `resolve` nor `reject` fires — the promise never settles and the uploader hangs on its spinner with no error | Add a terminal `reject` for the empty-CSV branch; remove the double-settle between `step` and `complete` | S |
| F-BUG-007 | High | `lib/csvParser.ts:237` | `.filter(t => t.description !== 'Unknown' && t.amount !== 0)` silently drops empty-description rows, genuine zero-amount rows, and (via the `NaN`→`0` coercion at `:230`) every row whose amount failed to parse — with no count or warning | Return rejected rows with reasons; display the count in the preview step | S |
| F-BUG-008 | High | `lib/localStorage.ts:8` | Unguarded `JSON.parse` of `financePatterns`. `getPatterns()` is called during render at `pages/Settings.tsx:24` and `pages/Dashboard.tsx:84`, so corrupt storage throws inside render and blanks the app | Wrap in try/catch, return `[]`, validate the parsed value is an array | S |
| F-BUG-009 | High | `stores/useSettingsStore.ts:33` (with `vite.config.ts:10`) | `define: { 'process.env': {} }` makes `getEnvGeminiApiKey()` always return `''`, so `isUsingEnvKey` is permanently false and the Usage Budget card (`pages/Settings.tsx:117`), Testing Mode banner (`pages/Settings.tsx:260`) and forced-model effect (`pages/Settings.tsx:38`) are all unreachable | Read `import.meta.env.VITE_*`, or drop the env-key feature and its dead UI | S |
| F-BUG-016 | Medium | `stores/useSettingsStore.ts:33` (also `api/chat.ts:9`, `api/categorize.ts:12`) | `process` is referenced in three files while `tsconfig.json:9` sets `"types": ["vite/client"]` and `@types/node` is absent from `devDependencies` — a likely `tsc` failure that has never been observed because CI skips the typecheck step | Verify against a real `tsc` run in Task 0.1; add `@types/node` or remove the `process` references | S |
| F-BUG-010 | Medium | `components/MonkeySmileChat.tsx:107` | Context block labelled "RECENT TRANSACTIONS (Last 5)" uses `monthlyTx.slice(0, 5)` on an import-ordered array — the LLM is sent the five **oldest** rows and told they are the newest | Sort by date descending before slicing | S |
| F-BUG-011 | Medium | `components/CSVUploader.tsx:656` | `accept=".csv,.xlsx"` but PapaParse handles delimited text only and no XLSX reader exists; helper text one line below correctly says "Supports .csv" | Restrict `accept` to `.csv` | S |
| F-BUG-012 | Medium | `components/InsightsDashboard.tsx:103` | `MonthlyPerformance` accepts `transactions` then discards it (`transactions: _transactions`) and computes from `allTransactions`, so the dashboard time filter visibly changes two cards and not this one | Honour the filter, or drop the prop and relabel the card "All History" | S |
| F-BUG-013 | Medium | `pages/Dashboard.tsx:83` | `hasPatterns` uses `useMemo(..., [])` while its trailing comment claims it re-checks when transactions change; the "Apply Rules" button never appears until remount | Subscribe to a pattern-count value in the store | S |
| F-BUG-014 | Medium | `pages/Dashboard.tsx:75` | `isAIConfigured` reads `getState()` inside a memo keyed only on `[aiMode, isDemoMode]`, so saving a key in Settings leaves the dashboard showing "Config AI" | Subscribe to `geminiConfig`/`groqConfig` | S |
| F-BUG-015 | Medium | `lib/localStorage.ts:113` | `merchant.includes(p.keyword) \|\| p.keyword.includes(merchant)` over 20-char truncated keywords over-matches — `"UBER"` matches both `UBER EATS` and `UBER TRIP`; `find` also returns insertion order, not best match | Require prefix/whole-token match with a minimum length; prefer the longest match | S |

### PERF

| ID | Severity | Evidence | Problem | Fix direction | Effort |
|---|---|---|---|---|---|
| F-PERF-004 | Critical *(Also: SEC)* | `index.html:8` | Tailwind Play CDN: an unpinned, no-SRI third-party script with full DOM access on a page holding parsed bank statements and a decodable API key — and a runtime CSS compiler costing ~400 KB and 300–800 ms LCP. `tailwindcss`/`postcss`/`autoprefixer` are already installed but no `tailwind.config.js`, `postcss.config.js` or CSS file exists | Add the local Tailwind build, delete the CDN tag, add a CSP | M |
| F-PERF-001 | High | `stores/useTransactionStore.ts:163` | `persist` re-serializes the whole transaction array to `localStorage` synchronously on every `set()`, including each of ~200 analysis batches — ~8 s of blocked main thread at 5,000 rows, plus quota risk | Throttle the persisted storage; index transactions by id so batch merges are O(k) | M |
| F-PERF-002 | High | `services/aiService.ts:349` (also `:475`, `:568`) | Fixed `setTimeout` sits at the end of the loop body, so it also fires after the final batch. Gemini: 20 batches × 4 s = 80 s; Groq: 50 × 2 s = 100 s | Move the delay to the top of the loop guarded on `i > 0`; use adaptive backoff on observed 429s | S |
| F-PERF-003 | High | `services/aiService.ts:502` | Ollama path issues one sequential HTTP round-trip per transaction while cloud paths batch 25/10 — ~7 minutes for 500 rows | Batch, or run a small concurrency pool (~4) | S |
| F-PERF-005 | High | `App.tsx:2` | All four pages statically imported, so `recharts` (~350–450 KB with d3) ships in the entry bundle even for first-time users landing on Upload with no data | `React.lazy` the dashboard route behind `Suspense` | S |
| F-PERF-006 | Medium | `lib/localStorage.ts:108` | `applyPatterns` runs 6 regexes per row then a linear scan of up to 500 patterns — 2.5 M comparisons at 5,000 rows, synchronous | Index patterns by normalized first token in a `Map` | S |
| F-PERF-007 | Medium | `pages/Dashboard.tsx:273` (also `:274`, `:276`, `:378`) | Four full-array scans in the render body with no memo, re-run on every progress-counter tick | Single memoized reduce keyed on `transactions` | S |
| F-PERF-008 | Medium | `components/TransactionTable.tsx:243` | `processedData` re-filters and re-sorts on every keystroke (`:365` has no debounce) — ~60 ms per character at 5,000 rows | Debounce the query at ~150 ms; hoist `lowerQuery` | S |
| F-PERF-009 | Medium | `pages/Dashboard.tsx:59` | Effect keyed on `transactions` array identity, so the 1 s health-check timer is re-armed ~200 times per analysis run | Key on `transactions.length` and `isCategorizing` falling to `false` | S |
| F-PERF-010 | Medium | `vite.config.ts:17` | `sourcemap: true` unconditionally — roughly doubles the deploy artifact and publishes readable source | Gate on `mode !== 'production'` | S |
| F-PERF-011 | Low | `pages/Dashboard.tsx:100` (also `:125`) | `Math.max(...timestamps)` passes one argument per transaction; throws `RangeError` above ~65k elements | Replace with `reduce` | S |

### UX

Static-only review — the app could not be launched (build unprobed). Findings are drawn from source.

| ID | Severity | Evidence | Problem | Fix direction | Effort |
|---|---|---|---|---|---|
| F-UX-001 | Critical | `components/Layout.tsx:22` (button `:84`) | Header "Clear" deletes every imported transaction on one click with no confirmation and no undo, adjacent to the Settings gear | Route through the existing `ConfirmDialog` with `variant="danger"` | S |
| F-UX-002 | Critical | `pages/Settings.tsx:44` | "Clear All Patterns" permanently destroys all learned categorization data with no confirmation; the code carries `// Removed confirm()` and the UI copy at `:213` already promises "cannot be undone" | Reuse `ConfirmDialog` | S |
| F-UX-003 | Critical *(Also: SEC, DOCS)* | `pages/Upload.tsx:78` (also `:38`, `pages/Settings.tsx:296`, `README.md:8`, impl `stores/useSettingsStore.ts:22`) | A padlock icon and "Secure & Encrypted — API keys are encrypted in LocalStorage" sit above a `btoa()` call. Users decide to paste a billable cloud key on a false premise; any same-origin script (including the CDN in `F-PERF-004`) reads it with one `atob` | Rename `encrypt`/`decrypt` to `obfuscate`/`deobfuscate`; correct all four copy sites; optionally add real WebCrypto PBKDF2+AES-GCM behind a passphrase | S |
| F-UX-004 | High | `pages/Dashboard.tsx:426` (with `pages/Settings.tsx:129`) | The budget error offers "Go to Settings to Reset"; Settings states "Limits are hard-coded and cannot be reset manually" — the user follows the app's own instruction into a dead end | Ship the reset control, or change the CTA to explain what actually unblocks them | S |
| F-UX-005 | Medium | `components/CSVUploader.tsx:341` | "We couldn't auto-detect your bank format" renders unconditionally, including when `autoDetectMapping` (`:196`) filled every field correctly — users re-map correct values | Branch the heading on detection success | S |
| F-UX-006 | Medium | `components/TransactionTable.tsx:479` (bar `:457`) | "Verify" pill and a 0–100% confidence bar appear per row with no legend; users skip the loop that trains the pattern engine | Relabel to "Mark correct" and add one explanatory line above the table | S |
| F-UX-007 | Medium | `components/Layout.tsx:27` (vs `components/MonkeySmileChat.tsx:46`) | Two contradictory `isAIReady` definitions: Layout requires a stored key, the chat returns `true` unconditionally for cloud — the banner can say "simulated" while the chat presents as live | Hoist one selector into the settings store | S |
| F-UX-008 | Medium | `components/Layout.tsx:84` | Clear is `hidden sm:flex` with no mobile equivalent — on the most privacy-sensitive action mobile users have no exit | Move into an overflow menu rendered at all breakpoints | S |
| F-UX-009 | Medium | `components/TransactionTable.tsx:431` | Category dropdown position captured once via `getBoundingClientRect()` and rendered fixed; scrolling leaves it floating over unrelated rows — a mis-categorization risk | Reposition on scroll/resize, or close on scroll | S |
| F-UX-010 | Medium | `components/TransactionTable.tsx:483` (also `:383`) | Row actions are `p-1.5` with `w-3`/`w-4` icons — Delete sits ~8 px from Verify at ~24 px tall, under the 44 px touch minimum | Raise interactive rows to `min-h-11`; increase Verify/Delete spacing | S |
| F-UX-011 | Low | `components/Layout.tsx:88` | Settings is an icon-only button with no label or `aria-label` | Add `aria-label` and `title` | S |
| F-UX-012 | Low | `components/MonkeySmileChat.tsx:175` | Chat returns `null` below 1 transaction, so the flagship feature's FAB appears unannounced after first import | Mention it in the post-import success state | S |
| F-UX-013 | Low | `components/Layout.tsx:144` | `v1.0.0` hardcoded beside a live commit hash — support cannot trust the displayed version | Inject from `package.json` at build time | S |

### CLEAN

| ID | Severity | Evidence | Problem | Fix direction | Effort |
|---|---|---|---|---|---|
| F-CLEAN-007 | Medium | `.prettierrc:1` | The file is **0 bytes**, `prettier` is not in `devDependencies`, and no `format`/`format:check` script exists — yet CI invokes `npm run format:check` and README documents `npm run format`. Nothing enforces formatting anywhere | Add prettier + config + both scripts (closes `F-CI-001` jointly) | S |
| F-CLEAN-001 | Medium | `services/scoreService.ts:20` | `calculateFinancialScore` is 164 lines covering validation, timeframe setup, four scoring metrics and grade banding in one body | Extract one function per metric so each is independently testable | M |
| F-CLEAN-002 | Medium | `components/CSVUploader.tsx:117` | 699-line component holding four render modes, a nested modal component, dedupe logic, pagination and drag handling | Split per uploader state; lift dedupe into `lib/` | M |
| F-CLEAN-003 | Medium | `pages/Dashboard.tsx:34` | 590-line component: three analysis handlers, filtering, stats, alerts, tabs and two modals | Extract `useAnalysis` hook and a stats component | M |
| F-CLEAN-004 | Low | `services/scoreService.ts:38` | Indentation switches from 2-space to 4-space mid-function and stays there to the end | Fixed automatically once prettier runs (`F-CLEAN-007`) | S |
| F-CLEAN-005 | Low | `services/alertService.ts:119` | Sorting by `b.message.length - a.message.length` is labelled "top 2 priority alerts" — the key is character count of a randomly chosen quip | Rank by drift percentage | S |
| F-CLEAN-006 | Low | `services/aiService.ts:332` (also `:275`, `:440`, `:457`, `:525`, `components/CSVUploader.tsx:218`, `api/chat.ts:44`) | 8 `console.*` calls ship to production, several logging full AI error payloads on a page holding financial data | Route through a logger gated on `import.meta.env.DEV` | S |

### DEAD

| ID | Severity | Evidence | Problem | Fix direction | Effort |
|---|---|---|---|---|---|
| F-DEAD-001 | High | `api/categorize.ts:9` | 67-line handler referenced by no source file, duplicating the categorization prompt already at `services/aiService.ts:288`. Its own header concedes it exists "to satisfy the architectural requirement of the prompt" | Delete, or wire it up as part of `F-BUG-003` | S |
| F-DEAD-002 | Medium | `index.html:45` | Leftover AI-Studio import map pinning `vite@^7.3.0` and `@vitejs/plugin-react@^5.1.2` — contradicting `package.json:38` (`^6.2.0`) and `:30` (`^4.3.4`) — plus nine packages Vite already bundles. Inert after bundling but a live confusion and supply-chain surface | Delete the `<script type="importmap">` block | S |
| F-DEAD-003 | Medium | `package.json:34` (also `:36`, `:31`) | `tailwindcss`, `postcss` and `autoprefixer` are installed but there is no `tailwind.config.js`, no `postcss.config.js` and no CSS file anywhere — the intended build path was never wired up while `index.html:8` loads the CDN instead | Resolve together with `F-PERF-004` — wire up the local build rather than removing the deps | S |
| F-DEAD-007 | Medium | `migrated_prompt_history/` | 6.4 MB of committed AI transcript dumps (two JSON files) in the repo root, unreferenced by any code | Remove from the working tree and add to `.gitignore` | S |
| F-DEAD-004 | Low | `constants.ts:35` | `MAX_TRANSACTIONS = 5000` exported and imported nowhere | Enforce the cap in `parseCSVWithMapping` or delete | S |
| F-DEAD-005 | Low | `services/alertService.ts:111` | `Alert.id` is constructed per alert but `pages/Dashboard.tsx:67` forwards only `message` and `type` — it appears to have been intended for dedupe | Use it to dedupe repeat alerts, or remove the field | S |
| F-DEAD-009 | Low | `tasks.md:1` | Scaffold checklist with every box ticked, including "Configure DevOps (Linting, Prettier)" — which is precisely what `F-CI-001` shows is broken | Delete, or replace with a pointer to `MODERNIZATION_PLAN.md` | S |

*Cross-references (excluded from counts):* `types.ts:80` `debitCreditCols` is declared and never
implemented — see `F-BUG-002`. `components/InsightsDashboard.tsx:103` unused prop — see `F-BUG-012`.

### TEST

| ID | Severity | Evidence | Problem | Fix direction | Effort |
|---|---|---|---|---|---|
| F-TEST-001 | Critical | repo-wide | No test framework and zero test files (`git ls-files` filtered for `test\|spec\|__tests__` → 0). Nothing in this report can be verified and no fix can be regression-guarded | Add Vitest + jsdom and one smoke test; make it the baseline-green command | M |
| F-TEST-002 | High | `lib/csvParser.ts:41` (also `:75`, `services/scoreService.ts:20`, `lib/localStorage.ts:53`, `:103`) | The pure, trivially testable functions — `parseAmount`, `autoDetectMapping`, `calculateFinancialScore`, `extractMerchantName`, `applyPatterns` — are exactly where the correctness defects cluster, and none has a single test | Characterization tests first, then the `F-BUG-001`/`F-BUG-002` fixes against them | M |
| F-TEST-003 | Medium | repo-wide | No coverage tooling configured, so there is no number to improve against | Add `vitest --coverage` (v8 provider) and record a first measurement | S |

### CI

| ID | Severity | Evidence | Problem | Fix direction | Effort |
|---|---|---|---|---|---|
| F-CI-001 | Critical *(Also: DOCS)* | `.github/workflows/ci.yml:27` (also `:33`) | The quality job calls `npm run format:check` and `npm run typecheck`; **neither script exists** in `package.json:5-10`. Both recorded runs fail at step 5, leaving lint, typecheck and build `skipped` — they have never executed successfully on this repo | Add the missing scripts and the prettier dependency; re-run until the job is green | S |
| F-CI-003 | High | `.github/workflows/ci.yml:12` | No test step, because there is no suite. CI gates formatting but not behaviour | Add `npm test` to the quality job once `F-TEST-001` lands | S |
| F-CI-004 | Medium | `.github/workflows/ci.yml:57` | `aquasecurity/trivy-action@master` is an unpinned moving reference — any upstream change executes in CI unreviewed | Pin to a release tag or commit SHA | S |
| F-CI-005 | Medium | `.github/workflows/ci.yml:54` | `gitleaks-action` runs with `continue-on-error: true`, so the secret scan can never fail the build — it is advisory only | Remove `continue-on-error` (history is currently clean, so this will not break the build) | S |
| F-CI-006 | Medium | `.github/workflows/ci.yml:39` | Trivy scans the filesystem but nothing runs `npm audit`, which is what surfaced the critical `protobufjs` advisory | Add an `npm audit --audit-level=high` gate | S |
| F-CI-007 | Low | repo-wide | No pre-commit hooks — every check is deferred to CI, which is itself red | Add husky + lint-staged running lint and format on staged files | S |

*Cross-reference (excluded from counts):* `.github/workflows/ci.yml:21` pins Node 20 (EOL) — counted
as `F-DEP-010`.

### SEC

Secret scanning came back **clean**: `gitleaks detect` over all 10 commits (7.22 MB) reported
`no leaks found`, and `git log --all` shows no `.env` was ever committed (only `.env.example`).

| ID | Severity | Evidence | Problem | Fix direction | Effort |
|---|---|---|---|---|---|
| F-SEC-001 | High | `index.html:4` | No Content-Security-Policy and no security headers anywhere, on a page that loads a third-party CDN script and holds financial data plus a decodable API key in `localStorage` | Add a CSP `<meta>` restricting `default-src 'self'` with `connect-src` limited to the Gemini and Groq origins | S |
| F-SEC-002 | Medium | `stores/useSettingsStore.ts:159` | `getDecryptedApiKey` returns a plaintext third-party API key that any same-origin script can read; the app has no XSS sinks of its own (`dangerouslySetInnerHTML`/`eval` → 0 hits) but does load an unpinned external script | Pair with `F-PERF-004` (drop the CDN) and `F-SEC-001` (add CSP); consider session-only key storage as an option | S |

*Cross-references (excluded from counts):* dependency advisories — see `F-DEP-001` … `F-DEP-008`.
Third-party CDN — see `F-PERF-004`. Misrepresented key protection — see `F-UX-003`.

### DOCS

| ID | Severity | Evidence | Problem | Fix direction | Effort |
|---|---|---|---|---|---|
| F-DOCS-001 | High | `README.md:108` (also `:109`, `:110`) | The "Quality Assurance" section documents `npm run lint`, `npm run format` and `npm run typecheck`; only `lint` exists. A contributor following the README hits two immediate failures | Update once the scripts land in `F-CI-001` | S |
| F-DOCS-002 | High | `README.md:55` (also `.env.example:2`) | Setup step 3 instructs the user to put `GEMINI_API_KEY` in `.env`, but `vite.config.ts:10` stubs `process.env` and Vite only exposes `VITE_`-prefixed vars — the documented setup has no effect on the client | Correct the instructions to the in-app Settings flow, or implement `VITE_`-prefixed reading | S |
| F-DOCS-003 | Medium | `README.md:20` (also `:88`) | "Serverless Backend: Vercel Functions (in `api/` folder)" is presented as shipped, but nothing builds or deploys `api/` | Align with whichever branch of `F-BUG-003` is chosen | S |
| F-DOCS-004 | Medium | `README.md:4` | Claims on-device AI "via WebLLM/Ollama"; WebLLM appears nowhere in the dependency tree or source | Remove the WebLLM claim | S |
| F-DOCS-005 | Medium | `README.md:30` | "Prerequisites: Node.js v20+" — Node 20 reached end of life 2026-04-30 | Update to Node 24 LTS alongside `F-DEP-010` | S |
| F-DOCS-006 | Low | `README.md:22` | "Styling: Tailwind CSS" implies a build step; actual styling is the runtime Play CDN at `index.html:8` | Update after `F-PERF-004` lands | S |
| F-DOCS-007 | Low | `README.md:129` | States "License: MIT" but no `LICENSE` file exists; no `CONTRIBUTING.md` despite a Contributing section | Add `LICENSE`; add `CONTRIBUTING.md` or trim the section | S |

## Cross-cutting patterns

- **Raw strings used as structured data.** The CSV date is stored verbatim and then parsed by
  fixed-offset slicing in five separate modules, each re-deriving the same assumption independently.
  Demo data happens to satisfy it, so the whole family is invisible in the only path anyone exercises.
  (`F-BUG-001`, `F-BUG-002`, `F-PERF-011`)
- **Features whose enabling condition can never be true.** The env-key path, the usage budget UI, the
  testing-mode banner, the `/api/chat` fallback and the Citi format are all fully built and all
  unreachable — code written against an environment that was never configured.
  (`F-BUG-002`, `F-BUG-003`, `F-BUG-009`, `F-DEAD-001`, `F-DEAD-003`)
- **Destructive actions lost their guards.** `ConfirmDialog` exists and is correctly wired for the
  *least* destructive action (deleting one row), while the two actions that erase everything call
  straight through — one carrying an explicit `// Removed confirm()`.
  (`F-UX-001`, `F-UX-002`)
- **State read two ways in the same function.** Zustand is read via subscription in one line and
  `getState()` in the next, with the stale one silently winning. (`F-BUG-005`, `F-BUG-013`, `F-BUG-014`)
- **Documentation describes the intended system, not the built one.** README, `.env.example`, UI copy
  and `tasks.md` all describe a Vercel-backed, encrypted, Tailwind-compiled, prettier-checked app.
  None of those four are true of the artifact `npm run build` produces.
  (`F-CI-001`, `F-UX-003`, `F-DOCS-001` … `F-DOCS-006`, `F-DEAD-009`)

## Artifacts written

| File | Why |
|---|---|
| `MODERNIZATION_REPORT.md` | this report |
| `MODERNIZATION_PLAN.md` | the derived plan |
| `CODE_REVIEW.md` | declared artifact — written by `code-review` mode `review` |

No probe byproducts were created: `npm audit --package-lock-only` and `npm ci --dry-run` do not
install, and `node_modules/` remains absent.

**Tracked files modified: 0** — `git diff --stat` empty, verified after Phase 0 and after each delegate.

## Limitations

- **The build was never executed.** `node_modules/` is absent and this audit does not install
  dependencies, so build, lint and typecheck are all **Not Assessed**. `F-BUG-016` (a suspected
  `tsc` failure from `process` being referenced without `@types/node`) is therefore *inferred from
  citable configuration*, not observed. Task 0.1 exists to settle it. CI cannot substitute — it has
  never reached those steps.
- **UX was reviewed statically.** The app could not be launched, so `dont-make-me-think` ran against
  source rather than a running UI. Rendering, responsive behaviour and real interaction were not
  observed; findings about touch targets and scroll behaviour are read from markup and class names.
- **Dimensions ran inline and sequentially.** The Agent tool was not used in this session, so the
  parallel `dimension-auditor` path was not taken and `plan-architect`/`plan-validator` run inline
  rather than with fresh context. At 31 source files this is the size branch's prescribed path
  (< 50 files → inline), but the validator's independence is reduced.
- **No runtime profiling.** All `PERF` findings are static; the impact figures are estimates derived
  from batch sizes, array lengths and published bundle weights, not measurements. Confirm with Chrome
  DevTools before optimizing.
- **Network was available**, so latest versions and advisories are current as of 2026-08-17. They will
  drift; re-run `npm audit` before executing W1.
- Six dimensions (`CLEAN`, `DEAD`, `TEST`, `CI`, `SEC`, `DOCS`) were audited inline by design — their
  delegate skills write files, so running them would breach the read-only contract. This is the
  expected path, not a degradation.

## Next step

The plan derived from this report: [`MODERNIZATION_PLAN.md`](./MODERNIZATION_PLAN.md).
</content>
