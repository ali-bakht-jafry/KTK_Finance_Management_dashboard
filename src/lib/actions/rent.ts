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

/**
 * Generate rent charges for a month for every active resident with a non-zero
 * rent rate (or the given subset). Charges are created at the resident's
 * CURRENT monthly rate; existing charges for the period are never overwritten,
 * so historical charges stay immutable.
 */
export async function generateRentCharges(input: unknown): Promise<ActionState> {
  const user = await getAuthorized(PERMISSIONS.manageFinance);
  if (!user) return { ok: false, message: "You don't have permission to do this." };

  const parsed = z
    .object({ period: periodSchema, residentIds: z.array(z.string()).optional() })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { period, residentIds } = parsed.data;

  const where = {
    status: "ACTIVE" as const,
    monthlyRent: { gt: 0 },
    ...(residentIds?.length ? { id: { in: residentIds } } : {}),
  };

  const residents = await prisma.resident.findMany({
    where,
    select: { id: true, monthlyRent: true },
  });

  const created = await prisma.$transaction(async (tx) => {
    const before = await tx.rentCharge.count({ where: { period } });
    if (residents.length) {
      await tx.rentCharge.createMany({
        data: residents.map((r) => ({ residentId: r.id, period, amount: r.monthlyRent })),
        skipDuplicates: true,
      });
    }
    const after = await tx.rentCharge.count({ where: { period } });
    return after - before;
  });

  await writeAudit({
    user,
    action: "rent.charges_generated",
    entity: "RentCharge",
    after: { period, created },
  });

  revalidatePath("/rent");
  revalidatePath("/dues");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  return { ok: true, message: `Generated ${created} rent charge(s) for ${period}.` };
}

const addChargeSchema = z.object({
  residentId: z.string().min(1),
  period: periodSchema,
  amount: z.union([z.string(), z.number()]).transform((v) => parseMoney(v)),
  notes: z.string().trim().optional().nullable(),
});

/** Manually add or adjust a single resident's rent charge for a period. */
export async function addRentCharge(input: unknown): Promise<ActionState> {
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

  const charge = await prisma.rentCharge.upsert({
    where: { residentId_period: { residentId: d.residentId, period: d.period } },
    create: { residentId: d.residentId, period: d.period, amount: d.amount, notes: d.notes || null },
    // Existing charge: only touch notes, never the amount (historical immutability).
    update: { notes: d.notes || null },
  });

  await writeAudit({
    user,
    action: "rent.charge_updated",
    entity: "RentCharge",
    entityId: charge.id,
    after: { residentId: d.residentId, period: d.period, amount: charge.amount },
  });

  revalidatePath("/rent");
  revalidatePath("/dues");
  revalidatePath(`/residents/${d.residentId}`);
  return { ok: true, message: "Rent charge saved." };
}

export async function deleteRentCharge(input: { id: string }): Promise<ActionState> {
  const user = await getAuthorized(PERMISSIONS.manageFinance);
  if (!user) return { ok: false, message: "You don't have permission to do this." };

  const charge = await prisma.rentCharge.findUnique({
    where: { id: input.id },
    include: { payments: true },
  });
  if (!charge) return { ok: false, message: "Charge not found." };

  if (charge.payments.length > 0) {
    return {
      ok: false,
      message: "This charge has linked payments. Delete the payments first.",
    };
  }

  await prisma.rentCharge.delete({ where: { id: input.id } });
  await writeAudit({
    user,
    action: "rent.charge_deleted",
    entity: "RentCharge",
    entityId: input.id,
    before: { residentId: charge.residentId, period: charge.period, amount: charge.amount },
  });

  revalidatePath("/rent");
  revalidatePath("/dues");
  revalidatePath(`/residents/${charge.residentId}`);
  return { ok: true, message: "Rent charge deleted." };
}
