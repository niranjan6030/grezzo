"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BadgePercent, Check, Loader2, MapPin, Tag, X } from "lucide-react";
import { colourOf, inr } from "@/lib/products";
import { PAYMENT_METHODS, lineKey } from "@/lib/types";
import { useStore } from "@/store/useStore";
import { useCheckout } from "@/store/useCheckout";
import { useCatalogue } from "@/components/CatalogueProvider";
import { useAuth } from "@/components/AuthProvider";
import { tapFeedback } from "@/lib/native";
import ProductImage from "@/components/ProductImage";

const loadRazorpay = () =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });

export default function ReviewStep() {
  const router = useRouter();
  const { user } = useAuth();
  const { byId } = useCatalogue();
  const cart = useStore((s) => s.cart);
  const deselected = useStore((s) => s.deselected);
  const clearPurchased = useStore((s) => s.clearPurchased);
  const track = useStore((s) => s.track);
  const { addressId, code, method, setCode, setMethod, reset } = useCheckout();

  // Which methods this Razorpay account can actually take. `null` means we
  // could not ask, in which case everything stays on offer rather than
  // blocking checkout on a failed lookup.
  const [available, setAvailable] = useState(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/payment-methods")
      .then((r) => r.json())
      .then((j) => alive && setAvailable(j.methods ?? null))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const methods = useMemo(
    () => PAYMENT_METHODS.filter((m) => !m.online || !available || available[m.id]),
    [available],
  );

  // The stored preference defaults to UPI and persists between visits, so a
  // shopper can arrive with a method selected that the account cannot take.
  // Checkout would then open restricted to it and dead-end inside Razorpay.
  useEffect(() => {
    if (!available) return;
    if (methods.some((m) => m.id === method)) return;
    const first = methods.find((m) => m.online) ?? methods[0];
    if (first) setMethod(first.id);
  }, [available, methods, method, setMethod]);

  const [address, setAddress] = useState(null);
  const [codeInput, setCodeInput] = useState("");
  const [bankOfferId, setBankOfferId] = useState(null);
  const [quote, setQuote] = useState(null);
  const [quoting, setQuoting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  /* The lines actually being bought — what was ticked in the bag. */
  const chosen = useMemo(
    () =>
      cart
        .filter((l) => !deselected.includes(lineKey(l)))
        .map((l) => {
          const product = byId(l.productId);
          return product ? { line: l, product, colour: colourOf(product, l.colour) } : null;
        })
        .filter((x) => x !== null),
    [cart, deselected, byId],
  );

  const payload = useMemo(() => chosen.map((c) => c.line), [chosen]);

  useEffect(() => {
    if (!addressId) return;
    fetch("/api/addresses")
      .then((r) => r.json())
      .then((j) => setAddress(j.addresses?.find((a) => a.id === addressId) ?? null))
      .catch(() => setAddress(null));
  }, [addressId]);

  useEffect(() => {
    if (payload.length === 0) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setQuoting(true);
      try {
        const res = await fetch("/api/checkout/quote", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ cart: payload, method, code }),
        });
        const json = await res.json();
        if (!cancelled) setQuote(json);
      } catch {
        if (!cancelled) setError("Could not reach the server to price your order.");
      } finally {
        if (!cancelled) setQuoting(false);
      }
    }, 140);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [payload, method, code]);

  const totals = quote?.totals;
  const codBlocked = quote?.codUnavailable ?? null;
  const selectedBankOffer =
    bankOfferId && quote?.bankOffers.some((o) => o.id === bankOfferId) ? bankOfferId : null;

  const finish = (receipt) => {
    chosen.forEach((c) => track("purchase", c.product.id));
    clearPurchased(chosen.map((c) => lineKey(c.line)));
    reset();
    tapFeedback("medium");
    router.push(`/checkout/done/${receipt}`);
  };

  const placeOrder = async () => {
    setBusy(true);
    setError(null);
    try {
      if (method === "cod") {
        const res = await fetch("/api/orders/cod", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ cart: payload, addressId, code }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Could not place the order.");
          if (data.couponRejected) setCode("");
          return;
        }
        finish(data.receipt);
        return;
      }

      const res = await fetch("/api/razorpay/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cart: payload,
          addressId,
          method,
          code,
          bankOfferId: selectedBankOffer,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Could not start checkout.");
        if (data.couponRejected) setCode("");
        return;
      }

      if (data.configured === false) {
        setError(
          "Stock is reserved and the total is confirmed, but Razorpay keys are not connected yet — see README section 3.",
        );
        return;
      }

      const ready = await loadRazorpay();
      if (!ready || !window.Razorpay) {
        setError("Could not reach Razorpay. Check your connection.");
        return;
      }

      // Indian mobile numbers are stored as ten digits; Razorpay wants them
      // in +91 form. Anything already carrying a country code is left alone.
      const e164 = (raw) => {
        const d = String(raw ?? "").replace(/\D/g, "");
        if (d.length === 10) return `+91${d}`;
        if (d.length === 12 && d.startsWith("91")) return `+${d}`;
        return d ? `+${d}` : "";
      };

      // Open Razorpay straight onto the rail already chosen, rather than
      // making someone pick a payment method twice.
      const only = (m) => ({
        upi: m === "upi",
        card: m === "card",
        netbanking: m === "netbanking",
        wallet: m === "wallet",
        paylater: m === "paylater",
        emi: m === "emi",
      });

      const rzp = new window.Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        order_id: data.orderId,
        name: "GREZZO",
        description: `${chosen.length} item${chosen.length > 1 ? "s" : ""}`,
        theme: { color: "#16233a" },
        method: only(method),
        prefill: {
          email: user?.email ?? "",
          // Razorpay's contact field wants an international number. A bare
          // ten-digit one is dropped, and the shopper is then asked to type
          // a number the shop already has on the delivery address.
          contact: e164(address?.phone ?? user?.phoneNumber),
          name: address?.name ?? user?.displayName ?? "",
        },
        handler: async (response) => {
          const v = await fetch("/api/razorpay/verify", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(response),
          }).then((r) => r.json());

          if (v.verified) finish(data.receipt);
          else
            setError(
              "We could not verify that payment. Nothing has been charged twice — contact us with your payment id.",
            );
        },
        modal: { ondismiss: () => setError("Payment cancelled. Your bag is untouched.") },
      });
      rzp.open();
    } catch {
      setError("Something went wrong placing the order.");
    } finally {
      setBusy(false);
    }
  };

  /* ---- gates ---- */
  if (payload.length === 0) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
        <p className="tracked-lg text-2xl">Nothing to review</p>
        <Link
          href="/cart"
          className="tracked mt-8 border border-denim-deep px-10 py-3.5 transition-colors hover:bg-denim-deep hover:text-white"
        >
          Back to the bag
        </Link>
      </div>
    );
  }

  if (!addressId) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
        <p className="tracked-lg text-2xl">Choose a delivery address first</p>
        <Link
          href="/checkout/address"
          className="tracked mt-8 bg-denim-deep px-10 py-3.5 text-white transition-colors hover:bg-denim-mid"
        >
          Choose address
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr]">
      <div>
        <h1 className="tracked-lg text-2xl md:text-3xl">Review your order</h1>

        {/* ---- what's in it ---- */}
        <section className="mt-8">
          <p className="tracked border-b border-line pb-3">
            {chosen.length} item{chosen.length === 1 ? "" : "s"}
          </p>
          <div className="divide-y divide-line">
            {chosen.map(({ line, product, colour }) => (
              <div key={lineKey(line)} className="flex gap-4 py-5">
                <div className="denim-weave-light w-20 shrink-0">
                  <ProductImage product={product} colour={colour} className="h-full w-full" />
                </div>
                <div className="flex flex-1 items-start justify-between gap-4">
                  <div>
                    <p className="tracked">{product.name}</p>
                    <p className="mt-1.5 text-xs text-ink-soft">
                      {product.fit} · {colour.wash} · Size {line.size} · ×{line.qty}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm tabular-nums">
                    {inr(product.pricePaise * line.qty)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ---- where it's going ---- */}
        <section className="mt-10">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <p className="tracked flex items-center gap-2">
              <MapPin size={14} strokeWidth={1.5} /> Delivery address
            </p>
            <Link href="/checkout/address" className="tracked text-ink-soft seam-link">
              Change
            </Link>
          </div>
          {address ? (
            <div className="pt-4 text-sm leading-relaxed">
              <p className="tracked">{address.label}</p>
              <p className="mt-2">{address.name}</p>
              <p className="mt-1 text-ink-soft">
                {address.line1}
                {address.line2 ? `, ${address.line2}` : ""}, {address.city}, {address.state}{" "}
                {address.pincode}
              </p>
              <p className="mt-1 text-ink-soft">{address.phone}</p>
            </div>
          ) : (
            <p className="pt-4 text-sm text-ink-soft">Loading…</p>
          )}
        </section>

        {/* ---- coupon ---- */}
        <section className="mt-10">
          <p className="tracked border-b border-line pb-3">Coupon</p>
          <div className="pt-4">
            {totals?.couponCode ? (
              <div className="flex items-start justify-between gap-3 border border-denim-deep px-4 py-3">
                <div className="min-w-0">
                  <p className="tracked flex items-center gap-2 text-denim-deep">
                    <Check size={13} strokeWidth={2} /> {totals.couponCode}
                  </p>
                  {quote?.couponNote && (
                    <p className="mt-1 text-xs text-ink-soft">{quote.couponNote}</p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setCode("");
                    setCodeInput("");
                  }}
                  aria-label="Remove code"
                  className="shrink-0 text-ink-soft hover:text-ink"
                >
                  <X size={15} strokeWidth={1.5} />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag
                    size={14}
                    strokeWidth={1.5}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft"
                  />
                  <input
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === "Enter" && setCode(codeInput.trim())}
                    placeholder="COUPON CODE"
                    className="field w-full border border-line py-3 pl-9 pr-3 outline-none focus:border-denim-deep"
                  />
                </div>
                <button
                  onClick={() => setCode(codeInput.trim())}
                  disabled={!codeInput.trim()}
                  className="tracked border border-denim-deep px-6 transition-colors hover:bg-denim-deep hover:text-white disabled:opacity-40"
                >
                  Apply
                </button>
              </div>
            )}
            {quote?.couponError && <p className="mt-2 text-xs text-red-700">{quote.couponError}</p>}
          </div>
        </section>

        {/* ---- payment ---- */}
        <section className="mt-10 scroll-mt-24" id="payment">
          <p className="tracked border-b border-line pb-3">How would you like to pay?</p>
          <div className="mt-4 space-y-2">
            {methods.map((m) => {
              const disabled = m.id === "cod" && Boolean(codBlocked);
              return (
                <label
                  key={m.id}
                  className={`flex items-start gap-3 border px-4 py-3.5 transition-colors ${
                    disabled
                      ? "cursor-not-allowed border-line opacity-45"
                      : method === m.id
                        ? "cursor-pointer border-denim-deep"
                        : "cursor-pointer border-line hover:border-denim-light"
                  }`}
                >
                  <input
                    type="radio"
                    name="method"
                    checked={method === m.id}
                    disabled={disabled}
                    onChange={() => setMethod(m.id)}
                    className="mt-1 h-4 w-4 accent-[var(--denim-deep)]"
                  />
                  <span className="min-w-0">
                    <span className="tracked block">{m.label}</span>
                    <span className="mt-0.5 block text-xs text-ink-soft">{m.note}</span>
                  </span>
                </label>
              );
            })}
          </div>
          {codBlocked && <p className="mt-2 text-xs text-ink-soft">{codBlocked}</p>}

          {/* ---- bank offers ---- */}
          {quote && quote.bankOffers.length > 0 && (
            <div className="mt-8">
              <p className="tracked mb-4 flex items-center gap-2">
                <BadgePercent size={14} strokeWidth={1.5} /> Bank offers
              </p>
              <div className="space-y-2">
                {quote.bankOffers.map((o) => (
                  <label
                    key={o.id}
                    className={`flex cursor-pointer items-start gap-3 border p-4 transition-colors ${
                      selectedBankOffer === o.id
                        ? "border-denim-deep"
                        : "border-line hover:border-denim-light"
                    }`}
                  >
                    <input
                      type="radio"
                      name="bankoffer"
                      checked={selectedBankOffer === o.id}
                      onChange={() => setBankOfferId(selectedBankOffer === o.id ? null : o.id)}
                      className="mt-1 h-4 w-4 accent-[var(--denim-deep)]"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm">{o.label}</span>
                      <span className="mt-1 block text-xs text-ink-soft">
                        {o.applicable
                          ? `About ${inr(o.estimatedPaise)} off — Razorpay checks the card and applies it at payment.`
                          : "Display only: no Razorpay Offer is linked to this yet, so it will not be applied."}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* ---- the bill ---- */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="denim-weave-light p-7">
          <p className="tracked border-b border-line pb-4">Bill</p>

          <div className="mt-4">
            <Row k="Subtotal" v={inr(totals?.subtotalPaise ?? 0)} />
            {(totals?.couponDiscountPaise ?? 0) > 0 && (
              <Row
                k={`Coupon ${totals?.couponCode}`}
                v={`− ${inr(totals.couponDiscountPaise)}`}
                good
              />
            )}
            <Row k="Delivery" v={totals?.shippingPaise ? inr(totals.shippingPaise) : "Free"} />
            {(totals?.codFeePaise ?? 0) > 0 && (
              <Row k="Cash handling" v={inr(totals.codFeePaise)} />
            )}
          </div>

          <div className="topstitch my-5" />
          <div className="flex items-baseline justify-between">
            <span className="tracked">Total</span>
            <span className="text-lg tabular-nums">
              {quoting && !totals ? "…" : inr(totals?.totalPaise ?? 0)}
            </span>
          </div>

          <button
            onClick={placeOrder}
            disabled={busy || quoting}
            className="tracked mt-7 flex w-full items-center justify-center gap-2 bg-denim-deep py-4 text-white transition-colors hover:bg-denim-mid disabled:opacity-50"
          >
            {busy ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Placing order…
              </>
            ) : method === "cod" ? (
              `Place order · ${inr(totals?.totalPaise ?? 0)}`
            ) : (
              `Pay ${inr(totals?.totalPaise ?? 0)}`
            )}
          </button>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 overflow-hidden text-xs leading-relaxed text-red-700"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <p className="mt-5 text-[0.62rem] leading-relaxed text-ink-soft">
            {method === "cod"
              ? "Nothing is charged now. Pay the courier when it arrives."
              : "Card details never reach our servers — Razorpay collects them."}
          </p>

          <Link
            href="/checkout/address"
            className="tracked mt-4 block text-center text-ink-soft seam-link"
          >
            Back to delivery
          </Link>
        </div>
      </aside>
    </div>
  );
}

function Row({ k, v, good }) {
  return (
    <div className="mt-3 flex justify-between gap-4 text-sm">
      <span className={good ? "text-denim-mid" : "text-ink-soft"}>{k}</span>
      <span className={`tabular-nums ${good ? "text-denim-mid" : ""}`}>{v}</span>
    </div>
  );
}
