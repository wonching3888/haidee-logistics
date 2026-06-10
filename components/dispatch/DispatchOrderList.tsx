import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { MarketBadge } from "@/components/shared/MarketBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface DispatchOrderRow {
  id: string;
  dispatchNo: string | null;
  truckPlate: string;
  driverName: string | null;
  markets: string[];
  status: string;
  totalQty: number;
  capacity: number | null;
}

interface DispatchOrderListProps {
  orders: DispatchOrderRow[];
}

export function DispatchOrderList({ orders }: DispatchOrderListProps) {
  if (orders.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-haidee-text">
        今日派车单 Today&apos;s Dispatch Orders
      </h3>
      <div className="overflow-hidden rounded-xl border border-haidee-border bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
              <TableHead>派车单号 DO No.</TableHead>
              <TableHead>车牌 Plate</TableHead>
              <TableHead>司机 Driver</TableHead>
              <TableHead>市场 Markets</TableHead>
              <TableHead className="text-right">装载 Load</TableHead>
              <TableHead>状态 Status</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-mono text-sm">
                  {o.dispatchNo ?? "—"}
                </TableCell>
                <TableCell className="font-mono">{o.truckPlate}</TableCell>
                <TableCell>{o.driverName ?? "—"}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {o.markets.map((m) => (
                      <MarketBadge key={m} code={m} />
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono">
                  {o.totalQty}
                  {o.capacity ? ` / ${o.capacity}` : ""}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className="border-haidee-green text-haidee-green"
                  >
                    {o.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={`/dispatch/${o.id}`}
                    className="text-sm text-haidee-blue hover:underline"
                  >
                    编辑 Edit
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
