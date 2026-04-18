"use client";

/**
 * `useMoveSound` — drop-in chess.com-style move-sound effects.
 *
 * Plays one short audio cue on every committed move. The sound is picked
 * from the just-emitted `lastAnimations` descriptors and the post-move
 * snapshot, not from SAN — so the same hook works for drag, click,
 * keyboard, and `tryMove` invocations without any integration boilerplate.
 *
 * ### Design choices
 *
 * 1. **Local assets by default.** The seven chess.com MP3s ship in-package
 *    (see `src/sounds/`). Users may override any URL via the `sources`
 *    option — set one, set all, or set none. No runtime CDN dependency.
 * 2. **One pool per sound.** Each sound gets a {@link POOL_SIZE}-element
 *    pool of `HTMLAudioElement` so rapid-fire clicks don't cut each other
 *    off (the browser serializes `.play()` on a single element).
 * 3. **One cue per committed move.** We only fire when `historyPly`
 *    advances. Undo / redo-to-same-state is silent (matches chess.com).
 * 4. **SSR-safe.** `new Audio()` is guarded behind a `typeof window`
 *    check; the hook does nothing on the server.
 * 5. **`enabled={false}` zeroes all work.** No pool, no subscription, no
 *    allocation — pass `false` and the hook returns without side effects.
 *
 * The hook is self-contained: it does not call into the engine adapter,
 * it does not need `san()`, and it will not re-render the component.
 */

import type { BoardModel } from "@ultrachess/core";
import { useEffect, useRef } from "react";
import captureUrl from "../sounds/capture.mp3";
import castleUrl from "../sounds/castle.mp3";
import gameEndUrl from "../sounds/game-end.mp3";
import moveCheckUrl from "../sounds/move-check.mp3";
import moveOpponentUrl from "../sounds/move-opponent.mp3";
import moveSelfUrl from "../sounds/move-self.mp3";
import promoteUrl from "../sounds/promote.mp3";

/** The seven categories of move cue, mirroring chess.com's default set. */
export type MoveSoundKey =
  | "moveSelf"
  | "moveOpponent"
  | "capture"
  | "castle"
  | "moveCheck"
  | "promote"
  | "gameEnd";

/** Sparse URL map — any key omitted falls back to the built-in local asset. */
export type MoveSoundSources = Partial<Readonly<Record<MoveSoundKey, string>>>;

/**
 * Default URL map. Points at the MP3 files shipped with this package; the
 * tsup `file` loader rewrites these imports to hashed URLs at build time.
 */
export const DEFAULT_MOVE_SOUND_SOURCES: Readonly<Record<MoveSoundKey, string>> = Object.freeze({
  moveSelf: moveSelfUrl,
  moveOpponent: moveOpponentUrl,
  capture: captureUrl,
  castle: castleUrl,
  moveCheck: moveCheckUrl,
  promote: promoteUrl,
  gameEnd: gameEndUrl,
});

/** Public configuration for the hook (and the `<Chessboard sound/>` prop). */
export interface MoveSoundOptions {
  /** Master switch. Default `true`. */
  readonly enabled?: boolean;
  /** Output volume, `0`–`1`. Default `1`. */
  readonly volume?: number;
  /** Per-key URL overrides. Missing keys fall back to {@link DEFAULT_MOVE_SOUND_SOURCES}. */
  readonly sources?: MoveSoundSources;
  /**
   * Viewer perspective. When set, moves played *by* this colour use the
   * `moveSelf` cue and moves played by the opponent use `moveOpponent`. When
   * omitted (the default), every non-special move uses `moveSelf`.
   */
  readonly perspective?: 0 | 1;
}

/** How many audio elements per category. Four is enough for spam-clicking. */
const POOL_SIZE = 4;

/**
 * Classify the cue that should play for the given commit.
 *
 * Priority (highest wins):
 *   1. `gameEnd` if the engine reports `isGameOver`.
 *   2. `promote` / `castle` — structural moves always get their own cue
 *      even if they also deliver check, mirroring chess.com.
 *   3. `moveCheck` if the side-to-move is now in check.
 *   4. `capture` if any descriptor is a capture.
 *   5. `moveSelf` / `moveOpponent` otherwise.
 */
