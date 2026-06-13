import type {
  CrateTypeColumn,
  PickupLocationStockSummary,
} from "@/app/actions/customerCrateStock";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface PickupLocationStockBlocksProps {
  crateTypes: CrateTypeColumn[];
  summaries: PickupLocationStockSummary[];
}

function qtyClass(qty: number) {
  return qty < 0 ? "font-mono text-red-600" : "font-mono";
}

function blockTotal(
  summary: PickupLocationStockSummary,
  crateTypes: CrateTypeColumn[]
) {
  return crateTypes.reduce(
    (sum, crateType) => sum + (summary.quantities[crateType.id] ?? 0),
    0
  );
}

export function PickupLocationStockBlocks({
  crateTypes,
  summaries,
}: PickupLocationStockBlocksProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {summaries.map((summary) => {
        const total = blockTotal(summary, crateTypes);

        return (
          <div
            key={summary.location}
            className="overflow-hidden rounded-xl border border-haidee-border bg-white"
          >
            <div className="border-b border-haidee-border bg-haidee-surface px-4 py-3">
              <h3 className="text-base font-semibold text-haidee-text">
                {summary.title}
              </h3>
              <p className="text-xs text-haidee-muted">
                各桶型库存合计 · 总计 Total:{" "}
                <span className={qtyClass(total)}>{total}</span>
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-haidee-surface/60 hover:bg-haidee-surface/60">
                    {crateTypes.map((crateType) => (
                      <TableHead
                        key={crateType.id}
                        className="text-right font-mono text-xs"
                      >
                        {crateType.code}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    {crateTypes.map((crateType) => {
                      const qty = summary.quantities[crateType.id] ?? 0;
                      return (
                        <TableCell
                          key={crateType.id}
                          className={cn("text-right", qtyClass(qty))}
                        >
                          {qty}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
