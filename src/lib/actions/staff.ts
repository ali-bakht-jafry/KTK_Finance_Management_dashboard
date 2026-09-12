"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuthorized } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { parseMoney } from "@/lib/validation";
import type { ActionState } from "@/lib/validation";

const TYPES = ["SALARY", "ADVANCE", "DEDUCTION"] as const;

const staffSchema = z.object({
  name: z.string().trim().min(1, "Staff name is required").max(120),
  role: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  joiningDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid joining date"),
  monthlySalary: z.union([z.string(), z.number()]).transform((v) => parseMoney(v)),
  notes: z.string().trim().optional().nullable(),
});

export async function addStaff(input: unknown): Promise<ActionState> {
  const user = await getAuthorized(PERMISSIONS.manageStaff);
  if (!user) return { ok: false, message: "You don't have permission to do this." };
  const parsed = staffSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const d = parsed.data;

  const staff = await prisma.staff.create({
    data: {
      name: d.name,
      role: d.role || "Other",
      phone: d.phone || null,
      joiningDate: new Date(`${d.joiningDate}T00:00:00.000Z`),
      monthlySalary: d.monthlySalary ?? 0,
      notes: d.notes || null,
    },
  });

  await writeAudit({
    user,
    action: "staff.created",
    entity: "Staff",
    entityId: staff.id,
    after: { name: staff.name, role: staff.role },
  });

  revalidatePath("/staff");
  return { ok: true, message: "Staff member added.", id: staff.id };
}

export async function updateStaff(input: unknown): Promise<ActionState> {
  const user = await getAuthorized(PERMISSIONS.manageStaff);
  if (!user) return { ok: false, message: "You don't have permission to do this." };
  const parsed = staffSchema.extend({ id: z.string().min(1) }).safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const d = parsed.data;

  const existing = await prisma.staff.findUnique({ where: { id: d.id } });
  if (!existing) return { ok: false, message: "Staff member not found." };

  const staff = await prisma.staff.update({
    where: { id: d.id },
    data: {
      name: d.name,
      role: d.role || "Other",
      phone: d.phone || null,
      monthlySalary: d.monthlySalary ?? 0,
      notes: d.notes || null,
    },
  });

  await writeAudit({
    user,
    action: "staff.updated",
    entity: "Staff",
    entityId: staff.id,
    before: { name: existing.name, monthlySalary: existing.monthlySalary },
    after: { name: staff.name, monthlySalary: staff.monthlySalary },
  });

  revalidatePath("/staff");
  return { ok: true, message: "Staff member updated." };
}

export async function setStaffStatus(input: { id: string; status: "ACTIVE" | "LEFT" }): Promise<ActionState> {
  const user = await getAuthorized(PERMISSIONS.manageStaff);
  if (!user) return { ok: false, message: "You don't have permission to do this." };

  await prisma.staff.update({ where: { id: input.id }, data: { status: input.status } });
  await writeAudit({
    user,
    action: input.status === "ACTIVE" ? "staff.activated" : "staff.deactivated",
    entity: "Staff",
    entityId: input.id,
    after: { status: input.status },
  });

  revalidatePath("/staff");
  return { ok: true, message: input.status === "ACTIVE" ? "Staff marked active." : "Staff marked as left." };
}

export async function deleteStaff(input: { id: string }): Promise<ActionState> {
  const user = await getAuthorized(PERMISSIONS.manageStaff);
  if (!user) return { ok: false, message: "You don't have permission to do this." };

  const staff = await prisma.staff.findUnique({
    where: { id: input.id },
    include: { payments: { take: 1 } },
  });
  if (!staff) return { ok: false, message: "Staff member not found." };
  if (staff.payments.length > 0) {
    return { ok: false, message: "This staff member has payment history. Mark them as left instead." };
  }

  await prisma.staff.delete({ where: { id: input.id } });
  await writeAudit({
    user,
    action: "staff.deleted",
    entity: "Staff",
    entityId: input.id,
    before: { name: staff.name },
  });

  revalidatePath("/staff");
  return { ok: true, message: "Staff member deleted." };
}

const paymentSchema = z.object({
  staffId: z.string().min(1, "Select a staff member"),
  type: z.enum(TYPES),
  amount: z.union([z.string(), z.number()]).transform((v) => parseMoney(v)),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date"),
  period: z.string().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

export async function recordStaffPayment(input: unknown): Promise<ActionState> {
  const user = await getAuthorized(PERMISSIONS.manageStaff);
  if (!user) return { ok: false, message: "You don't have permission to do this." };
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const d = parsed.data;
  if (d.amount === null || d.amount <= 0) {
    return { ok: false, message: "Enter a positive amount." };
  }

  const staff = await prisma.staff.findUnique({ where: { id: d.staffId } });
  if (!staff) return { ok: false, message: "Staff member not found." };

  await prisma.staffPayment.create({
    data: {
      staffId: d.staffId,
      type: d.type,
      amount: d.amount,
      date: new Date(`${d.date}T00:00:00.000Z`),
      period: d.period || null,
      notes: d.notes || null,
      createdById: user.id,
    },
  });

  await writeAudit({
    user,
    action: "staff.payment_recorded",
    entity: "StaffPayment",
    after: { staffId: d.staffId, type: d.type, amount: d.amount },
  });

  revalidatePath("/staff");
  revalidatePath("/expenses");
  revalidatePath("/reports");
  return { ok: true, message: "Staff payment recorded." };
}
