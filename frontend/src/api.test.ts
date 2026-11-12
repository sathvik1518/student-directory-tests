import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { addStudent, ApiError, deleteStudent, listClasses, listStudents } from "./api";
import { backend } from "./test/setup";
import { server } from "./test/server";

describe("listStudents", () => {
  it("asks for the plain list when there is no filter", async () => {
    const rows = await listStudents({ q: "", class_name: "" });
    expect(rows).toHaveLength(6);
    const call = backend.requests.find((r) => r.url.pathname === "/api/students");
    expect(call?.url.search).toBe("");
  });
  it("sends the search and the class", async () => {
    await listStudents({ q: "reddy", class_name: "6A" });
    const call = backend.requests.find((r) => r.url.pathname === "/api/students");
    expect(call?.url.searchParams.get("q")).toBe("reddy");
    expect(call?.url.searchParams.get("class_name")).toBe("6A");
  });
  it("does not send a search that is only spaces", async () => {
    await listStudents({ q: "   ", class_name: "" });
    expect(backend.requests.find((r) => r.url.pathname === "/api/students")?.url.search).toBe("");
  });
  it("sends special characters safely", async () => {
    await listStudents({ q: "a&b=c#d", class_name: "" });
    expect(backend.requests.find((r) => r.url.pathname === "/api/students")?.url.searchParams.get("q")).toBe("a&b=c#d");
  });
  it("a network failure becomes a readable message with no status", async () => {
    server.use(http.get("/api/students", () => HttpResponse.error()));
    await expect(listStudents({ q: "", class_name: "" })).rejects.toMatchObject({ name: "ApiError", message: "Cannot reach the server. Is it running?", status: null });
  });
  it("a cancel is passed through as an AbortError, not turned into a message", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(listStudents({ q: "", class_name: "" }, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  });
  it.each([404, 500, 503])("status %i with no body says the status", async (status) => {
    server.use(http.get("/api/students", () => new HttpResponse("oops", { status })));
    await expect(listStudents({ q: "", class_name: "" })).rejects.toThrow(`The server answered ${status}.`);
  });
  it("uses the server's own text when it sends {detail: text}", async () => {
    server.use(http.get("/api/students", () => HttpResponse.json({ detail: "Down for maintenance." }, { status: 503 })));
    await expect(listStudents({ q: "", class_name: "" })).rejects.toThrow("Down for maintenance.");
  });
  it.each([[{ students: [] }], ["text"], [5], [null]])("a body that is not a list (%j) is refused", async (body) => {
    server.use(http.get("/api/students", () => HttpResponse.json(body)));
    await expect(listStudents({ q: "", class_name: "" })).rejects.toThrow("not a student list");
  });
  it("a body that is not JSON is refused", async () => {
    server.use(http.get("/api/students", () => new HttpResponse("<html>", { status: 200 })));
    await expect(listStudents({ q: "", class_name: "" })).rejects.toThrow("not a student list");
  });
});

describe("listClasses", () => {
  it("returns the class names", async () => expect(await listClasses()).toEqual(["6A", "6B", "7A", "7B", "8A"]));
  it("refuses a list with something that is not text in it", async () => {
    server.use(http.get("/api/classes", () => HttpResponse.json(["6A", 7])));
    await expect(listClasses()).rejects.toThrow("not a class list");
  });
});

describe("addStudent", () => {
  it("sends JSON and returns the created student", async () => {
    const created = await addStudent({ name: "Zara Khan", class_name: "8A", score: 77 });
    expect(created).toMatchObject({ id: 7, name: "Zara Khan" });
    expect(backend.requests.find((r) => r.method === "POST")?.body).toEqual({ name: "Zara Khan", class_name: "8A", score: 77 });
  });
  it("a duplicate gives the server's 409 message", async () => {
    await expect(addStudent({ name: "Aarav Reddy", class_name: "6A", score: 1 })).rejects.toMatchObject({ message: "Aarav Reddy is already in class 6A.", status: 409 });
  });
  it("a validation error list is turned into the first message, without FastAPI's prefix", async () => {
    server.use(http.post("/api/students", () => HttpResponse.json({ detail: [{ loc: ["body", "name"], msg: "Value error, Name must not be empty." }] }, { status: 422 })));
    await expect(addStudent({ name: "x", class_name: "6A", score: 1 })).rejects.toThrow(new ApiError("Name must not be empty.", 422));
  });
  it.each([[[]], [[{}]], [[{ msg: 5 }]], [{ nope: 1 }]])("an odd error body (%j) still gives a readable message", async (detail) => {
    server.use(http.post("/api/students", () => HttpResponse.json({ detail }, { status: 422 })));
    await expect(addStudent({ name: "x", class_name: "6A", score: 1 })).rejects.toThrow("The server answered 422.");
  });
});

describe("deleteStudent", () => {
  it("deletes", async () => {
    await deleteStudent(1);
    expect(backend.rows().some((r) => r.id === 1)).toBe(false);
  });
  it("a missing student gives the 404 message", async () => {
    await expect(deleteStudent(999)).rejects.toMatchObject({ message: "Student 999 does not exist.", status: 404 });
  });
});
