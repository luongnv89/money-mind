# Modernization Plan — money-mind

Derived from [`MODERNIZATION_REPORT.md`](./MODERNIZATION_REPORT.md) · **Baseline at audit:** RED
**Test command of record:** *none at audit time* · **Pass rate at audit:** *n/a — no suite exists*

## Baseline-green substitution (read this first)

There was no test command and no probeable build at audit time, so the usual *"the suite still passes"*
assertion has nothing to point at until Sprint 0 creates one. Every task therefore carries one of two
baseline assertions:

- **Tasks scheduled before Task 0.4** assert `npm ci && npm run build` exits 0.
- **Task 0.4 and everything after** assert `npm test` passes at ≥ the rate Task 0.4 records, *and*
  `npm ci && npm run build` still exits 0.

This substitution is what keeps the second acceptance criterion on each task meaningful rather than
vacuous. Task 0.4 is the hinge; nothing downstream is genuinely verifiable before it lands.

## At a glance

| Phase | Sprints | Tasks | Closes | Milestone |
|---|---|---|---|---|
| P0 Stabilize | 1 (Sprint 0) | 7 | 3 Critical, 3 High, 6 Medium, 1 Low | M0 |
| P1 Secure & Patch | 2 (Sprints 1–2) | 14 | 8 Critical, 16 High, 5 Medium | M1 |
| P2 Modernize | 2 (Sprints 3–4) | 7 | 1 High † | M2 |
| P3 Clean & Harden | 1 (Sprint 5) | 7 | 11 Medium, 6 Low (+ coverage) | M3 |
| P4 Polish | 1 (Sprint 6) | 4 | 4 High, 13 Medium, 6 Low | M4 |
| **Total** | **7** | **39** | **11 Critical, 24 High, 35 Medium, 13 Low** | |

† Counts are **distinct finding IDs**, so each ID is attributed to the phase that first closes it.
P2 closes one new finding (`F-DEP-009`); `F-DEP-002`, `F-DEP-008` and `F-DEP-011` are already counted
in P1 and merely *continue* there — `F-DEP-011` is a single finding covering seven packages, so the
seven P2 major-upgrade tasks that finish it must not be re-counted as seven findings.

**Critical path:** `0.1 → 0.2 → 0.4 → 0.5 → 2.1 → 5.2 → 5.6 → 5.7 → 6.1 → 6.2` — **~28 working days.**
Nothing outside P0 starts before **M0**, because the baseline is RED and no change is verifiable until
a build and a suite both exist.

### One deviation from the standard phase skeleton, stated deliberately

**Wave W3 (Node 20 → 24 LTS) is pulled forward from P2 into P0** as Task 0.3. Node 20 reached end of
life on 2026-04-30 and is the only runtime CI declares; M0 requires a green CI run from a clean
checkout, which cannot be claimed on an unsupported runner that stops receiving security fixes. Every
later task depends on that CI signal, so the runtime bump is a P0 prerequisite rather than a P2
modernization. All other majors remain in P2, one per task.

---

## Phase P0 — Stabilize

**Goal:** Produce a build and a test suite that a clean checkout can reproduce, and a CI run that
actually executes them. · **Milestone M0:** from a clean clone, `npm ci && npm run build && npm test`
all exit 0, and the GitHub Actions quality job reports `success` with **zero** `skipped` steps.

### Sprint 0 — Restore a verifiable baseline

#### Task 0.1: Produce a reproducible build from a clean checkout and record the artifact size

**Description**: The build has never been observed. `node_modules/` is absent locally and CI fails
before reaching the build step, so `tsc && vite build` has no known status. `F-BUG-016` predicts a
`tsc` failure: `process` is referenced at `stores/useSettingsStore.ts:33`, `api/chat.ts:9` and
`api/categorize.ts:12` while `tsconfig.json:9` sets `"types": ["vite/client"]` and `@types/node` is
absent. Settle that empirically, fix whatever the compiler actually reports, and record the resulting
bundle measurements — they bind the M4 performance budget.

**Closes**: `F-BUG-016`

**Acceptance Criteria**:
- [ ] `npm ci && npm run build` exits 0 from a clean checkout with no pre-existing `node_modules/`
- [ ] Every `tsc` diagnostic is resolved by either adding `@types/node` to `devDependencies` or removing the `process` references — the chosen route is recorded in the commit message
- [ ] `dist/` total size and the largest single chunk are recorded in this plan's M4 row (baseline for the perf budget)
- [ ] `git diff --stat` shows no unintended changes to `package-lock.json`

**Dependencies**: None

**Effort**: S (1 day)

**Verify**: `rm -rf node_modules && npm ci && npm run build && du -sh dist && ls -S dist/assets | head -3`

#### Task 0.2: Add the four missing npm scripts and the prettier dependency

**Description**: CI calls `npm run format:check` (`.github/workflows/ci.yml:27`) and `npm run typecheck` (`.github/workflows/ci.yml:33`);
neither exists in `package.json:5-10`. This is why both recorded CI runs fail at step 5 and leave
lint, typecheck and build `skipped`. `prettier` is not a dependency at all and `.prettierrc` is a
**0-byte file**. README documents all three commands as if they work.

**Closes**: `F-CI-001`, `F-CLEAN-007`, `F-DOCS-001`, `F-CLEAN-004`

**Acceptance Criteria**:
- [ ] `prettier` is in `devDependencies`; `.prettierrc` contains a real configuration object (not empty)
- [ ] `format`, `format:check` and `typecheck` scripts exist and each exits 0 on the current tree
- [ ] `README.md:107-110` lists exactly the scripts that exist, with no extras
- [ ] `npm ci && npm run build` exits 0 (baseline-green holds)

**Dependencies**: 0.1

**Effort**: S (1 day)

**Verify**: `npm run format:check && npm run lint && npm run typecheck && npm run build`

#### Task 0.3: Declare the Node version in-repo and move CI off end-of-life Node 20

**Description**: `.github/workflows/ci.yml:21` pins `node-version: '20'`, which reached end of life on
2026-04-30 (nodejs/Release `schedule.json`). The repository declares no runtime at all — no `engines`
field, no `.nvmrc` — so contributors and CI can silently diverge (local is v26.4.0). This is wave W3,
pulled forward per the deviation noted above.

**Closes**: `F-DEP-010`

**Acceptance Criteria**:
- [ ] `.nvmrc` exists and pins Node 24; `package.json` declares `"engines": { "node": ">=24" }`
- [ ] `.github/workflows/ci.yml:21` reads `node-version-file: '.nvmrc'` so the two can no longer drift
- [ ] `npm ci && npm run build` exits 0 on Node 24
- [ ] `README.md:30` states Node 24 LTS, not v20

**Dependencies**: 0.1

**Effort**: S (0.5 day)

**Verify**: `node -v && npm ci && npm run build` on a Node 24 runner

#### Task 0.4: Add Vitest and establish the test command of record

**Description**: There is no test framework and zero test files, which is why the baseline is RED and
why nothing in the report can be verified. This task creates the command that every subsequent task's
acceptance criteria reference.

**Closes**: `F-TEST-001`

**Acceptance Criteria**:
- [ ] `vitest` + `jsdom` in `devDependencies`; `test` and `test:run` scripts exist
- [ ] At least one smoke test renders `App` and asserts it mounts without throwing
- [ ] `npm test` exits 0; the pass count is recorded here as the new baseline rate
- [ ] `npm ci && npm run build` still exits 0

