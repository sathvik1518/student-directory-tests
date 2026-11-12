# Testing a Student Directory End to End: Server Tests, Component Tests With a Pretend Server, Accessibility Checks, Real-Browser Journeys, and Tests That Are Proven to Fail

**Day 48 Mini Capstone, Test a Student Directory End to End (Testing)**  
**Project folder:** `student-directory-tests`

---

## 1. Goal

Build a small student directory (search, class filter, add, delete) and **test it at every level**. The plan for this capstone was:

1. **pytest** tests for the server.
2. **Vitest + React Testing Library + MSW** component tests (MSW is a pretend server, so component tests need no real backend).
3. **axe** accessibility checks.
4. **Playwright** journeys in a real browser against the real server.
5. A **failing-on-purpose** check: prove the tests fail when the code is broken.
6. A written **not-covered list**.

I could not re-read the original task page, so this follows that plan as written. If your page asks for something extra, tell me and I will add it.

Think of checking a new bridge. **pytest** tests each steel beam alone (server rules). **Component tests** test a section of the deck with a model of the river (the page with a pretend server). **axe** checks the handrails and signs a machine can check. **Playwright** walks real people across the real bridge. **Failing on purpose** is deliberately loosening one bolt at a time to see that the inspectors notice. The **not-covered list** is the honest sign at the entrance: "we did not test it in a storm."

**What is real and what is not.** Python server with a real SQLite file, real built React page, real Chromium (headless, Linux). The component tests use a pretend server (MSW) that I wrote; it is a copy of the real server's rules, which is why the real-browser journeys exist as well. Windows was **not** tested. See *Known limit* and `NOT_COVERED.md`.

---

## 2. Tools

| Tool | Role |
|---|---|
| Python 3.10+ (tested on 3.13), FastAPI 0.162.0, uvicorn 0.54.0 | The server |
| pytest 9.1.1 + httpx | Server tests |
| React 19 + TypeScript + Vite | The page |
| Vitest 5 + React Testing Library + user-event + jest-dom + jsdom | Component tests |
| MSW 3 | The pretend server for component tests. **In MSW 3 the option that catches unplanned requests is `onUnhandledFrame`; the old name `onUnhandledRequest` is silently ignored** (see `guard.test.ts`) |
| axe-core 4 | Accessibility rules, in jsdom |
| Playwright 1.65 + @axe-core/playwright | Real-browser journeys, and axe with colour contrast |

---

## 3. Project structure

```
student-directory-tests/
├── NOT_COVERED.md                 (what is not tested, and why)
├── break48.py                     (57 deliberate mistakes; the tests must notice each)
├── backend/
│   ├── app/ seed.py main.py __main__.py
│   └── tests/ conftest.py test_api.py          (50 tests)
└── frontend/
    ├── playwright.config.ts                    (starts the real server + built page)
    ├── src/ api.ts validate.ts App.tsx main.tsx styles.css
    ├── src/test/ server.ts setup.ts guard.test.ts
    ├── src/ validate.test.ts api.test.ts App.test.tsx axe.test.tsx   (94 tests with guard)
    └── e2e/ fixtures.ts journeys.spec.ts a11y.spec.ts                (27 tests)
```

---

## 4. Setup commands

```bash
# Windows PowerShell. Two windows are NOT needed: Playwright starts both servers itself.
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
cd ..\frontend
npm install
npx playwright install chromium
```

**Commands**

```bash
# backend folder
python -m pytest -q                  # 50 server tests
python -m app                        # server on http://127.0.0.1:8000 (data resets at every start)
# frontend folder
npm test                             # 94 component, api, axe tests
npm run dev                          # page on http://localhost:5173 (start the server first)
npm run test:e2e                     # 27 real-browser tests (starts both servers itself)
# project folder
python break48.py                    # 57 deliberate mistakes
```

---

## 5. The idea: each level catches what the others cannot

| Level | Real server? | Real browser? | Catches | Cannot catch |
|---|---|---|---|---|
| pytest (50) | yes | no | server rules: duplicates, ranges, accents, 404, the test-only reset switch | anything the page does |
| Vitest + MSW (94) | **no, a copy** | no (jsdom) | what the user sees and does: states, forms, focus, messages, stale answers, labels | colours, layout, real network, the copy drifting from the real server |
| axe in jsdom (12) | no | no | missing labels, names, table headings | colour contrast (jsdom has no colours) |
| Playwright (27) | **yes** | **yes** | the whole path, colour contrast, focus ring, sideways scrolling, two tabs, reloads | other browsers, other computers |

**Safety nets built into the tests themselves**
- **Every pytest test gets a brand-new database**, so tests cannot affect each other.
- **Every Playwright test starts with a server reset** (`POST /api/test/reset`). That address exists **only** when `ENABLE_TEST_RESET=1`; tests check it is missing by default and for any value other than `1`.
- **Unplanned requests fail the test.** If the page asks the pretend server for something nobody planned, the test fails. A test (`guard.test.ts`) proves this guard works; a guard that does nothing looks just like one that works.
- **Unplanned `console.error` fails the test**, so a React warning cannot hide.
- **No retries** in Playwright: a test that needs a second try is a broken test.
- **Every checker is shown to fail:** axe finds a missing `alt`, a missing label, an unnamed button, and (in the browser) low-contrast text.

**Failing on purpose.** `python break48.py` loosens one bolt at a time (57 times), runs the matching test suite, expects it to fail, and puts the file back. Example of what a caught mistake looks like (the database `UNIQUE` rule removed):

```
................................F
=================================== FAILURES ===================================
_______ test_duplicate_in_the_same_class_is_409_with_a_readable_message ________

client = <starlette.testclient.TestClient object at 0x7fc64b513af0>

    def test_duplicate_in_the_same_class_is_409_with_a_readable_message(client):
        r = add(client, name="Aarav Reddy", class_name="6A")
>       assert r.status_code == 409 and r.json()["detail"] == "Aarav Reddy is already in class 6A."
E       assert (201 == 409)
E        +  where 201 = <Response [201 Created]>.status_code

tests/test_api.py:131: AssertionError
=========================== short test summary info ============================
FAILED tests/test_api.py::test_duplicate_in_the_same_class_is_409_with_a_readable_message
!!!!!!!!!!!!!!!!!!!!!!!!!! stopping after 1 failures !!!!!!!!!!!!!!!!!!!!!!!!!!!
1 failed, 32 passed in 0.53s
```

**What breaking things taught me.** First full run: **56 of 58 caught**. Fixes: (1) a search replaced by a newer one could flash an error and no test saw it, so I added a test that holds both answers back and checks no alert appears; (2) one mutation (remove the page icon) cannot be seen in headless Chromium, which never asks for the icon, so I removed that case instead of counting it, and wrote it in `NOT_COVERED.md`. Before that, two other cases were *equivalent mutations* (the code changed, behaviour did not): I rewrote them so they test real behaviour, and added tests that read the accent-normalising function directly. After the fixes the cancel case was re-run on its own (caught); I did **not** repeat the whole 57-case run.

**A real bug found while testing.** The page checked for a cancelled request with `error instanceof DOMException`. In the test environment the cancel error is a different copy of `DOMException`, so the check failed and a cancel would have been shown as "Cannot reach the server". Now it is checked by name (`error.name === "AbortError"`).

---

## 6. The code

### `backend/app/seed.py`

