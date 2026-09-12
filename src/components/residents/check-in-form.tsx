"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { checkInResident } from "@/lib/actions/residents";
import { useAction } from "@/hooks/use-action";

type SeatOption = { id: string; name: string; occupied: boolean; active: boolean };
type RoomOption = { id: string; name: string; seats: SeatOption[] };
export type FloorOption = { id: string; name: string; rooms: RoomOption[] };

export function CheckInForm({
  floors,
  defaultRent,
  defaultMess,
  today,
}: {
  floors: FloorOption[];
  defaultRent: number;
  defaultMess: number;
  today: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [joiningDate, setJoiningDate] = useState(today);
  const [floorId, setFloorId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [seatId, setSeatId] = useState("");
  const [monthlyRent, setMonthlyRent] = useState(defaultRent ? String(defaultRent) : "");
  const [monthlyMess, setMonthlyMess] = useState(defaultMess ? String(defaultMess) : "");
  const [securityDeposit, setSecurityDeposit] = useState("");
  const [initialPayment, setInitialPayment] = useState("");
  const [notes, setNotes] = useState("");

  const selectedFloor = floors.find((f) => f.id === floorId);
  const selectedRoom = selectedFloor?.rooms.find((r) => r.id === roomId);

  const { pending, run } = useAction(checkInResident, (res) => {
    toast.success("Resident checked in.");
    router.push(`/residents/${res.id}`);
    router.refresh();
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!seatId) {
      toast.error("Please select a seat.");
      return;
    }
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
  };

  return (
    <form onSubmit={submit}>
      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ci-name">Full name</Label>
              <Input
                id="ci-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ci-phone">Phone (optional)</Label>
              <Input
                id="ci-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="ci-date">Joining date</Label>
              <Input
                id="ci-date"
                type="date"
                value={joiningDate}
                onChange={(e) => setJoiningDate(e.target.value)}
                required
              />
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
            <Label>Available seat</Label>
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
              <p className="text-xs text-amber-600">
                This room has no vacant seats. Choose another room.
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="ci-rent">Monthly rent (Rs.)</Label>
              <Input
                id="ci-rent"
                type="number"
                inputMode="numeric"
                value={monthlyRent}
                onChange={(e) => setMonthlyRent(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ci-mess">Monthly mess (Rs.)</Label>
              <Input
                id="ci-mess"
                type="number"
                inputMode="numeric"
                value={monthlyMess}
                onChange={(e) => setMonthlyMess(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ci-security">Security deposit (Rs.)</Label>
              <Input
                id="ci-security"
                type="number"
                inputMode="numeric"
                value={securityDeposit}
                onChange={(e) => setSecurityDeposit(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ci-initial">Initial payment (Rs., optional)</Label>
              <Input
                id="ci-initial"
                type="number"
                inputMode="numeric"
                value={initialPayment}
                onChange={(e) => setInitialPayment(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ci-notes">Notes</Label>
              <Textarea
                id="ci-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Checking in…" : "Check in"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
