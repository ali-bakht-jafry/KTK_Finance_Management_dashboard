"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuthorized } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import type { ActionState } from "@/lib/validation";

const nameSchema = z.string().trim().min(1, "Seat name is required").max(100);

export async function addSeat(input: unknown): Promise<ActionState> {
  const user = await getAuthorized(PERMISSIONS.manageStructure);
  if (!user) return { ok: false, message: "You don't have permission to do this." };

  const parsed = z
    .object({ roomId: z.string().min(1), name: nameSchema })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const duplicate = await prisma.seat.findFirst({
    where: { roomId: parsed.data.roomId, name: parsed.data.name },
  });
  if (duplicate) {
    return { ok: false, message: `A seat named "${parsed.data.name}" already exists in this room.` };
  }

  const count = await prisma.seat.count({ where: { roomId: parsed.data.roomId } });
  const seat = await prisma.seat.create({
    data: { roomId: parsed.data.roomId, name: parsed.data.name, order: count + 1 },
  });
  await writeAudit({
    user,
    action: "seat.created",
    entity: "Seat",
    entityId: seat.id,
    after: { roomId: seat.roomId, name: seat.name },
  });
  revalidatePath("/rooms");
  revalidatePath("/floors");
  revalidatePath("/dashboard");
  return { ok: true, message: "Seat added.", id: seat.id };
}

export async function renameSeat(input: unknown): Promise<ActionState> {
  const user = await getAuthorized(PERMISSIONS.manageStructure);
  if (!user) return { ok: false, message: "You don't have permission to do this." };

  const parsed = z
    .object({ id: z.string().min(1), name: nameSchema })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const existing = await prisma.seat.findUnique({ where: { id: parsed.data.id } });
  if (!existing) return { ok: false, message: "Seat not found." };

  const duplicate = await prisma.seat.findFirst({
    where: { roomId: existing.roomId, name: parsed.data.name, id: { not: parsed.data.id } },
  });
  if (duplicate) {
    return { ok: false, message: `A seat named "${parsed.data.name}" already exists in this room.` };
  }

  // Rename the existing seat record in place (never create+delete), so the
  // assignment history and the current-resident pointer stay valid.
  await prisma.$transaction(async (tx) => {
    await tx.seat.update({ where: { id: parsed.data.id }, data: { name: parsed.data.name } });
    // Keep the active assignment's location snapshot in sync with the rename.
    await tx.seatAssignment.updateMany({
      where: { seatId: parsed.data.id, endDate: null },
      data: { seatName: parsed.data.name },
    });
  });

  await writeAudit({
    user,
    action: "seat.renamed",
    entity: "Seat",
    entityId: parsed.data.id,
    before: { name: existing.name },
    after: { name: parsed.data.name },
  });
  revalidatePath("/rooms");
  revalidatePath("/floors");
  revalidatePath("/dashboard");
  return { ok: true, message: "Seat renamed." };
}

export async function updateSeat(input: unknown): Promise<ActionState> {
  const user = await getAuthorized(PERMISSIONS.manageStructure);
  if (!user) return { ok: false, message: "You don't have permission to do this." };

  const parsed = z
    .object({ id: z.string().min(1), name: nameSchema, active: z.boolean() })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const existing = await prisma.seat.findUnique({
    where: { id: parsed.data.id },
    include: { currentResident: true },
  });
  if (!existing) return { ok: false, message: "Seat not found." };

  if (!parsed.data.active && existing.currentResidentId) {
    return {
      ok: false,
      message: `This seat is occupied by ${existing.currentResident?.name ?? "a resident"}. Checkout or transfer the resident first.`,
    };
  }

  const duplicate = await prisma.seat.findFirst({
    where: { roomId: existing.roomId, name: parsed.data.name, id: { not: parsed.data.id } },
  });
  if (duplicate) {
    return { ok: false, message: `A seat named "${parsed.data.name}" already exists in this room.` };
  }

  await prisma.seat.update({
    where: { id: parsed.data.id },
    data: { name: parsed.data.name, active: parsed.data.active },
  });
  await writeAudit({
    user,
    action: "seat.updated",
    entity: "Seat",
    entityId: parsed.data.id,
    before: { name: existing.name, active: existing.active },
    after: { name: parsed.data.name, active: parsed.data.active },
  });
  revalidatePath("/rooms");
  revalidatePath("/floors");
  revalidatePath("/residents/new");
  revalidatePath("/dashboard");
  return { ok: true, message: "Seat updated." };
}

export async function deleteSeat(input: { id: string }): Promise<ActionState> {
  const user = await getAuthorized(PERMISSIONS.manageStructure);
  if (!user) return { ok: false, message: "You don't have permission to do this." };

  const seat = await prisma.seat.findUnique({
    where: { id: input.id },
    include: { currentResident: true },
  });
  if (!seat) return { ok: false, message: "Seat not found." };

  if (seat.currentResidentId) {
    return {
      ok: false,
      message: `This seat is currently occupied by ${seat.currentResident?.name ?? "a resident"}. Transfer the resident or complete checkout before deleting this seat.`,
    };
  }

  await prisma.seat.delete({ where: { id: input.id } });
  await writeAudit({
    user,
    action: "seat.deleted",
    entity: "Seat",
    entityId: input.id,
    before: { name: seat.name, roomId: seat.roomId },
  });
  revalidatePath("/rooms");
  revalidatePath("/floors");
  revalidatePath("/dashboard");
  revalidatePath("/reports/occupancy");
  return { ok: true, message: "Seat deleted." };
}