**Dependencies**: 0.2

**Effort**: M (2 days)

**Verify**: `npm test -- --run`

#### Task 0.5: Write characterization tests for the five pure-logic hotspots

**Description**: `parseAmount` (`lib/csvParser.ts:41`), `autoDetectMapping` (`lib/csvParser.ts:75`),
`calculateFinancialScore` (`services/scoreService.ts:20`), `extractMerchantName` (`lib/localStorage.ts:53`) and
`applyPatterns` (`lib/localStorage.ts:103`) are pure, trivially testable, and are exactly where the
correctness defects cluster. Pin **current** behaviour first — including the wrong behaviour — so the
P1 fixes are provably changes rather than guesses.

**Closes**: `F-TEST-002`

**Acceptance Criteria**:
- [ ] Each of the five functions has a test file covering happy path, boundary and malformed input
- [ ] `calculateFinancialScore` has an explicit test asserting today's broken non-ISO behaviour, marked with a `// characterization — Task 2.1 will invert this` comment
- [ ] `parseAmount` covers US (`1,234.56`), EU (`1.234,56`), bare-comma (`-61,75`), NBSP-separated and unparseable inputs
- [ ] `npm test` passes at ≥ the Task 0.4 rate and `npm run build` exits 0

**Dependencies**: 0.4

**Effort**: M (3 days)

**Verify**: `npm test -- --run lib services`

#### Task 0.6: Make CI run the full gate and harden the security job

**Description**: CI gates formatting but not behaviour, `aquasecurity/trivy-action@master`
(`.github/workflows/ci.yml:57`) is an unpinned moving reference executing in CI unreviewed, `gitleaks` runs with
`continue-on-error: true` (`.github/workflows/ci.yml:54`) so it can never fail a build, and nothing runs `npm audit` —
which is what surfaced the critical `protobufjs` advisory in the first place.

**Closes**: `F-CI-003`, `F-CI-004`, `F-CI-005`, `F-CI-006`

**Acceptance Criteria**:
- [ ] The quality job runs `npm test` and the whole job reports `success` with zero `skipped` steps
- [ ] `trivy-action` is pinned to a release tag or commit SHA, not `@master`
- [ ] `continue-on-error` is removed from the gitleaks step (history is verified clean, so this will not break the build)
- [ ] An `npm audit --audit-level=high` step exists; it may report failures at this point but must execute
- [ ] `npm ci && npm run build && npm test` all exit 0

**Dependencies**: 0.2, 0.3, 0.4

**Effort**: S (1 day)

**Verify**: `gh run list --limit 1` reports `success`; `gh api .../jobs` shows no `skipped` step

#### Task 0.7: Add coverage tooling and record the first measurement

**Description**: Coverage was **Not Assessed** at audit — no tool is configured, so there is no number
to improve against. Measurement must precede improvement; this task binds the M3 target.

**Closes**: `F-TEST-003`

**Acceptance Criteria**:
- [ ] `vitest --coverage` (v8 provider) is configured and `npm run coverage` emits a line/branch report
- [ ] The measured line coverage for `lib/` and `services/` is written into the M3 row of this plan
- [ ] Coverage output paths are added to `.gitignore`
- [ ] `npm test` passes at ≥ the Task 0.4 rate

**Dependencies**: 0.4

**Effort**: S (1 day)

**Verify**: `npm run coverage`

---

## Phase P1 — Secure & Patch

**Goal:** Close every advisory, remove the third-party script from the financial-data page, correct the
false security claims, and fix the Critical/High correctness defects — before anything is built on top
of them. · **Milestone M1:** `npm audit --audit-level=high` reports **0** advisories; `npm outdated`
shows no remaining patch/minor gaps; **all 11 Critical findings are closed**.

Sprint 2 carries the Critical correctness defects rather than deferring them to P3. Data-loss and
data-integrity bugs are Critical, and upgrading dependency majors on top of a parser that silently
deletes rows would make every P2 regression ambiguous.

### Sprint 1 — Vulnerabilities, supply chain, and trust claims

#### Task 1.1: Ship upgrade wave W1 — security patches only

**Description**: One critical and six high advisories, all with fixes available. `protobufjs ≤7.6.4`
carries GHSA-xq3m-2v4x-88gg (arbitrary code execution) transitively via `@google/genai`. Ship this
wave alone so that if the suite goes red, the cause is unambiguous. No majors, no features.

**Closes**: `F-DEP-001`, `F-DEP-002` *(advisory portion)*, `F-DEP-003`, `F-DEP-004`, `F-DEP-005`, `F-DEP-006`, `F-DEP-007`, `F-DEP-008` *(advisory portion)*

**Acceptance Criteria**:
- [ ] `npm audit --package-lock-only --json | jq .metadata.vulnerabilities` reports 0 critical and 0 high
- [ ] Only `package.json` and `package-lock.json` change; the diff contains no major version bumps
- [ ] `npm test` passes at ≥ the Task 0.4 rate and `npm run build` exits 0
- [ ] The CI security job passes with the `npm audit` gate from Task 0.6 active

**Dependencies**: 0.6

**Effort**: S (1 day)

**Verify**: `npm audit --package-lock-only --audit-level=high && npm test -- --run && npm run build`

#### Task 1.2: Replace the Tailwind Play CDN with a local build

**Description**: `index.html:8` loads `https://cdn.tailwindcss.com` — unpinned, no SRI, full DOM access
— on a page holding parsed bank statements and a decodable API key. It is also a runtime CSS compiler
costing roughly 400 KB and 300–800 ms of LCP. `tailwindcss`, `postcss` and `autoprefixer` are already
installed; only the config files and a stylesheet were never created.

**Closes**: `F-PERF-004`, `F-DEAD-003`

**Acceptance Criteria**:
- [ ] `tailwind.config.js` and `postcss.config.js` exist; the config reproduces the colour palette and font stack currently inlined at `index.html:10-37`
- [ ] A stylesheet with the `@tailwind` directives is imported from `index.tsx`
- [ ] `index.html` contains no `cdn.tailwindcss.com` reference and no inline `tailwind.config` block
- [ ] `dist/` total size is **smaller** than the Task 0.1 recorded baseline
- [ ] `npm test` passes at ≥ the Task 0.4 rate and `npm run build` exits 0

**Dependencies**: 0.6

**Effort**: M (2 days)

**Verify**: `npm run build && ! grep -r 'cdn.tailwindcss.com' dist index.html && du -sh dist`

#### Task 1.3: Add a Content-Security-Policy and security headers

**Description**: The app has no CSP anywhere (`index.html:4`) despite handling financial data and
holding a third-party API key in `localStorage`. It has no XSS sinks of its own (`dangerouslySetInnerHTML`
and `eval` both return zero hits), so a restrictive policy is achievable without refactoring.

**Closes**: `F-SEC-001`, `F-SEC-002`

**Acceptance Criteria**:
- [ ] A CSP restricts `default-src` to `'self'` with `connect-src` limited to `https://generativelanguage.googleapis.com`, `https://api.groq.com` and the configured Ollama origin
- [ ] The app loads and all three AI modes' network calls succeed under the policy (no CSP violations in the console)
- [ ] `npm test` passes at ≥ the Task 0.4 rate and `npm run build` exits 0

**Dependencies**: 1.2

**Effort**: S (1 day)

**Verify**: `npm run build && npm run preview`, then confirm zero CSP violations in DevTools console across Upload → Dashboard → Settings

#### Task 1.4: Stop describing base64 obfuscation as encryption

