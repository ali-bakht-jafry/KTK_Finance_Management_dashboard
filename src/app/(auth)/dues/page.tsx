import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getDuesList } from "@/lib/dues";
import { formatPKR } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";

export default async function DuesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; floorId?: string; roomId?: string }>;
}) {
  const user = await requireUser();
  const canView = can(user.role, PERMISSIONS.viewDues);
  if (!canView) {
    return <PageHeader title="Dues" description="You don't have permission to view dues." />;
  }

  const { q, floorId, roomId } = await searchParams;
  const floors = await prisma.floor.findMany({
    orderBy: { order: "asc" },
    include: { rooms: { orderBy: { name: "asc" }, select: { id: true, name: true } } },
  });

  const dues = await getDuesList({ search: q, floorId, roomId });
  const total = dues.reduce((s, d) => s + d.totalDue, 0);
  const withDues = dues.filter((d) => d.totalDue > 0);

  return (
    <div>
      <PageHeader title="Money due" description="See which residents still have rent or mess money to pay." />

      <form className="mb-4 flex flex-wrap items-center gap-2" action="/dues" method="get">
        <Input name="q" defaultValue={q} placeholder="Search by name or phone…" className="max-w-xs" />
        <select
          name="floorId"
          defaultValue={floorId ?? ""}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">All floors</option>
          {floors.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <select
          name="roomId"
          defaultValue={roomId ?? ""}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">All rooms</option>
          {floors.flatMap((f) =>
            f.rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {f.name} / {r.name}
              </option>
            )),
          )}
        </select>
        <Button type="submit" variant="secondary" size="sm">
          Filter
        </Button>
        {(q || floorId || roomId) && (
          <Button asChild variant="ghost" size="sm">
            <Link href="/dues">Clear</Link>
          </Button>
        )}
      </form>

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Residents with dues</p>
            <p className="mt-1 text-2xl font-semibold">{withDues.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Total outstanding</p>
            <p className="mt-1 text-2xl font-semibold">{formatPKR(total)}</p>
          </CardContent>
        </Card>
      </div>

      {dues.length === 0 ? (
        <EmptyState icon={AlertCircle} title="No dues" description="All residents are up to date." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Resident</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead className="text-right">Rent due</TableHead>
                  <TableHead className="text-right">Mess due</TableHead>
                  <TableHead className="text-right">Total due</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dues.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">
                      <Link href={`/residents/${d.id}`} className="hover:underline">
                        {d.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{d.room ?? "—"}</TableCell>
                    <TableCell className="text-right">{formatPKR(d.rentDue)}</TableCell>
                    <TableCell className="text-right">{formatPKR(d.messDue)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={d.totalDue > 0 ? "warning" : "success"}>{formatPKR(d.totalDue)}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/residents/${d.id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
