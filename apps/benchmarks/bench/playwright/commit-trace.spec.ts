/**
 * Commit-trace capture — the architectural-claim video.
 *
 * Replays the full 40-ply Najdorf via `playMove` (direct state update,
 * no drag UI) against each library under 4× CPU throttle, with the
 * mutation-flash overlay enabled. Every DOM mutation the browser
 * observes inside the board subtree is highlighted with a short-lived
 * red rectangle — literally the same information React DevTools shows
 * under "Highlight updates when components render".
 *
 * Why this scenario rather than drag-storm for the hero video:
 *
 *   - `playMove` hits every library through an identical path (direct
 *     state mutation). No drag-style variance, no pointer-capture
 *     heuristics, no per-library timing quirks in how input is
 *     consumed. The only variable left is "how much does the library
 *     re-render per move?"
 *   - The flash overlay is library-agnostic — it watches the actual
 *     DOM mutations, not React's internal reconciler — so it's fair to
 *     all three. Ultra, rcb, cg all get the same `MutationObserver`.
 *   - The architectural claim is directly visible: Ultra flashes 2-4
 *     rectangles per move (the affected squares), rcb flashes most of
 *     the 64-square grid on every move, cg produces its own imperative
 *     DOM writes that are also narrow.
 *
 * Runs against the *production* Vite build (see `playwright.config.ts`)
 * so React's dev-mode overhead isn't inflating rcb's numbers.
 *
 * Run:
 *
 *   bun run bench:playwright bench/playwright/commit-trace.spec.ts
 *
 * Artifacts: `apps/benchmarks/bench-results/traces/commit-<library>.zip`
 * Videos:    `apps/benchmarks/test-results/.../video.webm`
 */

import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type Page, test } from "@playwright/test";
import { ALL_LIBRARIES, gotoBoard, type Library, throttleCpu } from "./lib.js";
import { GAME_40 } from "./tours.js";

/** Settle time between moves so each move's flash is legible on video. */
const MOVE_GAP_MS = 650;
/** Opening / closing idle so the clip has a resting state on both ends. */
const PRE_ROLL_MS = 600;
const POST_ROLL_MS = 600;

const here = dirname(fileURLToPath(import.meta.url));
const tracesDir = resolve(here, "..", "..", "bench-results", "traces");
mkdirSync(tracesDir, { recursive: true });

test.use({ video: { mode: "on", size: { width: 1280, height: 900 } } });

/**
 * Inject a compact HUD so the video is self-describing: library, move
 * number, SAN-style from→to, and a running cumulative mutation count.
 * Updates are DOM-only (no React) so they don't contaminate what the
 * flash overlay measures.
 */
async function installHud(page: Page, library: Library): Promise<void> {
  await page.evaluate((lib) => {
    const hud = document.createElement("div");
    hud.id = "__gb_commit_hud__";
    Object.assign(hud.style, {
      position: "fixed",
      top: "0",
      left: "0",
      right: "0",
      padding: "10px 18px",
      background: "rgba(0,0,0,0.88)",
      color: "#fff",
      font: "14px/1.3 ui-monospace, Menlo, Consolas, monospace",
      letterSpacing: "0.3px",
      display: "flex",
      alignItems: "center",
      gap: "18px",
      zIndex: "9999",
      boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
    });
    hud.innerHTML = `
      <span id="hud-lib" style="font-weight:700;min-width:90px;padding:2px 8px;background:#fff;color:#000;border-radius:3px;text-align:center;"></span>
      <span id="hud-move" style="font-weight:700;min-width:110px;"></span>
      <span id="hud-san" style="font-weight:500;min-width:110px;"></span>
      <span id="hud-mut" style="margin-left:auto;opacity:0.9;">DOM mutations: <b id="hud-mut-n">0</b></span>
    `;
    document.body.appendChild(hud);
    // biome-ignore lint/suspicious/noExplicitAny: host-only HUD type
    const w = window as any;
    const libEl = hud.querySelector<HTMLElement>("#hud-lib");
    const moveEl = hud.querySelector<HTMLElement>("#hud-move");
    const sanEl = hud.querySelector<HTMLElement>("#hud-san");
    const mutEl = hud.querySelector<HTMLElement>("#hud-mut-n");
    if (libEl) libEl.textContent = lib.toUpperCase();
    const hudApi = {
      set(patch: {
        move?: number;
        total?: number;
        from?: string;
        to?: string;
        mut?: number;
      }): void {
        if (moveEl && patch.move !== undefined && patch.total !== undefined) {
          moveEl.textContent = `MOVE ${patch.move} / ${patch.total}`;
        }
        if (sanEl && patch.from !== undefined && patch.to !== undefined) {
          sanEl.textContent = `${patch.from} → ${patch.to}`;
        }
        if (mutEl && patch.mut !== undefined) {
          mutEl.textContent = String(patch.mut);
        }
      },
    };
    w.__gbCommitHud__ = hudApi;
    w.__ucrCommitHud__ = hudApi;
  }, library);
}

async function updateHud(
  page: Page,
  patch: { move?: number; total?: number; from?: string; to?: string; mut?: number },
): Promise<void> {
  await page.evaluate((p) => {
    // biome-ignore lint/suspicious/noExplicitAny: host-only HUD type
    const w = window as any;
    (w.__gbCommitHud__ ?? w.__ucrCommitHud__)?.set(p);
  }, patch);
}

for (const library of ALL_LIBRARIES) {
  test(`commit trace — ${library}`, async ({ page, context }, testInfo) => {
    test.setTimeout(180_000);

    await gotoBoard(page, library);
    await throttleCpu(page, 4);
    await installHud(page, library);

    // Turn on the red-flash overlay that each library's bench page
    // installed at mount time (library-agnostic MutationObserver).
    await page.evaluate(() => {
      (window.__gbFlash__ ?? window.__ucrFlash__)?.setVisible(true);
      (window.__gbFlash__ ?? window.__ucrFlash__)?.resetCount();
    });

    await context.tracing.start({
      screenshots: true,
      snapshots: true,
      sources: false,
      title: `commit-trace-40ply-${library as Library}`,
    });

    await page.waitForTimeout(PRE_ROLL_MS);

    let moveIdx = 0;
    for (const [from, to] of GAME_40) {
      moveIdx++;
      await updateHud(page, { move: moveIdx, total: GAME_40.length, from, to });
      // Direct state mutation — the fair comparison. No drag UI, no
      // pointer-event pacing. Each library updates its state and
      // reconciles on its own terms.
      await page.evaluate(([f, t]) => (window.__gbBench__ ?? window.__ucrBench__)?.playMove(f, t), [
        from,
        to,
      ] as const);
      // Let the mutation batch settle and reflect it on the HUD so the
      // viewer can watch the cumulative count climb.
      const mut = await page.evaluate(
        () => (window.__gbFlash__ ?? window.__ucrFlash__)?.getCount() ?? 0,
      );
      await updateHud(page, { mut });
      await page.waitForTimeout(MOVE_GAP_MS);
    }

    await page.waitForTimeout(POST_ROLL_MS);

    const tracePath = resolve(tracesDir, `commit-${library}.zip`);
    await context.tracing.stop({ path: tracePath });
    await testInfo.attach(`trace-commit-${library}`, {
      path: tracePath,
      contentType: "application/zip",
    });
  });
}
