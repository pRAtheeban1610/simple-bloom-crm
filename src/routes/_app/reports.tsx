import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrg } from "@/hooks/useOrg";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { FileDown } from "lucide-react";
import { formatDate, formatMoney } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/reports")({
  head: () => ({ meta: [{ title: "Reports — Ledgerly" }] }),
  component: ReportsPage,
});

type Dataset = "invoices" | "customers";

const INVOICE_COLUMNS: { key: string; label: string; get: (row: any) => any }[] = [
  { key: "invoice_number", label: "Invoice #", get: (r) => r.invoice_number },
  { key: "customer", label: "Customer", get: (r) => r.customer?.company_name || r.customer?.name || "" },
  { key: "customer_number", label: "Customer ID", get: (r) => r.customer?.customer_number || "" },
  { key: "customer_email", label: "Email", get: (r) => r.customer?.email || "" },
  { key: "issue_date", label: "Issue date", get: (r) => r.issue_date },
  { key: "due_date", label: "Due date", get: (r) => r.due_date || "" },
  { key: "status", label: "Status", get: (r) => r.status },
  { key: "subtotal", label: "Subtotal", get: (r) => r.subtotal },
  { key: "discount_total", label: "Discount", get: (r) => r.discount_total },
  { key: "tax_total", label: "Tax", get: (r) => r.tax_total },
  { key: "grand_total", label: "Total", get: (r) => r.grand_total },
  { key: "notes", label: "Notes", get: (r) => r.notes || "" },
];

const CUSTOMER_COLUMNS: { key: string; label: string; get: (row: any) => any }[] = [
  { key: "customer_number", label: "Customer ID", get: (r) => r.customer_number },
  { key: "name", label: "Name", get: (r) => r.name },
  { key: "company_name", label: "Company", get: (r) => r.company_name || "" },
  { key: "email", label: "Email", get: (r) => r.email || "" },
  { key: "phone", label: "Phone", get: (r) => r.phone || "" },
  { key: "status", label: "Status", get: (r) => r.status },
  { key: "billing_address", label: "Billing address", get: (r) => r.billing_address || "" },
  { key: "tax_number", label: "Tax #", get: (r) => r.tax_number || "" },
  { key: "created_at", label: "Created", get: (r) => r.created_at },
];