**Description**: `stores/useSettingsStore.ts:22` is `btoa()`, and its own comment says so — but
`pages/Upload.tsx:78` renders a padlock beside "Secure & Encrypted — API keys are encrypted in
LocalStorage", `pages/Upload.tsx:38` and `pages/Settings.tsx:296` repeat the claim, and `README.md:8`
states it as a feature. Users decide to paste a billable cloud key on a false premise.

**Closes**: `F-UX-003`

**Acceptance Criteria**:
- [ ] `encrypt`/`decrypt` are renamed to `obfuscate`/`deobfuscate` throughout, and `types.ts:42`/`:47` comments updated
- [ ] All four user-facing claims are corrected to describe local-only storage without asserting encryption; the padlock framing at `pages/Upload.tsx:75-78` is removed or relabelled
- [ ] `grep -ri "encrypted" README.md pages/ components/` returns no claim about API keys
- [ ] `npm test` passes at ≥ the Task 0.4 rate and `npm run build` exits 0

**Dependencies**: 0.6

**Effort**: S (1 day)

**Verify**: `grep -rn "encrypt" README.md pages/ components/ stores/ types.ts`

#### Task 1.5: Restore confirmation on the two data-destroying actions

**Description**: Header "Clear" (`components/Layout.tsx:22`) deletes every transaction on one click beside the
Settings gear. "Clear All Patterns" (`pages/Settings.tsx:44`) destroys all learned data and carries an
explicit `// Removed confirm()`. `components/ConfirmDialog.tsx` already exists and is correctly wired
for the *least* destructive action — deleting a single row.

**Closes**: `F-UX-001`, `F-UX-002`

**Acceptance Criteria**:
- [ ] Both actions route through `ConfirmDialog` with `variant="danger"` and state what will be lost
- [ ] Tests assert that neither `clearAll` nor `clearPatterns` is invoked until the confirm handler fires
- [ ] `npm test` passes at ≥ the Task 0.4 rate and `npm run build` exits 0

**Dependencies**: 0.6

**Effort**: S (1 day)

**Verify**: `npm test -- --run components/ConfirmDialog Layout Settings`

#### Task 1.6: Ship upgrade wave W2 — patch and minor batch

**Description**: Twelve packages sit at patch/minor gaps with no advisories (react 19.2.4→19.2.8,
recharts 3.8.1→3.10.1, zustand 5.0.12→5.0.15, `@typescript-eslint` 8.57.2→8.67.0, papaparse,
tailwind-merge, autoprefixer, `@types/*`). One batch, one verification.

**Closes**: `F-DEP-011` *(patch/minor portion)*

**Acceptance Criteria**:
- [ ] `npm outdated` reports no remaining patch or minor gaps; no major is included in the diff
- [ ] `npm audit --audit-level=high` still reports 0
- [ ] `npm test` passes at ≥ the Task 0.4 rate and `npm run build` exits 0

**Dependencies**: 1.1

**Effort**: S (1 day)

**Verify**: `npm outdated; npm test -- --run && npm run build`

### Sprint 2 — Critical and high correctness defects

#### Task 2.1: Normalize transaction dates at the parser boundary

**Description**: The single highest-leverage fix in this plan. `lib/csvParser.ts:228` stores the raw
bank string, while `services/scoreService.ts:39`, `components/MonkeySmileChat.tsx:68`, `services/alertService.ts:73` and
`components/InsightsDashboard.tsx:220` each independently derive a month key by fixed-offset slicing and match
with `startsWith`. For `03/27/2026` nothing matches, so the score card, alerts, both charts and the AI
chat context all silently compute on empty sets. `lib/demoData.ts:22` emits ISO, which is why demo
mode works and hides the whole family.

**Closes**: `F-BUG-001`

**Acceptance Criteria**:
- [ ] `Transaction.date` is documented and validated as `YYYY-MM-DD`; conversion happens once, in the parser
- [ ] The mapping screen exposes a day-first / month-first control, defaulted from a header heuristic
- [ ] Rows whose date cannot be parsed are surfaced with a count in the preview step, not silently dropped
- [ ] The Task 0.5 characterization tests are **inverted** to assert correct behaviour, with tests covering `MM/DD/YYYY`, `DD/MM/YYYY`, `YYYY-MM-DD` and `DD.MM.YYYY`
- [ ] `calculateFinancialScore` returns a non-zero grade for a `MM/DD/YYYY` fixture spanning three months
- [ ] `npm test` passes at ≥ the Task 0.4 rate and `npm run build` exits 0

**Dependencies**: 0.5

**Effort**: M (3 days)

**Verify**: `npm test -- --run lib/csvParser services/scoreService services/alertService`

#### Task 2.2: Implement or withdraw the Citi split debit/credit format

**Description**: `constants.ts:31` advertises Citi with `amountCol: ''` and `debitCreditCols: true`,
deferring to parser logic that was never written — `debitCreditCols` is read only at `lib/csvParser.ts:252`
to relax a header check. `parseAmount(row[''])` yields `NaN` → `0` (`lib/csvParser.ts:230`), and
`lib/csvParser.ts:237` then filters `amount !== 0`, deleting every row. Citi users see "Import 0
Transactions" with no error.

**Closes**: `F-BUG-002`

**Acceptance Criteria**:
- [ ] Either `parseCSVWithMapping` combines separate debit and credit columns into a signed amount, **or** Citi is removed from `SUPPORTED_BANKS` and the unused `debitCreditCols` flag is deleted from `types.ts:80`
- [ ] If implemented: a Citi-shaped fixture imports the correct row count with correct signs
- [ ] If withdrawn: `components/CSVUploader.tsx:686` no longer advertises Citi as supported
- [ ] `npm test` passes at ≥ the Task 0.4 rate and `npm run build` exits 0

**Dependencies**: 2.1

**Effort**: M (2 days)

**Verify**: `npm test -- --run lib/csvParser`

#### Task 2.3: Resolve the `/api` serverless proxy — deploy it or delete it

**Description**: `services/aiService.ts:26` and `:146` fetch `/api/chat` whenever no key is set, but
`npm run build` is `tsc && vite build` and emits a static SPA — there is no `vercel.json`, no
`@vercel/node`, no adapter. The advertised keyless demo path always fails. `api/categorize.ts` is
referenced by nothing at all; its own header concedes it exists "to satisfy the architectural
requirement of the prompt".

**Closes**: `F-BUG-003`, `F-DEAD-001`, `F-DOCS-003`

**Acceptance Criteria**:
- [ ] A decision is recorded in the commit message: **(a)** add a deployment target so `api/` actually ships, or **(b)** delete `api/` and both `/api/chat` fallback branches and require a user-supplied key
- [ ] Under (a): a deployed preview returns 200 from `POST /api/chat`. Under (b): `grep -rn "/api/" services/ components/ pages/` returns no hits and `api/` no longer exists
- [ ] `api/categorize.ts` is deleted under either route — it is unreferenced in both
- [ ] `README.md:20` and `README.md:87-93` describe the architecture that actually ships
- [ ] `npm test` passes at ≥ the Task 0.4 rate and `npm run build` exits 0

**Dependencies**: 0.6

**Effort**: M (2 days)

**Verify**: `npm run build && grep -rn "api/chat" services/ components/ pages/`

#### Task 2.4: Make the CSV parser fail loudly instead of silently

