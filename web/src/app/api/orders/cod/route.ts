import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { readAdminData, updateAdminData } from "@/lib/admin/store";
import { mergeCatalogue } from "@/lib/catalogue";
import { applyRedemption, evaluateCoupon } from "@/lib/coupons";
import { codUnavailableReason, priceCart } from "@/lib/pricing";
import { commitReservation, reserveStock } from "@/lib/inventory";
import { loadOrders } from "@/lib/admin/orders";
import type { AdminOrder } from "@/lib/admin/types";
import { getAdminSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/firebase/admin";
import { findAddress } from "@/lib/addresses";
import type { CartLine } from "@/lib/types";

/**
 * Cash on delivery.
 *
 * Nothing is charged, so there is no payment to verify — which is exactly
 * why it needs a verified identity behind it. Sign-in is required, and the
 * stock is committed straight away because the order is confirmed, just
 * unpaid.
 */
export async function POST(req: Request) {
  const auth = await requireUser();
  if ("response" in auth) {
    return auth.response;      // 401 signed out, or 503 if Firebase is unset
  }
  const user = auth.user;

  const body = await req.json().catch(() => ({}));
  const cart: CartLine[] = Array.isArray(body.cart) ? body.cart : [];
  const addressId: string = typeof body.addressId === "string" ? body.addressId : "";
  const code: string = typeof body.code === "string" ? body.code : "";

  const data = await readAdminData();

  // The address is read from the shopper's own saved book, so a request
  // cannot ship someone else's order to a new address.
  const address = await findAddress(user.uid, addressId);
  if (!address) {
    return NextResponse.json({ error: "Choose a saved delivery address." }, { status: 400 });
  }
  const pincode = address.pincode;

  const catalogue = mergeCatalogue(data);
  const base = priceCart(cart, catalogue, { method: "cod" });

  if (base.lines.length === 0) {
    return NextResponse.json({ error: "Your bag is empty." }, { status: 400 });
  }

  const blocked = codUnavailableReason(base.subtotalPaise);
  if (blocked) return NextResponse.json({ error: blocked }, { status: 409 });

  // Re-validate the coupon at placement, not at display time.
  let coupon: { code: string; discountPaise: number; freeShipping: boolean } | null = null;
  if (code.trim()) {
    const orders = await loadOrders();
    const firstOrder = !orders.some(
      (o) => o.userId === user.uid &&
        ["paid", "shipped", "delivered", "cod_pending"].includes(o.status));

    const verdict = evaluateCoupon(data, code, {
      lines: base.lines, catalogue, subtotalPaise: base.subtotalPaise,
      userId: user.uid, firstOrder,
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

  const totals = priceCart(cart, catalogue, { coupon, method: "cod" });

  const reservation = await reserveStock(totals.lines, pincode);
  if (!reservation.ok) {
    return NextResponse.json(
      { error: "Some sizes just went out of stock.", unavailable: reservation.unavailable },
      { status: 409 },
    );
  }

  // The order is confirmed the moment it is placed, so the stock leaves the
  // warehouse now rather than sitting on a hold nobody will ever settle.
  await commitReservation(reservation.id);

  const receipt = `gz_cod_${Date.now().toString(36)}_${crypto.randomBytes(3).toString("hex")}`;
  const order: AdminOrder = {
    id: receipt,
    receipt,
    userId: user.uid,
    email: user.email ?? undefined,
    pincode,
    address,
    paymentMethod: "cod",
    couponCode: totals.couponCode ?? undefined,
    couponDiscountPaise: totals.couponDiscountPaise || undefined,
    codFeePaise: totals.codFeePaise,
    status: "cod_pending",
    subtotalPaise: totals.subtotalPaise,
    shippingPaise: totals.shippingPaise,
    totalPaise: totals.totalPaise,
    lines: totals.lines.map((l) => ({
      productId: l.productId, name: l.name, colour: l.colour,
      size: l.size, qty: l.qty, unitPaise: l.unitPaise,
    })),
    createdAt: new Date().toISOString(),
    timeline: [{ status: "cod_pending", at: new Date().toISOString(), note: "Order placed" }],
  };

  const db = getAdminSupabase();
  if (db) {
    await db.from("orders").insert({
      receipt,
      user_id: user.uid,
      email: user.email ?? null,
      pincode,
      address: `${address.line1}${address.line2 ? ", " + address.line2 : ""}, ${address.city}, ${address.state} ${address.pincode}`,
      phone: address.phone,
      payment_method: "cod",
      coupon_code: totals.couponCode,
      coupon_discount_paise: totals.couponDiscountPaise,
      cod_fee_paise: totals.codFeePaise,
      status: "cod_pending",
      subtotal_paise: totals.subtotalPaise,
      shipping_paise: totals.shippingPaise,
      total_paise: totals.totalPaise,
      reservation_id: reservation.id,
      lines: totals.lines,
    });
  }

  await updateAdminData((draft) => {
    if (!db) {
      draft.orders.unshift(order);
      draft.orders = draft.orders.slice(0, 500);
    }
    if (totals.couponCode) applyRedemption(draft, totals.couponCode, user.uid, receipt);
  });

  return NextResponse.json({
    ok: true,
    receipt,
    totals,
    message: `Order ${receipt} confirmed. Pay ₹${(totals.totalPaise / 100).toLocaleString("en-IN")} to the courier on delivery.`,
  });
}
