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

import { useCallback, useEffect, useRef } from "react";
import type { BoardModel } from "../core/index.js";
import { classifyMoveFeedback, type MoveFeedbackKey } from "../lib/move-feedback.js";

/** The seven categories of move cue, mirroring chess.com's default set. */
export type MoveSoundKey = MoveFeedbackKey;

/** Sparse URL map — any key omitted falls back to the built-in local asset. */
export type MoveSoundSources = Partial<Readonly<Record<MoveSoundKey, string>>>;
export type TriggerMoveSound = (key: MoveSoundKey) => void;

/**
 * Default URL map. Points at the MP3 files shipped with this package; the
 * package build copies them next to the emitted JS under `dist/sounds/`.
 * Keeping these as static `new URL(..., import.meta.url)` expressions lets
 * consumer bundlers such as Vite and Next.js rebase/copy the files correctly.
 *
 * The `typeof import.meta.url` guard keeps the CommonJS build importable in
 * Node; browser ESM consumers get the fully resolved asset URLs.
 */
export const DEFAULT_MOVE_SOUND_SOURCES: Readonly<Record<MoveSoundKey, string>> = Object.freeze({
  moveSelf:
    typeof import.meta.url === "string"
      ? new URL("./sounds/move-self.mp3", import.meta.url).href
      : "./sounds/move-self.mp3",
  moveOpponent:
    typeof import.meta.url === "string"
      ? new URL("./sounds/move-opponent.mp3", import.meta.url).href
      : "./sounds/move-opponent.mp3",
  capture:
    typeof import.meta.url === "string"
      ? new URL("./sounds/capture.mp3", import.meta.url).href
      : "./sounds/capture.mp3",
  castle:
    typeof import.meta.url === "string"
      ? new URL("./sounds/castle.mp3", import.meta.url).href
      : "./sounds/castle.mp3",
  moveCheck:
    typeof import.meta.url === "string"
      ? new URL("./sounds/move-check.mp3", import.meta.url).href
      : "./sounds/move-check.mp3",
  promote:
    typeof import.meta.url === "string"
      ? new URL("./sounds/promote.mp3", import.meta.url).href
      : "./sounds/promote.mp3",
  gameEnd:
    typeof import.meta.url === "string"
      ? new URL("./sounds/game-end.mp3", import.meta.url).href
      : "./sounds/game-end.mp3",
});

