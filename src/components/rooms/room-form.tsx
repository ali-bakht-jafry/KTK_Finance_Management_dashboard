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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createRoom, updateRoom } from "@/lib/actions/rooms";
import { useAction } from "@/hooks/use-action";

type RoomFormProps = {
  floors: { id: string; name: string }[];
  room?: {
    id: string;
    floorId: string;
    name: string;
    capacity: number | null;
    defaultRent: number | null;
    notes: string | null;
    active: boolean;
  };
  trigger: React.ReactNode;
};

export function RoomForm({ floors, room, trigger }: RoomFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [floorId, setFloorId] = useState(room?.floorId ?? floors[0]?.id ?? "");
  const [name, setName] = useState(room?.name ?? "");
  const [capacity, setCapacity] = useState(room?.capacity ? String(room.capacity) : "");
  const [defaultRent, setDefaultRent] = useState(
    room?.defaultRent ? String(room.defaultRent) : "",
  );
  const [notes, setNotes] = useState(room?.notes ?? "");
  const [active, setActive] = useState(room?.active ?? true);

  const action = room ? updateRoom : createRoom;
  const { pending, run } = useAction(action, () => {
    setOpen(false);
    router.refresh();
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run({
      ...(room ? { id: room.id } : {}),
      floorId,
      name,
      capacity,
      defaultRent,
      notes,
      active,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{room ? "Edit Room" : "Add new room"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Floor</Label>
            <Select value={floorId} onValueChange={setFloorId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose floor" />
              </SelectTrigger>
              <SelectContent>
                {floors.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="room-name">Room name</Label>
            <Input
              id="room-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Example: Room 101 or Block A"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="room-capacity">Seats</Label>
              <Input
                id="room-capacity"
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="room-rent">Rent</Label>
              <Input
                id="room-rent"
                type="number"
                value={defaultRent}
                onChange={(e) => setDefaultRent(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="room-notes">Notes</Label>
            <Textarea
              id="room-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Any extra details"
            />
          </div>
          <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
            <div>
              <p className="text-sm font-medium">Room active</p>
              <p className="text-xs text-muted-foreground">Turn off if not in use</p>
            </div>
            <Switch id="room-active" checked={active} onCheckedChange={setActive} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : room ? "Save changes" : "Add room"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
