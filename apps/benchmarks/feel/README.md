# GigaBoard FeelLab — automation without visual review

## Current implementation status

FeelLab is an incremental OpenSpec implementation under
`openspec/changes/automated-board-feel-lab/`. The browser correctness and
test-only timing probe are implemented; native macOS ScreenCaptureKit,
calibrated cross-process clock comparison, and the external BlindBase adapter
remain **NOT RUN / NOT IMPLEMENTED** until their tasks are completed. Do not
interpret browser screenshot comparisons as true input-to-photon latency.

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

## Follow-on OpenSpec implementation

See `tasks.md` for remaining work: full 100 distinct tactical puzzles,
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
