# Change: Automated Board FeelLab — measurable, accessible chessboard responsiveness

## Why

GigaBoard's current performance claims focus on React commits, JS work, and frame throughput, but users can still perceive a slower board than Chess.com Puzzle Rush. A visually impaired BlindBase maintainer cannot be expected to inspect screenshots or high-speed videos to diagnose this. We need a fully automatic, repeatable test system that measures **pickup, pointer following, dropping, readiness for the next move, audio feedback, and complete rapid-puzzle throughput**, including what was *visually presented*, and produces an accessible text-only pass/fail report. The maintainer's only manual task should be optional final subjective acceptance ("does this feel faster?").

The existing `apps/benchmarks` Playwright/Chromium tests provide a useful foundation, but synthetic event throughput and mean frame time are not the same as user-visible feedback or native macOS WKWebView latency. This change adds an independent interaction-feel quality gate, rather than changing the core renderer blindly.

## What Changes

1. Add **GigaBoard FeelLab** in `apps/benchmarks` (or a clearly separated workspace app if tooling isolation warrants it), reusing the production-built board fixture, existing game tours, benchmark harness, and current output conventions.
2. Instrument real user-path input and output phases: input dispatch, first pickup indication, drag activation, pointer sample and rendered position, release, model commit, callback completion, floating-piece cleanup, first visually settled frame, and acceptance of the next intended input. Record cold/warm behavior, median/p95/p99/worst, errors, and reproducibility metadata.
3. Implement **automatic visual oracles**: known-position piece templates/background-difference analysis, pixel bounds/centroids, visual-finish checks, ghost/origin duplication, selected-square feedback, and detection of tracking jumps and lag. Analyze frames programmatically; no human visual review is required to pass.
4. Build a representative **fast-puzzle simulation**: fixed deterministic tactical sequences, drag/click/touch where applicable, forced opponent replies, overlapping input, optional premove/readiness tests, illegal moves, captures, promotions, castling, cancellations, high repetition, and varying board sizes.
5. Create controlled **A/B profiles** for (a) 0/1/2/3/4/6-pixel activation thresholds and adaptive threshold; (b) first visual pickup on pointerdown vs first move; (c) origin-piece opacity 0 vs 0.35; (d) 0/30/60/100 ms move glides; (e) cold/prewarmed sounds and sound disabled; (f) synchronized/nonblocking feedback and drop/callback ordering. Experimental variants are test-only until separately reviewed and approved as product behavior.
6. Add a cross-engine matrix (Chromium and Playwright WebKit for correctness/relative signals). Keep CDP-specific precision profiling in Chromium, and do not equate Playwright WebKit with embedded macOS WKWebView.
7. Supply a **macOS native measurement path**, combining a minimal Tauri/WKWebView fixture, supported WebDriverIO/Tauri automation, and an opt-in Swift/ScreenCaptureKit frame-capture helper. An external/optional BlindBase adapter can run the same scenarios against the actual BlindBase desktop app; no proprietary BlindBase source, screenshots, or samples enter the public GigaBoard repo.
8. Separate deterministic CI correctness gates from performance gates on a controlled dedicated Mac; use platform-specific baselines, calibrated variance and traceable thresholds instead of invented universal latency numbers.
9. Generate machine-readable JSON and a fully self-contained, screen-reader-friendly Markdown/text summary stating results, baseline deltas, confidence/limitations, command to reproduce, and next diagnostic action. Screenshots/videos/traces are optional developer artifacts, never required for acceptance by the visually impaired maintainer.

## Scope

**In scope:** Measurement and test infrastructure, opt-in experimental flags/fixtures, test documentation, automated oracles, performance regression gates, native adapter contracts, accessibility and i18n regression checks, proof-of-concept implementation of native capture, and a reproducible report workflow.

**Out of scope:** Shipping a new default drag interaction, changing GigaBoard's public API without a follow-up product proposal, claiming to reverse-engineer Chess.com's proprietary implementation, automated scraping of Chess.com, copying Chessground/GPL code, requiring a manual video review, bundling test-only Tauri/WebDriver/ScreenCaptureKit components in production, or pretending screen capture measures physical photons emitted by a display.

## Existing Evidence / Starting Point

- `packages/react/src/core/drag-controller.ts`: default 4px drag activation threshold.
- `packages/react/src/hooks/use-drag.ts`: pointer listeners and imperative position updates; currently positions via `getBoundingClientRect()` each moving sample; drop callback before drag cleanup.
- `packages/react/src/components/drag-layer.tsx`: pre-mounted drag ghosts; visibility and transforms are imperative.
- `packages/react/src/chessboard.tsx`: game move and app callback during drop; 60ms default position animation; visual cursor/selection behavior.
- `packages/react/src/hooks/use-animation.ts`: WAAPI/FLIP runner, drag-initiated move glides skipped.
- `packages/react/src/hooks/use-move-sound.ts`: first audio playback lazily creates 7 pools × 4 HTMLAudioElement instances.
- `apps/benchmarks/bench/playwright/*`, `apps/benchmarks/playwright.config.ts`, `BENCH.md`: existing production Playwright Chromium measurement, including synthetic gesture paths.

These details are **investigation targets**, not declared root causes. No improvement may be claimed until the baseline and modified variant are measured under the same conditions.

## Accessibility / Performance / Licensing

- The test suite MUST be operable and its results understandable entirely through textual output; no sighted operator or image recognition by the user.
- Protect WAI-ARIA grid/roving tabindex, keyboard navigation, accessible promotion, LiveRegion speech and `prefers-reduced-motion`; verify English, Russian and Hebrew announcement pathways where text is introduced or affected.
- Preserve GigaBoard's existing performance budget: 0 React commits during drag movement, existing per-move commit expectations, production bundle constraints, transform/opacity compositor strategy, and no additional unconditional pointer-move work in the shipped library.
- Test instrumentation MUST be gated/test-only, with no production bundle or runtime overhead by default.
- Honor MIT/Apache-2.0/ISC dependency constraints; license-scan all new dependencies, do not copy GPL Chessground implementation.

## Dependencies and rollout

The native integration requires a consented macOS screen-recording permission and a controlled test host. When such a host is absent, non-native tests still run; the report must explicitly mark native latency coverage **NOT RUN**, never green by omission. The optional BlindBase integration depends on test-only hooks or a test fixture supplied by that separate repository; building GigaBoard itself must not depend on BlindBase.

## Success Criteria

- A single documented command produces a complete nonvisual report covering interaction correctness, visual-state correctness, and all available timing phases.
- Repeatable tests identify known injected faults (4px lag, stale drag ghost, delayed callback, missed next move, 1-frame visual stall, first-sound cold-path) and pass a correct baseline.
- The CI correctness gate is deterministic, while native performance gates disclose host metadata and variability and block only calibrated, reproducible regressions.
- The same reproducible scenario can be compared in Chromium, WebKit, Tauri fixture, and optionally installed BlindBase, with **no misleading apples-to-oranges performance ranking**.
- For each proposed feel variant, the report provides effect sizes and correctness trade-offs without requiring a person to inspect captured frames.
- The project remains accessible, license-clean, and free of test harness code in the production package.
