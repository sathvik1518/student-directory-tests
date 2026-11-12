import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { Student } from "../api";

export const CLASSES = ["6A", "6B", "7A", "7B", "8A"];
export const SEED: Student[] = [
  { id: 1, name: "Aarav Reddy", class_name: "6A", score: 40 },
  { id: 2, name: "Diya Goud", class_name: "6B", score: 47 },
  { id: 3, name: "Rohan Naidu", class_name: "7A", score: 54 },
  { id: 4, name: "Meera Rao", class_name: "7B", score: 61 },
  { id: 5, name: "Charan Reddy", class_name: "8A", score: 68 },
  { id: 6, name: "Karthik Sharma", class_name: "7A", score: 75 },
];

export type Backend = { handlers: ReturnType<typeof http.get>[]; requests: { method: string; url: URL; body?: unknown }[]; rows: () => Student[] };

/** A small pretend server with memory: adding a student makes it appear in the next list, deleting removes it.
 *  It follows the real server's rules for the cases the page tests need (409 for a duplicate, 404 for a missing id). */
export function makeBackend(initial: Student[] = SEED): Backend {
  let rows = initial.map((s) => ({ ...s }));
  let nextId = Math.max(0, ...rows.map((r) => r.id)) + 1;
  const requests: Backend["requests"] = [];
  const key = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  const handlers = [
    http.get("/api/classes", ({ request }) => {
      requests.push({ method: "GET", url: new URL(request.url) });
      return HttpResponse.json(CLASSES);
    }),
    http.get("/api/students", ({ request }) => {
      const url = new URL(request.url);
      requests.push({ method: "GET", url });
      const q = key(url.searchParams.get("q") ?? "");
      const cls = url.searchParams.get("class_name") ?? "";
      return HttpResponse.json(rows.filter((r) => (!q || key(r.name).includes(q)) && (!cls || r.class_name === cls)));
    }),
    http.post("/api/students", async ({ request }) => {
      const body = (await request.json()) as Omit<Student, "id">;
      requests.push({ method: "POST", url: new URL(request.url), body });
      if (rows.some((r) => key(r.name) === key(body.name) && r.class_name === body.class_name)) {
        return HttpResponse.json({ detail: `${body.name} is already in class ${body.class_name}.` }, { status: 409 });
      }
      const created = { id: nextId++, ...body };
      rows = [...rows, created];
      return HttpResponse.json(created, { status: 201 });
    }),
    http.delete("/api/students/:id", ({ request, params }) => {
      requests.push({ method: "DELETE", url: new URL(request.url) });
      const id = Number(params.id);
      if (!rows.some((r) => r.id === id)) return HttpResponse.json({ detail: `Student ${id} does not exist.` }, { status: 404 });
      rows = rows.filter((r) => r.id !== id);
      return new HttpResponse(null, { status: 204 });
    }),
  ];
  return { handlers: handlers as never, requests, rows: () => rows };
}

/** Every request nobody planned for ends up here. The setup file fails the test if this is not empty. */
export const unhandled: string[] = [];

export const server = setupServer();
