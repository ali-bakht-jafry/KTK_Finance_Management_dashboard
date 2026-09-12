import "server-only";

import { prisma } from "@/lib/prisma";

// Key-value settings with sensible defaults. Cached per-request in a module
// variable so repeated reads don't hammer the database.

type SettingsMap = Record<string, string>;

const DEFAULTS: SettingsMap = {
  "hostel.name": "KTK Girls Hostel",
  "hostel.address": "",
  "hostel.phone": "",
  "hostel.defaultRent": "0",
  "hostel.defaultMess": "0",
  "receipt.footer": "Thank you for staying with us.",
};

let cache: SettingsMap | null = null;

async function readAll(force = false): Promise<SettingsMap> {
  if (cache && !force) return cache;

  try {
    const rows = await prisma.setting.findMany();
    const map: SettingsMap = { ...DEFAULTS };
    for (const row of rows) map[row.key] = row.value;
    cache = map;
    return map;
  } catch (error) {
    console.warn("Settings database unavailable, using defaults.", error);
    const fallback: SettingsMap = { ...DEFAULTS };
    cache = fallback;
    return fallback;
  }
}

export async function getSetting(key: string): Promise<string> {
  const map = await readAll();
  return map[key] ?? DEFAULTS[key] ?? "";
}

export async function getNumberSetting(key: string): Promise<number> {
  const raw = await getSetting(key);
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export async function getAllSettings(): Promise<SettingsMap> {
  return readAll();
}

export async function setSettings(entries: Record<string, string>): Promise<void> {
  for (const [key, value] of Object.entries(entries)) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }
  cache = null;
}
