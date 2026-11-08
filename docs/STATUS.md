# GigaBoard — Status

**Updated:** 2026-11-08. **Published npm version:** 1.7.1.

## Board-feel improvement phase — accepted and archived

- [Published v1.7.1](https://github.com/itshak/gigaboard/releases/tag/v1.7.1)
  and [mac-feel-responsive-pipeline](../openspec/changes/archive/2026-11-08-mac-feel-responsive-pipeline/archive-notes.md)
  are complete. The [automated-board-feel-lab phase](../openspec/changes/archive/2026-11-08-automated-board-feel-lab/archive-notes.md)
  is archived after CI verification and owner acceptance of the host feel.
- GigaBoard's defaults remain conservative: 4px pickup and uncached geometry;
  adaptive 2px mouse/pen and 6px touch and optional geometry caching are
  supported, and GigaBoard 1.7.1 CI is green.
- BlindBase's **accepted** desktop defaults are responsive mouse drag On
  (2px mouse/pen, 6px hybrid touch), geometry cache Off, and Normal 120ms
  piece animation. Fast 80ms helps competitive puzzles, but the owner
  prefers Normal 120ms for smooth, satisfying everyday movement.
- In [macOS-hosted WebKit A/B](https://github.com/itshak/gigaboard/actions/runs/42456756200),
  both cache modes tracked browser motion at 1:1; cached geometry reduced
  measured DOM geometry reads but was not preferred subjectively.

## Verification boundary and deferred work

- [CI](https://github.com/itshak/gigaboard/actions/runs/42456756219),
  [FeelLab](https://github.com/itshak/gigaboard/actions/runs/42456756200),
  [visual](https://github.com/itshak/gigaboard/actions/runs/42456756324)
  and [performance](https://github.com/itshak/gigaboard/actions/runs/42456756408)
  workflows passed. The tests remain in CI after OpenSpec archival.
- Native embedded Tauri WKWebView latency, hardware mouse acceleration,
  ScreenCaptureKit input-to-frame timing, full BlindBase adapter and iOS
  hardware checks were **not** implemented or exhaustively verified.
  They are deferred ideas, not silently passed acceptance gates.
- Related intermittent BlindBase audio reliability has been accepted for
  current user use, with no issues currently noticed; it is not certified
  for every sleep/wake and output-device sequence. Future reports can open
  focused regressions.
