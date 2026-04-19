# next-showcase

Comprehensive Next.js 15 + `@ultrachess/react` example that exercises every
configurable knob on `<Chessboard/>` — a useful reference when you're deciding
what to wire up in your own app.

```bash
bun install
bun -F @ultrachess/example-next-showcase dev   # http://localhost:3001
```

## What it demonstrates

- **Themes** — live-swap between `brown`, `green`, `blue`, `wood` from
  `@ultrachess/themes`.
- **Piece sets** — live-swap between `neo`, `chesscom`, `alpha`, `cburnett`,
  `merida` from `@ultrachess/pieces`.
- **Orientation flip**, coordinate labels on/off, legal-target style
  (`rings` / `dots` / off), last-move highlight, check highlight, and
  illegal-move red-flash.
- **Interaction toggles** — drag-and-drop, right-click arrow drawing, and
  premove queuing (drag out-of-turn; toggles the premove ghost overlay).
- **Animation tuning** — enable/disable glide, live duration slider.
- **Sound** — volume slider plus explicit `sources` config (see below).
- **FEN presets + freeform input** — Italian Game, Najdorf, K+R endgame,
  Fool's Mate, or paste any FEN.
- **Live status + move log** — `useBoardSnapshot` drives the status strip
  (turn, check, game-over, premove queue depth), and the move log decodes
  `PackedMove` from the `onMove` callback.
- **Undo / redo / reset** wired to `BoardModel.undo() / redo()`.

## Sounds: why a `postinstall` script?

The seven move-sound `.mp3` assets ship bundled inside `@ultrachess/react`
with [tsup](https://tsup.egoist.dev/) content hashes (e.g.
`move-self-66AY7WGX.mp3`). The built bundle references them with relative
URLs that the consumer app's static-file handler then has to serve — but
Next.js's `public/` root doesn't know about files buried in `node_modules`,
so those fetches 404.

`scripts/copy-sounds.mjs` runs at `postinstall` and copies the assets into
`public/sounds/` with **stable** filenames (`move-self.mp3`, etc.).
`app/showcase.tsx` then passes them explicitly via the `sound.sources` prop:

```tsx
<Chessboard
  game={game}
  sound={{
    enabled: true,
    volume: 0.6,
    sources: {
      moveSelf: "/sounds/move-self.mp3",
      moveOpponent: "/sounds/move-opponent.mp3",
      capture: "/sounds/capture.mp3",
      castle: "/sounds/castle.mp3",
      moveCheck: "/sounds/move-check.mp3",
      promote: "/sounds/promote.mp3",
      gameEnd: "/sounds/game-end.mp3",
    },
  }}
/>
```

If you prefer to fetch them from a CDN or your own asset pipeline, just
replace those URLs — the `sources` prop accepts any addressable MP3.
