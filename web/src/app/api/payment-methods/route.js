import { NextResponse } from "next/server";
import { enabledMethods } from "@/lib/razorpay/preferences";

/**
 * Which online payment methods the checkout should offer.
 *
 * `null` means Razorpay could not be asked — the review page then shows all
 * of them rather than blocking checkout on a lookup that happened to fail.
 * Cash on delivery is ours, not Razorpay's, so it is never filtered here.
 */
export async function GET() {
  const methods = await enabledMethods();
  return NextResponse.json(
    { methods },
    { headers: { "cache-control": "public, max-age=300" } },
  );
}
