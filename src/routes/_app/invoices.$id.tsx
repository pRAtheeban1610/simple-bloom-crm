import { createFileRoute, useNavigate, useParams, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrg } from "@/hooks/useOrg";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, ArrowLeft, FileDown, Printer, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { calcInvoiceTotals, formatMoney } from "@/lib/format";
import { downloadInvoicePdf } from "@/lib/pdf";

export const Route = createFileRoute("/_app/invoices/$id")({
  head: () => ({ meta: [{ title: "Invoice — Ledgerly" }] }),
  component: InvoiceEditor,
});

type Item = { id?: string; description: string; quantity: number; unit_price: number; tax_percent: number; discount_percent: number; position: number };

function InvoiceEditor() {
  const { id } = useParams({ from: "/_app/invoices/$id" });
  const isNew = id === "new";
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: ctx } = useOrg(!!user);
  const symbol = ctx?.org?.currency_symbol ?? "$";

  const [customerId, setCustomerId] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<"draft" | "pending" | "paid" | "unpaid">("draft");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Item[]>([
    { description: "", quantity: 1, unit_price: 0, tax_percent: ctx?.org?.default_tax_percent ?? 0, discount_percent: 0, position: 0 },
  ]);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const [newCustOpen, setNewCustOpen] = useState(false);
  const [newCust, setNewCust] = useState({ name: "", company_name: "", email: "", phone: "", billing_address: "", tax_number: "", status: "lead" as "lead" | "prospect" | "active" });
  const [creatingCust, setCreatingCust] = useState(false);

  const createCustomer = async () => {
    if (!newCust.name.trim()) return toast.error("Name is required");
    setCreatingCust(true);
    try {
      const { data, error } = await supabase.from("customers").insert({
        ...newCust, organization_id: ctx!.org!.id,
      } as any).select("id").single();
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["customers-min"] });
      await qc.invalidateQueries({ queryKey: ["customers"] });
      setCustomerId(data.id);
      setNewCustOpen(false);
      setNewCust({ name: "", company_name: "", email: "", phone: "", billing_address: "", tax_number: "", status: "lead" });
      toast.success("Customer added");
    } catch (e: any) { toast.error(e.message); } finally { setCreatingCust(false); }
  };

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-min"], enabled: !!ctx?.org,
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("id, name, company_name, customer_number, email, billing_address, tax_number").order("name");
      return data ?? [];
    },
  });

  useEffect(() => {
    if (isNew) return;
    (async () => {
      const { data: inv } = await supabase.from("invoices").select("*").eq("id", id).maybeSingle();
      if (!inv) return;
      setCustomerId(inv.customer_id);
      setIssueDate(inv.issue_date);
      setDueDate(inv.due_date ?? "");
      setStatus(inv.status as any);
      setNotes(inv.notes ?? "");
      const { data: its } = await supabase.from("invoice_items").select("*").eq("invoice_id", id).order("position");
      setItems((its ?? []).map((it, idx) => ({ ...it, position: idx })) as any);
    })();
  }, [id, isNew]);

  const totals = calcInvoiceTotals(items);

  const save = async () => {
    if (!customerId) return toast.error("Select a customer");
    if (items.length === 0 || !items.some(i => i.description)) return toast.error("Add at least one line item");
    setBusy(true);
    try {
      let invoiceId = isNew ? null : id;
      if (isNew) {
        const { data, error } = await supabase.from("invoices").insert({
          organization_id: ctx!.org!.id,
          customer_id: customerId,
          issue_date: issueDate,
          due_date: dueDate || null,
          status, notes,
          subtotal: totals.subtotal, tax_total: totals.tax_total,
          discount_total: totals.discount_total, grand_total: totals.grand_total,
        } as any).select("id").single();
        if (error) throw error;
        invoiceId = data.id;
      } else {
        const { error } = await supabase.from("invoices").update({
          customer_id: customerId, issue_date: issueDate, due_date: dueDate || null, status, notes,
          subtotal: totals.subtotal, tax_total: totals.tax_total,
          discount_total: totals.discount_total, grand_total: totals.grand_total,
        }).eq("id", id);
        if (error) throw error;
        await supabase.from("invoice_items").delete().eq("invoice_id", id);
      }
      const rows = items.filter(i => i.description).map((it, idx) => ({
        invoice_id: invoiceId!, description: it.description, quantity: it.quantity,
        unit_price: it.unit_price, tax_percent: it.tax_percent, discount_percent: it.discount_percent,
        position: idx,
      }));
      if (rows.length) {
        const { error: e2 } = await supabase.from("invoice_items").insert(rows);
        if (e2) throw e2;
      }
      toast.success("Invoice saved");
      navigate({ to: "/invoices" });
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const setItem = (idx: number, patch: Partial<Item>) =>
    setItems(items.map((it, i) => i === idx ? { ...it, ...patch } : it));

  const customer = customers.find((c: any) => c.id === customerId);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <Link to="/invoices" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to invoices
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Print</Button>
          {!isNew && <Button variant="outline" onClick={() => downloadInvoicePdf({
            invoice: { invoice_number: "PREVIEW", issue_date: issueDate, due_date: dueDate, status, notes, ...totals },
            items, customer, org: ctx?.org,
          })}><FileDown className="mr-2 h-4 w-4" /> PDF</Button>}
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save invoice"}</Button>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-4 p-6 md:grid-cols-4">
          <div className="space-y-2 md:col-span-2">
            <div className="flex items-center justify-between">
              <Label>Customer</Label>
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setNewCustOpen(true)}>
                <UserPlus className="mr-1 h-3.5 w-3.5" /> New customer
              </Button>
            </div>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
              <SelectContent>
                {customers.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.company_name || c.name} · {c.customer_number}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Issue date</Label>
            <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Due date</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v: any) => setStatus(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Description</th>
                <th className="px-3 py-2 text-right w-20">Qty</th>
                <th className="px-3 py-2 text-right w-32">Price</th>
                <th className="px-3 py-2 text-right w-20">{ctx?.org?.tax_label ?? "Tax"} %</th>
                <th className="px-3 py-2 text-right w-20">Disc %</th>
                <th className="px-3 py-2 text-right w-32">Total</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((it, idx) => {
                const line = it.quantity * it.unit_price;
                const afterDisc = line - line * (it.discount_percent / 100);
                const total = afterDisc + afterDisc * (it.tax_percent / 100);
                return (
                  <tr key={idx}>
                    <td className="p-2"><Input value={it.description} onChange={(e) => setItem(idx, { description: e.target.value })} placeholder="Item description" /></td>
                    <td className="p-2"><Input type="number" step="0.01" value={it.quantity} onChange={(e) => setItem(idx, { quantity: +e.target.value })} className="text-right" /></td>
                    <td className="p-2"><Input type="number" step="0.01" value={it.unit_price} onChange={(e) => setItem(idx, { unit_price: +e.target.value })} className="text-right" /></td>
                    <td className="p-2"><Input type="number" step="0.01" value={it.tax_percent} onChange={(e) => setItem(idx, { tax_percent: +e.target.value })} className="text-right" /></td>
                    <td className="p-2"><Input type="number" step="0.01" value={it.discount_percent} onChange={(e) => setItem(idx, { discount_percent: +e.target.value })} className="text-right" /></td>
                    <td className="p-2 text-right tabular-nums">{formatMoney(total, symbol)}</td>
                    <td className="p-2"><Button variant="ghost" size="icon" onClick={() => setItems(items.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4 text-destructive" /></Button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-border p-3">
          <Button variant="outline" size="sm" onClick={() => setItems([...items, { description: "", quantity: 1, unit_price: 0, tax_percent: ctx?.org?.default_tax_percent ?? 0, discount_percent: 0, position: items.length }])}>
            <Plus className="mr-2 h-4 w-4" /> Add line
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardContent className="p-5 space-y-2">
          <Label>Notes</Label>
          <Textarea rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Payment terms, thank-you note, etc." />
        </CardContent></Card>
        <Card><CardContent className="p-5 space-y-2 text-sm">
          <Row k="Subtotal" v={formatMoney(totals.subtotal, symbol)} />
          <Row k="Discount" v={`- ${formatMoney(totals.discount_total, symbol)}`} />
          <Row k={ctx?.org?.tax_label ?? "Tax"} v={formatMoney(totals.tax_total, symbol)} />
          <div className="my-2 border-t border-border" />
          <Row k={<span className="text-base font-semibold">Total</span>} v={<span className="text-base font-semibold">{formatMoney(totals.grand_total, symbol)}</span>} />
        </CardContent></Card>
      </div>

      <Dialog open={newCustOpen} onOpenChange={setNewCustOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>New customer</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Name *</Label>
              <Input value={newCust.name} onChange={(e) => setNewCust({ ...newCust, name: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Company</Label>
              <Input value={newCust.company_name} onChange={(e) => setNewCust({ ...newCust, company_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={newCust.email} onChange={(e) => setNewCust({ ...newCust, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={newCust.phone} onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Billing address</Label>
              <Textarea rows={2} value={newCust.billing_address} onChange={(e) => setNewCust({ ...newCust, billing_address: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>GST / VAT number</Label>
              <Input value={newCust.tax_number} onChange={(e) => setNewCust({ ...newCust, tax_number: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={newCust.status} onValueChange={(v: any) => setNewCust({ ...newCust, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="prospect">Prospect</SelectItem>
                  <SelectItem value="active">Active Client</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewCustOpen(false)}>Cancel</Button>
            <Button onClick={createCustomer} disabled={creatingCust}>{creatingCust ? "Adding…" : "Add customer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ k, v }: { k: React.ReactNode; v: React.ReactNode }) {
  return <div className="flex items-center justify-between"><span className="text-muted-foreground">{k}</span><span className="tabular-nums">{v}</span></div>;
}
