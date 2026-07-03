"use client";

import { useRef, useState } from "react";
import { useT } from "@/components/shared/locale-context";
import type { CrateExportDueTodayData, CrateExportPrefillTarget } from "@/lib/crate-export-due-today";
import { CrateExportDueTodayPanel } from "@/components/tong/CrateExportDueTodayPanel";
import { TongExportForm } from "@/components/tong/TongExportForm";

interface ShipperOption {
  id: string;
  code: string;
  name: string;
}

interface TongTypeOption {
  id: string;
  code: string;
  name: string;
}

interface CrateExportWorkbenchProps {
  dueToday: CrateExportDueTodayData;
  dueInteractive: boolean;
  shippers: ShipperOption[];
  tongTypes: TongTypeOption[];
}

export function CrateExportWorkbench({
  dueToday,
  dueInteractive,
  shippers,
  tongTypes,
}: CrateExportWorkbenchProps) {
  const { t } = useT();
  const formRef = useRef<HTMLDivElement>(null);
  const [prefill, setPrefill] = useState<CrateExportPrefillTarget | null>(null);
  const [prefillToken, setPrefillToken] = useState(0);
  const [extraShipper, setExtraShipper] = useState<ShipperOption | null>(null);

  function handleSelect(target: CrateExportPrefillTarget) {
    const inList = shippers.some((s) => s.id === target.shipperId);
    setExtraShipper(
      inList
        ? null
        : {
            id: target.shipperId,
            code: target.shipperCode,
            name: target.shipperName,
          }
    );
    setPrefill(target);
    setPrefillToken((n) => n + 1);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="space-y-8">
      <CrateExportDueTodayPanel
        data={dueToday}
        interactive={dueInteractive}
        onSelect={dueInteractive ? handleSelect : undefined}
      />

      <section
        ref={formRef}
        className="space-y-4 rounded-xl border border-haidee-border bg-white p-4 shadow-sm"
      >
        <div>
          <h3 className="text-lg font-semibold text-haidee-text">
            {t("crateExport.newReturnTitle")}
          </h3>
          <p className="text-sm text-haidee-muted">
            {t("crateExport.newReturnHint")}
          </p>
        </div>
        <TongExportForm
          shippers={shippers}
          tongTypes={tongTypes}
          prefill={prefill}
          prefillToken={prefillToken}
          extraShipper={extraShipper}
        />
      </section>
    </div>
  );
}
