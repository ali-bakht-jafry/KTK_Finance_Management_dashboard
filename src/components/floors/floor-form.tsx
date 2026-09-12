"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createFloor, updateFloor } from "@/lib/actions/floors";
import { useAction } from "@/hooks/use-action";

type FloorFormProps = {
  floor?: { id: string; name: string; order: number };
  suggestedOrder?: number;
  trigger: React.ReactNode;
};

export function FloorForm({ floor, suggestedOrder = 0, trigger }: FloorFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(floor?.name ?? "");
  const [order, setOrder] = useState(String(floor?.order ?? suggestedOrder));

  const action = floor ? updateFloor : createFloor;
  const { pending, run } = useAction(action, () => {
    setOpen(false);
    router.refresh();
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run({ ...(floor ? { id: floor.id } : {}), name, order: Number(order) || 0 });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{floor ? "Edit Floor" : "Add Floor"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="floor-name">Floor name</Label>
            <Input
              id="floor-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ground Floor"
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="floor-order">Display order</Label>
            <Input
              id="floor-order"
              type="number"
              value={order}
              onChange={(e) => setOrder(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Lower numbers appear first.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : floor ? "Save changes" : "Add floor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