```python
"""The same 30 students every time, so every test knows what to expect."""
CLASSES = ["6A", "6B", "7A", "7B", "8A"]
NAMES = [
    "Aarav Reddy", "Diya Goud", "Rohan Naidu", "Meera Rao", "Karthik Sharma", "Ananya Patel",
    "Teja Kumar", "Priya Verma", "Vivaan Yadav", "Isha Gupta", "Arjun Singh", "Sneha Mehta",
    "Harsha Nair", "Pooja Iyer", "Nikhil Joshi", "Divya Das", "Sai Pillai", "Keerthi Menon",
    "Varun Bhat", "Anjali Shetty", "Rahul Jain", "Navya Thakur", "Charan Reddy", "Harini Goud",
    "Pranav Rao", "Bhavana Naidu", "Aditya Kumar", "Lakshmi Sharma", "Krishna Patel", "Sirisha Verma",
]


def seed_rows() -> list[tuple[str, str, int]]:
    """(name, class_name, score). Class and score follow the position, so they never change between runs."""
    return [(name, CLASSES[i % len(CLASSES)], 40 + (i * 7) % 61) for i, name in enumerate(NAMES)]
```

### `backend/app/main.py`

```python
from __future__ import annotations

import os
import sqlite3
import unicodedata
from contextlib import closing
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, HTTPException, Query, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.seed import CLASSES, seed_rows

MAX_NAME = 60

SCHEMA = """
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL,
  class_name TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  UNIQUE (name_key, class_name)
);
"""


def name_key(name: str) -> str:
    """Two names are 'the same' when they differ only by case, extra spaces or how an accent is typed."""
    return " ".join(unicodedata.normalize("NFC", name).split()).casefold()


class NewStudent(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    name: str
    class_name: str
    score: Annotated[int, Field(ge=0, le=100)]

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        cleaned = " ".join(unicodedata.normalize("NFC", value).split())
        if not cleaned:
            raise ValueError("Name must not be empty.")
        if len(cleaned) > MAX_NAME:
            raise ValueError(f"Name must be at most {MAX_NAME} characters.")
        return cleaned

    @field_validator("class_name")
    @classmethod
    def known_class(cls, value: str) -> str:
        if value not in CLASSES:
            raise ValueError(f"Class must be one of: {', '.join(CLASSES)}.")
        return value


def create_app(db_path: str | Path, *, allow_reset: bool | None = None) -> FastAPI:
    """allow_reset: the /api/test/reset address exists only when this is true (or ENABLE_TEST_RESET=1). Never on in production."""
    if allow_reset is None:
        allow_reset = os.environ.get("ENABLE_TEST_RESET") == "1"
    path = str(db_path)
    app = FastAPI(title="Student Directory")

    def connect() -> sqlite3.Connection:
        conn = sqlite3.connect(path)
        conn.row_factory = sqlite3.Row
        return conn

    def reset() -> None:
        with closing(connect()) as conn:
            conn.executescript("DROP TABLE IF EXISTS students;" + SCHEMA)
            conn.executemany(
                "INSERT INTO students (name, name_key, class_name, score) VALUES (?, ?, ?, ?)",
                [(n, name_key(n), c, s) for n, c, s in seed_rows()],
            )
            conn.commit()

    reset()  # a fresh, known database every time the server starts

    def as_dict(row: sqlite3.Row) -> dict:
        return {"id": row["id"], "name": row["name"], "class_name": row["class_name"], "score": row["score"]}

    @app.get("/api/health")
    def health() -> dict:
        return {"status": "ok"}

    @app.get("/api/classes")
    def classes() -> list[str]:
        return CLASSES

    @app.get("/api/students")
    def list_students(
        q: Annotated[str, Query(max_length=60)] = "",
        class_name: Annotated[str, Query(max_length=10)] = "",
    ) -> list[dict]:
        key = name_key(q)
        sql, args = "SELECT * FROM students WHERE 1=1", []
        if key:
            sql += " AND instr(name_key, ?) > 0"
            args.append(key)
        if class_name:
            sql += " AND class_name = ?"
            args.append(class_name)
        with closing(connect()) as conn:
            return [as_dict(r) for r in conn.execute(sql + " ORDER BY id", args)]

    @app.post("/api/students", status_code=201)
    def add_student(student: NewStudent) -> dict:
        with closing(connect()) as conn:
            try:
                cur = conn.execute(
                    "INSERT INTO students (name, name_key, class_name, score) VALUES (?, ?, ?, ?)",
                    (student.name, name_key(student.name), student.class_name, student.score),
                )
                conn.commit()
            except sqlite3.IntegrityError as error:
                if "UNIQUE" in str(error):
                    raise HTTPException(409, f"{student.name} is already in class {student.class_name}.") from None
                raise
            return as_dict(conn.execute("SELECT * FROM students WHERE id = ?", (cur.lastrowid,)).fetchone())

    @app.delete("/api/students/{student_id}", status_code=204)
    def delete_student(student_id: int) -> Response:
        with closing(connect()) as conn:
            cur = conn.execute("DELETE FROM students WHERE id = ?", (student_id,))
            conn.commit()
            if cur.rowcount == 0:
                raise HTTPException(404, f"Student {student_id} does not exist.")
        return Response(status_code=204)

    if allow_reset:

        @app.post("/api/test/reset", status_code=204)
        def reset_for_tests() -> Response:
            reset()
            return Response(status_code=204)

    return app
```

### `backend/app/__main__.py`

```python
"""python -m app   ->  http://127.0.0.1:8000"""
import os
from pathlib import Path

import uvicorn

from app.main import create_app

db = os.environ.get("STUDENTS_DB", str(Path(__file__).resolve().parent.parent / "students.db"))
uvicorn.run(create_app(db), host="127.0.0.1", port=int(os.environ.get("PORT", "8000")), log_level="warning")
```

### `backend/requirements.txt`

```text
fastapi==0.162.0
uvicorn==0.54.0
```

### `backend/requirements-dev.txt`

```text
-r requirements.txt
pytest==9.1.1
httpx==0.28.1
```

### `backend/pytest.ini`

```ini
[pytest]
testpaths = tests
addopts = -p no:cacheprovider
```

### `frontend/package.json`

```json
{
  "name": "student-directory-tests-frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "react": "^19.3.1",
    "react-dom": "^19.3.1"
  },
  "devDependencies": {
    "@axe-core/playwright": "^4.11.0",
    "@playwright/test": "^1.63.0",
    "@testing-library/jest-dom": "^7.0.1",
    "@testing-library/react": "^16.3.3",
    "@testing-library/user-event": "^14.6.8",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "@vitejs/plugin-react": "^6.2.1",
    "axe-core": "^4.11.0",
    "jsdom": "^31.0.0",
    "msw": "^3.0.3",
    "typescript": "^7.0.2",
    "vite": "^8.3.6",
    "vitest": "^5.1.0"
  }
}
```

### `frontend/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "types": ["vitest/globals"]
  },
  "include": ["src", "vite.config.ts"]
}
```

### `frontend/vite.config.ts`

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// The page asks /api/... on its own address; this proxy forwards it to the Python server (same origin, no CORS).
const api = { "/api": { target: "http://127.0.0.1:8000", changeOrigin: false } };

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true, proxy: api },
  preview: { port: 4173, strictPort: true, proxy: api },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
```

### `frontend/playwright.config.ts`

```ts
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "@playwright/test";

const python = process.platform === "win32" ? "python" : "python3";
const database = join(tmpdir(), "student-directory-e2e.db");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // one database, so one test at a time; every test starts from a reset (see e2e/fixtures.ts)
  workers: 1,
  retries: 0, // a test that needs a retry to pass is a broken test, not a lucky one
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Use your own Chrome/Chromium if you set CHROMIUM_PATH; otherwise the one `npx playwright install chromium` downloaded.
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  webServer: [
    {
      // The real Python server, with the test-only reset address switched ON and a throw-away database file.
      command: `${python} -m app`,
      cwd: "../backend",
      env: { ENABLE_TEST_RESET: "1", STUDENTS_DB: database, PORT: "8000" },
      url: "http://127.0.0.1:8000/api/health",
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      // The real built page, with /api forwarded to Python.
      command: "npx vite build --logLevel error && npx vite preview --logLevel error",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: false,
      timeout: 90_000,
    },
  ],
});
```

