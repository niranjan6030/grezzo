import "server-only";

import { readAdminData } from "./store";
import { getAdminSupabase } from "@/lib/supabase/server";

/** Transactions, from whichever backend is holding them. Postgres is the
 *  record once Supabase is connected; before that the local store is. */
export async function loadOrders(limit = 400) {
  const db = getAdminSupabase();
  if (!db) return (await readAdminData()).orders.slice(0, limit);

  const { data, error } = await db
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[admin] could not load orders", error);
    return [];
  }

  // Every column the callers actually read. `userId` in particular: without
  // it /api/orders/mine compares undefined against the signed-in uid and a
  // shopper's own order history comes back empty forever.
  return (data ?? []).map((r) => ({
    id: String(r.id),
    receipt: String(r.receipt),
    userId: r.user_id ?? undefined,
    razorpayOrderId: r.razorpay_order_id ?? undefined,
    razorpayPaymentId: r.razorpay_payment_id ?? undefined,
    email: r.email ?? undefined,
    phone: r.phone ?? undefined,
    pincode: r.pincode ?? undefined,
    address: r.address ?? undefined,
    paymentMethod: r.payment_method ?? undefined,
    couponCode: r.coupon_code ?? undefined,
    couponDiscountPaise: Number(r.coupon_discount_paise ?? 0),
    codFeePaise: Number(r.cod_fee_paise ?? 0),
    reservationId: r.reservation_id ?? undefined,
    status: r.status,
    subtotalPaise: Number(r.subtotal_paise),
    shippingPaise: Number(r.shipping_paise),
    totalPaise: Number(r.total_paise),
    lines: r.lines ?? [],
    timeline: r.timeline ?? [],
    createdAt: String(r.created_at),
    paidAt: r.paid_at ?? undefined,
  }));
}
