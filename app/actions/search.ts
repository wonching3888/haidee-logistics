"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { parseDateInput, toDateInputValue } from "@/lib/inbound-utils";
import {
  formatPickupLocationLabel,
  resolveSessionPickupLocation,
} from "@/lib/constants/pickup-locations";

export interface SearchResultRow {
  date: string;
  shipperName: string;
  areaNote: string | null;
  pickupLocationLabel: string;
  stallCode: string;
  tongTypeCode: string;
  quantity: number;
  marketCode: string;
  truckPlate: string;
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
  fromDate: string;
  toDate: string;
  query?: string;
}): Promise<SearchResult> {
  const user = await getCurrentUser();
  if (!user) throw new Error("未登录 Unauthorized");

  const fromDate = parseDateInput(input.fromDate);
  const toDate = parseDateInput(input.toDate);
  const rangeStart = fromDate <= toDate ? fromDate : toDate;
  const rangeEnd = fromDate <= toDate ? toDate : fromDate;
  const q = input.query?.trim() ?? "";

  const sessionDateFilter = { gte: rangeStart, lte: rangeEnd };

  const baseWhere: Prisma.InboundLineWhereInput = {
    session: { date: sessionDateFilter, status: "confirmed" },
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
          {
            session: {
              pickupLocation: { contains: q, mode: "insensitive" },
            },
          },
          {
            session: {
              shipper: {
                pickupLocation: { contains: q, mode: "insensitive" },
              },
            },
          },
          { truck: { plate: { contains: q, mode: "insensitive" } } },
          {
            dispatchLines: {
              some: {
                dispatchOrder: {
                  date: sessionDateFilter,
                  status: { notIn: ["draft", "cancelled"] },
                  truck: { plate: { contains: q, mode: "insensitive" } },
                },
              },
            },
          },
        ],
      }
    : baseWhere;

  const dispatchOrderFilter = {
    date: sessionDateFilter,
    status: { notIn: ["draft", "cancelled"] },
  };

  const lines = await prisma.inboundLine.findMany({
    where,
    include: {
      session: { include: { shipper: true } },
      stall: { include: { market: true } },
      tongType: true,
      dispatchLines: {
        where: { dispatchOrder: dispatchOrderFilter },
        include: {
          dispatchOrder: { include: { truck: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: [
      { session: { date: "asc" } },
      { session: { shipper: { name: "asc" } } },
      { stall: { code: "asc" } },
      { tongType: { code: "asc" } },
    ],
  });

  let truckHeader: TruckSearchHeader | null = null;

  if (q) {
    const dispatchOrders = await prisma.dispatchOrder.findMany({
      where: {
        date: sessionDateFilter,
        status: { notIn: ["draft", "cancelled"] },
        truck: { plate: { contains: q, mode: "insensitive" } },
      },
      include: {
        truck: true,
        lines: { include: { inboundLine: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });

    if (dispatchOrders.length > 0) {
      const latest = dispatchOrders[0];
      const totalCrates = dispatchOrders.reduce(
        (sum, order) =>
          sum +
          order.lines.reduce(
            (lineSum, dl) =>
              lineSum + (dl.inboundLine.isBox ? 0 : dl.inboundLine.quantity),
            0
          ),
        0
      );
      truckHeader = {
        plate: latest.truck.plate,
        driverName: latest.driverName ?? "—",
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

  const rows: SearchResultRow[] = lines.map((line) => {
    const plate =
      line.dispatchLines[0]?.dispatchOrder.truck.plate ?? "未派车";

    return {
      date: toDateInputValue(line.session.date),
      shipperName: line.session.shipper.name,
      areaNote: line.session.areaNote,
      pickupLocationLabel: formatPickupLocationLabel(
        resolveSessionPickupLocation(
          line.session.pickupLocation,
          line.session.shipper.pickupLocation
        )
      ),
      stallCode: line.stall.code,
      tongTypeCode: line.tongType.code,
      quantity: line.quantity,
      marketCode: line.stall.market?.code ?? "—",
      truckPlate: plate,
      isBox: line.isBox,
    };
  });

  return { rows, truckHeader };
}
