# Ultra Chess React

The fastest React chessboard on the planet — powered by [`ultrachess`](https://github.com/yahorbarkouski/ultrachess) (WASM).

> `ultrachess` perfts at **336 Mnps on Node** and **581 Mnps on Bun** — 55–95× faster than `chess.js`. Ultra Chess React extracts every drop of that into a React layer that costs ≤ 4 component re-renders per move, 0 per hover, 0 per drag frame.

## Status

`0.0.0` — scaffolding. See [`docs/`](docs/) and the [plan](/Users/yahorbarkouski/.claude/plans/enumerated-foraging-crescent.md) for the milestone breakdown.

## Packages

| Package | Status | Budget (gzip) |
|---|---|---|
| [`@ultrachess/core`](packages/core) — framework-agnostic state machine | M1 | < 6 KB |
| [`@ultrachess/react`](packages/react) — interactive board | M2–M5 | < 14 KB |
| [`@ultrachess/react/server`](packages/react) — static SSR board | M5 | < 4 KB |
| [`@ultrachess/pieces`](packages/pieces) — SVG piece sets | M6 | < 2 KB / set |
| [`@ultrachess/themes`](packages/themes) — board themes (CSS vars only) | M6 | < 1 KB / theme |

## Apps & examples

- [`apps/docs`](apps/docs) — Next.js 15 docs site (MDX + live playgrounds).
- [`apps/benchmarks`](apps/benchmarks) — React Profiler + PerformanceObserver harness.
- [`examples/next-minimal`](examples/next-minimal) — smallest working Next.js setup.
- [`examples/next-analysis`](examples/next-analysis) — analysis board (history + arrows + premoves).
- [`examples/puzzle-trainer`](examples/puzzle-trainer) — premove / puzzle-next flow.

## Quick start

```bash
bun install
bun run turbo build
bun run turbo test
bun run dev                      # start all dev servers
bun -F @ultrachess/docs dev      # docs only — http://localhost:3000
```

## Contributing

Read these in order before your first PR:

1. [`docs/STANDARDS.md`](docs/STANDARDS.md) — the quality bar. No exceptions.
2. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how the layers fit together.
3. [`docs/TESTING.md`](docs/TESTING.md) — what we test and why.
4. [`docs/PERFORMANCE.md`](docs/PERFORMANCE.md) — budgets, profiling, benchmarks.
5. [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) — workflow + PR checklist.

## License

MIT © Yahor Barkouski
