-- Lindung 24 Jam voluntary opt-out (default false = still enrolled).
ALTER TABLE "drivers" ADD COLUMN "lindung_24_jam_opt_out" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "staff" ADD COLUMN "lindung_24_jam_opt_out" BOOLEAN NOT NULL DEFAULT false;