/** Public configuration for the hook (and the `<Chessboard sound/>` prop). */
export interface MoveSoundOptions {
  /** Master switch. Default `true`. */
  readonly enabled?: boolean;
  /** Output volume, `0`–`1`. Default `1`. */
  readonly volume?: number;
  /** HTMLAudio preload mode. Default "none" (no background network work). */
  readonly preload?: "none" | "metadata" | "auto";
  /**
   * Opt-in eager creation/preload of the built-in audio pool on mount,
   * without attempting autoplay. Effective only for the built-in player;
   * injected players remain responsible for their own warmup.
   */
  readonly prewarm?: boolean;
  /**
   * Inject a host-owned playback backend. GigaBoard classifies and triggers
   * exactly one board cue; the host owns audio assets, Web Audio context,
   * theme, mute, volumes, audio focus and speech coordination. No built-in
   * HTMLAudio pool is allocated when this callback is provided.
   */
  readonly onCue?: (key: MoveSoundKey, volume: number) => void;
  /**
   * "model" (default): play on local engine model commits, with controlled
   * position syncs supported as before. "position": defer ALL move cues
   * until the controlled `positionFen` prop changes. This is necessary for
   * apps that may reject or roll back a local move after onMove is called.
   * No sound is played for initial position hydration.
   */
  readonly trigger?: "model" | "position";
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

/** Internal per-category pool record. */
type Pool = {
  readonly elements: HTMLAudioElement[];
  cursor: number;
};

function createPools(
  sources: Readonly<Record<MoveSoundKey, string>>,
  preload: MoveSoundOptions["preload"],
): Record<MoveSoundKey, Pool> {
  const pools = {} as Record<MoveSoundKey, Pool>;
  for (const key of Object.keys(sources) as MoveSoundKey[]) {
    const url = sources[key];
    const elements: HTMLAudioElement[] = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      const audio = new Audio(url);
      audio.preload = preload ?? "none";
      elements.push(audio);
    }
    pools[key] = { elements, cursor: 0 };
  }
  return pools;
}

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
export function useMoveSound(
  model: BoardModel | null,
  options: MoveSoundOptions = {},
): TriggerMoveSound {
  const {
    enabled = true,
    volume = 1,
    preload = "none",
    prewarm = false,
    onCue,
    trigger = "model",
    sources,
    perspective,
  } = options;

  const poolsRef = useRef<Record<MoveSoundKey, Pool> | null>(null);
  const sourcesRef = useRef<Readonly<Record<MoveSoundKey, string>>>(DEFAULT_MOVE_SOUND_SOURCES);
  const preloadRef = useRef(preload);
  const onCueRef = useRef(onCue);
  onCueRef.current = onCue;

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

  useEffect(() => {
    sourcesRef.current = {
      ...DEFAULT_MOVE_SOUND_SOURCES,
      ...(sources ?? {}),
    };
    poolsRef.current = null;
  }, [sources]);

  useEffect(() => {
    preloadRef.current = preload;
    poolsRef.current = null;
  }, [preload]);

  useEffect(() => {
    if (!enabled) {
      poolsRef.current = null;
    }
  }, [enabled]);

  // Opt-in warmup for the built-in HTMLAudio backend. Keeping it passive
  // avoids blocking the first visual commit; no play() gesture is attempted.
  useEffect(() => {
    if (!enabled || !prewarm || onCue) return;
    if (typeof window === "undefined" || typeof Audio === "undefined") return;
    if (poolsRef.current === null) {
      poolsRef.current = createPools(sourcesRef.current, preloadRef.current);
    }
  }, [enabled, prewarm, onCue, preload, sources]);

  const triggerMoveSound = useCallback<TriggerMoveSound>(
    (key) => {
      if (!enabled) return;
      if (typeof window === "undefined") return; // SSR guard.
      const effectiveVolume = Math.max(0, Math.min(1, volumeRef.current));
      if (onCueRef.current) {
        onCueRef.current(key, effectiveVolume);
        return;
      }
      if (typeof Audio === "undefined") return; // happy-dom lacks Audio.

      const pools = poolsRef.current ?? createPools(sourcesRef.current, preloadRef.current);
      poolsRef.current = pools;

      const pool = pools[key];
      if (pool === undefined) return;

      pool.cursor = (pool.cursor + 1) % pool.elements.length;
      const el = pool.elements[pool.cursor];
      if (el === undefined) return;
      el.volume = effectiveVolume;
      el.currentTime = 0;
      // Some browsers reject autoplay before a user gesture. Swallow the
      // rejection — once the user interacts, subsequent plays succeed.
      void el.play().catch(() => {
        /* autoplay blocked — will resolve after the first user gesture. */
      });
    },
    [enabled],
  );

  // Subscribe to the model. Fire the chosen cue on every commit that
  // increments `historyPly` (forward moves only — undo is silent, matching
  // chess.com). The subscription is cheap: one `subscribe` per enabled
  // mount and zero re-renders.
  useEffect(() => {
    if (!enabled || model === null || trigger === "position") return;

    let prevPly = model.getSnapshot().historyPly;

    return model.subscribe(() => {
      const snap = model.getSnapshot();
      if (snap.historyPly <= prevPly) {
        prevPly = snap.historyPly;
        return;
      }
      prevPly = snap.historyPly;

      const key = classifyMoveFeedback(model.lastAnimations, snap, perspectiveRef.current);
      triggerMoveSound(key);
    });
  }, [enabled, model, trigger, triggerMoveSound]);

  return triggerMoveSound;
}
