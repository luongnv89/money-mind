# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-08-22

This is the first tagged release of MoneyMind, a client-side React 19 + TypeScript + Vite
app that categorizes bank CSV transactions with LLMs (Gemini, Groq, Ollama). It collects
the project's full history to date: the initial feature set, a security hardening pass,
a toolchain and dependency modernization wave, and a round of correctness and
performance fixes.

### Added

- Initial MoneyMind app: CSV import, AI-assisted transaction categorization, dashboard, and data modeling.
- Groq AI provider mode with transaction approval and learned-pattern application logic.
- MonkeySmile AI financial assistant, with AI readiness detection and display improvements.
- Demo mode with transaction deletion, usage limits, and demo-mode reset, toggleable in settings.
- Dynamic AI provider model lists resolved per provider instead of hardcoded (#81).
- Local quality gates (Prettier, Vitest, pre-commit hooks) plus a reproducible clean-checkout build baseline and Node 24 pinning in CI (#43, #44).
- Coverage tooling, characterization tests for pure-logic hotspots, and a 93.9% line coverage gate on `lib/` and `services/` (#45, #46, #75).

### Changed

- Modernized the toolchain: Tailwind CSS 3.4 to 4.3 with a CSS-first config from a local PostCSS build replacing the CDN (#49, #64), ESLint 10 flat config (#63), TypeScript 5 to 7 (#67), and Vite 6 to 8 with @vitejs/plugin-react 4 to 6 (#66).
- Upgraded dependencies: @google/genai v1 to v2 (#65), lucide-react 0.560 to 1.33 (#69), uuid v14 (#68), plus a wave of patch and minor upgrades (#58).
- Decomposed the largest modules (CSVUploader, Dashboard, scoreService) into focused units (#71) and removed dead code and committed cruft (#70).
- Gated production logging behind a DEV-only logger (#74).
- Indexed pattern matching, debounced search, and closed UX findings (#77); optimized persistence, batching, and route loading (#76).
- Reconciled README and docs with the shipped app, covering the in-app API key flow (#62, #78, #80).

### Fixed

- Corrected six medium dashboard correctness defects (#73) and ranked financial alerts by drift percentage (#72).
- CSV parser: combined Citi split debit/credit columns into signed amounts (#59), normalized transaction dates at the parser boundary (#53), and made unparseable rows fail loudly instead of silently dropping (#55).
- Stopped uploader mid-flow resets and stale analysis batch closure (#60); guarded localStorage reads and resolved the usage-reset dead end (#61).
- Destructive data-clearing actions now require confirmation (#52).

### Security

- Added a Content Security Policy and security headers (#57).
- Patched known-vulnerable dependencies (#48) and enforce `npm audit` as a hard CI gate (#11).
- Removed the dead `/api` proxy; AI calls now require a user-supplied API key (#54).
- Stopped describing stored API keys as "encrypted" — they are obfuscated only (#50).

[1.0.0]: https://github.com/luongnv89/money-mind/releases/tag/v1.0.0
