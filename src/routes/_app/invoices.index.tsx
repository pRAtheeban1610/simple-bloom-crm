import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrg } from "@/hooks/useOrg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, FileDown, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatMoney } from "@/lib/format";
import { downloadInvoicePdf } from "@/lib/pdf";

export const Route = createFileRoute("/_app/invoices/")({
  head: () => ({ meta: [{ title: "Invoices — Ledgerly" }] }),
  component: InvoicesPage,
});

function InvoicesPage() {
  const { user } = useAuth();
  const { data: ctx } = useOrg(!!user);
  const qc = useQueryClient();
  const symbol = ctx?.org?.currency_symbol ?? "$";

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices"],
    enabled: !!ctx?.org,
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices")
        .select("*, customer:customers(id, name, company_name, customer_number, email, billing_address, tax_number)")
        .order("issue_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const filtered = useMemo(() => invoices.filter((i: any) => {
    if (status !== "all" && i.status !== status) return false;
    if (from && i.issue_date < from) return false;
    if (to && i.issue_date > to) return false;
    if (!q) return true;
    const s = q.toLowerCase();
    return [i.invoice_number, i.customer?.name, i.customer?.company_name, i.customer?.customer_number]
      .some((v: string) => v?.toLowerCase().includes(s));
  }), [invoices, q, status, from, to]);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invoices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["invoices"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); toast.success("Invoice deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  const exportCsv = () => {
    const rows = [["Invoice", "Customer", "Customer ID", "Issue date", "Due date", "Status", "Subtotal", "Tax", "Discount", "Total"]];
    for (const i of filtered) rows.push([
      i.invoice_number, i.customer?.name ?? "", i.customer?.customer_number ?? "",
      i.issue_date, i.due_date ?? "", i.status,
      i.subtotal, i.tax_total, i.discount_total, i.grand_total,
    ]);
    const csv = rows.map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `invoices-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Invoices</h2>
          <p className="text-sm text-muted-foreground">Create, send, and track every invoice.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv}><FileDown className="mr-2 h-4 w-4" /> Export CSV</Button>
          <Link to="/invoices/$id" params={{ id: "new" }}><Button><Plus className="mr-2 h-4 w-4" /> New invoice</Button></Link>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search invoice #, customer, or ID…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Invoice</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Issued</th>
                <th className="px-4 py-3 text-left">Due</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">Loading…</td></tr>}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-16 text-center text-muted-foreground">No invoices match your filters.</td></tr>
              )}
              {filtered.map((i: any) => (
                <tr key={i.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">{i.invoice_number}</td>
                  <td className="px-4 py-3 font-medium">{i.customer?.company_name || i.customer?.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(i.issue_date)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(i.due_date)}</td>
                  <td className="px-4 py-3"><span className="capitalize text-xs rounded-full border px-2 py-0.5">{i.status}</span></td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{formatMoney(i.grand_total, symbol)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="icon" title="Download PDF" onClick={async () => {
                      const { data: items } = await supabase.from("invoice_items").select("*").eq("invoice_id", i.id).order("position");
                      downloadInvoicePdf({ invoice: i, items: items ?? [], customer: i.customer, org: ctx!.org! });
                    }}><FileDown className="h-4 w-4" /></Button>
                    <Link to="/invoices/$id" params={{ id: i.id }}>
                      <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
                    </Link>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Delete ${i.invoice_number}?`)) remove.mutate(i.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
