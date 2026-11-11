/**
 * Browser-level SOUND SEMANTICS regression. Uses real Playwright mouse and
 * keyboard events against a production Vite build of GigaBoard and a React
 * controlled-FEN host. No synthetic PointerEvent or mocked board.
 *
 * onCue is host-injected, so these tests prove the right semantic event is
 * delivered exactly once; only native BlindBase testing can prove speakers
 * actually produce sound in macOS WKWebView.
 */
import { expect, test, type Page } from "@playwright/test";

const CAPTURE = "4k3/8/8/4p3/3P4/8/8/4K3 w - - 0 1";
const EN_PASSANT = "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1";
const QUIET = "4k3/8/8/8/3P4/8/8/4K3 w - - 0 1";

async function setup(page: Page, fen = CAPTURE) {
  await page.goto("/audio.html");
  await page.waitForFunction(() => window.__gbAudioE2E__?.ready === true);
  await page.evaluate(async (f) => { await window.__gbAudioE2E__?.reset(f); }, fen);
  await expect.poll(async () => page.evaluate(() => window.__gbAudioE2E__?.cues())).toEqual([]);
}

async function center(page: Page, square: string) {
  const rect = await page.locator('[data-square="' + square + '"]').boundingBox();
  if (rect === null) throw new Error("Missing board square: " + square);
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

async function drag(page: Page, from: string, to: string) {
  const a = await center(page, from);
  const b = await center(page, to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await page.mouse.up();
}

async function clickMove(page: Page, from: string, to: string) {
  const a = await center(page, from);
  const b = await center(page, to);
  await page.mouse.click(a.x, a.y);
  await page.mouse.click(b.x, b.y);
}

async function assertCues(page: Page, expected: string[]) {
  await expect.poll(async () => page.evaluate(() => window.__gbAudioE2E__?.cues())).toEqual(expected);
}

for (const mode of ["drag", "click"] as const) {
  for (const arrows of ["none", "empty", "populated"] as const) {
    test("@sound-e2e " + mode + " capture with managedArrows=" + arrows + " emits once", async ({ page }) => {
      await setup(page);
      await page.evaluate((value) => window.__gbAudioE2E__?.setArrows(value), arrows);
      if (mode === "drag") await drag(page, "d4", "e5");
      else await clickMove(page, "d4", "e5");
      await assertCues(page, ["capture"]);
      expect(await page.evaluate(() => window.__gbAudioE2E__?.moveCount())).toBe(1);
      await page.evaluate(() => window.__gbAudioE2E__?.setArrows("populated"));
      await assertCues(page, ["capture"]); // Arrow-only rerender is silent.
    });
  }
}

test("@sound-e2e real keyboard navigation generates same capture key", async ({ page }) => {
  await setup(page);
  // Keyboard navigation starts on the roving-tabindex e2 square, not on an
  // arbitrary square focused with DOM .focus(). Walk to d4 using actual keys.
  await page.locator('[data-square="e2"]').focus();
  await page.keyboard.press("ArrowUp"); // e3
  await page.keyboard.press("ArrowUp"); // e4
  await page.keyboard.press("ArrowLeft"); // d4
  await expect(page.locator('[data-square="d4"]')).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowUp"); // d5
  await page.keyboard.press("ArrowRight"); // e5
  await expect(page.locator('[data-square="e5"]')).toBeFocused();
  await page.keyboard.press("Enter");
  await assertCues(page, ["capture"]);
  expect(await page.evaluate(() => window.__gbAudioE2E__?.moveCount())).toBe(1);
});

test("@sound-e2e rejected mouse move plays no accepted cue", async ({ page }) => {
  await setup(page);
  const original = await page.evaluate(() => window.__gbAudioE2E__?.fen());
  await page.evaluate(() => window.__gbAudioE2E__?.rejectNextMove());
  await drag(page, "d4", "e5");
  await assertCues(page, []);
  expect(await page.evaluate(() => window.__gbAudioE2E__?.fen())).toBe(original);
});

test("@sound-e2e controlled keyboard-style capture works with and without UCI metadata", async ({ page }) => {
  await setup(page);
  await page.evaluate(() => window.__gbAudioE2E__?.externalMove("d4e5"));
  await assertCues(page, ["capture"]);
  await page.evaluate(async () => { await window.__gbAudioE2E__?.reset("4k3/8/8/4p3/3P4/8/8/4K3 w - - 0 1"); });
  await page.evaluate(() => window.__gbAudioE2E__?.externalMove("d4e5", true));
  await assertCues(page, ["capture"]);
});

test("@sound-e2e distinct quiet move and capture-check precedence", async ({ page }) => {
  await setup(page, QUIET);
  await drag(page, "d4", "d5");
  await assertCues(page, ["moveSelf"]);
  await page.evaluate(async () => { await window.__gbAudioE2E__?.reset("4k3/4r3/8/8/8/8/4R3/4K3 w - - 0 1"); });
  await drag(page, "e2", "e7");
  await assertCues(page, ["capture"]);
});

test("@sound-e2e en passant and promotion-capture via external controlled updates", async ({ page }) => {
  await setup(page, EN_PASSANT);
  await page.evaluate(() => window.__gbAudioE2E__?.externalMove("e5d6", true));
  await assertCues(page, ["capture"]);
  await page.evaluate(async () => { await window.__gbAudioE2E__?.reset("1r2k3/P7/8/8/8/8/8/4K3 w - - 0 1"); });
  await page.evaluate(() => window.__gbAudioE2E__?.externalMove("a7b8q"));
  await assertCues(page, ["capture"]);
});

test("@sound-e2e mute gate preserves accepted move without emitting onCue", async ({ page }) => {
  await setup(page);
  await page.evaluate(() => window.__gbAudioE2E__?.setEnabled(false));
  await drag(page, "d4", "e5");
  await assertCues(page, []);
  expect(await page.evaluate(() => window.__gbAudioE2E__?.moveCount())).toBe(1);
});

test("@sound-e2e rapid successive confirmed moves are not replayed on arrow updates", async ({ page }) => {
  await setup(page, QUIET);
  await drag(page, "d4", "d5");
  await assertCues(page, ["moveSelf"]);
  await page.evaluate(() => window.__gbAudioE2E__?.externalMove("e8e7"));
  await assertCues(page, ["moveSelf", "moveSelf"]);
  await page.evaluate(() => window.__gbAudioE2E__?.setArrows("none"));
  await page.evaluate(() => window.__gbAudioE2E__?.setArrows("populated"));
  await assertCues(page, ["moveSelf", "moveSelf"]);
});