function classify(
  animations: ReadonlyArray<{ readonly kind: string }>,
  snapshot: { readonly isGameOver: boolean; readonly inCheck: boolean; readonly turn: 0 | 1 },
  perspective: 0 | 1 | undefined,
): MoveSoundKey {
  if (snapshot.isGameOver) return "gameEnd";

  let sawPromotion = false;
  let sawCastle = false;
  let sawCapture = false;
  for (const d of animations) {
    if (d.kind === "promotion") sawPromotion = true;
    else if (d.kind === "castle") sawCastle = true;
    else if (d.kind === "capture" || d.kind === "en-passant") sawCapture = true;
  }

  if (sawPromotion) return "promote";
  if (sawCastle) return "castle";
  if (snapshot.inCheck) return "moveCheck";
  if (sawCapture) return "capture";

  // The side that JUST moved is the opposite of the new side-to-move.
  if (perspective !== undefined) {
    const moverWasMe = snapshot.turn !== perspective;
    return moverWasMe ? "moveSelf" : "moveOpponent";
  }
  return "moveSelf";
}

/** Internal per-category pool record. */
type Pool = {
  readonly elements: HTMLAudioElement[];
  cursor: number;
};

/**
 * Drop-in hook. Mount inside a React tree that has a `BoardModel`. Pass
 * `null` while the engine is still loading — the hook no-ops until the
 * model is available.
 *
 * @example
 * ```tsx
 * useMoveSound(game, { enabled: soundOn, volume: 0.6 });
 * ```
 */
export function useMoveSound(model: BoardModel | null, options: MoveSoundOptions = {}): void {
  const { enabled = true, volume = 1, sources, perspective } = options;

  const poolsRef = useRef<Record<MoveSoundKey, Pool> | null>(null);

  // Keep a latest-value ref for volume so the pool doesn't tear down
  // every time the slider moves — we just update each element's volume
  // at play time.
  const volumeRef = useRef(volume);
  useEffect(() => {
    volumeRef.current = volume;
  });

  const perspectiveRef = useRef(perspective);
  useEffect(() => {
    perspectiveRef.current = perspective;
  });

  // Build / rebuild the pool whenever the URL set changes. A shallow
  // identity check on `sources` is enough — callers following the latest-
  // ref pattern or supplying a stable object will not thrash.
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return; // SSR guard.
    if (typeof Audio === "undefined") return; // happy-dom lacks Audio.

    const resolved: Record<MoveSoundKey, string> = {
      ...DEFAULT_MOVE_SOUND_SOURCES,
      ...(sources ?? {}),
    };

    const pools = {} as Record<MoveSoundKey, Pool>;
    for (const key of Object.keys(resolved) as MoveSoundKey[]) {
      const url = resolved[key];
      const elements: HTMLAudioElement[] = [];
      for (let i = 0; i < POOL_SIZE; i++) {
        const a = new Audio(url);
        a.preload = "auto";
        elements.push(a);
      }
      pools[key] = { elements, cursor: 0 };
    }
    poolsRef.current = pools;

    return () => {
      poolsRef.current = null;
    };
  }, [enabled, sources]);

  // Subscribe to the model. Fire the chosen cue on every commit that
  // increments `historyPly` (forward moves only — undo is silent, matching
  // chess.com). The subscription is cheap: one `subscribe` per enabled
  // mount and zero re-renders.
  useEffect(() => {
    if (!enabled || model === null) return;

    let prevPly = model.getSnapshot().historyPly;

    return model.subscribe(() => {
      const pools = poolsRef.current;
      if (pools === null) return;

      const snap = model.getSnapshot();
      if (snap.historyPly <= prevPly) {
        prevPly = snap.historyPly;
        return;
      }
      prevPly = snap.historyPly;

      const key = classify(model.lastAnimations, snap, perspectiveRef.current);
      const pool = pools[key];
      if (pool === undefined) return;

      pool.cursor = (pool.cursor + 1) % pool.elements.length;
      const el = pool.elements[pool.cursor];
      if (el === undefined) return;
      el.volume = Math.max(0, Math.min(1, volumeRef.current));
      el.currentTime = 0;
      // Some browsers reject autoplay before a user gesture. Swallow the
      // rejection — once the user interacts, subsequent plays succeed.
      void el.play().catch(() => {
        /* autoplay blocked — will resolve after the first user gesture. */
      });
    });
  }, [enabled, model]);
}
