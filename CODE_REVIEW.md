# Code Review Report

**Date**: 2026-08-17
**Scope**: Full Audit — `money-mind` @ `9b8d7f8` (main)
**Mode**: Mode 1 (inline fast path — 31 source files < 50 threshold)
**Files Reviewed**: 31 TypeScript/TSX source files + `index.html`, `vite.config.ts`, `tsconfig.json`, `.eslintrc.json`, `.github/workflows/ci.yml`
**Excluded**: `package-lock.json` (generated), `migrated_prompt_history/*.json` (AI transcript dumps), `node_modules/` (absent)
**Subagent coverage**: degraded — reviewed inline sequentially rather than via parallel `file-reviewer` agents.

## Summary

| Severity | Count |
|----------|-------|
| Critical | 6     |
| Major    | 13    |
| Minor    | 11    |
| Info     | 0     |

**Headline:** The application is a browser-only SPA that carries a user-supplied LLM API key. Two
classes of defect dominate: (1) **every analytics surface silently assumes ISO-8601 dates** while the
CSV parser stores whatever string the bank supplied, so scores, alerts, charts and the AI chat context
quietly compute on empty data for most real bank exports; and (2) **the `/api` serverless proxy the
client depends on is never built or deployed**, so the advertised keyless demo path always fails.
Demo mode is the only path that emits ISO dates, which is why the date defect has gone unnoticed.

---

## Critical Issues

### [Correctness / Data Integrity]: Analytics silently assume ISO-8601 dates; real bank CSVs compute on empty sets
**Files**: `services/scoreService.ts:37`, `services/scoreService.ts:39`, `components/MonkeySmileChat.tsx:68`, `components/MonkeySmileChat.tsx:70`, `services/alertService.ts:73`, `services/alertService.ts:79`, `components/InsightsDashboard.tsx:130`, `components/InsightsDashboard.tsx:220`
**Smell**: Primitive Obsession / Implicit contract

`lib/csvParser.ts:228` stores the raw bank string verbatim (`date: String(date)`). Every downstream
consumer then derives a month key by fixed-offset string slicing and matches with `startsWith`:

**Before** (`services/scoreService.ts:36-40`):
```typescript
const latestDate = new Date(sortedTx[sortedTx.length - 1].date);
const currentMonthKey = latestDate.toISOString().substring(0, 7); // YYYY-MM

const currentMonthTx = expenses.filter(t => t.date.startsWith(currentMonthKey));
const historyTx = expenses.filter(t => !t.date.startsWith(currentMonthKey));
```

For a Chase/AmEx export dated `03/27/2026`, `currentMonthKey` is `"2026-03"` but `t.date` is
`"03/27/2026"` — `startsWith` never matches. `currentMonthTx` is empty, `totalCurrentSpend` is `0`,
and the guard at `services/scoreService.ts:56` skips every metric. The user is shown a financial grade computed
from nothing. `components/InsightsDashboard.tsx:221` makes the assumption explicit and silent:

```typescript
const m = t.date.substring(0, 7);
if (m.length === 7 && m.includes('-')) {   // non-ISO rows silently dropped
```

`lib/demoData.ts:22` emits `date.toISOString().split('T')[0]` — ISO — so demo mode always works and
masks the defect.

**Suggested Fix**: Normalize once at the parser boundary and make the type enforce it.
```typescript
// lib/csvParser.ts — parse to a canonical ISO date at ingest, reject rows that cannot be parsed
const toIsoDate = (raw: unknown, dayFirst: boolean): string | null => {
  const d = parseBankDate(String(raw), dayFirst); // explicit, format-aware
  return d ? d.toISOString().slice(0, 10) : null;
};
// then: Transaction.date is documented and validated as 'YYYY-MM-DD'
```
Add a mapping-screen control for day-first vs month-first, and surface a count of unparseable rows
instead of dropping them.

---

