import Link from "next/link";
import {
  ArrowRight,
  Building2,
  DoorOpen,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/permissions";
import { getActiveResidentCount, getFinancialSummary, getFloorOccupancy } from "@/lib/aggregates";
import { getSetting } from "@/lib/settings";
import { formatPKR } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default async function DashboardPage() {
  const user = await requireUser();
  const [hostelName, activeResidents, finance, floors] = await Promise.all([
    getSetting("hostel.name"),
    getActiveResidentCount(),
    getFinancialSummary(),
    getFloorOccupancy(),
  ]);

  const occupancy = floors.reduce(
    (summary, floor) => ({
      totalRooms: summary.totalRooms + floor.rooms,
      occupiedSeats: summary.occupiedSeats + floor.occupied,
    }),
    { totalRooms: 0, occupiedSeats: 0 },
  );

  const quickActions = [
    { label: "Book a bed", href: "/rooms", icon: UserPlus, permission: PERMISSIONS.manageResidents },
    { label: "Add room", href: "/rooms", icon: DoorOpen, permission: PERMISSIONS.manageStructure },
    { label: "Add payment", href: "/payments", icon: Wallet, permission: PERMISSIONS.manageFinance },
  ].filter((a) => can(user.role, a.permission));

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${user.name}. ${hostelName} is ready to manage.`}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Residents" value={activeResidents} icon={Users} />
        <StatCard label="Rooms" value={occupancy.totalRooms} icon={DoorOpen} />
        <StatCard label="Occupied Seats" value={occupancy.occupiedSeats} icon={Building2} />
        <StatCard label="Collection" value={formatPKR(finance.rentReceived + finance.messReceived)} icon={Wallet} tone="positive" />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Quick actions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {quickActions.map((a) => (
            <Button key={a.label} asChild variant="outline" className="h-12 justify-between">
              <Link href={a.href}>
                <span className="flex items-center gap-2">
                  <a.icon className="h-4 w-4" />
                  {a.label}
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          ))}
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Room status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {floors.length === 0 ? (
              <EmptyState icon={Building2} title="No floor data yet" />
            ) : (
              floors.map((f) => (
                <div key={f.id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium">{f.name}</span>
                    <span className="text-muted-foreground">{f.occupied}/{f.total}</span>
                  </div>
                  <Progress value={f.pct * 100} />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Outstanding balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Rent due</span>
                <span className="font-semibold text-destructive">{formatPKR(finance.rentOutstanding)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Mess due</span>
                <span className="font-semibold text-destructive">{formatPKR(finance.messOutstanding)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Security held</span>
                <span className="font-semibold">{formatPKR(finance.securityHeld)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
