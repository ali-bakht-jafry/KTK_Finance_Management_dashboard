"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuthorized } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import type { ActionState } from "@/lib/validation";

const ROLES = ["ADMIN", "ACCOUNTANT", "MANAGER"] as const;

const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(ROLES),
});

export async function createUser(input: unknown): Promise<ActionState> {
  const user = await getAuthorized(PERMISSIONS.manageUsers);
  if (!user) return { ok: false, message: "You don't have permission to do this." };
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const d = parsed.data;

  const email = d.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { ok: false, message: "A user with this email already exists." };

  const passwordHash = await bcrypt.hash(d.password, 10);
  const created = await prisma.user.create({
    data: { name: d.name, email, passwordHash, role: d.role },
  });

  await writeAudit({
    user,
    action: "user.created",
    entity: "User",
    entityId: created.id,
    after: { name: created.name, email: created.email, role: created.role },
  });

  revalidatePath("/users");
  return { ok: true, message: "User created.", id: created.id };
}

export async function updateUserRole(input: { id: string; role: (typeof ROLES)[number] }): Promise<ActionState> {
  const actor = await getAuthorized(PERMISSIONS.manageUsers);
  if (!actor) return { ok: false, message: "You don't have permission to do this." };

  // Prevent demoting yourself out of ADMIN (avoids locking everyone out).
  if (input.id === actor.id && input.role !== "ADMIN") {
    return { ok: false, message: "You cannot remove your own admin role." };
  }

  const target = await prisma.user.findUnique({ where: { id: input.id } });
  if (!target) return { ok: false, message: "User not found." };

  // Ensure at least one ADMIN remains.
  if (target.role === "ADMIN" && input.role !== "ADMIN") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) return { ok: false, message: "At least one admin must remain." };
  }

  await prisma.user.update({ where: { id: input.id }, data: { role: input.role } });
  await writeAudit({
    user: actor,
    action: "user.role_changed",
    entity: "User",
    entityId: input.id,
    before: { role: target.role },
    after: { role: input.role },
  });

  revalidatePath("/users");
  return { ok: true, message: "Role updated." };
}

export async function resetUserPassword(input: { id: string; password: string }): Promise<ActionState> {
  const actor = await getAuthorized(PERMISSIONS.manageUsers);
  if (!actor) return { ok: false, message: "You don't have permission to do this." };
  if (!input.password || input.password.length < 8) {
    return { ok: false, message: "Password must be at least 8 characters." };
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  await prisma.user.update({ where: { id: input.id }, data: { passwordHash } });
  await writeAudit({
    user: actor,
    action: "user.password_reset",
    entity: "User",
    entityId: input.id,
  });

  revalidatePath("/users");
  return { ok: true, message: "Password reset." };
}

export async function deleteUser(input: { id: string }): Promise<ActionState> {
  const actor = await getAuthorized(PERMISSIONS.manageUsers);
  if (!actor) return { ok: false, message: "You don't have permission to do this." };

  if (input.id === actor.id) {
    return { ok: false, message: "You cannot delete your own account." };
  }

  const target = await prisma.user.findUnique({ where: { id: input.id } });
  if (!target) return { ok: false, message: "User not found." };

  if (target.role === "ADMIN") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) return { ok: false, message: "At least one admin must remain." };
  }

  await prisma.user.delete({ where: { id: input.id } });
  await writeAudit({
    user: actor,
    action: "user.deleted",
    entity: "User",
    entityId: input.id,
    before: { name: target.name, email: target.email },
  });

  revalidatePath("/users");
  return { ok: true, message: "User deleted." };
}
