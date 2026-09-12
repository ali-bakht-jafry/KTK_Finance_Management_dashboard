import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getNumberSetting } from "@/lib/settings";
import { todayString } from "@/lib/dates";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { CheckInForm } from "@/components/residents/check-in-form";
import type { FloorOption } from "@/components/residents/check-in-form";

export default async function NewResidentPage() {
  const user = await requireUser();
  if (!can(user.role, PERMISSIONS.manageResidents)) {
    return (
      <div>
        <PageHeader title="Check In" description="You don't have permission to check in residents." />
      </div>
    );
  }

  const [floors, defaultRent, defaultMess, today] = await Promise.all([
    prisma.floor.findMany({
      orderBy: { order: "asc" },
      include: {
        rooms: {
          orderBy: { name: "asc" },
          include: {
            seats: { orderBy: { order: "asc" }, select: { id: true, name: true, currentResidentId: true, active: true } },
          },
        },
      },
    }),
    getNumberSetting("hostel.defaultRent"),
    getNumberSetting("hostel.defaultMess"),
    Promise.resolve(todayString()),
  ]);

  const floorOptions: FloorOption[] = floors.map((f) => ({
    id: f.id,
    name: f.name,
    rooms: f.rooms.map((r) => ({
      id: r.id,
      name: r.name,
      seats: r.seats.map((s) => ({
        id: s.id,
        name: s.name,
        occupied: Boolean(s.currentResidentId),
        active: s.active,
      })),
    })),
  }));

  return (
    <div>
      <PageHeader
        title="Check In"
        description="Register a new resident and assign them a vacant seat."
        actions={
          <Button asChild variant="ghost">
            <Link href="/residents">
              <ArrowLeft /> Back to residents
            </Link>
          </Button>
        }
      />
      <CheckInForm
        floors={floorOptions}
        defaultRent={defaultRent}
        defaultMess={defaultMess}
        today={today}
      />
    </div>
  );
}
