/**
 * Drag-storm *trace* capture — the video/trace artifacts.
 *
 * Replays the full 40-ply Najdorf via real-mouse drag gestures under
 * 4× CPU throttle, producing:
 *
 *   - a shareable `.zip` per library that opens in
 *     https://trace.playwright.dev (main-thread strip, long tasks,
 *     screenshots, network — the Chrome DevTools Performance panel view,
 *     but portable), and
 *   - a `.webm` per library of the actual 40-move game being played.
 *
 * A HUD overlay is injected into each page before recording starts —
 * the same overlay on all three libraries — so the video proves the
 * scenarios are mechanically identical: same move number at each
 * timestamp, same phase (DRAGGING / SETTLING), same move labels. Any
 * divergence in the videos is real library behaviour, not harness
 * drift.
 *
 * Why replay a real game rather than loop a piece around a rectangle:
 * a circular drag reads as abstract motion. A played-out Najdorf shows
 * captures, castling, sharp middle-game tactics — real UI work the
 * viewer can relate to. Under CPU throttle, Ultra and cg complete the
 * game noticeably faster than rcb; the viewer watches the gap open up
 * in real time.
 *
 * Drives gestures through `page.mouse.*` (real OS-level input) so the
 * cursor is actually visible in the video and pointer-capture engages.
 * The measurement specs use synthetic events inside `page.evaluate` —
 * different tool for a different job.
 *
 * Run:
 *
 *   bun run bench:playwright bench/playwright/drag-trace.spec.ts
 *
 * Artifacts: `apps/benchmarks/bench-results/traces/<library>.zip`
 * Videos:    `apps/benchmarks/test-results/.../video.webm`
 */

import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type Page, test } from "@playwright/test";
import { ALL_LIBRARIES, gotoBoard, type Library, throttleCpu } from "./lib.js";
import { GAME_40 } from "./tours.js";

/** Substeps of `page.mouse.move` per hop. Low enough that 40 moves fit
 *  in a reasonable clip, high enough that the piece's glide is legible
 *  at 25 fps video capture. */
const STEPS_PER_HOP = 18;
/** Breathing room between moves so the viewer parses each hop as its
 *  own gesture and the board state change is visible. */
const HOP_SETTLE_MS = 140;
/** Opening / closing idle so the clip has a resting state on both ends. */
const PRE_ROLL_MS = 500;
const POST_ROLL_MS = 500;

const here = dirname(fileURLToPath(import.meta.url));
const tracesDir = resolve(here, "..", "..", "bench-results", "traces");
mkdirSync(tracesDir, { recursive: true });

test.use({ video: { mode: "on", size: { width: 1280, height: 900 } } });

async function squareCentre(page: Page, label: string): Promise<{ x: number; y: number }> {
  const pt = await page.evaluate((l) => {
    const b = window.__ucrBench__;
    if (b === undefined) throw new Error("harness missing");
    return b.squareCentre(l);
  }, label);
  if (pt === null) throw new Error(`square not found: ${label}`);
  return pt;
}

/**
 * Inject a fixed-position HUD into the page. Vanilla DOM only — no
 * React, no library dependency — so the per-update cost is identical
 * across all three bench pages and doesn't contaminate what we're
 * measuring. Exposes `window.__ucrHud__.set({ ... })` for the test
 * runner to drive.
 */
