"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuthorized } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import type { ActionState } from "@/lib/validation";

const schema = z.object({
  name: z.string().trim().min(1, "Floor name is required").max(100),
  order: z.coerce.number().int(),
});

export async function createFloor(input: unknown): Promise<ActionState> {
  const user = await getAuthorized(PERMISSIONS.manageStructure);
  if (!user) return { ok: false, message: "You don't have permission to do this." };
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const floor = await prisma.floor.create({
    data: { name: parsed.data.name, order: parsed.data.order },
  });
  await writeAudit({
    user,
    action: "floor.created",
    entity: "Floor",
    entityId: floor.id,
    after: { name: floor.name, order: floor.order },
  });
  revalidatePath("/floors");
  revalidatePath("/rooms");
  revalidatePath("/dashboard");
  return { ok: true, message: "Floor added.", id: floor.id };
}

export async function updateFloor(input: unknown): Promise<ActionState> {
  const user = await getAuthorized(PERMISSIONS.manageStructure);
  if (!user) return { ok: false, message: "You don't have permission to do this." };
  const parsed = schema
    .extend({ id: z.string().min(1) })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const existing = await prisma.floor.findUnique({ where: { id: parsed.data.id } });
  if (!existing) return { ok: false, message: "Floor not found." };

  const floor = await prisma.floor.update({
    where: { id: parsed.data.id },
    data: { name: parsed.data.name, order: parsed.data.order },
  });
  await writeAudit({
    user,
    action: "floor.updated",
    entity: "Floor",
    entityId: floor.id,
    before: { name: existing.name, order: existing.order },
    after: { name: floor.name, order: floor.order },
  });
  revalidatePath("/floors");
  revalidatePath("/rooms");
  revalidatePath("/dashboard");
  return { ok: true, message: "Floor updated." };
}

export async function deleteFloor(input: { id: string }): Promise<ActionState> {
  const user = await getAuthorized(PERMISSIONS.manageStructure);
  if (!user) return { ok: false, message: "You don't have permission to do this." };

  const floor = await prisma.floor.findUnique({
    where: { id: input.id },
    include: { rooms: { include: { seats: true } } },
  });
  if (!floor) return { ok: false, message: "Floor not found." };

  const occupied = floor.rooms
    .flatMap((r) => r.seats)
    .filter((s) => s.currentResidentId).length;
  if (occupied > 0) {
    return {
      ok: false,
      message: `This floor has ${occupied} occupied seat(s). Transfer or check out residents before deleting it.`,
    };
  }

  await prisma.floor.delete({ where: { id: input.id } });
  await writeAudit({
    user,
    action: "floor.deleted",
    entity: "Floor",
    entityId: input.id,
    before: { name: floor.name, rooms: floor.rooms.length },
  });
  revalidatePath("/floors");
  revalidatePath("/rooms");
  revalidatePath("/dashboard");
  revalidatePath("/reports/occupancy");
  return { ok: true, message: "Floor deleted." };
}
