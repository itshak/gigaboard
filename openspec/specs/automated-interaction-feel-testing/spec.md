# automated-interaction-feel-testing Specification

## Purpose

Browser-driven, nonvisual chessboard interaction correctness and diagnostic
pointer comparison. This is the **shipped subset** of the wider archived
automated-board-feel-lab research proposal; unfinished native measurement
requirements are not misrepresented as implemented.

## Requirements

### Requirement: Nonvisual browser feel correctness gate

GigaBoard SHALL provide a production-built Playwright FeelLab that exercises
real browser-injected mouse input in Chromium and WebKit, independently checks
accepted chess moves and interactions, and produces `results.json`,
`environment.json` and a readable `report.md`. Test status SHALL distinguish
PASS, FAIL, INCONCLUSIVE and NOT_RUN. Reports SHALL avoid requiring manual
visual review and use a pixel oracle for supported rendered-state assertions.

#### Scenario: Browser-only run
- **WHEN** the operator runs `cd apps/benchmarks && bun run feel:ci`
- **THEN** browser-driven interaction tests execute and report clear results
- **AND** unavailable native capture and physical input-to-photon timing
  are clearly marked NOT_RUN or NOT_MEASURED rather than PASS.

### Requirement: Reversible pickup and geometry A/B tests

The FeelLab SHALL exercise 2px versus 4px pickup, click-jitter behavior,
dragged-piece tracking, drag cleanup and geometry-cache On versus Off.
A macOS-hosted WebKit job SHALL compare pointer input travel over the board
and a control region outside the board, drag transform CSS gain, board
rectangle reads and browser event/frame-scheduling proxies in an alternating
cache/live/live/cache order.

#### Scenario: Equal pointer-to-piece travel
- **WHEN** equal browser-injected pointer traces are used in cached and live modes
- **THEN** floating-piece CSS displacement SHALL remain 1:1 with pointer
  displacement within the test's published geometry tolerance
- **AND** cache read reduction SHALL be measured without asserting that
  the system mouse pointer itself feels faster.

### Requirement: Evidence and packaging boundary

The regular package SHALL keep test instrumentation outside published
runtime code. Browser WebKit is NOT embedded native Tauri WKWebView; no
software-only test SHALL claim hardware pointer acceleration,
presentation-to-photon latency, native macOS acceptance, or broad iOS
certification. Native ScreenCaptureKit, calibrated cross-process timing,
a BlindBase adapter and dedicated-host latency gates are explicitly
deferred; they are not normative implemented requirements in this spec.

#### Scenario: Archived phase keeps the CI checks
- **WHEN** the OpenSpec performance-improvement phase is archived
- **THEN** existing browser FeelLab and performance workflows remain
  executable against GigaBoard main
- **AND** native-only unimplemented tasks remain explicitly documented
  in the archived research plan.
