import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrg } from "@/hooks/useOrg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Settings — Ledgerly" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const { data: ctx } = useOrg(!!user);
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (ctx?.org) setForm(ctx.org); }, [ctx?.org]);

  const save = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.from("organizations").update({
        name: form.name, email: form.email, phone: form.phone, address: form.address,
        tax_number: form.tax_number, currency_code: form.currency_code, currency_symbol: form.currency_symbol,
        tax_label: form.tax_label, default_tax_percent: form.default_tax_percent,
        invoice_prefix: form.invoice_prefix, customer_prefix: form.customer_prefix,
      }).eq("id", ctx!.org!.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["org"] });
      toast.success("Settings saved");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  if (!form.id) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground">Configure your company branding, currency, and tax label.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Company</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Company name"><Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Email"><Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Phone"><Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Tax / GST / VAT number"><Input value={form.tax_number ?? ""} onChange={(e) => setForm({ ...form, tax_number: e.target.value })} /></Field>
          <Field label="Address" className="md:col-span-2"><Textarea rows={2} value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Currency &amp; tax</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Field label="Currency code"><Input maxLength={3} value={form.currency_code ?? ""} onChange={(e) => setForm({ ...form, currency_code: e.target.value.toUpperCase() })} placeholder="USD" /></Field>
          <Field label="Currency symbol"><Input maxLength={3} value={form.currency_symbol ?? ""} onChange={(e) => setForm({ ...form, currency_symbol: e.target.value })} placeholder="$" /></Field>
          <Field label="Tax label"><Input value={form.tax_label ?? ""} onChange={(e) => setForm({ ...form, tax_label: e.target.value })} placeholder="GST / VAT / Tax" /></Field>
          <Field label="Default tax %"><Input type="number" step="0.01" value={form.default_tax_percent ?? 0} onChange={(e) => setForm({ ...form, default_tax_percent: +e.target.value })} /></Field>
          <Field label="Invoice prefix"><Input value={form.invoice_prefix ?? ""} onChange={(e) => setForm({ ...form, invoice_prefix: e.target.value })} /></Field>
          <Field label="Customer prefix"><Input value={form.customer_prefix ?? ""} onChange={(e) => setForm({ ...form, customer_prefix: e.target.value })} /></Field>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save settings"}</Button>
      </div>
    </div>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return <div className={`space-y-2 ${className ?? ""}`}><Label className="text-xs">{label}</Label>{children}</div>;
}
