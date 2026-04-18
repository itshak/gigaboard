import { expect, test } from "@playwright/test";

test.describe("docs smoke", () => {
  test("home page renders the title", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Ultra Chess React" })).toBeVisible();
  });
});
