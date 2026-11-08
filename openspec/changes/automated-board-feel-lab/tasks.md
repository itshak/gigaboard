# Implementation Tasks: Automated Board FeelLab

Each task is intended to be independently reviewable and completable in one coding session. Deliver measurement infrastructure before changing shipped board behavior.

> **Implementation status, November 5, 2026: IN PROGRESS.** Browser-side Playwright assertions, test-only instrumentation, pixel-diff oracle, a basic mutation test, rapid move scenarios, accessible reports, and a browser GitHub Actions workflow have been committed to `main`. The runnable suite has **not been verified in this environment**. Native macOS frame capture, an external BlindBase adapter, cross-clock calibration, distinct tactical puzzles, calibrated performance gating, and full accessibility/i18n coverage are outstanding. **Do not archive this change or claim all requirements satisfied.**

## 1. Inventory and baseline contract

- [ ] 1.1 Audit `apps/benchmarks`, `BENCH.md`, current GigaBoard drag/click/animation/sound hooks, current tests, and existing OpenSpec ADRs. Record what timings are genuine vs synthetic, and preserve existing benchmark suite results.
- [ ] 1.2 Define a versioned FeelLab scenario schema (FEN/UCI, input trace, expected callbacks, profile, view size/orientation/DPR, seed), measurement event taxonomy, outcome enum and machine-readable results schema. Document clock domains and limitations.
- [ ] 1.3 Add replayable baseline fixtures (40-ply game, ≥100 legal short tactical puzzles, captures, promotions, castling, illegal/drop-off/cancel, reduced-motion) with independent legality verification and zero proprietary puzzle data.

## 2. Browser interaction correctness

- [x] 2.1 Add `feel:ci` runner using existing production Playwright fixture; keep browser-driven `page.mouse` input distinct from synthetic `dispatchEvent` microbenchmarks; ensure Chromium and WebKit correctness jobs.
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
- [x] 4.2 Add isolated A/B profiles for drag threshold 0/1/2/3/4/6px and Chessground-inspired adaptive threshold, plus immediate pointerdown pickup; avoid importing GPL code. Track accidental moves/missed clicks.
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
- [x] 6.2 Produce versioned `results.json` + `environment.json`, plain-text console summary and structured accessible `report.md` with failure causes, baseline deltas, confidence, exact reproduction command and no color-only states.
- [ ] 6.3 Implement deterministic `feel:ci` correctness gate, and a separate controlled-host `feel:bench` / `feel:compare` performance gate using repeated alternating A/B runs, host metadata, calibrated budgets and explicit `INCONCLUSIVE`/`NOT_RUN`.
- [ ] 6.4 Add CI jobs with production builds, test artifact retention policies, native runner opt-in and failed/missing-permission diagnostics. Explicitly disclose missing native coverage; never report it as PASS.
- [ ] 6.5 Add mutation-based validation of the gates themselves; prove a 4px pickup delay, 1-frame presentation stall, ghost leak, missed next move and first-use audio regression are detected in supported measured modes.

## 7. Docs and verification

- [ ] 7.1 Document fully nonvisual setup/usage, scenario reproducibility, test limitations, macOS one-time consent, BlindBase external adapter, tuning calibrated thresholds and accessibility expectations. Add FeelLab section to `BENCH.md` and `docs/STATUS.md`.
- [ ] 7.2 Review new dependencies and license compatibility; confirm no GPL copied into production and no native/driver/instrumentation code in npm distribution.
- [ ] 7.3 Verify `bun run typecheck`, `bun run lint`, `bun run test`, `bun run build`, `bun run size`, `bun run bench`, `bun --cwd apps/benchmarks run feel:ci`; run native suite on supported Mac and record tested/not-run modes.
- [ ] 7.4 Confirm zero drag-frame React commits, existing move/render/SSR/ARIA contracts, and no production pointermove overhead. Document measured results without making unverified "faster than Chess.com" claims.

## November 8, 2026 — CI-hosted configuration screening increment

- Added optional, backward-compatible `dragActivationDistance` and
  `dragPickupOnPointerDown` to the React board. The defaults remain 4px
  and false. `"adaptive"` is a fixed touch-aware heuristic (2px mouse/pen,
  6px touch), not a learning algorithm.
- Added a real-board Playwright sweep with rotating order, three repetitions,
  independent chess.js move checks, click-jitter detection, diagnostic browser
  event/DOM timings, and ranked nonvisual Markdown/JSON output.
- Added separate nightly/manual/push GitHub Actions optimization run. CI
  screening does NOT prove physical photon timing, exact perceived feel,
  calibrated cross-host regressions, or native Mac/WKWebView behavior.
- The checked 4.2–4.4 tasks cover this browser screening increment only.
  Full adaptive policy validation, true calibrated performance and native
  frame capture remain open in sections 5 and 6.

## Initial actual CI evidence — November 8, 2026

- GitHub-hosted run: https://github.com/itshak/gigaboard/actions/runs/42421368523
- 42 real Playwright mouse trials, 14 isolated profiles, three repetitions each,
  with accessible `optimization-report.md` and JSON artifact. The workflow
  passed all exercised move-integrity assertions.
- Under the declared 1px click-jitter safeguard, the 2px mouse activation
  profile passed and reduced pickup **movement** from the 4px default to 2px.
  A touch-aware adaptive profile matched 2px on mouse but its touch branch
  was not measured. Immediate pointerdown, 0px and 1px profiles created a
  visible ghost during a 1px click jitter and were excluded.
