"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuthorized } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { parseMoney } from "@/lib/validation";
import type { ActionState } from "@/lib/validation";

const schema = z.object({
  floorId: z.string().min(1, "Select a floor"),
  name: z.string().trim().min(1, "Room number/name is required").max(100),
  capacity: z
    .union([z.string(), z.number()])
    .transform((v) => {
      const n = Number(String(v).replace(/[,\s]/g, ""));
      return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
    })
    .nullable(),
  defaultRent: z
    .union([z.string(), z.number()])
    .transform((v) => parseMoney(v))
    .nullable(),
  notes: z.string().trim().optional().nullable(),
  active: z.boolean().optional().default(true),
});

export async function createRoom(input: unknown): Promise<ActionState> {
  const user = await getAuthorized(PERMISSIONS.manageStructure);
  if (!user) return { ok: false, message: "You don't have permission to do this." };
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const duplicate = await prisma.room.findFirst({
    where: { floorId: parsed.data.floorId, name: parsed.data.name },
  });
  if (duplicate) {
    return { ok: false, message: `A room named "${parsed.data.name}" already exists on this floor.` };
  }

  const room = await prisma.room.create({
    data: {
      floorId: parsed.data.floorId,
      name: parsed.data.name,
      capacity: parsed.data.capacity ?? null,
      defaultRent: parsed.data.defaultRent ?? null,
      notes: parsed.data.notes || null,
      active: parsed.data.active,
    },
  });
  await writeAudit({
    user,
    action: "room.created",
    entity: "Room",
    entityId: room.id,
    after: { name: room.name, floorId: room.floorId },
  });
  revalidatePath("/rooms");
  revalidatePath("/floors");
  revalidatePath("/dashboard");
  return { ok: true, message: "Room added.", id: room.id };
}

export async function updateRoom(input: unknown): Promise<ActionState> {
  const user = await getAuthorized(PERMISSIONS.manageStructure);
  if (!user) return { ok: false, message: "You don't have permission to do this." };
  const parsed = schema.extend({ id: z.string().min(1) }).safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const existing = await prisma.room.findUnique({ where: { id: parsed.data.id } });
  if (!existing) return { ok: false, message: "Room not found." };

  const duplicate = await prisma.room.findFirst({
    where: {
      floorId: parsed.data.floorId,
      name: parsed.data.name,
      id: { not: parsed.data.id },
    },
  });
  if (duplicate) {
    return { ok: false, message: `A room named "${parsed.data.name}" already exists on this floor.` };
  }

  const room = await prisma.room.update({
    where: { id: parsed.data.id },
    data: {
      floorId: parsed.data.floorId,
      name: parsed.data.name,
      capacity: parsed.data.capacity ?? null,
      defaultRent: parsed.data.defaultRent ?? null,
      notes: parsed.data.notes || null,
      active: parsed.data.active,
    },
  });
  await writeAudit({
    user,
    action: "room.updated",
    entity: "Room",
    entityId: room.id,
    before: { name: existing.name, floorId: existing.floorId },
    after: { name: room.name, floorId: room.floorId },
  });
  revalidatePath("/rooms");
  revalidatePath("/floors");
  revalidatePath("/dashboard");
  return { ok: true, message: "Room updated." };
}

export async function deleteRoom(input: { id: string }): Promise<ActionState> {
  const user = await getAuthorized(PERMISSIONS.manageStructure);
  if (!user) return { ok: false, message: "You don't have permission to do this." };

  const room = await prisma.room.findUnique({
    where: { id: input.id },
    include: { seats: true },
  });
  if (!room) return { ok: false, message: "Room not found." };

  const occupied = room.seats.filter((s) => s.currentResidentId).length;
  if (occupied > 0) {
    return {
      ok: false,
      message: `This room has ${occupied} occupied seat(s). Transfer or check out residents before deleting it.`,
    };
  }

  await prisma.room.delete({ where: { id: input.id } });
  await writeAudit({
    user,
    action: "room.deleted",
    entity: "Room",
    entityId: input.id,
    before: { name: room.name },
  });
  revalidatePath("/rooms");
  revalidatePath("/floors");
  revalidatePath("/dashboard");
  revalidatePath("/reports/occupancy");
  return { ok: true, message: "Room deleted." };
}
