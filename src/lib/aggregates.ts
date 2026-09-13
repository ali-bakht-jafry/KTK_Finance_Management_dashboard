import "server-only";

import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Occupancy
// ---------------------------------------------------------------------------

export async function getOccupancyStats() {
  const [totalSeats, occupiedSeats, totalRooms, totalFloors, activeResidents] =
    await Promise.all([
      prisma.seat.count(),
      prisma.seat.count({ where: { currentResidentId: { not: null } } }),
      prisma.room.count(),
      prisma.floor.count(),
      prisma.resident.count({ where: { status: "ACTIVE" } }),
    ]);

  return {
    totalSeats,
    occupiedSeats,
    vacantSeats: totalSeats - occupiedSeats,
    totalRooms,
    totalFloors,
    activeResidents,
    occupancyPct: totalSeats === 0 ? 0 : occupiedSeats / totalSeats,
  };
}

export async function getActiveResidentCount(): Promise<number> {
  return prisma.resident.count({ where: { status: "ACTIVE" } });
}

export async function getFloorOccupancy() {
  const floors = await prisma.floor.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
    include: {
      rooms: { include: { seats: { select: { id: true, currentResidentId: true } } } },
    },
  });

  return floors.map((floor) => {
    const seats = floor.rooms.flatMap((r) => r.seats);
    const occupied = seats.filter((s) => s.currentResidentId).length;
    return {
      id: floor.id,
      name: floor.name,
      order: floor.order,
      rooms: floor.rooms.length,
      total: seats.length,
      occupied,
      vacant: seats.length - occupied,
      pct: seats.length === 0 ? 0 : occupied / seats.length,
    };
  });
}

// ---------------------------------------------------------------------------
// Financial summaries (all-time running totals; monthly breakdown is in reports)
// ---------------------------------------------------------------------------

export type FinancialSummary = {
  rentExpected: number;
  rentReceived: number;
  rentOutstanding: number;
  messExpected: number;
  messReceived: number;
  messOutstanding: number;
  otherIncome: number;
  refunds: number;
  totalExpenses: number;
  netOperating: number;
  securityReceived: number;
  securityRefunded: number;
  securityDeducted: number;
  securityHeld: number;
};

export async function getFinancialSummary(): Promise<FinancialSummary> {
  const [rentCharges, messCharges, paymentsByType, expenses, securityByType] = await Promise.all([
    prisma.rentCharge.aggregate({ _sum: { amount: true } }),
    prisma.messCharge.aggregate({ _sum: { amount: true } }),
    prisma.payment.groupBy({ by: ["paymentType"], _sum: { amount: true } }),
    prisma.expense.aggregate({ _sum: { amount: true } }),
    prisma.securityTransaction.groupBy({ by: ["type"], _sum: { amount: true } }),
  ]);

  const paymentTotals = Object.fromEntries(
    paymentsByType.map((row) => [row.paymentType, row._sum.amount ?? 0]),
  );
  const securityTotals = Object.fromEntries(
    securityByType.map((row) => [row.type, row._sum.amount ?? 0]),
  );

  const rentExpected = rentCharges._sum.amount ?? 0;
  const rentReceived = paymentTotals.RENT ?? 0;
  const messExpected = messCharges._sum.amount ?? 0;
  const messReceived = paymentTotals.MESS ?? 0;
  const other = paymentTotals.OTHER ?? 0;
  const refundTotal = paymentTotals.REFUND ?? 0;
  const totalExpenses = expenses._sum.amount ?? 0;
  const securityReceived = securityTotals.DEPOSIT ?? 0;
  const securityRefunded = securityTotals.REFUND ?? 0;
  const securityDeducted = securityTotals.DEDUCTION ?? 0;

  return {
    rentExpected,
    rentReceived,
    rentOutstanding: rentExpected - rentReceived,
    messExpected,
    messReceived,
    messOutstanding: messExpected - messReceived,
    otherIncome: other,
    refunds: refundTotal,
    totalExpenses,
    netOperating: rentReceived + messReceived + other - refundTotal - totalExpenses,
    securityReceived,
    securityRefunded,
    securityDeducted,
    securityHeld: securityReceived - securityRefunded - securityDeducted,
  };
}

// ---------------------------------------------------------------------------
// Resident-level balances
// ---------------------------------------------------------------------------

export type ResidentBalances = {
  rentCharged: number;
  rentPaid: number;
  rentDue: number;
  messCharged: number;
  messPaid: number;
  messDue: number;
  securityHeld: number;
  totalDue: number;
};

