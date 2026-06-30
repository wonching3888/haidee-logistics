"use client";

import { useRef, useState } from "react";
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
  shippers: ShipperOption[];
  tongTypes: TongTypeOption[];
}

export function CrateExportWorkbench({
  dueToday,
  shippers,
  tongTypes,
}: CrateExportWorkbenchProps) {
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
    setPrefillToken((t) => t + 1);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="space-y-8">
      <CrateExportDueTodayPanel data={dueToday} onSelect={handleSelect} />
      <div ref={formRef}>
        <TongExportForm
          shippers={shippers}
          tongTypes={tongTypes}
          prefill={prefill}
          prefillToken={prefillToken}
          extraShipper={extraShipper}
        />
      </div>
    </div>
  );
}
