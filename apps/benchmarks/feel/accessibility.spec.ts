import { expect, test } from "@playwright/test";
import { center, ready } from "./helpers.js";

test.beforeEach(async ({ page }) => ready(page));

test("ARIA grid contains 64 cells with a single roving tab stop", async ({ page }) => {
  const grid = page.getByRole("grid", { name: "Chess board" });
  await expect(grid).toHaveCount(1);
  await expect(grid.getByRole("gridcell")).toHaveCount(64);
  await expect(grid).toHaveAttribute("aria-rowcount", "8");
  await expect(grid).toHaveAttribute("aria-colcount", "8");
  const tabStops = await grid.locator('[role="gridcell"][tabindex="0"]').count();
  expect(tabStops).toBe(1);
  await expect(page.locator('[data-layer="live-region"]')).toHaveAttribute("aria-live", "polite");
});

test("keyboard arrow navigation updates focused square", async ({ page }) => {
  await page.locator('[data-square="e2"]').focus();
  await page.keyboard.press("ArrowUp");
  await expect(page.locator('[data-square="e3"]')).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-square="f3"]')).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-layer="drag"]')).toHaveAttribute("data-active", "false");
});

test("a successful move updates accessible announcement without requiring vision", async ({ page }) => {
  const src = await center(page, "e2");
  const dst = await center(page, "e4");
  await page.mouse.click(src.x, src.y);
  await page.mouse.click(dst.x, dst.y);
  await expect(page.locator('[data-layer="live-region"]')).toContainText("White pawn e2 to e4");
  await expect(page.locator('[data-layer="live-region"]')).toHaveAttribute("aria-atomic", "true");
});
