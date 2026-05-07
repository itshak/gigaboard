# Move sound assets

The seven MP3 files in this directory are the chess.com default move-sound
set (`move-self`, `move-opponent`, `capture`, `castle`, `move-check`,
`promote`, `game-end`). They were fetched from

    https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/<key>.mp3

and committed locally so the React package ships a self-contained default
experience — no runtime CDN hit, no hotlink fragility.

## Licensing / redistribution note

These are chess.com's assets. Embedding them in an open-source library
that's published to npm is a **redistribution** that chess.com has not
explicitly licensed. If you intend to publish this package publicly, you
should either:

1. Replace these files with sounds you have the right to distribute (for
   example the [Lichess sounds](https://github.com/lichess-org/lila/tree/master/public/sound)
   are GPL-3.0 licensed and listed in that repo's `COPYING.md`), or
2. Swap the built-in set out at runtime via the `sound={{ sources: ... }}`
   prop on `<Chessboard/>` so no chess.com assets are shipped.

The sound plumbing in `hooks/use-move-sound.ts` is licence-agnostic — it's
just a URL map plus a pool.

## Build plumbing

- `useMoveSound` references these files with static
  `new URL("./sounds/<key>.mp3", import.meta.url)` expressions. Consumer
  bundlers can then rebase or emit the assets into the app build instead of
  leaving page-relative URLs behind.
- The package `build` script copies `src/sounds/*.mp3` into `dist/sounds/`
  so direct ESM consumers can resolve the same URLs without a CDN.
- `useMoveSound` creates the `Audio` pool lazily on first playback, so merely
  mounting a board with sound enabled does not create audio elements or start
  audio preloading.
