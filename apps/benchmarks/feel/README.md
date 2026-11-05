# GigaBoard FeelLab — automation without visual review

## Current implementation status

FeelLab is an incremental OpenSpec implementation under
\`openspec/changes/automated-board-feel-lab/\`. The browser correctness and
test-only timing probe are implemented; native macOS ScreenCaptureKit,
calibrated cross-process clock comparison, and the external BlindBase adapter
remain **NOT RUN / NOT IMPLEMENTED** until their tasks are completed. Do not
interpret browser screenshot comparisons as true input-to-photon latency.

## Run browser assertions

From the repository root:

\`\`\`sh
bun install
npx playwright install chromium webkit
bun --cwd apps/benchmarks run feel:ci
\`\`\`

The suite uses a production Vite build, real \`page.mouse\` pointer input,
Chromium + Playwright WebKit, independently computed expected chess moves,
and an automatic pixel comparison oracle. The oracle does not require a
human to look at a screenshot. A deliberately hidden drag ghost is included
as an oracle mutation test.

Outputs (ignored by Git) appear at
\`apps/benchmarks/feel-results/results.json\`,
\`environment.json\` and \`report.md\`. Report status uses textual
PASS/FAIL/INCONCLUSIVE/NOT_RUN; no color coding is required.

\`\`\`sh
bun --cwd apps/benchmarks run feel:compare -- path/to/baseline.json path/to/candidate.json
\`\`\`

Do not compare browser/OS/hardware conditions as if they shared one timing
budget. A browser test result does not provide macOS WKWebView certification.

## What the tests currently measure

- Native Playwright pointer pickup at the current 4px drag threshold.
- First visible DOM activation, pointer delivery and drop callback markers.
- A 15ms deliberately slow application callback and ghost cleanup order.
- Independent screenshot pixel changes as a piece enters an empty square.
- A mutation test that hides a floating piece and ensures the pixel
  detector would reject the missing visual.
- Click-to-move, same-square release, 40-ply mixed click/drag sequence,
  100 repeated fixtures spanning 40 verified legal positions, and
  keyboard-only move entry.

Playwright screenshot calls perturb the page and cannot be used for
frame-accurate motion latency. The data explicitly labels such results as
**rendered correctness only**. \`performance.now()\` event and mutation marks
are **browser processing proxies**, not physical display timestamps.
The scenario wall times include driver overhead.

## Follow-on OpenSpec implementation

See \`tasks.md\` for remaining work: full 100 distinct tactical puzzles,
1,000-attempt stress suite, configurable A/B pickup thresholds, isolated
sound/animation variants, controlled-host performance regressions,
ScreenCaptureKit native frame oracle, BlindBase adapter, full automated
accessibility/i18n coverage, and verified Mac-specific execution.

Never add screenshots/videos from private BlindBase data to this public repo.
Do not copy GPL chessground code into the MIT GigaBoard implementation.
