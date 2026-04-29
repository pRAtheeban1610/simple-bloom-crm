export function formatMoney(amount: number | string | null | undefined, symbol = "$") {
  const n = typeof amount === "string" ? parseFloat(amount) : (amount ?? 0);
  return `${symbol}${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

export function calcInvoiceTotals(items: Array<{ quantity: number; unit_price: number; tax_percent: number; discount_percent: number }>) {
  let subtotal = 0, tax = 0, discount = 0;
  for (const it of items) {
    const line = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
    const lineDiscount = line * ((Number(it.discount_percent) || 0) / 100);
    const lineAfterDiscount = line - lineDiscount;
    const lineTax = lineAfterDiscount * ((Number(it.tax_percent) || 0) / 100);
    subtotal += line;
    discount += lineDiscount;
    tax += lineTax;
  }
  const grand = subtotal - discount + tax;
  return {
    subtotal: +subtotal.toFixed(2),
    discount_total: +discount.toFixed(2),
    tax_total: +tax.toFixed(2),
    grand_total: +grand.toFixed(2),
  };
}