**Description**: Two independent silent failures. `lib/csvParser.ts:138`: when `meta.fields` is absent,
`data` is empty and `errors` is empty, neither `resolve` nor `reject` fires — the promise never settles
and the uploader hangs on its spinner forever. `lib/csvParser.ts:237`: rows are dropped for empty
descriptions, genuine zero amounts, and (via the `NaN`→`0` coercion at `:230`) any unparseable amount —
with no count or warning.

**Closes**: `F-BUG-006`, `F-BUG-007`

**Acceptance Criteria**:
- [ ] `getCSVHeaders` rejects with a descriptive error on an empty or unreadable CSV; the double-settle between `step` and `complete` is removed
- [ ] `parseCSVWithMapping` returns rejected rows with reasons alongside accepted rows; the preview step displays the rejected count
- [ ] Tests cover: empty file, headers-only file, all-unparseable amounts, and a genuine zero-amount row being preserved
- [ ] `npm test` passes at ≥ the Task 0.4 rate and `npm run build` exits 0

**Dependencies**: 0.5

**Effort**: M (2 days)

**Verify**: `npm test -- --run lib/csvParser`

#### Task 2.5: Fix the uploader lifecycle reset and the analysis stale closure

**Description**: `components/CSVUploader.tsx:152` declares a cleanup commented "on mount or unmount" but lists
`state` as a dependency, so it runs on every transition closing over the previous state — the
`mapping → processing` step fires `reset()` and clears `file`/`headers`/`mapping` mid-flow.
Separately, `pages/Dashboard.tsx:166` reads the stale render closure while `:152` in the same callback reads
fresh state; since the callback fires once per 25-row batch, every batch after the first is rebuilt
from the pre-analysis snapshot, discarding earlier results.

**Closes**: `F-BUG-004`, `F-BUG-005`

**Acceptance Criteria**:
- [ ] The `CSVUploader` cleanup uses an empty dependency array (with a ref if unmount-only behaviour is wanted); a test walks `idle → mapping → processing → preview` and asserts `file` survives every transition
- [ ] `pages/Dashboard.tsx:166` reads from `useTransactionStore.getState()`; a test runs a 3-batch categorization and asserts all three batches' results are present in the final store
- [ ] `npm test` passes at ≥ the Task 0.4 rate and `npm run build` exits 0

**Dependencies**: 0.5

**Effort**: M (2 days)

**Verify**: `npm test -- --run components/CSVUploader pages/Dashboard`

#### Task 2.6: Guard localStorage reads and remove the unreachable env-key feature

**Description**: `lib/localStorage.ts:8` parses `financePatterns` unguarded, and `getPatterns()` is called
during render at `pages/Settings.tsx:24` and `pages/Dashboard.tsx:84` — corrupt storage throws inside render and
blanks the app with no recovery. Separately, `vite.config.ts:10` replaces `process.env` with `{}`, so
`getEnvGeminiApiKey()` (`stores/useSettingsStore.ts:33`) always returns `''`, making `isUsingEnvKey`
permanently false and the Usage Budget card, Testing Mode banner and forced-model effect all
unreachable dead UI.

**Closes**: `F-BUG-008`, `F-BUG-009`

**Acceptance Criteria**:
- [ ] `getPatterns` catches parse errors, validates the result is an array, and returns `[]` on failure; a test writes corrupt JSON to `localStorage` and asserts the app still renders
- [ ] Either the env-key path reads `import.meta.env.VITE_*` and the budget UI becomes reachable, **or** the env-key feature and its three dead UI branches are removed — the choice is recorded in the commit message
- [ ] `npm test` passes at ≥ the Task 0.4 rate and `npm run build` exits 0

**Dependencies**: 0.5

**Effort**: M (2 days)

**Verify**: `npm test -- --run lib/localStorage stores/useSettingsStore`

#### Task 2.7: Remove the usage-reset dead end

**Description**: The budget error at `pages/Dashboard.tsx:426` offers "Go to Settings to Reset"; Settings
states at `:129` that "Limits are hard-coded and cannot be reset manually". The user follows the app's
own instruction into a screen that contradicts it, with no alternative offered.

**Closes**: `F-UX-004`

**Acceptance Criteria**:
- [ ] Either a working reset control exists in Settings, **or** the Dashboard CTA is changed to state what actually unblocks the user (supplying their own API key) and the Settings copy is made consistent
- [ ] No screen instructs the user to perform an action that another screen says is impossible — verified by re-reading both strings
- [ ] `npm test` passes at ≥ the Task 0.4 rate and `npm run build` exits 0

**Dependencies**: 1.5

**Effort**: S (1 day)

**Verify**: `npm test -- --run pages/Settings pages/Dashboard`

#### Task 2.8: Correct the environment-variable setup documentation

**Description**: `README.md:48-58` instructs users to create `.env` with `GEMINI_API_KEY`, and
`.env.example:2` reinforces it — but `vite.config.ts:10` stubs `process.env` and Vite only exposes
`VITE_`-prefixed variables via `import.meta.env`. The documented setup has no effect on the client.

**Closes**: `F-DOCS-002`

**Acceptance Criteria**:
- [ ] `README.md` setup steps match whichever route Task 2.6 chose, and a fresh contributor following them reaches a working AI configuration
- [ ] `.env.example` lists only variables the application actually reads (or is deleted if none remain)
- [ ] `npm test` passes at ≥ the Task 0.4 rate and `npm run build` exits 0

**Dependencies**: 2.3

**Effort**: S (0.5 day)

**Verify**: Follow `README.md` setup from a clean clone; the app reaches a configured AI state

---

## Phase P2 — Modernize

**Goal:** Bring every remaining major dependency current, one per task, ordered by blast radius
ascending. · **Milestone M2:** every major listed in the report's currency table is either current or
recorded in **Deferred** with a written rationale; `npm test` and `npm run build` green after each.

**Every task below names its migration source.** Where none was retrieved during the audit, the task's
first acceptance criterion is producing it — those are labelled *spike*.

### Sprint 3 — Toolchain majors

#### Task 3.1: Upgrade ESLint 8 → 10 with flat config (wave W4)

**Description**: `eslint@8.57.1` is past end of life; v10.8.1 is current. The project still uses the
legacy `.eslintrc.json` with no `eslint.config.*`. `eslint-plugin-react-hooks@4.6.2` cannot run on
ESLint 9+, so it must move to 7.1.1 in the **same** task — they are a single atomic change, not two
majors batched for convenience.

**Closes**: `F-DEP-009`

**Migration source**: ESLint flat-config migration guide + `@eslint/migrate-config` codemod — **spike: retrieve and record before starting.**

**Acceptance Criteria**:
- [ ] The migration guide is retrieved and its breaking changes are listed in the PR description
- [ ] `eslint.config.js` replaces `.eslintrc.json`; the four custom rules at `.eslintrc.json:12-19` are preserved with identical severities
- [ ] `npm run lint` exits 0 with `--max-warnings 0`, as `package.json:9` already requires
- [ ] `npm test` passes at ≥ the Task 0.4 rate and `npm run build` exits 0

**Dependencies**: 1.6

**Effort**: M (2 days)

**Verify**: `npm run lint && npm test -- --run && npm run build`

#### Task 3.2: Upgrade Tailwind CSS 3 → 4 (wave W5)

**Description**: `tailwindcss@3.4.19` → `4.3.3`. Tailwind 4 replaces the JS config with a CSS-first
`@theme` directive and changes the PostCSS plugin entry point. This depends on Task 1.2, which created
the local build in the first place.

