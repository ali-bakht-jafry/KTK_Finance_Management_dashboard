"use client";

import { Pencil, ArrowLeftRight, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EditResidentForm } from "@/components/residents/edit-resident-form";
import { TransferForm } from "@/components/residents/transfer-form";
import { CheckoutForm } from "@/components/residents/checkout-form";
import type { FloorOption } from "@/components/residents/check-in-form";

export function ResidentActions({
  resident,
  floors,
  securityHeld,
  today,
}: {
  resident: {
    id: string;
    name: string;
    phone: string | null;
    monthlyRent: number;
    monthlyMess: number;
    notes: string | null;
    status: "ACTIVE" | "LEFT";
    currentSeat: { id: string; name: string; roomName: string; floorName: string } | null;
  };
  floors: FloorOption[];
  securityHeld: number;
  today: string;
}) {
  return (
    <>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Pencil /> Edit
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit resident</DialogTitle>
            <DialogDescription>Update basic details and current rates.</DialogDescription>
          </DialogHeader>
          <EditResidentForm resident={resident} />
        </DialogContent>
      </Dialog>

      {resident.status === "ACTIVE" && (
        <>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <ArrowLeftRight /> Transfer
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Transfer resident</DialogTitle>
                <DialogDescription>Move this resident to a different vacant seat.</DialogDescription>
              </DialogHeader>
              <TransferForm resident={resident} floors={floors} today={today} />
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <LogOut /> Checkout
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Check out resident</DialogTitle>
                <DialogDescription>
                  Release the seat and settle the security deposit.
                </DialogDescription>
              </DialogHeader>
              <CheckoutForm
                resident={{ id: resident.id, name: resident.name }}
                securityHeld={securityHeld}
                today={today}
              />
            </DialogContent>
          </Dialog>
        </>
      )}
    </>
  );
}
