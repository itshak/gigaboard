# Change: macOS-first GigaBoard responsive drag pipeline (1.7.1)

## Why
The native macOS BlindBase user reports significantly better fast-puzzle feel
after GigaBoard 1.7.0 and its sound-ownership integration; sound on/off shows
no discernible speed difference. A 2px mouse threshold feels marginally better
than 4px. Animation Off is fastest but Fast (120ms) feels smoother and more
alive. Preserve that subjective win without claiming it is a measured physical
input-to-display latency reduction.

## What changes
1. Optimize pre-mounted drag-ghost slot activation to touch only the old/new
   piece instead of writing style to all 12 slots each pickup.
2. Introduce an explicitly opt-in `dragGeometryCache` prop that reads the
   board rectangle once per drag, invalidates on scroll/resize and starts
   fresh on every gesture. The existing per-move measurement remains default
   for compatible fallback and controlled A/B.
3. Extend production-build FeelLab with real Playwright input comparing
   cache on/off, 2px/4px threshold and 120ms/0ms animations. Reject wrong
   moves, click jitter, stale drag ghosts and geometry drift.
4. Add unit tests for geometry invalidation, re-grabs and repeated piece
   selection, including the old disabled path.
5. Run CI (lint/typecheck/build/unit/size, browser Playwright Chromium and
   WebKit, macOS-hosted WebKit where possible), report exactly what ran.
6. Publish npm gigaboard 1.7.1 only after passing checks; integrate optional
   geometry caching in BlindBase after publication and user acceptance.

## Non-goals
Do not change GigaBoard's default 4px threshold or global animation timing.
BlindBase already owns the macOS 2px toggle and 120ms preference.
Do not copy Chessground GPL code, ship test-only instrumentation, assume
Playwright WebKit equals Tauri WKWebView or claim a proven speed win.
Do not change iOS touch behavior; it remains untested on hardware.
