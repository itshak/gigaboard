import { describe, expect, it } from "vitest";
import { isValidElement } from "react";
import {
  BOARD_CELL_KEY,
  PACKAGE_VERSION,
  alpha,
  cburnett,
  chesscom,
  chesscomPieceUrls,
  createImagePieceSet,
  merida,
  neo,
  pieceSets,
} from "../src/index.js";

/** Pull the `src` and `alt` from the renderer's output without needing react-dom. */
function inspect(set: ReturnType<typeof createImagePieceSet>, cell: number) {
  const node = set({ cell, square: 0 });
  if (node === null) return null;
  if (!isValidElement<{ src: string; alt: string }>(node)) {
    throw new Error("renderer did not return a React element");
  }
  return { src: node.props.src, alt: node.props.alt };
}

describe("@ultrachess/pieces", () => {
  it("exports a semver-looking version string", () => {
    expect(PACKAGE_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("every built-in set renders a white pawn and a black king with readable alt text", () => {
    for (const [name, set] of Object.entries(pieceSets)) {
      const wp = inspect(set, BOARD_CELL_KEY.wP);
      const bk = inspect(set, BOARD_CELL_KEY.bK);
      expect(wp, `${name}:wP`).not.toBeNull();
      expect(bk, `${name}:bK`).not.toBeNull();
      expect(wp?.alt).toBe("white pawn");
      expect(bk?.alt).toBe("black king");
    }
  });

  it("renders null for the empty cell (0) and out-of-range cells", () => {
    expect(neo({ cell: 0, square: 0 })).toBeNull();
    expect(neo({ cell: 99, square: 0 })).toBeNull();
  });

  it("chesscom is an alias for neo", () => {
    expect(chesscom).toBe(neo);
  });

  it("chesscomPieceUrls returns frozen URLs pointing at chess.com's CDN", () => {
    const urls = chesscomPieceUrls("neo");
    expect(Object.isFrozen(urls)).toBe(true);
    for (let cell = 1; cell <= 12; cell++) {
      const url = (urls as Record<number, string>)[cell];
      expect(url.startsWith("https://images.chesscomfiles.com/chess-themes/pieces/")).toBe(
        true,
      );
      expect(url).toMatch(/\.png$/);
    }
  });

  it("cburnett/alpha/merida/neo each point at a distinct chess.com style", () => {
    expect(inspect(cburnett, BOARD_CELL_KEY.wP)?.src).toContain("/classic/");
    expect(inspect(alpha, BOARD_CELL_KEY.wP)?.src).toContain("/alpha/");
    expect(inspect(merida, BOARD_CELL_KEY.wP)?.src).toContain("/neo_wood/");
    expect(inspect(neo, BOARD_CELL_KEY.wP)?.src).toContain("/neo/");
  });

  it("createImagePieceSet builds a custom set from a URL table", () => {
    const urls = chesscomPieceUrls("marble");
    const custom = createImagePieceSet(urls);
    const out = inspect(custom, BOARD_CELL_KEY.bQ);
    expect(out?.src).toContain("/marble/");
    expect(out?.src).toContain("bq.png");
  });
});
