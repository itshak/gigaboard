import { expect, test } from "@playwright/test";

test.describe("docs smoke", () => {
  test("home page renders the title and interactive chessboard", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Ultra Chess React" })).toBeVisible();
    await expect(page.locator("[data-gb-orientation]")).toHaveAttribute("data-gb-orientation", "white");
  });

  test("flip control changes board orientation and can be reversed", async ({ page }) => {
    await page.goto("/");
    const board = page.locator("[data-gb-orientation]");
    await expect(board).toHaveAttribute("data-gb-orientation", "white");
    await page.getByRole("button", { name: "Flip" }).click();
    await expect(board).toHaveAttribute("data-gb-orientation", "black");
    await page.getByRole("button", { name: "Flip" }).click();
    await expect(board).toHaveAttribute("data-gb-orientation", "white");
  });
});
