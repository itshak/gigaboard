# Design: Correct move acknowledgment and classification independent of arrows

## Existing behavior and problem

`useMoveSound(...,{trigger:"position"})` intentionally suppresses locally speculative `historyPly` sounds. `Chessboard` then plays when the consumer's controlled `positionFen` advances. Its equality fast path only executes when `managedArrows===undefined`. Any arrow array selects the visual-sync branch; when `game.engine.fen()===positionFen`, `syncPositionFen` reports no position change and the notification vanishes. Neither branch currently has an explicit immutable acknowledgment object.

GigaBoard 1.7.2's FEN inference is useful for direct controlled updates but intentionally conservative. `lastAnimations` is not an authoritative move classifier after `load` because its diff fallback is fade/disappear. `capture` vs `moveSelf` cannot be decided from `inCheck` alone.

## State/event contract

1. **Local tentative commit.** Before/after model snapshot and the original `tryMove` feedback descriptors are recorded with a monotonically ordered internal move attempt identity. The onMove callback may cause synchronous or asynchronous host acceptance; a rejection/rollback discards pending cues.
2. **Host acknowledgment.** An accepted controlled `positionFen` matching that local commit consumes the pending semantic cue, even when engine FEN is already equal. This acknowledgment is independent of `managedArrows` and animations. The cue is emitted once; repeated render/effect/layout updates are idempotent.
3. **Host-driven transition.** A direct new controlled `positionFen` without pending local move is classified from reliable `positionTransition` UCI and before/after board, or conservatively inferred from the pair of board snapshots. Missing or contradictory metadata does not justify a fabricated capture. Rewinds, multi-ply FEN replacements, and initial hydration follow explicit product semantics; document navigation cue policy.
4. **Non-move visual updates.** `game.syncPosition({managedArrows})` is allowed to update arrows regardless of FEN equality but must not clear semantic evidence or be confused with new chess moves.
5. **Audio ownership.** `onCue` is a single semantic delivery to the consumer. The library's internal pool is used only when no `onCue` is provided. `sound.enabled` and `trigger` continue to control subscriptions and callbacks.

Prefer a small, stable `pendingConfirmedFeedback` record/ref inside `Chessboard` or equivalent model API that preserves pre/post descriptors across React effects. Introduce an optional accepted-move identity/metadata prop only if the existing `positionTransition` and FEN cannot resolve real branch/path or repeated-position ambiguity; avoid breaking consumers. Do **not** merely remove `managedArrows===undefined` without proving the resulting state machine handles rejection and duplicates.

Under `cuePolicy:"san-priority"`: capture > castle > promotion > check/mate > ordinary, including capture+check/mate/promotion and en passant. `cuePolicy:"default"` still prioritizes terminal moves, promotions and checks as before. Haptics must use their independently configured policy, and no new audio may be emitted on arrow-only syncs.

## Diagnostic split

Capture not heard may be (a) no confirmed cue, (b) `moveSelf` wrongly classified, (c) `capture` emitted but host maps/loads/plays incorrectly. Tests and optional dev-only hooks should separately assert `onCue` key and count, source of descriptors and confirmation outcome. Avoid logging private move sequences or FENs in release builds; do not add a new logger dependency.

## Tests that must fail first against current source

- Local `game.tryMove` + rerender `positionFen=game.engine.fen()` with `managedArrows=[]`, non-empty arrows, and undefined: all assert exactly one cue; initial render and arrow updates are silent.
- Repeat for capture, quiet check and promotion; both mouse click and drag event paths, including native-like consumer response delay and onMove callback accepted/rejected.
- Keyboard-style externally controlled FEN to capture, en passant, capture-promotion, capture+check/mate; run both with and without `positionTransition`, `managedArrows` populated, while preserving check-only behavior.
- Non-inferable FEN diff, undo/redo, repeated positions, castling, null move, and missing UCI metadata produce only contractually intended cues.
- No duplicate sound after StrictMode, unrelated React rerenders, arrow toggles, animation changes, and `sound` option identity changes.
- `onCue` injection skips internal `HTMLAudioElement` entirely; `enabled=false` is silent; default `trigger=model` regression unchanged.
- Integrated BlindBase native adapter (cross-repo) receives `capture` key and maps it to themed capture asset.

## Verification and release

Run targeted Vitest/component tests locally plus typecheck, build and relevant existing feel/drag tests. CI only by explicit owner direction, given private minutes. Publish a patch only after the tests are green, inspect its emitted ESM capability marker and exact resolved dependency, then let BlindBase test audibility in native macOS WKWebView. Do not treat Playwright browser behavior as native Mac confirmation.
