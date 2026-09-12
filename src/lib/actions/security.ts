"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuthorized } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { parseMoney } from "@/lib/validation";
import type { ActionState } from "@/lib/validation";

const TYPES = ["DEPOSIT", "REFUND", "DEDUCTION"] as const;

const schema = z.object({
  residentId: z.string().min(1, "Select a resident"),
  type: z.enum(TYPES),
  amount: z.union([z.string(), z.number()]).transform((v) => parseMoney(v)),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date"),
  notes: z.string().trim().optional().nullable(),
});

export async function recordSecurity(input: unknown): Promise<ActionState> {
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

  // A refund or deduction cannot exceed the amount currently held.
  if (d.type === "REFUND" || d.type === "DEDUCTION") {
    const sec = await prisma.securityTransaction.groupBy({
      by: ["type"],
      where: { residentId: d.residentId },
      _sum: { amount: true },
    });
    const by: Record<string, number> = {};
    for (const row of sec) by[row.type] = row._sum.amount ?? 0;
    const held = (by.DEPOSIT ?? 0) - (by.REFUND ?? 0) - (by.DEDUCTION ?? 0);
    if (d.amount > held) {
      return {
        ok: false,
        message: `Amount exceeds the refundable security (${held.toLocaleString()}).`,
      };
    }
  }

  const tx = await prisma.securityTransaction.create({
    data: {
      residentId: d.residentId,
      type: d.type,
      amount: d.amount,
      date: new Date(`${d.date}T00:00:00.000Z`),
      notes: d.notes || null,
      createdById: user.id,
    },
  });

  await writeAudit({
    user,
    action: "security.recorded",
    entity: "SecurityTransaction",
    entityId: tx.id,
    after: { residentId: d.residentId, type: d.type, amount: d.amount },
  });

  revalidatePath("/security");
  revalidatePath(`/residents/${d.residentId}`);
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  return { ok: true, message: "Security transaction recorded.", id: tx.id };
}

export async function deleteSecurity(input: { id: string }): Promise<ActionState> {
  const user = await getAuthorized(PERMISSIONS.manageFinance);
  if (!user) return { ok: false, message: "You don't have permission to do this." };

  const tx = await prisma.securityTransaction.findUnique({ where: { id: input.id } });
  if (!tx) return { ok: false, message: "Transaction not found." };

  await prisma.securityTransaction.delete({ where: { id: input.id } });
  await writeAudit({
    user,
    action: "security.deleted",
    entity: "SecurityTransaction",
    entityId: input.id,
    before: { residentId: tx.residentId, type: tx.type, amount: tx.amount },
  });

  revalidatePath("/security");
  revalidatePath(`/residents/${tx.residentId}`);
  revalidatePath("/dashboard");
  return { ok: true, message: "Security transaction deleted." };
}
