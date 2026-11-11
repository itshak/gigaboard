# Tasks — proposal only; nothing implemented

## Diagnostic reproduction
- [x] 1.1 Create a failing test for a locally applied move followed by accepted `positionFen` where `managedArrows=[]`; repeat non-empty and undefined arrows.
- [x] 1.2 Reproduce a capturing mouse move and record which `onCue` key (if any) is produced; compare with keyboard-style direct FEN capture sync using identical pre/post positions and the actual consumer's settings.
- [x] 1.3 Identify classification-versus-delivery failures in a short technical audit before selecting code changes. Check built 1.7.2 files vs source for capability marker and capture inference.

## Correct semantic acknowledgment
- [x] 2.1 Preserve original local move feedback across host confirmation independent of managed arrow and visual sync branches; add stable dedupe and rejection handling.
- [x] 2.2 Ensure direct controlled updates use explicit accepted move metadata when available, with conservative FEN fallback; keep normal default policy unchanged.
- [x] 2.3 Resolve capture, en passant, capture+check/mate and capture-promotion under `san-priority`, and document ambiguity/null/rewind policy.

## Regression tests and delivery
- [x] 3.1 Cover local mouse drag and click-to-move, controlled keyboard-style move, arrow empty/nonempty/undefined, promotion, check, castle, rejection, rapid moves and repeated render.
- [x] 3.2 Test `onCue` alone (no HTMLAudio pool), `trigger=model` compatibility, sound enabled flags and haptic separation.
- [x] 3.3 Run focused local Vitest, TypeScript/build and drag/feel regressions; inspect published bundle contents. Do not run CI without explicit owner approval.
- [x] 3.4 Publish next patch version after verified tests; coordinate exact pin/integration acceptance with BlindBase.
- [x] 3.5 Sync stable specs, add documented diagnosis and archive only after BlindBase native macOS confirms audible mouse and capture sounds.

## Archive qualification

The completed checkboxes above concern the library implementation and automated browser gates. Native installed BlindBase/WKWebView speaker audibility is NOT RUN and is a downstream consumer acceptance task. npm release/publish is tracked as a separate follow-up after merging the archived implementation into main; this archive does not claim publication succeeded.
