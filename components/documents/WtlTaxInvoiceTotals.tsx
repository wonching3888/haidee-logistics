interface WtlTaxInvoiceTotalsRow {
  label: string;
  amount: string;
  grand?: boolean;
}

interface WtlTaxInvoiceTotalsProps {
  rows: WtlTaxInvoiceTotalsRow[];
}

export function WtlTaxInvoiceTotals({ rows }: WtlTaxInvoiceTotalsProps) {
  return (
    <div className="mode4-tax-invoice-totals">
      {rows.map((row) => (
        <div
          key={row.label}
          className={
            row.grand
              ? "mode4-tax-total-row mode4-tax-total-row-grand"
              : "mode4-tax-total-row"
          }
        >
          <span className="mode4-tax-total-label">{row.label}</span>
          <span className="mode4-tax-total-amount-box">{row.amount}</span>
        </div>
      ))}
    </div>
  );
}
