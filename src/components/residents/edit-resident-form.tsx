"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { updateResident } from "@/lib/actions/residents";
import { useAction } from "@/hooks/use-action";

export function EditResidentForm({
  resident,
}: {
  resident: {
    id: string;
    name: string;
    phone: string | null;
    monthlyRent: number;
    monthlyMess: number;
    notes: string | null;
  };
}) {
  const router = useRouter();
  const [name, setName] = useState(resident.name);
  const [phone, setPhone] = useState(resident.phone ?? "");
  const [monthlyRent, setMonthlyRent] = useState(String(resident.monthlyRent));
  const [monthlyMess, setMonthlyMess] = useState(String(resident.monthlyMess));
  const [notes, setNotes] = useState(resident.notes ?? "");

  const { pending, run } = useAction(updateResident, () => {
    toast.success("Resident updated.");
    router.refresh();
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run({ id: resident.id, name, phone, monthlyRent, monthlyMess, notes });
      }}
    >
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full name</Label>
              <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input id="edit-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-rent">Monthly rent (Rs.)</Label>
              <Input
                id="edit-rent"
                type="number"
                inputMode="numeric"
                value={monthlyRent}
                onChange={(e) => setMonthlyRent(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-mess">Monthly mess (Rs.)</Label>
              <Input
                id="edit-mess"
                type="number"
                inputMode="numeric"
                value={monthlyMess}
                onChange={(e) => setMonthlyMess(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea id="edit-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
          <p className="text-xs text-muted-foreground">
            Changing the rent/mess rate only affects future charge generation — historical charges are never altered.
          </p>
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
