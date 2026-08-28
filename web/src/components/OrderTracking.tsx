"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Loader2, MapPin, Package, Truck, Home as HomeIcon } from "lucide-react";
import { inr } from "@/lib/products";
import type { AdminOrder } from "@/lib/admin/types";
import { useAuth } from "./AuthProvider";

/* The stages a shopper cares about, in order. Statuses that end an order
   early — cancelled, refunded, failed — are shown on their own instead of
   being forced into this line. */
const STAGES = [
  { key: "placed",    label: "Order placed",  icon: Check,     hint: "We have your order" },
  { key: "confirmed", label: "Confirmed",     icon: Package,   hint: "Payment settled, picking has started" },
  { key: "shipped",   label: "Shipped",       icon: Truck,     hint: "With the courier" },
  { key: "delivered", label: "Delivered",     icon: HomeIcon,  hint: "Signed for" },
] as const;

const STAGE_OF: Record<string, number> = {
  created: 0, signature_failed: 0,
  paid: 1, cod_pending: 1,
  shipped: 2,
  delivered: 3,
};

const ENDED: Record<string, string> = {
  cancelled: "This order was cancelled.",
  refunded: "This order was refunded.",
  failed: "The payment failed, so this order was not placed.",
};

const POLL_MS = 15_000;

export default function OrderTracking({ receipt }: { receipt: string }) {
  const { ready, user } = useAuth();
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  /* Polls while the tab is open. Not a socket — for a parcel that moves a
     few times a day, a fifteen-second check is honest "live" and costs
     nothing to run. Polling pauses when the tab is hidden. */
  useEffect(() => {
    if (!ready || !user) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const res = await fetch(`/api/orders/${receipt}`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(json.error ?? "Could not load that order.");
        setOrder(json.order);
        setCheckedAt(new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit", minute: "2-digit",
        }));
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load that order.");
      } finally {
        if (!cancelled) timer = setTimeout(poll, document.hidden ? POLL_MS * 4 : POLL_MS);
      }
    };
    poll();

    const onVisible = () => { if (!document.hidden) { clearTimeout(timer); poll(); } };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ready, user, receipt]);

  if (!ready) return <Spinner />;

  if (!user) {
    return (
      <Centered>
        <p className="tracked-lg text-2xl">Sign in to track this order</p>
        <Link href={`/account?next=/account/orders/${receipt}`}
              className="tracked mt-8 bg-denim-deep px-10 py-3.5 text-white transition-colors hover:bg-denim-mid">
          Sign in
        </Link>
      </Centered>
    );
  }

  if (error && !order) {
    return (
      <Centered>
        <p className="tracked-lg text-2xl">Order not found</p>
        <p className="mt-4 max-w-sm text-sm text-ink-soft">{error}</p>
        <Link href="/account/orders"
              className="tracked mt-8 border border-denim-deep px-10 py-3.5 transition-colors hover:bg-denim-deep hover:text-white">
          Your orders
        </Link>
      </Centered>
    );
  }

  if (!order) return <Spinner />;

  const ended = ENDED[order.status];
  const stage = STAGE_OF[order.status] ?? 0;
  const units = order.lines.reduce((n, l) => n + l.qty, 0);

  return (
    <section className="mx-auto max-w-3xl px-5 py-16 md:px-10">
      <Link href="/account/orders" className="tracked text-ink-soft seam-link">← All orders</Link>

      <h1 className="tracked-lg mt-6 text-3xl md:text-4xl">{order.receipt}</h1>
      <p className="mt-3 text-sm text-ink-soft">
        Placed {new Date(order.createdAt).toLocaleDateString("en-IN", {
          day: "numeric", month: "long", year: "numeric",
        })}
        {" · "}{units} item{units === 1 ? "" : "s"}{" · "}{inr(order.totalPaise)}
        {order.paymentMethod && ` · ${order.paymentMethod.toUpperCase()}`}
      </p>

      {/* ---- progress ---- */}
      {ended ? (
        <div className="denim-weave-light mt-10 p-6">
          <p className="tracked">Closed</p>
          <p className="mt-2 text-sm text-ink-soft">{ended}</p>
        </div>
      ) : (
        <ol className="mt-12">
          {STAGES.map((s, i) => {
            const done = i < stage;
            const active = i === stage;
            const Icon = s.icon;
            const entry = order.timeline?.find((t) => (STAGE_OF[t.status] ?? -1) === i);
            return (
              <li key={s.key} className="relative flex gap-5 pb-10 last:pb-0">
                {/* connector */}
                {i < STAGES.length - 1 && (
                  <span className={`absolute left-[15px] top-8 h-full w-px ${
                    done ? "bg-denim-deep" : "bg-line"}`} />
                )}

                <motion.span
                  initial={false}
                  animate={{ scale: active ? [1, 1.08, 1] : 1 }}
                  transition={{ duration: 1.8, repeat: active ? Infinity : 0, ease: "easeInOut" }}
                  className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    done || active ? "bg-denim-deep text-white" : "border border-line text-ink-soft"}`}
                >
                  <Icon size={14} strokeWidth={1.6} />
                </motion.span>

                <div className="pt-1">
                  <p className={`tracked ${done || active ? "text-ink" : "text-ink-soft"}`}>
                    {s.label}
                  </p>
                  <p className="mt-1.5 text-sm text-ink-soft">
                    {entry?.note ?? s.hint}
                  </p>
                  {entry && (
                    <p className="mt-1 text-xs text-ink-soft">
                      {new Date(entry.at).toLocaleString("en-IN", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {checkedAt && !ended && (
        <p className="mt-2 text-xs text-ink-soft">
          Updating automatically · last checked {checkedAt}
        </p>
      )}

      {/* ---- items ---- */}
      <div className="topstitch mt-12" />
      <div className="mt-8">
        <p className="tracked mb-4">In this order</p>
        <div className="divide-y divide-line">
          {order.lines.map((l, i) => (
            <div key={i} className="flex justify-between gap-4 py-3 text-sm">
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

        <div className="mt-5 space-y-2 text-sm">
          <Row k="Subtotal" v={inr(order.subtotalPaise)} />
          {(order.couponDiscountPaise ?? 0) > 0 && (
            <Row k={`Coupon ${order.couponCode}`} v={`− ${inr(order.couponDiscountPaise!)}`} />
          )}
          <Row k="Delivery" v={order.shippingPaise ? inr(order.shippingPaise) : "Free"} />
          {(order.codFeePaise ?? 0) > 0 && <Row k="Cash handling" v={inr(order.codFeePaise!)} />}
          <div className="topstitch my-3" />
          <Row k="Total" v={inr(order.totalPaise)} strong />
        </div>
      </div>

      {order.address && (
        <div className="mt-10">
          <p className="tracked mb-3 flex items-center gap-2">
            <MapPin size={14} strokeWidth={1.5} /> Delivering to
          </p>
          <p className="text-sm">{order.address.name}</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            {order.address.line1}{order.address.line2 ? `, ${order.address.line2}` : ""},{" "}
            {order.address.city}, {order.address.state} {order.address.pincode}
          </p>
          <p className="mt-1 text-xs text-ink-soft">{order.address.phone}</p>
        </div>
      )}

      <div className="mt-12 flex flex-col gap-3 sm:flex-row">
        <Link href="/jeans"
              className="tracked border border-denim-deep px-10 py-3.5 text-center transition-colors hover:bg-denim-deep hover:text-white">
          Continue shopping
        </Link>
        <Link href="/contact"
              className="tracked px-6 py-3.5 text-center text-ink-soft seam-link">
          Something wrong? Contact us
        </Link>
      </div>
    </section>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-ink-soft">{k}</span>
      <span className={`tabular-nums ${strong ? "text-base" : ""}`}>{v}</span>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="animate-spin text-denim-mid" strokeWidth={1.25} />
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex min-h-[60vh] flex-col items-center justify-center px-5 text-center">
      {children}
    </section>
  );
}
