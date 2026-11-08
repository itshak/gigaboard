# drag-performance Specification

## Purpose

Reversible drag hot-path improvements and correctness evidence boundaries introduced in GigaBoard 1.7.1.

## Requirements

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

### Requirement: Desktop-host validation and truthful evidence
CI SHALL verify chess correctness, no duplicate moves, 2px click jitter
safety, animation variants, and cache-on/off on browser-driven input.
An explicit macOS-hosted Playwright WebKit A/B probe SHALL report hover
inside/outside board, pointer-to-piece CSS travel gain and geometry reads.
This is a browser test, not proof of native embedded WKWebView performance,
system cursor acceleration or physical mouse-to-photon timing.
iOS native behavior remains explicitly untested. GigaBoard's package
defaults remain 4px and cache Off; BlindBase uses host-selected adaptive
2px mouse/pen and 6px touch with cache Off.

### Requirement: Keyboard and assistive technology parity

The geometry cache SHALL NOT change roving focus, keyboard move entry, promotion keyboard interaction, LiveRegion announcements or English/Russian/Hebrew host behavior.

#### Scenario: Keyboard input with cache enabled
Given a board with drag geometry caching enabled, when a user completes a move using keyboard navigation, then the same accepted move and announcements SHALL be produced as when caching is disabled.


### Requirement: Preserve the accepted feel baseline without imposing host defaults

GigaBoard SHALL expose opt-in responsive pickup and geometry-cache controls,
while preserving backwards-compatible package defaults. A consumer MAY
select 2px mouse/pen via adaptive activation and choose uncached geometry
when preferred after hands-on testing.

#### Scenario: Host chooses smooth responsiveness
- **WHEN** BlindBase opts into adaptive pickup with geometry cache Off
- **THEN** GigaBoard SHALL use 2px for mouse/pen, 6px for touch, and the
  original fresh geometry reads during dragging.
- **AND** GigaBoard's own default shall remain 4px with cache Off.

The 120ms default and 80ms optional animation are **BlindBase-level**
settings, not changes to GigaBoard's published package defaults.