### [Correctness]: Citi statements are parsed to zero transactions and silently discarded
**Files**: `constants.ts:31`, `lib/csvParser.ts:220`, `lib/csvParser.ts:237`
**Smell**: Speculative Generality / Dead contract

`constants.ts:31` declares Citi with an empty `amountCol` and defers to a parser that never
implements the split-column case:

**Before**:
```typescript
// constants.ts:31
{ name: 'Citi', dateCol: 'Date', descCol: 'Description', amountCol: '', debitCreditCols: true }, // Logic handled in parser
```
`debitCreditCols` is read in exactly one place — `lib/csvParser.ts:252`, purely to relax the header check —
and nowhere is a debit/credit pair ever combined. `parseCSVWithMapping` then does
`parseAmount(row[''])` → `NaN` → coerced to `0` at `lib/csvParser.ts:230`, and `lib/csvParser.ts:237` filters
`t.amount !== 0`, deleting every row. The user sees "Citi" advertised as supported at
`components/CSVUploader.tsx:686` and gets an empty import with no error.

**Suggested Fix**: Either implement the split-column path or stop advertising the format.
```typescript
// csvParser.ts — honour split debit/credit columns
const amount = mapping.debitCol && mapping.creditCol
  ? parseAmount(row[mapping.creditCol]) - parseAmount(row[mapping.debitCol])
  : parseAmount(row[mapping.amountCol]);
```

---

### [Correctness]: Client depends on `/api/chat`, which the build never produces
**Files**: `services/aiService.ts:26`, `services/aiService.ts:146`, `package.json:7`, `api/chat.ts:4`
**Smell**: Broken Window / Architecture drift

`npm run build` is `tsc && vite build` — a static SPA emitted to `dist/`. Nothing compiles or deploys
`api/*.ts`; there is no `vercel.json`, no `@vercel/node` dependency, and no serverless adapter.
Yet the keyless path fetches that endpoint:

**Before** (`services/aiService.ts:146`):
```typescript
if (!apiKey) {
    const response = await fetch('/api/chat', { ... });   // 404 on any static host
```
On a static deploy this returns the SPA's `index.html` with a 200 (SPA rewrite) or a 404, so
`response.json()` throws and the user gets "Failed to connect to demo server". `README.md:20` and
`README.md:88` advertise the proxy as a shipped feature.

Additionally, `api/categorize.ts` is referenced by **no** source file — it is entirely dead, and its
own header comment concedes it exists "to satisfy the architectural requirement of the prompt".

**Suggested Fix**: Pick one. Either add the deployment target so the functions actually ship —
```jsonc
// vercel.json
{ "functions": { "api/*.ts": { "runtime": "@vercel/node@5" } } }
```
— or delete `api/`, remove the `/api/chat` fallback branches, and require a user-supplied key.

---

### [Security]: Third-party CDN script executes with full privileges on a financial-data page
**File**: `index.html:8`
**Smell**: Supply-chain exposure

```html
<script src="https://cdn.tailwindcss.com"></script>
```
The Tailwind Play CDN is a JIT compiler that runs unpinned, unversioned, and without Subresource
Integrity, on a page that holds parsed bank statements in memory and a decoded LLM API key in
`localStorage`. Any compromise of that origin yields full script execution against that data. Tailwind
documents this build explicitly as development-only. There is no CSP anywhere in the app to constrain it.

Note the project already ships `tailwindcss`, `postcss` and `autoprefixer` as devDependencies — but
there is **no** `tailwind.config.js`, **no** `postcss.config.js` and **no** CSS file in the repo, so
the intended build path was never wired up.

**Suggested Fix**: Compile Tailwind locally and drop the CDN tag.
```bash
# add tailwind.config.js + postcss.config.js, create src/index.css with @tailwind directives,
# import it from index.tsx, then remove the <script src="https://cdn.tailwindcss.com"> line
```
Then add a CSP `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; connect-src 'self' https://generativelanguage.googleapis.com https://api.groq.com">`.

