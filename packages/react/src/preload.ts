/**
 * `preloadEngine` — warm the default `ultrachess` WASM module ahead of first use.
 *
 * A thin alias over `@ultrachess/core`'s `preloadUltrachessAdapter()`, exposed
 * here so consumers of the React package don't have to reach into `core` for
 * what is logically a one-liner in an app's entry module.
 */

import { preloadUltrachessAdapter } from "@ultrachess/core";

/**
 * Start fetching / compiling / instantiating the `ultrachess` WASM module now,
 * rather than at the moment `useChessGame()` first runs inside a component.
 *
 * The WASM compile is a ~250 ms one-time cost. Without preload, that cost
 * lands *after* React has already mounted (because `useChessGame()` kicks it
 * off inside a `useEffect`) — which means the user sees the board but can't
 * move a piece for ~250 ms. With preload, the engine is almost always ready
 * before `useChessGame()` ever runs, because the init overlaps with HTML
 * parse, JS download, and React hydration.
 *
 * Call once at app boot. Idempotent — repeat calls return the same Promise
 * and do no extra work.
 *
 * @example
 * ```tsx
 * // Next.js App Router: app/layout.tsx
 * import { preloadEngine } from "@ultrachess/react";
 * preloadEngine();  // fire-and-forget, runs at module-import time
 *
 * export default function RootLayout({ children }: { children: React.ReactNode }) {
 *   return <html><body>{children}</body></html>;
 * }
 * ```
 *
 * @example
 * ```ts
 * // Vite / CRA: src/main.tsx
 * import { preloadEngine } from "@ultrachess/react";
 * preloadEngine();
 * ```
 *
 * @remarks
 * Pair with a preload hint in the HTML `<head>` so the browser starts the
 * WASM fetch alongside HTML parse:
 *
 * ```html
 * <link rel="preload" as="fetch" href="/path/to/ultrachess_bg.wasm" crossorigin>
 * ```
 *
 * The exact path depends on your bundler's asset-emission strategy; see the
 * `ultrachess` README for specifics per bundler.
 *
 * @returns A Promise that resolves when the engine module is ready. Most
 *   callers can ignore the return value.
 */
export function preloadEngine(): Promise<void> {
  return preloadUltrachessAdapter();
}
