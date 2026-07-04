-- Thai public holidays calendar (manual). Sundays are holiday-rate without a row here.

CREATE TABLE "thai_public_holidays" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "thai_public_holidays_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "thai_public_holidays_date_key" ON "thai_public_holidays"("date");
