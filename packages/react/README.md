# @ultrachess/react

Opinionated React chessboard with owned state, byte-scoped subscriptions, refs-only drag, WAAPI piece movement, Canvas arrows, bundled move sounds, optional mobile haptics, SSR static rendering, WAI-ARIA keyboard parity, and a polished default board using `@ultrachess/themes/green` plus `@ultrachess/pieces/neo`. Powered by [`ultrachess`](https://github.com/yahorbarkouski/ultrachess) (WASM) and [`@ultrachess/core`](../core).

## Status

`1.1.x` — interactive board, drag, animations, arrows, premoves, sounds, mobile haptics, themes, piece sets, and SSR static rendering are shipped.

## Move feedback

- `sound={false}` keeps audio fully disabled.
- `sound` / `useMoveSound` allocate audio pools lazily on the first forward move that needs a cue.
- `haptics` / `useMoveHaptics` provide mobile-only tactile feedback using the same move-cue classifier as sound.
- `triggerMoveHaptic` is available for controlled-FEN analysis boards that need to emit feedback outside the board model history.

## Entry points

- `@ultrachess/react` — interactive board (client component).
- `@ultrachess/react/server` — static SSR board (zero client JS).
- `@ultrachess/react/canvas` — opt-in full-canvas renderer (post-1.0).

## Size budget

- `@ultrachess/react` < 16 KB gzip.
- `@ultrachess/react/server` < 4 KB gzip.

Enforced in CI via `size-limit`.
