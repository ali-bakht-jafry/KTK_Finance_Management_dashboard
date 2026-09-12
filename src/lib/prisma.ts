import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL ?? process.env.NETLIFY_DB_URL;

if (!databaseUrl) {
  throw new Error("Database connection is not configured. Set DATABASE_URL or NETLIFY_DB_URL.");
}

const runtimeDatabaseUrl = new URL(databaseUrl);
if (!runtimeDatabaseUrl.searchParams.has("connection_limit")) {
  runtimeDatabaseUrl.searchParams.set("connection_limit", "1");
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: runtimeDatabaseUrl.toString() } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

globalForPrisma.prisma = prisma;
