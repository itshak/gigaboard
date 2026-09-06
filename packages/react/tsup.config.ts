import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    core: "src/core/index.ts",
    server: "src/server.tsx",
    canvas: "src/renderers/canvas.ts",
    pieces: "src/pieces/index.ts",
    "pieces/neo": "src/pieces/sets/neo.ts",
    "pieces/cburnett": "src/pieces/sets/cburnett.ts",
    "pieces/merida": "src/pieces/sets/merida.ts",
    "pieces/alpha": "src/pieces/sets/alpha.ts",
    "pieces/chesscom": "src/pieces/sets/chesscom.ts",
    themes: "src/themes/index.ts",
    "themes/brown": "src/themes/brown.ts",
    "themes/blue": "src/themes/blue.ts",
    "themes/green": "src/themes/green.ts",
    "themes/wood": "src/themes/wood.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: true,
  target: "es2022",
  treeshake: true,
  minify: false,
  external: ["react", "react-dom", "web-haptics", "gigachess"],
  // Move-sound MP3s are referenced via static `new URL(..., import.meta.url)`
  // expressions and copied by the package build script. Leaving those
  // expressions intact lets consumer bundlers rebase or emit the assets.
});
