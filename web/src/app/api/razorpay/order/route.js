import { NextResponse } from "next/server";
import crypto from "node:crypto";
import Razorpay from "razorpay";
import { priceCart } from "@/lib/pricing";
import { mergeCatalogue } from "@/lib/catalogue";
import { evaluateCoupon } from "@/lib/coupons";
import { reserveStock } from "@/lib/inventory";
import { readAdminData, updateAdminData } from "@/lib/admin/store";
import { loadOrders } from "@/lib/admin/orders";

import { getAdminSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/firebase/admin";
import { findAddress } from "@/lib/addresses";

const KEY_ID = process.env.RAZORPAY_KEY_ID;

const NOTE_LIMIT = 250; // Razorpay's cap is 256; leave a little room

/** SKU list for the Razorpay dashboard, trimmed to fit their note limit. */
function summariseLines(lines) {
  const parts = lines.map((l) => `${l.sku}x${l.qty}`);
  let out = "";
  for (let i = 0; i < parts.length; i++) {
    const next = out ? `${out},${parts[i]}` : parts[i];
    const suffix = i < parts.length - 1 ? ` +${parts.length - i - 1} more` : "";
    if (next.length + suffix.length > NOTE_LIMIT) {
      return out ? `${out} +${parts.length - i} more` : `${parts.length} items`;
    }
    out = next;
  }
  return out;
}
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

export async function POST(req) {
  // Checkout is behind sign-in: addresses and order tracking both need an
  // identity, and a cash order with no verified account is not something to
  // hand a courier.
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const user = auth.user;

  const body = await req.json().catch(() => ({}));
  const cart = Array.isArray(body.cart) ? body.cart : [];
  const addressId = typeof body.addressId === "string" ? body.addressId : "";
  const code = typeof body.code === "string" ? body.code : "";
  const bankOfferId = typeof body.bankOfferId === "string" ? body.bankOfferId : undefined;
  const method = body.method ?? "upi";

  if (method === "cod") {
    return NextResponse.json(
      { error: "Cash on delivery is placed through /api/orders/cod." },
      { status: 400 },
    );
  }

  const data = await readAdminData();
  const catalogue = mergeCatalogue(data);

  const address = await findAddress(user.uid, addressId);
  if (!address) {
    return NextResponse.json({ error: "Choose a saved delivery address." }, { status: 400 });
  }
  const pincode = address.pincode;
  const email = user.email ?? undefined;

  const base = priceCart(cart, catalogue, { method });
  if (base.lines.length === 0) {
    return NextResponse.json({ error: "Your bag is empty." }, { status: 400 });
  }

  /* Re-validate the coupon here rather than trusting the quote the browser
     was shown. Between adding the code and paying, it can expire, hit its
     limit, or stop applying because the bag changed. */
  let coupon = null;
  if (code.trim()) {
    const orders = await loadOrders();
    const firstOrder = !orders.some(
      (o) =>
        o.userId === user.uid && ["paid", "shipped", "delivered", "cod_pending"].includes(o.status),
    );
    const verdict = evaluateCoupon(data, code, {
      lines: base.lines,
      catalogue,
      subtotalPaise: base.subtotalPaise,
      userId: user?.uid,
      firstOrder,
    });
    if (!verdict.ok) {
      return NextResponse.json({ error: verdict.reason, couponRejected: true }, { status: 409 });
    }
    coupon = {
      code: verdict.coupon.code,
      discountPaise: verdict.discountPaise,
      freeShipping: verdict.freeShipping,
    };
  }

  const totals = priceCart(cart, catalogue, { coupon, method });

  // Hold the stock before we ask anyone for money.
  const reservation = await reserveStock(totals.lines, pincode);
  if (!reservation.ok) {
    return NextResponse.json(
      { error: "Some sizes just went out of stock.", unavailable: reservation.unavailable },
      { status: 409 },
    );
  }

  const receipt = `gz_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;

  /** Every attempt is written down. An abandoned checkout is a number the
   *  merchant needs to see, not something to quietly discard. */
  const recordLocally = async (razorpayOrderId) => {
    if (getAdminSupabase()) return; // Postgres is the record
    const order = {
      id: receipt,
      receipt,
      razorpayOrderId,
      userId: user.uid,
      email,
      pincode,
      address,
      paymentMethod: method,
      couponCode: totals.couponCode ?? undefined,
      couponDiscountPaise: totals.couponDiscountPaise || undefined,
      status: "created",
      subtotalPaise: totals.subtotalPaise,
      shippingPaise: totals.shippingPaise,
      totalPaise: totals.totalPaise,
      lines: totals.lines.map((l) => ({
        productId: l.productId,
        name: l.name,
        colour: l.colour,
        size: l.size,
        qty: l.qty,
        unitPaise: l.unitPaise,
      })),
      createdAt: new Date().toISOString(),
      timeline: [{ status: "created", at: new Date().toISOString(), note: "Checkout started" }],
    };
    await updateAdminData((draft) => {
      draft.orders.unshift(order);
      draft.orders = draft.orders.slice(0, 500);
    });
  };

  if (!KEY_ID || !KEY_SECRET) {
    await recordLocally();
    // Razorpay not connected yet. Say so plainly rather than faking a payment.
    return NextResponse.json({
      configured: false,
      receipt,
      totals,
      reservationId: reservation.id,
      message:
        "Razorpay keys are not set. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to enable live payments.",
    });
  }

  // A bank offer is only real if it exists in Razorpay — they check the card,
  // we cannot. An id we do not recognise is dropped rather than guessed at.
  const bankOffer = bankOfferId
    ? data.bankOffers.find((o) => o.id === bankOfferId && o.active && o.razorpayOfferId)
    : undefined;

  try {
    const rzp = new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET });
    const order = await rzp.orders.create({
      amount: totals.totalPaise,
      currency: "INR",
      receipt,
      ...(bankOffer?.razorpayOfferId ? { offer_id: bankOffer.razorpayOfferId } : {}),
      notes: {
        reservation: reservation.id,
        method,
        coupon: totals.couponCode ?? "",
        uid: user.uid,
        // Razorpay rejects any note longer than 256 characters, which a big
        // bag would sail past — and it would fail for the largest orders
        // only. The full line detail lives in our own record either way, so
        // this is a convenience label, not the source of truth.
        items: summariseLines(totals.lines),
      },
    });

    const db = getAdminSupabase();
    if (db) {
      await db.from("orders").insert({
        razorpay_order_id: order.id,
        receipt,
        user_id: user.uid,
        email: email ?? null,
        phone: address.phone,
        pincode,
        address: `${address.line1}${address.line2 ? ", " + address.line2 : ""}, ${address.city}, ${address.state} ${address.pincode}`,
        payment_method: method,
        coupon_code: totals.couponCode,
        coupon_discount_paise: totals.couponDiscountPaise,
        status: "created",
        subtotal_paise: totals.subtotalPaise,
        shipping_paise: totals.shippingPaise,
        total_paise: totals.totalPaise,
        reservation_id: reservation.id,
        lines: totals.lines,
        timeline: [{ status: "created", at: new Date().toISOString(), note: "Checkout started" }],
      });
    }
    await recordLocally(order.id);

    return NextResponse.json({
      configured: true,
      keyId: KEY_ID,
      orderId: order.id,
      amount: totals.totalPaise,
      currency: "INR",
      receipt,
      method,
      totals,
      bankOfferApplied: Boolean(bankOffer?.razorpayOfferId),
    });
  } catch (e) {
    console.error("razorpay order failed", e);
    return NextResponse.json({ error: "Could not start payment. Try again." }, { status: 502 });
  }
}
