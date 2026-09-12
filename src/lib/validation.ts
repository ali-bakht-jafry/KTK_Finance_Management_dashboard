import { z } from "zod";

// Shared validation primitives. Amounts arrive from forms as strings (e.g.
// "15,000" or "") and are normalized to integer rupees.

/** Parse a money string into integer rupees; returns null when blank/invalid. */
export function parseMoney(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim().replace(/[,\s]/g, "");
  if (s === "" || s === "-") return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

export const moneySchema = z
  .union([z.string(), z.number()])
  .transform((v) => {
    const n = parseMoney(v);
    if (n === null) return undefined;
    return n;
  })
  .refine((v): v is number => typeof v === "number", { message: "Invalid amount" });

export const requiredMoneySchema = z
  .union([z.string(), z.number()])
  .transform((v) => parseMoney(v))
  .refine((v): v is number => v !== null, { message: "Enter a valid amount" });

/** "YYYY-MM-DD" date string. */
export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Enter a valid date" });

/** "YYYY-MM" period string. */
export const periodSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, { message: "Enter a valid month (YYYY-MM)" });

export const phoneSchema = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null))
  .nullable();

export const optionalTextSchema = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null))
  .nullable();

/** An ActionState used by forms to relay field errors + a toast message. */
export type ActionState<T = Record<string, string[]>> = {
  ok: boolean;
  message?: string;
  errors?: T;
  // used by redirect flows / to return a created entity id
  id?: string;
};