**Closes**: `F-DEP-011` *(tailwindcss)*

**Migration source**: Tailwind CSS v4 upgrade guide + `npx @tailwindcss/upgrade` codemod — **spike: retrieve and record before starting.**

**Acceptance Criteria**:
- [ ] The upgrade guide is retrieved and breaking changes listed in the PR description
- [ ] The custom palette (`accent`, `accent-hover`, `accent-light`, the gray scale) and Inter font stack render identically — verified by side-by-side screenshots of Upload, Dashboard and Settings
- [ ] `npm test` passes at ≥ the Task 0.4 rate and `npm run build` exits 0

**Dependencies**: 1.2, 1.6

**Effort**: M (2 days)

**Verify**: `npm run build && npm run preview` + visual diff against pre-upgrade screenshots

#### Task 3.3: Upgrade @google/genai 1 → 2 (wave W6)

**Description**: `@google/genai@1.46.0` → `2.17.1`. This also clears the transitive `protobufjs` pin
behind `F-DEP-001` at its source rather than relying on the W1 override.

**Closes**: `F-DEP-011` *(@google/genai)*, `F-DEP-001` *(root-cause portion)*

**Migration source**: `@google/genai` v2 release notes / CHANGELOG — **spike: retrieve and record before starting.**

**Acceptance Criteria**:
- [ ] The v2 breaking changes are retrieved and listed in the PR description
- [ ] `generateContent` calls at `services/aiService.ts:40`, `:167`, `:304` and the `responseSchema` blocks at `:309-323` are updated to the v2 API
- [ ] A live Gemini categorization of a 10-row fixture returns correctly shaped results
- [ ] `npm audit` confirms `protobufjs` resolves to a non-vulnerable version without an override
- [ ] `npm test` passes at ≥ the Task 0.4 rate and `npm run build` exits 0

**Dependencies**: 1.6

**Effort**: M (2 days)

**Verify**: `npm audit --package-lock-only && npm test -- --run services/aiService && npm run build`

### Sprint 4 — Build chain and remaining majors

#### Task 4.1: Upgrade Vite 6 → 8 with @vitejs/plugin-react 4 → 6 (wave W7)

**Description**: `vite@6.4.1` → `8.2.1` (two majors) and `@vitejs/plugin-react@4.7.0` → `6.0.5`.
The plugin is version-locked to the Vite major, so these ship together as one atomic change. This also
closes the residual `F-DEP-002` advisories at their root. Highest blast radius in P2 — it runs last in
the toolchain ordering.

**Closes**: `F-DEP-002` *(major portion)*, `F-DEP-011` *(vite, @vitejs/plugin-react)*

**Migration source**: Vite 7 and Vite 8 migration guides (both majors must be read) — **spike: retrieve and record before starting.**

**Acceptance Criteria**:
- [ ] Both migration guides are retrieved and their breaking changes listed in the PR description
- [ ] `vite.config.ts` is updated; the `define: { 'process.env': {} }` hack at `:10` is re-evaluated against whatever Task 2.6 decided and removed if now unnecessary
- [ ] `npm run dev` serves on port 3000 and `npm run build` produces a working `dist/`
- [ ] `npm audit --audit-level=high` reports 0
- [ ] `npm test` passes at ≥ the Task 0.4 rate

**Dependencies**: 3.1, 3.2, 3.3

**Effort**: M (3 days)

**Verify**: `npm run build && npm run preview && npm test -- --run`

#### Task 4.2: Upgrade TypeScript 5 → 7 (wave W8)

**Description**: `typescript@5.9.3` → `7.0.2`, two majors. Runs after Vite because the build invokes
`tsc` first (`package.json:7`) and after ESLint because `@typescript-eslint` must support the new
compiler.

**Closes**: `F-DEP-011` *(typescript)*

**Migration source**: TypeScript 6.0 and 7.0 release notes — **spike: retrieve and record before starting.**

**Acceptance Criteria**:
- [ ] Both releases' breaking changes are retrieved and listed in the PR description
- [ ] `npm run typecheck` exits 0 with `strict`, `noUnusedLocals`, `noUnusedParameters` and `noFallthroughCasesInSwitch` all still enabled (`tsconfig.json:15-18`)
- [ ] No `@ts-expect-error` or `@ts-ignore` is introduced to force the upgrade through
- [ ] `npm test` passes at ≥ the Task 0.4 rate and `npm run build` exits 0

**Dependencies**: 4.1

**Effort**: M (3 days)

**Verify**: `npm run typecheck && npm run build && npm test -- --run`

#### Task 4.3: Upgrade uuid 13 → 14 and drop the redundant @types/uuid (wave W9)

**Description**: `uuid@13.0.0` → `14.0.1`, which also closes the moderate advisory
GHSA-w5hq-g745-h8pq. `@types/uuid@10` is redundant — `uuid` has shipped its own types since v13 — so
the type package is deleted rather than bumped to 11.

**Closes**: `F-DEP-008`, `F-DEP-011` *(uuid, @types/uuid)*

**Migration source**: `uuid` v14 CHANGELOG — **spike: retrieve and record before starting.**

**Acceptance Criteria**:
- [ ] `@types/uuid` is removed from `devDependencies` and `npm run typecheck` still exits 0
- [ ] The three `uuidv4()` call sites (`lib/csvParser.ts:227`, `components/CSVUploader.tsx:285`, `stores/useToastStore.ts:22`) work unchanged or are updated per the CHANGELOG
- [ ] `npm audit` reports 0 advisories for `uuid`
- [ ] `npm test` passes at ≥ the Task 0.4 rate and `npm run build` exits 0

**Dependencies**: 4.1

**Effort**: S (1 day)

**Verify**: `npm audit --package-lock-only && npm run typecheck && npm test -- --run`

#### Task 4.4: Upgrade lucide-react 0.x → 1.x (wave W10)

**Description**: `lucide-react@0.560.0` → `1.31.0`. Pure icon library, lowest blast radius, no
dependents — scheduled last.

**Closes**: `F-DEP-011` *(lucide-react)*

**Migration source**: `lucide-react` v1 release notes (icon renames) — **spike: retrieve and record before starting.**

**Acceptance Criteria**:
- [ ] Any renamed or removed icons among the ~35 imported across `components/` and `pages/` are updated
- [ ] `npm run build` exits 0 with no unresolved icon imports
- [ ] Every screen renders with no missing-icon placeholders — verified visually on Upload, Dashboard, Settings, Privacy
- [ ] `npm test` passes at ≥ the Task 0.4 rate

**Dependencies**: 4.1

**Effort**: S (1 day)

**Verify**: `npm run build && npm run preview`

---

## Phase P3 — Clean & Harden

**Goal:** Remove dead code, break up the three god modules, close the remaining Medium correctness
defects, and raise coverage to a bound target. · **Milestone M3:** see the binding table below.

### M3 binding

| Value | Bound to |
|---|---|
| Coverage target | **≥ 60% line coverage across `lib/` and `services/`** — the directories where the correctness defects cluster — which is the binding floor and is measurable on its own today. Baseline was **Not Assessed**, so Task 0.7 measures first and *raises* the target to `baseline + 20 pp` if that exceeds the floor. Record the Task 0.7 number here when it lands: `______%` (floor applies until then) |
| Duplication threshold | The categorization prompt duplicated between `api/categorize.ts:9` and `services/aiService.ts:288` is eliminated (Task 2.3), and no logic block named in the `DEAD` findings survives repeated ≥ 3 times |
| Weak-type scope | **Clause dropped.** The `DEAD` audit found zero occurrences of `any` (`grep -rn ": any\|as any\|<any>"` → 0 hits) and `tsconfig.json:15` already enables `strict`. Inventing a weak-type target here would be fabrication |

