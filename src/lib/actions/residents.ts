"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuthorized } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { parseMoney } from "@/lib/validation";
import type { ActionState } from "@/lib/validation";

// Thrown inside a transaction when an atomic seat-claim finds the seat was
// just taken by a concurrent request.
class SeatConflictError extends Error {}

// ---------------------------------------------------------------------------
// Check-in
// ---------------------------------------------------------------------------

const checkInSchema = z.object({
  name: z.string().trim().min(1, "Resident name is required").max(120),
  phone: z.string().trim().optional().nullable(),
  joiningDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid joining date"),
  seatId: z.string().min(1, "Select a seat"),
  monthlyRent: z.union([z.string(), z.number()]).transform((v) => parseMoney(v)),
  monthlyMess: z
    .union([z.string(), z.number()])
    .transform((v) => parseMoney(v))
    .nullable(),
  securityDeposit: z
    .union([z.string(), z.number()])
    .transform((v) => parseMoney(v))
    .nullable(),
  initialPayment: z
    .union([z.string(), z.number()])
    .transform((v) => parseMoney(v))
    .nullable(),
  notes: z.string().trim().optional().nullable(),
});

export async function checkInResident(input: unknown): Promise<ActionState> {
  const user = await getAuthorized(PERMISSIONS.manageResidents);
  if (!user) return { ok: false, message: "You don't have permission to do this." };

  const parsed = checkInSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const d = parsed.data;

  const seat = await prisma.seat.findUnique({
    where: { id: d.seatId },
    include: { room: { include: { floor: true } }, currentResident: true },
  });
  if (!seat) return { ok: false, message: "Seat not found." };
  if (!seat.active) return { ok: false, message: "This seat is not available for new residents." };
  if (seat.currentResidentId) {
    return {
      ok: false,
      message: `This seat is already occupied by ${seat.currentResident?.name ?? "a resident"}.`,
    };
  }

  const joiningDate = new Date(`${d.joiningDate}T00:00:00.000Z`);

  let residentId = "";
  try {
    residentId = await prisma.$transaction(async (tx) => {
      const resident = await tx.resident.create({
        data: {
          name: d.name,
          phone: d.phone || null,
          joiningDate,
          status: "ACTIVE",
          monthlyRent: d.monthlyRent ?? 0,
          monthlyMess: d.monthlyMess ?? 0,
          notes: d.notes || null,
        },
      });

      // Atomically claim the seat: updateMany only succeeds while
      // currentResidentId is still null, so a concurrent check-in cannot
      // double-book the same seat.
      const claim = await tx.seat.updateMany({
        where: { id: d.seatId, currentResidentId: null },
        data: { currentResidentId: resident.id },
      });
      if (claim.count === 0) throw new SeatConflictError();

      await tx.seatAssignment.create({
        data: {
          residentId: resident.id,
          seatId: d.seatId,
          floorName: seat.room.floor.name,
          roomName: seat.room.name,
          seatName: seat.name,
          startDate: joiningDate,
        },
      });

      if (d.securityDeposit && d.securityDeposit > 0) {
        await tx.securityTransaction.create({
          data: {
            residentId: resident.id,
            type: "DEPOSIT",
            amount: d.securityDeposit,
            date: joiningDate,
            notes: "Security deposit at check-in",
            createdById: user.id,
          },
        });
      }

      if (d.initialPayment && d.initialPayment > 0) {
        await tx.payment.create({
          data: {
            residentId: resident.id,
            paymentType: "RENT",
            amount: d.initialPayment,
            method: "CASH",
            date: joiningDate,
            notes: "Initial payment at check-in",
            createdById: user.id,
          },
        });
      }

      return resident.id;
    });

    await writeAudit({
      user,
      action: "resident.checked_in",
      entity: "Resident",
      entityId: residentId,
      after: { name: d.name, seat: seat.name, room: seat.room.name },
    });
  } catch (e) {
    if (e instanceof SeatConflictError) {
      return { ok: false, message: "This seat is already occupied. Please choose another seat." };
    }
    throw e;
  }

  revalidatePath("/residents");
  revalidatePath("/rooms");
  revalidatePath("/dashboard");
  revalidatePath("/dues");
  return { ok: true, message: "Resident checked in.", id: residentId };
}

