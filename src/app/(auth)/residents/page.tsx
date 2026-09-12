import Link from "next/link";
import { Plus, Users, ArrowRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default async function ResidentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const user = await requireUser();
  const canManage = can(user.role, PERMISSIONS.manageResidents);
  const { q, status } = await searchParams;

  const where = {
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(status === "LEFT" ? { status: "LEFT" as const } : status === "ACTIVE" ? { status: "ACTIVE" as const } : {}),
  };

  const residents = await prisma.resident.findMany({
    where,
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: {
      currentSeat: { include: { room: { include: { floor: true } } } },
    },
  });

  return (
    <div>
      <PageHeader
        title="Residents"
        description="Open a resident to see their bed, payments, and balance."
        actions={
          canManage ? (
            <Button asChild>
              <Link href="/rooms">
                <Plus /> Book a bed
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Button asChild variant={status === undefined || status === "ACTIVE" ? "secondary" : "ghost"} size="sm">
          <Link href="/residents">Active</Link>
        </Button>
        <Button asChild variant={status === "LEFT" ? "secondary" : "ghost"} size="sm">
          <Link href="/residents?status=LEFT">Left</Link>
        </Button>
      </div>

      {residents.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No residents found"
          description={
            q
              ? `No results for "${q}".`
              : "Book a bed to add a resident."
          }
          action={
            canManage && !q ? (
              <Button asChild>
                <Link href="/rooms">
                  <Plus /> Book a bed
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {residents.map((r) => (
            <Link
              key={r.id}
              href={`/residents/${r.id}`}
              className="group rounded-xl border bg-card p-4 transition-colors hover:border-primary hover:bg-primary/5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{r.name}</p>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {r.currentSeat
                      ? `${r.currentSeat.room.floor.name} / ${r.currentSeat.room.name} / Bed ${r.currentSeat.name}`
                      : "No bed assigned"}
                  </p>
                </div>
                <Badge variant={r.status === "ACTIVE" ? "success" : "secondary"}>
                  {r.status === "ACTIVE" ? "Staying" : "Left"}
                </Badge>
              </div>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{r.phone ?? "No phone added"}</span>
                <span className="flex items-center gap-1 font-medium text-primary">
                  Open <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
