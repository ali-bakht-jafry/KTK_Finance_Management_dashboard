import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import { formatDisplayDate } from "@/lib/dates";
import { formatPKR } from "@/lib/format";
import { PAYMENT_METHOD_LABELS, PAYMENT_TYPE_LABELS } from "@/lib/constants";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PrintReceiptButton } from "@/components/finance/print-receipt-button";

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ receiptNumber: string }>;
}) {
  const user = await requireUser();
  if (!can(user.role, PERMISSIONS.viewReceipts)) {
    return <PageHeader title="Receipt" description="You don't have permission to view receipts." />;
  }

  const { receiptNumber } = await params;
  const receipt = await prisma.receipt.findUnique({
    where: { receiptNumber },
    include: {
      resident: { select: { id: true, name: true, phone: true } },
      payment: { select: { reference: true, notes: true, receiptImageData: true } },
      createdBy: { select: { name: true } },
    },
  });
  if (!receipt) notFound();

  const footer = await getSetting("receipt.footer");

  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/payments">
            <ArrowLeft /> Back to payments
          </Link>
        </Button>
        <PrintReceiptButton />
      </div>

      <Card className="print-area mx-auto max-w-2xl">
        <CardHeader className="border-b text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <FileText className="h-5 w-5" />
          </div>
          <CardTitle>Payment receipt</CardTitle>
          <p className="text-sm text-muted-foreground">{receipt.receiptNumber}</p>
        </CardHeader>
        <CardContent className="space-y-4 p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <Info label="Resident" value={receipt.resident?.name ?? "General payment"} />
            <Info label="Payment type" value={PAYMENT_TYPE_LABELS[receipt.paymentType]} />
            <Info label="Amount" value={formatPKR(receipt.amount)} strong />
            <Info label="Date" value={formatDisplayDate(receipt.date)} />
            <Info label="Method" value={PAYMENT_METHOD_LABELS[receipt.method]} />
            {receipt.resident?.phone && <Info label="Phone" value={receipt.resident.phone} />}
          </div>

          {(receipt.payment?.reference || receipt.payment?.notes) && (
            <div className="border-t pt-4 text-sm">
              {receipt.payment.reference && <Info label="Reference" value={receipt.payment.reference} />}
              {receipt.payment.notes && <Info label="Note" value={receipt.payment.notes} />}
            </div>
          )}

          {receipt.payment?.receiptImageData && (
            <div className="border-t pt-4">
              <p className="mb-2 text-sm font-medium">Uploaded receipt photo</p>
              <a href={receipt.payment.receiptImageData} target="_blank" rel="noreferrer">
                <img
                  src={receipt.payment.receiptImageData}
                  alt="Uploaded payment receipt"
                  className="max-h-80 w-full rounded-md border object-contain"
                />
              </a>
            </div>
          )}

          <div className="border-t pt-4 text-center text-sm text-muted-foreground">
            <p>{footer}</p>
            <p className="mt-1 text-xs">Recorded by {receipt.createdBy.name}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Info({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b pb-2 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "text-base font-semibold" : "font-medium"}>{value}</span>
    </div>
  );
}
