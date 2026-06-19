import type { Prisma } from "@prisma/client";

/** Active tong types selectable in inbound entry, settings, export, customer stock, etc. */
export const INBOUND_VISIBLE_TONG_TYPE_WHERE: Prisma.TongTypeWhereInput = {
  active: true,
  showInInbound: true,
};

/** Active tong types for empty-crate import (includes import-only types like SKTN). */
export const CRATE_IMPORT_TONG_TYPE_WHERE: Prisma.TongTypeWhereInput = {
  active: true,
  isBox: false,
};
