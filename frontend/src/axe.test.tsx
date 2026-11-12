import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe, { type Result } from "axe-core";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { server } from "./test/server";

/** Runs axe on the whole page. jsdom has no real layout or colours, so the colour-contrast rule cannot work here;
 *  it is checked in the real browser instead (e2e/a11y.spec.ts). */
async function violations(root: Element = document.body): Promise<Result[]> {
  const result = await axe.run(root, { rules: { "color-contrast": { enabled: false } } });
  return result.violations;
}
function describeAll(list: Result[]): string {
  return list.map((v) => `${v.id}: ${v.help} -> ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`).join("\n");
}
async function expectNoViolations() {
  const found = await violations();
  expect(found, describeAll(found)).toEqual([]);
}

describe("axe: the page has no accessibility violations in any state", () => {
  it("loaded with students", async () => {
    render(<App />);
    await screen.findByRole("table");
    await expectNoViolations();
  });
  it("loading", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    server.use(http.get("/api/students", async () => { await gate; return HttpResponse.json([]); })); // answers only when WE say so
    render(<App />);
    await screen.findAllByRole("option", { name: "6A" }); // the class menu has loaded; only the student list is still waiting
    expect(screen.getByRole("status")).toHaveTextContent("Loading students…");
    await expectNoViolations();
    release();
    await screen.findByText("No student matches this search."); // let it finish so nothing is left running
  });
  it("empty result", async () => {
    server.use(http.get("/api/students", () => HttpResponse.json([])));
    render(<App />);
    await screen.findByText("No student matches this search.");
    await expectNoViolations();
  });
  it("server error", async () => {
    server.use(http.get("/api/students", () => new HttpResponse("x", { status: 500 })));
    render(<App />);
    await screen.findByRole("alert");
    await expectNoViolations();
  });
  it("the add form full of errors", async () => {
    render(<App />);
    await screen.findByRole("table");
    await userEvent.click(screen.getByRole("button", { name: "Add student" }));
    expect(screen.getByLabelText("Name")).toHaveAttribute("aria-invalid", "true");
    await expectNoViolations();
  });
  it("the add form with a server error", async () => {
    render(<App />);
    await screen.findByRole("table");
    await userEvent.type(screen.getByLabelText("Name"), "Aarav Reddy");
    await userEvent.selectOptions(screen.getByLabelText("Class for the new student"), "6A");
    await userEvent.type(screen.getByLabelText("Score (0 to 100)"), "5");
    await userEvent.click(screen.getByRole("button", { name: "Add student" }));
    await screen.findByText(/already in class/);
    await expectNoViolations();
  });
  it("after a search", async () => {
    render(<App />);
    await screen.findByRole("table");
    await userEvent.type(screen.getByLabelText("Search by name"), "reddy");
    await screen.findByText("2 students shown");
    await expectNoViolations();
  });
});

describe("axe: the checker itself works (it must be able to fail)", () => {
  it("finds an image without alt text", async () => {
    document.body.innerHTML = '<main><img src="x.png"></main>';
    const found = await violations();
    expect(found.map((v) => v.id)).toContain("image-alt");
  });
  it("finds an input with no label", async () => {
    document.body.innerHTML = "<main><input></main>";
    expect((await violations()).map((v) => v.id)).toContain("label");
  });
  it("finds a button with no name", async () => {
    document.body.innerHTML = "<main><button></button></main>";
    expect((await violations()).map((v) => v.id)).toContain("button-name");
  });
  it("finds a table cell with no heading", async () => {
    document.body.innerHTML = "<main><table><tr><td>a</td></tr></table></main>";
    // axe has no rule that fails a table with no headers at all, so this documents a limit instead of pretending
    expect((await violations()).map((v) => v.id)).not.toContain("td-has-header");
  });
  it("and if the page's own label were removed, the page would fail", async () => {
    render(<App />);
    await screen.findByRole("table");
    screen.getByLabelText("Search by name").removeAttribute("id");
    expect((await violations()).map((v) => v.id)).toContain("label");
  });
});
