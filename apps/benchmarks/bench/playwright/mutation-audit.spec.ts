/**
 * Mutation audit — guardrail against a known performance regression.
 *
 * Ultra's architectural claim is "byte-level subscription, minimal DOM
 * work per move." That claim is only true if no upstream controller
 * starts diff-writing per-square attributes across an entire colour's
 * pieces on every commit. Exactly that pattern — a cursor controller
 * rewriting `data-ucr-grabbable` on 32 squares per turn flip — cost the
 * library 85 % of its per-move DOM mutations before it was caught.
 *
 * This spec:
 *
 *   1. Dumps every `MutationRecord` observed on the board subtree during
 *      one `playMove` per library, broken down by type / attribute /
 *      target. Written to `bench-results/mutation-audit.json` for
 *      offline analysis.
 *
 *   2. Asserts per-library budgets on the resulting count. Crossing the
 *      budget fails the test — CI catches regressions that would otherwise
 *      only show up as slower drags or grid-mount blocking time.
 *
 * Budgets are set slightly above the measured steady state (≈ 7 for
 * Ultra on a quiet pawn move; headroom for a future legitimate change
 * but tight enough that a per-square write loop would blow through).
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { ALL_LIBRARIES, gotoBoard, type Library } from "./lib.js";

interface MutationSummary {
  type: string;
  target: string;
  attribute?: string | null;
  addedNodes?: string[];
  removedNodes?: string[];
  oldValue?: string | null;
  newValue?: string | null;
}

interface AuditResult {
  library: Library;
  move: string;
  total: number;
  records: MutationSummary[];
}

/**
 * Per-library ceiling for mutation count on a single quiet pawn move
 * (`e2-e4` from the starting position). Lower is better.
 *
 * Headroom policy: budget = measured steady state + ~40 % margin for
 * noise and small legitimate additions. A regression that doubles the
 * count will blow through the budget; a 10-mutation drift into a new
 * feature is absorbed.
 *
 * Current measured (production React, one e2-e4 move):
 *   ultra: 7,  rcb: 2,  cg: 3.
 */
const BUDGETS: Record<Library, number> = {
  ultra: 10,
  rcb: 5,
  cg: 5,
};

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "..", "..", "bench-results");
mkdirSync(outDir, { recursive: true });

const collected: AuditResult[] = [];

for (const library of ALL_LIBRARIES) {
  test(`mutation audit — ${library}`, async ({ page }) => {
    await gotoBoard(page, library);
    // Let any initial-tick work settle.
    await page.waitForTimeout(300);

    const result = await page.evaluate(async () => {
      const boardRoot = document.getElementById("bench-board");
      if (boardRoot === null) throw new Error("no board root");

      function describeEl(n: Node): string {
        if (!(n instanceof Element)) return `#${n.nodeType}`;
        const tag = n.tagName.toLowerCase();
        const id = n.id ? `#${n.id}` : "";
        const sq = n.getAttribute("data-square") ?? n.getAttribute("data-piece-square");
        const sqAttr = sq ? `[sq=${sq}]` : "";
        const layer = n.getAttribute("data-layer");
        const layerAttr = layer ? `[layer=${layer}]` : "";
        const dragCell = n.getAttribute("data-drag-cell");
        const dragAttr = dragCell ? `[drag-cell=${dragCell}]` : "";
        return `${tag}${id}${sqAttr}${layerAttr}${dragAttr}`;
      }

      function describeWithParents(n: Node, depth = 6): string {
        const chain: string[] = [];
        let cur: Node | null = n;
        for (let i = 0; i < depth && cur !== null; i++) {
          chain.push(describeEl(cur));
          cur = (cur as Element).parentElement ?? null;
        }
        return chain.join(" ← ");
      }

      const records: Array<MutationSummary> = [];
      const observer = new MutationObserver((list) => {
        for (const r of list) {
          const out: MutationSummary = {
            type: r.type,
            target: describeWithParents(r.target),
          };
          if (r.type === "attributes") {
            out.attribute = r.attributeName;
            out.oldValue = r.oldValue;
            if (r.target instanceof Element && r.attributeName !== null) {
              out.newValue = r.target.getAttribute(r.attributeName);
            }
          } else if (r.type === "childList") {
            out.addedNodes = Array.from(r.addedNodes).map(describeEl);
            out.removedNodes = Array.from(r.removedNodes).map(describeEl);
          }
          records.push(out);
        }
      });
      observer.observe(boardRoot, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeOldValue: true,
        characterData: true,
        characterDataOldValue: true,
      });

      await window.__ucrBench__?.playMove("e2", "e4");
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
      observer.disconnect();
      return { records, total: records.length };
    });

    const summary: AuditResult = {
      library,
      move: "e2-e4",
      total: result.total,
      records: result.records as MutationSummary[],
    };
    collected.push(summary);

    // Assertion: stay under the budget. This is the regression guard.
    expect(
      result.total,
      `${library}: ${result.total} DOM mutations on one quiet pawn move — exceeds budget ${BUDGETS[library]}. See bench-results/mutation-audit.json for the full breakdown.`,
    ).toBeLessThanOrEqual(BUDGETS[library]);
  });
}

test.afterAll(() => {
  writeFileSync(resolve(outDir, "mutation-audit.json"), `${JSON.stringify(collected, null, 2)}\n`);
});
