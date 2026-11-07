/**
 * GitHub-hosted, real-board A/B screening. Each candidate is isolated in
 * the same production-built Vite fixture and driven by Playwright mouse input.
 *
 * Ranking is by pickup movement distance subject to click-jitter integrity.
 * Browser event-to-DOM timings are diagnostic and NOT physical display latency.
 */
import { expect, test, type Page } from "@playwright/test";
import { Chess } from "chess.js";
import { attachMetrics, center, drag, ready, reset, START_FEN } from "./helpers.js";

interface Profile {
  id: string;
  threshold: number | "adaptive";
  pickup: "move" | "down";
  ghost: number;
  animation: number;
  sound: "off" | "cold" | "warm";
}

interface Trial {
  profileId: string;
  round: number;
  acceptedTwoMoves: boolean;
  jitterClickAccepted: boolean;
  ghostAppearedDuringOnePixelClick: boolean;
  firstPickupDistanceCssPx: number | null;
  pickupDomHandlingProxyMs: number | null;
  dropCleanupDomProxyMs: number | null;
  observedOriginOpacity: number | null;
  error: string | null;
}

const baseline: Profile = {
  id: "baseline-4px", threshold: 4, pickup: "move",
  ghost: 0.35, animation: 60, sound: "cold",
};

const profiles: Profile[] = [
  baseline,
  ...([0, 1, 2, 3, 6, "adaptive"] as const).map((threshold) => ({
    ...baseline, id: "threshold-" + threshold, threshold,
  })),
  { ...baseline, id: "pickup-on-pointerdown", pickup: "down" },
  { ...baseline, id: "origin-fully-hidden", ghost: 0 },
  ...([0, 30, 100] as const).map((animation) => ({
    ...baseline, id: "glide-" + animation + "ms", animation,
  })),
  { ...baseline, id: "sound-off", sound: "off" },
  { ...baseline, id: "sound-prewarmed", sound: "warm" },
];

const E4 = new Chess(START_FEN);
E4.move("e4");
const E4_E5 = new Chess(E4.fen());
E4_E5.move("e5");

function samePosition(actual: string, expected: string): boolean {
  return actual.split(" ").slice(0, 2).join(" ") ===
    expected.split(" ").slice(0, 2).join(" ");
}

function params(profile: Profile): string {
  const p = new URLSearchParams({
    feel: "1",
    threshold: String(profile.threshold),
    pickup: profile.pickup,
    ghost: String(profile.ghost),
    animation: String(profile.animation),
    sound: profile.sound === "off" ? "0" : "1",
  });
  return "?" + p.toString();
}

