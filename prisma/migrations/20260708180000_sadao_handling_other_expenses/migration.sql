-- Sadao handling: clerk-entered other expense lines per day.
CREATE TABLE "sadao_handling_other_expenses" (
    "id" UUID NOT NULL,
    "handling_daily_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "amount_thb" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sadao_handling_other_expenses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sadao_handling_other_expenses_handling_daily_id_idx" ON "sadao_handling_other_expenses"("handling_daily_id");

ALTER TABLE "sadao_handling_other_expenses" ADD CONSTRAINT "sadao_handling_other_expenses_handling_daily_id_fkey" FOREIGN KEY ("handling_daily_id") REFERENCES "sadao_crate_handling_daily"("id") ON DELETE CASCADE ON UPDATE CASCADE;
