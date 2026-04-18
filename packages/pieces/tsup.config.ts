import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "sets/cburnett": "src/sets/cburnett.ts",
    "sets/merida": "src/sets/merida.ts",
    "sets/alpha": "src/sets/alpha.ts",
    "sets/neo": "src/sets/neo.ts",
    "sets/chesscom": "src/sets/chesscom.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: true,
  target: "es2022",
  treeshake: true,
  minify: false,
  external: ["react"],
});
