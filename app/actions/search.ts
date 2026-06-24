"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireWrite } from "@/lib/require-auth";
import { parseDateInput, toDateInputValue } from "@/lib/inbound-utils";
import {
  formatPickupLocationLabel,
  resolveSessionPickupLocation,
} from "@/lib/constants/pickup-locations";
import { SEARCH_RESULT_LIMIT } from "@/lib/search-filters";

export interface SearchInboundInput {
  fromDate: string;
  toDate: string;
  shipperId?: string;
  marketCodes?: string[];
  tongTypeId?: string;
  plate?: string;
  docNo?: string;
  keyword?: string;
}

export interface SearchResultRow {
  date: string;
  sessionNo: string | null;
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
  truncated: boolean;
}

function buildInboundLineSearchWhere(input: {
  sessionDateFilter: { gte: Date; lte: Date };
  shipperId?: string;
  marketCodes?: string[];
  tongTypeId?: string;
  plate?: string;
  docNo?: string;
  keyword?: string;
}): Prisma.InboundLineWhereInput {
  const {
    sessionDateFilter,
    shipperId,
    marketCodes,
    tongTypeId,
    plate,
    docNo,
    keyword,
  } = input;

  const dispatchOrderInRange: Prisma.DispatchOrderWhereInput = {
    date: sessionDateFilter,
    status: { notIn: ["draft", "cancelled"] },
  };

  const and: Prisma.InboundLineWhereInput[] = [
    {
      session: {
        date: sessionDateFilter,
        status: "confirmed",
      },
    },
  ];

  if (shipperId) {
    and.push({ session: { shipperId } });
  }

  if (marketCodes && marketCodes.length > 0) {
    and.push({
      stall: { market: { code: { in: marketCodes } } },
    });
  }

  if (tongTypeId) {
    and.push({ tongTypeId });
  }

  if (plate) {
    and.push({
      OR: [
        {
          session: {
            thVehiclePlate: { contains: plate, mode: "insensitive" },
          },
        },
        {
          truck: { plate: { contains: plate, mode: "insensitive" } },
        },
        {
          dispatchLines: {
            some: {
              dispatchOrder: {
                ...dispatchOrderInRange,
                truck: { plate: { contains: plate, mode: "insensitive" } },
              },
            },
          },
        },
      ],
    });
  }

  if (docNo) {
    and.push({
      OR: [
        {
          session: {
            sessionNo: { contains: docNo, mode: "insensitive" },
          },
        },
        {
          dispatchLines: {
            some: {
              dispatchOrder: {
                dispatchNo: { contains: docNo, mode: "insensitive" },
              },
            },
          },
        },
      ],
    });
  }

  if (keyword) {
    and.push({
      OR: [
        {
          session: {
            areaNote: { contains: keyword, mode: "insensitive" },
          },
        },
        {
          session: {
            pickupLocation: { contains: keyword, mode: "insensitive" },
          },
        },
        {
          stall: { code: { contains: keyword, mode: "insensitive" } },
        },
        {
          stall: { name: { contains: keyword, mode: "insensitive" } },
        },
      ],
    });
  }

  return { AND: and };
}

async function buildTruckHeader(
  plateQuery: string,
  sessionDateFilter: { gte: Date; lte: Date },
  lines: {
    isBox: boolean;
    quantity: number;
    session: { thVehiclePlate: string | null };
  }[]
): Promise<TruckSearchHeader | null> {
  const dispatchOrders = await prisma.dispatchOrder.findMany({
    where: {
      date: sessionDateFilter,
      status: { notIn: ["draft", "cancelled"] },
      truck: { plate: { contains: plateQuery, mode: "insensitive" } },
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
    return {
      plate: latest.truck.plate,
      driverName: latest.driverName ?? "—",
      totalCrates,
    };
  }

  const thPlate = lines.find((line) =>
    line.session.thVehiclePlate
      ?.toLowerCase()
      .includes(plateQuery.toLowerCase())
  )?.session.thVehiclePlate;

  if (!thPlate) return null;

  const totalCrates = lines
    .filter(
      (line) =>
        !line.isBox &&
        line.session.thVehiclePlate
          ?.toLowerCase()
          .includes(plateQuery.toLowerCase())
    )
    .reduce((sum, line) => sum + line.quantity, 0);

  return {
    plate: thPlate,
    driverName: "—",
    totalCrates,
  };
}

export async function searchInbound(
  input: SearchInboundInput
): Promise<SearchResult> {
  await requireWrite();

  const fromDate = parseDateInput(input.fromDate);
  const toDate = parseDateInput(input.toDate);
  const rangeStart = fromDate <= toDate ? fromDate : toDate;
  const rangeEnd = fromDate <= toDate ? toDate : fromDate;
  const sessionDateFilter = { gte: rangeStart, lte: rangeEnd };

  const shipperId = input.shipperId?.trim() || undefined;
  const marketCodes = input.marketCodes?.filter(Boolean);
  const tongTypeId = input.tongTypeId?.trim() || undefined;
  const plate = input.plate?.trim() || undefined;
  const docNo = input.docNo?.trim() || undefined;
  const keyword = input.keyword?.trim() || undefined;

  const where = buildInboundLineSearchWhere({
    sessionDateFilter,
    shipperId,
    marketCodes,
    tongTypeId,
    plate,
    docNo,
    keyword,
  });

  const dispatchOrderFilter: Prisma.DispatchOrderWhereInput = {
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
    take: SEARCH_RESULT_LIMIT + 1,
  });

  const truncated = lines.length > SEARCH_RESULT_LIMIT;
  const limitedLines = truncated ? lines.slice(0, SEARCH_RESULT_LIMIT) : lines;

  let truckHeader: TruckSearchHeader | null = null;
  if (plate) {
    truckHeader = await buildTruckHeader(plate, sessionDateFilter, limitedLines);
  }

  const rows: SearchResultRow[] = limitedLines.map((line) => {
    const truckPlate =
      line.dispatchLines[0]?.dispatchOrder.truck.plate ?? "未派车";

    return {
      date: toDateInputValue(line.session.date),
      sessionNo: line.session.sessionNo,
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
      truckPlate,
      isBox: line.isBox,
    };
  });

  return { rows, truckHeader, truncated };
}
