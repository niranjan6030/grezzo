import "server-only";
import type { AdminOrder } from "./types";
import { readAdminData } from "./store";
import { getAdminSupabase } from "@/lib/supabase/server";

/** Transactions, from whichever backend is holding them. Postgres is the
 *  record once Supabase is connected; before that the local store is. */
export async function loadOrders(limit = 400): Promise<AdminOrder[]> {
  const db = getAdminSupabase();
  if (!db) return (await readAdminData()).orders.slice(0, limit);

  const { data, error } = await db
    .from("orders").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) {
    console.error("[admin] could not load orders", error);
    return [];
  }

  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    receipt: String(r.receipt),
    razorpayOrderId: (r.razorpay_order_id as string) ?? undefined,
    razorpayPaymentId: (r.razorpay_payment_id as string) ?? undefined,
    email: (r.email as string) ?? undefined,
    pincode: (r.pincode as string) ?? undefined,
    status: r.status as AdminOrder["status"],
    subtotalPaise: Number(r.subtotal_paise),
    shippingPaise: Number(r.shipping_paise),
    totalPaise: Number(r.total_paise),
    lines: (r.lines ?? []) as AdminOrder["lines"],
    timeline: (r.timeline ?? []) as AdminOrder["timeline"],
    createdAt: String(r.created_at),
    paidAt: (r.paid_at as string) ?? undefined,
  }));
}
