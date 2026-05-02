import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrg } from "@/hooks/useOrg";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney, formatDate } from "@/lib/format";
import { ArrowUpRight, Users, FileText, Wallet, Clock } from "lucide-react";
import { Link } from "@tanstack/react-router";

const DashboardCharts = lazy(() => import("@/components/DashboardCharts"));

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Ledgerly" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const { data: ctx } = useOrg(!!user);
  const symbol = ctx?.org?.currency_symbol ?? "$";

  const { data } = useQuery({
    queryKey: ["dashboard"],
    enabled: !!ctx?.org,
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const [{ count: customerCount }, { data: invoices }, { data: recentCustomers }] = await Promise.all([
        supabase.from("customers").select("*", { count: "exact", head: true }),
        supabase.from("invoices").select("id, invoice_number, status, grand_total, issue_date, due_date, customer:customers(name, company_name)").order("issue_date", { ascending: false }).limit(100),
        supabase.from("customers").select("id, name, company_name, status, customer_number, created_at").order("created_at", { ascending: false }).limit(5),
      ]);

      const all = invoices ?? [];
      const revenue = all.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.grand_total || 0), 0);
      const pending = all.filter(i => i.status === "pending" || i.status === "unpaid").reduce((s, i) => s + Number(i.grand_total || 0), 0);

      // Build last 6 months trend
      const now = new Date();
      const months: { key: string; label: string; revenue: number; count: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        months.push({ key, label: d.toLocaleString(undefined, { month: "short" }), revenue: 0, count: 0 });
      }
      for (const inv of all) {
        const d = new Date(inv.issue_date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const m = months.find(m => m.key === key);
        if (m) {
          m.count += 1;
          if (inv.status === "paid") m.revenue += Number(inv.grand_total || 0);
        }
      }

      return {
        customerCount: customerCount ?? 0,
        invoiceCount: all.length,
        revenue, pending,
        recent: all.slice(0, 6),
        recentCustomers: recentCustomers ?? [],
        months,
      };
    },
  });

  const stats = [
    { label: "Total Revenue", v: formatMoney(data?.revenue ?? 0, symbol), icon: Wallet, hint: "Paid invoices" },
    { label: "Outstanding", v: formatMoney(data?.pending ?? 0, symbol), icon: Clock, hint: "Pending + unpaid" },
    { label: "Customers", v: String(data?.customerCount ?? 0), icon: Users, hint: "Total in CRM" },
    { label: "Invoices", v: String(data?.invoiceCount ?? 0), icon: FileText, hint: "Issued" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
          <p className="text-sm text-muted-foreground">Here's what's happening with your business.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.label}</div>
                <div className="grid h-8 w-8 place-items-center rounded-md bg-accent text-accent-foreground">
                  <s.icon className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 text-2xl font-semibold tabular-nums">{s.v}</div>
              <div className="mt-1 text-xs text-muted-foreground">{s.hint}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Revenue (last 6 months)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <Suspense fallback={<Skeleton className="h-full w-full" />}>
                <DashboardCharts months={data?.months ?? []} symbol={symbol} kind="revenue" />
              </Suspense>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Invoices issued</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <Suspense fallback={<Skeleton className="h-full w-full" />}>
                <DashboardCharts months={data?.months ?? []} symbol={symbol} kind="count" />
              </Suspense>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent invoices</CardTitle>
            <Link to="/invoices" className="text-xs text-primary hover:underline inline-flex items-center gap-1">View all <ArrowUpRight className="h-3 w-3" /></Link>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {(data?.recent ?? []).length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">No invoices yet.</p>
            )}
            {data?.recent.map((i: any) => (
              <div key={i.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="text-sm font-medium">{i.invoice_number}</div>
                  <div className="text-xs text-muted-foreground">{i.customer?.company_name || i.customer?.name}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold tabular-nums">{formatMoney(i.grand_total, symbol)}</div>
                  <StatusBadge status={i.status} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent customers</CardTitle>
            <Link to="/customers" className="text-xs text-primary hover:underline inline-flex items-center gap-1">View all <ArrowUpRight className="h-3 w-3" /></Link>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {(data?.recentCustomers ?? []).length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">No customers yet.</p>
            )}
            {data?.recentCustomers.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="text-sm font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.company_name || c.customer_number}</div>
                </div>
                <div className="text-right">
                  <Badge variant="outline" className="capitalize">{c.status}</Badge>
                  <div className="mt-1 text-xs text-muted-foreground">{formatDate(c.created_at)}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant: Record<string, { cls: string; label: string }> = {
    paid: { cls: "bg-success/15 text-success border-success/30", label: "Paid" },
    pending: { cls: "bg-warning/15 text-warning-foreground border-warning/40", label: "Pending" },
    unpaid: { cls: "bg-destructive/10 text-destructive border-destructive/30", label: "Unpaid" },
    draft: { cls: "bg-muted text-muted-foreground border-border", label: "Draft" },
  };
  const v = variant[status] ?? variant.draft;
  return <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${v.cls}`}>{v.label}</span>;
}
