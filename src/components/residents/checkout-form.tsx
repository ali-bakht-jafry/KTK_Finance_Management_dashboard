"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { checkoutResident } from "@/lib/actions/residents";
import { useAction } from "@/hooks/use-action";
import { formatPKR } from "@/lib/format";

export function CheckoutForm({
  resident,
  securityHeld,
  today,
}: {
  resident: { id: string; name: string };
  securityHeld: number;
  today: string;
}) {
  const router = useRouter();
  const [leavingDate, setLeavingDate] = useState(today);
  const [securityDeduction, setSecurityDeduction] = useState("");
  const [securityRefund, setSecurityRefund] = useState("");
  const [notes, setNotes] = useState("");

  const { pending, run } = useAction(checkoutResident, () => {
    toast.success("Resident checked out.");
    router.push("/residents?status=LEFT");
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run({
      residentId: resident.id,
      leavingDate,
      securityDeduction,
      securityRefund,
      notes,
    });
  };

  return (
    <form onSubmit={submit}>
      <Card>
        <CardContent className="space-y-4 p-6">
          <p className="text-sm text-muted-foreground">
            Checking out <span className="font-medium text-foreground">{resident.name}</span> releases their
            seat and marks them as left. This cannot be undone.
          </p>

          <div className="space-y-2">
            <Label htmlFor="co-date">Leaving date</Label>
            <Input
              id="co-date"
              type="date"
              value={leavingDate}
              onChange={(e) => setLeavingDate(e.target.value)}
              required
            />
          </div>

          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            Refundable security deposit:{" "}
            <span className="font-semibold">{formatPKR(securityHeld)}</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="co-deduction">Deduct (Rs., damages etc.)</Label>
              <Input
                id="co-deduction"
                type="number"
                inputMode="numeric"
                value={securityDeduction}
                onChange={(e) => setSecurityDeduction(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="co-refund">Refund (Rs.)</Label>
              <Input
                id="co-refund"
                type="number"
                inputMode="numeric"
                value={securityRefund}
                onChange={(e) => setSecurityRefund(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Deduction + refund cannot exceed the refundable security above.
          </p>

          <div className="space-y-2">
            <Label htmlFor="co-notes">Notes</Label>
            <Textarea id="co-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <div className="flex justify-end">
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Checking out…" : "Complete checkout"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
