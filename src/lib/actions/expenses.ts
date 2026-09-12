"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuthorized } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { parseMoney } from "@/lib/validation";
import type { ActionState } from "@/lib/validation";

const CATEGORIES = [
  "ELECTRICITY",
  "GAS",
  "WATER",
  "INTERNET",
  "MAINTENANCE",
  "CLEANING",
  "STAFF_SALARY",
  "MESS",
  "FURNITURE",
  "OTHER",
] as const;
const METHODS = ["CASH", "BANK_TRANSFER", "EASYPAISA", "JAZZCASH", "OTHER"] as const;

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date"),
  category: z.enum(CATEGORIES),
  amount: z.union([z.string(), z.number()]).transform((v) => parseMoney(v)),
  description: z.string().trim().optional().nullable(),
  method: z.enum(METHODS).default("CASH"),
  notes: z.string().trim().optional().nullable(),
});

export async function addExpense(input: unknown): Promise<ActionState> {
  const user = await getAuthorized(PERMISSIONS.manageFinance);
  if (!user) return { ok: false, message: "You don't have permission to do this." };
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const d = parsed.data;
  if (d.amount === null || d.amount <= 0) {
    return { ok: false, message: "Enter a positive amount." };
  }

  const expense = await prisma.expense.create({
    data: {
      date: new Date(`${d.date}T00:00:00.000Z`),
      category: d.category,
      amount: d.amount,
      description: d.description || null,
      method: d.method,
      notes: d.notes || null,
      createdById: user.id,
    },
  });

  await writeAudit({
    user,
    action: "expense.created",
    entity: "Expense",
    entityId: expense.id,
    after: { category: expense.category, amount: expense.amount, date: d.date },
  });

  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  return { ok: true, message: "Expense recorded.", id: expense.id };
}

export async function deleteExpense(input: { id: string }): Promise<ActionState> {
  const user = await getAuthorized(PERMISSIONS.manageFinance);
  if (!user) return { ok: false, message: "You don't have permission to do this." };

  const expense = await prisma.expense.findUnique({ where: { id: input.id } });
  if (!expense) return { ok: false, message: "Expense not found." };

  await prisma.expense.delete({ where: { id: input.id } });
  await writeAudit({
    user,
    action: "expense.deleted",
    entity: "Expense",
    entityId: input.id,
    before: { category: expense.category, amount: expense.amount },
  });

  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  return { ok: true, message: "Expense deleted." };
}
