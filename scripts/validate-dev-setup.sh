#!/usr/bin/env bash
# Validates: README.md "Setup & Installation" + "Deployment" sections and the
# CONTRIBUTING.md "Setup" section. Check-only by default: verifies preconditions
# and asserts expected state; every mutating/outward-facing step is gated.
# Usage: validate-dev-setup.sh [--check] [--run-destructive]
set -uo pipefail

MODE="check"
for arg in "$@"; do
  case "$arg" in
    --check) ;;
    --run-destructive) MODE="destructive" ;;
    -h|--help)
      printf 'Usage: %s [--check] [--run-destructive]\n' "${0##*/}"
      exit 0
      ;;
    *)
      printf 'Unknown option: %s\n' "$arg" >&2
      printf 'Usage: %s [--check] [--run-destructive]\n' "${0##*/}" >&2
      exit 2
      ;;
  esac
done

cd "$(dirname "$0")/.."

fail=0
ok()   { printf '[CHECK] %-38s OK\n' "$1"; }
bad()  { printf '[CHECK] %-38s FAIL — %s\n' "$1" "$2"; fail=1; }
man()  { printf '[MANUAL] %-37s SKIPPED (run by operator)\n' "$1"; }

# --- README "Prerequisites": Node.js 24+ and npm ---
command -v node >/dev/null && ok "node installed" || bad "node installed" "not on PATH"
command -v npm  >/dev/null && ok "npm installed"  || bad "npm installed" "not on PATH"
if command -v node >/dev/null && [ -f .nvmrc ]; then
  expected_major="$(tr -d '[:space:]' < .nvmrc | cut -d. -f1)"
  actual_major="$(node -p 'process.versions.node.split(".")[0]')"
  if [ "$expected_major" = "" ]; then
    bad "node version floor readable" ".nvmrc is empty or malformed"
  elif [ "$actual_major" -ge "$expected_major" ] 2>/dev/null; then
    ok "node >= ${expected_major} (running $(node -p process.versions.node))"
  else
    bad "node >= ${expected_major}" "running major is ${actual_major}"
  fi
fi

# --- README "Local Development" step 2: install dependencies ---
[ -d node_modules ] && ok "dependencies installed (node_modules/)" \
  || bad "dependencies installed (node_modules/)" "run: npm install"

# --- README "Manual Commands": every documented script exists (pinned by repo-config.test.ts:13) ---
for s in dev build preview lint typecheck format format:check test test:watch coverage; do
  node -e "require('./package.json').scripts['$s']" >/dev/null 2>&1 \
    && ok "script '$s' declared" \
    || bad "script '$s' declared" "missing from package.json scripts"
done

# --- README "Local Development" step 4: dev server on port 3000 ---
grep -q "port: 3000" vite.config.ts \
  && ok "dev port 3000 (vite.config.ts)" \
  || bad "dev port 3000 (vite.config.ts)" "port not set to 3000"

# --- README "Deployment" note: static SPA, no serverless functions ---
[ ! -d api ] && ok "no api/ dir (static SPA)" \
  || bad "no api/ dir (static SPA)" "api/ exists but README says it was removed"
node -e "const v=require('./vercel.json'); if (JSON.stringify(v).match(/functions|builds/)) process.exit(1)" 2>/dev/null \
  && ok "vercel.json declares no functions/builds" \
  || bad "vercel.json declares no functions/builds" "unexpected serverless config"
grep -q 'http-equiv="Content-Security-Policy"' index.html \
  && ok "CSP meta present in index.html" \
  || bad "CSP meta present in index.html" "meta tag missing"
grep -q "importmap" index.html \
  && bad "no esm.sh importmap (issue #32)" "importmap present in index.html" \
  || ok "no esm.sh importmap (issue #32)"

# --- README "Tech Stack": Tailwind v4 local PostCSS build, no CDN ---
grep -q "@tailwindcss/postcss" postcss.config.js \
  && ok "postcss uses @tailwindcss/postcss" \
  || bad "postcss uses @tailwindcss/postcss" "postcss.config.js misconfigured"
head -1 src/index.css | grep -q "tailwindcss" \
  && ok "src/index.css imports tailwindcss" \
  || bad "src/index.css imports tailwindcss" "missing @import 'tailwindcss'"
grep -Eq "cdn\.tailwindcss|esm\.sh/tailwind" index.html \
  && bad "no Tailwind CDN" "CDN reference found in index.html" \
  || ok "no Tailwind CDN"

# --- CONTRIBUTING "Quality gates": Vitest setup file present and wired ---
[ -f tests/setup.ts ] && ok "tests/setup.ts exists" \
  || bad "tests/setup.ts exists" "file missing"
grep -q "tests/setup.ts" vite.config.ts \
  && ok "vite.config.ts loads tests/setup.ts" \
  || bad "vite.config.ts loads tests/setup.ts" "setupFiles entry missing"

# --- README "Deployment" step 1: production build (writes gitignored dist/, gated) ---
if [ "$MODE" = "destructive" ]; then
  echo "[RUN] npm run build…"
  npm run build && ok "production build succeeds" || bad "production build succeeds" "npm run build failed"
else
  man "npm run build (writes dist/; rerun with --run-destructive)"
fi

# --- README "Deployment" step 2 + Vercel section: operator actions ---
man "deploy dist/ to static host (README Deployment step 2)"
man "Vercel: connect repo, enter keys in-app Settings (README Vercel section)"

exit $fail
