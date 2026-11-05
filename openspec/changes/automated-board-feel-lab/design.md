# Design: GigaBoard FeelLab

## Architecture overview

Keep testing outside the shipped `gigaboard` package, reusing `apps/benchmarks` production Vite fixture and Playwright infrastructure. Divide responsibilities so that no test relies on a single self-reporting signal.

```text
scenario manifest (JSON/TS: position, actions, expected moves, profile)
                  |
     deterministic user input drivers
        |                  |
  Playwright page.mouse    WebDriverIO + native Tauri (macOS)
        |                  |
   instrumented board   optional BlindBase test adapter
        |                  |
  DOM/event/profiler trace   ScreenCaptureKit timed frames
        \                 /
         independent oracles
           |      |      |
         logical  pixel   timing
           \      |      /
           results + environment manifest
                  |
       calibration / baseline comparator
                  |
          text + JSON report
```

The existing inline `window.__gbBench__` harness may be extended with a separately namespaced and versioned `window.__gbFeelLab__` driver. It MUST be restricted to test builds; instrumentation cannot ship with library consumers. Use the same deterministic scenarios and fixture rules across drivers.

## 1. Measurement definitions and clock domains

Record explicit, semantically stable markers:

- `input:pointerdown-delivered` / `input:pointermove-delivered` / `input:pointerup-delivered`: browser event timestamps/performance clock, not implied OS-to-photon latency.
- `pickup:indicated`: first DOM visual state change (opacity, selection highlight, active ghost) attributable to press.
- `drag:activated`: state-machine pending→dragging.
- `drag:transform-written`: instrumented CSS transform writes, with pointer position, effective square size and element bounds.
- `drop:handler-start`, `move:model-accepted`, `move:onMove-start/end`, `drop:ghost-hidden`.
- `visual:first-pickup-frame`, `visual:last-position-frame`, `visual:settled-frame`: independent rendered-frame oracle timestamps, or **UNMEASURED** if no frame capture.
- `input:next-accepted`: first subsequent valid selection/move accepted after prior action. Distinguish a *premove queued* from an accepted immediate move.
- `audio:trigger`, `audio:first-play-initiated` and (where feasible) AudioContext state or sound-event recording; do not infer acoustic onset from `play()`.

Include raw and derived measures: threshold crossing distance (CSS pixels), pointer-to-piece position error (pixels), response intervals (ms), per-frame tracking error/jump, dropped/late frames relative to observed refresh period, full-puzzle throughput, missed/duplicated/illegal moves, and logical state consistency. Report p50/p95/p99/max, cold-first-event separately, and confidence/variance across repetitions.

All clocks must be monotonic and their domains recorded. CDP/WebDriver/Swift timestamps SHALL be synchronized by explicit calibration samples with estimated uncertainty; never directly subtract unsynchronized clock values. For frame timing, distinguish when a frame is recorded/presented by a capture API from actual monitor photon emission. Frame-capture timestamps may be quantized by refresh and encoder pipeline; show resolution and uncertainty.

`requestAnimationFrame` / double-rAF is only an approximate paint scheduling proxy; test reports MUST label it accordingly. Chrome event-timing/INP and CDP trace are supporting diagnostics, not drag latency ground truth.

## 2. Input drivers

**Behavioral path:** Playwright `page.mouse.move/down/up` (and touch/context equivalents) with controlled steps exercises the browser input stack. Add dedicated browser events/assertions to confirm input was received. Do not use only `dispatchEvent(new PointerEvent(...))` as a substitute for real browser-driven input when claiming user-path timing. Keep the existing in-page synthetic events for inexpensive deterministic state-machine or throughput isolation, and label them separately.

**Native path:** WebDriverIO driving the macOS Tauri fixture and optional BlindBase app; use a reproducible native window size/position, DPR, orientation, focus and board geometry. Prefer trusted native events where supported and record actual delivered event times. Ensure driver permissions/automation status are verified before measurement.

Tests should run both deliberate known paths (uniform, acceleration/deceleration, small corrections, fast diagonals, backtracking, ending outside board) and reproducible randomized event traces (fixed seeds). Include touch/trackpad-like gestures when supported, alongside mouse, keyboard and screen-reader workflows.

## 3. Independent state and pixel oracles

