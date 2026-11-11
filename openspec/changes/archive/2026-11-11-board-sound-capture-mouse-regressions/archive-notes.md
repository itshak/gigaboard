# Archive notes — board-sound-capture-mouse-regressions

Archived: 2026-11-11, after source-level fix and browser verification.
Target package release: next patch after 1.7.2 (release process follows merge).

## Root cause and fix

The controlled-position sound effect treated an already-applied model FEN as a sound-confirming transition only when `managedArrows === undefined`. BlindBase passes a managed-arrow array on every board, including an empty array, so the already-applied mouse move could be silently bypassed. GigaBoard now recognizes host confirmation independently of arrow presence and preserves semantic animation descriptors before arrow syncing. This also prevents a capture from being reported as a normal move when the sync overwrites animation descriptors. Local capture-promotions now identify the non-null captured target and honor `san-priority`.

## Automated verification (all passing on implementation SHA 4d2426b0)

- Full CI (lint, typecheck, Bun/Node unit tests, package inspection): https://github.com/itshak/gigaboard/actions/runs/43021762684
- Production-build Playwright FeelLab: **99 tests passed** across Chromium and WebKit, including **26 new confirmed-sound browser scenarios** with real pointer drag, click and keyboard focus/navigation, arrows absent/empty/populated, capture, en passant, promotion capture, check capture, host rejection, settings gating and deduplication: https://github.com/itshak/gigaboard/actions/runs/43021762709
- The same workflow's separate macOS-hosted WebKit (NOT native WKWebView) pointer, drag and sound semantics job passed.
- Visual regression: https://github.com/itshak/gigaboard/actions/runs/43021762786
- Bundle size: https://github.com/itshak/gigaboard/actions/runs/43021762725
- Performance benchmark job: see PR check status; do not claim it passed until its independent workflow completes.

## Boundaries and follow-ups

These tests verify GigaBoard's semantic `onCue` callback in real browsers, not physical sound from speakers. BlindBase remains the owner of audio assets, theme mapping, native WKWebView and shared Web Audio. The native macOS BlindBase capture/mouse audibility, output-device interruptions and idle resilience were **NOT tested by this library change**. Those remain the consumer's separate acceptance workflow. No second HTMLAudio audio backend or persistent keepalive was added. The test fixture lives only under `apps/benchmarks`, not the npm package.

After merge, cut the GigaBoard patch through release-please, verify npm registry version and integrity, and integrate the exact new package in BlindBase. Archive status must not be conflated with npm publication.
