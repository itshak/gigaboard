## ADDED Requirements

### Requirement: Reversible drag geometry optimization
The Chessboard SHALL support an optional `dragGeometryCache` that avoids
repeated `getBoundingClientRect()` reads while following a pointer. It SHALL
default to the prior uncached behavior for backwards compatibility.

#### Scenario: Cached follow path remains accurate
Given a mouse drag with caching enabled, each pointer sample SHALL update
the floating piece without React state work; resizing or scrolling SHALL
invalidate the cached board geometry before subsequent movement.

#### Scenario: Uncached control and gesture teardown
With the option disabled, each move SHALL retain fresh board measurement.
After cancel, drop, unmount or a new gesture, no previous geometry SHALL leak.

### Requirement: Drag ghost minimal slot mutations
For each pickup the board SHALL reveal the selected piece and hide the
previously shown piece without rewriting all 12 slots. Cancel/drop SHALL
leave no active floating ghost and subsequent picks SHALL show the right piece.

### Requirement: macOS-first validation, truthful evidence
CI SHALL verify chess correctness, no duplicate moves, 2px click jitter safety,
120ms/0ms animation options and cache-on/off on real browser-driven input.
Browser results SHALL not claim native WKWebView/input-to-photon measurement.
iOS native behavior SHALL remain explicitly untested.
