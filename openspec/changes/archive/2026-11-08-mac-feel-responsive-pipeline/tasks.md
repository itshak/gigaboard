# Tasks: responsive drag pipeline for GigaBoard 1.7.1

- [x] Record user observations and define conservative, reversible A/B scope.
- [x] Implement two-slot drag-ghost opacity updates (previous/new only).
- [x] Implement opt-in cache for pointer transform geometry with invalidation.
- [x] Thread option through published Chessboard props and FeelLab fixture.
- [x] Add unit tests for repeated piece selection and re-grab.
- [x] Add tests for scroll invalidation and uncached baseline comparison; browser resize still pending.
- [x] Add real Playwright 120ms/0ms + 2px/4px + cache on/off correctness runs.
- [x] Add macOS-hosted WebKit CI for supported browser scenarios; await successful run.
- [x] Complete CI for lint, typecheck, build, unit, size and browser correctness (CI run 42434630442; FeelLab run 42434630356; size run 42434630452).
- [x] Release only when checks pass; publish and registry-verify npm 1.7.1 (run 42434630447: npm publish and Verify published versions on registry both succeeded).
- [x] Mark native macOS WKWebView and iOS device response UNTESTED; user
      perception testing follows after BlindBase dependency upgrade.

Archived 2026-11-08 after published 1.7.1 and passing CI. Native macOS WKWebView, iOS hardware and subjective BlindBase acceptance remain unverified.
