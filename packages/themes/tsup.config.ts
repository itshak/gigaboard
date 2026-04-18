import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    brown: "src/brown.ts",
    blue: "src/blue.ts",
    green: "src/green.ts",
    wood: "src/wood.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: true,
  target: "es2022",
  treeshake: true,
  minify: false,
});
