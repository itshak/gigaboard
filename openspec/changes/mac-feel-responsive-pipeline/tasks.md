# Tasks: responsive drag pipeline for GigaBoard 1.7.1

- [x] Record user observations and define conservative, reversible A/B scope.
- [x] Implement two-slot drag-ghost opacity updates (previous/new only).
- [x] Implement opt-in cache for pointer transform geometry with invalidation.
- [x] Thread option through published Chessboard props and FeelLab fixture.
- [ ] Add unit tests for repeated piece selection and re-grab.
- [ ] Add tests for scroll/resize invalidation and baseline comparison.
- [ ] Add real Playwright 120ms/0ms + 2px/4px + cache on/off correctness runs.
- [ ] Add macOS-hosted WebKit CI for supported browser scenarios.
- [ ] Complete CI for lint, typecheck, build, unit, size and browser correctness.
- [ ] Release only when checks pass; publish and registry-verify npm 1.7.1.
- [ ] Mark native macOS WKWebView and iOS device response UNTESTED; user
      perception testing follows after BlindBase dependency upgrade.

This change remains active while CI or publication is pending.
