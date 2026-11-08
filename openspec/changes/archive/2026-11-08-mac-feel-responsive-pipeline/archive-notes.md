# Archive notes — mac-feel-responsive-pipeline

Archived: 2026-11-08. Published version: 1.7.1.

## Verified evidence

- Release: https://github.com/itshak/gigaboard/releases/tag/v1.7.1
- CI lint, typecheck, Node/Bun tests and package inspection: https://github.com/itshak/gigaboard/actions/runs/42434630442
- Chromium and macOS-hosted Playwright WebKit correctness (NOT native WKWebView): https://github.com/itshak/gigaboard/actions/runs/42434630356
- Bundle-size and performance regression workflows passed: 42434630452, 42434630525.
- npm publish and registry-version verification succeeded: https://github.com/itshak/gigaboard/actions/runs/42434630447

## Accessibility/performance and carryover

Geometry caching is opt-in (off by default), retaining the uncached control. The pointer-follow hot path avoids repeated geometry reads when enabled and changes only old/new floating-piece slots. Keyboard move entry, promotion and speech behavior are unchanged by design. This is NOT measured native input-to-photon latency.

BlindBase native macOS WKWebView user feel, VoiceOver, resize/scroll/gesture acceptance and audio persistence remain outstanding. iOS/iPadOS hardware is UNTESTED. The larger automated-board-feel-lab OpenSpec change remains ACTIVE and must not be archived.
