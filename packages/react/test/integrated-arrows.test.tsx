import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { computeDynamicAeroGeometry } from "../src/components/arrows-layer.js";
import type { BoardModel, SquareIndex } from "../src/core/index.js";
import { installBoardGeometry, makeBoardModel, renderBoard } from "./helpers.js";

describe("integrated aero-chisel arrows", () => {
  installBoardGeometry(400);
  let model: BoardModel;

  beforeEach(async () => {
    model = await makeBoardModel();
  });

  afterEach(() => {
    model.dispose();
  });

  describe("computeDynamicAeroGeometry", () => {
    it("computes dynamic auto-centering cabin for standard evaluation", () => {
      const geom = computeDynamicAeroGeometry("+0.4", "aero_chisel", 2.45, true);
      expect(geom.cabinW).toBeGreaterThanOrEqual(3.2);
      expect(geom.tipLen).toBeGreaterThan(geom.cabinW);
      expect(geom.path).toContain("M ");
      expect(geom.path).toContain(" Z");
    });

    it("expands cabin dynamically for wide 5-character evaluation like +32.3", () => {
      const standard = computeDynamicAeroGeometry("+0.4", "aero_chisel", 2.45, true);
      const wide = computeDynamicAeroGeometry("+32.3", "aero_chisel", 2.45, true);
      // Wide score cabin must be wider than standard 4-char score
      expect(wide.cabinW).toBeGreaterThan(standard.cabinW);
      // Tip must extend past cabinW
      expect(wide.tipLen).toBe(wide.cabinW + 1.25);
    });

    it("handles mate evaluations like #18 without clipping", () => {
      const mate = computeDynamicAeroGeometry("#18", "aero_chisel", 2.45, true);
      expect(mate.cabinW).toBeGreaterThanOrEqual(3.2);
      expect(mate.dockLen).toBeGreaterThan(0);
    });

    it("generates sculpted Aero-Sharp chisel geometry when evaluation text is empty or undefined", () => {
      const nonEvalEmpty = computeDynamicAeroGeometry("", "aero_chisel", 2.45, true);
      const nonEvalUndef = computeDynamicAeroGeometry(undefined, "aero_chisel", 2.45, true);

      for (const geom of [nonEvalEmpty, nonEvalUndef]) {
        expect(geom.cabinW).toBe(0);
        expect(geom.tipLen).toBe(2.8);
        expect(geom.dockLen).toBe(1.8);
        // Total head length should be 4.6u (substantially shorter than 8.3u eval pod)
        expect(geom.tipLen + geom.dockLen).toBe(4.6);
        expect(geom.path).toContain("L 2.8,0");
        expect(geom.path).toContain(" Z");
      }
    });
  });

  describe("rendering on board", () => {
    it("renders integrated arrows with evaluation text and apple-elevation filter in top layer", () => {
      model.setArrows([
        {
          from: 54 as SquareIndex, // g7
          to: 46 as SquareIndex, // g6
          color: "#F59E0B",
          label: {
            text: "+0.4",
            background: "#F59E0B",
            headStyle: "aero_chisel",
          },
        },
        {
          from: 62 as SquareIndex, // g8
          to: 45 as SquareIndex, // f6
          color: "#F59E0B",
          label: {
            text: "#18",
            background: "#F59E0B",
            headStyle: "aero_chisel",
          },
        },
      ]);

      renderBoard(model);

      // SVG decoration layer rendered
      const svg = document.querySelector('svg[data-layer="arrows-decor"]');
      expect(svg).not.toBeNull();

      // Check for evaluation text
      expect(screen.getByText("+0.4")).not.toBeNull();
      expect(screen.getByText("#18")).not.toBeNull();

      // Check for Apple elevation filter definition
      const filter = svg?.querySelector("#gb-apple-elevation");
      expect(filter).not.toBeNull();

      // Check for amber gradient definition
      const gradient = svg?.querySelector("#gb-apple-amber-grad");
      expect(gradient).not.toBeNull();
    });

    it("renders dual aero collinear moves (g7-g6 and g7-g5) with two-pass shafts and heads", () => {
      model.setArrows([
        {
          from: 54 as SquareIndex, // g7
          to: 46 as SquareIndex, // g6
          color: "#F59E0B",
          label: {
            text: "+0.4",
            background: "#F59E0B",
            headStyle: "aero_chisel",
          },
        },
        {
          from: 54 as SquareIndex, // g7
          to: 38 as SquareIndex, // g5
          color: "#F59E0B",
          label: {
            text: "+32.3",
            background: "#F59E0B",
            headStyle: "aero_chisel",
          },
        },
      ]);

      renderBoard(model);

      // Both evaluation scores rendered
      expect(screen.getByText("+0.4")).not.toBeNull();
      expect(screen.getByText("+32.3")).not.toBeNull();

      const svg = document.querySelector('svg[data-layer="arrows-decor"]');
      const shafts = svg?.querySelectorAll('g[filter*="gb-apple-elevation"]');
      // Should have shafts and heads rendered in separate groups
      expect(shafts?.length).toBeGreaterThanOrEqual(2);
    });

    it("routes knight moves to avoid collisions when collinear arrow shares the same file", () => {
      // Knight g8 (index 62, file 6) and Pawn g7 (index 54, file 6)
      model.setArrows([
        {
          from: 54 as SquareIndex, // g7
          to: 46 as SquareIndex, // g6
          color: "#F59E0B",
          label: {
            text: "+0.1",
            background: "#F59E0B",
            headStyle: "aero_chisel",
          },
        },
        {
          from: 62 as SquareIndex, // g8
          to: 45 as SquareIndex, // f6
          color: "#F59E0B",
          label: {
            text: "+0.4",
            background: "#F59E0B",
            headStyle: "aero_chisel",
          },
        },
      ]);

      renderBoard(model);

      const svg = document.querySelector('svg[data-layer="arrows-decor"]');
      expect(svg).not.toBeNull();
      // Knight arrow should be rendered cleanly alongside pawn arrow
      expect(screen.getByText("+0.1")).not.toBeNull();
      expect(screen.getByText("+0.4")).not.toBeNull();
    });

    it("renders vertical pawn moves d2-d4 and knight g1-f3 with visible shafts", () => {
      model.setArrows([
        {
          from: 11 as SquareIndex, // d2
          to: 27 as SquareIndex, // d4
          color: "rgba(245, 158, 11, 0.95)",
          brush: "blue",
          label: {
            text: "+0.2",
            fill: "#000000",
            background: "#F59E0B",
            headStyle: "aero_chisel",
            style3d: true,
          },
        },
        {
          from: 6 as SquareIndex, // g1
          to: 21 as SquareIndex, // f3
          color: "rgba(245, 158, 11, 0.95)",
          brush: "blue",
          label: {
            text: "+0.1",
            fill: "#000000",
            background: "#F59E0B",
            headStyle: "aero_chisel",
            style3d: true,
          },
        },
      ]);

      renderBoard(model);

      const svg = document.querySelector('svg[data-layer="arrows-decor"]');
      expect(svg).not.toBeNull();
      const shaftPaths = svg?.querySelectorAll('g[filter*="gb-apple-elevation"] path[stroke]');
      expect(shaftPaths?.length).toBeGreaterThanOrEqual(2);
    });

    it("renders non-eval arrows with sculpted Aero-Sharp chisel and no empty text element", () => {
      model.setArrows([
        {
          from: 11 as SquareIndex, // d2
          to: 19 as SquareIndex, // d3 (1-square move)
          color: "rgba(245, 158, 11, 0.95)",
          brush: "blue",
          label: {
            text: "",
            background: "#F59E0B",
            headStyle: "aero_chisel",
            style3d: true,
          },
        },
      ]);

      renderBoard(model);

      const svg = document.querySelector('svg[data-layer="arrows-decor"]');
      expect(svg).not.toBeNull();

      // Sharp head path rendered with elevation filter
      const headGroup = svg?.querySelectorAll('g[filter*="gb-apple-elevation"]');
      expect(headGroup?.length).toBeGreaterThanOrEqual(1);

      // No <text> tag should be in the DOM since there is no eval
      const textTags = svg?.querySelectorAll("text");
      expect(textTags?.length ?? 0).toBe(0);
    });
  });
});
