import { expect, rowCount, test } from "./fixtures";

test.describe("browsing", () => {
  test("shows all 30 students, then narrows by search, class and both, then comes back", async ({ app }) => {
    await expect(app.getByRole("status").first()).toHaveText("30 students shown");
    await app.getByLabel("Search by name").fill("reddy");
    await expect(app.getByRole("status").first()).toHaveText("2 students shown");
    await expect(app.getByRole("rowheader")).toHaveText(["Aarav Reddy", "Charan Reddy"]);
    await app.getByLabel("Search by name").fill("");
    await expect(app.getByRole("status").first()).toHaveText("30 students shown");
    await app.getByLabel("Class", { exact: true }).selectOption("7A");
    await expect(app.getByRole("status").first()).toHaveText("6 students shown");
    await app.getByLabel("Search by name").fill("naidu");
    await expect(app.getByRole("rowheader")).toHaveText(["Rohan Naidu"]);
  });

  test("a search with no match says so, and typing fast never leaves an old answer on screen", async ({ app }) => {
    await app.getByLabel("Search by name").pressSequentially("reddy", { delay: 5 });
    await expect(app.getByRole("rowheader")).toHaveText(["Aarav Reddy", "Charan Reddy"]);
    await app.getByLabel("Search by name").fill("zzzz");
    await expect(app.getByText("No student matches this search.")).toBeVisible();
    await expect(app.getByRole("table")).toHaveCount(0);
  });

  test("a search with a quote and a percent sign is just text", async ({ app }) => {
    await app.getByLabel("Search by name").fill("' OR 1=1 -- %");
    await expect(app.getByText("No student matches this search.")).toBeVisible();
  });
});

test.describe("adding", () => {
  async function fill(app: import("@playwright/test").Page, name: string, cls: string, score: string) {
    await app.getByLabel("Name", { exact: true }).fill(name);
    await app.getByLabel("Class for the new student").selectOption(cls);
    await app.getByLabel("Score (0 to 100)").fill(score);
  }

  test("a new student appears, the form empties, and it is still there after a reload and in search", async ({ app }) => {
    await fill(app, "Zara Khan", "8A", "77");
    await app.getByRole("button", { name: "Add student" }).click();
    await expect(app.getByText("Added Zara Khan.")).toBeVisible();
    await expect(app.getByRole("status").first()).toHaveText("31 students shown");
    await expect(app.getByLabel("Name", { exact: true })).toHaveValue("");
    await expect(app.getByLabel("Name", { exact: true })).toBeFocused();
    await app.reload();
    await expect(app.getByRole("status").first()).toHaveText("31 students shown");
    await app.getByLabel("Search by name").fill("zara");
    await expect(app.getByRole("row", { name: /Zara Khan 8A 77/ })).toBeVisible();
  });

  test("an empty form shows three messages, moves to the first problem, and adds nothing", async ({ app }) => {
    await app.getByRole("button", { name: "Add student" }).click();
    await expect(app.getByText("Enter a name.")).toBeVisible();
    await expect(app.getByText("Choose a class.")).toBeVisible();
    await expect(app.getByText("Enter a score from 0 to 100.")).toBeVisible();
    await expect(app.getByLabel("Name", { exact: true })).toBeFocused();
    expect(await rowCount(app)).toBe(30);
  });

  test("a score of 101 is refused with a message", async ({ app }) => {
    await fill(app, "Zara Khan", "8A", "101");
    await app.getByRole("button", { name: "Add student" }).click();
    await expect(app.getByText("Score must be a whole number from 0 to 100.")).toBeVisible();
    expect(await rowCount(app)).toBe(30);
  });

  test("a duplicate is refused by the server in plain words and what was typed is kept", async ({ app }) => {
    await fill(app, "  aarav   REDDY ", "6A", "50");
    await app.getByRole("button", { name: "Add student" }).click();
    await expect(app.getByRole("alert")).toHaveText("aarav REDDY is already in class 6A.");
    await expect(app.getByLabel("Score (0 to 100)")).toHaveValue("50");
    await expect(app.getByRole("status").first()).toHaveText("30 students shown");
  });

  test("the same name in another class is fine", async ({ app }) => {
    await fill(app, "Aarav Reddy", "8A", "50");
    await app.getByRole("button", { name: "Add student" }).click();
    await expect(app.getByText("Added Aarav Reddy.")).toBeVisible();
  });

  test("the whole thing works with the keyboard only", async ({ app }) => {
    await app.getByLabel("Name", { exact: true }).focus();
    await app.keyboard.type("Keyboard Kid");
    await app.keyboard.press("Tab");
    await app.keyboard.press("ArrowDown"); // the class menu: first real class
    await app.keyboard.press("Tab");
    await app.keyboard.type("66");
    await app.keyboard.press("Enter");
    await expect(app.getByText("Added Keyboard Kid.")).toBeVisible();
    await expect(app.getByRole("row", { name: /Keyboard Kid 6A 66/ })).toBeVisible();
  });

  test("a very long name is refused by the server too, even if the page's own check is skipped", async ({ app, request }) => {
    const response = await request.post("/api/students", { data: { name: "a".repeat(61), class_name: "6A", score: 1 } });
    expect(response.status()).toBe(422);
  });
});

