import { NextResponse } from "next/server";
import { requireUser } from "@/lib/firebase/admin";
import { loadOrders } from "@/lib/admin/orders";

/** One order, for the person who placed it. The uid comes from the verified
 *  session cookie, so a guessed receipt number gets you nothing. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ receipt: string }> },
) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { receipt } = await params;
  const order = (await loadOrders()).find(
    (o) => o.receipt === receipt && o.userId === auth.user.uid,
  );

  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  return NextResponse.json({ order }, { headers: { "cache-control": "no-store" } });
}