### Sprint 5 — Dead code, structure, and coverage

#### Task 5.1: Delete dead code and committed cruft

**Description**: Seven unreferenced artifacts, including 6.4 MB of committed AI transcript dumps.

**Closes**: `F-DEAD-002`, `F-DEAD-004`, `F-DEAD-005`, `F-DEAD-007`, `F-DEAD-009`

**Acceptance Criteria**:
- [ ] The `<script type="importmap">` block at `index.html:45-65` is deleted (it pins `vite@^7.3.0` against `package.json`'s actual version and is inert after bundling)
- [ ] `migrated_prompt_history/` (6.4 MB) is removed from the working tree and added to `.gitignore`; `tasks.md` is deleted or replaced with a pointer to this plan
- [ ] `MAX_TRANSACTIONS` (`constants.ts:35`) is either enforced in `parseCSVWithMapping` or removed; `Alert.id` (`services/alertService.ts:111`) is either used for dedupe or removed
- [ ] `npm test` passes at ≥ the Task 0.4 rate and `npm run build` exits 0

**Dependencies**: 2.3

**Effort**: S (1 day)

**Verify**: `npm run build && du -sh . --exclude=node_modules --exclude=.git`

#### Task 5.2: Decompose the three oversized modules

**Description**: `components/CSVUploader.tsx:117` is 699 lines holding four render modes, a nested modal, dedupe
logic and pagination. `pages/Dashboard.tsx:34` is 590 lines with three analysis handlers, filtering, stats,
alerts, tabs and two modals. `calculateFinancialScore` (`services/scoreService.ts:20`) is 164 lines covering
validation, timeframes, four metrics and grade banding. The Task 0.5 and 2.1 tests make this refactor
safe; it is scheduled after them for exactly that reason.

**Closes**: `F-CLEAN-001`, `F-CLEAN-002`, `F-CLEAN-003`

**Acceptance Criteria**:
- [ ] `calculateFinancialScore` is split into one function per metric, each independently unit-tested
- [ ] **Within the three modules this task names**, no resulting file exceeds 300 lines and no resulting function exceeds 50 lines. `components/TransactionTable.tsx` (553) and `pages/Settings.tsx` (457) are deliberately **out of scope** — no `CLEAN` finding cites them, and this plan does not invent work the report did not raise
- [ ] Behaviour is unchanged — the existing test suite passes without modification to assertions
- [ ] `npm test` passes at ≥ the Task 0.4 rate and `npm run build` exits 0

**Dependencies**: 0.5, 2.1

**Effort**: L (5 days)

**Verify**: `npm test -- --run && wc -l components/*.tsx pages/*.tsx services/*.ts | sort -n | tail -5`

#### Task 5.3: Replace shipped console logging with a gated logger

**Description**: Eight `console.*` calls ship to production, several logging full AI error payloads on
a page holding financial data.

**Closes**: `F-CLEAN-006`

**Acceptance Criteria**:
- [ ] All eight sites route through a logger gated on `import.meta.env.DEV`
- [ ] `grep -rn "console\." services/ components/ pages/ lib/ stores/` returns 0 hits
- [ ] `npm test` passes at ≥ the Task 0.4 rate and `npm run build` exits 0

**Dependencies**: 4.2

**Effort**: S (1 day)

**Verify**: `grep -rn "console\." services/ components/ pages/ lib/ stores/ | wc -l` → 0

#### Task 5.4: Rank financial alerts by drift, not message length

**Description**: `services/alertService.ts:119` sorts by `b.message.length - a.message.length` while the comment
promises "top 2 priority alerts" — the ranking key is the character count of a randomly chosen quip.

**Closes**: `F-CLEAN-005`

**Acceptance Criteria**:
- [ ] Alerts are ranked by drift percentage descending; a test asserts a 200% drift outranks a 25% drift regardless of quip length
- [ ] `npm test` passes at ≥ the Task 0.4 rate and `npm run build` exits 0

**Dependencies**: 5.2

**Effort**: S (0.5 day)

**Verify**: `npm test -- --run services/alertService`

#### Task 5.5: Add pre-commit hooks

**Description**: Every check is deferred to CI. Shift lint and format left so the loop is fast and CI
stays green.

**Closes**: `F-CI-007`

**Acceptance Criteria**:
- [ ] `husky` + `lint-staged` run `eslint --fix` and `prettier --write` on staged files
- [ ] A deliberately mis-formatted staged file is corrected (or the commit blocked) on `git commit`
- [ ] `npm test` passes at ≥ the Task 0.4 rate and `npm run build` exits 0

**Dependencies**: 3.1

**Effort**: S (1 day)

**Verify**: Stage a mis-formatted file and run `git commit`; confirm the hook fires

**Delegate**: run `/devops-pipeline` for the hook configuration, then verify the criteria above independently.

#### Task 5.6: Close the six remaining Medium correctness defects

**Description**: `components/MonkeySmileChat.tsx:107` sends the five *oldest* transactions labelled "Last 5";
`components/CSVUploader.tsx:656` accepts `.xlsx` with no XLSX reader present; `components/InsightsDashboard.tsx:103`
discards the `transactions` prop so the time filter silently doesn't apply to that card;
`pages/Dashboard.tsx:83` memoizes `hasPatterns` with `[]` against its own comment; `pages/Dashboard.tsx:75` leaves
`isAIConfigured` stale after a key is saved; `lib/localStorage.ts:113` over-matches patterns bidirectionally.

**Closes**: `F-BUG-010`, `F-BUG-011`, `F-BUG-012`, `F-BUG-013`, `F-BUG-014`, `F-BUG-015`

**Acceptance Criteria**:
- [ ] Each of the six has a regression test that fails against the current implementation and passes after the fix
- [ ] Pattern matching requires a prefix or whole-token match with a minimum keyword length and prefers the longest match — a test asserts `UBER EATS` and `UBER TRIP` no longer collide
- [ ] `npm test` passes at ≥ the Task 0.4 rate and `npm run build` exits 0

**Dependencies**: 5.2

**Effort**: M (3 days)

**Verify**: `npm test -- --run`

#### Task 5.7: Raise coverage to the M3 target

**Description**: Fill the gaps the Task 0.7 report identifies, prioritising `lib/` and `services/`.

**Closes**: milestone-enabling — serves **M3**

**Acceptance Criteria**:
- [ ] Line coverage across `lib/` and `services/` meets the M3 bound (max(60%, Task 0.7 baseline + 20 pp))
- [ ] Every error path in `csvParser.ts` and `aiService.ts` has at least one test
- [ ] Coverage is enforced in CI via a `--coverage.thresholds.lines` gate, so it cannot regress
- [ ] `npm test` passes at ≥ the Task 0.4 rate and `npm run build` exits 0

**Dependencies**: 5.2, 5.6

**Effort**: L (5 days)

**Verify**: `npm run coverage` and confirm the threshold gate fails when a covered branch is deleted

**Delegate**: run `/test-coverage` on `lib/` and `services/`, then verify the criteria above independently. "Ran the skill" is not a criterion — the threshold gate is.

---

## Phase P4 — Polish

**Goal:** Performance, remaining UX, and documentation alignment. · **Milestone M4:** all 13 `UX`
findings closed; the perf budget below met; every documentation claim matches the built artifact.

### M4 binding

| Value | Bound to |
|---|---|
| Perf budget | **Entry-bundle gzipped size ≤ 250 KB**, which is the binding ceiling and is measurable on its own. It is derived, not invented: removing the ~400 KB Tailwind Play CDN (Task 1.2) and lazy-loading the ~350–450 KB `recharts` dashboard route (Task 6.1) must leave the entry chunk comfortably under it. Record Task 0.1's pre-change measurement here for the before/after: `______ KB`. Enforced as a CI size check |
| UX exit | `F-UX-001` … `F-UX-013` all closed (001–004 land earlier, in P1) |
| Docs exit | Every claim in `README.md` is true of the artifact `npm run build` produces |

### Sprint 6 — Performance, UX, and docs

#### Task 6.1: Close the four High performance findings

**Description**: `stores/useTransactionStore.ts:163` re-serializes the entire transaction array to
`localStorage` synchronously on every `set()` — roughly 8 s of blocked main thread across a 200-batch
analysis at 5,000 rows. `services/aiService.ts:349`/`:475` place the rate-limit sleep at the end of the loop so
it also fires after the final batch (80 s and 100 s of sleeping respectively). `services/aiService.ts:502`
issues one sequential request per transaction on the Ollama path (~7 min for 500 rows).
`App.tsx:2` eagerly imports all four pages, shipping ~350–450 KB of `recharts` to first-time users who
land on Upload with no data.

**Closes**: `F-PERF-001`, `F-PERF-002`, `F-PERF-003`, `F-PERF-005`

**Acceptance Criteria**:
- [ ] Before optimizing, a Chrome DevTools profile of a 1,000-row categorization is captured and attached — the report's estimates are static, not measured
- [ ] Persisted writes are throttled; a 200-batch analysis performs fewer than 20 `localStorage` writes
- [ ] The rate-limit sleep is guarded on `i > 0`; a 3-batch run sleeps exactly twice, not three times
- [ ] The Ollama path uses a concurrency pool; a 100-row local run completes in under half its previous wall-clock
- [ ] The dashboard route is `React.lazy`-loaded; the entry chunk no longer contains `recharts` and meets the M4 budget
- [ ] `npm test` passes at ≥ the Task 0.4 rate and `npm run build` exits 0

**Dependencies**: 4.2, 5.7

**Effort**: M (3 days)

**Verify**: `npm run build && ls -S dist/assets | head -3` + attached before/after DevTools profiles

#### Task 6.2: Close the remaining Medium and Low performance findings

**Description**: `lib/localStorage.ts:108` scans up to 500 patterns per row with 6 regexes each (2.5 M
comparisons at 5,000 rows); `pages/Dashboard.tsx:273-276` runs four unmemoized full-array scans per render;
`components/TransactionTable.tsx:243` re-filters and re-sorts on every keystroke with no debounce;
`pages/Dashboard.tsx:59` re-arms the health-check timer ~200 times per analysis; `vite.config.ts:17` ships
source maps to production; `pages/Dashboard.tsx:100` spreads the full timestamp array into `Math.max`.

**Closes**: `F-PERF-006`, `F-PERF-007`, `F-PERF-008`, `F-PERF-009`, `F-PERF-010`, `F-PERF-011`

**Acceptance Criteria**:
- [ ] Patterns are indexed by normalized token in a `Map`; a 5,000-row × 500-pattern benchmark completes in under 200 ms
- [ ] The four Dashboard scans collapse into one memoized reduce; the search input is debounced at ~150 ms
- [ ] `sourcemap` is gated on `mode !== 'production'`; `Math.max` spreads are replaced with `reduce`
- [ ] `npm test` passes at ≥ the Task 0.4 rate and `npm run build` exits 0

**Dependencies**: 6.1

**Effort**: M (2 days)

**Verify**: `npm run build && ! ls dist/assets/*.map 2>/dev/null && npm test -- --run`

#### Task 6.3: Close the nine remaining UX findings

**Description**: Mapping screen blames auto-detection even on success (`components/CSVUploader.tsx:341`);
"Verify" and the confidence bar are unexplained (`components/TransactionTable.tsx:479`); two contradictory
`isAIReady` definitions (`components/Layout.tsx:27` vs `components/MonkeySmileChat.tsx:46`); Clear is hidden on mobile
(`components/Layout.tsx:84`); the category dropdown detaches on scroll (`components/TransactionTable.tsx:431`); touch targets
fall under 44 px (`components/TransactionTable.tsx:483`); Settings is an unlabeled icon (`components/Layout.tsx:88`); the
chat FAB appears unannounced (`components/MonkeySmileChat.tsx:175`); the version string is hardcoded
(`components/Layout.tsx:144`).

**Closes**: `F-UX-005`, `F-UX-006`, `F-UX-007`, `F-UX-008`, `F-UX-009`, `F-UX-010`, `F-UX-011`, `F-UX-012`, `F-UX-013`

**Acceptance Criteria**:
- [ ] A single `isAIReady` selector lives in the settings store and is the only definition consumed anywhere
- [ ] All interactive rows in `TransactionTable` are ≥ 44 px tall; Clear is reachable at every breakpoint
- [ ] The category dropdown repositions or closes on scroll; the mapping heading branches on detection success
- [ ] The version string is injected from `package.json` at build time
- [ ] `npm test` passes at ≥ the Task 0.4 rate and `npm run build` exits 0

**Dependencies**: 5.7

**Effort**: M (3 days)

**Verify**: `npm test -- --run components/ pages/` + manual pass at 375 px viewport width

#### Task 6.4: Align documentation with the shipped artifact

**Description**: `README.md:4` claims on-device AI "via WebLLM/Ollama" though WebLLM appears nowhere in
the dependency tree; `:22` says "Styling: Tailwind CSS" implying a build step that Task 1.2 only just
created; `:30` still names EOL Node 20; `:129` states "License: MIT" with no `LICENSE` file present,
and a Contributing section exists with no `CONTRIBUTING.md`.

**Closes**: `F-DOCS-004`, `F-DOCS-005`, `F-DOCS-006`, `F-DOCS-007`

**Acceptance Criteria**:
- [ ] The WebLLM claim is removed; the styling and Node version statements match the post-P2 reality
- [ ] A `LICENSE` file exists matching the stated MIT license; `CONTRIBUTING.md` exists or the section is trimmed
- [ ] Every command in `README.md` is executed from a clean clone and succeeds
- [ ] `npm test` passes at ≥ the Task 0.4 rate and `npm run build` exits 0

**Dependencies**: 6.1, 6.3

**Effort**: S (1 day)

**Verify**: Execute every documented command from a fresh clone

**Delegate**: run `/doc-manager` against the repo, then verify each criterion above independently.

---

## Dependency table

| Task | Depends on | Blocks | Wave |
|---|---|---|---|
| 0.1 | — | 0.2, 0.3 | W0 |
| 0.2 | 0.1 | 0.4, 0.6 | W0 |
| 0.3 | 0.1 | 0.6 | W3 |
| 0.4 | 0.2 | 0.5, 0.6, 0.7 | W0 |
| 0.5 | 0.4 | 2.1, 2.4, 2.5, 2.6, 5.2 | W0 |
| 0.6 | 0.2, 0.3, 0.4 | 1.1, 1.2, 1.4, 1.5, 2.3 | W0 |
| 0.7 | 0.4 | — (binds M3) | W0 |
| 1.1 | 0.6 | 1.6 | W1 |
| 1.2 | 0.6 | 1.3, 3.2 | W1 |
| 1.3 | 1.2 | — | W1 |
| 1.4 | 0.6 | — | W1 |
| 1.5 | 0.6 | 2.7 | W1 |
| 1.6 | 1.1 | 3.1, 3.2, 3.3 | W2 |
| 2.1 | 0.5 | 2.2, 5.2 | W1 |
| 2.2 | 2.1 | — | W1 |
| 2.3 | 0.6 | 2.8, 5.1 | W1 |
| 2.4 | 0.5 | — | W1 |
| 2.5 | 0.5 | — | W1 |
| 2.6 | 0.5 | — | W1 |
| 2.7 | 1.5 | — | W1 |
| 2.8 | 2.3 | — | W1 |
| 3.1 | 1.6 | 4.1, 5.5 | W4 |
| 3.2 | 1.2, 1.6 | 4.1 | W5 |
| 3.3 | 1.6 | 4.1 | W6 |
| 4.1 | 3.1, 3.2, 3.3 | 4.2, 4.3, 4.4 | W7 |
| 4.2 | 4.1 | 5.3, 6.1 | W8 |
| 4.3 | 4.1 | — | W9 |
| 4.4 | 4.1 | — | W10 |
| 5.1 | 2.3 | — | — |
| 5.2 | 0.5, 2.1 | 5.4, 5.6, 5.7 | — |
| 5.3 | 4.2 | — | — |
| 5.4 | 5.2 | — | — |
| 5.5 | 3.1 | — | — |
| 5.6 | 5.2 | 5.7 | — |
| 5.7 | 5.2, 5.6 | 6.1, 6.3 | — |
| 6.1 | 4.2, 5.7 | 6.2, 6.4 | — |
| 6.2 | 6.1 | — | — |
| 6.3 | 5.7 | 6.4 | — |
| 6.4 | 6.1, 6.3 | — | — |

Every referenced task ID exists. Dependencies point only to strictly lower-numbered tasks, so the graph
is acyclic by construction.

## Execution waves

Tasks with no unmet dependencies, grouped by the round they can start in. Everything in a wave can run
in parallel.

| Wave | Tasks |
|---|---|
| 1 | 0.1 |
| 2 | 0.2, 0.3 |
| 3 | 0.4 |
| 4 | 0.5, 0.6, 0.7 |
| 5 | 1.1, 1.2, 1.4, 1.5, 2.1, 2.3, 2.4, 2.5, 2.6 |
| 6 | 1.3, 1.6, 2.2, 2.7, 2.8, 5.1, 5.2 |
| 7 | 3.1, 3.2, 3.3, 5.4, 5.6 |
| 8 | 4.1, 5.5, 5.7 |
| 9 | 4.2, 4.3, 4.4, 6.3 |
| 10 | 5.3, 6.1 |
| 11 | 6.2, 6.4 |

## Milestones

| ID | Phase | Exit condition (measurable) | Verify with |
|---|---|---|---|
| M0 | P0 | Clean clone → `npm ci && npm run build && npm test` all exit 0; CI quality job reports `success` with **zero** `skipped` steps | `gh run list --limit 1` + `gh api repos/luongnv89/money-mind/actions/runs/<id>/jobs --jq '.jobs[].steps[].conclusion'` |
| M1 | P1 | 0 critical and 0 high advisories; no patch/minor gaps remain; all 11 Critical findings closed | `npm audit --package-lock-only --audit-level=high && npm outdated` |
| M2 | P2 | Every major in the report's currency table is current, or listed in **Deferred** below with a written rationale | `npm outdated` — remaining rows must each match a Deferred entry |
| M3 | P3 | Coverage across `lib/` + `services/` ≥ max(60%, Task 0.7 baseline + 20 pp), enforced by a CI threshold gate; no file > 300 lines; no function > 50 lines | `npm run coverage` + `wc -l components/*.tsx pages/*.tsx` |
| M4 | P4 | All 13 UX findings closed; entry bundle within the Task 0.1-bound budget; every README command succeeds from a clean clone | `npm run build && ls -S dist/assets \| head -3` + documented-command walkthrough |

## Deferred and out of scope

| ID | Severity | Why deferred | Revisit when |
|---|---|---|---|
| — | — | Nothing is deferred at plan time. Every Critical and High finding is closed by at least one task above. | — |

Two decisions are deliberately left open **inside** their tasks rather than deferred, because either
branch closes the finding and the choice is the maintainer's:

| Finding | Open choice | Decided in |
|---|---|---|
| `F-BUG-003` | Deploy `api/` as serverless functions, or delete it and require a user key | Task 2.3 |
| `F-BUG-009` | Implement `VITE_`-prefixed env keys, or remove the env-key feature and its dead UI | Task 2.6 |

## Risks

| Risk | Affects | Mitigation |
|---|---|---|
| No test coverage exists at plan start, so the earliest tasks are themselves unverifiable | Tasks 0.1–0.3 | Task 0.4 lands as early as the graph allows; tasks before it assert only the build, and the plan says so explicitly rather than implying suite coverage |
| Refactoring `CSVUploader` and `Dashboard` (Task 5.2) touches code with known defects still in flight | Task 5.2 | 5.2 depends on 0.5 and 2.1, so characterization tests and the date fix both land first; the task forbids changing test assertions |
| Six majors in P2 could individually break the build with no upstream guide retrieved | Tasks 3.1–4.4 | Each task is a single major, ordered by blast radius ascending, and each carries a spike as its first acceptance criterion — no upgrade starts before its migration guide is read |
| Advisory data drifts between audit (2026-08-17) and execution | Task 1.1 | Re-run `npm audit --package-lock-only` immediately before W1 and reconcile against the report's table |
| Task 2.1's date normalization changes stored data shape for existing users | Task 2.1 | Persisted transactions live in `localStorage` under `moneymind-transactions`; add a migration in the zustand `persist` config, and test an upgrade from a pre-fix stored payload |
| Tailwind 3→4 (Task 3.2) is a visual-regression risk with no screenshot baseline | Task 3.2 | The task requires side-by-side screenshots of three screens captured *before* the upgrade begins |
| PERF estimates are static, never profiled | Task 6.1 | 6.1's first acceptance criterion is capturing a real DevTools profile before any optimization |
</content>

---

## Appendix — Recorded baselines

Captured on `origin/main` while executing the tasks below; merged here so the numbers live
alongside the plan they belong to. These are measurements, not plan phases.

### Task 0.1 — Reproducible clean-checkout build

Verified on 2026-08-18 with Node v26.4.0, npm 11.17.0:

```bash
rm -rf node_modules && npm ci && npm run build
```

Exits 0. `tsc` reports no diagnostics: the predicted `process` failure
(F-BUG-016) does not reproduce because `@types/node` is present transitively in
the dependency tree (`vite`, `vitest`, `@google/genai` → `protobufjs`,
`@types/papaparse`) and leaks the `process` global via their type references.
No dependency change was required; `package-lock.json` is unchanged.

### M4 — Performance baseline (bundle budget)

| Metric | Value |
|--------|-------|
| `dist/` total size | 5.6 MB |
| Largest single chunk | `assets/index-DwgV9SQn.js` — 1,059.65 kB (gzip 286.83 kB; map 4,778.75 kB) |

Chunk exceeds Vite's 500 kB warning threshold; code-splitting /
`manualChunks` is future perf work bounded by this baseline.
