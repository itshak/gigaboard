/**
 * `preloadEngine` — warm the default `gigachess` tables ahead of first use.
 *
 * A thin alias over `@gigaboard/core`'s `preloadGigachessAdapter()`, exposed
 * here so consumers of the React package don't have to reach into `core` for
 * what is logically a one-liner in an app's entry module.
 */

import { preloadGigachessAdapter } from "@gigaboard/core";

/**
 * Preload gigachess attack and Zobrist tables ahead of time.
 *
 * Call once at app boot. Idempotent — repeat calls return the same Promise
 * and do no extra work.
 *
 * @example
 * ```tsx
 * // Next.js App Router: app/layout.tsx
 * import { preloadEngine } from "gigaboard";
 * preloadEngine();  // fire-and-forget, runs at module-import time
 *
 * export default function RootLayout({ children }: { children: React.ReactNode }) {
 *   return <html><body>{children}</body></html>;
 * }
 * ```
 *
 * @returns A Promise that resolves when tables are ready.
 */
export function preloadEngine(): Promise<void> {
  return preloadGigachessAdapter();
}
