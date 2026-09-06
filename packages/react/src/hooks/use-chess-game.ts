"use client";

/**
 * Own a `BoardModel` across the lifetime of a component.
 *
 * The engine (`gigachess`) initializes synchronously (<0.5 ms), so the model
 * is active and non-null immediately on frame 0. Pieces are grabbable and
 * responsive to pointer events on the initial render commit without an
 * intermediate async gap.
 */

import { useEffect, useRef, useState } from "react";
import {
  type BoardModel,
  type BoardModelOptions,
  createBoardModel,
  createGigachessAdapter,
} from "../core/index.js";
import type { UseChessGameOptions } from "../types.js";

/**
 * Allocate a board model bound to a fresh `gigachess` engine. The model
 * is created synchronously on the initial render, lives for the lifetime of
 * the calling component, and is disposed on unmount.
 *
 * @remarks
 * Synchronous initialization on frame 0 ensures zero layout shift and 0 ms
 * long tasks during mount. Changing `options.fen` disposes the current model
 * and allocates a fresh one.
 */
export function useChessGame(options: UseChessGameOptions & BoardModelOptions = {}): BoardModel {
  const { fen, ...modelOptions } = options;
  const [initialModelOptions] = useState<BoardModelOptions>(() => modelOptions);

  // Synchronous initialization on frame 0 via createGigachessAdapter (<0.5 ms)
  const [model, setModel] = useState<BoardModel>(() => {
    const adapter = createGigachessAdapter(fen);
    return createBoardModel(adapter, modelOptions);
  });

  // Track FEN changes: reallocate model if lifecycle FEN input changes
  const prevFenRef = useRef<string | undefined>(fen);
  useEffect(() => {
    if (prevFenRef.current !== fen) {
      prevFenRef.current = fen;
      const adapter = createGigachessAdapter(fen);
      const nextModel = createBoardModel(adapter, initialModelOptions);
      setModel((prev) => {
        prev.dispose();
        return nextModel;
      });
    }
  }, [fen, initialModelOptions]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      model.dispose();
    };
  }, [model]);

  return model;
}
