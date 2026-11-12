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