// ---------------------------------------------------------------------------
// Edit resident basics (current rates; historical charges are untouched)
// ---------------------------------------------------------------------------

const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, "Resident name is required").max(120),
  phone: z.string().trim().optional().nullable(),
  monthlyRent: z.union([z.string(), z.number()]).transform((v) => parseMoney(v)),
  monthlyMess: z
    .union([z.string(), z.number()])
    .transform((v) => parseMoney(v))
    .nullable(),
  notes: z.string().trim().optional().nullable(),
});

export async function updateResident(input: unknown): Promise<ActionState> {
  const user = await getAuthorized(PERMISSIONS.manageResidents);
  if (!user) return { ok: false, message: "You don't have permission to do this." };
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const d = parsed.data;

  const existing = await prisma.resident.findUnique({ where: { id: d.id } });
  if (!existing) return { ok: false, message: "Resident not found." };

  const rentChanged = existing.monthlyRent !== (d.monthlyRent ?? 0);
  const updated = await prisma.resident.update({
    where: { id: d.id },
    data: {
      name: d.name,
      phone: d.phone || null,
      monthlyRent: d.monthlyRent ?? 0,
      monthlyMess: d.monthlyMess ?? 0,
      notes: d.notes || null,
    },
  });

  await writeAudit({
    user,
    action: rentChanged ? "resident.rent_changed" : "resident.updated",
    entity: "Resident",
    entityId: d.id,
    before: { name: existing.name, monthlyRent: existing.monthlyRent },
    after: { name: updated.name, monthlyRent: updated.monthlyRent },
  });

  revalidatePath(`/residents/${d.id}`);
  revalidatePath("/residents");
  revalidatePath("/dashboard");
  return { ok: true, message: "Resident updated." };
}

// ---------------------------------------------------------------------------
// Transfer (seat/room/floor) — history preserved
// ---------------------------------------------------------------------------

const transferSchema = z.object({
  residentId: z.string().min(1),
  newSeatId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date"),
});

export async function transferResident(input: unknown): Promise<ActionState> {
  const user = await getAuthorized(PERMISSIONS.manageResidents);
  if (!user) return { ok: false, message: "You don't have permission to do this." };
  const parsed = transferSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const d = parsed.data;
  const date = new Date(`${d.date}T00:00:00.000Z`);

  const resident = await prisma.resident.findUnique({
    where: { id: d.residentId },
    include: { currentSeat: true },
  });
  if (!resident) return { ok: false, message: "Resident not found." };
  if (resident.status !== "ACTIVE") return { ok: false, message: "This resident has already left." };
  if (!resident.currentSeat) return { ok: false, message: "Resident has no active seat." };

  if (resident.currentSeat.id === d.newSeatId) {
    return { ok: false, message: "Resident is already on this seat." };
  }

  const newSeat = await prisma.seat.findUnique({
    where: { id: d.newSeatId },
    include: { room: { include: { floor: true } }, currentResident: true },
  });
  if (!newSeat) return { ok: false, message: "New seat not found." };
  if (newSeat.currentResidentId) {
    return {
      ok: false,
      message: `Seat "${newSeat.name}" is occupied by ${newSeat.currentResident?.name ?? "a resident"}.`,
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Close the current assignment.
      await tx.seatAssignment.updateMany({
        where: { residentId: resident.id, endDate: null },
        data: { endDate: date },
      });
      // Release the old seat.
      await tx.seat.updateMany({
        where: { id: resident.currentSeat!.id, currentResidentId: resident.id },
        data: { currentResidentId: null },
      });
      // Claim the new seat atomically.
      const claim = await tx.seat.updateMany({
        where: { id: d.newSeatId, currentResidentId: null },
        data: { currentResidentId: resident.id },
      });
      if (claim.count === 0) throw new SeatConflictError();
      await tx.seatAssignment.create({
        data: {
          residentId: resident.id,
          seatId: d.newSeatId,
          floorName: newSeat.room.floor.name,
          roomName: newSeat.room.name,
          seatName: newSeat.name,
          startDate: date,
        },
      });
    });
  } catch (e) {
    if (e instanceof SeatConflictError) {
      return { ok: false, message: "That seat was just occupied. Please choose another seat." };
    }
    throw e;
  }

  await writeAudit({
    user,
    action: "resident.transferred",
    entity: "Resident",
    entityId: resident.id,
    before: { seatId: resident.currentSeat.id },
    after: { seatId: d.newSeatId, seat: newSeat.name, room: newSeat.room.name },
  });

  revalidatePath(`/residents/${resident.id}`);
  revalidatePath("/residents");
  revalidatePath("/rooms");
  revalidatePath("/dashboard");
  return { ok: true, message: "Resident transferred." };
}

