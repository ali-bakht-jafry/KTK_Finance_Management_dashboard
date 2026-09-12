"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { recordSecurity } from "@/lib/actions/security";
import { useAction } from "@/hooks/use-action";

type ResidentOption = { id: string; name: string };

export function RecordSecurityForm({
  residents,
  defaultDate,
}: {
  residents: ResidentOption[];
  defaultDate: string;
}) {
  const router = useRouter();
  const [residentId, setResidentId] = useState("");
  const [type, setType] = useState("DEPOSIT");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [notes, setNotes] = useState("");

  const { pending, run } = useAction(recordSecurity, () => {
    toast.success("Security transaction recorded.");
    router.refresh();
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!residentId) {
          toast.error("Select a resident.");
          return;
        }
        run({ residentId, type, amount, date, notes: notes || null });
      }}
    >
      <div className="space-y-2">
        <Label>Resident</Label>
        <Select value={residentId} onValueChange={setResidentId}>
          <SelectTrigger>
            <SelectValue placeholder="Select resident" />
          </SelectTrigger>
          <SelectContent>
            {residents.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Type</Label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="DEPOSIT">Deposit (received)</SelectItem>
            <SelectItem value="REFUND">Refund (returned)</SelectItem>
            <SelectItem value="DEDUCTION">Deduction (damages)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="rs-amount">Amount (Rs.)</Label>
          <Input
            id="rs-amount"
            type="number"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="rs-date">Date</Label>
          <Input id="rs-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="rs-notes">Notes (optional)</Label>
        <Input id="rs-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <p className="text-xs text-muted-foreground">
        Refunds and deductions cannot exceed the resident&apos;s refundable security.
      </p>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Record transaction"}
        </Button>
      </div>
    </form>
  );
}