test.describe("deleting", () => {
  test("a student is removed and stays removed after a reload", async ({ app }) => {
    await app.getByRole("button", { name: "Delete Diya Goud" }).click();
    await expect(app.getByText("Deleted Diya Goud.")).toBeVisible();
    await expect(app.getByRole("status").first()).toHaveText("29 students shown");
    await app.reload();
    await expect(app.getByRole("status").first()).toHaveText("29 students shown");
    await expect(app.getByRole("rowheader", { name: "Diya Goud" })).toHaveCount(0);
  });

  test("two open tabs: the second tab deletes someone the first tab already deleted", async ({ app, context }) => {
    const second = await context.newPage();
    await second.goto("/");
    await expect(second.getByRole("table")).toBeVisible();
    await app.getByRole("button", { name: "Delete Meera Rao" }).click();
    await expect(app.getByText("Deleted Meera Rao.")).toBeVisible();
    await second.getByRole("button", { name: "Delete Meera Rao" }).click(); // this tab still shows her
    await expect(second.getByText("Student 4 does not exist.")).toBeVisible();
    await expect(second.getByRole("rowheader", { name: "Meera Rao" })).toHaveCount(0); // and the list refreshed itself
  });
});

test.describe("when things go wrong", () => {
  test("server down: a plain message, then Try again works once it is back", async ({ app }) => {
    await app.route("**/api/students**", (route) => route.abort());
    await app.reload();
    await expect(app.getByRole("alert")).toContainText("Cannot reach the server. Is it running?");
    await expect(app.getByRole("table")).toHaveCount(0);
    await app.unroute("**/api/students**");
    await app.getByRole("button", { name: "Try again" }).click();
    await expect(app.getByRole("table")).toBeVisible();
    await expect(app.getByRole("alert")).toHaveCount(0);
  });

  test("a server error 500 says the status", async ({ app }) => {
    await app.route("**/api/students**", (route) => route.fulfill({ status: 500, body: "boom" }));
    await app.reload();
    await expect(app.getByRole("alert")).toContainText("The server answered 500.");
  });

  test("a slow server: 'Loading students…' is shown, then the list", async ({ app }) => {
    await app.route("**/api/students**", async (route) => {
      await new Promise((r) => setTimeout(r, 1200));
      await route.continue();
    });
    await app.reload();
    await expect(app.getByRole("status").first()).toHaveText("Loading students…");
    await expect(app.getByRole("table")).toBeVisible();
  });

  test("adding while the server is down says so and adds nothing", async ({ app }) => {
    await app.getByLabel("Name", { exact: true }).fill("Zara Khan");
    await app.getByLabel("Class for the new student").selectOption("8A");
    await app.getByLabel("Score (0 to 100)").fill("5");
    await app.route("**/api/students", (route) => (route.request().method() === "POST" ? route.abort() : route.continue()));
    await app.getByRole("button", { name: "Add student" }).click();
    await expect(app.getByRole("alert")).toHaveText("Cannot reach the server. Is it running?");
    await app.unroute("**/api/students");
    await app.reload();
    await expect(app.getByRole("status").first()).toHaveText("30 students shown");
  });
});

test.describe("a clean run", () => {
  test("loading, searching, adding and deleting make no console errors and no failed requests", async ({ page, request }) => {
    await request.post("/api/test/reset");
    const problems: string[] = [];
    page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()}`));
    page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));
    page.on("requestfailed", (r) => problems.push(`failed: ${r.url()}`));
    page.on("response", (r) => r.status() >= 400 && problems.push(`${r.status()}: ${r.url()}`));
    await page.goto("/");
    await expect(page.getByRole("table")).toBeVisible();
    await page.getByLabel("Search by name").fill("reddy");
    await expect(page.getByRole("status").first()).toHaveText("2 students shown");
    await page.getByLabel("Search by name").fill("");
    await page.getByLabel("Name", { exact: true }).fill("Clean Run");
    await page.getByLabel("Class for the new student").selectOption("6B");
    await page.getByLabel("Score (0 to 100)").fill("9");
    await page.getByRole("button", { name: "Add student" }).click();
    await expect(page.getByText("Added Clean Run.")).toBeVisible();
    await page.getByRole("button", { name: "Delete Clean Run" }).click();
    await expect(page.getByText("Deleted Clean Run.")).toBeVisible();
    expect(problems).toEqual([]);
  });
});

test.describe("the test set-up itself", () => {
  test("every test starts from 30 students, whatever the test before it did", async ({ app }) => {
    expect(await rowCount(app)).toBe(30);
  });
  test("the reset address works on a database that was changed behind the page's back", async ({ app, request }) => {
    await request.delete("/api/students/1");
    await request.post("/api/test/reset");
    await app.reload();
    await expect(app.getByRole("status").first()).toHaveText("30 students shown");
  });
});