### `frontend/index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" href="data:," />
    <title>Student Directory</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### `frontend/src/api.ts`

```ts
export type Student = { id: number; name: string; class_name: string; score: number };
export type NewStudent = { name: string; class_name: string; score: number };
export type Filter = { q: string; class_name: string };

/** A message a person can read. Never a stack trace, never "[object Object]". */
export class ApiError extends Error {
  readonly status: number | null;
  constructor(message: string, status: number | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** By NAME, not by class: the cancel error can come from a different copy of DOMException (this happened in the test environment). */
export function isAbort(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { name?: unknown }).name === "AbortError";
}

async function send(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(path, init);
  } catch (error) {
    if (isAbort(error)) throw error;
    throw new ApiError("Cannot reach the server. Is it running?", null);
  }
}

/** FastAPI sends {detail: "text"} for our own errors and {detail: [{loc, msg}, ...]} for validation errors. */
async function problem(response: Response): Promise<ApiError> {
  let detail: unknown;
  try {
    detail = ((await response.json()) as { detail?: unknown }).detail;
  } catch {
    return new ApiError(`The server answered ${response.status}.`, response.status);
  }
  if (typeof detail === "string") return new ApiError(detail, response.status);
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: unknown };
    if (typeof first.msg === "string") return new ApiError(first.msg.replace(/^Value error, /, ""), response.status);
  }
  return new ApiError(`The server answered ${response.status}.`, response.status);
}

export async function listStudents(filter: Filter, signal?: AbortSignal): Promise<Student[]> {
  const params = new URLSearchParams();
  if (filter.q.trim()) params.set("q", filter.q);
  if (filter.class_name) params.set("class_name", filter.class_name);
  const query = params.toString();
  const response = await send(`/api/students${query ? `?${query}` : ""}`, { signal });
  if (!response.ok) throw await problem(response);
  const body: unknown = await response.json().catch(() => null);
  if (!Array.isArray(body)) throw new ApiError("The server sent something that is not a student list.", response.status);
  return body as Student[];
}

export async function listClasses(signal?: AbortSignal): Promise<string[]> {
  const response = await send("/api/classes", { signal });
  if (!response.ok) throw await problem(response);
  const body: unknown = await response.json().catch(() => null);
  if (!Array.isArray(body) || !body.every((c) => typeof c === "string")) throw new ApiError("The server sent something that is not a class list.", response.status);
  return body;
}

export async function addStudent(student: NewStudent): Promise<Student> {
  const response = await send("/api/students", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(student) });
  if (!response.ok) throw await problem(response);
  return (await response.json()) as Student;
}

export async function deleteStudent(id: number): Promise<void> {
  const response = await send(`/api/students/${id}`, { method: "DELETE" });
  if (!response.ok) throw await problem(response);
}
```

### `frontend/src/validate.ts`

```ts
import { type NewStudent } from "./api";

export const MAX_NAME = 60;
export type FormValues = { name: string; class_name: string; score: string };
export type FormErrors = Partial<Record<keyof FormValues, string>>;

/** Checks the form the same way the server does, so the person gets the answer without waiting for a round trip.
 *  The server checks again: the page's check is a convenience, never the protection. */
export function validate(values: FormValues, classes: readonly string[]): { ok: true; student: NewStudent } | { ok: false; errors: FormErrors } {
  const errors: FormErrors = {};
  const name = values.name.trim().replace(/\s+/g, " ");
  if (name === "") errors.name = "Enter a name.";
  else if (name.length > MAX_NAME) errors.name = `Name must be at most ${MAX_NAME} characters.`;
  if (!classes.includes(values.class_name)) errors.class_name = "Choose a class.";
  const text = values.score.trim();
  if (text === "") errors.score = "Enter a score from 0 to 100.";
  else if (!/^\d+$/.test(text) || Number(text) > 100) errors.score = "Score must be a whole number from 0 to 100.";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, student: { name, class_name: values.class_name, score: Number(text) } };
}
```

### `frontend/src/App.tsx`