Always validate legal board model/FEN independently of the page's assertions. Pixel checks MUST compare an actual captured render with a reference generated from an independently positioned known piece asset + board theme. Do not treat `element.style.transform` or mock 'was painted' flags as proof of onscreen pixels.

- Capture stable pre-gesture baseline and mask nonboard UI, OS cursor, clocks/notifications and dynamic overlays.
- Track the known floating piece by image-difference, template correlation or centroid/segmentation within calibrated board bounds. Avoid opaque ML/vision judgments; provide algorithmic confidence, failure thresholds and fallback status.
- Confirm piece location against the event position, expected centering, tolerance for anti-aliasing/DPR and renderer transforms; ensure tracked object is not the origin piece.
- Detect pickup frame, ghost visibility, origin opacity, piece duplication, snap/jump, drop target, stuck ghost, stale highlight, destination settle and frame pacing.
- Run controlled positive/negative fixtures (intentionally invisible ghost, shifted template, disabled highlight, wrong destination, lingering overlay, 1–2 frame stall) to validate that the oracle **fails** when it should. If confidence is low, return `INCONCLUSIVE` and fail the relevant correctness gate rather than a false pass.
- Use screenshots and pixel diffs for correctness/static states; DO NOT equate sequential screenshots taken through Playwright with sufficiently accurate high-FPS latency measurement. They perturb timing and may be affected by animation fast-forwarding. For precise motion, use passive capture or instrumented compositor/capture stream.

All stored visual data is optional debugging material; pass/fail is computed automatically. Text reports include accessible descriptions of pixel-related failures (e.g. "drag piece 14 CSS px behind pointer at sample 83").

## 4. Test matrix and controlled experiments

Common deterministic suite:

| Category | Examples and assertions |
|---|---|
| Pickup | press-only, movement 0/1/2/3/4/6px, threshold boundary, selected indicator, click-vs-drag ambiguity |
| Following | 960-point closed loops, slow and fast trajectories, 120Hz/60Hz host where available, direction reversals, jitter and last-sample-to-visible-frame offset |
| Drop | quiet move, capture, castle, en-passant, promotion, off-board release, illegal, same-square, pointercancel, lost focus, double-click, rapid redrag |
| Readiness | immediate next valid input, queued premove, forced opponent reply while user moves, race between drop cleanup and new pointerdown |
| Animations | no glide vs 30/60/100ms, dragged vs click moves, overlap, cancellation, reduced-motion: reduce, no input lock due to decoration |
| Sound/haptics | disabled/cold/prewarmed audio, first and steady state, expected cue exactly once, visual/audio alignment, autoplay blocked/muted |
| Application pressure | `onMove` busy 0/5/15/40ms, unrelated React updates, many arrows/highlights, large analysis panes, background/foreground |
| Accessibility | keyboard-only select/move/promotion, focus order, LiveRegion output/no duplicates, ARIA labels, announcements in en/ru/he where applicable, reduced motion |
| Variety | board sizes, orientation, piece sets, themes, DPRs, zoom, 60/120Hz if hardware present, Chromium/WebKit/macOS WKWebView |

Use fixed puzzle fixtures stored as FEN + expected UCI/ply sequences + intended timing patterns. Include 40-ply Najdorf continuity, ≥100 puzzle instances, burst stress (e.g. ≥1,000 attempts), click-to-move and drag variants; ensure deterministic seed, fixture legality and no dependency on Chess.com login/network or proprietary positions. The same logical sequence, not necessarily identical physical browser timing, can run across engines.

A/B profiles are independent controls; do not silently combine them when attributing improvement. Each profile should provide effect size vs baseline, correctness/regression counts and *whether the improvement is perceptible remains a user acceptance question*. Test-only behavior toggles SHALL not alter the release default. Adaptation state must reset between trials and be exposed in diagnostic metadata.

## 5. Native measurements

