"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { parseDateInput } from "@/lib/inbound-utils";

export interface SearchResultRow {
  shipperName: string;
  areaNote: string | null;
  stallCode: string;
  tongTypeCode: string;
  quantity: number;
  marketCode: string;
  isBox: boolean;
}

export interface TruckSearchHeader {
  plate: string;
  driverName: string;
  totalCrates: number;
}

export interface SearchResult {
  rows: SearchResultRow[];
  truckHeader: TruckSearchHeader | null;
}

export async function searchInbound(input: {
  date: string;
  query?: string;
}): Promise<SearchResult> {
  const user = await getCurrentUser();
  if (!user) throw new Error("未登录 Unauthorized");

  const date = parseDateInput(input.date);
  const q = input.query?.trim() ?? "";

  const baseWhere: Prisma.InboundLineWhereInput = {
    session: { date, status: "confirmed" },
  };

  const where: Prisma.InboundLineWhereInput = q
    ? {
        ...baseWhere,
        OR: [
          {
            session: {
              shipper: { name: { contains: q, mode: "insensitive" } },
            },
          },
          { stall: { code: { contains: q, mode: "insensitive" } } },
          {
            session: {
              thVehiclePlate: { contains: q, mode: "insensitive" },
            },
          },
          { tongType: { code: { contains: q, mode: "insensitive" } } },
          { tongType: { name: { contains: q, mode: "insensitive" } } },
          {
            session: { areaNote: { contains: q, mode: "insensitive" } },
          },
          { truck: { plate: { contains: q, mode: "insensitive" } } },
          {
            dispatchLines: {
              some: {
                dispatchOrder: {
                  date,
                  status: { notIn: ["draft", "cancelled"] },
                  truck: { plate: { contains: q, mode: "insensitive" } },
                },
              },
            },
          },
        ],
      }
    : baseWhere;

  const lines = await prisma.inboundLine.findMany({
    where,
    include: {
      session: { include: { shipper: true } },
      stall: { include: { market: true } },
      tongType: true,
    },
    orderBy: [
      { session: { shipper: { name: "asc" } } },
      { stall: { code: "asc" } },
      { tongType: { code: "asc" } },
    ],
  });

  let truckHeader: TruckSearchHeader | null = null;

  if (q) {
    const dispatchOrder = await prisma.dispatchOrder.findFirst({
      where: {
        date,
        status: { notIn: ["draft", "cancelled"] },
        truck: { plate: { contains: q, mode: "insensitive" } },
      },
      include: {
        truck: true,
        lines: { include: { inboundLine: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    if (dispatchOrder) {
      const totalCrates = dispatchOrder.lines.reduce(
        (sum, dl) =>
          sum + (dl.inboundLine.isBox ? 0 : dl.inboundLine.quantity),
        0
      );
      truckHeader = {
        plate: dispatchOrder.truck.plate,
        driverName: dispatchOrder.driverName ?? "—",
        totalCrates,
      };
    } else {
      const thPlate = lines.find((line) =>
        line.session.thVehiclePlate
          ?.toLowerCase()
          .includes(q.toLowerCase())
      )?.session.thVehiclePlate;

      if (thPlate) {
        const totalCrates = lines
          .filter(
            (line) =>
              !line.isBox &&
              line.session.thVehiclePlate
                ?.toLowerCase()
                .includes(q.toLowerCase())
          )
          .reduce((sum, line) => sum + line.quantity, 0);
        truckHeader = {
          plate: thPlate,
          driverName: "—",
          totalCrates,
        };
      }
    }
  }

  const rows: SearchResultRow[] = lines.map((line) => ({
    shipperName: line.session.shipper.name,
    areaNote: line.session.areaNote,
    stallCode: line.stall.code,
    tongTypeCode: line.tongType.code,
    quantity: line.quantity,
    marketCode: line.stall.market?.code ?? "—",
    isBox: line.isBox,
  }));

  return { rows, truckHeader };
}
