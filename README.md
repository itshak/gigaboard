# Ultra Chess React

The fastest React chessboard — powered by [`ultrachess`](https://github.com/yahorbarkouski/ultrachess) (WASM).

> **117× faster move validation**, **2 728× faster legal-move lookup**,
> **2.9× fewer React commits per move** than `react-chessboard` 5.10.0.
> Every number here is backed by a committed benchmark — see
> [`BENCH.md`](BENCH.md).

## Packages

| Package                                          | Budget (gzip) | Measured |
|--------------------------------------------------|--------------:|---------:|
| [`@ultrachess/core`](packages/core)              |         6 KB  |  3.73 KB |
| [`@ultrachess/react`](packages/react)            |        14 KB  | 12.32 KB |
| [`@ultrachess/react/server`](packages/react) (RSC) |       4 KB  |  2.27 KB |
| [`@ultrachess/pieces/{neo,chesscom,…}`](packages/pieces) | 2 KB / set | ~615 B |
| [`@ultrachess/themes/{green,brown,blue,wood}`](packages/themes) | 1 KB / theme | ~210 B |

## Quick start

Install the React package and the chess engine it depends on:

```bash
bun add @ultrachess/react ultrachess
```

Then render a board (client component):

```tsx
"use client";

import { Chessboard, useChessGame } from "@ultrachess/react";
import { green } from "@ultrachess/themes/green";
import { neo } from "@ultrachess/pieces/neo";

export default function Board() {
  const game = useChessGame();
  return (
    <Chessboard
      game={game}
      theme={green}
      pieces={neo}
      sound           // chess.com-style move cues, on by default
      onMove={(m) => console.log("played", m)}
    />
  );
}
```

Or drop a zero-JS static board into a React Server Component:

```tsx
import { StaticChessboard } from "@ultrachess/react/server";

export default function Diagram() {
  return (
    <StaticChessboard fen="r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 4 4" />
  );
}
```

## Why

- **Engine.** `ultrachess` ([repo](https://github.com/yahorbarkouski/ultrachess)) is a WASM-first chess engine with O(1) `hash()` and bitboard-parallel move generation. It perfts at 336 Mnps on Node and 581 Mnps on Bun — 55–95× faster than `chess.js`.
- **React layer.** Per-byte subscriptions on `Uint8Array(64)`, canvas-2D arrows, refs-only drag (zero re-renders per frame), WAAPI piece animation off the React commit path, Context-for-services-not-state. The result: **one** commit per move.
- **Tree-shakeable.** `@ultrachess/pieces/neo` imports one renderer; nothing else comes along. `@ultrachess/themes/green` imports one CSS-variable record. Ship only what you use.
- **RSC-ready.** `@ultrachess/react/server` is a React Server Component that produces a static 8×8 board from a FEN. Zero client JS unless the interactive board also mounts.
- **Accessible.** WAI-ARIA grid pattern, roving tabindex keyboard nav, screen-reader live region announcing SAN in prose, `prefers-reduced-motion` respected throughout.
- **Chess.com-parity out of the box.** Default sound set mirrors chess.com's `move-self`/`capture`/`castle`/`move-check`/`promote`/`game-end` cues. `pieces/chesscom` and `themes/green` match the look of the chess.com board pixel-for-pixel.

## Apps & examples

- [`apps/docs`](apps/docs) — Next.js 15 docs site.
- [`apps/benchmarks`](apps/benchmarks) — Node microbenchmarks + React Profiler harness (see [`BENCH.md`](BENCH.md)).
- [`examples/next-minimal`](examples/next-minimal) — smallest working Next.js setup.
- [`examples/next-analysis`](examples/next-analysis) — analysis board with a static SSR variant.
- [`examples/puzzle-trainer`](examples/puzzle-trainer) — premove + next-puzzle flow.

## Dev

```bash
bun install
bun run turbo build test size     # everything CI runs
bun run turbo bench               # benchmark harness → bench-results/
bun -F @ultrachess/docs dev       # docs site → http://localhost:3000
```

## Contributing

Read these in order:

1. [`docs/STANDARDS.md`](docs/STANDARDS.md) — the quality bar. No exceptions.
2. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how the layers fit together.
3. [`docs/TESTING.md`](docs/TESTING.md) — what we test and why.
4. [`docs/PERFORMANCE.md`](docs/PERFORMANCE.md) — budgets + profiling.
5. [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) — PR checklist.

## License

MIT © Yahor Barkouski