- Create a minimal **test-only** Tauri v2 macOS fixture embedding the exact GigaBoard build, with no dependency on proprietary BlindBase code. Keep Tauri/WebDriverIO dependencies scoped to native testing, not the npm package.
- Implement an opt-in Swift ScreenCaptureKit capture helper that streams timestamped frames/bounds to the oracle (prefer lossless/cropped board frames; preserve original frame timing). Detect and report dropped frames in the capture helper separately from app frame misses.
- A one-time macOS Screen Recording / Accessibility / automation consent may be necessary. Tests must fail with an actionable text explanation if permissions are unavailable, never silently skip and report success.
- Offer a **separate external adapter contract** for an installed BlindBase dev/test build (test-only board selector, FEN set/reset, expected cursor/rect info, event markers, build revision); do not require or commit proprietary code or private screenshots into GigaBoard.
- Run Chrome, Playwright WebKit and actual embedded WKWebView as distinct strata. A WebKit Playwright browser is **not** equivalent to Tauri's embedded macOS WKWebView.
- Correlate Swift and page clocks via repeated calibration samples and disclose uncertainty. A software capture cannot give absolute OS input-to-physical-photon latency. Provide documented option for future high-speed camera/photodiode only as non-required validation.

## 6. Statistical procedure and gates

**Deterministic correctness gate (standard CI):** FEN, expected move sequence, no duplicate/missed callbacks, one active dragged piece, proper event/ARIA behavior, reliable pixel oracle, reduced-motion and legal edge cases. Fail on any correctness regression or oracle failure; no manual visual sign-off.

**Performance gate (dedicated calibrated host):** Fix OS/browser/app build, resolution, DPR, window geometry, refresh rate, GPU/power mode; isolate other workloads. Warm and cold runs separately, repeated alternating A/B order with randomized seed order. Store host/environment manifest, fixture ID, build commit and date. Calculate run distributions and uncertainty (e.g. bootstrap paired differences where appropriate). Set baseline budgets **after** collecting reproducible baseline data, not aspirational magic numbers. Fail only a reproducible regression that breaches a documented calibrated budget; label variance-dominated results `INCONCLUSIVE` and request rerun. Avoid comparing raw timing from different hosts or browser engines.

**No native runner available:** mark native scenarios `NOT RUN`; standard CI may pass if its required scope is complete, but a release requiring macOS performance certification must fail or remain uncertified. Separate pass/fail/certification status explicitly.

**Mutation check:** deliberately introduce injected delays, offset errors, stale layers and next-input failures; verify that tests detect them. This is a required validation step for the testing system itself.

## 7. Artifacts and accessible reporting

Produce:
- `results.json` schema-versioned records + `environment.json`, per-test measurement summaries and outcome fields: `PASS`, `FAIL`, `INCONCLUSIVE`, `NOT_RUN`.
- `report.md` and plain-text console summary with heading hierarchy, no color-only statuses, explicit counts and reasons, relative baseline deltas and uncertainty, top regressions, recommended next experiment, and exact reproduction command.
- Optional machine-readable traces, screenshots, raw frames and performance profiles in ignored/non-shipping output paths. Respect privacy; default to synthetic test positions and remove accidental private app content from retained artifacts.

Document `bun --cwd apps/benchmarks run feel:ci`, `feel:bench`, `feel:compare`, plus opt-in `feel:mac` and `feel:blindbase` or equivalent verified scripts. Include a nonvisual operator guide for accessibility.

## 8. Architecture constraints and ADRs

Follow `AGENTS.md`, `openspec/config.yaml` and any applicable existing `openspec/adr/` decisions. Prefer an ADR for cross-clock calibration and native-capture/driver boundaries before introducing a long-lived new runtime dependency.

All new dependencies must be reviewed for permissive licenses. Existing `chessground` benchmark dependency is reference-only and cannot be incorporated into `gigaboard` production code. No production telemetry overhead; preserve zero React commits per drag frame and existing move, bundle, SSR and screen-reader contracts.

## Risks and mitigations

- **False sense of precision:** Separate event callbacks, DOM writes, frame capture and actual photon timing; report clock uncertainty.
- **Self-fulfilling visual tests:** Capture independent output and inject mutations proving detection.
- **Flaky CI timing:** Only gate timing on dedicated calibrated hardware; correctness in shared CI.
- **Tauri/driver tooling limitations:** Native support is conditional, with capability detection and actionable `NOT RUN`, not fabricated results.
- **Private-app leakage:** Only opt-in local BlindBase adapter, no fixtures from real user databases, test artifacts ignored and never committed by default.
- **Accessibility regression:** Continuous keyboard/LiveRegion/motion tests; human final acceptance remains optional experience feedback, not a test dependency.
