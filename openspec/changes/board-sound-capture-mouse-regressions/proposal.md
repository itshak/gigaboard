# Change: Correct confirmed-position mouse and capture sounds

**Status:** PROPOSED, not implemented. **Date:** 2026-11-11.
**Consumer:** BlindBase companion OpenSpec `board-sound-capture-mouse-regressions`, `itshak/blindbase`.

## User evidence

BlindBase's native macOS user reports silence on mouse moves even though keyboard moves sound; captures still fail to produce their distinct sound, while check is audible. BlindBase already pins GigaBoard 1.7.2, which was released to fix controlled-FEN capture classification. That release's isolated tests do not exercise the real controlled+managed-arrows+local-commit integration.

## Confirmed code-level defect

GigaBoard `packages/react/src/chessboard.tsx` has a sound-on-host-confirmation early branch:
`if (game.engine.fen() === positionFen && managedArrows === undefined)`.
When controlled `positionFen` acknowledges an already-applied local `game.tryMove`, but `managedArrows` is present, execution falls through to `syncPositionFen`, which returns `positionChanged=false`. The effect then returns without `triggerMoveSound`. BlindBase always supplies an array (possibly empty) for `managedArrows`. This conclusively demonstrates a missing-cue path for mouse local commits independent of whether the consumer's Web Audio works.

The capture symptom is still a *runtime diagnosis to complete*, not an independently proven distinct root cause. GigaBoard 1.7.2 added `inferControlledFeedbackDescriptors` for single-ply FEN-only captures, but when that returns null the effect falls back to `lastAnimations`, which after `load(fen)` describes appearances/disappearances, not captures. Separately, local-commit confirmation must retain its own original move semantics; visual/arrow sync must not erase them. Identify the actual failing path and capture key with instrumentation before assigning final causality.

## Proposed changes

- Separate the **acknowledged-move event** from managed-arrow/animation/position syncing. Emit a cue on a valid controlled host confirmation even if the engine already holds the confirmed FEN, for `managedArrows=undefined`, `[]` and non-empty arrays.
- Capture original move descriptors when `tryMove` commits and preserve them until host accepts/rejects. Never infer the semantic move from the post-commit board alone.
- Prefer verified accepted UCI transition information where supplied; preserve bounded FEN-only classification for a single unambiguous transition. Ensure every capture including en passant, check, promotion and mate is a capture under `san-priority`, with default built-in classification unchanged.
- Dedupe by actual accepted transition/confirmation identity rather than incidental rerender/arrow dependency. Do not play on initial hydration, rejected or rolled-back local attempts, previews, null moves, or pure arrow updates; retain current navigation policy and explicit consumer controls.
- Add failing regression tests first using a controlled `Chessboard` with arrows, a real local `tryMove`, then parent `positionFen` acknowledgment, plus direct keyboard-style FEN updates. Test sound cue count, classification, rollback and no duplicate cues.
- Preserve the `onCue` host-owned playback option (no second HTMLAudio backend), backwards compatibility with `sound={true|false}`, `trigger=model|position`, default cue policy, and board animation/performance.

**Non-goals:** changing audio files, adding speech/player backends, relying on SAN strings, modifying chess rules, disabling arrow overlays or altering drag thresholds.

**Release gate:** fix in source, verify with source and bundled output, publish next patch, then let BlindBase update its exact dependency and verify audible behavior on native macOS; do not claim the npm patch alone proves sound audibility.

**Pointers:** `packages/react/src/chessboard.tsx`, `hooks/use-move-sound.ts`, `lib/move-feedback.ts`, `lib/controlled-feedback.ts`, `core/board-model.ts`, `test/controlled-capture-sound.test.tsx`. Prior capture patch: https://github.com/itshak/gigaboard/commit/c04337eec370bbc34a290734a9ffa1b761e5680e