---

### [Security]: Critical RCE advisory in transitive `protobufjs` reachable from the shipped bundle
**File**: `package.json:12` (`@google/genai` → `protobufjs`)
**Smell**: Unpatched dependency

`npm audit --package-lock-only` reports **1 critical, 6 high** advisories. `protobufjs <=7.6.4` carries
GHSA-xq3m-2v4x-88gg (arbitrary code execution) plus prototype-pollution and DoS chains, pulled in via
`@google/genai@1.46.0`. `vite <=6.4.2` (GHSA-p9ff-h696-f583, arbitrary file read via dev-server
WebSocket) and `postcss <=8.5.22` are direct dependencies. All have fixes available.

**Suggested Fix**: Ship the security patch wave first, verified independently of feature upgrades:
```bash
npm audit fix          # then re-run: npm audit --package-lock-only --json | jq .metadata.vulnerabilities
```
`@google/genai` needs a major bump (1.46.0 → 2.17.1) to clear the transitive pin — schedule it as its
own change, not batched.

---

### [Security]: Base64 obfuscation is presented to users as encryption
**Files**: `stores/useSettingsStore.ts:22`, `stores/useSettingsStore.ts:26`, `pages/Settings.tsx:296`, `pages/Upload.tsx:38`, `pages/Upload.tsx:78`, `README.md:8`
**Smell**: Misleading abstraction

**Before** (`stores/useSettingsStore.ts:21-27`):
```typescript
// Simple obfuscation to prevent plain-text read in local storage (not military grade encryption)
const encrypt = (text: string) => { try { return btoa(text); } catch(_e) { return text; } };
const decrypt = (text: string) => { try { return atob(text); } catch(_e) { return text; } };
```
The implementation comment is honest; every user-facing string is not. `pages/Upload.tsx:78` renders a
padlock icon beside **"Secure & Encrypted — API keys are encrypted in LocalStorage"**, and
`pages/Settings.tsx:296` states **"Your key is encrypted and stored locally."** `btoa` is a reversible
encoding with no key; any script on the origin — including the unpinned CDN above — reads it with one
`atob` call. For a product whose core pitch is privacy, this is a material misrepresentation.

**Suggested Fix**: Rename the functions to what they do and correct every user-facing claim.
```typescript
const obfuscate = (text: string) => { try { return btoa(text); } catch { return text; } };
const deobfuscate = (text: string) => { try { return atob(text); } catch { return text; } };
```
UI copy: *"Your key is stored in this browser's local storage and never sent to our servers."* If real
at-rest protection is wanted, derive a key from a user passphrase via WebCrypto `PBKDF2` + `AES-GCM`.

---

## Major Issues

### [Correctness]: Cleanup effect resets the uploader on every state transition, not on unmount
**File**: `components/CSVUploader.tsx:152`
**Smell**: Misused lifecycle

```typescript
useEffect(() => {
    return () => { if (state !== 'idle') reset(); };
}, [state, reset]);
```
The comment says *"Reset when component mounts or unmounts"*, but because `state` is a dependency,
React runs the cleanup on **every** `state` change, closing over the *previous* state. The
`mapping → processing` transition therefore fires `reset()` with `state === 'mapping'`, clearing
`file`, `headers` and `mapping` mid-flow. Use an empty dependency array and a ref if unmount-only
behaviour is intended.

### [Correctness / Data Loss]: Stale closure drops categorization results across batches
**File**: `pages/Dashboard.tsx:166`
**Smell**: Stale closure

Within the same callback, line 152 correctly reads fresh state
(`useTransactionStore.getState().transactions`) but line 166 reads the render-time closure:
```typescript
const updates = results.map(res => {
    const original = transactions.find(t => t.id === res.id);   // stale snapshot
```
`categorizeWithAI` invokes this callback once per batch (`services/aiService.ts:285`, `BATCH_SIZE = 25`), so
from batch 2 onward every update is rebuilt from the pre-analysis snapshot and written back via
`updateTransactionBatch`, discarding batch 1's results. Read from `getState()` here as well.