export type ResidentFinancials = {
  rentCharged: number;
  rentPaid: number;
  messCharged: number;
  messPaid: number;
  paid: number;
  due: number;
  securityHeld: number;
};

/**
 * Compute paid/due/security for many residents in a handful of grouped
 * aggregate queries instead of loading every resident's full charge/payment
 * history. Used by the room & floor seat grids, where we only need three
 * summary numbers per resident.
 */
export async function getBulkResidentFinancials(
  residentIds: string[],
): Promise<Map<string, ResidentFinancials>> {
  const result = new Map<string, ResidentFinancials>();
  const ids = residentIds.filter((id) => id);
  if (ids.length === 0) return result;

  const [rent, mess, payments, security] = await Promise.all([
    prisma.rentCharge.groupBy({
      by: ["residentId"],
      where: { residentId: { in: ids } },
      _sum: { amount: true },
    }),
    prisma.messCharge.groupBy({
      by: ["residentId"],
      where: { residentId: { in: ids } },
      _sum: { amount: true },
    }),
    prisma.payment.groupBy({
      by: ["residentId", "paymentType"],
      where: { residentId: { in: ids }, paymentType: { in: ["RENT", "MESS"] } },
      _sum: { amount: true },
    }),
    prisma.securityTransaction.groupBy({
      by: ["residentId", "type"],
      where: { residentId: { in: ids } },
      _sum: { amount: true },
    }),
  ]);

  const rentCharged = new Map<string, number>();
  for (const row of rent) rentCharged.set(row.residentId, row._sum.amount ?? 0);
  const messCharged = new Map<string, number>();
  for (const row of mess) messCharged.set(row.residentId, row._sum.amount ?? 0);

  const rentPaid = new Map<string, number>();
  const messPaid = new Map<string, number>();
  for (const row of payments) {
    if (!row.residentId) continue;
    const amount = row._sum.amount ?? 0;
    if (row.paymentType === "RENT") rentPaid.set(row.residentId, amount);
    else if (row.paymentType === "MESS") messPaid.set(row.residentId, amount);
  }

  const securityHeld = new Map<string, number>();
  for (const row of security) {
    const amount = row._sum.amount ?? 0;
    const held = securityHeld.get(row.residentId) ?? 0;
    securityHeld.set(
      row.residentId,
      held + (row.type === "DEPOSIT" ? amount : -amount),
    );
  }

  for (const id of ids) {
    const rc = rentCharged.get(id) ?? 0;
    const mc = messCharged.get(id) ?? 0;
    const rp = rentPaid.get(id) ?? 0;
    const mp = messPaid.get(id) ?? 0;
    result.set(id, {
      rentCharged: rc,
      rentPaid: rp,
      messCharged: mc,
      messPaid: mp,
      paid: rp + mp,
      due: Math.max(0, rc - rp) + Math.max(0, mc - mp),
      securityHeld: securityHeld.get(id) ?? 0,
    });
  }

  return result;
}

export async function getResidentBalances(residentId: string): Promise<ResidentBalances> {
  const [rentCharges, rentPaid, messCharges, messPaid, sec] = await Promise.all([
    prisma.rentCharge.aggregate({ where: { residentId }, _sum: { amount: true } }),
    prisma.payment.aggregate({
      where: { residentId, paymentType: "RENT" },
      _sum: { amount: true },
    }),
    prisma.messCharge.aggregate({ where: { residentId }, _sum: { amount: true } }),
    prisma.payment.aggregate({
      where: { residentId, paymentType: "MESS" },
      _sum: { amount: true },
    }),
    prisma.securityTransaction.groupBy({
      by: ["type"],
      where: { residentId },
      _sum: { amount: true },
    }),
  ]);

  const rentCharged = rentCharges._sum.amount ?? 0;
  const rentPaidTotal = rentPaid._sum.amount ?? 0;
  const messCharged = messCharges._sum.amount ?? 0;
  const messPaidTotal = messPaid._sum.amount ?? 0;

  const secByType: Record<string, number> = {};
  for (const row of sec) secByType[row.type] = row._sum.amount ?? 0;
  const securityHeld =
    (secByType.DEPOSIT ?? 0) - (secByType.REFUND ?? 0) - (secByType.DEDUCTION ?? 0);

  const rentDue = rentCharged - rentPaidTotal;
  const messDue = messCharged - messPaidTotal;

  return {
    rentCharged,
    rentPaid: rentPaidTotal,
    rentDue,
    messCharged,
    messPaid: messPaidTotal,
    messDue,
    securityHeld,
    totalDue: Math.max(0, rentDue) + Math.max(0, messDue),
  };
}