async function installHud(page: Page, library: Library): Promise<void> {
  await page.evaluate((lib) => {
    const hud = document.createElement("div");
    hud.id = "__ucr_hud__";
    Object.assign(hud.style, {
      position: "fixed",
      top: "0",
      left: "0",
      right: "0",
      padding: "10px 18px",
      background: "rgba(0,0,0,0.85)",
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
      <span id="hud-phase" style="min-width:110px;padding:2px 8px;border-radius:3px;"></span>
      <span id="hud-san" style="font-weight:500;"></span>
      <span id="hud-clock" style="margin-left:auto;opacity:0.75;"></span>
    `;
    document.body.appendChild(hud);

    // biome-ignore lint/suspicious/noExplicitAny: host-only HUD type
    const w = window as any;
    const libEl = hud.querySelector<HTMLElement>("#hud-lib");
    const moveEl = hud.querySelector<HTMLElement>("#hud-move");
    const phaseEl = hud.querySelector<HTMLElement>("#hud-phase");
    const sanEl = hud.querySelector<HTMLElement>("#hud-san");
    const clockEl = hud.querySelector<HTMLElement>("#hud-clock");
    if (libEl) libEl.textContent = lib.toUpperCase();
    const t0 = performance.now();
    w.__ucrHud__ = {
      set(patch: {
        move?: number;
        total?: number;
        phase?: "idle" | "dragging" | "settling" | "done";
        from?: string;
        to?: string;
      }): void {
        if (patch.move !== undefined && patch.total !== undefined && moveEl) {
          moveEl.textContent = `MOVE ${patch.move} / ${patch.total}`;
        }
        if (patch.phase !== undefined && phaseEl) {
          const colors: Record<string, string> = {
            idle: "#6b7280",
            dragging: "#f59e0b",
            settling: "#3b82f6",
            done: "#10b981",
          };
          phaseEl.textContent = patch.phase.toUpperCase();
          phaseEl.style.background = colors[patch.phase] ?? "#6b7280";
        }
        if (patch.from !== undefined && patch.to !== undefined && sanEl) {
          sanEl.textContent = `${patch.from} → ${patch.to}`;
        }
        if (clockEl) {
          const ms = Math.round(performance.now() - t0);
          const s = Math.floor(ms / 1000);
          const ms3 = (ms % 1000).toString().padStart(3, "0");
          clockEl.textContent = `t+${s}.${ms3}s`;
        }
      },
    };
    w.__ucrHud__.set({ move: 0, total: 40, phase: "idle", from: "—", to: "—" });
  }, library);
}

async function updateHud(
  page: Page,
  patch: {
    move?: number;
    total?: number;
    phase?: "idle" | "dragging" | "settling" | "done";
    from?: string;
    to?: string;
  },
): Promise<void> {
  await page.evaluate((p) => {
    // biome-ignore lint/suspicious/noExplicitAny: host-only HUD type
    const w = window as any;
    w.__ucrHud__?.set(p);
  }, patch);
}

async function realMouseDrag(page: Page, from: string, to: string): Promise<void> {
  const a = await squareCentre(page, from);
  const b = await squareCentre(page, to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: STEPS_PER_HOP });
  await page.mouse.up();
}

for (const library of ALL_LIBRARIES) {
  test(`drag trace — ${library}`, async ({ page, context }, testInfo) => {
    test.setTimeout(120_000);

    await gotoBoard(page, library);
    await throttleCpu(page, 4);
    await installHud(page, library);

    await context.tracing.start({
      screenshots: true,
      snapshots: true,
      sources: true,
      title: `drag-storm-40ply-${library as Library}`,
    });

    // Park the cursor on a visible piece so the opening frame isn't the
    // viewport corner.
    const park = await squareCentre(page, "e2");
    await page.mouse.move(park.x, park.y);
    await page.waitForTimeout(PRE_ROLL_MS);

    let moveIdx = 0;
    for (const [from, to] of GAME_40) {
      moveIdx++;
      await updateHud(page, {
        move: moveIdx,
        total: GAME_40.length,
        phase: "dragging",
        from,
        to,
      });
      await realMouseDrag(page, from, to);
      await updateHud(page, { phase: "settling" });
      await page.waitForTimeout(HOP_SETTLE_MS);
    }

    await updateHud(page, { phase: "done" });
    await page.waitForTimeout(POST_ROLL_MS);

    const tracePath = resolve(tracesDir, `${library}.zip`);
    await context.tracing.stop({ path: tracePath });

    await testInfo.attach(`trace-${library}`, {
      path: tracePath,
      contentType: "application/zip",
    });
  });
}
