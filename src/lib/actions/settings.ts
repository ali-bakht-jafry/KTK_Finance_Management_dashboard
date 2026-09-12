"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAuthorized } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import type { ActionState } from "@/lib/validation";

const ALLOWED_KEYS = [
  "hostel.name",
  "hostel.address",
  "hostel.phone",
  "hostel.defaultRent",
  "hostel.defaultMess",
  "receipt.footer",
] as const;

type SettingsInput = Partial<Record<(typeof ALLOWED_KEYS)[number], string>>;

export async function saveSettings(input: SettingsInput): Promise<ActionState> {
  const user = await getAuthorized(PERMISSIONS.manageSettings);
  if (!user) return { ok: false, message: "You don't have permission to do this." };

  const entries = Object.entries(input).filter(
    ([k, v]) =>
      (ALLOWED_KEYS as readonly string[]).includes(k) && typeof v === "string",
  ) as [string, string][];

  for (const [key, value] of entries) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }

  await writeAudit({
    user,
    action: "settings.updated",
    entity: "Setting",
    after: Object.fromEntries(entries),
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true, message: "Settings saved." };
}
