"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useAdmin } from "./AdminProvider";
import { Card, Empty, PanelHead, Pill, Stat, rupees, shortDate } from "./ui";
import SetupStatus from "./SetupStatus";

const DAYS = 14;

export default function Dashboard() {
  const { loading, error, stats, orders, backend, catalogue } = useAdmin();

  /** Revenue per day for the last fortnight, for the bar chart. */
  const series = useMemo(() => {
    const buckets = new Array(DAYS).fill(0);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const startMs = start.getTime() - (DAYS - 1) * 86_400_000;

    for (const o of orders) {
      if (!["paid", "cod_pending", "shipped", "delivered"].includes(o.status)) continue;
      const idx = Math.floor((Date.parse(o.createdAt) - startMs) / 86_400_000);
      if (idx >= 0 && idx < DAYS) buckets[idx] += o.totalPaise;
    }
    return buckets.map((paise, i) => ({
      paise,
      label: new Date(startMs + i * 86_400_000).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      }),
    }));
  }, [orders]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-denim-mid" strokeWidth={1.25} />
      </div>
    );
  }
  if (error) return <p className="text-sm text-red-700">{error}</p>;
  if (!stats) return null;

  const peak = Math.max(...series.map((s) => s.paise), 1);
  const recent = orders.slice(0, 8);

  return (
    <>
      <PanelHead
        title="Overview"
        sub={`${catalogue.length} products live · storage: ${backend === "supabase" ? "Supabase Postgres" : "local file (development)"}`}
      />

      <SetupStatus />

      {backend === "file" && (
        <Card className="mb-8 border-thread/40 bg-thread/8 p-5">
          <p className="tracked flex items-center gap-2">
            <AlertTriangle size={14} strokeWidth={1.6} /> Development storage
          </p>
          <p className="mt-2.5 text-sm leading-relaxed text-ink-soft">
            Edits are saved to <code className="bg-white px-1.5 py-0.5">web/.data/admin.json</code>.
            That file is fine locally but serverless hosts have a read-only, temporary filesystem —
            connect Supabase before going live or your changes will vanish on the next deploy.
          </p>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Revenue — 24h"
          value={rupees(stats.revenueDayPaise)}
          hint={`${stats.ordersDay} order${stats.ordersDay === 1 ? "" : "s"}`}
        />
        <Stat label="Revenue — 7d" value={rupees(stats.revenueWeekPaise)} />
        <Stat
          label="Average order"
          value={rupees(stats.averageOrderPaise)}
          hint={`${stats.unitsAll} units all time`}
        />
        <Stat
          label="Abandoned checkouts"
          value={String(stats.abandoned)}
          hint="Reserved stock, never paid"
        />
      </div>

      {/* ---- revenue chart ---- */}
      <Card className="mt-8 p-6">
        <div className="flex items-end justify-between">
          <p className="tracked">Revenue, last {DAYS} days</p>
          <p className="text-sm tabular-nums">{rupees(stats.revenueAllPaise)} all time</p>
        </div>

        <div className="mt-7 flex h-40 items-end gap-1.5">
          {series.map((d, i) => (
            <div key={i} className="group relative flex-1">
              <div
                className="w-full bg-denim-deep/85 transition-all duration-500 group-hover:bg-denim-deep"
                style={{
                  height: `${Math.max((d.paise / peak) * 150, d.paise > 0 ? 3 : 1)}px`,
                  transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)",
                }}
              />
              <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 whitespace-nowrap bg-denim-raw px-2 py-1 text-[0.6rem] text-white group-hover:block">
                {d.label} · {rupees(d.paise)}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex justify-between text-[0.6rem] uppercase tracking-[0.16em] text-ink-soft">
          <span>{series[0]?.label}</span>
          <span>{series.at(-1)?.label}</span>
        </div>
      </Card>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* ---- recent transactions ---- */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <p className="tracked">Recent transactions</p>
            <Link href="/admin/orders" className="tracked seam-link text-ink-soft">
              All
            </Link>
          </div>
          {recent.length === 0 ? (
            <Empty>No transactions yet. They appear here the moment a checkout starts.</Empty>
          ) : (
            <div className="mt-5 divide-y divide-line">
              {recent.map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm">{o.email ?? o.receipt}</p>
                    <p className="mt-0.5 text-xs text-ink-soft">
                      {shortDate(o.createdAt)} · {o.lines.reduce((n, l) => n + l.qty, 0)} units
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm tabular-nums">{rupees(o.totalPaise)}</span>
                    <StatusPill status={o.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ---- stock + sellers ---- */}
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <p className="tracked">Low stock</p>
              <Link href="/admin/inventory" className="tracked seam-link text-ink-soft">
                Manage
              </Link>
            </div>
            {stats.lowStock.length === 0 ? (
              <Empty>Every size is above the reorder line.</Empty>
            ) : (
              <>
                <div className="mt-5 divide-y divide-line">
                  {stats.lowStock.slice(0, 6).map((s) => (
                    <div key={s.sku} className="flex items-center justify-between py-2.5">
                      <p className="text-sm">
                        {s.name}
                        <span className="ml-2 text-xs text-ink-soft">
                          {s.colour} · {s.size}
                        </span>
                      </p>
                      <Pill tone={s.qty === 0 ? "bad" : "warn"}>
                        {s.qty === 0 ? "Out" : `${s.qty} left`}
                      </Pill>
                    </div>
                  ))}
                </div>
                {stats.lowStockCount > 6 && (
                  <p className="mt-4 text-xs text-ink-soft">
                    {stats.lowStockCount - 6} more below the line.
                  </p>
                )}
              </>
            )}
          </Card>

          <Card className="p-6">
            <p className="tracked">Best sellers</p>
            {stats.bestSellers.length === 0 ? (
              <Empty>Nothing sold yet.</Empty>
            ) : (
              <div className="mt-5 space-y-3">
                {stats.bestSellers.map((b) => {
                  const top = stats.bestSellers[0].qty || 1;
                  return (
                    <div key={b.productId}>
                      <div className="flex justify-between text-sm">
                        <span>{b.name}</span>
                        <span className="tabular-nums text-ink-soft">{b.qty}</span>
                      </div>
                      <div className="mt-1.5 h-[3px] bg-denim-wash">
                        <div
                          className="h-full bg-denim-deep"
                          style={{ width: `${(b.qty / top) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

export function StatusPill({ status }) {
  const tone =
    status === "paid" || status === "delivered"
      ? "good"
      : status === "shipped" || status === "cod_pending"
        ? "neutral"
        : status === "created"
          ? "warn"
          : "bad";
  return <Pill tone={tone}>{status.replace("_", " ")}</Pill>;
}
