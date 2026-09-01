import { NextResponse } from "next/server";
import { requireUser } from "@/lib/firebase/admin";
import { loadOrders } from "@/lib/admin/orders";

/** The signed-in shopper's own orders. Never anyone else's — the uid comes
 *  from the verified session cookie, not from the request. */
export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const orders = (await loadOrders()).filter((o) => o.userId === auth.user.uid);
  return NextResponse.json({ orders }, { headers: { "cache-control": "no-store" } });
}