function ReportsPage() {
  const { user } = useAuth();
  const { data: ctx } = useOrg(!!user);
  const symbol = ctx?.org?.currency_symbol ?? "$";

  const [dataset, setDataset] = useState<Dataset>("invoices");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("all");

  const allCols = dataset === "invoices" ? INVOICE_COLUMNS : CUSTOMER_COLUMNS;
  const [selected, setSelected] = useState<Record<string, boolean>>(
    () => Object.fromEntries(INVOICE_COLUMNS.map((c) => [c.key, true]))
  );

  // Reset columns when dataset changes
  const onDatasetChange = (v: Dataset) => {
    setDataset(v);
    const cols = v === "invoices" ? INVOICE_COLUMNS : CUSTOMER_COLUMNS;
    setSelected(Object.fromEntries(cols.map((c) => [c.key, true])));
    setStatus("all");
  };

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["report", dataset, from, to, status],
    enabled: !!ctx?.org,
    queryFn: async () => {
      if (dataset === "invoices") {
        let q = supabase
          .from("invoices")
          .select("*, customer:customers(id, name, company_name, customer_number, email)")
          .order("issue_date", { ascending: false });
        if (from) q = q.gte("issue_date", from);
        if (to) q = q.lte("issue_date", to);
        if (status !== "all") q = q.eq("status", status as any);
        const { data, error } = await q;
        if (error) throw error;
        return data as any[];
      } else {
        let q = supabase.from("customers").select("*").order("created_at", { ascending: false });
        if (from) q = q.gte("created_at", from);
        if (to) q = q.lte("created_at", to + "T23:59:59");
        if (status !== "all") q = q.eq("status", status as any);
        const { data, error } = await q;
        if (error) throw error;
        return data as any[];
      }
    },
  });

  const activeCols = useMemo(() => allCols.filter((c) => selected[c.key]), [allCols, selected]);

  const totals = useMemo(() => {
    if (dataset !== "invoices") return null;
    return rows.reduce(
      (acc: any, r: any) => {
        acc.subtotal += Number(r.subtotal) || 0;
        acc.tax += Number(r.tax_total) || 0;
        acc.discount += Number(r.discount_total) || 0;
        acc.grand += Number(r.grand_total) || 0;
        return acc;
      },
      { subtotal: 0, tax: 0, discount: 0, grand: 0 }
    );
  }, [rows, dataset]);

  const downloadCsv = () => {
    if (activeCols.length === 0) {
      toast.error("Select at least one column");
      return;
    }
    const header = activeCols.map((c) => c.label);
    const data = [header, ...rows.map((r: any) => activeCols.map((c) => c.get(r)))];
    const csv = data
      .map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${dataset}-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report downloaded");
  };

  const downloadJson = () => {
    const data = rows.map((r: any) =>
      Object.fromEntries(activeCols.map((c) => [c.key, c.get(r)]))
    );
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${dataset}-report-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report downloaded");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Reports</h2>
          <p className="text-sm text-muted-foreground">Filter, choose columns, and export your data.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadJson}>
            <FileDown className="mr-2 h-4 w-4" /> JSON
          </Button>
          <Button onClick={downloadCsv}>
            <FileDown className="mr-2 h-4 w-4" /> Download CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Dataset</Label>
            <Select value={dataset} onValueChange={(v) => onDatasetChange(v as Dataset)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="invoices">Invoices</SelectItem>
                <SelectItem value="customers">Customers</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {dataset === "invoices" ? (
                  <>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="prospect">Prospect</SelectItem>
                    <SelectItem value="active">Active Client</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Columns</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {allCols.map((c) => (
              <label key={c.key} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                <Checkbox
                  checked={!!selected[c.key]}
                  onCheckedChange={(v) => setSelected((s) => ({ ...s, [c.key]: !!v }))}
                />
                {c.label}
              </label>
            ))}
          </div>
          <div className="mt-3 flex gap-2 text-xs">
            <Button variant="ghost" size="sm" onClick={() => setSelected(Object.fromEntries(allCols.map((c) => [c.key, true])))}>Select all</Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected({})}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {totals && (
        <div className="grid gap-3 sm:grid-cols-4">
          <SummaryCard label="Records" value={String(rows.length)} />
          <SummaryCard label="Subtotal" value={formatMoney(totals.subtotal, symbol)} />
          <SummaryCard label="Tax" value={formatMoney(totals.tax, symbol)} />
          <SummaryCard label="Grand total" value={formatMoney(totals.grand, symbol)} />
        </div>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {activeCols.map((c) => (
                  <th key={c.key} className="px-4 py-3 text-left whitespace-nowrap">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <tr><td colSpan={activeCols.length || 1} className="px-4 py-12 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr><td colSpan={activeCols.length || 1} className="px-4 py-16 text-center text-muted-foreground">No data for the selected filters.</td></tr>
              )}
              {rows.slice(0, 100).map((r: any, i: number) => (
                <tr key={r.id || i} className="hover:bg-muted/30">
                  {activeCols.map((c) => {
                    const v = c.get(r);
                    const isMoney = ["subtotal", "discount_total", "tax_total", "grand_total"].includes(c.key);
                    const isDate = ["issue_date", "due_date", "created_at"].includes(c.key);
                    return (
                      <td key={c.key} className="px-4 py-2.5 whitespace-nowrap">
                        {isMoney ? formatMoney(v, symbol) : isDate ? formatDate(v) : String(v ?? "")}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 100 && (
            <div className="border-t p-3 text-center text-xs text-muted-foreground">
              Showing first 100 of {rows.length} rows. Download to see all.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}
