import Link from "next/link";
import { Plus, DoorOpen, Building2, ArrowRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { RoomForm } from "@/components/rooms/room-form";
import { FloorForm } from "@/components/floors/floor-form";

export default async function RoomsPage() {
  const user = await requireUser();
  const canManage = can(user.role, PERMISSIONS.manageStructure);

  const floors = await prisma.floor.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
    include: {
      rooms: {
        orderBy: { name: "asc" },
        include: { seats: { select: { id: true, currentResidentId: true } } },
      },
    },
  });

  const totalRooms = floors.reduce((s, f) => s + f.rooms.length, 0);

  return (
    <div>
      <PageHeader
        title="Rooms & beds"
        description="Choose a floor, then open a room to book a vacant bed or check payment details."
        actions={
          canManage ? (
            <div className="flex flex-wrap gap-2">
              <FloorForm suggestedOrder={floors.length + 1} trigger={<Button variant="outline"><Building2 />Add floor</Button>} />
              {floors.length > 0 && (
                <RoomForm
                  floors={floors.map((f) => ({ id: f.id, name: f.name }))}
                  trigger={<Button><Plus />Add room</Button>}
                />
              )}
            </div>
          ) : undefined
        }
      />

      {totalRooms === 0 ? (
        <EmptyState
          icon={DoorOpen}
          title="Set up your hostel"
          description="Start by adding a floor, then add rooms and beds inside it."
          action={
            canManage ? (
              <FloorForm suggestedOrder={1} trigger={<Button><Building2 />Add your first floor</Button>} />
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-6">
          {floors.map((floor) => (
            <Card key={floor.id}>
              <CardHeader className="flex-row items-center justify-between py-4">
                <div>
                  <CardTitle className="text-base">{floor.name}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {floor.rooms.length} {floor.rooms.length === 1 ? "room" : "rooms"}
                  </p>
                </div>
                {canManage && (
                  <RoomForm
                    floors={floors.map((f) => ({ id: f.id, name: f.name }))}
                    trigger={<Button variant="outline" size="sm"><Plus />Add room</Button>}
                  />
                )}
              </CardHeader>
              <CardContent>
                {floor.rooms.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No rooms yet. Add the first room on this floor.</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {floor.rooms.map((room) => {
                      const occupied = room.seats.filter((s) => s.currentResidentId).length;
                      const total = room.seats.length;
                      const vacant = total - occupied;
                      return (
                        <Link
                          key={room.id}
                          href={`/rooms/${room.id}`}
                          className="group rounded-lg border p-4 transition-colors hover:border-primary hover:bg-primary/5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold">{room.name}</p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {occupied} booked · {vacant} vacant
                              </p>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            <Badge variant={vacant > 0 ? "success" : "secondary"}>
                              {vacant > 0 ? `${vacant} bed${vacant === 1 ? "" : "s"} available` : "Fully booked"}
                            </Badge>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
