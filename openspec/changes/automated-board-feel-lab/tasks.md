# Implementation Tasks: Automated Board FeelLab

Each task is intended to be independently reviewable and completable in one coding session. Deliver measurement infrastructure before changing shipped board behavior.

## 1. Inventory and baseline contract

- [ ] 1.1 Audit `apps/benchmarks`, `BENCH.md`, current GigaBoard drag/click/animation/sound hooks, current tests, and existing OpenSpec ADRs. Record what timings are genuine vs synthetic, and preserve existing benchmark suite results.
- [ ] 1.2 Define a versioned FeelLab scenario schema (FEN/UCI, input trace, expected callbacks, profile, view size/orientation/DPR, seed), measurement event taxonomy, outcome enum and machine-readable results schema. Document clock domains and limitations.
- [ ] 1.3 Add replayable baseline fixtures (40-ply game, ≥100 legal short tactical puzzles, captures, promotions, castling, illegal/drop-off/cancel, reduced-motion) with independent legality verification and zero proprietary puzzle data.

## 2. Browser interaction correctness

- [ ] 2.1 Add `feel:ci` runner using existing production Playwright fixture; keep browser-driven `page.mouse` input distinct from synthetic `dispatchEvent` microbenchmarks; ensure Chromium and WebKit correctness jobs.
- [ ] 2.2 Instrument pointer down/move/up, drag activation, transform writes, model acceptance, callback start/end, ghost hide and next-move acceptance with test-only performance markers; confirm no instrumentation in published bundles.
- [ ] 2.3 Add deterministic tests for pickup/threshold boundaries, click vs drag, pointercancel, out-of-board drop, illegal move, same-square release, rapid repeat, lost focus, orientation, board sizes and drag artifacts.
- [ ] 2.4 Add click-to-move and real move callbacks tests, including 0/5/15/40ms controlled callback loads, no stale ghost, exact move count/FEN, first-move vs warmed cases.
- [ ] 2.5 Add frame scheduler, animation and audio state tests: no/30/60/100ms glide, slow and fast paths, first/cold sound, prewarm/sound disabled, prefers-reduced-motion and overlapping transitions.

## 3. Automated rendered-image oracle (no visual operator)

- [ ] 3.1 Build a fully deterministic image-difference/template-position oracle for known pieces, themes and board bounds. Validate across 1x/2x DPR and multiple sizes/zoom. Use actual browser screenshots for state correctness, not claims of high-FPS timing.
- [ ] 3.2 Verify pickup state, origin opacity, one visible dragged piece, continuous tracked position, settled destination, highlight/cursor state, and nonpersistent overlays automatically. Return explicit confidence and `INCONCLUSIVE` when rendering cannot be analyzed.
- [ ] 3.3 Add oracle mutation tests: shift drag by known pixels, hide ghost, retain ghost after release, wrong piece, duplicate piece, disable highlight, introduce 1–2 frame delay. Fail tests if the oracle fails to detect injected defects.
- [ ] 3.4 Implement event/frame correlation with proxy `requestAnimationFrame` instrumentation, clearly labeling proxy precision; store raw traces only when enabled.

## 4. Fast-puzzle and behavioral comparison

- [ ] 4.1 Add deterministic Puzzle Rush-like 100-puzzle throughput tour and ≥1,000-attempt stress run. Include fast drag/click, forced opponent replies, next input before visual settle, optional premove queued vs immediate accepted, and correctness/integrity assertions.
- [ ] 4.2 Add isolated A/B profiles for drag threshold 0/1/2/3/4/6px and Chessground-inspired adaptive threshold, plus immediate pointerdown pickup; avoid importing GPL code. Track accidental moves/missed clicks.
- [ ] 4.3 Add isolated A/B profiles for origin ghost opacity 0/0.35, animation 0/30/60/100ms, disabled/cold/prewarmed audio, and callback/cleanup ordering. Experimental toggles must remain test-only pending separate product approval.
- [ ] 4.4 Produce effect sizes, distribution plots for machine artifacts only, and readable textual comparisons; no visual judgement or hand-picked cherry-pick outcome.

## 5. Desktop runtime and actual compositor frames

- [ ] 5.1 Create small test-only macOS Tauri/WKWebView fixture using the exact GigaBoard package build; add scoped WebDriverIO + Tauri automation and verify supported versions/tool permissions at implementation time.
- [ ] 5.2 Build opt-in Swift ScreenCaptureKit board-cropped capture pipeline with timestamps, capture-drop accounting, board template matching and CLI-readable errors for missing Screen Recording permissions.
- [ ] 5.3 Define and test monotonic cross-process clock calibration between JS/driver/Swift and report bounds/uncertainty; NEVER report a physical photon latency from software-only capture.
- [ ] 5.4 Implement opt-in `feel:blindbase` external adapter protocol for the actual macOS desktop application, with user-configured app path and test-only hooks. Make it impossible to accidentally commit private app/database/images/trace output into public GigaBoard.
- [ ] 5.5 Test fixture parity Chromium vs Playwright WebKit vs native WKWebView vs optional BlindBase without presenting cross-engine timings as apples-to-apples regressions.

## 6. Accessibility, nonvisual reporting, reliability gates

- [ ] 6.1 Add keyboard-only and ARIA/LiveRegion assertions (navigation, Enter/Space, Escape, promotion, focus, cue ordering, reduced-motion); test en/ru/he announcement paths where applicable.
- [ ] 6.2 Produce versioned `results.json` + `environment.json`, plain-text console summary and structured accessible `report.md` with failure causes, baseline deltas, confidence, exact reproduction command and no color-only states.
- [ ] 6.3 Implement deterministic `feel:ci` correctness gate, and a separate controlled-host `feel:bench` / `feel:compare` performance gate using repeated alternating A/B runs, host metadata, calibrated budgets and explicit `INCONCLUSIVE`/`NOT_RUN`.
- [ ] 6.4 Add CI jobs with production builds, test artifact retention policies, native runner opt-in and failed/missing-permission diagnostics. Explicitly disclose missing native coverage; never report it as PASS.
- [ ] 6.5 Add mutation-based validation of the gates themselves; prove a 4px pickup delay, 1-frame presentation stall, ghost leak, missed next move and first-use audio regression are detected in supported measured modes.

## 7. Docs and verification

- [ ] 7.1 Document fully nonvisual setup/usage, scenario reproducibility, test limitations, macOS one-time consent, BlindBase external adapter, tuning calibrated thresholds and accessibility expectations. Add FeelLab section to `BENCH.md` and `docs/STATUS.md`.
- [ ] 7.2 Review new dependencies and license compatibility; confirm no GPL copied into production and no native/driver/instrumentation code in npm distribution.
- [ ] 7.3 Verify `bun run typecheck`, `bun run lint`, `bun run test`, `bun run build`, `bun run size`, `bun run bench`, `bun --cwd apps/benchmarks run feel:ci`; run native suite on supported Mac and record tested/not-run modes.
- [ ] 7.4 Confirm zero drag-frame React commits, existing move/render/SSR/ARIA contracts, and no production pointermove overhead. Document measured results without making unverified "faster than Chess.com" claims.
