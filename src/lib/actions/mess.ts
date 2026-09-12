"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuthorized } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { parseMoney } from "@/lib/validation";
import type { ActionState } from "@/lib/validation";

const periodSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Enter a valid month (YYYY-MM)");

/** Generate mess charges for a month at each active resident's current mess rate. */
export async function generateMessCharges(input: unknown): Promise<ActionState> {
  const user = await getAuthorized(PERMISSIONS.manageFinance);
  if (!user) return { ok: false, message: "You don't have permission to do this." };

  const parsed = z
    .object({ period: periodSchema, residentIds: z.array(z.string()).optional() })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { period, residentIds } = parsed.data;

  const residents = await prisma.resident.findMany({
    where: {
      status: "ACTIVE",
      monthlyMess: { gt: 0 },
      ...(residentIds?.length ? { id: { in: residentIds } } : {}),
    },
    select: { id: true, monthlyMess: true },
  });

  const created = await prisma.$transaction(async (tx) => {
    const before = await tx.messCharge.count({ where: { period } });
    if (residents.length) {
      await tx.messCharge.createMany({
        data: residents.map((r) => ({ residentId: r.id, period, amount: r.monthlyMess })),
        skipDuplicates: true,
      });
    }
    const after = await tx.messCharge.count({ where: { period } });
    return after - before;
  });

  await writeAudit({
    user,
    action: "mess.charges_generated",
    entity: "MessCharge",
    after: { period, created },
  });

  revalidatePath("/mess");
  revalidatePath("/dues");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  return { ok: true, message: `Generated ${created} mess charge(s) for ${period}.` };
}

const addChargeSchema = z.object({
  residentId: z.string().min(1),
  period: periodSchema,
  amount: z.union([z.string(), z.number()]).transform((v) => parseMoney(v)),
  notes: z.string().trim().optional().nullable(),
});

export async function addMessCharge(input: unknown): Promise<ActionState> {
  const user = await getAuthorized(PERMISSIONS.manageFinance);
  if (!user) return { ok: false, message: "You don't have permission to do this." };
  const parsed = addChargeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const d = parsed.data;
  if (d.amount === null || d.amount < 0) {
    return { ok: false, message: "Enter a valid non-negative amount." };
  }

  const resident = await prisma.resident.findUnique({ where: { id: d.residentId } });
  if (!resident) return { ok: false, message: "Resident not found." };

  const charge = await prisma.messCharge.upsert({
    where: { residentId_period: { residentId: d.residentId, period: d.period } },
    create: { residentId: d.residentId, period: d.period, amount: d.amount, notes: d.notes || null },
    update: { notes: d.notes || null },
  });

  await writeAudit({
    user,
    action: "mess.charge_updated",
    entity: "MessCharge",
    entityId: charge.id,
    after: { residentId: d.residentId, period: d.period, amount: charge.amount },
  });

  revalidatePath("/mess");
  revalidatePath("/dues");
  revalidatePath(`/residents/${d.residentId}`);
  return { ok: true, message: "Mess charge saved." };
}

export async function deleteMessCharge(input: { id: string }): Promise<ActionState> {
  const user = await getAuthorized(PERMISSIONS.manageFinance);
  if (!user) return { ok: false, message: "You don't have permission to do this." };

  const charge = await prisma.messCharge.findUnique({
    where: { id: input.id },
    include: { payments: true },
  });
  if (!charge) return { ok: false, message: "Charge not found." };

  if (charge.payments.length > 0) {
    return { ok: false, message: "This charge has linked payments. Delete the payments first." };
  }

  await prisma.messCharge.delete({ where: { id: input.id } });
  await writeAudit({
    user,
    action: "mess.charge_deleted",
    entity: "MessCharge",
    entityId: input.id,
    before: { residentId: charge.residentId, period: charge.period, amount: charge.amount },
  });

  revalidatePath("/mess");
  revalidatePath("/dues");
  revalidatePath(`/residents/${charge.residentId}`);
  return { ok: true, message: "Mess charge deleted." };
}