```tsx
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { addStudent, deleteStudent, isAbort, listClasses, listStudents, type Filter, type Student } from "./api";
import { MAX_NAME, validate, type FormErrors, type FormValues } from "./validate";

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; students: Student[] };
const EMPTY_FORM: FormValues = { name: "", class_name: "", score: "" };

export function App() {
  const searchId = useId();
  const classId = useId();
  const [filter, setFilter] = useState<Filter>({ q: "", class_name: "" });
  const [classes, setClasses] = useState<string[]>([]);
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    listClasses(controller.signal).then(setClasses, () => {
      /* the list itself reports connection problems; the class menus just stay short */
    });
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    const controller = new AbortController();
    setLoad((current) => (current.status === "ready" ? current : { status: "loading" }));
    listStudents(filter, controller.signal).then(
      (students) => setLoad({ status: "ready", students }),
      (error: unknown) => {
        if (isAbort(error)) return; // a newer search replaced this one
        setLoad({ status: "error", message: error instanceof Error ? error.message : "Something went wrong." });
      },
    );
    return () => controller.abort();
  }, [filter, attempt]);

  const refresh = useCallback(() => setAttempt((n) => n + 1), []);

  async function remove(student: Student) {
    try {
      await deleteStudent(student.id);
      setNotice(`Deleted ${student.name}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not delete.");
    }
    refresh();
  }

  return (
    <main className="page">
      <h1>Student Directory</h1>

      <form className="filters" role="search" aria-label="Find students" onSubmit={(e) => e.preventDefault()}>
        <div className="field">
          <label htmlFor={searchId}>Search by name</label>
          <input id={searchId} type="search" autoComplete="off" value={filter.q} maxLength={60} onChange={(e) => setFilter({ ...filter, q: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor={classId}>Class</label>
          <select id={classId} value={filter.class_name} onChange={(e) => setFilter({ ...filter, class_name: e.target.value })}>
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </form>

      <p role="status" className="summary">
        {load.status === "ready" ? `${load.students.length} ${load.students.length === 1 ? "student" : "students"} shown` : load.status === "loading" ? "Loading students…" : ""}
      </p>
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}

      {load.status === "error" && (
        <div role="alert" className="problem">
          <p>{load.message}</p>
          <button type="button" onClick={refresh}>
            Try again
          </button>
        </div>
      )}

      {load.status === "ready" &&
        (load.students.length === 0 ? (
          <p className="empty">No student matches this search.</p>
        ) : (
          <table>
            <caption>Students</caption>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Class</th>
                <th scope="col">Score</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {load.students.map((s) => (
                <tr key={s.id}>
                  <th scope="row">{s.name}</th>
                  <td>{s.class_name}</td>
                  <td>{s.score}</td>
                  <td>
                    <button type="button" onClick={() => void remove(s)} aria-label={`Delete ${s.name}`}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}

      <AddForm classes={classes} onAdded={(s) => { setNotice(`Added ${s.name}.`); refresh(); }} />
    </main>
  );
}

function AddForm({ classes, onAdded }: { classes: string[]; onAdded: (s: Student) => void }) {
  const id = useId();
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const firstBad = useRef<keyof FormValues | null>(null);

  useEffect(() => {
    // After a failed submit, move the cursor to the first field with a problem (keyboard and screen-reader users need this).
    if (firstBad.current) {
      document.getElementById(`${id}-${firstBad.current}`)?.focus();
      firstBad.current = null;
    }
  }, [errors, id]);

  function set(field: keyof FormValues, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setServerError("");
    const result = validate(values, classes);
    if (!result.ok) {
      firstBad.current = (["name", "class_name", "score"] as const).find((f) => result.errors[f]) ?? null;
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      onAdded(await addStudent(result.student));
      setValues(EMPTY_FORM);
      nameRef.current?.focus();
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Could not add the student.");
    } finally {
      setBusy(false);
    }
  }

  const field = (name: keyof FormValues) => ({
    id: `${id}-${name}`,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `${id}-${name}-error` : undefined,
  });
  const error = (name: keyof FormValues) =>
    errors[name] ? (
      <p id={`${id}-${name}-error`} className="field-error">
        {errors[name]}
      </p>
    ) : null;

  return (
    <section aria-labelledby={`${id}-title`} className="add">
      <h2 id={`${id}-title`}>Add a student</h2>
      <form onSubmit={(e) => void submit(e)} noValidate>
        <div className="field">
          <label htmlFor={`${id}-name`}>Name</label>
          <input {...field("name")} ref={nameRef} value={values.name} maxLength={MAX_NAME + 20} autoComplete="off" onChange={(e) => set("name", e.target.value)} />
          {error("name")}
        </div>
        <div className="field">
          <label htmlFor={`${id}-class_name`}>Class for the new student</label>
          <select {...field("class_name")} value={values.class_name} onChange={(e) => set("class_name", e.target.value)}>
            <option value="">Choose a class</option>
            {classes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {error("class_name")}
        </div>
        <div className="field">
          <label htmlFor={`${id}-score`}>Score (0 to 100)</label>
          <input {...field("score")} value={values.score} inputMode="numeric" autoComplete="off" onChange={(e) => set("score", e.target.value)} />
          {error("score")}
        </div>
        {serverError && (
          <p role="alert" className="field-error">
            {serverError}
          </p>
        )}
        <button type="submit" disabled={busy}>
          {busy ? "Adding…" : "Add student"}
        </button>
      </form>
    </section>
  );
}
```

### `frontend/src/main.tsx`

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

### `frontend/src/styles.css`

```css
:root { color-scheme: light; }
body { font-family: system-ui, "Segoe UI", Arial, sans-serif; margin: 0; background: #ffffff; color: #1a1a1a; }
.page { max-width: 760px; margin: 0 auto; padding: 24px 16px 64px; }
h1 { font-size: 1.6rem; margin: 0 0 16px; }
h2 { font-size: 1.2rem; margin: 32px 0 8px; }
.filters { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 8px; }
.field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
label { font-weight: 600; }
input, select, button { font: inherit; padding: 8px 10px; border: 1px solid #5b6472; border-radius: 6px; background: #fff; color: #1a1a1a; }
button { background: #1d4ed8; color: #fff; border-color: #1d4ed8; cursor: pointer; }
button:disabled { background: #4b5563; border-color: #4b5563; cursor: progress; }
button:focus-visible, input:focus-visible, select:focus-visible { outline: 3px solid #f59e0b; outline-offset: 2px; }
table { width: 100%; border-collapse: collapse; margin-top: 8px; }
caption { text-align: left; font-weight: 600; padding-bottom: 6px; }
th, td { text-align: left; padding: 8px; border-bottom: 1px solid #d1d5db; }
tbody th { font-weight: 500; }
td button { background: #fff; color: #991b1b; border-color: #991b1b; padding: 4px 10px; }
.summary, .notice { margin: 4px 0; color: #374151; }
.notice { color: #065f46; }
.empty { padding: 16px 0; color: #374151; }
.problem { border: 2px solid #991b1b; border-radius: 6px; padding: 8px 12px; margin: 12px 0; color: #7f1d1d; }
.field-error { color: #991b1b; margin: 0; font-weight: 600; }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
```

### `break48.py`

```python
"""Break each rule once on purpose and check that the tests notice.
Run from the project folder:   python break48.py            (all)     or    python break48.py "duplicate" "focus"   (only names that contain a word)
Each case edits one file, runs ONE suite (py = server tests, js = page tests, e2e = real browser), expects it to FAIL,
then puts the file back. Suite times: py about 1 s, js about 10 s, e2e about 40 s (it needs `npx playwright install chromium` once)."""
import os
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).parent
B = ROOT / "backend" / "app" / "main.py"
S = ROOT / "frontend" / "src"
IS_WINDOWS = sys.platform == "win32"

# (name, suite, file, old text, new text)
CASES = [
  # ---- server rules ----
  ("server: database UNIQUE rule removed (duplicates get through)", "py", B, "CHECK (score BETWEEN 0 AND 100),\n  UNIQUE (name_key, class_name)\n", "CHECK (score BETWEEN 0 AND 100)\n"),
  ("server: duplicate answers 400 instead of 409", "py", B, "raise HTTPException(409,", "raise HTTPException(400,"),
  ("server: score range not checked", "py", B, "Annotated[int, Field(ge=0, le=100)]", "int"),
  ("server: numbers sent as text are accepted", "py", B, 'ConfigDict(extra="forbid", strict=True)', 'ConfigDict(extra="forbid")'),
  ("server: unknown fields accepted", "py", B, 'ConfigDict(extra="forbid", strict=True)', "ConfigDict(strict=True)"),
  ("server: same name in different case is not a duplicate", "py", B, '.split()).casefold()', ".split())"),
  ("server: accent form not normalised in the duplicate key", "py", B, 'return " ".join(unicodedata.normalize("NFC", name).split())', 'return " ".join(name.split())'),
  ("server: accent form not normalised in the stored name", "py", B, 'cleaned = " ".join(unicodedata.normalize("NFC", value).split())', 'cleaned = " ".join(value.split())'),
  ("server: search matches everything", "py", B, '" AND instr(name_key, ?) > 0"', '" AND 1 = 1"'),
  ("server: class filter removed", "py", B, 'sql += " AND class_name = ?"', 'sql += " AND 1 = 1"'),
  ("server: deleting a missing student looks fine", "py", B, "if cur.rowcount == 0:", "if False:"),
  ("server: empty names accepted", "py", B, "if not cleaned:", "if False:"),
  ("server: name limit off by one", "py", B, "if len(cleaned) > MAX_NAME:", "if len(cleaned) >= MAX_NAME:"),
  ("server: unknown classes accepted", "py", B, "if value not in CLASSES:", "if False:"),
  ("server: search text length not limited", "py", B, 'q: Annotated[str, Query(max_length=60)] = "",', 'q: str = "",'),
  ("server: ids reused after a delete", "py", B, "id INTEGER PRIMARY KEY AUTOINCREMENT,", "id INTEGER PRIMARY KEY,"),
  ("server: test-only reset address always on (dangerous)", "py", B, "    if allow_reset:", "    if True:"),
  ("server: reset switched on by any value of the variable", "py", B, 'os.environ.get("ENABLE_TEST_RESET") == "1"', 'os.environ.get("ENABLE_TEST_RESET")'),
  ("server: database not re-created at start", "py", B, "    reset()  # a fresh", "    pass  # a fresh"),
  # ---- api client ----
  ("client: a search of only spaces is sent", "js", S/"api.ts", 'if (filter.q.trim()) params.set("q", filter.q);', 'if (filter.q) params.set("q", filter.q);'),
  ("client: the class filter is not sent", "js", S/"api.ts", 'if (filter.class_name) params.set("class_name", filter.class_name);', ""),
  ("client: a cancel is treated as a network failure", "js", S/"api.ts", '(error as { name?: unknown }).name === "AbortError"', "false"),
  ("client: the server's own error text is ignored", "js", S/"api.ts", "if (typeof detail === \"string\") return new ApiError(detail, response.status);", ""),
  ("client: FastAPI's 'Value error, ' prefix left in", "js", S/"api.ts", '.replace(/^Value error, /, "")', ""),
  ("client: something that is not a list accepted", "js", S/"api.ts", 'if (!Array.isArray(body)) throw new ApiError("The server sent something that is not a student list.", response.status);', ""),
  ("client: class list not checked", "js", S/"api.ts", " || !body.every((c) => typeof c === \"string\")", ""),
  ("client: delete uses the wrong method", "js", S/"api.ts", 'method: "DELETE"', 'method: "POST"'),
  ("client: network failure message changed", "js", S/"api.ts", "Cannot reach the server. Is it running?", "Network error"),
  # ---- form rules ----
  ("form: any text accepted as a score", "js", S/"validate.ts", "!/^\\d+$/.test(text) || Number(text) > 100", "Number(text) > 100"),
  ("form: score 100 refused", "js", S/"validate.ts", "Number(text) > 100", "Number(text) >= 100"),
  ("form: name limit off by one", "js", S/"validate.ts", "name.length > MAX_NAME", "name.length >= MAX_NAME"),
  ("form: any class accepted", "js", S/"validate.ts", "!classes.includes(values.class_name)", 'values.class_name === ""'),
  ("form: name spaces not cleaned", "js", S/"validate.ts", 'values.name.trim().replace(/\\s+/g, " ")', "values.name"),
  # ---- page behaviour ----
  ("page: an old slow answer can overwrite a new one", "js", S/"App.tsx", "    return () => controller.abort();\n  }, [filter, attempt]);", "    return () => {};\n  }, [filter, attempt]);"),
  ("page: a cancelled request is shown as an error", "js", S/"App.tsx", "if (isAbort(error)) return; // a newer search replaced this one", ""),
  ("page: Delete buttons lose the student's name", "js", S/"App.tsx", " aria-label={`Delete ${s.name}`}", ""),
  ("page: table has no caption", "js", S/"App.tsx", "<caption>Students</caption>", ""),
  ("page: student name is not a row heading", "js", S/"App.tsx", '<th scope="row">{s.name}</th>', "<td>{s.name}</td>"),
  ("page: the Add button stays enabled while sending", "js", S/"App.tsx", "disabled={busy}", "disabled={false}"),
  ("page: cursor not moved to the first problem", "js", S/"App.tsx", "document.getElementById(`${id}-${firstBad.current}`)?.focus();", ""),
  ("page: cursor not returned to Name after adding", "js", S/"App.tsx", "nameRef.current?.focus();", ""),
  ("page: form not cleared after adding", "js", S/"App.tsx", "setValues(EMPTY_FORM);", ""),
  ("page: invalid fields not marked", "js", S/"App.tsx", '"aria-invalid": errors[name] ? true : undefined,', ""),
  ("page: server error on the form not announced", "js", S/"App.tsx", '<p role="alert" className="field-error">\n            {serverError}', '<p className="field-error">\n            {serverError}'),
  ("page: delete failure not shown", "js", S/"App.tsx", 'setNotice(error instanceof Error ? error.message : "Could not delete.");', 'setNotice("");'),
  ("page: list not refreshed after a delete", "js", S/"App.tsx", "    refresh();\n  }\n\n  return (", "  }\n\n  return ("),
  ("page: Try again does nothing", "js", S/"App.tsx", '<button type="button" onClick={refresh}>', '<button type="button" onClick={() => {}}>'),
  ("page: '1 students shown'", "js", S/"App.tsx", 'load.students.length === 1 ? "student" : "students"', '"students"'),
  ("page: errors never shown", "js", S/"App.tsx", '{load.status === "error" && (', "{false && ("),
  ("page: search box has no label", "js", S/"App.tsx", "<label htmlFor={searchId}>Search by name</label>", "<span>Search by name</span>"),
  ("page: class filter does nothing", "js", S/"App.tsx", "onChange={(e) => setFilter({ ...filter, class_name: e.target.value })}", "onChange={() => setFilter({ ...filter })}"),
  # ---- only the real browser can see these ----
  ("browser: keyboard focus ring removed", "e2e", S/"styles.css", "{ outline: 3px solid #f59e0b; outline-offset: 2px; }", "{ outline: none; }"),
  ("browser: error text too faint to read", "e2e", S/"styles.css", ".field-error { color: #991b1b;", ".field-error { color: #ff9999;"),
  ("browser: summary text too faint to read", "e2e", S/"styles.css", ".summary, .notice { margin: 4px 0; color: #374151; }", ".summary, .notice { margin: 4px 0; color: #bbbbbb; }"),
  ("browser: stylesheet not loaded", "e2e", S/"main.tsx", 'import "./styles.css";', ""),
  ("browser: /api not forwarded to the Python server", "e2e", ROOT/"frontend"/"vite.config.ts", 'const api = { "/api": { target: "http://127.0.0.1:8000", changeOrigin: false } };', "const api = {};"),
  ("browser: page scrolls sideways on a narrow screen", "e2e", S/"styles.css", "table { width: 100%;", "table { width: 900px;"),
]


def suite_fails(suite: str) -> bool:
    env = dict(os.environ)
    if suite == "py":
        cmd, cwd = [sys.executable, "-m", "pytest", "-q", "-x"], ROOT / "backend"
    elif suite == "js":
        cmd, cwd = ["npx", "vitest", "run", "--bail", "1"], ROOT / "frontend"
    else:
        cmd, cwd = ["npx", "playwright", "test", "--max-failures=1"], ROOT / "frontend"
    return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, shell=IS_WINDOWS, env=env).returncode != 0


def main(words):
    chosen = [c for c in CASES if not words or any(w.lower() in c[0].lower() for w in words)]
    for suite in sorted({c[1] for c in chosen}):
        assert not suite_fails(suite), f"the {suite} tests must pass before anything is broken"
    survivors = []
    for name, suite, path, old, new in chosen:
        original = path.read_text(encoding="utf-8")
        if original.count(old) != 1:
            print(f"BAD CASE (text found {original.count(old)} times): {name}")
            survivors.append(name)
            continue
        try:
            path.write_text(original.replace(old, new), encoding="utf-8")
            caught = suite_fails(suite)
        finally:
            path.write_text(original, encoding="utf-8")
        print(("caught   " if caught else "MISSED   ") + name, flush=True)
        if not caught:
            survivors.append(name)
    for suite in sorted({c[1] for c in chosen}):
        assert not suite_fails(suite), "files were not restored"
    print(f"\n{len(chosen) - len(survivors)} of {len(chosen)} mistakes caught")
    if survivors:
        print("NOT caught:", *survivors, sep="\n  - ")
        sys.exit(1)


main(sys.argv[1:])
```

### `NOT_COVERED.md`

```markdown
# What these tests do NOT cover

Written on purpose. A test suite that does not say what it skips makes people think the skipped things are safe.

## Not tested at all

| Not covered | Why it matters | What would cover it |
|---|---|---|
| **Windows.** Everything ran on Linux. | Paths, `taskkill`, `python` vs `python3`, line endings could differ. | Run `npm run test:e2e` and `python -m pytest` on a Windows machine. |
| **Firefox, Safari, phones.** Only Chromium. | Layout and focus behaviour differ per browser. | Add `projects` for `firefox` and `webkit` in `playwright.config.ts`. |
| **Screen readers** (NVDA, JAWS, VoiceOver). | axe checks the rules a machine can check. It cannot hear what a person hears. Roughly a third to a half of real accessibility problems need a person. | Ten minutes with a screen reader on the add form. |
| **Real people on the keyboard / zoom.** | One keyboard journey and one narrow-screen check exist. They are not a review. | A manual pass. |
| **Many users at once.** | One database file, one test at a time. | A load test; `postgres` or similar instead of one SQLite file. |
| **Large lists.** | 30 students. No paging, no virtual list. | Add paging, then test with 5,000 rows (see the Day 47 project). |
| **A slow or dropping network** beyond one 1.2 s delay and one total failure. | Real networks half-fail. | Playwright network throttling through the browser's debugging protocol. |
| **Security.** No login, no limits, no rate limiting, no HTTPS. | Anyone who can reach the server can add or delete. The test-reset address is off unless an environment variable is set, and that is tested, but the setting is the only thing standing between production and a wipe. | Add login first, then test it. |
| **Data that survives upgrades.** | No migrations. The server rebuilds the table at every start (that is how the tests get known data). **This means the server in this project loses its data on restart.** | A real migration tool and a separate test database. |
| **Visual look.** | No screenshot comparison. A page can pass every test and look wrong. | Playwright `toHaveScreenshot`. |
| **The built page versus the dev page.** | The browser tests use the built page. `npm run dev` is not tested. | Run the same specs against it. |
| **Text in other languages and right-to-left.** | Only English messages; a name with an accent is tested, an Arabic name is not. | More cases. |

## Tested only partly

- **Colour contrast** is checked by axe in the real browser on 5 screens, not on every state (for example, hover colours are not checked).
- **Double submit** is tested in the component tests with a pretend server and in the browser only by the single-click path.
- **The component tests use a pretend server (MSW).** It follows the real server's rules for the cases it handles, but it is a copy. If the real server changes and the copy does not, the component tests still pass. The browser journeys (real server) are what catch that, which is why both exist.
- **axe in jsdom** cannot check colour contrast or layout. Those two are only checked in the real browser.

## Known weaknesses of the tests themselves

- The break-it script (`break48.py`) covers the mistakes I thought of. It says nothing about the ones I did not.
- **The missing page icon** (`<link rel="icon">`) cannot be tested here: headless Chromium never asks for `/favicon.ico`, so removing the line changes nothing the tests can see. I removed that case from the break-it list instead of counting it. A normal browser would log a 404.
- Two of my first-draft mutations turned out to be equivalent (the name is already cleaned before its key is built, and `vite preview` reuses `server.proxy`). I rewrote them so they change real behaviour.
```

### `.gitignore`

```text
node_modules/
dist/
__pycache__/
.pytest_cache/
.venv/
*.db
test-results/
playwright-report/
```

### Design decisions

| Decision | Reason |
|---|---|
| pretend server (MSW) with memory | Adding a student shows up in the next list, deleting removes it. The page is tested against behaviour, not against hand-written answers per test. |
| Per-test overrides with `server.use` | An error case replaces just one answer; the default stays happy. |
| Query tests by role and label (`getByRole`, `getByLabel`) | Tests find things the way a user (and a screen reader) does. A button with no name cannot be found, which is a bug worth knowing. |
| Validation in the page AND the server | The page checks for speed and kindness; the server is the protection. A test calls the server directly with a 61-character name. |
| Duplicate rule in the database (UNIQUE) with a friendly 409 | Two requests at once cannot both win. Case, spaces and accent form do not make a different name. |
| Focus moves to the first bad field and back to Name after adding | Keyboard and screen-reader users must not be left at the bottom of the page. |
| `aria-invalid` + `aria-describedby` on bad fields | A screen reader reads the field and its message together; tested with `toHaveAccessibleDescription`. |
| Ignore the old search answer (abort + keep old list while loading) | Typing fast must never show the answer to an earlier word, and must not flash an error. |
| Playwright runs one test at a time, no retries | One database; flaky passes hide real problems. |
| `NOT_COVERED.md` | A suite that does not say what it skips makes people think skipped things are safe. |

---

## 7. Tests (171 tests)

**Server 50 + page 94 + browser 27 = 171.**

| Group | Count | What it proves |
|---|---|---|
| `test_api.py` | 50 | list order and fields; search (case, spaces, `%`, quote, length); class filter; both together; create returns 201; name cleaned; empty, too long (60/61), bad scores (-1, 101, text, 50.5, true), unknown class, extra and missing fields, non-JSON body; duplicates (case, spaces, accent form) and same name in another class; refused students are not stored; delete 204, twice 404, bad id 422; ids not reused; the reset address is off by default, on only for `1`; restart gives a fresh database |
| `validate.test.ts` | 21 | every form rule, edges, all problems at once |
| `api.test.ts` | 26 | what is sent (empty and space-only search not sent, special characters), every kind of failure becomes a readable message, cancel passes through, odd error bodies |
| `App.test.tsx` | 32 | loading, list, table structure, empty, class menu failing; search, class, both; **old answer never wins**; **no error flash on cancel**; server 500, dead network, junk body, recovery; add (focus, clearing, Enter key, all errors at once, `aria-invalid`, bad scores, duplicate, server errors, double click sends once); delete (names on buttons, already deleted elsewhere) |
| `axe.test.tsx` | 12 | no violations in 7 states (loaded, loading, empty, error, form errors, form with server error, after search); the checker finds a missing alt, label, button name; removing the page's own label makes it fail |
| `guard.test.ts` | 3 | unplanned requests are recorded and fail |
| `a11y.spec.ts` | 8 | axe in the real browser **with colour contrast really checked**; five screens; focus ring visible; no sideways scroll at 640 px; low-contrast sample fails |
| `journeys.spec.ts` | 19 | browse and narrow; fast typing; hostile search text; add, empty form, bad score, duplicate, other class, keyboard only, long name straight to the server; delete and reload, **two tabs**; server down then Try again, 500, slow server, add while down; no console errors or failed requests; reset works |

| # | Test | What it proves |
|---|---|---|
| 1 | Run order | pytest first (fast), then Vitest, then Playwright (slowest) |

### `backend/tests/conftest.py`

```python
import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture
def client(tmp_path):
    """A brand-new database for EVERY test, so no test can affect another."""
    return TestClient(create_app(tmp_path / "t.db"))
```

### `backend/tests/test_api.py`

```python
import pytest
from fastapi.testclient import TestClient

from app.main import create_app, name_key
from app.seed import CLASSES, seed_rows


def add(client, **kw):
    body = {"name": "New Person", "class_name": "6A", "score": 50} | kw
    return client.post("/api/students", json=body)


# ---------- list ----------
def test_lists_the_30_seeded_students_in_id_order(client):
    rows = client.get("/api/students").json()
    assert len(rows) == 30
    assert [r["id"] for r in rows] == list(range(1, 31))
    assert rows[0] == {"id": 1, "name": "Aarav Reddy", "class_name": "6A", "score": 40}


def test_every_row_has_exactly_four_fields(client):
    assert all(set(r) == {"id", "name", "class_name", "score"} for r in client.get("/api/students").json())


def test_search_matches_part_of_a_name_ignoring_case(client):
    names = [r["name"] for r in client.get("/api/students", params={"q": "REDDY"}).json()]
    assert names == ["Aarav Reddy", "Charan Reddy"]


def test_search_ignores_extra_spaces(client):
    assert len(client.get("/api/students", params={"q": "  aarav    reddy "}).json()) == 1


def test_search_with_no_match_is_an_empty_list_not_an_error(client):
    r = client.get("/api/students", params={"q": "zzzz"})
    assert r.status_code == 200 and r.json() == []


def test_class_filter(client):
    rows = client.get("/api/students", params={"class_name": "7A"}).json()
    assert rows and all(r["class_name"] == "7A" for r in rows)
    assert len(rows) == sum(1 for _, c, _ in seed_rows() if c == "7A")


def test_search_and_class_together(client):
    rows = client.get("/api/students", params={"q": "reddy", "class_name": "6A"}).json()
    assert [r["name"] for r in rows] == ["Aarav Reddy"]


def test_unknown_class_filter_is_an_empty_list(client):
    assert client.get("/api/students", params={"class_name": "99Z"}).json() == []


def test_a_percent_sign_in_search_is_just_text(client):
    assert client.get("/api/students", params={"q": "%"}).json() == []


def test_a_quote_in_search_is_just_text(client):
    r = client.get("/api/students", params={"q": "' OR 1=1 --"})
    assert r.status_code == 200 and r.json() == []


def test_too_long_search_is_refused(client):
    assert client.get("/api/students", params={"q": "a" * 61}).status_code == 422


def test_classes(client):
    assert client.get("/api/classes").json() == CLASSES


# ---------- create ----------
def test_create_returns_201_and_the_new_row(client):
    r = add(client, name="Zara Khan", class_name="8A", score=77)
    assert r.status_code == 201
    assert r.json() == {"id": 31, "name": "Zara Khan", "class_name": "8A", "score": 77}


def test_created_student_shows_up_in_the_list(client):
    add(client, name="Zara Khan")
    assert "Zara Khan" in [r["name"] for r in client.get("/api/students").json()]


def test_name_is_cleaned(client):
    assert add(client, name="   Zara    Khan  ").json()["name"] == "Zara Khan"


@pytest.mark.parametrize("name", ["", "   ", "\t\n"])
def test_empty_name_refused(client, name):
    assert add(client, name=name).status_code == 422


def test_name_length_limit_is_inclusive(client):
    assert add(client, name="a" * 60).status_code == 201
    assert add(client, name="b" * 61).status_code == 422


@pytest.mark.parametrize("score", [-1, 101, 1000])
def test_score_outside_0_to_100_refused(client, score):
    assert add(client, score=score).status_code == 422


@pytest.mark.parametrize("score", [0, 100])
def test_score_edges_accepted(client, score):
    assert add(client, name=f"Edge {score}", score=score).status_code == 201


@pytest.mark.parametrize("score", ["50", 50.5, None, True])
def test_score_must_be_a_whole_number(client, score):
    assert add(client, score=score).status_code == 422


def test_unknown_class_refused_with_the_allowed_list(client):
    r = add(client, class_name="99Z")
    assert r.status_code == 422 and "6A" in r.text


def test_extra_fields_refused(client):
    assert client.post("/api/students", json={"name": "A", "class_name": "6A", "score": 1, "admin": True}).status_code == 422


def test_missing_fields_refused(client):
    assert client.post("/api/students", json={"name": "A"}).status_code == 422


def test_non_json_body_refused(client):
    assert client.post("/api/students", content="hello", headers={"content-type": "application/json"}).status_code == 422


def test_duplicate_in_the_same_class_is_409_with_a_readable_message(client):
    r = add(client, name="Aarav Reddy", class_name="6A")
    assert r.status_code == 409 and r.json()["detail"] == "Aarav Reddy is already in class 6A."


def test_duplicate_ignores_case_spaces_and_accent_form(client):
    assert add(client, name="  AARAV   reddy ", class_name="6A").status_code == 409
    assert add(client, name="Renée", class_name="6B").status_code == 201  # e + accent
    assert add(client, name="Renée", class_name="6B").status_code == 409  # one-character e-acute


def test_same_name_in_another_class_is_allowed(client):
    assert add(client, name="Aarav Reddy", class_name="8A").status_code == 201


def test_a_refused_student_is_not_stored(client):
    add(client, name="Aarav Reddy", class_name="6A")
    add(client, score=500)
    assert len(client.get("/api/students").json()) == 30


# ---------- delete ----------
def test_delete_returns_204_and_removes_it(client):
    assert client.delete("/api/students/1").status_code == 204
    assert 1 not in [r["id"] for r in client.get("/api/students").json()]


def test_delete_twice_second_is_404(client):
    client.delete("/api/students/1")
    r = client.delete("/api/students/1")
    assert r.status_code == 404 and r.json()["detail"] == "Student 1 does not exist."


def test_delete_with_a_non_number_is_422(client):
    assert client.delete("/api/students/abc").status_code == 422


def test_ids_are_not_reused_after_a_delete(client):
    client.delete("/api/students/30")
    assert add(client).json()["id"] == 31


# ---------- the test-only reset address ----------
def test_reset_address_does_not_exist_by_default(client):
    assert client.post("/api/test/reset").status_code in (404, 405)


def test_reset_address_exists_only_when_switched_on(tmp_path):
    c = TestClient(create_app(tmp_path / "r.db", allow_reset=True))
    c.delete("/api/students/1")
    assert c.post("/api/test/reset").status_code == 204
    assert len(c.get("/api/students").json()) == 30


def test_reset_switched_on_by_the_environment(tmp_path, monkeypatch):
    monkeypatch.setenv("ENABLE_TEST_RESET", "1")
    assert TestClient(create_app(tmp_path / "e.db")).post("/api/test/reset").status_code == 204


def test_reset_off_when_the_environment_says_anything_else(tmp_path, monkeypatch):
    monkeypatch.setenv("ENABLE_TEST_RESET", "yes")
    assert TestClient(create_app(tmp_path / "e.db")).post("/api/test/reset").status_code in (404, 405)


# ---------- small pieces ----------
def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_unknown_address_404(client):
    assert client.get("/api/nope").status_code == 404


def test_name_key_joins_the_two_ways_of_typing_an_accent():
    assert name_key("Rene\u0301e") == name_key("Ren\u00e9e")  # e + accent  ==  one-character e-acute


def test_stored_names_use_the_one_character_accent_form(client):
    assert add(client, name="Rene\u0301e", class_name="8A").json()["name"] == "Ren\u00e9e"


def test_name_key_rules():
    assert name_key("  Straße  ") == name_key("STRASSE")
    assert name_key("A  B") == "a b"


def test_server_start_gives_a_fresh_database(tmp_path):
    a = TestClient(create_app(tmp_path / "s.db"))
    a.delete("/api/students/1")
    b = TestClient(create_app(tmp_path / "s.db"))  # same file, "restart"
    assert len(b.get("/api/students").json()) == 30
```

### `frontend/src/test/server.ts` (the pretend server with memory)

```ts
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
```

### `frontend/src/test/setup.ts` (shared set-up and safety nets)

```ts
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, expect, vi } from "vitest";
import { makeBackend, server, unhandled, type Backend } from "./server";

// Node's fetch needs a full address; the page uses "/api/...". Give it the page's own address, like a browser would.
const realFetch = globalThis.fetch;
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
  realFetch(typeof input === "string" && input.startsWith("/") ? new URL(input, window.location.href).href : input, init)) as typeof fetch;

export let backend: Backend;

beforeAll(() =>
  server.listen({
    // A request with no handler is a mistake in the TEST (or a new request in the app nobody planned for). It must not pass quietly.
    // (MSW 3 calls this option onUnhandledFrame. The old name, onUnhandledRequest, is silently ignored: see guard.test.ts.)
    async onUnhandledFrame({ frame, defaults }) {
      unhandled.push((await frame.getUnhandledMessage()).replace(/\s+/g, " ").trim());
      defaults.error();
    },
  }),
);
afterAll(() => server.close());

let errorSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  unhandled.length = 0;
  backend = makeBackend();
  server.use(...backend.handlers);
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  const left = errorSpy.mock.calls.map((c: unknown[]) => c.map(String).join(" "));
  errorSpy.mockRestore();
  const strays = [...unhandled];
  unhandled.length = 0;
  expect(strays, "the page made a request that has no handler").toEqual([]);
  expect(left, "console.error was called during the test and the test did not account for it").toEqual([]);
});

/** Lets a test that EXPECTS a request with no handler say so, and take it out of the list. */
export function takeUnhandled(): string[] {
  const taken = [...unhandled];
  unhandled.length = 0;
  return taken;
}

/** Returns the console.error messages so far and forgets them (for tests that EXPECT an error to be reported). */
export function takeConsoleErrors(): string[] {
  const calls = errorSpy.mock.calls.map((c: unknown[]) => c.map(String).join(" "));
  errorSpy.mockClear();
  return calls;
}
```

### `frontend/src/test/guard.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { takeConsoleErrors, takeUnhandled } from "./setup";

// These tests exist because a guard that does nothing looks exactly like a guard that works, until the day it matters.
describe("the test setup's own safety net", () => {
  it("a request nobody planned for is recorded and fails the request", async () => {
    await expect(fetch("/api/not-planned")).rejects.toThrow();
    const taken = takeUnhandled();
    expect(taken).toHaveLength(1);
    expect(taken[0]).toContain("/api/not-planned");
    expect(takeConsoleErrors().join(" ")).toContain("not-planned"); // MSW also reports it on the console; we expected that
  });

  it("a request that IS planned is not recorded", async () => {
    const response = await fetch("/api/classes");
    expect(response.ok).toBe(true);
    expect(takeUnhandled()).toEqual([]);
  });

  it("every test starts with an empty list", () => {
    expect(takeUnhandled()).toEqual([]);
  });
});
```

### `frontend/src/validate.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { MAX_NAME, validate } from "./validate";

const classes = ["6A", "6B"];
const good = { name: "Zara Khan", class_name: "6A", score: "77" };

describe("validate", () => {
  it("accepts good values and returns a clean student with a number score", () => {
    expect(validate(good, classes)).toEqual({ ok: true, student: { name: "Zara Khan", class_name: "6A", score: 77 } });
  });
  it("cleans spaces in the name", () => {
    expect(validate({ ...good, name: "  Zara    Khan " }, classes)).toMatchObject({ ok: true, student: { name: "Zara Khan" } });
  });
  it.each([[""], ["   "], ["\t"]])("refuses an empty name %j", (name) => {
    expect(validate({ ...good, name }, classes)).toEqual({ ok: false, errors: { name: "Enter a name." } });
  });
  it("name length limit is inclusive and counted after cleaning", () => {
    expect(validate({ ...good, name: "a".repeat(MAX_NAME) }, classes).ok).toBe(true);
    expect(validate({ ...good, name: "a".repeat(MAX_NAME + 1) }, classes).ok).toBe(false);
    expect(validate({ ...good, name: `  ${"a".repeat(MAX_NAME)}  ` }, classes).ok).toBe(true);
  });
  it("refuses a class that is not in the list, or none", () => {
    expect(validate({ ...good, class_name: "" }, classes)).toEqual({ ok: false, errors: { class_name: "Choose a class." } });
    expect(validate({ ...good, class_name: "9Z" }, classes).ok).toBe(false);
  });
  it.each([["0", 0], ["100", 100], [" 55 ", 55], ["007", 7]])("accepts score %j", (text, n) => {
    expect(validate({ ...good, score: text }, classes)).toMatchObject({ ok: true, student: { score: n } });
  });
  it.each([["101"], ["-1"], ["5.5"], ["abc"], ["1e2"], ["+5"], ["5 5"], ["١٢"]])("refuses score %j", (score) => {
    expect(validate({ ...good, score }, classes)).toEqual({ ok: false, errors: { score: "Score must be a whole number from 0 to 100." } });
  });
  it("an empty score has its own message", () => {
    expect(validate({ ...good, score: "" }, classes)).toEqual({ ok: false, errors: { score: "Enter a score from 0 to 100." } });
  });
  it("reports every problem at once, not one at a time", () => {
    const result = validate({ name: "", class_name: "", score: "" }, classes);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["class_name", "name", "score"]);
  });
});
```

### `frontend/src/api.test.ts`

```ts
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
```

### `frontend/src/App.test.tsx`

```tsx
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
```

### `frontend/src/axe.test.tsx`

```tsx
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
```

### `frontend/e2e/fixtures.ts`

```ts
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
```

### `frontend/e2e/journeys.spec.ts`

```ts
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
```

### `frontend/e2e/a11y.spec.ts`

```ts
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
```

---

## 8. Results

| Check | Command | Result |
|---|---|---|
| Server tests | `python -m pytest -q` | **50 passed** in under 1 second |
| Page tests | `npm test` | **94 passed** (5 files), run 4 times in a row: always 94; `npx tsc --noEmit` clean |
| Real browser | `npm run test:e2e` | **27 passed** in about 30 seconds |
| Break it on purpose | `python break48.py` | first full run **56 of 58**; two fixed or removed as described; final list has 57 cases; the cancel case re-checked alone (caught) |
| Safety net | `guard.test.ts` | unplanned request recorded and failed: yes |

---

## 9. Problems avoided

| Problem | Cause | Fix |
|---|---|---|
| Unplanned requests passed quietly | MSW 3 renamed the option to `onUnhandledFrame`; the old name does nothing | Use the new name and add a test that the guard fires |
| Cancel treated as a network failure in tests | `instanceof DOMException` fails across copies of the class | Check `error.name` |
| `act(...)` warnings in the loading axe test | The class menu loaded while axe was running | Wait for the menu first, hold the student list back with a gate |
| Tests sharing data | One database | New database per pytest test; reset per Playwright test |
| Two break cases that proved nothing | Equivalent mutations | Rewritten to change real behaviour |
| A real error flash on cancelled searches, unseen | No test looked at the moment between two searches | New test that holds both answers |

---

## 10. What was practiced

- The levels of testing and what each one cannot see
- MSW with per-test overrides and a guard against unplanned requests
- Testing by role and label, and accessible descriptions
- axe in jsdom and in a real browser (and why contrast needs the browser)
- Playwright journeys: two tabs, offline, slow server, keyboard only
- Resetting state between tests safely
- Breaking code on purpose and handling equivalent mutants
- Writing down what is not tested

---

## 11. Known limit

- **Windows was not tested.** Everything ran on Linux. The Windows branches (`python`, paths) were written but never run.
- **Only Chromium**, and the browser was a pre-installed build, not the one Playwright downloads. No Firefox, Safari or phone.
- **No screen reader.** axe checks the rules a machine can check; it does not replace a person.
- **The server loses its data at every start** (it re-creates the table so tests get known data). Do not use it as a real app.
- **No login or rate limits.** Anyone who can reach it can add or delete.
- **The component tests use a copy of the server.** If the copy and the real server disagree, only the browser tests would notice.
- **Break-it covers 57 mistakes I thought of,** not the ones I did not. The full run was 56 of 58 before fixes; after fixes only the changed case was re-run.
- Full list: `NOT_COVERED.md`.

---

## 12. How to run it

```bash
# Windows PowerShell, from the folder that holds student-directory-tests.zip
Expand-Archive student-directory-tests.zip -DestinationPath .
cd student-directory-tests\backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
python -m pytest -q

cd ..\frontend
npm install
npx playwright install chromium
npm test
npm run test:e2e
```

To see the page by hand: in one window `python -m app` (in `backend`), in another `npm run dev` (in `frontend`), then open http://localhost:5173.
To watch the browser tests: `npx playwright test --headed`.
