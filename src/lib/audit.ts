import "server-only";

import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth";

type AuditInput = {
  user: SessionUser | null;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
};

/**
 * Append an audit-log entry. Runs on the same Prisma client, so callers can
 * include it inside a $transaction for atomicity with the change it records.
 */
export async function writeAudit(input: AuditInput): Promise<void> {
  const jsonSafe = (v: unknown) => {
    if (v === undefined) return undefined;
    try {
      return JSON.parse(JSON.stringify(v));
    } catch {
      return undefined;
    }
  };
  await prisma.auditLog.create({
    data: {
      userId: input.user?.id ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      before: jsonSafe(input.before),
      after: jsonSafe(input.after),
    },
  });
}