### [Correctness]: `getCSVHeaders` can never settle, hanging the UI on "Analyzing file…"
**File**: `lib/csvParser.ts:138`
**Smell**: Missing error path

In `complete`, if `results.meta.fields` is absent, `results.data` is empty **and** `results.errors` is
empty, neither `resolve` nor `reject` is called. The returned promise never settles, so
`components/CSVUploader.tsx:175` awaits forever and the dropzone stays in its spinner state with no error. Add a
terminal `reject(new Error("Empty or unreadable CSV"))`. (`step` and `complete` can also both resolve —
harmless, but the double-settle should be removed.)

### [Correctness / Data Loss]: Import silently discards rows with no user feedback
**File**: `lib/csvParser.ts:237`
**Smell**: Silent failure

```typescript
.filter(t => t.description !== 'Unknown' && t.amount !== 0);
```
Two distinct classes are dropped without a count or warning: rows whose description column was empty
(defaulted to `'Unknown'` at line 229) and every genuinely zero-amount row — plus, because
`lib/csvParser.ts:230` coerces `NaN` to `0`, every row whose amount failed to parse. A user importing a
statement with a mis-mapped amount column sees "Import 0 Transactions" and no explanation. Return the
rejected rows and surface the count in the preview screen.

### [Robustness]: Unguarded `JSON.parse` of localStorage crashes the Settings page
**File**: `lib/localStorage.ts:8`
**Smell**: Missing error handling

```typescript
const stored = localStorage.getItem(STORAGE_KEY);
return stored ? JSON.parse(stored) : [];
```
`getPatterns()` is called during render at `pages/Settings.tsx:24` and `pages/Dashboard.tsx:84`. Any
corrupt or truncated `financePatterns` value throws inside render and blanks the app with no recovery
path. Wrap in `try/catch`, return `[]`, and validate the parsed value is an array.

### [Correctness]: Env-key detection can never succeed, disabling the entire usage-budget feature
**Files**: `stores/useSettingsStore.ts:33`, `vite.config.ts:10`, `pages/Settings.tsx:117`
**Smell**: Dead feature

`vite.config.ts:10` replaces `process.env` with an empty object at build time:
```typescript
define: { 'process.env': {} }
```
so `getEnvGeminiApiKey()` (`stores/useSettingsStore.ts:33`) always returns `''`. Consequently
`isUsingEnvKey` (`pages/Settings.tsx:34`) is permanently `false`, and the "Usage Budget" card
(`pages/Settings.tsx:117`), the "Testing Mode" banner (`pages/Settings.tsx:260`) and the forced-model effect
(`pages/Settings.tsx:38`) are unreachable. The `GEMINI_API_KEY` documented in `README.md:55` and
`.env.example:2` has no effect on the client — Vite only exposes `VITE_`-prefixed variables via
`import.meta.env`.

### [Safety]: Irreversible pattern deletion has no confirmation, though a dialog component exists
**File**: `pages/Settings.tsx:44`
**Smell**: Removed safeguard

```typescript
const handleClearPatterns = () => {
    // Removed confirm()
    clearPatterns();
```
"Clear All Patterns" permanently deletes all learned categorization data — the app's only accumulated
user value — on a single click. `components/ConfirmDialog.tsx` already exists and is wired up for the
far less destructive single-transaction delete at `components/TransactionTable.tsx:346`. Use it here.

### [Correctness]: Chat context labelled "Last 5" sends the first 5
**File**: `components/MonkeySmileChat.tsx:107`
**Smell**: Name/behaviour mismatch

