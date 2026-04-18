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

- `tsup.config.ts` sets `loader: { ".mp3": "file" }` so esbuild copies each
  referenced MP3 into `dist/` with a hashed name and replaces the
  `import x from "./sounds/...mp3"` call with the emitted URL string.
- `assets.d.ts` gives TypeScript a `string` type for those imports.
- Modern bundlers (Next.js, Vite, Webpack 5) re-resolve the emitted URL via
  their own static-asset handling, so the files land in the consumer app's
  public directory automatically.
