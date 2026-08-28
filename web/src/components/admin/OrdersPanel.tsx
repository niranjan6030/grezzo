"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Search, X } from "lucide-react";
import type { AdminOrder } from "@/lib/admin/types";
import { useAdmin } from "./AdminProvider";
import { StatusPill } from "./Dashboard";
import { Button, Card, Empty, Input, PanelHead, Select, rupees, shortDate } from "./ui";

const FILTERS = ["all", "created", "paid", "cod_pending", "shipped",
                 "delivered", "refunded", "failed"] as const;

/** What an order is allowed to become next. Mirrors the API guard so the UI
 *  never offers a move the server will reject. */
const NEXT: Record<string, AdminOrder["status"][]> = {
  created: ["cancelled"],
  paid: ["shipped", "refunded", "cancelled"],
  cod_pending: ["shipped", "cancelled"],
  shipped: ["delivered", "refunded", "cancelled"],
  delivered: ["refunded"],
};

export default function OrdersPanel() {
  const { orders, loading, setOrderStatus } = useAdmin();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<AdminOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (filter !== "all" && o.status !== filter) return false;
      if (!needle) return true;
      return [o.receipt, o.email, o.pincode, o.razorpayPaymentId, ...o.lines.map((l) => l.name)]
        .filter(Boolean).join(" ").toLowerCase().includes(needle);
    });
  }, [orders, filter, q]);

  const move = async (o: AdminOrder, status: AdminOrder["status"]) => {
    setBusy(true);
    setError(null);
    try {
      await setOrderStatus(o.id, status);
      setOpen({ ...o, status });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PanelHead title="Transactions"
                 sub="Every checkout, paid or not. An abandoned one still held stock, so it is worth watching." />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-56">
          <Search size={15} strokeWidth={1.4}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} className="pl-9"
                 placeholder="Search email, receipt, payment id, product" />
        </div>
        <Select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}
                className="w-auto">
          {FILTERS.map((f) => (
            <option key={f} value={f}>{f === "all" ? "All statuses" : f.replace("_", " ")}</option>
          ))}
        </Select>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="animate-spin text-denim-mid" strokeWidth={1.25} />
        </div>
      ) : rows.length === 0 ? (
        <Card><Empty>No transactions match.</Empty></Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[0.6rem] uppercase tracking-[0.16em] text-ink-soft">
                <th className="px-5 py-3.5 font-normal">Placed</th>
                <th className="px-5 py-3.5 font-normal">Customer</th>
                <th className="px-5 py-3.5 font-normal">Items</th>
                <th className="px-5 py-3.5 text-right font-normal">Total</th>
                <th className="px-5 py-3.5 font-normal">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((o) => (
                <tr key={o.id} onClick={() => { setOpen(o); setError(null); }}
                    className="cursor-pointer transition-colors hover:bg-denim-wash/60">
                  <td className="whitespace-nowrap px-5 py-3.5 text-ink-soft">{shortDate(o.createdAt)}</td>
                  <td className="px-5 py-3.5">
                    <span className="block">{o.email ?? "—"}</span>
                    <span className="text-xs text-ink-soft">{o.receipt}</span>
                  </td>
                  <td className="px-5 py-3.5 text-ink-soft">
                    {o.lines.reduce((n, l) => n + l.qty, 0)}
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums">{rupees(o.totalPaise)}</td>
                  <td className="px-5 py-3.5"><StatusPill status={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* ---- detail drawer ---- */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-denim-raw/30"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setOpen(null)} />
            <motion.aside
              className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white"
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex items-start justify-between border-b border-line px-6 py-5">
                <div>
                  <p className="tracked">{open.receipt}</p>
                  <p className="mt-1.5 text-xs text-ink-soft">{shortDate(open.createdAt)}</p>
                </div>
                <button onClick={() => setOpen(null)} aria-label="Close">
                  <X size={19} strokeWidth={1.3} />
                </button>
              </div>

              <div className="flex-1 space-y-7 overflow-y-auto px-6 py-6">
                <div>
                  <StatusPill status={open.status} />
                </div>

                <section>
                  <p className="tracked mb-3 text-ink-soft">Items</p>
                  <div className="divide-y divide-line">
                    {open.lines.map((l, i) => (
                      <div key={i} className="flex justify-between gap-4 py-3">
                        <div>
                          <p className="text-sm">{l.name}</p>
                          <p className="mt-0.5 text-xs text-ink-soft">
                            {l.colour.replace(/-/g, " ")} · size {l.size} · ×{l.qty}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm tabular-nums">{rupees(l.unitPaise * l.qty)}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="space-y-2 text-sm">
                  <Row k="Subtotal" v={rupees(open.subtotalPaise)} />
                  {(open.couponDiscountPaise ?? 0) > 0 && (
                    <Row k={`Coupon ${open.couponCode}`} v={`− ${rupees(open.couponDiscountPaise!)}`} />
                  )}
                  <Row k="Delivery" v={open.shippingPaise ? rupees(open.shippingPaise) : "Free"} />
                  {(open.codFeePaise ?? 0) > 0 && (
                    <Row k="Cash handling" v={rupees(open.codFeePaise!)} />
                  )}
                  <div className="topstitch my-3" />
                  <Row k="Total" v={rupees(open.totalPaise)} strong />
                </section>

                <section>
                  <p className="tracked mb-3 text-ink-soft">Details</p>
                  <div className="space-y-2 text-sm">
                    <Row k="Email" v={open.email ?? "—"} />
                    <Row k="Pincode" v={open.pincode ?? "—"} />
                    <Row k="Payment" v={open.paymentMethod?.toUpperCase() ?? "—"} />
                    {open.couponCode && (
                      <Row k="Coupon" v={`${open.couponCode} (−${rupees(open.couponDiscountPaise ?? 0)})`} />
                    )}
                    <Row k="Razorpay order" v={open.razorpayOrderId ?? "—"} />
                    <Row k="Payment id" v={open.razorpayPaymentId ?? "—"} />
                    {open.paidAt && <Row k="Paid" v={shortDate(open.paidAt)} />}
                  </div>
                </section>
              </div>

              <div className="border-t border-line px-6 py-5">
                {error && <p className="mb-3 text-sm text-red-700">{error}</p>}
                <div className="flex flex-wrap gap-2">
                  {(NEXT[open.status] ?? []).map((s) => (
                    <Button key={s} disabled={busy}
                            variant={s === "refunded" || s === "cancelled" ? "danger" : "solid"}
                            onClick={() => move(open, s)}>
                      Mark {s}
                    </Button>
                  ))}
                  {(NEXT[open.status] ?? []).length === 0 && (
                    <p className="text-sm text-ink-soft">No further action available.</p>
                  )}
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-ink-soft">{k}</span>
      <span className={`truncate text-right ${strong ? "text-base" : ""}`}>{v}</span>
    </div>
  );
}
