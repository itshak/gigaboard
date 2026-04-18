"use client";

/**
 * Own a `BoardModel` across the lifetime of a component.
 *
 * The engine (`ultrachess`) is imported asynchronously, so the model is
 * `null` during the brief window between mount and first `setState` with the
 * live model. Consumers pass this nullable value into `<Chessboard/>`, which
 * renders a visually-identical placeholder while `null`.
 */

import {
  type BoardModel,
  type BoardModelOptions,
  createBoardModel,
  createUltrachessAdapter,
} from "@ultrachess/core";
import { useEffect, useState } from "react";
import type { UseChessGameOptions } from "../types.js";

/**
 * Allocate a board model bound to a fresh `ultrachess` engine. The model
 * lives for the lifetime of the calling component and is disposed on
 * unmount.
 *
 * @remarks
 * `useEffect` owns the lifecycle rather than `useMemo` because async work is
 * involved. Returning `null` until init completes is deliberate — it forces
 * consumers to handle the loading state explicitly rather than having silent
 * no-op moves during the async gap.
 */
export function useChessGame(
  options: UseChessGameOptions & BoardModelOptions = {},
): BoardModel | null {
  // Hooks rule: every render must see the same hook order. Stable over renders.
  const { fen, ...modelOptions } = options;

  const [model, setModel] = useState<BoardModel | null>(null);

  useEffect(() => {
    let cancelled = false;
    let active: BoardModel | null = null;

    (async () => {
      const adapter = await createUltrachessAdapter(fen);
      if (cancelled) {
        adapter.dispose();
        return;
      }
      active = createBoardModel(adapter, modelOptions);
      setModel(active);
    })().catch((err) => {
      // Surface the init failure to a boundary — don't swallow.
      if (!cancelled) throw err;
    });

    return () => {
      cancelled = true;
      active?.dispose();
      active = null;
      // Replace with `null` so the next mount starts clean and any
      // downstream memoisation keyed on `model` invalidates cleanly.
      setModel(null);
    };
    // `fen` is the only field that should trigger a full re-init. Model
    // options that change over a session are applied through the model's
    // own methods, not by tearing it down.
    // biome-ignore lint/correctness/useExhaustiveDependencies: modelOptions is a stable, sub-pattern derivative
  }, [fen]);

  return model;
}
