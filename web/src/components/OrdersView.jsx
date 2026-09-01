"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { inr } from "@/lib/products";

import { useAuth } from "./AuthProvider";

const LABEL = {
  created: "Awaiting payment",
  paid: "Paid",
  cod_pending: "Cash on delivery",
  shipped: "Shipped",
  delivered: "Delivered",
  refunded: "Refunded",
  cancelled: "Cancelled",
  failed: "Payment failed",
  signature_failed: "Payment could not be verified",
};

export default function OrdersView() {
  const { ready, user } = useAuth();
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!ready || !user) return;
    fetch("/api/orders/mine")
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? "Could not load your orders.");
        setOrders(json.orders);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load your orders."));
  }, [ready, user]);

  if (!ready) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-denim-mid" strokeWidth={1.25} />
      </div>
    );
  }

  if (!user) {
    return (
      <section className="flex min-h-[60vh] flex-col items-center justify-center px-5 text-center">
        <h1 className="tracked-lg text-3xl">Sign in to see your orders</h1>
        <Link
          href="/account?next=/account/orders"
          className="tracked mt-10 border border-denim-deep px-10 py-3.5 transition-colors hover:bg-denim-deep hover:text-white"
        >
          Sign in
        </Link>
      </section>
    );
  }

  if (orders === null && !error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-denim-mid" strokeWidth={1.25} />
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-3xl px-5 py-16 md:px-10">
      <h1 className="tracked-lg text-3xl md:text-4xl">Your orders</h1>

      {error && <p className="mt-8 text-sm text-red-700">{error}</p>}

      {orders?.length === 0 && !error && (
        <div className="py-24 text-center">
          <p className="text-sm text-ink-soft">Nothing here yet.</p>
          <Link
            href="/jeans"
            className="tracked mt-8 inline-block border border-denim-deep px-10 py-3.5 transition-colors hover:bg-denim-deep hover:text-white"
          >
            Shop jeans
          </Link>
        </div>
      )}

      <div className="mt-10 space-y-5">
        {orders?.map((o, i) => (
          <motion.div
            key={o.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="border border-line p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="tracked">{o.receipt}</p>
                <p className="mt-1.5 text-xs text-ink-soft">
                  {new Date(o.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                  {o.paymentMethod && ` · ${o.paymentMethod.toUpperCase()}`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm tabular-nums">{inr(o.totalPaise)}</p>
                <p className="mt-1 text-[0.6rem] uppercase tracking-[0.18em] text-denim-mid">
                  {LABEL[o.status] ?? o.status}
                </p>
              </div>
            </div>

            <div className="topstitch my-5" />

            <div className="space-y-2">
              {o.lines.map((l, n) => (
                <div key={n} className="flex justify-between gap-4 text-sm">
                  <span>
                    {l.name}
                    <span className="ml-2 text-xs text-ink-soft">
                      {l.colour.replace(/-/g, " ")} · {l.size} · ×{l.qty}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-ink-soft">
                    {inr(l.unitPaise * l.qty)}
                  </span>
                </div>
              ))}
            </div>

            {(o.couponDiscountPaise ?? 0) > 0 && (
              <p className="mt-4 text-xs text-denim-mid">
                {o.couponCode} saved you {inr(o.couponDiscountPaise)}
              </p>
            )}
            {o.status === "cod_pending" && (
              <p className="mt-4 text-xs text-ink-soft">
                Pay {inr(o.totalPaise)} to the courier when it arrives.
              </p>
            )}

            <Link
              href={`/account/orders/${o.receipt}`}
              className="tracked mt-5 inline-block text-denim-mid seam-link"
            >
              Track this order
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
