"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthorized } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { parseMoney } from "@/lib/validation";
import type { ActionState } from "@/lib/validation";

const PAYMENT_TYPES = ["RENT", "MESS", "OTHER", "REFUND"] as const;
const METHODS = ["CASH", "BANK_TRANSFER", "EASYPAISA", "JAZZCASH", "OTHER"] as const;

const schema = z.object({
  residentId: z.string().min(1).optional().nullable(),
  paymentType: z.enum(PAYMENT_TYPES),
  amount: z.union([z.string(), z.number()]).transform((v) => parseMoney(v)),
  method: z.enum(METHODS).default("CASH"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date"),
  rentChargeId: z.string().optional().nullable(),
  messChargeId: z.string().optional().nullable(),
  reference: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  receiptImageData: z.string().max(8_000_000).optional().nullable(),
  generateReceipt: z.boolean().optional().default(true),
});

function receiptNumber(year: number, seq: number): string {
  return `RCP-${year}-${String(seq).padStart(5, "0")}`;
}

function receiptYear(): number {
  return new Date(Date.now() + 5 * 60 * 60 * 1000).getUTCFullYear();
}

export async function recordPayment(input: unknown): Promise<ActionState> {
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
  if (d.paymentType === "RENT" && !d.residentId) {
    return { ok: false, message: "Select a resident for a rent payment." };
  }

  const date = new Date(`${d.date}T00:00:00.000Z`);

  // Receipt numbers are allocated by counting per-year and guarded by the
  // unique index; retry once on a rare concurrent collision.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const payment = await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.create({
          data: {
            residentId: d.residentId || null,
            paymentType: d.paymentType,
            amount: d.amount!,
            method: d.method,
            date,
            rentChargeId: d.rentChargeId || null,
            messChargeId: d.messChargeId || null,
            reference: d.reference || null,
            notes: d.notes || null,
            receiptImageData: d.receiptImageData || null,
            createdById: user.id,
          },
        });

        if (d.generateReceipt) {
          const year = receiptYear();
          const prefix = `RCP-${year}-`;
          const count = await tx.receipt.count({ where: { receiptNumber: { startsWith: prefix } } });
          await tx.receipt.create({
            data: {
              receiptNumber: receiptNumber(year, count + 1),
              paymentId: payment.id,
              residentId: payment.residentId,
              amount: payment.amount,
              paymentType: payment.paymentType,
              method: payment.method,
              date: payment.date,
              createdById: user.id,
            },
          });
        }

        return payment;
      });

      await writeAudit({
        user,
        action: "payment.recorded",
        entity: "Payment",
        entityId: payment.id,
        after: {
          type: payment.paymentType,
          amount: payment.amount,
          residentId: payment.residentId,
        },
      });

      revalidatePath("/payments");
      revalidatePath("/dues");
      revalidatePath("/dashboard");
      revalidatePath("/reports");
      if (payment.residentId) revalidatePath(`/residents/${payment.residentId}`);
      return { ok: true, message: "Payment recorded.", id: payment.id };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        continue; // receipt number collision — retry
      }
      throw e;
    }
  }

  return { ok: false, message: "Could not allocate a receipt number. Please try again." };
}

export async function deletePayment(input: { id: string }): Promise<ActionState> {
  const user = await getAuthorized(PERMISSIONS.manageFinance);
  if (!user) return { ok: false, message: "You don't have permission to do this." };

  const payment = await prisma.payment.findUnique({ where: { id: input.id } });
  if (!payment) return { ok: false, message: "Payment not found." };

  await prisma.$transaction(async (tx) => {
    await tx.receipt.deleteMany({ where: { paymentId: payment.id } });
    await tx.payment.delete({ where: { id: payment.id } });
  });

  await writeAudit({
    user,
    action: "payment.deleted",
    entity: "Payment",
    entityId: payment.id,
    before: { type: payment.paymentType, amount: payment.amount, residentId: payment.residentId },
  });

  revalidatePath("/payments");
  revalidatePath("/dues");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath("/receipts");
  if (payment.residentId) revalidatePath(`/residents/${payment.residentId}`);
  return { ok: true, message: "Payment deleted." };
}
