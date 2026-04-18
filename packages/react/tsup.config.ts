import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    server: "src/server.ts",
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
  external: ["react", "react-dom", "ultrachess"],
});