async function trial(page: Page, profile: Profile, round: number): Promise<Trial> {
  const result: Trial = {
    profileId: profile.id, round,
    acceptedTwoMoves: false,
    jitterClickAccepted: false,
    ghostAppearedDuringOnePixelClick: false,
    firstPickupDistanceCssPx: null,
    pickupDomHandlingProxyMs: null,
    dropCleanupDomProxyMs: null,
    observedOriginOpacity: null,
    error: null,
  };
  try {
    await ready(page, params(profile));
    if (profile.sound === "warm") {
      // Warm the actual move-sound pool and then restore the initial FEN.
      await drag(page, "e2", "e4", 3);
      await reset(page);
    }

    const src = await center(page, "e2");
    const dst = await center(page, "e4");
    const active = async (): Promise<boolean> =>
      (await page.locator('[data-layer="drag"]').getAttribute("data-active")) === "true";

    await page.mouse.move(src.x, src.y);
    await page.mouse.down();
    let distance: number | null = (await active()) ? 0 : null;
    if (distance === null) {
      // Same distance samples for every profile; this is a deterministic
      // activation DISTANCE test, not a wall-clock speed comparison.
      for (const offset of [0.25, 0.5, 1, 2, 3, 4, 6, 8]) {
        await page.mouse.move(src.x + offset, src.y);
        if (await active()) {
          distance = offset;
          break;
        }
      }
    }
    result.firstPickupDistanceCssPx = distance;
    if (distance === null) throw new Error("Drag ghost never activated within 8 CSS px");
    result.observedOriginOpacity = await page.locator('[data-piece-square="e2"]').evaluate(
      (el) => Number(getComputedStyle(el).opacity),
    );
    if (Math.abs(result.observedOriginOpacity - profile.ghost) > 0.05) {
      throw new Error("Wrong rendered origin opacity: " + result.observedOriginOpacity);
    }

    await page.mouse.move(dst.x, dst.y, { steps: 4 });
    await page.mouse.up();

    const events = await page.evaluate(() => window.__gbFeelLab__?.events() ?? []);
    const firstActive = events.find((e) => e.kind === "drag:active" && e.value === "true");
    if (firstActive) {
      const precedingInput = events.filter((e) =>
        (e.kind === "pointer:down" || e.kind === "pointer:move") && e.t <= firstActive.t
      ).at(-1);
      if (precedingInput) {
        result.pickupDomHandlingProxyMs = Math.max(0, firstActive.t - precedingInput.t);
      }
    }
    const firstUp = events.find((e) => e.kind === "pointer:up");
    const firstHidden = events.find((e) => e.kind === "drag:active" && e.value === "false");
    if (firstUp && firstHidden) {
      result.dropCleanupDomProxyMs = Math.max(0, firstHidden.t - firstUp.t);
    }

    const firstFen = await page.evaluate(() => window.__gbFeelLab__?.fen() ?? "");
    const firstMoves = await page.evaluate(() => window.__gbFeelLab__?.moveCount() ?? -1);
    if (!samePosition(firstFen, E4.fen()) || firstMoves !== 1 || await active()) {
      throw new Error("First drag failed independent FEN/callback/cleanup oracle");
    }

    // This verifies readiness for another legal input immediately after drop.
    await drag(page, "e7", "e5", 3);
    const secondFen = await page.evaluate(() => window.__gbFeelLab__?.fen() ?? "");
    const secondMoves = await page.evaluate(() => window.__gbFeelLab__?.moveCount() ?? -1);
    result.acceptedTwoMoves = samePosition(secondFen, E4_E5.fen()) &&
      secondMoves === 2 && !(await active());
    if (!result.acceptedTwoMoves) {
      throw new Error("Second immediate move failed FEN/callback/cleanup oracle");
    }

    // A tiny 1px hand jitter during click-to-move must NOT cause a visible
    // dragged ghost. Report as a UX risk rather than hide it as a passing drag.
    await reset(page);
    await page.mouse.move(src.x, src.y);
    await page.mouse.down();
    await page.mouse.move(src.x + 1, src.y);
    result.ghostAppearedDuringOnePixelClick = await active();
    await page.mouse.up();
    await page.mouse.click(dst.x, dst.y);
    const clickFen = await page.evaluate(() => window.__gbFeelLab__?.fen() ?? "");
    const clickMoves = await page.evaluate(() => window.__gbFeelLab__?.moveCount() ?? -1);
    result.jitterClickAccepted = samePosition(clickFen, E4.fen()) &&
      clickMoves === 1 && !(await active());
    if (!result.jitterClickAccepted) {
      result.error = "Click-to-move after 1px pointer jitter did not complete";
    }
  } catch (error) {
    result.error = String(error);
  }
  return result;
}

test("@optimize repeated actual-board config sweep with click-jitter safety", async ({ page }, info) => {
  test.skip(process.env["FEELLAB_OPTIMIZE"] !== "1", "Explicit CI optimization workflow only");
  test.setTimeout(2_400_000);
  const samples: Trial[] = [];
  const rounds = 3;
  // Rotating candidate ordering reduces systematic position-on-run bias;
  // no timing significance claim is made from shared ephemeral runners.
  for (let round = 0; round < rounds; round++) {
    const rotated = profiles.slice(round * 5).concat(profiles.slice(0, round * 5));
    for (const profile of rotated) {
      const measured = await trial(page, profile, round);
      samples.push(measured);
      console.log(
        "FEELLAB_SAMPLE " + profile.id + " round=" + round +
        " activationCssPx=" + measured.firstPickupDistanceCssPx +
        " twoMoves=" + measured.acceptedTwoMoves +
        " clickCorrect=" + measured.jitterClickAccepted +
        " clickGhost=" + measured.ghostAppearedDuringOnePixelClick +
        (measured.error ? " error=" + measured.error : ""),
      );
    }
  }
  await attachMetrics(info, {
    schemaVersion: 1,
    experiment: "single-variable profile screening",
    rounds,
    profiles,
    samples,
    environment: "GitHub-hosted browser processing proxies; no photon or WKWebView timing",
    rankingRule: "all trials must pass 2 moves and click correctness, with zero visible drag on 1px click jitter; then minimize measured activation distance",
  });
  const baseSamples = samples.filter((s) => s.profileId === baseline.id);
  expect(baseSamples).toHaveLength(rounds);
  expect(baseSamples.every((s) => s.acceptedTwoMoves && s.jitterClickAccepted &&
    !s.ghostAppearedDuringOnePixelClick && s.firstPickupDistanceCssPx !== null),
  "Baseline 4px behavior must stay correct for comparison").toBe(true);
});
