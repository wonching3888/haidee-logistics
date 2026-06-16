-- CreateTable
CREATE TABLE "unloading_rate_configs" (
    "id" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "smallCrate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "largeCrate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "box" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kpbSmall" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kpbLarge" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kpbBox" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kpbMode" TEXT NOT NULL DEFAULT 'per_crate',
    "unloadMode" TEXT NOT NULL DEFAULT 'per_crate',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unloading_rate_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crate_loading_rate_configs" (
    "id" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "smallTruck" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "largeTruck" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crate_loading_rate_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unloading_fees" (
    "id" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "trip_date" DATE NOT NULL,
    "lorry" TEXT NOT NULL,
    "driver" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "store_code" TEXT,
    "small_crate_qty" INTEGER NOT NULL DEFAULT 0,
    "large_crate_qty" INTEGER NOT NULL DEFAULT 0,
    "box_qty" INTEGER NOT NULL DEFAULT 0,
    "unload_fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kpb_fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unload_fee_override" DOUBLE PRECISION,
    "kpb_fee_override" DOUBLE PRECISION,
    "is_kpb_exempt" BOOLEAN NOT NULL DEFAULT false,
    "trip_level_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unloading_fees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crate_loading_fees" (
    "id" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "trip_date" DATE NOT NULL,
    "lorry" TEXT NOT NULL,
    "driver" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "truck_size" TEXT NOT NULL,
    "loading_fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "loading_fee_override" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crate_loading_fees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_vouchers" (
    "id" TEXT NOT NULL,
    "voucher_no" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "trip_date" DATE NOT NULL,
    "lorry" TEXT NOT NULL,
    "driver_name" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "chop_border_amt" DOUBLE PRECISION,
    "chop_border_actual" DOUBLE PRECISION,
    "parking_amt" DOUBLE PRECISION,
    "parking_actual" DOUBLE PRECISION,
    "kpb_amt" DOUBLE PRECISION,
    "kpb_actual" DOUBLE PRECISION,
    "fish_check_amt" DOUBLE PRECISION,
    "fish_check_actual" DOUBLE PRECISION,
    "upah_turun_amt" DOUBLE PRECISION,
    "upah_turun_actual" DOUBLE PRECISION,
    "upah_naik_tong_amt" DOUBLE PRECISION,
    "upah_naik_tong_actual" DOUBLE PRECISION,
    "minyak_moto_enabled" BOOLEAN NOT NULL DEFAULT false,
    "minyak_moto_amt" DOUBLE PRECISION NOT NULL DEFAULT 8,
    "minyak_moto_actual" DOUBLE PRECISION,
    "duit_jalan" DOUBLE PRECISION,
    "belanja" DOUBLE PRECISION,
    "baki" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "unloading_rate_configs_market_key" ON "unloading_rate_configs"("market");

-- CreateIndex
CREATE UNIQUE INDEX "crate_loading_rate_configs_market_key" ON "crate_loading_rate_configs"("market");

-- CreateIndex
CREATE INDEX "unloading_fees_trip_id_idx" ON "unloading_fees"("trip_id");

-- CreateIndex
CREATE INDEX "unloading_fees_trip_date_idx" ON "unloading_fees"("trip_date");

-- CreateIndex
CREATE INDEX "crate_loading_fees_trip_id_idx" ON "crate_loading_fees"("trip_id");

-- CreateIndex
CREATE INDEX "crate_loading_fees_trip_date_idx" ON "crate_loading_fees"("trip_date");

-- CreateIndex
CREATE UNIQUE INDEX "driver_vouchers_voucher_no_key" ON "driver_vouchers"("voucher_no");

-- CreateIndex
CREATE INDEX "driver_vouchers_trip_id_idx" ON "driver_vouchers"("trip_id");

-- CreateIndex
CREATE INDEX "driver_vouchers_trip_date_idx" ON "driver_vouchers"("trip_date");