```typescript
RECENT TRANSACTIONS (Last 5):
${monthlyTx.slice(0, 5).map(...)}
```
`monthlyTx` is in original import order, so `slice(0, 5)` yields the **oldest** five. The LLM is told
they are the most recent and answers accordingly. Sort by date descending before slicing.

### [Correctness]: `.xlsx` files are accepted but cannot be parsed
**File**: `components/CSVUploader.tsx:656`
**Smell**: Overstated capability

```html
accept=".csv,.xlsx"
```
PapaParse handles delimited text only; there is no XLSX reader in the dependency tree. Selecting a
spreadsheet feeds binary ZIP content to the delimiter heuristic and produces garbage rows or an opaque
failure. The helper text one line below at `components/CSVUploader.tsx:674` correctly says "Supports .csv".
Restrict `accept` to `.csv`.

### [Correctness]: "Monthly Performance" ignores the dashboard's time filter
**Files**: `components/InsightsDashboard.tsx:103`, `pages/Dashboard.tsx:571`
**Smell**: Dead parameter

```typescript
export const MonthlyPerformance: React.FC<InsightsDashboardProps> = ({ transactions: _transactions, allTransactions }) => {
```
`pages/Dashboard.tsx:571` passes `displayedTransactions`, but the component discards it and computes from
`allTransactions`. Switching Week/Month/All Time visibly changes the other two cards and not this one.
Either honour the filter or stop accepting the prop and label the card "All History".

### [Correctness]: `hasPatterns` never recomputes, hiding the "Apply Rules" action
**File**: `pages/Dashboard.tsx:83`
**Smell**: Comment contradicts code

```typescript
const hasPatterns = useMemo(() => {
    return getPatterns().length > 0;
}, []); // Re-check when transactions change (implies potential learning)
```
The dependency array is empty, so the comment's stated intent never happens. A user who corrects their
first transaction — creating the first pattern — will not see the "Apply Rules" button
(`pages/Dashboard.tsx:354`) until a full remount.

### [Correctness]: `isAIConfigured` does not react to key changes
**File**: `pages/Dashboard.tsx:75`
**Smell**: Incomplete dependency array

`getDecryptedApiKey(useSettingsStore.getState())` is read inside a `useMemo` keyed only on
`[aiMode, isDemoMode]`. After a user saves a key in Settings and returns, the dashboard still shows
"Config AI" and routes the Analyze button back to Settings. Subscribe to `geminiConfig`/`groqConfig`
instead of reading `getState()`.

### [Correctness]: Bidirectional substring matching over-applies learned patterns
**File**: `lib/localStorage.ts:113`
**Smell**: Over-broad heuristic

```typescript
const match = patterns.find((p) => merchant.includes(p.keyword) || p.keyword.includes(merchant));
```
`extractMerchantName` strips digits and truncates to 20 characters, so a short residual keyword such
as `"UBER"` matches both `"UBER EATS"` and `"UBER TRIP"` — categorizing meals as transport or vice
versa — and the reversed test makes any short new merchant match a longer stored keyword. Require a
prefix/whole-token match with a minimum keyword length, and prefer the longest match rather than the
first (`find` returns insertion order).

---

## Minor Issues

### [Dead Code]: `api/categorize.ts` is referenced by nothing
**File**: `api/categorize.ts:9` — 67 lines duplicating the categorization prompt already in
`services/aiService.ts:288`. No caller anywhere in the repo.

### [Dead Code]: Import map contradicts `package.json` and is inert after bundling
**File**: `index.html:45` — pins `vite@^7.3.0` and `@vitejs/plugin-react@^5.1.2` against
`package.json:38` (`vite ^6.2.0`) and `package.json:30` (`^4.3.4`), plus nine runtime packages Vite
already bundles. Leftover AI-Studio scaffolding; delete it.

### [Dead Code]: `MAX_TRANSACTIONS` is exported and never used
**File**: `constants.ts:35` — no importer. Either enforce the cap in `parseCSVWithMapping` or remove it.

