# Capability: Automated Interaction Feel Testing

## ADDED Requirements

### Requirement: A user can evaluate board responsiveness without visual review

The repository SHALL provide a documented, nonvisual `GigaBoard FeelLab` workflow that automatically drives chessboard scenarios, evaluates correctness and rendered output, and produces a text report with explicit results. No screenshot or video inspection by the user SHALL be required to obtain a decision.

#### Scenario: Fully automatic run

- **Given** a supported browser-test environment and GigaBoard production build
- **When** the user runs the documented FeelLab CI command
- **Then** the suite executes deterministic chess move and interaction scenarios without prompts for visual judgment
- **And** emits a screen-reader-readable summary, structured results, and reproducible failures
- **And** includes the executed, failed, inconclusive and not-run scenario counts.

#### Scenario: Native measurement unavailable

- **Given** the run lacks supported macOS hardware or permissions for native frame capture
- **When** FeelLab completes its browser tests
- **Then** native frame results are explicitly `NOT_RUN` with a reason and setup guidance
- **And** the report does not claim native latency certification
- **And** non-native deterministic checks can still pass independently.

### Requirement: Measure the whole interactive move lifecycle

FeelLab SHALL measure distinct phases for pickup, drag activation, pointer tracking, drop, logical commit, callback completion, visual settle and next-input acceptance. It SHALL distinguish cold from warm paths, express sample distributions, and label the measurement domain and precision.

#### Scenario: Known pointer gesture

- **Given** a known legal position, viewport, DPR, selected piece and event trajectory
- **When** the test drives a real browser pointer down, movement and release
- **Then** event and model markers are recorded in sequence
- **And** the measured activation distance, transform position, callback intervals and next-input readiness are reported
- **And** the resulting FEN and move count match an independent expected sequence.

#### Scenario: Slow callback

- **Given** injected application callbacks that take 0, 5, 15, or 40 milliseconds
- **When** the user drops a legal piece
- **Then** the suite determines whether callback work delays visual completion or subsequent input
- **And** reports the separately measured phase responsible
- **And** does not mark the move correct solely because the model eventually accepts it.

### Requirement: Independent automated rendered-output validation

The test suite SHALL verify actual rendered states using deterministic pixel/image analysis of known chess positions and piece assets. It SHALL NOT treat DOM state, JavaScript callbacks, or Playwright screenshot timing as direct evidence of display presentation. Visual-oracle failure or insufficient confidence MUST be surfaced explicitly, not converted to a pass.

#### Scenario: Piece visually follows pointer

- **Given** a calibrated board, piece template, and recorded pointer positions
- **When** a drag is recorded in supported frame-capture mode
- **Then** the suite identifies the floating piece in captured frames
- **And** computes its deviation from the expected pointer-relative position and abrupt jumps
- **And** records missing or delayed rendered updates with capture resolution and uncertainty.

#### Scenario: Correct visual cleanup

- **Given** a legal move that ends in a destination square
- **When** the mouse button is released
- **Then** an independent pixel oracle verifies the destination piece settles, the floating overlay disappears, and the source has no unintended duplicate
- **And** stale ghost or incorrect piece detection fails automatically.

#### Scenario: Oracle cannot identify rendered piece

- **Given** an unsupported renderer, ambiguous pixels, or an obscured chessboard
- **When** the image oracle cannot confidently determine the piece location
- **Then** the test reports `INCONCLUSIVE` with diagnostic text
- **And** cannot silently pass the corresponding required visual assertion.

### Requirement: Model rapid tactical puzzle use correctly

FeelLab SHALL provide deterministic multi-puzzle and high-frequency sequences that combine legal and illegal actions, forced responses, click and drag, premove eligibility, captures, promotions, castling, cancellation, orientation changes and overlapping animations. It SHALL validate actual input acceptance rather than only rendered animation speed.

#### Scenario: Rapid puzzle tour

- **Given** at least 100 legally verified short tactical fixtures and a fixed input seed
- **When** the test runs the full rapid sequence
- **Then** every expected move is accepted exactly once in order
- **And** illegal attempts do not mutate the board
- **And** total completion, drop-to-ready and missed/duplicate input rates are reported.

#### Scenario: Next intended move during automatic reply

- **Given** a puzzle that performs an automatic opponent reply
- **When** a new user move is attempted before that reply finishes visually
- **Then** the test records whether it is accepted immediately, queued as a supported premove or rejected
- **And** checks against the configured interaction policy
- **And** no move disappears silently or is counted twice.

