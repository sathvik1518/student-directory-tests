import { expect, test as base, type Page } from "@playwright/test";

/** Every test starts from the same 30 students: the server is reset before each one. */
export const test = base.extend<{ app: Page }>({
  app: async ({ page, request }, use) => {
    const reset = await request.post("/api/test/reset");
    expect(reset.status(), "the server must be started with ENABLE_TEST_RESET=1").toBe(204);
    await page.goto("/");
    await expect(page.getByRole("table")).toBeVisible();
    await use(page);
  },
});
export { expect };

export const rowCount = (page: Page) => page.getByRole("table").getByRole("row").count().then((n) => n - 1); // minus the header row
