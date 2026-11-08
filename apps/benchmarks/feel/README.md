# GigaBoard FeelLab — automation without visual review

## Current implementation status

FeelLab's **browser-only phase is accepted and archived** in
`openspec/changes/archive/2026-11-08-automated-board-feel-lab/`.
The real browser correctness and test-only timing probes remain in CI.
The original broader proposal also imagined native macOS ScreenCaptureKit,
cross-process clock calibration and an external BlindBase adapter; those
tasks are **deferred and not implemented**, not silently considered passed.
Do not interpret browser screenshot comparisons as input-to-photon latency.

## Run browser assertions

From the repository root:

```sh
bun install
npx playwright install chromium webkit
(cd apps/benchmarks && bun run feel:ci)
```

The suite uses a production Vite build, real `page.mouse` pointer input,
Chromium + Playwright WebKit, independently computed expected chess moves,
and an automatic pixel comparison oracle. The oracle does not require a
human to look at a screenshot. A deliberately hidden drag ghost is included
as an oracle mutation test.

Outputs (ignored by Git) appear at
`apps/benchmarks/feel-results/results.json`,
`environment.json` and `report.md`. Report status uses textual
PASS/FAIL/INCONCLUSIVE/NOT_RUN; no color coding is required.

```sh
bun --cwd apps/benchmarks run feel:compare -- path/to/baseline.json path/to/candidate.json
```

Do not compare browser/OS/hardware conditions as if they shared one timing
budget. A browser test result does not provide macOS WKWebView certification.

## What the tests currently measure

- Native Playwright pointer pickup at the current 4px drag threshold.
- First visible DOM activation, pointer delivery and drop callback markers.
- Controlled 0, 5, 15 and 40ms application callback loads and ghost cleanup order.
- Automated origin-opacity, animation-duration and sound-pool initialization checks.
- Optional 1,000-gesture stress run: set FEELLAB_STRESS=1 and select its spec.
- Independent screenshot pixel changes as a piece enters an empty square.
- A mutation test that hides a floating piece and ensures the pixel
  detector would reject the missing visual.
- Click-to-move, same-square release, 40-ply mixed click/drag sequence,
  100 repeated fixtures spanning 40 verified legal positions, and
  keyboard-only move entry.

Playwright screenshot calls perturb the page and cannot be used for
frame-accurate motion latency. The data explicitly labels such results as
**rendered correctness only**. `performance.now()` event and mutation marks
are **browser processing proxies**, not physical display timestamps.
The scenario wall times include driver overhead.

## Optional future research — deferred

See the [archived tasks](../../../openspec/changes/archive/2026-11-08-automated-board-feel-lab/tasks.md) for ideas not implemented: full 100 distinct tactical puzzles,
configurable A/B pickup thresholds, controlled-host performance regressions,
ScreenCaptureKit native frame oracle, BlindBase adapter, full automated
accessibility/i18n coverage, and verified Mac-specific execution.

Never add screenshots/videos from private BlindBase data to this public repo.
Do not copy GPL chessground code into the MIT GigaBoard implementation.

## GitHub-hosted board configuration A/B screening

`FeelLab Configuration Optimization` runs on every push to main, nightly, and
on manual workflow dispatch. It uses real Playwright mouse input against the
production-built chessboard, independently checks move FEN/callback counts,
verifies a following move is accepted, and detects visual pickup caused by 1px
click jitter. Experimental controls are opt-in props, so defaults stay unchanged.

Run `FEELLAB_OPTIMIZE=1 (cd apps/benchmarks && bun run feel:optimize)`.
Download `feel-results/optimization-report.md` and
`feel-results/optimization-results.json` from GitHub Actions artifacts.
The report ranks eligible pickup profiles by the measured minimum hand movement
to visible DOM pickup, not by physical display latency or subjective feel.
Each profile is repeated three times, order is rotated, and noisy DOM handling
time is reported but not used to certify a perceptual improvement.

