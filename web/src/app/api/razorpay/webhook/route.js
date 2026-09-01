import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { commitReservation, releaseReservation } from "@/lib/inventory";
import { getAdminSupabase } from "@/lib/supabase/server";
import { updateAdminData } from "@/lib/admin/store";
import { applyRedemption } from "@/lib/coupons";

const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

/** Authoritative payment state. Razorpay retries this, so every branch has to
 *  be safe to run more than once. */
export async function POST(req) {
  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";

  if (!WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Webhook secret not configured." }, { status: 503 });
  }

  const expected = crypto.createHmac("sha256", WEBHOOK_SECRET).update(raw).digest("hex");
  if (
    expected.length !== signature.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  ) {
    return NextResponse.json({ error: "Bad signature." }, { status: 401 });
  }

  const event = JSON.parse(raw);
  const orderId = event?.payload?.payment?.entity?.order_id ?? event?.payload?.order?.entity?.id;
  if (!orderId) return NextResponse.json({ ok: true });

  const db = getAdminSupabase();
  if (!db) return NextResponse.json({ ok: true });

  const { data: order } = await db
    .from("orders")
    .select("id, status, reservation_id, coupon_code, user_id")
    .eq("razorpay_order_id", orderId)
    .single();
  if (!order) return NextResponse.json({ ok: true });

  switch (event.event) {
    case "payment.captured": {
      if (order.status !== "paid") {
        await commitReservation(order.reservation_id);
        await db
          .from("orders")
          .update({
            status: "paid",
            razorpay_payment_id: event.payload.payment.entity.id,
            paid_at: new Date().toISOString(),
          })
          .eq("id", order.id);
        if (order.coupon_code) {
          // applyRedemption is keyed on the order id, so a retried webhook
          // cannot count the same redemption twice.
          await updateAdminData((draft) =>
            applyRedemption(draft, order.coupon_code, order.user_id ?? undefined, String(order.id)),
          );
        }
      }
      break;
    }
    case "payment.failed":
    case "order.paid.failed": {
      if (order.status !== "paid") {
        await releaseReservation(order.reservation_id);
        await db.from("orders").update({ status: "failed" }).eq("id", order.id);
      }
      break;
    }
    case "refund.processed": {
      await db.from("orders").update({ status: "refunded" }).eq("id", order.id);
      break;
    }
  }

  return NextResponse.json({ ok: true });
}
