"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { addSeat, updateSeat } from "@/lib/actions/seats";
import { useAction } from "@/hooks/use-action";

type SeatFormProps = {
  roomId: string;
  seat?: { id: string; name: string; active: boolean; residentName?: string | null };
  trigger: React.ReactNode;
};

export function SeatForm({ roomId, seat, trigger }: SeatFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(seat?.name ?? "");
  const [active, setActive] = useState(seat?.active ?? true);

  const action = seat ? updateSeat : addSeat;
  const { pending, run } = useAction(action, () => {
    setOpen(false);
    router.refresh();
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(seat ? { id: seat.id, name, active } : { roomId, name });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{seat ? "Edit bed" : "Add a bed"}</DialogTitle>
          {seat ? (
            <DialogDescription>
              Current name: <span className="font-medium">{seat.name}</span>
              {seat.residentName && (
                <span className="mt-1 block text-amber-600">
                  This seat is currently assigned to {seat.residentName}.
                </span>
              )}
            </DialogDescription>
          ) : (
            <DialogDescription>
              Give this bed a simple label like A, B, 1, or Bed 1.
            </DialogDescription>
          )}
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="seat-name">Bed label</Label>
            <Input
              id="seat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Example: A or Bed 1"
              required
              autoFocus
            />
          </div>
          {seat && (
            <label className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <span>
                <span className="block text-sm font-medium">Seat available</span>
                <span className="block text-xs text-muted-foreground">
                  Turn off when this seat should not be used
                </span>
              </span>
              <Switch checked={active} onCheckedChange={setActive} />
            </label>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : seat ? "Save changes" : "Add bed"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
