import Link from "next/link";
import { Plus, Wallet } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { formatDisplayDate, todayString } from "@/lib/dates";
import { formatPKR } from "@/lib/format";
import { PAYMENT_TYPE_LABELS } from "@/lib/constants";
import { deletePayment } from "@/lib/actions/payments";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmButton } from "@/components/ui/confirm-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RecordPaymentForm } from "@/components/finance/record-payment-form";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const user = await requireUser();
  const canFinance = can(user.role, PERMISSIONS.manageFinance);
  const { type } = await searchParams;

  const where = type && ["RENT", "MESS", "OTHER", "REFUND"].includes(type)
    ? { paymentType: type as "RENT" | "MESS" | "OTHER" | "REFUND" }
    : {};

  const [payments, residents, totals] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: { resident: true, receipt: true },
      orderBy: { date: "desc" },
      take: 200,
    }),
    prisma.resident.findMany({
      select: { id: true, name: true, status: true },
      orderBy: [{ status: "asc" }, { name: "asc" }],
    }),
    prisma.payment.groupBy({
      by: ["paymentType"],
      _sum: { amount: true },
    }),
  ]);

  const sumBy: Record<string, number> = {};
  for (const row of totals) sumBy[row.paymentType] = row._sum.amount ?? 0;
  const received = (sumBy.RENT ?? 0) + (sumBy.MESS ?? 0) + (sumBy.OTHER ?? 0);
  const refunds = sumBy.REFUND ?? 0;

  return (
    <div>
      <PageHeader
        title="Payments"
        description="See who has paid and quickly add a new payment."
        actions={
          canFinance ? (
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <Plus /> Add payment
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Add received payment</DialogTitle>
                  <DialogDescription>Choose the resident, enter the amount, and optionally add a receipt photo.</DialogDescription>
                </DialogHeader>
                <RecordPaymentForm residents={residents} defaultDate={todayString()} />
              </DialogContent>
            </Dialog>
          ) : undefined
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Total money received</p>
            <p className="mt-1 text-2xl font-semibold">{formatPKR(received)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Refunds given back</p>
            <p className="mt-1 text-2xl font-semibold">{formatPKR(refunds)}</p>
          </CardContent>
        </Card>
      </div>

      {payments.length === 0 ? (
        <EmptyState icon={Wallet} title="No payments" description="Record a payment to get started." />
      ) : (
        <Card>
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {payments.map((p) => (
              <div key={p.id} className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{p.resident?.name ?? "General payment"}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{formatDisplayDate(p.date)}</p>
                  </div>
                  <Badge variant={p.paymentType === "REFUND" ? "secondary" : "default"}>
                    {PAYMENT_TYPE_LABELS[p.paymentType]}
                  </Badge>
                </div>
                <p className="mt-4 text-2xl font-semibold">{formatPKR(p.amount)}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                  {p.receipt && <Link href={`/receipts/${p.receipt.receiptNumber}`} className="text-primary hover:underline">View receipt</Link>}
                  {p.receiptImageData && <a href={p.receiptImageData} target="_blank" rel="noreferrer" className="text-primary hover:underline">View photo</a>}
                  {canFinance && <ConfirmButton action={deletePayment} id={p.id} title="Delete payment?" description={`Delete this payment of ${formatPKR(p.amount)}.`} />}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
