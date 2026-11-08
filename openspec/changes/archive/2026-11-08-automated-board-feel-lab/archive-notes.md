# Archive notes — automated-board-feel-lab

Archived: 2026-11-08. Disposition: **phase accepted, research backlog deferred**.

## What shipped and was verified

- GigaBoard **1.7.1**, with optional `dragGeometryCache` (package default
  false), 2px/4px `dragActivationDistance` customization, and fixed
  `adaptive` threshold (2px mouse/pen, 6px touch). GigaBoard's package
  activation default remains 4px for backwards compatibility.
- Production Playwright correctness, 2px jitter/click checks, WebKit,
  browser A/B optimization, visually independent pixel assertions,
  native-macOS-hosted **Playwright WebKit** pointer comparison and readable
  JSON/Markdown reports. Native embedded WKWebView was **not** measured.
- On main as of 2026-11-08:
  - [GigaBoard CI](https://github.com/itshak/gigaboard/actions/runs/42456756219) PASS
  - [macOS WebKit FeelLab](https://github.com/itshak/gigaboard/actions/runs/42456756200) PASS
  - [optimization sweep](https://github.com/itshak/gigaboard/actions/runs/42456756202) PASS
  - [performance regression](https://github.com/itshak/gigaboard/actions/runs/42456756408) PASS
  - [visual regression](https://github.com/itshak/gigaboard/actions/runs/42456756324) PASS
- Playwright WebKit cache On/Off had equal 370 CSS px cursor travel,
  1.0000 floating-piece motion gain, 0px sampled tracking error, and
  1ms p95 drag event-processing proxy. Cache reduced drag board-rectangle
  reads from 52 to 5. These do **not** demonstrate native Mac cursor
  acceleration or subjective benefit.

## User-accepted host decision (BlindBase)

The BlindBase desktop host enables 2px mouse/pen pickup through the adaptive
mode, defaults to **geometry cache Off** and **Normal 120ms** ease-in-out
animation. Owner tried Fast 80ms: quicker for puzzles, but Normal 120ms
was more satisfying for everyday chess. Fast 80ms and animation Off remain
opt-in speed choices. These are **BlindBase defaults**, not changes to
GigaBoard 1.7.1's backwards-compatible defaults.

## Deferred, not silently completed

The original tasks' unmarked checkboxes are preserved as historical future
research: native Tauri/WKWebView, ScreenCaptureKit frame timing, hardware
pointer/photons, cross-clock calibration, full BlindBase native adapter,
controlled dedicated-host perf gates, a full 100 distinct tactical puzzle
tour, mutation completeness and broad assistive-tech hardware verification.
No native iOS physical-device verification. Do not claim "faster than
Chess.com" or physical input-to-photon gains. Should the user report new
regressions, create a focused new change rather than reopening this phase.

Related: the separate prior mac-feel-responsive-pipeline change remains
archived, GigaBoard library is published as 1.7.1, and BlindBase integration
is archived with a full user acceptance record.
