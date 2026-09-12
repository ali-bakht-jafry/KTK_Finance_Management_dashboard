import Link from "next/link";
import { Plus, Sparkles, UtensilsCrossed } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { addMonths, currentPeriod, periodLabel } from "@/lib/dates";
import { formatPKR } from "@/lib/format";
import { generateMessCharges, addMessCharge, deleteMessCharge } from "@/lib/actions/mess";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { GenerateChargesForm } from "@/components/finance/generate-charges-form";
import { ChargeForm } from "@/components/finance/charge-form";

export default async function MessPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const user = await requireUser();
  const canFinance = can(user.role, PERMISSIONS.manageFinance);

  const { period: rawPeriod } = await searchParams;
  const period = rawPeriod ?? currentPeriod();

  const [charges, activeResidents] = await Promise.all([
    prisma.messCharge.findMany({
      where: { period },
      include: { resident: true, payments: true },
      orderBy: { resident: { name: "asc" } },
    }),
    prisma.resident.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const charged = charges.reduce((s, c) => s + c.amount, 0);
  const paid = charges.reduce((s, c) => s + c.payments.reduce((a, p) => a + p.amount, 0), 0);
  const periods = Array.from({ length: 6 }, (_, i) => addMonths(currentPeriod(), -i));

  return (
    <div>
      <PageHeader
        title="Mess"
        description="Mess charges and collections."
        actions={
          canFinance ? (
            <>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Plus /> Add charge
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add / adjust mess charge</DialogTitle>
                    <DialogDescription>Record a manual mess charge for a resident.</DialogDescription>
                  </DialogHeader>
                  <ChargeForm action={addMessCharge} residents={activeResidents} label="Mess" defaultPeriod={period} />
                </DialogContent>
              </Dialog>
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <Sparkles /> Generate charges
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Generate mess charges</DialogTitle>
                    <DialogDescription>Bulk-create mess charges for a month.</DialogDescription>
                  </DialogHeader>
                  <GenerateChargesForm action={generateMessCharges} label="Mess" defaultPeriod={period} />
                </DialogContent>
              </Dialog>
            </>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {periods.map((p) => (
          <Button key={p} asChild variant={p === period ? "secondary" : "ghost"} size="sm">
            <Link href={`/mess?period=${p}`}>{periodLabel(p)}</Link>
          </Button>
        ))}
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Charged</p>
            <p className="mt-1 text-2xl font-semibold">{formatPKR(charged)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Paid</p>
            <p className="mt-1 text-2xl font-semibold">{formatPKR(paid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Outstanding</p>
            <p className="mt-1 text-2xl font-semibold">{formatPKR(charged - paid)}</p>
          </CardContent>
        </Card>
      </div>

      {charges.length === 0 ? (
        <EmptyState
          icon={UtensilsCrossed}
          title={`No mess charges for ${periodLabel(period)}`}
          description={canFinance ? "Generate mess charges for this month to get started." : "No charges recorded."}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Resident</TableHead>
                  <TableHead className="text-right">Charged</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  {canFinance && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {charges.map((c) => {
                  const paidFor = c.payments.reduce((s, p) => s + p.amount, 0);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        <Link href={`/residents/${c.resident.id}`} className="hover:underline">
                          {c.resident.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right">{formatPKR(c.amount)}</TableCell>
                      <TableCell className="text-right">{formatPKR(paidFor)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={c.amount - paidFor > 0 ? "warning" : "success"}>
                          {formatPKR(c.amount - paidFor)}
                        </Badge>
                      </TableCell>
                      {canFinance && (
                        <TableCell className="text-right">
                          <ConfirmButton
                            action={deleteMessCharge}
                            id={c.id}
                            title="Delete mess charge?"
                            description={`Delete the ${periodLabel(c.period)} mess charge for ${c.resident.name}.`}
                          />
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
