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
  external: ["react", "react-dom", "ultrachess", "web-haptics"],
  // Emit MP3 move-sound assets as files in `dist/` and rewrite imports to
  // their runtime URLs. This keeps sound assets bundler-friendly — Next.js,
  // Vite, and any modern ESM bundler will re-resolve the emitted URL via
  // static asset handling.
  loader: {
    ".mp3": "file",
  },
});