### Requirement: Controlled feel-profile experiments

FeelLab SHALL allow opt-in, isolated measurement of pickup-on-down, drag threshold and adaptation, origin opacity, animation duration, audio cold/warm behavior and drop callback/cleanup ordering. The test-only variants SHALL NOT change production defaults without separate review.

#### Scenario: Compare pickup thresholds

- **Given** repeatable input trajectories and tested drag thresholds of 0, 1, 2, 3, 4 and 6 pixels
- **When** variants are run in controlled alternating order
- **Then** the report compares activation distance, first-visible-response timing, accidental drags, click failures and successful completion
- **And** does not assume zero threshold means immediate pointerdown pickup.

#### Scenario: Compare motion and sound profiles

- **Given** controlled animation durations, origin opacity, sound setup and callback-order variants
- **When** each parameter is varied independently against a baseline
- **Then** the suite reports timing and correctness trade-offs
- **And** a variant is not declared objectively best solely from JavaScript execution time.

### Requirement: Separate browser, native-WebView and physical-display claims

The suite SHALL run portable browser correctness checks in Chromium and WebKit; support a dedicated macOS Tauri/WKWebView fixture and external BlindBase integration; and optionally analyze timestamped frames using ScreenCaptureKit. It SHALL label different engines and distinguish software frame capture from physical mouse-to-photon timing.

#### Scenario: Native macOS desktop measurement

- **Given** a controlled Mac host with permissions and a test-only Tauri fixture
- **When** the native runner executes the shared scenario manifest
- **Then** WebDriverIO or equivalent supported native automation supplies the input
- **And** ScreenCaptureKit records rendered frames with capture-drop accounting
- **And** JS/native clocks are calibrated with stated uncertainty
- **And** results identify the host, runtime, resolution, refresh and application revision.

#### Scenario: BlindBase integration

- **Given** an external installed BlindBase test build exposing documented test-only hooks
- **When** the optional native adapter runs
- **Then** it reuses the same scenario and assertion contract without importing private BlindBase source into the GigaBoard repository
- **And** GigaBoard runs independently when BlindBase is absent
- **And** private chess databases, application screenshots and traces are not published by default.

### Requirement: Accessible and calibrated regression gates

FeelLab SHALL provide deterministic correctness and accessibility checks as a standard CI gate; calibrated performance regression checks on controlled hardware; and a fully readable baseline-comparison report. Thresholds must derive from baseline repeatability with explicit uncertainty, not arbitrary performance claims.

#### Scenario: Correctness regression

- **Given** a known baseline and a mutation such as a stale drag ghost, wrong destination, duplicate callback, missed next move or absent pickup feedback
- **When** the regular CI suite runs
- **Then** the corresponding independent state, event or pixel assertion fails
- **And** the textual report explains which observable invariant broke and how to reproduce it.

#### Scenario: Performance regression

- **Given** the same dedicated host profile and sufficient repeated baseline/candidate trials
- **When** a calibrated latency budget is exceeded reproducibly
- **Then** the controlled performance gate reports FAIL with samples, effect size and uncertainty
- **And** runs dominated by environmental noise report INCONCLUSIVE instead of fabricating precision.

#### Scenario: Accessible interaction preserved

- **Given** a board interaction change or test-only feel variant
- **When** automated keyboard, focus, ARIA and LiveRegion checks run
- **Then** keyboard-only move/promotion/cancel remains operable, announcements remain correct, and reduced-motion is honored
- **And** applicable human-facing announcement strings are verified for English, Russian and Hebrew
- **And** a purely visual speed improvement cannot override a failed accessibility invariant.

### Requirement: Preserve release-size, performance, and license constraints

All FeelLab drivers, frame helpers and instrumentation SHALL remain outside the normal published GigaBoard runtime; the suite SHALL guard current architectural budgets and use only license-approved dependencies.

#### Scenario: Production package validation

- **Given** a normal production GigaBoard build
- **When** bundle and architecture checks run
- **Then** no test driver, native ScreenCaptureKit helper or instrumentation hook is included in the published runtime
- **And** zero React drag-frame commits, existing move commit expectations, bundle size, reduced-motion, and SSR contracts remain intact
- **And** no Chessground GPL code is copied into the distributed implementation.
