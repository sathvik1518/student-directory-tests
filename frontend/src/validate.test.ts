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
