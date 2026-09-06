/**
 * Component tests for square textures, gradients, blend modes,
 * and piece filter accessibility styles across client and SSR.
 */

import { fireEvent, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { BoardModel } from "../src/core/index.js";
import { StaticChessboard } from "../src/server.js";
import { highContrast } from "../src/themes/highContrast.js";
import { newspaper } from "../src/themes/newspaper.js";
import { makeBoardModel, renderBoard } from "./helpers.js";

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("Square Textures and A11y Piece Filters", () => {
  let model: BoardModel;

  beforeEach(async () => {
    model = await makeBoardModel(STARTING_FEN);
  });

  afterEach(() => {
    model.dispose();
  });

  describe("Interactive Client Board (<Chessboard />)", () => {
    it("renders square elements with layered backgroundImage, backgroundSize, and backgroundBlendMode", () => {
      renderBoard(model, { theme: newspaper });

      const lightSquare = screen.getByRole("gridcell", { name: "b1" });
      const darkSquare = screen.getByRole("gridcell", { name: "a1" });

      // Light square styling
      expect(lightSquare.style.backgroundColor).toBe("var(--gb-sq-light)");
      expect(lightSquare.style.backgroundImage).toBe("var(--gb-sq-light-image,none)");
      expect(lightSquare.style.backgroundSize).toBe("var(--gb-sq-image-size,cover)");
      expect(lightSquare.style.backgroundBlendMode).toBe("var(--gb-sq-blend-mode,normal)");

      // Dark square styling
      expect(darkSquare.style.backgroundColor).toBe("var(--gb-sq-dark)");
      expect(darkSquare.style.backgroundImage).toBe("var(--gb-sq-dark-image,none)");
      expect(darkSquare.style.backgroundSize).toBe("var(--gb-sq-image-size,cover)");
      expect(darkSquare.style.backgroundBlendMode).toBe("var(--gb-sq-blend-mode,normal)");
    });

    it("applies white and black piece filters to PieceSlot elements", () => {
      renderBoard(model, { theme: highContrast });

      // White pawn on e2 (cell <= 6)
      const whitePieceSlot = document.querySelector<HTMLElement>(
        '[data-piece-square="e2"]',
      );
      expect(whitePieceSlot).not.toBeNull();
      expect(whitePieceSlot?.style.filter).toBe(
        "var(--gb-piece-filter-white, none)",
      );

      // Black pawn on e7 (cell > 6)
      const blackPieceSlot = document.querySelector<HTMLElement>(
        '[data-piece-square="e7"]',
      );
      expect(blackPieceSlot).not.toBeNull();
      expect(blackPieceSlot?.style.filter).toBe(
        "var(--gb-piece-filter-black, none)",
      );
    });

    it("applies piece filter CSS variables to pre-materialized DragLayer ghost slots", () => {
      renderBoard(model, { theme: highContrast });

      // Drag slot 1 = white pawn
      const whiteDragSlot = document.querySelector<HTMLElement>(
        '[data-drag-cell="1"]',
      );
      expect(whiteDragSlot).not.toBeNull();
      expect(whiteDragSlot?.style.filter).toBe(
        "var(--gb-piece-filter-white, none)",
      );

      // Drag slot 7 = black pawn
      const blackDragSlot = document.querySelector<HTMLElement>(
        '[data-drag-cell="7"]',
      );
      expect(blackDragSlot).not.toBeNull();
      expect(blackDragSlot?.style.filter).toBe(
        "var(--gb-piece-filter-black, none)",
      );
    });

    it("preserves selection and last-move pseudo-element integration on textured boards", () => {
      renderBoard(model, { theme: newspaper });

      const e2 = screen.getByRole("gridcell", { name: "e2" });
      const e4 = screen.getByRole("gridcell", { name: "e4" });

      // Select e2
      fireEvent.click(e2);

      // Square retains its textured background properties while selection controller writes dataset
      expect(e2.dataset["gbSelection"]).toBe("selected");
      expect(e2.style.backgroundImage).toBe("var(--gb-sq-light-image,none)");

      // Play e2-e4
      fireEvent.click(e4);

      // Square retains its textured background properties while last-move controller writes dataset
      expect(e2.dataset["gbLastMove"]).toBe("from");
      expect(e2.style.backgroundImage).toBe("var(--gb-sq-light-image,none)");

      expect(e4.dataset["gbLastMove"]).toBe("to");
      expect(e4.style.backgroundImage).toBe("var(--gb-sq-light-image,none)");
    });
  });

  describe("Server Static Board (<StaticChessboard />)", () => {
    it("renders square texture styles and piece filters in SSR HTML output", () => {
      const html = renderToStaticMarkup(
        <StaticChessboard fen={STARTING_FEN} theme={newspaper} />,
      );

      // Check light and dark square texture styles
      expect(html).toContain("background-image:var(--gb-sq-light-image,none)");
      expect(html).toContain("background-image:var(--gb-sq-dark-image,none)");
      expect(html).toContain("background-size:var(--gb-sq-image-size,cover)");
      expect(html).toContain(
        "background-blend-mode:var(--gb-sq-blend-mode,normal)",
      );

      // Check piece filter styles
      expect(html).toContain("filter:var(--gb-piece-filter-white, none)");
      expect(html).toContain("filter:var(--gb-piece-filter-black, none)");

      // Check newspaper theme custom properties are spread onto root container
      expect(html).toContain("--gb-sq-light-image:");
      expect(html).toContain("--gb-sq-dark-image:");
      expect(html).toContain("--gb-piece-filter-white:");
      expect(html).toContain("--gb-piece-filter-black:");
    });

    it("matches client square structure for zero-shift SSR hydration", () => {
      const html = renderToStaticMarkup(
        <StaticChessboard fen={STARTING_FEN} theme={newspaper} />,
      );

      // Has 64 gridcells with data-gb-square and data-light
      const squareMatches = html.match(/data-gb-square=""/g) ?? [];
      expect(squareMatches.length).toBe(64);
    });
  });
});