// ---------------------------------------------------------------------------
// Checkout — release seat, close assignment, record security deductions/refund
// ---------------------------------------------------------------------------

const checkoutSchema = z.object({
  residentId: z.string().min(1),
  leavingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid leaving date"),
  securityDeduction: z
    .union([z.string(), z.number()])
    .transform((v) => parseMoney(v))
    .nullable(),
  securityRefund: z
    .union([z.string(), z.number()])
    .transform((v) => parseMoney(v))
    .nullable(),
  notes: z.string().trim().optional().nullable(),
});

export async function checkoutResident(input: unknown): Promise<ActionState> {
  const user = await getAuthorized(PERMISSIONS.manageResidents);
  if (!user) return { ok: false, message: "You don't have permission to do this." };
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const d = parsed.data;
  const leavingDate = new Date(`${d.leavingDate}T00:00:00.000Z`);

  const resident = await prisma.resident.findUnique({
    where: { id: d.residentId },
    include: { currentSeat: true },
  });
  if (!resident) return { ok: false, message: "Resident not found." };
  if (resident.status !== "ACTIVE") return { ok: false, message: "This resident has already checked out." };

  const deduction = d.securityDeduction ?? 0;
  const refund = d.securityRefund ?? 0;

  // Compute security held from transactions to validate the refund/deduction.
  const sec = await prisma.securityTransaction.groupBy({
    by: ["type"],
    where: { residentId: resident.id },
    _sum: { amount: true },
  });
  const secByType: Record<string, number> = {};
  for (const row of sec) secByType[row.type] = row._sum.amount ?? 0;
  const held =
    (secByType.DEPOSIT ?? 0) - (secByType.REFUND ?? 0) - (secByType.DEDUCTION ?? 0);

  if (deduction < 0 || refund < 0) {
    return { ok: false, message: "Amounts cannot be negative." };
  }
  if (deduction + refund > held) {
    return {
      ok: false,
      message: `Security deduction + refund cannot exceed the refundable security (${held.toLocaleString()}).`,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.seatAssignment.updateMany({
      where: { residentId: resident.id, endDate: null },
      data: { endDate: leavingDate },
    });
    if (resident.currentSeat) {
      await tx.seat.updateMany({
        where: { id: resident.currentSeat.id, currentResidentId: resident.id },
        data: { currentResidentId: null },
      });
    }
    await tx.resident.update({
      where: { id: resident.id },
      data: { status: "LEFT", leavingDate },
    });
    if (deduction > 0) {
      await tx.securityTransaction.create({
        data: {
          residentId: resident.id,
          type: "DEDUCTION",
          amount: deduction,
          date: leavingDate,
          notes: d.notes || "Security deduction at checkout",
          createdById: user.id,
        },
      });
    }
    if (refund > 0) {
      await tx.securityTransaction.create({
        data: {
          residentId: resident.id,
          type: "REFUND",
          amount: refund,
          date: leavingDate,
          notes: d.notes || "Security refund at checkout",
          createdById: user.id,
        },
      });
    }
  });

  await writeAudit({
    user,
    action: "resident.checked_out",
    entity: "Resident",
    entityId: resident.id,
    after: { name: resident.name, leavingDate: d.leavingDate, deduction, refund },
  });

  revalidatePath(`/residents/${resident.id}`);
  revalidatePath("/residents");
  revalidatePath("/rooms");
  revalidatePath("/dashboard");
  revalidatePath("/security");
  revalidatePath("/dues");
  return { ok: true, message: "Resident checked out." };
}
