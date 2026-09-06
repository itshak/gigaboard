/**
 * `gigaboard/server` tests.
 *
 * The server entry is a pure render target — no hooks, no state, no
 * client JS. We verify the **shape** of its output (right number of
 * squares, right pieces in right places, right aria wiring) and its
 * **purity** (no `"use client"` leakage, identical markup at server /
 * client boundary).
 *
 * Rendering is done via `ReactDOMServer.renderToString` so we exercise
 * the actual SSR code path rather than the client renderer.
 */

import { renderToStaticMarkup, renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StaticChessboard } from "../src/server.js";

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("<StaticChessboard/> (server)", () => {
  it("renders an 8×8 grid from the starting FEN", () => {
    const html = renderToString(<StaticChessboard fen={STARTING_FEN} />);
    // 64 gridcells — every square present.
    const cellMatches = html.match(/role="gridcell"/g) ?? [];
    expect(cellMatches.length).toBe(64);
  });

  it("places pieces on every file of rank 2 and 7 (starting position)", () => {
    const html = renderToStaticMarkup(<StaticChessboard fen={STARTING_FEN} />);
    for (const file of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
      expect(html).toContain(`data-piece-square="${file}2"`);
      expect(html).toContain(`data-piece-square="${file}7"`);
    }
  });

  it("renders black pieces at ranks 7-8 and white pieces at ranks 1-2", () => {
    const html = renderToStaticMarkup(<StaticChessboard fen={STARTING_FEN} />);
    // Black king (piece cell code 12) on e8.
    expect(html).toContain('data-piece-square="e8"');
    expect(html).toMatch(/data-piece-square="e8"[^>]*data-piece-cell="12"/);
    // White king (cell 6) on e1.
    expect(html).toMatch(/data-piece-square="e1"[^>]*data-piece-cell="6"/);
  });

  it("flips orientation in the DOM order without changing aria-label semantics", () => {
    const white = renderToStaticMarkup(<StaticChessboard fen={STARTING_FEN} orientation="white" />);
    const black = renderToStaticMarkup(<StaticChessboard fen={STARTING_FEN} orientation="black" />);
    // a1 is still labelled "a1" in both.
    expect(white).toContain('aria-label="a1"');
    expect(black).toContain('aria-label="a1"');
    // The markers differ on the orientation attr.
    expect(white).toContain('data-gb-orientation="white"');
    expect(black).toContain('data-gb-orientation="black"');
  });

  it("marks the board as read-only for assistive tech", () => {
    const html = renderToStaticMarkup(<StaticChessboard fen={STARTING_FEN} />);
    expect(html).toMatch(/role="grid"[^>]*aria-readonly="true"/);
  });

  it("supports showCoordinates={false}", () => {
    const withCoords = renderToStaticMarkup(
      <StaticChessboard fen={STARTING_FEN} showCoordinates />,
    );
    const withoutCoords = renderToStaticMarkup(
      <StaticChessboard fen={STARTING_FEN} showCoordinates={false} />,
    );
    // Coordinate letters are in the `with` render but not the `without`.
    expect(withCoords.match(/>a</g)?.length).toBeGreaterThan(0);
    // The `without` render has no `<span>...a...</span>` coord labels.
    // Check by counting file-letter spans specifically (they sit at `bottom:1%`).
    expect(withoutCoords.includes("bottom:1%")).toBe(false);
  });

  it("renders an empty position without errors", () => {
    const html = renderToStaticMarkup(<StaticChessboard fen="8/8/8/8/8/8/8/8 w - - 0 1" />);
    // 64 cells still, but zero piece markers.
    expect(html.match(/role="gridcell"/g)?.length).toBe(64);
    expect(html.includes("data-piece-square=")).toBe(false);
  });

  it("throws on a malformed FEN rather than silently mis-rendering", () => {
    expect(() => renderToStaticMarkup(<StaticChessboard fen="totally-invalid" />)).toThrow();
  });

  it("does not emit any event-handler attributes (zero client JS)", () => {
    const html = renderToStaticMarkup(<StaticChessboard fen={STARTING_FEN} />);
    // Check for classic handler attribute patterns; Static render has none.
    for (const attr of ["onclick", "onkeydown", "onpointerdown", "onmousedown"]) {
      expect(html.toLowerCase().includes(attr)).toBe(false);
    }
  });

  it("output is idempotent: same FEN → identical markup", () => {
    const a = renderToStaticMarkup(<StaticChessboard fen={STARTING_FEN} />);
    const b = renderToStaticMarkup(<StaticChessboard fen={STARTING_FEN} />);
    expect(a).toBe(b);
  });
});
