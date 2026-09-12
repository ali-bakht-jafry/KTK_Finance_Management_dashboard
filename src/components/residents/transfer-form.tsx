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
import { Card, CardContent } from "@/components/ui/card";
import { transferResident } from "@/lib/actions/residents";
import { useAction } from "@/hooks/use-action";
import type { FloorOption } from "@/components/residents/check-in-form";

export function TransferForm({
  resident,
  floors,
  today,
}: {
  resident: {
    id: string;
    name: string;
    currentSeat: { id: string; name: string; roomName: string; floorName: string } | null;
  };
  floors: FloorOption[];
  today: string;
}) {
  const router = useRouter();
  const [date, setDate] = useState(today);
  const [floorId, setFloorId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [seatId, setSeatId] = useState("");

  const selectedFloor = floors.find((f) => f.id === floorId);
  const selectedRoom = selectedFloor?.rooms.find((r) => r.id === roomId);

  const { pending, run } = useAction(transferResident, () => {
    toast.success("Resident transferred.");
    router.refresh();
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!seatId) {
      toast.error("Please select a destination seat.");
      return;
    }
    run({ residentId: resident.id, newSeatId: seatId, date });
  };

  return (
    <form onSubmit={submit}>
      <Card>
        <CardContent className="space-y-4 p-6">
          <p className="text-sm text-muted-foreground">
            Transfer <span className="font-medium text-foreground">{resident.name}</span> from{" "}
            <span className="font-medium text-foreground">
              {resident.currentSeat
                ? `${resident.currentSeat.floorName} / ${resident.currentSeat.roomName} / ${resident.currentSeat.name}`
                : "—"}
            </span>{" "}
            to a vacant seat.
          </p>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="tr-date">Effective date</Label>
              <Input id="tr-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Floor</Label>
              <Select
                value={floorId}
                onValueChange={(v) => {
                  setFloorId(v);
                  setRoomId("");
                  setSeatId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select floor" />
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
              <Label>Room</Label>
              <Select
                value={roomId}
                onValueChange={(v) => {
                  setRoomId(v);
                  setSeatId("");
                }}
                disabled={!selectedFloor}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select room" />
                </SelectTrigger>
                <SelectContent>
                  {selectedFloor?.rooms.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Destination seat (vacant only)</Label>
            <Select value={seatId} onValueChange={setSeatId} disabled={!selectedRoom}>
              <SelectTrigger>
                <SelectValue placeholder="Select a vacant seat" />
              </SelectTrigger>
              <SelectContent>
                {selectedRoom?.seats
                  .filter((s) => !s.occupied && s.active)
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {selectedRoom && selectedRoom.seats.every((s) => s.occupied) && (
              <p className="text-xs text-amber-600">This room has no vacant seats.</p>
            )}
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? "Transferring…" : "Transfer resident"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
