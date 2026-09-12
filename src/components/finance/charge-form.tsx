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
import { useAction } from "@/hooks/use-action";
import type { ActionState } from "@/lib/validation";

type ResidentOption = { id: string; name: string };

export function ChargeForm({
  action,
  residents,
  label,
  defaultPeriod,
}: {
  action: (input: {
    residentId: string;
    period: string;
    amount: string;
    notes?: string;
  }) => Promise<ActionState>;
  residents: ResidentOption[];
  label: string;
  defaultPeriod: string;
}) {
  const router = useRouter();
  const [residentId, setResidentId] = useState("");
  const [period, setPeriod] = useState(defaultPeriod);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  const { pending, run } = useAction(action, () => {
    toast.success(`${label} charge saved.`);
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
        run({ residentId, period, amount, notes });
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
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`ch-${label}-p`}>Month</Label>
          <Input
            id={`ch-${label}-p`}
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`ch-${label}-a`}>Amount (Rs.)</Label>
          <Input
            id={`ch-${label}-a`}
            type="number"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`ch-${label}-n`}>Notes (optional)</Label>
        <Input id={`ch-${label}-n`} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <p className="text-xs text-muted-foreground">
        If a charge already exists for this month, only its notes are updated — the amount stays as
        originally recorded.
      </p>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save charge"}
        </Button>
      </div>
    </form>
  );
}
