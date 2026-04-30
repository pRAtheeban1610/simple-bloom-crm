import { formatDate, formatMoney } from "./format";

export async function downloadInvoicePdf({ invoice, items, customer, org }: any) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF();
  const symbol = org?.currency_symbol ?? "$";
  const taxLabel = org?.tax_label ?? "Tax";

  // Header
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(org?.name ?? "Company", 14, 20);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);
  if (org?.address) doc.text(org.address, 14, 26);
  if (org?.email) doc.text(org.email, 14, 31);
  if (org?.phone) doc.text(org.phone, 14, 36);

  doc.setTextColor(0);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", 196, 20, { align: "right" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(invoice.invoice_number, 196, 27, { align: "right" });

  // Bill to / dates
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("BILL TO", 14, 52);
  doc.text("ISSUE DATE", 130, 52);
  doc.text("DUE DATE", 170, 52);
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.text(customer?.company_name || customer?.name || "", 14, 58);
  doc.setFont("helvetica", "normal");
  let y = 63;
  if (customer?.name && customer?.company_name) { doc.text(customer.name, 14, y); y += 5; }
  if (customer?.email) { doc.text(customer.email, 14, y); y += 5; }
  if (customer?.billing_address) {
    customer.billing_address.split("\n").forEach((line: string) => { doc.text(line, 14, y); y += 5; });
  }
  if (customer?.tax_number) { doc.text(`Tax #: ${customer.tax_number}`, 14, y); y += 5; }
  doc.text(formatDate(invoice.issue_date), 130, 58);
  doc.text(formatDate(invoice.due_date), 170, 58);

  // Items
  autoTable(doc, {
    startY: Math.max(y + 5, 80),
    head: [["Description", "Qty", "Price", `${taxLabel} %`, "Disc %", "Total"]],
    body: items.map((it: any) => {
      const line = Number(it.quantity) * Number(it.unit_price);
      const afterDisc = line - line * (Number(it.discount_percent) / 100);
      const total = afterDisc + afterDisc * (Number(it.tax_percent) / 100);
      return [
        it.description,
        Number(it.quantity).toString(),
        formatMoney(it.unit_price, symbol),
        Number(it.tax_percent).toString(),
        Number(it.discount_percent).toString(),
        formatMoney(total, symbol),
      ];
    }),
    headStyles: { fillColor: [99, 102, 241], textColor: 255 },
    styles: { fontSize: 9 },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 8;
  const totals: [string, string][] = [
    ["Subtotal", formatMoney(invoice.subtotal, symbol)],
    ["Discount", `- ${formatMoney(invoice.discount_total, symbol)}`],
    [taxLabel, formatMoney(invoice.tax_total, symbol)],
  ];
  totals.forEach(([k, v], i) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(k, 140, finalY + i * 6);
    doc.text(v, 196, finalY + i * 6, { align: "right" });
  });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Total", 140, finalY + 22);
  doc.text(formatMoney(invoice.grand_total, symbol), 196, finalY + 22, { align: "right" });

  if (invoice.notes) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text("Notes", 14, finalY + 35);
    doc.setTextColor(0);
    doc.text(invoice.notes, 14, finalY + 41, { maxWidth: 120 });
  }

  doc.save(`${invoice.invoice_number}.pdf`);
}
