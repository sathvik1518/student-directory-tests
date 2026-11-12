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
