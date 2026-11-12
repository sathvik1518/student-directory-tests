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
