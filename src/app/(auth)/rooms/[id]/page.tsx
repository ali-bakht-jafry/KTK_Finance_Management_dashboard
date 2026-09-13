import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getBulkResidentFinancials } from "@/lib/aggregates";
import { formatDisplayDate, toDateString } from "@/lib/dates";
import { formatPKR, formatPercent } from "@/lib/format";
import { todayString } from "@/lib/dates";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { BedDouble } from "lucide-react";
import { SeatCard, type SeatCardData } from "@/components/rooms/seat-card";
import { SeatForm } from "@/components/rooms/seat-form";
import { RoomForm } from "@/components/rooms/room-form";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { deleteRoom } from "@/lib/actions/rooms";

export default async function RoomDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const canManage = can(user.role, PERMISSIONS.manageStructure);

  const [room, floors] = await Promise.all([
    prisma.room.findUnique({
      where: { id },
      include: {
        floor: true,
        seats: {
          orderBy: { order: "asc" },
          include: {
            currentResident: {
              select: { name: true, monthlyRent: true },
            },
            assignments: { where: { endDate: null }, select: { startDate: true } },
          },
        },
      },
    }),
    prisma.floor.findMany({
      orderBy: { order: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!room) notFound();

  const financials = await getBulkResidentFinancials(
    room.seats
      .map((s) => s.currentResidentId)
      .filter((id): id is string => !!id),
  );

  const occupied = room.seats.filter((s) => s.currentResidentId).length;
  const total = room.seats.length;

  const seatCards: SeatCardData[] = room.seats.map((s) => {
    const fin = s.currentResidentId ? financials.get(s.currentResidentId) : undefined;
    return {
      id: s.id,
      name: s.name,
      active: s.active,
      residentId: s.currentResidentId,
      residentName: s.currentResident?.name ?? null,
      monthlyRent: s.currentResident?.monthlyRent ?? null,
      financial: fin
        ? { paid: fin.paid, due: fin.due, securityHeld: fin.securityHeld }
        : null,
      assignmentStartDate: s.assignments[0]?.startDate
        ? formatDisplayDate(toDateString(s.assignments[0].startDate))
        : null,
    };
  });

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href="/rooms">
          <ArrowLeft className="h-4 w-4" /> All rooms
        </Link>
      </Button>

      <PageHeader
        title={`${room.floor.name} · ${room.name}`}
        description={
          room.notes ||
          `${total} seats · ${occupied} occupied · ${formatPercent(
            total ? occupied / total : 0,
          )} occupancy`
        }
        actions={
          canManage ? (
            <>
              <SeatForm
                roomId={room.id}
                trigger={<Button><Plus />Add bed</Button>}
              />
              <RoomForm
                floors={floors}
                room={{
                  id: room.id,
                  floorId: room.floorId,
                  name: room.name,
                  capacity: room.capacity,
                  defaultRent: room.defaultRent,
                  notes: room.notes,
                  active: room.active,
                }}
                trigger={<Button variant="outline">Edit Room</Button>}
              />
              <ConfirmButton
                action={deleteRoom}
                id={room.id}
                title="Delete room"
                description={`Delete "${room.name}"? Seats without residents will be removed too. This cannot be undone.`}
              />
            </>
          ) : undefined
        }
      />

      {room.defaultRent != null && room.defaultRent > 0 && (
        <p className="-mt-3 mb-4 text-sm text-muted-foreground">
          Default rent: {formatPKR(room.defaultRent)}
        </p>
      )}

      {total === 0 ? (
        <EmptyState
          icon={BedDouble}
          title="No seats yet"
          description="Add beds to this room so girls can book them."
          action={
            canManage ? (
              <SeatForm
                roomId={room.id}
                trigger={<Button><Plus />Add bed</Button>}
              />
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {seatCards.map((seat) => (
            <SeatCard
              key={seat.id}
              seat={seat}
              roomId={room.id}
              defaultRent={room.defaultRent ?? 0}
              today={todayString()}
              canManage={canManage}
            />
          ))}
        </div>
      )}
    </div>
  );
}

