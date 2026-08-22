# Troubleshooting

Log of real issues diagnosed and resolved while validating the documented setup/deploy runbooks. Only actually-encountered findings belong here.

## README deployment asked for SPA rewrite rules the app does not need

- **Cause:** boilerplate SPA advice — the app has no client-side router; navigation is a `View` state union (`App.tsx:15`), so there are no deep links for a host to rewrite.
- **Fix:** README "Deployment" now states no rewrite rules are needed and that `vercel.json` declares none; `scripts/validate-dev-setup.sh` asserts the static-SPA invariants (`no api/ dir`, `vercel.json` has no `functions`/`builds`) instead of checking for rewrites.
- **Seen during:** `scripts/validate-dev-setup.sh` design pass (doc-manager runbook add-on, 2026-08-22).
