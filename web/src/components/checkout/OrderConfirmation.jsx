"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Package, Receipt as ReceiptIcon } from "lucide-react";
import { inr } from "@/lib/products";

import ZipCurtain, { useZipProgress } from "@/components/ZipCurtain";
import { usePrefersReducedMotion } from "@/lib/useReducedMotion";

/**
 * The order lands behind the same denim panel the site opens with — it
 * unzips to reveal the confirmation. Skippable, and skipped outright for
 * anyone who has asked for reduced motion.
 */
const DURATION = 2200;

export default function OrderConfirmation({ receipt }) {
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [showBill, setShowBill] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  const reveal = useCallback(() => setRevealed(true), []);
  const progress = useZipProgress(DURATION, !reducedMotion && !revealed, reveal);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/orders/${receipt}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? "Could not load that order.");
        if (!cancelled) setOrder(json.order);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load that order.");
      });
    return () => {
      cancelled = true;
    };
  }, [receipt]);

  const curtainUp = reducedMotion || revealed;

  return (
    <div className="relative min-h-[70vh]">
      {/* ---- the unzip ---- */}
      {!curtainUp && (
        <div className="fixed inset-0 z-[95]">
          <ZipCurtain progress={progress} />
          <button
            onClick={reveal}
            className="tracked absolute bottom-8 right-8 z-10 text-white/70 transition-colors hover:text-white"
          >
            Skip
          </button>
        </div>
      )}

      {/* ---- confirmation ---- */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={curtainUp ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto max-w-2xl py-10 text-center"
      >
        <p className="tracked text-thread">Order placed</p>
        <h1 className="tracked-lg mt-5 text-3xl leading-tight md:text-4xl">
          Thank you.
          <br />
          It is being packed.
        </h1>

        {error ? (
          <p className="mt-8 text-sm text-red-700">{error}</p>
        ) : !order ? (
          <div className="mt-10 flex justify-center">
            <Loader2 className="animate-spin text-denim-mid" strokeWidth={1.25} />
          </div>
        ) : (
          <>
            <p className="mt-6 text-sm leading-relaxed text-ink-soft">
              Order <span className="text-ink">{order.receipt}</span> ·{" "}
              {order.lines.reduce((n, l) => n + l.qty, 0)} item
              {order.lines.reduce((n, l) => n + l.qty, 0) === 1 ? "" : "s"} ·{" "}
              {inr(order.totalPaise)}
              {order.status === "cod_pending" && " to pay on delivery"}
            </p>

            {/* ---- the bill ---- */}
            <div className="mt-10 text-left">
              <button
                onClick={() => setShowBill((v) => !v)}
                className="tracked flex w-full items-center justify-between border-y border-line py-4"
              >
                <span className="flex items-center gap-2">
                  <ReceiptIcon size={14} strokeWidth={1.5} /> {showBill ? "Hide" : "View"} the bill
                </span>
                <span className="text-ink-soft">{showBill ? "−" : "+"}</span>
              </button>

              <motion.div
                initial={false}
                animate={{ height: showBill ? "auto" : 0, opacity: showBill ? 1 : 0 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <div className="py-6">
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
                      <Row
                        k={`Coupon ${order.couponCode}`}
                        v={`− ${inr(order.couponDiscountPaise)}`}
                      />
                    )}
                    <Row k="Delivery" v={order.shippingPaise ? inr(order.shippingPaise) : "Free"} />
                    {(order.codFeePaise ?? 0) > 0 && (
                      <Row k="Cash handling" v={inr(order.codFeePaise)} />
                    )}
                    <div className="topstitch my-3" />
                    <Row k="Total" v={inr(order.totalPaise)} strong />
                  </div>

                  {order.address && (
                    <div className="mt-6 text-sm leading-relaxed">
                      <p className="tracked text-ink-soft">Delivering to</p>
                      <p className="mt-2">{order.address.name}</p>
                      <p className="mt-1 text-ink-soft">
                        {order.address.line1}
                        {order.address.line2 ? `, ${order.address.line2}` : ""},{" "}
                        {order.address.city}, {order.address.state} {order.address.pincode}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                href={`/account/orders/${order.receipt}`}
                className="tracked flex items-center justify-center gap-2 bg-denim-deep px-10 py-3.5 text-white transition-colors hover:bg-denim-mid"
              >
                <Package size={15} strokeWidth={1.5} /> Track this order
              </Link>
              <Link
                href="/jeans"
                className="tracked border border-denim-deep px-10 py-3.5 transition-colors hover:bg-denim-wash"
              >
                Continue shopping
              </Link>
            </div>

            <Link
              href="/account/orders"
              className="tracked mt-6 inline-block text-ink-soft seam-link"
            >
              All your orders
            </Link>
          </>
        )}
      </motion.div>
    </div>
  );
}

function Row({ k, v, strong }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-ink-soft">{k}</span>
      <span className={`tabular-nums ${strong ? "text-base" : ""}`}>{v}</span>
    </div>
  );
}