- An actual execution of the broader Chromium+WebKit correctness suite exposed
  a previously hidden click-to-move castling failure: selection snapshots
  included canonical king-captures-rook targets but omitted conventional
  king landing squares. Fixed with a regression unit test. Rerun required
  before claiming this specific correction verified.
- The optimization run is *not* native macOS, a controlled-host latency gate,
  a proof of improvement in human-perceived responsiveness, nor a screen
  presentation timing measurement. 4.3 and 4.4 remain open for complete
  callback/cleanup A/B and robust distributions/effect sizes.

## 2px candidate validation gate — November 8, 2026

The next pass explicitly tests the 2px threshold against the 4px baseline in
both Chromium and WebKit. Browser-driven mouse jitter on a click (stationary,
1px axial, and 1px diagonal) must not falsely reveal a drag ghost; click-to-move
must still complete. Crossing 2px must activate the experimental ghost earlier
than 4px, while both boards must accept the same drag. A 40-ply mixed drag/click
game (including castling) must preserve independently verified FEN and callback
counts. Chromium also uses CDP browser-driven touch input to contrast fixed 2px
with the adaptive touch branch (6px) without treating JS-dispatched synthetic
events as real user input. This remains a correctness and ergonomic safety
screen; it does not measure native application feel or a user's own jitter.

## Sound integration audit and staged ownership (November 8, 2026)

- BlindBase owns a predecoded Web Audio pool shared with move speech and iOS
  audio-session focus, four selectable CC0/local themes, per-category volume,
  master mute, UI/engine/feedback cues and explicit illegal-move feedback.
  GigaBoard's lazy HTMLAudio pool cannot replace this backend without a
  regression. Its built-in chess.com sound assets have a redistribution warning.
- Add GigaBoard `sound.onCue` for host-supplied backends, optional native pool
  prewarming, and `sound.trigger = "position"` for apps that approve/reject
  moves against controlled `positionFen`. Never sound a rejected local move.
- Host integration must move move-*event ownership* to GigaBoard while keeping
  app speech, illegal/training/engine/UI events in the existing audio engine.
  Verify browser-native controlled FEN confirmations and no duplicate cues
  before removing app-originated move cues. Cross-repo deployment requires an
  npm package release and a BlindBase lockfile update; neither is implied by
  simply merging GigaBoard source.

## Sound API implementation and verified browser/consumer checks (November 8, 2026)

- GigaBoard now provides `sound.onCue` to route board-confirmed semantic
  sounds into a host-provided backend (zero HTMLAudio instances when injected).
  The opt-in `sound.prewarm` and HTML preload controls remain available for
  standalone GigaBoard consumers, but BlindBase's existing predecoded Web Audio
  backend and speech/audio focus should not be replaced by a second player.
- `sound.trigger = "position"` defers move cues until externally controlled
  `positionFen` confirmation, preventing speculative legal-but-wrong puzzle
  moves from sounding. `sound.cuePolicy = "san-priority"` preserves capture
  before check/promotion and handles draw versus checkmate cue semantics.
- Tests verify prewarm, volume delegation, callback ownership, rejected moves,
  accepted controlled position changes, and capture-checkmate/promotion/stalemate
  priority. Both CI and Playwright FeelLab passed before the final policy
  addition; all new CI runs must pass before release.
- BlindBase has an explicit old-npm fallback and two-job cross-repository CI:
  [old + source package integration passed](https://github.com/itshak/blindbase/actions/runs/42425507664).
  A new GigaBoard npm version must be published and its dependency lockfile
  upgraded before claiming the board-owned sound trigger is used in production.
- This is only the sound-integration subset of FeelLab; remaining native
  display/frame measurements, accessibility, and broad puzzle stress tasks
  remain open. **Do not archive the OpenSpec change.**

## macOS-first acceptance decision — November 8, 2026

- The user's primary device and acceptance environment is the **native macOS
  BlindBase app**. Prioritize WKWebView interaction behavior, drag feel, actual
  pointer-to-piece response, click-to-move, puzzle throughput and sound recovery
  on macOS. Browser CI remains a deterministic correctness screen, not proof
  of macOS native responsiveness.
- BlindBase now exposes a reversible **macOS-only mouse drag experiment**:
  GigaBoard 1.7's browser-tested 2px activation candidate is enabled by default
  on desktop Macs; Settings > Board & Pieces > Board Comforts lets the tester
  turn it off to return to the unchanged GigaBoard 4px baseline. The real user
  assessment and subsequent performance gates remain outstanding.
- Do not change iOS/iPadOS touch activation thresholds based on macOS mouse
  results. Keep touch and audio integration reasonably compatible but label
  **native iOS UNTESTED** explicitly. iOS is deferred and does not block the
  macOS acceptance/release gate.
- macOS-focused remaining work: native app test fixture, repeated A/B with
  robust statistics, frame/cursor feedback, 100-puzzle throughput and 1,000
  action stress, nonvisual report and VoiceOver regression checks. Leave
  the FeelLab OpenSpec active pending those verifications.
- In private BlindBase do not auto-run expensive audio integration CI on
  intermediate commits; its manual-only workflow defaults to one published
  GigaBoard job and requires opt-in for the full cross-version matrix.
