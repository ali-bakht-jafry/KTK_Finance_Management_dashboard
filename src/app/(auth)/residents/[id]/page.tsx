import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, CreditCard, FileText, History, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getResidentBalances } from "@/lib/aggregates";
import type { ResidentBalances } from "@/lib/aggregates";
import { formatDisplayDate, periodLabel, todayString } from "@/lib/dates";
import { formatPKR } from "@/lib/format";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_TYPE_LABELS,
  SECURITY_TYPE_LABELS,
} from "@/lib/constants";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ResidentActions } from "@/components/residents/resident-actions";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "rent", label: "Rent" },
  { key: "mess", label: "Mess" },
  { key: "payments", label: "Payments" },
  { key: "security", label: "Security" },
  { key: "history", label: "History" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default async function ResidentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { tab } = await searchParams;
  const activeTab: TabKey = TABS.some((t) => t.key === tab) ? (tab as TabKey) : "overview";

  const canManage = can(user.role, PERMISSIONS.manageResidents);

  // Core resident record + balances + transfer dropdown are all light queries
  // that every tab needs. The tab-specific data (payments, charges, etc.) is
  // loaded lazily inside <ResidentTab> so switching tabs never re-fetches the
  // whole history.
  const [resident, balances, floors] = await Promise.all([
    prisma.resident.findUnique({
      where: { id },
      include: {
        currentSeat: { include: { room: { include: { floor: true } } } },
      },
    }),
    getResidentBalances(id),
    canManage
      ? prisma.floor.findMany({
          orderBy: { order: "asc" },
          include: {
            rooms: {
              orderBy: { name: "asc" },
              include: {
                seats: {
                  orderBy: { order: "asc" },
                  select: { id: true, name: true, currentResidentId: true, active: true },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);
  if (!resident) notFound();

  const floorOptions = floors.map((f) => ({
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

  const currentSeat = resident.currentSeat
    ? {
        id: resident.currentSeat.id,
        name: resident.currentSeat.name,
        roomName: resident.currentSeat.room.name,
        floorName: resident.currentSeat.room.floor.name,
      }
    : null;

  return (
    <div>
      <PageHeader
        title={resident.name}
        description={
          resident.status === "ACTIVE"
            ? currentSeat
              ? `${currentSeat.floorName} / ${currentSeat.roomName} / ${currentSeat.name}`
              : "Active — no seat assigned"
            : `Left ${resident.leavingDate ? `on ${formatDisplayDate(resident.leavingDate)}` : ""}`
        }
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/residents">
                <ArrowLeft /> Back
              </Link>
            </Button>
            {canManage && (
              <ResidentActions
                resident={{
                  id: resident.id,
                  name: resident.name,
                  phone: resident.phone,
                  monthlyRent: resident.monthlyRent,
                  monthlyMess: resident.monthlyMess,
                  notes: resident.notes,
                  status: resident.status,
                  currentSeat,
                }}
                floors={floorOptions}
                securityHeld={balances.securityHeld}
                today={todayString()}
              />
            )}
          </div>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <Badge variant={resident.status === "ACTIVE" ? "success" : "secondary"}>
          {resident.status === "ACTIVE" ? "Active" : "Left"}
        </Badge>
        {resident.phone && <span className="text-sm text-muted-foreground">{resident.phone}</span>}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Button
            key={t.key}
            asChild
            variant={activeTab === t.key ? "secondary" : "ghost"}
            size="sm"
          >
            <Link href={`/residents/${resident.id}?tab=${t.key}`}>{t.label}</Link>
          </Button>
        ))}
      </div>

      <Suspense fallback={<TabSkeleton />}>
        <ResidentTab
          tab={activeTab}
          resident={{
            id: resident.id,
            monthlyRent: resident.monthlyRent,
            monthlyMess: resident.monthlyMess,
            joiningDate: resident.joiningDate,
            notes: resident.notes,
          }}
          balances={balances}
        />
      </Suspense>
    </div>
  );
}

/**
 * Loads only the data for the currently active tab, so the resident record
 * renders immediately and each tab switch fetches a small, targeted query.
 */
async function ResidentTab({
  tab,
  resident,
  balances,
}: {
  tab: TabKey;
  resident: {
    id: string;
    monthlyRent: number;
    monthlyMess: number;
    joiningDate: Date;
    notes: string | null;
  };
  balances: ResidentBalances;
}) {
  if (tab === "overview") {
    return (
      <OverviewTab
        balances={balances}
        rent={resident.monthlyRent}
        mess={resident.monthlyMess}
        joined={resident.joiningDate}
        notes={resident.notes}
        securityHeld={balances.securityHeld}
      />
    );
  }

  if (tab === "rent") {
    const charges = await prisma.rentCharge.findMany({
      where: { residentId: resident.id },
      orderBy: { period: "desc" },
      include: { payments: true },
    });
    return (
      <ChargesTable
        rows={charges.map((c) => ({
          period: periodLabel(c.period),
          amount: c.amount,
          paid: c.payments.reduce((s, p) => s + p.amount, 0),
        }))}
        empty="No rent charges yet. Generate monthly charges from the Rent module."
        totalLabel="Rent charged"
        total={balances.rentCharged}
      />
    );
  }

  if (tab === "mess") {
    const charges = await prisma.messCharge.findMany({
      where: { residentId: resident.id },
      orderBy: { period: "desc" },
      include: { payments: true },
    });
    return (
      <ChargesTable
        rows={charges.map((c) => ({
          period: periodLabel(c.period),
          amount: c.amount,
          paid: c.payments.reduce((s, p) => s + p.amount, 0),
        }))}
        empty="No mess charges yet."
        totalLabel="Mess charged"
        total={balances.messCharged}
      />
    );
  }

  if (tab === "payments") {
    const payments = await prisma.payment.findMany({
      where: { residentId: resident.id },
      orderBy: { date: "desc" },
      include: { rentCharge: true, messCharge: true, receipt: true },
    });
    return <PaymentsTable payments={payments} />;
  }

  if (tab === "security") {
    const transactions = await prisma.securityTransaction.findMany({
      where: { residentId: resident.id },
      orderBy: { date: "desc" },
    });
    return <SecurityTable transactions={transactions} held={balances.securityHeld} />;
  }

  const assignments = await prisma.seatAssignment.findMany({
    where: { residentId: resident.id },
    orderBy: { startDate: "desc" },
  });
  return <HistoryTable assignments={assignments} />;
}

function TabSkeleton() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Loading">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-24 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-56 rounded-lg" />
    </div>
  );
}

function OverviewTab({
  balances,
  rent,
  mess,
  joined,
  notes,
  securityHeld,
}: {
  balances: {
    rentCharged: number;
    rentPaid: number;
    rentDue: number;
    messCharged: number;
    messPaid: number;
    messDue: number;
    totalDue: number;
  };
  rent: number;
  mess: number;
  joined: Date;
  notes: string | null;
  securityHeld: number;
}) {
  const stats = [
    { label: "Rent charged", value: formatPKR(balances.rentCharged) },
    { label: "Rent paid", value: formatPKR(balances.rentPaid) },
    { label: "Rent due", value: formatPKR(balances.rentDue) },
    { label: "Mess charged", value: formatPKR(balances.messCharged) },
    { label: "Mess paid", value: formatPKR(balances.messPaid) },
    { label: "Total due", value: formatPKR(balances.totalDue) },
  ];

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-2xl font-semibold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Joined:</span> {formatDisplayDate(joined)}
          </p>
          <p>
            <span className="text-muted-foreground">Monthly rent:</span> {formatPKR(rent)}
          </p>
          <p>
            <span className="text-muted-foreground">Monthly mess:</span> {formatPKR(mess)}
          </p>
          <p>
            <span className="text-muted-foreground">Security held:</span> {formatPKR(securityHeld)}
          </p>
          {notes && (
            <p>
              <span className="text-muted-foreground">Notes:</span> {notes}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ChargesTable({
  rows,
  empty,
  totalLabel,
  total,
}: {
  rows: { period: string; amount: number; paid: number }[];
  empty: string;
  totalLabel: string;
  total: number;
}) {
  if (rows.length === 0) {
    return <EmptyState icon={FileText} title="Nothing here yet" description={empty} />;
  }
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead className="text-right">Charged</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.period}>
                <TableCell className="font-medium">{r.period}</TableCell>
                <TableCell className="text-right">{formatPKR(r.amount)}</TableCell>
                <TableCell className="text-right">{formatPKR(r.paid)}</TableCell>
                <TableCell className="text-right">{formatPKR(r.amount - r.paid)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="font-semibold">
              <TableCell>{totalLabel}</TableCell>
              <TableCell className="text-right">{formatPKR(total)}</TableCell>
              <TableCell className="text-right">
                {formatPKR(rows.reduce((s, r) => s + r.paid, 0))}
              </TableCell>
              <TableCell className="text-right">
                {formatPKR(total - rows.reduce((s, r) => s + r.paid, 0))}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function PaymentsTable({
  payments,
}: {
  payments: Array<{
    id: string;
    date: Date;
    paymentType: string;
    amount: number;
    method: string;
    notes: string | null;
    rentCharge: { period: string } | null;
    messCharge: { period: string } | null;
    receipt: { receiptNumber: string } | null;
  }>;
}) {
  if (payments.length === 0) {
    return (
      <EmptyState
        icon={CreditCard}
        title="No payments"
        description="No payments recorded for this resident yet."
      />
    );
  }
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Method</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Receipt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="text-muted-foreground">{formatDisplayDate(p.date)}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{PAYMENT_TYPE_LABELS[p.paymentType as keyof typeof PAYMENT_TYPE_LABELS]}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {p.rentCharge ? periodLabel(p.rentCharge.period) : p.messCharge ? periodLabel(p.messCharge.period) : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {PAYMENT_METHOD_LABELS[p.method as keyof typeof PAYMENT_METHOD_LABELS]}
                </TableCell>
                <TableCell className="text-right font-medium">{formatPKR(p.amount)}</TableCell>
                <TableCell>
                  {p.receipt ? (
                    <Link href={`/receipts/${p.receipt.receiptNumber}`} className="hover:underline">
                      {p.receipt.receiptNumber}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function SecurityTable({
  transactions,
  held,
}: {
  transactions: Array<{
    id: string;
    type: string;
    amount: number;
    date: Date;
    notes: string | null;
  }>;
  held: number;
}) {
  return (
    <div className="grid gap-4">
      <Card>
        <CardContent className="flex items-center justify-between p-5">
          <p className="text-sm text-muted-foreground">Security currently held</p>
          <p className="text-2xl font-semibold">{formatPKR(held)}</p>
        </CardContent>
      </Card>
      {transactions.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="No security activity" description="No deposit recorded yet." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-muted-foreground">{formatDisplayDate(t.date)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          t.type === "DEPOSIT" ? "success" : t.type === "REFUND" ? "secondary" : "destructive"
                        }
                      >
                        {SECURITY_TYPE_LABELS[t.type as keyof typeof SECURITY_TYPE_LABELS]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatPKR(t.amount)}</TableCell>
                    <TableCell className="text-muted-foreground">{t.notes ?? "—"}</TableCell>
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

function HistoryTable({
  assignments,
}: {
  assignments: Array<{
    id: string;
    floorName: string;
    roomName: string;
    seatName: string;
    startDate: Date;
    endDate: Date | null;
  }>;
}) {
  if (assignments.length === 0) {
    return <EmptyState icon={History} title="No history" description="No seat assignments recorded." />;
  }
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Floor</TableHead>
              <TableHead>Room</TableHead>
              <TableHead>Seat</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignments.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="text-muted-foreground">{a.floorName}</TableCell>
                <TableCell className="text-muted-foreground">{a.roomName}</TableCell>
                <TableCell className="font-medium">{a.seatName}</TableCell>
                <TableCell className="text-muted-foreground">{formatDisplayDate(a.startDate)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {a.endDate ? formatDisplayDate(a.endDate) : "Present"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
