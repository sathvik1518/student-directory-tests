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
