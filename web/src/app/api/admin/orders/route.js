import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { updateAdminData } from "@/lib/admin/store";
import { loadOrders } from "@/lib/admin/orders";
import { getAdminSupabase } from "@/lib/supabase/server";

const NOTE = {
  cancelled: "Order cancelled",
  shipped: "Handed to the courier",
  delivered: "Delivered",
  refunded: "Refund issued",
};

const FLOW = {
  created: ["cancelled"],
  paid: ["shipped", "refunded", "cancelled"],
  // Cash orders are confirmed but unpaid until the courier collects, so they
  // ship first and only become "paid" on delivery.
  cod_pending: ["shipped", "cancelled"],
  shipped: ["delivered", "refunded", "cancelled"],
  delivered: ["refunded"],
};

export async function GET(req) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const q = (url.searchParams.get("q") ?? "").toLowerCase();

  const orders = await loadOrders();

  const filtered = orders.filter((o) => {
    if (status && status !== "all" && o.status !== status) return false;
    if (!q) return true;
    return [o.receipt, o.email, o.pincode, o.razorpayPaymentId, ...o.lines.map((l) => l.name)]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(q);
  });

  return NextResponse.json({ orders: filtered });
}

/** Advance an order along the fulfilment flow. */
export async function PATCH(req) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id, status } = await req.json().catch(() => ({}));
  if (!id || !status) return NextResponse.json({ error: "Missing id or status." }, { status: 400 });

  const db = getAdminSupabase();
  if (db) {
    const { data: row } = await db.from("orders").select("status").eq("id", id).single();
    if (!row) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (!(FLOW[row.status] ?? []).includes(status)) {
      return NextResponse.json(
        { error: `Cannot move an order from ${row.status} to ${status}.` },
        { status: 409 },
      );
    }
    const entry = { status, at: new Date().toISOString(), note: NOTE[status] };
    const { error } = await db.rpc("append_order_status", {
      p_order_id: id,
      p_status: status,
      p_entry: entry,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 502 });
    return NextResponse.json({ ok: true });
  }

  const { result } = await updateAdminData((draft) => {
    const o = draft.orders.find((x) => x.id === id);
    if (!o) return "missing";
    if (!(FLOW[o.status] ?? []).includes(status)) return "illegal";
    o.status = status;
    (o.timeline ??= []).push({
      status,
      at: new Date().toISOString(),
      note: NOTE[status],
    });
    return "ok";
  });

  if (result === "missing")
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (result === "illegal")
    return NextResponse.json({ error: "That status change is not allowed." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