Profiles cover threshold 0/1/2/3/4/6 CSS px, mouse/pen 2px vs touch 6px
heuristic, immediate pointerdown pickup, origin opacity 0/0.35, animation
0/30/60/100ms and sound off/cold/prewarmed. The non-pickup dimensions
remain correctness/diagnostic experiments; no reliable real-screen winner
can be declared without native capture and user acceptance. More tests are
needed for different touch pointer hardware and motion disorders.

## First GitHub A/B results (November 8, 2026)

[Successful run with artifact](https://github.com/itshak/gigaboard/actions/runs/42421368523):
14 profiles x 3 repetitions = 42 real Chromium Playwright trials. All
tested moves completed; immediate pickup, 0px and 1px thresholds visibly
activated drag on 1px mouse jitter. Fixed 2px and the 2px-mouse/6px-touch
heuristic passed the same jitter oracle, reducing pickup *movement* from
the 4px default to 2px. The browser sweep recommends the fixed **2px**
profile for optional user acceptance, not automatic production adoption.
No measured physical-display timing improvement may be claimed.

## 2px follow-up validation

The `@twopx` Playwright group now validates the 2px candidate against the 4px
default in **Chromium and WebKit**: 1px horizontal/vertical/diagonal click
jitter, click-to-move, exact activation at 2px vs 4px, and a full 40-ply mixed
click/drag game with castling. A Chromium-specific test drives actual browser
CDP touch input and compares fixed 2px with the touch-aware adaptive 6px
threshold. Touch testing here does **not** substitute for a physical device.

From `apps/benchmarks` run `bun x playwright test --config ./playwright.feel.config.ts --grep @twopx`.
The tests run in the GitHub FeelLab correctness workflow on every push and
PR, as part of `bun run feel:ci`. The owner has since accepted the BlindBase native perceived-feel configuration
(2px mouse, cache Off, Normal 120ms) and prefers it over cache On; this is
subjective acceptance, not a hardware frame-latency measurement.


## macOS-hosted WebKit pointer-movement A/B (November 8, 2026)

The `@pointerperf` suite compares geometry cache **On and Off** in
alternating `cache/live/live/cache` order on the **same macOS-15 GitHub runner**.
It runs in `.github/workflows/feel-lab.yml`, in addition to the
existing `@dragperf` correctness matrix.

It measures, with no visual operator:

- **Idle hover**: browser pointermove coordinate travel and event counts over
  the board versus outside the board (control), pointer dispatch p50/p95,
  animation-frame interval p50/p95 and board rectangle-read counts.
- **Held-piece dragging**: input CSS-pixel distance versus floating-piece
  transform distance (gain must remain about **1.0**), worst-case geometric
  pointer-to-piece error below **1.5 CSS px**, pointer handler processing
  and how many board layout rectangles are read in each mode.
- Alternating repeats to limit host drift; all raw per-variant measurements
  appear in `feel-results/results.json`, the GitHub Actions job summary, and the screen-reader-friendly
  `feel-results/report.md`. Timings are **diagnostics**, not hard pass/fail
  performance thresholds because shared macOS runners fluctuate.

Reproduce from `apps/benchmarks` after installing dependencies and WebKit:

```sh
bun x playwright test --config ./playwright.feel.config.ts --project=webkit-feel --grep @pointerperf
```

**Limitations:** Playwright's mouse API sends browser automation input, not
physical mouse or trackpad motion. It cannot measure hardware pointer
sensitivity, macOS acceleration, actual cursor travel on the desktop,
native Tauri/WKWebView timing, subjective speed, or photons on screen.
A passing 1:1 pointer-to-piece test cannot disprove a perceived "heavy
cursor" effect in installed BlindBase. Those require separate native
instrumentation (OpenSpec section 5) and user acceptance. Cache geometry is
only used while dragging; idle hover has no cache coordinate lookup.

After a local @pointerperf run, `cd apps/benchmarks && node feel/summarize-pointer.mjs` prints the same human-readable comparison shown in GitHub Actions.
