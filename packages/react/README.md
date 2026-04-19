# @ultrachess/react

The fastest React chessboard on the planet. Powered by [`ultrachess`](https://github.com/yahorbarkouski/ultrachess) (WASM) and [`@ultrachess/core`](../core).

## Status

`0.0.0` — scaffolding. The interactive `<Chessboard/>` lands in M2, drag + animations in M3, arrows + premoves in M4.

## Entry points

- `@ultrachess/react` — interactive board (client component).
- `@ultrachess/react/server` — static SSR board (zero client JS).
- `@ultrachess/react/canvas` — opt-in full-canvas renderer (post-1.0).

## Size budget

- `@ultrachess/react` < 15 KB gzip.
- `@ultrachess/react/server` < 4 KB gzip.

Enforced in CI via `size-limit`.
