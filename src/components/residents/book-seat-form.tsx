"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { checkInResident } from "@/lib/actions/residents";
import { useAction } from "@/hooks/use-action";

type BookSeatFormProps = {
  seatId: string;
  seatName: string;
  today: string;
  defaultRent: number;
};

export function BookSeatForm({ seatId, seatName, today, defaultRent }: BookSeatFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [joiningDate, setJoiningDate] = useState(today);
  const [monthlyRent, setMonthlyRent] = useState(defaultRent ? String(defaultRent) : "");
  const [monthlyMess, setMonthlyMess] = useState("");
  const [securityDeposit, setSecurityDeposit] = useState("");
  const [initialPayment, setInitialPayment] = useState("");
  const [notes, setNotes] = useState("");

  const { pending, run } = useAction(checkInResident, (res) => {
    toast.success("Seat booked and resident added.");
    router.push(`/residents/${res.id}`);
    router.refresh();
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        run({
          name,
          phone,
          joiningDate,
          seatId,
          monthlyRent,
          monthlyMess,
          securityDeposit,
          initialPayment,
          notes,
        });
      }}
    >
      <Card>
        <CardContent className="space-y-4 p-1">
          <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
            Booking seat <span className="font-semibold">{seatName}</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="book-name">Girl's full name</Label>
              <Input id="book-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="book-phone">Phone</Label>
              <Input id="book-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="book-date">Joining date</Label>
              <Input id="book-date" type="date" value={joiningDate} onChange={(e) => setJoiningDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="book-rent">Monthly rent (Rs.)</Label>
              <Input id="book-rent" type="number" value={monthlyRent} onChange={(e) => setMonthlyRent(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="book-mess">Monthly mess (Rs.)</Label>
              <Input id="book-mess" type="number" value={monthlyMess} onChange={(e) => setMonthlyMess(e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="book-security">Security received (Rs.)</Label>
              <Input id="book-security" type="number" value={securityDeposit} onChange={(e) => setSecurityDeposit(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="book-payment">Rent received now (Rs.)</Label>
              <Input id="book-payment" type="number" value={initialPayment} onChange={(e) => setInitialPayment(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="book-notes">Notes</Label>
            <Textarea id="book-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Saving…" : "Book seat"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
