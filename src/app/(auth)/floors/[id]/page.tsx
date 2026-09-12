import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, DoorOpen, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { formatPKR, formatPercent } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function FloorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const canManage = can(user.role, PERMISSIONS.manageStructure);

  const floor = await prisma.floor.findUnique({
    where: { id },
    include: {
      rooms: {
        orderBy: { name: "asc" },
        include: {
          seats: {
            select: {
              id: true,
              currentResidentId: true,
              currentResident: {
                include: {
                  rentCharges: { select: { amount: true } },
                  messCharges: { select: { amount: true } },
                  payments: { select: { amount: true, paymentType: true } },
                  securityTransactions: { select: { amount: true, type: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!floor) notFound();

  const rooms = floor.rooms.map((r) => {
    const occupied = r.seats.filter((s) => s.currentResidentId).length;
    return {
      ...r,
      total: r.seats.length,
      occupied,
      vacant: r.seats.length - occupied,
      pct: r.seats.length ? occupied / r.seats.length : 0,
      paid: r.seats.reduce(
        (sum, seat) => sum + (seat.currentResident ? getResidentPaid(seat.currentResident) : 0),
        0,
      ),
      due: r.seats.reduce(
        (sum, seat) => sum + (seat.currentResident ? getResidentDue(seat.currentResident) : 0),
        0,
      ),
      securityHeld: r.seats.reduce(
        (sum, seat) => sum + (seat.currentResident ? getSecurityHeld(seat.currentResident) : 0),
        0,
      ),
    };
  });

  const totalSeats = rooms.reduce((s, r) => s + r.total, 0);
  const totalOccupied = rooms.reduce((s, r) => s + r.occupied, 0);

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href="/floors">
          <ArrowLeft className="h-4 w-4" /> All floors
        </Link>
      </Button>

      <PageHeader
        title={floor.name}
        description={`${rooms.length} rooms · ${totalOccupied}/${totalSeats} seats occupied`}
        actions={
          canManage ? (
            <Button asChild>
              <Link href="/rooms">
                <Plus /> Add Room
              </Link>
            </Button>
          ) : undefined
        }
      />

      {rooms.length === 0 ? (
        <EmptyState
          icon={DoorOpen}
          title="No rooms on this floor"
          description="Add a room to start assigning seats."
          action={
            canManage ? (
              <Button asChild>
                <Link href="/rooms">
                  <Plus /> Add Room
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Room</TableHead>
                  <TableHead className="text-right">Seats</TableHead>
                  <TableHead className="text-right">Occupied</TableHead>
                  <TableHead className="text-right">Vacant</TableHead>
                  <TableHead className="text-right">Occupancy</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Due</TableHead>
                  <TableHead className="text-right">Security</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rooms.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      <Link href={`/rooms/${r.id}`} className="hover:underline">
                        {r.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">{r.total}</TableCell>
                    <TableCell className="text-right">{r.occupied}</TableCell>
                    <TableCell className="text-right">{r.vacant}</TableCell>
                    <TableCell className="text-right">{formatPercent(r.pct)}</TableCell>
                    <TableCell className="text-right">{formatPKR(r.paid)}</TableCell>
                    <TableCell className={`text-right ${r.due > 0 ? "font-semibold text-destructive" : ""}`}>
                      {formatPKR(r.due)}
                    </TableCell>
                    <TableCell className="text-right">{formatPKR(r.securityHeld)}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/rooms/${r.id}`}>Open</Link>
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

type ResidentFinancialData = {
  rentCharges: { amount: number }[];
  messCharges: { amount: number }[];
  payments: { amount: number; paymentType: string }[];
  securityTransactions: { amount: number; type: string }[];
};

function getResidentPaid(resident: ResidentFinancialData) {
  return resident.payments
    .filter((payment) => payment.paymentType === "RENT" || payment.paymentType === "MESS")
    .reduce((sum, payment) => sum + payment.amount, 0);
}

function getResidentDue(resident: ResidentFinancialData) {
  const rentCharged = resident.rentCharges.reduce((sum, charge) => sum + charge.amount, 0);
  const messCharged = resident.messCharges.reduce((sum, charge) => sum + charge.amount, 0);
  const rentPaid = resident.payments
    .filter((payment) => payment.paymentType === "RENT")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const messPaid = resident.payments
    .filter((payment) => payment.paymentType === "MESS")
    .reduce((sum, payment) => sum + payment.amount, 0);
  return Math.max(0, rentCharged - rentPaid) + Math.max(0, messCharged - messPaid);
}

function getSecurityHeld(resident: ResidentFinancialData) {
  return resident.securityTransactions.reduce(
    (sum, transaction) =>
      sum + (transaction.type === "DEPOSIT" ? transaction.amount : -transaction.amount),
    0,
  );
}
