"use client";

import { useRouter } from "next/navigation";
import type { SadaoHandlingRow } from "@/app/actions/thai-cost";
import type {
  PattaniHandlingRow,
  SongkhlaHandlingRow,
  ThaiDriverRow,
} from "@/app/actions/thai-cost-phase2";
import { useT } from "@/components/shared/locale-context";
import { Input } from "@/components/ui/input";
import { SadaoHandlingDayPanel } from "@/components/thai-cost/handling/SadaoHandlingDayPanel";
import { SongkhlaHandlingDayPanel } from "@/components/thai-cost/handling/SongkhlaHandlingDayPanel";
import { PattaniHandlingDayPanel } from "@/components/thai-cost/handling/PattaniHandlingDayPanel";

export function UnifiedHandlingView({
  date,
  sadaoRow,
  songkhlaRow,
  pattaniRow,
  drivers,
  canWrite,
}: {
  date: string;
  sadaoRow: SadaoHandlingRow | null;
  songkhlaRow: SongkhlaHandlingRow | null;
  pattaniRow: PattaniHandlingRow | null;
  drivers: ThaiDriverRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const { tLocal } = useT();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          <span>{tLocal("thaiCost.common.date")}</span>
          <Input
            type="date"
            className="w-44"
            value={date}
            onChange={(e) =>
              router.push(`/thai-cost/handling?date=${e.target.value}`)
            }
          />
        </label>
        <p className="text-sm text-haidee-muted">
          {tLocal("thaiCost.handling.sharedDateHint")}
        </p>
      </div>

      <SadaoHandlingDayPanel
        date={date}
        existingRow={sadaoRow}
        canWrite={canWrite}
      />
      <SongkhlaHandlingDayPanel
        date={date}
        existingRow={songkhlaRow}
        drivers={drivers}
        canWrite={canWrite}
      />
      <PattaniHandlingDayPanel
        date={date}
        existingRow={pattaniRow}
        drivers={drivers}
        canWrite={canWrite}
      />
    </div>
  );
}
