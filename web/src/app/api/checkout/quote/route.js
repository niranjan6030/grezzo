import { NextResponse } from "next/server";
import { readAdminData } from "@/lib/admin/store";
import { mergeCatalogue } from "@/lib/catalogue";
import { evaluateCoupon, bankOfferValue, describeBankOffer, liveBankOffers } from "@/lib/coupons";
import { codUnavailableReason, priceCart } from "@/lib/pricing";
import { currentUser } from "@/lib/firebase/admin";
import { loadOrders } from "@/lib/admin/orders";

/**
 * The single place a basket is priced.
 *
 * The bag calls this to render every figure, and checkout calls the same
 * functions again before charging. There is deliberately no client-side
 * arithmetic on money — if this route says ₹4,231, that is what Razorpay
 * is asked for.
 */
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const cart = Array.isArray(body.cart) ? body.cart : [];
  const method = body.method;
  const code = typeof body.code === "string" ? body.code : "";

  const data = await readAdminData();
  const catalogue = mergeCatalogue(data);
  const base = priceCart(cart, catalogue, { method });

  const user = await currentUser();
  let firstOrder;
  if (user) {
    const orders = await loadOrders();
    firstOrder = !orders.some(
      (o) =>
        o.userId === user.uid && ["paid", "shipped", "delivered", "cod_pending"].includes(o.status),
    );
  }

  // ---- coupon ----
  let coupon = null;
  let couponError = null;
  let couponNote = null;

  if (code.trim()) {
    const verdict = evaluateCoupon(data, code, {
      lines: base.lines,
      catalogue,
      subtotalPaise: base.subtotalPaise,
      userId: user?.uid,
      firstOrder,
    });
    if (verdict.ok) {
      coupon = {
        code: verdict.coupon.code,
        discountPaise: verdict.discountPaise,
        freeShipping: verdict.freeShipping,
      };
      couponNote = verdict.coupon.description;
    } else {
      couponError = verdict.reason;
    }
  }

  const totals = priceCart(cart, catalogue, { coupon, method });

  // ---- bank offers ----
  const offers = liveBankOffers(data, totals.subtotalPaise, method).map((o) => ({
    id: o.id,
    label: describeBankOffer(o),
    bank: o.bank,
    methods: o.methods,
    estimatedPaise: bankOfferValue(o, totals.subtotalPaise),
    /** Only offers tied to a Razorpay Offer can actually be applied. */
    applicable: Boolean(o.razorpayOfferId),
  }));

  return NextResponse.json(
    {
      totals,
      couponError,
      couponNote,
      bankOffers: offers,
      codUnavailable: codUnavailableReason(totals.subtotalPaise),
      signedIn: Boolean(user),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
