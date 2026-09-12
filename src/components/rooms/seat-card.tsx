"use client";

import Link from "next/link";
import { BedDouble, ExternalLink, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SeatForm } from "@/components/rooms/seat-form";
import { BookSeatForm } from "@/components/residents/book-seat-form";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { deleteSeat } from "@/lib/actions/seats";
import { formatPKR } from "@/lib/format";
import { cn } from "@/lib/utils";

export type SeatCardData = {
  id: string;
  name: string;
  active: boolean;
  residentId: string | null;
  residentName: string | null;
  monthlyRent: number | null;
  assignmentStartDate: string | null;
  financial: { paid: number; due: number; securityHeld: number } | null;
};

export function SeatCard({
  seat,
  roomId,
  defaultRent,
  today,
  canManage,
}: {
  seat: SeatCardData;
  roomId: string;
  defaultRent: number;
  today: string;
  canManage: boolean;
}) {
  const occupied = !!seat.residentId;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className={cn(
            "flex min-h-[96px] flex-col justify-between rounded-xl border p-4 text-left transition-colors hover:border-primary/50",
            occupied
              ? "border-emerald-200 bg-emerald-50/40"
              : seat.active
                ? "border-dashed bg-muted/30"
                : "border-amber-200 bg-amber-50/40",
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="font-semibold">{seat.name}</span>
            <Badge variant={occupied ? "success" : seat.active ? "outline" : "warning"}>
              {occupied ? "Booked" : seat.active ? "Vacant" : "Off"}
            </Badge>
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <BedDouble className="h-4 w-4 text-muted-foreground" />
            <span className={occupied ? "font-medium" : "text-muted-foreground"}>
              {seat.residentName ?? (seat.active ? "Available to book" : "Not in use")}
            </span>
          </div>
          {occupied && seat.financial && (
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>Paid <strong className="text-foreground">{formatPKR(seat.financial.paid)}</strong></span>
              <span>Due <strong className={seat.financial.due > 0 ? "text-destructive" : "text-foreground"}>{formatPKR(seat.financial.due)}</strong></span>
              <span className="col-span-2">Security <strong className="text-foreground">{formatPKR(seat.financial.securityHeld)}</strong></span>
            </div>
          )}
        </button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {seat.name}
            <Badge
              variant={occupied ? "success" : seat.active ? "outline" : "warning"}
              className="ml-2 align-middle"
            >
              {occupied ? "Booked" : seat.active ? "Vacant" : "Off"}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <Row label="Status" value={occupied ? "Booked" : seat.active ? "Vacant" : "Off"} />
          <Row label="Booked by" value={seat.residentName ?? "Nobody yet"} />
          <Row label="Assignment date" value={seat.assignmentStartDate ?? "—"} />
          <Row
            label="Monthly rent"
            value={seat.monthlyRent != null ? formatPKR(seat.monthlyRent) : "—"}
          />
          {seat.financial && (
            <>
              <Row label="Paid so far" value={formatPKR(seat.financial.paid)} />
              <Row label="Amount due" value={formatPKR(seat.financial.due)} />
              <Row label="Security held" value={formatPKR(seat.financial.securityHeld)} />
            </>
          )}
        </div>

        <Separator />

        <DialogFooter className="sm:justify-start">
          {occupied && seat.residentId && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/residents/${seat.residentId}`}>
                <ExternalLink className="h-4 w-4" /> View resident
              </Link>
            </Button>
          )}
          {canManage && (
            <>
              {!occupied && seat.active && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm">Book this seat</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Book vacant seat {seat.name}</DialogTitle>
                    </DialogHeader>
                    <BookSeatForm
                      seatId={seat.id}
                      seatName={seat.name}
                      today={today}
                      defaultRent={defaultRent}
                    />
                  </DialogContent>
                </Dialog>
              )}
              <SeatForm
                roomId={roomId}
                seat={{ id: seat.id, name: seat.name, active: seat.active, residentName: seat.residentName }}
                trigger={
                  <Button variant="outline" size="sm">
                    <Pencil className="h-4 w-4" /> Edit seat
                  </Button>
                }
              />
              {!occupied && seat.active && (
                <ConfirmButton
                  action={deleteSeat}
                  id={seat.id}
                  title="Delete seat"
                  description={`Delete seat "${seat.name}"? This cannot be undone.`}
                />
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
