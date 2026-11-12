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
