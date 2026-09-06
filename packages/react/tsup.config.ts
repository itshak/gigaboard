import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    server: "src/server.tsx",
    canvas: "src/renderers/canvas.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: true,
  target: "es2022",
  treeshake: true,
  minify: false,
  external: ["react", "react-dom", "web-haptics"],
  // Move-sound MP3s are referenced via static `new URL(..., import.meta.url)`
  // expressions and copied by the package build script. Leaving those
  // expressions intact lets consumer bundlers rebase or emit the assets.
});
