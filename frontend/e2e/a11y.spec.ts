import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

/** In the real browser axe CAN check colour contrast (jsdom cannot), so every rule is on here. */
async function scan(page: import("@playwright/test").Page) {
  const result = await new AxeBuilder({ page }).analyze();
  const text = result.violations.map((v) => `${v.id}: ${v.help} -> ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`).join("\n");
  expect(result.violations, text).toEqual([]);
  return result;
}

test.describe("accessibility, in the real browser, colour contrast included", () => {
  test("the loaded page", async ({ app }) => {
    const result = await scan(app);
    expect(result.passes.map((p) => p.id), "colour contrast was really checked").toContain("color-contrast");
  });
  test("the empty result", async ({ app }) => {
    await app.getByLabel("Search by name").fill("zzzz");
    await expect(app.getByText("No student matches this search.")).toBeVisible();
    await scan(app);
  });
  test("the add form full of errors", async ({ app }) => {
    await app.getByRole("button", { name: "Add student" }).click();
    await expect(app.getByText("Enter a name.")).toBeVisible();
    await scan(app);
  });
  test("a server error and a duplicate message", async ({ app }) => {
    await app.getByLabel("Name", { exact: true }).fill("Aarav Reddy");
    await app.getByLabel("Class for the new student").selectOption("6A");
    await app.getByLabel("Score (0 to 100)").fill("5");
    await app.getByRole("button", { name: "Add student" }).click();
    await expect(app.getByRole("alert")).toBeVisible();
    await scan(app);
  });
  test("the error screen", async ({ app }) => {
    await app.route("**/api/students**", (route) => route.fulfill({ status: 500, body: "x" }));
    await app.reload();
    await expect(app.getByRole("alert")).toBeVisible();
    await scan(app);
  });
  test("the keyboard focus ring is visible on the first control", async ({ app }) => {
    await app.keyboard.press("Tab");
    const outline = await app.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle + " " + getComputedStyle(document.activeElement!).outlineWidth);
    expect(outline).toBe("solid 3px");
  });
  test("the page works zoomed to 200 percent with no sideways scrolling", async ({ app }) => {
    await app.setViewportSize({ width: 640, height: 800 }); // 1280 wide at 200 percent zoom
    const overflow = await app.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
  test("the checker works in the browser too: a page with low-contrast text fails", async ({ page }) => {
    await page.setContent('<html lang="en"><head><title>t</title></head><body><main><p style="color:#ccc;background:#fff">faint text</p></main></body></html>');
    const result = await new AxeBuilder({ page }).analyze();
    expect(result.violations.map((v) => v.id)).toContain("color-contrast");
  });
});
