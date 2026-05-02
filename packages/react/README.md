# @ultrachess/react

Opinionated React chessboard with owned state, byte-scoped subscriptions, refs-only drag, WAAPI piece movement, Canvas arrows, bundled move sounds, SSR static rendering, WAI-ARIA keyboard parity, and a polished default board using `@ultrachess/themes/green` plus `@ultrachess/pieces/neo`. Powered by [`ultrachess`](https://github.com/yahorbarkouski/ultrachess) (WASM) and [`@ultrachess/core`](../core).

## Status

`1.1.x` — interactive board, drag, animations, arrows, premoves, sounds, themes, piece sets, and SSR static rendering are shipped.

## Entry points

- `@ultrachess/react` — interactive board (client component).
- `@ultrachess/react/server` — static SSR board (zero client JS).
- `@ultrachess/react/canvas` — opt-in full-canvas renderer (post-1.0).

## Size budget

- `@ultrachess/react` < 16 KB gzip.
- `@ultrachess/react/server` < 4 KB gzip.

Enforced in CI via `size-limit`.
