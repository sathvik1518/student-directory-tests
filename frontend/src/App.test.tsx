import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { server } from "./test/server";
import { backend } from "./test/setup";

async function ready() {
  render(<App />);
  await screen.findByRole("table");
}
const rows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1); // without the header row
const names = () => rows().map((r) => within(r).getByRole("rowheader").textContent);
const listCalls = () => backend.requests.filter((r) => r.method === "GET" && r.url.pathname === "/api/students");

describe("loading and showing the list", () => {
  it("says it is loading, then shows the students", async () => {
    server.use(http.get("/api/students", async () => { await delay(30); return HttpResponse.json([{ id: 1, name: "Slow One", class_name: "6A", score: 5 }]); }));
    render(<App />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading students…");
    expect(await screen.findByText("Slow One")).toBeInTheDocument();
    expect(screen.getAllByRole("status")[0]).toHaveTextContent("1 student shown");
  });
  it("shows all 6 students with name, class and score", async () => {
    await ready();
    expect(names()).toEqual(["Aarav Reddy", "Diya Goud", "Rohan Naidu", "Meera Rao", "Charan Reddy", "Karthik Sharma"]);
    expect(within(rows()[0]!).getAllByRole("cell").map((c) => c.textContent)).toEqual(["6A", "40", "Delete"]);
    expect(screen.getByRole("status")).toHaveTextContent("6 students shown");
  });
  it("the table has a caption and proper column headings", async () => {
    await ready();
    expect(screen.getByRole("table", { name: "Students" })).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Name", "Class", "Score", "Actions"]);
  });
  it("the class menus are filled from the server", async () => {
    await ready();
    const menu = screen.getByLabelText("Class");
    expect(within(menu).getAllByRole("option").map((o) => o.textContent)).toEqual(["All classes", "6A", "6B", "7A", "7B", "8A"]);
  });
  it("an empty list says so, in words", async () => {
    server.use(http.get("/api/students", () => HttpResponse.json([])));
    render(<App />);
    expect(await screen.findByText("No student matches this search.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("0 students shown");
  });
  it("the page still works if the class list cannot be loaded", async () => {
    server.use(http.get("/api/classes", () => HttpResponse.error()));
    await ready();
    expect(names()).toHaveLength(6);
    expect(within(screen.getByLabelText("Class")).getAllByRole("option")).toHaveLength(1);
  });
});

describe("searching and filtering", () => {
  it("narrows by name and tells the server", async () => {
    await ready();
    await userEvent.type(screen.getByLabelText("Search by name"), "reddy");
    await waitFor(() => expect(names()).toEqual(["Aarav Reddy", "Charan Reddy"]));
    expect(listCalls().at(-1)?.url.searchParams.get("q")).toBe("reddy");
    expect(screen.getByRole("status")).toHaveTextContent("2 students shown");
  });
  it("says so when nothing matches, and recovers when the search is cleared", async () => {
    await ready();
    const box = screen.getByLabelText("Search by name");
    await userEvent.type(box, "zzzz");
    expect(await screen.findByText("No student matches this search.")).toBeInTheDocument();
    await userEvent.clear(box);
    await waitFor(() => expect(names()).toHaveLength(6));
  });
  it("filters by class", async () => {
    await ready();
    await userEvent.selectOptions(screen.getByLabelText("Class"), "7A");
    await waitFor(() => expect(names()).toEqual(["Rohan Naidu", "Karthik Sharma"]));
    expect(listCalls().at(-1)?.url.searchParams.get("class_name")).toBe("7A");
  });
  it("search and class work together", async () => {
    await ready();
    await userEvent.selectOptions(screen.getByLabelText("Class"), "7A");
    await userEvent.type(screen.getByLabelText("Search by name"), "naidu");
    await waitFor(() => expect(names()).toEqual(["Rohan Naidu"]));
    expect(screen.getByRole("status")).toHaveTextContent("1 student shown");
  });
  it("an old, slow answer never overwrites a newer one", async () => {
    server.use(
      http.get("/api/students", async ({ request }) => {
        const q = new URL(request.url).searchParams.get("q");
        if (q === "r") { await delay(150); return HttpResponse.json([{ id: 9, name: "Old Answer", class_name: "6A", score: 1 }]); }
        return HttpResponse.json([{ id: 1, name: "New Answer", class_name: "6A", score: 1 }]);
      }),
    );
    render(<App />);
    await screen.findByRole("table");
    await userEvent.type(screen.getByLabelText("Search by name"), "re"); // "r" is slow, "re" is fast
    expect(await screen.findByText("New Answer")).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 250));
    expect(screen.queryByText("Old Answer")).not.toBeInTheDocument();
  });
});

describe("cancelled searches", () => {
  it("a search replaced by a newer one never flashes an error while the newer one is still loading", async () => {
    await ready();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    server.use(http.get("/api/students", async ({ request }) => {
      if (new URL(request.url).searchParams.get("q")) await gate; // both searches wait; the first is cancelled by the second
      return HttpResponse.json([{ id: 1, name: "Late Answer", class_name: "6A", score: 1 }]);
    }));
    await userEvent.type(screen.getByLabelText("Search by name"), "re");
    await new Promise((r) => setTimeout(r, 60)); // time for the cancelled request to report back
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(names()).toHaveLength(6); // the old list stays on screen meanwhile
    release();
    expect(await screen.findByText("Late Answer")).toBeInTheDocument();
  });
});

describe("when the server fails", () => {
  it("shows the server's problem and a Try again button that works", async () => {
    server.use(http.get("/api/students", () => new HttpResponse("boom", { status: 500 }), { once: true }));
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent("The server answered 500.");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("a dead network says 'Cannot reach the server'", async () => {
    server.use(http.get("/api/students", () => HttpResponse.error()));
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Cannot reach the server. Is it running?");
  });
  it("a body that is not a list is a message, not a crash", async () => {
    server.use(http.get("/api/students", () => HttpResponse.json({ nope: true })));
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent("not a student list");
  });
  it("a failed search keeps working for the next search", async () => {
    await ready();
    server.use(http.get("/api/students", () => new HttpResponse("x", { status: 503 }), { once: true }));
    await userEvent.type(screen.getByLabelText("Search by name"), "a");
    expect(await screen.findByRole("alert")).toHaveTextContent("503");
    await userEvent.type(screen.getByLabelText("Search by name"), "a");
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });
});

describe("adding a student", () => {
  async function fill(name: string, cls: string, score: string) {
    if (name) await userEvent.type(screen.getByLabelText("Name"), name);
    if (cls) await userEvent.selectOptions(screen.getByLabelText("Class for the new student"), cls);
    if (score) await userEvent.type(screen.getByLabelText("Score (0 to 100)"), score);
  }

  it("adds, announces it, shows it, clears the form and puts the cursor back in Name", async () => {
    await ready();
    await fill("Zara Khan", "8A", "77");
    await userEvent.click(screen.getByRole("button", { name: "Add student" }));
    expect(await screen.findByText("Added Zara Khan.")).toBeInTheDocument();
    await waitFor(() => expect(names()).toContain("Zara Khan"));
    expect(screen.getByLabelText("Name")).toHaveValue("");
    expect(screen.getByLabelText("Name")).toHaveFocus();
    expect(backend.requests.find((r) => r.method === "POST")?.body).toEqual({ name: "Zara Khan", class_name: "8A", score: 77 });
  });
  it("submitting with the Enter key works too", async () => {
    await ready();
    await fill("Zara Khan", "8A", "77");
    await userEvent.type(screen.getByLabelText("Score (0 to 100)"), "{Enter}");
    expect(await screen.findByText("Added Zara Khan.")).toBeInTheDocument();
  });
  it("an empty form shows all three problems, sends nothing, and moves the cursor to the first one", async () => {
    await ready();
    await userEvent.click(screen.getByRole("button", { name: "Add student" }));
    expect(screen.getByText("Enter a name.")).toBeInTheDocument();
    expect(screen.getByText("Choose a class.")).toBeInTheDocument();
    expect(screen.getByText("Enter a score from 0 to 100.")).toBeInTheDocument();
    expect(backend.requests.some((r) => r.method === "POST")).toBe(false);
    expect(screen.getByLabelText("Name")).toHaveFocus();
  });
  it("each bad field is marked invalid and linked to its message", async () => {
    await ready();
    await userEvent.click(screen.getByRole("button", { name: "Add student" }));
    const name = screen.getByLabelText("Name");
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAccessibleDescription("Enter a name.");
    expect(screen.getByLabelText("Score (0 to 100)")).toHaveAccessibleDescription("Enter a score from 0 to 100.");
  });
  it.each([["abc"], ["101"], ["5.5"], ["-3"]])("a score of %s is refused before anything is sent", async (score) => {
    await ready();
    await fill("Zara Khan", "8A", score);
    await userEvent.click(screen.getByRole("button", { name: "Add student" }));
    expect(screen.getByText("Score must be a whole number from 0 to 100.")).toBeInTheDocument();
    expect(screen.getByLabelText("Score (0 to 100)")).toHaveFocus();
    expect(backend.requests.some((r) => r.method === "POST")).toBe(false);
  });
  it("the messages go away once the form is fixed", async () => {
    await ready();
    await userEvent.click(screen.getByRole("button", { name: "Add student" }));
    await fill("Zara Khan", "8A", "77");
    await userEvent.click(screen.getByRole("button", { name: "Add student" }));
    await screen.findByText("Added Zara Khan.");
    expect(screen.queryByText("Enter a name.")).not.toBeInTheDocument();
  });
  it("a duplicate shows the server's message and keeps what was typed", async () => {
    await ready();
    await fill("aarav   reddy", "6A", "50");
    await userEvent.click(screen.getByRole("button", { name: "Add student" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("aarav reddy is already in class 6A.");
    expect(screen.getByLabelText("Name")).toHaveValue("aarav   reddy");
    expect(screen.getByRole("button", { name: "Add student" })).toBeEnabled();
  });
  it("a server validation error is shown in plain words", async () => {
    server.use(http.post("/api/students", () => HttpResponse.json({ detail: [{ msg: "Value error, Class must be one of: 6A." }] }, { status: 422 })));
    await ready();
    await fill("Zara Khan", "8A", "5");
    await userEvent.click(screen.getByRole("button", { name: "Add student" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Class must be one of: 6A.");
  });
  it("a dead network while adding says so, and nothing was added", async () => {
    server.use(http.post("/api/students", () => HttpResponse.error()));
    await ready();
    await fill("Zara Khan", "8A", "5");
    await userEvent.click(screen.getByRole("button", { name: "Add student" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Cannot reach the server. Is it running?");
    expect(names()).not.toContain("Zara Khan");
  });
  it("while sending, the button is disabled, so a double click adds only once", async () => {
    let posts = 0;
    server.use(http.post("/api/students", async () => { posts += 1; await delay(80); return HttpResponse.json({ id: 50, name: "Zara Khan", class_name: "8A", score: 5 }, { status: 201 }); }));
    await ready();
    await fill("Zara Khan", "8A", "5");
    const button = screen.getByRole("button", { name: "Add student" });
    await userEvent.dblClick(button);
    expect(screen.getByRole("button", { name: "Adding…" })).toBeDisabled();
    await screen.findByText("Added Zara Khan.");
    expect(posts).toBe(1);
  });
});

describe("deleting a student", () => {
  it("each Delete button says whose it is", async () => {
    await ready();
    expect(screen.getAllByRole("button", { name: /^Delete / }).map((b) => b.getAttribute("aria-label"))).toContain("Delete Aarav Reddy");
  });
  it("deletes, announces it, and the row goes", async () => {
    await ready();
    await userEvent.click(screen.getByRole("button", { name: "Delete Diya Goud" }));
    expect(await screen.findByText("Deleted Diya Goud.")).toBeInTheDocument();
    await waitFor(() => expect(names()).not.toContain("Diya Goud"));
    expect(names()).toHaveLength(5);
  });
  it("deleting someone already deleted by someone else shows the server's message and refreshes the list", async () => {
    await ready();
    backend.rows().splice(0, backend.rows().length); // the server loses everybody behind the page's back
    await userEvent.click(screen.getByRole("button", { name: "Delete Diya Goud" }));
    expect(await screen.findByText("Student 2 does not exist.")).toBeInTheDocument();
    expect(await screen.findByText("No student matches this search.")).toBeInTheDocument();
  });
});
