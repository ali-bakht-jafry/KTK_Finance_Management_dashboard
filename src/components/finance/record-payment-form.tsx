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
import { recordPayment } from "@/lib/actions/payments";
import { useAction } from "@/hooks/use-action";
import { PAYMENT_METHODS } from "@/lib/constants";

type ResidentOption = { id: string; name: string; status: "ACTIVE" | "LEFT" };

export function RecordPaymentForm({
  residents,
  defaultDate,
}: {
  residents: ResidentOption[];
  defaultDate: string;
}) {
  const router = useRouter();
  const [paymentType, setPaymentType] = useState("RENT");
  const [residentId, setResidentId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [date, setDate] = useState(defaultDate);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [receiptImageData, setReceiptImageData] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);

  const { pending, run } = useAction(recordPayment, () => {
    toast.success("Payment recorded.");
    router.refresh();
  });

  const needsResident = paymentType === "RENT" || paymentType === "MESS" || paymentType === "REFUND";

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (needsResident && !residentId) {
          toast.error("Select a resident.");
          return;
        }
        run({
          residentId: needsResident ? residentId : residentId || null,
          paymentType,
          amount,
          method,
          date,
          reference: reference || null,
          notes: notes || null,
          receiptImageData,
          generateReceipt: true,
        });
      }}
    >
      <div className="space-y-2">
        <Label>What is this payment for?</Label>
        <Select value={paymentType} onValueChange={setPaymentType}>
          <SelectTrigger>
            <SelectValue placeholder="Choose payment type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="RENT">Room rent</SelectItem>
            <SelectItem value="MESS">Mess / food</SelectItem>
            <SelectItem value="OTHER">Other payment</SelectItem>
            <SelectItem value="REFUND">Refund</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Which resident paid?</Label>
        <Select value={residentId} onValueChange={setResidentId}>
          <SelectTrigger>
            <SelectValue placeholder="Choose resident" />
          </SelectTrigger>
          <SelectContent>
            {residents.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
                {r.status === "LEFT" ? " (left)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="rp-amount">Amount received (Rs.)</Label>
          <Input
            id="rp-amount"
            type="number"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="rp-date">Payment date</Label>
          <Input id="rp-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
      </div>

      <div className="space-y-2 rounded-md border bg-muted/20 p-3">
        <Label htmlFor="rp-receipt">Receipt photo (optional)</Label>
        <Input
          id="rp-receipt"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) {
              setReceiptImageData(null);
              return;
            }
            if (file.size > 6_000_000) {
              toast.error("Receipt image must be smaller than 6 MB.");
              e.target.value = "";
              setReceiptImageData(null);
              return;
            }
            const reader = new FileReader();
            reader.onload = () => setReceiptImageData(typeof reader.result === "string" ? reader.result : null);
            reader.readAsDataURL(file);
          }}
        />
        <p className="text-xs text-muted-foreground">
          Take a picture or upload it. If it is unclear, the amount and date above are still saved manually.
        </p>
      </div>

      <button
        type="button"
        className="text-sm text-primary hover:underline"
        onClick={() => setShowMore((value) => !value)}
      >
        {showMore ? "Hide extra details" : "Add payment method or note"}
      </button>

      {showMore && (
        <div className="space-y-4 rounded-md border p-3">
          <div className="space-y-2">
            <Label>Payment method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rp-ref">Reference (optional)</Label>
            <Input id="rp-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Bank reference or receipt number" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rp-notes">Note (optional)</Label>
            <Input id="rp-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save payment"}
        </Button>
      </div>
    </form>
  );
}
