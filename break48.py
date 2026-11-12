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
