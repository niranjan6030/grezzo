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

  return (data ?? []).map((r) => ({
    id: String(r.id),
    receipt: String(r.receipt),
    razorpayOrderId: r.razorpay_order_id ?? undefined,
    razorpayPaymentId: r.razorpay_payment_id ?? undefined,
    email: r.email ?? undefined,
    pincode: r.pincode ?? undefined,
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
