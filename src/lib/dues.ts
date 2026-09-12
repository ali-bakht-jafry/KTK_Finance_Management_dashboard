import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type DuesRow = {
  id: string;
  name: string;
  phone: string | null;
  room: string | null;
  seat: string | null;
  rentDue: number;
  messDue: number;
  totalDue: number;
};

type Filters = {
  search?: string;
  floorId?: string;
  roomId?: string;
  /** "as of" period "YYYY-MM": balances computed up to the end of that month. */
  period?: string;
};

/** Last day of a "YYYY-MM" period as a UTC-midnight Date. */
function periodEnd(period: string): Date {
  const [y, m] = period.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1, lastDay));
}

export async function getDuesList(filters: Filters = {}): Promise<DuesRow[]> {
  const where: Prisma.ResidentWhereInput = { status: "ACTIVE" };

  if (filters.search) {
    const q = filters.search.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
    ];
  }

  const residents = await prisma.resident.findMany({
    where,
    include: { currentSeat: { include: { room: { include: { floor: true } } } } },
    orderBy: { name: "asc" },
  });

  // Filter by floor/room based on the resident's current seat.
  let filtered = residents;
  if (filters.floorId || filters.roomId) {
    filtered = residents.filter((r) => {
      const room = r.currentSeat?.room;
      if (filters.roomId && room?.id !== filters.roomId) return false;
      if (filters.floorId && room?.floorId !== filters.floorId) return false;
      return true;
    });
  }

  const ids = filtered.map((r) => r.id);
  const periodFilter = filters.period ? { period: { lte: filters.period } } : {};
  const rentChargeWhere = { residentId: { in: ids }, ...periodFilter };
  const messChargeWhere = { residentId: { in: ids }, ...periodFilter };
  const paymentWhere = {
    residentId: { in: ids },
    ...(filters.period ? { date: { lte: periodEnd(filters.period) } } : {}),
  };

  const [rentCharged, rentPaid, messCharged, messPaid] = await Promise.all([
    prisma.rentCharge.groupBy({ by: ["residentId"], where: rentChargeWhere, _sum: { amount: true } }),
    prisma.payment.groupBy({
      by: ["residentId"],
      where: { ...paymentWhere, paymentType: "RENT" },
      _sum: { amount: true },
    }),
    prisma.messCharge.groupBy({ by: ["residentId"], where: messChargeWhere, _sum: { amount: true } }),
    prisma.payment.groupBy({
      by: ["residentId"],
      where: { ...paymentWhere, paymentType: "MESS" },
      _sum: { amount: true },
    }),
  ]);

  const sumMap = (
    rows: { residentId: string | null; _sum?: { amount?: number | null } }[],
  ) => {
    const map = new Map<string, number>();
    for (const r of rows) {
      if (r.residentId) map.set(r.residentId, r._sum?.amount ?? 0);
    }
    return map;
  };

  const rentChargedMap = sumMap(rentCharged);
  const rentPaidMap = sumMap(rentPaid);
  const messChargedMap = sumMap(messCharged);
  const messPaidMap = sumMap(messPaid);

  return filtered.map((r) => {
    const rentDue = (rentChargedMap.get(r.id) ?? 0) - (rentPaidMap.get(r.id) ?? 0);
    const messDue = (messChargedMap.get(r.id) ?? 0) - (messPaidMap.get(r.id) ?? 0);
    return {
      id: r.id,
      name: r.name,
      phone: r.phone,
      room: r.currentSeat?.room
        ? `${r.currentSeat.room.floor.name} / ${r.currentSeat.room.name}`
        : null,
      seat: r.currentSeat?.name ?? null,
      rentDue,
      messDue,
      totalDue: Math.max(0, rentDue) + Math.max(0, messDue),
    };
  });
}