### [Dead Code]: `Alert.id` is computed and discarded
**File**: `services/alertService.ts:111` — `id: \`drift-${cat}-${currentMonthKey}\`` is built for every
alert but `pages/Dashboard.tsx:67` forwards only `message` and `type`. It looks like it was meant to
deduplicate repeat alerts; it does not.

### [Maintainability]: Alert "priority" is message length
**File**: `services/alertService.ts:119`
```typescript
return alerts.sort((a, b) => b.message.length - a.message.length).slice(0, 2);
```
The comment promises "top 2 priority alerts"; the sort key is the number of characters in a randomly
chosen quip. Rank by drift percentage.

### [Resource Leak]: Toast timers are never cancelled
**File**: `stores/useToastStore.ts:23` — `setTimeout` is registered outside React's lifecycle and never
cleared, so a dismissed toast still fires a store write later. Harmless today; store the handle and
clear it in `removeToast`.

### [Correctness]: CSV export serialises the raw row object
**File**: `components/TransactionTable.tsx:317` — `Papa.unparse` receives each transaction with its
`raw: Record<string, unknown>` field intact, emitting a `[object Object]` column. Strip `raw` and
`index` alongside `id` and `isLearned`.

### [Performance]: Spread-based `Math.max` over unbounded arrays
**File**: `pages/Dashboard.tsx:100`, `pages/Dashboard.tsx:125` — `Math.max(...timestamps)` passes one
argument per transaction; at tens of thousands of rows this throws `RangeError: too many arguments`.
Use a reduce.

### [Broken Window]: Debug logging left in shipped code
**Files**: `services/aiService.ts:275`, `services/aiService.ts:332`, `services/aiService.ts:440`,
`services/aiService.ts:457`, `services/aiService.ts:525`, `components/CSVUploader.tsx:218`,
`api/chat.ts:44` — eight `console.*` calls, several logging full AI error payloads on a page holding
financial data. Route through a logger gated on `import.meta.env.DEV`.

### [Maintainability]: Inconsistent indentation mid-function
**File**: `services/scoreService.ts:38` — the function opens at 2-space indentation and switches to
4-space from line 39 to the end. `.prettierrc` is a **0-byte file** and `prettier` is not in
`devDependencies`, so nothing enforces formatting.

### [Maintainability]: `calculateFinancialScore` is a 164-line function with 4 responsibilities
**File**: `services/scoreService.ts:20`
**Smell**: Long Method — validation, timeframe setup, four scoring metrics, and grade banding in one
body with no unit tests. Extract one function per metric so each becomes independently testable.

---

## Recommendations

1. **Normalize dates at the parser boundary before anything else.** The single change at
   `lib/csvParser.ts:228` fixes the score card, the alert service, both charts and the AI chat
   context at once. Nothing else in the analytics layer is trustworthy until it lands.
2. **Decide whether `api/` ships.** Either add a serverless deployment target or delete the directory
   and the two `/api/chat` fallback branches. The current half-state means the advertised no-key demo
   is guaranteed to fail in production.
3. **Correct the encryption claims immediately.** This is a one-hour copy change across four files
   and is the highest-risk item from a user-trust standpoint.
4. **Replace the Tailwind Play CDN with a local build** and add a CSP. The devDependencies for this
   are already installed; only the config files and a stylesheet are missing.
5. **Ship the security patch wave** (`protobufjs`, `vite`, `postcss`, `nanoid`, `ws`, `js-yaml`,
   `brace-expansion`) as its own verified change before any feature upgrade.
6. **There is no test suite.** Every fix above is unverifiable and every refactor is unguarded. The
   pure functions — `parseAmount`, `autoDetectMapping`, `calculateFinancialScore`,
   `extractMerchantName`, `applyPatterns` — are trivially testable and are exactly where the
   correctness defects cluster. Start there.
</content>
</invoke>
