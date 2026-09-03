import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { commitReservation, releaseReservation } from "@/lib/inventory";
import { getAdminSupabase } from "@/lib/supabase/server";
import { updateAdminData } from "@/lib/admin/store";
import { applyRedemption } from "@/lib/coupons";

/** Move an order on AND record the step, in one statement. The database
 *  function keeps `status` and `timeline` from ever disagreeing. */
async function advance(db, id, status, note) {
  const { error } = await db.rpc("append_order_status", {
    p_order_id: id,
    p_status: status,
    p_entry: { status, at: new Date().toISOString(), note },
  });
  if (error) console.error("[orders] could not append status", status, error);
}

const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

/** Signature check on the client callback. The webhook is the authoritative
 *  confirmation; this exists so the shopper gets an answer immediately. */
export async function POST(req) {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req
    .json()
    .catch(() => ({}));

  if (!KEY_SECRET) {
    return NextResponse.json({ error: "Payments are not configured." }, { status: 503 });
  }
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ error: "Missing payment fields." }, { status: 400 });
  }

  const expected = crypto
    .createHmac("sha256", KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  const valid =
    expected.length === razorpay_signature.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(razorpay_signature));

  const db = getAdminSupabase();

  /** Keeps the local order log in step when Razorpay is live but Postgres
   *  is not connected yet. A no-op once Supabase is the record. */
  const markLocally = async (status) => {
    if (db) return null;
    const { result } = await updateAdminData((draft) => {
      const o = draft.orders.find((x) => x.razorpayOrderId === razorpay_order_id);
      if (!o) return null;
      o.status = status;
      if (status === "paid") {
        o.paidAt = new Date().toISOString();
        o.razorpayPaymentId = razorpay_payment_id;
        (o.timeline ??= []).push({
          status: "paid",
          at: o.paidAt,
          note: "Payment received",
        });
      }
      return o.id;
    });
    return result;
  };

  if (!valid) {
    if (db) {
      const { data } = await db
        .from("orders")
        .select("id, reservation_id")
        .eq("razorpay_order_id", razorpay_order_id)
        .single();
      if (data?.reservation_id) await releaseReservation(data.reservation_id);
      if (data?.id) await advance(db, data.id, "signature_failed", "Signature check failed");
    }
    await markLocally("signature_failed");
    return NextResponse.json({ verified: false }, { status: 400 });
  }

  if (db) {
    const { data } = await db
      .from("orders")
      .select("id, reservation_id, coupon_code, user_id")
      .eq("razorpay_order_id", razorpay_order_id)
      .single();
    if (data?.reservation_id) await commitReservation(data.reservation_id);
    await db
      .from("orders")
      .update({ razorpay_payment_id, paid_at: new Date().toISOString() })
      .eq("razorpay_order_id", razorpay_order_id);
    if (data?.id) await advance(db, data.id, "paid", "Payment received");

    // Redemption counts live in the config blob either way, so they are
    // recorded here even when Postgres holds the order.
    if (data?.coupon_code) {
      await updateAdminData((draft) =>
        applyRedemption(draft, data.coupon_code, data.user_id ?? undefined, String(data.id)),
      );
    }
  }

  const localId = await markLocally("paid");
  if (!db && localId) {
    await updateAdminData((draft) => {
      const o = draft.orders.find((x) => x.id === localId);
      if (o?.couponCode) applyRedemption(draft, o.couponCode, o.userId, o.id);
    });
  }
  return NextResponse.json({ verified: true, orderId: razorpay_order_id });
}
